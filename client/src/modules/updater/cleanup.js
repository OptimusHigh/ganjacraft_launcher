/**
 * Ganj4Craft Launcher - Cleanup Module
 * Унифицированные функции очистки устаревших файлов
 * 
 * Правила очистки соответствуют правилам генерации манифеста на сервере:
 * - mods: только .jar в корне, исключая server-*
 * - kubejs: только client_scripts, startup_scripts, assets
 * - fancymenu_data: сервер-контролируемый UI
 * - resourcepacks: только [GanjaCraft]* паки
 * - thingpacks: полностью управляется сервером
 */

const fs = require('fs');
const path = require('path');
const { isModDisabled } = require('./utils');

/**
 * Рекурсивная очистка директории от файлов, отсутствующих в manifest
 * @param {string} dir - Абсолютный путь к директории
 * @param {string} relBase - Относительный путь для сравнения с manifest
 * @param {Set<string>} manifestPaths - Set нормализованных путей из манифеста
 * @param {function} sendLog - Функция логирования
 * @returns {number} - Количество удалённых файлов
 */
function cleanDirectory(dir, relBase, manifestPaths, sendLog = () => {}) {
    if (!fs.existsSync(dir)) return 0;
    
    let deleted = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relBase, entry.name);
        const normalizedPath = path.normalize(relPath);

        if (entry.isDirectory()) {
            // Recurse into subdirectory
            deleted += cleanDirectory(fullPath, relPath, manifestPaths, sendLog);
            
            // Remove empty directories
            try {
                const remaining = fs.readdirSync(fullPath);
                if (remaining.length === 0) {
                    fs.rmdirSync(fullPath);
                }
            } catch (e) { /* ignore */ }
        } else {
            // Check if file is in manifest
            if (!manifestPaths.has(normalizedPath)) {
                sendLog(`Удаление устаревшего: ${relPath}`);
                try {
                    fs.unlinkSync(fullPath);
                    deleted++;
                } catch (e) {
                    sendLog(`Не удалось удалить ${relPath}: ${e.message}`);
                }
            }
        }
    }
    
    return deleted;
}

/**
 * Очистка папки mods от файлов, отсутствующих в манифесте
 * Только файлы в корне mods/, без рекурсии (как в генераторе манифеста)
 * @param {string} rootPath - Корневая директория игры
 * @param {object} manifest - Parsed manifest.json
 * @param {string[]} disabledMods - Список отключённых модов
 * @param {function} sendLog - Функция логирования
 */
function cleanupMods(rootPath, manifest, disabledMods = [], sendLog = () => {}) {
    const modsDir = path.join(rootPath, 'mods');
    if (!fs.existsSync(modsDir)) return;

    // Собираем Set путей модов из манифеста (исключая отключённые)
    const manifestMods = new Set(
        manifest.files
            .filter(f => f.path.startsWith('mods/') && !isModDisabled(f.path, disabledMods))
            .map(f => path.normalize(f.path))
    );

    cleanDirectory(modsDir, 'mods', manifestMods, sendLog);
}

/**
 * Очистка KubeJS скриптов
 * Чистим только синхронизируемые папки: client_scripts, startup_scripts, assets
 * server_scripts НЕ трогаем — они для админов
 */
function cleanupKubejs(rootPath, manifest, sendLog = () => {}) {
    const kubejsDir = path.join(rootPath, 'kubejs');
    const syncedFolders = ['client_scripts', 'startup_scripts', 'assets'];
    
    if (!fs.existsSync(kubejsDir)) return;

    // Собираем Set путей kubejs из манифеста
    const manifestKubejs = new Set(
        manifest.files
            .filter(f => f.path.startsWith('kubejs/'))
            .map(f => path.normalize(f.path))
    );

    // Чистим только синхронизируемые папки
    for (const folder of syncedFolders) {
        const folderPath = path.join(kubejsDir, folder);
        if (fs.existsSync(folderPath)) {
            cleanDirectory(folderPath, path.join('kubejs', folder), manifestKubejs, sendLog);
        }
    }
}

/**
 * Очистка thingpacks (JsonThings custom content)
 * Удаляем папки thingpacks, которых нет в манифесте
 */
