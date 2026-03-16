# Artifact Optimizer: Algorithm Reference

## Problem

Given a team of 4 characters sharing an inventory of N artifacts (~1000–2400), assign 5 artifacts per character (one per slot) to maximize the carry's damage, subject to:

- No artifact shared between characters
- Per-character artifact set requirements (4pc or 2+2)
- Per-character ER and CR minimum thresholds

The search space is the Cartesian product of per-slot artifact choices across all characters and set patterns. Exhaustive search is intractable.

---

## V1: Multi-Start Hill-Climbing

### Per-Character Search

For each character, initialize with the highest weight-scored artifact per slot, then iteratively swap each slot with the top `altCount=7` alternatives, keeping any improvement. Repeat until no single-slot swap improves damage. This finds a local optimum in the space of single-slot perturbations.

### Team Allocation

Try all N! character orderings. For each ordering, greedily assign each character their best build using artifacts not yet taken by earlier characters. Keep the best team across all orderings.

### Hyperparameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `altCount` | 7 | Number of alternative artifacts considered per slot per hill-climbing step. Small enough for speed, large enough to find most local optima. |

### Production Status

Retained as backup code. No longer used in the UI.

---

## V2: Branch-and-Bound with Hill-Climbing Warm-Start

### Phase 0: Heuristic Base Sheets

Before any B&B search begins, build a heuristic artifact assignment for every character to seed realistic team stat context. This replaces the previous approach of using account-equipped artifacts, which could belong to the wrong set and create artificially high initial bounds that pruned all valid search results.

