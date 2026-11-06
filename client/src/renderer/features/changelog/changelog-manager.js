/**
 * Ganj4Craft Launcher - Pack & Client Changelog Feature
 * Управление историей изменений сборки и релизов лаунчера
 */

import { dom } from '../../utils/dom.js';
import { openSettings, closeSettings, switchTab } from '../settings/index.js';
import { createSnowBurst } from '../../ui/effects/index.js';
import { triggerInertiaCascade } from '../../utils/performance.js';
import { appState } from '../../state/app-state.js';

const STORAGE_KEY_SEEN = 'ganja_last_seen_changelog_id';

let cachedPackHistory = [];
let cachedLauncherReleases = [];
let cachedNews = [];
let isInitialized = false;

/**
 * Проверка, является ли мод чисто клиентским (графика, интерфейс, утилиты)
 */
export function isClientMod(raw) {
    if (!raw) return false;
    const str = String(raw).toLowerCase();
    if (str.startsWith('client_mods/') || str.startsWith('client-') || str.startsWith('client_')) return true;

    const clientKeywords = [
        'sodium', 'iris', 'embeddium', 'oculus', 'rubidium', 'xaero', 'jei', 'rei', 'emi',
        'jade', 'waila', 'hud', 'appleskin', 'cloth', 'controlling', 'searchables',
        'customskinloader', 'authlib', 'sound', 'animation', 'ambient', 'presence', 'chat',
        'smoothboot', 'ferrite', 'entityculling', 'immediatelyfast', 'modernfix', 'fps',
        'dynamic', 'zoom', 'invtweaks', 'mouse', 'gamma', 'tooltip', 'screenshot', 'voice',
        'simplevoicechat', 'replay', 'borderless', 'fullscreen', 'custom_steve', 'emotecraft',
        'cit', 'emf', 'etf', 'falling_leaves', 'notenoughanimations', 'itemphysic', 'legendarytooltips'
    ];
    return clientKeywords.some(k => str.includes(k));
}

/**
 * Парсер имени мода для красивого человекочитаемого отображения
 */
