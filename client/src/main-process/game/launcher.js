/**
 * Ganj4Craft Launcher - Game Launcher
 * Основная логика запуска игры
 */

const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { Client } = require('minecraft-launcher-core');
const { downloadFile, syncFiles, downloadWithRetry } = require('../../modules/updater');
const { authenticateYggdrasil } = require('../../modules/auth');
const { checkAndDownloadJava, getJavaVersionInfo, REQUIRED_JAVA_MAJOR, preferJavaw, resolveJavaPath } = require('../../modules/java');
const { loadConfig, saveConfig, getProfileConfig } = require('../../modules/config');
const { cleanZeroByteFiles, isZipIntact } = require('./integrity');
const { ensureVanillaVersionFiles, preflightNeoForgeLibraries, ensureNeoForgeVersionJsonMerged, ensureAssetIndex, parseNeoForgeJvmArgs, verifyNeoForgeLibraries } = require('./neoforge');
const {
    CLIENT_VERSION,
    getBuildProfile,
    NEOFORGE_VERSION,
    MC_VERSION,
    MANIFEST_URL,
    getNeoForgeInstallerUrl,
    NEOFORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_URL,
    YGGDRASIL_AUTH_URL,
    BASE_URL,
    API_BASE,
    DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS,
    JVM_OPTIMIZATION_ARGS,
} = require('../constants');
const { discordRpc } = require('../discord/rpc');

// Global state
const launcher = new Client();
let isGameRunning = false;
let isLaunchCancelled = false;
let currentGameProcess = null;
const activeChildProcesses = new Set();
let launchAbortController = null;
let currentSendLog = null;
let currentSendDebug = null;

/**
 * Принудительно завершить дерево процессов (PID)
 */
function killProcessTree(procOrPid, sendDebug) {
    if (!procOrPid) return;
    const pid = typeof procOrPid === 'number' ? procOrPid : procOrPid.pid;
    if (!pid) return;

    if (sendDebug) sendDebug(`Killing process tree for PID: ${pid}`);

    if (process.platform === 'win32') {
        try {
            require('child_process').execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        } catch (e) {
            if (sendDebug) sendDebug(`taskkill notice: ${e.message}`);
        }
    } else {
        try {
            process.kill(-pid, 'SIGKILL');
        } catch {
            try {
                if (typeof procOrPid === 'object' && procOrPid.kill) {
                    procOrPid.kill('SIGKILL');
                } else {
                    process.kill(pid, 'SIGKILL');
                }
            } catch (e) {
                if (sendDebug) sendDebug(`SIGKILL notice: ${e.message}`);
            }
        }
    }
}

// Monkey-patch MCLC Handler to check cancellation and support fallback to VPS mirror on download failure
const MCLCHandler = require('minecraft-launcher-core/components/handler');
const originalDownloadAsync = MCLCHandler.prototype.downloadAsync;
const { getMirrorFallbackUrl } = require('../constants');

// Safe IPC helper functions to prevent crashing if renderer frame is disposed/destroyed
function safeSend(targetWin, channel, ...args) {
    try {
        if (targetWin && !targetWin.isDestroyed() && targetWin.webContents && !targetWin.webContents.isDestroyed() && !targetWin.webContents.isCrashed()) {
            targetWin.webContents.send(channel, ...args);
        }
    } catch (err) {
        // Silently ignore IPC send errors on closed/disposed frames
    }
}

function safeSenderSend(sender, channel, ...args) {
    try {
        if (sender && !sender.isDestroyed() && !sender.isCrashed()) {
            sender.send(channel, ...args);
        }
    } catch (err) {
        // Silently ignore IPC send errors on closed/disposed frames
    }
}

MCLCHandler.prototype.downloadAsync = async function (url, directory, name, retry, type) {
    if (isLaunchCancelled) {
        throw new Error('CANCELLED');
    }
    const fallbackUrl = getMirrorFallbackUrl(url);
    const filePath = path.join(directory, name);

    // Try original URL first
    let result = false;
    try {
        result = await originalDownloadAsync.call(this, url, directory, name, retry, type);
    } catch (e) {
        this.client.emit('debug', `[MCLC]: Download error for ${url}: ${e.message}`);
        result = false;
    }

    if (isLaunchCancelled) {
        throw new Error('CANCELLED');
    }

    // Validate downloaded file integrity (0-byte or corrupted ZIP/JAR)
    if (fs.existsSync(filePath)) {
        let isInvalid = false;
        try {
            const stat = fs.statSync(filePath);
            if (stat.size === 0) {
                isInvalid = true;
            } else if (name.endsWith('.jar') || name.endsWith('.zip')) {
                if (!(await isZipIntact(filePath))) {
                    isInvalid = true;
                }
            }
        } catch {
            isInvalid = true;
        }

        if (isInvalid) {
            try { fs.unlinkSync(filePath); } catch { }
            this.client.emit('debug', `[MCLC]: Cleaned up invalid/corrupted download: ${name}`);
            result = false;
        }
    }

    // MCLC resolves with `false` on 404/invalid, or `undefined` on error
    if (!result && fallbackUrl) {
        if (isLaunchCancelled) throw new Error('CANCELLED');
        this.client.emit('debug', `[MCLC]: Original URL failed or corrupted (${url}). Falling back to mirror: ${fallbackUrl}`);
        // Try fallback URL, without passing fallback logic further down
        let mirrorResult = false;
        try {
            mirrorResult = await originalDownloadAsync.call(this, fallbackUrl, directory, name, retry, type);
        } catch (e) {
            this.client.emit('debug', `[MCLC]: Mirror download error for ${fallbackUrl}: ${e.message}`);
            mirrorResult = false;
        }

        if (isLaunchCancelled) throw new Error('CANCELLED');

        // Clean up invalid file from mirror failure too
        if (fs.existsSync(filePath)) {
            let isInvalid = false;
            try {
                const stat = fs.statSync(filePath);
                if (stat.size === 0) {
                    isInvalid = true;
                } else if (name.endsWith('.jar') || name.endsWith('.zip')) {
                    if (!(await isZipIntact(filePath))) {
                        isInvalid = true;
                    }
                }
            } catch {
                isInvalid = true;
            }

            if (isInvalid) {
                try { fs.unlinkSync(filePath); } catch { }
                this.client.emit('debug', `[MCLC]: Cleaned up invalid/corrupted mirror download: ${name}`);
            }
        }
        return mirrorResult;
    }

    return result;
};

