/**
 * Ganj4Craft Launcher - Authentication Feature
 * Аутентификация через Telegram OTP
 */

import { appState } from '../../state/app-state.js';
import { dom } from '../../utils/dom.js';
import { showError } from '../../ui/modals.js';
import { ERROR_DISPLAY_TIME, API_BASE } from '../../constants.js';
import { initSkinViewer } from '../skin-viewer/index.js';
import { initMagneticPlayButton } from '../ui/magnetic-button.js';

// Локальный стейт для auth flow
let currentUsername = '';

/**
 * Проверить сохранённую аутентификацию
 */
export async function checkSavedAuth() {
    // Small delay to ensure Electron has loaded localStorage from leveldb
    await new Promise(r => setTimeout(r, 100));

    const savedUser = localStorage.getItem('auth_user');
    const savedToken = localStorage.getItem('auth_token');

    if (savedUser && savedToken) {
        try {
            const result = await window.api.checkAuth(savedUser, savedToken);
            // Server returns { success: true } not { valid: true }
            if (result.success) {
                currentUsername = savedUser;

                // Update admin status from server
                if (result.is_admin) {
                    localStorage.setItem('is_admin', 'true');
                } else {
                    localStorage.removeItem('is_admin');
                }

                appState.update('auth', {
                    isLoggedIn: true,
                    username: savedUser,
                    token: savedToken,
                    isAdmin: !!result.is_admin
                });

                hideLoginStep();
                await showBuildSelection();
                return true;
            }
        } catch (e) {
            console.warn('[AUTH] Token check failed:', e);
        }

        // Token invalid, clear
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
    }

    // No valid auth - show login screen
    showLoginScreen();
    return false;
}

/**
 * Запросить код подтверждения (Step 1)
 * @param {string} username 
 */
export async function requestAuthCode(username) {
    if (!username.trim()) {
        showError('login-error', 'Пожалуйста, введите никнейм');
        return { success: false };
    }

    try {
        const result = await window.api.requestAuth(username);
        if (result.success) {
            currentUsername = username;
            appState.set('auth.username', username);
            return { success: true, has_password: result.has_password };
        } else {
            showError('login-error', result.message || result.error || 'Ошибка сервера');
            return { success: false, error: result.message || result.error, status: result.status, has_password: result.has_password };
        }
    } catch (e) {
        showError('login-error', e.message);
        console.error('[AUTH] Request code failed:', e);
        return { success: false, error: e.message, status: 0 };
    }
}

/**
 * Проверить код подтверждения (Step 2)
 * @param {string} code 
 */
export async function verifyAuthCode(code) {
    if (!code.trim()) {
        return { success: false, error: 'Введите код' };
    }

    try {
        const result = await window.api.verifyAuth(currentUsername, code);
        if (result.success) {
            // Save auth to localStorage
            localStorage.setItem('auth_user', currentUsername);
            if (result.token) {
                localStorage.setItem('auth_token', result.token);
            }
            // Save admin status
            if (result.is_admin) {
                localStorage.setItem('is_admin', 'true');
            } else {
                localStorage.removeItem('is_admin');
            }

            appState.update('auth', {
                isLoggedIn: true,
                username: currentUsername,
                token: result.token,
                isAdmin: !!result.is_admin
            });

            return { success: true };
        } else {
            showError('code-error', result.error || 'Неверный код');
            return { success: false, error: result.error, status: result.status };
        }
    } catch (e) {
        const message = e?.message || String(e);
        showError('code-error', message || 'Ошибка сети');
        console.error('[AUTH] Verify failed:', e);
        return { success: false, error: message, status: 0 };
    }
}

/**
 * Выход из аккаунта
 */
export function logout() {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');

    appState.update('auth', {
        isLoggedIn: false,
        username: null,
        token: null
    });

    currentUsername = '';

    // Reload to reset UI
    location.reload();
}

/**
 * Получить текущего пользователя
 */
export function getCurrentUsername() {
    return currentUsername || appState.get('auth.username');
}

/**
 * Получить токен
 */
export function getAuthToken() {
    return localStorage.getItem('auth_token');
}

// --- UI Helpers ---

function hideLoadingStep() {
    const stepLoading = dom.get('step-loading');
    if (stepLoading) stepLoading.classList.add('hidden');
}

