/**
 * Ganj4Craft Launcher - Settings Feature
 * Управление настройками лаунчера
 */

import { dom } from '../../utils/dom.js';
import { customAlert, customConfirm } from '../../ui/modals.js';
import { toggleSnow, createSnowBurst, createDirectionalBurst, createSideBurst, applyEffectsConfig, effectsEngine } from '../../ui/effects/index.js';
import { appState } from '../../state/app-state.js';
import { startSmokeEffect, stopSmokeEffect } from '../../ui/effects/smoke.js';
import { startParallax, stopParallax } from '../../ui/effects/parallax.js';
import { loadModsList, getDisabledMods, setAllModsState, updateModsCounter, updateCategorySidebar } from '../mods/index.js';
import { logToConsole } from '../console/console.js';
import { initRamSlider } from './ram-slider.js';
import { debounce, triggerInertiaCascade } from '../../utils/performance.js';
import { renderChangelogList, markChangelogSeen, checkChangelogBadge } from '../changelog/changelog-manager.js';
import { applySkinMode, getSkinViewerMode, randomizeCharacterEquipment } from '../skin-viewer/index.js';

// Стейт для отслеживания изменений
let initialSettingsState = null;
let hasUnsavedChanges = false;
let settingsAnimating = false;
let currentTabIndex = 0;

// DOM references
let settingsScreen = null;
let consoleOutput = null;
let currentConfig = {};

/**
 * Инициализация DOM references
 */
function initDOMRefs() {
    settingsScreen = dom.get('step-settings');
    consoleOutput = dom.get('console-output');
}

/**
 * Получить текущее состояние настроек
 */
export function getCurrentSettingsState() {
    return {
        installPath: document.getElementById('setting-path')?.value || '',
        javaPath: document.getElementById('setting-java')?.value || '',
        memoryMin: document.getElementById('setting-ram-min')?.value.trim().toUpperCase() || '1G',
        memoryMax: document.getElementById('setting-ram-max')?.value.trim().toUpperCase() || '3G',
        hideOnPlay: document.getElementById('setting-hide-on-play')?.checked ?? true,
        skinMode: document.getElementById('setting-skin-mode')?.value || '3d',
        effectsPreset: document.getElementById('setting-effects-preset')?.value || 'auto',
        effectsDensity: document.getElementById('setting-effects-density')?.value || 'low',
        enableSmoke: document.getElementById('setting-enable-smoke')?.checked ?? true,
        enableParallax: document.getElementById('setting-enable-parallax')?.checked ?? true,
        enableDiscordRpc: document.getElementById('setting-enable-discord-rpc')?.checked ?? true,
        disabledMods: getDisabledMods().sort().join(',')
    };
}

import { hasUnsavedConfigs } from '../configs/configs-manager.js';

/**
 * Проверить изменились ли настройки
 */
export function settingsChanged() {
    const current = getCurrentSettingsState();
    return JSON.stringify(current) !== JSON.stringify(initialSettingsState);
}

/**
 * Обновить видимость кнопки сохранения (debounced для производительности)
 */
export const updateSaveButtonVisibility = debounce(() => {
    const saveBtn = dom.get('save-settings');
    if (!saveBtn) return;

    hasUnsavedChanges = settingsChanged() || hasUnsavedConfigs();

    if (hasUnsavedChanges) {
        saveBtn.classList.add('visible');
    } else {
        saveBtn.classList.remove('visible');
    }
}, 100);

/**
 * Настроить слушатели изменений полей
 */
export function setupSettingsChangeListeners() {
    // Text inputs - используем passive для лучшей производительности
    const textInputs = [
        'setting-path',
        'setting-java',
        'setting-ram-min',
        'setting-ram-max'
    ];

    textInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateSaveButtonVisibility, { passive: true });
            el.addEventListener('change', updateSaveButtonVisibility, { passive: true });
        }
    });

    // RAM Sliders (новый UI)
    const ramSliders = [
        'setting-ram-slider-min',
        'setting-ram-slider-max'
    ];

    ramSliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateSaveButtonVisibility, { passive: true });
            el.addEventListener('change', updateSaveButtonVisibility, { passive: true });
        }
    });

    // Controls (Checkboxes & Selects)
    const formControls = [
        'setting-hide-on-play',
        'setting-skin-mode',
        'setting-effects-preset',
        'setting-effects-density',
        'setting-enable-smoke',
        'setting-enable-parallax',
        'setting-enable-discord-rpc'
    ];

    formControls.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateSaveButtonVisibility, { passive: true });
        }
    });



    // Mods list - event delegation (grid container)
    const modsGrid = document.getElementById('mods-grid');
    if (modsGrid) {
        modsGrid.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                updateSaveButtonVisibility();
                updateModsCounter();
                updateCategorySidebar();
            }
        });
    }
}

