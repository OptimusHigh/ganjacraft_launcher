"""
GanjaCraft Mod Classifier & Launcher Configurator
=================================================
Автоматический анализ Minecraft модов (Fabric, NeoForge, Forge, Quilt):
  1. Извлечение метаданных (ID, название, версия, описание, авторы, иконки, ссылки).
  2. Определение стороны / среды мода:
     - client-only: чисто клиентский (не нужен на сервере, клиент может подключаться к любому серверу)
     - client-optional: клиентский с опциональной серверной синхронизацией (JEI, Jade, AppleSkin, perf-моды)
     - both: контентный мод (блоки, предметы, биомы, сущности — строго обязателен на клиенте и сервере)
     - server-only: серверный плагин/утилита (Chunky, LuckPerms, EasyAuth, StyledChat и т.д.)
  3. Вычисление графа реальных зависимостей (parents/addons/libraries).
  4. Разделение клиентских модов (client_mods) и добавление серверного префикса server_ в mods/.
     (Папка server_mods НЕ используется — серверные моды лежат в mods/ с префиксом server_ / server-,
     чтобы сервер их загружал, а манифест лаунчера и sync_service их игнорировали).
  5. Генерация актуальной конфигурации mod-groups.js для лаунчера GanjaCraft.

Использование:
  python tools/mod_classifier.py --scan <путь_к_папке_mods>
  python tools/mod_classifier.py --separate <путь_к_папке_mods> [--dry-run]
  python tools/mod_classifier.py --update-launcher
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


# ============================================================================
# Словари известных модов и их категорий
# ============================================================================

KNOWN_SERVER_ONLY: Set[str] = {
    "chunky", "chunkyborder", "bluemap", "easyauth", "easywhitelist",
    "essential_commands", "luckperms", "serverreplay", "ledger",
    "styled-chat", "styled_chat", "styled-nicknames", "styledplayerlist",
    "viperantixray", "meowantixray", "mtsanticheat", "floodgate", "geyser",
    "servercore", "spark", "ftb-essentials", "ftbessentials", "invview", "slashloot",
    "fabric-carpet", "packet_fixer", "leavesbegone", "leaves-be-gone", "leaves_be_gone",
    "zfastnoise", "fastnoise", "fast_noise", "ksyxis", "dungeoncrawl", "dungeon_crawl", "async"
}

KNOWN_CLIENT_ONLY: Set[str] = {
    "sodium", "iris", "oculus", "embeddium", "entityculling", "moreculling",
    "immediatelyfast", "badoptimizations", "gpumemleakfix",
    "entity_model_features", "entity_texture_features", "entity_sound_features",
    "fallingleaves", "visuality", "notenoughanimations", "eatinganimation",
    "eating-animation", "3dskinlayers", "skinlayers3d", "firstperson",
    "betterthirdperson", "freecam", "replaymod", "presencefootsteps",
    "ok_zoomer", "zoomify", "litematica", "forgematica", "printer", "malilib",
    "minihud", "modmenu", "controlling", "searchables", "mousetweaks",
    "betteradvancements", "shulkerboxtooltip", "advanced-xray", "xray",
    "reeses", "continuity", "variants-cit", "sound-physics", "sound_physics",
    "spawnanimations", "spawn-animations", "windy", "configsearch",
    "clickthrough", "cutthrough", "better-advanced-tooltips", "asyncparticles"
}

KNOWN_CLIENT_OPTIONAL: Set[str] = {
    "appleskin", "jade", "jei", "emi", "semi", "jer", "justenoughresources",
    "inventoryprofilesnext", "libipn", "diorama", "cloth-config", "cloth_config",
    "yet_another_config_lib", "fzzy_config", "mezz_config", "zconfig",
    "lithium", "ferritecore", "modernfix", "c2me", "fastasyncworldsave",
    "fasterblockentities", "asynclogger", "fastsuite",
    "krypton", "scalablelux"
}

# Известные иконки лаунчера
# Поддерживаются лаунчером: sodium, brush, leaf, monitor, eye, block, keyboard, mouse, award, camera, user, blueprint, sound, heart, swords, gear
ICON_MAPPINGS: Dict[str, str] = {
    "sodium": "sodium",
    "sodium_extra": "gear",
    "reeses": "cloud",
    "iris": "brush",
    "entity_culling": "eye",
    "more_culling": "eye",
    "lithium": "gear",
    "ferritecore": "gear",
    "modernfix": "gear",
    "immediatelyfast": "sodium",
    "faster_block_entities": "block",
    "c2me": "gear",
    "fast_async_world_save": "gear",
    "bad_optimizations": "gear",
    "gpu_memleak_fix": "monitor",
    "async_particles": "brush",
    "leaves_be_gone": "leaf",
    "etf": "brush",
    "emf": "brush",
    "esf": "sound",
    "continuity": "brush",
    "visuality": "brush",
    "falling_leaves": "leaf",
    "not_enough_animations": "user",
    "eating_animation": "heart",
    "skin_layers_3d": "user",
    "sound_physics": "sound",
    "presence_footsteps": "sound",
    "freecam": "camera",
    "replaymod": "camera",
    "firstperson": "user",
    "ok_zoomer": "eye",
    "better_third_person": "user",
    "litematica": "blueprint",
    "litematica_printer": "blueprint",
    "malilib": "gear",
    "minihud": "monitor",
    "jei": "keyboard",
    "emi": "keyboard",
    "jer": "keyboard",
    "jade": "eye",
    "appleskin": "heart",
    "controlling": "keyboard",
    "searchables": "keyboard",
    "mouse_tweaks": "mouse",
    "modmenu": "gear",
    "better_advancements": "award",
    "shulker_box_tooltip": "block",
    "xray": "eye",
    "diorama": "brush",
    "inventory_profiles_next": "mouse",
    "apotheosis": "swords",
    "better_end": "block",
    "better_nether": "block",
    "biomes_o_plenty": "leaf",
    "refined_storage": "monitor",
    "twilight_forest": "leaf",
    "farmers_delight": "heart",
    "sophisticated_backpacks": "block",
    "artifacts": "award",
    "kubejs": "gear",
    "iron_chests": "block",
    "iron_furnaces": "block",
    "immersive_aircraft": "camera",
    "immersive_paintings": "brush",
    "thaumaturge": "swords",
    "continuum_construct": "swords",
    "curios": "award",
    "lootr": "block",
    "patchouli": "blueprint",
}


def parse_toml(content: str) -> dict:
    """Простой и надежный парсер TOML метаданных Forge/NeoForge без внешних библиотек."""
    data: dict = {"mods": [], "dependencies": {}}
    current_section = None
    current_dict: dict = {}

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        # Удаляем хвостовые комментарии # ..., не находящиеся внутри кавычек
        if "#" in line:
            parts = line.split("#")
            # Простая проверка кавычек
            cleaned = parts[0].strip()
            if cleaned.count('"') % 2 == 0 and cleaned.count("'") % 2 == 0:
                line = cleaned
        if not line:
            continue
        if line.startswith("[["):
            sec = line.strip("[]").strip()
            if sec.startswith("mods"):
                current_dict = {}
                data["mods"].append(current_dict)
                current_section = "mod"
            elif sec.startswith("dependencies."):
                mod_id = sec.split(".", 1)[1].strip()
                current_dict = {}
                data["dependencies"].setdefault(mod_id, []).append(current_dict)
                current_section = "dep"
            else:
                current_section = "other"
                current_dict = {}
        elif "=" in line and current_section:
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            current_dict[k] = v
    return data


def inspect_jar(path: str) -> dict:
    """Глубокий анализ содержимого JAR файла мода."""
    fname = os.path.basename(path)
    info: dict = {
        "filename": fname,
        "path": path,
        "size": os.path.getsize(path),
        "loader": "unknown",
        "id": None,
        "name": None,
        "version": None,
        "description": "",
        "authors": "",
        "environment": "*",       # Fabric: 'client', 'server', '*'
        "neoforge_side": None,     # NeoForge dependency side on minecraft/loader: 'CLIENT', 'SERVER', 'BOTH'
        "dependencies": [],        # list of {id, type, side}
        "entrypoints": [],
        "has_assets": False,
        "has_data": False,
        "has_client_mixins": False,
        "has_server_mixins": False,
        "display_url": None,
    }

    try:
        with zipfile.ZipFile(path, "r") as z:
            names = z.namelist()
            info["has_assets"] = any(n.startswith("assets/") for n in names)
            info["has_data"] = any(n.startswith("data/") for n in names)

            # 1. Fabric mod
            if "fabric.mod.json" in names:
                info["loader"] = "fabric"
                try:
                    f_data = json.loads(z.read("fabric.mod.json").decode("utf-8", errors="ignore"))
                    info["id"] = f_data.get("id")
                    info["name"] = f_data.get("name") or info["id"]
                    info["version"] = str(f_data.get("version", ""))
                    desc = f_data.get("description", "")
                    info["description"] = " ".join(desc) if isinstance(desc, list) else str(desc)
                    authors = f_data.get("authors", [])
                    if isinstance(authors, list):
                        info["authors"] = ", ".join(str(a.get("name") if isinstance(a, dict) else a) for a in authors)
                    elif isinstance(authors, str):
                        info["authors"] = authors
                    info["environment"] = f_data.get("environment", "*")

                    deps = f_data.get("depends", {})
                    if isinstance(deps, dict):
                        for k, v in deps.items():
                            if k not in ("fabricloader", "minecraft", "java"):
                                info["dependencies"].append({"id": k, "type": "required", "version": str(v)})

                    recs = f_data.get("recommends", {})
                    if isinstance(recs, dict):
                        for k, v in recs.items():
                            info["dependencies"].append({"id": k, "type": "optional", "version": str(v)})

                    entrypoints = f_data.get("entrypoints", {})
                    if isinstance(entrypoints, dict):
                        info["entrypoints"] = list(entrypoints.keys())
                    contact = f_data.get("contact", {})
                    info["display_url"] = contact.get("homepage") or contact.get("sources")
                except Exception as e:
                    info["parse_error"] = str(e)

            # 2. NeoForge / Forge
            nf_files = [n for n in names if n in ("META-INF/neoforge.mods.toml", "META-INF/mods.toml")]
            if nf_files:
                info["loader"] = "neoforge" if "META-INF/neoforge.mods.toml" in nf_files else "forge"
                try:
                    raw = z.read(nf_files[0]).decode("utf-8", errors="ignore")
                    toml = parse_toml(raw)
                    if toml["mods"]:
                        m = toml["mods"][0]
                        info["id"] = m.get("modId")
                        info["name"] = m.get("displayName") or info["id"]
                        info["version"] = m.get("version")
                        info["description"] = m.get("description", "")
                        info["authors"] = m.get("authors", "")
                        info["display_url"] = m.get("displayURL")

                    for mod_id, dep_list in toml["dependencies"].items():
                        for dep in dep_list:
                            dep_target = dep.get("modId")
                            side = dep.get("side", "BOTH").upper()
                            if dep_target in ("minecraft", "neoforge", "forge"):
                                if side in ("CLIENT", "SERVER"):
                                    info["neoforge_side"] = side
                            elif dep_target:
                                info["dependencies"].append({
                                    "id": dep_target,
                                    "type": dep.get("type", "required" if dep.get("mandatory") == "true" else "optional"),
                                    "side": side
                                })
                except Exception as e:
                    info["parse_error"] = str(e)

            # 3. Mixins
            for n in names:
                if n.endswith(".mixins.json"):
                    try:
                        m_data = json.loads(z.read(n).decode("utf-8", errors="ignore"))
                        if m_data.get("client"):
                            info["has_client_mixins"] = True
                        if m_data.get("server"):
                            info["has_server_mixins"] = True
                        mixins = m_data.get("mixins") or []
                        if mixins and all(".client." in str(mx) for mx in mixins):
                            info["has_client_mixins"] = True
                    except Exception:
                        pass
    except Exception as e:
        info["error"] = str(e)

    # Нормализуем имя если пусто
    if not info["name"]:
        stem = fname.replace(".jar", "")
        clean_name = re.sub(r"[-_](?:v?\d|\+mc|neoforge|forge|fabric).*", "", stem, flags=re.IGNORECASE)
        info["name"] = clean_name.replace("-", " ").replace("_", " ").title()

    if not info["id"]:
        info["id"] = re.sub(r"[^a-z0-9_]+", "_", info["name"].lower()).strip("_")

    return info


def classify_mod(m: dict) -> Tuple[str, str]:
    """
    Классифицирует мод на 4 ключевых статуса:
      - 'client-only': исключительно клиентский (графика, HUD, шейдеры, локальная физика).
      - 'client-optional': может работать только на клиенте и подключаться к ванили/серверу без этого мода.
      - 'both': обязателен на обеих сторонах (контент, блоки, предметы, механики мира).
      - 'server-only': исключительно серверный (админка, античит, бэкапы, веб-карты).
    """
    fname = m["filename"].lower()
    mod_id = (m["id"] or "").lower()

    # 0. Серверный префикс имени файла
    if fname.startswith("server_") or fname.startswith("server-"):
        return "server-only", "Серверный префикс имени файла (server_)"

    # 1. Известные серверные
    if any(s in mod_id or s in fname for s in KNOWN_SERVER_ONLY):
        return "server-only", "Серверная утилита / античит / админка"

    if m["environment"] == "server" or m["neoforge_side"] == "SERVER":
        return "server-only", "Явное указание серверной среды в метаданных"

    # 2. Известные клиентские
    if any(s in mod_id or s in fname for s in KNOWN_CLIENT_ONLY):
        return "client-only", "Клиентская оптимизация / графика / интерфейс / камера"

    if m["environment"] == "client" or m["neoforge_side"] == "CLIENT":
        return "client-only", "Явное указание клиентской среды в метаданных"

    if m["entrypoints"] == ["client"] and not m["has_data"] and not m["has_server_mixins"]:
        return "client-only", "Только клиентские точки входа, отсутствие серверных данных"

    # 3. Клиент-опциональные (работают на клиенте без сервера)
    if any(s in mod_id or s in fname for s in KNOWN_CLIENT_OPTIONAL):
        return "client-optional", "Работает на клиенте автономно, совместим с ванильными серверами"

    # 4. Контентные моды
    if m["has_data"] and m["has_assets"]:
        return "both", "Содержит ресурсы (assets) и данные (data): блоки, предметы, механики"

    if m["has_data"] and not m["has_assets"]:
        return "both", "Содержит игровые данные / датапаки / рецепты"

    return "both", "Контентный / общий мод"


def categorize_mod(m: dict, status: str) -> str:
    """Назначение категории для интерфейса лаунчера."""
    fname = m["filename"].lower()
    mod_id = (m["id"] or "").lower()

    # 1. Оптимизация
    opt_keywords = [
        "sodium", "embeddium", "lithium", "ferritecore", "modernfix", "badoptimizations",
        "immediatelyfast", "entityculling", "moreculling", "fasterblockentities",
        "enhancedblockentities", "c2me", "fastasyncworldsave", "gpumemleakfix",
        "fastsuite", "asynclogger", "krypton", "scalablelux"
    ]
    if any(k in mod_id or k in fname for k in opt_keywords):
        return "Оптимизация"

    # 2. Графика
    gfx_keywords = [
        "iris", "oculus", "etf", "emf", "esf", "entity_model_features", "entity_texture_features",
        "entity_sound_features", "continuity", "visuality", "fallingleaves",
        "notenoughanimations", "eatinganimation", "eating-animation", "3dskinlayers",
        "skinlayers", "lambdynamiclights", "variants-cit", "spawnanimations",
        "spawn-animations", "windy", "immersive_paintings", "asyncparticles"
    ]
    if any(k in mod_id or k in fname for k in gfx_keywords):
        return "Графика"

    # 3. Камера и Управление
    cam_keywords = [
        "freecam", "replaymod", "firstperson", "betterthirdperson", "leawind",
        "presencefootsteps", "sound-physics", "sound_physics", "ok_zoomer", "zoomify",
        "mousetweaks", "clickthrough", "cutthrough"
    ]
    if any(k in mod_id or k in fname for k in cam_keywords):
        return "Камера и Управление"

    # 4. Строительство
    build_keywords = ["litematica", "forgematica", "printer", "worldedit"]
    if any(k in mod_id or k in fname for k in build_keywords):
        return "Строительство"

    # 5. Интерфейс
    ui_keywords = [
        "jei", "emi", "semi", "jer", "justenoughresources", "jade", "appleskin",
        "betteradvancements", "controlling", "searchables", "shulkerboxtooltip",
        "minihud", "malilib", "modmenu", "inventoryprofilesnext", "libipn", "diorama",
        "xray", "configsearch", "better-advanced-tooltips"
    ]
    if any(k in mod_id or k in fname for k in ui_keywords):
        return "Интерфейс"

    # 6. Библиотеки / Ядра
    lib_keywords = [
        "fabric-api", "fabric-language-kotlin", "kotlinforforge", "cloth-config", "cloth_config",
        "puzzleslib", "balm", "fzzy_config", "mezz_config", "zconfig", "yet_another_config_lib",
        "matlib", "placebo", "cupboard", "cristellib", "jamlib", "glitchcore",
        "wunderlib", "bclib", "lithostitched", "terrablender", "rhino", "mantle", "curios"
    ]
    if any(k in mod_id or k in fname for k in lib_keywords):
        return "Библиотеки"

    # 7. Контент / Геймплей
    return "Контент"


def resolve_depends_on(mod_id: str, deps: List[dict], all_mods_by_id: Dict[str, dict]) -> Optional[str]:
    """Определение родительского мода для аддонов (например sodium-extra -> sodium)."""
    clean_id = mod_id.lower().replace("-", "_")

    # Специфические родительские связи
    parent_rules = {
        "sodium_extra": "sodium",
        "reeses_sodium_options": "sodium",
        "iris": "sodium",
        "entity_model_features": "entity_texture_features",
        "entity_sound_features": "entity_texture_features",
        "litematica_printer": "litematica",
        "minihud": "malilib",
        "justenoughresources": "jei",
        "jer": "jei",
        "apothic_attributes": "placebo",
        "apothic_enchanting": "apothic_attributes",
        "apothic_spawners": "placebo",
        "continuum_construct": "continuum_core",
        "better_end": "bclib",
        "better_nether": "bclib",
        "biomes_o_plenty": "glitchcore",
        "sophisticated_backpacks": "sophisticated_core",
        "thaumaturge_additions": "thaumaturge",
        "thaumic_tinkerer": "thaumaturge",
        "thaumic_tracker": "thaumaturge",
        "veinminer_enchant": "veinminer",
    }

    if clean_id in parent_rules:
        return parent_rules[clean_id]

    # Анализируем зависимости мода
    for d in deps:
        target = d["id"].lower().replace("-", "_")
        if target in all_mods_by_id and target != clean_id:
            # Если целевой мод является крупным ядром
            if target in ("sodium", "jei", "emi", "litematica", "malilib", "curios", "kubejs", "placebo"):
                return target

    return None


def extract_file_match_patterns(filename: str, mod_id: str) -> List[str]:
    """Генерация паттернов для безопасного сопоставления имени файла в лаунчере."""
    stem = filename.replace(".jar", "")
    base_name = re.sub(r"[-_](?:v?\d|\+mc|neoforge|forge|fabric).*", "", stem, flags=re.IGNORECASE).strip("-_")
    patterns = set()

    clean_base = base_name.lower().replace(" ", "").replace("-", "").replace("_", "")
    if clean_base:
        patterns.add(clean_base)

    if base_name:
        patterns.add(base_name.lower())

    if mod_id:
        patterns.add(mod_id.lower())

    return sorted(list(patterns), key=len, reverse=True)


# ============================================================================
# Генератор mod-groups.js
# ============================================================================

def build_mod_group_entry(item: dict, all_items_by_id: Dict[str, dict]) -> dict:
    """Создание единичной записи MOD_GROUPS для лаунчера."""
    info = item["info"]
    status = item["status"]
    cat = item["category"]

    mod_id = info["id"].lower().replace("-", "_")
    name = info["name"]
    version = info["version"] or "1.0.0"
    desc = info["description"] or f"Мод {name} ({status})"

    # Укорачиваем описание до 1-2 предложений если оно слишком длинное
    if len(desc) > 160:
        parts = desc.split(". ")
        desc = parts[0] + "."
        if len(desc) > 160:
            desc = desc[:157] + "..."

    icon = ICON_MAPPINGS.get(mod_id, "gear")
    if cat == "Графика" and icon == "gear":
        icon = "brush"
    elif cat == "Камера и Управление" and icon == "gear":
        icon = "camera"
    elif cat == "Строительство" and icon == "gear":
        icon = "blueprint"
    elif cat == "Интерфейс" and icon == "gear":
        icon = "keyboard"
    elif cat == "Оптимизация" and icon == "gear":
        icon = "sodium" if "sodium" in mod_id else "gear"

    depends_on = resolve_depends_on(mod_id, info["dependencies"], all_items_by_id)
    patterns = extract_file_match_patterns(info["filename"], info["id"])

    # Curse / Modrinth slug
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

    entry = {
        "id": mod_id,
        "name": name,
        "shortName": name,
        "version": str(version),
        "category": cat,
        "subCategory": cat,
        "icon": icon,
        "description": desc,
        "curseSlug": slug,
        "modrinthSlug": slug,
        "files": patterns,
        "side": status,
    }

    if depends_on:
        entry["dependsOn"] = depends_on

    # Дефолтное отключение для рискованных или специфических модов
    if mod_id in ("xray", "advanced_xray", "freecam"):
        entry["defaultDisabled"] = True

    return entry


def extract_existing_resourcepacks_and_shaders(existing_js_path: str) -> List[dict]:
    """Извлечение уже существующих определений ресурспаков и шейдеров из mod-groups.js."""
    if not os.path.exists(existing_js_path):
        return []

    try:
        with open(existing_js_path, "r", encoding="utf-8") as f:
            text = f.read()

        m = re.search(r'export const MOD_GROUPS = (\[.*?\]);', text, re.DOTALL)
        if m:
            data = json.loads(m.group(1))
            packs = [x for x in data if x.get("category") in ("Ресурспаки", "Шейдеры")]
            if packs:
                return packs

        # Резервный поиск регуляркой для старых форматов JS
        pattern = re.compile(r'(\{[^{}]*?category:\s*[\'"](?:Ресурспаки|Шейдеры)[\'"][^{}]*?\})', re.DOTALL)
        matches = pattern.findall(text)
        parsed = []
        for block in matches:
            item: dict = {}
            for line in block.splitlines():
                line = line.strip().rstrip(",")
                if ":" in line:
                    k, v = line.split(":", 1)
                    k = k.strip()
                    v = v.strip()
                    if v.startswith("[") and v.endswith("]"):
                        raw_items = v[1:-1].split(",")
                        item[k] = [x.strip().strip("'\"") for x in raw_items if x.strip()]
                    elif v in ("true", "false"):
                        item[k] = (v == "true")
                    else:
                        item[k] = v.strip("'\"")
            if "id" in item:
                parsed.append(item)
        return parsed
    except Exception as e:
        print(f"Ошибка чтения существующих ресурспаков/шейдеров: {e}")
        return []


def generate_launcher_mod_groups_js(active_mods: List[dict], output_path: str) -> None:
    """Генерация файла mod-groups.js для лаунчера с объединением модов и существующих ресурспаков/шейдеров."""
    by_id = {m["info"]["id"].lower().replace("-", "_"): m for m in active_mods}

    # Извлекаем существующие ресурспаки и шейдеры
    preserved_packs = extract_existing_resourcepacks_and_shaders(output_path)
    print(f"Сохранено {len(preserved_packs)} ресурспаков и шейдеров из существующего файла.")

    unique_groups: Dict[str, dict] = {}

    for item in active_mods:
        # В MOD_GROUPS лаунчера со свитчами идут СТРОГО клиентские моды!
        # Контентные моды (both), библиотеки и серверные (server-only) ни в коем случае нельзя отключать!
        if item["status"] not in ("client-only", "client-optional"):
            continue
        if item["category"] in ("Библиотеки", "Контент"):
            continue

        entry = build_mod_group_entry(item, by_id)
        gid = entry["id"]
        if gid not in unique_groups:
            unique_groups[gid] = entry
        else:
            existing_files = set(unique_groups[gid]["files"])
            existing_files.update(entry["files"])
            unique_groups[gid]["files"] = sorted(list(existing_files), key=len, reverse=True)

    # Добавляем сохраненные ресурспаки и шейдеры
    for p in preserved_packs:
        pid = p["id"]
        if pid not in unique_groups:
            unique_groups[pid] = p

    group_list = list(unique_groups.values())

    # Сортировка: сначала независимые, потом зависимые аддоны
    group_list.sort(key=lambda g: (g.get("dependsOn") is not None, g["category"], g["name"]))

    category_order = [
        "Оптимизация",
        "Графика",
        "Камера и Управление",
        "Строительство",
        "Интерфейс",
        "Ресурспаки",
        "Шейдеры",
        "Остальное"
    ]

    lines = [
        "/**",
        " * Ganj4Craft Launcher - Mods & Resourcepacks Configuration",
        " * Сгенерировано автоматически mod_classifier.py на основе реальных метаданных модов",
        " */",
        "",
        "export const MOD_GROUPS = " + json.dumps(group_list, ensure_ascii=False, indent=4) + ";",
        "",
        "/**",
        " * Категории порядка отображения в лаунчере",
        " */",
        "export const CATEGORY_ORDER = " + json.dumps(category_order, ensure_ascii=False, indent=4) + ";",
        "",
        "/**",
        " * ID групп с дефолтным отключением",
        " */",
        "export const DEFAULT_DISABLED_GROUPS = MOD_GROUPS",
        "    .filter(g => g.defaultDisabled)",
        "    .map(g => g.id);",
        "",
        "export const SUB_CATEGORIES = ['ОПЦИОНАЛЬНЫЕ'];",
        ""
    ]

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Успешно сохранен mod-groups.js: {output_path} ({len(group_list)} групп)")


# ============================================================================
# Разделение клиентских модов и префиксирование серверных
# ============================================================================

def separate_mods(mods_dir: str, client_mods_dir: str, dry_run: bool = False) -> None:
    """
    Разделяет моды:
      - client-only моды переносит в client_mods_dir (для синка клиентам без нагрузки на сервер).
      - server-only моды оставляет в mods_dir, добавляя префикс 'server_' (чтобы сервер загружал jar,
        а ManifestService и sync_service исключали их из клиентского манифеста).
      - both / content моды оставляет в mods_dir как есть.
    """
    os.makedirs(client_mods_dir, exist_ok=True)

    jars = sorted(glob.glob(os.path.join(mods_dir, "*.jar")))
    print(f"\nНачало обработки модов в: {mods_dir} (Всего: {len(jars)} jar)")

    moved_client = 0
    renamed_server = 0
    kept_both = 0

    for jar_path in jars:
        info = inspect_jar(jar_path)
        status, reason = classify_mod(info)
        fn = info["filename"]

        if status == "client-only":
            dest = os.path.join(client_mods_dir, fn)
            print(f"  [CLIENT-ONLY] {fn} -> {client_mods_dir} ({reason})")
            if not dry_run:
                shutil.move(jar_path, dest)
            moved_client += 1
        elif status == "server-only":
            fn_lower = fn.lower()
            if not fn_lower.startswith("server_") and not fn_lower.startswith("server-"):
                new_fn = f"server_{fn}"
                dest = os.path.join(mods_dir, new_fn)
                print(f"  [SERVER-ONLY] {fn} -> {new_fn} (добавлен префикс server_, {reason})")
                if not dry_run:
                    shutil.move(jar_path, dest)
                renamed_server += 1
            else:
                print(f"  [SERVER-ONLY] {fn} (уже имеет префикс server_, {reason})")
                renamed_server += 1
        else:
            kept_both += 1

    mode_str = "[DRY-RUN] " if dry_run else ""
    print(f"\n{mode_str}Итоги:")
    print(f"  Перемещено в клиентские (client_mods): {moved_client}")
    print(f"  Серверные с префиксом server_ в mods/: {renamed_server}")
    print(f"  Осталось в общих (mods): {kept_both}")


# ============================================================================
# CLI Точка входа
# ============================================================================

def main() -> None:
    parser = argparse.ArgumentParser(description="GanjaCraft Mod Classifier & Launcher Configurator")
    parser.add_argument("--scan", type=str, help="Просканировать директорию с модами и вывести детальный отчет")
    parser.add_argument("--separate", type=str, help="Директория mods для разделения client-only модов и префиксирования server_")
    parser.add_argument("--client-dir", type=str, help="Целевая директория для client-only модов (по умолч. client_mods рядом)")
    parser.add_argument("--dry-run", action="store_true", help="Не перемещать/переименовывать файлы, только вывести действия")
    parser.add_argument("--update-launcher", action="store_true", help="Сгенерировать актуальный mod-groups.js для лаунчера")
    parser.add_argument("--output-js", type=str, help="Путь для вывода mod-groups.js")

    args = parser.parse_args()

    # Дефолтные пути в проекте
    base_dir = Path(__file__).resolve().parent.parent
    default_launcher_js = base_dir.parent / "ganja_launcher" / "client" / "src" / "renderer" / "features" / "mods" / "mod-groups.js"

    known_packs = {
        "GC5": r"c:\Users\asuka\AppData\Roaming\FreesmLauncher\instances\GANJ4CRAFT 5\minecraft\mods",
        "VanillaClient": r"C:\Users\asuka\AppData\Roaming\FreesmLauncher\instances\26.3\minecraft\mods",
        "VanillaServer": r"d:\GanjaCraft\ganj4craft-vanilla\mods"
    }

    if args.scan:
        target_dir = args.scan
        jars = sorted(glob.glob(os.path.join(target_dir, "*.jar")))
        print(f"\nСканирование: {target_dir} ({len(jars)} jars)")
        classified = []
        for j in jars:
            info = inspect_jar(j)
            status, reason = classify_mod(info)
            cat = categorize_mod(info, status)
            classified.append({"info": info, "status": status, "reason": reason, "category": cat})

        for st in ("client-only", "client-optional", "both", "server-only"):
            group = [x for x in classified if x["status"] == st]
            print(f"\n=== {st.upper()} ({len(group)}) ===")
            for item in group:
                m = item["info"]
                print(f"  [{item['category']}] {m['name']} (id={m['id']}, v={m['version']}) -> {m['filename']}")
                if m["dependencies"]:
                    dep_ids = [d["id"] for d in m["dependencies"]]
                    print(f"       Зависимости: {dep_ids}")
        return

    if args.separate:
        src = args.separate
        client_dir = args.client_dir or os.path.join(os.path.dirname(src.rstrip("/\\")), "client_mods")
        separate_mods(src, client_dir, dry_run=args.dry_run)
        return

    if args.update_launcher:
        all_active_mods = []
        for name, p in known_packs.items():
            if os.path.exists(p):
                jars = sorted(glob.glob(os.path.join(p, "*.jar")))
                print(f"Анализ сборки {name} ({len(jars)} модов)...")
                for j in jars:
                    info = inspect_jar(j)
                    status, reason = classify_mod(info)
                    cat = categorize_mod(info, status)
                    all_active_mods.append({
                        "info": info,
                        "status": status,
                        "reason": reason,
                        "category": cat
                    })

        out_js = args.output_js or str(default_launcher_js)
        generate_launcher_mod_groups_js(all_active_mods, out_js)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
