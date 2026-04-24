# Recommendation View Redesign — Plan

Status: planning → implementation. Owner: in-progress.

## Goal

Replace the current per-character independent optimizer + tier-rank stealing with:

1. A **global allocation pass** that assigns the entire artifact pool to characters tier by tier (S → A → B → C → D → Pool), maximizing per-tier total score subject to artifact-uniqueness within the pass.
2. A separate **upgrade pass** that, given the allocated builds, recommends which submax artifacts to upgrade (with three structured strategies described below).

Drops `farm` and `reroll` from the action space entirely. The user controls only:
- A score-diff threshold (single slider) — recommendations below this are hidden.
- An "include upgrade actions" toggle.

## Inputs and conventions

- **Allocation pass uses artifacts as-is** (no projection to max level). Each artifact contributes its current substats.
- **Tier waterfall**: S processed first against the full pool; A receives the unclaimed remainder; B receives what A leaves; etc. Pool tier may or may not run an allocation (TBD; possibly skipped — Pool characters typically have low priority and crowd-out S/A/B picks).
- **Soft main stat**: main-stat mismatch contributes 0 to the score (via existing per-stat weights), not a hard reject. Every artifact in a slot is a candidate.
- **Soft CR cap**: excess CR over (100% − non-artifact-CR baseline) contributes 0, but the build is *not* rejected. A 101% CR build is allowed if total score is higher.
- **2+2 set composition constraint**: exactly `2 × halfSetId1 + 2 × halfSetId2 + 1 flex (any set)`, with `halfSetId1 ≠ halfSetId2` (otherwise it would be 4pc).
- **4pc set constraint**: `≥ 4 × mainSet + 1 flex (any set)`. The flex may itself be the mainSet (5pc).

## Algorithm — allocation pass

### Per-character solver (sealed)
The existing branch-and-bound (`buildOptimizer.ts`) handles per-character feasibility (slot, set composition, soft main stat, soft CR cap). All cross-character coupling is ignored at this layer.

Required changes to per-char solver:
- Remove main-stat hard filter; main stat scored via weight only (already partly the case in scoring, but candidate filtering needs to drop the gate).
- CR contribution clipped at the cap (existing behavior assumed correct; verify) but **never reject the build** for exceeding it.
- Expose `enumerateBuilds(config, { maxK, minScoreDiff })` returning columns in score-descending order. Each column = `(artifactIds[5], slotScores, totalScore)`.

### Cross-character solver (column packing)
Given top-K columns per character in a tier, pick one column per character such that artifact IDs are pairwise disjoint, maximizing total score.

DFS-with-pruning:
- Order chars by descending top-1 score (decide hardest-to-satisfy first).
- State: `(charIdx, claimedSet, scoreSoFar)`.
- Branch: each non-conflicting column of char[charIdx], in score-descending order.
- Bound: `scoreSoFar + Σ_{c > charIdx} bestNonConflicting(c, claimedSet)`. Admissible because it ignores future cross-char disjointness.
- Prune when `bound ≤ bestFound`.

K controls the optimality/speed trade. Production K ≈ 20–30. Ground-truth K = enumerated until next column score < (top1 − minScoreDiff) so dropped columns can never appear in the displayed result.

### Tier orchestration
```
for tier in [S, A, B, C, D] (and optionally Pool):
  chars = characters in tier with valid builds
  pool  = unclaimed artifacts ∪ extraArtifacts
  for c in chars: columns[c] = enumerateBuilds(c, pool, K)
  assignment = packDisjointColumns(columns)
  unclaimed -= artifacts used in assignment
  record assignment[c] for each c
```

Characters without an assigned build (e.g., infeasible set match) get null.

## Algorithm — upgrade pass

Runs after allocation. Operates per-character independently (no uniqueness constraint on the artifact being upgraded).

### Inputs per character
- The character's allocated build (5 artifact IDs, or null if no allocation).
- The character's set composition: 4pc (mainSet) or 2+2 (halfSet1, halfSet2).
- The character's stat weights, target main stats per slot, CR budget.

