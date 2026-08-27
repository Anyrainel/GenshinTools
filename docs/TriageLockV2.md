# 圣遗物锁定规则 V2 — 基于概率的统一体系

> 替换当前 `evaluate4pc` / `evaluate2pc` / `evaluateRareEmbryo` 三套独立规则，
> 用一套基于概率推导的统一评估框架。

---

## 设计目标

1. **有理有据**：每条规则的阈值都由概率计算推导，不是拍脑袋
2. **统一评估**：4pc/2pc/flex 共用一套质量评估，只在供需阶段区分
3. **弹性可调**：用户通过供需配额旋钮（fillerKeep, qualityMargin）和几个开关控制行为
4. **供需分离**：质量评估（"这个胚子好不好"）和供需决策（"我需不需要它"）明确分开
5. **主词条硬筛选**：主词条不是加分项，是门槛。不匹配的主词条直接跳过

---

## Build 原始输入格式

每个 Build 对每个部位提供：

```typescript
type BuildSlotDemand = {
  acceptedMainStats: { stat: MainStat; weight: number }[];  // 该部位接受的主词条 + 权重
  substats: {
    stat: SubStat;
    weight: number;     // 词条权重（反映对 Build 的重要程度）
  }[];
};
```

Build 来自角色配装数据，每个角色可有多个 Build（如 C0 vs C2 配装，或不同套装配装）。

### Build → 规则输入转换

Build 的原始权重需要经过以下步骤转换为上锁算法的输入：

#### 步骤1：按用户账号选择 Build（每套装一个）

同一个角色可能有多个 Build，对应不同的圣遗物套装配置（如 4pc 绝缘 vs 4pc 追忆）。
同一个套装配置下，可能有多个 Build 变体（如 C0 版和 C2 版）。

系统的 `selectBuildPerSet` 按以下逻辑选择：
1. 按套装配置分组（`buildSetKey`：4pc 用 `4pc:{setKey}`，2pc+2pc 用 `2pc:{set1}+{set2}` 排序后）
2. 每组中，选择 `minCons ≤ 用户命座` 的最高 `minCons` Build
3. 若无满足条件的 Build，fallback 到组内 `minCons` 最低的

```
例：角色有 3 个 Build
  - 4pc绝缘 C0 版
  - 4pc绝缘 C2 版
  - 4pc追忆 C0 版
用户角色命座 = 3
→ 选择 4pc绝缘 C2 版 + 4pc追忆 C0 版（每套装一个，共2个 Build 投入规则生成）
```

过滤后，每个角色×每个套装配置最多一个 Build 投入规则生成。

#### 步骤2：主词条过滤

主词条按权重过滤：低于 `mainStatThreshold`（默认 80）的主词条直接忽略。

```
例：Build 的杯子 acceptedMainStats = [{ pyro%: 100 }, { atk%: 30 }]
  mainStatThreshold = 80 → 只保留 pyro%，atk% 被过滤
```

#### 步骤3：副词条分类

副词条按权重分为 **desired**（需求）和 **optional**（可选/填充）：

```
optionalSubThreshold = 50  // 用户可调，0-100 权重刻度

weight ≥ optionalSubThreshold → desired（参与 hitCount 和概率计算）
weight < optionalSubThreshold → optional（仅参与排名）
```

crcd 修饰符由 desired 中是否同时包含 cr 和 cd 自动推导，不再需要 core/valuable 区分。

#### 步骤4：filler 推导

filler = desired 中每个 scaling%（ATK%/HP%/DEF%）对应的 flat 版本（ATK/HP/DEF），
前提是该 flat 词条在副词条池中可用（花排除 HP，羽排除 ATK），且不在 desired 中，且不等于主词条。

#### 步骤5：demand 计算

每个角色×每个套装投一票。相同 embryoKey（套装类型×套装×部位×主词条×desired）的票数汇总 = demand。

```
例：3个角色的 Build 都需要 绝缘×沙×ER% → demand = 3
```

### 转换后的规则输入

