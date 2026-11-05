const { contextBridge, ipcRenderer } = require('electron');

const MOCK_AUTH = process.env.MOCK_AUTH === '1';

const API_BASES = [
    'https://launcher.ganj4craft.ru/api'
];
const API_BASE = API_BASES[0];
const DEFAULT_TIMEOUT = 25000;

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'localtunnel',
                'Bypass-Tunnel-Reminder': 'true',
                ...(options.headers || {})
            }
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function readJsonOrThrow(response) {
    const text = await response.text();
    if (!text) {
        throw new Error('Empty response from server');
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(`Invalid JSON response: ${text}`);
    }
}

// Unified API call helper to reduce duplication with candidate fallbacks
async function apiCall(endpoint, { method = 'POST', body = null, headers = {}, returnErrorAsResult = false } = {}) {
    let lastError = null;
    for (const base of API_BASES) {
        try {
            const response = await fetchWithTimeout(`${base}${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json', ...headers },
                body: body ? JSON.stringify(body) : undefined,
                timeout: DEFAULT_TIMEOUT
            });

            if (response.ok) {
                return await readJsonOrThrow(response);
            }

            const text = await response.text();
            let data = null;
            try { data = JSON.parse(text); } catch { }

            if (data && (data.message || data.error || data.detail)) {
                const msg = data.message || data.error || (Array.isArray(data.detail) ? data.detail[0]?.msg : String(data.detail));
                if (returnErrorAsResult) return { success: false, message: msg, status: response.status, has_password: data.has_password };
                const err = new Error(msg);
                err.status = response.status;
                err.has_password = data.has_password;
                throw err;
            }
            lastError = new Error(`API Error: ${response.status} - ${text}`);
            lastError.status = response.status;
        } catch (e) {
            if (e && e.message && !e.message.includes('fetch') && !e.message.includes('network') && !e.name.includes('Abort')) {
                if (returnErrorAsResult) return { success: false, message: e.message, status: e.status || 0 };
                throw e;
            }
            lastError = e;
            lastError.status = 0;
        }
    }
    if (returnErrorAsResult) {
        return { success: false, message: lastError?.message || 'Ошибка сети', status: lastError?.status || 0 };
    }
    const err = lastError || new Error('Ошибка сети: сервер авторизации недоступен');
    err.status = err.status || 0;
    throw err;
}

if (MOCK_AUTH) console.log('[MOCK_AUTH] Mock auth mode enabled');

contextBridge.exposeInMainWorld('api', {
    isMockAuth: MOCK_AUTH,
    launchGame: (options) => ipcRenderer.invoke('launch-game', options),
    getBuildProfiles: () => ipcRenderer.invoke('get-build-profiles'),
    setActiveProfile: (profileId) => ipcRenderer.invoke('set-active-profile', profileId),

    // Auth API calls with offline fallback when backend is not running
    requestAuth: async (username) => {
        if (MOCK_AUTH) return { success: true, message: '[MOCK] Code sent', has_password: true };
        try {
            const res = await apiCall('/launcher/auth/request', { body: { username }, returnErrorAsResult: true });
            if (!res.success) return { success: false, error: res.message, status: res.status, has_password: res.has_password };
            return res;
        } catch (e) {
            return { success: false, error: 'Сервер авторизации недоступен. Проверьте интернет-соединение.', status: 0 };
        }
    },
    verifyAuth: async (username, code) => {
        if (MOCK_AUTH) return { success: true, token: 'mock-token', is_admin: true };
        try {
            const res = await apiCall('/launcher/auth/verify', { body: { username, code }, returnErrorAsResult: true });
            if (!res.success) {
                // If it's a network error (status 0), fallback to offline
                if (res.status === 0) {
                    console.warn('Backend auth server unreachable, fallback to offline token:', res.message);
                    return { success: true, token: 'offline-token', is_admin: false, offline: true };
                }
                return { success: false, error: res.message, status: res.status };
            }
            return res;
        } catch (e) {
            console.warn('Backend auth server unreachable, fallback to offline token:', e.message);
            return { success: true, token: 'offline-token', is_admin: false, offline: true };
        }
    },
    passwordAuth: async (username, password) => {
        if (MOCK_AUTH) return { success: true, token: 'mock-token', is_admin: true };
        try {
            const res = await apiCall('/launcher/auth/password', { body: { username, password }, returnErrorAsResult: true });
            if (!res.success) return { success: false, error: res.message, status: res.status };
            return res;
        } catch (e) {
            return { success: false, error: e.message || 'Ошибка подключения к серверу', status: 0 };
        }
    },
    checkAuth: async (username, token) => {
        if (MOCK_AUTH) return { success: true, is_admin: true };
        try {
            const res = await apiCall('/launcher/auth/check', {
                body: { username },
                headers: { 'X-Auth-Token': token },
                returnErrorAsResult: true
            });
            if (!res.success && res.status === 0) {
                return { success: true, is_admin: false, offline: true };
            }
            return res;
        } catch (e) {
            return { success: true, is_admin: false, offline: true };
        }
    },

    getNews: async () => {
        if (MOCK_AUTH) return { success: true, news: [{ id: 1, title: '[MOCK] Ganj4Craft News', content: 'Локальный тестовый режим', date: new Date().toISOString() }] };
        for (const base of API_BASES) {
            try {
                const response = await fetchWithTimeout(`${base}/news?limit=50`, { timeout: 4000 });
                if (response.ok) return await response.json();
            } catch (e) { }
        }
        return { success: false, news: [] };
    },
    onLog: (callback) => ipcRenderer.on('log-message', (event, text) => callback(text)),
    onProgress: (callback) => ipcRenderer.on('progress', (event, e) => callback(e)),
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),
    onWindowRestore: (callback) => ipcRenderer.on('window-restore', () => callback()),
    onWindowFocus: (callback) => ipcRenderer.on('window-focus', () => callback()),

    // Settings & Config
    loadConfig: () => ipcRenderer.invoke('load-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getGameConfigs: (profileId) => ipcRenderer.invoke('get-game-configs', profileId),
    saveGameConfig: (filePath, key, value) => ipcRenderer.invoke('save-game-config', filePath, key, value),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    selectPath: (type) => ipcRenderer.invoke('select-path', type), // type: 'dir' or 'file'
    openFolder: (path) => ipcRenderer.invoke('open-folder', path),
    openUrl: (url) => ipcRenderer.invoke('open-url', url),

    // Discord Rich Presence
    setDiscordRpcEnabled: (enabled) => ipcRenderer.invoke('set-discord-rpc-enabled', enabled),
    updateDiscordActivity: (data) => ipcRenderer.invoke('update-discord-activity', data),

    // Advanced
    reinstallClient: () => ipcRenderer.invoke('reinstall-client'),

    getManifest: (profileId) => ipcRenderer.invoke('get-manifest', profileId), // To list mods in UI
    getManifestHistory: (profileId) => ipcRenderer.invoke('get-manifest-history', profileId), // History of pack updates
    getLauncherReleases: () => ipcRenderer.invoke('get-launcher-releases'), // History of launcher client releases
    resolveModrinth: (hashes) => ipcRenderer.invoke('resolve-modrinth', hashes),

    // Events
    onGameReady: (callback) => ipcRenderer.on('game-ready', () => callback()),
    onGameClosed: (callback) => ipcRenderer.on('game-closed', () => callback()),

    // Updater
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),

    cancelLaunch: () => ipcRenderer.invoke('cancel-launch'),
    showContextMenu: () => ipcRenderer.send('show-context-menu')
});
