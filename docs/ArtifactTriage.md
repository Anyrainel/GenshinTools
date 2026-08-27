# Artifact Triage System — Rule-Based Design

> **Historical design note:** this document records the original triage proposal
> and is not the current behavioral contract. See `docs/TriageLockV2.md` for
> current quota semantics, universal hoarding rules, protection behavior, and
> defaults.

圣遗物去留决策系统。对背包中每一个 **+0 圣遗物**回答："锁还是分解？"

> 本文聚焦 +0 圣遗物（绝大多数使用场景）。已升级圣遗物的处理见附录 A。

---

## 设计原则

1. **Rule-based，非 score-based**：每条决策都有明确的规则来源，用户能清晰理解"为什么锁/不锁"
2. **不依赖具体权重值**：只依赖 build 中的词条**存在性**和**权重区间**（高/中/低/无），不用连续分数计算阈值
3. **质量是绝对的**：高质量胚子永远值得锁，已有库存只能让边缘胚子被放弃，不能让好胚子被跳过
4. **所有主观判断均可配置**：每个影响决策的阈值都暴露为用户可调设置
5. **可解释**：每个决策附带完整的规则链路径，用户可追溯

---

## 核心概念

### 1. Stat Tier（词条区间）

从每个 build 中提取词条分区，不使用具体权重值：

```typescript
type StatTier = "core" | "valuable" | "minor" | "unwanted";
```

| 区间 | 判定规则 | 含义 | 示例 |
|------|----------|------|------|
| **core** | 权重 ≥ 85 | 核心词条，最想要 | DPS build 的 CR、CD |
| **valuable** | 50 ≤ 权重 < 85 | 有价值，想要但不是最急需 | DPS build 的 ATK%、EM |
| **minor** | 0 < 权重 < 50 | 聊胜于无，有比没有好 | DPS build 的 ER |
| **unwanted** | 权重 = 0 | 完全不需要的废词条 | DPS build 的 DEF%、flat DEF |

> **用户可调**：区间边界值 `coreThreshold`（默认 85）和 `valuableThreshold`（默认 50）可在设置中修改。

### 2. Embryo Type（胚子类型）

**胚子类型**是圣遗物的需求分类标签，描述"这个圣遗物是为谁、以什么身份保留的"。每个圣遗物可以有多个胚子类型（因为可能同时服务于多个 build、多种身份）。

```typescript
type EmbryoType = {
  // 需求来源
  demandSource: DemandSource;
  // 匹配的 build 信息
  characterId: string;
  characterName: string;
  buildId: string;
  // 胚子位标识（用于库存分组和去重）
  embryoKey: string;  // 格式见下文
  // 词条评级
  grade: SubstatGrade;
};

type DemandSource =
  | { type: "4pc"; setKey: string }      // 作为 4 件套成员
  | { type: "2pc"; setKey: string }      // 作为 2+2 件套成员
  | { type: "flex" };                     // 作为散件（含稀有胚子散件）
```

#### Embryo Key（胚子位标识）

胚子位标识决定了"哪些圣遗物在竞争同一个位置"。不同 demand source 有不同的 key 格式：

| DemandSource | embryoKey 格式 | 示例 | 含义 |
|---|---|---|---|
| 4pc | `4pc:{set}:{slot}:{mainStat}` | `4pc:EmblemOfSeveredFate:sands:er` | 绝缘充能沙（4 件套用） |
| 2pc | `2pc:{halfSetId}:{slot}:{mainStat}` | `2pc:18atk:flower:*` | 攻击 +18% 两件套的花（任何提供此效果的套装） |
| flex | `flex:{slot}:{mainStat}` | `flex:circlet:cd` | 任何套装的暴伤头（散件） |

**关键设计**：2pc 的胚子位按 **halfSetId**（2 件套效果 ID）聚合，而非按具体套装。因为"追忆的攻击花"和"角斗的攻击花"在 2+2 场景下是完全可互换的——它们提供相同的 2 件套效果（ATK+18%）。

### 3. Demand Profile（需求画像）

从每个 build 的每个槽位提取需求画像：

```typescript
type DemandProfile = {
  buildId: string;
  characterId: string;
  characterName: string;
  // 需求类型
  demandSource: DemandSource;
  // 对于 4pc：具体套装 ID。对于 2pc：halfSetId。对于 flex：null
  setConstraint: string | null;
  // 对于 2pc：所有提供该 halfSet 效果的套装 ID 列表
  eligibleSets: string[] | null;
  // 槽位与主词条
  slot: Slot;
  acceptedMainStats: MainStat[];
  // 词条分区（从 build weights 映射而来）
  coreStats: SubStat[];
  valuableStats: SubStat[];
  minorStats: SubStat[];
};
```

#### Demand 提取规则

**4pc build**（如"绝缘 4 件"）生成：
- 4 个 `4pc` demand（套装内的 4 个槽位）
- 对于沙/杯/头的散件位：不单独生成 `flex` demand——散件评估由稀有胚子清单驱动（见 Step 1 第 3 步）

**2pc+2pc build**（如"追忆 2 + 角斗 2"）生成：
- 2 个 `2pc` demand（halfSet1 的 2 个槽位）→ `eligibleSets` = 所有提供相同 halfSet 效果的套装
- 2 个 `2pc` demand（halfSet2 的 2 个槽位）→ 同上

> 2pc demand 的槽位分配：由于 2+2 只需要每个半套 ≥2 件（不要求特定槽位），demand 提取时枚举所有 5 个槽位，每个槽位都同时生成 halfSet1 和 halfSet2 的 2pc demand。最终匹配时按"对该圣遗物最有利的 demand"选择。

**散件（flex）**：不由 build 直接生成 demand。散件评估仅在 Step 1 的第 3 步中，对沙/杯/头检查是否命中稀有胚子清单时触发。flex 的 DemandSource 仍存在于类型系统中，用于标记"此圣遗物作为散件被保留"。

### 4. Substat Grade（词条评级）

对一个 +0 圣遗物的词条组合，相对于某个 demand profile 进行评级：

