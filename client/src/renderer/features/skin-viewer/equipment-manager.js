/**
 * Ganj4Craft Launcher - 3D Character Equipment & Wardrobe Engine
 * Полнофункциональный менеджер 3D экипировки персонажа:
 * 1. Bedrock .geo.json 3D модели оружия TACZ (АК-47, Kriss Vector, Glock 17, RPG-7, Minigun)
 * 2. 3D Ванильная броня Minecraft (Алмазный и Незеритовый сеты layer_1 и layer_2)
 * 3. Тактические позы удержания оружия перед собой
 */

import * as THREE from 'three';
import { taczGeoLoader } from './tacz-geo-loader.js';
import { armorMeshBuilder } from './armor-mesh-builder.js';
import { voxelItemBuilder } from './voxel-item-builder.js';

const STORAGE_KEY_EQUIPMENT = 'ganjacraft_player_equipment_v1';

// ── Каталог экипировки (Ванильная броня + Оружие TACZ) ──
export const EQUIPMENT_CATALOG = {
    // 🪖 ШЛЕМЫ / ГОЛОВА
    head: {
        none: { id: 'none', name: 'Без шлема', icon: '👤', rarity: 'common' },
        netherite_helmet: {
            id: 'netherite_helmet',
            name: 'Незеритовый шлем',
            icon: 'assets/equipment/items/netherite_helmet.png',
            isImage: true,
            rarity: 'epic',
            armorTex: 'assets/equipment/armor/netherite_layer_1.png'
        },
        diamond_helmet: {
            id: 'diamond_helmet',
            name: 'Алмазный шлем',
            icon: 'assets/equipment/items/diamond_helmet.png',
            isImage: true,
            rarity: 'rare',
            armorTex: 'assets/equipment/armor/diamond_layer_1.png'
        }
    },

    // 🎽 НАГРУДНИК / ТЕЛО
    chest: {
        none: { id: 'none', name: 'Без брони', icon: '👕', rarity: 'common' },
        netherite_chestplate: {
            id: 'netherite_chestplate',
            name: 'Незеритовый нагрудник',
            icon: 'assets/equipment/items/netherite_chestplate.png',
            isImage: true,
            rarity: 'epic',
            armorTex: 'assets/equipment/armor/netherite_layer_1.png'
        },
        diamond_chestplate: {
            id: 'diamond_chestplate',
            name: 'Алмазный нагрудник',
            icon: 'assets/equipment/items/diamond_chestplate.png',
            isImage: true,
            rarity: 'rare',
            armorTex: 'assets/equipment/armor/diamond_layer_1.png'
        }
    },

    // 👖 ПОНОЖИ / НОГИ
    legs: {
        none: { id: 'none', name: 'Без поножей', icon: '🩳', rarity: 'common' },
        netherite_leggings: {
            id: 'netherite_leggings',
            name: 'Незеритовые поножи',
            icon: 'assets/equipment/items/netherite_leggings.png',
            isImage: true,
            rarity: 'epic',
            armorLegsTex: 'assets/equipment/armor/netherite_layer_2.png'
        },
        diamond_leggings: {
            id: 'diamond_leggings',
            name: 'Алмазные поножи',
            icon: 'assets/equipment/items/diamond_leggings.png',
            isImage: true,
            rarity: 'rare',
            armorLegsTex: 'assets/equipment/armor/diamond_layer_2.png'
        }
    },

    // 👢 БОТИНКИ / СТУПНИ
    boots: {
        none: { id: 'none', name: 'Без ботинок', icon: '🧦', rarity: 'common' },
        netherite_boots: {
            id: 'netherite_boots',
            name: 'Незеритовые ботинки',
            icon: 'assets/equipment/items/netherite_boots.png',
            isImage: true,
            rarity: 'epic',
            armorTex: 'assets/equipment/armor/netherite_layer_1.png'
        },
        diamond_boots: {
            id: 'diamond_boots',
            name: 'Алмазные ботинки',
            icon: 'assets/equipment/items/diamond_boots.png',
            isImage: true,
            rarity: 'rare',
            armorTex: 'assets/equipment/armor/diamond_layer_1.png'
        }
    },

    // ⚔️ ОСНОВНАЯ РУКА (предметы сборки и TACZ 3D арсенал)
    mainHand: {
        none: { id: 'none', name: 'Пустая рука', icon: '✊', rarity: 'common' },
        vanilla_diamond_sword: { id: 'vanilla_diamond_sword', name: 'Алмазный меч', icon: 'assets/equipment/items/diamond_sword.png', isImage: true, rarity: 'rare', type: 'voxel_item', itemTex: 'assets/equipment/items/diamond_sword.png' },
        vanilla_diamond_pickaxe: { id: 'vanilla_diamond_pickaxe', name: 'Алмазная кирка', icon: 'assets/equipment/items/diamond_pickaxe.png', isImage: true, rarity: 'rare', type: 'voxel_item', itemTex: 'assets/equipment/items/diamond_pickaxe.png' },
        ganj4craft5_wand: { id: 'ganj4craft5_wand', name: 'Тауматургическая палочка', icon: 'assets/equipment/items/tf_twilight_scepter.png', isImage: true, rarity: 'mythic', type: 'voxel_item', itemTex: 'assets/equipment/items/tf_twilight_scepter.png' },
        tacz_deagle: { id: 'tacz_deagle', name: 'Desert Eagle .50', mod: 'TACZ', icon: 'assets/tacz/hud/deagle.png', isImage: true, rarity: 'epic', type: 'tacz_geo', geoGunId: 'deagle' },
        tacz_spas_12: { id: 'tacz_spas_12', name: 'SPAS-12', mod: 'TACZ', icon: 'assets/tacz/hud/spas_12.png', isImage: true, rarity: 'rare', type: 'tacz_geo', geoGunId: 'spas_12' },
        tacz_ak47: { id: 'tacz_ak47', name: 'АК-47', mod: 'TACZ', icon: 'assets/tacz/hud/ak47.png', isImage: true, rarity: 'epic', type: 'tacz_geo', geoGunId: 'ak47' },
        tacz_vector45: { id: 'tacz_vector45', name: 'Kriss Vector .45', mod: 'TACZ', icon: 'assets/tacz/hud/vector45.png', isImage: true, rarity: 'legendary', type: 'tacz_geo', geoGunId: 'vector45' },
        tacz_awp: { id: 'tacz_awp', name: 'AWP Sniper', mod: 'TACZ', icon: 'assets/tacz/hud/ai_awp.png', isImage: true, rarity: 'legendary', type: 'tacz_geo', geoGunId: 'ai_awp' },
        tacz_glock17: { id: 'tacz_glock17', name: 'Glock 17', mod: 'TACZ', icon: 'assets/tacz/hud/glock_17.png', isImage: true, rarity: 'common', type: 'tacz_geo', geoGunId: 'glock_17' },
        tacz_rpg7: { id: 'tacz_rpg7', name: 'РПГ-7', mod: 'TACZ', icon: 'assets/tacz/hud/rpg7.png', isImage: true, rarity: 'mythic', type: 'tacz_geo', geoGunId: 'rpg7' },
        tacz_minigun: { id: 'tacz_minigun', name: 'Миниган M134', mod: 'TACZ', icon: 'assets/tacz/hud/minigun.png', isImage: true, rarity: 'mythic', type: 'tacz_geo', geoGunId: 'minigun' }
    },

    // 🔮 ВТОРАЯ РУКА (Пусто)
    offHand: {
        none: { id: 'none', name: 'Пусто', icon: '✋', rarity: 'common' }
    },

    // 🎒 СПИНА (Пусто)
    back: {
        none: { id: 'none', name: 'Пусто', icon: '🚫', rarity: 'common' }
    }
};

