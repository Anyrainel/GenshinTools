# Insight System Algorithm Specification

This document describes the algorithms and magic numbers used by the Insight Engine (`src/lib/insightEngine.ts`) to generate actionable recommendations for artifact optimization.

## Overview

The insight system analyzes a character's equipped artifacts and compares them against available alternatives (from inventory or other characters) to suggest improvements. It generates five types of insights:

| Type | Description | Priority |
|------|-------------|----------|
| `SWAP` | Immediately equip a better max-level artifact | 1 (highest) |
| `UPGRADE` | Invest resources (Mora, XP) to level up an artifact | 2 |
| `REROLL` | Use Sanctifying Essence to reroll substats on a Lv.20 artifact | 3 |
| `FARM` | Suggest farming a new artifact for a weak slot | 4 (lowest) |
| `FIX_MAIN` | Alert about an artifact with 0-weight main stat | Special |

Only lower priority insights are shown if they provide a higher expected score gain than the higher priority ones.

---

## Magic Numbers Summary

| Constant | Value | Purpose | Notes |
|----------|-------|---------|-------|
| `DEFAULT_LUCK_MULTIPLIER` | `0.85` | Expected roll value as fraction of max | Can be overridden per tier |
| `SWAP_THRESHOLD` | `1.0` | Min score gain to suggest swap | |
| `UPGRADE_THRESHOLD` | `3.0` | Min projected gain to suggest upgrade | |
| `REROLL_THRESHOLD` | `5.0` | Min gain to suggest reroll | Most expensive action |
| `FARM_THRESHOLD` | `2.0` | Min gain to suggest farming | |

### Luck Expectation (Per-Tier Setting)

Users can configure the expected roll quality per tier group:

| Setting | Multiplier | Description |
|---------|------------|-------------|
| Cautious | 0.80x | Pessimistic - expect lower rolls |
| Balanced | 0.85x | Realistic average (default) |
| Hopeful | 0.90x | Optimistic - expect higher rolls |

This setting affects all projection calculations for characters in that tier.

### Efficiency Percentage

Each insight includes an efficiency percentage displayed alongside the score diff (e.g., "+12.1 (23%)").

**Formula**: `efficiencyDiff = scoreDiff / maxPotentialScore`

Where `maxPotentialScore` is calculated using `calculateMaxSlotSubScore()`:
- Considers the artifact's main stat (excluded from substat pool)
- Uses character's stat weights
- Assumes optimal 5-1-1-1 roll distribution (8 rolls for 5★, 6 rolls for 4★)

### Max Level by Rarity

| Rarity | Max Level |
|--------|-----------|
| 5★ | 20 |
| 4★ | 16 |
| 3★ | 12 |
| 2★ | 8 |
| 1★ | 4 |

---

## Max Substat Roll Values

From `constants.ts` (`maxSubstatRolls`), sourced from game data:

| Stat | 5★ Max | 4★ Max |
|------|--------|--------|
| HP (flat) | 298.75 | 239.0 |
| ATK (flat) | 19.45 | 15.56 |
| DEF (flat) | 23.15 | 18.52 |
| HP% | 5.83% | 4.66% |
| ATK% | 5.83% | 4.66% |
| DEF% | 7.29% | 5.83% |
| EM | 23.31 | 18.65 |
| ER | 6.48% | 5.18% |
| CR | 3.89% | 3.11% |
| CD | 7.77% | 6.22% |

**Expected Roll Value** = `maxRollValue × 0.85`

---

## Scoring System

### Stat-to-Score Conversion

The system converts substat values to a CD-equivalent score using these multipliers (from `artifactScore.ts`):

| Stat | Multiplier | Notes |
|------|------------|-------|
| `cr` | `× 2.0` | CR has half the max roll of CD |
| `cd` | `× 1.0` | Baseline |
| `em` | `× 0.3333` | EM has ~3x the roll value |
| `er` | `× 1.1991` | Based on max roll ratio |
| `atk%`, `hp%` | `× 1.3328` | |
| `def%` | `× 1.0658` | |
| `atk` (flat) | `× 0.3995 × (flatAtk/100)` | Uses global config |
| `hp` (flat) | `× 0.026 × (flatHp/100)` | Uses global config |
| `def` (flat) | `× 0.3356 × (flatDef/100)` | Uses global config |