```typescript
type SubstatGrade = {
  coreCount: number;      // 出现的 core 词条数量
  valuableCount: number;  // 出现的 valuable 词条数量
  minorCount: number;     // 出现的 minor 词条数量
  unwantedCount: number;  // 出现的 unwanted 词条数量（废词条）
  totalCount: number;     // 总词条数（3 或 4）
  initial4Line: boolean;  // 是否 4 初始词条
};
```

计算方式：将圣遗物的每个 substat 对照 demand profile 的分区归类，然后计数。

### 5. Half-Set Demand Summary（2 件套需求汇总）

系统预计算一张 **halfSet 需求汇总表**，将所有 2pc demand 按 halfSetId 聚合：

```typescript
type HalfSetDemandSummary = {
  halfSetId: string;              // 如 "18atk", "20er", "80em", "15anemo"
  halfSetName: string;            // 如 "攻击力+18%", "元素充能效率+20%"
  eligibleSets: string[];         // 提供此效果的所有套装 ID
  // 按槽位 × 主词条聚合的需求
  slotDemands: Map<string, {      // key = "{slot}:{mainStat}"
    demandCount: number;          // 需要这种胚子的角色数
    characters: string[];         // 角色名列表
    bestCoreStats: SubStat[];     // 所有 demand 中 core 词条的并集
    bestValuableStats: SubStat[]; // 所有 demand 中 valuable 词条的并集
  }>;
};
```

用途：
- 在 UI 中展示"攻击 +18% 两件套需要哪些胚子"
- 在 Supply Check 中，同一 halfSetId 下不同套装的圣遗物共享库存（追忆攻击花 和 角斗攻击花 是同一个库存池）

### 6. Rare Embryo Registry（稀有高需求胚子清单）

系统预计算一张**稀有胚子清单**——跨所有 build 统计，哪些 `(slot, mainStat, substat 组合)` 同时满足"高需求"和"低出现率"。

```typescript
type RareEmbryoEntry = {
  slot: Slot;
  mainStat: MainStat;
  requiredSubstats: SubStat[];     // 必须包含的词条（通常 1-2 个）
  // 需求指标
  demandCount: number;             // 有多少个 build 需要这种胚子
  demandCharacters: string[];      // 角色名列表
  // 稀有度指标
  mainStatDropRate: number;        // 该主词条的掉落概率（%）
  substatProbability: number;      // 在该主词条下，副词条包含 requiredSubstats 的概率（%）
  combinedRarity: number;          // mainStatDropRate × substatProbability（越低越稀有）
};
```

#### 稀有胚子的自动发现算法

```
for each (slot, mainStat) combination with mainStatDropRate ≤ 15%:
  for each build that accepts this (slot, mainStat):
    coreStats = build 的 core 词条列表
    if coreStats 包含 CR 和/或 CD:
      entry = {
        slot, mainStat,
        requiredSubstats: coreStats ∩ {CR, CD},  // 至少有一个暴击词条
        ...
      }
      compute substatProbability（在排除 mainStat 后的词条池中，出现 requiredSubstats 的概率）
      if combinedRarity ≤ RARE_THRESHOLD:  // 内部常量，默认 10%
        加入稀有胚子清单
```

> 稀有胚子阈值（combinedRarity 上限）由系统内部调优（默认 10%），用户只需通过 `rareEmbryoLockEnabled` 控制是否启用。

#### 典型稀有胚子示例

| 胚子 | 主词条掉率 | 副词条要求 | 综合稀有度 | 需求角色 |
|------|-----------|-----------|-----------|---------|
| 精通杯 + 双暴 | 4% (精通杯) | CR+CD | ~1.2% | 万叶、纳西妲、... |
| 元素伤害杯 + 双暴 | ~5% (各元素) | CR+CD | ~1.5% | 各元素 DPS |
| 暴伤头 + 暴击 | 10% | CR | ~3.5% | 所有 DPS |
| 暴击头 + 暴伤 | 10% | CD | ~3.5% | 所有 DPS |
| 充能沙 + 双暴 | 10% (充能沙) | CR+CD | ~3% | 雷电、草主、... |

稀有胚子清单在散件评估中起重要作用——即使 3 初始也值得保留（见下文规则）。

---

## 规则引擎

### 决策流程

对每个 +0 圣遗物，按以下顺序执行规则。

```
输入：artifact（+0 圣遗物）
     allDemandProfiles（所有 build 的需求画像）
     halfSetSummaries（2 件套需求汇总）
     rareEmbryoRegistry（稀有胚子清单）
     existingSupply（已有库存信息）
     userSettings（用户可调设置）

Step 1: CLASSIFY         — 该圣遗物有哪些胚子类型？
Step 2: QUALITY GATE     — 对每种胚子类型，词条够不够好？（不同类型规则不同）
Step 3: SUPPLY CHECK     — 库存是否允许降低宽容度？（仅对 BORDERLINE）
```

最终结果 = 所有胚子类型判定中**最优的那个**（LOCK > BORDERLINE > FODDER）。

### Step 1: Classify（胚子类型分类）

对圣遗物枚举所有可能的胚子类型。一个圣遗物可以同时拥有多种类型：

```
embryoTypes = []

// 1. 作为 4pc 套装件
for each demand where demand.type == "4pc" AND demand.setKey == artifact.setKey
    AND demand.slot == artifact.slotKey
    AND demand.acceptedMainStats.includes(artifact.mainStatKey):
  embryoTypes.push({ source: "4pc", demand, grade: computeGrade(artifact, demand) })

// 2. 作为 2pc 套装件（按 halfSetId 匹配）
for each demand where demand.type == "2pc"
    AND demand.eligibleSets.includes(artifact.setKey)
    AND demand.slot == artifact.slotKey
    AND demand.acceptedMainStats.includes(artifact.mainStatKey):
  embryoTypes.push({ source: "2pc", demand, grade: computeGrade(artifact, demand) })

// 3. 作为散件（仅沙/杯/头，通过稀有胚子清单驱动）
if artifact.slotKey in ["sands", "goblet", "circlet"]:
  for each rareEntry in rareEmbryoRegistry
      where rareEntry.slot == artifact.slotKey
      AND rareEntry.mainStat == artifact.mainStatKey
      AND artifact.substats contains all rareEntry.requiredSubstats:
    // 找到匹配此稀有胚子的 demand（用于 grade 计算）
    bestDemand = findBestMatchingDemand(artifact, rareEntry.demandCharacters)
    embryoTypes.push({ source: "flex", demand: bestDemand, grade: computeGrade(artifact, bestDemand), rareEntry })
```