// ── Быстрые наборы (Пресеты) ──
export const EQUIPMENT_PRESETS = {
    random: {
        id: 'random',
        name: '🎲 Случайный Лут',
        icon: '🎲',
        desc: 'Случайная комбинация оружия TACZ и ванильной брони',
        slots: {}
    },
    tacz_specops: {
        id: 'tacz_specops',
        name: 'Штурмовик АК-47',
        icon: '🔫',
        desc: 'Незеритовая броня и автомат АК-47',
        slots: {
            head: 'netherite_helmet',
            chest: 'netherite_chestplate',
            legs: 'netherite_leggings',
            boots: 'netherite_boots',
            mainHand: 'tacz_ak47',
            offHand: 'none',
            back: 'none'
        }
    },
    tacz_vector: {
        id: 'tacz_vector',
        name: 'Оперативник Vector',
        icon: '⚡',
        desc: 'Алмазная броня с пистолетом-пулеметом Kriss Vector',
        slots: {
            head: 'diamond_helmet',
            chest: 'diamond_chestplate',
            legs: 'diamond_leggings',
            boots: 'diamond_boots',
            mainHand: 'tacz_vector45',
            offHand: 'none',
            back: 'none'
        }
    },
    tacz_heavy: {
        id: 'tacz_heavy',
        name: 'Джаггернаут Миниган',
        icon: '🔥',
        desc: 'Незеритовый комплект с тяжелым шестиствольным миниганом',
        slots: {
            head: 'netherite_helmet',
            chest: 'netherite_chestplate',
            legs: 'netherite_leggings',
            boots: 'netherite_boots',
            mainHand: 'tacz_minigun',
            offHand: 'none',
            back: 'none'
        }
    },
    tacz_rpg: {
        id: 'tacz_rpg',
        name: 'Гранатометчик РПГ-7',
        icon: '💥',
        desc: 'Незеритовая броня с реактивным гранатометом РПГ-7',
        slots: {
            head: 'netherite_helmet',
            chest: 'netherite_chestplate',
            legs: 'netherite_leggings',
            boots: 'netherite_boots',
            mainHand: 'tacz_rpg7',
            offHand: 'none',
            back: 'none'
        }
    },
    tacz_hitman: {
        id: 'tacz_hitman',
        name: 'Агент Glock 17',
        icon: '🎯',
        desc: 'Алмазный сет со скорострельным пистолетом Glock 17',
        slots: {
            head: 'diamond_helmet',
            chest: 'diamond_chestplate',
            legs: 'diamond_leggings',
            boots: 'diamond_boots',
            mainHand: 'tacz_glock17',
            offHand: 'none',
            back: 'none'
        }
    },
    clean_skin: {
        id: 'clean_skin',
        name: 'Чистый скин',
        icon: '✨',
        desc: 'Оригинальный вид игрока без дополнительного снаряжения',
        slots: {
            head: 'none',
            chest: 'none',
            legs: 'none',
            boots: 'none',
            mainHand: 'none',
            offHand: 'none',
            back: 'none'
        }
    }
};

