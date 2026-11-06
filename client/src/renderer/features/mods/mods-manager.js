/**
 * Ganj4Craft Launcher - Mods Manager (Native Launcher UI)
 * Управление модами с использованием стандартных категорий и переключателей лаунчера
 */

import { dom } from '../../utils/dom.js';
import { FILES_BASE } from '../../constants.js';
import { MOD_GROUPS, CATEGORY_ORDER } from './mod-groups.js';
import { isClientMod } from '../changelog/changelog-manager.js';

let cachedManifest = null;
let cachedManifestProfileId = null;
let searchQuery = '';
let allGroupItems = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeManifestPath(filePath) {
    return String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function getManifestFileKind(file) {
    const normalizedPath = normalizeManifestPath(file?.path).toLowerCase();
    const declaredKind = String(file?.kind || file?.type || '').trim().toLowerCase();

    if (normalizedPath.startsWith('client_mods/')) return 'client_mod';
    if (normalizedPath.startsWith('resourcepacks/')) return 'resourcepack';
    if (normalizedPath.startsWith('shaderpacks/')) return 'shader';
    if (declaredKind === 'client' || declaredKind === 'client_mod' || declaredKind === 'client-mod') return 'client_mod';
    if (declaredKind === 'resource_pack' || declaredKind === 'resource-pack' || declaredKind === 'resourcepack') return 'resourcepack';
    if (declaredKind === 'shaderpack' || declaredKind === 'shader_pack' || declaredKind === 'shader-pack' || declaredKind === 'shader') return 'shader';
    return 'mod';
}

function getModFileName(filePath) {
    return normalizeManifestPath(filePath).split('/').pop() || '';
}

function getModStem(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const fileName = filePath.split('/').pop().split('\\').pop().toLowerCase();
    return fileName
        .replace(/\.jar$/i, '')
        .replace(/\.zip$/i, '')
        .replace(/[-_](v?\d+\.[\d.]+.*)$/i, '')
        .replace(/[-_](neoforge|forge|fabric|mc\d+.*)$/i, '');
}

function fileMatchesPattern(filePath, pattern) {
    const norm = normalizeManifestPath(filePath).toLowerCase();
    const fileName = norm.split('/').pop();
    const p = pattern.toLowerCase();

    const matches = fileName.includes(p) || norm.includes(p);
    if (!matches) return false;

    // Collision exclusions to prevent overlapping patterns
    if (p === 'sodium' && (fileName.includes('sodium-extra') || fileName.includes('sodium_extra') || fileName.includes('reeses'))) return false;
    if (p === 'entity_texture_features' && (fileName.includes('entity_model_features') || fileName.includes('entity_sound_features'))) return false;
    if (p === 'etf' && (fileName.includes('emf') || fileName.includes('esf'))) return false;
    if (p === 'litematica' && (fileName.includes('printer') || fileName.includes('malilib'))) return false;
    if (p === 'forgematica' && (fileName.includes('printer') || fileName.includes('mafglib') || fileName.includes('badpackets'))) return false;
    if (p === 'freshanimations' && (fileName.includes('fa+all') || fileName.includes('fa+player'))) return false;
    if (p === 'armory reforged' && (fileName.includes('reforged tools') || fileName.includes('hardware reforged') || fileName.includes('health bars'))) return false;
    if (p === 'armoryreforged' && (fileName.includes('reforgedtools') || fileName.includes('hardwarereforged') || fileName.includes('healthbars'))) return false;
    if (p === 'visualenchantments' && (fileName.includes('armor_trims') || fileName.includes('armortrims') || fileName.includes('enchant icons') || fileName.includes('enchanticons') || fileName.includes('xali'))) return false;
    if (p === 'visual_enchantments' && (fileName.includes('armor_trims') || fileName.includes('enchant icons') || fileName.includes('xali'))) return false;
    if (p === 'controlling' && fileName.includes('searchables')) return false;
    if ((p === 'emi' || p === 'semi') && (fileName.includes('createjeicompat') || fileName.includes('jei') || fileName.includes('jer'))) return false;
    if (p === 'jei' && (fileName.includes('justenoughresources') || fileName.includes('jer'))) return false;
    if (p.includes('fancy') && fileName.includes('fast')) return false;
    if (p.includes('fast') && fileName.includes('fancy')) return false;

    return true;
}

function isCandidateOptionalFile(file) {
    if (!file || typeof file.path !== 'string') return false;
    const norm = normalizeManifestPath(file.path).toLowerCase();

    // Ignore helper/metadata files that are handled with parent packs
    if (norm.endsWith('.pw.toml') || norm.endsWith('.zip.txt') || norm.endsWith('.disabled')) return false;

    if (file.optional === true) return true;

    if (norm.startsWith('client_mods/') || norm.startsWith('resourcepacks/') || norm.startsWith('shaderpacks/')) {
        return true;
    }

    if (norm.startsWith('mods/')) {
        if (norm.startsWith('mods/client-') || norm.startsWith('mods/client_')) return true;
        const fileName = norm.split('/').pop();
        if (isClientMod(fileName)) return true;
        if (MOD_GROUPS.some(g => g.files && g.files.some(p => fileMatchesPattern(fileName, p)))) return true;
    }

    return false;
}

const LEGACY_GROUP_ALIASES = {
    etf_emf_cit: 'etf',
    cit_resewn: 'etf',
    etf_emf: 'etf',
    oculus: 'iris'
};

function isModDisabled(filePath, disabledMods = []) {
    if (!filePath || !Array.isArray(disabledMods) || disabledMods.length === 0) return false;
    const normPath = normalizeManifestPath(filePath);
    if (disabledMods.includes(normPath)) return true;

    const targetFileName = normPath.split('/').pop().toLowerCase();
    const targetStem = getModStem(normPath);

    for (const disabledEntry of disabledMods) {
        if (!disabledEntry) continue;
        const normDisabled = normalizeManifestPath(disabledEntry);
        if (normDisabled === normPath) return true;

        const lookupId = LEGACY_GROUP_ALIASES[normDisabled] || normDisabled;
        const groupById = MOD_GROUPS.find(g => g.id === lookupId);
        if (groupById && groupById.files) {
            if (groupById.files.some(p => targetFileName.includes(p.toLowerCase()))) return true;
        }

        const entryFileName = normDisabled.split('/').pop().toLowerCase();
        const matchingGroup = MOD_GROUPS.find(g =>
            g.files && g.files.some(p => entryFileName.includes(p.toLowerCase()))
        );
        if (matchingGroup && matchingGroup.files) {
            if (matchingGroup.files.some(p => targetFileName.includes(p.toLowerCase()))) return true;
        }

        const entryStem = getModStem(normDisabled);
        if (targetStem && entryStem && targetStem === entryStem) return true;
    }

    return false;
}

/**
 * Загрузить список модов
 */
export async function loadModsList(disabledMods = [], config = {}, forceReload = false) {
    const profileId = config.activeProfileId || window.__activeBuildProfileId || 'ganj4craft5';
    const profileChanged = cachedManifestProfileId !== profileId;
    if (!profileId) {
        cachedManifest = null;
        cachedManifestProfileId = null;
        allGroupItems = [];
        const gridContainer = dom.get('mods-grid');
        if (gridContainer) {
            gridContainer.innerHTML = '<div class="unified-empty"><div class="unified-empty-icon">🎮</div><div class="unified-empty-text">Сначала выберите сборку</div></div>';
        }
        return;
    }
    forceReload = forceReload || profileChanged;
    const gridContainer = dom.get('mods-grid');
    if (!gridContainer) return;

    // Если список модов уже загружен в память — обновляем состояния и сетку без вывода спиннера
    if (allGroupItems.length > 0 && !forceReload) {
        allGroupItems.forEach(item => {
            if (item.type === 'group') {
                const group = MOD_GROUPS.find(g => g.id === item.id);
                if ((config.modsDefaultsApplied !== true || config.modsDefaultsVersion !== 2) && group?.defaultDisabled) {
                    item.checked = false;
                } else {
                    item.checked = item.paths.every(p => !isModDisabled(p, disabledMods));
                }
            } else {
                item.checked = item.paths.every(p => !isModDisabled(p, disabledMods));
            }
        });

        renderModsGrid();
        return;
    }

    if (allGroupItems.length === 0) {
        gridContainer.innerHTML = '<div class="unified-loading"><span class="unified-spinner"></span>Загрузка модов...</div>';
    }

    cachedManifest = await window.api.getManifest(profileId);
    cachedManifestProfileId = profileId;
    if (!cachedManifest) {
        gridContainer.innerHTML = '<div class="unified-empty"><div class="unified-empty-icon">⚠️</div><div class="unified-empty-text">Не удалось загрузить манифест модов</div></div>';
        return;
    }

    const manifestFiles = Array.isArray(cachedManifest.files) ? cachedManifest.files : [];
    const allFiles = manifestFiles.filter(file => isCandidateOptionalFile(file));

    allGroupItems = [];
    const handledFiles = new Set();

    // 1. Обрабатываем структурированные группы модов и ресурспаков
    MOD_GROUPS.forEach(group => {
        const groupFiles = allFiles.filter(f => {
            return group.files.some(pattern => fileMatchesPattern(f.path, pattern));
        });

        if (groupFiles.length > 0) {
            groupFiles.forEach(f => handledFiles.add(f.path));

            // Захватываем сопутствующие вспомогательные файлы (например, .pw.toml или .zip.txt для шейдеров)
            const extraPaths = [];
            groupFiles.forEach(f => {
                const normPath = normalizeManifestPath(f.path);
                manifestFiles.forEach(mf => {
                    const mfNorm = normalizeManifestPath(mf.path);
                    if (mfNorm !== normPath && (mfNorm.startsWith(normPath + '.') || (normPath.endsWith('.zip') && mfNorm === normPath.replace(/\.zip$/i, '.pw.toml')))) {
                        handledFiles.add(mf.path);
                        extraPaths.push(mfNorm);
                    }
                });
            });

            let isChecked;
            if ((config.modsDefaultsApplied !== true || config.modsDefaultsVersion !== 2) && group.defaultDisabled) {
                isChecked = false;
            } else {
                isChecked = groupFiles.every(f => !isModDisabled(f.path, disabledMods));
            }

            const allGroupPaths = [...groupFiles.map(f => normalizeManifestPath(f.path)), ...extraPaths];

            allGroupItems.push({
                type: 'group',
                id: group.id,
                name: group.name,
                shortName: group.shortName || group.name,
                version: group.version || '1.0.0',
                subCategory: group.subCategory || 'Остальное',
                icon: group.icon || 'gear',
                dependsOn: group.dependsOn || null,
                description: group.description,
                curseSlug: group.curseSlug,
                modrinthSlug: group.modrinthSlug,
                paths: allGroupPaths,
                checked: isChecked
            });
        }
    });

    // 2. Обрабатываем оставшиеся файлы (индивидуальные моды, ресурспаки, шейдеры)
    const remainingFiles = allFiles.filter(f => !handledFiles.has(f.path));
    remainingFiles.forEach(file => {
        const isChecked = !isModDisabled(file.path, disabledMods);
        const fileName = getModFileName(file.path);
        const normalizedPath = normalizeManifestPath(file.path).toLowerCase();
        const kind = getManifestFileKind(file);
        const specialSection = kind === 'resourcepack'
            ? 'Ресурспаки'
            : kind === 'shader'
                ? 'Шейдеры'
                : 'Остальное';

        let prettyName = file.displayName || fileName
            .replace(/\.(jar|zip|mcpack)$/i, '')
            .replace(/^client[-_]/i, '')
            .replace(/[-_](neoforge|forge|fabric|mc|\d+\.\d+).*/i, '')
            .replace(/[-_]\d+.*$/i, '')
            .replace(/[_-]+/g, ' ')
            .trim();
        prettyName = prettyName.charAt(0).toUpperCase() + prettyName.slice(1);

        const slug = prettyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        allGroupItems.push({
            type: 'file',
            id: `${kind}-${slug}`,
            name: prettyName,
            shortName: prettyName,
            version: file.version || '1.0.0',
            kind,
            badge: specialSection,
            subCategory: specialSection,
            icon: kind === 'resourcepack' ? 'brush' : kind === 'shader' ? 'brush' : 'block',
            dependsOn: null,
            description: `${specialSection} (${fileName})`,
            curseSlug: slug,
            modrinthSlug: slug,
            paths: [normalizeManifestPath(file.path)],
            checked: isChecked
        });
    });

    // Валидация зависимостей при старте
    allGroupItems.forEach(item => {
        if (item.dependsOn && item.checked) {
            const parent = allGroupItems.find(p => p.id === item.dependsOn);
            if (parent && !parent.checked) {
                item.checked = false;
            }
        }
    });

    renderModsGrid();
}

/**
 * Переключить состояние мода и применить каскадные зависимости
 */
export function toggleModState(modId, isChecked) {
    const mod = allGroupItems.find(m => m.id === modId);
    if (!mod) return;

    mod.checked = isChecked;

    // Синхронизируем состояние чекбокса в DOM без полной перерисовки страницы
    const grid = dom.get('mods-grid');
    if (grid) {
        const input = grid.querySelector(`input[data-id="${modId}"]`);
        if (input && input.checked !== isChecked) {
            input.checked = isChecked;
        }

        const addonsContainer = grid.querySelector(`.mod-addons-container[data-parent-id="${modId}"]`);
        if (addonsContainer) {
            if (isChecked) {
                addonsContainer.classList.remove('parent-disabled');
            } else {
                addonsContainer.classList.add('parent-disabled');
            }
        }

        // Обновляем счётчик активных модов
        updateActiveCounterDisplay();
    }

    if (isChecked) {
        if (mod.dependsOn) {
            const parent = allGroupItems.find(p => p.id === mod.dependsOn);
            if (parent && !parent.checked) {
                toggleModState(parent.id, true);
            }
        }
    } else {
        const children = allGroupItems.filter(c => c.dependsOn === modId);
        children.forEach(child => {
            if (child.checked) {
                toggleModState(child.id, false);
            }
        });
    }
}

function updateActiveCounterDisplay() {
    const counter = document.getElementById('mods-active-counter');
    if (counter) {
        const total = allGroupItems.length;
        const enabled = allGroupItems.filter(i => i.checked).length;
        counter.textContent = `${enabled} / ${total} активно`;
    }
}

/**
 * Индивидуальные SVG иконки для каждого типа мода
 */
function getModItemSVG(iconType) {
    switch (iconType) {
        case 'sodium':
            return `<svg class="setting-icon" style="color: #4CAF50;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
        case 'cloud':
            return `<svg class="setting-icon" style="color: #64b5f6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>`;
        case 'brush':
            return `<svg class="setting-icon" style="color: #ba68c8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92.92 2.07 1.06 3 1.06 2.76 0 5-2.24 5-5 0-.58-.1-1.13-.27-1.64"/></svg>`;
        case 'leaf':
            return `<svg class="setting-icon" style="color: #81c784;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
        case 'monitor':
            return `<svg class="setting-icon" style="color: #29b6f6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`;
        case 'eye':
            return `<svg class="setting-icon" style="color: #ab47bc;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        case 'block':
            return `<svg class="setting-icon" style="color: #4dd0e1;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
        case 'keyboard':
            return `<svg class="setting-icon" style="color: #ffa726;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>`;
        case 'mouse':
            return `<svg class="setting-icon" style="color: #26a69a;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="7"/><line x1="12" x2="12" y1="6" y2="10"/></svg>`;
        case 'award':
            return `<svg class="setting-icon" style="color: #ffca28;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`;
        case 'camera':
            return `<svg class="setting-icon" style="color: #42a5f5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
        case 'user':
            return `<svg class="setting-icon" style="color: #7e57c2;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        case 'blueprint':
            return `<svg class="setting-icon" style="color: #26c6da;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24a1.48 1.48 0 0 0-1.55 0L3 6"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>`;
        case 'sound':
            return `<svg class="setting-icon" style="color: #ffb74d;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
        case 'heart':
            return `<svg class="setting-icon" style="color: #ef5350;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
        case 'swords':
            return `<svg class="setting-icon" style="color: #e57373;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>`;
        case 'gear':
        default:
            return `<svg class="setting-icon" style="color: #a1a8b5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;
    }
}

/**
 * Иконки для категории
 */
function getCategoryIconId(catName) {
    switch (catName.toUpperCase()) {
        case 'ОПТИМИЗАЦИЯ': return '#icon-game';
        case 'ГРАФИКА': return '#icon-appearance';
        case 'КАМЕРА И УПРАВЛЕНИЕ':
        case 'КАМЕРА': return '#icon-hide';
        case 'СТРОИТЕЛЬСТВО': return '#icon-folder';
        case 'ИНТЕРФЕЙС': return '#icon-wrench';
        case 'РЕСУРСПАКИ': return '#icon-appearance';
        case 'ШЕЙДЕРЫ': return '#icon-smoke';
        default: return '#icon-game';
    }
}

/**
 * Отрендерить единую страницу модов (Опциональные моды + Поиск + Полный список внизу)
 */
export function renderModsGrid() {
    const grid = dom.get('mods-grid');
    if (!grid) return;

    const query = searchQuery ? searchQuery.trim().toLowerCase() : '';

    // Фильтруем элементы
    const filteredMods = allGroupItems.filter(item => {
        if (!query) return true;
        return (item.name && item.name.toLowerCase().includes(query)) ||
            (item.shortName && item.shortName.toLowerCase().includes(query)) ||
            (item.description && item.description.toLowerCase().includes(query));
    });

    const groupsMap = {};
    filteredMods.forEach(mod => {
        const cat = mod.subCategory || 'Остальное';
        if (!groupsMap[cat]) groupsMap[cat] = [];
        groupsMap[cat].push(mod);
    });

    const fragment = document.createDocumentFragment();

    // 1. КАРТОЧКА ПОИСКА МОДОВ (Размещается вверху правой колонки)
    const totalOptional = allGroupItems.length;
    const enabledOptional = allGroupItems.filter(i => i.checked).length;

    const searchCard = document.createElement('div');
    searchCard.className = 'settings-category search-card-top';
    searchCard.innerHTML = `
        <div class="category-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h4>ПОИСК МОДОВ</h4>
            </div>
            <span class="mods-active-counter" id="mods-active-counter">${enabledOptional} / ${totalOptional} активно</span>
        </div>
        <div class="category-content" style="padding: 12px 14px;">
            <div class="search-input-wrapper" style="width: 100%;">
                <input type="text" id="mods-search-input" value="${escapeHtml(searchQuery || '')}" placeholder="Поиск модов..." autocomplete="off">
                <button type="button" id="mods-search-clear-btn" class="search-action-btn" title="Очистить">
                    <svg class="search-icon-magnifier ${searchQuery ? 'hidden' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <svg class="search-icon-clear ${searchQuery ? '' : 'hidden'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
    `;

    // 2. Двухколоночный флекс-контейнер
    const colLeft = document.createElement('div');
    colLeft.className = 'mods-col-left';
    colLeft.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 14px; min-width: 0;';

    const colRight = document.createElement('div');
    colRight.className = 'mods-col-right';
    colRight.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 14px; min-width: 0;';

    // Помещаем Поиск первым в правую колонку
    colRight.appendChild(searchCard);

    // Сортировка категорий
    const sortedCats = Object.keys(groupsMap).sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a);
        const idxB = CATEGORY_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    if (query && filteredMods.length === 0) {
        const emptyNotice = document.createElement('div');
        emptyNotice.className = 'settings-category';
        emptyNotice.innerHTML = `
            <div class="category-content" style="padding: 24px; text-align: center; color: var(--gc-text-subtle, #7a808c); font-size: 13px;">
                Опциональные моды по запросу «${escapeHtml(query)}» не найдены
            </div>
        `;
        colLeft.appendChild(emptyNotice);
    }

    // Распределяем категории по колонкам:
    // Левая:  Оптимизация, Графика
    // Правая: Поиск модов, Интерфейс, Камера, Строительство, Остальное
    sortedCats.forEach(catName => {
        const categoryMods = groupsMap[catName];
        if (categoryMods.length === 0) return;

        const categoryCard = document.createElement('div');
        categoryCard.className = 'settings-category';

        const iconId = getCategoryIconId(catName);
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
            <svg class="category-icon"><use href="${iconId}"/></svg>
            <h4>${catName.toUpperCase()}</h4>
        `;
        categoryCard.appendChild(header);

        const content = document.createElement('div');
        content.className = 'category-content';

        const processedIds = new Set();

        function createModRow(mod, isAddon = false) {
            const itemLabel = document.createElement('label');
            itemLabel.className = `setting-item setting-item-toggle ${isAddon ? 'mod-addon-item' : 'mod-parent-item'}`;
            itemLabel.dataset.id = mod.id;

            const iconSvg = getModItemSVG(mod.icon);
            const paths = escapeHtml(mod.paths.join('|'));
            const addonBadge = isAddon ? `<span class="addon-badge">Аддон</span>` : '';

            itemLabel.innerHTML = `
                <div class="setting-label">
                    ${iconSvg}
                    <div class="setting-text">
                        <span class="setting-title">${escapeHtml(mod.shortName)} <span style="font-size: 11px; color: #888; font-family: monospace;">v${escapeHtml(mod.version)}</span>${addonBadge}</span>
                        <span class="setting-desc">${escapeHtml(mod.description)}</span>
                    </div>
                </div>
                <div class="setting-control">
                    <span class="toggle-switch">
                        <input type="checkbox" data-paths="${paths}" data-id="${mod.id}" ${mod.checked ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </span>
                </div>
            `;

            const checkbox = itemLabel.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                toggleModState(mod.id, e.target.checked);
            });

            return itemLabel;
        }

        function renderModTree(mod) {
            if (processedIds.has(mod.id)) return;
            processedIds.add(mod.id);

            const parentRow = createModRow(mod, false);
            content.appendChild(parentRow);

            const children = categoryMods.filter(c => c.dependsOn === mod.id);
            if (children.length > 0) {
                const addonsContainer = document.createElement('div');
                addonsContainer.className = `mod-addons-container ${!mod.checked ? 'parent-disabled' : ''}`;
                addonsContainer.dataset.parentId = mod.id;

                const addonsHeader = document.createElement('div');
                addonsHeader.className = 'mod-addons-header';
                addonsHeader.innerHTML = `
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                    <span>АДДОНЫ И МОДУЛИ ДЛЯ ${escapeHtml(mod.shortName).toUpperCase()}</span>
                `;
                addonsContainer.appendChild(addonsHeader);

                children.forEach(child => {
                    processedIds.add(child.id);
                    const childRow = createModRow(child, true);
                    addonsContainer.appendChild(childRow);
                });

                content.appendChild(addonsContainer);
            }
        }

        categoryMods.forEach(mod => {
            if (processedIds.has(mod.id)) return;

            if (mod.dependsOn) {
                const parent = categoryMods.find(p => p.id === mod.dependsOn);
                if (parent && !processedIds.has(parent.id)) {
                    renderModTree(parent);
                    return;
                }
            }

            renderModTree(mod);
        });

        categoryCard.appendChild(content);

        const upperCat = catName.toUpperCase();
        const leftCategories = new Set([
            'ОПТИМИЗАЦИЯ',
            'ГРАФИКА',
            'КАМЕРА И УПРАВЛЕНИЕ',
            'КАМЕРА',
            'СТРОИТЕЛЬСТВО'
        ]);
        if (leftCategories.has(upperCat)) {
            colLeft.appendChild(categoryCard);
        } else {
            colRight.appendChild(categoryCard);
        }
    });

    const topSection = document.createElement('div');
    topSection.className = 'mods-top-section';
    topSection.style.cssText = 'display: flex; gap: 14px; width: 100%; grid-column: 1 / -1;';
    topSection.appendChild(colLeft);
    topSection.appendChild(colRight);
    fragment.appendChild(topSection);

    // 3. НИЖНЯЯ КАРТОЧКА ПОЛНОГО СПИСКА (Full Width Span 2 Columns)
    if (cachedManifest && cachedManifest.files) {
        const fullListCard = document.createElement('div');
        fullListCard.className = 'settings-category full-mods-list-card';
        fullListCard.style.gridColumn = '1 / -1';
        fullListCard.innerHTML = `
            <div class="category-header">
                <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                </svg>
                <h4>ВСЕ МОДЫ И ФАЙЛЫ В СБОРКЕ (ПОЛНЫЙ СПИСОК & ССЫЛКИ)</h4>
            </div>
            <div class="category-content catalog-items-content"></div>
        `;

        const catalogContent = fullListCard.querySelector('.category-content');

        // Делегирование ссылок Modrinth
        catalogContent.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-url]');
            if (!btn) return;
            const url = btn.dataset.url;
            if (url && window.api?.openUrl) {
                window.api.openUrl(url);
            } else if (url) {
                window.open(url, '_blank');
            }
        });

        renderLinksCatalogIntoContainer(cachedManifest, catalogContent, query);
        fragment.appendChild(fullListCard);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);

    setupSearchCardEvents();
}

