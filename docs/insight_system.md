# Recommendation System

圣遗物优化建议系统。基于组合优化器为每个角色找到最优 build，再 diff 当前装备生成可执行建议。

## 架构

```
recommendationEngine.ts  → 入口：两轮约束优化 + diff 生成建议
candidatePool.ts         → 构建候选池：current / swap / upgrade / reroll / farm
buildOptimizer.ts        → 5 槽组合优化器（分支定界 + CR 溢出惩罚）
crBudget.ts              → 计算非圣遗物 CR 预算（角色/武器/套装）
artifactProjection.ts    → 副词条投影（升级/洗/刷本期望值）
artifactScore.ts         → 评分：CD 当量转换、主词条评分
RecommendationView.tsx   → 页面入口（AccountData 页面使用）
RecommendationCard.tsx   → 角色维度卡片
ActionRecommendationCard.tsx → 单条建议卡片
```

> **注意**：旧的 `insightEngine.ts` / `InsightList.tsx` 已废弃，无页面引用。

## 流程

```
                  ┌─────────────────────────┐
                  │  generateAllRecommendations  │
                  └────────────┬────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   1. crBudget          2. candidatePool      (per character)
   计算非圣遗物CR        构建5槽候选列表
          │                    │
          └────────┬───────────┘
                   ▼
           3. buildOptimizer
           两轮约束优化
                   │
                   ▼
           4. diff → Recommendation[]
```

### Phase 1: CR Budget

计算角色不依赖圣遗物的暴击率总量，用于优化器判断 CR 溢出：

| 来源 | 说明 |
|------|------|
| baseCr | 固定 0.05 |
| ascensionCr | 突破属性 CR（超出 0.05 的部分）|
| weaponSecondaryCr | 武器副属性 CR |
| weaponPassiveCr | 武器被动 CR（取最大可能值）|
| artifactSetCr | 套装效果 CR（仅 4pc，取最大值）|

### Phase 2: Candidate Pool

每个槽位构建候选列表，每个候选带 `source` 标签：

| Source | 来源 | 处理 |
|--------|------|------|
| `current` | 当前装备 | 投影到满级 |
| `swap` | 背包/低优先级角色的满级圣遗物 | 原样使用 |
| `upgrade` | 背包/低优先级角色的未满级圣遗物 | 投影到满级 |
| `reroll` | 当前装备的 5★ 满级圣遗物 | 重新分配强化（需有废词条或 9+ totalRolls）|
| `farm` | 虚拟理想圣遗物 | 每个目标主词条生成一个 |

**Steal 规则**：只能从严格低优先级 tier 的角色拿（`TIER_RANK[donor] > TIER_RANK[char]`）。

### Phase 3: Build Optimizer

5 槽组合优化器，核心特性：

- **套装约束**：按 build 定义的 4pc / 2pc+2pc 枚举所有合法的槽位-套装分配模式
  - 4pc: 5 种模式（每种 1 个 flex 槽）
  - 2pc+2pc: C(5,2)×C(3,2) = 30 种模式
- **Top-K 剪枝**：每个槽位只保留前 15 个候选（`TOP_K_PER_SLOT = 15`）
- **分支定界**：partial score + 剩余槽位 upper bound ≤ 当前最优 → 剪枝
- **CR 溢出惩罚**：`penalty = max(0, totalCr - 1.0) × 100 × 2 × (crWeight / 100)`
- **输出**：Top-N builds（默认 3），按 finalScore 排序

### Phase 4: Two-Pass Constrained Optimization

```
Pass 1: 无约束优化 → 找到全局最优 build
         ↓
对每个槽位：如果 slotDiff < 对应 action 的 threshold → 标记为"不值得"
         ↓
Pass 2: 锁定"不值得"的槽位为 current-only → 重新优化
```

**投资阈值**（用户可调，`DEFAULT_INVESTMENT_THRESHOLDS`）：

