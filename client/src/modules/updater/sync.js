/**
 * Ganj4Craft Launcher - File Sync Module
 * Основная логика синхронизации файлов с манифестом
 */

const fs = require('fs');
const path = require('path');
const { resolveUnderRoot, getFileHash, ensureDir, isModDisabled } = require('./utils');
const { downloadFile, downloadWithRetry } = require('./download');
const { resolveModrinthUrls } = require('./modrinth');
const { cleanupAll } = require('./cleanup');

// Категории файлов для защиты/обновления
const FILE_CATEGORIES = {
    // Сервер-контролируемые файлы — всегда обновляются
    serverControlled: [
        'client_config/',
        'fancymenu_data/',
        'config/fancymenu/',
        'config/fancymenu-',
        'resourcepacks/[GanjaCraft]',
        'kubejs/'
    ],
    // Пользовательские файлы — защищены если существуют локально
    userProtected: [
        'options.txt',
        'servers.dat'
    ]
};

/**
 * Проверить, является ли файл сервер-контролируемым
 */
function isServerControlled(filePath) {
    return FILE_CATEGORIES.serverControlled.some(prefix => filePath.startsWith(prefix));
}

/**
 * Проверить, является ли файл пользовательским (защищённым)
 */
function isUserProtected(filePath) {
    // options.txt, servers.dat
    if (FILE_CATEGORIES.userProtected.includes(filePath)) {
        return true;
    }
    // config/* кроме сервер-контролируемых
    if (filePath.startsWith('config/') && !isServerControlled(filePath)) {
        return true;
    }
    return false;
}