如果 `embryoTypes` 为空：
- 结果：`FODDER`
- 理由：`"没有任何 build 需要 {setName} 的 {mainStat} {slot}"`

> 如果用户开启了 `includePresetBuilds`，preset 中的 build 也参与匹配（但在理由中标注为"来自预设"）。

### Step 2: Quality Gate（质量关卡）

对每种胚子类型，使用**不同的质量规则表**。这是核心设计：4pc 最宽松、2pc 更严格、稀有胚子散件使用独立规则表（仅沙/杯/头）。

#### 2A. 4pc 质量规则（标准严格度）

4 件套需要 4-5 件同套装圣遗物，凑齐难度最高，因此最宽容。

##### 锁定规则（4pc Lock Rules）

| 规则 ID | 条件 | 默认启用 | 理由模板 |
|---------|------|----------|----------|
| **L4-1** | coreCount ≥ 2 | 是 | "4pc {set}: 有 {coreCount} 个核心词条（{stats}），适用于 {character}" |
| **L4-2** | coreCount ≥ 1 AND valuableCount ≥ 2 | 是 | "4pc {set}: 核心词条 {coreStat} + {valuableCount} 个有价值词条" |
| **L4-3** | coreCount ≥ 1 AND valuableCount ≥ 1 AND initial4Line | 是 | "4pc {set}: 4 初始 + 核心 {coreStat} + 有价值 {valuableStat}，上限较高" |
| **L4-4** | valuableCount ≥ 3 | 是 | "4pc {set}: {valuableCount} 个有价值词条（{stats}）" |
| **L4-5** | valuableCount ≥ 2 AND initial4Line AND unwantedCount == 0 | 是 | "4pc {set}: 4 初始 + 无废词条 + {valuableCount} 个有价值词条" |

> 注：4 初始双暴胚子由 SP5 pre-check 在 Step 1 之前短路处理，不在此规则表中重复。

##### 分解规则（4pc Fodder Rules）

| 规则 ID | 条件 | 默认启用 | 理由模板 |
|---------|------|----------|----------|
| **F4-1** | unwantedCount ≥ 3 | 是 | "4pc: {unwantedCount} 个废词条，上限极低" |
| **F4-2** | coreCount == 0 AND valuableCount == 0 | 是 | "4pc: 无核心或有价值词条" |
| **F4-3** | coreCount == 0 AND valuableCount == 1 AND unwantedCount ≥ 2 AND NOT initial4Line | 是 | "4pc: 仅 1 有价值 + {unwantedCount} 废，3 初始上限不足" |

#### 2B. 2pc 质量规则（更严格）

2 件套只需 2 件同效果圣遗物，且**多个套装可以提供同一个 2 件套效果**（如追忆和角斗都给 ATK+18%），凑齐容易得多。因此锁定门槛更高。

##### 锁定规则（2pc Lock Rules）

| 规则 ID | 条件 | 默认启用 | 理由模板 |
|---------|------|----------|----------|
| **L2-1** | coreCount ≥ 2 AND unwantedCount ≤ 1 | 是 | "2pc {halfSet}: {coreCount} 核心词条 + 废词条少" |
| **L2-2** | coreCount ≥ 1 AND valuableCount ≥ 2 AND unwantedCount == 0 | 是 | "2pc {halfSet}: 核心 + 2 有价值 + 无废词条" |
| **L2-3** | coreCount ≥ 2 AND initial4Line | 是 | "2pc {halfSet}: 4 初始 + {coreCount} 核心词条" |
| **L2-4** | valuableCount ≥ 3 AND unwantedCount == 0 | 是 | "2pc {halfSet}: 3 有价值 + 无废词条" |

与 4pc 对比：L2 规则普遍要求更少的废词条（`unwantedCount == 0` 或 `≤ 1`），门槛更高。

##### 分解规则（2pc Fodder Rules）

| 规则 ID | 条件 | 默认启用 | 理由模板 |
|---------|------|----------|----------|
| **F2-1** | unwantedCount ≥ 2 AND coreCount ≤ 1 | 是 | "2pc: ≥2 废词条且核心不足，2pc 容易凑不值得将就" |
| **F2-2** | coreCount == 0 AND valuableCount ≤ 1 | 是 | "2pc: 无核心且有价值词条 ≤1，不值得保留" |

2pc 的分解规则比 4pc 更激进——同样的词条组合在 4pc 下可能是 BORDERLINE，在 2pc 下就直接 FODDER。

#### 2C. 稀有胚子锁定（散件，仅沙/杯/头）

> **散件只针对沙漏、杯子、头冠。** 花和羽毛主词条固定，不存在"难刷到对的主词条"的问题——即使最终某个角色用了散件花/羽，那也是恰好别的套装刷出来更好的，不需要刻意囤积。

散件的判定核心是**稀有胚子清单**（Rare Embryo Registry）。只有命中稀有胚子清单的沙/杯/头才会被评估为散件。

##### 稀有胚子锁定规则

| 规则 ID | 条件 | 默认启用 | 理由模板 |
|---------|------|----------|----------|
| **LR-1** | initial4Line | 是 | "稀有胚子: {slot} {mainStat} + {requiredSubstats}，4 初始（综合概率 {rarity}%）" |
| **LR-2** | unwantedCount ≤ 1 | 是 | "稀有胚子: {slot} {mainStat} + {requiredSubstats}，废词条少（综合概率 {rarity}%）" |
| **LR-3** | coreCount ≥ 2 AND unwantedCount ≤ 2 | 是 | "稀有胚子: {coreCount} 核心词条 + {slot} {mainStat}（综合概率 {rarity}%）" |

##### 稀有胚子分解规则