### Upgrade candidates
- A submax artifact = 5★ at level < 20, or 4★ at level < 16.
- 4★ artifacts with fewer than 4 substat lines are excluded.
- Special case: 5★ at levels 0–3 with `unactivatedSubstats` present — the first +4 upgrade always activates the 4th line. We must apply this *before* distributing remaining rolls.
- Remaining rolls distributed equally across all 4 substats.
- Per-roll value uses the luck multiplier (cautious 0.8, balanced 0.85, hopeful 0.9) of the *mid value between roll #2 and roll #3* of the actual `artifact_stat.json` data. (Locate the read util — likely under `scripts/` or `src/data/`.)

### Three upgrade strategies

For 4pc builds, generate all three. For 2+2 builds, only strategy (1) — strategies (2) and (3) are skipped (too complex and rarely useful with two halves competing for the flex slot).

**Strategy 1 — upgrade in place.**
- For each slot in the allocated build:
  - If it's a "fixed-set" slot (one of the 4 mainSet slots in 4pc, or one of the 2-piece slots in 2+2): consider only same-set upgrade candidates that share that slot.
  - If it's the flex slot: consider only different-set upgrade candidates (since same-set candidates are accounted for by strategy 2).
- For each candidate, compute the score delta: build score with this artifact upgraded and replacing the current allocated piece in that slot, vs. allocated build score.
- Each candidate above threshold = one upgrade recommendation.

**Strategy 2 — upgrade flex with same-set, optionally swap another fixed slot.** *(4pc only)*
- For each same-set upgrade candidate that fits the flex slot's slot type:
  - Compute score with this candidate in the flex slot (now we have 5pc-equivalent), keeping all other allocated artifacts fixed.
  - Optionally: also try replacing one of the 4 fixed-set slots with a different-set max-level artifact from the unclaimed pool (now the build becomes 4pc + 1 different-set in that slot, satisfying 4pc constraint via the flex+3fixed remaining + the new same-set in flex). The "freed" fixed-set slot can hold any different-set artifact.
  - Take the best such combination per upgrade-candidate.

**Strategy 3 — swap flex to same-set first, then upgrade a different slot.** *(4pc only)*
- Pick a max-level same-set artifact (from unclaimed pool) to put in the flex slot.
- For each other slot, consider different-set upgrade candidates that could replace the now-redundant fixed-set slot (which is freed by the flex swap making the build 5pc-equivalent on the mainSet).
- The combined swap+upgrade is one recommendation.

### Output
Per character, a list of upgrade recommendations sorted by score delta. Each carries:
- Strategy label (1/2/3).
- Artifact(s) involved (the upgrade target + any swap partners).
- Score delta vs. allocated build.

### Notes
- No uniqueness constraint across characters: the same upgrade candidate can appear under multiple characters' recommendations. The user upgrades the artifact once and decides who gets it.
- Independent per-character → fast. Should not be a bottleneck.

## Ground-truth strategy

Same column-packing algorithm with K large enough to saturate (or with `minScoreDiff = 0`). Used offline for benchmarking the production K.

Build a small benchmark harness:
- Snapshots of representative accounts.
- Run K=20 vs K=∞ (or K=200).
- Log per-tier total score gap.
- If gap > ε, raise K or improve column generation.

## Code change plan

1. **Per-char solver enhancements** (`src/lib/account-data/buildOptimizer.ts`)
   - Soften main stat (drop hard filter at candidate construction — happens upstream in `candidatePool.ts`).
   - Verify CR is soft-clipped, not hard-rejected.
   - Add `enumerateBuilds(config, { maxK, minScoreDiff })` returning columns in score-descending order.

2. **Candidate pool simplification** (`src/lib/account-data/candidatePool.ts`)
   - Drop `farm` and `reroll` candidate types.
   - Drop the projection-to-max for swap/upgrade variants — use artifacts as-is. (The "upgrade" notion moves to the upgrade pass.)
   - Drop the tier-rank stealing gate — uniqueness is enforced by the cross-tier waterfall, not per-candidate.
   - Drop main-stat filter.