function hideLoginStep() {
    const stepLogin = dom.get('step-login');
    if (stepLogin) stepLogin.classList.add('hidden');
}

function showLoginScreen() {
    hideLoadingStep();
    const stepLogin = dom.get('step-login');
    if (stepLogin) {
        stepLogin.classList.remove('hidden');
        stepLogin.classList.add('fade-in');
    }
    // Focus username input
    const usernameInput = dom.get('username');
    if (usernameInput) usernameInput.focus();
}

export async function loadPlayerStats(username) {
    if (!username) return;

    const nameEl = dom.get('player-display-name');
    if (nameEl) nameEl.textContent = username;

    const rankBadgeEl = dom.get('player-rank-badge');
    const coinsEl = dom.get('stat-coins');
    const playtimeEl = dom.get('stat-playtime');

    try {
        const res = await fetch(`${API_BASE}/stats/leaderboards`, {
            headers: {
                'User-Agent': 'localtunnel',
                'Bypass-Tunnel-Reminder': 'true'
            }
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.players)) {
                const player = data.players.find(p => p.nick && p.nick.toLowerCase() === username.toLowerCase());
                if (player) {
                    if (rankBadgeEl) {
                        const rawRank = player.rank_name || 'Игрок';
                        const rankClean = rawRank.replace(/[\[\]]/g, '').trim();
                        rankBadgeEl.textContent = `[${rankClean}]`;
                        const rankSlug = rankClean.toLowerCase().replace(/\s+/g, '-');
                        rankBadgeEl.className = `player-rank-pill minecraft-rank-badge rank-${rankSlug}`;
                    }
                    if (coinsEl) coinsEl.textContent = (player.emc != null ? Number(player.emc).toLocaleString('ru-RU') : '0');
                    const hours = player.season_hours || player.total_hours || (player.season_playtime_minutes ? (player.season_playtime_minutes / 60).toFixed(1) : '0');
                    if (playtimeEl) playtimeEl.textContent = `${hours} ч`;
                    return;
                }
            }
        }
    } catch (e) {
        console.warn('[AUTH] Failed to fetch player leaderboard stats:', e);
    }

    if (rankBadgeEl) {
        rankBadgeEl.textContent = '[Игрок]';
        rankBadgeEl.className = 'player-rank-pill minecraft-rank-badge rank-player';
    }
    if (coinsEl) coinsEl.textContent = '0';
    if (playtimeEl) playtimeEl.textContent = '0 ч';
}

async function showBuildSelection() {
    // Profile selection is intentionally kept on the regular dashboard.
    // The first authenticated screen must not silently choose a build.
    hideLoadingStep();
    const selection = dom.get('step-build-selection');
    if (selection) selection.classList.add('hidden');
    showPlayScreen();
    window.dispatchEvent(new CustomEvent('auth-ready'));
}

function showPlayScreen() {
    console.log('[AUTH] showPlayScreen() entered for user:', currentUsername);
    hideLoadingStep();
    const stepPlay = dom.get('step-play');

    if (stepPlay) {
        stepPlay.classList.remove('hidden');
        stepPlay.classList.add('fade-in');
    }

    // Инициализируем 3D/2D скин игрока
    if (currentUsername) {
        console.log('[AUTH] Calling initSkinViewer for:', currentUsername);
        initSkinViewer(currentUsername);
        console.log('[AUTH] Calling loadPlayerStats for:', currentUsername);
        loadPlayerStats(currentUsername);
    }

    // Инициализируем магнитную физику для кнопки «ИГРАТЬ»
    console.log('[AUTH] Calling initMagneticPlayButton()');
    initMagneticPlayButton();
    console.log('[AUTH] showPlayScreen() completed');
}

/**
 * Проверить пароль (Step 2.5)
 * @param {string} password 
 */
export async function loginWithPassword(password) {
    if (!password.trim()) {
        showError('password-error', 'Введите пароль');
        return { success: false };
    }

    try {
        const result = await window.api.passwordAuth(currentUsername, password);
        if (result.success) {
            localStorage.setItem('auth_user', currentUsername);
            if (result.token) {
                localStorage.setItem('auth_token', result.token);
            }
            if (result.is_admin) {
                localStorage.setItem('is_admin', 'true');
            } else {
                localStorage.removeItem('is_admin');
            }

            appState.update('auth', {
                isLoggedIn: true,
                username: currentUsername,
                token: result.token,
                isAdmin: !!result.is_admin
            });

            return { success: true };
        } else {
            showError('password-error', result.message || result.error || 'Неверный пароль');
            return { success: false, error: result.message || result.error, status: result.status };
        }
    } catch (e) {
        const message = e?.message || String(e);
        showError('password-error', message || 'Ошибка сети');
        return { success: false, error: message, status: 0 };
    }
}

