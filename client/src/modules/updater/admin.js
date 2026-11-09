/**
 * Ganj4Craft Launcher - Admin Sync Tools
 * Инструменты для разработчиков/администраторов:
 * - Синхронизация отдельных категорий
 * - Удаление категорий
 * - Подсчёт файлов
 * - Загрузка server_scripts (только для админов)
 */

const fs = require('fs');
const path = require('path');
const { downloadFile } = require('./download');
const { API_BASE } = require('../../main-process/constants');

/**
 * Синхронизация конкретной категории файлов
 * @param {string} rootPath - Путь к папке игры
 * @param {string} manifestUrl - URL манифеста
 * @param {string} category - Категория: 'mods', 'config', 'kubejs', 'resourcepacks', 'thingpacks'
 * @param {object} options - Опции
 * @param {boolean} options.force - Принудительная перезагрузка (игнорировать хеш)
 * @param {string[]} options.kubejsFolders - Подпапки KubeJS для синхронизации
 * @param {function} options.sendLog - Callback логирования
 * @param {AbortSignal} options.abortSignal - Сигнал отмены операции
 */
async function syncCategory(rootPath, manifestUrl, category, options = {}) {
    const {
        force = false,
        kubejsFolders = ['client_scripts', 'startup_scripts', 'server_scripts'],
        sendLog = () => {},
        abortSignal = null
    } = options;

    // Проверка отмены
    if (abortSignal?.aborted) {
        throw new Error('Operation cancelled');
    }

    // Скачиваем манифест
    const manifestPath = path.join(rootPath, 'manifest.json');
    try {
        await downloadFile(manifestUrl, manifestPath, { timeoutMs: 10_000 });
    } catch (e) {
        throw new Error(`Ошибка загрузки манифеста: ${e.message}`);
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        throw new Error('Ошибка чтения манифеста: некорректный JSON');
    }

    if (!manifest || !Array.isArray(manifest.files)) {
        throw new Error('Invalid manifest format');
    }

    // Фильтруем файлы по категории
    let files = [];
    switch (category) {
        case 'mods':
            files = manifest.files.filter(f => f.path.startsWith('mods/') && f.path.endsWith('.jar'));
            break;
        case 'config':
            files = manifest.files.filter(f => f.path.startsWith('config/') || f.path.startsWith('client_config/'));
            break;
        case 'kubejs':
            files = manifest.files.filter(f => {
                if (!f.path.startsWith('kubejs/')) return false;
                const subPath = f.path.substring('kubejs/'.length);
                return kubejsFolders.some(folder => 
                    subPath.startsWith(folder + '/') || subPath === folder
                );
            });
            break;
        case 'resourcepacks':
            files = manifest.files.filter(f => f.path.startsWith('resourcepacks/'));
            break;
        case 'thingpacks':
            files = manifest.files.filter(f => f.path.startsWith('thingpacks/'));
            break;
        default:
            throw new Error(`Unknown category: ${category}`);
    }

    sendLog(`Найдено ${files.length} файлов в категории ${category}`);

    // Подсчёт локальных файлов
    const countLocalFiles = () => {
        let count = 0;
        for (const file of files) {
            if (!file || typeof file.path !== 'string') continue;
            try {
                const localPath = resolveUnderRoot(rootPath, file.path);
                if (fs.existsSync(localPath)) count++;
            } catch {}
        }
        return count;
    };

    // Начальный счётчик
    const initialLocal = countLocalFiles();
    sendLog({
        type: 'counter-update',
        localCount: initialLocal,
        manifestCount: files.length,
        message: `Найдено ${files.length} файлов в категории ${category}`
    });

    let downloaded = 0;
    let skipped = 0;

    for (const file of files) {
        // Проверка отмены
        if (abortSignal?.aborted) {
            sendLog('Операция отменена');
            throw new Error('Operation cancelled');
        }

        if (!file || typeof file.path !== 'string' || typeof file.url !== 'string') {
            continue;
        }

        const localPath = resolveUnderRoot(rootPath, file.path);
        const localDir = path.dirname(localPath);
        ensureDir(localDir);

        let needDownload = force;

        if (!needDownload) {
            if (!fs.existsSync(localPath)) {
                needDownload = true;
            } else if (file.hash) {
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

        if (needDownload) {
            sendLog(`Загрузка: ${file.path}`);
            try {
                await downloadFile(file.url, localPath, {
                    expectedHash: force ? null : file.hash,
                    expectedSize: typeof file.size === 'number' ? file.size : null,
                });
                downloaded++;

                // Обновление счётчика в реальном времени
                const currentLocal = countLocalFiles();
                sendLog({
                    type: 'counter-update',
                    localCount: currentLocal,
                    manifestCount: files.length,
                    message: `Загрузка: ${file.path}`
                });
            } catch (e) {
                sendLog(`Ошибка загрузки ${file.path}: ${e.message}`);
            }
        } else {
            skipped++;
        }
    }

    sendLog(`Готово. Скачано: ${downloaded}, пропущено: ${skipped}`);
    return { downloaded, skipped, total: files.length };
}

/**
 * Удаление всех файлов в категории
 * @param {string} rootPath - Путь к папке игры
 * @param {string} category - Категория для удаления
 */
async function deleteCategory(rootPath, category) {
    let targetPath;
    let deletePattern = null;

    switch (category) {
        case 'mods':
            targetPath = path.join(rootPath, 'mods');
            break;
        case 'config':
            targetPath = path.join(rootPath, 'config');
            break;
        case 'kubejs':
            targetPath = path.join(rootPath, 'kubejs');
            break;
        case 'resourcepacks':
            targetPath = path.join(rootPath, 'resourcepacks');
            deletePattern = /^\[GanjaCraft\]/; // Только серверные ресурспаки
            break;
        case 'thingpacks':
            targetPath = path.join(rootPath, 'thingpacks');
            break;
        default:
            throw new Error(`Unknown category: ${category}`);
    }

    if (!fs.existsSync(targetPath)) {
        return { deleted: 0, message: 'Папка не существует' };
    }

    let deleted = 0;

    if (deletePattern) {
        // Селективное удаление (например, только [GanjaCraft] ресурспаки)
        const entries = fs.readdirSync(targetPath);
        for (const entry of entries) {
            if (deletePattern.test(entry)) {
                const fullPath = path.join(targetPath, entry);
                try {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    deleted++;
                } catch (e) {
                    console.error(`Failed to delete ${fullPath}:`, e);
                }
            }
        }
    } else {
        // Удаление всего содержимого
        const entries = fs.readdirSync(targetPath);
        for (const entry of entries) {
            const fullPath = path.join(targetPath, entry);
            try {
                fs.rmSync(fullPath, { recursive: true, force: true });
                deleted++;
            } catch (e) {
                console.error(`Failed to delete ${fullPath}:`, e);
            }
        }
    }

    return { deleted, message: `Удалено ${deleted} элементов` };
}

/**
 * Подсчёт файлов в каждой категории (локально и в манифесте)
 * @param {string} rootPath - Путь к папке игры
 * @param {string} manifestUrl - URL манифеста
 */
async function getCategoryCounts(rootPath, manifestUrl) {
    // Пробуем скачать свежий манифест
    let manifest = null;
    try {
        const manifestPath = path.join(rootPath, 'manifest.json');
        await downloadFile(manifestUrl, manifestPath, { timeoutMs: 10_000 });
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
        // Используем локальный манифест если загрузка не удалась
        try {
            const localManifest = path.join(rootPath, 'manifest.json');
            if (fs.existsSync(localManifest)) {
                manifest = JSON.parse(fs.readFileSync(localManifest, 'utf-8'));
            }
        } catch {}
    }

    const counts = {
        mods: { local: 0, manifest: 0, size: 0 },
        config: { local: 0, manifest: 0, size: 0 },
        kubejs: { local: 0, manifest: 0, size: 0 },
        resourcepacks: { local: 0, manifest: 0, size: 0 },
        thingpacks: { local: 0, manifest: 0, size: 0 }
    };

    // Подсчёт локальных файлов
    const countLocalFiles = (dir, recursive = true) => {
        if (!fs.existsSync(dir)) return 0;
        let count = 0;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile()) {
                    count++;
                } else if (entry.isDirectory() && recursive) {
                    count += countLocalFiles(path.join(dir, entry.name), true);
                }
            }
        } catch {}
        return count;
    };

    counts.mods.local = countLocalFiles(path.join(rootPath, 'mods'), false);
    counts.config.local = countLocalFiles(path.join(rootPath, 'config'), true);
    counts.kubejs.local = countLocalFiles(path.join(rootPath, 'kubejs'), true);
    counts.resourcepacks.local = countLocalFiles(path.join(rootPath, 'resourcepacks'), true);
    counts.thingpacks.local = countLocalFiles(path.join(rootPath, 'thingpacks'), true);

    // Подсчёт файлов в манифесте
    if (manifest && Array.isArray(manifest.files)) {
        for (const f of manifest.files) {
            if (!f || typeof f.path !== 'string') continue;
            const size = typeof f.size === 'number' ? f.size : 0;
            
            if (f.path.startsWith('mods/')) {
                counts.mods.manifest++;
                counts.mods.size += size;
            }
            else if (f.path.startsWith('config/') || f.path.startsWith('client_config/')) {
                counts.config.manifest++;
                counts.config.size += size;
            }
            else if (f.path.startsWith('kubejs/')) {
                counts.kubejs.manifest++;
                counts.kubejs.size += size;
            }
            else if (f.path.startsWith('resourcepacks/')) {
                counts.resourcepacks.manifest++;
                counts.resourcepacks.size += size;
            }
            else if (f.path.startsWith('thingpacks/')) {
                counts.thingpacks.manifest++;
                counts.thingpacks.size += size;
            }
        }
    }

    return counts;
}

