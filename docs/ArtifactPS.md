# Artifact Filter Config Computation — Problem Statement & Design

## 1. Context

The artifact filter system computes **in-game lock/trash configs** from character builds.
Genshin Impact allows **2 custom sub-stat filter configs per artifact set**.
Each config specifies: main stats (per slot), sub-stats to match, must-present sub-stats, and a minimum stat count (k-of-n).

The pipeline today:
1. **Add Phase** — Each visible build creates a `SetConfig` per relevant artifact set.
2. **Merge Phase** — `greedyMerge` collapses configs via identical-signature merging, pick-one merging, and rigid promotion.
3. **Display** — Configs render per artifact set (sorted by 4pc priority) with pass-chance indicators.

### Current Build Schema

```ts
type Build = {
  substats: SubStat[];     // Desired sub-stats (pool)
  kOverride?: number;      // Min matching stat count (defaults to pool length)
  // ... main stats per slot, artifact set, etc.
};
```

### Current Config Schema

```ts
type SlotConfig = {
  mainStats: MainStatPlus[];
  substats: SubStat[];       // Pool of acceptable sub-stats
  mustPresent: SubStat[];    // Hard requirements (detected via heuristics)
  minStatCount: number;      // k — how many from pool must appear
};
```

---

## 2. Problem Landscape

### 2.1 The Core Optimization Problem

**Given** N character builds that map to a set of artifact sets, **produce** at most 2 configs per set that:

| Goal                | Definition                                                                                |
|-|-|
| **Maximize Recall** | Every artifact that is optimal/viable for any active build is locked (not trashed).        |
| **Minimize Pass Chance** | The fraction of random 5★ artifacts that satisfy the config is low enough that the player is not overwhelmed with "locked" junk. |
| **Maximize Usability** | Expose clear, actionable controls when the algorithm cannot achieve both goals simultaneously. |

These goals are inherently in tension. A config that accepts "any sub-stat" has 100% recall but also 100% pass chance. A config that requires 4 specific stats has low pass chance but may miss viable artifacts.

### 2.2 Why "At Least N Stats" Is Insufficient

The current `substats` + `minStatCount` model treats all listed sub-stats as equally important. In reality, builds have diverse substat priority shapes:

- **Standard DPS**: CR + CD indispensable, ATK% important, EM nice-to-have (e.g. Raiden, Xiao).
- **HP-scaling DPS**: HP% + CR + CD all indispensable, ATK% irrelevant (e.g. Neuvillette, Hu Tao).
- **Reaction DPS**: EM + CR + CD all important, ER sometimes needed (e.g. Cyno, Alhaitham).
- **Lean DPS**: CR + CD + one scaling stat only, no fourth stat matters (e.g. Wanderer, Ayaka).
- **Support builds**: ER critical; scaling stat (HP%/DEF%/ATK%) important; CR sometimes desired for weapon procs (Favonius).

The equal-weight model forces authors to choose between:
- Listing only must-haves → low recall (misses "nice-to-have" artifacts)  
- Listing all viable stats with a low k → high pass chance

### 2.3 The CR+CD Auto-Lock Problem

In-game, players almost universally enable "Auto-Lock: CR + CD" (artifacts with both crit rate and crit damage are auto-locked). This single rule covers most DPS builds.

Currently, `skipCritBuilds` defaults to **false**, even though:
- Almost every player already uses in-game CR+CD auto-lock.
- When enabled, many DPS-only artifact sets produce **zero additional configs** (because their only builds are CR+CD DPS builds).
- This frees up config slots for the harder support/hybrid cases.

### 2.4 Support Build Condensation

Support builds are the hardest to merge because they diverge on their primary scaling stat:
- HP% scaling (Furina, Zhongli, Chevreuse)
- DEF% scaling (Xilonen, Yun Jin, Kachina)  
- ATK% scaling (Shenhe, Xianyun, Jean)
- EM scaling (Kazuha, Sucrose, Citlali)