```typescript
type TriageRule = {
  characterId: string;
  buildId: string;
  demandSource: DemandSource;  // { type: "4pc", setKey } | { type: "2pc", halfSetId }
  slot: Slot;
  mainStat: MainStat;
  desired: SubStat[];    // weight ≥ threshold 的副词条
  optional: SubStat[];   // weight < threshold 的副词条（用于排名）
  fillers: SubStat[];    // desired 中 scaling% 对应的 flat 版本
  tierEntry: DemandTierEntry;  // 预计算的条件表条目
};
```

**主词条匹配规则**：圣遗物的主词条必须匹配 TriageRule 的 mainStat 才会被评估。
例：Build 只要 `pyro%` 杯 → ATK% 杯不匹配 → 不为这个 Build 评估。

---

## 四档质量体系

| 档位 | 含义 | 与供需的关系 |
|------|------|-------------|
| **Premium (极品)** | 极难复现 | 无条件锁，不看库存 |
| **Quality (优质)** | 值得保留 | 锁，但库存超额时不再收新的 |
| **Neutral (中性)** | 勉强能用 | 不锁，但库存不足时挑最好的留 |
| **Trash (劣质)** | 不值得留 | 无条件喂，不看库存 |

定档方法：基于 rarity 概率（见下文）。

---

## Rarity 概率：核心标尺

### 公式

Rarity 回答的问题：**"如果我重新刷，刷出一个至少跟这个一样好的胚子，概率是多少？"**

每个条件（condition）的 rarity 由两部分组成：

```
基础 rarity = P(主词条) × P(副词条命中 ≥ k | 4次抽样)
4L rarity   = P(主词条) × P4L × P(副词条命中 ≥ k | 4次抽样)
```

关键设计：**无论3线还是4线，副词条概率始终基于4次抽样**。所有5星圣遗物均显示4条副词条（3线的第4条为未激活状态），因此副词条命中判定基于4条全部可见的状态。

`P4L = 30%` — 4线乘数。实际域内掉落率为20%，但考虑到强化台回收(~34%)以及防止4L修饰符轻易跨档，设计上采用30%作为有效评估概率。

#### P(主词条)
该主词条在该部位的出现概率。来自 datamine。
- 花/羽：100%（固定主词条）
- 沙：scaling% ≈ 27%，EM/ER ≈ 10%
- 杯：scaling% ≈ 19%，元素% ≈ 5%，EM ≈ 2.5%
- 头：scaling% ≈ 22%，暴击 ≈ 10%，EM ≈ 4%

#### P(副词条命中)
从副词条池中无放回加权抽样 4 个（排除主词条），命中 ≥ k 个需求词条的概率。
副词条权重：flat(HP/ATK/DEF)=6, pct(HP%/ATK%/DEF%/EM/ER%)=4, crit(CR/CD)=3, 合计44。

---

## 条件修饰符系统 (Condition Modifiers)

### 三个修饰符

在基础 `hit≥k` 之上，有三个可选修饰符，按以下顺序叠加：

| 修饰符 | 含义 | 适用条件 | 质量信号强度 |
|--------|------|---------|-------------|
| **crcd** | 副词条同时包含 CR 和 CD | subN≥3 且 desired 包含 cr+cd，且 k < subN | 强（双暴协同） |
| **4L** | 初始4线 | k≥2 或 subN=1 | 中（更多强化机会） |
| **fill≥1** | 至少1个填充词条（scaling% 对应的 flat 版本） | k=subN 且有可用 filler 且 k+1≤4 | 弱（聊胜于无） |

### 格修饰符组合 (Lattice)

对每个 `hit≥k`，生成所有可用修饰符的 2³ 子集组合（最多8个），但**只保留有意义的**：

> **过滤规则**：一个修饰符组合只有当其中**每个修饰符都是必要的**时才保留。
> 具体地，对组合中的每个修饰符 m，去掉 m 后的子组合的 tier 不能是 P。
> 若去掉 m 后已经是 P，说明 m 是多余的（往一个已经是极品的条件上加限制没有意义）。

示例（3CC-fill 花，subN=3）：
- `hit≥3 & 4L & fill≥1` → 去掉 4L → `hit≥3 & fill≥1` = P → **4L 多余，不保留此组合**
- `hit≥3 & fill≥1` → 去掉 fill → `hit≥3` = Q → fill 有意义 → **保留**
- `hit≥2 & crcd & 4L` → 去掉 crcd → `hit≥2 & 4L` = N → crcd 有意义；去掉 4L → `hit≥2 & crcd` = N → 4L 有意义 → **保留**

