/**
 * Ganj4Craft Launcher - Game Launch Feature
 * Запуск игры и обработка прогресса
 */

import { dom } from '../../utils/dom.js';
import { logToConsole } from '../console/index.js';
import { showNotification } from '../../ui/modals.js';
import { getCurrentUsername, getAuthToken } from '../auth/index.js';
import { getCurrentConfig, settingsChanged, saveSettings, closeSettings } from '../settings/index.js';
import { isLauncherUpdateAvailable, handleLauncherUpdateClick, renderLauncherUpdateButton } from '../updater/index.js';

/**
 * Заблокировать кнопки настроек и шапки при запуске
 */
let isGameLaunching = false;

export function isGameLaunchingActive() {
    return isGameLaunching;
}

export function toggleLaunchLogModal() {
    const modal = dom.get('launch-log-modal');
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        document.body.classList.add('log-modal-open');
        const output = dom.get('console-output');
        if (output) output.scrollTop = output.scrollHeight;
    } else {
        modal.classList.add('hidden');
        document.body.classList.remove('log-modal-open');
    }
}

export function lockControlsForLaunch() {
    isGameLaunching = true;
    document.body.classList.add('is-game-launching');
    const stepPlay = dom.get('step-play');
    if (stepPlay) stepPlay.classList.add('is-game-launching');
    try {
        closeSettings();
    } catch (e) {
        // ignore
    }

    const btnSettings = dom.get('btn-settings');
    const btnChangelog = dom.get('btn-changelog');
    const titleBtn = dom.get('title-bar-title');
    const settingsTabsBar = dom.get('settings-tabs-bar');
    const playBtn = dom.get('play-btn');
    const popCounter = dom.get('particle-pop-counter');

    if (btnSettings) {
        btnSettings.classList.remove('disabled-launch');
        btnSettings.removeAttribute('disabled');
        btnSettings.classList.add('active-log-btn');
        btnSettings.setAttribute('title', 'Логи запуска и консоль игры');
    }
    if (btnChangelog) {
        btnChangelog.classList.add('disabled-launch');
        btnChangelog.setAttribute('disabled', 'true');
        btnChangelog.setAttribute('title', 'Обновления недоступны во время запуска');
    }
    if (titleBtn) {
        titleBtn.classList.add('disabled-launch');
    }
    if (settingsTabsBar) {
        settingsTabsBar.classList.add('hidden');
    }

    // Трансформируем круглую кнопку Play в кнопку Cancel
    if (playBtn) {
        playBtn.classList.add('is-cancelling-btn');
        playBtn.setAttribute('title', 'Отменить запуск');
        playBtn.innerHTML = `
            <span class="play-btn-glow-ring cancel-glow"></span>
            <svg class="play-btn-cancel-icon" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" stroke-width="2.6" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
    }
}

/**
 * Разблокировать кнопки настроек и шапки после завершения/отмены запуска
 */
export function unlockControlsAfterLaunch() {
    isGameLaunching = false;
    document.body.classList.remove('is-game-launching');
    const stepPlay = dom.get('step-play');
    if (stepPlay) stepPlay.classList.remove('is-game-launching');
    const modal = dom.get('launch-log-modal');
    if (modal) modal.classList.add('hidden');

    const btnSettings = dom.get('btn-settings');
    const btnChangelog = dom.get('btn-changelog');
    const titleBtn = dom.get('title-bar-title');
    const playBtn = dom.get('play-btn');

    if (btnSettings) {
        btnSettings.classList.remove('disabled-launch');
        btnSettings.classList.remove('active-log-btn');
        btnSettings.removeAttribute('disabled');
        btnSettings.setAttribute('title', 'Настройки');
    }
    if (btnChangelog) {
        btnChangelog.classList.remove('disabled-launch');
        btnChangelog.removeAttribute('disabled');
        btnChangelog.setAttribute('title', 'Обновления сборки');
    }
    if (titleBtn) {
        titleBtn.classList.remove('disabled-launch');
    }

    // Возвращаем круглую кнопку в актуальный режим (Play или Update)
    if (playBtn) {
        playBtn.classList.remove('is-cancelling-btn');
        renderLauncherUpdateButton();
    }
}

/**
 * Обновить прогресс-бар игры (реалистичный эффект тления косяка)
 * @param {HTMLElement} container - Контейнер с изображением косяка
 * @param {HTMLElement} burn - Элемент с эффектом горения (огонёк)
 * @param {HTMLElement} endImg - Изображение окурка (показывается при 100%)
 * @param {number} percent - Процент прогресса (0-100)
 */
export function setJointProgress(container, burn, endImg, percent) {
    if (!container) return;

    const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;

    // Constants for realistic smoking effect
    const MAX_WIDTH = 260; // Total width of the image in pixels
    const MIN_WIDTH = 28;  // Width at 100% progress (the filter/butt)
    const START_BURN_HEIGHT = 19; // Thickness at start
    const END_BURN_HEIGHT = 10;    // Thickness at end

    // Calculate current width of the container (the unsmoked part)
    // 0% progress -> MAX_WIDTH
    // 100% progress -> MIN_WIDTH
    const currentWidthPx = MAX_WIDTH - ((MAX_WIDTH - MIN_WIDTH) * (safePercent / 100));

    // Calculate burn height (thickness)
    const currentBurnHeight = START_BURN_HEIGHT - ((START_BURN_HEIGHT - END_BURN_HEIGHT) * (safePercent / 100));

    if (safePercent >= 100) {
        // Finished
        container.classList.add('hidden');
        if (burn) burn.classList.add('hidden');
        if (endImg) endImg.classList.remove('hidden');
    } else {
        // In progress
        container.classList.remove('hidden');
        container.style.width = `${currentWidthPx}px`;

        if (burn) {
            burn.classList.remove('hidden');

            // Position: The burn is separate from the container in the DOM.
            // It tracks the left edge of the visible joint.
            // Since the joint is anchored right, the left edge is at (MAX_WIDTH - currentWidthPx).
            const burnLeftPos = MAX_WIDTH - currentWidthPx;
            burn.style.left = `${burnLeftPos}px`;

            // Vertical Trajectory: Moves down by 3px as it burns
            // 0% -> 0px offset
            // 100% -> 3px offset
            const verticalOffset = 3 * (safePercent / 100);
            burn.style.top = `${verticalOffset}px`;

            // Update height/thickness of the burning tip
            const burnTip = burn.querySelector('.joint-burn');
            if (burnTip) {
                burnTip.style.height = `${currentBurnHeight}px`;
            }
        }

        if (endImg) endImg.classList.add('hidden');
    }
}

/**
 * Показать экран игры (после отмены или ошибки запуска)
 */
function showPlayScreen() {
    const stepPlay = dom.get('step-play');
    const stepProgress = dom.get('step-progress');

    if (stepProgress) stepProgress.classList.add('hidden');
    if (stepPlay) {
        stepPlay.classList.remove('hidden');
        stepPlay.classList.add('fade-in');
    }
    unlockControlsAfterLaunch();
}

/**
 * Запустить игру
 */
export async function startLaunch() {
    console.log('[GAME] startLaunch() called');
    if (!window.__activeBuildProfileId) {
        const selector = document.getElementById('build-profile-selector');
        if (selector) {
            selector.focus();
            selector.setAttribute('aria-invalid', 'true');
            setTimeout(() => selector.removeAttribute('aria-invalid'), 1800);
        }
        const message = 'Сначала выберите сборку в списке рядом с кнопкой «Играть».';
        logToConsole(`[LAUNCHER] ${message}`);
        showNotification(message, 'warning', 'Сборка не выбрана', 4000);
        showPlayScreen();
        return false;
    }
    if (isLauncherUpdateAvailable()) {
        handleLauncherUpdateClick();
        return;
    }
    lockControlsForLaunch();

    const statusDiv = dom.get('game-status') || dom.get('status');
    const consoleOutput = dom.get('console-output');
    const retryBtn = dom.get('retry-btn');
    const cancelBtn = dom.get('cancel-btn');
    const gameJointProgress = dom.get('game-joint-progress');
    const gameJointBurn = dom.get('game-joint-burn');
    const gameJointEnd = dom.get('game-joint-end');

    // Reset UI
    if (statusDiv) {
        statusDiv.innerText = 'Инициализация запуска...';
        statusDiv.style.color = '#39ff14';
    }
    setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);

    if (retryBtn) retryBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    // Auto-save any pending setting or mod changes before launching
    if (settingsChanged()) {
        logToConsole('[SETTINGS] Сохранение изменённых настроек перед запуском...');
        await saveSettings();
    }

    logToConsole('[LAUNCHER] Подготовка к запуску игры...');
    console.log('[GAME] Calling window.api.launchGame...');

    let result;
    try {
        result = await window.api.launchGame({
            username: getCurrentUsername(),
            token: getAuthToken(),
            profileId: window.__activeBuildProfileId || undefined,
        });
    } catch (error) {
        console.error('[GAME] launchGame IPC failed:', error);
        const message = error?.message || 'Не удалось связаться с процессом запуска.';
        if (statusDiv) {
            statusDiv.innerText = `Ошибка: ${message.substring(0, 40)}${message.length > 40 ? '...' : ''}`;
            statusDiv.style.color = '#ef5350';
        }
        logToConsole(`[ERROR] ${message}`);
        if (retryBtn) retryBtn.classList.remove('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        showPlayScreen();
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
        return false;
    }
    console.log('[GAME] window.api.launchGame returned:', result);

    if (result.success) {
        if (statusDiv) {
            statusDiv.innerText = 'Загрузка Minecraft и модов...';
            statusDiv.style.color = '#39ff14';
        }
        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 100);
    } else {
        // Error Handling
        console.error(result.error);

        const err = result.error ? result.error.toString() : 'Неизвестная ошибка';

        // Handle Cancellation
        if (err === 'Запуск отменен' || err.includes('CANCELLED')) {
            logToConsole('[LAUNCHER] Запуск отменен пользователем.');
            showPlayScreen();
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
            if (statusDiv) {
                statusDiv.innerText = 'Запуск отменен';
                statusDiv.style.color = '#ef5350';
            }
            unlockControlsAfterLaunch();
            return;
        }

        let msg = 'Ошибка запуска';

        if (err.includes('ENOTFOUND') || err.includes('ETIMEDOUT') || err.includes('UnknownHostException')) {
            msg = 'Потеряно соединение. Проверьте интернет.';
        } else {
            msg = 'Ошибка: ' + err.substring(0, 40) + (err.length > 40 ? '...' : '');
        }

        if (statusDiv) {
            statusDiv.innerText = msg;
            statusDiv.style.color = '#ef5350';
        }

        logToConsole(`[ERROR] ${result.error}`);

        // Show Retry
        if (retryBtn) retryBtn.classList.remove('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        unlockControlsAfterLaunch();
    }
}

/**
 * Отменить запуск и/или закрыть игру
 */
export async function cancelLaunch() {
    logToConsole('[LAUNCHER] Отмена запуска пользователем...');

    const statusDiv = dom.get('game-status') || dom.get('status');
    const gameJointProgress = dom.get('game-joint-progress');
    const gameJointBurn = dom.get('game-joint-burn');
    const gameJointEnd = dom.get('game-joint-end');
    const cancelBtn = dom.get('cancel-btn');
    const retryBtn = dom.get('retry-btn');
    const playBtn = dom.get('play-btn');

    if (statusDiv) {
        statusDiv.innerText = 'Запуск отменяется...';
        statusDiv.style.color = '#ffaa00';
    }

    if (playBtn) {
        playBtn.disabled = true;
    }

    try {
        await window.api.cancelLaunch();
    } catch (e) {
        console.error('cancelLaunch error:', e);
    }

    showPlayScreen();
    setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);

    if (statusDiv) {
        statusDiv.innerText = 'Запуск отменен';
        statusDiv.style.color = '#ef5350';
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (retryBtn) retryBtn.classList.remove('hidden');

    if (playBtn) {
        playBtn.disabled = false;
    }

    unlockControlsAfterLaunch();
}

/**
 * Инициализация IPC обработчиков прогресса
 */
export function initProgressHandlers() {
    const statusDiv = dom.get('game-status') || dom.get('status');
    const gameJointProgress = dom.get('game-joint-progress');
    const gameJointBurn = dom.get('game-joint-burn');
    const gameJointEnd = dom.get('game-joint-end');
    const cancelBtn = dom.get('cancel-btn');
    const stepProgress = dom.get('step-progress');
    const stepPlay = dom.get('step-play');

    // Progress Handler
    if (window.api.onProgress) {
        window.api.onProgress((e) => {
            try {
                if (!e || typeof e.task !== 'number' || typeof e.total !== 'number' || e.total <= 0) return;
                const percent = Math.max(0, Math.min(100, (e.task / e.total) * 100));
                setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, percent);
                const statusEl = dom.get('game-status') || dom.get('status');
                if (statusEl) {
                    if (e.currentFile) {
                        const filename = e.currentFile.split(/[/\\]/).pop();
                        const tag = e.sourceName ? `[${e.sourceName}] ` : '';
                        statusEl.innerText = `${tag}${filename} (${Math.round(percent)}%)`;
                    } else {
                        statusEl.innerText = `Загрузка ресурсов: ${Math.round(percent)}%`;
                    }
                }
            } catch (err) {
                console.error('[Progress handler error]', err);
            }
        });
    }

    // Log Handler
    window.api.onLog((text) => {
        logToConsole(text);
        const statusEl = dom.get('game-status') || dom.get('status');

        if (text.includes('Скачивание:')) {
            if (statusEl) statusEl.innerText = 'Загрузка ресурсов...';
            if (gameJointProgress && !gameJointProgress.classList.contains('hidden') && gameJointProgress.style.width === '100%') {
                setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 40);
            }
        } else if (text.includes('Обновление завершено')) {
            if (statusEl) statusEl.innerText = 'Запуск игры...';
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 100);
            if (cancelBtn) cancelBtn.classList.add('hidden');
        } else if (text.includes('Проверка обновлений')) {
            if (statusEl) statusEl.innerText = 'Проверка обновлений...';
            setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 5);
        }
    });

    // Game Fully Ready Handler (Minecraft main window & sound engine loaded)
    if (window.api.onGameReady) {
        window.api.onGameReady(() => {
            logToConsole('[LAUNCHER] Игра Minecraft полностью инициализирована!');
            const statusEl = dom.get('game-status') || dom.get('status');
            if (statusEl) {
                statusEl.innerText = 'Игра запущена';
                statusEl.style.color = '#39ff14';
            }

            // Сворачиваем лаунчер только теперь, когда игра действительно полностью готова
            const cfg = getCurrentConfig() || {};
            if (cfg.hideOnPlay !== false) {
                window.api.minimize();
            }
        });
    }

    // Game Closed Handler
    window.api.onGameClosed(() => {
        logToConsole('[LAUNCHER] Игровая сессия завершена.');

        if (stepProgress) stepProgress.classList.add('hidden');
        if (stepPlay) {
            stepPlay.classList.remove('hidden');
            stepPlay.classList.add('fade-in');
        }

        setJointProgress(gameJointProgress, gameJointBurn, gameJointEnd, 0);
        const statusEl = dom.get('game-status') || dom.get('status');
        if (statusEl) {
            statusEl.innerText = 'Готов к игре';
            statusEl.style.color = '#39ff14';
        }

        const playBtn = dom.get('play-btn');
        if (playBtn) {
            playBtn.disabled = !window.__activeBuildProfileId
                && !playBtn.classList.contains('is-update-btn');
        }

        unlockControlsAfterLaunch();
    });
}

/**
 * Инициализация кнопок запуска
 */
export function initGameButtons() {
    const playBtn = dom.get('play-btn');
    const cancelBtn = dom.get('cancel-btn');
    const retryBtn = dom.get('retry-btn');
    const stepPlay = dom.get('step-play');
    const stepProgress = dom.get('step-progress');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (isGameLaunching) {
                cancelLaunch();
            } else if (isLauncherUpdateAvailable()) {
                handleLauncherUpdateClick();
            } else if (!window.__activeBuildProfileId) {
                startLaunch();
            } else {
                if (stepProgress) {
                    stepProgress.classList.remove('hidden');
                    stepProgress.classList.add('fade-in');
                }
                startLaunch();
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelLaunch);
    }

    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (isLauncherUpdateAvailable()) {
                handleLauncherUpdateClick();
            } else {
                startLaunch();
            }
        });
    }

    const btnCloseLog = dom.get('btn-close-log-modal');
    if (btnCloseLog) {
        btnCloseLog.addEventListener('click', () => {
            toggleLaunchLogModal();
        });
    }

    const backdropLog = dom.get('launch-log-backdrop');
    if (backdropLog) {
        backdropLog.addEventListener('click', () => {
            toggleLaunchLogModal();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = dom.get('launch-log-modal');
            if (modal && !modal.classList.contains('hidden')) {
                toggleLaunchLogModal();
            }
        }
    });
}