/**
 * Показать/скрыть основные UI элементы с эффектными анимациями входа/выхода
 */
export function toggleMainUIVisibility(show, config) {
    const isPlayingStep = !document.getElementById('step-play')?.classList.contains('hidden');
    const serverWidget = document.getElementById('server-status-widget');
    const authContainer = document.querySelector('.auth-container');
    const playerSection = document.querySelector('.player-character-section');
    const centerBrand = document.querySelector('.hero-brand-section');
    const playBrandGroup = document.querySelector('.play-brand-group');
    const launchHub = document.querySelector('.launch-action-hub');
    const appVersion = document.getElementById('app-version');

    // 1. Top Server status widget
    if (serverWidget) {
        serverWidget.style.transition = show
            ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease'
            : 'transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease';
        serverWidget.style.transform = show ? 'none' : 'translateY(-150%)';
        serverWidget.style.opacity = show ? '1' : '0';
        serverWidget.style.pointerEvents = show ? 'auto' : 'none';
    }

    // 2. Fixed App Version Tag in bottom-right
    if (appVersion) {
        appVersion.style.transition = show
            ? 'transform 0.35s ease 80ms, opacity 0.35s ease 80ms'
            : 'transform 0.2s ease, opacity 0.2s ease';
        appVersion.style.transform = show ? 'none' : 'translateY(150%)';
        appVersion.style.opacity = show ? '1' : '0';
    }

    if (isPlayingStep) {
        // Сбрасываем ломающие inline-трансформы с auth-container
        if (authContainer) {
            authContainer.style.transform = 'none';
            authContainer.style.pointerEvents = show ? 'auto' : 'none';
        }

        // Анимируем левую часть (игрок) - улетает влево
        if (playerSection) {
            playerSection.style.transition = show
                ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 40ms, opacity 0.35s ease 40ms'
                : 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease';
            playerSection.style.transform = show ? 'none' : 'translateX(-140%) scale(0.85)';
            playerSection.style.opacity = show ? '1' : '0';
            playerSection.style.pointerEvents = show ? 'auto' : 'none';

            if (show) {
                randomizeCharacterEquipment();
                if (appState.get('effects.snowEnabled')) {
                    setTimeout(() => createSideBurst('left'), 80);
                }
            }
        }

        // Анимируем центральный заголовок - улетает вверх
        if (centerBrand) {
            centerBrand.style.transition = show
                ? 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 70ms, opacity 0.4s ease 70ms'
                : 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease';
            centerBrand.style.transform = show ? 'none' : 'scale(0.65) translateY(-50px)';
            centerBrand.style.opacity = show ? '1' : '0';
            centerBrand.style.pointerEvents = show ? 'auto' : 'none';
        }

        // Анимируем блок эмблемы листа на правой панели - улетает вправо
        if (playBrandGroup) {
            playBrandGroup.style.transition = show
                ? 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 80ms, opacity 0.4s ease 80ms'
                : 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease';
            playBrandGroup.style.transform = show ? 'none' : 'translateX(140%) scale(0.85)';
            playBrandGroup.style.opacity = show ? '1' : '0';
            playBrandGroup.style.pointerEvents = show ? 'auto' : 'none';
        }

        // Анимируем правую панель со статусом сервера - улетает вправо
        if (launchHub) {
            launchHub.style.transition = show
                ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 60ms, opacity 0.35s ease 60ms'
                : 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease';
            launchHub.style.transform = show ? 'none' : 'translateX(140%) scale(0.85)';
            launchHub.style.opacity = show ? '1' : '0';
            launchHub.style.pointerEvents = show ? 'auto' : 'none';

            if (show && appState.get('effects.snowEnabled')) {
                setTimeout(() => createSideBurst('right'), 100);
            }
        }
    } else {
        // Режим авторизации (не залогинен)
        if (authContainer) {
            authContainer.style.transition = show
                ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 50ms, opacity 0.35s ease 50ms'
                : 'transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease';
            authContainer.style.transform = show ? 'translate(-50%, -50%)' : 'translate(calc(-50% + 120px), -50%) scale(0.95)';
            authContainer.style.opacity = show ? '1' : '0';
            authContainer.style.pointerEvents = show ? 'auto' : 'none';

            if (show && appState.get('effects.snowEnabled')) {
                setTimeout(() => createSideBurst('right'), 100);
            }
        }
    }
}