Formula: `score = value × multiplier × (weight / 100)`

---

## Algorithm Details by Insight Type

### 1. SWAP Strategy

**Purpose**: Find immediately-usable max-level artifacts in inventory or from "Pool" characters.

**Candidate Filtering**:
- Same slot
- Matching main stat (or main stat with weight > 40 for flexible slots)
- Must be at max level for rarity
- Source is either:
  - Inventory (no `location`)
  - Equipped by a "Pool" tier character (stealable)

**Safe Swap Check** (`checkSafeSwap`):

A swap is safe if it doesn't break set bonuses:
- Same set: ✅ Safe
- Current is off-piece (count = 1): ✅ Safe
- Current count = 5 or 3: ✅ Safe (reducing to 4pc or 2pc is fine)
- Current count = 4 or 2: ❌ Unsafe (would break 4pc or 2pc bonus)

**Performance Optimization**: If swap is unsafe, only consider same-set candidates.

**Score Comparison**:
```
if (candScore > currentScore + 1.0) {
  suggest SWAP
}
```

**Threshold**: `SWAP_THRESHOLD = 1.0`

---

### 2. LEVEL Strategy

**Purpose**: Identify artifacts worth investing resources to level up.

**Considerations**:
- Artifacts below max level for their rarity (Lv.20 for 5★, Lv.16 for 4★)
- Both inventory artifacts and currently equipped artifacts
- Must be safe to swap (if from inventory)

**Projected Score Calculation**:

1. Identify 3-line vs 4-line artifacts:
   - **3-line**: Has 3 activated substats + 1 unactivated substat
   - **4-line**: Has 4 activated substats

2. **For 3-line artifacts below Lv.4**:
   - The Lv.4 upgrade unlocks the 4th stat (from `unactivatedSubstats`)
   - This is NOT a roll on existing stats—it adds the 4th stat's initial value
   - Remaining upgrades (Lv.8, 12, 16, 20) are distributed among all 4 stats

3. For all artifacts, count remaining upgrade rolls (every 4 levels after the 4th stat unlock)

4. Get all substats including `unactivatedSubstats`

5. Pad with weight-0 placeholders if fewer than 4 stats known

6. Sort by weight to identify top stats

**Roll Distribution** (for remaining rolls after 4th stat unlock):
- **5+ remaining rolls**: Favorable distribution
  - Top 2 stats: 1.5 rolls each
  - Bottom 2 stats: 1.0 roll each
  - Remaining rolls distributed evenly (0.25 each)
- **< 5 remaining rolls**: Even distribution (rolls / 4 each)

**Formula**:
```
// For 3-line artifacts below Lv.4, add 4th stat initial value
if (has3Lines && level < 4) {
  expectedGain += calcStatScore(expectedRollValue for 4th stat)
}

// Then add expected gain from remaining rolls
expectedGain += Σ(rollCount × expectedRollValue × statScore)
projectedScore = currentScore + expectedGain
```

Where `expectedRollValue = getMaxRollValue(stat, rarity) × 0.85`

**Score Comparison**:
```
if (projectedScore > currentProjectedScore + 3.0) {
  gain = projectedScore - currentScore  // Gain from NOW
  suggest LEVEL
}
```

**Threshold**: `LEVEL_THRESHOLD = 3.0`

---

### 3. REROLL Strategy

**Purpose**: Identify Lv.20 5★ artifacts with poor substat distribution that could benefit from Sanctifying Essence reroll.

**Conditions**:
- Artifact is 5★ and at Lv.20
- Has 4 substats (including unactivated)
- At least one substat has weight = 0 (completely useless)

**Mechanics**: Reroll redistributes upgrade rolls among existing stat types. Stat types do NOT change—only which stats receive upgrades and the roll values.

**Expected Score Calculation**:

1. Determine `totalRolls` from artifact data (default: 8)
   - `totalRolls = 8`: Started with 3 substats (4th unlocked at +4)
   - `totalRolls = 9`: Started with 4 substats

2. Get initial values for each stat:
   - Use `initialValues[stat]` if available (from GOOD v3 format)
   - Fallback: `maxRollValue × 0.85`

3. Sort substats by weight (highest first = selected for guaranteed upgrades)

**For `totalRolls = 8`** (started with 3 lines):
```
For each of 4 stats:
  expectedValue = initialValue + (1 × expectedRollValue)
  expectedScore += calcStatScore(expectedValue)
```

**For `totalRolls = 9`** (started with 4 lines):
```
For top 2 stats:
  expectedValue = initialValue + (1.5 × expectedRollValue)
For bottom 2 stats:
  expectedValue = initialValue + (1.0 × expectedRollValue)
```

4. Calculate current substat score and compare

**Score Comparison**:
```
scoreDiff = expectedSubScore - currentSubScore
if (scoreDiff > 5.0) {
  suggest REROLL
}
```

**Threshold**: `REROLL_THRESHOLD = 5.0`

---

### 4. FARM Strategy

**Purpose**: Suggest farming when current artifact is significantly below potential.

**Expected Score Calculation**:

Assume optimal new artifact:
- Same main stat as current
- 4 starting lines (best case)
- Top 4 weighted substats (excluding main stat overlap)

**Roll Distribution** (4 initials + 5 upgrades = 9 total):

| Stat Rank | Initial Rolls | Upgrade Rolls | Total |
|-----------|---------------|---------------|-------|
| Top 1 | 1 | 1.5 | 2.5 |
| Top 2 | 1 | 1.5 | 2.5 |
| Top 3 | 1 | 1.0 | 2.0 |
| Top 4 | 1 | 1.0 | 2.0 |

**Formula**:
```
For each of top 4 weighted stats:
  expected = totalRolls × (maxRollValue × 0.85)
  farmExpectedScore += calcStatScore(expected)

scoreDiff = farmExpectedScore - currentScore
if (scoreDiff > 1.0) {
  suggest FARM with efficiency = currentScore / farmExpectedScore
}
```

**Threshold**: `FARM_THRESHOLD = 1.0` (aligned with SWAP)

---

### 5. Priority Selection

For each slot, insights are generated and selected in this priority:

```
bestScoreSoFar = 0

1. SWAP - if found, add and update bestScoreSoFar
2. LEVEL - only add if scoreDiff > bestScoreSoFar
3. REROLL - only add if scoreDiff > bestScoreSoFar
4. FARM - only add if scoreDiff > bestScoreSoFar
```

This ensures:
- Free/cheap actions (SWAP) are preferred
- Expensive actions (REROLL, FARM) only shown if they provide greater benefit
- No redundant suggestions for the same slot

Final insights are sorted by `scoreDiff` (highest first).

---

## Future Tuning Opportunities

### EXPECTED_ROLL_MULTIPLIER
- Currently fixed at `0.85`
- Could be configurable per user tier (optimistic vs conservative)
- Higher values = more aggressive recommendations

### Threshold Tuning
- All thresholds could become user-configurable
- Different playstyles may prefer different sensitivity

### Multi-Character Optimization
- Currently doesn't consider overall account optimization
- Could weigh actions by character tier importance
- Could detect circular dependencies in artifact swaps

### Resin Cost Analysis
- Could factor in expected resin cost per action type
- LEVEL: ~20 resin equivalent (artifact XP + mora)
- REROLL: ~40 resin equivalent (Sanctifying Essence)
- FARM: Variable based on expected domain runs

---

## Appendix: Helper Functions

### `getMaxRollValue(stat, rarity)`
Returns the maximum roll value for a substat at given rarity.

### `getExpectedRollValue(stat, rarity)`
Returns `getMaxRollValue(stat, rarity) × 0.85`.

### `getAllSubstats(artifact)`
Returns combined list of `substats` and `unactivatedSubstats` keys.

### `calcStatScore(value, stat, weights, globalConfig)`
Converts a stat value to CD-equivalent score using the multipliers above.
