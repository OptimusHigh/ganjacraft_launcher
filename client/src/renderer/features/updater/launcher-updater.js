/**
 * Ganj4Craft Launcher - Auto-Updater Feature
 * Управление состоянием обновления лаунчера и переключением кнопки «Играть» -> «Обновить»
 */

import { dom } from '../../utils/dom.js';
import { customAlert, showNotification } from '../../ui/modals.js';
import { logToConsole } from '../console/index.js';

const updaterState = {
    isAvailable: false,
    version: '',
    isDownloading: false,
    isDownloaded: false,
    percent: 0
};

export function isLauncherUpdateAvailable() {
    return updaterState.isAvailable;
}

export function isLauncherUpdateDownloading() {
    return updaterState.isDownloading;
}

export function isLauncherUpdateDownloaded() {
    return updaterState.isDownloaded;
}

export function getLauncherUpdateState() {
    return { ...updaterState };
}

/**
 * Отрисовать состояние кнопки Play / Update
 */
export function renderLauncherUpdateButton() {
    const playBtn = dom.get('play-btn');
    if (!playBtn) return;

    if (updaterState.isDownloaded) {
        playBtn.className = 'launcher-play-btn is-update-btn is-ready-to-install';
        playBtn.setAttribute('title', 'Установить обновление и перезапустить');
        playBtn.setAttribute('aria-label', 'Перезапустить');
        playBtn.innerHTML = `
            <svg class="play-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span class="play-btn-text">ПЕРЕЗАПУСТИТЬ</span>
        `;
    } else if (updaterState.isDownloading) {
        playBtn.className = 'launcher-play-btn is-update-btn is-downloading';
        const percentVal = Math.max(0, Math.min(100, updaterState.percent || 0));
        const displayPercent = String(Math.round(percentVal)).padStart(2, '0');
        const titleText = `Загрузка обновления: ${percentVal}%`;
        playBtn.setAttribute('title', titleText);
        playBtn.setAttribute('aria-label', titleText);
        playBtn.innerHTML = `
            <span class="play-btn-spinner"></span>
            <span class="play-btn-text">ЗАГРУЗКА ${displayPercent}%</span>
        `;
    } else if (updaterState.isAvailable) {
        playBtn.className = 'launcher-play-btn is-update-btn';
        const titleText = updaterState.version ? `Обновить лаунчер (v${updaterState.version})` : 'Обновить лаунчер';
        playBtn.setAttribute('title', titleText);
        playBtn.setAttribute('aria-label', 'Обновить');
        playBtn.innerHTML = `
            <svg class="play-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="play-btn-text">ОБНОВИТЬ</span>
        `;
    } else {
        playBtn.className = 'launcher-play-btn';
        playBtn.setAttribute('title', 'Играть');
        playBtn.setAttribute('aria-label', 'Играть');
        playBtn.innerHTML = `
            <svg class="play-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
            <span class="play-btn-text">ИГРАТЬ</span>
        `;
    }
}

let isSimulationMode = false;

/**
 * Начать загрузку обновления
 */
export async function startDownloadingLauncherUpdate() {
    if (updaterState.isDownloading) {
        showNotification(`Загрузка обновления уже идёт${updaterState.percent > 0 ? ` (${updaterState.percent}%)` : ''}...`, 'info', 'Обновление', 3000);
        return;
    }
    if (updaterState.isDownloaded) {
        if (isSimulationMode) {
            showNotification(`[DEV] Симуляция: лаунчер бы перезапустился и установил v${updaterState.version || '1.0.183'}!`, 'success', 'Тест обновления', 5000);
        } else {
            window.api.installUpdate();
        }
        return;
    }

    updaterState.isDownloading = true;
    updaterState.percent = 0;
    renderLauncherUpdateButton();
    showNotification('Загрузка обновления началась...', 'info', 'Обновление', 4000);
    logToConsole('[UPDATER] Загрузка новой версии лаунчера...');

    // Если запущена симуляция в dev-режиме
    if (isSimulationMode) {
        let currentPercent = 0;
        const interval = setInterval(() => {
            currentPercent += Math.floor(Math.random() * 8) + 8; // Шаг 8..15%
            if (currentPercent >= 100) {
                clearInterval(interval);
                updaterState.percent = 100;
                updaterState.isDownloading = false;
                updaterState.isDownloaded = true;
                renderLauncherUpdateButton();
                logToConsole('[UPDATER] [DEV] Симуляция: Обновление загружено.');
                showNotification('Обновление готово к установке! Нажмите кнопку для перезапуска.', 'success', 'Обновление загружено', 6000);
            } else {
                updaterState.percent = currentPercent;
                renderLauncherUpdateButton();
            }
        }, 320);
        return;
    }

    try {
        const res = await window.api.downloadUpdate();
        if (res && res.success === false) {
            updaterState.isDownloading = false;
            renderLauncherUpdateButton();
            showNotification(`Ошибка скачивания обновления: ${res.error || 'Неизвестная ошибка'}`, 'error', 'Ошибка обновления', 6000);
        }
    } catch (e) {
        updaterState.isDownloading = false;
        renderLauncherUpdateButton();
        console.error('[UPDATER] downloadUpdate error:', e);
        showNotification(`Ошибка скачивания обновления: ${e.message}`, 'error', 'Ошибка обновления', 6000);
    }
}

