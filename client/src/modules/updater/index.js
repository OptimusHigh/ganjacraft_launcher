/**
 * Ganj4Craft Launcher - Updater Module
 * Главный файл модуля обновления
 * 
 * Экспортирует все функции для обратной совместимости
 * с существующим кодом лаунчера
 */

// Утилиты
const { getFileHash, resolveUnderRoot, safeUnlink, ensureDir, getTempPath, getModStem, isModDisabled } = require('./utils');

// Загрузка файлов
const { downloadFile, downloadWithRetry } = require('./download');

// Синхронизация
const { syncFiles, isServerControlled, isUserProtected, FILE_CATEGORIES } = require('./sync');

// Очистка
const { 
    cleanDirectory,
    cleanupMods,
    cleanupKubejs,
    cleanupThingpacks,
    cleanupResourcepacks,
    cleanupFancymenu,
    cleanupClientConfig,
    cleanupAll
} = require('./cleanup');

// Админские инструменты
const { syncCategory, deleteCategory, getCategoryCounts, fetchServerScripts } = require('./admin');



// Обратная совместимость: экспортируем то же API что и раньше
module.exports = {
    // Основные функции (были в оригинальном updater.js)
    downloadFile,
    downloadWithRetry,
    getFileHash,
    syncFiles,
    syncCategory,
    deleteCategory,
    getCategoryCounts,
    fetchServerScripts,
    
    // Новые функции
    resolveUnderRoot,
    safeUnlink,
    ensureDir,
    getTempPath,
    getModStem,
    isModDisabled,
    isServerControlled,
    isUserProtected,
    FILE_CATEGORIES,
    
    // Cleanup функции
    cleanDirectory,
    cleanupMods,
    cleanupKubejs,
    cleanupThingpacks,
    cleanupResourcepacks,
    cleanupFancymenu,
    cleanupClientConfig,
    cleanupAll
};
