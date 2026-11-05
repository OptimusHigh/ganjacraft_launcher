/**
 * Ganj4Craft Launcher - Configs Manager (Master-Detail UI)
 * Управление конфигурациями модов с парсингом напрямую из файлов
 */

import { dom } from '../../utils/dom.js';
import { updateSaveButtonVisibility } from '../settings/settings.js';

let allConfigs = [];
let searchQuery = '';
let activeConfigFile = null;
let pendingConfigChanges = new Map(); // Ключ: filePath|key, Значение: newValue

/**
 * Проверить есть ли несохранённые изменения в конфигах
 */
export function hasUnsavedConfigs() {
    return pendingConfigChanges.size > 0;
}

/**
 * Сохранить все изменения конфигов разом (вызывается из app.js при клике на кнопку Сохранить)
 */
export async function savePendingConfigs() {
    if (pendingConfigChanges.size === 0) return true;

    let allSuccess = true;
    for (const [hash, newValue] of pendingConfigChanges.entries()) {
        const [filePath, key] = hash.split('|');
        try {
            const result = await window.api.saveGameConfig(filePath, key, newValue);
            if (!result.success) {
                console.error(`Failed to save config ${key}:`, result.error);
                allSuccess = false;
            } else {
                // Обновляем в локальном кэше
                const configItem = allConfigs.find(c => c.filePath === filePath && c.key === key);
                if (configItem) {
                    configItem.value = newValue;
                }
            }
        } catch (e) {
            console.error(`IPC error saving config ${key}:`, e);
            allSuccess = false;
        }
    }

    if (allSuccess) {
        pendingConfigChanges.clear();
        // Подсвечиваем активные элементы зелёным
        const inputs = document.querySelectorAll('.cfg-input, .toggle-switch input');
        inputs.forEach(input => {
            if (input.dataset.changed === 'true') {
                input.classList.remove('changed');
                input.classList.add('saved');
                setTimeout(() => input.classList.remove('saved'), 1000);
                input.dataset.changed = 'false';
            }
        });
    }

    return allSuccess;
}

/**
 * Отменить несохранённые изменения (вызывается при закрытии без сохранения)
 */
export function cancelPendingConfigs() {
    if (pendingConfigChanges.size === 0) return;
    pendingConfigChanges.clear();

    // Пересобираем правую панель чтобы вернуть исходные значения
    if (activeConfigFile) {
        const groupsMap = getFilteredGroups();
        if (groupsMap[activeConfigFile]) {
            const rightPanel = document.getElementById('cfg-right-panel');
            if (rightPanel) {
                buildDetailPanel(rightPanel, groupsMap);
            }
        }
    }
}


/**
 * Загрузить список конфигураций
 */
export async function loadConfigsList(profileId = window.__activeBuildProfileId) {
    const gridContainer = dom.get('configs-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '<div class="unified-loading"><span class="unified-spinner"></span>Загрузка конфигураций...</div>';

    try {
        allConfigs = await window.api.getGameConfigs(profileId);

        if (!allConfigs || allConfigs.length === 0) {
            gridContainer.innerHTML = '<div class="unified-empty"><div class="unified-empty-icon">⚠️</div><div class="unified-empty-text">Конфигурации не найдены</div></div>';
            return;
        }

        renderConfigsUI();
    } catch (e) {
        console.error('Error loading configs:', e);
        gridContainer.innerHTML = `<div class="unified-empty"><div class="unified-empty-icon">❌</div><div class="unified-empty-text">Ошибка загрузки: ${e.message}</div></div>`;
    }
}

/**
 * Хелпер для форматирования camelCase ключей в читаемый вид
 */
function formatKeyName(key) {
    if (!key) return key;
    const spaced = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).replace(/\s+/g, ' ').trim();
}

/**
 * Вычислить отфильтрованные группы по текущему searchQuery.
 * Группируем по filePath чтобы не смешивать одноимённые файлы из разных папок.
 * Ключ группы — displayName ("папка/файл.toml" или просто "файл.toml").
 */
function getFilteredGroups() {
    const query = searchQuery ? searchQuery.trim().toLowerCase() : '';

    const filteredConfigs = allConfigs.filter(item => {
        if (!query) return true;
        // Поиск по ключу, комментарию, имени файла и пути (включая папку)
        return (item.key && item.key.toLowerCase().includes(query)) ||
            (item.comment && item.comment.toLowerCase().includes(query)) ||
            (item.fileName && item.fileName.toLowerCase().includes(query)) ||
            (item.filePath && item.filePath.toLowerCase().includes(query));
    });

    // Собираем уникальные filePath → определяем у каких fileName есть дубликаты
    const filePathSet = {};
    filteredConfigs.forEach(config => {
        if (!filePathSet[config.filePath]) {
            filePathSet[config.filePath] = config.fileName;
        }
    });

    // Считаем сколько разных путей имеют одно и то же fileName
    const fileNameCount = {};
    Object.values(filePathSet).forEach(name => {
        fileNameCount[name] = (fileNameCount[name] || 0) + 1;
    });

    // Строим groupsMap: ключ = displayName
    const groupsMap = {};
    filteredConfigs.forEach(config => {
        const displayName = getDisplayName(config, fileNameCount);
        if (!groupsMap[displayName]) groupsMap[displayName] = [];
        // Сохраняем displayName на объекте для удобства
        config._displayName = displayName;
        groupsMap[displayName].push(config);
    });

    return groupsMap;
}