### hit≥0 条件（稀有主词条兜底）

当 `hit≥1` 的无修饰符基础条件为 Trash 时，`hit≥0` 也一定是 Trash — 不生成 `hit≥0` 条件。
但当 P(main) 很低（稀有主词条）时，`hit≥0` 的 rarity = P(main) × 1.0 可能 ≤ N 阈值，
此时生成 `hit≥0` 条件，使0命中的圣遗物获得 Neutral（而非 Trash）。

```
例：EM 杯 P(main) = 2.5%
  rarity(hit≥0) = 2.5% → 花/羽阈值下 N，沙/杯/头阈值下不适用（EM杯是沙/杯/头, 2.5% ≤ 10% → N）
  → 生成 hit≥0 → N 条件
  → EM 杯即使0命中也是 Neutral，可被 fillerKeep 保底保留
```

`hit≥0` 不添加任何修饰符（crcd/4L/fill 在0命中时无意义）。

### 质量约束（防止反直觉定档）

1. **fill 仅在 hit≥|subN| 时生效**：fill 仅在所有 desired 副词条都命中时才作为锦上添花。不允许 `hit≥2 & fill≥1` 跳过 `hit≥3` 的情况。

2. **hit≥1 不展开**：当 subN > 1 时，`hit≥1` 不添加任何修饰符。命中只有1个时应追求更多命中，而非靠修饰符凑档。

3. **P4L = 30% 而非 20%**：防止 4L 修饰符轻易造成跨档（如 `hit≥2 & 4L` 比 `hit≥3` 档位高）。

---

## 概率 → 档位映射

### 阈值（按部位区分，固定不暴露给用户）

| 档位 | 花/羽 | 沙/杯/头 |
|------|-------|---------|
| **P** Premium | rarity ≤ 1% | rarity ≤ 0.5% |
| **Q** Quality | rarity ≤ 4% | rarity ≤ 2% |
| **N** Neutral | rarity ≤ 20% | rarity ≤ 10% |
| **T** Trash | rarity > 20% | rarity > 10% |

沙/杯/头的阈值为花/羽的一半。原因：沙/杯/头的主词条概率已经很低（P(main) ≤ 27%），
如果不收紧阈值，大量条件会塌缩为 Premium，失去区分度。

### 用户可调节的旋钮

| 旋钮 | 影响什么 | 默认值 |
|------|---------|-------|
| **fillerKeep** | 扩大后的目标内最多保留几个 Neutral | 3 |
| **qualityMargin** | 直接扩大每个 build demand，不区分质量档位 | 5 |
| **setSlotKeep** | 每个套装×部位至少保留几个圣遗物（SP6） | 3 |
| **optionalSubThreshold** | 副词条权重低于此值视为 optional（0-100 刻度） | 50 |
| **mainStatThreshold** | 主词条权重低于此值忽略（0-100 刻度） | 80 |
| **满级保护** (levelProtection) | ≥ 该等级不判 FODDER | 12 |
| **装备保护** (equippedProtection) | 已装备不判 FODDER | 开 |

条件表由 `tierTableBuilder.ts` 按需生成并缓存（基于结构等价类键），无需外部预计算。

### 命中计数

```
hitCount    = 副词条中命中 desired 的数量       ← 用于条件匹配和定档
hitOptional = 副词条中命中 optional 的数量      ← 仅用于同档内排名
hasCrCd     = 副词条同时包含 CR 和 CD
is4L        = 初始4线
hasFill     = hitCount == |desired| 且至少1个 filler 命中  ← fill 修饰符
hitTotal    = hitCount + hitOptional + (hasFill ? 1 : 0)   ← 排名用总命中
```

> **不再使用双路径 rarity**。V2 使用条件修饰符系统替代：
> fill 作为修饰符仅在 `hitCount == |desired|` 时考虑，而非作为独立的 expanded path。
> optional 不参与定档，仅用于同档圣遗物之间的排名比较。

### 花/羽的填充词条限制

花的主词条是 HP（固定），副词条池排除小生命(HP)。
羽的主词条是 ATK（固定），副词条池排除小攻击(ATK)。

