/**
 * Ganj4Craft Launcher - Server Status Feature
 * Проверка статуса сервера + список игроков при наведении
 */

import { dom } from '../../utils/dom.js';
import { API_BASE } from '../../constants.js';

const DEFAULT_SERVER_HOST = 'vocalize-cove.gl.joinmc.link';
const STATUS_UPDATE_INTERVAL = 60000; // 60 секунд
let statusInterval = null;
let activeProfile = {
    id: 'vanilla',
    name: 'GanjaCraft Vanilla',
    serverHost: DEFAULT_SERVER_HOST,
    serverPort: 25565,
};

export function setServerProfile(profile) {
    if (!profile || !profile.id) return;
    activeProfile = {
        id: profile.id,
        name: profile.name || profile.id,
        serverHost: profile.serverHost || DEFAULT_SERVER_HOST,
        serverPort: Number(profile.serverPort) || 25565,
    };
}

export async function initBuildProfileSelector(config = {}) {
    if (!window.api?.getBuildProfiles) return;
    const profiles = await window.api.getBuildProfiles();
    if (!Array.isArray(profiles) || profiles.length === 0) return;

    let selector = document.getElementById('build-profile-selector');
    if (!selector) {
        selector = document.createElement('select');
        selector.id = 'build-profile-selector';
        selector.title = 'Игровая сборка';
        selector.style.cssText = 'margin-left:8px;background:rgba(10,10,10,.75);color:#fff;border:1px solid rgba(57,255,20,.45);border-radius:4px;padding:3px 6px;font-size:11px;';
        const widget = dom.get('server-status-widget');
        widget?.appendChild(selector);
    }

    selector.replaceChildren(...profiles.map(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.shortName || profile.name || profile.id;
        return option;
    }));
    selector.value = config.activeProfileId || 'vanilla';

    const selected = profiles.find(profile => profile.id === selector.value) || profiles[0];
    setServerProfile(selected);
    window.__activeBuildProfileId = selected.id;
    selector.onchange = async () => {
        const profile = profiles.find(item => item.id === selector.value);
        if (!profile) return;

        const saved = await window.api.setActiveProfile(profile.id);
        const selectedProfile = saved || profile;
        setServerProfile(selectedProfile);
        window.__activeBuildProfileId = selectedProfile.id;
        window.dispatchEvent(new CustomEvent('build-profile-changed', {
            detail: selectedProfile,
        }));
        await updateServerStatus();
    };
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
    const tooltip = buildTooltip(players);

    target.addEventListener('mouseenter', (e) => {
        tooltip.classList.add('visible');
        positionTooltip(e, tooltip);
    });

    target.addEventListener('mousemove', (e) => {
        positionTooltip(e, tooltip);
    });

    target.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
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
export async function updateServerStatus() {
    const playerCount = dom.get('player-count');
    const indicator = document.querySelector('.status-indicator');
    if (!playerCount || !indicator) return;

    try {
        let isOnline = false;
        let onlineCount = 0;
        let maxCount = 0;
        let list = [];

        const serverAddress = activeProfile.serverPort === 25565
            ? activeProfile.serverHost
            : `${activeProfile.serverHost}:${activeProfile.serverPort}`;

        // 1. Пробуем mcstatus.io (отлично поддерживает SRV и прокси-домены joinmc.link)
        try {
            const resIo = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(serverAddress)}`, {
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (resIo.ok) {
                const dataIo = await resIo.json();
                if (dataIo.online) {
                    isOnline = true;
                    onlineCount = dataIo.players?.online ?? 0;
                    maxCount = dataIo.players?.max ?? 0;
                    list = dataIo.players?.list || [];
                }
            }
        } catch (e) {
            console.warn('mcstatus.io check failed, trying fallback:', e);
        }

        // 2. Fallback на mcsrvstat.us если mcstatus.io недоступен
        if (!isOnline) {
            try {
                const resSrv = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(serverAddress)}`, {
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (resSrv.ok) {
                    const dataSrv = await resSrv.json();
                    if (dataSrv.online) {
                        isOnline = true;
                        onlineCount = dataSrv.players?.online ?? 0;
                        maxCount = dataSrv.players?.max ?? 0;
                        list = dataSrv.players?.list || [];
                    }
                }
            } catch (e) {
                console.warn('mcsrvstat.us check failed:', e);
            }
        }

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
                liveStatusText.textContent = `СЕРВЕР В СЕТИ · ${activeProfile.name}`;
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
                liveStatusText.textContent = `ОФФЛАЙН · ${activeProfile.name}`;
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