function formatBytes(bytes) {
    if (!bytes || typeof bytes !== 'number' || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getSourceInfo(url) {
    if (!url) return { name: 'Сервер', icon: '📦' };
    if (url.includes('modrinth.com')) return { name: 'Modrinth CDN', icon: '⚡' };
    return { name: 'Сервер Ganj4Craft', icon: '📦' };
}

/**
 * Синхронизация файлов с манифестом сервера
 * @param {string} rootPath - Путь к папке игры
 * @param {string} manifestUrl - URL манифеста
 * @param {function} sendLog - Callback для логирования
 * @param {function} onProgress - Callback для прогресса {task, total, type}
 * @param {string[]} disabledMods - Список путей отключённых модов
 * @param {function} checkCancelled - Функция проверки отмены
 */
/**
 * Синхронизация файлов с манифестом сервера
 * @param {string} rootPath - Путь к папке игры
 * @param {string} manifestUrl - URL манифеста
 * @param {function} sendLog - Callback для логирования
 * @param {function} onProgress - Callback для прогресса {task, total, type}
 * @param {string[]} disabledMods - Список путей отключённых модов
 * @param {function} checkCancelled - Функция проверки отмены
 * @param {object} options - Дополнительные опции (signal и т.д.)
 */
async function syncFiles(rootPath, manifestUrl, sendLog, onProgress, disabledMods = [], checkCancelled = () => false, options = {}) {
    const signal = options.signal;
    const isCancelled = () => checkCancelled() || Boolean(signal && signal.aborted);

    if (isCancelled()) {
        throw new Error('CANCELLED');
    }

    sendLog('Проверка обновлений...');
    
    // 1. Скачиваем манифест
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadWithRetry(manifestUrl, manifestPath, { timeoutMs: 15_000, signal });
    } catch (e) {
        if (e.message === 'CANCELLED' || isCancelled()) {
            throw new Error('CANCELLED');
        }
        sendLog('Ошибка загрузки манифеста: ' + e.message);
        throw e;
    }

    if (isCancelled()) {
        throw new Error('CANCELLED');
    }

    // 2. Парсим манифест
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        sendLog('Ошибка чтения манифеста: некорректный JSON');
        throw e;
    }

    if (!manifest || !Array.isArray(manifest.files)) {
        throw new Error('Invalid manifest format: files[] is missing');
    }

    sendLog(`Найдено ${manifest.files.length} файлов в манифесте.`);

    // 2.5. Быстрый резолвинг модов через Modrinth CDN (по SHA1 хешам)
    const jarHashes = manifest.files
        .filter(f => f && f.hash && typeof f.path === 'string' && f.path.endsWith('.jar'))
        .map(f => f.hash);

    if (jarHashes.length > 0 && !isCancelled()) {
        sendLog('Поиск модов на Modrinth CDN...');
        try {
            const modrinthMap = await resolveModrinthUrls(jarHashes);
            const resolvedCount = Object.keys(modrinthMap).length;
            if (resolvedCount > 0) {
                for (const file of manifest.files) {
                    if (file && file.hash && modrinthMap[file.hash.toLowerCase()] && modrinthMap[file.hash.toLowerCase()].cdnUrl) {
                        file.url = modrinthMap[file.hash.toLowerCase()].cdnUrl;
                    }
                }
            }
        } catch (mErr) {
            sendLog(`Предупреждение Modrinth CDN: ${mErr.message}`);
        }
    }

    if (isCancelled()) {
        throw new Error('CANCELLED');
    }

    // 2.6. Подсчет статистики источников
    let modrinthCount = 0;
    let serverCount = 0;
    for (const f of manifest.files) {
        const src = getSourceInfo(f.url);
        if (src.name.includes('Modrinth')) modrinthCount++;
        else serverCount++;
    }

    sendLog(`📊 Источники: ⚡ Modrinth CDN (${modrinthCount}) | 📦 Сервер (${serverCount})`);

    // 3. Обрабатываем файлы параллельно
    const CONCURRENCY = 4;
    let processed = 0;
    let downloaded = 0;
    const totalFiles = manifest.files.length;
    const queue = [...manifest.files];
    
    async function processFile(file) {
        // Проверка отмены
        if (isCancelled()) {
            queue.length = 0;
            throw new Error('CANCELLED');
        }

        // Пропуск отключённых модов (удаляем если существуют)
        if (file && typeof file.path === 'string' && isModDisabled(file.path, disabledMods)) {
            const localPath = resolveUnderRoot(rootPath, file.path);
            if (fs.existsSync(localPath)) {
                sendLog(`Удаление отключенного мода: ${file.path}`);
                try { fs.rmSync(localPath, { force: true }); } catch {}
            }
            return;
        }

        // Валидация записи манифеста
        if (!file || typeof file.path !== 'string' || typeof file.url !== 'string' || typeof file.hash !== 'string') {
            throw new Error('Invalid manifest file entry');
        }

        const localPath = resolveUnderRoot(rootPath, file.path);
        const localDir = path.dirname(localPath);

        // Защита пользовательских файлов
        if (isUserProtected(file.path) && fs.existsSync(localPath)) {
            processed++;
            if (onProgress) {
                onProgress({ task: processed, total: totalFiles, type: 'mods' });
            }
            return;
        }

        // Создаём директорию
        ensureDir(localDir);

        // Проверяем нужно ли скачивать
        let needDownload = false;

        if (!fs.existsSync(localPath)) {
            needDownload = true;
        } else {
            // Оптимизация: сначала проверяем размер
            if (file.size) {
                try {
                    const stats = fs.statSync(localPath);
                    if (stats.size !== file.size) {
                        needDownload = true;
                    }
                } catch {
                    needDownload = true;
                }
            }

            // Если размер совпал — проверяем хеш
            if (!needDownload) {
                try {
                    const localHash = await getFileHash(localPath);
                    if (localHash !== file.hash) {
                        needDownload = true;
                    }
                } catch {
                    needDownload = true;
                }
            }
        }

        if (isCancelled()) {
            queue.length = 0;
            throw new Error('CANCELLED');
        }

        // Скачиваем если нужно
        if (needDownload) {
            const src = getSourceInfo(file.url);
            const sizeStr = formatBytes(file.size);
            sendLog(`[${processed + 1}/${totalFiles}] ${src.icon} [${src.name}] Скачивание ${file.path} (${sizeStr})...`);
            await downloadWithRetry(file.url, localPath, {
                expectedHash: file.hash,
                expectedSize: typeof file.size === 'number' ? file.size : null,
                signal,
            }, 4, 1500);
            downloaded++;
        }
        
        processed++;
        const src = getSourceInfo(file.url);
        if (onProgress) {
            onProgress({
                task: processed,
                total: totalFiles,
                type: 'mods',
                currentFile: file.path,
                sourceName: src.name,
                sizeFormatted: formatBytes(file.size)
            });
        }
    }

    // Запускаем параллельную обработку
    const failedFiles = [];
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
            while (queue.length > 0) {
                if (isCancelled()) {
                    queue.length = 0;
                    throw new Error('CANCELLED');
                }
                const file = queue.shift();
                try {
                    await processFile(file);
                } catch (err) {
                    if (err.message === 'CANCELLED' || isCancelled()) {
                        queue.length = 0;
                        throw err;
                    }
                    sendLog(`Предупреждение: не удалось сразу скачать ${file?.path || 'unknown'}, отложено для повтора...`);
                    failedFiles.push(file);
                }
            }
        })());
    }

    await Promise.all(workers);

    if (isCancelled()) {
        throw new Error('CANCELLED');
    }

    // Повторный проход для файлов, упавших во время параллельного скачивания
    if (failedFiles.length > 0) {
        sendLog(`Повторная попытка скачивания для ${failedFiles.length} файлов...`);
        const finalFailures = [];
        for (const file of failedFiles) {
            if (isCancelled()) throw new Error('CANCELLED');
            try {
                await processFile(file);
            } catch (err) {
                if (err.message === 'CANCELLED' || isCancelled()) throw err;
                sendLog(`Ошибка обработки ${file?.path || 'unknown'}: ${err.message}`);
                finalFailures.push(file);
            }
        }
        if (finalFailures.length > 0) {
            throw new Error(`Не удалось скачать ${finalFailures.length} файлов из манифеста после повторов.`);
        }
    }

    if (isCancelled()) {
        throw new Error('CANCELLED');
    }

    sendLog('Все файлы проверены.');

    // 4. Очистка устаревших файлов
    cleanupAll(rootPath, manifest, disabledMods, sendLog);

    // 5. Итоговое сообщение
    if (downloaded > 0) {
        sendLog(`Обновление завершено. Скачано: ${downloaded}`);
    } else {
        sendLog('Обновление завершено. Файлы проверены.');
    }
}

module.exports = { 
    syncFiles,
    isServerControlled,
    isUserProtected,
    FILE_CATEGORIES
};
