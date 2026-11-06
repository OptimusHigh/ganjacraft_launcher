/**
 * Ganj4Craft Launcher - Server Status Feature
 * Статус серверов + спойлеры онлайн игроков с нативным 2D рендером голов
 */

import { dom } from '../../utils/dom.js';
import { API_BASE } from '../../constants.js';

const DEFAULT_SERVER_HOST = 'vocalize-cove.gl.joinmc.link';
const STATUS_UPDATE_INTERVAL = 60000; // 60 секунд
let statusInterval = null;
let activeProfile = null;
let availableProfiles = [];
let spoilersInitialized = false;

// Кэш сгенерированных голов игроков (offscreen canvas)
const headCache = new Map();

/**
 * Отрисовка пиксель-перфект лица Стива (фоллбэк)
 */
function drawSteveHead(ctx, size) {
    const p = size / 8;
    // Волосы
    ctx.fillStyle = '#49311c';
    ctx.fillRect(0, 0, size, p * 2);
    ctx.fillRect(0, p * 2, p, p);
    ctx.fillRect(p * 7, p * 2, p, p);
    // Кожа лица
    ctx.fillStyle = '#b88360';
    ctx.fillRect(p, p * 2, p * 6, p * 6);
    ctx.fillRect(0, p * 3, p, p * 5);
    ctx.fillRect(p * 7, p * 3, p, p * 5);
    // Глаза
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p, p * 4, p * 2, p);
    ctx.fillRect(p * 5, p * 4, p * 2, p);
    ctx.fillStyle = '#2b3bb3';
    ctx.fillRect(p * 2, p * 4, p, p);
    ctx.fillRect(p * 5, p * 4, p, p);
    // Нос
    ctx.fillStyle = '#9e6745';
    ctx.fillRect(p * 3, p * 5, p * 2, p);
    // Рот и борода
    ctx.fillStyle = '#59321c';
    ctx.fillRect(p * 2, p * 6, p * 4, p);
    ctx.fillRect(p * 3, p * 7, p * 2, p);
}

/**
 * Рендер головы игрока на Canvas (лицо 8x8 + шлем 8x8 оверлей)
 */