- **花上 HP% 需求**：filler = HP 不在池中 → 该 demand 无 fill 修饰符可用
- **羽上 ATK% 需求**：filler = ATK 不在池中 → 同上
- 其他 slot/stat 组合的 filler 正常参与 fill 修饰符

### 硬性过滤（不看概率）

不再需要单独的硬性过滤规则。`hit≥0` 条件已自动处理：

- **常见主词条**（P(main) ≥ 15%）：rarity(hit≥0) 太高，不生成 hit≥0 条件 → hitCount=0 自然落入 Trash
- **稀有主词条**（P(main) < 15%）：rarity(hit≥0) 足够低，生成 hit≥0 → N 条件 → hitCount=0 可获 Neutral

> 花/羽(100%)、scaling%沙(~27%)、scaling%杯(~19%)、scaling%头(22%) 的 P(main) 都 ≥15%，0命中自然 Trash。
> EM/ER/元素%/暴击/治疗主词条 P(main) <15%，hit≥0 条件使其保留 Neutral 机会。

---

## 预计算条件查表

### 设计思路

运行时**不重新计算概率**。所有概率在 `tierTableBuilder.ts` 首次调用时按需计算，
生成一张以结构等价类为键的条件表并缓存在模块作用域。运行时只需判断圣遗物满足哪些条件，取最佳 tier。

### 结构等价类（Structural Equivalence Class）

不同的 (slot, mainStat, desired[]) 组合在概率上可能等价。等价性取决于：

1. **池权重分布**：desired 词条在副词条池中的权重向量（排序后）
2. **剩余权重**：池中非 desired 词条的总权重
3. **filler 权重**：filler 词条的权重和数量
4. **P(main)**：主词条概率（四舍五入到合理精度）
5. **部位类别**：花/羽 vs 沙/杯/头（决定 tier 阈值）

共享这5项的组合产生相同的条件表，只需存储一份。实际上只有约25个唯一的等价类。

### 条件表数据结构

```typescript
/** 一个可匹配的条件 */
type TierCondition = {
  k: number;           // 要求命中 ≥ k 个 desired 词条
  crcd: boolean;       // 要求同时有 CR 和 CD
  is4L: boolean;       // 要求初始4线
  fill: boolean;       // 要求至少1个 filler 命中（仅当 k == subN 时）
  tier: 'P' | 'Q' | 'N';  // 该条件对应的 tier（Trash 条件不存储）
};

/** 一个需求模式的完整查表数据 */
type DemandTierEntry = {
  subN: number;                // desired 词条数量
  hasCrCd: boolean;           // desired 是否包含 cr+cd
  hasFillers: boolean;        // 是否有可用 filler
  conditions: TierCondition[];  // 按 tier 从好到差排列（P → Q → N）
};
```

### 运行时评估算法

给定一个圣遗物和一个 TriageRule：

```typescript
function evaluateTier(
  artifactSubs: SubStat[],
  is4L: boolean,
  rule: TriageRule,
): {
  tier: QualityTier;
  hitCount: number;
  hitOptional: number;
  hitTotal: number;
  hasCrCd: boolean;
  hasFill: boolean;
  matchedCondition: TierCondition | null;
} {
  const hitCount = countHits(artifactSubs, rule.desired);
  const hitOptional = countHits(artifactSubs, rule.optional);
  const hasCrCd = artifactSubs.includes("cr") && artifactSubs.includes("cd");
  const hasFill = hitCount === rule.tierEntry.subN
    && rule.fillers.some(f => artifactSubs.includes(f));
  const hitTotal = hitCount + hitOptional + (hasFill ? 1 : 0);

  for (const cond of rule.tierEntry.conditions) {
    if (hitCount < cond.k) continue;
    if (cond.crcd && !hasCrCd) continue;
    if (cond.is4L && !is4L) continue;
    if (cond.fill && !hasFill) continue;
    return { tier: cond.tier, hitCount, hitOptional, hitTotal,
             hasCrCd, hasFill, matchedCondition: cond };
  }
  return { tier: "T", hitCount, hitOptional, hitTotal,
           hasCrCd, hasFill, matchedCondition: null };
}
```

