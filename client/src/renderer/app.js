/**
 * Ganj4Craft Launcher - Main Application Entry Point
 * Точка входа для renderer process
 */

window.onerror = (message, source, lineno, colno, error) => {
    console.error('[UNCAUGHT RENDERER ERROR]', message, `at ${source}:${lineno}:${colno}`, error);
};

window.onunhandledrejection = (event) => {
    console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
};

// === Core Imports ===
import { dom } from './utils/dom.js';

// === UI Imports ===
import { customConfirm, customAlert, showError, showNotification } from './ui/modals.js';
import {
    initAllEffects,
    createSnowBurst,
    createDirectionalBurst,
    createSideBurst
} from './ui/effects/index.js';
import { initAllEasterEggs } from './features/easter-eggs/index.js';
import { initWardrobeModal } from './features/skin-viewer/index.js';
import { initLauncherUpdaterHandlers } from './features/updater/index.js';

// === Feature Imports ===
import {
    checkSavedAuth,
    initAuthHandlers,
    getCurrentUsername
} from './features/auth/index.js';

import {
    loadModsList,
    initModsListeners
} from './features/mods/index.js';

import {
    loadConfigsList,
    savePendingConfigs,
    cancelPendingConfigs
} from './features/configs/configs-manager.js';

import {
    setupSettingsChangeListeners,
    toggleMainUIVisibility,
    openSettings,
    closeSettings,
    switchTab,
    populateSettingsFields,
    saveSettings,
    initSettingsTabs,
    initPathSelectors,
    initReinstallButton,
    initModsButtons,
    captureInitialSettingsState,
    isSettingsAnimating,
    getCurrentConfig,
    setCurrentConfig,
    tryTriggerEasterEgg,
    triggerEasterEggStage2,
    hideEasterEgg,
    isSettingsEasterEggActive,
    getEasterEggStage
} from './features/settings/index.js';

import {
    initProgressHandlers,
    initGameButtons,
    isGameLaunchingActive,
    toggleLaunchLogModal
} from './features/game/index.js';

import {
    logToConsole,
    isConsoleVisible,
    showConsole,
    hideConsole,
    initConsoleActions
} from './features/console/index.js';

import { startStatusChecker, initBuildProfileSelector } from './features/server-status/index.js';
import { initChangelog, loadChangelogHistory, isChangelogOpen, closeChangelogScreen, openChangelogScreen } from './features/changelog/index.js';

// === Application State ===
let currentConfig = {};
let profileChangeReloading = false;

// === Window Controls ===
function initWindowControls() {
    const btnMinimize = dom.get('btn-minimize');
    const btnClose = dom.get('btn-close');

    if (btnMinimize) {
        btnMinimize.addEventListener('click', () => {
            window.api.minimize();
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            window.api.close();
        });
    }
}



// === Console Toggle ===
function initConsoleToggle() {
    const consoleToggleBtn = dom.get('console-toggle-btn');

    if (consoleToggleBtn) {
        consoleToggleBtn.addEventListener('click', () => {
            // Easter egg handling
            if (isSettingsEasterEggActive() && getEasterEggStage() === 1) {
                triggerEasterEggStage2();
                return;
            }

            if (isSettingsEasterEggActive() && getEasterEggStage() === 2) {
                hideEasterEgg();
                return;
            }

            const consoleVisible = isConsoleVisible();

            if (consoleVisible) {
                hideConsole();
            } else {
                showConsole();
            }
        });
    }
}

