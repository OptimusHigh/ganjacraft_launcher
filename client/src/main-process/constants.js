/**
 * Ganj4Craft Launcher - Main Process Constants
 * Все константы для main process
 */

// Legacy NeoForge constants kept for compatibility with existing helpers.
const NEOFORGE_VERSION = '21.1.247';
const MC_VERSION = '1.21.1';
const REQUIRED_JAVA_MAJOR = 21;

// Client build profiles. Each profile is isolated by manifest, history and game directory.
const BUILD_PROFILES = {
    vanilla: {
        id: 'vanilla',
        name: 'GanjaCraft Vanilla',
        shortName: 'VANILLA',
        loader: 'fabric',
        minecraftVersion: '26.3',
        fabricLoaderVersion: '0.20.1',
        javaMajor: 25,
        manifestPath: 'vanilla/manifest.json',
        historyPath: 'vanilla/manifest_history.json',
        serverHost: 'vocalize-cove.gl.joinmc.link',
        serverPort: 25565,
        directoryName: 'vanilla',
        discord: {
            serverName: 'Vanilla',
            details: 'Играет на сервере Vanilla',
            largeImage: 'https://launcher.ganj4craft.ru/files/icons/grass_block.png',
            largeText: 'GanjaCraft Vanilla (Fabric 26.3)',
            smallImage: 'mclogonew',
            smallText: 'Minecraft 26.3 • Fabric'
        }
    },
    ganj4craft5: {
        id: 'ganj4craft5',
        name: 'ThaumParty',
        shortName: 'ThaumParty',
        loader: 'neoforge',
        minecraftVersion: '26.1.2',
        neoforgeVersion: '26.1.2.126',
        javaMajor: 25,
        manifestPath: 'ganj4craft5/manifest.json',
        historyPath: 'ganj4craft5/manifest_history.json',
        serverHost: 'vocalize-cove.gl.joinmc.link',
        serverPort: 25578,
        directoryName: 'ganj4craft5',
        discord: {
            serverName: 'ThaumParty',
            details: 'Играет на сервере ThaumParty',
            largeImage: 'https://launcher.ganj4craft.ru/files/icons/thaumonomicon.png',
            largeText: 'ThaumParty (NeoForge 26.1.2)',
            smallImage: 'mclogonew',
            smallText: 'Minecraft 26.1.2 • NeoForge'
        }
    },
};

function getBuildProfile(profileId) {
    if (profileId === 'minecraft-vanilla') return BUILD_PROFILES.vanilla;
    return BUILD_PROFILES[profileId] || BUILD_PROFILES.ganj4craft5;
}

const path = require('path');
const fs = require('fs');

let CLIENT_VERSION = '1.0.0';
try {
    const pkgPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg && pkg.version) CLIENT_VERSION = pkg.version;
    }
} catch (e) {
    // fallback
}

// URLs
const API_BASES = [
    'https://launcher.ganj4craft.ru/api',
];
const BASE_URL = 'https://launcher.ganj4craft.ru';
const SITE_URL = 'https://ganj4craft.ru';

// Discord Rich Presence Application ID
const DISCORD_CLIENT_ID = '1407381680871833662';


const MIRROR_BASE = `${BASE_URL}/mirror`;
const FILES_BASE = `${BASE_URL}/files`;
const API_BASE = `${BASE_URL}/api`;

const MANIFEST_URL = `${FILES_BASE}/vanilla/manifest.json`;
const MANIFEST_HISTORY_URL = `${FILES_BASE}/vanilla/manifest_history.json`;
const NEOFORGE_INSTALLER_URL = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${NEOFORGE_VERSION}/neoforge-${NEOFORGE_VERSION}-installer.jar`;
function getNeoForgeInstallerUrl(version = NEOFORGE_VERSION) {
    return `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
}
const AUTHLIB_INJECTOR_VERSION = '1.2.8';
const AUTHLIB_INJECTOR_URL = `https://github.com/yushijinhun/authlib-injector/releases/download/v${AUTHLIB_INJECTOR_VERSION}/authlib-injector-${AUTHLIB_INJECTOR_VERSION}.jar`;
const YGGDRASIL_AUTH_URL = `${API_BASE}/yggdrasil/authserver/authenticate`;

const VANILLA_VERSION_JSON_URL = `https://piston-meta.mojang.com/v1/packages/67e466e82c012158c8cda81df39aa40a7ade7276/1.21.1.json`;
const VANILLA_VERSION_JAR_URL = `https://piston-data.mojang.com/v1/objects/30c73b1c5da787909b2f73340419fdf13b9def88/client.jar`;



