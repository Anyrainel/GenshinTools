# Formula v2 — Design Adaptations

Deviations from the original `formulav2.md` proposal made during implementation.

---

## 1. `evaluateWithReaction()` → `createReactionVariant()` + pipeline threading

**Design**: A standalone `evaluateWithReaction()` function that takes a formula, target reaction, stats, and context, then dispatches to the correct variant and calls `.calc()`.

**Implementation**: Instead of a single evaluation function, we:
1. Added `createReactionVariant()` as a formula-level utility (creates the variant without evaluating).
2. Threaded `ReactionOverride` through the existing evaluation pipeline (`CharacterBase.getDamageResult` → `CharBuild.getDamageResult` → `TeamBuild.getDamageResult`).

**Reason**: The display pipeline (`getDisplayParts`) needs access to the variant formula to produce `DisplayPart` breakdowns for the UI. A pure evaluation function would bypass this. By threading the override through the pipeline, both `.calc()` and `.display()` use the correct variant, and the existing stat resolution (5-phase pipeline) is fully preserved.

## 2. `createDirect()` factory method added

**Design**: Only `createAmplified()` and `createCatalyzed()` factory methods.

**Implementation**: Added `createDirect()` as well, returning a `DirectFormula` with `reaction: "none"`.

**Reason**: Needed for the reverse case — if a formula already has a reaction tag and the user selects "none", we need to downgrade it to a direct variant.

## 3. Per-part reaction resolution via `resolvePartReaction()`

**Design**: Mentions per-part `eligibleReactions` but doesn't specify the resolution logic.

**Implementation**: Added `resolvePartReaction(override, partIndex, eligibleReactions)` utility that resolves effective reaction for each part using a three-tier priority:
1. Explicit per-part override (`partReactions[idx]`)
2. Gate reaction if the part is eligible for it
3. Falls back to "none"

## 4. Combo evaluation stat caching

**Design**: Mentions "cache `getTeamStats` per unique on-field character" but doesn't specify the caching strategy.

**Implementation**: `evaluateCombo()` uses a `Map<string, Record<string, StatSheet>>` keyed by on-field character ID. This works because `getTeamStats()` output depends only on the calc target (on-field character), not the formula being evaluated.

## 5. Arlecchino burst `eligibleReactions`

**Design**: Only mentions normal combo hits 0 and 3 as reaction-eligible for Arlecchino.

**Implementation**: Also added `eligibleReactions: ["vaporize", "melt"]` to the burst formula part, since the burst is a single hit that can always be amplified (no ICD concern). The original code had separate `arlecchino-burst-melt` and `arlecchino-burst-vape` entries confirming this.

## 6. Optimizer integration deferred

**Design**: Proposes using combo total as the optimization objective when combo mode is active.

**Implementation**: The optimizer still uses single-formula mode. The UI provides a mode toggle (Single Formula / Combo) for viewing, but optimization targets the selected single formula. Combo-based optimization is left for a future iteration since it requires changes to the multi-pass optimizer's marginal gain calculations and could affect optimization performance significantly.