/**
 * Инициализация обработчиков аутентификации
 */
export function initAuthHandlers() {
    const loginBtn = dom.get('login-btn');
    const verifyBtn = dom.get('verify-btn');
    const passLoginBtn = dom.get('pass-login-btn');
    const logoutBtn = dom.get('logout-btn');
    const usernameInput = dom.get('username');
    const codeInput = dom.get('auth-code');
    const passwordInput = dom.get('auth-password');
    const stepLogin = dom.get('step-login');
    const stepCode = dom.get('step-code');
    const stepPassword = dom.get('step-password');
    const switchToPassBtn = dom.get('switch-to-pass-btn');
    const switchToCodeBtn = dom.get('switch-to-code-btn');

    // Switch buttons
    if (switchToPassBtn && stepCode && stepPassword) {
        switchToPassBtn.addEventListener('click', () => {
            stepCode.classList.add('hidden');
            stepPassword.classList.remove('hidden');
            stepPassword.classList.add('fade-in');
            passwordInput?.focus();
        });
    }

    if (switchToCodeBtn && stepCode && stepPassword) {
        switchToCodeBtn.addEventListener('click', () => {
            stepPassword.classList.add('hidden');
            stepCode.classList.remove('hidden');
            stepCode.classList.add('fade-in');
            codeInput?.focus();
        });
    }

    // Login button
    if (loginBtn && usernameInput) {
        loginBtn.addEventListener('click', async () => {
            const username = usernameInput.value.trim();

            loginBtn.disabled = true;
            loginBtn.innerText = '...';

            try {
                const result = await requestAuthCode(username);
                if (result.success) {
                    stepLogin.classList.add('hidden');
                    stepCode.classList.remove('hidden');
                    stepCode.classList.add('fade-in');
                    codeInput?.focus();

                    if (switchToPassBtn) {
                        switchToPassBtn.style.display = result.has_password ? '' : 'none';
                    }
                } else {
                    // Do not fallback if the user doesn't exist (404) or is not approved (403)
                    if (result.status === 404 || result.status === 403) {
                        return;
                    }

                    // Do not fallback to password if the user doesn't have a password set
                    if (result.has_password) {
                        // Fast fallback: if requesting code failed (e.g. 409 no TG linked, 500 bot down, 0 network error), show password step automatically
                        stepLogin.classList.add('hidden');
                        stepPassword.classList.remove('hidden');
                        stepPassword.classList.add('fade-in');
                        passwordInput?.focus();
                    }
                }
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerText = 'Далее';
                usernameInput.focus();
            }
        });

        // Enter key support
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });
    }

    // Verify button
    if (verifyBtn && codeInput) {
        verifyBtn.addEventListener('click', async () => {
            const code = codeInput.value.trim();
            if (!code) return;

            verifyBtn.disabled = true;
            verifyBtn.innerText = 'Проверка...';

            try {
                const result = await verifyAuthCode(code);
                if (result.success) {
                    stepCode.classList.add('hidden');
                    await showBuildSelection();
                }
            } finally {
                if (!appState.get('auth.isLoggedIn')) {
                    verifyBtn.disabled = false;
                    verifyBtn.innerText = 'Подтвердить';
                }
            }
        });

        // Enter key support
        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                verifyBtn.click();
            }
        });
    }

    // Password Login button
    if (passLoginBtn && passwordInput) {
        passLoginBtn.addEventListener('click', async () => {
            const password = passwordInput.value.trim();
            if (!password) return;

            passLoginBtn.disabled = true;
            passLoginBtn.innerText = 'Вход...';

            try {
                const result = await loginWithPassword(password);
                if (result.success) {
                    stepPassword.classList.add('hidden');
                    await showBuildSelection();
                }
            } finally {
                if (!appState.get('auth.isLoggedIn')) {
                    passLoginBtn.disabled = false;
                    passLoginBtn.innerText = 'Войти';
                }
            }
        });

        // Enter key support
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                passLoginBtn.click();
            }
        });
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}
