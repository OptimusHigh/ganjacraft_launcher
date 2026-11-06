/**
 * Ganj4Craft Launcher - Mods & Resourcepacks Configuration
 * Структурированная конфигурация групп модов, ресурспаков и шейдеров с зависимостями
 */

export const MOD_GROUPS = [
    // ----------------------------------------------------
    // ОПТИМИЗАЦИЯ
    // ----------------------------------------------------
    {
        id: 'sodium',
        name: 'Sodium',
        shortName: 'Sodium',
        version: '0.9.3',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'sodium',
        description: 'Ядерное ускорение рендеринга и многопоточности чанков. Основной двигатель FPS.',
        curseSlug: 'sodium',
        modrinthSlug: 'sodium',
        files: ['sodium', 'embeddium', 'chloride']
    },
    {
        id: 'sodium_extra',
        name: 'Sodium Extra',
        shortName: 'Sodium Extra',
        version: '0.9.5',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        dependsOn: 'sodium',
        description: 'Расширенная оптимизация анимаций, частиц, частиц облаков и подпрядных чанков.',
        curseSlug: 'sodium-extra',
        modrinthSlug: 'sodium-extra',
        files: ['sodium-extra', 'sodium_extra']
    },
    {
        id: 'reeses_options',
        name: 'Reese\'s Options',
        shortName: 'Reese\'s Options',
        version: '2.2.6',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'cloud',
        dependsOn: 'sodium',
        description: 'Удобное графическое меню настроек Sodium с вертикальными вкладками и поиском.',
        curseSlug: 'reeses-sodium-options',
        modrinthSlug: 'reeses-sodium-options',
        files: ['reeses-sodium-options', 'reeses']
    },
    {
        id: 'iris',
        name: 'Iris / Oculus Shaders',
        shortName: 'Iris Shaders',
        version: '1.11.7',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'brush',
        dependsOn: 'sodium',
        description: 'Поддержка современных шейдерпаков в интерфейсе настроек видео Sodium.',
        curseSlug: 'iris',
        modrinthSlug: 'iris',
        files: ['iris', 'oculus']
    },
    {
        id: 'entity_culling',
        name: 'Entity Culling',
        shortName: 'Entity Culling',
        version: '1.11.3',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'eye',
        description: 'Пропуск рендеринга скрытых стенами сущностей и сундуков. Сильно повышает FPS на базах.',
        curseSlug: 'entityculling',
        modrinthSlug: 'entityculling',
        files: ['entityculling']
    },
    {
        id: 'more_culling',
        name: 'More Culling',
        shortName: 'More Culling',
        version: '1.9.0',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'eye',
        description: 'Продвинутый куллинг невидимых граней блоков, облаков и сущностей.',
        curseSlug: 'moreculling',
        modrinthSlug: 'more-culling',
        files: ['moreculling']
    },
    {
        id: 'lithium',
        name: 'Lithium',
        shortName: 'Lithium',
        version: '0.26.2',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Глубокая оптимизация физики, тиков мира, поиска путей ИИ и загрузки чанков.',
        curseSlug: 'lithium',
        modrinthSlug: 'lithium',
        files: ['lithium']
    },
    {
        id: 'ferritecore',
        name: 'FerriteCore',
        shortName: 'FerriteCore',
        version: '9.0.0',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Значительное снижение потребления оперативной памяти RAM модельным кэшем.',
        curseSlug: 'ferritecore',
        modrinthSlug: 'ferrite-core',
        files: ['ferritecore']
    },
    {
        id: 'modernfix',
        name: 'ModernFix',
        shortName: 'ModernFix',
        version: '5.27.26',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Ускорение запуска игры, исправление утечек памяти и оптимизация структур данных.',
        curseSlug: 'modernfix',
        modrinthSlug: 'modernfix',
        files: ['modernfix']
    },
    {
        id: 'immediatelyfast',
        name: 'ImmediatelyFast',
        shortName: 'ImmediatelyFast',
        version: '1.15.3',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Оптимизация рендеринга интерфейса, текста, карт, частиц и HUD в реальном времени.',
        curseSlug: 'immediatelyfast',
        modrinthSlug: 'immediatelyfast',
        files: ['immediatelyfast', 'ImmediatelyFast']
    },
    {
        id: 'faster_block_entities',
        name: 'Enhanced Block Entities',
        shortName: 'Fast Block Entities',
        version: '1.1.0',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'block',
        description: 'Ускорение рендеринга сундуков, табличек, колоколов и механизмов.',
        curseSlug: 'enhanced-block-entities',
        modrinthSlug: 'ebe',
        files: ['enhancedblockentities', 'fasterblockentities']
    },
    {
        id: 'c2me',
        name: 'C2ME (Chunk Engine)',
        shortName: 'C2ME',
        version: '0.4.2',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Многопоточная генерация и ускоренная загрузка чанков мира без фризов.',
        curseSlug: 'c2me-fabric',
        modrinthSlug: 'c2me-fabric',
        files: ['c2me']
    },
    {
        id: 'fast_async_world_save',
        name: 'Fast Async World Save',
        shortName: 'Fast Async Save',
        version: '2.6',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Асинхронное фоновое сохранение мира без микро-статтеров.',
        files: ['fastasyncworldsave']
    },
    {
        id: 'bad_optimizations',
        name: 'BadOptimizations',
        shortName: 'BadOptimizations',
        version: '2.4.1',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Легковесные микро-оптимизации рендера освещения и неба.',
        files: ['badoptimizations', 'BadOptimizations']
    },
    {
        id: 'gpu_memleak_fix',
        name: 'GPU Memory Leak Fix',
        shortName: 'GPU Leak Fix',
        version: '1.9',
        category: 'Оптимизация',
        subCategory: 'Оптимизация',
        icon: 'gear',
        description: 'Предотвращение утечек видеопамяти при долгой игре.',
        files: ['gpumemleakfix']
    },

    // ----------------------------------------------------
    // ГРАФИКА
    // ----------------------------------------------------
    {
        id: 'etf',
        name: 'Entity Texture Features (ETF)',
        shortName: 'Entity Textures (ETF)',
        version: '7.2.7',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'eye',
        description: 'Кастомные и случайные текстуры мобов, светящиеся глаза и поддержка OptiFine скинов.',
        curseSlug: 'entity-texture-features-fabric-forge',
        modrinthSlug: 'entity-texture-features',
        files: ['entity_texture_features']
    },
    {
        id: 'emf',
        name: 'Entity Model Features (EMF)',
        shortName: 'Entity Models (EMF)',
        version: '3.3.12',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'eye',
        dependsOn: 'etf',
        description: 'Кастомные 3D-модели мобов и живая анимация сущностей (OptiFine CEM).',
        curseSlug: 'entity-model-features',
        modrinthSlug: 'entity-model-features',
        files: ['entity_model_features']
    },
    {
        id: 'esf',
        name: 'Entity Sound Features (ESF)',
        shortName: 'Entity Sounds (ESF)',
        version: '0.8.2',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'sound',
        dependsOn: 'etf',
        description: 'Кастомные звуки мобов в зависимости от их подвида и биома.',
        files: ['entity_sound_features']
    },
    {
        id: 'connected_textures',
        name: 'Connected Textures (CTM)',
        shortName: 'Connected Textures',
        version: '3.0.1',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'block',
        description: 'Соединяющиеся текстуры блоков (стекло, камень и другие блоки OptiFine CTM).',
        curseSlug: 'continuity',
        modrinthSlug: 'continuity',
        files: ['continuity', 'athena']
    },
    {
        id: 'variants_cit',
        name: 'Variants CIT',
        shortName: 'Variants CIT',
        version: '5.7.1',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'brush',
        description: 'Кастомные текстуры и 3D-модели предметов при переименовании на наковальне.',
        files: ['variants-cit', 'citresewn', 'cit_resewn']
    },
    {
        id: 'visuality',
        name: 'Visuality',
        shortName: 'Visuality',
        version: '0.7.15',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'brush',
        description: 'Красивые частицы брызг, искр, светящихся душ и магии вокруг мобов.',
        curseSlug: 'visuality',
        modrinthSlug: 'visuality',
        files: ['visuality']
    },
    {
        id: 'falling_leaves',
        name: 'Falling Leaves',
        shortName: 'Falling Leaves',
        version: '2.0.8',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'leaf',
        description: 'Реалистичный листопад с крон деревьев в лесах и садах.',
        curseSlug: 'fallingleaves',
        modrinthSlug: 'fallingleaves',
        files: ['fallingleaves', 'LeavesBeGone']
    },
    {
        id: 'not_enough_animations',
        name: 'Not Enough Animations',
        shortName: 'Not Enough Animations',
        version: '1.12.6',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'user',
        description: 'Плавные анимации от 3-го лица: еда, питьё, гребля, лазание по лестницам.',
        curseSlug: 'not-enough-animations',
        modrinthSlug: 'not-enough-animations',
        files: ['notenoughanimations']
    },
    {
        id: 'eating_animation',
        name: 'Eating Animation',
        shortName: 'Eating Animation',
        version: '5.1.0',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'user',
        description: 'Постепенное откусывание предметов еды в руках персонажа.',
        files: ['eating-animation']
    },
    {
        id: 'skin_layers_3d',
        name: '3D Skin Layers',
        shortName: '3D Skin Layers',
        version: '1.11.4',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'user',
        description: 'Объёмные 3D-слои одежды, деталей скинов и аксессуаров игроков.',
        curseSlug: 'skin-layers-3d',
        modrinthSlug: '3dskinlayers',
        files: ['skinlayers3d', 'skinlayers']
    },
    {
        id: 'sound_physics',
        name: 'Sound Physics Remastered',
        shortName: 'Sound Physics',
        version: '1.5.2',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'sound',
        description: 'Физическое распространение звука с эхом в пещерах и приглушением за стенами.',
        curseSlug: 'sound-physics-remastered',
        modrinthSlug: 'sound-physics-remastered',
        files: ['sound-physics', 'soundphysics']
    },
    {
        id: 'lamb_dynamic_lights',
        name: 'LambDynamicLights',
        shortName: 'Dynamic Lights',
        version: '4.13.0',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'brush',
        description: 'Динамическое освещение в руках: факелы, светящиеся блоки и фонари освещают путь.',
        curseSlug: 'lambdynamiclights',
        modrinthSlug: 'lambdynamiclights',
        files: ['lambdynamiclights']
    },
    {
        id: 'spawn_animations',
        name: 'Spawn Animations',
        shortName: 'Spawn Animations',
        version: '1.11.6',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'eye',
        description: 'Эффектные анимации появления мобов из земли, порталов и тумана.',
        files: ['spawnanimations', 'spawn-animations-compats']
    },
    {
        id: 'borderless',
        name: 'Borderless Window',
        shortName: 'Borderless Window',
        version: '1.7.5',
        category: 'Графика',
        subCategory: 'Графика',
        icon: 'monitor',
        description: 'Полноэкранный режим в окне без рамок для мгновенного переключения окон (Alt+Tab).',
        curseSlug: 'borderless-mining',
        modrinthSlug: 'borderless-mining',
        files: ['borderless']
    },

    // ----------------------------------------------------
    // КАМЕРА И УПРАВЛЕНИЕ
    // ----------------------------------------------------
    {
        id: 'freecam',
        name: 'Freecam',
        shortName: 'Freecam',
        version: '1.5.1',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'camera',
        description: 'Свободная летающая камера для осмотра построек и создания красивых скриншотов.',
        files: ['freecam'],
        defaultDisabled: true
    },
    {
        id: 'ok_zoomer',
        name: 'OK Zoomer',
        shortName: 'Zoomer (Клавиша C)',
        version: '19.0.0',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'camera',
        description: 'Плавное приближение камеры с кинематографическим зумом на клавишу C.',
        files: ['ok_zoomer', 'zoomify']
    },
    {
        id: 'first_person',
        name: 'First Person Model',
        shortName: 'First Person Model',
        version: '2.7.3',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'user',
        description: 'Реалистичный вид от первого лица с отображением тела, ног, брони и предметов персонажа.',
        curseSlug: 'first-person-model',
        modrinthSlug: 'first-person-model',
        files: ['firstperson', 'FirstPerson'],
        defaultDisabled: true
    },
    {
        id: 'third_person',
        name: 'Better Third Person',
        shortName: 'Better 3rd Person',
        version: '1.9.0',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'camera',
        description: 'Плавная свободная камера от третьего лица при нажатии F5 (обзор на 360° вокруг игрока).',
        curseSlug: 'leawind-third-person',
        modrinthSlug: 'leawind-third-person',
        files: ['leawind_third_person', 'betterthirdperson', 'BetterThirdPerson'],
        defaultDisabled: true
    },
    {
        id: 'replaymod',
        name: 'Replay Mod',
        shortName: 'Replay Mod',
        version: '2.6.28',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'camera',
        description: 'Запись игрового процесса и создание кинематографических видеороликов.',
        files: ['replaymod'],
        defaultDisabled: true
    },
    {
        id: 'presence_footsteps',
        name: 'Presence Footsteps',
        shortName: 'Presence Footsteps',
        version: '1.14.0',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'sound',
        description: 'Богатая палитра звуков шагов по разным поверхностям и материалам.',
        files: ['PresenceFootsteps']
    },
    {
        id: 'windy_fabric',
        name: 'Windy Fabric',
        shortName: 'Windy Breeze',
        version: '1.2.1',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'leaf',
        description: 'Эффект колыхания ветра на траве, листьях и баннерах.',
        files: ['Windy_Fabric', 'windy']
    },
    {
        id: 'inventory_profiles',
        name: 'Inventory Profiles Next',
        shortName: 'Inventory Profiles',
        version: '2.3.8',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'mouse',
        description: 'Удобная сортировка инвентаря, авто-замена сломанных инструментов и быстрый трансфер.',
        files: ['InventoryProfilesNext', 'libIPN']
    },
    {
        id: 'diorama',
        name: 'Diorama',
        shortName: 'Diorama',
        version: '0.3.0',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'eye',
        description: 'Плавное масштабирование дальности прорисовки и визуальные эффекты горизонта.',
        files: ['diorama']
    },
    {
        id: 'clickthrough',
        name: 'Clickthrough Plus',
        shortName: 'Clickthrough Plus',
        version: '3.6.5',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'mouse',
        description: 'Возможность открывать сундуки, таблички и баннеры прямо через рамки предметов.',
        files: ['clickthrough-plus', 'cutthrough']
    },
    {
        id: 'advanced_xray',
        name: 'Advanced X-Ray',
        shortName: 'Advanced X-Ray',
        version: '26.3.0',
        category: 'Камера и Управление',
        subCategory: 'Камера и Управление',
        icon: 'eye',
        description: 'Поиск редких руд и скрытых блоков.',
        files: ['advanced-xray'],
        defaultDisabled: true
    },

    // ----------------------------------------------------
    // СТРОИТЕЛЬСТВО
    // ----------------------------------------------------
    {
        id: 'litematica',
        name: 'Litematica / Forgematica',
        shortName: 'Litematica (Схематики)',
        version: '0.29.1',
        category: 'Строительство',
        subCategory: 'Строительство',
        icon: 'blueprint',
        description: 'Загрузка 3D-схематик постройки, полупрозрачная проекция и сверка блоков.',
        curseSlug: 'forgematica',
        modrinthSlug: 'forgematica',
        files: ['litematica', 'forgematica', 'Forgematica'],
        defaultDisabled: true
    },
    {
        id: 'litematica_printer',
        name: 'Litematica / NeoForgematica Printer',
        shortName: 'Схематик-Принтер',
        version: '3.2.3',
        category: 'Строительство',
        subCategory: 'Строительство',
        icon: 'block',
        dependsOn: 'litematica',
        description: 'Автоматическая расстановка блоков по загруженной 3D-проекции схематики.',
        curseSlug: 'neoforgematicaprinter',
        modrinthSlug: 'neoforgematicaprinter',
        files: ['litematica-printer', 'neoforgematicaprinter', 'NeoForgematicaPrinter'],
        defaultDisabled: true
    },
    {
        id: 'malilib',
        name: 'MaLiLib',
        shortName: 'MaLiLib Core',
        version: '0.30.2',
        category: 'Строительство',
        subCategory: 'Строительство',
        icon: 'gear',
        dependsOn: 'litematica',
        description: 'Базовая служебная библиотека настроек для модов Litematica и MiniHUD.',
        files: ['malilib', 'mafglib', 'badpackets'],
        defaultDisabled: true
    },

    // ----------------------------------------------------
    // ИНТЕРФЕЙС
    // ----------------------------------------------------
    {
        id: 'emi',
        name: 'EMI (Рецепты и Крафты)',
        shortName: 'EMI Recipes',
        version: '1.1.24',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'block',
        description: 'Просмотр всех рецептов игры и дерева крафта справа в инвентаре.',
        curseSlug: 'emi',
        modrinthSlug: 'emi',
        files: ['semi', 'emi', 'createjeicompat']
    },
    {
        id: 'jei',
        name: 'Just Enough Items (JEI)',
        shortName: 'JEI Plugin',
        version: '31.16.0',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'block',
        dependsOn: 'emi',
        description: 'Плагин интеграции каталога предметов и поддержка рецептов сторонних модов.',
        curseSlug: 'jei',
        modrinthSlug: 'jei',
        files: ['jei']
    },
    {
        id: 'jer',
        name: 'Just Enough Resources (JER)',
        shortName: 'JER (Ресурсы и Дропы)',
        version: '1.11.0',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'award',
        dependsOn: 'emi',
        description: 'Отображение шансов выпадения лута с мобов, глубин залегания руд и сундуков данжей.',
        files: ['JustEnoughResources', 'jer']
    },
    {
        id: 'controlling',
        name: 'Controlling',
        shortName: 'Controlling',
        version: '26.3.4',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'keyboard',
        description: 'Быстрый поиск конфликтов клавиш и расширенная настройка биндов.',
        curseSlug: 'controlling',
        modrinthSlug: 'controlling',
        files: ['Controlling', 'controlling']
    },
    {
        id: 'searchables',
        name: 'Searchables',
        shortName: 'Searchables Filter',
        version: '1.0.3',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'keyboard',
        dependsOn: 'controlling',
        description: 'Поисковая строка для списков клавиш, рецептов и меню настроек.',
        files: ['Searchables', 'searchables']
    },
    {
        id: 'mouse_tweaks',
        name: 'Mouse Tweaks',
        shortName: 'Mouse Tweaks',
        version: '2.31',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'mouse',
        description: 'Удобное перемещение предметов в инвентаре зажатием ПКМ, быстрое перемещение колесиком мыши.',
        curseSlug: 'mouse-tweaks',
        modrinthSlug: 'mouse-tweaks',
        files: ['MouseTweaks', 'mousetweaks']
    },
    {
        id: 'better_advancements',
        name: 'Better Advancements',
        shortName: 'Better Advancements',
        version: '0.6.0',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'award',
        description: 'Удобное полноэкранное древо достижений с масштабированием, описаниями и прогрессом.',
        curseSlug: 'better-advancements',
        modrinthSlug: 'better-advancements',
        files: ['BetterAdvancements', 'betteradvancements'],
        defaultDisabled: true
    },
    {
        id: 'jade',
        name: 'Jade (Инфо-плашка WAILA)',
        shortName: 'Jade HUD',
        version: '26.3.5',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'eye',
        description: 'Информативная всплывающая плашка с именем блока, содержимым сундуков и здоровьем мобов.',
        curseSlug: 'jade',
        modrinthSlug: 'jade',
        files: ['Jade', 'jade', 'waila']
    },
    {
        id: 'appleskin',
        name: 'AppleSkin',
        shortName: 'AppleSkin',
        version: '3.0.10',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'heart',
        description: 'Отображение насыщения еды, восстанавливаемых очков сытости и здоровья.',
        curseSlug: 'appleskin',
        modrinthSlug: 'appleskin',
        files: ['appleskin']
    },
    {
        id: 'shulker_box_tooltip',
        name: 'Shulker Box Tooltip',
        shortName: 'Shulker Tooltip',
        version: '5.4.2',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'block',
        description: 'Предпросмотр содержимого шалкеров, сундуков и рюкзаков при наведении курсора.',
        curseSlug: 'shulkerboxtooltip',
        modrinthSlug: 'shulkerboxtooltip',
        files: ['shulkerboxtooltip']
    },
    {
        id: 'minihud',
        name: 'MiniHUD',
        shortName: 'MiniHUD',
        version: '0.41.2',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'monitor',
        description: 'Настраиваемый оверлей координат, FPS, света, времени суток и биома на экране.',
        files: ['minihud'],
        defaultDisabled: true
    },
    {
        id: 'modmenu',
        name: 'Mod Menu',
        shortName: 'Mod Menu',
        version: '21.0.0',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'gear',
        description: 'Внутриигровой список модов и быстрый доступ к их конфигурациям в меню паузы.',
        files: ['modmenu']
    },
    {
        id: 'more_overlays',
        name: 'More Overlays',
        shortName: 'More Overlays',
        version: '1.24.4',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'monitor',
        description: 'Отображение сетки спавна мобов клавишей F7 и границ чанков клавишей F9.',
        files: ['moreoverlays']
    },
    {
        id: 'config_search',
        name: 'Config Search',
        shortName: 'Config Search',
        version: '1.1.0',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'keyboard',
        description: 'Быстрый поиск параметров по названиям в меню настроек модов.',
        files: ['ConfigSearch']
    },
    {
        id: 'better_tooltips',
        name: 'Better Advanced Tooltips',
        shortName: 'Better Tooltips',
        version: '1.1.0',
        category: 'Интерфейс',
        subCategory: 'Интерфейс',
        icon: 'blueprint',
        description: 'Расширенные подсказки предметов с ID, тегами и свойствами NBT.',
        files: ['better-advanced-tooltips']
    },

    // ----------------------------------------------------
    // РЕСУРСПАКИ
    // ----------------------------------------------------
    {
        id: 'fresh_animations',
        name: 'Fresh Animations',
        shortName: 'Fresh Animations',
        version: '1.10.5',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'eye',
        description: 'Полная динамическая переработка анимаций мобов, живая мимика и реалистичные движения.',
        curseSlug: 'fresh-animations',
        modrinthSlug: 'fresh-animations',
        files: ['FreshAnimations']
    },
    {
        id: 'fa_extensions',
        name: 'FA+ All Extensions',
        shortName: 'FA+ Расширения',
        version: '1.9.2',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'block',
        dependsOn: 'fresh_animations',
        description: 'Дополнительные расширенные анимации существ и мобов для Fresh Animations.',
        files: ['FA+All_Extensions', 'FA+AllExtensions']
    },
    {
        id: 'fa_player',
        name: 'FA+ Player',
        shortName: 'FA+ Анимации игрока',
        version: '1.1',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'user',
        dependsOn: 'fresh_animations',
        description: 'Плавные живые анимации движений, плавания и действий персонажа игрока.',
        files: ['FA+Player']
    },
    {
        id: 'armory_reforged',
        name: 'Armory Reforged',
        shortName: 'Armory Reforged',
        version: '1.1',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'award',
        description: 'Комплект Reforged: детализированные 3D-модели и текстуры доспехов и брони.',
        files: ['Armory Reforged', 'ArmoryReforged']
    },
    {
        id: 'reforged_tools',
        name: 'Reforged Tools',
        shortName: 'Reforged Tools',
        version: '1.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'blueprint',
        dependsOn: 'armory_reforged',
        description: 'Обновлённые 3D-модели и текстуры всех инструментов и боевого оружия.',
        files: ['Reforged Tools', 'ReforgedTools']
    },
    {
        id: 'hardware_reforged',
        name: 'Hardware Reforged',
        shortName: 'Hardware Reforged',
        version: '1.1.0-a',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'gear',
        dependsOn: 'armory_reforged',
        description: 'Переработанные металлические компоненты, замки, рельсы и механизмы.',
        files: ['Hardware Reforged', 'HardwareReforged']
    },
    {
        id: 'health_bars_reforged',
        name: 'Health Bars Reforged',
        shortName: 'Health Bars Reforged',
        version: '1.1',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'heart',
        dependsOn: 'armory_reforged',
        description: 'Стилизованные индикаторы здоровья мобов и сердец в стилистике Reforged.',
        files: ['Health Bars Reforged', 'HealthBarsReforged']
    },
    {
        id: 'visual_enchantments',
        name: 'Visual Enchantments',
        shortName: 'Visual Enchantments',
        version: '5.0.6',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'brush',
        description: 'Уникальные анимированные текстуры для книг зачарований и зачарованных предметов.',
        files: ['VisualEnchantments', 'Visual_Enchantments']
    },
    {
        id: 'visual_armor_trims',
        name: 'Visual Armor Trims',
        shortName: 'Visual Armor Trims',
        version: '4.3',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'brush',
        dependsOn: 'visual_enchantments',
        description: 'Продвинутый 3D-рельеф и свечение кузнечных шаблонов на доспехах.',
        files: ['visual_armor_trims', 'VisualArmorTrims']
    },
    {
        id: 'enchant_icons',
        name: 'Enchant Icons Reforged',
        shortName: 'Enchant Icons',
        version: '26.1.2',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'award',
        dependsOn: 'visual_enchantments',
        description: 'Красивые тематические иконки уровней и типов чар в инвентаре и наковальне.',
        files: ['Enchant Icons Reforged', 'EnchantIconsReforged']
    },
    {
        id: 'xalis_books',
        name: 'xali\'s Books Reforged',
        shortName: 'xali\'s Books',
        version: '1.0.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'block',
        dependsOn: 'visual_enchantments',
        description: 'Индивидуальные визуальные модели для каждого типа магических книг.',
        files: ['xali\'s books reforged', 'xalis_books']
    },
    {
        id: 'stay_true',
        name: 'Stay True',
        shortName: 'Stay True',
        version: '1.21.5',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'leaf',
        description: 'Улучшенные ванильные текстуры блоков с вариативностью листвы и кирпичей.',
        files: ['Stay True', 'StayTrue']
    },
    {
        id: 'better_grounds',
        name: 'Better Grounds',
        shortName: 'Better Grounds',
        version: '1.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'block',
        description: 'Плавные переходы почвы, песка, камня и травы без резких стыков блоков.',
        files: ['Better Grounds', 'BetterGrounds']
    },
    {
        id: 'better_vanilla_building',
        name: 'Better Vanilla Building',
        shortName: 'Better Building',
        version: 'Beta 5',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'blueprint',
        description: 'Расширенные текстуры строительных блоков для красивой архитектуры.',
        files: ['BetterVanillaBuilding']
    },
    {
        id: 'fast_better_grass',
        name: 'Fast Better Grass',
        shortName: 'Fast Better Grass',
        version: '1.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'leaf',
        description: 'Сплошной травяной покров по боковым граням блоков дёрна.',
        files: ['Fast Better Grass', 'FastBetterGrass']
    },
    {
        id: 'low_on_fire',
        name: 'Low On Fire',
        shortName: 'Low On Fire',
        version: '26.1',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'eye',
        description: 'Уменьшенная высота пламени на экране при горении для чистого обзора.',
        files: ['LowOnFire']
    },
    {
        id: 'mbv_3d',
        name: 'MBV 3D Models',
        shortName: 'MBV 3D',
        version: '1.0.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'block',
        description: 'Трёхмерные объёмные модели рельс, дверей, люков и декоративных блоков.',
        files: ['MBV-3D', 'MBV3D']
    },
    {
        id: 'more_shroom_variants',
        name: 'More Shroom Variants',
        shortName: 'More Shrooms',
        version: '1.20',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'leaf',
        description: 'Разнообразные варианты грибов и растительности в лесах и подземельях.',
        files: ['More Shroom Variants', 'MoreShroomVariants']
    },
    {
        id: 'variated_blocks',
        name: 'Variated Blocks',
        shortName: 'Variated Blocks',
        version: '1.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'block',
        description: 'Случайные вариации текстур руд, дерева и камней для разнообразия мира.',
        files: ['VARIATED BLOCK', 'VariatedBlocks']
    },
    {
        id: 'variant_paintings',
        name: 'Variant Paintings',
        shortName: 'Variant Paintings',
        version: '1.21+',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'brush',
        description: 'Новые картины высокого разрешения для оформления баз и интерьеров.',
        files: ['Variant Paintings', 'VariantPaintings']
    },
    {
        id: 'magma_variants',
        name: 'Magma Variants',
        shortName: 'Magma Variants',
        version: '1.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'brush',
        description: 'Светящиеся трещины и анимированная лава в блоках магмы.',
        files: ['magma_variants', 'MagmaVariants']
    },
    {
        id: 'default_dark_mode',
        name: 'Default Dark Mode',
        shortName: 'Dark Mode UI',
        version: '26.3',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'monitor',
        description: 'Стильный тёмный интерфейс для всех игровых меню, инвентарей и сундуков.',
        files: ['Default-Dark-Mode', 'DefaultDarkMode']
    },
    {
        id: 'slightly_improved_font',
        name: 'Slightly Improved Font',
        shortName: 'Improved Font',
        version: '1.1.5',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'keyboard',
        description: 'Чёткий сглаженный шрифт интерфейса высокой читаемости.',
        files: ['Slightly-Improved-Font', 'SlightlyImprovedFont']
    },
    {
        id: 'trim_lang',
        name: 'Trim Lang Localization',
        shortName: 'Trim Lang (RU)',
        version: '1.0',
        category: 'Ресурспаки',
        subCategory: 'Ресурспаки',
        icon: 'award',
        description: 'Полный русскоязычный перевод названий отделок и кузнечных шаблонов брони.',
        files: ['trim-lang']
    },

    // ----------------------------------------------------
    // ШЕЙДЕРЫ
    // ----------------------------------------------------
    {
        id: 'shader_complementary',
        name: 'Complementary Unbound',
        shortName: 'Complementary Unbound',
        version: 'r5.9.3',
        category: 'Шейдеры',
        subCategory: 'Шейдеры',
        icon: 'brush',
        description: 'Флагманский шейдерпак: объемные лучи, динамический свет, отражения и волны воды.',
        files: ['ComplementaryUnbound', 'complementary-unbound']
    },
    {
        id: 'shader_nostalgia',
        name: 'Nostalgia Shader',
        shortName: 'Nostalgia Shader',
        version: 'v5.1',
        category: 'Шейдеры',
        subCategory: 'Шейдеры',
        icon: 'brush',
        description: 'Атмосферный кинематографический шейдерпак в стиле первых версий Minecraft.',
        files: ['Nostalgia', 'nostalgia-shader']
    },
    {
        id: 'shader_sildurs_fancy',
        name: 'Sildur\'s Enhanced Default (Fancy)',
        shortName: 'Sildur\'s Fancy',
        version: 'v1.20',
        category: 'Шейдеры',
        subCategory: 'Шейдеры',
        icon: 'brush',
        description: 'Мягкие тени, улучшенное освещение и отражения без просадки FPS.',
        files: ['Sildur\'s Enhanced Default v1.20 Fancy', 'sildurs-fancy']
    },
    {
        id: 'shader_sildurs_fast',
        name: 'Sildur\'s Enhanced Default (Fast)',
        shortName: 'Sildur\'s Fast',
        version: 'v1.20',
        category: 'Шейдеры',
        subCategory: 'Шейдеры',
        icon: 'brush',
        description: 'Ультра-легкий шейдер для слабых ПК: мягкий свет и улучшенная вода.',
        files: ['Sildur\'s Enhanced Default v1.20 Fast', 'sildurs-fast']
    },
    {
        id: 'shader_potato',
        name: 'Potato Shaders',
        shortName: 'Potato Shaders',
        version: 'v1.0d',
        category: 'Шейдеры',
        subCategory: 'Шейдеры',
        icon: 'brush',
        description: 'Максимально оптимизированный шейдерпак для слабых ноутбуков и видеокарт.',
        files: ['PotatoShaders', 'potato-shaders']
    },
    {
        id: 'shader_i_like_vanilla',
        name: 'I Like Vanilla',
        shortName: 'I Like Vanilla',
        version: 'v1.5.0b',
        category: 'Шейдеры',
        subCategory: 'Шейдеры',
        icon: 'brush',
        description: 'Легкие тени и мягкая ванильная атмосфера без изменения стилистики игры.',
        files: ['I Like Vanilla', 'i-like-vanilla']
    }
];

/**
 * Категории порядка отображения в лаунчере
 */
export const CATEGORY_ORDER = [
    'Оптимизация',
    'Графика',
    'Камера и Управление',
    'Строительство',
    'Интерфейс',
    'Ресурспаки',
    'Шейдеры',
    'Остальное'
];

/**
 * ID групп с дефолтным отключением
 */
export const DEFAULT_DISABLED_GROUPS = MOD_GROUPS
    .filter(g => g.defaultDisabled)
    .map(g => g.id);

export const SUB_CATEGORIES = ['ОПЦИОНАЛЬНЫЕ'];
