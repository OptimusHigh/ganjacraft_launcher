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

    const storedId = window.__activeBuildProfileId
        || localStorage.getItem('selected_build_profile')
        || (config.isDefault ? '' : config.activeProfileId || '');

    selector.replaceChildren(new Option('Выберите сборку', ''));
    profiles.forEach(profile => {
        selector.appendChild(new Option(
            profile.shortName || profile.name || profile.id,
            profile.id
        ));
    });
    selector.value = profiles.some(profile => profile.id === storedId) ? storedId : '';
    window.__activeBuildProfileId = selector.value || undefined;
    setServerProfile(selector.value ? profiles.find(profile => profile.id === selector.value) : null);

    const applyProfile = async (profileId) => {
        const profile = profiles.find(item => item.id === profileId);
        if (!profile) {
            window.__activeBuildProfileId = undefined;
            localStorage.removeItem('selected_build_profile');
            setServerProfile(null);
            window.dispatchEvent(new CustomEvent('build-profile-changed', { detail: null }));
            return;
        }

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
            selector.value = '';
        } finally {
            selector.disabled = false;
            updatePlayAvailability();
        }
    };

    selector.onchange = () => applyProfile(selector.value);
    if (selector.value) {
        const selected = profiles.find(profile => profile.id === selector.value);
        setServerProfile(selected);
        window.__activeBuildProfileId = selected.id;
    }
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

export async function updateServerStatus() {
    const playerCount = dom.get('player-count');
    const indicator = document.querySelector('.status-indicator');
    if (!playerCount || !indicator) return;
    if (!availableProfiles.length) {
        playerCount.textContent = 'Выберите сборку';
        indicator.className = 'status-indicator';
        indicator.title = 'Игровая сборка не выбрана';
        const liveStatusText = dom.get('live-status-text');
        if (liveStatusText) liveStatusText.textContent = 'ВЫБЕРИТЕ СБОРКУ';
        return;
    }

    try {
        const statuses = await Promise.all(availableProfiles.map(fetchServerStatus));
        const onlineStatuses = statuses.filter(status => status.online);
        const isOnline = onlineStatuses.length > 0;
        const onlineCount = onlineStatuses.reduce((sum, status) => sum + status.onlineCount, 0);
        const maxCount = onlineStatuses.reduce((sum, status) => sum + status.maxCount, 0);
        const seenPlayers = new Set();
        const list = onlineStatuses.flatMap(status => status.list).filter(player => {
            const name = typeof player === 'string'
                ? player
                : (player?.name_clean || player?.name_raw || 'Игрок');
            const key = name.toLocaleLowerCase();
            if (seenPlayers.has(key)) return false;
            seenPlayers.add(key);
            return true;
        });
        const onlineServerNames = onlineStatuses.map(status => status.profile.shortName || status.profile.name).join(' + ');

        const liveCard = document.querySelector('.server-live-card-modern');
        const bottomCount = dom.get('bottom-player-count');
        const liveStatusText = dom.get('live-status-text');
        const livePlayerCount = dom.get('live-player-count');
        const livePlayersContainer = dom.get('live-players-container');

        if (isOnline) {
            playerCount.textContent = `${onlineCount} / ${maxCount} онлайн`;
            playerCount.style.cursor = 'default';

            if (bottomCount) {
                bottomCount.textContent = `В сети (${onlineCount} игроков)`;
            }

            indicator.className = 'status-indicator online';
            indicator.title = 'Сервер доступен';

            const liveDot = document.querySelector('.status-indicator-dot');
            if (liveDot) {
                liveDot.className = 'status-indicator-dot online';
                liveDot.title = 'Сервер доступен';
            }

            if (liveStatusText) {
                liveStatusText.textContent = `СЕРВЕРЫ В СЕТИ · ${onlineServerNames || 'нет данных'}`;
            }
            if (livePlayerCount) {
                livePlayerCount.textContent = `${onlineCount} / ${maxCount}`;
            }

            const mainLayout = document.querySelector('.main-dashboard-layout');
            if (Array.isArray(list) && list.length > 0) {
                if (liveCard) {
                    liveCard.classList.add('has-players');
                    liveCard.classList.remove('empty-card');
                }
                if (mainLayout) {
                    mainLayout.classList.add('has-players');
                    mainLayout.classList.remove('empty-card');
                }
                if (livePlayersContainer) {
                    livePlayersContainer.innerHTML = list.map(p => {
                        const name = typeof p === 'string' ? p : (p?.name_clean || p?.name_raw || 'Игрок');
                        const avatarUrl = `${API_BASE}/skins/${encodeURIComponent(name)}.png`;
                        return `
                            <div class="live-player-item" title="${name}">
                                <div class="live-player-avatar-wrap">
                                    <img src="${avatarUrl}" class="live-player-avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%2339ff14%22><rect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23111%22/><circle cx=%2212%22 cy=%229%22 r=%224%22 fill=%22%2339ff14%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22 fill=%22%2339ff14%22/></svg>'">
                                </div>
                                <span class="live-player-name">${name}</span>
                            </div>
                        `;
                    }).join('');
                }
            } else {
                // Нет игроков в онлайне — минималистичный режим без фона и заглушек
                if (liveCard) {
                    liveCard.classList.remove('has-players');
                    liveCard.classList.add('empty-card');
                }
                if (mainLayout) {
                    mainLayout.classList.remove('has-players');
                    mainLayout.classList.add('empty-card');
                }
                if (livePlayersContainer) {
                    livePlayersContainer.innerHTML = '';
                }
            }

            // Тултип с никами при наведении
            attachTooltip(playerCount, list);
            attachTooltip(indicator, list);
            if (bottomCount) attachTooltip(bottomCount, list);
        } else {
            playerCount.textContent = 'Оффлайн';
            playerCount.style.cursor = 'default';
            if (bottomCount) {
                bottomCount.textContent = 'Оффлайн';
            }
            indicator.className = 'status-indicator offline';
            indicator.title = 'Сервер недоступен';

            const liveDot = document.querySelector('.status-indicator-dot');
            if (liveDot) {
                liveDot.className = 'status-indicator-dot offline';
                liveDot.title = 'Сервер недоступен';
            }

            const mainLayout = document.querySelector('.main-dashboard-layout');
            if (liveCard) {
                liveCard.classList.remove('has-players');
                liveCard.classList.add('empty-card');
            }
            if (mainLayout) {
                mainLayout.classList.remove('has-players');
                mainLayout.classList.add('empty-card');
            }
            if (liveStatusText) {
                liveStatusText.textContent = 'СЕРВЕРЫ ОФФЛАЙН';
            }
            if (livePlayerCount) {
                livePlayerCount.textContent = '0 / 0';
            }
            if (livePlayersContainer) {
                livePlayersContainer.innerHTML = '';
            }

            // Убираем тултип если есть
            const tooltip = document.getElementById('players-tooltip');
            if (tooltip) tooltip.remove();
        }
    } catch (error) {
        console.error('Status check failed:', error);
        playerCount.textContent = '—';
        indicator.className = 'status-indicator offline';
        const livePlayersContainer = dom.get('live-players-container');
        if (livePlayersContainer) {
            livePlayersContainer.innerHTML = `
                <div class="live-empty-state offline">
                    <span class="live-empty-icon">⚠️</span>
                    <span>Ошибка связи с сервером</span>
                </div>
            `;
        }
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
