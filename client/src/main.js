const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Override userData path to keep everything in .ganjacraft
const appDataPath = app.getPath('appData');
const customUserDataPath = path.join(appDataPath, '.ganjacraft', 'launcher-data');
if (!fs.existsSync(customUserDataPath)) {
    fs.mkdirSync(customUserDataPath, { recursive: true });
}
app.setPath('userData', customUserDataPath);

// Enable overlay scrollbars in Chromium engine
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');

// Global crash guards
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION]', reason);
});

const { createWindow, getMainWindow, discordRpc } = require('./main-process');
const { loadConfig } = require('./modules/config');
const { autoUpdater } = require('electron-updater');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const win = getMainWindow() || BrowserWindow.getAllWindows()[0];
        if (win && !win.isDestroyed()) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();

        // Initialize Discord Rich Presence
        try {
            const config = loadConfig();
            discordRpc.init({
                enabled: config.enableDiscordRpc !== false,
                profileId: config.activeProfileId
            });
        } catch (e) {
            console.warn('[MAIN] Failed to init Discord RPC:', e.message);
        }

        // Setup Auto-Updater
        autoUpdater.autoDownload = false;
        
        autoUpdater.on('update-available', (info) => {
            const win = getMainWindow();
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                try { win.webContents.send('update-available', info); } catch (_) {}
            }
        });
        
        autoUpdater.on('download-progress', (progressObj) => {
            const win = getMainWindow();
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                try { win.webContents.send('update-progress', progressObj); } catch (_) {}
            }
        });
        
        autoUpdater.on('update-downloaded', () => {
            const win = getMainWindow();
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                try { win.webContents.send('update-downloaded'); } catch (_) {}
            }
        });

        // Check for updates
        autoUpdater.checkForUpdates().catch(err => console.error("Update check failed:", err));

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    try {
        discordRpc.destroy();
    } catch (_) {}
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    try {
        discordRpc.destroy();
    } catch (_) {}
});