/**
 * Обработка клика по кнопке обновления
 */
export function handleLauncherUpdateClick() {
    if (updaterState.isDownloaded) {
        if (isSimulationMode) {
            showNotification(`[DEV] Симуляция: лаунчер бы перезапустился и установил v${updaterState.version || '1.0.183'}!`, 'success', 'Тест обновления', 5000);
        } else {
            logToConsole('[UPDATER] Установка обновления и перезапуск...');
            window.api.installUpdate();
        }
    } else if (updaterState.isDownloading) {
        showNotification(`Загрузка обновления продолжается${updaterState.percent > 0 ? ` (${updaterState.percent}%)` : ''}...`, 'info', 'Обновление', 3000);
    } else if (updaterState.isAvailable) {
        startDownloadingLauncherUpdate();
    }
}

/**
 * Инициализация обработчиков IPC для обновления лаунчера
 */
export function initLauncherUpdaterHandlers() {
    if (!window.api) return;

    if (window.api.onUpdateAvailable) {
        window.api.onUpdateAvailable((info) => {
            const version = info?.version || '';
            updaterState.isAvailable = true;
            updaterState.version = version;
            renderLauncherUpdateButton();

            const msg = version 
                ? `Доступна новая версия лаунчера (v${version}). Нажмите кнопку по центру для обновления.`
                : 'Доступна новая версия лаунчера. Нажмите кнопку по центру для обновления.';

            showNotification(msg, 'info', 'Доступно обновление', 6000);
        });
    }

    if (window.api.onUpdateProgress) {
        window.api.onUpdateProgress((progress) => {
            if (!updaterState.isDownloading) {
                updaterState.isDownloading = true;
            }
            if (progress && typeof progress.percent === 'number') {
                updaterState.percent = Math.round(progress.percent);
            }
            renderLauncherUpdateButton();
        });
    }

    if (window.api.onUpdateDownloaded) {
        window.api.onUpdateDownloaded(() => {
            updaterState.isDownloading = false;
            updaterState.isDownloaded = true;
            renderLauncherUpdateButton();

            logToConsole('[UPDATER] Обновление успешно загружено.');
            showNotification('Обновление готово к установке! Нажмите кнопку для перезапуска.', 'success', 'Обновление загружено', 6000);
        });
    }

    // Expose developer simulation helpers
    if (typeof window !== 'undefined') {
        window.simulateUpdateAvailable = (version = '1.0.183') => {
            isSimulationMode = true;
            updaterState.isAvailable = true;
            updaterState.version = version;
            renderLauncherUpdateButton();
            const msg = `Доступна новая версия лаунчера (v${version}). Нажмите кнопку по центру для обновления.`;
            showNotification(msg, 'info', 'Доступно обновление', 6000);
        };
        window.simulateUpdateProgress = (percent = 45) => {
            updaterState.isDownloading = true;
            updaterState.percent = percent;
            renderLauncherUpdateButton();
        };
        window.simulateUpdateDownloaded = () => {
            updaterState.isDownloading = false;
            updaterState.isDownloaded = true;
            renderLauncherUpdateButton();
            showNotification('Обновление готово к установке! Нажмите кнопку для перезапуска.', 'success', 'Обновление загружено', 6000);
        };
    }
}