// === Settings Button ===
function initSettingsButton() {
    const btnSettings = dom.get('btn-settings');
    const btnCloseSettings = dom.get('btn-close-settings');
    const btnSaveSettings = dom.get('save-settings');
    const settingsScreen = dom.get('step-settings');
    const consoleOutput = dom.get('console-output');
    const titleMainTab = dom.get('title-bar-title');

    // Title bar main tab click -> switch to main launcher screen
    if (titleMainTab) {
        titleMainTab.addEventListener('click', () => {
            if (isSettingsAnimating()) return;
            if (settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing')) {
                tryTriggerEasterEgg();
                closeSettings();
                cancelPendingConfigs();
                const saveBtn = dom.get('save-settings');
                if (saveBtn) saveBtn.classList.remove('visible');
            }
        });
    }

    // Open/Toggle settings
    if (btnSettings) {
        btnSettings.addEventListener('click', async () => {
            if (isSettingsAnimating()) return;

            // Во время запуска игры кнопка настроек открывает/закрывает окно логов (не наслаиваясь на тир)
            if (isGameLaunchingActive()) {
                toggleLaunchLogModal();
                return;
            }

            // Если панель открыта на любой вкладке — сразу закрываем её
            if (settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing')) {
                tryTriggerEasterEgg();
                closeSettings();
                cancelPendingConfigs();
                const saveBtn = dom.get('save-settings');
                if (saveBtn) saveBtn.classList.remove('visible');
                return;
            }

            // Открываем панель на вкладке 'general'
            openSettings('general');
            try {
                window.api.updateDiscordActivity({ username: getCurrentUsername(), viewName: 'Настройки' });
            } catch (_) { }

            // Hide easter egg after animation if active
            if (isSettingsEasterEggActive()) {
                setTimeout(() => {
                    hideEasterEgg();
                }, 300);
            }
        });
    }

    // Close settings
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            if (isSettingsAnimating()) return;

            tryTriggerEasterEgg();
            toggleMainUIVisibility(true, currentConfig);
            closeSettings();
            cancelPendingConfigs();
            try {
                window.api.updateDiscordActivity({ username: getCurrentUsername(), viewName: 'Главное меню' });
            } catch (_) { }

            const saveBtn = dom.get('save-settings');
            if (saveBtn) saveBtn.classList.remove('visible');
        });
    }

    // Save settings
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            const settingsSuccess = await saveSettings();
            const configsSuccess = await savePendingConfigs();

            if (settingsSuccess && configsSuccess) {
                currentConfig = getCurrentConfig();
                toggleMainUIVisibility(true, currentConfig);
                closeSettings();
            }
        });
    }
}

// === Loading Progress Helper ===
function updateLoaderStatus(percent, text) {
    const fill = dom.get('loader-progress-fill');
    const statusText = dom.get('loader-status-text');
    const percentText = dom.get('loader-percent-text');

    if (fill) fill.style.width = `${percent}%`;
    if (statusText) statusText.innerText = text;
    if (percentText) percentText.innerText = `${percent}%`;
}

function hideLoaderScreen() {
    const loader = dom.get('launcher-loader-screen');
    if (loader) {
        loader.classList.add('loaded');
    }
}

// === Display Version ===
async function displayVersion() {
    try {
        const ver = await window.api.getAppVersion();
        const vDiv = dom.get('app-version');
        if (vDiv) vDiv.innerText = `v${ver}`;
        const bDiv = dom.get('brand-version-tag');
        if (bDiv) bDiv.innerText = `v${ver}`;
    } catch (e) {
        console.error('Failed to get version', e);
    }
}

