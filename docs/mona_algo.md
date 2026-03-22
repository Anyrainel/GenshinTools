# Mona Artifact Optimizer: Algorithm Reference

Reverse-engineered from [genshin_artifact](https://github.com/wormtql/genshin_artifact) (`mona_wasm/src/applications/optimize_artifacts/algorithms/`).

The Mona optimizer has two main algorithms exposed in its UI: **A\*** and **A\* V2**. Despite the names, both are branch-and-bound algorithms (not true A\* with an open/closed list). The UI labels map to Rust code as follows:

| UI Label | Rust Struct | Source File |
|----------|-------------|-------------|
| A\* | `AStarCutoff` | `cutoff_a_star.rs` |
| A\* V2 | `CutoffAlgo2` | `cutoff_algo2.rs` |

Both share infrastructure from `common.rs`.

---

## Shared Infrastructure (`common.rs`)

### Super Artifacts (Upper Bound Construction)

The core pruning idea: for a group of real artifacts sharing the same `(Slot, MainStat, Set)`, construct a single **virtual "super artifact"** that takes the **maximum value of every sub-stat** across all artifacts in the group. Any real artifact from that group is guaranteed to have stats ≤ the super artifact's stats. This makes the super artifact an admissible upper bound for the branch.

Two variants:
- **`get_super_artifacts(arts)`**: Groups by `(SetName, Slot, MainStat)`. Used when set constraints are active.
- **`get_super_artifacts_without_set(arts)`**: Groups by `(Slot, MainStat)` only (ignores set). Used for flex slots.

### Value Function

Holds references to character, weapon, target function, buffs, enemy config. Methods:
- `get_attribute(arts)` — builds a full attribute graph from an artifact list
- `score_attribute(attribute, arts)` — evaluates `target_function.target()` to get a scalar damage score
- `check_attribute(attribute)` — validates constraint minimums (ATK, DEF, HP, EM, ER, CR clamped to [0,1], CD)

### Result Recorder

A **min-heap** (`BinaryHeap<Reverse<...>>`) capped at `size` entries, with a `HashSet<[u64; 5]>` for deduplication.
- `current_least()` — returns the worst score in the top-N, or 0.0 if not full yet
- `push_result(arts, score)` — adds a result if it beats `current_least`, evicts the worst if over capacity

This is the pruning threshold: any branch whose upper bound ≤ `current_least()` is pruned.

---

## Algorithm 1: A\* (Original) — `cutoff_a_star.rs`

### Overview

A **recursive depth-first branch-and-bound** over 5 artifact slots. At each slot level, iterates over set groups and individual artifacts, pruning branches whose optimistic evaluation (using super artifacts for undecided slots) cannot beat the current best.

### Pre-processing

`SingleOptimizer::new()` groups all artifacts into a 3D index: `(ArtifactSlotName, StatName, ArtifactSetName)`. For each group, builds a super artifact via `merge_art_stat` (component-wise max). Additionally, for each `(slot, mainStat)` combination, creates a **cross-set super artifact** keyed under `ArtifactSetName::Empty`, representing the upper bound ignoring set restrictions.

### Slot Ordering

Before search begins, sorts the 5 slots by **total artifact count** (ascending). The slot with the fewest artifacts is explored first. This improves pruning because the first few slot decisions lock in concrete stats faster, giving tighter upper bounds for remaining slots.

### Core Search: `do_enumerate_recursive`

```
function recurse(slot_index, upper_arts[5]):
    if slot_index == 5:
        evaluate upper_arts (all real now) → record if beats current_least
        return

    slot = sorted_slots[slot_index]
    for each set_group in slot:
        // SET-LEVEL PRUNE: replace upper_arts[slot] with set's super artifact
        upper_arts[slot] = set_group.super_artifact
        if check_hope(upper_arts) ≤ current_least:
            continue  // skip entire set group

        for each real_artifact in set_group:
            // ARTIFACT-LEVEL PRUNE: replace with real artifact
            upper_arts[slot] = real_artifact
            if check_hope(upper_arts) ≤ current_least:
                continue

            if slot_index == 4:  // last slot
                record result
            else:
                recurse(slot_index + 1, upper_arts)

    restore upper_arts[slot] to original super artifact
```

**Key detail**: `check_hope` does a **full attribute computation and target function evaluation** using a mix of real artifacts (decided slots) and super artifacts (undecided slots). This is NOT a cheap heuristic — it's an exact evaluation where super artifacts provide optimistic stat values.

### Set Bonus Handling

Four modes, driven by `ConstraintSetMode`:

#### `do4(set)` — 4-piece set
Iterates 5 patterns (one slot is "free", other 4 must be the target set). For each main-stat combination across slots, uses set-specific super artifacts for set-constrained slots and cross-set super artifacts for the free slot. Runs `check_hope_option` on the full super array before entering enumeration to prune entire main-stat combos.

#### `do22(set1, set2)` — 2+2 piece
Enumerates all ways to assign 2 slots to set1, 2 to set2, 1 free. Uses position pairs `(pos1, pos2)` for set1 and `(pos3, pos4)` for set2, skipping overlapping positions.

#### `do2(set)` — any 2-piece
Picks 2 positions for the set, 3 slots are free.

#### `do_any()` — no set restriction
All 5 slots are unrestricted. Uses cross-set super artifacts.

When `ConstraintSetMode::Any` (no user-specified set), calls **all four** modes for every applicable set to explore every possible set combination.

### Edge Cases

- **Empty slot**: If any slot has zero artifacts for the required set, that pattern is skipped (returns early).
- **Fallback**: If the total artifact count is zero or the search space is degenerate, falls back to `CutoffAlgorithmHeuristic` with `use_heuristic: false` (brute force).

---

## Algorithm 2: A\* V2 — `cutoff_algo2.rs`

### Overview

An **unrolled 5-level nested loop** with upper-bound pruning at every level. Key improvements over A\*:
1. **Weight-based heuristic pre-sorting** of artifacts (most promising first)
2. **Set mask system** instead of recursive set iteration
3. **Accuracy factor** for aggressive pruning control

### Pre-processing: Weight Heuristic (`weight_heuristic.rs`)

Before the main search, runs `NaiveWeightHeuristic` to determine which stats matter:

1. **Stat weight computation**: For each of 16 stat types (ATK%, HP%, DEF%, CR, CD, EM, ER, healing%, elemental bonuses, physical%), creates a virtual artifact with 10× the max substat roll value. Evaluates the target function with just that artifact vs. no artifacts. If damage increases → weight = 1.0, else weight = 0.0. This is a binary useful/not-useful classification.

2. **Set weights**: Currently hardcoded (weight 1.0 for Emblem of Severed Fate and Blizzard Strayer only — appears incomplete/placeholder in source).

3. **Artifact sorting**: Within each `(set, slot, mainStat)` group, artifacts are sorted by weighted sub-stat efficiency (descending). Sands/Goblet/Circlet main stat iteration order is also sorted by weight.

### Data Structures

`CutoffAlgo2Helper` holds:
- `artifacts`: HashMap keyed by `(SetName, SlotIndex, MainStat)` → Vec of artifacts
- `artifacts_without_set`: Same but ignoring set name (for flex slots)
- `super_artifacts` / `super_artifacts_without_set`: Max-stat virtual artifacts per group
- `sand_stats`, `goblet_stats`, `head_stats`: Available main stats for each variable slot, sorted by weight
- `factor_a`: Accuracy factor (default 1.0; < 1.0 → more aggressive pruning, may miss results)

### Core Search: `do_iter`

An unrolled 5-deep nested loop:

```
for i0 in slot0_artifacts:
    upper = [real[0], super[1], super[2], super[3], super[4]]
    if score(upper) * factor_a ≤ current_least: continue

    for i1 in slot1_artifacts:
        upper = [real[0], real[1], super[2], super[3], super[4]]
        if score(upper) * factor_a ≤ current_least: continue

        for i2 in slot2_artifacts:
            upper = [real[0], real[1], real[2], super[3], super[4]]
            if score(upper) * factor_a ≤ current_least: continue

            for i3 in slot3_artifacts:
                upper = [real[0], real[1], real[2], real[3], super[4]]
                if score(upper) * factor_a ≤ current_least: continue

                for i4 in slot4_artifacts:
                    score([real[0], real[1], real[2], real[3], real[4]])
                    update_result_if_better()
```

At each nesting level, replaces one more super artifact with a real artifact and runs a **full attribute computation + target function evaluation**. If the score (multiplied by `factor_a`) doesn't beat `current_least`, the entire sub-tree is pruned.

### Set Mask System

Instead of A\*'s recursive set iteration, V2 uses **set masks** — arrays of 5 integers:
- `0` = any set (flex slot, uses set-agnostic artifact pool)
- `1` = must be set1
- `2` = must be set2

**`iter_set(set_masks, s1, s2)`**: For each main-stat combination (sands/goblet/circlet), for each set mask:
1. Build full super artifact array using set-constrained super artifacts
2. If this upper bound doesn't beat `current_least` → skip entire mask
3. Otherwise call `do_iter` with the constrained artifact pools

**`iter_set4(set)`**: 5 masks — one slot flex, four from target set:
```
[0,1,1,1,1], [1,0,1,1,1], [1,1,0,1,1], [1,1,1,0,1], [1,1,1,1,0]
```

**`iter_set22(s1, s2)`**: 30 masks covering all ways to place 2 of set1, 2 of set2, 1 free.

**`iter_set2(set)`**: 10 masks for all ways to place 2 of the target set, 3 free.

**`iter_any()`**: Single mask `[0,0,0,0,0]`.

### Orchestration: `do_calculation`

Same logic as A\*: when unconstrained, calls `iter_set4` for all sets, `iter_set22` for all set pairs, `iter_set2` for all sets, then `iter_any`.

### Edge Cases

- Empty artifact groups cause the mask to be skipped (returns `null` from group lookup)
- `factor_a < 1.0` trades completeness for speed (may miss optimal within `(1-factor_a)` margin)

---

## Key Differences: A\* vs A\* V2

| Aspect | A\* (`AStarCutoff`) | A\* V2 (`CutoffAlgo2`) |
|--------|---------------------|------------------------|
| **Search structure** | Recursive DFS with backtracking | Unrolled 5-deep nested loop |
| **Pruning granularity** | Two-level: set-group then individual artifact | One-level per depth: individual artifact only |
| **Artifact ordering** | Slots sorted by group size (smallest first) | Artifacts sorted by weighted substat efficiency (best first) |
| **Heuristic pre-sort** | None | `NaiveWeightHeuristic` sorts artifacts and main stats |
| **Set iteration** | Nested loops over slot × mainStat built into do4/do22/do2/do_any | Set mask system with outer `iter_set` driver |
| **Main stat iteration** | Implicit (part of the 5-slot recursion) | Explicit outer loop over sands/goblet/circlet main stats |
| **Accuracy control** | None (exact) | `factor_a` multiplier (1.0 = exact, < 1.0 = aggressive) |
| **Upper bound check** | `check_hope`: full eval with real+super artifacts | Same: full eval with real+super artifacts, multiplied by `factor_a` |
| **Performance** | Slower on large inventories (no sort heuristic) | Faster due to heuristic sorting (best-first → prunes more early) |

### Why V2 is Faster

The key insight is **artifact ordering**. By sorting artifacts within each group by weighted efficiency, the best candidates are tried first. This means:
1. The result recorder fills up quickly with high scores
2. The `current_least` threshold rises fast
3. Subsequent iterations are pruned more aggressively

A\*'s slot-size ordering helps too (small groups first = fewer branches), but V2's per-artifact sorting is more effective.

---

## Heuristic + A\* Variant (`cutoff_heu_plus_a_star.rs`)

Not exposed as a separate UI option. Simply:
1. Pre-filters artifacts using `target_function.get_target_function_opt_config().filter()` (removes obviously bad artifacts)
2. Runs `CutoffAlgo2` with `accuracy_factor: 1.0`

This is what the UI calls "A\*" (confusingly — internally `AStar` maps to `CutoffAlgo2`, and `Naive` maps to `AStarCutoff`).

---

## Our Implementations

We have four benchmark algorithms, all sharing the same team-level wrapper (`teamSearch.ts`):

| File | Algorithm | Per-Character Search |
|------|-----------|---------------------|
| `astar.ts` | Our custom A\* | Max-heap best-first priority queue |
| `mona.ts` | Faithful Mona A\* | Recursive DFS B&B (cutoff\_a\_star.rs) |
| `monaV2.ts` | Faithful Mona A\* V2 | Unrolled 5-loop with weight heuristic (cutoff\_algo2.rs) |
| `v1.ts` | Hill-climbing | Greedy local search |

### astar.ts (formerly "mona")

Our custom algorithm, NOT a replica of any Mona algorithm. Key differences from Mona:

| Aspect | Mona A\* | Mona A\* V2 | Our `astar.ts` |
|--------|----------|-------------|---------------|
| **Search structure** | Recursive DFS | Unrolled 5-loop | **Max-heap priority queue (true A\*)** |
| **Expansion order** | Depth-first | Depth-first (sorted within group) | **Best-first (highest upper bound)** |
| **Pruning depth** | UB at every depth | UB at every depth | UB at depths 1–3 only (skip 0 and 4) |
| **Memory bound** | Unbounded (stack) | Unbounded (stack) | **Bounded: heap trimmed at 500K** |
| **Artifact pre-filter** | None (A\*) / weight heuristic (V2) | Weight heuristic | **Weight-scored top-N per slot** (15 constrained, 10 unconstrained) |
| **ER/CR pruning** | Post-eval only | Post-eval only | **Prefix-sum + suffix-max arrays** for early pruning before eval |
| **Set exploration** | All sets × all patterns (exhaustive) | Same | **Top 5 viable 4pc + top 8 half-sets** (heuristic, not exhaustive) |
| **Team allocation** | N/A (single character) | N/A (single character) | **Conflict-aware DFS with multi-ordering** |
| **Carry re-opt** | N/A | N/A | **Phase 3: re-optimize carry with locked support artifacts** |
| **Time budget** | Unlimited | Unlimited | **Dynamic per-char deadline with pooled budget** |

### Architectural Differences

1. **Scope**: Mona optimizes a single character. Our implementation optimizes an entire team (4 characters), handling artifact conflicts, carry re-optimization, and constraint repair.

2. **Search strategy**: Mona uses DFS (both algorithms), which is memory-efficient but doesn't guarantee expanding the most promising nodes first. We use a true best-first search (max-heap ordered by upper bound), which is better at finding good solutions quickly under time pressure, at the cost of memory.

3. **Pre-filtering**: Mona V2 sorts artifacts by heuristic weight but doesn't cap the number. We cap at 10–15 per slot, dramatically reducing the search space but potentially missing artifacts that happen to score poorly on the heuristic.

4. **Set exploration**: Mona tries every possible set combination exhaustively. We limit to the top 5 4pc sets and top 8 half-set combos by slot coverage, which is a significant reduction for large inventories with many set types.

### mona.ts and monaV2.ts (faithful implementations)

These faithfully replicate the original Mona algorithms' per-character search logic, wrapped in our team-level optimizer (phases 1–4 from `teamSearch.ts`).

**mona.ts** (Mona A\* / `cutoff_a_star.rs`):
- Recursive DFS with two-level pruning (set-group, then individual artifact)
- Slots sorted by group size (ascending)
- No per-slot artifact cap
- Exhaustive set combination iteration (all 4pc, all 2+2, all 2pc, rainbow)

**monaV2.ts** (Mona A\* V2 / `cutoff_algo2.rs`):
- Unrolled 5-deep nested loop
- `NaiveWeightHeuristic` for artifact/main-stat sorting (binary stat weights)
- Set mask system with explicit main-stat outer loop
- `factor_a` accuracy control (defaults to 1.0 = exact)
- Exhaustive set combination iteration

Both share the team wrapper from `teamSearch.ts` which adds:
- Conflict-aware DFS for team allocation
- Carry re-optimization with locked support artifacts
- Constraint repair for ER/CR violations
- Dynamic time budgeting