export function renderPlayerHead(canvas, username) {
    if (!canvas || !username) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Проверяем кэш
    const cached = headCache.get(username);
    if (cached) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(cached, 0, 0, canvas.width, canvas.height);
        return;
    }

    // Мгновенный фоллбэк на Стива, пока грузится скин
    drawSteveHead(ctx, canvas.width);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
        try {
            const offscreen = document.createElement('canvas');
            offscreen.width = 32;
            offscreen.height = 32;
            const offCtx = offscreen.getContext('2d');
            offCtx.imageSmoothingEnabled = false;

            // 1. Базовый слой головы (x=8, y=8, w=8, h=8)
            offCtx.drawImage(img, 8, 8, 8, 8, 0, 0, 32, 32);

            // 2. Внешний слой / шлем (x=40, y=8, w=8, h=8)
            offCtx.drawImage(img, 40, 8, 8, 8, 0, 0, 32, 32);

            headCache.set(username, offscreen);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.warn('[Avatar] Failed to crop head for', username, e);
        }
    };

    img.onerror = () => {
        // Фоллбэк на mc-heads.net, если локальный скин отсутствует
        const fallback = new Image();
        fallback.crossOrigin = 'anonymous';
        fallback.onload = () => {
            headCache.set(username, fallback);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(fallback, 0, 0, canvas.width, canvas.height);
        };
        fallback.src = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/32`;
    };

    img.src = `${API_BASE}/skins/${encodeURIComponent(username)}.png`;
}

export function setServerProfile(profile) {
    activeProfile = profile?.id ? {
        id: profile.id,
        name: profile.name || profile.shortName || profile.id,
        shortName: profile.shortName || profile.name || profile.id,
        serverHost: profile.serverHost || DEFAULT_SERVER_HOST,
        serverPort: Number(profile.serverPort) || 25565,
    } : null;
    updateActiveServerHighlight();
    openServerSpoiler(activeProfile?.id);
}

export async function initBuildProfileSelector(config = {}) {
    const selector = document.getElementById('build-profile-selector');
    if (!selector || !window.api?.getBuildProfiles) return [];

    initServerSpoilers();

    const profiles = await window.api.getBuildProfiles();
    if (!Array.isArray(profiles) || profiles.length === 0) return [];
    availableProfiles = profiles
        .filter(profile => profile?.id && profile?.serverHost)
        .map(profile => ({
            id: profile.id,
            name: profile.name || profile.shortName || profile.id,
            shortName: profile.shortName || profile.name || profile.id,
            serverHost: profile.serverHost || DEFAULT_SERVER_HOST,
            serverPort: Number(profile.serverPort) || 25565,
        }));

    const defaultProfileId = profiles.some(p => p.id === 'ganj4craft5')
        ? 'ganj4craft5'
        : (profiles[0]?.id || '');

    const storedId = window.__activeBuildProfileId
        || localStorage.getItem('selected_build_profile')
        || (config.isDefault ? '' : config.activeProfileId || '');

    const activeId = profiles.some(profile => profile.id === storedId)
        ? storedId
        : defaultProfileId;

    selector.replaceChildren();
    profiles.forEach(profile => {
        selector.appendChild(new Option(
            profile.shortName || profile.name || profile.id,
            profile.id
        ));
    });
    selector.value = activeId;
    window.__activeBuildProfileId = activeId;
    localStorage.setItem('selected_build_profile', activeId);
    setServerProfile(profiles.find(profile => profile.id === activeId) || null);

    const applyProfile = async (profileId) => {
        const profile = profiles.find(item => item.id === profileId)
            || profiles.find(item => item.id === defaultProfileId)
            || profiles[0];
        if (!profile) return;

        selector.disabled = true;
        try {
            const saved = await window.api.setActiveProfile(profile.id);
            const selected = saved || profile;
            window.__activeBuildProfileId = selected.id;
            localStorage.setItem('selected_build_profile', selected.id);
            setServerProfile(selected);
            openServerSpoiler(selected.id);
            window.dispatchEvent(new CustomEvent('build-profile-changed', { detail: selected }));
        } catch (error) {
            console.error('[Profile] Failed to save selected build:', error);
        } finally {
            selector.disabled = false;
            updatePlayAvailability();
        }
    };

    selector.onchange = () => applyProfile(selector.value);
    applyProfile(selector.value);
    updatePlayAvailability();
    return profiles;
}

function updatePlayAvailability() {
    const playButton = document.getElementById('play-btn');
    const selected = Boolean(window.__activeBuildProfileId);
    if (playButton && !playButton.classList.contains('is-update-btn')) {
        playButton.disabled = !selected;
        playButton.classList.toggle('is-profile-required', !selected);
        playButton.title = selected ? 'Играть' : 'Сначала выберите сборку';
    }
}

/**
 * Раскрыть спойлер сервера, соответствующего выбранному профилю
 */
export function openServerSpoiler(profileId) {
    const targetKey = (profileId === 'vanilla' || profileId === 'minecraft-vanilla')
        ? 'vanilla'
        : 'ganj4craft5';

    ['vanilla', 'ganj4craft5'].forEach(sid => {
        const card = document.getElementById(`server-card-${sid}`);
        const header = document.getElementById(`server-status-${sid}`);
        const shouldOpen = (sid === targetKey);

        if (card) {
            card.classList.toggle('is-open', shouldOpen);
            card.classList.toggle('is-active', shouldOpen);
        }
        if (header) {
            header.classList.toggle('is-active', shouldOpen);
            header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        }
    });
}

/**
 * Переключить спойлер конкретного сервера вручную
 */
export function toggleServerSpoiler(serverId) {
    const card = document.getElementById(`server-card-${serverId}`);
    const header = document.getElementById(`server-status-${serverId}`);
    if (!card) return;

    const isOpen = card.classList.toggle('is-open');
    if (header) {
        header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}

/**
 * Инициализировать интерактивные спойлеры серверов
 */
export function initServerSpoilers() {
    if (spoilersInitialized) return;
    spoilersInitialized = true;

    ['vanilla', 'ganj4craft5'].forEach(sid => {
        const header = document.getElementById(`server-status-${sid}`);
        if (!header) return;

        const clickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleServerSpoiler(sid);
        };

        header.addEventListener('click', clickHandler);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                clickHandler(e);
            }
        });
    });

    const activeId = activeProfile?.id || window.__activeBuildProfileId;
    if (activeId) {
        openServerSpoiler(activeId);
    }
}

function updateActiveServerHighlight() {
    const currentId = activeProfile?.id || window.__activeBuildProfileId;
    const targetKey = (currentId === 'vanilla' || currentId === 'minecraft-vanilla')
        ? 'vanilla'
        : 'ganj4craft5';

    ['vanilla', 'ganj4craft5'].forEach(sid => {
        const card = document.getElementById(`server-card-${sid}`);
        const header = document.getElementById(`server-status-${sid}`);
        const isActive = (sid === targetKey);
        if (card) card.classList.toggle('is-active', isActive);
        if (header) header.classList.toggle('is-active', isActive);
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('build-profile-changed', (e) => {
        const pid = e.detail?.id || window.__activeBuildProfileId;
        updateActiveServerHighlight();
        openServerSpoiler(pid);
    });
}

/**
 * Обновить статус серверов через внешний API mcstatus / mcsrvstat (fallback)
 */
async function fetchServerStatus(profile) {
    const serverAddress = profile.serverPort === 25565
        ? profile.serverHost
        : `${profile.serverHost}:${profile.serverPort}`;
    let result = { online: false, onlineCount: 0, maxCount: 0, list: [], profile };

    try {
        const response = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(serverAddress)}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.online) {
                return {
                    online: true,
                    onlineCount: Number(data.players?.online) || 0,
                    maxCount: Number(data.players?.max) || 0,
                    list: data.players?.list || [],
                    profile
                };
            }
        }
    } catch (error) {
        console.warn(`[Status] mcstatus.io failed for ${profile.id}:`, error);
    }

    try {
        const response = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(serverAddress)}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.online) {
                return {
                    online: true,
                    onlineCount: Number(data.players?.online) || 0,
                    maxCount: Number(data.players?.max) || 0,
                    list: data.players?.list || [],
                    profile
                };
            }
        }
    } catch (error) {
        console.warn(`[Status] mcsrvstat.us failed for ${profile.id}:`, error);
    }

    return result;
}

/**
 * Прямой запрос статуса серверов через API бота
 */
async function fetchServersFromApi() {
    try {
        const response = await fetch(`${API_BASE}/status/servers`, {
            headers: {
                'Cache-Control': 'no-cache',
                'User-Agent': 'localtunnel',
                'Bypass-Tunnel-Reminder': 'true'
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.servers) {
                return data.servers;
            }
        }
    } catch (e) {
        console.warn('[Status] Direct API fetch failed, falling back:', e);
    }
    return null;
}

/**
 * Фолбэк опрос через внешние публичные сервисы
 */
async function fetchFallbackStatuses() {
    if (!availableProfiles.length) return null;
    const statuses = await Promise.all(availableProfiles.map(fetchServerStatus));
    const result = {};
    for (const s of statuses) {
        const pid = s.profile.id;
        result[pid] = {
            id: pid,
            name: s.profile.name || pid,
            short_name: (s.profile.shortName || pid).toUpperCase(),
            online: s.online,
            online_count: s.onlineCount,
            max_players: s.maxCount || 20,
            players: s.list || []
        };
    }
    return result;
}

/**
 * Отрисовка статуса серверов в спойлеры с карточками игроков
 */
function renderServersStatus(serversMap) {
    if (!serversMap) return;
    initServerSpoilers();

    const playerCount = dom.get('player-count');
    const indicator = document.querySelector('.status-indicator');
    const bottomCount = dom.get('bottom-player-count');

    let totalOnline = 0;
    let totalMax = 0;
    let anyOnline = false;

    const serverKeys = ['vanilla', 'ganj4craft5'];
    for (const key of serverKeys) {
        const s = serversMap[key] || {
            id: key,
            short_name: key === 'vanilla' ? 'VANILLA' : 'THAUMPARTY',
            online: false,
            online_count: 0,
            max_players: 20,
            players: []
        };

        const cardEl = document.getElementById(`server-card-${key}`);
        const headerEl = document.getElementById(`server-status-${key}`);
        const countEl = document.getElementById(`count-${key}`);
        const playersListEl = document.getElementById(`players-list-${key}`);

        if (s.online) {
            anyOnline = true;
            totalOnline += s.online_count;
            totalMax += s.max_players;

            if (headerEl) {
                headerEl.classList.remove('is-offline');
                const dot = headerEl.querySelector('.status-indicator-dot');
                if (dot) {
                    dot.className = 'status-indicator-dot online';
                    dot.title = `${s.short_name} доступен`;
                }
            }
            if (cardEl) {
                cardEl.classList.remove('is-offline');
            }
            if (countEl) {
                countEl.textContent = `${s.online_count} / ${s.max_players}`;
            }

            // Отрисовка игроков конкретного сервера
            if (playersListEl) {
                playersListEl.innerHTML = '';
                const rawPlayers = Array.isArray(s.players) ? s.players : [];
                if (rawPlayers.length > 0) {
                    const fragment = document.createDocumentFragment();
                    for (const p of rawPlayers) {
                        const name = typeof p === 'string' ? p : (p?.name_clean || p?.name_raw || 'Игрок');
                        const item = document.createElement('div');
                        item.className = 'live-player-item';
                        item.title = `${name} (${s.short_name})`;

                        const avatarWrap = document.createElement('div');
                        avatarWrap.className = 'live-player-avatar-wrap';

                        const canvas = document.createElement('canvas');
                        canvas.className = 'live-player-head-canvas';
                        canvas.width = 32;
                        canvas.height = 32;
                        avatarWrap.appendChild(canvas);

                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'live-player-name';
                        nameSpan.textContent = name;

                        item.appendChild(avatarWrap);
                        item.appendChild(nameSpan);
                        fragment.appendChild(item);

                        // Рендерим кубическую голову
                        renderPlayerHead(canvas, name);
                    }
                    playersListEl.appendChild(fragment);
                } else {
                    playersListEl.innerHTML = '<div class="server-empty-hint">Сейчас никого нет на сервере</div>';
                }
            }
        } else {
            if (headerEl) {
                headerEl.classList.add('is-offline');
                const dot = headerEl.querySelector('.status-indicator-dot');
                if (dot) {
                    dot.className = 'status-indicator-dot offline';
                    dot.title = `${s.short_name} оффлайн`;
                }
            }
            if (cardEl) {
                cardEl.classList.add('is-offline');
            }
            if (countEl) {
                countEl.textContent = 'ОФФЛАЙН';
            }
            if (playersListEl) {
                playersListEl.innerHTML = '<div class="server-empty-hint">Сервер оффлайн</div>';
            }
        }
    }

    updateActiveServerHighlight();

    if (playerCount) {
        if (anyOnline) {
            playerCount.textContent = `${totalOnline} / ${totalMax} онлайн`;
            playerCount.style.cursor = 'default';
        } else {
            playerCount.textContent = 'Оффлайн';
        }
    }
    if (indicator) {
        indicator.className = anyOnline ? 'status-indicator online' : 'status-indicator offline';
        indicator.title = anyOnline ? 'Серверы доступны' : 'Серверы недоступны';
    }
    if (bottomCount) {
        bottomCount.textContent = anyOnline ? `В сети (${totalOnline} игроков)` : 'Оффлайн';
    }
}

export async function updateServerStatus() {
    try {
        let serversData = await fetchServersFromApi();

        if (!serversData) {
            serversData = await fetchFallbackStatuses();
        }

        if (serversData) {
            renderServersStatus(serversData);
        }
    } catch (error) {
        console.error('[Status] Server status update failed:', error);
    }
}

/**
 * Запустить периодическую проверку статуса
 */
export function startStatusChecker() {
    initServerSpoilers();
    updateServerStatus();
    if (!statusInterval) {
        statusInterval = setInterval(updateServerStatus, STATUS_UPDATE_INTERVAL);
    }
}

/**
 * Остановить проверку статуса
 */
export function stopStatusChecker() {
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
}