Two HP% support builds merge trivially. An HP% build and a DEF% build share almost no sub-stats. The merge produces a union that's too broad (high pass chance) or the algorithm gives up (>2 configs).

### 2.5 Flat Stat Dilemma

Builds like `["hp%", "er"]` only need 2 priority sub-stats. Since artifacts have 4 substat lines, the ideal artifact for these builds would have HP%, flat HP, ER, and one junk stat — all 3 "useful" lines covered. Including flat HP in the config:
- **Improves recall** — keeps artifacts where all 3 HP-related + ER lines are present, which are genuinely optimal for these builds since any other stat is wasted.
- **Destroys mergeability** — now HP-scaling and ATK-scaling support builds share even fewer sub-stats, making it harder to merge them into shared configs.

The key insight: flat stats aren't a *replacement* for percentage stats — they're a way to fill the remaining substat lines with something useful when a build only has 2 primary percentage stats.

### 2.6 The 2-Config Bottleneck

The in-game limit of 2 configs per set is the binding constraint. When a set serves 3+ divergent build archetypes, the algorithm must choose which dimension to compress. Today this is done via heuristic merge rules. But the heuristics are:
- Hard to reason about (users can't predict outcomes)
- Not always optimal (greedy pairwise merging is order-dependent)
- Silent when they fail (no feedback to the user about what was sacrificed)

---

## 3. Proposed Directions

### 3.1 Per-Build Sub-Stat Weights (Replaces `substats` + `kOverride`)

Replace the flat sub-stat pool with explicit weights per build:

```ts
// Proposed new field on Build
type SubStatWeights = Partial<Record<SubStat, number>>;
// e.g. { cr: 100, cd: 100, "atk%": 80, em: 40 }
```

**Benefits:**
- Enables accurate artifact scoring tied to a specific build (not just global character weights).
- Algorithm can differentiate "must-have" (weight ≥ threshold) from "nice-to-have" (weight > 0).
- Eliminates `kOverride` — the algorithm decides `k` and `mustPresent` based on weight distribution.

**Drawbacks:**
- **(A) Main stat scoring gap.** If elemental DMG% goblet is viable but sub-optimal vs. ATK% goblet, sub-stat weights alone don't express this. However, main stat scoring is secondary — the in-game filter already handles main stats separately.
- **(B) Increased setup friction.** Mitigated by making presets the default data source (see §3.5).

**Weight → Config Translation Algorithm (sketch):**
1. Sort stats by weight descending.
2. Stats with weight ≥ W_must → `mustPresent`.
3. Stats with weight ≥ W_include → included in `substats` pool.
4. `minStatCount` = `|mustPresent|` + 1 (default, tunable).
5. Stats below W_include are dropped — they're "nice-to-have" but not worth inflating pass chance.

The thresholds W_must and W_include can be tuned per-build or globally. This is the key algorithmic lever.

### 3.2 CR+CD Auto-Lock as Default

**Proposal:** Default `skipCritBuilds` to `true`. When a set's only remaining configs after CR+CD exclusion are zero, show the set's card in a "covered by CR+CD auto-lock" state (grayed out, collapsed).

**Variant:** "Skip CR+CD builds if the set has ≥ 2 non-crit configs." This prevents over-aggressive skipping on sets where the crit build is the *only* build (though this is rare in practice).

**User control:** A toggle, defaulting to on, with clear labeling: "Assume in-game CR+CD auto-lock is enabled."

### 3.3 Pass-Chance-Aware Merging

Instead of greedy pairwise structural merging, evaluate merges by their impact on **pass chance**:

1. For each artifact set, enumerate all possible ways to partition N input configs into ≤ 2 groups.
2. For each partition, compute the merged config per group and its pass chance.
3. Select the partition that minimizes `max(pass_chance_group_1, pass_chance_group_2)` subject to maintaining 100% recall.

For small N (typically 2–6 configs per set), exhaustive enumeration is feasible.

**When no partition achieves both goals,** the algorithm should report:
- Which builds are "outliers" that prevent good merging.
- What the pass chance would be if they were excluded.
- Let the user decide (see §3.4).

### 3.4 User Agency for Unresolvable Conflicts

When the algorithm identifies builds that cannot be condensed into 2 configs without unacceptable pass chance:

1. **Outlier Highlighting:** "Disabling build X for [Character] on this set would reduce pass chance from 45% to 12%."
2. **Per-Set Build Toggle:** Let users disable specific builds for a specific set's config computation, without hiding the build globally.
3. **Default Config Fallback:** For known-difficult sets, offer a "use in-game default config" option (see §3.6).

### 3.5 Presets as Default Data

Shift presets from "optional import" to "everyone gets defaults for free":
- On first load (empty store), auto-load the bundled preset.
- Users can create custom builds that coexist with defaults.
- Users can hide/disable default builds they don't want.
- When the creator updates presets, new data is available to all users (surfaced as "update available" or auto-merged with user overrides).

This directly addresses the friction cost of per-build sub-stat weights — users don't set them up; they arrive pre-configured.

### 3.6 Built-In Set Configs (Emergency Valve)

For artifact sets that defy condensation into 2 configs, provide a hand-authored "default config" per set. This config:
- Does NOT consume one of the 2 algorithm-computed config slots.
- Represents the in-game default filter behavior (high recall, high pass chance).
- Is shown to the user as an opt-in: "Use the default in-game config for this set? (Higher pass chance, but guaranteed coverage.)"

This is a safety net for the worst-case scenario and can be combined with a downstream artifact scoring/trash recommendation system.

### 3.7 Owned-Characters-Only Filter

Add a toggle: "Only compute configs for characters I own."
- Reduces the number of input builds, often dramatically simplifying the merge problem.
- Requires account data to be imported (GOOD/Enka) or character ownership to be marked.
- Defaults to off (so users see full coverage before importing data).

### 3.8 Flat Stat Handling

When a build specifies both a percentage and flat variant (e.g., `hp%` + `hp`):
- **During merging:** Ignore flat stats. They are "bonus" stats that don't affect the config shape.
- **During scoring:** Include flat stats at their declared weight.
- **During config generation:** Only include flat stats if the config has remaining capacity (substats pool has room without inflating pass chance).

When a build only specifies 1–2 percentage stats (implying flat is "the next best thing"):
- The algorithm may auto-infer the flat stat but should exclude it from merge logic to preserve condensability.

---

## 4. Experiment Results

Experiments conducted in `scripts/experiment/` using the preset data (`[Anyrainel] All Character Builds`, 86 visible characters, 157 visible builds).

### 4.1 Build Pattern Analysis (`analyze-builds.ts`)

**Category breakdown** of all 157 visible builds:
- **CrCd builds**: 91 (58%) — all DPS builds that require both CR and CD
- **ER-based builds**: 62 (39%) — support/sustain builds, typically ER + scaling stat
- **Other**: 4 (3%) — miscellaneous (flat-only, EM-only)

**Top substat patterns** (by frequency):
| Count | Pattern | Archetype |
|-------|---------|-----------|
| 27 | `[cd, cr, atk%]` k=3 | Standard ATK DPS (rigid) |
| 16 | `[er, hp%]` k=2 | HP support |
| 12 | `[cd, cr, er, atk%]` k=3 | Burst DPS (flex) |
| 9 | `[cd, cr, atk%, em]` k=3 | Reaction DPS (flex) |
| 9 | `[em, er]` k=2 | EM support |
| 7 | `[cd, cr, def%]` k=3 | DEF DPS (rigid) |
| 6 | `[cd, cr, em]` k=3 | Pure reaction DPS (rigid) |
| 6 | `[atk%, er]` k=2 | ATK support |
| 4 | `[def%, er, def]` k=3 | DEF support (with flat) |
| 4 | `[er, hp%, hp]` k=3 | HP support (with flat) |

**Key insight**: 45 unique substat patterns but only ~10 archetypes dominate. The "tail" creates most of the merge difficulty.

### 4.2 Set Contention Analysis

**Effect of `skipCritBuilds=true`** on per-set config count:

| Status | Count | Examples |
|--------|-------|---------|
| **Solved** (0 or ≤2 patterns remain) | 21 of 34 sets | golden_troupe, marechaussee_hunter, crimson_witch, blizzard_strayer, … |
| **Still hard** (3+ patterns remain) | 10 sets | silken_moons, tenacity, noblesse, emblem, viridescent, … |

`skipCritBuilds` alone eliminates all contention for **21 out of 34** artifact sets. This is the single highest-impact change.

### 4.3 Pipeline Comparison (`pipeline-experiment.ts`)

Tested 4 pipeline variants (all with `skipCritBuilds=true`):

| Pipeline | >2 Config Sets | Avg Max Pass | Global Max | Success Rate |
|----------|:-:|:-:|:-:|:-:|
| **1. Current (greedyMerge)** | **5** | 11.3% | 34.9% | 86.8% |
| **2. BF-partition (raw)** | **0** | 10.2% | 42.1% | **100%** |
| 3. 4pc-only + BF | 0 | 5.4% | 40.3% | 100% |
| 4. BF with 25% floor | 0 | 10.2% | 42.1% | 100% |

**Winner: Variant 2 — brute-force partition on raw (pre-merge) configs.**

Why greedyMerge fails: its greedy pairwise merge locks in suboptimal groupings that cannot be undone. The brute-force approach considers ALL possible 2-group partitions and picks the one with minimum max pass chance. For N ≤ 15 configs per set (always true in practice), this is O(2^N) — fast enough.

**Per-set comparison** (problem sets, greedyMerge vs BF-partition):

| Set | greedyMerge | BF-partition | Winner |
|-----|:-:|:-:|:-:|
| noblesse_oblige | 2cfg / 26.9% | 2cfg / **15.5%** | BF (−11.4%) |
| viridescent_venerer | 2cfg / 26.9% | 2cfg / **15.5%** | BF (−11.4%) |
| scroll_of_the_hero | **3cfg** / 29.1% | 2cfg / **15.5%** | BF (fixed!) |
| flower_of_paradise | 2cfg / 26.9% | 2cfg / **15.5%** | BF (−11.4%) |
| vourukashas_glow | 1cfg / 26.9% | 2cfg / **15.5%** | BF (−11.4%) |
| deepwood_memories | **3cfg** / 15.5% | 2cfg / 15.5% | BF (fixed!) |
| silken_moons | **4cfg** / 34.9% | 2cfg / 42.1% | BF (fits in 2, but higher pass) |
| instructor | **3cfg** / 32.5% | 2cfg / 40.3% | BF (fits in 2, but higher pass) |
| emblem_of_severed | **3cfg** / 26.9% | 2cfg / 32.4% | BF (fits in 2, but higher pass) |

### 4.4 Outlier Detection (`outlier-experiment.ts`)

For sets where BF-partition produces >20% pass chance, identified which builds are "outliers":

| Set | BF MaxPass | Best single removal | Result |
|-----|:-:|---------|:-:|
| **instructor** | 40.3% | Remove Nilou `[hp%, hp]` | **15.5%** (−24.8%) |
| **emblem** | 32.4% | Remove Charlotte+Ganyu (2pc+2pc) | **15.5%** (−16.9%) |
| **silken_moons** | 42.1% | Remove Lauma+YunJin+Aino (sequential) | **15.5%** |
| **tenacity** | 26.9% | No single removal helps | 26.9% (irreducible) |

**Key insight**: High-pass-chance sets almost always have 1–3 outlier builds whose removal dramatically improves results. The algorithm should detect these and present them to the user as actionable choices.

### 4.5 Irreducible Sets

**Tenacity of the Millelith** is the canonical "irreducible" set: it serves 11 support characters across HP%, EM, ATK%, and CR+CD archetypes. Even with CrCd skipped, the remaining 4 patterns cannot merge below 26.9% pass chance.

This is the use case for:
- The "covered by in-game default config" fallback (§3.6)
- User agency: "Disable Dehya or Nilou's builds for this set?" (§3.4)

---

## 5. Formal Goal Statement

> Design an algorithm that, given a set of character builds with sub-stat weights, produces at most 2 in-game configs per artifact set.
> **Primary objective:** Maximize recall (no viable artifact is trashed).  
> **Secondary objective:** Minimize pass chance (reduce locked junk).  
> **Tertiary objective:** When P1 and P2 conflict, surface clear, actionable choices to the user.

---

## 6. Evaluation Framework

### 6.1 Metrics

| Metric | Definition | Target |
|-|-|-|
| **Recall** | % of input build configs fully covered by the ≤2 output configs | 100% (hard constraint) |
| **Mean Pass Chance** | Average pass chance across all slots, averaged across all artifact sets | Minimize |
| **Max Pass Chance** | Worst-case pass chance among all (set, slot) pairs | < 30% ideal, < 50% acceptable |
| **Config Count** | Number of output configs per set | ≤ 2 (hard constraint) |
| **Outlier Count** | Number of builds flagged for user review | Minimize |

### 6.2 Evaluation Scripts

- `scripts/evaluate-configs.ts` — Main evaluation with comparison mode
- `scripts/experiment/analyze-builds.ts` — Build pattern analysis
- `scripts/experiment/merge-experiment.ts` — Merge strategy comparison
- `scripts/experiment/pipeline-experiment.ts` — Full pipeline comparison
- `scripts/experiment/outlier-experiment.ts` — Outlier detection analysis

### 6.3 Iteration Protocol

```
1. Modify algorithm in src/lib/computeFilters.ts or src/lib/greedyMerge.ts
2. Run: npx tsx --tsconfig tsconfig.json scripts/evaluate-configs.ts --compare
3. Compare output metrics against previous baseline
4. For deep dives: run individual experiment scripts
```

---

## 7. Proven Solution & Implementation Plan

### 7.1 The Winning Architecture

Based on experiments, the optimal pipeline is:

```
Builds → createConfigFromBuild → [skipCritBuilds filter]
  → per-set brute-force 2-partition → outlier detection → output
```

1. **`skipCritBuilds=true` by default** — eliminates contention for 21/34 sets.
2. **Replace `greedyMerge` with brute-force partition** — achieves 100% success rate (≤2 configs) vs 86.8% for current approach.
3. **Add outlier detection** — when pass chance >N%, identify which 1–3 builds to disable and present to user.

### 7.2 Implementation Phases

#### Phase 1: Algorithm Core (High Impact)
- [ ] Default `skipCritBuilds` to `true`, with "covered by CR+CD auto-lock" UI state.
- [ ] Implement `bruteForcePartition` in `computeFilters.ts`, replacing `greedyMerge` for the final merge step.
- [ ] Add outlier detection: for sets with maxPass > threshold, compute per-build removal impact.
- [ ] Surface outlier info in `ArtifactSetConfigs` (new field for UI consumption).

#### Phase 2: User Controls (Medium Impact)
- [ ] Add "owned characters only" toggle.
- [ ] Add per-set build toggle (disable specific builds from config computation).
- [ ] Default config fallback for irreducible sets (tenacity, etc.).
- [ ] UI for outlier recommendations ("Disable X to improve pass chance from Y to Z").

#### Phase 3: Scoring & Weights (Future)
- [ ] Add `SubStatWeights` to build schema (alongside existing `substats`).
- [ ] Implement weight → config translation (thresholds for must/include).
- [ ] Migrate preset data to include weights.
- [ ] Build artifact scoring integration for trash recommendations.

#### Phase 4: Default Data (Future)
- [ ] Shift presets to auto-loaded defaults.
- [ ] Hand-author fallback configs for problematic sets.
- [ ] User notification for preset updates.