| 规则 ID | 条件 | 默认启用 | 理由模板 |
|---------|------|----------|----------|
| **FR-1** | unwantedCount ≥ 2 AND NOT initial4Line | 是 | "稀有胚子但 3 初始 + ≥2 废词条，上限不足" |

##### 什么算"稀有胚子"？

稀有胚子 = 某个 (slot, mainStat, requiredSubstats) 组合同时满足：
1. **有需求**：至少一个 build 接受这个 slot + mainStat
2. **难获得**：该组合的综合概率（主词条掉率 × 副词条命中率）低于阈值

典型示例：

| 胚子 | 主词条掉率 | 要求副词条 | 综合概率 |
|------|-----------|-----------|---------|
| 攻击沙 + 双暴 | 26.68% | CR+CD | ~8% |
| 充能沙 + 双暴 | 10% | CR+CD | ~3% |
| 精通沙 + 双暴 | 10% | CR+CD | ~3% |
| 任意元素伤害杯 + 双暴 | ~5% | CR+CD | ~1.5% |
| 精通杯 + 双暴 | 2.5% (此处为实际掉率) | CR+CD | ~0.8% |
| 暴伤头 + 暴击 | 10% | CR | ~3.5% |
| 暴击头 + 暴伤 | 10% | CD | ~3.5% |
| 攻击杯 + 双暴 | 21.25% | CR+CD | ~6.5% |

> 注意"攻击沙+双暴"综合概率 ~8%，算不算稀有取决于阈值设定。默认阈值 10% 会将其纳入，如果用户觉得攻击沙太常见，可以降低阈值到 5%。

> **用户可调**：`rareEmbryoLockEnabled`（默认 true）— 关闭后不对散件做任何锁定。稀有胚子清单的具体阈值由系统内部调优，用户无需手动设定。

#### 2E. Borderline（边缘）

对于某种胚子类型，如果既没有命中其锁定规则也没有命中其分解规则，该胚子类型下的判定为 `BORDERLINE`。

#### 2F. 跨类型结果聚合

一个圣遗物可能有多个胚子类型，各自产生不同的判定。取**最优结果**：

```
finalQualityResult = best of all embryoType results (LOCK > BORDERLINE > FODDER)
```

决策输出中记录**所有**胚子类型的判定结果，方便用户查看完整推理。最终结果标注是哪个胚子类型"拯救"了该圣遗物。

### Step 3: Supply Check（库存检查）

> **核心原则**：库存只能让 BORDERLINE 变成 FODDER，不能让 LOCK 变成其他。

仅对最终结果为 **BORDERLINE** 的圣遗物执行。

库存按 **embryoKey** 分组（见上文胚子位标识）。对该圣遗物的最优 BORDERLINE 胚子类型，查询其 embryoKey 对应的库存：

```typescript
type SupplyInfo = {
  embryoKey: string;
  // 同一 embryoKey 下已锁定的圣遗物数量
  lockedCount: number;
  // 同一 embryoKey 下已锁定且质量更好（命中了 Lock Rule）的数量
  lockedBetterCount: number;
  // 该 embryoKey 对应的需求数量（去重角色数）
  demandCount: number;
};
```

> **2pc 库存的特殊处理**：对于 `2pc:18atk:flower:*` 这样的 embryoKey，库存池包含**所有提供 ATK+18% 效果的套装**的花。角斗花和追忆花在 2pc 库存中是同一个池子。

#### 库存规则表

| 规则 ID | 条件 | 结果 | 理由模板 |
|---------|------|------|----------|
| **S1** | lockedCount == 0 | LOCK | "该类型（{embryoKey}）无库存，优先保留" |
| **S2** | lockedBetterCount < demandCount | LOCK | "已有 {lockedBetterCount} 个优质品，但需要 {demandCount} 个，库存不足" |
| **S3** | lockedBetterCount ≥ demandCount + surplusBuffer | FODDER | "已有 {lockedBetterCount} 个优质品，超出需求 {demandCount} + 缓冲 {buffer}" |
| **S4** | 其他 | BORDERLINE（维持） | "已有 {lockedCount} 个，需求 {demandCount} 个，可再观望" |

> **用户可调**：`surplusBuffer`（默认 1）— 超出需求多少个才允许放弃边缘胚子。

---

## 特殊规则模块（Special Rules）

独立于主流程的可选规则，每条可单独开关。

### SP1: ER Hoarding（充能囤积）

在 Step 1 之前执行（pre-check），命中即短路 LOCK。

```
条件：artifact 有 ER 副词条 AND initial4Line AND
      存在任何 build 将 ER 标记为 core
结果：LOCK
理由："4 初始充能胚子，{character} 对充能有极端需求"
```

> **用户可调**：开关 `erHoardingEnabled`（默认 **true**）。开启后，任何 4 初始的充能胚子只要有 build 需要高充能就自动锁定，不管套装和其他词条。

### SP2: Minimum Keep（最低保留数）

在 Step 3 (Supply Check) 中生效。保证每种**有需求的 (套装, 部位, 主词条) 组合**至少保留 N 个圣遗物——无论副词条质量如何，只要该组合有 demand，就从副词条最好的开始保留到 N 个。

```
条件：某个 embryoKey 下 lockedCount < minimumKeep
效果：在该 embryoKey 内，按 SubstatGrade 排序，
      将排名前 minimumKeep 个中尚未 LOCK 的圣遗物提升为 LOCK
理由："该类型（{embryoKey}）库存不足 {minimumKeep} 个，保留当前最优的"
```

这条规则统一覆盖了之前的三种场景：
- **稀有主词条**（如元素杯、暴伤头）：掉率低，自然难以积累到 N 个，所以 minimumKeep 生效
- **新套装**：总库存少，同理
- **常见主词条**：通常库存充裕不会触发，但如果真的一个都没有也能保底

> **用户可调**：`minimumKeep`（默认 1，范围 0-3）。设为 0 即关闭此规则。

### SP3: Max Level Protection（满级保护）

> 仅用于附录 A 中的已升级圣遗物流程。

```
条件：artifact.level >= maxLevel
效果：FODDER → BORDERLINE
理由："满级圣遗物（+{level}），分解损失大量经验"
```

> **用户可调**：`maxLevelProtection`（默认 true）