**关键特性**：
- **O(n) 线性扫描**，n = 条件数（通常 ≤ 10）
- **无概率计算**：所有概率已预烘焙进条件表的 tier 字段
- **条件已经过 lattice 过滤**：不会出现冗余条件（如"已经 P 了还加修饰符"）
- **多 Build 取最佳**：圣遗物对每个匹配的 TriageRule 分别评估，取最佳 tier

### 关键场景示例

以 **3CC-fill**（cr+cd+atk%，花）为例：

```
desired = [cr, cd, atk%], subN = 3, fillers = [atk], slot = flower

预计算条件表（按 tier 排列）：
  hit≥3 & fill≥1      → P  (rarity = 0.10%)
  hit≥3                → Q  (rarity = 0.21%)
  hit≥2 & crcd & 4L   → Q  (rarity = 0.50%)
  hit≥2 & crcd         → N  (rarity = 1.66%)
  hit≥2 & 4L           → N  (rarity = 2.59%)
  hit≥2                → N  (rarity = 8.63%)

运行时评估示例：
  花，subs=[cr, cd, atk%, hp], is4L=false
  → hitCount=3, hasCrCd=true, hasFill=false（hp 不是 filler；需要 atk）
  → 匹配 hit≥3 → tier = Q

  花，subs=[cr, cd, atk%, atk], is4L=true
  → hitCount=3, hasCrCd=true, hasFill=true（atk 是 atk% 的 filler）
  → 匹配 hit≥3 & fill≥1 → tier = P
```

---

## 圣遗物评估流程

每个圣遗物经过以下评估流程：

### 1. 规则匹配

圣遗物按套装、部位、主词条匹配所有 TriageRule。匹配条件：
- **4pc 规则**：套装完全匹配
- **2pc 规则**：套装属于对应半套的等效套装组

每条匹配的规则独立执行 `evaluateTier()`，取最佳 tier 作为该圣遗物的质量定档。

### 2. 特殊规则标记

在正常评估同时，检查以下特殊规则：

| 规则 ID | 名称 | 条件 | 默认 | 效果 |
|---------|------|------|------|------|
| **SP1** | ER 囤积 | 4线 + ER 主/副词条 + 支援套 | 开 | 标记，后续强制锁 |
| **SP5** | 双暴锁 | 4线 + CR + CD，不要求 build 匹配 | 开 | 标记，后续强制锁 |
| **SP3** | 满级保护 | 等级 ≥ levelProtection | 12 | 标记为受保护（UI 展示在保护区） |
| **SP4** | 装备保护 | 已装备在角色身上 | 开 | 标记为受保护（UI 展示在保护区） |
| **SP6** | 套装部位保底 | 该套装×部位的锁定数 < setSlotKeep | 3 | 提升最好的未锁为锁 |
| **FLEX** | 散件匹配 | 匹配已启用的 flex pattern | — | 标记，后续强制锁 |

### 3. 供需决策

按 embryoKey 分组后执行供需配额逻辑（见下文）。

### 4. 特殊规则锁提升

SP1、SP5、FLEX 标记的圣遗物，若供需决策后仍为 unlock，强制提升为 lock。

### 5. 最终标签

每个圣遗物的最终标签 = 供需决策结果 + 特殊规则锁提升。

### 决策 Rule ID 说明

| Rule ID | 含义 |
|---------|------|
| **TP** | Premium tier → lock |
| **TQ** | Quality tier → lock（在扩大后的目标内） |
| **QB** | Quality borderline → unlock（供给超额，Quality 被淘汰） |
| **NK** | Neutral keep → lock（在扩大后的目标内，且未达到 fillerKeep） |
| **TN** | Neutral tier → unlock（正常情况） |
| **TF** | Trash/failed → unlock（副词条不匹配） |
| **TD** | No demand → unlock（无任何规则匹配此套装/部位/主词条） |
| **SK** | Set-slot keep → lock（SP6 保底） |
| **SP1/SP5/FLEX** | 特殊规则强制锁 |

---

## 供需配额系统

### 核心概念

每个 embryoKey（套装类型×套装×部位×主词条×desired 组合）有 `demand` 个需求槽位。
供需目标固定为 `capacity = demand + qualityMargin`。Premium、Quality、Neutral
按稳定质量排名依次占用同一个目标，不因跨过某个质量档位而切换算法：