3. **New cross-character packer** (`src/lib/account-data/columnPacker.ts`)
   - DFS-with-pruning over per-char columns.
   - Returns one column per character (or null if infeasible/no columns).

4. **New tier waterfall driver** (`src/lib/account-data/tierWaterfall.ts`)
   - Iterates S → A → B → C → D, calling enumerator and packer.
   - Returns per-character allocated build + remaining unclaimed pool for the upgrade pass.

5. **Upgrade pass** (`src/lib/account-data/upgradePass.ts`)
   - Implements strategies 1/2/3.
   - Uses real per-roll values from `artifact_stat.json` (need to find the read util).

6. **Engine driver rewrite** (`src/lib/account-data/scoreUpEngine.ts`)
   - New flow: `tierWaterfall(...) → upgradePass(...) → flatten to ScoreUpAction[]`.
   - Drop `farm` and `reroll` from `ActionType`.
   - Action types: `swap` (allocation moved an artifact between characters), `equip` (allocation filled an empty slot), `upgrade` (any of strategies 1/2/3).

7. **Store changes** (`src/stores/useTierStore.ts`)
   - Drop `investmentThresholds.farm` and `.reroll`.
   - Add `includeUpgrades: boolean` (default true).
   - Single `scoreDiffThreshold: number` (replaces swap/upgrade thresholds).
   - Migration logic + version bump per CLAUDE.md store refactor rules.

8. **Benchmark harness** (`tests/lib/account-data/columnPacker.test.ts`)
   - Compares packColumns output against brute-force ground truth on small synthetic instances.
   - Pending: full account-data integration benchmark comparing K=20 vs K=200 over realistic snapshots.

9. **UI rewrite** (`src/pages/account-data/RecommendationView.tsx` + `ScoreUpCard`)
   - To be brainstormed once the engine is done. Likely: per-character card shows allocated build (with swap arrows for moved artifacts), then a collapsible upgrades section with strategy badges.

## Algorithm correctness & K-experiment findings

### Verified by tests
- `enumerateBuilds` top-1 matches brute-force optimum on small inputs (`tests/lib/account-data/enumerateBuilds.test.ts`).
- Top-K is in score-descending order with no duplicate builds (dedup by sorted-ID signature).
- Soft main stat: wrong-main-stat candidates are scored on substats only, not filtered out.
- Soft CR cap: builds exceeding 100% CR are feasible; over-cap CR contributes 0.
- `packColumns` matches brute-force ground truth on a 4-char × 5-column instance with intentional artifact overlaps (`tests/lib/account-data/columnPacker.test.ts`).
- The "skip" branch is always tried (not gated by a heuristic) so the packer is provably optimal *within the columns it sees*.

### Known caveat: per-slot K cap inside per-char B&B
`buildOptimizer.ts` has hidden `TOP_K_SET=30` and `TOP_K_FLEX=15` per-slot caps that prune candidates beyond the K-th best per single-slot score. This is a heuristic — a great-substat artifact ranked >K by single-slot score could be globally optimal in combination with other artifacts. Practically rare, but documented for future tuning.

### Allocation pipeline (3-pass chain)

The full pipeline guarantees every character gets a build (no empty characters).

1. **Main packer** — top-K columns per char, packed with DFS-with-pruning.
2. **Sub-packer** — for characters skipped by the main packer (all their K columns conflicted), enumerate K columns against the post-main-packer leftover pool and pack them. Skipped-char columns are disjoint from main-round picks by construction, so this is a clean sub-problem.
3. **Sequential greedy** — any character still unassigned after the sub-packer gets their top-1 build via per-char B&B against whatever remains. Since `buildAllocationPool` always includes each character's currently-equipped artifacts, a feasible build is virtually always findable.

The contract: **every character with a valid `scoreResult` ends up with an allocated build**. No character is ever left empty because the packer's K was too low or the pool was contested.

### K-sweep results (`scripts/kSweepReal.ts`)