### SP4: Equipped Protection（装备保护）

```
条件：artifact 当前装备在某个角色身上
效果：FODDER → BORDERLINE
理由："当前装备在 {character} 身上"
```

> **用户可调**：`equippedProtection`（默认 true）

### SP5: Double Crit Lock（双暴无条件锁）

在 Step 1 之前执行（pre-check），命中即短路 LOCK。

```
条件：artifact 同时有 CR 和 CD 副词条 AND initial4Line AND
      artifact 有至少一个匹配的 demand（套装+部位+主词条被某个 build 需要）
结果：LOCK
理由："4 初始双暴胚子，适用于 {character}"
```

> **用户可调**：`doubleCritLockEnabled`（默认 true）。开启后，任何 4 初始的双暴圣遗物只要套装+主词条被某个 build 需要就自动锁定，不管其他词条。

---

## 用户设置汇总

```typescript
type TriageSettings = {
  // --- 区间边界 ---
  coreThreshold: number;            // 默认 85，权重 ≥ 此值归为 core
  valuableThreshold: number;        // 默认 50，权重 ≥ 此值归为 valuable

  // --- 库存管理 ---
  surplusBuffer: number;            // 默认 1，超出需求多少个才放弃边缘胚子
  minimumKeep: number;              // 默认 1 (范围 0-3)，每种有需求的胚子位至少保留几个

  // --- 特殊规则开关 ---
  erHoardingEnabled: boolean;       // 默认 true，4初始+充能副词条无条件锁
  doubleCritLockEnabled: boolean;   // 默认 true，4初始+双暴无条件锁
  rareEmbryoLockEnabled: boolean;   // 默认 true，稀有胚子锁定（作为散件）
  maxLevelProtection: boolean;      // 默认 true，满级保护
  equippedProtection: boolean;      // 默认 true，装备保护

  // --- 规则开关（高级） ---
  rules4pc: Record<string, boolean>;    // L4-1..L4-5, F4-1..F4-3
  rules2pc: Record<string, boolean>;    // L2-1..L2-4, F2-1..F2-2
  rulesRareEmbryo: Record<string, boolean>; // LR-1..LR-3, FR-1
  rules4star: Record<string, boolean>;  // L4s-1..L4s-3, F4s-1..F4s-2

  // --- 来源 ---
  includePresetBuilds: boolean;     // 默认 true，将 preset 作为隐式 demand
};
```

---

## 决策输出

```typescript
type TriageLabel = "LOCK" | "BORDERLINE" | "FODDER";

type TriageDecision = {
  artifactId: string;
  label: TriageLabel;
  // 所有胚子类型的判定结果
  embryoResults: EmbryoResult[];
  // 最终结果来源（哪个胚子类型决定了最终 label）
  decidingEmbryo: EmbryoResult;
  // 库存上下文（如果执行了 Supply Check）
  supplyContext: SupplyInfo | null;
  // 触发的特殊规则
  specialRules: string[];
};

type EmbryoResult = {
  embryoType: EmbryoType;
  label: TriageLabel;
  ruleId: string;          // 命中的规则 ID（如 "L4-1", "F2-2", "S1"）
  reason: string;          // 人类可读的理由
};

type RuleStep = {
  step: "SPECIAL_RULE" | "CLASSIFY" | "QUALITY_GATE" | "SUPPLY_CHECK";
  ruleId: string;
  result: TriageLabel;
  reason: string;
  isFinal: boolean;
};
```

### 理由展示示例

**LOCK — 作为 4pc 套装件：**

```
🔒 锁定
├─ 胚子类型 1: 4pc 魔女之花 (胡桃)
│   ├─ 词条: 暴击率[core] 暴击伤害[core] 攻击%[valuable] 小防御[unwanted]
│   ├─ 规则 L4-1 命中: "有 2 个核心词条（暴击率、暴击伤害），适用于 胡桃"
│   └─ → LOCK ✓
├─ 胚子类型 2: 稀有胚子散件 (宵宫)
│   ├─ 词条: 暴击率[core] 暴击伤害[core] 攻击%[valuable] 小防御[unwanted]
│   ├─ 规则 LR-3 命中: "2 核心词条 + 稀有胚子（综合概率 6.5%）"
│   └─ → LOCK
└─ 最终: LOCK (4pc 魔女, 规则 L4-1)
```

**LOCK — 套装件不行但稀有胚子拯救：**

```
🔒 锁定
├─ 胚子类型 1: 4pc 千岩之花 (钟离)
│   ├─ 词条: 暴击率[minor] 暴击伤害[minor] 精通[unwanted] 小攻击[unwanted]
│   ├─ 规则 F4-2 命中: "无核心或有价值词条"
│   └─ → FODDER ✗
├─ 胚子类型 2: 稀有胚子散件
│   ├─ 匹配稀有胚子: 精通杯+双暴（综合概率 1.2%）
│   ├─ 需求角色: 万叶、纳西妲、提纳里
│   ├─ 规则 LR-2 命中: "废词条 ≤1，值得保留"
│   └─ → LOCK ✓
└─ 最终: LOCK (稀有胚子, 规则 LR-2)
```

**FODDER — 所有胚子类型都不行：**

```
🗑 分解
├─ 胚子类型 1: 4pc 千岩之花 (钟离)
│   ├─ 词条: 小攻击[unwanted] 小防御[unwanted] 小生命[unwanted]
│   ├─ 规则 F4-1 命中: "3 个废词条，上限极低"
│   └─ → FODDER ✗
├─ 胚子类型 2: 2pc 生命+20% (钟离 2+2)
│   ├─ 词条: 小攻击[unwanted] 小防御[unwanted] 小生命[minor]
│   ├─ 规则 F2-2 命中: "无核心且有价值词条 ≤1"
│   └─ → FODDER ✗
├─ 稀有胚子散件: 无匹配（花不参与散件评估）
└─ 最终: FODDER (规则 F4-1)
```

**BORDERLINE → 被 2pc 库存降级为 FODDER：**

