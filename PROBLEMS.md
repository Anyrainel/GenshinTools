# Tech Debt & Abstraction Problems — team-comp module

## A. useTeamStore.ts — Team interface

1. **Flat, disorganized field layout.** The `Team` interface mixes DamageView fields, analyzer fields, weapon-choice cache, and per-character settings with no grouping. Analyzer fields (`analyzerConfigs`, `analyzerComboOverrides`, `analyzerMinErOverrides`, `analyzerReactionOverrides`, `analyzerEnemyAura`, `analyzerExtraBuffs`) are scattered between unrelated fields instead of being grouped into a sub-interface.

2. **Duplicated type declarations for per-view settings.** `enemyAura` vs `analyzerEnemyAura`, `extraBuffs` vs `analyzerExtraBuffs`, reaction overrides in combo lines vs `analyzerReactionOverrides`, `minEr` vs `analyzerMinErOverrides`. Each view correctly has its own independent data, but the *type declarations* are duplicated — each field pair uses different names and sometimes different shapes for the same concept. A shared sub-interface (e.g. `ViewConfig { enemyAura?: Element; extraBuffs?: ExtraBuff[]; reactionOverrides?: ... }`) would let lib code accept either view's config through a common type, enabling code reuse without merging data.

3. **`selectedCombo` is a string ID for a single combo.** The UI only shows one combo per team — there are no tabs for multiple combos. Yet `combos` is an array of `ComboFormula[]` keyed by string ID, and `selectedCombo` selects one. This abstraction adds indirection with no practical benefit. A single `combo: ComboFormula | null` would be simpler.

4. **Per-character settings use multiple parallel Records.** `minEr: Record<string, number>`, `minCr: Record<string, number>`, `crMode: Record<string, "min"|"target">`, `tierAwarePool: Record<string, boolean>`, `ignoreArtifactSets: Record<string, boolean>` — five separate Records all keyed by charId. These should be a single `Record<string, CharCalcSettings>` so related per-character settings travel together.

5. **`updateTeam` is an unchecked `Object.assign` with `Partial<Team>`.** Any caller can pass any subset of fields, with no validation, no invariant enforcement. There's no way to know which fields are being modified without reading every call site.

---

## B. types.ts — Type system fragmentation

6. **Combo template vs instance naming is unclear.** `ComboDescriptor` is a per-character template declaring default formula counts at each constellation. `ComboFormula` is the resolved team-level instance. The distinction is well-defined but the names don't convey it — "Descriptor" doesn't clearly mean "template/default". Candidate renames: `ComboDescriptor` → `ComboTemplate`, `ComboEntry` → `ComboTemplateEntry`. `ComboFormula` and `ComboLine` are fine as-is since they clearly represent the resolved instance.

8. **`ReactionOverride` naming is too narrow for what it holds.** The gate reaction, per-part reactions, and per-part hit counts all belong together — they specify which parts and how many hits get a reaction applied. But `forceOnField` is a field-state concern unrelated to reactions. Renaming to `FormulaOverride` would accommodate `forceOnField` without it feeling out of place.

9. **`FormulaContext` bundles unrelated concerns.** It contains `combo` (rotation definition) and `buffOverrides` (activation map) — these are independent inputs that happen to be passed together. When callers only need one, they still import the bundle type.

---

## C. damageCalc.ts — Monolithic god classes

10. **`CharBuild` is ~1000+ lines doing too much.** It constructs stat sheets, resolves formulas, applies buffs, evaluates damage, AND produces display results. It's both a builder and an evaluator. The stat construction path (for optimizer) and display path (for UI) are interleaved.

11. **`TeamBuild` orchestrates everything with no sub-layers.** It owns `CharBuild[]`, handles resonance, manages combo evaluation, produces display results, AND is the entry point for the optimizer. There's no intermediate "team stats" vs "team damage" vs "team display" separation.

12. **Two damage evaluation paths with no shared interface.** `TeamBuild.evaluateCombo()` uses object-based `DamageFormula.evaluate()` (good for display). `formulaCompiler.ts` compiles to `Expr` trees over `Float64Array` (good for optimizer). Both compute the same thing but share almost no code. When a bug is fixed in one path, the other path may still be wrong.

---

## D. damageModels.ts — Leaky abstractions

13. **`StatSheet` filter key serialization is part of the public API.** Filter keys like `"a:normal,charge|e:Pyro,Hydro|f:on"` are string-encoded `DamageTagFilter` values. Callers must understand this encoding to use `appendFieldState()`, `isFieldStateOnlyKey()`, etc. The serialization format leaks into every file that touches stats.

14. **`StatSheet.withFieldState()` returns a shared-data view.** The returned sheet references the same underlying `Map` — mutations through the view affect the original. There's no deep copy option and no documentation warning callers.

15. **`FormulaPart.bespokeBuffs` and `buildBespokeOverlay()` are an ad-hoc per-part buff system.** Bespoke buffs bypass the normal buff registration/resolution pipeline. They use `StatBuff[]` directly but without validation, deduplication, or stack limiting. This creates a parallel buff path that callers must manually account for.

16. **Registration system (`RegisterCharacter`, `RegisterWeapon`, etc.) uses module-level side effects.** Character/weapon/artifact implementations register themselves at import time via `index.ts` side-effect barrel. There's no way to know what's registered without importing the barrel, and registration order can matter for reaction resolution.

---

## E. analyzer.ts — Flat sparse override system

17. **Override keys are fragile untyped strings.** `comboOverrideKey("charId", 3, "lineKey")` produces `"charId|3|lineKey"`. There's no branded type, no validation, no protection against `|` in formula IDs. Typos in keys silently do nothing.