// === Main Initialization ===
async function init() {
    console.log('[INIT STEP 0] Launcher client initializing...');
    updateLoaderStatus(10, 'Загрузка конфигурации...');

    // 1. Load config
    currentConfig = await window.api.loadConfig();
    setCurrentConfig(currentConfig);
    console.log('[INIT STEP 1] Config loaded successfully');

    updateLoaderStatus(25, 'Инициализация графических эффектов...');
    // 2. Init visual effects & Easter Eggs
    await initAllEffects(currentConfig);
    initAllEasterEggs();
    console.log('[INIT STEP 2] Visual effects and easter eggs initialized');

    updateLoaderStatus(45, 'Подготовка интерфейса и настроек...');
    // 3. Init UI handlers & Pre-populate settings fields
    initWindowControls();
    initLauncherUpdaterHandlers();
    initConsoleToggle();
    initConsoleActions();
    initSettingsButton();
    initChangelog();
    const dashboardChangelogButton = dom.get('dashboard-open-changelog');
    if (dashboardChangelogButton) {
        dashboardChangelogButton.addEventListener('click', () => openChangelogScreen());
    }
    initWardrobeModal();
    initAuthHandlers();
    initProgressHandlers();
    initGameButtons();
    initSettingsTabs(currentConfig);
    initPathSelectors();
    initReinstallButton();
    initModsButtons();
    setupSettingsChangeListeners();

    // Предзаполнение всех полей настроек и RAM слайдера в DOM
    populateSettingsFields(currentConfig);
    console.log('[INIT STEP 3] UI handlers and settings fields populated');

    // Display version
    await displayVersion();
    console.log('[INIT STEP 4] Version displayed');

    updateLoaderStatus(65, 'Проверка авторизации...');
    // Mock auth: seed localStorage before checking saved auth
    if (window.api.isMockAuth) {
        localStorage.setItem('auth_user', 'TestAdmin');
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('is_admin', 'true');
        console.log('[MOCK_AUTH] Seeded localStorage as TestAdmin (admin)');
    }

    // 4. Check saved auth
    console.log('[INIT STEP 5] Checking saved auth...');
    await checkSavedAuth();
    console.log('[INIT STEP 5] Saved auth check completed');

    try {
        const username = getCurrentUsername();
        if (username) {
            window.api.updateDiscordActivity({ username, viewName: 'Главное меню' });
        }
    } catch (_) { }

    updateLoaderStatus(80, 'Загрузка данных сборки...');
    const initializeProfileSelector = async () => {
        const isAuthenticated = Boolean(localStorage.getItem('auth_user') && localStorage.getItem('auth_token'));
        if (!isAuthenticated) return;
        return initBuildProfileSelector(currentConfig);
    };

    // Auth completion can happen after initial app startup (OTP/password flow).
    window.addEventListener('auth-ready', () => {
        initializeProfileSelector().catch(error => {
            console.error('[Profile] Failed to initialize selector after authentication:', error);
        });
    });
    await initializeProfileSelector();
    const activeProfileId = window.__activeBuildProfileId || '';
    const activeProfileConfig = currentConfig.profiles?.[activeProfileId] || currentConfig;

    console.log('[INIT STEP 6] Loading profile mods and configs...');
    if (activeProfileId) {
        await Promise.all([
            loadModsList(activeProfileConfig.disabledMods || [], {
                ...currentConfig,
                activeProfileId,
            }),
            loadConfigsList(activeProfileId),
        ]);
    } else {
        await loadModsList([], { ...currentConfig, activeProfileId: '' });
    }
    captureInitialSettingsState();

    window.addEventListener('build-profile-changed', async (event) => {
        if (profileChangeReloading) return;
        profileChangeReloading = true;
        try {
            const profileId = event.detail?.id || window.__activeBuildProfileId || '';
            if (!profileId) {
                return;
            }
            const profileConfig = currentConfig.profiles?.[profileId] || currentConfig;
            currentConfig = {
                ...currentConfig,
                activeProfileId: profileId,
            };
            setCurrentConfig(currentConfig);
            // Shared install root is identical across profiles; refresh profile-owned settings state.
            populateSettingsFields(currentConfig);
            captureInitialSettingsState();
            await loadModsList(profileConfig.disabledMods || [], currentConfig, true);
            await loadConfigsList(profileId);
            await loadChangelogHistory(profileId);
        } catch (error) {
            console.error('[Profile] Failed to reload profile data:', error);
        } finally {
            profileChangeReloading = false;
        }
    });

    updateLoaderStatus(90, 'Загрузка обновлений и статуса серверов...');
    // Start network work after the interactive shell is visible; it must not block first paint.
    requestAnimationFrame(() => {
        loadChangelogHistory(window.__activeBuildProfileId).catch(error => console.warn('[CHANGELOG] Deferred load failed:', error));
        startStatusChecker();
    });

    updateLoaderStatus(100, 'Готово!');
    logToConsole('[LAUNCHER] Initialization complete. All modules pre-loaded.');

    // Smoothly fade out splash loading screen
    setTimeout(hideLoaderScreen, 300);
}

// === Start Application ===
init().catch(e => {
    console.error('[LAUNCHER] Initialization failed:', e);
    logToConsole(`[ERROR] Initialization failed: ${e.message}`);
});

// === Export for potential testing ===
export { init, currentConfig };
