export const i18nUiData = {
  common: {
    search: { en: "Search...", zh: "搜索..." },
    loading: { en: "Loading...", zh: "加载中..." },
    clear: { en: "Clear", zh: "清除" },
    clearAccountData: { en: "Clear Account Data", zh: "清除账号数据" },
    clearBuilds: { en: "Clear Builds", zh: "清除配装" },
    clearTeams: { en: "Clear Teams", zh: "清除队伍" },
    clearTierList: { en: "Clear Tier List", zh: "清除排行" },
    active: { en: "Active", zh: "使用中" },
    home: { en: "Home", zh: "主页" },
    refresh: { en: "Refresh Page", zh: "刷新页面" },
    error: { en: "Something went wrong", zh: "出错了" },
    errorMsg: {
      en: "An unexpected error occurred.",
      zh: "发生了一个未知的错误。",
    },
    cancel: { en: "Cancel", zh: "取消" },
    reset: { en: "Reset", zh: "重置" },
    noResults: { en: "No results found", zh: "未找到结果" },
    duplicate: { en: "Duplicate", zh: "复制" },
    moveUp: { en: "Move Up", zh: "上移" },
    moveDown: { en: "Move Down", zh: "下移" },
    revert: { en: "Revert Changes", zh: "撤销更改" },
    delete: { en: "Delete", zh: "删除" },
    constellationFormat: { en: "C{0}", zh: "{0}命" },
    refinementFormat: { en: "R{0}", zh: "精{0}" },
    restore: { en: "Restore Preset", zh: "恢复预设" },
    gotIt: { en: "Got it", zh: "知道了" },
    save: { en: "Save", zh: "保存" },
    offFieldSuffix: { en: "(off-field)", zh: "(后台)" },
    partialOffFieldSuffix: { en: "(partial off-field)", zh: "(部分后台)" },
    damage: { en: "Damage", zh: "伤害" },
    stop: { en: "Stop", zh: "停止" },
    equip: { en: "Equip", zh: "装备" },
    level: { en: "Level", zh: "等级" },
    previous: { en: "Previous", zh: "上一步" },
    next: { en: "Next", zh: "下一步" },
    finish: { en: "Finish", zh: "完成" },
    stepOf: { en: "Step {0} of {1}", zh: "第 {0} / {1} 步" },
    addBuild: { en: "Add Build", zh: "添加配装" },
    ownedOnly: { en: "Owned Only", zh: "仅已拥有" },
    deleteTitle: { en: "Delete Build?", zh: "删除配装？" },
    revertTitle: { en: "Revert Changes?", zh: "撤销更改？" },
    restoreTitle: { en: "Restore Preset Defaults?", zh: "恢复预设默认值？" },
    deleteConfirm: {
      en: "This will delete this build configuration. If it belongs to a preset, it will be hidden.",
      zh: "这将删除此配装配置。如果它属于预设，它将被隐藏。",
    },
    revertConfirm: {
      en: "This will discard your local changes and restore the original preset configuration.",
      zh: "这将丢弃您的本地更改并恢复原始预设配置。",
    },
    restoreConfirm: {
      en: "This will remove all custom builds and weapon settings for this character. This action cannot be undone.",
      zh: "这将删除此角色的所有自定义配装和武器设置。此操作无法撤销。",
    },
    confirmDelete: {
      en: "Are you sure you want to delete this profile?",
      zh: "确定要删除此账号配置吗？",
    },
  },
  import: {
    action: { en: "Import", zh: "导入" },
    dialogDescription: {
      en: "Choose from built-in presets or import from a local file.",
      zh: "从内置预设中选择，或从本地文件导入。",
    },
    fromFile: { en: "Import from File", zh: "从文件导入" },
    presetConfirmTitle: { en: "Apply preset?", zh: "应用预设？" },
    presetConfirmAction: { en: "Apply preset", zh: "应用预设" },
    fileLoadError: { en: "Failed to import file", zh: "文件导入失败" },
    clearBeforeImport: { en: "Clear existing data", zh: "清除现有数据" },
    titleBuilds: { en: "Import builds", zh: "导入配装" },
    titleTierList: { en: "Import Tier List", zh: "导入榜单" },
    titleAccountData: { en: "Import Account Data", zh: "导入账号数据" },
    confirmDescBuilds: {
      en: "This will replace current builds with the selected preset.",
      zh: "此操作会用所选预设替换当前配装。",
    },
    confirmDescTierList: {
      en: "This will replace your current tier list with the selected preset.",
      zh: "此操作会用所选预设替换当前榜单。",
    },
    presetLoadError: { en: "Failed to load preset", zh: "预设加载失败" },
    loadErrorTierList: {
      en: "Failed to load tier list",
      zh: "榜单加载失败",
    },
    titleTeamComp: { en: "Import Team Comp", zh: "导入队伍配队" },
    confirmDescTeamComp: {
      en: "This will replace your current teams with the selected preset.",
      zh: "此操作会用所选预设替换当前队伍。",
    },
    loadErrorTeamComp: {
      en: "Failed to load team comp",
      zh: "队伍配队加载失败",
    },
    presetEmpty: { en: "No presets found", zh: "未找到预设" },
    presetEmptyBuilds: {
      en: "No presets found. Add preset JSON files to the presets folder.",
      zh: "未找到预设。请在 presets 文件夹中添加预设 JSON 文件。",
    },
    fileTitle: { en: "Import File", zh: "导入文件" },
    actionPrompt: {
      en: "Choose how you want to import these builds:",
      zh: "请选择导入方式：",
    },
    actionSubscribe: { en: "Subscribe", zh: "订阅" },
    actionSubscribeDesc: {
      en: "You will receive updates automatically. Your customizations will be saved alongside the preset.",
      zh: "您将接收自动预设更新。您的自定义修改将作为增量保存。",
    },
    actionCopy: { en: "Copy to Local", zh: "复制到本地" },
    actionCopyDesc: {
      en: "One-time import. No future updates unless manual re-import.",
      zh: "一次性导入。除非手动重新导入，否则不会有后续更新。",
    },
    goodFileButton: { en: "Import .json file", zh: "导入 .json 文件" },
    goodTitle: { en: "Full Data Import", zh: "完整数据导入" },
    badgeRecommended: { en: "Recommended", zh: "推荐" },
    goodBenefit: {
      en: "Full artifact inventory with swap, upgrade, and reroll recommendations.",
      zh: "完整背包数据，获取替换、强化和洗练建议。",
    },
    goodRequiresPC: {
      en: "Use a PC scanner tool to export your account data as a GOOD format .json file",
      zh: "需要在电脑上运行扫描工具，将账号数据导出为 GOOD 格式 .json 文件",
    },
    toolIrminsul: {
      en: "Irminsul (Packet Capture)",
      zh: "Irminsul (抓包)",
    },
    toolGoodScanner: {
      en: "GOODScanner (OCR, 16:9 Chinese client)",
      zh: "GOODScanner (扫图, 16:9)",
    },
    wrongFormatGOOD: {
      en: "This file is not in GOOD format. Please export using a supported scanner tool.",
      zh: "该文件不是 GOOD 格式，请使用支持的扫描工具导出。",
    },
    uidTitle: { en: "Quick UID Import", zh: "UID 快捷导入" },
    uidDescription: {
      en: "Fetch from Enka Network. Limited to 12 showcase characters and their equipments. Make sure you allowed character details!",
      zh: "通过 Enka Network 获取。仅限 12 个展示角色及其装备。确保你打开了角色详情！",
    },
    uidPlaceholder: {
      en: "Enter UID (e.g. 800000000)",
      zh: "输入 UID (如 100000000)",
    },
    optionalUidPlaceholder: { en: "Optional UID", zh: "UID（选填）" },
    uidRequiredForNewProfile: {
      en: "UID required for new profile",
      zh: "新建配置需要填写 UID",
    },
    uidInvalid: {
      en: "UID must be 9–10 digits",
      zh: "UID 须为 9–10 位数字",
    },
  },
  export: {
    action: { en: "Export", zh: "导出" },
    authorLabel: { en: "Author", zh: "作者" },
    authorPlaceholder: { en: "Enter your name...", zh: "输入您的名字..." },
    descriptionLabel: { en: "Description", zh: "描述" },
    descriptionPlaceholder: {
      en: "Enter a description...",
      zh: "输入描述...",
    },
    authorRequired: { en: "Author is required", zh: "需要填写作者" },
    descriptionRequired: {
      en: "Description is required",
      zh: "需要填写描述",
    },
    titleBuilds: { en: "Export builds", zh: "导出配装" },
    descBuilds: {
      en: "Fill in the information below to export your builds.",
      zh: "填写以下信息以导出您的配装。",
    },
    titleTierList: { en: "Export Tier List", zh: "导出榜单" },
    descTierList: {
      en: "Fill in the information below to export your tier list.",
      zh: "填写以下信息以导出您的榜单。",
    },
    titleTeamComp: { en: "Export Team Comp", zh: "导出队伍配队" },
    descTeamComp: {
      en: "Fill in the information below to export your team compositions.",
      zh: "填写以下信息以导出您的队伍配队。",
    },
  },

  accountData: {
    characters: { en: "Characters", zh: "角色" },
    inventory: { en: "Inventory", zh: "库存" },
    recommendations: { en: "Recommendations", zh: "推荐" },
    weapons: { en: "Weapons", zh: "武器" },
    artifacts: { en: "Artifacts", zh: "圣遗物" },
    equipped: { en: "Equipped", zh: "已装备" },
    unequipped: { en: "Unequipped", zh: "未装备" },
    maxLevel: { en: "Max Level", zh: "满级" },
    other: { en: "Other Level", zh: "未满级" },
    sameSet: { en: "Same Set", zh: "同套装" },
    allOther: { en: "All Other", zh: "其他套装" },
    noAccountDataLoaded: {
      en: "No account data loaded.",
      zh: "未加载账号数据。",
    },
    importPrompt: {
      en: "Import your data to unlock character builds, artifact scoring, and inventory insights.",
      zh: "导入数据以解锁角色配装、圣遗物评分和库存分析。",
    },
    emptyStateEnkaTitle: {
      en: "Enka UID",
      zh: "Enka UID",
    },
    emptyStateEnkaDesc: {
      en: "Paste your UID to fetch your showcase characters instantly.",
      zh: "粘贴 UID 即可即时获取你的展示角色。",
    },
    emptyStateGoodTitle: {
      en: "GOOD JSON",
      zh: "GOOD JSON",
    },
    emptyStateGoodDesc: {
      en: "Upload a full artifact scanner export for complete analysis.",
      zh: "上传完整的圣遗物扫描导出文件以获得全面分析。",
    },
    emptyStateAfterImport: {
      en: "After importing, you'll see build scores, upgrade recommendations, and inventory insights.",
      zh: "导入后，你将看到配装评分、升级建议和库存分析。",
    },
    importProfileSelect: { en: "Select Profile", zh: "选择账号配置" },
    manageProfiles: { en: "Manage Profiles", zh: "管理账号配置" },
    importProfileDesc: {
      en: "Choose a profile to import into, or create a new one.",
      zh: "选择要导入的账号配置，或新建一个。",
    },
    manageProfilesDesc: {
      en: "Switch, rename, or delete your profiles.",
      zh: "切换、重命名或删除您的账号配置。",
    },
    createNewProfile: { en: "Create New Profile", zh: "创建新配置" },
    addProfile: { en: "Import Data", zh: "导入数据" },
    willBeAssigned: {
      en: "will be assigned to this profile",
      zh: "将绑定到此配置",
    },
    createProfile: { en: "Create Profile", zh: "创建配置" },
    defaultAccount: { en: "Default Account", zh: "默认账号" },
    accounts: { en: "Accounts", zh: "账号管理" },
    account: { en: "Account", zh: "账号" },
    noCharactersMatchFilters: {
      en: "No characters match your filters",
      zh: "没有角色匹配当前过滤条件",
    },
    noCharactersMatchFiltersDescription: {
      en: "Try adjusting your filter settings or clear all filters to see your characters.",
      zh: "尝试调整过滤设置或清除所有过滤条件以查看角色。",
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
    statCount: { en: "Count", zh: "词条" },
    valOverScore: {
      en: "Val / Count",
      zh: "数值 / 词条数",
    },
    current: { en: "Before", zh: "之前" },
    upgrade: { en: "After", zh: "之后" },
    empty: { en: "Empty", zh: "空" },
    artifactDetails: { en: "Artifact Details", zh: "圣遗物详情" },
    totalRolls: { en: "{0} total rolls", zh: "{0} 总词条数" },
    twoPiece: { en: "2-Piece", zh: "2件套" },
    fourPiece: { en: "4-Piece", zh: "4件套" },
    talents: {
      auto: { en: "Attack", zh: "普通攻击" },
      skill: { en: "Skill", zh: "元素战技" },
      burst: { en: "Burst", zh: "元素爆发" },
    },
    punishmentFactor: { en: "Punishment Factor", zh: "惩罚系数" },
    resetDefaults: { en: "Reset Defaults", zh: "重置默认" },
    resetGlobalConfirm: {
      en: "Reset global settings to default?",
      zh: "重置全局设置到默认值？",
    },
    flatAtk: { en: "Flat ATK", zh: "小攻击" },
    flatHp: { en: "Flat HP", zh: "小生命" },
    flatDef: { en: "Flat DEF", zh: "小防御" },
    wrongMainStat: { en: "Ineffective main stat", zh: "无效主属性" },
    subStatScore: { en: "Sub", zh: "副词条" },
    mainStatContrib: { en: "Main", zh: "主属性" },
    subStatContrib: { en: "Sub", zh: "副属性" },
    outOf300: { en: "/ 300", zh: "/ 300" },
    scoreChangeAnnouncement: {
      title: {
        en: "Scoring Revamped",
        zh: "评分系统已升级",
      },
      headline: {
        en: "Every character's max score is now",
        zh: "所有角色的满分统一为",
      },
      detail: {
        en: "Main stats are now scored alongside substats.",
        zh: "主属性现与副属性一同计入评分。",
      },
      note: {
        en: "Tap a character's score to see the breakdown.",
        zh: "点击角色评分即可查看详细拆分。",
      },
    },
    scoredUsing: {
      en: "Scored using: {0}",
      zh: "基于配装评分: {0}",
    },
    viewBuilds: { en: "View Builds", zh: "查看配装" },
    noBuildConfigured: {
      en: "No build configured. Scores use Crit Rate and Crit DMG only.",
      zh: "未配置配装，仅基于暴击率和暴击伤害评分。",
    },
    insights: {
      title: { en: "Recommended Actions", zh: "推荐操作" },
      upgrade: { en: "Upgrade", zh: "强化" },
      swap: { en: "Swap", zh: "替换" },
      reroll: { en: "Reroll", zh: "洗词条" },
      farm: { en: "Farm", zh: "刷取" },
      fixMain: { en: "Fix Main", zh: "修正主词条" },
      fromInventory: { en: "In Inventory", zh: "背包中" },
      fromCharacter: { en: "from {0}", zh: "取自 {0}" },
      rerollCost: {
        en: "{0} Dust",
        zh: "{0} 启圣之尘",
      },
      farmOrCraft: {
        en: "Or craft: {0} Elixir",
        zh: "或制作: {0} 祝圣之霜",
      },
      allGood: { en: "All Good!", zh: "完美!" },
      allGoodDescription: {
        en: "No suggestions for this character.",
        zh: "这个角色没有优化建议。",
      },
      poolInfo: {
        en: "Characters in the Pool are not computed for recommendations. Their equipped artifacts may even be suggested for other characters to swap.",
        zh: "角色池中的角色不计算推荐操作。他们装备的圣遗物甚至有可能被推荐给其他角色使用。",
      },
      goToTierList: { en: "Manage Tiers", zh: "管理层级" },
      showMore: { en: "Show {0} more", zh: "展开更多 ({0})" },
      showLess: { en: "Show less", zh: "收起" },
    },
    recNoRecommendations: {
      en: "No recommendations — all builds are optimal!",
      zh: "无推荐 — 所有配装已最优！",
    },
    luckExpectation: {
      label: { en: "Roll Value Expectation", zh: "词条期望" },
      description: {
        en: "How much stamina to invest in this group",
        zh: "为该组角色投入多少体力",
      },
      tooltip: {
        en: "Use {0}× max roll value to predict score",
        zh: "使用 {0}× 最高词条值来预测分数",
      },
      cautious: { en: "Cautious", zh: "保守" },
      balanced: { en: "Balanced", zh: "平衡" },
      hopeful: { en: "Hopeful", zh: "乐观" },
    },
    investmentLevel: {
      label: { en: "Min. Score Diff", zh: "最低分差" },
    },
  },
  charEdit: {
    description: { en: "Edit character data", zh: "编辑角色数据" },
    constellation: { en: "Constellation", zh: "命座" },
    refinement: { en: "Refinement", zh: "精炼" },
    mainStat: { en: "Main Stat", zh: "主属性" },
    substats: { en: "Substats", zh: "副属性" },
    addSubstat: { en: "Add substat", zh: "添加副属性" },
    change: { en: "Change", zh: "更换" },
    stash: { en: "Stash", zh: "卸下" },
    equipWeapon: { en: "Equip Weapon", zh: "装备武器" },
    emptySlot: { en: "No artifact in this slot", zh: "此位置无圣遗物" },
    create: { en: "Create", zh: "创建" },
    equippedByOthers: { en: "On Other Characters", zh: "其他角色装备中" },
    willSwap: { en: "Will swap", zh: "将交换" },
    createNew: { en: "Create New", zh: "新建" },
    editMode: { en: "Edit", zh: "编辑" },
  },
  scoreExplanation: {
    title: { en: "Artifact Score Calculation", zh: "圣遗物评分计算逻辑" },
    description: {
      en: "How we derive the artifact score (out of 300) for each character.",
      zh: "角色的圣遗物评分（满分 300）是如何计算的？",
    },
    formula: {
      en: "Score = ( Main Stat Score + Substat Score ) × Normalizer",
      zh: "评分 = ( 主属性分 + 副属性分 ) × 归一化系数",
    },
    subFormula: {
      en: "Substat Score = Σ( Value × CD-Equiv Factor × Weight/100 × [Punishment] )",
      zh: "副属性分 = Σ( 数值 × 暴伤折算系数 × 权重/100 × [惩罚系数] )",
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
      description: {
        en: "Applied only to flat stats (ATK, HP, DEF) to reflect their reduced effectiveness compared to percentage stats. This is usually set between 30% to 40% for Lv.90-100 characters.",
        zh: "仅适用于固定数值属性（小攻击、小生命、小防御），以反映其相对于百分比属性较低的有效性。对于 90-100 级角色，通常设置为 30% 到 40%。",
      },
    },
    mainStat: {
      title: { en: "Main Stat Scoring", zh: "主属性评分" },
      description: {
        en: "The sands, goblet, and circlet main stats are scored when they match the build's recommendation. A correct 5★ main stat is worth 62.1 CD-equivalent points (46.4 for 4★). Wrong main stats contribute 0.",
        zh: "当沙漏、杯子和头冠的主属性与配装推荐一致时，会计入评分。正确的 5★ 主属性等效 62.1 暴伤点（4★ 为 46.4）。错误的主属性贡献为 0。",
      },
    },
    scale300: {
      title: { en: "300-Point Scale", zh: "300 分制" },
      description: {
        en: "The total score (main stats + substats) is normalized to a 300-point scale. 300 represents a theoretically perfect artifact set — correct main stats on all 3 slots, plus ideal substat rolls distributed across your top weighted stats.",
        zh: "总分（主属性 + 副属性）被归一化为 300 分制。300 分代表理论上的完美圣遗物套装 — 3 个位置的主属性全部正确，且副属性词条完美分配到最高权重的属性上。",
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
    navArtifactFilter: { en: "Builds", zh: "配装" },
    navAccountData: { en: "Account Data", zh: "账号数据" },
    navTierList: { en: "Tier List", zh: "榜单" },
    navArchive: { en: "Archive", zh: "图鉴" },
    navTeamComp: { en: "DMG Optimizer", zh: "伤害优化" },
    heroDescription: {
      en: "Powerful utilities to optimize your builds and organize your roster.",
      zh: "强大实用的工具，助您优化配装、管理角色养成。",
    },
    artifactFilterProblem: {
      en: "How to configure artifact filters?",
      zh: "圣遗物自动锁定怎么设置？",
    },
    artifactFilterGuideline: {
      en: "Never gonna let that bag blow up again.",
      zh: "背包再也不会爆炸了。",
    },
    tierListProblem: {
      en: "Which character to build next?",
      zh: "哪个角色应该优先练？",
    },
    tierListGuideline: {
      en: "You decide who's best.",
      zh: "谁强谁弱，你说了算。",
    },
    accountDataProblem: {
      en: "How good are my builds?",
      zh: "我的角色练度毕业了吗？",
    },
    accountDataGuideline: {
      en: "Are you really giving him/her your best?",
      zh: "你真的把最好的给TA了吗？",
    },
    archiveProblem: {
      en: "Looking up character or weapon details?",
      zh: "想查阅角色或武器详情？",
    },
    archiveGuideline: {
      en: "Everyone, everything, all together.",
      zh: "整整齐齐，一个不落。",
    },
    teamCompProblem: {
      en: "How can my team do more damage?",
      zh: "我的队伍怎么打更多伤害？",
    },
    teamCompGuideline: {
      en: "The numbers don't lie. Just sayin'.",
      zh: "不算不知道，一算吓一跳。",
    },
    navMoreToCome: { en: "More", zh: "更多" },
    moreProblem: {
      en: "Got ideas or feedback?",
      zh: "有想法或建议？",
    },
    moreGuideline: {
      en: "Join the Discord community! QQ Group: 1036645331",
      zh: "加入 Discord 社区！QQ群：1036645331",
    },
    ctaScoreArtifacts: { en: "Score My Artifacts", zh: "评估圣遗物" },
    ctaConfigureFilters: { en: "Compute Filters", zh: "计算过滤器" },
    ctaRankCharacters: { en: "Rank Characters", zh: "排列角色" },
    ctaBrowseDetails: { en: "Browse Archive", zh: "浏览图鉴" },
    ctaCalculateDamage: { en: "Optimize Damage", zh: "优化伤害" },
    ctaJoinCommunity: { en: "Join Community", zh: "加入社区" },
    tierListTitle: { en: "Character Priority", zh: "角色优先级" },
    weaponTierListTitle: { en: "Weapon Priority", zh: "武器优先级" },

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
    presetLoaded: { en: "Preset loaded", zh: "预设已加载" },
    imported: { en: "Builds imported", zh: "配装已导入" },
    disclaimer: {
      en: "Genshin Impact is a trademark of HoYoverse. This project is not affiliated with or endorsed by HoYoverse.",
      zh: "《原神》为米哈游/HoYoverse的商标，本项目与其无关联。",
    },
    dataAttribution: {
      en: "Game data sourced from HoYoWiki.",
      zh: "游戏数据来源于 HoYoWiki。",
    },
    presetPromptTitle: {
      en: "Get Started with Presets",
      zh: "使用预设快速开始",
    },
    presetPromptDesc: {
      en: "Load optimized artifact builds for every character — curated by GGArtifact, customizable by you.",
      zh: "加载GGArtifact精选的全角色圣遗物配装——随时可按你的想法自定义。",
    },
    presetPromptBenefit: {
      en: "All characters covered. Sets, main stats, and substats optimized for all constellations. Tweak anything anytime.",
      zh: "覆盖全部角色。各种命座的配装一应俱全。随时可调。",
    },
    presetPromptYes: { en: "Enable Preset", zh: "启用预设" },
    presetPromptNo: { en: "No Thanks", zh: "暂时不用" },
    presetPromptNoticeTitle: {
      en: "No Problem!",
      zh: "没问题！",
    },
    presetPromptNoticeDesc: {
      en: "You can load presets anytime from the Import button on the Artifact Builds page.",
      zh: "随时可通过圣遗物配装页面的导入按钮加载预设。",
    },

    presetMigrateTitle: {
      en: "Existing Builds Found",
      zh: "检测到已有配装",
    },
    presetMigrateDesc: {
      en: "You already have custom builds. How would you like to proceed?",
      zh: "你已有自定义配装数据，请选择如何处理：",
    },
    presetMigrateFresh: { en: "Start Fresh", zh: "从零开始" },
    presetMigrateFreshDesc: {
      en: "Clear existing builds and use the preset only.",
      zh: "清除现有配装，仅使用预设。",
    },
    presetMigrateKeep: { en: "Keep My Builds", zh: "保留我的配装" },
    presetMigrateKeepDesc: {
      en: "Layer the preset underneath your existing builds.",
      zh: "在你现有配装的基础上加载预设。",
    },
  },
  archive: {
    characters: { en: "Character Archive", zh: "角色图鉴" },
    weapons: { en: "Weapon Archive", zh: "武器图鉴" },
    artifacts: { en: "Artifact Archive", zh: "圣遗物图鉴" },
    bosses: { en: "Stygian Onslaught", zh: "幽境危战图鉴" },
    bossSelectPrompt: {
      en: "Select a boss to view details",
      zh: "选择Boss查看详情",
    },
    bossList: { en: "Boss List", zh: "Boss列表" },
    bossBaseRes: { en: "Base Resistance", zh: "基础抗性" },
    bossResStates: { en: "Resistance States", zh: "状态抗性变化" },
    bossMechanics: { en: "Combat Mechanics", zh: "战斗机制" },
    bossParams: { en: "Parameters", zh: "参数" },
    bossDescShort: { en: "Short", zh: "简略" },
    bossDescDetailed: { en: "Detailed", zh: "详细" },
    bossTier1: { en: "Normal", zh: "普通" },
    bossTier2: { en: "Advancing", zh: "进阶" },
    bossTier3: { en: "Hard", zh: "困难" },
    bossTier4: { en: "Menacing", zh: "险恶" },
    bossTier5: { en: "Fearless", zh: "无畏" },
    bossTier6: { en: "Dire", zh: "绝境" },
    bossSearchPlaceholder: { en: "Search bosses...", zh: "搜索Boss..." },
    bossTierDetails: { en: "Tier Details", zh: "难度详情" },
    characterLabel: { en: "characters", zh: "角色" },
    searchPlaceholder: {
      en: "Search names, skills, passives, constellations...",
      zh: "搜索名称、天赋、被动、命座...",
    },
    baseStats: { en: "Base Stats", zh: "基础属性" },
    lv90: { en: "Lv. 90", zh: "90级" },
    lv100: { en: "Lv. 100", zh: "100级" },
    skills: { en: "Skills", zh: "战斗天赋" },
    passives: { en: "Passives", zh: "固有天赋" },
    constellations: { en: "Constellations", zh: "命之座" },
    glossary: { en: "Glossary", zh: "术语表" },
    noCharacterSelected: {
      en: "Select a character to view details",
      zh: "选择一个角色查看详情",
    },
    artifactBuilds: { en: "Artifact Builds", zh: "圣遗物配装" },
    goToAccountData: {
      en: "Import data in Account Data",
      zh: "前往账号数据页面导入",
    },
    noResults: {
      en: "No characters match your search",
      zh: "没有角色匹配搜索",
    },
    searchItemPlaceholder: {
      en: "Search name, effects...",
      zh: "搜索名称、特效...",
    },
    noWeaponResults: {
      en: "No weapons match your search",
      zh: "没有武器匹配搜索",
    },
    noArtifactResults: {
      en: "No artifacts match your search",
      zh: "没有圣遗物匹配搜索",
    },
    notReleased: { en: "Character is not released yet", zh: "该角色尚未实装" },
    owned: { en: "Owned", zh: "已拥有" },
    notOwned: { en: "Not Owned", zh: "未拥有" },
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
  teamComp: {
    emptyTeamTitle: {
      en: "Build your first team",
      zh: "创建你的第一支队伍",
    },
    emptyTeamDesc: {
      en: "Pick 4 characters, assign weapons and artifacts, then calculate optimized damage.",
      zh: "选择4个角色、分配武器和圣遗物，然后计算优化伤害。",
    },
    emptyTeamOrImport: {
      en: "Or import a community team preset to get started.",
      zh: "或导入社区队伍预设以快速开始。",
    },
    teamName: { en: "Team Name", zh: "队伍名称" },
    weapon: { en: "Weapon", zh: "武器" },
    artifact: { en: "Artifact", zh: "圣遗物" },
    newTeamStart: { en: "New Team (Top)", zh: "新建队伍（顶部）" },
    newTeamEnd: { en: "New Team (Bottom)", zh: "新建队伍（底部）" },
    enemyAura: { en: "Enemy Element:", zh: "敌方元素:" },
    enemyAuraNone: { en: "None", zh: "无" },
    reactions: { en: "Reactions", zh: "元素反应" },
    teamOptimization: { en: "Damage Optimization", zh: "伤害优化" },
    teamRoster: { en: "Team Roster", zh: "队伍成员" },
    minEr: { en: "Min. ER", zh: "最低充能" },
    minCr: { en: "Min. CR", zh: "最低暴击" },
    clearTeamData: { en: "Clear Team Data", zh: "清空队伍数据" },
    setupError: { en: "Setup Error:", zh: "设置错误：" },
    equipAndDamage: { en: "Artifacts & Damage", zh: "圣遗物 & 伤害" },
    optimizing: { en: "Optimizing…", zh: "正在优化…" },
    totalExpectedDamage: { en: "Total Expected Damage:", zh: "总伤害期望：" },
    pending: { en: "Pending", zh: "等待计算" },
    emptyDamageMessage: {
      en: "Configure characters and weapons to see damage metrics.",
      zh: "配置队伍成员以查看伤害期望。",
    },
    emptyComboMessage: {
      en: "Add formula counts in the combo tab to see total rotation damage.",
      zh: "在循环公式面板中添加公式次数以查看循环总伤害。",
    },
    partialReactionNote: {
      en: "Not all hits in this formula are using reactions — partial reaction settings from single mode are applied.",
      zh: "此公式并非所有命中均使用元素反应——已应用单公式模式的部分反应设置。",
    },
    max: { en: "Max", zh: "最大面板" },
    conditional: { en: "Details", zh: "详细面板" },
    onField: { en: "On-Field", zh: "站场" },
    offField: { en: "Off-Field", zh: "后台" },
    universal: { en: "Universal", zh: "通用" },
    stats: { en: "Stats", zh: "详细属性" },
    noStatsResolved: { en: "No stats resolved.", zh: "无计算结果" },
    marginalGains: { en: "Marginal", zh: "边际收益" },
    avgVal: { en: "Avg. ", zh: "均值 " },
    gain: { en: "Gain", zh: "提升" },
    levelUpGain: { en: "Lv{0} → Lv{1}", zh: "{0}级 → {1}级" },
    base: { en: "Base", zh: "基础" },
    buffsLedger: { en: "Buffs & Effects Ledger", zh: "Buff 效果明细表" },
    hideTrivial: { en: "Hide trivial/inactive", zh: "隐藏次要/未激活效果" },
    showAllBuffs: { en: "Show all buffs", zh: "显示所有效果" },
    teamResonance: { en: "Team Resonance", zh: "队伍共鸣" },
    noBuffsOriginate: { en: "No buffs originating", zh: "未提供 Buff 效果" },
    receiverSelf: { en: "Self", zh: "自身" },
    receiverSelfOnField: { en: "Self (On-Field)", zh: "自身（前台）" },
    receiverSelfOffField: { en: "Self (Off-Field)", zh: "自身（后台）" },
    receiverOther: { en: "Others", zh: "他人" },
    receiverOtherOnField: { en: "Other (On-Field)", zh: "他人（前台）" },
    receiverOnField: { en: "On-Field", zh: "前台角色" },
    receiverTeam: { en: "Team", zh: "全队" },
    equippedSetDiffers: {
      en: "Equipped set differs from Team Roster goal",
      zh: "已装备的套装与队伍配置目标不一致",
    },
    overrideConst: { en: "Const.", zh: "命座" },
    overrideRefine: { en: "Refine", zh: "精炼" },
    enemyLevel: { en: "Enemy Lv.", zh: "怪物等级" },
    enemyRes: { en: "Enemy RES", zh: "怪物抗性" },
    assumeCrit: { en: "Assume CRIT", zh: "默认暴击" },
    critRateTarget: { en: "DPS CR Target", zh: "(凹分)主C暴击目标" },
    critRateTargetTooltip: {
      en: "Adds a (100−x)% CR buff to the main DPS during calculation. In rotation mode, any character with a damage formula is treated as main DPS.",
      zh: "计算时会给主C添加一个(100-x)%的暴击率buff。循环模式下带有伤害公式的角色均视为主C。",
    },
    rollMultiplier: { en: "Roll Growth", zh: "词条成长" },
    idealSubstatBudget: {
      en: "Rolls Count",
      zh: "词条数",
    },
    emptyOptMessage: {
      en: "Press Run Optimization to find the best artifact loadout.",
      zh: "点击「开始优化」寻找最优圣遗物配装。",
    },
    noValidCombinations: {
      en: "No valid combinations found for ER {0}%.",
      zh: "未找到满足 {0}% 充能要求的配装组合。",
    },
    failEmptyPool: {
      en: "No artifacts for: {0}",
      zh: "以下部位无圣遗物：{0}",
    },
    failNoSeeds: {
      en: "No valid artifact combinations found",
      zh: "未找到可用的圣遗物组合",
    },
    failErUnmet: {
      en: "ER too low: need {0}%, best {1}%",
      zh: "充能不足：需要 {0}%，最高 {1}%",
    },
    failCrUnmet: {
      en: "CR too low: need {0}%, best {1}%",
      zh: "暴击不足：需要 {0}%，最高 {1}%",
    },
    failSetImpossible: {
      en: "Not enough pieces for: {0}",
      zh: "套装件数不足：{0}",
    },
    failAllFiltered: {
      en: "All {0} combos failed constraints",
      zh: "全部 {0} 个组合均不满足约束",
    },
    preparingOptimizer: {
      en: "Preparing optimizer…",
      zh: "正在准备优化器…",
    },
    optimizerError: { en: "Optimization Error:", zh: "优化错误：" },
    ignoreArtifactSets: {
      en: "Ignore sets when Min. ER/CR cannot be met",
      zh: "充能、暴击无法达到要求时忽略套装",
    },
    expandFormula: { en: "Expand", zh: "展开" },
    collapseFormula: { en: "Collapse", zh: "收起" },
    inventoryWarning: {
      en: "Only equipped artifacts detected. Import full inventory for accurate results.",
      zh: "仅检测到已装备的圣遗物。导入完整背包数据以获得准确结果。",
    },
    inventoryWarningLink: {
      en: "Import data",
      zh: "导入数据",
    },
    optimizationComplete: { en: "Complete", zh: "完成" },
    phaseInit: { en: "Initializing", zh: "初始化" },
    phasePerChar: { en: "Per-character search", zh: "单角色搜索" },
    phaseTeamAlloc: { en: "Team allocation", zh: "队伍分配" },
    phaseTeamRefine: { en: "Team refinement", zh: "全队精修" },
    generatingIdeal: { en: "Generating…", zh: "正在生成…" },
    idealEmptyMessage: {
      en: "Press Generate to compute ideal artifact stats.",
      zh: "点击「生成」计算理想圣遗物属性。",
    },
    // Formula v2: Reaction Selector + Combo
    reaction: { en: "Reaction", zh: "元素反应" },
    combo: { en: "Combo", zh: "连招" },
    totalRotation: { en: "Total Rotation Damage", zh: "循环总伤害" },
    formulaSelection: {
      en: "Formula Selection",
      zh: "公式选择",
    },
    tabCurrentEquipped: {
      en: "Current",
      zh: "当前",
    },
    tabCurrentEquippedDesc: {
      en: "Equipped in account",
      zh: "账号已装备的",
    },
    tabOptimize: {
      en: "Optimize",
      zh: "优化",
    },
    tabOptimizeDesc: {
      en: "Best from inventory",
      zh: "背包中最佳",
    },
    tabGenerateIdeal: {
      en: "Generate",
      zh: "生成",
    },
    tabGenerateIdealDesc: {
      en: "Theoretical best stats",
      zh: "理论最佳词条",
    },
    saturated: { en: "Saturated", zh: "已饱和" },
    saturatedTooltip: {
      en: "All relevant stats have reached their cap. Additional artifact stats won't increase team damage. Consider raising CR or ER requirements for better rotation comfort.",
      zh: "所有相关属性已达上限，更多圣遗物属性不会提升队伍伤害。可以提高暴击或充能要求以优化循环舒适度。",
    },
    saturatedIntrinsicHint: {
      en: "This character's artifact stats never affect team damage (e.g. buff scales from base ATK only). Artifacts are filled from the remaining pool and this character is skipped when freezing all.",
      zh: "该角色的圣遗物属性从不影响队伍伤害（如增益仅基于基础攻击力）。圣遗物从剩余池中分配，冻结全部时会跳过该角色。",
    },
    saturatedMarginalHint: {
      en: "This character's contributions to team damage are independent of artifact stats. Set an ER or CR requirement if you need burst uptime or Favonius procs.",
      zh: "该角色对队伍伤害的贡献与圣遗物属性无关。如需保证大招循环或西风触发，请设置充能或暴击要求。",
    },
    freezeTeam: { en: "Freeze All", zh: "全部冻结" },
    freezeChar: { en: "Freeze", zh: "冻结" },
    unfreezeAll: { en: "Thaw All", zh: "全部解冻" },
    unfreezeChar: { en: "Thaw", zh: "解冻" },
    optimizeRest: { en: "Optimize Rest", zh: "优化其余" },
    partiallyFrozenTooltip: {
      en: "Some characters are frozen — only unfrozen ones will be re-optimized.",
      zh: "部分角色已冻结——仅对未冻结角色重新优化。",
    },
    swapArtifact: { en: "Swap Artifact", zh: "替换圣遗物" },
    swapArtifactDesc: {
      en: "Choose a replacement from your inventory",
      zh: "从背包中选择替换",
    },
    swapTabMatching: { en: "Matching Sets", zh: "匹配套装" },
    swapTabOther: { en: "Other", zh: "其他" },
    swapEmpty: {
      en: "No artifacts found for this slot",
      zh: "未找到该部位的圣遗物",
    },
    swapSortBy: { en: "Sort by", zh: "排序" },
    swapSortPlaceholder: { en: "Not set", zh: "未选择" },
    swapRestoreOriginal: { en: "Restore Original", zh: "恢复原始结果" },
    frozenTooltip: {
      en: "All characters are frozen — thaw to re-optimize.",
      zh: "所有角色已冻结——解冻后可重新优化。",
    },
    frozenBadge: { en: "Frozen", zh: "已冻结" },
    singleFormula: { en: "Single Skill", zh: "单技能" },
    comboFormula: {
      en: "Rotation Total",
      zh: "循环总伤",
    },
    singleFormulaDesc: {
      en: "Evaluate one formula at a time",
      zh: "每次评估单个公式",
    },
    comboFormulaDesc: {
      en: "Combine formulas into a rotation",
      zh: "将公式组合为循环",
    },
    comboDisclaimer: {
      en: "Combo mode does not track buff durations or stacks — results may be inaccurate for long rotations.",
      zh: "组合模式不追踪Buff持续时间和层数，长轴循环的结果可能不准确。",
    },
    investmentAnalysis: {
      en: "Investment Analysis",
      zh: "补金分析",
    },
    investmentDesc: {
      en: "Find the most cost-efficient order to invest constellations and weapon refinements.",
      zh: "找到最高性价比的命座和精炼投资顺序。",
    },
    investmentBuffStackWarning: {
      en: "Buff stack limits are not yet calculated. Some constellation values may be inaccurate, e.g. Clorinde C2, Xianyun C4, Shenhe C6.",
      zh: "目前还不能计算buff的层数限制，个别命座价值会被误算：如爱可菲2命，希诺宁4命，申鹤6命等。",
    },
    runAnalysis: {
      en: "Run Analysis",
      zh: "开始分析",
    },
    investChart: {
      en: "Chart",
      zh: "图表",
    },
    investTable: {
      en: "Table",
      zh: "表格",
    },
    investSequence: {
      en: "Sequence",
      zh: "顺序",
    },
    investMinConfig: {
      en: "Min",
      zh: "最低",
    },
    investMaxConfig: {
      en: "Max",
      zh: "最高",
    },
    investWeapon4StarR0: {
      en: "3/4★R5",
      zh: "3/4★精5",
    },
    investChar: {
      en: "Character",
      zh: "角色",
    },
    investJin: {
      en: "5★",
      zh: "金",
    },
    investVsPrev: {
      en: "vs Prev",
      zh: "vs 前者",
    },
    investDiff: {
      en: "Change",
      zh: "变化",
    },
    investNoSteps: {
      en: "No investment steps found.",
      zh: "未找到投资步骤。",
    },
    noWeapon5Star: {
      en: "No 5★ Weapon",
      zh: "无5★武器",
    },
  },
  filters: {
    title: { en: "Filters", zh: "过滤" },
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
    ownedOnlyDisabled: {
      en: "Import your data first to use this filter",
      zh: "请先导入数据以使用此筛选",
    },
    elements: { en: "Elements", zh: "元素" },
    weaponTypes: { en: "Weapon Types", zh: "武器类型" },
    regions: { en: "Regions", zh: "地区" },
    rarity: { en: "Rarity", zh: "稀有度" },
  },
  computeFilters: {
    searchSets: { en: "Search Sets", zh: "搜索套装" },
    searchPlaceholder: { en: "Enter set name...", zh: "输入套装名称..." },
    noConfigurations: {
      en: "No Artifact Set Found",
      zh: "没有找到圣遗物套装",
    },
    noConfigurationsDesc: {
      en: "Configure builds for your characters first, then switch here to see which artifacts to keep or trash.",
      zh: "请先为角色配置配装，然后切换到这里查看哪些圣遗物该保留或丢弃。",
    },
    noConfigurationsCta: {
      en: "Go to Configure",
      zh: "前往配置",
    },
    noConfigurationsOrPreset: {
      en: "Or import a community preset to get started in seconds.",
      zh: "或者导入社区预设，几秒钟即可开始。",
    },
    noConfigurationsImportPreset: {
      en: "Import Presets",
      zh: "导入预设",
    },
    configuration: { en: "Configuration", zh: "配置" },
    mainStat: { en: "Main Stat", zh: "主词条" },
    subStat: { en: "Substat", zh: "副词条" },
    atLeast: { en: "at least", zh: "至少" },
    any: { en: "Any", zh: "任意" },
    for: { en: "For", zh: "适用角色" },
    fourPc: { en: "4pc", zh: "四件套" },
    twoPc: { en: "2pc", zh: "两件套" },
    configurationNumber: { en: "Config", zh: "配置" },
    computeOptions: { en: "Compute Options", zh: "计算选项" },
    mergeAlgorithm: { en: "Merge Algorithm", zh: "合并算法" },
    algorithmBruteForce: {
      en: "Brute-Force Merge",
      zh: "暴力合并",
    },
    algorithmBruteForceDesc: {
      en: "Exhaustive search and merge builds to find the 2 configs with highest recall.",
      zh: "穷举搜索并合并配装，找到召回率最高的2个配置。",
    },
    algorithmGreedyMerge: {
      en: "Greedy Merge",
      zh: "贪心合并",
    },
    algorithmGreedyMergeDesc: {
      en: "Merge builds greedily (one by one) using heuristic rules. May produce more than 2 configs.",
      zh: "贪婪地逐个合并配装(借助一些启发式规则)。可能产生超过2个配置。",
    },
    algorithmSmartMerge: {
      en: "Smart Merge (Recommended)",
      zh: "智能合并（推荐）",
    },
    algorithmSmartMergeDesc: {
      en: "Groups builds by DPS and Support builds, then merge builds down to 2 configs.",
      zh: "按不同输出和辅助配装类型分组，然后合并到2个配置中。",
    },
    normalizeFlatStats: {
      en: "Optimize flat stats (add flat HP/ATK/DEF to 2 substats only configs)",
      zh: "优化小词条（自动添加至只有2副词条的配置）",
    },
    expandElementalGoblet: {
      en: "Treat any elemental DMG% goblet as all elemental DMG% (recommended)",
      zh: "将任意元素伤%空之杯视为所有元素伤%（推荐）",
    },
    expandCritCirclet: {
      en: "In 4pc builds, treat CR or CD circlet as both CR/CD (recommended)",
      zh: "4件套配装中，将暴击或暴伤理之冠视为两者皆可（推荐）",
    },
    substatWeightThreshold: {
      en: "Included substat weight threshold",
      zh: "副词条纳入权重阈值",
    },
    substatWeightThresholdDesc: {
      en: "Substats with weight ≥ this value are included in the filter pool.",
      zh: "权重 ≥ 此值的副词条会被纳入过滤池。",
    },
    mustPresentWeightThreshold: {
      en: "Must-present substat weight threshold",
      zh: "必须存在副词条权重阈值",
    },
    mustPresentWeightThresholdDesc: {
      en: "Substats with weight ≥ this value must appear on every artifact.",
      zh: "权重 ≥ 此值的副词条必须出现在每件圣遗物上。",
    },
    optionalConfig: {
      en: "Optional — skip if CR+CD auto-lock is enabled",
      zh: "此配置可跳过——如已开启双暴自动锁定",
    },
    computing: {
      en: "Recomputing configurations…",
      zh: "正在重新计算配置…",
    },
    passChance: { en: "Pass chance", zh: "达标概率" },
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
  },
  navigation: {
    configure: { en: "Character Builds", zh: "角色配装" },
    computeFilters: {
      en: "Artifact Filters",
      zh: "圣遗物过滤器",
    },
    autoTune: { en: "AutoTune", zh: "自动调参" },
  },
  characterCard: {
    addFirstBuild: { en: "Add First Build", zh: "添加第一个配装" },
    hideBuilds: { en: "Hide Builds", zh: "隐藏配装" },
    showBuilds: { en: "Show Builds", zh: "显示配装" },
    hiddenNotice: {
      en: "This character is hidden. Builds are ignored in computations.",
      zh: "该角色已隐藏。配装不参与计算。",
    },
  },
  buildCard: {
    presetBuild: { en: "Preset Build", zh: "预设配装" },
    modifiedPreset: { en: "Modified Preset", zh: "修改后的预设" },
    customBuild: { en: "Custom Build", zh: "自定义配装" },

    substats: { en: "Substats", zh: "副词条" },
    deselect: { en: "Deselect", zh: "取消选择" },
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
    weightWarning: {
      en: "Set at least one substat weight to 100",
      zh: "请将至少一个副词条权重设为100",
    },
    missingStyle: {
      en: "Select at least one style (On-Field / Off-Field)",
      zh: "请选择至少一个定位（前台/后台）",
    },
    missingRole: {
      en: "Select at least one role (DPS / Support / Sustain)",
      zh: "请选择至少一个职能（输出/辅助/生存）",
    },
    stylesLabel: { en: "Style", zh: "定位" },
    rolesLabel: { en: "Role", zh: "职能" },
    autoTune: { en: "Auto Tune", zh: "自动调参" },
    autoTuneTitle: { en: "Auto Tune Weights", zh: "自动调参权重" },
    autoTuneDesc: {
      en: "Compute optimal substat weights using damage analysis with your teams",
      zh: "使用队伍数据通过伤害分析计算最优副词条权重",
    },
    autoTuneTeams: { en: "Team Contexts", zh: "队伍环境" },
    autoTuneNoTeams: {
      en: "No saved teams contain this character. Create a team first.",
      zh: "没有包含此角色的已保存队伍。请先创建队伍。",
    },
    autoTuneCalculate: { en: "Calculate", zh: "计算" },
    autoTuneComputing: { en: "Computing weights...", zh: "正在计算权重..." },
    autoTuneApply: { en: "Apply Weights", zh: "应用权重" },
    autoTuneTeamBreakdown: { en: "Per-Team Breakdown", zh: "分队伍详情" },
    autoTuneSubstats: { en: "Substat Weights", zh: "副词条权重" },
    autoTuneMainStats: { en: "Main Stat Weights", zh: "主词条权重" },
    autoTuneIdealRolls: { en: "Ideal Rolls", zh: "理想词条数" },
    autoTuneLopsidedPenalty: {
      en: "Lopsided allocation: the highest substat has ≥15 more rolls than the 2nd highest, suggesting this main stat forces an unbalanced build. −2% penalty applied.",
      zh: "词条分配不均：最多的副词条比第二多的多出≥15条，说明该主词条迫使副词条严重倾斜。已扣除2%伤害惩罚。",
    },
    autoTuneError: { en: "Calculation failed", zh: "计算失败" },
    autoTuneAddTeam: { en: "Add Team", zh: "添加队伍" },
    autoTuneFormulas: { en: "Formulas (Rotation)", zh: "公式（循环）" },
    autoTuneErWarning: {
      en: "ER from rotation requirement is not considered. Please manually add ER weights if needed.",
      zh: "未考虑循环充能需求。如有需要，请手动添加充能效率权重。",
    },
    autoTuneEditTeam: { en: "Edit Team", zh: "编辑队伍" },
    autoTuneEditTeamDesc: {
      en: "Configure team members, weapons, and artifact sets.",
      zh: "配置队伍成员、武器和圣遗物套装。",
    },
    autoTuneSaveTeam: { en: "Save Team", zh: "保存队伍" },
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
    showManekin: { en: "Show Manekin(a)", zh: "显示奇偶" },
    customize: { en: "Customize", zh: "自定义" },
    includeRarity5: { en: "5★", zh: "5★" },
    includeRarity4: { en: "4★", zh: "4★" },
    includeRarity3: { en: "3★", zh: "3★" },

    help: { en: "Help", zh: "帮助" },
  },
  resetConfirmDialog: {
    title: { en: "Reset Tier List", zh: "重置榜单" },
    message: {
      en: "Are you sure you want to reset the tier list? This will clear all character assignments, custom tier names, and visibility settings. This action cannot be undone.",
      zh: "确定要重置榜单吗？这将清除所有角色分配、自定义梯度名称和显示设置。此操作无法撤销。",
    },
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
  },

  tour: {
    guide: {
      title: { en: "Guide", zh: "指南" },

      artifactFilter: {
        en: "1. Click {import} to use presets, or configure builds in {builds} tab.\n2. In {filters} tab, tweak custom controls to generate your own lock rules.",
        zh: "1. 点击 {import} 使用预设，或在 {builds} 标签页中配置配装。\n2. 在 {filters} 标签页中调整自定义选项以生成属于你的锁定规则。",
      },
      tierList: {
        en: "1. Use {import} to load community tier list presets.\n2. Use {customize} to modify tier names and settings.",
        zh: "1. 使用 {import} 加载社区榜单预设。\n2. 使用 {customize} 修改梯度名称和设置。",
      },
      accountData: {
        en: "1. Open {import} menu to find tools for GOOD JSON files (e.g. from Inventory Kamera) or import via UID (Enka).\n2. View build scores in {characters} tab.\n3. Check personalized upgrade suggestions in {recommendations} tab.",
        zh: "1. 打开 {import} 菜单查找 GOOD JSON 文件工具（如 Inventory Kamera）或通过 UID (Enka) 导入。\n2. 在 {characters} 标签页中查看配装评分。\n3. 在 {recommendations} 标签页中查看个性化升级建议。",
      },
      teamComp: {
        en: "1. Pick {characters} , weapons, and artifact sets in each team card.\n2. Click {optimize} to find the best artifact loadout.\n3. Use {import} to load community presets.",
        zh: "1. 在每个队伍卡片中选择 {characters}、武器和圣遗物套装。\n2. 点击 {optimize} 寻找最佳圣遗物搭配。\n3. 使用 {import} 加载社区预设。",
      },
      teamOptDetail: {
        en: "1. Configure characters, weapons, artifact sets, and combat options in the roster.\n2. Choose a damage formula or build a combo rotation.\n3. Compare current, optimized, and ideal artifact results.",
        zh: "1. 在阵容中配置角色、武器、圣遗物套装和战斗选项。\n2. 选择伤害公式或构建连招循环。\n3. 比较当前、优化和理想圣遗物结果。",
      },
    },
    artifactFilter: {
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
    teamComp: {
      teamCardTitle: { en: "Build a Team", zh: "组建队伍" },
      teamCardContent: {
        en: "Pick 4 characters, their weapons, and artifact sets. Each column corresponds to one slot.",
        zh: "选择4个角色、他们的武器和圣遗物套装。每一列对应一个位置。",
      },
      optimizeContent: {
        en: "Once all slots are filled, click Optimize to find the best artifact loadout from your inventory.",
        zh: "当所有位置填满后，点击优化从你的背包中找到最佳圣遗物搭配。",
      },
      importContent: {
        en: "Load community team presets for a quick start, or import your own saved teams.",
        zh: "加载社区队伍预设快速开始，或导入你保存的队伍。",
      },
    },
    teamOptDetail: {
      rosterTitle: { en: "Team Roster", zh: "队伍阵容" },
      rosterContent: {
        en: "Configure characters, weapons, artifact sets, and combat options. Toggle constellation overrides and set conditions for each slot.",
        zh: "配置角色、武器、圣遗物套装和战斗选项。切换命座覆盖并为每个位置设置条件。",
      },
      formulaContent: {
        en: "Pick a damage formula in Single mode, or switch to Combo mode to build a full rotation with hit counts for each skill.",
        zh: "在单一模式下选择伤害公式，或切换到连招模式以构建包含每个技能命中次数的完整循环。",
      },
      damageTitle: { en: "Results & Optimization", zh: "结果与优化" },
      damageContent: {
        en: "Compare damage across three tabs: Current shows your equipped artifacts, Optimize finds the best loadout from your inventory, and Generate creates ideal theoretical artifacts.",
        zh: "在三个标签页中比较伤害：当前显示已装备圣遗物，优化从背包中找到最佳搭配，生成创建理论最优圣遗物。",
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
      recommendationsContent: {
        en: "Get personalized recommendations for artifact upgrades, swaps, and farming priorities based on your collection.",
        zh: "根据你的圣遗物收藏，获取个性化的强化、替换和刷取建议。",
      },
    },
  },

  evaluation: {
    title: { en: "Artifact Evaluation", zh: "圣遗物评估" },
    tabLabel: { en: "Evaluation", zh: "评估" },
    subtitle: { en: "{0} builds · Avg {1}%", zh: "{0} 个配装 · 均值 {1}%" },
    noBuilds: { en: "No builds to evaluate", zh: "无配装可评估" },
    noBuildsDesc: {
      en: "Import account data and configure artifact builds to see evaluations.",
      zh: "导入账号数据并配置圣遗物配装方案后可查看评估。",
    },
    sortAsc: { en: "Weakest first", zh: "最弱优先" },
    sortDesc: { en: "Strongest first", zh: "最强优先" },
    all: { en: "All", zh: "全部" },
  },
  v2Weights: {
    loading: {
      en: "Loading game data & generating weights...",
      zh: "正在加载游戏数据并生成权重...",
    },
  },
  batchAutoTune: {
    title: { en: "Batch AutoTune", zh: "批量自动调参" },
    subtitle: {
      en: "Compute optimal substat and main stat weights for DPS builds using damage simulations across team compositions.",
      zh: "通过队伍配置的伤害模拟，为 DPS 配装计算最优副词条和主词条权重。",
    },
    available: { en: "DPS Builds (with teams)", zh: "输出配装（有团队）" },
    allBuilds: { en: "All DPS Builds", zh: "全部输出配装" },
    selectAll: { en: "Select All", zh: "全选" },
    deselectAll: { en: "Deselect All", zh: "取消全选" },
    run: { en: "Run AutoTune", zh: "开始调参" },
    running: { en: "Computing {0}/{1}...", zh: "计算中 {0}/{1}..." },
    apply: { en: "Apply", zh: "应用" },
    applyAll: { en: "Apply All", zh: "全部应用" },
    applied: { en: "Applied", zh: "已应用" },
    dismiss: { en: "Skip", zh: "跳过" },
    noTeams: { en: "No teams available", zh: "没有可用的队伍" },
    done: { en: "Done ({0}/{1} succeeded)", zh: "完成（{0}/{1} 成功）" },
    noBuild: {
      en: "No builds and teams to tune. Import or create builds and teams first.",
      zh: "没有可调整的配装和配队。请先导入或创建配装和配队。",
    },
    mainStatCombos: {
      en: "{0} main stat combo{1}",
      zh: "{0} 种主属性组合",
    },
  },
  whatsNew: {
    title: { en: "What's New", zh: "更新日志" },
    roadmap: { en: "Roadmap", zh: "计划" },
    features: { en: "Features", zh: "新功能" },
    fixes: { en: "Fixes", zh: "修复" },
  },
  triage: {
    tabLabel: { en: "Triage", zh: "锁定" },
    title: { en: "Artifact Triage Helper", zh: "圣遗物锁定助手" },
    subtitle: {
      en: "{0} artifacts analyzed:",
      zh: "已分析 {0} 个圣遗物：",
    },
    autoLockWip: {
      en: "Auto lock/unlock tool coming soon~",
      zh: "自动加解锁工具正在制作中~",
    },
    recommendLock: {
      en: "Recommend Lock",
      zh: "建议锁定",
    },
    recommendUnlock: {
      en: "Recommend Unlock",
      zh: "建议解锁",
    },
    recommendLockDesc: {
      en: "Currently unlocked artifacts worth keeping",
      zh: "当前未锁定但值得保留的圣遗物",
    },
    recommendUnlockDesc: {
      en: "Currently locked artifacts that can be foddered",
      zh: "当前已锁定但可以分解的圣遗物",
    },
    noActionNeeded: {
      en: "Protected",
      zh: "保护区",
    },
    noActionDesc: {
      en: "High-level or equipped artifacts — already protected, no lock change needed",
      zh: "高等级或已装备的圣遗物——已受保护，无需改变锁定状态",
    },
    noChange: {
      en: "No Change",
      zh: "无变化",
    },
    noChangeDesc: {
      en: "Artifacts whose lock status already matches the recommendation",
      zh: "锁定状态已与建议一致的圣遗物",
    },
    noRecommendations: {
      en: "No items in this category",
      zh: "此类别中没有圣遗物",
    },
    noData: {
      en: "Import account data and configure artifact builds to use triage.",
      zh: "导入账号数据并配置圣遗物配装后可使用去留分析。",
    },
    // Decision labels (lock / unlock)
    label: {
      lock: { en: "Lock", zh: "锁定" },
      unlock: { en: "Unlock", zh: "解锁" },
    },
    // Quality tier names
    tier: {
      P: { en: "Prime", zh: "极品" },
      Q: { en: "Solid", zh: "精良" },
      N: { en: "Filler", zh: "过渡" },
      T: { en: "Fodder", zh: "狗粮" },
    },
    // Rule descriptions (what decided the action)
    rule: {
      TP: { en: "Premium — always keep", zh: "极品装全部保留" },
      TQ: { en: "Quality — default keep", zh: "精良装默认保留" },
      QB: { en: "Over-supplied — quality fodder", zh: "供大于求，精良装分解" },
      NK: { en: "Under-supplied — filler kept", zh: "供不应求，过渡装保留" },
      TN: { en: "Filler — default fodder", zh: "过渡装默认分解" },
      TF: { en: "Substats don't match", zh: "副词条不匹配，狗粮分解" },
      TD: { en: "Main stat no demand", zh: "主词条无需求，狗粮分解" },
    },
    // Special rule labels (short, for inline display)
    sp: {
      SP1: { en: "4-liner ER (support set)", zh: "4初始充能（辅助套）" },
      SP3: { en: "Level protected", zh: "高等级保护" },
      SP4: { en: "Equipped protected", zh: "已装备保护" },
      SP5: { en: "4-liner CR+CD", zh: "4初始双暴" },
      SP6: { en: "Set+slot keep", zh: "套装部位最低保留" },
      FLEX: { en: "Flex match", zh: "散件匹配保留（可控制每种开关）" },
    },
    // Detail panel labels
    detail: {
      demand: { en: "Demand", zh: "需求" },
      supply: { en: "Supply", zh: "供给" },
      rankInTier: {
        en: "Rank {0}/{1} in {2}",
        zh: "{2}中第{0}/{1}",
      },
    },
    // Settings
    flexPatterns: { en: "Flex Patterns", zh: "散件保留" },
    settings: { en: "Settings", zh: "设置" },
    settingsProtection: {
      en: "Protection rules (excluded from analysis)",
      zh: "保护规则（不参与分析）",
    },
    settingsThreshold: { en: "Build conversion rules", zh: "配装转化规则" },
    settingsKeepRules: { en: "Custom keep rules", zh: "自定义保留规则" },
    mainStatThreshold: {
      en: "Main stat threshold",
      zh: "主词条阈值",
    },
    optionalSubThreshold: {
      en: "Substat threshold",
      zh: "副词条阈值",
    },
    ownedOnly: {
      en: "Owned characters only",
      zh: "只考虑已拥有角色",
    },
    neutralKeep: {
      en: "Neutral keep per type",
      zh: "过渡装保底数（低于需求时备用几个）",
    },
    qualityMargin: {
      en: "Quality surplus margin",
      zh: "精良装余量数（超过需求后多留几个）",
    },
    setSlotKeep: {
      en: "Min keep per set+slot",
      zh: "每套装每部位最少保留",
    },
    erHoarding: {
      en: "ER hoarding (4-liner + ER)",
      zh: "辅助套充能锁定（4初始+充能）",
    },
    doubleCritLock: {
      en: "Double crit lock (4-liner + CR+CD)",
      zh: "双暴锁定（4初始+暴击+暴伤）",
    },
    levelProtection: {
      en: "Level protection",
      zh: "等级保护",
    },
    equippedProtect: {
      en: "Equipped protection",
      zh: "已装备保护",
    },
    rulePrefixFlex: { en: "Off-piece", zh: "散件" },
    // Help dialog
    help: {
      title: { en: "How does this work?", zh: "这是怎么运作的？" },
      desc: {
        en: "Compares every artifact's substats against your builds to decide what to keep.",
        zh: "将每件圣遗物的副词条与你的配装需求进行比对，决定去留。",
      },
      howTitle: { en: "How it decides", zh: "决策方式" },
      howMatch: {
        en: "Match artifacts to builds by set, slot, and main stat",
        zh: "按套装、部位、主词条匹配圣遗物与配装",
      },
      howRarity: {
        en: "Score substat hits as a rarity — rarer combos rank higher",
        zh: "将命中的副词条换算为稀有度——越稀有排名越高",
      },
      howFactors: {
        en: "Bonuses: CR+CD pair, 4 initial substats, useful minor stat when all core stats hit",
        zh: "加分项：双暴、初始4词条、核心全中时带实用小词条",
      },
      tierTitle: { en: "Rarity tiers", zh: "稀有度档位" },
      badgeAlwaysLock: { en: "Always lock", zh: "无条件锁定" },
      badgeAlwaysFodder: { en: "Always fodder", zh: "无条件解锁" },
      badgeOverSupply: { en: "Over-supply → unlock", zh: "供过于求 → 解锁" },
      badgeUnderSupply: { en: "Under-supply → lock", zh: "供不应求 → 锁定" },
      tierPrime: {
        en: "Flower / Plume ≤ 1%  ·  Others ≤ 0.5% — Always locked.",
        zh: "花/羽 ≤ 1%  ·  沙/杯/头 ≤ 0.5% — 无条件锁定。",
      },
      tierSolid: {
        en: "Flower / Plume ≤ 4%  ·  Others ≤ 2% — Locked unless you have too many.",
        zh: "花/羽 ≤ 4%  ·  沙/杯/头 ≤ 2% — 默认锁定，供过于求时淘汰。",
      },
      tierFiller: {
        en: "Flower / Plume ≤ 20%  ·  Others ≤ 10% — Only kept when supply is short.",
        zh: "花/羽 ≤ 20%  ·  沙/杯/头 ≤ 10% — 仅在供不应求时保留。",
      },
      tierFodder: {
        en: "Everything else — Always fodder.",
        zh: "其余全部 — 无条件分解。",
      },
      supplyTitle: { en: "Supply & demand", zh: "供需机制" },
      supplyOver: { en: "Plenty of pieces", zh: "供给充足" },
      supplyUnder: { en: "Short on pieces", zh: "供不应求" },
      supplyDemand: { en: "demand", zh: "需求" },
      supplyMargin: { en: "margin", zh: "余量" },
      supplyBackup: { en: "backup", zh: "保底" },
      supplyRecycle: { en: "recycle", zh: "回收" },
      supplyKeep: { en: "keep limit", zh: "保留" },
      supplyCustomizable: {
        en: "Backup and margin counts are customizable in settings.",
        zh: "保底和余量的数量可以在设置中自定义。",
      },
      spTitle: { en: "Exceptions", zh: "例外规则" },
      spOverride: {
        en: "Extra lock rules (optional)",
        zh: "额外锁定规则（可选）",
      },
      spSP6Detail: {
        en: "Set+slot keep: ensures at least N pieces per set+slot.",
        zh: "套装部位最低保留：确保每个套装的每个部位至少保留 N 个。",
      },
      spProtect: {
        en: "Protection rules (no suggestions)",
        zh: "保护规则（不提供建议）",
      },
    },
    flexDialogDesc: {
      en: "Auto-detected premium off-piece patterns. Toggle on to lock regardless of set. (Format: Slot·MainStat·SubStat)",
      zh: "自动检测的散件类型。开启后无视套装锁定。（选项为“部位·主词条·副词条”）",
    },
  },
};
