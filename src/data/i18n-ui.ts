export const i18nUiData = {
  common: {
    search: { en: "Search...", zh: "搜索..." },
    clear: { en: "Clear", zh: "清除" },
    clearAccountData: { en: "Clear Account Data", zh: "清除账号数据" },
    clearBuilds: { en: "Clear Builds", zh: "清除配装" },
    clearTeams: { en: "Clear Teams", zh: "清除队伍" },
    clearTierList: { en: "Clear Tier List", zh: "清除排行" },
    active: { en: "Active", zh: "使用中" },
    none: { en: "None", zh: "无" },
    home: { en: "Home", zh: "主页" },
    refresh: { en: "Refresh Page", zh: "刷新页面" },
    loading: { en: "Loading...", zh: "加载中..." },
    error: { en: "Something went wrong", zh: "出错了" },
    errorMsg: {
      en: "An unexpected error occurred.",
      zh: "发生了一个未知的错误。",
    },
    appUpdatedMsg: {
      en: "This usually means the app was updated. A cache-busting reload should fix it.",
      zh: "这通常意味着应用已更新。点击下方按钮刷新缓存即可修复。",
    },
    reload: { en: "Reload", zh: "重新加载" },
    cancel: { en: "Cancel", zh: "取消" },
    reset: { en: "Reset", zh: "重置" },
    ownedOnly: { en: "Owned Only", zh: "仅已拥有" },
    noResults: { en: "No results found", zh: "未找到结果" },
    duplicate: { en: "Duplicate", zh: "复制" },
    moveUp: { en: "Move Up", zh: "上移" },
    moveDown: { en: "Move Down", zh: "下移" },
    revert: { en: "Revert Changes", zh: "撤销更改" },
    delete: { en: "Delete", zh: "删除" },
    unnamed: { en: "Unnamed", zh: "未命名" },
    constellationFormat: { en: "C{0}", zh: "{0}命" },
    refinementFormat: { en: "R{0}", zh: "精{0}" },
    constellationRefinementCompact: { en: "C{0}R{1}", zh: "{0}+{1}" },
    restore: { en: "Restore Preset", zh: "恢复预设" },
    gotIt: { en: "Got it", zh: "知道了" },
    save: { en: "Save", zh: "保存" },
    offFieldSuffix: { en: "(off-field)", zh: "(后台)" },
    partialOffFieldSuffix: { en: "(partial off-field)", zh: "(部分后台)" },
    forceOnField: { en: "Force on-field", zh: "强制前台" },
    ignoreCharDamage: { en: "Ignore {0} damage", zh: "忽略{0}伤害" },
    damage: { en: "Damage", zh: "伤害" },
    stop: { en: "Stop", zh: "停止" },
    equip: { en: "Equip", zh: "装备" },
    level: { en: "Level", zh: "等级" },
    previous: { en: "Previous", zh: "上一步" },
    next: { en: "Next", zh: "下一步" },
    finish: { en: "Finish", zh: "完成" },
    stepOf: { en: "Step {0} of {1}", zh: "第 {0} / {1} 步" },
    addBuild: { en: "Add Build", zh: "添加配装" },
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
    dialogDesc: {
      en: "Choose from built-in presets or import from a local file.",
      zh: "从内置预设中选择，或从本地文件导入。",
    },
    fromFile: { en: "Import from File", zh: "从文件导入" },
    confirmTitle: { en: "Apply preset?", zh: "应用预设？" },
    confirmAction: { en: "Apply preset", zh: "应用预设" },
    fileLoadError: { en: "Failed to import file", zh: "文件导入失败" },
    clearBeforeImport: { en: "Clear existing data", zh: "清除现有数据" },
    titleBuilds: { en: "Import builds", zh: "导入配装" },
    titleTierList: { en: "Import Tier List", zh: "导入榜单" },
    titleAccountData: { en: "Import Account Data", zh: "导入账号数据" },
    confirmBuilds: {
      en: "This will replace current builds with the selected preset.",
      zh: "此操作会用所选预设替换当前配装。",
    },
    confirmTierList: {
      en: "This will replace your current tier list with the selected preset.",
      zh: "此操作会用所选预设替换当前榜单。",
    },
    presetLoadError: { en: "Failed to load preset", zh: "预设加载失败" },
    loadErrorTierList: {
      en: "Failed to load tier list",
      zh: "榜单加载失败",
    },
    titleTeamComp: { en: "Import Team Comp", zh: "导入队伍配队" },
    confirmTeamComp: {
      en: "This will replace your current teams with the selected preset.",
      zh: "此操作会用所选预设替换当前队伍。",
    },
    loadErrorTeamComp: {
      en: "Failed to load team comp",
      zh: "队伍配队加载失败",
    },
    presetEmpty: { en: "No presets found", zh: "未找到预设" },
    emptyBuildsHint: {
      en: "No presets found. Add preset JSON files to the presets folder.",
      zh: "未找到预设。请在 presets 文件夹中添加预设 JSON 文件。",
    },
    goodSplitFileHint: {
      en: "Now supports separate character, weapon, and artifact files!",
      zh: "现支持分别导入角色、武器和圣遗物文件！",
    },
    goodFileButton: { en: "Import .json file", zh: "导入 .json 文件" },
    goodTitle: { en: "Full Data Import", zh: "完整数据导入" },
    recommended: { en: "Recommended", zh: "推荐" },
    goodBenefit: {
      en: "Full artifact inventory with swap, upgrade, and reroll recommendations.",
      zh: "完整背包数据，获取替换、强化和洗练建议。",
    },
    goodPcHint: {
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
    proxyHint: {
      en: "Slow GitHub connection? Direct download:",
      zh: "GitHub 下载慢？直接下载：",
    },
    wrongFormat: {
      en: "This file is not in GOOD format. Please export using a supported scanner tool.",
      zh: "该文件不是 GOOD 格式，请使用支持的扫描工具导出。",
    },
    uidTitle: { en: "Quick UID Import", zh: "UID 快捷导入" },
    uidDescription: {
      en: "Fetch from Enka Network. Limited to 12 showcase characters and their equipments. Make sure you allowed character details!",
      zh: "通过 Enka Network 获取。仅限 12 个展示角色及其装备。确保你打开了角色详情！（不支持B服）",
    },
    uidPlaceholder: {
      en: "UID (required)",
      zh: "UID (必填)",
    },
    optionalUid: { en: "Optional UID", zh: "UID（选填）" },
    uidRequired: {
      en: "UID required for new profile",
      zh: "新建配置需要填写 UID",
    },
    uidInvalid: {
      en: "UID must be 9–10 digits",
      zh: "UID 须为 9–10 位数字",
    },
    enkaStatusHint: {
      en: "Problems with import? Check {link}Enka status{/link}.",
      zh: "导入遇到问题？查看 {link}Enka 状态{/link}。",
    },
    hoyolabTitle: {
      en: "HoYoLAB / 米游社 Import",
      zh: "米游社 / HoYoLAB 导入",
    },
    hoyolabDescription: {
      en: "Fetch your full character roster (all owned characters with equipped gear) using your HoYoLAB or 米游社 account cookie.",
      zh: "使用你的米游社 / HoYoLAB 账号 Cookie 获取所有已拥有角色及其装备。",
    },
    hoyolabRegionOs: { en: "HoYoLAB (Global)", zh: "HoYoLAB（国际服）" },
    hoyolabRegionCn: {
      en: "米游社 (CN / Bilibili)",
      zh: "米游社（国服 / B 服）",
    },
    hoyolabMissingCookie: {
      en: "Paste your HoYoLAB / 米游社 cookie first.",
      zh: "请先粘贴你的 HoYoLAB / 米游社 Cookie。",
    },
    hoyolabPrivacyNote: {
      en: "Cookies are stored locally in your browser and only sent to our proxy to sign the request. Never persisted server-side.",
      zh: "Cookie 仅保存在你的浏览器本地，仅在签名请求时发送到我们的代理服务，服务端不会存储。",
    },
    hoyolabGuideTitle: {
      en: "How to get your HoYoLAB / 米游社 cookie",
      zh: "如何获取 HoYoLAB / 米游社 Cookie",
    },
    hoyolabGuideIntro: {
      en: "Follow these steps in a desktop browser. The cookie authenticates you — treat it like a password and never share it.",
      zh: "请在桌面浏览器中按以下步骤操作。Cookie 相当于你的登录凭证，请像密码一样妥善保管，切勿分享。",
    },
    hoyolabGuideStepOsTitle: {
      en: "Global (HoYoLAB)",
      zh: "国际服（HoYoLAB）",
    },
    hoyolabGuideStepCnTitle: {
      en: "CN / Bilibili (米游社)",
      zh: "国服 / B 服（米游社）",
    },
    hoyolabHowTo: { en: "How to get cookie", zh: "如何获取 Cookie" },
    hoyolabGuideStep1: {
      en: "Open {0} in a desktop browser and log in to your account.",
      zh: "在桌面浏览器中打开 {0} 并登录你的账号。",
    },
    hoyolabGuideStep2: {
      en: "Press F12 → Application (Chrome/Edge) or Storage (Firefox) → Cookies → {0}.",
      zh: "按 F12 → Application（Chrome/Edge）或 存储（Firefox）→ Cookies → {0}。",
    },
    hoyolabGuideStep3: {
      en: "Find the rows named {0} and {1}.",
      zh: "找到名为 {0} 和 {1} 的两行。",
    },
    hoyolabGuideStep4: {
      en: "Copy each value into the matching field in this dialog.",
      zh: "分别将两个值粘贴到导入对话框中对应的位置。",
    },
    hoyolabGuideSecurity: {
      en: "Never paste your cookie into untrusted sites. You can log out on {0} to invalidate it at any time.",
      zh: "切勿将 Cookie 粘贴到不受信任的网站。你可以随时在 {0} 退出登录以使其失效。",
    },
  },
  export: {
    action: { en: "Export", zh: "导出" },
    authorLabel: { en: "Author", zh: "作者" },
    authorPlaceholder: { en: "Enter your name...", zh: "输入您的名字..." },
    descLabel: { en: "Description", zh: "描述" },
    descPlaceholder: {
      en: "Enter a description...",
      zh: "输入描述...",
    },
    authorRequired: { en: "Author is required", zh: "需要填写作者" },
    descRequired: {
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
    invalidBuildsTitle: {
      en: "Invalid builds ({0})",
      zh: "无效配装（{0}）",
    },
    invalidBuildsMore: {
      en: "{0} more invalid builds not shown.",
      zh: "另有 {0} 个无效配装未显示。",
    },
  },

  accountData: {
    characters: { en: "Characters", zh: "角色" },
    inventory: { en: "Inventory", zh: "仓库" },
    recommendations: { en: "Recommendations", zh: "提分推荐" },
    weapons: { en: "Weapons", zh: "武器" },
    artifacts: { en: "Artifacts", zh: "圣遗物" },
    equipped: { en: "Equipped", zh: "已装备" },
    unequipped: { en: "Unequipped", zh: "未装备" },
    maxLevel: { en: "Max Level", zh: "满级" },
    other: { en: "Other Level", zh: "未满级" },
    filterByElement: { en: "Filter by element", zh: "按元素过滤" },
    filterBySubstat: { en: "Filter by substat", zh: "按副属性过滤" },
    sameSet: { en: "Same Set", zh: "同套装" },
    allOther: { en: "All Other", zh: "其他套装" },
    noData: {
      en: "Character Builds & Inventory",
      zh: "角色配装与仓库",
    },
    importPrompt: {
      en: "View your characters, artifacts, and weapons — with build scoring and upgrade recommendations. Import your data via Enka UID or a GOOD export file to get started.",
      zh: "查看你的角色、圣遗物和武器 — 包含配装评分和升级建议。通过 Enka UID 或 GOOD 导出文件导入数据即可开始。",
    },
    enkaTitle: {
      en: "Enka UID",
      zh: "Enka UID",
    },
    enkaDesc: {
      en: "Paste your UID to fetch your showcase characters instantly.",
      zh: "粘贴 UID 即可即时获取你的展示角色。",
    },
    goodTitle: {
      en: "GOOD JSON",
      zh: "GOOD JSON",
    },
    goodDesc: {
      en: "Upload a full artifact scanner export for complete analysis.",
      zh: "上传完整的圣遗物扫描导出文件以获得全面分析。",
    },
    afterImportHint: {
      en: "After importing, you'll see build scores, upgrade recommendations, and inventory insights.",
      zh: "导入后，你将看到配装评分、升级建议和套装分析。",
    },
    profileSelect: { en: "Select Profile", zh: "选择账号配置" },
    manageProfiles: { en: "Manage Profiles", zh: "管理账号配置" },
    profileSelectDesc: {
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
    needsBothTitle: {
      en: "Account Data & Builds Required",
      zh: "需要账号数据与配装方案",
    },
    needsBothDesc: {
      en: "This feature analyzes your artifacts against your build configurations. Import your account data and set up builds to get started.",
      zh: "此功能根据配装方案分析你的圣遗物。导入账号数据并配置配装方案即可开始。",
    },
    noFilterMatch: {
      en: "No characters match your filters",
      zh: "没有角色匹配当前过滤条件",
    },
    noFilterMatchDesc: {
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
    conversionSkipped: {
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
    flatAtk: { en: "Flat ATK", zh: "小攻击" },
    flatHp: { en: "Flat HP", zh: "小生命" },
    flatDef: { en: "Flat DEF", zh: "小防御" },
    wrongMainStat: { en: "Ineffective main stat", zh: "非主流属性" },
    subStatScore: { en: "Sub", zh: "副词条" },
    mainStatContrib: { en: "Main", zh: "主属性" },
    subStatContrib: { en: "Sub", zh: "副属性" },
    outOf300: { en: "/ 300", zh: "/ 300" },
    scoreRevamp: {
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
      upgrade: { en: "Upgrade", zh: "强化" },
      swap: { en: "Swap", zh: "替换" },
      keep: { en: "Keep", zh: "保持" },
      swapDetails: { en: "Swap details", zh: "替换详情" },
      bestAllocation: { en: "Best allocation", zh: "最佳分配" },
      bestAllocationScoreLabel: { en: "Best allocation:", zh: "最佳分配：" },
      additionalUpgrades: { en: "Upgrade suggestions", zh: "升级建议" },
      noUpgradeSuggestions: {
        en: "No upgrade suggestions for this allocation.",
        zh: "当前分配下暂无升级建议。",
      },
      noArtifactSwaps: {
        en: "No artifacts were swapped.",
        zh: "所有圣遗物均未替换。",
      },
      statValue: { en: "Stat Value", zh: "属性值" },
      fromInventory: { en: "In Inventory", zh: "背包中" },
      fromCharacter: { en: "from {0}", zh: "取自 {0}" },
      poolInfo: {
        en: "Characters in the Pool are not computed for recommendations. Their equipped artifacts may even be suggested for other characters to swap.",
        zh: "角色池中的角色不计算推荐操作。他们装备的圣遗物甚至有可能被推荐给其他角色使用。",
      },
      goToTierList: { en: "Manage Tiers", zh: "管理层级" },
    },
    noRankedChars: {
      en: "Rank your characters in the Tier List to get personalized upgrade recommendations.",
      zh: "在层级列表中为角色排序，即可获得个性化的升级建议。",
    },
    recommendationsCalculating: {
      en: "Calculating recommendations",
      zh: "正在计算提分推荐",
    },
    recommendationsCurrentTier: {
      en: "Current tier: {0}",
      zh: "当前层级：{0}",
    },
    recommendationsProgress: {
      en: "{0} of {1} tiers complete",
      zh: "已完成 {0} / {1} 个层级",
    },
    recommendationsFailed: {
      en: "Recommendation calculation failed. Check the console for details.",
      zh: "提分推荐计算失败。请查看控制台了解详情。",
    },
    recalculateRecommendations: {
      en: "Recalculate",
      zh: "重新计算",
    },
    applyRecommendationsToGame: {
      en: "Apply recommendations to game",
      zh: "将推荐应用到游戏",
    },
    applyRecommendationTiers: {
      en: "Tiers to apply",
      zh: "应用层级",
    },
    applyRecommendationTiersDesc: {
      en: "Only best allocation equipment is applied. Upgrade suggestions are not included.",
      zh: "仅应用最佳分配的装备方案，不包括强化建议。",
    },
    luckExpectation: {
      label: { en: "Upgrade Roll Value Expectation", zh: "升级词条值期望" },
      tooltip: {
        en: "Use {0}× max roll value to predict score",
        zh: "使用 {0}× 最高词条值来预测分数",
      },
      cautious: { en: "Cautious", zh: "保守" },
      balanced: { en: "Balanced", zh: "平衡" },
      hopeful: { en: "Hopeful", zh: "乐观" },
    },
    hint: {
      en: "These are quick suggestions based on artifact scoring. For precise team damage optimization, use the {0} tab.",
      zh: "以上为基于圣遗物评分的快速建议。如需精确的队伍伤害优化，请使用{0}。",
    },
    hintDamageLink: {
      en: "Damage",
      zh: "伤害计算",
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
    unactivated: { en: "Unactivated", zh: "未激活" },
    invalidSubstat: {
      en: "Invalid substat value: {0}",
      zh: "副属性数值无效：{0}",
    },
    invalidRollCombination: {
      en: "Substat values don't form a valid roll combination",
      zh: "副属性数值无法构成有效的强化组合",
    },
  },
  scoreExplanation: {
    title: { en: "Artifact Score Calculation", zh: "圣遗物评分计算逻辑" },
    description: {
      en: "How we derive the artifact score (out of 300) for each character.",
      zh: "角色的圣遗物评分（满分 300）是如何计算的？",
    },
    formula: {
      en: "Score = ( Main Stat Score + Substat Score ) × 300 / Ideal",
      zh: "评分 = ( 主属性分 + 副属性分 ) × 300 / 理想分",
    },
    subFormula: {
      en: "Stat Score = Σ( Value × CD-Equiv Factor × Weight/100 )",
      zh: "属性分 = Σ( 数值 × 暴伤折算系数 × 权重/100 )",
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
        en: "Used to fill in weights for flat stats (ATK, HP, DEF) when a build does not explicitly define them. The flat stat weight is derived from its percentage counterpart scaled by this factor. If a build already specifies a weight for a flat stat, the punishment factor has no effect on it. This is usually set between 30% to 40% for Lv.90-100 characters.",
        zh: "当构建未明确定义固定数值属性（小攻击、小生命、小防御）的权重时，用于自动填充其权重。固定属性的权重由对应百分比属性的权重乘以此系数得出。如果构建已为某个固定属性指定了权重，则惩罚系数对其无效。对于 90-100 级角色，通常设置为 30% 到 40%。",
      },
    },
    mainStat: {
      title: { en: "Main Stat Scoring", zh: "主属性评分" },
      description: {
        en: "Sands, goblet, and circlet main stats are scored using the same weighted formula as substats. Each main stat's weight is defined by the build — for example, an ATK% sands at weight 80 contributes less than an EM sands at weight 100. Wrong main stats (not in the build) contribute 0. Flower and plume main stats are fixed and not scored.",
        zh: "沙漏、杯子和头冠的主属性使用与副属性相同的加权公式进行评分。每个主属性的权重由配装定义 —— 例如，权重为 80 的攻击力%沙漏贡献低于权重为 100 的精通沙漏。不在配装中的错误主属性贡献为 0。花与羽的主属性固定，不计入评分。",
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
    navTeamComp: { en: "Team DMG", zh: "队伍伤害" },
    heroDescription: {
      en: "Powerful utilities to optimize your builds and organize your roster.",
      zh: "强大实用的工具，助您优化配装、管理角色养成。",
    },
    artifactFilterProblem: {
      en: "How to set up auto artifact locking?",
      zh: "圣遗物自动锁定怎么设置？",
    },
    artifactFilterGuideline: {
      en: "Your bag will never overflow again.",
      zh: "背包再也不会爆炸了。",
    },
    tierListProblem: {
      en: "Which character to prioritize?",
      zh: "哪个角色应该优先练？",
    },
    tierListGuideline: {
      en: "Who's strong, who's weak — you decide.",
      zh: "谁强谁弱，你说了算。",
    },
    accountDataProblem: {
      en: "Are my characters fully built?",
      zh: "我的角色练度毕业了吗？",
    },
    accountDataGuideline: {
      en: "Are you really giving them your best?",
      zh: "你真的把最好的给TA了吗？",
    },
    archiveProblem: {
      en: "Need character or weapon details?",
      zh: "想查阅角色或武器详情？",
    },
    archiveGuideline: {
      en: "All in one place, nothing missing.",
      zh: "整整齐齐，一个不落。",
    },
    teamCompProblem: {
      en: "How can my team do more damage?",
      zh: "我的队伍怎么打更多伤害？",
    },
    teamCompGuideline: {
      en: "You won't know until you calculate — the results may surprise you.",
      zh: "不算不知道，一算吓一跳。",
    },
    navMoreToCome: { en: "More", zh: "更多" },
    moreProblem: {
      en: "Got ideas or feedback?",
      zh: "有想法或建议？",
    },
    moreGuideline: {
      en: "Join the Discord community! QQ Group: 1093957900",
      zh: "加入 Discord 社区！QQ群：1093957900",
    },
    ctaScoreArtifacts: { en: "Score My Artifacts", zh: "评估圣遗物" },
    ctaConfigureFilters: { en: "Compute Filters", zh: "计算过滤器" },
    ctaRankCharacters: { en: "Rank Characters", zh: "排列角色" },
    ctaBrowseDetails: { en: "Browse Archive", zh: "浏览图鉴" },
    ctaCalculateDamage: { en: "Optimize Damage", zh: "优化伤害" },
    ctaJoinCommunity: { en: "Join Community", zh: "加入社区" },
    tierListTitle: { en: "Character Priority", zh: "角色优先级" },
    weaponTierListTitle: { en: "Weapon Priority", zh: "武器优先级" },
    artifactTierListTitle: {
      en: "Artifact Priority",
      zh: "圣遗物优先级",
    },

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
      en: "Thanks to HoYoWiki for the game data.",
      zh: "感谢HoYoWiki的游戏数据。",
    },
    presetAppliedTitle: {
      en: "Preset Builds Loaded",
      zh: "预设配装已加载",
    },
    presetAppliedDesc: {
      en: "Optimized artifact builds for all characters have been loaded, curated by GGArtifact. You can customize any build, or import/export your own data anytime from the Artifact Builds page.",
      zh: "已加载GGArtifact精选的全角色圣遗物配装。你可以随时自定义任意角色的配装，或通过圣遗物配装页面的导入/导出功能管理数据。",
    },
  },
  archive: {
    characters: { en: "Character Archive", zh: "角色图鉴" },
    weapons: { en: "Weapon Archive", zh: "武器图鉴" },
    artifacts: { en: "Artifact Archive", zh: "圣遗物图鉴" },
    bosses: { en: "Stygian Onslaught", zh: "幽境危战图鉴" },
    viewCharacter: { en: "View in Archive", zh: "查看图鉴" },
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
    lv70: { en: "Lv. 70", zh: "70级" },
    lv80: { en: "Lv. 80", zh: "80级" },
    lv90: { en: "Lv. 90", zh: "90级" },
    lv95: { en: "Lv. 95", zh: "95级" },
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
      en: "Team Damage Calculator",
      zh: "队伍伤害计算器",
    },
    emptyTeamDesc: {
      en: "Build teams, assign weapons and artifacts, and calculate optimized damage across rotations.",
      zh: "组建队伍、分配武器和圣遗物，计算整个循环的优化伤害。",
    },
    emptyTeamOrImport: {
      en: "Load a community preset to get started instantly, or build your own from scratch.",
      zh: "加载社区预设立即开始，或从头构建自己的队伍。",
    },
    teamName: { en: "Team Name", zh: "队伍名称" },
    teamIndex: { en: "Team {0}", zh: "队伍 {0}" },
    weapon: { en: "Weapon", zh: "武器" },
    artifact: { en: "Artifact", zh: "圣遗物" },
    newTeamStart: { en: "New Team (Top)", zh: "新建队伍（顶部）" },
    newTeamEnd: { en: "New Team (Bottom)", zh: "新建队伍（底部）" },
    searchPlaceholder: {
      en: "Search characters, weapons, artifacts, reactions...",
      zh: "搜索角色、武器、圣遗物、元素反应...",
    },
    sortByTier: { en: "By Tier", zh: "按评级" },
    sortByRelease: { en: "By Release Date", zh: "按发布日期" },
    unfreezeTeam: { en: "Thaw Team", zh: "解冻队伍" },
    enemyAura: { en: "Enemy Element:", zh: "敌方元素:" },
    reactions: { en: "Reactions", zh: "元素反应" },
    teamOptimization: { en: "Damage Optimization", zh: "伤害优化" },
    teamRoster: { en: "Team Roster", zh: "队伍成员" },
    minEr: { en: "Min.ER", zh: "最低充能" },
    minCr: { en: "Min.CR", zh: "最低暴击" },
    clearTeamData: { en: "Clear Team Data", zh: "清空队伍数据" },
    setupError: { en: "Setup Error:", zh: "设置错误：" },
    equipAndDamage: { en: "Artifacts & Damage", zh: "圣遗物 & 伤害" },
    optimizing: { en: "Optimizing…", zh: "正在优化…" },
    totalDamage: { en: "Total Damage:", zh: "总伤害：" },
    critModeExpected: { en: "Expected", zh: "期望" },
    critModeCrit: { en: "CRIT", zh: "暴击" },
    critModeNoCrit: { en: "Non-CRIT", zh: "非暴击" },
    emptyDamageMsg: {
      en: "Configure characters and weapons, then select a formula to see damage.",
      zh: "配置角色和武器，然后选择公式以查看伤害。",
    },
    emptyComboMsg: {
      en: "Add formula counts in the combo tab to see total rotation damage.",
      zh: "在循环公式面板中添加公式次数以查看循环总伤害。",
    },
    partialReactionNote: {
      en: "Not all hits in this formula are using reactions — partial reaction settings from single mode are applied.",
      zh: "此公式并非所有命中均使用元素反应——已应用单公式模式的部分反应设置。",
    },
    idle: { en: "Idle", zh: "站街面板" },
    combat: { en: "Combat", zh: "战斗面板" },
    condition: { en: "Condition", zh: "条件" },
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
    showAllBuffs: { en: "Show all buffs", zh: "显示所有效果" },
    teamResonance: { en: "Team Resonance & Environment", zh: "队伍共鸣与环境" },
    nStacks: { en: "{0} stacks", zh: "{0}层" },
    nTimes: { en: "{0} time", zh: "{0}次" },
    noBuffsOriginate: { en: "No buffs originating", zh: "未提供 Buff 效果" },
    receiverCharOnField: { en: " (On-Field)", zh: "-前台" },
    receiverCharOffField: { en: " (Off-Field)", zh: "-后台" },
    setMismatch: {
      en: "Equipped set differs from Team Roster goal",
      zh: "已装备的套装与队伍配置目标不一致",
    },
    enemyLevel: { en: "Enemy Lv.", zh: "怪物等级" },
    enemyRes: { en: "Enemy RES", zh: "怪物抗性" },
    critRateTarget: { en: "Max.CR (soft cap)", zh: "最高暴击（凹分）" },
    tierPool: {
      en: "Avoid stealing from higher tiers",
      zh: "避免抢高评级角色",
    },
    erOverSet: {
      en: "Prioritize ER over set",
      zh: "充能不够时放弃套装",
    },
    dpsSeconds: { en: "s", zh: "秒" },
    rollMultiplier: { en: "Roll Growth", zh: "词条成长" },
    substatBudget: {
      en: "Rolls Count",
      zh: "词条数",
    },
    emptyOptMsg: {
      en: "Press Run Optimization to find the best artifact loadout.",
      zh: "点击「开始优化」寻找最优圣遗物配装。",
    },
    noValidCombos: {
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
    failTimeout: {
      en: "Optimization timed out",
      zh: "优化超时",
    },
    timeBudget: {
      en: "Budget",
      zh: "时限",
    },
    failWorkerError: {
      en: "Optimizer error: {0}",
      zh: "优化器错误：{0}",
    },
    preparingOpt: {
      en: "Preparing optimizer…",
      zh: "正在准备优化器…",
    },
    optError: { en: "Optimization Error:", zh: "优化错误：" },
    expandFormula: { en: "Expand", zh: "展开" },
    collapseFormula: { en: "Collapse", zh: "收起" },
    backToCombo: { en: "Back to combo", zh: "返回连招" },
    buffActivation: { en: "Buff Activation", zh: "增益激活" },
    buffActivationDesc: {
      en: "Control how many hits each buff is active for",
      zh: "控制每个增益生效的命中次数",
    },
    disableAll: { en: "Disable All", zh: "全部关闭" },
    enableAll: { en: "Enable All", zh: "全部开启" },
    emptyBuffMsg: {
      en: "No applicable buffs for this part.",
      zh: "此部分没有可用的增益。",
    },
    inventoryWarning: {
      en: "Only equipped artifacts detected. Import full inventory for accurate results.",
      zh: "仅检测到已装备的圣遗物。导入完整背包数据以获得准确结果。",
    },
    inventoryWarningLink: {
      en: "Import data",
      zh: "导入数据",
    },
    optComplete: { en: "Complete", zh: "完成" },
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
    formulaSelect: {
      en: "Formula Selection",
      zh: "公式选择",
    },
    tabCurrent: {
      en: "Current",
      zh: "当前",
    },
    tabCurrentDesc: {
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
    tabGenerate: {
      en: "Generate",
      zh: "生成",
    },
    tabGenerateDesc: {
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
    mainStatFilter: {
      en: "Main Stat Filter",
      zh: "主词条筛选",
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
    partialFrozenTip: {
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
    swapRestore: { en: "Restore Original", zh: "恢复原始结果" },
    swapGuide: { en: "Swap Guide", zh: "换装指南" },
    swapGuideChange: { en: "change", zh: "处变更" },
    swapGuideChanges: { en: "changes", zh: "处变更" },
    swapStatusInventory: { en: "Inventory", zh: "背包中" },
    downloadSwapGuide: { en: "Download Swap Image", zh: "下载换装图片" },
    reuseLabel: { en: "Artifact freeze mode:", zh: "圣遗物冻结模式:" },
    reuseNone: { en: "No sharing", zh: "不复用" },
    reuseSameChar: { en: "Same character", zh: "同角色允许复用" },
    reuseForce: { en: "Same char + set", zh: "同角色同套装强制复用" },
    reuseBadgeLocked: { en: "Force reuse({0}/{1})", zh: "强制复用({0}/{1})" },
    reuseBadgeShared: { en: "Allow reuse({0}/{1})", zh: "允许复用({0}/{1})" },
    vsEquipped: { en: "vs current equip", zh: "对比当前已装备" },
    vsEquippedCaveat: { en: "* current", zh: "* 当前" },
    caveatDiffSet: { en: "different sets", zh: "套装不同" },
    caveatCrUnmet: { en: "crit unmet", zh: "暴击不符合要求" },
    caveatErUnmet: { en: "ER unmet", zh: "充能不符合要求" },
    freezeConflictTitle: {
      en: "Duplicate artifacts detected",
      zh: "检测到重复圣遗物",
    },
    freezeConflictDesc: {
      en: "Some artifacts are already frozen in another team. Freezing will store duplicate assignments. Continue?",
      zh: "部分圣遗物已在其他队伍中被冻结。冻结将保存重复的分配。是否继续？",
    },
    freezeConflictConfirm: { en: "Freeze anyway", zh: "仍然冻结" },
    freezeOverrideTitle: {
      en: "Overwrite frozen artifacts?",
      zh: "覆盖已冻结圣遗物？",
    },
    freezeOverrideDesc: {
      en: "This character already has different frozen artifacts (e.g. from a previous optimization). Freezing will replace them with the currently equipped set.",
      zh: "该角色已有不同的冻结圣遗物（如来自之前的优化）。冻结将替换为当前装备的套装。",
    },
    standaloneArtifacts: {
      en: "Frozen Individual Artifacts (exclude from optimizer)",
      zh: "冻结单个圣遗物（不参与优化）",
    },
    freezeArtifact: { en: "Freeze Artifact", zh: "冻结圣遗物" },
    freezeArtifactDesc: {
      en: "Select artifacts to freeze — frozen artifacts won't be reassigned by the optimizer",
      zh: "选择要冻结的圣遗物——冻结后优化器不会重新分配",
    },
    freezeSelected: { en: "Freeze Selected", zh: "冻结已选" },
    freezeNSelected: { en: "{0} selected", zh: "已选 {0} 个" },
    freezeNoArtifacts: {
      en: "No artifacts in your inventory",
      zh: "背包中没有圣遗物",
    },
    frozenEmpty: {
      en: "No frozen teams or artifacts",
      zh: "没有冻结的队伍或圣遗物",
    },
    frozenEmptyTitle: {
      en: "Frozen Artifacts",
      zh: "冻结圣遗物",
    },
    frozenEmptyDesc: {
      en: "After running optimization in the Damage tab, freeze the results to lock in your best artifact assignments. Frozen artifacts appear here for review and export.",
      zh: "在伤害页签中运行优化后，冻结结果以锁定最佳圣遗物分配。冻结的圣遗物会显示在此处供查看和导出。",
    },
    optimizeTeamDamage: {
      en: "Optimize team damage",
      zh: "优化队伍伤害",
    },
    detailLinkDamage: {
      en: "Go to damage optimizer",
      zh: "查看伤害优化",
    },
    detailLinkInvestment: {
      en: "Go to investment analysis",
      zh: "查看补金分析",
    },
    detailLinkWeaponChoice: {
      en: "Go to weapon and artifact choice",
      zh: "查看武器圣遗物选择",
    },
    detailLinkManageFrozen: {
      en: "Manage all frozen artifacts",
      zh: "管理所有冻结圣遗物",
    },
    downloadAllFrozen: {
      en: "Download All Swaps Image",
      zh: "下载所有换装图片",
    },
    frozenExportFilename: {
      en: "{0} Teams Optimized Export",
      zh: "{0}队伍优化导出",
    },
    characterScoreExportFilename: {
      en: "{0} Character Score Export",
      zh: "{0}角色评分导出",
    },
    frozenTooltip: {
      en: "All characters are frozen — thaw to re-optimize.",
      zh: "所有角色已冻结——解冻后可重新优化。",
    },
    frozenBadge: { en: "Frozen", zh: "已冻结" },
    singleFormula: { en: "Single Skill", zh: "单技能" },
    singleFormulaDesc: {
      en: "one formula",
      zh: "单一公式",
    },
    comboFormula: {
      en: "Rotation Total",
      zh: "循环总伤",
    },
    comboFormulaDesc: {
      en: "Multiple formulas",
      zh: "组合公式",
    },
    comboDisclaimer: {
      en: "Combo mode does not track buff durations or stacks — results may be inaccurate for long rotations.",
      zh: "组合模式不追踪Buff持续时间，长轴循环的结果可能不准确。",
    },
    rxTrigger: { en: "Trigger", zh: "触发" },
    rxOnField: { en: "On-field", zh: "战场" },
    teamReactions: { en: "Team Reactions", zh: "队伍反应" },
    transformativeReactionDmg: {
      en: "Transformative Reaction Damage",
      zh: "聚变反应伤害",
    },
    extraBuffs: { en: "Environment", zh: "环境设置" },
    extraBuffsFood: { en: "Food", zh: "料理" },
    extraBuffsEnv: { en: "Environment", zh: "环境" },
    extraBuffsStatus: { en: "Status", zh: "状态" },
    extraBuffsCustom: { en: "Custom Buff…", zh: "自定义加成…" },
    extraBuffsCustomTitle: { en: "Custom Extra Buff", zh: "自定义额外加成" },
    extraBuffsTarget: { en: "Target", zh: "目标" },
    extraBuffsStat: { en: "Stat", zh: "属性" },
    extraBuffsValue: { en: "Value", zh: "数值" },
    extraBuffsValuePct: { en: "(%, e.g. 20)", zh: "(%, 如 20)" },
    extraBuffsValueFlat: { en: "(flat)", zh: "(固定值)" },
    extraBuffsMaxStacks: { en: "Max Stacks", zh: "最大层数" },
    extraBuffsOptional: { en: "optional", zh: "选填" },
    extraBuffsAdd: { en: "Add Buff", zh: "添加加成" },
    extraBuffsNoChars: {
      en: "Add characters first",
      zh: "请先添加角色",
    },
    analyzer: {
      en: "Investment Analysis",
      zh: "补金分析",
    },
    analyzerDesc: {
      en: "Find the most cost-efficient order to invest constellations and weapon refinements.",
      zh: "找到最高性价比的命座和精炼投资顺序。",
    },
    runAnalysis: {
      en: "Run Analysis",
      zh: "开始分析",
    },
    analyzerPhase1: {
      en: "Generating artifacts…",
      zh: "生成圣遗物中…",
    },
    analyzerPhase2: {
      en: "Evaluating combinations…",
      zh: "评估组合中…",
    },
    analyzerPhase3: {
      en: "Optimizing paths…",
      zh: "优化路径中…",
    },
    analyzerChart: {
      en: "Chart",
      zh: "图表",
    },
    analyzerTable: {
      en: "Table",
      zh: "表格",
    },
    analyzerTableDesc: {
      en: "Compare all allocations",
      zh: "对比所有配置",
    },
    analyzerSequence: {
      en: "Path",
      zh: "路径",
    },
    analyzerSequenceDesc: {
      en: "Optimal upgrade order",
      zh: "最优升级顺序",
    },
    analyzerMinConfig: {
      en: "Min Config",
      zh: "最低配置",
    },
    analyzerMaxConfig: {
      en: "Max Config",
      zh: "最高配置",
    },
    analyzerWeapon4StarR0: {
      en: "3/4★R5",
      zh: "3/4★精5",
    },
    analyzerChar: {
      en: "Character",
      zh: "角色",
    },
    analyzerJin: {
      en: "5★",
      zh: "金",
    },
    analyzerVsPrev: {
      en: "vs Prev",
      zh: "vs 前者",
    },
    analyzerDiff: {
      en: "Change",
      zh: "变化",
    },
    analyzerNoSteps: {
      en: "No investment steps found.",
      zh: "未找到投资步骤。",
    },
    noWeapon5Star: {
      en: "No 5★ Weapon",
      zh: "无5★武器",
    },
    analyzerCombo: {
      en: "Rotation",
      zh: "循环",
    },
    analyzerNoResults: {
      en: "Run analysis to see results",
      zh: "运行分析以查看结果",
    },
    analyzerMinEr: {
      en: "Min ER (%)",
      zh: "最低充能 (%)",
    },
    analyzerResetDefaults: {
      en: "Reset to defaults",
      zh: "重置为默认值",
    },
    tabDamage: { en: "DMG Optimizer", zh: "伤害优化" },
    tabFrozen: { en: "Frozen Teams", zh: "冻结管理" },
    tabInvestment: { en: "Investment", zh: "补金分析" },
    tabWeaponChoice: { en: "Weapon & Artifact Choice", zh: "武器圣遗物选择" },
    weaponChoiceDesc: {
      en: "Select a team to compare weapons and artifact sets",
      zh: "选择队伍来比较武器与圣遗物套装",
    },
    weaponChoiceRun: { en: "Run", zh: "运行" },
    weaponChoiceRunning: { en: "Computing...", zh: "计算中..." },
    weaponChoiceRanking: { en: "Weapon Ranking", zh: "武器排名" },
    weaponChoiceConfig: { en: "Character Config", zh: "角色配置" },
    weaponChoiceBest: { en: "Best", zh: "最佳" },
    weaponChoiceResults: { en: "Choice Results", zh: "选择结果" },
    choiceModeWeapon: { en: "Weapon Choice", zh: "武器选择" },
    choiceModeWeaponDesc: {
      en: "Compare compatible weapons with generated artifacts",
      zh: "用生成圣遗物比较可用武器",
    },
    choiceModeArtifact: { en: "Artifact Choice", zh: "圣遗物选择" },
    choiceModeArtifactDesc: {
      en: "Compare 4-piece artifact sets with the current weapon",
      zh: "用当前武器比较四件套",
    },
    choiceOthersUnchanged: {
      en: "(others unchanged)",
      zh: "（其他人不变）",
    },
    artifactAssignmentSuggestion: {
      en: "Artifact Assignment Suggestion",
      zh: "圣遗物分配建议",
    },
    artifactAssignmentImprovesBy: {
      en: "Improves by",
      zh: "提升",
    },
    artifactAssignmentApply: {
      en: "Apply to team",
      zh: "应用到队伍",
    },
    artifactAssignmentNoChange: {
      en: "Current assignment is already best",
      zh: "当前分配已经最优",
    },
    weaponChoiceEmpty: {
      en: "Click Run to analyze weapons",
      zh: "点击运行以分析武器",
    },
    artifactChoiceEmpty: {
      en: "Click Run to analyze artifact sets",
      zh: "点击运行以分析圣遗物套装",
    },
    mainStats: { en: "Main Stats", zh: "主词条" },
    substatAllocation: { en: "Substat Totals", zh: "副词条合计" },
    noCompatibleWeapons: {
      en: "No compatible weapons",
      zh: "无匹配武器",
    },
    noCompatibleArtifactSets: {
      en: "No compatible artifact sets",
      zh: "无匹配圣遗物套装",
    },
  },
  filters: {
    title: { en: "Filters", zh: "过滤" },
    clearAll: { en: "Clear All", zh: "全部清除" },
    sort: { en: "Sort", zh: "排序" },
    sortByTier: { en: "Tier", zh: "评级" },
    sortByReleaseDate: { en: "Release Date", zh: "发布日期" },
    sortByScore: { en: "Art. Score", zh: "圣遗物评分" },
    scoreSortDisabled: {
      en: "Import your data first to sort by score",
      zh: "请先导入数据以按评分排序",
    },
    searchPlaceholder: { en: "Search characters...", zh: "搜索角色..." },
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
    noConfig: {
      en: "Artifact Build Presets",
      zh: "圣遗物配装预设",
    },
    noConfigDesc: {
      en: "Define which artifact sets and stats each character needs. Import a community preset to get started quickly.",
      zh: "定义每个角色需要的圣遗物套装和属性。导入社区预设即可快速开始。",
    },
    importPreset: {
      en: "Browse Presets & Import",
      zh: "浏览预设与导入",
    },
    mainStat: { en: "Main Stat", zh: "主词条" },
    subStat: { en: "Substat", zh: "副词条" },
    atLeast: { en: "at least", zh: "至少" },
    any: { en: "Any", zh: "任意" },
    for: { en: "For", zh: "适用角色" },
    fourPc: { en: "4pc", zh: "四件套" },
    twoPc: { en: "2pc", zh: "两件套" },
    configNum: { en: "Config", zh: "配置" },
    computeOptions: { en: "Compute Options", zh: "计算选项" },
    mergeAlgorithm: { en: "Merge Algorithm", zh: "合并算法" },
    algorithmBruteForce: {
      en: "Brute-Force Merge",
      zh: "暴力合并",
    },
    algorithmBruteForceDesc: {
      en: "Exhaustive search and merge builds to find the 3 configs with highest recall.",
      zh: "穷举搜索并合并配装，找到召回率最高的3个配置。",
    },
    algorithmGreedyMerge: {
      en: "Greedy Merge",
      zh: "贪心合并",
    },
    algorithmGreedyMergeDesc: {
      en: "Merge builds greedily (one by one) using heuristic rules. May produce more than 3 configs.",
      zh: "贪婪地逐个合并配装(借助一些启发式规则)。可能产生超过3个配置。",
    },
    algorithmSmartMerge: {
      en: "Smart Merge (Recommended)",
      zh: "智能合并（推荐）",
    },
    algorithmSmartMergeDesc: {
      en: "Groups builds by DPS and Support builds, then merge builds down to 3 configs.",
      zh: "按不同输出和辅助配装类型分组，然后合并到3个配置中。",
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
    subThreshold: {
      en: "Included substat weight threshold",
      zh: "副词条纳入权重阈值",
    },
    subThresholdDesc: {
      en: "Substats with weight ≥ this value are included in the filter pool.",
      zh: "权重 ≥ 此值的副词条会被纳入过滤池。",
    },
    mustPresentThreshold: {
      en: "Must-present substat weight threshold",
      zh: "必须存在副词条权重阈值",
    },
    mustPresentDesc: {
      en: "Substats with weight ≥ this value must appear on every artifact.",
      zh: "权重 ≥ 此值的副词条必须出现在每件圣遗物上。",
    },
    optionalConfig: {
      en: "Optional — skip if CR+CD auto-lock is enabled",
      zh: "此配置可跳过—若已开启双暴锁定",
    },
    computing: {
      en: "Recomputing configurations…",
      zh: "正在重新计算配置…",
    },
    passChance: { en: "Pass chance", zh: "达标概率" },
  },
  configure: {
    noChars: { en: "No characters found", zh: "没有找到角色" },
    noCharsDesc: {
      en: "Try adjusting your filters to see more characters",
      zh: "尝试调整您的过滤条件以查看更多角色",
    },
    clearConfirmTitle: {
      en: "Clear all saved data?",
      zh: "清除所有保存的数据？",
    },
    clearConfirmDesc: {
      en: "This removes every build and visibility setting. This cannot be undone.",
      zh: "此操作会移除所有配装和隐藏设置，且无法撤销。",
    },
    clearConfirmAction: { en: "Yes, clear everything", zh: "确认清除" },
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
    sandsMain: { en: "Sands Main Stat", zh: "时之沙主词条" },
    gobletMain: { en: "Goblet Main Stat", zh: "空之杯主词条" },
    circletMain: { en: "Circlet Main Stat", zh: "理之冠主词条" },
    missing4pc: {
      en: "Missing 4-piece artifact set",
      zh: "缺少4件套圣遗物套装",
    },
    missing2pc: {
      en: "Missing 2-piece artifact sets",
      zh: "缺少2件套圣遗物套装",
    },
    select2pc: {
      en: "Select two different 2-piece Set Effects",
      zh: "选择两个不同的2件套效果",
    },
    select2pcHint: {
      en: "You can combine any set that gives the same stat bonus.",
      zh: "您可以组合任意提供相同属性加成的套装。",
    },
    notEnough2pc: {
      en: "Not enough artifact sets with the same 2-piece effect",
      zh: "相同2件套效果的圣遗物套装数量不足",
    },
    missingSands: {
      en: "Need at least 1 sands main stat",
      zh: "需要至少1个时之沙主词条",
    },
    missingGoblet: {
      en: "Need at least 1 goblet main stat",
      zh: "需要至少1个空之杯主词条",
    },
    missingCirclet: {
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
    autoTuneBreakdown: { en: "Per-Team Breakdown", zh: "分队伍详情" },
    autoTuneSubstats: { en: "Substat Weights", zh: "副词条权重" },
    autoTuneMainStats: { en: "Main Stat Weights", zh: "主词条权重" },
    autoTuneIdealRolls: { en: "Ideal Rolls", zh: "理想词条数" },
    autoTuneLopsided: {
      en: "Lopsided allocation: the highest substat has ≥15 more rolls than the 2nd highest, suggesting this main stat forces an unbalanced build. Damage ratio is clamped to 100% — the best balanced combo defines the baseline.",
      zh: "词条分配不均：最多的副词条比第二多的多出≥15条，说明该主词条迫使副词条严重倾斜。伤害比例已限制在100%以内——以最佳均衡组合作为基准。",
    },
    autoTuneError: { en: "Calculation failed", zh: "计算失败" },
    autoTuneAddTeam: { en: "Add Team", zh: "添加队伍" },
    autoTuneFormulas: { en: "Formulas (Rotation)", zh: "公式（循环）" },
    autoTuneErWarning: {
      en: "ER from rotation requirement is not considered. Please manually add ER weights if needed.",
      zh: "未考虑循环充能需求。如有需要，请手动添加充能效率权重。",
    },
    autoTuneEditTeam: { en: "Edit Team", zh: "编辑队伍" },
    autoTuneEditDesc: {
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
        en: "1. Click {import} to use presets, or configure builds in {builds} tab.\n2. In {filters} tab, tweak custom controls to generate your own lock rules.\n3. Use AutoTune to let the optimizer calculate substat weights based on your teams.",
        zh: "1. 点击 {import} 使用预设，或在 {builds} 标签页中配置配装。\n2. 在 {filters} 标签页中调整自定义选项以生成属于你的锁定规则。\n3. 使用自动调参让优化器根据你的队伍自动计算副词条权重。",
      },
      tierList: {
        en: "1. Use {import} to load community tier list presets.\n2. Use {customize} to modify tier names and settings.\n3. Switch to the Weapon tab to create a separate priority list for weapons.",
        zh: "1. 使用 {import} 加载社区榜单预设。\n2. 使用 {customize} 修改梯度名称和设置。\n3. 切换到武器标签页，为武器单独创建优先级排名。",
      },
      accountData: {
        en: "1. Open {import} menu to find tools for GOOD JSON files (e.g. from Inventory Kamera) or import via UID (Enka).\n2. View build scores in {characters} tab.\n3. Check personalized upgrade suggestions in {recommendations} tab.\n4. Use Set Evaluation to check build completeness, and Artifact Triage for lock/unlock advice.",
        zh: "1. 打开 {import} 菜单查找 GOOD JSON 文件工具（如 Inventory Kamera）或通过 UID (Enka) 导入。\n2. 在 {characters} 标签页中查看配装评分。\n3. 在 {recommendations} 标签页中查看个性化升级建议。\n4. 套装评估可以查看配装完成度，锁定助手则帮你判断该锁定和回收哪些圣遗物。",
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
      buildCardContent: {
        en: "Select artifact sets and substats for each character. The filter will keep artifacts that match your criteria.",
        zh: "为每个角色选择圣遗物套装和副词条。过滤器会保留符合条件的圣遗物。",
      },
      computeTabTitle: { en: "Generate Filters", zh: "生成过滤器" },
      computeTabContent: {
        en: "Switch to the Compute tab to see your optimized filter configuration, ready to use with artifact filtering tools.",
        zh: "切换到计算标签页查看优化后的过滤配置，可直接用于圣遗物过滤工具。",
      },
      weightsTabContent: {
        en: "Let the optimizer figure out substat weights for you — it simulates your team comps to find the best priorities automatically.",
        zh: "让优化器根据你的队伍自动算出最佳副词条权重，省去手动调参的麻烦。",
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
      weaponsTabContent: {
        en: "Switch here to rank weapons the same way — drag and drop into tiers, filter by type or stats.",
        zh: "切换到这里给武器排名，操作方式和角色一样——拖拽到对应梯度即可。",
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
      evaluationContent: {
        en: "See how complete your artifact builds are at a glance — scored by set and grouped by completion tier, so you know where to farm next.",
        zh: "一览所有配装的圣遗物完成情况，按套装分组评分，方便规划接下来刷哪个副本。",
      },
      triageContent: {
        en: "Not sure which artifacts to keep? Triage analyzes your collection against your builds and tells you what to lock and what to toss.",
        zh: "拿不准哪些圣遗物该留？锁定助手会根据你的配装逐一分析，告诉你该锁哪些、该回收哪些。",
      },
    },
  },

  evaluation: {
    title: { en: "Artifact Evaluation", zh: "圣遗物评估" },
    tabLabel: { en: "Set Evaluation", zh: "套装评估" },
    resourcesTabLabel: { en: "Resources", zh: "资源规划" },
    subtitle: { en: "{0} builds · Avg {1}%", zh: "{0} 个配装 · 均值 {1}%" },
    goToBuilds: {
      en: "Configure Builds",
      zh: "配置配装",
    },
    sortAsc: { en: "Weakest first", zh: "最弱优先" },
    sortDesc: { en: "Strongest first", zh: "最强优先" },
    tierSortOff: { en: "Char tier: off", zh: "角色评级排序：关" },
    tierSortDesc: { en: "Char tier ↓", zh: "角色评级排序 降序" },
    tierSortAsc: { en: "Char tier ↑", zh: "角色评级排序 升序" },
    all: { en: "All", zh: "全部" },
    ownedOnly: { en: "Owned characters", zh: "仅已拥有角色" },
    resourceSuggestions: { en: "Resource Planning", zh: "资源投入规划" },
    suggestCraft: { en: "Craft", zh: "制作" },
    suggestReroll: { en: "Reroll", zh: "重铸" },
    suggestLevelup: { en: "Level Up", zh: "强化" },
    sanctifyingEssence: { en: "Sanctifying Essence", zh: "祝圣精华" },
    tierThresholds: { en: "Completeness goal", zh: "完成度目标" },
    minScoreDiff: { en: "Min score gain", zh: "最低收益" },
    gainLabel: { en: "Avg. Gain", zh: "平均收益" },
    sanctifyingElixir: { en: "Sanctifying Elixir", zh: "祝圣之霜" },
    dustOfEnlightenment: { en: "Dust of Enlightenment", zh: "启圣之尘" },
    pUpgradeLabel: { en: "P(upgrade)", zh: "升级概率" },
    reassess: { en: "Re-assess", zh: "重新评估" },
    noSuggestions: {
      en: "No suggestions — all builds meet their tier threshold.",
      zh: "暂无建议 — 所有配装已达到各自评级的阈值。",
    },
    helpTitle: {
      en: "How Scores Are Calculated",
      zh: "分数计算方式",
    },
    helpDesc: {
      en: "Each option compares the expected outcome against the best-scoring artifact for that slot in the build.",
      zh: "每个选项将操作的期望结果与该配装对应位置得分最高的圣遗物进行对比。",
    },
    helpBaselineTitle: { en: "Baseline", zh: "基准" },
    helpBaselineDesc: {
      en: "The comparison target is the score of the best-matching artifact for that slot in the build (as determined by Set Evaluation), including substat scores and main stat contribution.",
      zh: "对比基准为套装评估中该配装对应位置得分最高的圣遗物分数，包含副词条分数与主词条贡献。",
    },
    helpExpectedTitle: { en: "Expected Score", zh: "期望分数" },
    helpExpectedCraftDesc: {
      en: "Craft: you select 2 substats; the other 2 are drawn randomly from a weighted pool. Enumerates all possible draws, computes E[score] = rolls per sub × avg roll value, averaged over all draw outcomes. Roll budget: 8 (75%) or 9 (25%) total.",
      zh: "制作：选择2条副词条，另外2条从加权池中随机抽取。枚举所有可能的抽取结果，计算 E[分数] = 每条词条的强化次数 × 平均强化数值，对所有抽取结果取加权平均。总强化次数：8次(75%) 或 9次(25%)。",
    },
    helpExpectedRerollDesc: {
      en: "Reroll: keeps all 4 existing substats and their initial roll values. You select 2 substats; 2 guaranteed upgrades are distributed among them, remaining upgrades distributed randomly among all 4 substats. Total upgrade count is fixed (same as the original: 4 or 5 depending on 3-line or 4-line start).",
      zh: "重铸：保留全部4条现有副词条及其初始数值。选择2条副词条，2次保底强化在选中的2条中分配，剩余强化次数在全部4条副词条中随机分配。总强化次数固定不变（与原圣遗物一致：3词条起始为4次，4词条起始为5次）。",
    },
    helpExpectedLevelupDesc: {
      en: "Level up: starts from current substat values, adds expected gain from remaining upgrade rolls (each uniformly among 4 substats, value ×0.7/0.8/0.9/1.0). For 3-line artifacts, uses known 4th substat data when available for exact calculation.",
      zh: "强化：从当前副词条数值出发，加上剩余强化次数的期望收益（每次强化等概率分配到4条副词条，数值在×0.7/0.8/0.9/1.0间均匀分布）。3词条圣遗物在已知第4条词条时使用精确计算。",
    },
    helpMetricsTitle: { en: "Metrics", zh: "指标说明" },
    helpGainDesc: {
      en: "Avg. Gain = expected score − baseline. Positive means the action is expected to improve the slot on average.",
      zh: "平均收益 = 期望分数 − 基准分数。正数表示该操作预期能提升该位置的平均水平。",
    },
    helpPUpgradeDesc: {
      en: "P(upgrade) = exact probability that the outcome scores higher than the baseline. Computed by convolving the probability mass function over all possible roll outcomes (upgrade count × tier value × substat routing).",
      zh: "升级概率 = 结果分数超过基准的精确概率。通过卷积所有可能强化结果（强化次数 × 档位数值 × 词条分配）的概率质量函数计算。",
    },
    helpThresholdsTitle: { en: "Filtering", zh: "筛选条件" },
    helpThresholdsDesc: {
      en: "Only builds below the completeness goal for their character tier are analyzed. Min score gain filters out low-impact options. Both are configurable per tier.",
      zh: "仅分析未达到对应角色评级完成度目标的配装。最低分数收益用于过滤低价值选项。两者均可按评级自定义。",
    },
  },
  v2Weights: {},
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
    noBuildTitle: {
      en: "Auto Tune Substat Weights",
      zh: "自动调整副词条权重",
    },
    noBuildDesc: {
      en: "Automatically compute optimal substat weights for each character based on their team and rotation. Requires DPS builds and teams with matching artifact sets.",
      zh: "根据角色的队伍和循环自动计算最优副词条权重。需要输出配装和使用相同圣遗物套装的队伍。",
    },
    goToTeams: {
      en: "Create Teams",
      zh: "创建配队",
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
  greeting: {
    getStarted: { en: "Get Started", zh: "使用教程" },
    // Step 1: Account Data
    step1ActionHint: {
      en: "Import data via Account Management on the Account Data page. Recommended: bundled GOOD Scanner. Also supports other tools or UID import.",
      zh: "在「账号数据」页面通过“账号管理”导入数据。推荐使用网站配套GOODScanner，也可以使用其他工具或UID导入。",
    },
    previewCharacters: {
      en: "View character progression and scores",
      zh: "查看角色练度和评分",
    },
    previewInventory: {
      en: "Browse inventory weapons and artifacts",
      zh: "浏览背包武器和圣遗物",
    },
    previewRecommendations: {
      en: "Score-boosting options and embryo upgrade picks",
      zh: "了解提分选项，胚子升级推荐",
    },
    previewEvaluation: {
      en: "Check set reserves and weak spots",
      zh: "查看套装储备情况和短板",
    },
    previewTriage: {
      en: "Recommend artifact lock/unlock. Can auto-sync to game (OCR)",
      zh: "推荐圣遗物锁定、解锁。可自动同步至游戏（OCR）",
    },
    // Step 2: Builds
    step2BuildHint: {
      en: "Customize artifact builds on the Builds page. The system auto-applies them to:",
      zh: "在「配装」页面自定义圣遗物方案，系统自动应用到其他场景：",
    },
    customizeBenefitScoring: {
      en: "Personalized artifact scoring",
      zh: "个性化圣遗物评分",
    },
    customizeBenefitRecommendations: {
      en: "Personalized upgrade suggestions",
      zh: "个性化升级建议",
    },
    customizeBenefitLock: {
      en: "Personalized artifact lock management",
      zh: "个性化圣遗物锁定管理",
    },
    // Step 3: Teams
    step3ActionHint: {
      en: "Import or add teams on the Team DMG page, then simulate real team damage.",
      zh: "在「队伍伤害」页面导入或添加队伍，然后模拟真实的队伍伤害。",
    },
    previewDamage: {
      en: "View and optimize team damage (using account artifacts)",
      zh: "查看、优化队伍伤害（使用账号圣遗物）",
    },
    previewFrozen: {
      en: "Freeze multi-team artifacts. Can auto-sync to game (OCR)",
      zh: "冻结多支队伍的圣遗物，可自动同步至游戏（OCR）",
    },
    previewInvestment: {
      en: "Budget-friendly constellation/refinement upgrade order",
      zh: "符合XP、预算的补金顺序",
    },
    previewWeapon: {
      en: "Best weapon for your team comp",
      zh: "符合配队的最佳武器",
    },
    // Step 4: Help
    helpTitle: { en: "Need Help?", zh: "需要帮助？" },
    helpDesc: {
      en: "Use each page's help option to learn its features.",
      zh: "使用每个页面的帮助选项以了解其功能。",
    },
    letsGo: { en: "Let's Go!", zh: "出发！" },
    // News dialog
    newsTitle: { en: "What's New", zh: "最新更新" },
    viewFullHistory: { en: "View Full History", zh: "查看完整历史" },
  },
  calcLimitations: {
    title: { en: "Calculation Limitations", zh: "计算限制" },
  },
  triage: {
    tabLabel: { en: "Artifact Triage", zh: "锁定助手" },
    title: { en: "Artifact Triage Helper", zh: "圣遗物锁定助手" },
    subtitle: {
      en: "{0} artifacts analyzed:",
      zh: "已分析 {0} 个圣遗物：",
    },
    recommendLock: {
      en: "Recommend Lock",
      zh: "未锁定，建议锁定",
    },
    recommendUnlock: {
      en: "Recommend Unlock",
      zh: "已锁定，建议解锁",
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
      zh: "保护区不参与",
    },
    noActionDesc: {
      en: "High-level or equipped artifacts — already protected, no lock change needed",
      zh: "高等级或已装备的圣遗物——已受保护，无需改变锁定状态",
    },
    noChange: {
      en: "No Change",
      zh: "无需改变锁定状态",
    },
    noChangeDesc: {
      en: "Artifacts whose lock status already matches the recommendation",
      zh: "锁定状态已与建议一致的圣遗物",
    },
    noRecommendations: {
      en: "No items in this category",
      zh: "此类别中没有圣遗物",
    },
    // Decision labels (lock / unlock)
    label: {
      lock: { en: "Lock", zh: "锁定" },
      unlock: { en: "Unlock", zh: "解锁" },
    },
    // Chip labels (shown on each TriageCard, per tab)
    chip: {
      suggestLock: { en: "Suggest Lock", zh: "建议锁定" },
      suggestUnlock: { en: "Suggest Unlock", zh: "建议解锁" },
      locked: { en: "Locked", zh: "已锁定" },
      unlocked: { en: "Unlocked", zh: "已解锁" },
      protected: { en: "Protected", zh: "保护中" },
    },
    // Quality tier names
    tier: {
      prime: { en: "Prime", zh: "极品" },
      solid: { en: "Solid", zh: "精良" },
      filler: { en: "Filler", zh: "过渡" },
      fodder: { en: "Fodder", zh: "狗粮" },
      offPiecePattern: { en: "Off-piece keep", zh: "散件保留" },
    },
    // Rule descriptions (what decided the action)
    rule: {
      primeTierKeep: { en: "Prime — always keep", zh: "极品装全部保留" },
      solidTierKeep: { en: "Solid — default keep", zh: "精良装默认保留" },
      solidOversupplyUnlock: {
        en: "Over-supplied — solid fodder",
        zh: "供大于求，精良装分解",
      },
      fillerShortfallKeep: {
        en: "Under-supplied — filler kept",
        zh: "供不应求，过渡装保留",
      },
      fillerDefaultUnlock: {
        en: "Filler — default fodder",
        zh: "过渡装默认分解",
      },
      fodderSubstatMismatch: {
        en: "Substats don't match",
        zh: "副词条不匹配，狗粮分解",
      },
      noDemand: {
        en: "No build wants this main stat",
        zh: "主词条无需求，狗粮分解",
      },
    },
    // Special rule labels (short, for inline display)
    sp: {
      supportSetErHoard: {
        en: "4-liner ER (support set)",
        zh: "4初始充能（辅助套）",
      },
      allSetErHoard: { en: "4-liner ER (all sets)", zh: "4初始充能（全套装）" },
      levelProtected: { en: "Level protected", zh: "高等级保护" },
      equippedProtected: { en: "Equipped protected", zh: "已装备保护" },
      doubleCrit: { en: "4-liner CR+CD", zh: "4初始双暴" },
      setSlotFloor: { en: "Set+slot keep", zh: "套装部位最低保留" },
      offPiecePattern: { en: "Off-piece match", zh: "散件匹配保留" },
    },
    concentrationValue: {
      concentratedStat: {
        en: "Concentrated rolls in {0}",
        zh: "词条集中在 {0}",
      },
    },
    // Detail panel labels
    detail: {
      demand: { en: "Demand", zh: "需求" },
      supply: { en: "Supply", zh: "供给" },
      rankInTier: {
        en: "Rank {0}/{1} in {2}",
        zh: "{2}中第{0}/{1}",
      },
      lockReason: { en: "Lock reason", zh: "锁定原因" },
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
    qualityMargin: {
      en: "Demand margin (extra keep above demand)",
      zh: "需求余量数（满足需求后多留几个备用）",
    },
    alwaysLockSolidArtifacts: {
      en: "Always lock solid artifacts",
      zh: "精良装始终锁定",
    },
    fillerKeep: {
      en: "Filler backup cap (max backups when short)",
      zh: "过渡保底数（即使需求不足时最多留几个过渡）",
    },
    setSlotKeep: {
      en: "Min keep per set+slot",
      zh: "每套装每部位最少保留",
    },
    sortByTier: { en: "Tier", zh: "品质" },
    sortByName: { en: "Name", zh: "名称" },
    expandAll: { en: "Expand All", zh: "全部展开" },
    collapseAll: { en: "Collapse All", zh: "全部折叠" },
    erHoarding: {
      en: "ER hoarding (4-liner + ER)",
      zh: "辅助套充能锁定（4初始+充能）",
    },
    erHoardingAll: {
      en: "ER hoarding all sets (4-liner + ER)",
      zh: "全套装充能锁定（4初始+充能）",
    },
    doubleCritLock: {
      en: "Double crit lock (4-liner + CR+CD)",
      zh: "双暴锁定（4初始+暴击+暴伤）",
    },
    triageMode: {
      en: "Relaxed mode",
      zh: "宽松模式",
    },
    triageModeHint: {
      en: "Keeps more artifacts (looser tier thresholds)",
      zh: "保留更多圣遗物（品质阈值放宽）",
    },
    levelProtection: {
      en: "High-level threshold",
      zh: "高等级阈值",
    },
    highLevelProtection: {
      en: "Protect high-level",
      zh: "保护高等级",
    },
    equippedProtect: {
      en: "Protect equipped",
      zh: "保护已装备",
    },
    filterByHalfSet: { en: "Filter by 2pc set", zh: "按2件套过滤" },
    filterBySlot: { en: "Filter by slot", zh: "按部位过滤" },
    rulePrefixFlex: { en: "Off-piece", zh: "散件" },
    // Help dialog
    help: {
      title: { en: "How does this work?", zh: "这是怎么运作的？" },
      desc: {
        en: "Compares every artifact's substats against your builds to decide what to keep.",
        zh: "将每件圣遗物的副词条与你的配装需求进行比对，决定保留还是分解。",
      },
      howTitle: { en: "How it decides", zh: "决策方式" },
      howMatch: {
        en: "Match artifacts to builds by set, slot, and main stat. Each build has a few substats it cares about (core stats).",
        zh: "先按套装、部位、主词条把圣遗物匹配到可能的配装；每个配装有它在意的几条副词条（核心词条）。",
      },
      howRarity: {
        en: "Probability = chance that a random artifact of the same set, slot, and main stat has no fewer core-stat hits than this one. Lower probability → rarer.",
        zh: "概率 = 随便抓一件同套、同部位、同主词条的圣遗物，其核心词条命中数不少于当前这件的概率；概率越低 → 越稀有。",
      },
      howFactors: {
        en: "If this artifact has CR+CD together, 4 initial substats, or all core stats hit plus a useful minor stat, those conditions are added to the probability (harder to match → lower probability).",
        zh: "若这件同时带暴击和暴伤 / 初始 4 条副词条 / 核心全中且多出一条实用小词条，则在概率上再附加这些条件（越难满足，概率越低）。",
      },
      tierTitle: { en: "Rarity tiers", zh: "稀有度档位" },
      badgeAlwaysLock: { en: "Always lock", zh: "无条件锁定" },
      badgeAlwaysFodder: { en: "Always fodder", zh: "无条件解锁" },
      badgeOverSupply: { en: "Over-supply → unlock", zh: "供过于求 → 解锁" },
      badgeUnderSupply: { en: "Under-supply → lock", zh: "供不应求 → 锁定" },
      tierPrime: {
        en: "Flower / Plume ≤ 1.5%  ·  Others ≤ 0.5%  (relaxed mode: 3% / 1%) — Always locked.",
        zh: "花/羽 ≤ 1.5%  ·  沙/杯/头 ≤ 0.5%（宽松模式：3% / 1%）— 无条件锁定。",
      },
      tierSolid: {
        en: "Flower / Plume ≤ 6%  ·  Others ≤ 2%  (relaxed mode: 10% / 4%) — Locked unless you have too many.",
        zh: "花/羽 ≤ 6%  ·  沙/杯/头 ≤ 2%（宽松模式：10% / 4%）— 默认锁定，供过于求时淘汰。",
      },
      tierFiller: {
        en: "Flower / Plume ≤ 15%  ·  Others ≤ 10%  (relaxed mode: 25% / 20%) — Only kept when supply is short.",
        zh: "花/羽 ≤ 15%  ·  沙/杯/头 ≤ 10%（宽松模式：25% / 20%）— 仅在供不应求时保留。",
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
      setSlotFloorDetail: {
        en: "Set+slot keep: ensures a minimum piece count per set+slot.",
        zh: "套装部位最低保留：确保每个套装的每个部位达到最低件数。",
      },
      spProtect: {
        en: "Protection rules (no suggestions)",
        zh: "保护规则（不提供建议）",
      },
      spHighLevelOff: {
        en: "When high-level protection is off",
        zh: "关闭高等级保护后",
      },
      spHighLevelOffDetail: {
        en: "Leveled artifacts run through normal triage. Any that would be unlocked are re-checked by a strategic-value pass and kept if ≥60% of their upgrade rolls (rolls beyond the initial one-per-substat, min. 3 upgrades) fall into one category: CR+CD, ER, EM, ATK%, HP%, or DEF%.",
        zh: "已升级的圣遗物将走一遍正常评级。本应被淘汰的，会由策略价值规则再判定一次：若其升级词条（即每个副词条初始 1 次以外的后续强化，至少 3 次）中 ≥60% 集中在单一类别（双暴合并、充能、精通、攻击%、生命%、防御%），则予以保留。",
      },
    },
    flexDialogDesc: {
      en: "Auto-detected premium off-piece patterns. Toggle on to lock regardless of set. (Format: Slot·MainStat·SubStat)",
      zh: "自动检测的散件类型。开启后无视套装锁定。（选项为“部位·主词条·副词条”）",
    },
    globalRules: { en: "Global Rules", zh: "全局规则" },
    builtInPatterns: { en: "Built-in Patterns", zh: "内置散件" },
    mainLabel: { en: "Main", zh: "主" },
    subLabel: { en: "Sub", zh: "副" },
    customPatterns: { en: "Custom Patterns", zh: "自定义散件" },
    addCustomFlex: { en: "Add", zh: "添加" },
    customFlexDuplicate: {
      en: "Pattern already exists",
      zh: "该规则已存在",
    },
    customFlexInvalid: {
      en: "Invalid substat combination",
      zh: "副词条组合无效",
    },
    removeCustomFlex: { en: "Remove custom pattern", zh: "删除自定义散件" },
  },
  manager: {
    title: { en: "Artifact Manager", zh: "圣遗物管理器" },
    applyToGame: { en: "Apply to Game", zh: "应用到游戏" },
    equipToGame: { en: "Equip to Game", zh: "装备到游戏" },
    equipAll: { en: "Equip All", zh: "全部装备到游戏" },
    port: { en: "Port", zh: "端口" },
    connect: { en: "Connect", zh: "连接" },
    ready: { en: "Ready", zh: "就绪" },
    offline: { en: "Offline", zh: "离线" },
    busy: { en: "Busy", zh: "忙碌中" },
    gameNotRunning: { en: "Game not running", zh: "游戏未运行" },
    paused: { en: "Paused", zh: "已暂停" },
    submitting: { en: "Sending instructions...", zh: "正在发送指令..." },
    waitingForGame: {
      en: "Waiting for game interaction...",
      zh: "等待游戏交互...",
    },
    completed: {
      en: "{0} artifacts processed",
      zh: "已处理 {0} 个圣遗物",
    },
    applied: { en: "Applied", zh: "已成功" },
    alreadyCorrect: { en: "Already correct", zh: "已正确" },
    notFound: { en: "Not found", zh: "未找到" },
    errors: { en: "Errors", zh: "错误" },
    aborted: { en: "Aborted", zh: "已中止" },
    showDetails: { en: "Show details", zh: "显示详情" },
    minimize: { en: "Minimize", zh: "最小化" },
    close: { en: "Close", zh: "关闭" },
    processed: {
      en: "{0} / {1} artifacts processed",
      zh: "已处理 {0} / {1} 个圣遗物",
    },
    includeLock: { en: "Include lock instructions", zh: "包括锁定指令" },
    includeUnlock: { en: "Include unlock instructions", zh: "包括解锁指令" },
    connectionDesc: {
      en: "Connect to the local artifact manager to apply changes in-game.",
      zh: "连接本地圣遗物管理器以在游戏中应用更改。",
    },
    setupStep1: {
      en: "Download and open {0}",
      zh: "下载并打开 {0}",
    },
    setupStep2: {
      en: 'Go to the "Manager" tab',
      zh: '切换到"管理器"标签页',
    },
    setupStep3: {
      en: "Start the HTTP server",
      zh: "启动HTTP服务器（注意使用相同端口）",
    },
    setupStep4: {
      en: "Ensure the game client is set to Simplified Chinese",
      zh: "确保游戏客户端语言设置为简体中文",
    },
    syncArtifacts: {
      en: "Sync from Scanner",
      zh: "从扫描器同步",
    },
    snapshotAvailable: {
      en: "Scanner data available",
      zh: "扫描器数据可用",
    },
    snapshotDiff: {
      en: "Scanner: {0} artifacts ({1} locked) — Local: {2} artifacts ({3} locked)",
      zh: "扫描器：{0}个圣遗物（{1}个锁定）— 本地：{2}个（{3}个锁定）",
    },
    applyFullSync: {
      en: "Apply full sync",
      zh: "应用完整同步",
    },
    skipSync: {
      en: "Skip sync",
      zh: "跳过同步",
    },
    notFoundInfo: {
      en: "{0} not found in game",
      zh: "{0}个在游戏中未找到",
    },
    alreadyCorrectInfo: {
      en: "{0} already correct — local data updated",
      zh: "{0}个已为正确状态 — 已更新本地数据",
    },
    errorInfo: {
      en: "{0} failed — unchanged",
      zh: "{0}个失败 — 未更改",
    },
    errorCors: {
      en: "Server is running but the browser is blocking the connection.",
      zh: "服务器正在运行，但浏览器阻止了连接。",
    },
    errorCorsHint: {
      en: "A browser extension may be modifying request headers. Try disabling extensions or using incognito mode.",
      zh: "浏览器扩展可能在修改请求头。请尝试禁用扩展或使用无痕模式。",
    },
    errorNotGOODScanner: {
      en: "Server found on this port, but it is not GOODScanner (HTTP 404). Check that the port number matches.",
      zh: "该端口有服务器响应，但不是 GOODScanner（HTTP 404）。请检查端口号是否正确。",
    },
    errorRejected: {
      en: "Server rejected the request (HTTP 403). A browser extension or firewall may be modifying requests.",
      zh: "服务器拒绝了请求（HTTP 403）。浏览器扩展或防火墙可能在修改请求。",
    },
    errorAuth: {
      en: "Server requires authentication (HTTP 401). A proxy or firewall may be intercepting requests.",
      zh: "服务器要求身份验证（HTTP 401）。代理或防火墙可能在拦截请求。",
    },
    errorTimeout: {
      en: "Server timed out (HTTP 408). GOODScanner may be overloaded or unresponsive.",
      zh: "服务器超时（HTTP 408）。GOODScanner 可能负载过重或无响应。",
    },
    errorServer: {
      en: "Server error (HTTP {0}).",
      zh: "服务器错误（HTTP {0}）。",
    },
    errorUnexpected: {
      en: "Unexpected response (HTTP {0}).",
      zh: "意外的响应（HTTP {0}）。",
    },
  },
  scanner: {
    syncFromGame: { en: "Sync from Game", zh: "从游戏同步" },
    title: { en: "Scan from Game", zh: "从游戏扫描" },
    description: {
      en: "Scan your in-game inventory with GOODScanner and sync the results into this account.",
      zh: "使用 GOODScanner 扫描游戏内背包，并将结果同步到当前账号。",
    },
    scanTargets: { en: "What to scan", zh: "扫描内容" },
    startScan: { en: "Start Scan", zh: "开始扫描" },
    statePending: { en: "Pending", zh: "待扫描" },
    countScanned: { en: "{0} scanned", zh: "已扫描 {0}" },
    fetchingData: {
      en: "Fetching scan results...",
      zh: "正在获取扫描结果...",
    },
    scanComplete: { en: "Scan complete", zh: "扫描完成" },
    scanPartial: { en: "Scan partially complete", zh: "扫描部分完成" },
    allAborted: { en: "All categories aborted", zh: "全部类别已中止" },
    partialApplyHint: {
      en: "Only completed categories will be applied. Aborted categories are skipped.",
      zh: "仅应用已完成的类别，已中止的类别将被跳过。",
    },
    noData: { en: "No data", zh: "无数据" },
    countItems: { en: "{0} entries", zh: "{0} 项" },
    applyToAccount: { en: "Apply to account", zh: "应用到账号" },
    applyCompletedOnly: {
      en: "Apply completed categories",
      zh: "应用已完成的类别",
    },
    nothingToApply: {
      en: "Nothing to apply — no category completed successfully.",
      zh: "没有可应用的数据 — 没有类别成功完成。",
    },
    syncApplied: {
      en: "Synced: {0}",
      zh: "已同步：{0}",
    },
    syncWarnings: {
      en: "{0} unknown entries were skipped",
      zh: "有 {0} 个未识别条目被跳过",
    },
  },
  tierList: {
    dpsSet: { en: "DPS Set", zh: "输出套" },
    supportSet: { en: "Support Set", zh: "辅助套" },
    otherSet: { en: "Other Set", zh: "其他套" },
    manageLists: { en: "Switch List", zh: "切换榜单" },
    manageListsDesc: {
      en: "Switch between tier lists or create new ones.",
      zh: "切换排行榜或创建新的排行榜。",
    },
    linkedAccount: { en: "Account:", zh: "账号：" },
    createNew: { en: "Create New Tier List", zh: "创建新排行榜" },
    importChoice: { en: "Import Tier List", zh: "导入排行榜" },
    importChoiceDesc: {
      en: "Override the current tier list or create a new one?",
      zh: "覆盖当前排行榜还是创建新的？",
    },
    importOverride: { en: "Override Current", zh: "覆盖当前" },
    importCreateNew: { en: "Create New", zh: "创建新的" },
  },
  erCalc: {
    noMatchingTeamFound: {
      en: "No matching team found in Team DMG",
      zh: "未找到匹配的队伍配置",
    },
    title: { en: "ER Requirements Calc (WIP)", zh: "能量需求 (开发中)" },
    erRequirements: { en: "ER Requirements", zh: "充能需求" },
    copyResults: { en: "Copy results", zh: "复制结果" },
    applyToTeamMinER: { en: "Apply to team Min ER", zh: "应用到队伍最低ER" },
    copied: { en: "Copied", zh: "已复制" },
    bindingModeStart: { en: "start", zh: "启动" },
    bindingModeRepeat: { en: "repeat", zh: "循环" },
    qWindowScalableRow: { en: "scalable", zh: "可充能" },
    qWindowBinding: { en: "binding", zh: "瓶颈" },
    qWindowEmpty: { en: "—", zh: "—" },
    qWindowLoopFirst: { en: "Loop (first)", zh: "循环轴（首次）" },
    qWindowLoopSubsequent: {
      en: "Loop (subsequent)",
      zh: "循环轴（后续）",
    },
    particleEnergyTitle: {
      en: "Particle / orb energy at 100% ER (scales with ER)",
      zh: "100% 充能下的微粒 / 元素球能量（受充能影响）",
    },
    scalableEnergyTitle: {
      en: "Scalable flat energy at 100% ER (scales with ER, e.g. orb grants)",
      zh: "100% 充能下的可充能固定能量（受充能影响，如元素球赋能）",
    },
    flatEnergyTitle: {
      en: "Fixed flat energy (NOT affected by ER)",
      zh: "固定能量（不受充能影响）",
    },
    actionsLabel: { en: "actions", zh: "个动作" },

    // Settings bar labels
    startEnergy: { en: "Start energy", zh: "初始能量" },
    zeroEnergy: { en: "Empty", zh: "零能量" },
    fullEnergy: { en: "Full", zh: "满能量" },
    particleEst: { en: "Particle est.", zh: "产球估算" },
    minEst: { en: "Min", zh: "最低" },
    avgEst: { en: "Avg", zh: "期望" },
    maxEst: { en: "Max", zh: "最高" },
    optimizeWaits: { en: "Auto Waits", zh: "自动添加等待" },
    optimizeWaitsTitle: {
      en: "Insert wait blocks to minimize team ER",
      zh: "插入等待节点以降低团队所需充能",
    },
    resetFavDefaults: { en: "Reset Fav", zh: "重置西风默认" },
    resetFavDefaultsTitle: {
      en: "Reapply Favonius default proc placement for all wielders",
      zh: "为所有西风武器持有者重新应用默认产球位置",
    },

    // Timeline controls
    loopLabel: { en: "Loop", zh: "循环轴" },
    loopOnce: { en: "× Once", zh: "× 1次" },
    loopRepeat: { en: "× Repeat", zh: "× ∞ 重复" },
    startupLabel: { en: "Startup", zh: "启动轴" },
    addStartup: { en: "+ Startup", zh: "+ 启动轴" },
    addStartupTitle: {
      en: "Add startup rotation",
      zh: "在循环轴前添加启动轴",
    },
    cloneLoop: { en: "Clone as Startup", zh: "复制为启动轴" },
    cloneLoopTitle: {
      en: "Clone loop as new startup rota",
      zh: "复制循环轴为新启动轴",
    },
    removeStartupTitle: {
      en: "Remove this startup rota",
      zh: "删除此启动轴",
    },
    addAction: { en: "Add action", zh: "添加动作" },
    addGrant: { en: "+ Energy Event", zh: "+ 能量事件" },

    // Grant chip + popover
    grantLabel: { en: "Grant", zh: "赋能" },
    grantEventTitle: { en: "Custom energy", zh: "自定义能量" },
    grantDesc: {
      en: "Grant flat energy to specific chars at this moment. Either as a fixed amount, or as a % of the recipient's burst cost. Neither is ER-scaled. For ER-scaled enemy orb drops, use a separate enemy orb event.",
      zh: "在此刻向指定角色授予固定能量。可填固定值或爆发消耗的百分比，皆不受充能影响。可充能的敌方产球请使用单独的「怪物产球」事件。",
    },
    grantFlat: { en: "flat", zh: "固定" },
    grantPercent: { en: "%cost", zh: "%消耗" },
    grantFlatTitle: {
      en: "Flat energy (not ER-scaled)",
      zh: "固定能量（不受充能影响）",
    },
    grantPercentTitle: {
      en: "% of recipient's burst cost (resolves to flat, not ER-scaled)",
      zh: "对方爆发消耗的百分比（解析为固定能量，不受充能影响）",
    },
    addEnemyOrb: { en: "+ Enemy Orb", zh: "+ 怪物产球" },
    enemyOrbTitle: { en: "Enemy orb drop", zh: "怪物产球" },
    enemyOrbDesc: {
      en: "Orbs dropped by enemies (shield breaks, kills, etc.). Absorbed by the next on-field char, ER-scaled at 3x particle value.",
      zh: "敌方掉落的元素球（破盾、击杀等）。由下一个前台角色拾取，受充能影响，能量为微粒的 3 倍。",
    },
    enemyOrbCount: { en: "Orbs", zh: "球数" },
    enemyOrbElement: { en: "Element", zh: "元素" },
    enemyOrbClear: { en: "Clear", zh: "无色" },
    remove: { en: "Remove", zh: "删除" },

    // Main chip popover
    selfEnergy: { en: "Self energy", zh: "自身充能" },
    particlesLabel: { en: "Particles", zh: "生成微粒" },
    periodicAbsorbed: { en: "Periodic absorbed", zh: "吸收周期微粒" },
    drainLabel: { en: "Drain", zh: "消耗能量" },
    perProcSuffix: { en: "/proc", zh: "/次" },
    clearParticle: { en: "clear", zh: "中性粒子" },
    reactionTrigger: { en: "Triggers reaction", zh: "触发反应" },
    reactionIf: { en: "if", zh: "条件：" },
    perProcLabel: { en: "Per proc", zh: "每次微粒" },
    particleSuffix: { en: "P", zh: "球" },
    particlesSuffixTriggered: { en: " particles", zh: "产球" },
    attachPeriodic: {
      en: "Attach periodic proc",
      zh: "添加持续产球",
    },
    allTarget: { en: "all", zh: "全队" },

    noParticleGen: {
      en: "No particle generation",
      zh: "此动作不产生微粒",
    },

    // Warnings
    scholarNotImplemented: {
      en: "Note: Scholar 4pc (energy to bow/catalyst on particle gain) is not modeled; ER estimates ignore this bonus.",
      zh: "注意：学者 4 件套（触发粒子时为弓/法器队员回能）尚未实现，计算结果略偏高。",
    },

    addCharacter: { en: "Add character", zh: "添加角色" },
    noWeapon: { en: "No weapon", zh: "无武器" },
  },
};