/**
 * Синхронизация иконок и активности кнопок ⚙️ и 🔔 в window-controls
 */
export function updateHeaderControlsForTab(tabId) {
    const btnSettings = document.getElementById('btn-settings');
    const btnChangelog = document.getElementById('btn-changelog');

    // Кнопка ⚙️ ВСЕГДА выполняет роль закрытия [ ✕ ] пока открыты настройки/обновления
    if (btnSettings) {
        btnSettings.classList.add('settings-active');
        const icon = document.getElementById('btn-settings-icon');
        if (icon) icon.textContent = '✕';
        btnSettings.title = 'Закрыть настройки';
    }

    // Внутри настроек колокольчик ВСЕГДА скрыт (так как в табах есть вкладка ОБНОВЛЕНИЯ)
    if (btnChangelog) {
        btnChangelog.classList.add('hidden');
    }
}

/**
 * Сброс состояния кнопок в заголовке окна
 */
function resetHeaderButtons() {
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.classList.remove('settings-active');
        const iconSpan = document.getElementById('btn-settings-icon');
        if (iconSpan) iconSpan.textContent = '⚙';
        btnSettings.title = 'Настройки';
    }

    // Проверяем актуальность обновлений для показа колокольчика на главном экране
    checkChangelogBadge();
}

/**
 * Открыть панель настроек / чейнджлога с анимацией выпадания
 * @param {string|object} target - ID целевой вкладки ('general', 'mods', 'configs', 'changelog') или объект конфига
 */
