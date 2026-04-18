# Refactor Ideas (Lower Confidence)

Ideas identified during the DRY/SOLID/SoC/KISS audit of `src/lib/team-comp/`
(excluding `impl/`). These were not implemented because the trade-offs are
unclear or the benefit is marginal.

---

## 1. Intrinsic Saturation Detection Duplication (Medium)

`resolveFormulaBuffs` and `getDisplayResult` in `teamBuild.ts` both run
saturation detection loops with near-identical structure (iterate formulas,
check if intrinsic buffs exist, compute saturation ratio). Could extract a
shared `detectSaturation(formulas, stats)` helper.

**Why deferred:** The two call sites diverge in what they do with the result
(one feeds optimizer scoring, the other builds display data). Extracting the
detection alone is possible but the surrounding context differs enough that
the helper's signature would be awkward.

---

## 2. TeamBuild Class Size / SRP Tension (Medium, Structural)

`teamBuild.ts` is ~3280 lines. The class mixes:
- Stat computation (pre/mid/post stats)
- Formula resolution and buff evaluation
- Display result formatting
- Combo evaluation and level-up gain analysis
- Off-field context building

A vertical split (e.g., `TeamBuildStats`, `TeamBuildDisplay`,
`TeamBuildCombo`) would improve SRP, but the methods share private state
heavily (`this.team`, `this.charBuilds`, caches). Splitting would require
either friend-class patterns or exposing internals.

**Why deferred:** High disruption, unclear net benefit given the tight
coupling between stat computation and display formatting. Would need a
clear seam to split along.

---

## 3. `dedup + map + apply` Pattern in getUnifiedPostStats (Low)

`getUnifiedPostStats` has a dedup-then-apply pattern for artifact set buffs
that's similar to `getPostStats`. The two methods already share
`rebuildBaseExcluding` (extracted in this audit), but the post-stat
aggregation logic still has some overlap.

**Why deferred:** The overlap is structural (both compute post-stats) rather
than copy-paste. Unifying further would over-abstract the differences
between single-char and unified stat flows.

---

## 4. Talent Override Harmonization in weaponChoice (Low)

`teamOptUtils.ts` has `resolveTalentOverrides` (extracted in this audit) used
by 3 functions, but `buildWeaponChoiceCharConfigs` still inlines its own
talent resolution due to behavioral differences (empty-string guard, returns
tuple vs object).

**Why deferred:** The behavioral differences are real. Forcing unification
would require adding flags or overloads that hurt readability more than the
duplication does.

---

## 5. createOptimizerContext Variants (Low)

`optimizer.ts` and `optimizerV1.ts` each have their own
`createOptimizerContext` with similar but not identical setup logic.

**Why deferred:** The two optimizer versions are intentionally separate
evolutionary paths. Sharing setup code would couple them and make it harder
to deprecate v1.

---

## 6. getStats Cache Closure Duplication (Low)

Several `getStats`-style methods use a closure-over-cache pattern
(`if (this._cache.X) return this._cache.X; const result = ...; this._cache.X = result; return result;`).
A generic `cached(key, compute)` helper could DRY this.

**Why deferred:** The caching pattern is a 3-line idiom. A generic helper
adds indirection for minimal savings. TypeScript's type inference also works
better with the inline pattern (return type is inferred from the assignment).