// Monkey-patch MCLC startMinecraft to capture and cancel process spawning
const originalStartMinecraft = Client.prototype.startMinecraft;
Client.prototype.startMinecraft = function (launchArguments) {
    if (isLaunchCancelled) {
        this.emit('debug', '[MCLC]: Launch was cancelled before startMinecraft, aborting process spawn.');
        const err = new Error('CANCELLED');
        this.emit('error', err);
        throw err;
    }

    const minecraft = originalStartMinecraft.call(this, launchArguments);
    currentGameProcess = minecraft;

    if (isLaunchCancelled) {
        this.emit('debug', '[MCLC]: Launch cancelled right after spawn, killing Minecraft process.');
        killProcessTree(minecraft);
        currentGameProcess = null;
        throw new Error('CANCELLED');
    }

    return minecraft;
};

/**
 * Проверить, запущена ли игра
 */
function getIsGameRunning() {
    return isGameRunning;
}

/**
 * Отменить запуск и принудительно закрыть игру
 */
function cancelLaunch() {
    isLaunchCancelled = true;
    isGameRunning = false;

    if (currentSendLog) {
        currentSendLog('[LAUNCHER] Отмена запуска и завершение процессов...');
    }

    // 1. Аборт сетевых запросов и загрузок
    if (launchAbortController) {
        try {
            launchAbortController.abort();
        } catch { }
    }

    // 2. Убийство активных вспомогательных подпроцессов (установщик Forge, распаковка Java и др.)
    for (const proc of activeChildProcesses) {
        killProcessTree(proc, currentSendDebug);
    }
    activeChildProcesses.clear();

    // 3. Убийство процесса игры Minecraft (если был запущен или запускается)
    if (currentGameProcess) {
        if (currentSendLog) {
            currentSendLog(`[LAUNCHER] Принудительное закрытие процесса игры (PID: ${currentGameProcess.pid})...`);
        }
        killProcessTree(currentGameProcess, currentSendDebug);
        currentGameProcess = null;
    }

    // 4. Остановка отслеживания модов
    stopModWatcher();

    return true;
}

/**
 * Вычислить дефолтные отключённые моды из манифеста
 */
function computeDefaultDisabledModsFromManifest(manifest) {
    try {
        if (!manifest || !Array.isArray(manifest.files)) return [];
        return manifest.files
            .filter(f => f && f.optional && typeof f.path === 'string' && f.path.startsWith('mods/') && f.path.endsWith('.jar'))
            .filter(f => {
                const fileName = f.path.split('/').pop();
                return DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS.some(p => fileName.toLowerCase().includes(p.toLowerCase()));
            })
            .map(f => f.path);
    } catch {
        return [];
    }
}

/**
 * Создать логгеры для запуска
 */
function createLoggers(event, rootPath, config) {
    const logFile = path.join(rootPath, 'launcher.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'w' });

    logStream.write(`--- Log started at ${new Date().toISOString()} ---\n`);

    const sendLog = (msg) => {
        safeSenderSend(event.sender, 'log-message', msg);
        const timestamp = new Date().toISOString();
        if (logStream && !logStream.destroyed) {
            logStream.write(`[${timestamp}] ${msg}\n`);
        }
    };

    const sendDebug = (msg) => {
        const timestamp = new Date().toISOString();
        if (logStream && !logStream.destroyed) {
            logStream.write(`[${timestamp}] [DEBUG] ${msg}\n`);
        }
    };

    return { logStream, sendLog, sendDebug };
}

let activeModWatcher = null;
let watcherDebounceTimeout = null;
let watcherInterval = null;
const { isModDisabled } = require('../../modules/updater/utils');

/**
 * Запустить слежение за папкой mods/ во время игры
 */
function startModWatcher(rootPath, config, gameProc, sendLog) {
    stopModWatcher();

    const modsDir = path.join(rootPath, 'mods');
    if (!fs.existsSync(modsDir)) return;

    const manifestPath = path.join(rootPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;

    let manifestMods;
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const disabledMods = Array.isArray(config.disabledMods) ? config.disabledMods : [];
        manifestMods = new Set(
            (manifest.files || [])
                .filter(f => f && typeof f.path === 'string' && f.path.startsWith('mods/') && !isModDisabled(f.path, disabledMods))
                .map(f => path.normalize(f.path).toLowerCase())
        );
    } catch (e) {
        sendLog(`[SECURITY] Ошибка чтения манифеста для слежки: ${e.message}`);
        return;
    }

    sendLog(`[SECURITY] Запуск отслеживания папки модов (PID игры: ${gameProc?.pid || 'unknown'})...`);

    const checkModsFolder = () => {
        if (!isGameRunning || !fs.existsSync(modsDir)) return;

        let detectedCheat = false;
        const cheatsFound = [];

        function scanDir(dir) {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch { return; }

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = path.relative(rootPath, fullPath);
                const normalizedPath = path.normalize(relPath).toLowerCase();

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else {
                    if (!manifestMods.has(normalizedPath)) {
                        detectedCheat = true;
                        cheatsFound.push({ fullPath, relPath });
                    }
                }
            }
        }

        scanDir(modsDir);

        if (detectedCheat) {
            for (const cheat of cheatsFound) {
                sendLog(`[SECURITY GUARD] СТОРОННИЙ МОД ОБНАРУЖЕН: ${cheat.relPath}`);
                try {
                    fs.unlinkSync(cheat.fullPath);
                    sendLog(`[SECURITY GUARD] Успешно удалён сторонний мод: ${cheat.relPath}`);
                } catch (e) {
                    sendLog(`[SECURITY GUARD] Не удалось удалить ${cheat.relPath}: ${e.message}`);
                }
            }

            sendLog('[SECURITY GUARD] ОБНАРУЖЕН СТОРОННИЙ МОД/ЧИТ! ПРИНУДИТЕЛЬНОЕ УБИЙСТВО ИГРЫ!');
            if (gameProc && gameProc.pid) {
                const pid = gameProc.pid;
                sendLog(`[SECURITY GUARD] Убийство процесса игры (PID: ${pid})...`);
                if (process.platform === 'win32') {
                    try {
                        require('child_process').execSync(`taskkill /F /T /PID ${pid}`);
                    } catch (err) {
                        sendLog(`[SECURITY GUARD] taskkill err: ${err.message}`);
                    }
                }
                try {
                    gameProc.kill('SIGKILL');
                } catch { }
            }
        }
    };

    // 1. Сразу проверяем при старте
    checkModsFolder();

    // 2. Отслеживаем события ФС на уровне ядра ОС (0% нагрузки на диск/HDD)
    try {
        activeModWatcher = fs.watch(modsDir, { recursive: true }, () => {
            if (watcherDebounceTimeout) clearTimeout(watcherDebounceTimeout);
            watcherDebounceTimeout = setTimeout(checkModsFolder, 200);
        });
    } catch (e) {
        sendLog(`[SECURITY] Ошибка fs.watch: ${e.message}`);
    }
}