export function openSettings(target = 'general') {
    initDOMRefs();
    if (!settingsScreen) return;
    if (settingsAnimating) return;

    // Запретить открытие настроек во время запуска игры
    const stepProgress = document.getElementById('step-progress');
    if (stepProgress && !stepProgress.classList.contains('hidden')) {
        return;
    }

    const targetTabId = (typeof target === 'string') ? target : 'general';

    // Если экран уже открыт — плавно переключаем вкладку горизонтально
    if (!settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing')) {
        switchTab(targetTabId);
        return;
    }

    // Скрываем основной интерфейс с анимацией разлетания
    toggleMainUIVisibility(false);

    // Сбросить горизонтальные направления каскадов
    document.querySelectorAll('.inertia-cascade, [data-dir]').forEach(el => {
        delete el.dataset.dir;
        el.classList.remove('inertia-cascade');
        Array.from(el.children).forEach(child => {
            child.style.animation = '';
        });
    });

    settingsAnimating = true;
    settingsScreen.classList.remove('hidden', 'closing');
    settingsScreen.classList.add('opening');

    // Настраиваем активный таб
    const tabButtons = Array.from(document.querySelectorAll('#settings-tabs-bar .tab-btn'));
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === targetTabId));

    const allTabs = Array.from(document.querySelectorAll('.tab-content'));
    allTabs.forEach(t => {
        t.classList.remove('slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
        if (t.id === `tab-${targetTabId}`) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    if (targetTabId === 'changelog') {
        renderChangelogList();
        markChangelogSeen();
    }

    const activeTab = document.getElementById(`tab-${targetTabId}`);
    if (activeTab) {
        const cascadeTarget = activeTab.querySelector('.settings-categories, .unified-dev-grid, #mods-grid, .inertia-cascade');
        if (cascadeTarget) {
            triggerInertiaCascade(cascadeTarget, 'down', true);
        }
    }

    // Деактивировать главную вкладку и запустить выпадение вкладок
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) titleMainTab.classList.remove('active');

    const titleBarTabs = document.getElementById('settings-tabs-bar');
    if (titleBarTabs) {
        titleBarTabs.classList.remove('hidden', 'closing');
        titleBarTabs.classList.add('opening');
    }

    updateHeaderControlsForTab(targetTabId);

    const activeTabBtn = document.querySelector('#settings-tabs-bar .tab-btn.active');
    currentTabIndex = activeTabBtn ? tabButtons.indexOf(activeTabBtn) : 0;

    // Snow burst
    if (appState.get('effects.snowEnabled')) {
        createSnowBurst();
    }

    setTimeout(() => {
        settingsScreen.classList.remove('opening');
        if (titleBarTabs) titleBarTabs.classList.remove('opening');
        settingsAnimating = false;
    }, 280);
}

/**
 * Закрыть настройки с анимацией (или мгновенно при переключении разделов)
 */
export function closeSettings(instant = false) {
    initDOMRefs();
    if (!settingsScreen) return;
    if (settingsAnimating && !instant) return;

    if (instant) {
        settingsScreen.className = 'settings-screen hidden';
        const titleBarTabs = document.getElementById('settings-tabs-bar');
        if (titleBarTabs) titleBarTabs.className = 'settings-tabs hidden';
        resetHeaderButtons();
        settingsAnimating = false;
        toggleMainUIVisibility(true);
        return;
    }

    settingsAnimating = true;
    settingsScreen.classList.remove('opening');
    settingsScreen.classList.add('closing');

    // Запускаем появление элементов главного экрана синхронно с закрытием настроек!
    toggleMainUIVisibility(true);

    // Активировать главную вкладку и спрятать вкладки настроек с анимацией
    const titleMainTab = document.getElementById('title-bar-title');
    if (titleMainTab) titleMainTab.classList.add('active');

    const titleBarTabs = document.getElementById('settings-tabs-bar');
    if (titleBarTabs) {
        titleBarTabs.classList.remove('opening');
        titleBarTabs.classList.add('closing');
        setTimeout(() => {
            titleBarTabs.classList.remove('closing');
            titleBarTabs.classList.add('hidden');
        }, 250);
    }

    resetHeaderButtons();

    setTimeout(() => {
        settingsScreen.classList.remove('closing');
        settingsScreen.classList.add('hidden');
        settingsAnimating = false;
    }, 250);
}

/**
 * Заполнить поля настроек из конфига
 */
export function populateSettingsFields(config) {
    currentConfig = config || {};
    initDOMRefs();

    const activeProfileId = window.__activeBuildProfileId || currentConfig.activeProfileId || 'ganj4craft5';
    const activeProfile = currentConfig.profiles?.[activeProfileId];
    const activeInstallPath = currentConfig.installRoot || activeProfile?.installPath || currentConfig.installPath || '';

    const pathInput = document.getElementById('setting-path');
    const javaInput = document.getElementById('setting-java');
    const ramMinInput = document.getElementById('setting-ram-min');
    const ramMaxInput = document.getElementById('setting-ram-max');
    const hideOnPlayCheckbox = document.getElementById('setting-hide-on-play');
    const skinModeSelect = document.getElementById('setting-skin-mode');
    const presetSelect = document.getElementById('setting-effects-preset');
    const densitySelect = document.getElementById('setting-effects-density');
    const smokeCheckbox = document.getElementById('setting-enable-smoke');
    const parallaxCheckbox = document.getElementById('setting-enable-parallax');
    const discordRpcCheckbox = document.getElementById('setting-enable-discord-rpc');

    if (pathInput) pathInput.value = activeInstallPath;
    if (javaInput) javaInput.value = config.javaPath || '';
    if (ramMinInput) ramMinInput.value = config.memoryMin || '1G';
    if (ramMaxInput) ramMaxInput.value = config.memoryMax || '3G';
    if (hideOnPlayCheckbox) hideOnPlayCheckbox.checked = config.hideOnPlay !== false;

    const skinMode = config.skinMode || getSkinViewerMode() || '3d';
    if (skinModeSelect) skinModeSelect.value = skinMode;

    let preset = config.effectsPreset || 'auto';
    if (config.enableSnow === false && (!config.effectsPreset || config.effectsPreset === 'snow')) {
        preset = 'off';
    }
    if (presetSelect) presetSelect.value = preset;
    if (densitySelect) densitySelect.value = config.effectsDensity || 'low';

    if (smokeCheckbox) smokeCheckbox.checked = config.enableSmoke !== false;
    if (parallaxCheckbox) parallaxCheckbox.checked = config.enableParallax !== false;
    if (discordRpcCheckbox) discordRpcCheckbox.checked = config.enableDiscordRpc !== false;

    // Инициализация RAM slider (новый UI)
    initRamSlider(config);
}

/**
 * Сохранить настройки
 */
export async function saveSettings() {
    let memMin = document.getElementById('setting-ram-min')?.value.trim().toUpperCase() || '1G';
    let memMax = document.getElementById('setting-ram-max')?.value.trim().toUpperCase() || '3G';

    // Append 'G' if just number
    if (memMin && /^\d+$/.test(memMin)) memMin += 'G';
    if (memMax && /^\d+$/.test(memMax)) memMax += 'G';

    // Validate format
    if (!/^\d+[MG]$/.test(memMin)) memMin = '1G';
    if (!/^\d+[MG]$/.test(memMax)) memMax = '3G';

    const selectedPreset = document.getElementById('setting-effects-preset')?.value || 'auto';
    const selectedSkinMode = document.getElementById('setting-skin-mode')?.value || '3d';
    const selectedDiscordRpc = document.getElementById('setting-enable-discord-rpc')?.checked ?? true;

    const activeProfileId = window.__activeBuildProfileId || currentConfig.activeProfileId || 'ganj4craft5';
    const selectedInstallRoot = document.getElementById('setting-path')?.value || '';
    const rootPath = selectedInstallRoot.replace(/[\\/]+$/, '');
    const profiles = {
        ...(currentConfig.profiles || {}),
        vanilla: {
            ...(currentConfig.profiles?.vanilla || {}),
            installPath: `${rootPath}/vanilla`,
        },
        ganj4craft5: {
            ...(currentConfig.profiles?.ganj4craft5 || {}),
            installPath: `${rootPath}/ganj4craft5`,
        },
        [activeProfileId]: {
            ...(currentConfig.profiles?.[activeProfileId] || {}),
            disabledMods: getDisabledMods(),
        },
    };

    const newConfig = {
        ...currentConfig,
        activeProfileId,
        installRoot: selectedInstallRoot,
        // Legacy alias remains the Vanilla profile path for older launcher code.
        installPath: profiles.vanilla.installPath,
        profiles,
        javaPath: document.getElementById('setting-java')?.value || '',
        memoryMin: memMin,
        memoryMax: memMax,
        hideOnPlay: document.getElementById('setting-hide-on-play')?.checked ?? true,
        skinMode: selectedSkinMode,
        effectsPreset: selectedPreset,
        effectsDensity: document.getElementById('setting-effects-density')?.value || 'low',
        enableSnow: selectedPreset !== 'off',
        enableSmoke: document.getElementById('setting-enable-smoke')?.checked ?? true,
        enableParallax: document.getElementById('setting-enable-parallax')?.checked ?? true,
        enableDiscordRpc: selectedDiscordRpc,
        disabledMods: getDisabledMods(),
        modsDefaultsApplied: true,
        modsDefaultsVersion: 2,
    };

    const ok = await window.api.saveConfig(newConfig);
    if (!ok) {
        logToConsole('[SETTINGS] Ошибка сохранения настроек (конфиг не записан).');
        return false;
    }

    currentConfig = newConfig;

    // Apply Skin Mode (3D / 2D / off)
    applySkinMode(selectedSkinMode);

    // Apply Visual Effects
    applyEffectsConfig(newConfig);

    if (newConfig.enableSmoke) {
        startSmokeEffect();
    } else {
        stopSmokeEffect();
    }

    // Toggle Parallax
    if (newConfig.enableParallax) {
        startParallax();
    } else {
        stopParallax();
    }

    // Update UI values
    const ramMinInput = document.getElementById('setting-ram-min');
    const ramMaxInput = document.getElementById('setting-ram-max');
    if (ramMinInput) ramMinInput.value = memMin;
    if (ramMaxInput) ramMaxInput.value = memMax;

    // Update state and hide save button
    initialSettingsState = getCurrentSettingsState();
    hasUnsavedChanges = false;
    const saveBtn = dom.get('save-settings');
    if (saveBtn) saveBtn.classList.remove('visible');

    logToConsole('[SETTINGS] Saved.');
    return true;
}

/**
 * Инициализация табов настроек
 */
let mainTabTimer = null;

/**
 * Переключить активную вкладку с плавной горизонтальной анимацией (ViewPager)
 * @param {string} targetTabId - ID вкладки ('general', 'mods', 'configs', 'changelog', 'dev')
 */
export function switchTab(targetTabId) {
    if (!targetTabId) return;

    const tabButtons = Array.from(document.querySelectorAll('.settings-tabs .tab-btn'));
    const btn = tabButtons.find(b => b.dataset.tab === targetTabId);
    const targetTab = document.getElementById(`tab-${targetTabId}`);

    if (!btn || !targetTab) return;

    // Если вкладка уже активна — ничего не делаем
    if (btn.classList.contains('active') && targetTab.classList.contains('active')) return;

    // Если идет анимация переключения — пропуск
    const settingsBody = document.querySelector('.settings-body');
    if (settingsBody && settingsBody.classList.contains('animating')) return;

    const allTabs = Array.from(document.querySelectorAll('.tab-content'));
    const currentActiveTab = allTabs.find(t => t.classList.contains('active') && t !== targetTab);

    const index = tabButtons.indexOf(btn);
    const direction = index >= currentTabIndex ? 'right' : 'left';
    currentTabIndex = index;

    if (mainTabTimer) {
        clearTimeout(mainTabTimer);
        mainTabTimer = null;
    }

    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Синхронизация кнопок ⚙️ и 🔔 в заголовке
    updateHeaderControlsForTab(targetTabId);

    try {
        const tabNames = {
            general: 'Настройки',
            mods: 'Моды',
            configs: 'Конфиги',
            changelog: 'Обновления'
        };
        const viewName = tabNames[targetTabId] || 'Настройки';
        const user = localStorage.getItem('auth_user') || '';
        window.api?.updateDiscordActivity?.({
            username: user,
            profileId: window.__activeBuildProfileId,
            viewName
        });
    } catch (_) {}

    if (settingsBody) settingsBody.classList.add('animating');

    allTabs.forEach(t => {
        t.classList.remove('slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
    });

    if (currentActiveTab) {
        currentActiveTab.classList.remove('active');
        currentActiveTab.classList.add(direction === 'right' ? 'slide-out-to-left' : 'slide-out-to-right');
    }

    targetTab.classList.add('active');
    targetTab.classList.add(direction === 'right' ? 'slide-in-from-right' : 'slide-in-from-left');

    if (targetTabId === 'changelog') {
        renderChangelogList();
        markChangelogSeen();
    }

    const cascadeTarget = targetTab.querySelector('.settings-categories, .unified-dev-grid, #mods-grid, .inertia-cascade');
    if (cascadeTarget) {
        triggerInertiaCascade(cascadeTarget, direction, true);
    }

    if (appState.get('effects.snowEnabled')) {
        createDirectionalBurst(direction);
        if (targetTabId === 'configs' || targetTabId === 'dev' || targetTabId === 'changelog') {
            effectsEngine.stop();
        } else {
            effectsEngine.start();
        }
    }

    mainTabTimer = setTimeout(() => {
        const activeBtn = document.querySelector('.settings-tabs .tab-btn.active');
        const activeId = activeBtn ? activeBtn.dataset.tab : null;
        const activeTab = activeId ? document.getElementById(`tab-${activeId}`) : targetTab;

        allTabs.forEach(t => {
            t.classList.remove('slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
            if (t === activeTab) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        if (cascadeTarget) {
            delete cascadeTarget.dataset.dir;
            cascadeTarget.classList.remove('inertia-cascade');
            const cardTargets = cascadeTarget.querySelectorAll(':scope > div > .settings-category, :scope > div > .full-mods-list-card');
            const itemsToReset = cardTargets.length > 0 ? Array.from(cardTargets) : Array.from(cascadeTarget.children);
            itemsToReset.forEach(child => {
                child.style.animation = '';
            });
        }

        if (settingsBody) settingsBody.classList.remove('animating');
        mainTabTimer = null;
    }, 550);
}

/**
 * Инициализация табов настроек
 */
export function initSettingsTabs(config) {
    const tabButtons = Array.from(document.querySelectorAll('.settings-tabs .tab-btn'));

    tabButtons.forEach((btn) => {
        if (btn.dataset.tabsBound) return;
        btn.dataset.tabsBound = 'true';

        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
}

/**
 * Инициализация кнопок выбора пути
 */
export function initPathSelectors() {
    const selectPathBtn = document.getElementById('btn-select-path');
    const openPathBtn = document.getElementById('btn-open-path');
    const selectJavaBtn = document.getElementById('btn-select-java');
    const resetJavaBtn = document.getElementById('btn-reset-java');

    if (selectPathBtn && !selectPathBtn.dataset.bound) {
        selectPathBtn.dataset.bound = 'true';
        selectPathBtn.addEventListener('click', async () => {
            const path = await window.api.selectPath('dir');
            if (path) {
                document.getElementById('setting-path').value = path;
                updateSaveButtonVisibility();
            }
        });
    }

    if (openPathBtn && !openPathBtn.dataset.bound) {
        openPathBtn.dataset.bound = 'true';
        openPathBtn.addEventListener('click', async () => {
            const path = document.getElementById('setting-path')?.value;
            if (path) {
                await window.api.openFolder(path);
            }
        });
    }

    if (selectJavaBtn && !selectJavaBtn.dataset.bound) {
        selectJavaBtn.dataset.bound = 'true';
        selectJavaBtn.addEventListener('click', async () => {
            const path = await window.api.selectPath('java');
            if (path) {
                document.getElementById('setting-java').value = path;
                updateSaveButtonVisibility();
            }
        });
    }

    if (resetJavaBtn && !resetJavaBtn.dataset.bound) {
        resetJavaBtn.dataset.bound = 'true';
        resetJavaBtn.addEventListener('click', () => {
            document.getElementById('setting-java').value = '';
            updateSaveButtonVisibility();
        });
    }
}

/**
 * Инициализация кнопки переустановки
 */
export function initReinstallButton() {
    const reinstallBtn = document.getElementById('btn-reinstall');
    if (reinstallBtn && !reinstallBtn.dataset.bound) {
        reinstallBtn.dataset.bound = 'true';
        reinstallBtn.addEventListener('click', async () => {
            const confirmed = await customConfirm(
                'Это удалит все моды и настройки игры. Продолжить?',
                '⚠️ Переустановка клиента'
            );
            if (confirmed) {
                await window.api.reinstallClient();
                await customAlert('Файлы клиента удалены. Пожалуйста, перезапустите лаунчер или нажмите ИГРАТЬ для повторной загрузки.', '✅ Переустановка завершена');
                settingsScreen?.classList.add('hidden');
            }
        });
    }
}

/**
 * Инициализация кнопок выбора всех/сброса модов
 */
export function initModsButtons() {
    const selectAllBtn = document.getElementById('mods-select-all');
    const deselectAllBtn = document.getElementById('mods-deselect-all');

    if (selectAllBtn && !selectAllBtn.dataset.bound) {
        selectAllBtn.dataset.bound = 'true';
        selectAllBtn.addEventListener('click', () => {
            setAllModsState(true);
            updateModsCounter();
            updateCategorySidebar();
            updateSaveButtonVisibility();
        });
    }

    if (deselectAllBtn && !deselectAllBtn.dataset.bound) {
        deselectAllBtn.dataset.bound = 'true';
        deselectAllBtn.addEventListener('click', () => {
            setAllModsState(false);
            updateModsCounter();
            updateCategorySidebar();
            updateSaveButtonVisibility();
        });
    }
}

/**
 * Сохранить initial state после загрузки
 */
export function captureInitialSettingsState() {
    initialSettingsState = getCurrentSettingsState();
    hasUnsavedChanges = false;
    const saveBtn = dom.get('save-settings');
    if (saveBtn) saveBtn.classList.remove('visible');
}

/**
 * Проверка анимации
 */
export function isSettingsAnimating() {
    return settingsAnimating;
}

/**
 * Получить текущий конфиг
 */
export function getCurrentConfig() {
    return currentConfig;
}

/**
 * Установить текущий конфиг
 */
export function setCurrentConfig(config) {
    currentConfig = config;
}