```
🗑 分解
├─ 胚子类型 1: 2pc 攻击+18% 充能沙 (宵宫 2+2)
│   ├─ 词条: 暴击率[core] 精通[minor] 小防御[unwanted]
│   ├─ 无规则命中 → BORDERLINE
│   ├─ 库存检查 (2pc:18atk:sands:er):
│   │   已有 4 个优质品（含角斗2个+追忆2个），超出需求 2 + 缓冲 1
│   ├─ 规则 S3 命中
│   └─ → FODDER ✗
├─ 稀有胚子散件: 未命中稀有胚子清单，不评估
└─ 最终: FODDER (规则 S3)
```

**BORDERLINE → 因稀缺被提升为 LOCK：**

```
🔒 锁定
├─ 胚子类型 1: 4pc 追忆暴伤头 (甘雨)
│   ├─ 词条: 攻击%[valuable] 暴击率[valuable] 小生命[unwanted]
│   ├─ 无规则命中 → BORDERLINE
│   ├─ 库存检查 (4pc:ShimenawasReminiscence:circlet:cd):
│   │   该类型无库存
│   ├─ 规则 S1 命中: "无库存，优先保留"
│   └─ → LOCK ✓
└─ 最终: LOCK (4pc 追忆, 规则 S1)
```

---

## 完整规则执行流程图

```
                      ┌─────────────┐
                      │  +0 Artifact │
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │ SP1 充能囤积 │ (pre-check)
                      │ SP5 双暴锁定 │
                      └──────┬──────┘
                      命中 → LOCK │ 未命中 → 继续
                             │
                      ┌──────▼──────┐
                      │ Step 1:      │
                      │ Classify     │
                      │ 枚举胚子类型  │
                      └──────┬──────┘
                      无类型 → FODDER │ 有类型 → 继续
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌────▼────┐  ┌──────▼──────┐
       │ 4pc 规则表   │ │2pc 规则 │  │稀有胚子规则  │
       │ L4-*/F4-*   │ │L2-*/F2-*│  │ LR-*/FR-*   │
       │（最宽松）    │ │（更严格）│  │（仅沙/杯/头）│
       └──────┬──────┘ └────┬────┘  └──────┬──────┘
              │              │              │
              │   各自产生 LOCK / BORDERLINE / FODDER
              └──────────────┼──────────────┘
                             │
                      ┌──────▼──────┐
                      │ 跨类型聚合   │
                      │ best of all  │
                      └──────┬──────┘
                       ┌─────┼─────┐
                    LOCK   BORDER  FODDER
                     │     LINE     │
                     │      │       │
                     │  ┌───▼───┐   │
                     │  │Step 3 │   │
                     │  │Supply │   │
                     │  │Check  │   │
                     │  │+ SP2  │   │
                     │  │最低保留│   │
                     │  └───┬───┘   │
                     │   ┌──┼──┐   │
                     │   L  B  F   │
                     │   │  │  │   │
                     └───┴──┴──┴───┘
                             │
                      ┌──────▼──────┐
                      │ SP3/SP4     │ (post-check)
                      │ 满级/装备保护│
                      │ FODDER→BORDR│
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │ Final Label  │
                      └─────────────┘
```

### 严格度梯度设计理由

为什么不同 demand source 使用不同的规则表：

| Demand Source | 严格度 | 理由 |
|---|---|---|
| **4pc** | 最宽松 | 需要 4-5 件同套装，凑齐最难，应当多留胚子 |
| **2pc** | 更严格 | 只需 2 件，且多个套装可提供同一效果（如 ATK+18% 有 5+ 个套装），库存池大，不需要将就 |
| **稀有胚子散件** | 中等 | 仅沙/杯/头。命中稀有胚子清单（高需求+低掉率组合）时评估，规则严格度介于 4pc 和 2pc 之间 |

---

## 计算模块结构

### 新增文件

```
src/lib/account-data/triage/
├── types.ts              — TriageLabel, EmbryoType, DemandProfile, SubstatGrade, TriageDecision, etc.
├── demandExtractor.ts    — 从 resolved builds 提取 DemandProfile[]（4pc/2pc demand），不生成 flex demand
├── embryoClassifier.ts   — Step 1: 为每个圣遗物枚举所有胚子类型（含稀有胚子检测）
├── halfSetSummary.ts     — 构建 HalfSetDemandSummary（2 件套需求汇总表）
├── rareEmbryoRegistry.ts — 构建 RareEmbryoEntry[]（稀有胚子自动发现）
├── substatGrader.ts      — 计算 SubstatGrade（圣遗物 × demand 的词条评级）
├── qualityRules.ts       — 三套规则表（4pc / 2pc / 稀有胚子散件）+ 4 星规则表
├── supplyChecker.ts      — 库存检查逻辑 (S1-S4) + SP2 最低保留数，含 2pc 跨套装库存池
├── specialRules.ts       — SP1 充能囤积, SP3 满级保护, SP4 装备保护, SP5 双暴锁定
├── triageEngine.ts       — 入口：组合以上模块，执行完整流程
└── defaults.ts           — 默认 TriageSettings
```

### 依赖关系

```
triageEngine.ts
├── demandExtractor.ts      (uses: resolved builds, preset builds, halfSet mappings)
├── halfSetSummary.ts       (uses: demand profiles, artifact set data)
├── rareEmbryoRegistry.ts   (uses: demand profiles, stat pool drop rates)
├── embryoClassifier.ts     (uses: artifact data, demand profiles, rare embryo registry)
├── substatGrader.ts        (uses: artifact data, demand profiles)
├── qualityRules.ts         (uses: SubstatGrade, EmbryoType, TriageSettings)
├── supplyChecker.ts        (uses: artifact inventory, embryoKey grouping, demand counts)
└── specialRules.ts         (uses: artifact data, TriageSettings)
```

**外部依赖**：
- `constants.ts`：`statPools`（主词条掉率）、`artifactIdToHalfSetId`（套装 → halfSet 映射）
- `types.ts`：`ArtifactData`、`Build`、`SubStat`、`MainStat` 等基础类型
- `useResolvedBuilds`：build 解析逻辑

**不依赖**：`artifactScore.ts`、`artifactProjection.ts`、`optimizerV2.ts`。本系统是独立的规则引擎。