// Repair URLs for critical files
const REPAIR_FILES = {
    'authlib-injector.jar': AUTHLIB_INJECTOR_URL,
    'neoforge-installer.jar': NEOFORGE_INSTALLER_URL,
    'vanilla-client.jar': VANILLA_VERSION_JAR_URL,
};

// URL fallbacks for mirroring - if official repos fail, try VPS mirror (https://launcher.ganj4craft.ru/mirror)
const MIRROR_FALLBACKS = [
    { from: 'https://libraries.minecraft.net/', to: `${MIRROR_BASE}/libraries/` },
    { from: 'https://maven.neoforged.net/releases/', to: `${MIRROR_BASE}/maven/` },
    { from: 'https://maven.minecraftforge.net/', to: `${MIRROR_BASE}/maven/` },
    { from: 'https://piston-meta.mojang.com/', to: `${MIRROR_BASE}/piston-meta/` },
    { from: 'https://piston-data.mojang.com/', to: `${MIRROR_BASE}/piston-data/` },
    { from: 'https://resources.download.minecraft.net/', to: `${MIRROR_BASE}/assets/` },
    { from: 'https://github.com/', to: `${MIRROR_BASE}/github/` },
    { from: 'https://raw.githubusercontent.com/', to: `${MIRROR_BASE}/github-raw/` },
];

/**
 * Получить резервный URL зеркала (fallback)
 * @param {string} url - Исходный URL
 * @returns {string|null} - URL зеркала или null, если правило не найдено
 */
function getMirrorFallbackUrl(url) {
    if (!url || typeof url !== 'string') return null;
    for (const rule of MIRROR_FALLBACKS) {
        if (url.startsWith(rule.from)) {
            return rule.to + url.slice(rule.from.length);
        }
    }
    return null;
}


// Default disabled optional mods (filename patterns)
const DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS = [
    // Forgematica & Litematica & Printer (schematics)
    'client-forgematica',
    'client-Forgematica',
    'forgematica',
    'Forgematica',
    'litematica',
    'Litematica',
    'client-neoforgematicaprinter',
    'client-NeoForgematicaPrinter',
    'printer',
    'Printer',

    // Better Advancements
    'client-betteradvancements',
    'client-BetterAdvancements',
    'betteradvancements',
    'BetterAdvancements',

    // Better Third Person
    'client-betterthirdperson',
    'client-BetterThirdPerson',
    'betterthirdperson',
    'BetterThirdPerson',
    'client-leawind_third_person',
    'leawind_third_person',

    // First Person Model
    'client-firstperson',
    'client-FirstPerson',
    'firstperson',
    'FirstPerson',

    // Freecam & X-Ray (disabled by default)
    'freecam',
    'Freecam',
    'advanced-xray',
    'xray'
];

// JVM optimization arguments
const JVM_OPTIMIZATION_ARGS = [
    '-Xss4m',
    '-Dneoforge.readTimeout=600',
    '-Dforge.readTimeout=600',
    '-Dfml.readTimeout=600',
    '-Dfml.loginTimeout=600',
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    '-XX:G1NewSizePercent=30',
    '-XX:G1MaxNewSizePercent=40',
    '-XX:G1HeapRegionSize=8M',
    '-XX:G1ReservePercent=20',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1'
];

module.exports = {
    // Build profiles
    BUILD_PROFILES,
    getBuildProfile,

    // Versions
    CLIENT_VERSION,
    NEOFORGE_VERSION,
    MC_VERSION,
    REQUIRED_JAVA_MAJOR,

    // URLs
    BASE_URL,
    FILES_BASE,
    SITE_URL,
    API_BASE,
    DISCORD_CLIENT_ID,
    MANIFEST_URL,
    MANIFEST_HISTORY_URL,
    getNeoForgeInstallerUrl,
    NEOFORGE_INSTALLER_URL,
    AUTHLIB_INJECTOR_VERSION,
    AUTHLIB_INJECTOR_URL,
    YGGDRASIL_AUTH_URL,
    VANILLA_VERSION_JSON_URL,
    VANILLA_VERSION_JAR_URL,


    // Configs
    REPAIR_FILES,
    MIRROR_FALLBACKS,
    getMirrorFallbackUrl,
    DEFAULT_DISABLED_OPTIONAL_MOD_PATTERNS,
    JVM_OPTIMIZATION_ARGS,
};