function cleanupThingpacks(rootPath, manifest, sendLog = () => {}) {
    const thingpacksDir = path.join(rootPath, 'thingpacks');
    if (!fs.existsSync(thingpacksDir)) return;

    // Собираем Set имён thingpacks из манифеста
    const manifestThingpacks = new Set(
        manifest.files
            .filter(f => f.path.startsWith('thingpacks/'))
            .map(f => f.path.split('/')[1]) // Имя папки thingpack
    );

    const localPacks = fs.readdirSync(thingpacksDir);
    
    for (const pack of localPacks) {
        const fullPath = path.join(thingpacksDir, pack);
        
        try {
            if (!fs.statSync(fullPath).isDirectory()) continue;
        } catch (e) { continue; }

        if (!manifestThingpacks.has(pack)) {
            sendLog(`Удаление старого thingpack: ${pack}`);
            try {
                fs.rmSync(fullPath, { recursive: true, force: true });
            } catch (e) {
                sendLog(`Не удалось удалить thingpack ${pack}: ${e.message}`);
            }
        }
    }
}

/**
 * Очистка resourcepacks
 * Удаляем ТОЛЬКО серверные паки [GanjaCraft]*, пользовательские не трогаем
 */
function cleanupResourcepacks(rootPath, manifest, sendLog = () => {}) {
    const resourcepacksDir = path.join(rootPath, 'resourcepacks');
    if (!fs.existsSync(resourcepacksDir)) return;

    // Собираем Set имён серверных ресурспаков
    const manifestPacks = new Set(
        manifest.files
            .filter(f => f.path.startsWith('resourcepacks/') && f.path.includes('[GanjaCraft]'))
            .map(f => f.path.split('/')[1] || '')
            .filter(name => name.startsWith('[GanjaCraft]'))
    );

    const localPacks = fs.readdirSync(resourcepacksDir);
    
    for (const pack of localPacks) {
        // Только серверные паки
        if (!pack.startsWith('[GanjaCraft]')) continue;

        const fullPath = path.join(resourcepacksDir, pack);

        if (!manifestPacks.has(pack)) {
            sendLog(`Удаление устаревшего ресурспака: ${pack}`);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(fullPath);
                }
            } catch (e) {
                sendLog(`Не удалось удалить ${pack}: ${e.message}`);
            }
        }
    }
}

/**
 * Очистка FancyMenu данных (сервер-контролируемый UI)
 */
function cleanupFancymenu(rootPath, manifest, sendLog = () => {}) {
    const fancymenuDir = path.join(rootPath, 'fancymenu_data');
    if (!fs.existsSync(fancymenuDir)) return;

    const manifestFancymenu = new Set(
        manifest.files
            .filter(f => f.path.startsWith('fancymenu_data/'))
            .map(f => path.normalize(f.path))
    );

    cleanDirectory(fancymenuDir, 'fancymenu_data', manifestFancymenu, sendLog);
}

/**
 * Очистка клиентских настроек
 */
function cleanupClientConfig(rootPath, manifest, sendLog = () => {}) {
    const clientConfigDir = path.join(rootPath, 'client_config');
    if (!fs.existsSync(clientConfigDir)) return;

    const manifestClientConfig = new Set(
        manifest.files
            .filter(f => f.path.startsWith('client_config/'))
            .map(f => path.normalize(f.path))
    );

    cleanDirectory(clientConfigDir, 'client_config', manifestClientConfig, sendLog);
}

/**
 * Выполнить полную очистку всех категорий
 */
function cleanupAll(rootPath, manifest, disabledMods = [], sendLog = () => {}) {
    cleanupMods(rootPath, manifest, disabledMods, sendLog);
    cleanupKubejs(rootPath, manifest, sendLog);
    cleanupThingpacks(rootPath, manifest, sendLog);
    cleanupResourcepacks(rootPath, manifest, sendLog);
    cleanupFancymenu(rootPath, manifest, sendLog);
    cleanupClientConfig(rootPath, manifest, sendLog);
}

module.exports = {
    cleanDirectory,
    cleanupMods,
    cleanupKubejs,
    cleanupThingpacks,
    cleanupResourcepacks,
    cleanupFancymenu,
    cleanupClientConfig,
    cleanupAll
};