export function formatModDisplay(raw) {
    if (!raw) return { title: 'Мод', version: '', raw: '', isClient: false };
    let fileName = String(raw).replace(/^mods\//i, '').replace(/^client_mods\//i, '').replace(/\.jar$/i, '').trim();
    let isClient = isClientMod(raw);

    if (fileName.startsWith('client-') || fileName.startsWith('client_')) {
        fileName = fileName.slice(7);
        isClient = true;
    }

    let title = fileName;
    let version = '';

    const camelMatch = fileName.match(/^([A-Za-z]+?)((?:1\.\d|v\d|\d\d).*)$/i);
    if (camelMatch) {
        title = camelMatch[1];
        version = camelMatch[2];
    } else {
        const delimMatch = fileName.match(/^([A-Za-z0-9_]+?)[-_](v?\d|\+mc|neoforge|forge|fabric)(.*)$/i);
        if (delimMatch) {
            title = delimMatch[1];
            version = (delimMatch[2] + delimMatch[3]).replace(/^[-_]+/, '');
        }
    }

    let cleanTitle = title
        .replace(/([a-z])([A-Z])/g, (m, p1, p2) => p1 + ' ' + p2)
        .replace(/([A-Z]+)([A-Z][a-z])/g, (m, p1, p2) => p1 + ' ' + p2)
        .replace(/[_-]+/g, ' ')
        .trim();

    const upperWords = new Set(['jei', 'ftb', 'emf', 'etf', 'cit', 'rei', 'emi', 'xaero', 'xaeros', 'mc', 'hud', 'fps', 'tps', 'waila', 'jade', 'mekanism']);
    cleanTitle = cleanTitle.split(' ').map(w => {
        if (upperWords.has(w.toLowerCase())) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');

    let cleanVer = version
        .replace(/[-_]?(?:neoforge|forge|fabric)[-_]?/gi, ' ')
        .replace(/[-_]?(?:mc)?1\.21(?:\.1)?[-_]?/gi, ' ')
        .replace(/[-_]+/g, ' ')
        .trim();

    if (cleanVer && !cleanVer.toLowerCase().startsWith('v') && /^\d/.test(cleanVer)) {
        cleanVer = 'v' + cleanVer;
    }

    return {
        title: cleanTitle || fileName,
        version: cleanVer || '',
        isClient,
        raw
    };
}

/**
 * Красивое форматирование даты
 */
function formatReleaseDate(dateStr, timestamp) {
    if (timestamp && typeof timestamp === 'number') {
        const d = new Date(timestamp * 1000);
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day} ${month} ${year} • ${hours}:${mins}`;
    }

    if (dateStr) {
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                const day = d.getDate();
                const month = months[d.getMonth()];
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                return `${day} ${month} ${year} • ${hours}:${mins}`;
            }
        } catch { }
        return dateStr;
    }

    return 'Недавнее обновление';
}

function getLatestCompoundId() {
    const latestPack = cachedPackHistory[0];
    const latestLauncher = cachedLauncherReleases[0];
    const latestNews = cachedNews[0];
    const pId = latestPack ? (latestPack.id || String(latestPack.timestamp || '')) : '';
    const lId = latestLauncher ? (latestLauncher.version || String(latestLauncher.timestamp || '')) : '';
    const nId = latestNews ? (latestNews.id || String(latestNews.timestamp || '')) : '';
    return `${pId}_${lId}_${nId}`;
}

let currentChangelogFilter = 'all';

/**
 * Установить фильтр ленты чейнджлога ('all', 'ganj4craft5', 'vanilla', 'news', 'launcher')
 */
export function setChangelogFilter(filter) {
    currentChangelogFilter = filter;
    const chips = document.querySelectorAll('.changelog-filter-chip');
    chips.forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === filter);
    });
    renderChangelogList();
}

/**
 * Инициализация интерактивных чипсов фильтрации ленты
 */
export function initChangelogFilters() {
    const filtersBar = dom.get('changelog-filters');
    if (!filtersBar || filtersBar._hasFilterListener) return;
    filtersBar._hasFilterListener = true;

    filtersBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.changelog-filter-chip');
        if (!chip) return;
        const filter = chip.dataset.filter || 'all';
        setChangelogFilter(filter);
    });
}

/**
 * Загрузить историю изменений манифеста всех сборок, релизов лаунчера и новостей
 */
export async function loadChangelogHistory() {
    try {
        let profiles = [];
        if (window.api && window.api.getBuildProfiles) {
            try {
                profiles = await window.api.getBuildProfiles();
            } catch (_) { }
        }
        if (!Array.isArray(profiles) || profiles.length === 0) {
            profiles = [
                { id: 'ganj4craft5', name: 'ThaumParty', shortName: 'ThaumParty' },
                { id: 'vanilla', name: 'GanjaCraft Vanilla', shortName: 'Vanilla' }
            ];
        }

        const profileHistoryPromises = profiles.map(profile => {
            if (window.api && window.api.getManifestHistory) {
                return window.api.getManifestHistory(profile.id)
                    .then(res => ({ profile, res }))
                    .catch(() => ({ profile, res: { success: false, history: [] } }));
            }
            return Promise.resolve({ profile, res: { success: false, history: [] } });
        });

        const launcherPromise = (window.api && window.api.getLauncherReleases)
            ? window.api.getLauncherReleases().catch(() => ({ success: false, releases: [] }))
            : Promise.resolve({ success: false, releases: [] });

        const newsPromise = (window.api && window.api.getNews)
            ? window.api.getNews().catch(() => ({ success: false, news: [] }))
            : Promise.resolve({ success: false, news: [] });

        const [historyResults, launcherRes, newsRes] = await Promise.all([
            Promise.all(profileHistoryPromises),
            launcherPromise,
            newsPromise
        ]);

        const mergedPackHistory = [];
        for (const { profile, res } of historyResults) {
            if (res && res.success && Array.isArray(res.history)) {
                for (const item of res.history) {
                    mergedPackHistory.push({
                        ...item,
                        profileId: item.profile_id || profile.id,
                        profileName: profile.name || profile.shortName || profile.id,
                        profileShortName: profile.shortName || profile.name || profile.id
                    });
                }
            }
        }

        // Сортировка всех обновлений сборок по времени (от новых к старым)
        mergedPackHistory.sort((a, b) => {
            const timeA = a.timestamp ? Number(a.timestamp) : (a.date ? new Date(a.date).getTime() / 1000 : 0);
            const timeB = b.timestamp ? Number(b.timestamp) : (b.date ? new Date(b.date).getTime() / 1000 : 0);
            return timeB - timeA;
        });

        cachedPackHistory = mergedPackHistory;

        if (launcherRes && launcherRes.success && Array.isArray(launcherRes.releases)) {
            cachedLauncherReleases = launcherRes.releases;
        }

        if (newsRes && newsRes.success && Array.isArray(newsRes.news)) {
            cachedNews = newsRes.news;
        }

        initChangelogFilters();
        checkChangelogBadge();
        renderChangelogList();
    } catch (e) {
        console.warn('[Changelog] Failed to load history:', e);
        renderEmptyState('Ошибка загрузки истории обновлений', 'changelog-list');
    }
}

/**
 * Проверить актуальность последнего обновления и переключить видимость колокольчика и бейджа
 */
export function checkChangelogBadge() {
    const btnChangelog = dom.get('btn-changelog');
    const badge = dom.get('changelog-badge');
    const settingsScreen = dom.get('step-settings');
    const isSettingsOpen = settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing');

    // Если сейчас открыты настройки — кнопка колокольчика скрыта (вкладка ОБНОВЛЕНИЯ доступна в меню)
    if (isSettingsOpen) {
        if (btnChangelog) btnChangelog.classList.add('hidden');
        return;
    }

    // На главном экране колокольчик всегда доступен в топ баре
    if (btnChangelog) btnChangelog.classList.remove('hidden');

    const compoundId = getLatestCompoundId();
    const seenId = localStorage.getItem(STORAGE_KEY_SEEN);
    const hasUnseen = Boolean(compoundId && seenId !== compoundId);

    if (hasUnseen) {
        if (badge) badge.classList.remove('hidden');
    } else {
        if (badge) badge.classList.add('hidden');
    }
}

/**
 * Отметить текущие обновления как просмотренные (гасит бейдж и скрывает колокольчик)
 */
export function markChangelogSeen() {
    const compoundId = getLatestCompoundId();
    if (compoundId) {
        localStorage.setItem(STORAGE_KEY_SEEN, compoundId);
    }
    const badge = dom.get('changelog-badge');
    if (badge) badge.classList.add('hidden');
    checkChangelogBadge();
}

/**
 * Рендер карточек объединённой истории обновлений и новостей
 */
export function renderChangelogList(containerId = 'changelog-list') {
    const container = dom.get(containerId);
    if (!container) return;

    const allItems = [];

    // 1. Обновления сборки
    cachedPackHistory.forEach((item) => {
        const ts = item.timestamp ? Number(item.timestamp) : (item.date ? new Date(item.date).getTime() / 1000 : 0);
        allItems.push({
            itemType: 'pack',
            timestamp: ts,
            date: item.date,
            data: item
        });
    });

    // 2. Релизы лаунчера
    cachedLauncherReleases.forEach((rel) => {
        const ts = rel.timestamp ? Number(rel.timestamp) : (rel.date ? new Date(rel.date).getTime() / 1000 : 0);
        allItems.push({
            itemType: 'launcher',
            timestamp: ts,
            date: rel.date,
            data: rel
        });
    });

    // 3. Новости из подключённого новостного источника (включая VK)
    cachedNews.forEach((newsItem) => {
        let ts = newsItem.timestamp ? Number(newsItem.timestamp) : 0;
        if (!ts && newsItem.created_at) {
            const parts = String(newsItem.created_at).match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/);
            if (parts) {
                const isoStr = `${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}:${parts[5]}:00+03:00`;
                const d = new Date(isoStr);
                if (!isNaN(d.getTime())) ts = d.getTime() / 1000;
            }
        }
        allItems.push({
            itemType: 'news',
            timestamp: ts || 0,
            date: newsItem.created_at,
            data: newsItem
        });
    });

    // Сортировка по времени (сначала самые свежие)
    allItems.sort((a, b) => b.timestamp - a.timestamp);

    let filteredItems = allItems;
    if (currentChangelogFilter === 'launcher') {
        filteredItems = allItems.filter(item => item.itemType === 'launcher');
    } else if (currentChangelogFilter === 'news') {
        filteredItems = allItems.filter(item => item.itemType === 'news');
    } else if (currentChangelogFilter === 'ganj4craft5') {
        filteredItems = allItems.filter(item => item.itemType === 'pack' && (item.data.profileId === 'ganj4craft5' || !item.data.profileId));
    } else if (currentChangelogFilter === 'vanilla') {
        filteredItems = allItems.filter(item => item.itemType === 'pack' && item.data.profileId === 'vanilla');
    }

    if (filteredItems.length === 0) {
        const emptyMsg = currentChangelogFilter === 'all'
            ? 'История обновлений и новостей пока пуста'
            : 'В выбранной категории пока нет записей';
        renderEmptyState(emptyMsg, containerId);
        return;
    }

    container.innerHTML = '';

    filteredItems.forEach((entry, idx) => {
        const card = document.createElement('div');
        let themeClass = 'card-theme-pack';
        if (entry.itemType === 'launcher') {
            themeClass = 'card-theme-launcher';
        } else if (entry.itemType === 'news') {
            themeClass = 'card-theme-news';
        } else if (entry.itemType === 'pack') {
            if (entry.data.profileId === 'ganj4craft5') themeClass = 'card-theme-thaumparty';
            else if (entry.data.profileId === 'vanilla') themeClass = 'card-theme-vanilla';
        }

        card.className = `changelog-release-card ${themeClass}`;

        if (entry.itemType === 'launcher') {
            card.innerHTML = renderLauncherCardHtml(entry.data, idx === 0);
        } else if (entry.itemType === 'news') {
            card.innerHTML = renderNewsCardHtml(entry.data, idx === 0);
        } else {
            card.innerHTML = renderPackCardHtml(entry.data, idx === 0);
        }

        container.appendChild(card);
    });

    // Навешиваем обработчик сворачивания/разворачивания групп
    if (!container._hasGroupToggleListener) {
        container._hasGroupToggleListener = true;
        container.addEventListener('click', (e) => {
            const toggle = e.target.closest('.changelog-group-toggle');
            if (!toggle) return;
            const group = toggle.closest('.changelog-group');
            if (!group) return;
            const body = group.querySelector('.changelog-group-body');
            if (!body) return;

            const isCollapsed = group.classList.contains('is-collapsed') || body.classList.contains('hidden');
            if (isCollapsed) {
                group.classList.remove('is-collapsed');
                group.classList.add('is-open');
                body.classList.remove('hidden');
            } else {
                group.classList.remove('is-open');
                group.classList.add('is-collapsed');
                body.classList.add('hidden');
            }
        });

        container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const toggle = e.target.closest('.changelog-group-toggle');
                if (toggle) {
                    e.preventDefault();
                    toggle.click();
                }
            }
        });
    }
}

/**
 * Рендер карточки новости из новостного источника (включая VK)
 */
function renderNewsCardHtml(item, isLatest) {
    const formattedDate = formatReleaseDate(item.created_at, item.timestamp);

    let imageHtml = '';
    if (item.image_url) {
        imageHtml = `
            <div class="changelog-news-image-wrap">
                <img src="${escapeHtml(item.image_url)}" alt="Изображение к новости" class="changelog-news-img" loading="lazy" />
            </div>
        `;
    }

    const rawText = item.text || '';
    let formattedText = escapeHtml(rawText);
    const urlPattern = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    formattedText = formattedText.replace(urlPattern, '<a href="$1" class="changelog-news-link" target="_blank" onclick="event.preventDefault(); window.api.openUrl(this.href);">$1</a>');
    formattedText = formattedText.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');

    return `
        <div class="changelog-release-header news-release-header">
            <div class="changelog-header-left">
                <svg class="changelog-date-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h4>${escapeHtml(formattedDate)}</h4>
                <span class="changelog-badge-tag changelog-badge-scope-news">📢 НОВОСТЬ</span>
                ${isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
            </div>
        </div>

        <div class="changelog-card-content changelog-news-content">
            ${imageHtml}
            <div class="changelog-news-text">
                <p>${formattedText}</p>
            </div>
        </div>
    `;
}

/**
 * Рендер карточки релиза самого лаунчера
 */
function renderLauncherCardHtml(rel, isLatest) {
    const formattedDate = formatReleaseDate(rel.date, rel.timestamp);
    const versionStr = rel.version ? `v${rel.version}` : '';
    let changes = rel.changes || [];

    if (!Array.isArray(changes) || changes.length === 0) {
        changes = [
            '⚡ Оптимизация сетевых протоколов и ускорение синхронизации',
            '🔧 Повышение стабильности работы клиента',
            '🛡️ Обновление модулей авторизации и безопасности'
        ];
    }

    return `
        <div class="changelog-release-header launcher-release-header">
            <div class="changelog-header-left">
                <svg class="changelog-date-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h4>${escapeHtml(formattedDate)}</h4>
                <span class="changelog-badge-tag changelog-badge-scope-launcher">🚀 ЛАУНЧЕР</span>
                ${isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
                ${versionStr ? `<span class="changelog-badge-ver ver-launcher">${escapeHtml(versionStr)}</span>` : ''}
            </div>
        </div>

        <div class="changelog-card-content">
            <div class="changelog-admin-note launcher-note">
                <div class="admin-note-header">
                    <span class="note-icon">🚀</span>
                    <span class="note-title">${escapeHtml(rel.title || `Обновление лаунчера ${versionStr}`)}</span>
                </div>
                ${rel.description ? `<div class="admin-note-body">${escapeHtml(rel.description)}</div>` : ''}
            </div>

            <div class="changelog-group">
                <div class="changelog-section-title group-label-launcher">
                    <span class="title-dot dot-launcher"></span>
                    <span>Что нового в лаунчере</span>
                </div>
                <div class="changelog-launcher-changes-grid">
                    ${changes.map(ch => `
                        <div class="changelog-launcher-change-item">
                            <span class="launcher-change-bullet">▸</span>
                            <span class="launcher-change-text">${escapeHtml(ch)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Форматирование текста заметки разработчика с цветными бейджами тегов ([BUFF], [NERF], [NEW], [FIX], [CSC], [BOSS] и т.д.)
 */
export function formatAdminNoteText(rawText) {
    if (!rawText) return '';
    let escaped = escapeHtml(rawText);

    const tagMap = [
        { regex: /\[(NEW|НОВОЕ)\]/gi, class: 'patch-tag-new', label: 'НОВОЕ' },
        { regex: /\[(BUFF|БАФФ|UP)\]/gi, class: 'patch-tag-buff', label: 'БАФФ' },
        { regex: /\[(NERF|НЕРФ|DOWN)\]/gi, class: 'patch-tag-nerf', label: 'НЕРФ' },
        { regex: /\[(FIX|ФИКС|ИСПРАВЛЕНИЕ)\]/gi, class: 'patch-tag-fix', label: 'ФИКС' },
        { regex: /\[(CSC)\]/gi, class: 'patch-tag-csc', label: 'CSC' },
        { regex: /\[(BOSS|БОСС|БОССЫ)\]/gi, class: 'patch-tag-boss', label: 'БОСС' },
        { regex: /\[(EVENT|ИВЕНТ|СОБЫТИЕ)\]/gi, class: 'patch-tag-event', label: 'ИВЕНТ' },
        { regex: /\[(BALANCE|БАЛАНС)\]/gi, class: 'patch-tag-balance', label: 'БАЛАНС' },
    ];

    tagMap.forEach(({ regex, class: cls, label }) => {
        escaped = escaped.replace(regex, `<span class="patch-tag ${cls}">${label}</span>`);
    });

    return escaped;
}

/**
 * Рендер карточки отдельной активности (CSC, Боссы, Баунти, Казино, Наноброня и др.)
 */
function renderActivityCard(item) {
    const icon = item.icon || '⚔️';
    const categoryName = item.category_name || 'Активность';
    const label = item.label || item.name || '';
    const filename = item.path || item.name || '';
    const action = item.action || 'update';

    let actionClass = 'action-update';
    let actionLabel = 'ОБНОВЛЕНО';
    if (action === 'add') { actionClass = 'action-add'; actionLabel = 'НОВОЕ'; }
    if (action === 'remove') { actionClass = 'action-remove'; actionLabel = 'УДАЛЕНО'; }

    return `
        <div class="changelog-mod-card card-activity ${actionClass}" title="${escapeHtml(filename)}">
            <div class="mod-card-left">
                <div class="mod-type-icon icon-activity">${escapeHtml(icon)}</div>
                <div class="mod-info-block">
                    <div class="activity-badge-row">
                        <span class="activity-category-badge">${escapeHtml(categoryName)}</span>
                        <span class="activity-action-tag ${actionClass}">${escapeHtml(actionLabel)}</span>
                    </div>
                    <span class="mod-main-name">${escapeHtml(label)}</span>
                    <span class="mod-sub-filename">${escapeHtml(filename)}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Рендер отдельной сворачиваемой группы изменений
 */
function renderChangelogGroup({ labelClass, dotClass, title, count, itemsHtml, isOpen = false }) {
    if (!itemsHtml || count <= 0) return '';

    return `
        <div class="changelog-group collapsible ${isOpen ? 'is-open' : 'is-collapsed'}">
            <div class="changelog-section-title ${labelClass} changelog-group-toggle" role="button" tabindex="0" title="Нажмите, чтобы свернуть или развернуть">
                <div class="group-title-left">
                    <span class="title-dot ${dotClass}"></span>
                    <span class="group-title-text">${title} (${count})</span>
                </div>
                <div class="group-chevron">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            <div class="changelog-group-body ${isOpen ? '' : 'hidden'}">
                <div class="changelog-mods-grid">
                    ${itemsHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Рендер карточки обновления сборки (чётко разделено по группам, с возможностью сворачивания)
 */
function renderPackCardHtml(item, isLatest) {
    const summary = item.summary || {};
    const formattedDate = formatReleaseDate(item.date, item.timestamp);
    const versionStr = item.launcher_version ? `v${item.launcher_version}` : '';

    const allAdded = summary.mods_added || [];
    const allUpdated = summary.mods_updated || [];
    const allRemoved = summary.mods_removed || [];
    const activitiesList = summary.activities_list || [];
    const skillsList = summary.skills_list || [];
    const questsList = summary.quests_list || [];
    const serverScriptsList = summary.server_scripts_list || [];
    const configsList = summary.configs_list || [];
    const scriptsList = summary.scripts_list || [];
    const resourcepacksList = summary.resourcepacks_list || [];

    const activitiesCount = summary.activities_count || activitiesList.length;
    const skillsCount = summary.skills_count || skillsList.length;
    const questsCount = summary.quests_count || questsList.length;
    const configsCount = summary.configs_count || configsList.length;
    const scriptsCount = summary.scripts_count || scriptsList.length;
    const packsCount = summary.resourcepacks_count || resourcepacksList.length;

    // Бейджи в шапке
    const summaryPills = [];
    const totalAdded = allAdded.length;
    const totalUpdated = allUpdated.length;
    const totalRemoved = allRemoved.length;
    const totalMods = totalAdded + totalUpdated + totalRemoved + packsCount;

    if (activitiesCount > 0) summaryPills.push(`<span class="changelog-pill pill-activity">⚔️ ${activitiesCount}</span>`);
    if (skillsCount > 0) summaryPills.push(`<span class="changelog-pill pill-skill">⭐ ${skillsCount}</span>`);
    if (questsCount > 0) summaryPills.push(`<span class="changelog-pill pill-quest">📜 ${questsCount}</span>`);
    if (totalAdded > 0) summaryPills.push(`<span class="changelog-pill pill-add">➕ ${totalAdded}</span>`);
    if (totalUpdated > 0) summaryPills.push(`<span class="changelog-pill pill-update">🔄 ${totalUpdated}</span>`);
    if (totalRemoved > 0) summaryPills.push(`<span class="changelog-pill pill-remove">➖ ${totalRemoved}</span>`);
    if (configsCount > 0) summaryPills.push(`<span class="changelog-pill pill-config">⚙️ ${configsCount}</span>`);

    const profileId = item.profileId || item.profile_id || 'ganj4craft5';
    let profileName = item.profileName || item.profileShortName;
    if (!profileName) {
        profileName = (profileId === 'ganj4craft5') ? 'ThaumParty' : (profileId === 'vanilla' ? 'Vanilla' : profileId);
    }
    const profileTagClass = (profileId === 'ganj4craft5') ? 'changelog-badge-scope-thaumparty' : 'changelog-badge-scope-vanilla';
    const profileIcon = (profileId === 'ganj4craft5') ? '🎮' : '🍦';

    const headerHtml = `
        <div class="changelog-release-header">
            <div class="changelog-header-left">
                <svg class="changelog-date-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h4>${escapeHtml(formattedDate)}</h4>
                <span class="changelog-badge-tag ${profileTagClass}">${profileIcon} ${escapeHtml(profileName)}</span>
                ${isLatest ? '<span class="changelog-badge-latest">СВЕЖЕЕ</span>' : ''}
                ${versionStr ? `<span class="changelog-badge-ver">${escapeHtml(versionStr)}</span>` : ''}
            </div>
            <div class="changelog-header-pills">
                ${summaryPills.join('')}
            </div>
        </div>
    `;

    let sectionsHtml = '<div class="changelog-card-content">';

    // 0. Заметка разработчика
    if (item.custom_note && item.custom_note.trim()) {
        sectionsHtml += `
            <div class="changelog-admin-note">
                <div class="admin-note-header">
                    <span class="note-icon">💬</span>
                    <span class="note-title">Патчноут сборки</span>
                </div>
                <div class="admin-note-body">${formatAdminNoteText(item.custom_note)}</div>
            </div>
        `;
    }

    // 1. ГРУППА: МОДЫ СБОРКИ (ЕДИНАЯ ГРУППА, НА САМОМ ВЕРХУ, РАСКРЫТО ПО ДЕФОЛТУ)
    if (totalMods > 0) {
        const modsHtml = [
            ...allAdded.map(m => renderModCard(m, 'add')),
            ...allUpdated.map(u => renderModCard(u, 'update')),
            ...allRemoved.map(m => renderModCard(m, 'remove')),
            ...resourcepacksList.map(r => `
                <div class="changelog-mod-card card-misc" title="${escapeHtml(r.path || r.name)}">
                    <div class="mod-card-left">
                        <div class="mod-type-icon icon-misc">🎨</div>
                        <div class="mod-info-block">
                            <span class="mod-main-name">${escapeHtml(r.label || r.name)}</span>
                            <span class="mod-sub-filename">${escapeHtml(r.path || r.name)}</span>
                        </div>
                    </div>
                </div>
            `)
        ].join('');
        sectionsHtml += renderChangelogGroup({
            labelClass: 'group-label-mods',
            dotClass: 'dot-mods',
            title: '🧩 Моды сборки',
            count: totalMods,
            itemsHtml: modsHtml,
            isOpen: true // <<< РАСКРЫТО ПО ДЕФОЛТУ НАВЕРХУ
        });
    }

    // 2. ГРУППА: ВНУТРИИГРОВЫЕ АКТИВНОСТИ И РЕЖИМЫ (Свернуто по умолчанию)
    if (activitiesList.length > 0) {
        sectionsHtml += renderChangelogGroup({
            labelClass: 'group-label-activity',
            dotClass: 'dot-activity',
            title: '⚔️ Внутриигровые активности и режимы',
            count: activitiesList.length,
            itemsHtml: activitiesList.map(a => renderActivityCard(a)).join(''),
            isOpen: false
        });
    }

    // 3. ГРУППА: ДРЕВО НАВЫКОВ И ПРОКАЧКИ (Свернуто по умолчанию)
    if (skillsList.length > 0) {
        sectionsHtml += renderChangelogGroup({
            labelClass: 'group-label-skill',
            dotClass: 'dot-skill',
            title: '⭐ Древо навыков и прокачка',
            count: skillsList.length,
            itemsHtml: skillsList.map(s => renderActivityCard(s)).join(''),
            isOpen: false
        });
    }

    // 4. ГРУППА: КВЕСТОВЫЕ ЦЕПОЧКИ И ЗАДАНИЯ (Свернуто по умолчанию)
    if (questsList.length > 0) {
        sectionsHtml += renderChangelogGroup({
            labelClass: 'group-label-quest',
            dotClass: 'dot-quest',
            title: '📜 Квестовые цепочки и задания',
            count: questsList.length,
            itemsHtml: questsList.map(q => renderActivityCard(q)).join(''),
            isOpen: false
        });
    }

    // 5. ГРУППА: БАЛАНС, КРАФТЫ И СЕРВЕРНЫЕ СКРИПТЫ (Свернуто по умолчанию)
    const otherScripts = scriptsList.filter(s => {
        const cat = s.category || '';
        return !cat.startsWith('activity_') && !cat.startsWith('skill_') && cat !== 'skills' && !cat.startsWith('quest_') && cat !== 'quests';
    });
    if (otherScripts.length > 0) {
        const scriptsHtml = otherScripts.map(s => `
            <div class="changelog-mod-card card-script" title="${escapeHtml(s.path || s.name)}">
                <div class="mod-card-left">
                    <div class="mod-type-icon icon-script">${escapeHtml(s.icon || '🛠️')}</div>
                    <div class="mod-info-block">
                        <span class="mod-main-name">${escapeHtml(s.label || s.name)}</span>
                        <span class="mod-sub-filename">${escapeHtml(s.path || s.name)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        sectionsHtml += renderChangelogGroup({
            labelClass: 'group-label-script',
            dotClass: 'dot-script',
            title: '🛠️ Баланс, крафты и серверные скрипты',
            count: otherScripts.length,
            itemsHtml: scriptsHtml,
            isOpen: false
        });
    }

    // 6. ГРУППА: КОНФИГУРАЦИИ СЕРВЕРА (Свернуто по умолчанию)
    if (configsList.length > 0) {
        const configsHtml = configsList.map(c => `
            <div class="changelog-mod-card card-config" title="${escapeHtml(c.path || c.name)}">
                <div class="mod-card-left">
                    <div class="mod-type-icon icon-config">⚙️</div>
                    <div class="mod-info-block">
                        <span class="mod-main-name">${escapeHtml(c.label || c.name)}</span>
                        <span class="mod-sub-filename">${escapeHtml(c.path || c.name)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        sectionsHtml += renderChangelogGroup({
            labelClass: 'group-label-config',
            dotClass: 'dot-config',
            title: '🔧 Конфигурации сервера',
            count: configsList.length,
            itemsHtml: configsHtml,
            isOpen: false
        });
    }

    if (activitiesList.length === 0 && skillsList.length === 0 && questsList.length === 0 && totalMods === 0 && otherScripts.length === 0 && configsCount === 0 && !item.custom_note) {
        sectionsHtml += '<div class="changelog-item-empty">Мелкие системные исправления сборки</div>';
    }

    sectionsHtml += '</div>';

    return headerHtml + sectionsHtml;
}

/**
 * Хелпер рендера карточки отдельного мода (добавлен / обновлен / удален)
 */
function renderModCard(item, actionType) {
    if (actionType === 'update') {
        const oldRaw = typeof item === 'string' ? item : (item.old || '');
        const newRaw = typeof item === 'string' ? item : (item.new || item.name || '');
        const pOld = formatModDisplay(oldRaw);
        const pNew = formatModDisplay(newRaw);

        return `
            <div class="changelog-mod-card card-update" title="${escapeHtml(oldRaw)} ➔ ${escapeHtml(newRaw)}">
                <div class="mod-card-left">
                    <div class="mod-type-icon icon-update">🔄</div>
                    <div class="mod-info-block">
                        <span class="mod-main-name">${escapeHtml(pNew.title || pOld.title)}</span>
                        <span class="mod-sub-filename">${escapeHtml(newRaw)}</span>
                    </div>
                </div>
                <div class="mod-diff-tag">
                    ${pOld.version ? `<span class="v-old">${escapeHtml(pOld.version)}</span>` : ''}
                    <span class="v-arrow">➔</span>
                    <span class="v-new">${escapeHtml(pNew.version || 'new')}</span>
                </div>
            </div>
        `;
    }

    const raw = typeof item === 'string' ? item : (item.name || '');
    const parsed = formatModDisplay(raw);

    if (actionType === 'remove') {
        return `
            <div class="changelog-mod-card card-remove" title="${escapeHtml(raw)}">
                <div class="mod-card-left">
                    <div class="mod-type-icon icon-remove">➖</div>
                    <div class="mod-info-block">
                        <span class="mod-main-name">${escapeHtml(parsed.title)}</span>
                        <span class="mod-sub-filename">${escapeHtml(parsed.raw)}</span>
                    </div>
                </div>
                ${parsed.version ? `<span class="mod-version-tag tag-removed">${escapeHtml(parsed.version)}</span>` : ''}
            </div>
        `;
    }

    // Default: 'add'
    return `
        <div class="changelog-mod-card card-add" title="${escapeHtml(raw)}">
            <div class="mod-card-left">
                <div class="mod-type-icon icon-add">➕</div>
                <div class="mod-info-block">
                    <span class="mod-main-name">${escapeHtml(parsed.title)}</span>
                    <span class="mod-sub-filename">${escapeHtml(parsed.raw)}</span>
                </div>
            </div>
            ${parsed.version ? `<span class="mod-version-tag">${escapeHtml(parsed.version)}</span>` : ''}
        </div>
    `;
}

/**
 * Отрендерить состояние пустой истории
 */
function renderEmptyState(message, containerId = 'changelog-list') {
    const container = dom.get(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="changelog-empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-title">${escapeHtml(message || 'История обновлений пока пуста')}</div>
            <div class="empty-desc">
                Все добавленные, обновлённые и удалённые моды сборки, конфиги, рецепты и релизы лаунчера будут автоматически появляться здесь.
            </div>
        </div>
    `;
}

/**
 * Экранирование HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const BELL_SVG = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
`;

let changelogAnimating = false;

/**
 * Открыть экран истории обновлений с анимацией (или переключить таб)
 */
export function openChangelogScreen() {
    openSettings('changelog');
    markChangelogSeen();
}

/**
 * Закрыть экран истории обновлений с анимацией
 */
export function closeChangelogScreen(instant = false) {
    closeSettings(instant);
}

/**
 * Переключить видимость экрана истории обновлений
 */
export function toggleChangelogScreen() {
    const stepProgress = dom.get('step-progress');
    if (stepProgress && !stepProgress.classList.contains('hidden')) return;

    const settingsScreen = dom.get('step-settings');
    const isVisible = settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing');

    if (isVisible) {
        const activeTabBtn = document.querySelector('#settings-tabs-bar .tab-btn.active');
        if (activeTabBtn && activeTabBtn.dataset.tab !== 'changelog') {
            switchTab('changelog');
            markChangelogSeen();
        } else {
            closeSettings();
        }
    } else {
        openSettings('changelog');
        markChangelogSeen();
    }
}

/**
 * Проверка, открыт ли чейнджлог прямо сейчас
 */
export function isChangelogOpen() {
    const settingsScreen = dom.get('step-settings');
    const isVisible = settingsScreen && !settingsScreen.classList.contains('hidden') && !settingsScreen.classList.contains('closing');
    const activeTabBtn = document.querySelector('#settings-tabs-bar .tab-btn.active');
    return Boolean(isVisible && activeTabBtn && activeTabBtn.dataset.tab === 'changelog');
}

/**
 * Инициализация обработчиков экрана обновлений, колокольчика и загрузка данных
 */
export function initChangelog() {
    if (isInitialized) return;
    isInitialized = true;

    // Кнопка колокольчика в шапке
    const bellBtn = dom.get('btn-changelog');
    if (bellBtn) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleChangelogScreen();
        });
    }

    // Закрытие по клавише Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isChangelogOpen()) {
            closeSettings();
        }
    });

    initChangelogFilters();

    // Фоновая загрузка истории
    loadChangelogHistory();
}