/**
 * Остановить слежение за папкой mods/
 */
function stopModWatcher() {
    if (watcherDebounceTimeout) {
        clearTimeout(watcherDebounceTimeout);
        watcherDebounceTimeout = null;
    }
    if (activeModWatcher) {
        try {
            activeModWatcher.close();
        } catch { }
        activeModWatcher = null;
    }
}

const CURRENT_MODS_DEFAULTS_VERSION = 2;

/**
 * Применить дефолтные настройки модов для свежих установок
 */
async function applyDefaultModSettings(config, rootPath, sendLog, sendDebug, options = {}) {
    const profile = options.profile || getBuildProfile(config.activeProfileId);
    if (config.modsDefaultsApplied === true && config.modsDefaultsVersion === CURRENT_MODS_DEFAULTS_VERSION) return config;
    const signal = options.signal;
    if (signal && signal.aborted) throw new Error('CANCELLED');

    sendLog('[SETUP] Применяю дефолтные настройки модов...');
    try {
        const manifestPath = path.join(rootPath, 'manifest.json');
        const manifestUrl = `${BASE_URL}/files/${profile.manifestPath}`;
        await downloadWithRetry(manifestUrl, manifestPath, { timeoutMs: 15_000, signal });
        if (signal && signal.aborted) throw new Error('CANCELLED');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const defaults = computeDefaultDisabledModsFromManifest(manifest);

        const profileConfig = getProfileConfig(config, profile.id);
        const existing = Array.isArray(profileConfig.disabledMods) ? profileConfig.disabledMods : [];
        const merged = Array.from(new Set([...existing, ...defaults]));
        config.profiles[profile.id].disabledMods = merged;
        config.profiles[profile.id].modsDefaultsApplied = true;
        config.profiles[profile.id].modsDefaultsVersion = CURRENT_MODS_DEFAULTS_VERSION;
        saveConfig(config);

        if (defaults.length > 0) {
            sendDebug(`Default disabled optional mods: ${JSON.stringify(defaults)}`);
        } else {
            sendDebug('Default disabled optional mods: none matched.');
        }
    } catch (e) {
        if (e.message === 'CANCELLED' || signal?.aborted) throw new Error('CANCELLED');
        sendLog('[SETUP] Не удалось применить дефолтные моды (продолжаю запуск).');
        sendDebug(`Default mods apply failed: ${e.stack || e.message}`);
    }

    return config;
}

/**
 * Подготовить и проверить Java
 */
async function prepareJava(config, rootPath, sendLog, sendDebug, options = {}) {
    const signal = options.signal;
    const requiredJavaMajor = options.javaMajor || REQUIRED_JAVA_MAJOR;
    const minecraftVersion = options.minecraftVersion || MC_VERSION;
    if (signal && signal.aborted) throw new Error('CANCELLED');

    let javaPath = config.javaPath ? resolveJavaPath(config.javaPath) : null;

    if (javaPath) {
        sendDebug(`Using custom Java path: ${javaPath}`);
        if (!fs.existsSync(javaPath)) {
            throw new Error("Неверный путь к Java. Проверьте настройки.");
        }

        // Verify Java version (Forge 1.20.1 requires Java 17+)
        const info = await getJavaVersionInfo(javaPath);
        if (!info || info.major < requiredJavaMajor) {
            throw new Error(
                `У вас указана неподходящая Java (нужна Java ${requiredJavaMajor}+ для Minecraft ${minecraftVersion}).\n\n` +
                `Решение:\n` +
                `1) Откройте настройки лаунчера и очистите поле "Java" (оставьте пустым) — лаунчер сам скачает JRE ${requiredJavaMajor}.\n` +
                `или\n` +
                `2) Укажите путь к java.exe из Java ${requiredJavaMajor}+.\n\n` +
                `Текущая Java: ${info?.major || 'не удалось определить'}`
            );
        }
        sendDebug(`Custom Java version OK: ${info.major}`);
    } else {
        // Auto-download Java if not set
        sendDebug('Checking/Downloading Java...');
        const downloadedJava = await checkAndDownloadJava(rootPath, sendLog, options);
        if (downloadedJava) {
            javaPath = downloadedJava;
            sendDebug(`Java downloaded/found at: ${javaPath}`);
        }
    }

    // Windows: prefer javaw.exe to avoid opening a console window
    if (process.platform === 'win32' && javaPath) {
        const preferredPath = preferJavaw(javaPath);
        if (preferredPath !== javaPath) {
            sendDebug(`Using javaw.exe to avoid console: ${preferredPath}`);
            javaPath = preferredPath;
        }
    }

    return javaPath;
}

/**
 * Подготовить Forge installer
 */
async function prepareForge(rootPath, sendLog, sendDebug, options = {}) {
    const signal = options.signal;
    const neoforgeVersion = options.neoforgeVersion || NEOFORGE_VERSION;
    const installerUrl = options.installerUrl || getNeoForgeInstallerUrl(neoforgeVersion);
    if (signal && signal.aborted) throw new Error('CANCELLED');

    const forgeInstallerPath = path.join(rootPath, `neoforge-${neoforgeVersion}-installer.jar`);
    let needForge = !fs.existsSync(forgeInstallerPath);

    if (!needForge) {
        const size = fs.statSync(forgeInstallerPath).size;
        if (size === 0 || !(await isZipIntact(forgeInstallerPath))) {
            sendLog('Обнаружен поврежденный установщик Forge (битый/не ZIP). Перекачивание...');
            try { fs.unlinkSync(forgeInstallerPath); } catch { }
            needForge = true;
        }
    }

    if (needForge) {
        sendLog('Скачивание установщика Forge...');
        sendDebug(`Downloading NeoForge from ${installerUrl}`);
        await downloadWithRetry(installerUrl, forgeInstallerPath, { timeoutMs: 120_000, signal });
        if (signal && signal.aborted) throw new Error('CANCELLED');
        if (!(await isZipIntact(forgeInstallerPath))) {
            try { fs.unlinkSync(forgeInstallerPath); } catch { }
            throw new Error('Downloaded Forge installer is not a valid JAR/ZIP (truncated or HTML response)');
        }
        sendLog('Установщик Forge скачан.');
    } else {
        sendLog('Установщик Forge найден.');
    }

    return forgeInstallerPath;
}

/**
 * Подготовить Authlib Injector
 */