18. **Five key-builder functions for the same pattern.** `comboLineKey()`, `comboOverrideKey()`, `minErOverrideKey()`, `rxCharOverrideKey()`, `rxDeltaOverrideKey()` — all build `foo|bar|baz` keys with slightly different arity. Could be a single generic key factory with typed discriminants.

19. **`AnalyzerCharConfig` vs `StoredAnalyzerCharConfig` — unnecessary split.** The stored form only differs by dropping the roster weapon (derived at runtime). But both types are exposed, and callers must know which to use and convert between them. The derivation logic is duplicated in migration code and in the runtime hydration path.

---

## F. teamReactions.ts — Internal ID format leaks

20. **Reaction formula IDs use `"rx-{reaction}-{charId}"` format.** This is an internal convention, not enforced by types. Callers parse these IDs with string splitting to extract reaction type and triggerer. If the format changes, every parser breaks silently.

21. **`TeamReactionProvider` stores formulas, eligibility, base-ID mapping, and rank weights in four separate flat Records.** These are all aspects of the same entity (a team reaction) but aren't grouped. Adding a new property to reactions requires updating four data structures.

---

## G. formulaCompiler.ts — Opaque compilation

22. **`VarMapping` layout is invisible to callers.** The mapping from `(charIdx, statKey, filterKey)` → Float64Array index is an implementation detail, but callers must use `fillVarsFromArtifacts()`, `fillVarsFromSheet()`, `fillVarsFromRawStats()` — three different fill functions for different input shapes. There's no unified "fill from any source" abstraction.

23. **`CompiledTeamDamage` has optional `evaluateEr?` and `evaluateCr?`.** These are always present when ER/CR constraints exist, but the type says optional. Callers must null-check even when they know constraints were configured.

---

## H. stackAllocation.ts — Hidden complexity

24. **Greedy stack allocation is tightly coupled to formula evaluation.** `computeDefaultActivation()` and `computeComboDefaultActivation()` directly call into damage evaluation to compute marginal gains. There's no pluggable gain function — the allocation algorithm is welded to the specific damage calc implementation.

25. **`BuffActivationMap` is a `Record<string, Record<number, number>>` passed everywhere.** It flows from stack allocation → damage calc → display → UI → store → back. But there's no helper type for reading/writing it safely. Components manually index into nested Records with string keys and numeric part indices.

---

## I. Component-level problems (src/components/team-comp/)

26. **Components directly call store key-generation functions.** `AnalyzerComboTab.tsx` and `FormulaSelectorCard.tsx` call `comboLineKey()`, `comboOverrideKey()`, `rxDeltaOverrideKey()` directly. The key format is a lib-internal concern that should be hidden behind store APIs like `setComboOverride(charId, c, formulaId, value)`.

27. **Components directly inspect `FormulaEntry.parts[].formula.tag` internals.** `ReactionPartControls.tsx`, `ReactionSelector.tsx`, and `FormulaSelectorCard.tsx` iterate over formula parts, check element types, inspect hit counts. These should be helper methods on `FormulaEntry` (or standalone functions) so the internal structure can change without breaking UI code.

28. **Artifact sorting duplicated across dialogs.** `ArtifactFreezeDialog.tsx` and `ArtifactSwapDialog.tsx` both implement `getStatValue()` and `sortByStats()` with identical logic (~50 lines each).

29. **`DamageCard.tsx` mixes calculation orchestration with UI state.** It manages `enemyLevel`, `enemyRes`, `rollMultiplier`, `substatBudget` (calc config), generator progress/results (async orchestration), AND `resultTab`, `highlightedStat` (UI state) all in one component. The calc orchestration should be a hook or lib function.

30. **`AnalyzerComboTab.tsx` has ~100 lines of pure data transformation inline.** The `formulaRows` computation (template line indexing, descriptor resolution, reaction matching) is rendering-independent logic embedded in the component. Should be extracted to a pure function in lib/.

31. **`BuffDialog.tsx` and `PartBuffDialog.tsx` access the buff override store directly.** They call `useBuffOverrideStore()` to read/write activation maps, knowing the store's internal key structure. A facade hook like `useBuffActivation(formulaKey)` would decouple them.

---

## J. Cross-cutting concerns

32. **No single source of truth for reaction metadata.** `REACTION_ELEMENT_REQUIREMENTS` in `constants.ts`, `MULTI_CONTRIBUTOR_REACTIONS` in `teamReactions.ts`, `ELEMENT_ELIGIBLE_REACTIONS` in `constants.ts`, `LUNAR_SUPERSEDES` in `constants.ts`, reaction aura/trigger pairs in `constants.ts`. Five separate constants across two files describing properties of the same entities.

33. **Field state / on-field resolution scattered across files.** `isPartOffField()` in `reactionResolve.ts`, `isFieldDependentReceiver()` and `fieldReq()` in `types.ts`, `isForcedOnField()` in `reactionResolve.ts`, `offFieldStatus()` in `damageCalc.ts`, `appendFieldState()` in `damageModels.ts`. Six functions in four files all dealing with the same concept.

34. **Buff applicability checked at three levels with no shared contract.** `filterMatchesTag()` in `types.ts` (tag-level), `StatBuff.match()` on subclasses (instance-level), `isBuffApplicable()` in `damageCalc.ts` (build-level). A new buff type must satisfy all three levels correctly, but there's no single validation function or test harness that checks all levels together.

35. **Display result construction is tangled with damage evaluation.** `getComboDisplayResult()` in `damageCalc.ts` produces `DisplayResult` by re-evaluating damage with display metadata collection. The display path can't be tested independently from the damage path, and display-only changes can break damage numbers.
