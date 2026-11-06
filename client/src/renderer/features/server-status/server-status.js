/**
 * Ganj4Craft Launcher - Server Status Feature
 * Проверка статуса сервера + список игроков при наведении
 */

import { dom } from '../../utils/dom.js';
import { API_BASE } from '../../constants.js';

const DEFAULT_SERVER_HOST = 'vocalize-cove.gl.joinmc.link';
const STATUS_UPDATE_INTERVAL = 60000; // 60 секунд
let statusInterval = null;
let activeProfile = null;
let availableProfiles = [];

export function setServerProfile(profile) {
    activeProfile = profile?.id ? {
        id: profile.id,
        name: profile.name || profile.shortName || profile.id,
        shortName: profile.shortName || profile.name || profile.id,
        serverHost: profile.serverHost || DEFAULT_SERVER_HOST,
        serverPort: Number(profile.serverPort) || 25565,
    } : null;
    updateActiveServerHighlight();
}

export async function initBuildProfileSelector(config = {}) {
    const selector = document.getElementById('build-profile-selector');
    if (!selector || !window.api?.getBuildProfiles) return [];

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
 * Создать/обновить тултип с именами игроков
 */
function buildTooltip(players) {
    let tooltip = document.getElementById('players-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'players-tooltip';
        tooltip.className = 'players-tooltip';
        document.body.appendChild(tooltip);
    }

    if (!players || players.length === 0) {
        tooltip.innerHTML = '<span class="tooltip-empty">Нет игроков</span>';
    } else {
        tooltip.innerHTML = players
            .map(p => {
                const name = typeof p === 'string' ? p : (p?.name_clean || p?.name_raw || 'Игрок');
                return `<span class="tooltip-player">⚔ ${name}</span>`;
            })
            .join('');
    }
    return tooltip;
}

/**
 * Привязать тултип к элементу
 */
function attachTooltip(target, players) {
    if (!target) return;
    const tooltip = buildTooltip(players);
    target._playersTooltip = tooltip;

    if (target._hasPlayersTooltipListeners) return;
    target._hasPlayersTooltipListeners = true;

    target.addEventListener('mouseenter', (e) => {
        const currentTooltip = target._playersTooltip;
        if (!currentTooltip) return;
        currentTooltip.classList.add('visible');
        positionTooltip(e, currentTooltip);
    });

    target.addEventListener('mousemove', (e) => {
        const currentTooltip = target._playersTooltip;
        if (currentTooltip) positionTooltip(e, currentTooltip);
    });

    target.addEventListener('mouseleave', () => {
        const currentTooltip = target._playersTooltip;
        if (currentTooltip) currentTooltip.classList.remove('visible');
    });
}

function positionTooltip(e, tooltip) {
    const x = e.clientX;
    const y = e.clientY;
    const rect = tooltip.getBoundingClientRect();
    const winW = window.innerWidth;

    let left = x + 12;
    if (left + rect.width > winW - 8) {
        left = x - rect.width - 12;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${y - rect.height / 2}px`;
}

/**
 * Обновить статус сервера
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

function updateActiveServerHighlight() {
    const currentId = activeProfile?.id || window.__activeBuildProfileId;
    ['vanilla', 'ganj4craft5'].forEach(sid => {
        const el = document.getElementById(`server-status-${sid}`);
        if (el) {
            el.classList.toggle('is-active', sid === currentId);
        }
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('build-profile-changed', () => updateActiveServerHighlight());
}

/**
 * Прямой запрос статуса серверов через API бота (без сторонних сервисов)
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
 * Фолбэк опрос через внешние публичные сервисы (если бэкенд недоступен)
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
 * Отрисовка статуса серверов (VANILLA и THAUMPARTY)
 */
function renderServersStatus(serversMap) {
    if (!serversMap) return;

    const playerCount = dom.get('player-count');
    const indicator = document.querySelector('.status-indicator');
    const liveCard = document.querySelector('.server-live-card-modern');
    const mainLayout = document.querySelector('.main-dashboard-layout');
    const livePlayersContainer = dom.get('live-players-container');
    const bottomCount = dom.get('bottom-player-count');

    let totalOnline = 0;
    let totalMax = 0;
    let anyOnline = false;
    const allPlayers = [];
    const seenPlayers = new Set();

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

        const rowEl = document.getElementById(`server-status-${key}`);
        const countEl = document.getElementById(`count-${key}`);

        if (s.online) {
            anyOnline = true;
            totalOnline += s.online_count;
            totalMax += s.max_players;

            if (rowEl) {
                rowEl.classList.remove('is-offline');
                const dot = rowEl.querySelector('.status-indicator-dot');
                if (dot) {
                    dot.className = 'status-indicator-dot online';
                    dot.title = `${s.short_name} доступен`;
                }
            }
            if (countEl) {
                countEl.textContent = `${s.online_count} / ${s.max_players}`;
            }

            if (Array.isArray(s.players)) {
                for (const p of s.players) {
                    const name = typeof p === 'string' ? p : (p?.name_clean || p?.name_raw || 'Игрок');
                    const norm = name.toLowerCase();
                    if (!seenPlayers.has(norm)) {
                        seenPlayers.add(norm);
                        allPlayers.push({ name, server: s.short_name });
                    }
                }
            }
        } else {
            if (rowEl) {
                rowEl.classList.add('is-offline');
                const dot = rowEl.querySelector('.status-indicator-dot');
                if (dot) {
                    dot.className = 'status-indicator-dot offline';
                    dot.title = `${s.short_name} оффлайн`;
                }
            }
            if (countEl) {
                countEl.textContent = 'ОФФЛАЙН';
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

    if (allPlayers.length > 0) {
        if (liveCard) {
            liveCard.classList.add('has-players');
            liveCard.classList.remove('empty-card');
        }
        if (mainLayout) {
            mainLayout.classList.add('has-players');
            mainLayout.classList.remove('empty-card');
        }
        if (livePlayersContainer) {
            livePlayersContainer.innerHTML = allPlayers.map(p => {
                const avatarUrl = `${API_BASE}/skins/${encodeURIComponent(p.name)}.png`;
                return `
                    <div class="live-player-item" title="${p.name} (${p.server})">
                        <div class="live-player-avatar-wrap">
                            <img src="${avatarUrl}" class="live-player-avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%2339ff14%22><rect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23111%22/><circle cx=%2212%22 cy=%229%22 r=%224%22 fill=%22%2339ff14%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22 fill=%22%2339ff14%22/></svg>'">
                        </div>
                        <span class="live-player-name">${p.name}</span>
                    </div>
                `;
            }).join('');
        }
        attachTooltip(playerCount, allPlayers.map(p => `${p.name} [${p.server}]`));
        attachTooltip(indicator, allPlayers.map(p => `${p.name} [${p.server}]`));
        if (bottomCount) attachTooltip(bottomCount, allPlayers.map(p => `${p.name} [${p.server}]`));
    } else {
        if (liveCard) {
            liveCard.classList.remove('has-players');
            liveCard.classList.add('empty-card');
        }
        if (mainLayout) {
            mainLayout.classList.remove('has-players');
            mainLayout.classList.remove('empty-card');
        }
        if (livePlayersContainer) {
            livePlayersContainer.innerHTML = '';
        }
        const tooltip = document.getElementById('players-tooltip');
        if (tooltip) tooltip.remove();
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