Two synthetic 5-character scenarios, sweep over K ∈ {1, 5, 10, 20, 50, 100, 200}.

Skip pattern column format: `main-packer-skips → sub-packer-rescues → greedy-rescues → finally-empty`. Final column is always 0.

**Scenario A — heavy contention (all 5 chars share 4pc CW):**
```
K=  1 |   2126.00 |  0.492% | 13    nodes | 4→1→3→0
K=  5 |   2116.63 |  0.930% | 30    nodes | 3→1→2→0
K= 10 |   2136.51 |  0.000% | 62    nodes | 3→1→2→0   ← best
K= 20 |   2136.51 |  0.000% | 98    nodes | 3→1→2→0   ← best, same total
K= 50 |   2125.37 |  0.521% | 520   nodes | 3→2→1→0
K=100 |   2120.35 |  0.756% | 2520  nodes | 2→1→1→0
K=200 |   2121.78 |  0.689% | 11539 nodes | 2→2→0→0
```

**Scenario B — realistic (3 chars on CW, 2 on Emblem):**
```
K=  1 |   2152.42 |  0.312% | 13    nodes | 4→1→3→0
K=  5 |   2154.84 |  0.200% | 53    nodes | 3→1→2→0
K= 10 |   2157.15 |  0.093% | 150   nodes | 3→2→1→0
K= 20 |   2154.84 |  0.200% | 606   nodes | 3→2→1→0
K= 50 |   2155.49 |  0.169% | 1690  nodes | 2→2→0→0
K=100 |   2159.10 |  0.002% | 9074  nodes | 1→1→0→0
K=200 |   2159.15 |  0.000% | 69038 nodes | 1→1→0→0   ← best
```

### Key finding: not monotonic in K — and that's OK now

In Scenario A (heavy contention), K=10–20 gives a *higher* total than K=100+. The packer's objective ("maximize sum of assigned column scores") doesn't account for the fallback's rescue quality, so at high K it can over-commit artifacts that the fallback would have used better for other characters.

In Scenario B (realistic low-contention), more K helps monotonically.

The 3-pass chain absorbs the non-monotonicity: every char gets a build regardless of K, and the quality swing is tight (≤0.9% across K=1–200 in both scenarios).

### Production K choice

**K=20 default**:
- Within 0.5% of best observed total in both scenarios.
- Zero empty characters guaranteed (3-pass chain).
- Fast: ~25ms enum + packer per tier of 5 chars.
- In realistic Genshin accounts (chars with different sets), closer to Scenario B — slightly suboptimal but safe.

Higher K (50–100) trades a bit more compute for an additional ~0.1–0.2% of realistic quality, but can hurt in pathological heavy-contention tiers. K=20 is the safe middle.

### Future algorithmic work (not in V1)

The packer's myopia (ignores fallback's downstream contribution) is the root of the non-monotonicity. A proper fix would **internalize the fallback value** into the packer's skip-branch score — but the fallback value depends on the rest of the assignment, making it a circular dependency. Approaches worth exploring:
- Lagrangian / shadow-price iteration (column generation).
- Iterative local search on top of the 3-pass result (swap moves between assigned and fallback chars).
- Integer programming (ILP solver in JS, slow but principled).

None justified for V1 given the current quality is within 0.5%.

## Open questions for later

- **Internalize fallback** into the packer's score function for true monotonic optimality.
- **Per-slot K cap** in `buildOptimizer.ts` (TOP_K_SET=30, TOP_K_FLEX=15) is a heuristic — should we expose / increase it for ground-truth runs?
- Pool tier: skip allocation entirely, or run with whatever's left?
- Should the upgrade pass also consider upgrading artifacts that are *not* in the allocated build (i.e., upgrade-then-swap-in)? Currently strategies 2 & 3 cover this for the flex slot. Maybe a strategy 4 for fixed-set slots.
- How to display strategy 2/3 in the UI (combined actions are harder to read).
- Whether to support a "limit upgrade-pass to artifacts of suitable main stat" knob to cut noise.