/**
 * Возвращает отображаемое имя файла:
 * — если fileName встречается из нескольких папок → «папка/файл.toml»
 * — если файл лежит в поддиректории configDir (определяем по глубине пути) → «папка/файл.toml»
 * — иначе просто «файл.toml»
 */
function getDisplayName(config, fileNameCount) {
    const sep = config.filePath.includes('/') ? '/' : '\\';
    const parts = config.filePath.split(sep);
    const fileName = parts[parts.length - 1];
    const parentFolder = parts.length >= 2 ? parts[parts.length - 2] : null;

    // Если папка называется «config» — это root, не показываем
    const isRootConfigDir = parentFolder && parentFolder.toLowerCase() === 'config';

    if (!isRootConfigDir && parentFolder && fileNameCount[fileName] > 1) {
        // Дубликаты имён из разных папок
        return `${parentFolder}/${fileName}`;
    }
    if (!isRootConfigDir && parentFolder) {
        // Файл в поддиректории (не root config)
        return `${parentFolder}/${fileName}`;
    }
    return fileName;
}

/**
 * Полный рендер Master-Detail layout (вызывается при первой загрузке и при смене поиска)
 */
function renderConfigsUI() {
    const grid = dom.get('configs-grid');
    if (!grid) return;

    grid.className = 'cfg-master-detail';

    const groupsMap = getFilteredGroups();
    const categories = Object.keys(groupsMap).sort();

    if (!activeConfigFile || !categories.includes(activeConfigFile)) {
        activeConfigFile = categories.length > 0 ? categories[0] : null;
    }

    // ==== LEFT PANEL (MASTER) ====
    const leftPanel = document.createElement('div');
    leftPanel.className = 'cfg-panel-left';
    leftPanel.id = 'cfg-left-panel';

    // Search Box
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'cfg-search-wrapper';
    searchWrapper.innerHTML = `
        <div class="search-input-wrapper" style="width: 100%;">
            <input type="text" id="configs-search-input" value="${searchQuery || ''}" placeholder="Поиск файлов и настроек..." autocomplete="off">
            <button type="button" id="configs-search-clear-btn" class="search-action-btn" title="Очистить">
                <svg class="search-icon-magnifier ${searchQuery ? 'hidden' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <svg class="search-icon-clear ${searchQuery ? '' : 'hidden'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    `;
    leftPanel.appendChild(searchWrapper);

    // File List
    const fileListContainer = document.createElement('div');
    fileListContainer.className = 'cfg-file-list';
    fileListContainer.id = 'cfg-file-list';

    buildFileList(fileListContainer, categories, groupsMap);
    leftPanel.appendChild(fileListContainer);

    // ==== RIGHT PANEL (DETAIL) ====
    const rightPanel = document.createElement('div');
    rightPanel.className = 'cfg-panel-right';
    rightPanel.id = 'cfg-right-panel';

    buildDetailPanel(rightPanel, groupsMap);

    grid.innerHTML = '';
    grid.appendChild(leftPanel);
    grid.appendChild(rightPanel);

    setupSearchEvents();
}

/**
 * Строим список файлов в левой панели
 */
function buildFileList(container, categories, groupsMap) {
    container.innerHTML = '';

    if (categories.length === 0) {
        container.innerHTML = '<div class="cfg-empty-hint">Ничего не найдено</div>';
        return;
    }

    categories.forEach(catName => {
        const isActive = activeConfigFile === catName;
        const fileItem = document.createElement('div');
        fileItem.className = `cfg-file-item${isActive ? ' active' : ''}`;
        fileItem.dataset.cat = catName;
        // Нативный тулип — браузер сам показывает при переполнении
        fileItem.title = catName;

        // Если displayName содержит слеш — разбиваем на папку и имя файла
        const slashIdx = catName.indexOf('/');
        const nameHtml = slashIdx !== -1
            ? `<span class="cfg-file-folder">${catName.slice(0, slashIdx + 1)}</span><span class="cfg-file-name">${catName.slice(slashIdx + 1)}</span>`
            : `<span class="cfg-file-name">${catName}</span>`;

        fileItem.innerHTML = `
            <svg class="cfg-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span class="cfg-file-name-wrap">${nameHtml}</span>
        `;

        fileItem.onclick = () => selectConfigFile(catName, groupsMap);

        container.appendChild(fileItem);
    });
}

/**
 * Выбрать файл — только обновляем active-класс и правую панель, левый скролл не трогаем
 */