async function prepareAuthlib(rootPath, sendLog, sendDebug, options = {}) {
    const signal = options.signal;
    if (signal && signal.aborted) throw new Error('CANCELLED');

    const authlibPath = path.join(rootPath, 'authlib-injector.jar');

    if (!fs.existsSync(authlibPath) || !(await isZipIntact(authlibPath))) {
        sendLog('Скачивание Authlib Injector...');
        sendDebug(`Downloading Authlib from ${AUTHLIB_INJECTOR_URL}`);
        await downloadFile(AUTHLIB_INJECTOR_URL, authlibPath, { timeoutMs: 60_000, signal });
        if (signal && signal.aborted) throw new Error('CANCELLED');
        if (!(await isZipIntact(authlibPath))) {
            try { fs.unlinkSync(authlibPath); } catch { }
            throw new Error('Downloaded authlib-injector is not a valid JAR/ZIP');
        }
        sendLog('Authlib Injector скачан.');
    }

    return authlibPath;
}

/**
 * Обязательные ресурспаки, которые всегда должны быть включены.
 * Игрок не может их убрать — лаунчер восстанавливает их при каждом запуске.
 */
const REQUIRED_RESOURCE_PACKS = [
    'file/[GanjaCraft] Main'
];

/**
 * Гарантировать наличие обязательных ресурспаков в options.txt
 * Добавляет паки в начало списка (перед vanilla/mod_resources), не трогая пользовательские.
 */
function ensureRequiredResourcePacks(rootPath, sendLog, sendDebug) {
    const optionsPath = path.join(rootPath, 'options.txt');

    try {
        let content = '';
        if (fs.existsSync(optionsPath)) {
            content = fs.readFileSync(optionsPath, 'utf-8');
        }

        // Parse the resourcePacks line
        const rpLineRegex = /^resourcePacks:(\[.*?\])\r?$/m;
        const match = content.match(rpLineRegex);

        let currentPacks = [];
        if (match) {
            try {
                currentPacks = JSON.parse(match[1]);
            } catch {
                currentPacks = [];
            }
        }

        // Add required packs if missing, placing them before 'vanilla' and 'mod_resources'
        let changed = false;
        for (const required of REQUIRED_RESOURCE_PACKS) {
            if (!currentPacks.includes(required)) {
                // Insert before 'vanilla' or 'mod_resources' if present, else at start
                const insertIdx = currentPacks.findIndex(p => p === 'vanilla' || p === 'mod_resources');
                if (insertIdx >= 0) {
                    currentPacks.splice(insertIdx, 0, required);
                } else {
                    currentPacks.unshift(required);
                }
                changed = true;
                sendDebug(`Required resource pack added to options.txt: ${required}`);
            }
        }

        if (changed || !match) {
            const newRpLine = `resourcePacks:${JSON.stringify(currentPacks)}`;
            if (match) {
                // Replace existing line
                content = content.replace(rpLineRegex, newRpLine);
            } else {
                // Append the line at end of file
                content = content.trimEnd() + '\n' + newRpLine + '\n';
            }
            fs.writeFileSync(optionsPath, content, 'utf-8');
            sendLog(`[SETUP] Ресурспаки обновлены в options.txt: ${JSON.stringify(currentPacks)}`);
        } else {
            sendDebug('Required resource packs already present in options.txt.');
        }
    } catch (e) {
        sendDebug(`ensureRequiredResourcePacks error: ${e.message}`);
        sendLog('Предупреждение: не удалось обновить options.txt с обязательными ресурспаками.');
    }
}

/**
 * Синхронизация модов
 */
async function syncMods(event, rootPath, config, sendLog, sendDebug, options = {}) {
    const profile = options.profile || getBuildProfile(config.activeProfileId);
    const manifestUrl = `${require('../constants').FILES_BASE}/${profile.manifestPath}`;
    const profileConfig = getProfileConfig(config, profile.id);
    const onSyncProgress = (p) => {
        safeSenderSend(event.sender, 'progress', p);
    };

    sendDebug('Starting syncFiles...');
    await syncFiles(rootPath, manifestUrl, sendLog, onSyncProgress, profileConfig.disabledMods, () => isLaunchCancelled, options);
    sendDebug('syncFiles completed.');

    // Copy custom client configs from client_config/ to config/ if present
    const clientConfigPath = path.join(rootPath, 'client_config');
    if (fs.existsSync(clientConfigPath)) {
        sendLog('Синхронизация клиентских настроек...');
        try {
            fs.cpSync(clientConfigPath, path.join(rootPath, 'config'), { recursive: true, force: true });
            sendDebug('Client configs copied from client_config/ to config/ successfully.');
        } catch (copyErr) {
            sendDebug(`Failed to copy client configs: ${copyErr.message}`);
            sendLog('Предупреждение: Не удалось применить клиентские настройки.');
        }
    }

    // Ensure required resource packs are always active in options.txt
    ensureRequiredResourcePacks(rootPath, sendLog, sendDebug);
}

/**
 * Подготовить Fabric version metadata для MCLC.
 */
async function ensureFabricVersionJson(rootPath, sendLog, sendDebug, options = {}) {
    const signal = options.signal;
    const minecraftVersion = options.minecraftVersion;
    const loaderVersion = options.fabricLoaderVersion;
    const versionId = `fabric-loader-${loaderVersion}-${minecraftVersion}`;
    const versionDir = path.join(rootPath, 'versions', versionId);
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    const metadataUrl = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;

    if (signal?.aborted) throw new Error('CANCELLED');

    let versionJson = null;
    if (fs.existsSync(versionJsonPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
            if (existing?.id === versionId && existing.inheritsFrom === minecraftVersion && Array.isArray(existing.libraries)) {
                versionJson = existing;
            }
        } catch { }
    }

    if (!versionJson) {
        sendLog(`Загрузка metadata Fabric Loader ${loaderVersion} для Minecraft ${minecraftVersion}...`);
        const response = await fetch(metadataUrl, { signal });
        if (!response.ok) throw new Error(`Fabric metadata вернул HTTP ${response.status}`);
        const metadata = await response.json();
        if (signal?.aborted) throw new Error('CANCELLED');
        if (!metadata || metadata.id !== versionId || metadata.inheritsFrom !== minecraftVersion || !Array.isArray(metadata.libraries)) {
            throw new Error(`Fabric metadata для ${versionId} имеет неожиданный формат`);
        }

        fs.mkdirSync(versionDir, { recursive: true });
        const tempPath = `${versionJsonPath}.tmp`;
        try {
            fs.writeFileSync(tempPath, JSON.stringify(metadata, null, 2), 'utf8');
            fs.renameSync(tempPath, versionJsonPath);
        } catch (error) {
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { }
            throw error;
        }
        versionJson = metadata;
        sendLog(`Fabric Loader ${loaderVersion} подготовлен.`);
    } else {
        sendDebug(`Fabric version metadata is valid: ${versionId}`);
    }

    return { versionId, versionJsonPath, versionJson };
}