function setupSearchCardEvents() {
    const searchInput = document.getElementById('mods-search-input');
    const clearBtn = document.getElementById('mods-search-clear-btn');

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderModsGrid();
            const newSearchInput = document.getElementById('mods-search-input');
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
            }
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            searchQuery = '';
            renderModsGrid();
            const newSearchInput = document.getElementById('mods-search-input');
            if (newSearchInput) {
                newSearchInput.focus();
            }
        };
    }
}

let cachedCatalogData = null;
let lastCatalogManifest = null;
let currentRenderedIndex = 0;
let filteredCatalogItems = [];
const BATCH_SIZE = 25;

let isModrinthResolving = false;
let resolvedModrinthUrls = {};

async function resolveModrinthProjectUrlsAsync(hashes) {
    if (!hashes || hashes.length === 0) return;

    try {
        const data = await window.api.resolveModrinth(hashes);
        if (!data || Object.keys(data).length === 0) return;

        let hasUpdates = false;
        for (const [hash, info] of Object.entries(data)) {
            if (info && info.projectId) {
                resolvedModrinthUrls[hash.toLowerCase()] = `https://modrinth.com/mod/${info.projectId}`;
                hasUpdates = true;
            }
        }

        if (hasUpdates && cachedCatalogData) {
            cachedCatalogData.forEach(item => {
                if (item.hash && resolvedModrinthUrls[item.hash] && !item.hasFixedModrinthUrl) {
                    item.modrinthUrl = resolvedModrinthUrls[item.hash];
                    item.hasFixedModrinthUrl = true;

                    // Update live DOM button without re-rendering everything
                    const btn = document.querySelector(`button[data-hash="${item.hash}"]`);
                    if (btn) {
                        btn.dataset.url = item.modrinthUrl;
                    }
                }
            });
        }
    } catch (err) {
        console.warn('[Modrinth UI] IPC resolve error:', err);
    }
}