---

## 与现有系统的关系

| 现有系统 | 关系 |
|----------|------|
| **Artifact Filter** | Filter = 模式级（"什么样的胚子值得留"）。Triage = 实例级（"这个具体的圣遗物留不留"）。Filter 可作为 Triage 的快速预检 |
| **推荐系统** (recommendation) | 互补。推荐 = "角色该用什么圣遗物"（自顶向下）。Triage = "这个圣遗物该不该留"（自底向上） |
| **评分系统** (artifactScore) | Triage 不使用评分系统的连续分数。只使用 build 的权重区间划分 |
| **优化器** (optimizerV2) | 无依赖。优化器太重且解决不同问题 |

---

## UI 设计概要

### 主视图：Inventory + Triage Overlay

在现有 Inventory 视图上叠加 triage 标签。每个圣遗物卡片显示：
- 彩色标签（LOCK / BORDERLINE / FODDER）
- 决定标签的胚子类型小图标（4pc / 2pc / flex / rare 徽章）

| 标签 | 颜色 | 含义 |
|------|------|------|
| LOCK | green | 锁定，值得保留 |
| BORDERLINE | amber | 边缘，建议再看看 |
| FODDER | red/muted | 分解，可以放弃 |

### 过滤与分组

- 按 triage label 过滤（"只看 FODDER"、"只看 BORDERLINE"）
- 按胚子位（embryoKey）分组展示：同类圣遗物放一起对比
- 按匹配的角色分组展示
- 按胚子类型过滤（"只看 4pc"、"只看散件"、"只看稀有胚子"）

### 详情面板

点击圣遗物展示完整推理（见上文理由展示示例），包括：
1. **所有胚子类型的判定**：每个类型各自的规则结果，标明哪个是最终决定
2. **词条评级可视化**：每个词条标注 core/valuable/minor/unwanted（按最终胚子类型着色）
3. **命中规则**：具体是哪条规则、哪个条件
4. **库存上下文**（如果是 BORDERLINE）：同 embryoKey 下有多少锁定的，需求多少
5. **稀有胚子信息**（如果命中）：综合概率、需求角色列表

### 汇总视图

#### Half-Set Demand Summary（2 件套需求总览）

按 halfSetId 分组展示需求：
- 每个 2 件套效果（如"ATK+18%"）列出哪些角色的 build 需要它
- 列出提供此效果的所有套装
- 按 slot × mainStat 展示需求数量和当前库存

#### Rare Embryo Registry（稀有胚子总览）

展示系统自动发现的稀有胚子清单：
- 每种稀有胚子的 slot + mainStat + 要求副词条
- 综合概率（越低越稀有）
- 需求角色列表
- 当前库存中是否有命中的圣遗物

### 设置面板

- 区间阈值滑块（core/valuable 边界）
- 特殊规则开关列表（SP1 充能囤积, SP5 双暴锁定, 稀有胚子锁定，每条可独立开关）
- 库存管理：surplusBuffer 滑块、minimumKeep 滑块 (0-3)
- 保护规则：满级保护 (SP3)、装备保护 (SP4)
- 高级：四套规则表各自的规则开关（L4-*/F4-*, L2-*/F2-*, LR-*/FR-*, L4s-*/F4s-*）
- Preset 导入选项

### 批量操作

- "一键锁定所有 LOCK 标签的圣遗物"
- "一键解锁所有 FODDER 标签的圣遗物"

---

## 4 星圣遗物规则

4 星圣遗物（指**套装上限为 4 星**的圣遗物，如武人、教官、流放）需要单独的规则体系。

> **5 星套装的 4 星版本**（如 4 星的绝缘、魔女等）：**一律 FODDER**。5 星版本严格优于 4 星版本，没有保留价值。

### 与 5 星的差异

| 维度 | 5 星 | 4 星（上限 4 星套装） |
|------|------|------|
| 初始词条数 | 3 或 4 | 2 或 3 |
| 总强化次数 | 5 次（Lv.0→20） | 4 次（Lv.0→16） |
| "好的"初始 | 4 初始 | **3 初始** |
| 胚子类型 | 4pc / 2pc / 散件 | **仅 4pc** |
| 保留动机 | 长期使用 | 过渡套 / 特殊4pc效果 |

### 4 星规则表

4 星圣遗物**仅评估 4pc 身份**，不评估 2pc 和散件。因为 4 星套装值得用通常是因为其 4pc 效果（如教官 4pc 增精通），单纯凑 2pc 或做散件不如用 5 星。

4 星的质量规则表与 5 星 4pc 共用相同结构，但调整"初始 4 词条"的概念为"初始 3 词条"：

| 规则 ID | 条件 | 理由模板 |
|---------|------|----------|
| **L4s-1** | coreCount ≥ 2 | "4pc {set}: 有 {coreCount} 个核心词条" |
| **L4s-2** | coreCount ≥ 1 AND valuableCount ≥ 1 AND initial3Line | "4pc {set}: 3 初始 + 核心 + 有价值" |
| **L4s-3** | valuableCount ≥ 2 AND initial3Line | "4pc {set}: 3 初始 + {valuableCount} 有价值" |
| **F4s-1** | unwantedCount ≥ 2 (out of 2-3 total) | "4pc: 废词条过多" |
| **F4s-2** | coreCount == 0 AND valuableCount == 0 | "4pc: 无核心或有价值词条" |

> 4 星圣遗物不参与 SP1 充能囤积、SP5 双暴无条件锁等 pre-check 规则。SP2 最低保留数正常生效。

---

## 附录 A: 已升级圣遗物处理

已升级圣遗物（level > 0）使用与 +0 相同的框架（胚子分类 → 质量关卡 → 库存检查），但质量关卡中引入**强化成长评估**，并且 SP3/SP4 保护规则生效。

### 核心差异

+0 圣遗物的判断基于"词条组合有没有潜力"，已升级圣遗物的判断基于"强化结果好不好"。

### 强化成长评估

对已升级圣遗物，除了 SubstatGrade（词条分区计数），额外计算 **UpgradeGrade（强化成长评级）**：