function buildLaunchOptions(config, rootPath, javaPath, forgeInstallerPath, authlibPath, authSession, authlibPrefetched, profile) {
    const isNeoForge = profile.loader === 'neoforge';
    // Read NeoForge JVM args directly from version.json
    const parsedJvmArgs = isNeoForge ? parseNeoForgeJvmArgs(rootPath, {
        minecraftVersion: profile.minecraftVersion,
        neoforgeVersion: profile.neoforgeVersion,
    }) : [];

    let neoforgeModuleArgs;
    if (parsedJvmArgs) {
        // Parsed from version.json — exact paths, no guessing
        neoforgeModuleArgs = parsedJvmArgs;
    } else {
        // Fallback: if version.json is not yet created (first install), 
        // use empty — installer will create it on next run
        neoforgeModuleArgs = [];
    }

    const customArgs = [...neoforgeModuleArgs, ...JVM_OPTIMIZATION_ARGS];
    if (authlibPath && !authSession.isOffline) {
        if (authlibPrefetched) {
            customArgs.unshift(`-Dauthlibinjector.yggdrasil.prefetched=${authlibPrefetched}`);
        }
        customArgs.unshift(`-Dauthlibinjector.disableSniCheck=true`);
        customArgs.unshift(`-Dauthlibinjector.side=client`);
        customArgs.unshift(`-javaagent:${authlibPath}=${BASE_URL}/api/yggdrasil`);
    }

    const versionId = isNeoForge ? `neoforge-${profile.neoforgeVersion || NEOFORGE_VERSION}` : profile.loader === 'fabric' ? `fabric-loader-${profile.fabricLoaderVersion}-${profile.minecraftVersion}` : profile.minecraftVersion;
    const versionJsonPath = path.join(rootPath, 'versions', versionId, `${versionId}.json`);

    const nativesDir = path.join(rootPath, 'natives');
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

    const assetIndexDir = path.join(rootPath, 'assets', 'indexes');
    if (!fs.existsSync(assetIndexDir)) {
        fs.mkdirSync(assetIndexDir, { recursive: true });
    }

    return {
        clientPackage: null,
        authorization: {
            access_token: authSession.accessToken,
            client_token: authSession.clientToken,
            uuid: authSession.uuid,
            name: authSession.name,
            user_properties: "{}"
        },
        root: rootPath,
        quickPlay: profile.serverHost ? {
            type: 'legacy',
            identifier: `${profile.serverHost}:${profile.serverPort}`,
        } : undefined,
        timeout: 180_000,
        version: {
            number: profile.minecraftVersion,
            type: "release",
            custom: versionId
        },
        forge: isNeoForge ? null : undefined,
        memory: {
            max: config.memoryMax,
            min: config.memoryMin
        },
        javaPath: javaPath || undefined,
        overrides: {
            maxSockets: 8,
            assetIndex: (() => {
                try {
                    const vanillaJsonPath = path.join(rootPath, 'versions', profile.minecraftVersion, `${profile.minecraftVersion}.json`);
                    return JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf8')).assetIndex?.id || profile.minecraftVersion;
                } catch {
                    return profile.minecraftVersion;
                }
            })(),
            minArgs: 1,
            versionJson: versionJsonPath,
            natives: nativesDir,
            minecraftJar: path.join(rootPath, 'versions', profile.minecraftVersion, `${profile.minecraftVersion}.jar`),
        },
        customArgs: customArgs
    };
}

/**
 * Обработать ошибку запуска MCLC
 */
function purgeCorruptedNeoForge(rootPath, neoforgeVersion = NEOFORGE_VERSION) {
    // Delete corrupted version JSON so installer recreates it cleanly
    try {
        const neoforgeVerId = `neoforge-${neoforgeVersion}`;
        const neoforgeJsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);
        if (fs.existsSync(neoforgeJsonPath)) {
            fs.unlinkSync(neoforgeJsonPath);
        }
    } catch (e) { }
    // Delete cpw libraries (bootstraplauncher, securejarhandler)
    try {
        const cpwDir = path.join(rootPath, 'libraries', 'cpw');
        if (fs.existsSync(cpwDir)) {
            fs.rmSync(cpwDir, { recursive: true, force: true });
        }
    } catch (e) { }
}

function handleLaunchError(error, rootPath, profile) {
    const msg = (error && error.message) ? error.message : String(error);
    const isEperm = msg.includes('EPERM') || error?.code === 'EPERM';
    const isClassNotFound = msg.includes('NoClassDefFoundError') || msg.includes('modlauncher') || msg.includes('securejarhandler');

    if (isClassNotFound) {
        if (profile?.loader === 'neoforge') {
            purgeCorruptedNeoForge(rootPath, profile.neoforgeVersion || NEOFORGE_VERSION);
        }
        return {
            success: false,
            error:
                `Обнаружены поврежденные библиотеки NeoForge.\n\n` +
                `Лаунчер автоматически очистил поврежденные файлы.\n` +
                `Пожалуйста, нажмите кнопку «Играть» ещё раз — нужные файлы перескачаются автоматически!`
        };
    } else if (isEperm) {
        return {
            success: false,
            error:
                `Windows блокирует запись файлов игры (EPERM).\n\n` +
                `Быстрое решение:\n` +
                `1) Закройте лаунчер/игру, перезагрузите ПК\n` +
                `2) Добавьте папку ${rootPath} в исключения Защитника Windows/антивируса\n\n` +
                `Техническая ошибка: ${msg}`
        };
    }

    return { success: false, error: msg };
}

/**
 * Запустить игру
 */
