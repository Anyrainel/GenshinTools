# Artifact Score V2: Normalized Scoring with Main Stat Integration

## Motivation

The V1 scoring system has several limitations:

1. **Weights are hand-tuned** — they don't adapt to character context (base stats, weapon, artifact set bonuses, team buffs), so a stat that's already saturated can still receive high weight.
2. **Main stats are not scored** — two artifacts with identical substats but different main stats (e.g., ATK% vs DEF% sands) get the same score, even though main stat choice is the single biggest artifact decision.
3. **Scores are not comparable across builds** — a character with weights {CR:100, CD:100, ATK%:90, EM:50} has much higher score potential than one with {EM:100, ER:70}, making cross-character comparison meaningless.

V2 addresses all three by:
- (Optional) Auto-deriving weights for DPS builds via marginal damage analysis
- Scoring main stats alongside substats
- Normalizing all scores to a fixed 300-point scale

---

## Core Concepts

### Substat Scoring (Unchanged from V1)

V1 converts every stat to a **CD-equivalent value** using conversion coefficients derived from the ratio of max roll values:

```
coefficient = 7.77 / maxRollValue(stat)
```

| Stat | Max roll (5★) | Coefficient (7.77 / max) |
|------|--------------|------------------------|
| CD | 7.77 | 1.0000 |
| CR | 3.89 | 1.9974 ≈ 2.0 |
| ATK% | 5.83 | 1.3328 |
| HP% | 5.83 | 1.3328 |
| DEF% | 7.29 | 1.0658 |
| EM | 23.31 | 0.3333 |
| ER | 6.48 | 1.1991 |
| Flat ATK | 19.45 | 0.3995 |
| Flat HP | 298.75 | 0.0260 |
| Flat DEF | 23.15 | 0.3356 |

This makes all stats directly comparable: 1 max roll of any stat = 7.77 CD-equivalent points (before weighting). The per-substat score is:

```
substatScore = actualValue × coefficient × (weight / 100)
```

V2 keeps this formula and these coefficients unchanged for substats.

### Main Stat as CD-Equivalent (NEW)

Since main stats and substats share the same underlying stat keys, we can score main stats using the same coefficients. A main stat at Lv.20 converts to CD-equivalent as:

```
mainStatCDEquiv = mainStatValue × coefficient
```

From game data, **every main stat at Lv.20 converts to the same CD-equivalent value** — this is by design in Genshin's stat economy:

```
ATK%:  46.6 × 1.3328 = 62.11
HP%:   46.6 × 1.3328 = 62.11
DEF%:  58.3 × 1.0658 = 62.14
EM:    186.5 × 0.3333 = 62.16
ER:    51.8 × 1.1991 = 62.11
CR:    31.1 × 1.9974 = 62.12
CD:    62.2 × 1.0000 = 62.20
```

All ≈ **62.1 CD-equivalent** — exactly 8 max rolls of CD (8 × 7.77 = 62.16), or equivalently ~9.4 average rolls (at 0.85 quality).

This means one 5-star main stat = 62.1 CD-equivalent points before weighting. The main stat score is simply:

```
mainStatScore = 62.1 × (weight / 100)
```

For 4-star artifacts (Lv.16), the equivalent is ~46.4 CD-equivalent (same derivation with 4-star values).

### Elemental/Physical DMG% and Healing Bonus

These main stats don't appear as substats, so they have no coefficient in the table above. Each build that recommends these main stats defines a **mainStatCDEquiv** override:

- For **auto-tuned DPS builds**: computed from the damage proxy (see Auto-Tuning section). Typically ~68–75 CD-equiv for elemental goblet (higher than 62.1, reflecting its superiority over ATK% goblet).
- For **manual builds**: default to 62.1 (neutral — assumes the recommended main stat is "full value"). Build authors can override per-build.

### Total Budget

For 5 five-star artifacts at Lv.20, the total CD-equivalent budget is:

| Component | CD-equivalent |
|-----------|--------------|
| Sands main stat | 62.1 |
| Goblet main stat | 62.1 (or override) |
| Circlet main stat | 62.1 |
| Substats (5 artifacts × 8–9 rolls × 7.77 avg) | ~280–310 |
| **Total** | **~466–496** |

(Flower and Plume have fixed main stats — flat HP and flat ATK — contributing no choice. They are excluded from the main stat budget.)

---

## Normalization to 300

### Computing the Ideal Score

For each build, compute the **ideal score** — the maximum achievable under this build's weights:

```
idealScore = idealMainStatScore + idealSubstatScore
```

**Ideal main stat score:** For each of the 3 choosable slots (sands, goblet, circlet), take the best recommended main stat's CD-equivalent × weight:

```
idealMainStatScore = Σ slot ∈ {sands, goblet, circlet}: mainStatCDEquiv(slot) × (bestWeight(slot) / 100)
```

**Ideal substat score:** Distribute the substat budget optimally using a greedy approach. Use a reference budget of **42 average rolls** (midpoint of 40–45 range for 5 five-star artifacts). Each roll contributes `7.77 × 0.85 = 6.6045` CD-equivalent points before weighting. Greedily assign each roll to the highest-weight stat:

For simplicity (since we're computing the ideal, not simulating diminishing returns), this is equivalent to:
1. Sort stats by weight descending
2. Assign as many rolls as possible to the highest-weight stat (practically: all 42, since we don't model substat slot constraints for the ideal)
3. idealSubstatScore = 42 × 6.6045 × (highestWeight / 100)

However, since **artifacts can only have 4 substats each**, and a substat can't match the artifact's main stat, a more realistic ideal distributes rolls across the top ~4 weighted stats. A reasonable approximation:

```
Distribution across 5 artifacts: [9, 9, 9, 8, 8] rolls (top-end: all start with 4 substats)
Per artifact: rolls go to top 4 weighted stats, e.g., [5, 2, 1, 1] split

Total ideal distribution (approximate): top4 stats get [22, 10, 5, 5] rolls
idealSubstatScore = Σ (rolls_i × 6.6045 × weight_i / 100)
```

The exact distribution can be tuned, but the key point is it's **fixed per build** based on the weight profile.

### The Normalizer

```
normalizer = 300 / idealScore
```

All actual scores (main stat + substat) are multiplied by this normalizer.

**Result:** Every build's score ceiling is 300. A player at 240/300 is at 80% of ideal, regardless of character.

### Per-Artifact Breakdown

Each artifact contributes to the 300 total:

- **Flower:** substat score only (fixed flat HP main stat, not scored)
- **Plume:** substat score only (fixed flat ATK main stat, not scored)
- **Sands:** main stat score + substat score
- **Goblet:** main stat score + substat score
- **Circlet:** main stat score + substat score

---

## Auto-Tuning Weights (DPS Builds)

For builds tagged as DPS with existing damage formula implementations, weights can be auto-derived instead of hand-tuned.

### Method: Marginal Analysis at Midpoint

1. **Establish baseline stats:** Character base stats + weapon stats + artifact set bonuses + chosen main stats (at Lv.20 values). No substats, no team buffs (or average team buffs — see Team Variance below).

2. **Run greedy allocation** on the substat budget (~42 rolls):
   - At each step, for each eligible stat, compute `damage(current + 1 roll of stat) - damage(current)`
   - One roll of stat = that stat's max roll × 0.85 (one average roll)
   - Assign the roll to the stat with highest marginal gain
   - Record the final allocation: e.g., `{CR: 5, CD: 14, ATK%: 8, EM: 3, ...}`

3. **Compute weights at the midpoint:**
   - Take the allocation from step 2, halve each value (round to nearest): `{CR: 3, CD: 7, ATK%: 4, EM: 2}`
   - Compute baseline + midpoint substats = the "operating point"
   - At this operating point, compute the marginal gain of one more roll of each stat
   - Normalize: `weight_i = marginal_i / max(all marginals) × 100`

4. **Output:** A `WeightedSubStat[]` array, same format as V1 hand-tuned weights. The rest of the scoring pipeline is unchanged.

### Why Midpoint?

- **At baseline (0 substats):** Marginals are too skewed — the most-needed stat dominates excessively.
- **At optimum (full allocation):** Marginals are roughly equalized (by the equal marginal principle of convex optimization) — weights become too flat, losing discriminating power.
- **At midpoint:** Represents a "decent but improvable" player. Preserves real stat value differences while accounting for partial diminishing returns. The linear scoring approximation is most accurate near the gradient evaluation point, and the midpoint minimizes maximum approximation error across the full range.

### Damage Calculator: Real Team-Comp Library

Auto-tuning uses the full `TeamBuild` damage calculator from `src/lib/team-comp/`, not a simplified proxy. This ensures that all buff interactions — character passives, weapon passives, artifact set bonuses (e.g., Blizzard Strayer's +40% CR), elemental resonances, and cross-character scaling buffs — are properly accounted for when computing marginal gains.

**Key APIs:**
- `TeamBuild(configs: CharCompConfig[])` — Constructs a full team with all buff resolution
- `TeamBuild.getTeamStats(artifactStats, calcTargetId)` — Computes final stat sheets for all members
- `TeamBuild.getDamageResult(charId, formulaId, teamStats, ctx)` — Evaluates damage for a formula
- `StatSheet.withDelta(key, delta)` — Creates a tweaked stat sheet for marginal analysis

**Why real calculations matter:**
- Artifact set bonuses (Blizzard Strayer +40% CR, Emblem ER→burst DMG%) change stat valuations fundamentally
- Cross-character buffs (Kazuha A4 EM→DMG%, Shenhe flat DMG, Bennett flat ATK) shift optimal stat distributions
- Elemental resonances (Pyro +25% ATK, Cryo +15% CR) affect the baseline
- Weapon passives (TTDS, Elegy, Favonius procs) alter the full stat picture

A simplified proxy that ignores these interactions produces misleading weights — e.g., overvaluing CR when the artifact set already provides it.

### Data Sources: Curated Presets

Team compositions and builds come from curated preset data, not from guessing:

1. **Flagship Teams** (`src/presets/team-comp/[GGArtifact] Flagship Teams.json`): ~30 meta teams with full 4-member builds (characters, weapons, artifact sets)
2. **AllCharacterBuilds** (`src/presets/artifact-builds/[GGArtifact] AllCharacterBuilds.json`): 112 characters with curated builds (weapons, artifact sets, main stats)

For each DPS character appearing in a Flagship Team:
- The full team composition (4 characters + 4 weapons + 4 artifact sets) is used to construct a `TeamBuild`
- The DPS character's registered damage formula drives the marginal analysis
- Multiple team contexts (if the character appears in multiple teams) are averaged

### Elemental Goblet Valuation

Compute the CD-equivalent of an elemental DMG% goblet via the real calculator:

```
damageWithElemGoblet = calc(team with goblet's elemDmg% main stat)
damageWithAtkGoblet  = calc(team with ATK% goblet main stat instead)

elemGobletCDEquiv = 62.1 × (damageWithElemGoblet / damageWithAtkGoblet)
```

This uses the full buff pipeline, so set bonuses that interact with DMG% (e.g., Crimson Witch 4pc) are properly reflected.

### Team Variance

Weights are averaged across all Flagship Team contexts where a character appears as DPS. This naturally produces weights that are "generally good" across team compositions — accounting for different buff environments, reactions, and teammate synergies.

### Support Builds: Manual Tuning

Support characters lack damage formulas that capture their true contribution (shield strength, heal amount, buff value, ER thresholds). Auto-tuning is not reliable for these. Keep manual weights for support builds.

The normalization to 300 still applies — manually-tuned support builds get the same normalizer treatment, so their scores are comparable to auto-tuned DPS builds.

---

## Score Interpretation Guide

| Score Range | Meaning |
|-------------|---------|
| 270–300 | Exceptional — near-perfect main stats and substats |
| 240–270 | Very strong — correct main stats, good substats |
| 200–240 | Solid — minor main stat or substat issues |
| 160–200 | Decent — one wrong main stat or generally mediocre substats |
| 120–160 | Needs work — multiple issues |
| <120 | Placeholder set — largely unbuilt |

These ranges are consistent across all characters because of the 300 normalization.

---

## Migration from V1

- **Build definitions:** Unchanged. V2 consumes the same `Build` type with `substats: WeightedSubStat[]` and main stat arrays.
- **Auto-tuned weights:** Optionally generated for DPS builds that have damage formula implementations. Stored alongside or replacing hand-tuned weights.
- **Scoring function:** New function that wraps the existing substat scoring, adds main stat scoring, and applies the normalizer.
- **Display:** Score shown as X/300 total, with per-artifact breakdown available on hover/click.
- **Backward compatibility:** V1 scores can still be computed. V2 adds a parallel scoring path.

---

## Example Calculation

**Arlecchino** — 4pc Fragment of Harmonic Whimsy, ATK% sands, Pyro% goblet, CD circlet.

Suppose auto-tuned weights (0–100): CR=100, CD=95, ATK%=80, EM=45, ER=15.
Suppose auto-tuned Pyro% goblet CD-equivalent = 70.0.

**Ideal score (before normalization):**

Main stats:
- Sands (ATK%, weight=80): 62.1 × 0.80 = 49.68
- Goblet (Pyro%, CDEquiv=70.0): 70.0 × 1.00 (goblet uses weight=100 for the recommended element) = 70.00
- Circlet (CD, weight=95): 62.1 × 0.95 = 58.99
- Main stat total: 178.67

Ideal substats (42-roll budget, distributed [22, 10, 5, 5] across top 4 stats):
- CR(22 rolls): 22 × 6.60 × 1.00 = 145.27
- CD(10 rolls): 10 × 6.60 × 0.95 = 62.74
- ATK%(5 rolls): 5 × 6.60 × 0.80 = 26.43
- EM(5 rolls): 5 × 6.60 × 0.45 = 14.87
- Substat total: 249.31

Ideal total: 178.67 + 249.31 = 427.98
Normalizer: 300 / 427.98 = 0.7009

**Player's actual score:**

Main stats (all correct): 178.67 × 0.7009 = 125.2

Substats: Suppose actual CD-equivalent contributions (after V1 formula):
- CR: 4.2 rolls × 6.60 × 1.00 = 27.73 → × 0.7009 = 19.4
- CD: 11.3 rolls × 6.60 × 0.95 = 70.86 → × 0.7009 = 49.7
- ATK%: 7.8 rolls × 6.60 × 0.80 = 41.18 → × 0.7009 = 28.9
- EM: 2.1 rolls × 6.60 × 0.45 = 6.24 → × 0.7009 = 4.4
- ER: 1.5 rolls × 6.60 × 0.15 = 1.49 → × 0.7009 = 1.0
- (DEF%, flat HP: weight=0, contribute nothing)
- Substat total: 103.4

**Total: 125.2 + 103.4 = 228.6 / 300**

If the player had ATK% goblet instead of Pyro%:
- Goblet: 62.1 × 0.80 = 49.68 (instead of 70.00)
- Main stat total drops by 20.32 → normalized: −14.2 points
- **Total: 214.4 / 300** — wrong goblet costs ~14 points, a significant and correct penalty.

---

## Summary

| Aspect | V1 | V2 |
|--------|----|----|
| Weights | Hand-tuned | Auto-derived (DPS) or hand-tuned (support) |
| Main stats | Not scored | Scored using same CD-equivalent coefficients |
| Score range | Varies by build | Fixed 300 for all builds |
| Cross-character comparison | Not meaningful | Meaningful |
| Stat saturation | Not considered | Addressed via midpoint marginal analysis |
| Intermediate representation | CD-equivalent | CD-equivalent (unchanged) |