function selectConfigFile(catName, groupsMap) {
    if (activeConfigFile === catName) return;

    activeConfigFile = catName;

    // Обновляем active-класс в левой панели без перерисовки
    const fileList = document.getElementById('cfg-file-list');
    if (fileList) {
        fileList.querySelectorAll('.cfg-file-item').forEach(el => {
            el.classList.toggle('active', el.dataset.cat === catName);
        });
    }

    // Обновляем только правую панель
    const rightPanel = document.getElementById('cfg-right-panel');
    if (rightPanel) {
        rightPanel.scrollTop = 0; // сбрасываем скролл правой панели (это нормально)
        buildDetailPanel(rightPanel, groupsMap);
    }
}

/**
 * Строим содержимое правой панели (детальный вид файла)
 */
function buildDetailPanel(container, groupsMap) {
    container.innerHTML = '';

    if (!activeConfigFile || !groupsMap[activeConfigFile]) {
        container.innerHTML = '<div class="cfg-placeholder">Выберите файл слева для просмотра параметров</div>';
        return;
    }

    const activeConfigs = groupsMap[activeConfigFile];

    // Header — если displayName содержит папку, показываем её отдельно
    const detailHeader = document.createElement('div');
    detailHeader.className = 'cfg-detail-header';
    const slashIdx = activeConfigFile.indexOf('/');
    const headerHtml = slashIdx !== -1
        ? `<h2 class="cfg-detail-title"><span class="cfg-detail-folder">${activeConfigFile.slice(0, slashIdx + 1)}</span>${activeConfigFile.slice(slashIdx + 1)}</h2>`
        : `<h2 class="cfg-detail-title">${activeConfigFile}</h2>`;
    detailHeader.innerHTML = headerHtml;
    container.appendChild(detailHeader);


    // Group by Categories
    const activeGroups = {};
    activeConfigs.forEach(config => {
        const cat = config.category || 'Общие';
        if (!activeGroups[cat]) activeGroups[cat] = [];
        activeGroups[cat].push(config);
    });

    const sortedGroups = Object.keys(activeGroups).sort();

    sortedGroups.forEach(groupName => {
        if (groupName !== 'Общие') {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'cfg-group-title';
            groupTitle.textContent = groupName;
            container.appendChild(groupTitle);
        }

        activeGroups[groupName].forEach(config => {
            const item = document.createElement('div');
            item.className = 'cfg-field';

            const readableKey = formatKeyName(config.key);
            const commentHtml = config.comment
                ? `<div class="cfg-field-comment">${config.comment}</div>`
                : '';

            if (config.type === 'boolean') {
                item.innerHTML = `
                    <div class="cfg-field-row">
                        <div class="cfg-field-label-wrap">
                            <div class="cfg-field-title" title="${config.key}">${readableKey}</div>
                            ${commentHtml}
                        </div>
                        <div class="cfg-toggle-wrap">
                            <label class="toggle-switch">
                                <input type="checkbox" data-type="boolean" ${config.value ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                `;
            } else {
                const inputType = config.type === 'number' ? 'number' : 'text';
                item.innerHTML = `
                    <div class="cfg-field-title" title="${config.key}">${readableKey}</div>
                    ${commentHtml}
                    <input type="${inputType}" class="cfg-input" data-type="${config.type}" value="${String(config.value).replace(/"/g, '&quot;')}">
                `;
            }

            const inputElement = item.querySelector('input');
            if (inputElement) {
                inputElement.addEventListener('change', (e) => {
                    handleConfigChange(config.filePath, config.key, config.type, e.target);
                });
                if (config.type !== 'boolean') {
                    inputElement.addEventListener('input', (e) => {
                        handleConfigChange(config.filePath, config.key, config.type, e.target);
                    });
                }
            }

            container.appendChild(item);
        });
    });
}

function setupSearchEvents() {
    const searchInput = document.getElementById('configs-search-input');
    const clearBtn = document.getElementById('configs-search-clear-btn');

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            // При смене поиска перестраиваем весь UI (левый список изменился)
            renderConfigsUI();
            const newSearchInput = document.getElementById('configs-search-input');
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
            }
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            searchQuery = '';
            renderConfigsUI();
        };
    }
}

/**
 * Обработка изменения значения и накопление его в кэше
 */
function handleConfigChange(filePath, key, type, inputElement) {
    let newValue;

    if (type === 'boolean') {
        newValue = inputElement.checked;
    } else if (type === 'number') {
        newValue = Number(inputElement.value);
        if (isNaN(newValue)) {
            inputElement.classList.add('error');
            return;
        }
    } else {
        newValue = inputElement.value;
    }

    inputElement.classList.remove('error');

    const configItem = allConfigs.find(c => c.filePath === filePath && c.key === key);
    if (!configItem) return;

    const hash = `${filePath}|${key}`;

    // Если значение вернулось к исходному — удаляем из pending
    if (newValue === configItem.value) {
        pendingConfigChanges.delete(hash);
        inputElement.dataset.changed = 'false';
        inputElement.classList.remove('changed');
    } else {
        pendingConfigChanges.set(hash, newValue);
        inputElement.dataset.changed = 'true';
        inputElement.classList.add('changed');
    }

    // Вызываем проверку глобальной кнопки Сохранить
    updateSaveButtonVisibility();
}