| Action | 默认阈值 | 含义 |
|--------|---------|------|
| swap | 1.0 | 换装最低收益 |
| upgrade | 3.0 | 升级最低收益 |
| reroll | 7.0 | 洗词条最低收益 |
| farm | 5.0 | 刷本最低收益 |

### Phase 5: Diff → Recommendations

对比 optimal build 和当前装备，每个有差异的槽位生成一条 `Recommendation`：

```typescript
interface Recommendation {
  actionType: "swap" | "upgrade" | "reroll" | "farm" | "equip";
  slot: Slot;
  optimalArtifact: CandidateArtifact;  // 优化器选出的
  currentArtifact: ArtifactData | null; // 当前装备
  slotScoreDiff: number;               // 该槽位收益
  buildScoreDiff: number;              // 整体 build 收益
}
```

`slotScoreDiff < 0.5` 的建议被过滤。结果按 `slotScoreDiff` 降序排列。

## 投影算法

**运气系数**（per-tier 可配）：cautious=0.80 / balanced=0.85 / hopeful=0.90

### 升级投影

1. 3 词条未满级：先解锁第 4 词条（+1 次期望值），再分配剩余强化
2. 剩余强化 ≥5 次：高权重 2 词条各多 0.5 次，低权重 2 词条各 1 次，余量均分
3. 剩余强化 <5 次：均分

### 洗词条投影

保留词条类型，重分配强化次数：
- 8 次总强化（3 词条起始）：每个词条 +1 次
- 9 次总强化（4 词条起始）：top2 各 +1.5 次，bottom2 各 +1 次

### 刷本投影

保守估计：3 词条起始（8 次总强化），top4 权重词条各 2 次（均分 `[2,2,2,2]`）。

## 评分体系

副词条 → CD 当量：`score = value × multiplier × (weight / 100)`

| 词条 | 乘数 | 词条 | 乘数 |
|------|------|------|------|
| CR | ×2.0 | ATK%/HP% | ×1.3328 |
| CD | ×1.0 | DEF% | ×1.0658 |
| EM | ×0.3333 | ER | ×1.1991 |

小攻/小生/小防按 `globalConfig` 缩放。

---

## 开放问题

### 1. 优化器对 donor 的影响是单向的

系统只检查 `TIER_RANK[donor] > TIER_RANK[char]` 就允许 steal，但不评估拿走后 donor 会变差多少。如果 donor 是 B tier 而非 Pool，用户执行建议后可能发现 donor 角色明显变弱。

### 2. 两轮优化可能丢失全局最优解

Pass 2 锁定"不值得"的槽位后重新优化，但锁定决策基于 Pass 1 的结果。如果某个槽位在 Pass 1 中 diff 低是因为其他槽位的选择导致的耦合效应，锁定它可能排除了真正的最优解。

### 3. CR 溢出惩罚的权重系数是否合理？

`penalty = wastedCr × 100 × 2 × (crWeight/100)`，其中 `×2` 是硬编码的惩罚倍率。这个值太小可能导致推荐溢出 CR 的 build，太大则过度回避 CR 词条。用户无法调节。

### 4. TOP_K_PER_SLOT=15 的截断可能遗漏最优组合

每个槽位只保留分数前 15 的候选，但在套装约束下，某个槽位的"第 16 名"候选可能因为恰好满足套装需求而构成全局最优 build。尤其是 2pc+2pc 模式下，候选池被套装过滤后可能所剩无几。

### 5. 投资阈值的用户心智模型不清晰

用户看到的是 swap=1, upgrade=3, reroll=7, farm=5 这样的数字，但不清楚"3 分收益"在实际游戏中意味着什么。缺少将分数差异映射到实际伤害变化或相对百分比的参照物。

### 6. Farm 投影过于保守可能导致"永远不推荐刷本"

Farm 使用 `[2,2,2,2]` 均匀分配（8 次总强化），是所有投影中最保守的。加上 farm 阈值本身就高（默认 5.0），实际触发条件非常苛刻。用户可能期望在"当前圣遗物明显差"时看到刷本建议，但系统几乎不会给出。