function appendCatalogBatch(contentContainer) {
    if (currentRenderedIndex >= filteredCatalogItems.length) return;

    const nextIndex = Math.min(currentRenderedIndex + BATCH_SIZE, filteredCatalogItems.length);
    const fragment = document.createDocumentFragment();

    for (let i = currentRenderedIndex; i < nextIndex; i++) {
        const item = filteredCatalogItems[i];
        const row = document.createElement('div');
        row.className = 'setting-item manifest-catalog-row';
        row.innerHTML = `
            <div class="setting-label">
                <svg class="setting-icon"><use href="#icon-game"/></svg>
                <div class="setting-text">
                    <span class="setting-title">${escapeHtml(item.cleanName)} <span style="font-size: 11px; color: ${item.isOptional ? '#81c784' : '#64b5f6'};">(${item.isOptional ? 'Опциональный' : 'Базовый'})</span></span>
                    <span class="setting-desc" style="font-family: monospace;">${escapeHtml(item.fileName)}</span>
                </div>
            </div>
            <div class="setting-control">
                <button type="button" class="unified-btn unified-btn-primary" data-url="${escapeHtml(item.modrinthUrl)}" ${item.hash ? `data-hash="${escapeHtml(item.hash)}"` : ''}>⚡ Modrinth ↗</button>
            </div>
        `;
        fragment.appendChild(row);
    }

    currentRenderedIndex = nextIndex;
    contentContainer.appendChild(fragment);

    if (currentRenderedIndex < filteredCatalogItems.length) {
        requestAnimationFrame(() => {
            appendCatalogBatch(contentContainer);
        });
    }
}