```
Premium  → 永远 LOCK，并占用一个 capacity
Quality  → capacity 尚有空位时 LOCK，否则 UNLOCK
Neutral  → capacity 尚有空位且尚未达到 fillerKeep 时 LOCK，否则 UNLOCK
Trash    → UNLOCK
```

Premium 即使超过 capacity 仍全部保留；此时不会再为 Quality 或 Neutral 留出位置。
`qualityMargin` 只负责把 demand 扩大为连续的保留目标，`fillerKeep` 则作为反向约束，
防止扩大后的目标被过多 Neutral 填满。

SP1、SP5、FLEX 等通用囤积规则在供需分配完成后才提升为 LOCK，因此不占用
build-based capacity，也不会挤掉正常配装规则选中的圣遗物。

### Neutral 排名（从 Neutral 中填补目标时）

```
排序依据（优先级从高到低）：
1. hitCount 多的优先（desired 命中数）
2. hitTotal 多的优先（含 optional + fill）
3. 初始4线优先
4. 已强化等级高的优先（沉没成本）
```

### Quality 排名（场景B中选择保留哪些 Quality 时）

```
排序依据（优先级从高到低）：
1. hitCount 多的优先
2. hitTotal 多的优先（含 optional + fill）
```

### 无需求圣遗物 (TD)

不匹配任何 TriageRule 的圣遗物标记为 TD (no demand)，demand=0。
按 `套装:部位:主词条` 分组，UI 显示该组的狗粮总数。

### 套装部位保底 (SP6 / setSlotKeep)

在供需决策与特殊规则提升完成后，检查每个 `套装×部位` 的最终保留数量。
若不足 setSlotKeep（默认3），才从该组的 unlock 圣遗物中按 tier → 胚子质量 →
roll 质量 → 等级排序选最好的提升为 lock (SK)。它是最终下限，不会在 demand margin
之外再固定追加三件；已有锁定状态只能用于完全同质量候选之间的稳定排序。

### 重要原则

- **Premium 永远锁**：极品多少个都不嫌多
- **flex 层不查库存**：匹配即 LOCK

---

## 散件 (Flex) 系统

### Flex Pattern

Flex pattern 是**手工策展**的稀有主副词条组合模板，定义在 `flexRegistry.ts` 中。
它们独立于 Build，代表任何套装都值得保留的稀有胚子。

```typescript
type FlexPattern = {
  key: string;              // 唯一标识 "flex:{slot}:{mainStat}:{subs}"
  slot: Slot;
  mainStat: MainStat;
  requiredSubs: SubStat[];  // 必须包含的副词条
  rarity: number;           // rarity 概率（用于 UI 展示稀有度）
};
```

### 策展模板

模板使用紧凑格式定义：`[slot, mainStats[], subs[]]`，支持 `"elemental%"` 展开为7种元素%，
`"flat"` 根据主词条自动解析为对应的 flat 副词条（ATK%→ATK, HP%→HP, DEF%→DEF）。

示例模板：
- `["goblet", ["elemental%"], ["cr", "cd"]]` → 7种元素杯 + 双暴
- `["circlet", ["cr"], ["cd", "atk%"]]` → 暴击头 + 暴伤 + 攻击%
- `["sands", ["er"], ["cr", "cd"]]` → ER 沙 + 双暴

### 前置特殊规则

在正常评估之外，以下前置规则独立于 flex 系统，但效果类似（命中即锁）：

| 规则 | 默认 | 说明 |
|------|------|------|
| **SP1 4线充能** | 开 | 4线 + ER 主/副词条 + 支援套，不要求 build 匹配 |
| **SP5 4线双暴** | 开 | 4线 + CR + CD，不要求 build 匹配 |

---

## 用户设定汇总