async function launchGame(event, options) {
    if (isGameRunning) {
        return { success: false, error: "Игра уже запущена!" };
    }

    isGameRunning = true;
    isLaunchCancelled = false;
    currentGameProcess = null;
    activeChildProcesses.clear();
    launchAbortController = new AbortController();
    const signal = launchAbortController.signal;

    let config = loadConfig();
    const requestedProfileId = options && options.profileId;
    const profile = getBuildProfile(requestedProfileId || config.activeProfileId);
    const profileConfig = getProfileConfig(config, profile.id);
    config.activeProfileId = profile.id;
    const rootPath = profileConfig.installPath;

    if (!fs.existsSync(rootPath)) {
        fs.mkdirSync(rootPath, { recursive: true });
    }

    const { logStream, sendLog, sendDebug } = createLoggers(event, rootPath, config);
    currentSendLog = sendLog;
    currentSendDebug = sendDebug;

    const checkCancelled = () => {
        if (isLaunchCancelled || signal.aborted) {
            throw new Error('CANCELLED');
        }
    };

    sendLog('[PROFILE] id=' + profile.id +
        ' requested=' + (requestedProfileId || 'none') +
        ' active=' + config.activeProfileId +
        ' installPath=' + rootPath);
    sendLog('Запуск с конфигурацией: ' + JSON.stringify(config));

    try {
        checkCancelled();

        // Apply default mod settings for fresh installs
        config = await applyDefaultModSettings(config, rootPath, sendLog, sendDebug, { signal, profile });
        checkCancelled();

        // Preload the selected Minecraft version files.
        sendDebug(`Preparing ${profile.name} (${profile.loader})...`);
        await ensureVanillaVersionFiles(rootPath, sendLog, {
            signal,
            minecraftVersion: profile.minecraftVersion,
        });
        checkCancelled();

        // Prepare Java
        let javaPath;
        try {
            javaPath = await prepareJava(config, rootPath, sendLog, sendDebug, {
                signal,
                activeChildProcesses,
                javaMajor: profile.javaMajor,
                minecraftVersion: profile.minecraftVersion,
            });
        } catch (e) {
            if (e.message === 'CANCELLED' || isLaunchCancelled) {
                isGameRunning = false;
                return { success: false, error: "Запуск отменен" };
            }
            sendLog(`[ОШИБКА] ${e.message}`);
            isGameRunning = false;
            return { success: false, error: e.message };
        }
        checkCancelled();

        let forgeInstallerPath = null;
        if (profile.loader === 'neoforge') {
            try {
                forgeInstallerPath = await prepareForge(rootPath, sendLog, sendDebug, {
                    signal,
                    neoforgeVersion: profile.neoforgeVersion,
                });
            } catch (e) {
                if (e.message === 'CANCELLED' || isLaunchCancelled) {
                    isGameRunning = false;
                    return { success: false, error: "Запуск отменен" };
                }
                sendDebug(`NeoForge download failed: ${e.stack}`);
                isGameRunning = false;
                return { success: false, error: "Не удалось скачать NeoForge: " + e.message };
            }
            checkCancelled();
        }

        // Prepare Authlib Injector
        let authlibPath;
        try {
            authlibPath = await prepareAuthlib(rootPath, sendLog, sendDebug, { signal });
        } catch (e) {
            if (e.message === 'CANCELLED' || isLaunchCancelled) {
                isGameRunning = false;
                return { success: false, error: "Запуск отменен" };
            }
            sendDebug(`Authlib download failed: ${e.stack}`);
            isGameRunning = false;
            return { success: false, error: "Не удалось скачать Authlib Injector: " + e.message };
        }
        checkCancelled();

        // Sync mods
        try {
            await syncMods(event, rootPath, config, sendLog, sendDebug, { signal, profile });
        } catch (e) {
            if (e.message === 'CANCELLED' || isLaunchCancelled) {
                sendLog('Запуск отменен пользователем.');
                isGameRunning = false;
                return { success: false, error: "Запуск отменен" };
            }
            sendLog('ВНИМАНИЕ: Ошибка синхронизации модов. Игра может работать нестабильно.');
            sendDebug(`Sync error: ${e.stack}`);
        }
        checkCancelled();

        // Authentication (Yggdrasil with Offline Fallback)
        sendLog('Авторизация игрока...');
        let authSession;
        const crypto = require('crypto');

        function makeOfflineSession(name) {
            const md5 = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
            md5[6] = (md5[6] & 0x0f) | 0x30;
            md5[8] = (md5[8] & 0x3f) | 0x80;
            const hex = md5.toString('hex');
            const offlineUuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

            return {
                accessToken: crypto.randomBytes(16).toString('hex'),
                clientToken: crypto.randomBytes(16).toString('hex'),
                uuid: offlineUuid,
                name: name,
                isOffline: true
            };
        }

        if (options && options.token) {
            try {
                let manifestHash = '';
                const manifestPath = path.join(rootPath, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        manifestHash = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
                    } catch (mHashErr) {
                        sendDebug(`Failed to compute manifest hash: ${mHashErr.message}`);
                    }
                }
                sendDebug(`Authenticating user: ${options.username} (profile: ${profile.id}, v${CLIENT_VERSION}, hash: ${manifestHash.slice(0, 8)}...)`);
                authSession = await authenticateYggdrasil(
                    YGGDRASIL_AUTH_URL,
                    options.username,
                    options.token,
                    2,
                    CLIENT_VERSION,
                    manifestHash,
                    profile.id,
                    { signal },
                );
                sendLog(`Авторизация успешна. UUID: ${authSession.uuid}`);
                sendDebug(`Auth success. UUID: ${authSession.uuid}, Name: ${authSession.name}`);
            } catch (e) {
                if (e.message === 'CANCELLED' || isLaunchCancelled) {
                    isGameRunning = false;
                    return { success: false, error: "Запуск отменен" };
                }
                sendDebug(`Yggdrasil auth failed: ${e.message}`);
                sendLog(`🛑 Ошибка авторизации: ${e.message}`);
                isGameRunning = false;
                return { success: false, error: e.message };
            }
        } else {
            const playerNick = (options && options.username) ? options.username : 'Player';
            sendLog(`Запуск в офлайн-режиме под ником ${playerNick}...`);
            authSession = makeOfflineSession(playerNick);
        }
        checkCancelled();

        // Ensure launcher_profiles.json exists (required by NeoForge installer)
        const profilesPath = path.join(rootPath, 'launcher_profiles.json');
        if (!fs.existsSync(profilesPath)) {
            const defaultProfiles = {
                profiles: {
                    "Ganj4Craft": {
                        name: "Ganj4Craft",
                        type: "custom",
                        created: new Date().toISOString(),
                        lastUsed: new Date().toISOString(),
                        lastVersionId: profile.minecraftVersion
                    }
                },
                settings: {},
                version: 3
            };
            try {
                fs.writeFileSync(profilesPath, JSON.stringify(defaultProfiles, null, 2), 'utf8');
            } catch (e) {
                sendDebug(`Failed to create launcher_profiles.json: ${e.message}`);
            }
        }

        // Prepare Fabric version metadata; libraries are resolved and downloaded by MCLC.
        if (profile.loader === 'fabric') {
            try {
                await ensureFabricVersionJson(rootPath, sendLog, sendDebug, {
                    signal,
                    minecraftVersion: profile.minecraftVersion,
                    fabricLoaderVersion: profile.fabricLoaderVersion,
                });
            } catch (e) {
                if (e.message === 'CANCELLED' || isLaunchCancelled || signal.aborted) {
                    isGameRunning = false;
                    return { success: false, error: 'Запуск отменен' };
                }
                sendDebug(`Fabric metadata setup failed: ${e.stack || e.message}`);
                isGameRunning = false;
                return { success: false, error: `Не удалось подготовить Fabric ${profile.fabricLoaderVersion}: ${e.message}` };
            }
        }

        // NeoForge headless install check
        const neoforgeVerId = `neoforge-${profile.neoforgeVersion || NEOFORGE_VERSION}`;
        const neoforgeJsonPath = path.join(rootPath, 'versions', neoforgeVerId, `${neoforgeVerId}.json`);

        if (profile.loader === 'neoforge' && !fs.existsSync(neoforgeJsonPath)) {
            checkCancelled();
            sendLog(`Первичная установка NeoForge ${profile.neoforgeVersion} (~15-30 сек)...`);
            sendDebug(`Running NeoForge installer headless: ${forgeInstallerPath}`);
            try {
                const { execFile } = require('child_process');
                const javaBin = (process.platform === 'win32' && javaPath && javaPath.toLowerCase().endsWith('javaw.exe'))
                    ? javaPath.replace(/javaw\.exe$/i, 'java.exe')
                    : (javaPath || 'java');

                await new Promise((resolve, reject) => {
                    if (signal.aborted || isLaunchCancelled) return reject(new Error('CANCELLED'));
                    const proc = execFile(javaBin, ['-jar', forgeInstallerPath, '--installClient', rootPath], { cwd: rootPath });
                    activeChildProcesses.add(proc);

                    const onAbort = () => {
                        killProcessTree(proc, sendDebug);
                        reject(new Error('CANCELLED'));
                    };

                    signal.addEventListener('abort', onAbort, { once: true });

                    let stderr = '';
                    let stdout = '';
                    proc.stdout?.on('data', d => { stdout += d.toString(); });
                    proc.stderr?.on('data', d => { stderr += d.toString(); });
                    proc.on('close', code => {
                        activeChildProcesses.delete(proc);
                        signal.removeEventListener('abort', onAbort);
                        sendDebug(`NeoForge installer exit code: ${code}`);
                        if (signal.aborted || isLaunchCancelled) {
                            return reject(new Error('CANCELLED'));
                        }
                        if (code === 0 || fs.existsSync(neoforgeJsonPath)) {
                            resolve();
                        } else {
                            reject(new Error(`Код завершения установщика: ${code}.\n${stderr || stdout}`));
                        }
                    });
                    proc.on('error', err => {
                        activeChildProcesses.delete(proc);
                        signal.removeEventListener('abort', onAbort);
                        reject(err);
                    });
                });
                sendLog(`✓ NeoForge ${profile.neoforgeVersion} успешно установлен.`);
            } catch (e) {
                if (e.message === 'CANCELLED' || isLaunchCancelled) {
                    isGameRunning = false;
                    return { success: false, error: "Запуск отменен" };
                }
                sendDebug(`NeoForge install error: ${e.stack || e.message}`);
                isGameRunning = false;
                return { success: false, error: `Не удалось установить NeoForge ${profile.neoforgeVersion}:\n${e.message}` };
            }
        }

        checkCancelled();

        if (profile.loader === 'neoforge') {
            // Merge NeoForge metadata before handing it to minecraft-launcher-core.
            ensureNeoForgeVersionJsonMerged(rootPath, sendDebug, {
                minecraftVersion: profile.minecraftVersion,
                neoforgeVersion: profile.neoforgeVersion,
            });
        }

        // Verify NeoForge library SHA1 hashes (delete corrupted, MCLC will re-download)
        try {
            const corrupted = profile.loader === 'neoforge'
                ? await verifyNeoForgeLibraries(rootPath, sendLog, sendDebug, {
                    neoforgeVersion: profile.neoforgeVersion,
                })
                : 0;
            if (corrupted > 0) {
                sendDebug(`Deleted ${corrupted} corrupted libraries. MCLC will re-download them.`);
            }
        } catch (e) {
            sendDebug(`Library verification failed: ${e.message}`);
        }

        checkCancelled();

        // Prefetch Yggdrasil metadata for authlib-injector (bypass Localtunnel reminder)
        let authlibPrefetched = null;
        if (authlibPath && !authSession.isOffline) {
            try {
                const metaRes = await fetch(`${BASE_URL}/api/yggdrasil`, {
                    signal,
                    headers: {
                        'bypass-tunnel-reminder': 'true',
                        'User-Agent': 'localtunnel',
                        'Accept': 'application/json'
                    }
                });
                const metaText = await metaRes.text();
                const compactJson = JSON.stringify(JSON.parse(metaText));
                authlibPrefetched = Buffer.from(compactJson, 'utf8').toString('base64');
                sendDebug(`Prefetched Yggdrasil metadata (${compactJson.length} chars)`);
            } catch (e) {
                if (e.name === 'AbortError' || isLaunchCancelled) throw new Error('CANCELLED');
                sendDebug(`Failed to prefetch Yggdrasil metadata: ${e.message}`);
            }
        }

        checkCancelled();

        // Ensure the selected Minecraft version's asset index exists and is populated.
        await ensureAssetIndex(rootPath, sendLog, {
            signal,
            minecraftVersion: profile.minecraftVersion,
            neoforgeVersion: profile.neoforgeVersion,
        });

        checkCancelled();

        // Build launch options
        const opts = buildLaunchOptions(config, rootPath, javaPath, forgeInstallerPath, authlibPath, authSession, authlibPrefetched, profile);

        // Cleanup empty files before launch
        sendLog('Проверка целостности библиотек...');
        try {
            await cleanZeroByteFiles(path.join(rootPath, 'libraries'));
            await cleanZeroByteFiles(path.join(rootPath, 'versions'));
        } catch (e) {
            isGameRunning = false;
            return { success: false, error: e.message };
        }

        checkCancelled();

        // Preflight checks
        try {
            if (profile.loader === 'neoforge') {
                sendDebug('Preflight: checking NeoForge library writability...');
                await preflightNeoForgeLibraries(rootPath, sendLog, sendDebug, {
                    neoforgeVersion: profile.neoforgeVersion,
                });
                sendDebug('Preflight: Forge library writability OK.');
            }
        } catch (e) {
            sendDebug(`Preflight failed: ${e.stack || e.message}`);
            isGameRunning = false;
            return { success: false, error: e.message };
        }

        checkCancelled();

        sendLog('Запуск ядра Minecraft...');
        sendDebug('Launching MCLC with options: ' + JSON.stringify(opts, null, 2));

        const mainWindow = BrowserWindow.fromWebContents(event.sender);

        // Remove all previous listeners to prevent memory leaks
        launcher.removeAllListeners();

        // Register fresh listeners
        launcher.once('close', (code) => {
            currentGameProcess = null;
            isGameRunning = false;
            stopModWatcher();
            sendLog(`[LAUNCHER] Игра закрылась с кодом ${code}`);
            sendDebug(`Game closed with code ${code}`);

            // Switch Discord RPC back to Launcher status
            try {
                discordRpc.setLauncherActivity({ username: authSession?.name || options?.username });
            } catch (_) { }

            if (logStream) logStream.end();

            if (mainWindow && !mainWindow.isDestroyed()) {
                try {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    if (!mainWindow.isVisible()) mainWindow.show();
                    mainWindow.focus();
                } catch (_) { }
                safeSend(mainWindow, 'game-closed');
            }
        });

        return new Promise((resolve) => {
            let hasResolved = false;

            const onArguments = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    sendLog('[LAUNCHER] Процесс игры запускается...');
                    sendDebug('Game process arguments generated.');

                    // Update Discord RPC status to In Game
                    try {
                        discordRpc.setGameActivity({
                            username: authSession?.name || options?.username,
                            startTime: Math.floor(Date.now() / 1000)
                        });
                    } catch (_) { }

                    resolve({ success: true });
                }
            };

            launcher.once('arguments', onArguments);

            let detectedFatalClassError = false;
            let gameReadyNotified = false;

            launcher.on('data', (e) => {
                const text = String(e).trim();
                if (text) sendLog(`[GAME] ${text}`);

                // Detect when Minecraft game has FULLY finished mod loading and reached TitleScreen
                if (!gameReadyNotified && (
                    text.includes('Sound engine started') ||
                    text.includes('OpenAL initialized') ||
                    text.includes('TitleScreen') ||
                    text.includes('Stopping! EarlyWindow') ||
                    text.includes('Stopping EarlyDisplay') ||
                    text.includes('EarlyDisplay: shutting down') ||
                    text.includes('NeoForge mod loading complete') ||
                    text.includes('Mod loading complete') ||
                    text.includes('Narrator library load')
                )) {
                    gameReadyNotified = true;
                    sendDebug('[LAUNCHER] Minecraft game window initialized and fully loaded.');
                    safeSend(mainWindow, 'game-ready');
                }

                // Detect fatal Java class loading errors from stderr
                if (!detectedFatalClassError && (
                    text.includes('Could not find or load main class') ||
                    text.includes('NoClassDefFoundError') ||
                    (text.includes('securejarhandler') && text.includes('ClassNotFoundException'))
                )) {
                    detectedFatalClassError = true;
                    sendLog('[LAUNCHER] Обнаружена критическая ошибка загрузки NeoForge. Автоматическое восстановление...');
                    if (profile.loader === 'neoforge') {
                        purgeCorruptedNeoForge(rootPath, profile.neoforgeVersion || NEOFORGE_VERSION);
                    }
                    sendLog('[LAUNCHER] Повреждённые файлы удалены. Пожалуйста, нажмите «Играть» ещё раз.');
                    safeSend(mainWindow, 'launch-error',
                        'Обнаружена ошибка NeoForge. Лаунчер автоматически починил файлы.\n' +
                        'Нажмите «Играть» ещё раз!');
                }
            });

            launcher.on('error', (e) => {
                const text = String(e).trim();
                if (text) sendLog(`[GAME ERROR] ${text}`);
            });

            let lastProgressSent = 0;
            let lastProgressPercent = -1;

            launcher.on('progress', (e) => {
                if (!e || typeof e.task !== 'number' || typeof e.total !== 'number') return;
                const now = Date.now();
                const percent = e.total > 0 ? Math.round((e.task / e.total) * 100) : 0;

                // Throttle: Send at most once every 50ms, or when reaching 100%, or at the start
                if (e.task === 0 || percent === 100 || (percent !== lastProgressPercent && (now - lastProgressSent >= 50))) {
                    lastProgressSent = now;
                    lastProgressPercent = percent;
                    safeSend(mainWindow, 'progress', { task: e.task, total: e.total, type: e.type });
                }
            });

            launcher.launch(opts).then((proc) => {
                if (proc) {
                    currentGameProcess = proc;
                    sendDebug(`Game process spawned with PID: ${proc.pid}`);
                    if (isLaunchCancelled || signal.aborted) {
                        sendDebug('[LAUNCHER] Launch was cancelled, terminating spawned game process immediately.');
                        killProcessTree(proc, sendDebug);
                        currentGameProcess = null;
                        if (!hasResolved) {
                            hasResolved = true;
                            isGameRunning = false;
                            resolve({ success: false, error: "Запуск отменен" });
                        }
                        return;
                    }
                    startModWatcher(rootPath, config, proc, sendLog);
                }
                if (!hasResolved) {
                    hasResolved = true;
                    resolve({ success: true });
                }
            }).catch(error => {
                sendDebug(`Launcher promise rejected: ${error.stack}`);
                if (currentGameProcess) {
                    killProcessTree(currentGameProcess, sendDebug);
                    currentGameProcess = null;
                }
                if (!hasResolved) {
                    hasResolved = true;
                    isGameRunning = false;
                    if (error.message === 'CANCELLED' || isLaunchCancelled || signal.aborted) {
                        resolve({ success: false, error: "Запуск отменен" });
                    } else {
                        resolve(handleLaunchError(error, rootPath, profile));
                    }
                } else {
                    if (error.message === 'CANCELLED' || isLaunchCancelled || signal.aborted) {
                        safeSend(mainWindow, 'log-message', '[LAUNCHER] Запуск отменен пользователем.');
                    } else {
                        safeSend(mainWindow, 'log-message', `[ОШИБКА] Игра вылетела: ${error.message}`);
                    }
                }
            });
        });

    } catch (e) {
        sendDebug(`Launcher exception: ${e.stack}`);
        if (currentGameProcess) {
            killProcessTree(currentGameProcess, sendDebug);
            currentGameProcess = null;
        }
        for (const proc of activeChildProcesses) {
            killProcessTree(proc, sendDebug);
        }
        activeChildProcesses.clear();

        isGameRunning = false;
        if (e.message === 'CANCELLED' || isLaunchCancelled || signal.aborted) {
            return { success: false, error: "Запуск отменен" };
        }
        return { success: false, error: e.message };
    }
}

module.exports = {
    launchGame,
    cancelLaunch,
    getIsGameRunning,
};
