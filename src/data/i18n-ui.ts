export const i18nUiData = {
  common: {
    search: { en: "Search...", zh: "搜索..." },
    clear: { en: "Clear", zh: "清除" },
    cancel: { en: "Cancel", zh: "取消" },
    noResults: { en: "No results found", zh: "未找到结果" },
  },
  accountData: {
    importGOOD: {
      en: "Import .json file (GOOD)",
      zh: "导入 .json 文件 (GOOD)",
    },
    characters: { en: "Characters", zh: "角色" },
    inventory: { en: "Inventory", zh: "库存" },
    summary: { en: "Summary", zh: "概览" },
    maxLvlWeapons: { en: "Max Level Weapons", zh: "满级武器" },
    otherWeapons: { en: "Other Weapons", zh: "其他武器" },
    maxLvlArtifacts: { en: "Max Level Artifacts", zh: "满级圣遗物" },
    otherArtifacts: { en: "Other Artifacts", zh: "其他圣遗物" },
    noAccountDataLoaded: {
      en: "No account data loaded.",
      zh: "未加载账号数据。",
    },
    importPrompt: {
      en: "Import your data to unlock character builds, artifact scoring, and inventory insights.",
      zh: "导入数据以解锁角色配装、圣遗物评分和库存分析。",
    },
    noCharactersMatchFilters: {
      en: "No characters match your filters",
      zh: "没有角色匹配当前过滤条件",
    },
    noCharactersMatchFiltersDescription: {
      en: "Try adjusting your filter settings or clear all filters to see your characters.",
      zh: "尝试调整过滤设置或清除所有过滤条件以查看角色。",
    },
    importHelpGood: {
      en: "Full Data Import (Recommended)",
      zh: "完整数据导入（推荐）",
    },
    importHelpGoodDesc: {
      en: "Import a GOOD format JSON file exported from tools like",
      zh: "导入由第三方工具生成的 GOOD 格式 JSON 文件，例如",
    },
    importHelpUid: {
      en: "UID Import",
      zh: "UID 导入",
    },
    importHelpUidDesc: {
      en: "Fetch data from Enka Network. Limited to characters showcased on your profile.",
      zh: "从 Enka Network 获取数据。仅限个人资料展示的角色。",
    },
    importDialogTitle: {
      en: "Import Account Data",
      zh: "导入账号数据",
    },
    uidPlaceholder: {
      en: "Enter UID (e.g. 800000000)",
      zh: "输入 UID (如 100000000)",
    },
    failedToParseFile: {
      en: "Failed to parse file.",
      zh: "解析文件失败。",
    },
    importSuccess: {
      en: "Import successful!",
      zh: "导入成功！",
    },
    conversionWarning: {
      en: "Some items could not be imported",
      zh: "部分条目无法导入",
    },
    conversionWarningSkipped: {
      en: "skipped",
      zh: "已跳过",
    },
    noSetBonus: { en: "No Set Bonus", zh: "无套装效果" },
    artifactScore: {
      en: "Artifact Score",
      zh: "圣遗物评分",
    },
    score: {
      en: "Score",
      zh: "评分",
    },
    breakdownByStat: {
      en: "By Stat",
      zh: "属性详情",
    },
    valOverScore: {
      en: "Val / Score",
      zh: "数值 / 分数",
    },
    twoPiece: { en: "2-Piece", zh: "2件套" },
    fourPiece: { en: "4-Piece", zh: "4件套" },
    talents: {
      auto: { en: "Attack", zh: "普通攻击" },
      skill: { en: "Skill", zh: "元素战技" },
      burst: { en: "Burst", zh: "元素爆发" },
    },
    statWeights: { en: "Stat Weights", zh: "词条权重" },
    punishmentFactor: { en: "Punishment Factor", zh: "惩罚系数" },
    resetDefaults: { en: "Reset Defaults", zh: "重置默认" },
    resetGlobal: { en: "Reset", zh: "重置" },
    resetCharacters: { en: "Reset", zh: "重置" },
    resetGlobalConfirm: {
      en: "Reset global settings to default?",
      zh: "重置全局设置到默认值？",
    },
    resetCharactersConfirm: {
      en: "Reset all character weights to default?",
      zh: "重置所有角色权重到默认值？",
    },
    characterWeights: { en: "Character Stat Weights", zh: "角色词条权重" },
    flatAtk: { en: "Flat ATK", zh: "小攻击" },
    flatHp: { en: "Flat HP", zh: "小生命" },
    flatDef: { en: "Flat DEF", zh: "小防御" },
    searchPlaceholder: { en: "Search characters...", zh: "搜索角色..." },
    wrongMainStat: { en: "Ineffective main stat", zh: "无效主属性" },
    subStatScore: { en: "Sub", zh: "副词条" },
    weightWarning: {
      en: "Set a main stat (ATK%, HP%, DEF%, EM) to 100, or set at least two substats (CR, CD, ER, etc.) to 100.",
      zh: "需将一个主属性 (攻击%, 生命%, 防御%, 精通) 设为 100，或将至少两个副词条设为 100。",
    },
  },
  scoreExplanation: {
    title: { en: "Artifact Score Calculation", zh: "圣遗物评分计算逻辑" },
    description: {
      en: "How we derive the score for each artifact.",
      zh: "圣遗物评分是如何计算的？",
    },
    formula: {
      en: "Final Score = Stat Value × Normalization Factor × (Weight / 100) × [Punishment Factor]",
      zh: "最终评分 = 属性数值 × 折算系数 × (权重 / 100) × [惩罚系数]",
    },
    normalization: {
      title: { en: "Normalization Factor", zh: "折算系数" },
      description: {
        en: "The scoring system normalizes all stats to their 'Critical Damage' equivalent value based on the maximum possible roll for a 5-star artifact.",
        zh: "评分系统基于 5 星圣遗物的最大可能数值，将所有属性折算为等效的“暴击伤害”数值。",
      },
    },
    weight: {
      title: { en: "Weight", zh: "权重" },
      description: {
        en: "Determines how important a stat is for a specific character. The app provides default weights based on general build guides, but you can customize them to fit your specific needs.",
        zh: "决定了该属性对特定角色的重要程度。应用提供了基于通用攻略的默认权重，但您可以根据自己的需求进行自定义。",
      },
    },
    punishment: {
      title: { en: "Punishment Factor", zh: "惩罚系数" },
      description: {
        en: "Applied only to flat stats (ATK, HP, DEF) to reflect their reduced effectiveness compared to percentage stats. This is usually set between 30% to 40% for Lv.90-100 characters.",
        zh: "仅适用于固定数值属性（小攻击、小生命、小防御），以反映其相对于百分比属性较低的有效性。对于 90-100 级角色，通常设置为 30% 到 40%。",
      },
    },
    factors: {
      cr: { en: "Crit Rate: ×2", zh: "暴击率: ×2" },
      cd: { en: "Crit DMG: ×1", zh: "暴击伤害: ×1" },
      em: { en: "Elemental Mastery: ×0.3333", zh: "元素精通: ×0.3333" },
      er: { en: "Energy Recharge: ×1.1991", zh: "元素充能: ×1.1991" },
      atk: { en: "ATK% / HP%: ×1.3328", zh: "攻击%/生命%: ×1.3328" },
      def: { en: "DEF%: ×1.0658", zh: "防御%: ×1.0658" },
      ele: { en: "Elemental DMG: ×1.3348", zh: "元素伤害: ×1.3348" },
      phys: { en: "Physical DMG: ×1.0669", zh: "物理伤害: ×1.0669" },
      heal: { en: "Healing Bonus: ×1.7326", zh: "治疗加成: ×1.7326" },
      flatAtk: { en: "Flat ATK: ×0.3995", zh: "小攻击: ×0.3995" },
      flatHp: { en: "Flat HP: ×0.026", zh: "小生命: ×0.026" },
      flatDef: { en: "Flat DEF: ×0.3356", zh: "小防御: ×0.3356" },
    },
  },
  app: {
    title: { en: "GG Artifact", zh: "GG圣遗物" },
    language: { en: "Language", zh: "语言" },
    navArtifactFilter: { en: "Artifact Builds", zh: "圣遗物配装" },
    navAccountData: { en: "Account Data", zh: "账号数据" },
    navTierList: { en: "Character Tiers", zh: "角色榜单" },
    navWeaponBrowser: { en: "Weapon Browser", zh: "武器图鉴" },
    navTeamBuilder: { en: "Team Builder", zh: "队伍构建" },
    heroDescription: {
      en: "Powerful utilities to optimize your builds and organize your roster.",
      zh: "强大实用的工具，助您优化配装、管理角色养成。",
    },
    artifactFilterProblem: {
      en: "How to configure artifact filters?",
      zh: "圣遗物自动锁定怎么设置？",
    },
    artifactFilterGuideline: {
      en: "1. Use built-in presets for all characters or define your own. 2. Generate optimized filter configurations.",
      zh: "1. 使用内置的全角色预设，或自定义理想配装。 2. 自动生成优化的过滤配置。",
    },
    tierListProblem: {
      en: "Which character to build next?",
      zh: "哪个角色应该优先练？",
    },
    tierListGuideline: {
      en: "Stack rank characters per element to define your own progression priority.",
      zh: "按元素分组排名，规划属于你自己的培养优先级。",
    },
    accountDataProblem: {
      en: "How good are my builds?",
      zh: "我的角色练度毕业了吗？",
    },
    accountDataGuideline: {
      en: "1. Import via UID or tools like [Irminsul](https://konkers.github.io/irminsul/02-quickstart.html) / [Inventory Kamera](https://github.com/taiwenlee/Inventory_Kamera). 2. Get automated artifact scoring.",
      zh: "1. 通过 UID 或 [Irminsul](https://konkers.github.io/irminsul/02-quickstart.html) / [Inventory Kamera](https://github.com/taiwenlee/Inventory_Kamera) 导入数据。 2. 自动计算圣遗物评分。",
    },
    weaponBrowserProblem: {
      en: "Need a quick weapon reference?",
      zh: "想快速查阅或筛选武器？",
    },
    weaponBrowserGuideline: {
      en: "Browse all weapons by type, filter by rarity and stats. A convenient visual reference.",
      zh: "按武器类型浏览，按稀有度和属性筛选，便捷的可视化武器图鉴。",
    },
    teamBuilderProblem: {
      en: "Need help theory-crafting new teams?",
      zh: "正在科研新配队？",
    },
    teamBuilderGuideline: {
      en: "A visual workspace to build, experiment, and refine your team compositions.",
      zh: "可视化构筑与实验，打磨你的最强阵容。",
    },
    tierListTitle: { en: "Character Priority", zh: "角色优先级" },
    weaponTierListTitle: { en: "Weapon Priority", zh: "武器优先级" },
    export: { en: "Export", zh: "导出" },
    import: { en: "Import", zh: "导入" },
    clear: { en: "Clear", zh: "清除" },
    print: { en: "Download Image", zh: "下载图片" },
    generatingImage: { en: "Generating image...", zh: "正在生成图片..." },
    imageGenerated: {
      en: "Image generated successfully",
      zh: "图片生成成功",
    },
    imageGenerationFailed: {
      en: "Failed to generate image",
      zh: "图片生成失败",
    },
    explore: { en: "Explore", zh: "探索" },
  },
  theme: {
    switcherButton: { en: "Theme", zh: "主题" },
    abyss: { en: "Abyss", zh: "深渊" },
    mondstadt: { en: "Mondstadt", zh: "蒙德" },
    liyue: { en: "Liyue", zh: "璃月" },
    inazuma: { en: "Inazuma", zh: "稻妻" },
    sumeru: { en: "Sumeru", zh: "须弥" },
    fontaine: { en: "Fontaine", zh: "枫丹" },
    natlan: { en: "Natlan", zh: "纳塔" },
    snezhnaya: { en: "Snezhnaya", zh: "至冬" },
    nodkrai: { en: "Nod-Krai", zh: "挪德卡莱" },
  },
  teamBuilder: {
    teamName: { en: "Team Name", zh: "队伍名称" },
    copy: { en: "Copy", zh: "复制" },
    delete: { en: "Delete", zh: "删除" },
    character: { en: "Character", zh: "角色" },
    weapon: { en: "Weapon", zh: "武器" },
    artifact: { en: "Artifact", zh: "圣遗物" },
    teamLabel: { en: "Team", zh: "队伍" },
  },
  filters: {
    title: { en: "Filters", zh: "过滤" },
    clear: { en: "Clear", zh: "清除" },
    clearAll: { en: "Clear All", zh: "全部清除" },
    sort: { en: "Sort", zh: "排序" },
    sortByTier: { en: "Tier", zh: "评级" },
    sortByReleaseDate: { en: "Release Date", zh: "发布日期" },
    sortOff: { en: "Off", zh: "关" },
    sortAsc: { en: "Asc", zh: "升" },
    sortDesc: { en: "Desc", zh: "降" },
    tierSortDisabled: {
      en: "Configure tiers on the Tier List page first",
      zh: "请先在榜单页面配置评级",
    },
    elements: { en: "Elements", zh: "元素" },
    weaponTypes: { en: "Weapon Types", zh: "武器类型" },
    regions: { en: "Regions", zh: "地区" },
    rarity: { en: "Rarity", zh: "稀有度" },
    secondaryStat: { en: "Substat", zh: "副属性" },
    noWeaponsFound: {
      en: "No weapons match filters",
      zh: "没有武器匹配当前筛选",
    },
  },
  computeFilters: {
    title: { en: "Filters", zh: "过滤" },
    searchSets: { en: "Search Sets", zh: "搜索套装" },
    searchPlaceholder: { en: "Enter set name...", zh: "输入套装名称..." },
    noConfigurations: {
      en: "No Artifact Set Found",
      zh: "没有找到圣遗物套装",
    },
    configuration: { en: "Configuration", zh: "配置" },
    flower: { en: "Flower", zh: "生之花" },
    plume: { en: "Plume", zh: "死之羽" },
    sands: { en: "Sands", zh: "时之沙" },
    goblet: { en: "Goblet", zh: "空之杯" },
    circlet: { en: "Circlet", zh: "理之冠" },
    mainStat: { en: "Main Stat", zh: "主词条" },
    subStat: { en: "Substat", zh: "副词条" },
    atLeast: { en: "at least", zh: "至少" },
    any: { en: "Any", zh: "任意" },
    for: { en: "For", zh: "适用角色" },
    fourPc: { en: "4pc", zh: "四件套" },
    twoPc: { en: "2pc", zh: "两件套" },
    configurationNumber: { en: "Config", zh: "配置" },
    computeOptions: { en: "Compute Options", zh: "计算选项" },
    skipCritBuilds: {
      en: "Skip builds with both CR and CD required (if you already use CR+CD auto-lock in game)",
      zh: "跳过必选双暴的配装（如果你在游戏中已经使用双暴自动锁定）",
    },
    expandElementalGoblet: {
      en: "Treat any elemental DMG% goblet as all elemental DMG% (recommended)",
      zh: "将任意元素伤%空之杯视为所有元素伤%（推荐）",
    },
    expandCritCirclet: {
      en: "In 4pc builds, treat CR or CD circlet as both CR/CD (recommended)",
      zh: "4件套配装中，将暴击或暴伤理之冠视为两者皆可（推荐）",
    },
    mergeSingleFlexVariants: {
      en: "Merge configs that share must-have stats and only differ by one optional stat (recommended)",
      zh: "合并必选词条相同的配置（推荐）",
    },
    findRigidCommonSubset: {
      en: "Find common subset among configs with all substats required (recommended)",
      zh: "在类似配置中寻找共同必选词条（推荐）",
    },
    passChance: { en: "Pass chance", zh: "达标概率" },
    moderatePassChance: {
      en: "High pass chance – consider tightening this slot",
      zh: "达标概率偏高——建议收紧该部位要求",
    },
    highPassChance: {
      en: "Very high pass chance – this slot may be too permissive",
      zh: "达标概率过高——该部位条件可能过于宽松",
    },
  },
  configure: {
    noCharactersFound: { en: "No characters found", zh: "没有找到角色" },
    noCharactersDescription: {
      en: "Try adjusting your filters to see more characters",
      zh: "尝试调整您的过滤条件以查看更多角色",
    },
    clearAll: { en: "Clear all data", zh: "清除所有数据" },
    clearAllConfirmTitle: {
      en: "Clear all saved data?",
      zh: "清除所有保存的数据？",
    },
    clearAllConfirmDescription: {
      en: "This removes every build and visibility setting. This cannot be undone.",
      zh: "此操作会移除所有配装和隐藏设置，且无法撤销。",
    },
    clearAllConfirmAction: { en: "Yes, clear everything", zh: "确认清除" },
    presetDialogEmpty: {
      en: "No presets found. Add preset JSON files to the presets folder.",
      zh: "未找到预设。请在 presets 文件夹中添加预设 JSON 文件。",
    },
    presetDialogLoadError: {
      en: "Failed to load preset",
      zh: "预设加载失败",
    },
    presetConfirmTitle: { en: "Apply preset?", zh: "应用预设？" },
    presetConfirmDescription: {
      en: "This will replace current builds with the selected preset.",
      zh: "此操作会用所选预设替换当前配装。",
    },
    presetConfirmAction: { en: "Apply preset", zh: "应用预设" },
    importDialogTitle: { en: "Import builds", zh: "导入配装" },
    importDialogDescription: {
      en: "Choose from built-in presets or import from a local file.",
      zh: "从内置预设中选择，或从本地文件导入。",
    },
    importFromFile: { en: "Import from File", zh: "从文件导入" },
    importDialogLoadError: {
      en: "Failed to import file",
      zh: "文件导入失败",
    },
    clearBeforeImport: {
      en: "Clear data before import",
      zh: "导入前清除现有数据",
    },
    exportDialogTitle: { en: "Export builds", zh: "导出配装" },
    exportDialogDescription: {
      en: "Fill in the information below to export your builds.",
      zh: "填写以下信息以导出您的配装。",
    },
    exportAuthorLabel: { en: "Author", zh: "作者" },
    exportAuthorPlaceholder: {
      en: "Enter your name...",
      zh: "输入您的名字...",
    },
    exportDescriptionLabel: { en: "Description", zh: "描述" },
    exportDescriptionPlaceholder: {
      en: "Enter a description...",
      zh: "输入描述...",
    },
    exportConfirmAction: { en: "Export", zh: "导出" },
    exportAuthorRequired: { en: "Author is required", zh: "需要填写作者" },
    exportDescriptionRequired: {
      en: "Description is required",
      zh: "需要填写描述",
    },
  },
  navigation: {
    configure: { en: "Character Builds", zh: "角色配装" },
    computeFilters: {
      en: "Artifact Filters",
      zh: "圣遗物过滤器",
    },
  },
  characterCard: {
    addFirstBuild: { en: "Add First Build", zh: "添加第一个配装" },
    addBuild: { en: "Add Build", zh: "添加配装" },
    hideBuilds: { en: "Hide Builds", zh: "隐藏配装" },
    showBuilds: { en: "Show Builds", zh: "显示配装" },
    hiddenNotice: {
      en: "This character is hidden. Builds are ignored in computations.",
      zh: "该角色已隐藏。配装不参与计算。",
    },
  },
  buildCard: {
    buildLabel: { en: "Build", zh: "配装" },
    substats: { en: "Substats", zh: "副词条" },
    deselect: { en: "Deselect", zh: "取消选择" },
    atLeast: { en: "at least", zh: "至少" },
    affixes: { en: "affixes", zh: "个词条" },
    effect1: { en: "Effect 1", zh: "效果1" },
    effect2: { en: "Effect 2", zh: "效果2" },
    "4pc": { en: "4pc", zh: "4件套" },
    "2pc+2pc": { en: "2pc+2pc", zh: "2+2件套" },
    buildComplete: { en: "Build is complete", zh: "配装已完成" },
    sandsMainStat: { en: "Sands Main Stat", zh: "时之沙主词条" },
    gobletMainStat: { en: "Goblet Main Stat", zh: "空之杯主词条" },
    circletMainStat: { en: "Circlet Main Stat", zh: "理之冠主词条" },
    missing4pcSet: {
      en: "Missing 4-piece artifact set",
      zh: "缺少4件套圣遗物套装",
    },
    missing2pcSets: {
      en: "Missing 2-piece artifact sets",
      zh: "缺少2件套圣遗物套装",
    },
    select2pcPrompt: {
      en: "Select two different 2-piece Set Effects",
      zh: "选择两个不同的2件套效果",
    },
    select2pcPromptHint: {
      en: "You can combine any set that gives the same stat bonus.",
      zh: "您可以组合任意提供相同属性加成的套装。",
    },
    notEnoughSame2pcSets: {
      en: "Not enough artifact sets with the same 2-piece effect",
      zh: "相同2件套效果的圣遗物套装数量不足",
    },
    missingSandsMainStat: {
      en: "Need at least 1 sands main stat",
      zh: "需要至少1个时之沙主词条",
    },
    missingGobletMainStat: {
      en: "Need at least 1 goblet main stat",
      zh: "需要至少1个空之杯主词条",
    },
    missingCircletMainStat: {
      en: "Need at least 1 circlet main stat",
      zh: "需要至少1个理之冠主词条",
    },
    missingSubstat: {
      en: "Need at least 1 substat",
      zh: "需要至少1个副词条",
    },
  },
  tierList: {
    importDialogTitle: { en: "Import Tier List", zh: "导入榜单" },
    importDialogDescription: {
      en: "Choose from built-in presets or import from a local file.",
      zh: "从内置预设中选择，或从本地文件导入。",
    },
    presetConfirmTitle: { en: "Apply preset?", zh: "应用预设？" },
    presetConfirmDescription: {
      en: "This will replace your current tier list with the selected preset.",
      zh: "此操作会用所选预设替换当前榜单。",
    },
    presetConfirmAction: { en: "Apply preset", zh: "应用预设" },
    loadError: { en: "Failed to load tier list", zh: "榜单加载失败" },
    noPresets: { en: "No presets found", zh: "未找到预设" },
    importFromFile: { en: "Import from File", zh: "从文件导入" },
    exportDialogTitle: { en: "Export Tier List", zh: "导出榜单" },
    exportDialogDescription: {
      en: "Fill in the information below to export your tier list.",
      zh: "填写以下信息以导出您的榜单。",
    },
    exportAuthorLabel: { en: "Author", zh: "作者" },
    exportAuthorPlaceholder: {
      en: "Enter your name...",
      zh: "输入您的名字...",
    },
    exportDescriptionLabel: { en: "Description", zh: "Description" },
    exportDescriptionPlaceholder: {
      en: "Enter a description...",
      zh: "输入描述...",
    },
    exportAuthorRequired: { en: "Author is required", zh: "需要填写作者" },
    exportDescriptionRequired: {
      en: "Description is required",
      zh: "需要填写描述",
    },
    exportConfirmAction: { en: "Export", zh: "导出" },
  },
  messages: {
    itemMoved: { en: "{0} moved to {1}", zh: "{0} 移动到了 {1}" },
    itemRemoved: {
      en: "{0} removed from tier list",
      zh: "{0} 从榜单移除",
    },
    tierListReset: { en: "Tier list has been reset", zh: "榜单已重置" },
    customizationsSaved: {
      en: "Customizations saved",
      zh: "自定义设置已保存",
    },
    tierListSaved: { en: "Tier list saved successfully", zh: "榜单保存成功" },
    tierListSaveFailed: {
      en: "Failed to save tier list",
      zh: "保存榜单失败",
    },
    tierListLoaded: {
      en: "Tier list loaded successfully",
      zh: "榜单加载成功",
    },
  },
  buttons: {
    showWeapons: { en: "Show Weapon Types", zh: "显示武器类型" },
    showTravelers: { en: "Show Travelers", zh: "显示旅行者" },
    customize: { en: "Customize", zh: "自定义" },
    includeRarity5: { en: "5★ Weapons", zh: "5★武器" },
    includeRarity4: { en: "4★ Weapons", zh: "4★武器" },
    includeRarity3: { en: "3★ Weapons", zh: "3★武器" },
    help: { en: "Help", zh: "帮助" },
  },
  resetConfirmDialog: {
    title: { en: "Reset Tier List", zh: "重置榜单" },
    message: {
      en: "Are you sure you want to reset the tier list? This will clear all character assignments, custom tier names, and visibility settings. This action cannot be undone.",
      zh: "确定要重置榜单吗？这将清除所有角色分配、自定义梯度名称和显示设置。此操作无法撤销。",
    },
    confirm: { en: "Reset", zh: "重置" },
  },
  customizeDialog: {
    title: { en: "Customize Tiers", zh: "自定义梯度" },
    description: {
      en: "Customize tier names and visibility settings.",
      zh: "自定义梯度名称和可见性设置。",
    },
    customTitle: { en: "Tier List Title", zh: "榜单标题" },
    tierName: { en: "Tier Name", zh: "梯度名称" },
    defaultPrefix: { en: "Default: ", zh: "默认: " },
    hideTier: { en: "Hide Tier", zh: "隐藏梯度" },
    reset: { en: "Reset", zh: "重置" },
    cancel: { en: "Cancel", zh: "取消" },
    save: { en: "Save", zh: "保存" },
  },
  tiers: {
    Pool: { en: "Pool", zh: "角色池" },
    S: { en: "S", zh: "夯" },
    A: { en: "A", zh: "顶级" },
    B: { en: "B", zh: "人上人" },
    C: { en: "C", zh: "NPC" },
    D: { en: "D", zh: "拉完了" },
  },
  tour: {
    guide: {
      title: { en: "Guide", zh: "指南" },
      gotIt: { en: "Got it", zh: "知道了" },
      artifactFilter: {
        en: "1. Click {import} to use presets, or configure builds in {builds} tab.\n2. In {filters} tab, tweak custom controls to generate your own lock rules.",
        zh: "1. 点击 {import} 使用预设，或在 {builds} 标签页中配置配装。\n2. 在 {filters} 标签页中调整自定义选项以生成属于你的锁定规则。",
      },
      tierList: {
        en: "1. Use {import} to load community tier list presets.\n2. Use {customize} to modify tier names and settings.",
        zh: "1. 使用 {import} 加载社区榜单预设。\n2. 使用 {customize} 修改梯度名称和设置。",
      },
      accountData: {
        en: "1. Open {import} menu to find tools for GOOD JSON files (e.g. from Inventory Kamera) or import via UID (Enka).\n2. View build scores in {characters} tab.\n3. Configure scoring weights in {weights} tab.",
        zh: "1. 打开 {import} 菜单查找 GOOD JSON 文件工具（如 Inventory Kamera）或通过 UID (Enka) 导入。\n2. 在 {characters} 标签页中查看配装评分。\n3. 在 {weights} 标签页中配置评分权重。",
      },
    },
    artifactFilter: {
      presetsTitle: { en: "Import Presets", zh: "导入预设" },
      presetsContent: {
        en: "Start by importing community presets for quick setup, or create custom builds for each character.",
        zh: "从社区预设快速开始，或为每个角色创建自定义配装。",
      },
      buildCardTitle: { en: "Configure Builds", zh: "配置配装" },
      buildCardContent: {
        en: "Select artifact sets and substats for each character. The filter will keep artifacts that match your criteria.",
        zh: "为每个角色选择圣遗物套装和副词条。过滤器会保留符合条件的圣遗物。",
      },
      computeTabTitle: { en: "Generate Filters", zh: "生成过滤器" },
      computeTabContent: {
        en: "Switch to the Compute tab to see your optimized filter configuration, ready to use with artifact filtering tools.",
        zh: "切换到计算标签页查看优化后的过滤配置，可直接用于圣遗物过滤工具。",
      },
    },
    tierList: {
      unassignedTitle: { en: "Character Pool", zh: "角色池" },
      unassignedContent: {
        en: "All your characters start here. Drag them to tiers below to set your farming priorities.",
        zh: "所有角色都从这里开始。将他们拖到下方的梯度来设置培养优先级。",
      },
      tierRowTitle: { en: "Tier Rows", zh: "梯度行" },
      tierRowContent: {
        en: "Drag characters into tiers to rank them. Higher tiers = higher priority for farming and building.",
        zh: "将角色拖入梯度进行排名。梯度越高 = 培养优先级越高。",
      },
      customizeTitle: { en: "Customize Tiers", zh: "自定义梯度" },
      customizeContent: {
        en: "Rename tiers, hide unused ones, or add a custom list title for sharing.",
        zh: "重命名梯度、隐藏未使用的梯度，或添加自定义榜单标题以便分享。",
      },
      exportTitle: { en: "Share Your List", zh: "分享榜单" },
      exportContent: {
        en: "Export your tier list as an image to share with friends or on social media.",
        zh: "将榜单导出为图片，分享给朋友或发布到社交媒体。",
      },
    },
    accountData: {
      importTitle: { en: "Import Your Data", zh: "导入数据" },
      importContent: {
        en: "Import your character data using GOOD format (from Inventory Kamera or similar tools) or fetch directly from Enka.Network using your UID.",
        zh: "使用 GOOD 格式导入角色数据（来自 Inventory Kamera 等工具），或通过 UID 从 Enka.Network 获取。",
      },
      charactersTitle: { en: "Character Overview", zh: "角色概览" },
      charactersContent: {
        en: "View all your imported characters with their equipped artifacts and weapons. Click any character to see detailed stats.",
        zh: "查看所有导入的角色及其装备的圣遗物和武器。点击任意角色查看详细属性。",
      },
      summaryTitle: { en: "Artifact Summary", zh: "圣遗物概览" },
      summaryContent: {
        en: "Get a bird's-eye view of your artifact collection with scoring and quality metrics for each character.",
        zh: "全局查看你的圣遗物收藏，包含每个角色的评分和质量指标。",
      },
      weightsTitle: { en: "Stat Weights", zh: "词条权重" },
      weightsContent: {
        en: "Customize how artifact substats are weighted for scoring. Adjust these to match your playstyle preferences.",
        zh: "自定义圣遗物副词条的评分权重。根据你的玩法偏好进行调整。",
      },
    },
  },
};
