/**
 * Ganj4Craft Launcher - Config IPC Handlers
 * Обработчики конфигурации
 */

const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, shell, app } = require('electron');
const https = require('https');
const { loadConfig, saveConfig } = require('../../modules/config');
const { resolveJavaPath } = require('../../modules/java');
const { MANIFEST_URL, MANIFEST_HISTORY_URL } = require('../constants');
const ConfigParser = require('../config-parser');
const { discordRpc } = require('../discord/rpc');

/**
 * Зарегистрировать обработчики конфигурации
 * @param {BrowserWindow} mainWindow - Главное окно
 */
function registerConfigHandlers(mainWindow) {
    // Load config
    ipcMain.handle('load-config', () => loadConfig());
    
    // Save config
    ipcMain.handle('save-config', (event, config) => {
        if (config && typeof config.enableDiscordRpc === 'boolean') {
            discordRpc.setEnabled(config.enableDiscordRpc);
        }
        return saveConfig(config);
    });

    // Discord Rich Presence Handlers
    ipcMain.handle('set-discord-rpc-enabled', (event, enabled) => {
        discordRpc.setEnabled(enabled);
        return true;
    });

    ipcMain.handle('update-discord-activity', (event, data) => {
        discordRpc.setLauncherActivity(data || {});
        return true;
    });
    
    // Get game configs
    ipcMain.handle('get-game-configs', async () => {
        const config = loadConfig();
        const configDir = require('path').join(config.installPath, 'config');
        const files = await ConfigParser.scanConfigsDir(configDir);
        
        const promises = files.map(file => ConfigParser.parseFile(file));
        const results = await Promise.all(promises);
        
        return results.flat();
    });

    // Save game config value
    ipcMain.handle('save-game-config', async (event, filePath, key, value) => {
        return await ConfigParser.saveConfigValue(filePath, key, value);
    });
    
    // Get app version
    ipcMain.handle('get-app-version', () => app.getVersion());
    
    // Select path dialog
    ipcMain.handle('select-path', async (event, type) => {
        let properties = type === 'dir' ? ['openDirectory'] : ['openFile'];
        let title = type === 'dir' ? 'Выберите папку' : 'Выберите файл';
        let filters = [];

        if (type === 'java') {
            title = 'Выберите javaw.exe или папку с Java';
            filters = process.platform === 'win32' ? [
                { name: 'Исполняемый файл Java (javaw.exe, java.exe)', extensions: ['exe'] },
                { name: 'Все файлы (*.*)', extensions: ['*'] }
            ] : [
                { name: 'Исполняемый файл Java (javaw, java)', extensions: ['*'] }
            ];
        }

        const options = { title, properties };
        if (filters.length > 0) options.filters = filters;

        const result = await dialog.showOpenDialog(mainWindow, options);
        if (!result.canceled && result.filePaths.length > 0) {
            let selectedPath = result.filePaths[0];
            if (type === 'java') {
                selectedPath = resolveJavaPath(selectedPath);
            }
            return selectedPath;
        }
        return null;
    });
    
    // Open folder in explorer
    ipcMain.handle('open-folder', async (event, folderPath) => {
        if (folderPath && fs.existsSync(folderPath)) {
            await shell.openPath(folderPath);
            return true;
        }
        return false;
    });
    
    // Open URL in browser safely
    ipcMain.handle('open-url', async (event, url) => {
        if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
            await shell.openExternal(url);
            return true;
        }
        return false;
    });
    
    // Get manifest - с кешированием чтобы не блокировать UI
    let manifestCache = null;
    let manifestCacheTime = 0;
    const MANIFEST_CACHE_TTL = 30_000; // 30 секунд
    
    ipcMain.handle('get-manifest', async () => {
        // Возвращаем кеш если свежий
        const now = Date.now();
        if (manifestCache && (now - manifestCacheTime) < MANIFEST_CACHE_TTL) {
            return manifestCache;
        }
        
        // Читаем локальный манифест если есть (мгновенно)
        const config = loadConfig();
        const localManifestPath = require('path').join(config.installPath, 'manifest.json');
        
        let localManifest = null;
        try {
            if (fs.existsSync(localManifestPath)) {
                localManifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf-8'));
            }
        } catch {}
        
        // Пробуем загрузить свежий (неблокирующе)
        try {
            const parsedUrl = new URL(MANIFEST_URL);
            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: 3000,
                headers: {
                    'User-Agent': 'localtunnel',
                    'Bypass-Tunnel-Reminder': 'true'
                }
            };
            const fresh = await new Promise((resolve, reject) => {
                const req = https.request(reqOptions, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); }
                        catch { reject(new Error('Invalid JSON')); }
                    });
                });
                
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.end();
            });
            
            manifestCache = fresh;
            manifestCacheTime = now;
            return fresh;
        } catch {
            // Fallback на локальный
            if (localManifest) {
                manifestCache = localManifest;
                manifestCacheTime = now;
                return localManifest;
            }
            return null;
        }
    });

    // Get manifest history (последние обновления сборки)
    let historyCache = null;
    let historyCacheTime = 0;
    const HISTORY_CACHE_TTL = 60_000; // 1 минута

    ipcMain.handle('get-manifest-history', async () => {
        const now = Date.now();
        if (historyCache && (now - historyCacheTime) < HISTORY_CACHE_TTL) {
            return historyCache;
        }

        try {
            const parsedUrl = new URL(MANIFEST_HISTORY_URL);
            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: 5000,
                headers: {
                    'User-Agent': 'localtunnel',
                    'Bypass-Tunnel-Reminder': 'true'
                }
            };
            const fresh = await new Promise((resolve, reject) => {
                const req = https.request(reqOptions, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        } catch {
                            reject(new Error('Invalid JSON'));
                        }
                    });
                });
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.end();
            });

            const historyList = Array.isArray(fresh) ? fresh : (fresh.history || []);
            historyCache = { success: true, history: historyList };
            historyCacheTime = now;
            return historyCache;
        } catch (e) {
            if (historyCache) {
                return historyCache;
            }
            return { success: false, history: [], error: e.message };
        }
    });

    // Launcher Client Releases
    let launcherReleasesCache = null;
    let launcherReleasesCacheTime = 0;
    const RELEASES_CACHE_TTL = 60_000;

    ipcMain.handle('get-launcher-releases', async () => {
        const now = Date.now();
        if (launcherReleasesCache && (now - launcherReleasesCacheTime) < RELEASES_CACHE_TTL) {
            return launcherReleasesCache;
        }

        let localReleases = [];
        try {
            const localPath = path.join(__dirname, '../../assets/launcher_releases.json');
            if (fs.existsSync(localPath)) {
                localReleases = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
            }
        } catch (e) {
            console.warn('[IPC] Could not read local launcher_releases.json:', e.message);
        }

        try {
            const reqOptions = {
                hostname: 'api.github.com',
                path: '/repos/OptimusHigh/ganjacraft_launcher/releases?per_page=15',
                method: 'GET',
                timeout: 4000,
                headers: {
                    'User-Agent': 'Ganj4Craft-Launcher'
                }
            };
            const githubReleases = await new Promise((resolve, reject) => {
                const req = https.request(reqOptions, (res) => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`GitHub returned ${res.statusCode}`));
                    }
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            resolve(Array.isArray(parsed) ? parsed : []);
                        } catch (err) {
                            reject(err);
                        }
                    });
                });
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.end();
            });

            const formattedGithub = githubReleases.slice(0, 6).map(r => {
                const version = (r.tag_name || '').replace(/^v/i, '');
                let bodyLines = (r.body || '').split('\n').map(l => l.trim()).filter(Boolean);
                const title = r.name || `Релиз лаунчера v${version}`;
                const description = bodyLines[0] || `Обновление компонентов лаунчера v${version}`;
                
                if (bodyLines.length === 0) {
                    bodyLines = [
                        '⚡ Оптимизация сетевых протоколов и ускорение синхронизации',
                        '🔧 Повышение стабильности работы клиента',
                        '🛡️ Обновление модулей авторизации и безопасности'
                    ];
                }

                return {
                    version,
                    date: r.published_at || r.created_at,
                    timestamp: r.published_at ? Math.floor(new Date(r.published_at).getTime() / 1000) : null,
                    title,
                    description,
                    changes: bodyLines,
                    html_url: r.html_url
                };
            });

            const map = new Map();
            for (const r of formattedGithub) {
                if (r.version) map.set(r.version, r);
            }
            for (const r of localReleases) {
                if (r.version) map.set(r.version, { ...(map.get(r.version) || {}), ...r });
            }

            const merged = Array.from(map.values()).sort((a, b) => {
                const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() / 1000 : 0);
                const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() / 1000 : 0);
                return timeB - timeA;
            });

            launcherReleasesCache = { success: true, releases: merged };
            launcherReleasesCacheTime = now;
            return launcherReleasesCache;
        } catch (err) {
            launcherReleasesCache = { success: true, releases: localReleases };
            launcherReleasesCacheTime = now;
            return launcherReleasesCache;
        }
    });
    
    // Reinstall client (delete mods, config, libraries, versions)
    ipcMain.handle('reinstall-client', async () => {
        const config = loadConfig();
        const rootPath = config.installPath;
        
        ['mods', 'config', 'libraries', 'versions'].forEach(dir => {
            const p = require('path').join(rootPath, dir);
            if (fs.existsSync(p)) {
                fs.rmSync(p, { recursive: true, force: true });
            }
        });
        
        return true;
    });

    // Modrinth Hash Resolver
    ipcMain.handle('resolve-modrinth', async (event, hashes) => {
        try {
            const { resolveModrinthUrls } = require('../../modules/updater/modrinth');
            return await resolveModrinthUrls(hashes);
        } catch (e) {
            console.error('IPC resolve-modrinth error:', e);
            return {};
        }
    });

}

module.exports = {
    registerConfigHandlers,
};