/**
 * Загрузка server_scripts с админского манифеста
 * server_scripts НЕ включены в обычный манифест для игроков
 * Требуется авторизация администратора
 * 
 * @param {string} rootPath - Путь к папке игры
 * @param {string} manifestUrl - Базовый URL (не используется)
 * @param {function} sendLog - Callback логирования
 * @param {string} authToken - Токен администратора
 * @param {object} options - Опции (force)
 */
async function fetchServerScripts(rootPath, manifestUrl, sendLog = () => {}, authToken = null, options = {}) {
    sendLog('Подготовка к загрузке server_scripts...');
    
    const { force = false } = options;

    if (!authToken) {
        sendLog('Ошибка: Требуется авторизация администратора');
        sendLog('Функция доступна только для администраторов сервера');
        return { success: false, downloaded: 0, message: 'Требуется авторизация админа' };
    }
    
    const serverScriptsPath = path.join(rootPath, 'kubejs', 'server_scripts');
    ensureDir(serverScriptsPath);
    
    sendLog('Загрузка списка server_scripts с сервера...');
    
    try {
        // Запрашиваем админский манифест (включает server_scripts)
        const adminManifestUrl = `${API_BASE}/admin/manifest-full.json`;
        const adminManifestPath = path.join(rootPath, 'manifest-admin-temp.json');
        
        sendLog('Запрос admin manifest: ' + adminManifestUrl);
        
        try {
            await downloadFile(adminManifestUrl, adminManifestPath, {
                timeoutMs: 30_000,
                authToken: authToken
            });
        } catch (e) {
            sendLog('Admin manifest недоступен: ' + e.message);
            sendLog('Для загрузки server_scripts используйте прямой доступ к серверу или Git.');
            return { success: true, downloaded: 0, message: 'Admin manifest недоступен' };
        }
        
        let adminManifest;
        try {
            adminManifest = JSON.parse(fs.readFileSync(adminManifestPath, 'utf-8'));
        } catch (e) {
            throw new Error('Ошибка чтения admin manifest');
        }
        
        // Удаляем временный файл
        try { fs.unlinkSync(adminManifestPath); } catch {}
        
        if (!adminManifest || !Array.isArray(adminManifest.files)) {
            throw new Error('Invalid admin manifest format');
        }
        
        // Фильтруем server_scripts
        const serverScripts = adminManifest.files.filter(f =>
            f.path && f.path.startsWith('kubejs/server_scripts/')
        );
        
        if (serverScripts.length === 0) {
            sendLog('server_scripts не найдены в admin manifest');
            return { success: true, downloaded: 0, message: 'Нет server_scripts' };
        }
        
        sendLog(`Найдено ${serverScripts.length} server_scripts файлов`);
        
        let downloaded = 0;
        for (const file of serverScripts) {
            const localPath = resolveUnderRoot(rootPath, file.path);
            const localDir = path.dirname(localPath);
            ensureDir(localDir);
            
            // Check if download is needed
            let needDownload = force;
            if (!needDownload) {
                if (!fs.existsSync(localPath)) {
                    needDownload = true;
                } else if (file.hash) {
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

            if (needDownload) {
                sendLog(`Загрузка: ${file.path}`);
                try {
                    await downloadFile(file.url, localPath, {
                        expectedHash: force ? null : file.hash,
                        expectedSize: typeof file.size === 'number' ? file.size : null,
                    });
                    downloaded++;
                } catch (e) {
                    sendLog(`Ошибка: ${e.message}`);
                }
            }
        }
        
        sendLog(`Готово. Скачано: ${downloaded} файлов`);
        return { success: true, downloaded, total: serverScripts.length };
        
    } catch (e) {
        throw new Error(`Ошибка загрузки server_scripts: ${e.message}`);
    }
}

module.exports = {
    syncCategory,
    deleteCategory,
    getCategoryCounts,
    fetchServerScripts
};