/**
 * Класс управления 3D экипировкой
 */
class EquipmentManager {
    constructor() {
        this.currentEquipment = {
            head: 'none',
            chest: 'none',
            legs: 'none',
            boots: 'none',
            mainHand: 'none',
            offHand: 'none',
            back: 'none'
        };

        this.listeners = new Set();
        this.activeAttachedObjects = new Map();
        this.loadEquipment();
    }

    loadEquipment() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_EQUIPMENT);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.currentEquipment = { ...this.currentEquipment, ...parsed };
                // Очищаем устаревшие ID
                ['head', 'chest', 'legs', 'boots', 'mainHand', 'offHand', 'back'].forEach(slot => {
                    if (EQUIPMENT_CATALOG[slot] && !EQUIPMENT_CATALOG[slot][this.currentEquipment[slot]]) {
                        this.currentEquipment[slot] = 'none';
                    }
                });
                this.currentEquipment.mainHand = 'none';
            } else {
                this.currentEquipment.mainHand = 'none';
            }
        } catch (e) {
            console.debug('[EquipmentManager] Load error', e);
        }
    }

    saveEquipment() {
        try {
            localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(this.currentEquipment));
        } catch (e) {
            console.debug('[EquipmentManager] Save error', e);
        }
    }

    getSlot(slotName) {
        return this.currentEquipment[slotName] || 'none';
    }

    getEquipment() {
        return { ...this.currentEquipment };
    }

    setSlot(slotName, itemId) {
        if (EQUIPMENT_CATALOG[slotName] && EQUIPMENT_CATALOG[slotName][itemId]) {
            this.currentEquipment[slotName] = itemId;
            this.saveEquipment();
            this.notifyListeners();
        }
    }

    applyBuildAppearance(profileId) {
        const buildId = String(profileId || '').toLowerCase();
        this.currentEquipment = {
            head: 'none',
            chest: 'none',
            legs: 'none',
            boots: 'none',
            mainHand: buildId === 'ganj4craft5' ? 'ganj4craft5_wand' : 'vanilla_diamond_sword',
            offHand: 'none',
            back: 'none',
        };
        this.saveEquipment();
        this.notifyListeners();
    }

    applyPreset(presetId) {
        if (presetId === 'random') {
            this.randomizeEquipment();
            return;
        }
        const preset = EQUIPMENT_PRESETS[presetId];
        if (preset && preset.slots) {
            this.currentEquipment = { ...preset.slots };
            this.saveEquipment();
            this.notifyListeners();
        }
    }

    /**
     * Рандомизация экипировки персонажа
     */
    randomizeEquipment() {
        const taczGuns = [
            'tacz_ak47',
            'tacz_vector45',
            'tacz_awp',
            'tacz_spas_12',
            'tacz_deagle',
            'tacz_glock17',
            'tacz_rpg7',
            'tacz_minigun'
        ];

        // 75% шанс на полный комплект брони (Незерит или Алмазка) + случайное оружие
        const armorTheme = Math.random() < 0.5 ? 'netherite' : 'diamond';
        const hasFullArmor = Math.random() < 0.75;

        if (hasFullArmor) {
            this.currentEquipment.head = Math.random() < 0.85 ? `${armorTheme}_helmet` : 'none';
            this.currentEquipment.chest = `${armorTheme}_chestplate`;
            this.currentEquipment.legs = `${armorTheme}_leggings`;
            this.currentEquipment.boots = `${armorTheme}_boots`;
        } else {
            const pick = (slot, prefix) => Math.random() < 0.7 ? `${prefix}_${slot}` : 'none';
            this.currentEquipment.head = pick('helmet', armorTheme);
            this.currentEquipment.chest = pick('chestplate', armorTheme);
            this.currentEquipment.legs = pick('leggings', armorTheme);
            this.currentEquipment.boots = pick('boots', armorTheme);
        }

        // 95% шанс на оружие в руках
        if (Math.random() < 0.95) {
            this.currentEquipment.mainHand = taczGuns[Math.floor(Math.random() * taczGuns.length)];
        } else {
            this.currentEquipment.mainHand = 'none';
        }

        this.currentEquipment.offHand = 'none';
        this.currentEquipment.back = 'none';

        this.saveEquipment();
        this.notifyListeners();
    }

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    notifyListeners() {
        this.listeners.forEach(fn => {
            try { fn(this.currentEquipment); } catch (e) { console.error(e); }
        });
    }

    /**
     * Применение 3D экипировки к модели Three.js SkinViewer / BedrockPlayerRig
     */
    async applyToViewer(viewer) {
        if (!viewer || !viewer.playerObject) return;

        console.log('[EQUIPMENT] applyToViewer called with equipment:', this.currentEquipment);
        const skin = viewer.playerObject.skin;
        const rig = viewer.bedrockRig;
        this.clearAllEquipment(skin, rig);

        // 1. Голова / Шлем
        if (this.currentEquipment.head !== 'none') {
            const item = EQUIPMENT_CATALOG.head[this.currentEquipment.head];
            if (item && item.armorTex) {
                const mesh = armorMeshBuilder.buildHelmet(item.armorTex, item);
                if (mesh) {
                    if (rig && rig.sockets && rig.sockets.head) {
                        rig.sockets.head.add(mesh);
                    } else if (skin && skin.head) {
                        skin.head.add(mesh);
                    }
                    this.activeAttachedObjects.set('head', mesh);
                }
            }
        }

        // 2. Нагрудник / Броня
        if (this.currentEquipment.chest !== 'none') {
            const item = EQUIPMENT_CATALOG.chest[this.currentEquipment.chest];
            if (item && item.armorTex) {
                const target = (rig && rig.bones) ? rig.bones : skin;
                const mesh = armorMeshBuilder.buildChestplate(item.armorTex, target, item);
                if (mesh) {
                    this.activeAttachedObjects.set('chest', mesh);
                }
            }
        }

        // 3. Поножи
        if (this.currentEquipment.legs !== 'none') {
            const item = EQUIPMENT_CATALOG.legs[this.currentEquipment.legs];
            if (item && item.armorLegsTex) {
                const target = (rig && rig.bones) ? rig.bones : skin;
                armorMeshBuilder.buildLeggings(item.armorLegsTex, target, item);
            }
        }

        // 4. Ботинки
        if (this.currentEquipment.boots !== 'none') {
            const item = EQUIPMENT_CATALOG.boots[this.currentEquipment.boots];
            if (item && item.armorTex) {
                const target = (rig && rig.bones) ? rig.bones : skin;
                armorMeshBuilder.buildBoots(item.armorTex, target, item);
            }
        }

        // 5. Основная рука (TACZ 3D оружие / Мечи)
        if (this.currentEquipment.mainHand !== 'none') {
            const item = EQUIPMENT_CATALOG.mainHand[this.currentEquipment.mainHand];
            if (item) {
                console.log('[EQUIPMENT] Building weapon mesh for:', item.id, item.geoGunId);
                const weaponMesh = await this.buildWeaponMesh(item);
                if (weaponMesh) {
                    if (rig && rig.sockets && rig.sockets.mainHand) {
                        // Точное позиционирование в ладони сустава кисти
                        if (item.geoGunId === 'minigun') {
                            weaponMesh.position.set(0, 0.2, 0.6);
                        } else if (item.geoGunId === 'rpg7') {
                            weaponMesh.position.set(0, 0.4, 0.8);
                        } else if (item.geoGunId === 'glock_17' || item.geoGunId === 'deagle') {
                            weaponMesh.position.set(0, 0, 0.4);
                        } else {
                            weaponMesh.position.set(0, 0, 0.5);
                        }
                        rig.sockets.mainHand.add(weaponMesh);
                    } else if (skin && skin.rightArm) {
                        skin.rightArm.add(weaponMesh);
                    }
                    this.activeAttachedObjects.set('mainHand', weaponMesh);
                    console.log('[EQUIPMENT] Weapon mesh attached successfully');
                }
            }
        }
        console.log('[EQUIPMENT] applyToViewer completed successfully');
    }

    clearAllEquipment(skin, rig = null) {
        const disposeMesh = (obj) => {
            if (!obj) return;
            if (obj.geometry) {
                try { obj.geometry.dispose(); } catch (_) { }
            }
            if (obj.material) {
                try {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                } catch (_) { }
            }
            if (obj.children && obj.children.length > 0) {
                for (let c = obj.children.length - 1; c >= 0; c--) {
                    disposeMesh(obj.children[c]);
                }
            }
        };

        if (skin) {
            const parts = [skin.head, skin.body, skin.rightArm, skin.leftArm, skin.rightLeg, skin.leftLeg];
            parts.forEach(part => {
                if (!part) return;
                for (let i = part.children.length - 1; i >= 0; i--) {
                    const child = part.children[i];
                    if (child && child.name && (
                        child.name.startsWith('EQ_') ||
                        child.name.startsWith('ARMOR_') ||
                        child.name.startsWith('TACZ_') ||
                        child.name.startsWith('VOXEL_')
                    )) {
                        part.remove(child);
                        disposeMesh(child);
                    }
                }
            });
        }

        if (rig && rig.sockets) {
            Object.values(rig.sockets).forEach(socket => {
                if (!socket) return;
                for (let i = socket.children.length - 1; i >= 0; i--) {
                    const child = socket.children[i];
                    socket.remove(child);
                    disposeMesh(child);
                }
            });
        }

        this.activeAttachedObjects.clear();
    }

    // ── Построение 3D Оружия (TACZ Geo) ──
    async buildWeaponMesh(item) {
        if (item.type === 'tacz_geo' && item.geoGunId) {
            return await taczGeoLoader.loadGunModel(item.geoGunId);
        }
        if (item.type === 'voxel_item' && item.itemTex) {
            return await voxelItemBuilder.createItemMesh(item.itemTex, { depth: 0.7, scale: 0.7 });
        }
        return null;
    }
}

export const equipmentManager = new EquipmentManager();
