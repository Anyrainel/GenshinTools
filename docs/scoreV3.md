# Artifact Score V3: Multiplicative Scoring with Crit Correction

## The Problem with V2

V2 derives substat weights via **midpoint marginal analysis**: run a greedy 40-roll allocation, then measure each stat's marginal damage gain at the 50% operating point. This has a fundamental flaw:

**Midpoint marginals measure scarcity, not value.**

Example: A CD-circlet build starts with ~62% CD from the circlet main stat plus ~50% from ascension/weapon, but only ~5% CR. At the midpoint (after applying half the greedy allocation), CR is still scarce relative to CD. Since `expectedDmg = baseDmg × (1 + cr × cd)`, the marginal gain of CR is proportional to CD (high) and the marginal gain of CD is proportional to CR (low). Result: **CR gets weight 100 for nearly every DPS build**, regardless of whether the build actually needs more CR.

This isn't a tuning problem — it's structural. Any single-point marginal evaluation will overvalue the stat that's scarce at that point. The multiplicative interaction between CR and CD means their relative marginal is always `cd/cr`, which diverges when CR is low.

### What Users Need

1. **A single number (0-300)** summarizing build quality, comparable across characters
2. **Per-artifact scores** identifying which pieces to upgrade or replace
3. **Main stat recommendations** with clear priority ordering
4. **Correct crit valuation** — don't recommend more CR when already at 85%

V2 handles (1-3) well but fails at (4). V3 must fix crit scoring without sacrificing the rest.

---

## Core Insight: Multiplicative Decomposition

Genshin's damage formula is multiplicative:

```
D = T_scale × T_rxn × T_crit × T_dmg × T_enemy
```

Where:
- **T_scale** = `baseATK × (1 + totalATK%) + totalFlatATK` (or HP/DEF/EM variant)
- **T_rxn** = `1 + rxnBonus + rxnCoeff × totalEM / (2000 + totalEM)` (amplifying reactions)
- **T_crit** = `1 + min(totalCR, 1) × totalCD` (expected crit damage)
- **T_dmg** = `1 + totalDMG%` (all DMG bonuses)
- **T_enemy** = enemy DEF/RES factor (independent of artifacts)

Each "total" stat is the sum of a **fixed** part (character + weapon + artifact sets + team buffs) and a **variable** part (artifact main stats + substats):

```
totalATK% = fixedATK% + artATK%
totalCR    = fixedCR   + artCR
totalCD    = fixedCD   + artCD
...
```

The fixed parts can be extracted from `TeamBuild` once per character build. The variable parts come from the user's artifacts.

**Key property:** In log-space, the factors are additive:

```
ln(D) = ln(T_scale) + ln(T_rxn) + ln(T_crit) + ln(T_dmg) + const
```

This means each multiplicative factor contributes independently to relative damage improvement.

---

## V3 Design: Pre-Baked Factor Scoring

### Overview

**Offline** (per character build, using full TeamBuild):
1. Extract fixed stat values by evaluating TeamBuild with zero artifact substats
2. Compute ideal artifact stats (from greedy allocation)
3. Compute `D_ideal` = damage with ideal artifacts
4. Store compact per-build data: fixed values, ideal values, D_ideal