function renderLinksCatalogIntoContainer(manifest, contentContainer, query = '') {
    if (!manifest || !manifest.files || !contentContainer) return;

    if (!cachedCatalogData || lastCatalogManifest !== manifest) {
        lastCatalogManifest = manifest;
        const jarFiles = (Array.isArray(manifest.files) ? manifest.files : []).filter(f => {
            const filePath = normalizeManifestPath(f?.path).toLowerCase();
            return (
                (filePath.startsWith('mods/') || filePath.startsWith('client_mods/')) && /\.(jar|zip)$/.test(filePath)
            ) || (
                    filePath.startsWith('resourcepacks/') && /\.(zip|mcpack)$/.test(filePath)
                ) || (
                    filePath.startsWith('shaderpacks/') && /\.(zip|jar)$/.test(filePath)
                );
        });

        cachedCatalogData = jarFiles.map(file => {
            const fileName = getModFileName(file.path);
            const fileKind = getManifestFileKind(file);
            let cleanName = fileName
                .replace(/\.jar$/i, '')
                .replace(/^client[-_]/i, '')
                .replace(/[-_](neoforge|forge|fabric|mc|\d+\.\d+).*/i, '')
                .replace(/[-_]\d+.*$/i, '');
            cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

            const groupMatch = fileKind === 'mod' && normalizeManifestPath(file.path).toLowerCase().startsWith('mods/')
                ? MOD_GROUPS.find(g =>
                    g.files && g.files.some(p => fileName.toLowerCase().includes(p.toLowerCase()))
                )
                : null;

            const downloadUrl = file.url || `${FILES_BASE}/${normalizeManifestPath(file.path)}`;

            const modrinthUrl = groupMatch?.modrinthSlug
                ? `https://modrinth.com/mod/${groupMatch.modrinthSlug}`
                : `https://modrinth.com/mods?q=${encodeURIComponent(groupMatch ? groupMatch.name : cleanName)}`;

            return {
                fileName,
                cleanName: groupMatch ? groupMatch.name : cleanName,
                kind: fileKind,
                isOptional: !!file.optional,
                downloadUrl,
                modrinthUrl: (file.hash && resolvedModrinthUrls[file.hash.toLowerCase()])
                    ? resolvedModrinthUrls[file.hash.toLowerCase()]
                    : modrinthUrl,
                hash: file.hash ? file.hash.toLowerCase() : null,
                hasFixedModrinthUrl: !!groupMatch?.modrinthSlug || !!(file.hash && resolvedModrinthUrls[file.hash.toLowerCase()])
            };
        });

        // Trigger async resolving for any hashes that don't have a fixed URL yet
        if (!isModrinthResolving) {
            isModrinthResolving = true;
            const hashesToResolve = cachedCatalogData
                .filter(item => item.hash && !item.hasFixedModrinthUrl)
                .map(item => item.hash);

            if (hashesToResolve.length > 0) {
                resolveModrinthProjectUrlsAsync(hashesToResolve);
            }
        }
    }

    filteredCatalogItems = cachedCatalogData.filter(item => {
        if (!query) return true;
        return item.cleanName.toLowerCase().includes(query) || item.fileName.toLowerCase().includes(query);
    });

    if (filteredCatalogItems.length === 0) {
        contentContainer.innerHTML = `<div class="unified-empty"><div class="unified-empty-text">${query ? `По запросу «${escapeHtml(query)}» файлы не найдены` : 'В манифесте нет дополнительных файлов'}</div></div>`;
        return;
    }

    contentContainer.innerHTML = '';
    currentRenderedIndex = 0;
    appendCatalogBatch(contentContainer);
}

export function renderLinksCatalog(manifest) {
    if (manifest) cachedManifest = manifest;
    renderModsGrid();
}

/**
 * Получить список отключённых модов
 */
export function getDisabledMods() {
    const disabled = [];
    allGroupItems.forEach(item => {
        if (!item.checked) {
            item.paths.forEach(p => disabled.push(p));
        }
    });
    return disabled;
}

/**
 * Включить или отключить все моды
 */
export function setAllModsState(isChecked) {
    allGroupItems.forEach(item => {
        item.checked = isChecked;
    });
    const grid = dom.get('mods-grid');
    if (grid) {
        grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = isChecked;
        });
        updateActiveCounterDisplay();
    }
}

export function updateModsCounter() { }
export function updateCategorySidebar() { }
export function updateSidebarStats() { }

export function initModsListeners(onChangeCallback) {
    const grid = dom.get('mods-grid');
    if (!grid) return;

    grid.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            if (onChangeCallback) onChangeCallback();
        }
    });
}