| 设定 | 默认 | 说明 |
|------|------|------|
| **fillerKeep** | 3 | 扩大后的目标内最多保留几个 Neutral |
| **qualityMargin** | 5 | 直接扩大每个 build demand，不区分质量档位 |
| **setSlotKeep** | 3 | 每个套装×部位最终至少保留的圣遗物数 |
| **optionalSubThreshold** | 50 | 副词条权重低于此值视为 optional（0-100 刻度） |
| **mainStatThreshold** | 80 | 主词条权重低于此值忽略（0-100 刻度） |
| **levelProtection** | 12 | ≥ 此等级的圣遗物标记为受保护 |
| **equippedProtection** | 开 | 已装备不判 FODDER |
| **erHoardingEnabled** | 开 | SP1: 4线充能囤积 |
| **doubleCritLockEnabled** | 开 | SP5: 4线双暴锁 |
| **ownedOnly** | 开 | 只考虑已拥有角色的 Build |
| **disabledFlexPatterns** | [] | 用户关闭的 flex pattern key 列表 |

> 概率阈值、P4L、部位 tier 阈值不暴露给用户 — 这些是系统内部校准参数。

---

## 工作流总览

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ 1. 规则提取      │ ──→ │ 2. 圣遗物评估     │ ──→ │ 3. 供需 + 特殊规则 │
│                 │     │                  │     │                  │
│ selectBuildPerSet│     │ 匹配规则          │     │ 按 embryoKey 分组  │
│ buildToRules    │     │ evaluateTier     │     │ P/Q/N/T 配额分配  │
│ buildFlexPatterns│     │ 特殊规则标记       │     │ SP6 保底          │
│                 │     │ flex 检查         │     │ SP1/SP5/FLEX 锁提升│
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `types.ts` | V2 类型定义（TriageRule, FlexPattern, TierCondition 等） |
| `defaults.ts` | 默认设置 |
| `tierMath.ts` | 概率数学（pDrawSet, pJoint, getTier, 组合/排列） |
| `tierTableBuilder.ts` | 条件查表构建（懒加载，缓存，structuralKey） |
| `is4L.ts` | 初始4线检测 |
| `tierEvaluator.ts` | `evaluateTier()` — 核心质量评估 |
| `ruleBuilder.ts` | Build → TriageRule 转换（selectBuildPerSet, deriveFillers） |
| `flexRegistry.ts` | 散件模板策展 + FlexPattern 生成 |
| `triageEngine.ts` | 完整 V2 管线（runTriage） |
| `demandExtractor.ts` | 复用工具函数（getAcceptedMainStats, getEligibleSetsForHalfSet） |
| `index.ts` | 公共导出 |

---

## 开放问题

### ✅ 已解决：概率阈值校准

按部位区分的固定阈值（花/羽: P≤1%/Q≤4%/N≤20%，沙/杯/头: P≤0.5%/Q≤2%/N≤10%）。
沙/杯/头阈值为花/羽的一半，防止稀有主词条导致大量条件塌缩为 Premium。

### ✅ 已解决：初始3线/4线

4L 作为条件修饰符处理，P4L=30%。4L 不再是独立的"路径"，而是叠加在 hit≥k 上的可选修饰符。

### ✅ 已解决：命中分类与条件修饰符

- 旧的双路径 rarity（strict/expanded）已被**条件修饰符系统**替代
- 三个修饰符 {crcd, 4L, fill} 的 2³ 子集经 lattice 过滤后生成条件表
- fill 仅在 hit≥|subN| 时生效，防止 fill 替代真正的命中
- core/valuable 区分已废弃，由 crcd 修饰符自动推导替代
- optional 词条不参与定档，仅用于同档排名（hitTotal）

### ✅ 已解决：稀有主词条 0 命中

通过 `hit≥0` 条件自然处理：稀有主词条 rarity(hit≥0) = P(main) 足够低时生成 N 条件，
常见主词条 rarity(hit≥0) 过高则不生成。不再需要单独的硬性过滤规则。

### ✅ 已解决：Build → 规则转换

通过 optionalSubThreshold 将 Build 权重转化为 desired/optional 分类，
通过 selectBuildPerSet 按套装分组、命座匹配选择最合适的 Build 版本，
通过角色×套装投票计算 demand。

### 待设计：roll 质量（强化评估）

胚子筛选阶段（Lv0~Lv11）：不看 roll 质量，只看命中。已确定。

**Lv≤11 的圣遗物**：视为胚子评估。通过 `totalRolls - 升级次数` 还原 initialRolls，
按胚子命中逻辑定档（等同于 Lv0 评估）。

**Lv≥12 的圣遗物**：已经过多次强化，应按实际成长质量评估。
需要另一套系统，后续设计。