**Runtime** (when scoring a user's artifacts):
1. Read the user's artifact stats
2. Compute each T factor using stored fixed values + actual artifact stats
3. `score = 300 × D_actual / D_ideal`

This is pure arithmetic at runtime — ~15 multiplications, one division, one `min()` for CR clamp. No TeamBuild needed.

### Extracting Fixed Values

For each character build + team context:

```typescript
// 1. Build TeamBuild with full team (weapons, artifacts, buffs)
const teamBuild = new TeamBuild(teamConfigs);

// 2. Compute stats with zero artifact substats but correct main stats
const zeroSubstatSheet = new StatSheet(mainStatsOnly);
const teamStats = teamBuild.getTeamStats(
  { [dpsCharId]: zeroSubstatSheet },
  dpsCharId, ctx
);

// 3. Read off the fixed values from the resolved stat sheet
const stats = teamStats[dpsCharId];
const fixed = {
  baseATK:    stats.baseATK,
  totalATK_pct: stats.atkPercent,   // everything except artifact substats
  totalFlatATK: stats.flatATK,
  totalCR:    stats.critRate,
  totalCD:    stats.critDamage,
  totalEM:    stats.elementalMastery,
  totalDMG:   stats.dmgBonus,
  totalER:    stats.energyRecharge,
  // ... per scaling stat variant
};
```

These fixed values fold in **all** complex interactions:
- Character base stats + ascension stat
- Weapon base ATK + secondary stat + passive
- Artifact set bonuses (Blizzard Strayer +40% CR, Emblem ER→DMG%, etc.)
- Team buffs (Bennett ATK, Kazuha DMG%, Shenhe flat DMG, resonances)
- Conditional passives evaluated at the reference point

### Handling Stat-Scaling Buffs

Some buffs depend on the character's own stats (e.g., Emblem 4pc: `burstDMG% += ER × 0.25`). These create coupling between artifact substats and the "fixed" values.

**Solution: Freeze at reference point.** Evaluate stat-scaling buffs with "typical good" substats (e.g., half the ideal allocation) and treat the result as fixed.

**Error analysis:** If ER substats vary by ±15% between a "decent" and "great" build, and Emblem 4pc contributes ~30% of total DMG%, the error in T_dmg is `0.15 × 0.25 × 0.30 ≈ 1.1%`. For scoring purposes, this is negligible — well within the noise of substat RNG.

Most buffs (Bennett ATK, Kazuha DMG%, resonances) don't scale with the buffed character's own stats at all, so they're exactly captured.

### The T Factor Formulas

At runtime, given stored fixed values `F` and actual artifact stats `A`:

**T_scale (ATK-scaling):**
```
T_scale = F.baseATK × (1 + F.atkPct + A.atkPct) + F.flatATK + A.flatATK
```

**T_scale (HP-scaling):**
```
T_scale = F.baseHP × (1 + F.hpPct + A.hpPct) + F.flatHP + A.flatHP
```

**T_scale (DEF-scaling):**
```
T_scale = F.baseDEF × (1 + F.defPct + A.defPct) + F.flatDEF + A.flatDEF
```

**T_crit:**
```
T_crit = 1 + min(F.cr + A.cr, 1) × (F.cd + A.cd)
```

The `min()` naturally handles CR overcapping. A user at 95% CR with mediocre CD will score lower than one at 70% CR with great CD — as it should be.

**T_rxn (amplifying reactions):**
```
totalEM = F.em + A.em
T_rxn = 1 + F.rxnBonus + F.rxnCoeff × totalEM / (2000 + totalEM)
```

For builds without amplifying reactions: `T_rxn = 1` (constant, dropped from scoring).

**T_dmg:**
```
T_dmg = 1 + F.dmgPct + A.dmgPct
```

Where `A.dmgPct` comes from elemental/physical DMG% goblet main stats (substats don't provide DMG%).

### Scoring Formula

```
D_actual = T_scale_actual × T_rxn_actual × T_crit_actual × T_dmg_actual
D_ideal  = T_scale_ideal  × T_rxn_ideal  × T_crit_ideal  × T_dmg_ideal  (pre-computed)

score = 300 × D_actual / D_ideal
```

Or equivalently, using the ratio form:

```
score = 300 × (T_scale_actual/T_scale_ideal)
            × (T_rxn_actual/T_rxn_ideal)
            × (T_crit_actual/T_crit_ideal)
            × (T_dmg_actual/T_dmg_ideal)
```

Each ratio is in [0, ~1], and their product gives the build's efficiency.

### Per-Artifact Scoring

To score a single artifact, compute the total score with and without it:

```
artifactScore = score(withArtifact) - score(withoutArtifact)
```

Since the T factors are fast to evaluate, this is trivial. This also naturally captures the **marginal value** of each artifact — an artifact that provides CR when the build already has 95% CR will score low, while the same artifact on a CR-starved build will score high.

This is a major improvement over V2's fixed-weight approach, where CR always gets the same weight regardless of the user's actual stats.

---

## Handling Multiple Damage Formulas

Characters have multiple talent formulas (Normal Attacks, Elemental Skill, Burst, etc.). Different formulas may have different scaling stats (e.g., Zhongli Burst scales with ATK, Skill scales with HP).

### Approach: Weighted Formula Sum

```
D = Σ_f  w_f × D_f
```

Where `w_f` is the relative importance of formula `f` (can be equal weights, or user-configurable rotation weights).

Each `D_f` has its own set of fixed values (different talent multipliers, possibly different scaling stats). At the offline stage, extract fixed values per formula. At runtime:

```
D_actual = Σ_f  w_f × T_scale_f(A) × T_rxn_f(A) × T_crit(A) × T_dmg_f(A)
```

Note that `T_crit` is shared across formulas (same CR/CD pool), but `T_scale` and `T_dmg` may differ per formula.

**Simplification for most characters:** The vast majority of DPS builds use formulas that all scale with the same stat (ATK) and share the same DMG bonus type. For these, a single set of fixed values suffices. Only characters like Zhongli (mixed HP/ATK scaling) need per-formula fixed values.

### Deriving Formula Weights

Options (in order of preference):

1. **Equal weights across all registered formulas** — simplest, decent for most characters
2. **Rotation-weighted** — count how many times each formula appears in a typical rotation (e.g., 5× Normal Attack, 1× Skill, 1× Burst). Can be defined per build profile
3. **Damage-weighted** — weight proportional to each formula's baseline damage contribution. Auto-derivable from TeamBuild

For V3 initial implementation, use option (1) as default with option (2) as an override in build profiles.

---

## Handling Energy Recharge

ER doesn't appear in the damage formula but is critical for rotation viability.

### Approach: Threshold with Soft Penalty

Each build defines an **ER threshold** (e.g., 140% for a character with good particle generation, 200% for an off-field burst support):

```
erPenalty = max(0, (erThreshold - totalER) / erThreshold) × penaltyWeight
adjustedScore = score × (1 - erPenalty)
```

- Below threshold: linear penalty proportional to shortfall
- At or above threshold: no penalty (no reward for excess ER)
- `penaltyWeight` controls severity (e.g., 0.15 means missing 100% of needed ER costs 15% of score)

### Determining ER Thresholds

1. **From team context:** Analyze particle generation and burst costs. This is complex and error-prone.
2. **From the greedy allocation:** If the greedy allocator assigns rolls to ER, it means ER has marginal value — but V3 doesn't use greedy for substat weights.
3. **From build profiles:** Manually specify per build. This is the most reliable approach.

For V3: store `erThreshold` in each `BuildV2Weights` (or the V3 equivalent). Default to 100% (no ER requirement). Build profiles can override.

---

## Handling Multiple Teams

A character may appear in multiple team contexts with different buff environments. The fixed values change per team.

### Approach: Per-Team Fixed Values, Averaged Score

```
score = 300 × mean_t( D_actual(F_t, A) / D_ideal(F_t) )
```

Where `F_t` are the fixed values for team context `t`.

Alternatively, average the fixed values across teams and use one set:

```
F_avg.cr = mean(F_t.cr)
F_avg.cd = mean(F_t.cd)
...
```

The per-team approach is more accurate but requires storing N sets of fixed values. The averaged approach is simpler but can misrepresent builds that perform very differently across teams.

**Recommendation:** Store per-team fixed values (they're small — ~10 numbers each), compute per-team scores, report the average. This also enables showing "score for Team A: 245, Team B: 260" in the UI.

---

## The CR Clamp: Why V3 Handles It Correctly

In V2, the CR clamp causes problems because weights are fixed:
- CR weight is determined at a single operating point
- A user with 90% CR still gets "CR is your best stat" advice

In V3, the clamp is evaluated with the **user's actual stats**:

```
T_crit = 1 + min(F.cr + A.cr, 1.0) × (F.cd + A.cd)
```

If `F.cr + A.cr > 1.0`, additional CR rolls contribute zero to T_crit. The score formula naturally reflects this — swapping a CR roll for a CD roll would increase T_crit (via higher CD multiplied by the clamped CR), and the score correctly prefers that.

**Per-artifact scoring also works correctly:** An artifact with high CR substat that pushes total above 100% will score poorly (because T_crit barely changes), while the same artifact on a low-CR build scores well.

This is the single biggest advantage of V3 over V2.

---

## Comparison with V2's CD-Equivalent Approach

V2 uses a linear scoring model:
```
score = normalizer × Σ_stats (value × coefficient × weight/100)
```

V3 uses a multiplicative model:
```
score = 300 × Π_factors (T_actual / T_ideal)
```

| Aspect | V2 (Linear) | V3 (Multiplicative) |
|--------|-------------|-------------------|
| Crit interaction | Fixed weights, ignores CR/CD balance | Natural: min(cr,1)×cd evaluated with actual stats |
| Stat saturation | Partially via midpoint marginals | Fully captured: diminishing returns are intrinsic |
| Cross-factor interaction | Ignored (ATK% and DMG% treated independently) | Captured: each factor is a ratio |
| Per-artifact scoring | Fixed weights, same for all users | Context-dependent: marginal value depends on other artifacts |
| Runtime cost | ~10 multiplications | ~15 multiplications |
| Stored data per build | 10 weights + normalizer | ~10 fixed values per team × N teams |

---

## What V3 Does NOT Change from V2

1. **Main stat combo enumeration** — V2's approach of enumerating all main stat combos and filtering by damage threshold is sound. V3 keeps this for main stat recommendations.

2. **Greedy allocation** — Still used offline to determine the ideal substat distribution (needed for `D_ideal`).

3. **300-point normalization** — `score = 300 × D_actual / D_ideal` naturally produces a 0-300 scale.

4. **Team database / build profiles** — Same curated team contexts drive the offline pipeline.

5. **Main stat scoring** — Handled naturally: wrong main stat → lower T_scale/T_dmg → lower score.

---

## Implementation Plan

### Phase 1: Fixed Value Extraction

Add to the offline pipeline:

```typescript
type V3FixedValues = {
  scalingStat: "atk" | "hp" | "def" | "em";
  baseScalingStat: number;     // e.g., baseATK
  fixedScalingPct: number;     // e.g., total ATK% from non-substat sources
  fixedScalingFlat: number;    // e.g., total flat ATK from non-substat sources
  fixedCR: number;
  fixedCD: number;
  fixedDmgPct: number;
  fixedEM: number;
  // Reaction parameters (if applicable)
  hasAmplifying: boolean;
  rxnBonus: number;            // fixed reaction bonus (e.g., Crimson Witch)
  rxnCoeff: number;            // 1.5 for vaporize, 2.0 for melt, etc.
  // ER
  erThreshold: number;
};
```

Extract by calling `teamBuild.getTeamStats()` with zero artifact substats and reading the resolved stats.

### Phase 2: Ideal Computation

Compute `D_ideal` using the greedy allocation's ideal stats applied to the T formulas. Store alongside fixed values.

```typescript
type V3BuildData = {
  characterId: string;
  buildName: string;
  // Main stat recommendations (from V2 combo enumeration)
  sands: MainStatWeight[];
  goblet: MainStatWeight[];
  circlet: MainStatWeight[];
  // Per-team scoring data
  teams: {
    name: string;
    fixed: V3FixedValues;
    idealDamage: number;      // D_ideal for this team context
  }[];
  // ER threshold
  erThreshold: number;
  // For display: V2-compatible weights (derived from ideal allocation proportions)
  displayWeights: Record<SubStat, number>;
};
```

### Phase 3: Runtime Scorer

```typescript
function scoreV3(
  artifacts: Partial<Record<Slot, ArtifactData>>,
  build: V3BuildData
): V3ScoreResult {
  // Sum artifact stats
  const artStats = sumArtifactStats(artifacts);

  // Score per team, then average
  let totalScore = 0;
  for (const team of build.teams) {
    const F = team.fixed;

    // T_scale
    const T_scale = F.baseScalingStat * (1 + F.fixedScalingPct + artStats.scalingPct)
                  + F.fixedScalingFlat + artStats.scalingFlat;

    // T_crit
    const cr = Math.min(F.fixedCR + artStats.cr, 1);
    const cd = F.fixedCD + artStats.cd;
    const T_crit = 1 + cr * cd;

    // T_dmg
    const T_dmg = 1 + F.fixedDmgPct + artStats.dmgPct;

    // T_rxn
    let T_rxn = 1;
    if (F.hasAmplifying) {
      const totalEM = F.fixedEM + artStats.em;
      T_rxn = 1 + F.rxnBonus + F.rxnCoeff * totalEM / (2000 + totalEM);
    }

    const D_actual = T_scale * T_rxn * T_crit * T_dmg;
    totalScore += D_actual / team.idealDamage;
  }

  totalScore = 300 * totalScore / build.teams.length;

  // ER penalty
  const totalER = sumER(artifacts, build);
  if (totalER < build.erThreshold) {
    const penalty = (build.erThreshold - totalER) / build.erThreshold * 0.15;
    totalScore *= (1 - penalty);
  }

  return { totalScore, /* per-slot breakdown, etc. */ };
}
```

### Phase 4: Display Weights (Backward Compatibility)

Users still want to see "which substats matter" at a glance. Derive display weights from the **ideal allocation** (not midpoint marginals):

```
displayWeight[stat] = idealRolls[stat] / max(idealRolls) × 100
```

These are shown in the UI as a guide but are NOT used for scoring. Scoring uses the multiplicative T-factor approach.

---

## Feasibility Assessment

### What's straightforward:
- T_crit, T_dmg, T_rxn formulas — simple arithmetic, well-defined
- Fixed value extraction — TeamBuild already computes resolved stats
- Main stat combo enumeration — already implemented in V2
- Per-artifact scoring — T factors are cheap to evaluate

### What needs care:
- **T_scale extraction:** Need to separate base stat from percentage and flat contributions. TeamBuild's stat pipeline should expose this (via StatSheet internals).
- **Stat-scaling buffs:** Freeze at reference point. Need to verify the reference point doesn't introduce significant error for extreme builds.
- **Multiple scaling stats:** Characters like Zhongli need per-formula T_scale. Implementation needs a formula-level loop, not just a single T_scale.
- **Non-standard formulas:** Some talents have unique scaling (e.g., "DMG based on Max HP and current HP ratio"). These may not fit the standard T-factor decomposition. For these, fall back to V2-style scoring (the error only affects that specific formula's contribution).

### What's NOT needed:
- Closed-form symbolic derivation of T factors — we extract them numerically
- Changes to TeamBuild or the damage calculator — we use it as-is
- Perfect accuracy — scoring needs correct **relative ordering**, not exact damage numbers. A 2-3% systematic error is acceptable.

---

## Migration from V2

V3 is a scoring-time change. The offline pipeline (combo enumeration, greedy allocation, main stat recommendations) stays largely the same, with the addition of fixed value extraction.

| Component | V2 | V3 |
|-----------|----|----|
| Offline: team database | Same | Same |
| Offline: combo enumeration | Same | Same |
| Offline: greedy allocation | Same | Same + extract fixed values |
| Offline: weight derivation | Midpoint marginals → weights | Greedy allocation → display weights |
| Stored data | `substats`, `normalizer`, `idealScore` | `teams[].fixed`, `teams[].idealDamage`, `displayWeights` |
| Runtime scorer | Linear CD-equivalent sum | Multiplicative T-factor ratios |
| CR handling | Fixed weight (broken) | Dynamic clamp (correct) |
| Per-artifact score | Fixed weight × CD-equiv | Marginal T-factor contribution |

### Backward Compatibility

- `displayWeights` serves the same role as V2's `substats` for UI purposes
- V2's scorer can be kept as a fallback for builds without V3 data
- The 300-point scale is preserved

---

## Summary

V3 replaces V2's linear scoring model with a multiplicative one that mirrors Genshin's actual damage formula. The key innovations are:

1. **Pre-baked fixed values** extracted from TeamBuild, enabling fast runtime scoring
2. **Multiplicative T-factor scoring** that naturally captures stat interactions and diminishing returns
3. **Native CR clamp handling** — no more artificially inflated CR weights
4. **Context-dependent artifact scoring** — the same artifact scores differently depending on what else is equipped
5. **Per-team scoring** — users see how their build performs in each team context

The approach is **deterministic** (fixed values are computed, not fitted), **fast** (pure arithmetic at runtime), and **accurate** (uses the same stat resolution as TeamBuild, with < 3% error from reference-point freezing of stat-scaling buffs).