1. **Order characters.** Carries get first pick, then supports.
2. **Determine set constraints.** For 4pc requirements, assign the on-set requirement to 4 slots (choosing the slot with fewest on-set candidates as the flex slot). For 2+2, greedily assign half-set slots.
3. **Weight-scored selection.** For each slot, filter candidates by set constraint and sort by `computeWeightScore` (using the character's `buildMatch` stat weights). Pick the top candidate, mark it as assigned so later characters cannot reuse it.
4. **Build StatSheets.** Convert each character's picked artifacts into a `StatSheet` for use as `baseSheets` in Phase 1.

This ensures every character's B&B search sees a valid initial bound from set-matching artifacts, avoiding the impossible-bound bug while still providing a strong pruning threshold.

### Phase 1: Per-Character B&B (Parallel)

For each character independently, find the top-K artifact builds. In the browser, Phase 1 runs all characters in parallel via Web Workers; in Node.js or single-character cases, it falls back to sequential execution on the main thread.

**Per-character B&B algorithm:**

1. **Pattern enumeration.** Based on set constraints, enumerate all valid slot assignment patterns (which slots are on-set vs off-set). For a 4pc set, there are 5 patterns (one per off-set slot position).

2. **Super-artifact construction.** For each slot group within a pattern, compute a virtual artifact whose every stat is the maximum across all real artifacts in that group. This defines an admissible upper bound: any real build's damage is at most the damage computed with super-artifacts, because the damage formula is monotonically increasing in all stats (with the exception of CR capping at 100%, which does not violate the bound).

3. **Hill-climbing warm-start.** Before the DFS, run hill-climbing on each pattern (greedy initialization + iterative per-slot swaps with top-15 alternatives). This seeds the top-K collector with a strong threshold, enabling aggressive pruning in the subsequent DFS.

4. **DFS with pruning.** Explore artifact assignments depth-first across the 5 slots, pruning any branch where:
   - The upper bound (real pieces so far + super-artifacts for remaining slots) does not exceed the collector's current K-th best damage
   - Cumulative ER or CR plus the suffix maximum cannot reach the target

5. **Deadline enforcement.** B&B aborts after the time budget expires. The hill-climbing warm-start ensures that even aborted searches return high-quality results.

**Parallelization via Web Workers:**

- Each worker receives: the character config, serialized `TeamBuild` (as `CharCompConfig[]` + `CombatOpts`), serialized `baseSheets` (via `StatSheet.toSerializable()`), inventory, and time budget.
- Workers reconstruct the `TeamBuild` and `StatSheet` objects internally, then run `runCharacterBnB`.
- Each worker gets the full Phase 1 time budget (since they run concurrently, the wall-clock time equals a single character's budget).
- Results are serialized back: `artifactIds` as `string[]` (converted back to `Set<string>` on the main thread).
- Worker crashes or timeouts are handled gracefully — the character gets empty results and later phases compensate.

### Phase 2: Conflict-Aware Team Allocation

Select one build per character from their top-K lists such that no artifact is shared:

1. Sort characters by flexibility (ascending damage range between rank-1 and rank-K). Carries first, then least-flexible supports.
2. DFS over top-K entries with upper-bound pruning (current score + rank-1 damage for remaining characters).
3. Fallbacks: greedy assignment with multiple orderings, then sequential B&B with exclusions.

### Phase 3: Carry Re-Optimization

After Phase 2 assigns optimized artifacts to supports, the carry's optimal build may change (Phase 1 used heuristic support stats). Re-run carry B&B with actual optimized support stats and previously assigned artifacts excluded.

### Phase 3b: Iterative Team Re-Optimization

Re-optimize each character with all other characters' artifacts locked. Repeat up to 3 passes until no improvement is found. Uses half the per-character time budget.

### Hyperparameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `TOP_K` | 100–300 (dynamic) | Scales linearly with inventory size. At 1656 artifacts: ~148. Provides enough build diversity for conflict resolution without excessive memory. |
| `MAX_TEAM_SEARCH` | 200K–2M (dynamic) | `topK² × 20`. Limits Phase 2 DFS iterations. Upper-bound pruning typically resolves search well within this budget. |
| `HC_ALT_COUNT` | 15 | Alternatives per slot in the hill-climbing warm-start. Higher than V1's 7 because this is a one-time cost that dramatically improves B&B pruning. |
| `MAX_REOPT_PASSES` | 3 | Phase 3b iterations. In practice converges in 1 pass. |
| `phase1Fraction` | 0.4 | Fraction of total time budget allocated to Phase 1 (the rest goes to Phases 2, 3, 3b). |

Dynamic scaling formula for `TOP_K`:
```
topK = clamp(100 + (inventorySize - 500) × 200/1900, 100, 300)
```

### Production Status

Active. Connected to the UI via `useAsyncTeamOptimizer`.

---

## Optimality Analysis

### V1: Local Optimum Only

V1 finds a local optimum with respect to single-slot swaps. It cannot escape local optima where improving requires changing 2+ slots simultaneously.

**Sources of sub-optimality:**

1. **Hill-climbing blindspot.** If the optimal build requires artifacts that are individually mediocre but synergize (e.g., two artifacts that together enable a set bonus), single-slot swaps will never find it. The `altCount=7` limit compounds this — only 7 of ~50–300 candidates per slot are evaluated.

2. **Greedy team allocation.** The N! ordering loop is complete in theory, but each ordering runs the limited hill-climbing. The globally optimal team assignment may require a character to use a build that hill-climbing cannot reach.

### V2: Global Optimum Under Conditions

V2 finds the globally optimal team assignment if **all** of the following hold:

1. **No B&B timeout.** Every character's B&B explores all patterns exhaustively.
2. **Top-K sufficiency.** The optimal team assignment uses builds that are all within the top-K for their respective characters.
3. **Team DFS completes.** The conflict-aware DFS does not hit the iteration limit.
4. **Phase 3b converges.** No cyclic dependencies prevent convergence within 3 passes.

**Proof sketch.** The super-artifact upper bound is admissible: it overestimates damage because each remaining slot's stat is the maximum across all real artifacts in that slot. Any branch pruned by `ub ≤ threshold` provably cannot contain a build better than the current best. When the DFS completes without timeout, the top-K captures all K-best builds. Phase 2's DFS over top-K entries with admissible pruning finds the optimal conflict-free assignment. Phases 3 and 3b close the gap from the proxy score approximation.

**Sources of sub-optimality (in practice):**

1. **B&B timeout.** Large artifact pools (e.g., 256 pieces in one set) create search spaces too large to exhaust within the time budget. Mitigation: hill-climbing warm-start seeds a strong threshold, and pattern sorting ensures the most promising patterns are explored first.

2. **Top-K insufficiency.** If two characters want the same set and their top-K builds heavily overlap, the optimal conflict-free assignment may require builds outside the top-K. Mitigation: K up to 300, plus Phase 3b re-optimizes with exclusions.

3. **Team DFS iteration limit.** With K=200 and 4 characters, worst-case is 200⁴ iterations. The limit prevents this. Mitigation: upper-bound pruning and character ordering typically resolve search early.

4. **Phase 3b non-convergence.** Theoretically possible with cyclic dependencies; not observed in benchmarks.

5. **Proxy score.** Phase 2 ranks team assignments by sum of per-character carry damages, which approximates but does not equal actual team damage due to inter-character buff interactions. Phase 3/3b partially correct this but may not fully recover from a sub-optimal Phase 2 starting point.

---

## Benchmark Summary

64 formula evaluations across 29 teams, 1656 artifacts, 30s timeout:

| Metric | V1 | V2 |
|--------|----|----|
| Wins | 0 | 43 |
| Ties | 21 | 21 |
| Timeouts | 6 | 0 |
| Avg time | 1.9s | 7.3s |
| Largest V2 gain | — | nilou-burst: +32% |

V2 is strictly superior or equal to V1 on every formula tested.

At 10s timeout, V2 finds the true optimum (matching the 30s/600s result) for 52/64 formulas. The remaining 12 formulas gain 0.7–5.8% with additional time, all involving teams with large artifact pools (250+ pieces in the target set).