```typescript
type UpgradeGrade = {
  totalUpgrades: number;          // 已发生的强化次数（level / 4）
  coreUpgrades: number;           // 强化到 core 词条的次数
  valuableUpgrades: number;       // 强化到 valuable 词条的次数
  wasteUpgrades: number;          // 强化到 minor/unwanted 词条的次数
  upgradeEfficiency: number;      // (coreUpgrades + valuableUpgrades) / totalUpgrades
};
```

**如何判断每次强化去了哪个词条？**

如果圣遗物有 `initialValues`（GOOD v3 格式记录了每个词条的初始值），可以精确计算：
```
upgrades to stat X = (currentValue - initialValue) / avgRollValue
```

如果没有 `initialValues`，使用近似估计：
```
estimated rolls on stat X = currentValue / avgRollValue - 1  (减去初始 1 次)
```

### 已升级质量规则表

在原有 SubstatGrade 规则的基础上，追加以下规则。**已升级规则优先于 +0 规则执行**：

##### 已升级锁定规则

| 规则 ID | 条件 | 理由模板 |
|---------|------|----------|
| **LU-1** | upgradeEfficiency ≥ 0.7 AND totalUpgrades ≥ 3 | "强化成长良好（{coreUpgrades}+{valuableUpgrades}/{totalUpgrades} 次有效），继续培养" |
| **LU-2** | coreUpgrades ≥ 3 | "核心词条吃到 {coreUpgrades} 次强化，高成长" |

##### 已升级分解规则

| 规则 ID | 条件 | 理由模板 |
|---------|------|----------|
| **FU-1** | upgradeEfficiency ≤ 0.3 AND totalUpgrades ≥ 3 | "强化大部分歪了（{wasteUpgrades}/{totalUpgrades} 次浪费），建议放弃" |
| **FU-2** | wasteUpgrades ≥ 3 AND coreUpgrades == 0 | "0 次核心强化 + {wasteUpgrades} 次浪费，成长极差" |

##### 逻辑整合

对已升级圣遗物，Step 2 (Quality Gate) 的执行顺序为：

```
1. 先执行已升级规则（LU-1/LU-2/FU-1/FU-2）
2. 如果命中 → 使用已升级规则的结果
3. 如果未命中 → 回退到 +0 规则表（即基于 SubstatGrade 的 L4-*/F4-* 等）
```

### SP3/SP4 保护

已升级圣遗物独有的后处理保护：

- **SP3 满级保护**：+20（5 星）/ +16（4 星）的圣遗物，如果被标为 FODDER，提升为 BORDERLINE。因为分解损失大量经验。
- **SP4 装备保护**：装备在角色身上的圣遗物，如果被标为 FODDER，提升为 BORDERLINE。

### 各等级段的决策重点

| 等级 | 强化次数 | 判断重点 |
|------|---------|---------|
| +0 | 0 | 纯看初始词条组合 + 3/4 初始 |
| +4 | 1 | 第 4 词条揭示 + 第 1 次强化方向。仍主要看初始组合 |
| +8 | 2 | 开始能看出强化趋势，但样本小。以 +0 规则为主，已升级规则为辅 |
| +12 | 3 | 强化趋势较明确。已升级规则开始可靠 |
| +16 | 4 | 对 5 星还有 1 次机会，对 4 星已满级（SP3 生效） |
| +20 | 5 | 5 星满级。完全确定，无不确定性。SP3 生效 |

---

## 模拟验证结论

对 27 个场景进行了规则引擎模拟（13 DPS + 14 辅助/边缘），结果总结：

### 符合预期的行为

- 4pc > 2pc > flex 的严格度梯度正确运作：同样 {core=2, valuable=1, unwanted=0} 的圣遗物在三种身份下都 LOCK，但门槛差异在边缘 case 中体现
- 2pc 跨套装库存池正确：千岩水伤杯作为 2pc(HP+20%) 被夜兰的 2+2 build 正确识别
- 稀有胚子独立于套装评估：乐团精通杯+双暴（无任何 4pc/2pc demand）通过稀有胚子散件正确 LOCK
- 库存检查只降级 BORDERLINE：同一个追忆暴伤头在空库存时 LOCK（S1），在已有 2 个优质品时 FODDER（S3）
- SP2 minimumKeep 正确保留了绝缘充能沙+1核心词条的边缘胚子（该 embryoKey 库存不足）

### 已修复的设计问题

- **最低保留数的盲区**：当套装完全没有 build 配置时（如刚开始刷的新本），不产生任何 demand，因此 minimumKeep 不生效。这是正确行为——没有配 build 的套装不应自动保留。用户应先配 build 再使用 triage。

### 需要注意的设计取舍（非 bug，属个人偏好）

- **SP2 minimumKeep 对低质量胚子的保底**：如深林草伤杯（1 core + 2 flat waste）被 minimumKeep 保留为 LOCK（因为该 embryoKey 下库存不足 N 个）。这是有意设计——稀有主词条即使副词条差也值得暂时保留。不需要的用户可将 `minimumKeep` 设为 0。
- **稀有胚子清单是需求驱动的**：只有至少一个 build 接受某 (slot, mainStat) 组合时才会生成稀有胚子条目。例如没有 build 配置治疗头 → 治疗头+双暴不在稀有清单中。这在逻辑上正确（没人要就不留），但需要在 UI 中清晰说明"稀有胚子清单基于你的 build 配置生成"。

---

## 开放问题

### 1. 规则冲突处理

当前设计是短路求值（第一个命中的规则决定），但用户可能想看到"如果不考虑某条规则会怎样"。是否需要"what-if"分析功能？

### 2. 角色 Tier 在 Triage 中的影响

当前设计中角色优先级（tier）不直接影响 triage 决策。是否需要引入"高 tier 角色的 build demand 更重要"的概念？例如 S tier 角色的需求自动获得更高的 `surplusBuffer`？

### 3. 跨套装统一视图

用户可能想看"所有充能沙"而不是按套装分开看。是否需要一个跨套装的汇总视图？

### 4. 与 Artifact Filter 的整合

Artifact Filter 已有 keep/trash 概念。Triage 是否应该取代它，还是作为互补视图？
