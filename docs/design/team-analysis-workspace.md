# Team analysis workspace refactor

Status: implementation specification, 2026-10-11. Source: decisions in this session. This document defines the accepted scope; implementation agents should record completion evidence and outstanding work at the end.

## Product and layout contract

- Keep the existing site shell and site-level tab bar. Never insert custom navigation/content above it.
- Consolidate the selected-team calculations into one analysis page. Top-level destinations are Analysis / 队伍分析 and Saved Loadouts / 配装方案; character replacement is a calculation mode, not an independent Team Builder page.
- Analysis without a selected team shows the existing searchable/filterable team grid. Put a concise Select a team / 选择队伍 cue inside its existing page header, not below the long grid.
- Selected-team details have the team name and a labeled Switch team / 切换队伍 control within the page. Switching teams preserves saved setup, mode-specific controls, and valid results for each team.
- Above the calculation selector render exactly one TeamRosterCard and one FormulaSelectorCard, preserving their existing headings. They stay mounted and have no calculation-mode-dependent variants, hiding, resets, or duplicated state.
- Selector order/names: Artifacts / 圣遗物; Builds / 配装; Investment / 补金; Characters / 角色; Energy / 充能. It follows the two shared blocks. All mode-specific settings and results follow the selector.
- Keep theme tokens, existing component/layout primitives, responsive behavior, literal i18n keys, and natural zh/en language. Controls must fit narrow phones and sidebar-constrained desktop content.

## Shared input ownership

- Shared roster owns character IDs, levels, constellations, talents, selected weapon IDs/refinements, artifact-set seeds, and combat options.
- Shared skill/environment panel owns single-formula versus combo selection, counts, reaction choices/details, enemy aura, extra buffs, selected/expanded skill state, reset-to-default action, and ignored damage contributors.
- Own panel interaction state once in the analysis workspace, independent of mode. Preserve it on mode changes; restore per-team authored values on team changes.
- Use the shared environment/reactions for every damage calculation. Investment must not silently strip shared reactions or select a different aura/buff configuration.
- Enemy numeric parameters and generated-artifact quality/stat requirements may remain existing controls below the selector where appropriate. Do not force a generic account/theoretical switch above the selector.
- Owned weapons with generated ideal artifacts is intentionally valid. Ownership restrictions and artifact sourcing are independent. Use concise contextual labels where their combination would otherwise be ambiguous.
- Parameters irrelevant to a calculation may remain accepted and unused without changing the shared panels. Energy has its own timeline/settings below the selector; action-count/timeline synchronization is explicitly out of scope.
- Calculated suggestions are previews. Explicit Apply actions modify the shared roster/setup and invalidate affected results. A second optimization round is supported; independent top-ranked suggestions are not presented as a guaranteed joint optimum.
- Changing shared inputs invalidates affected result caches safely; changing mode alone does not discard progress/settings/results. Cancel a run whose actual inputs changed and do not publish stale worker results.

## Roster shortcuts and physical weapon copies

- Add Reset 5★ to C0/R1 / 五星重置为0命精1: set configured five-star characters to C0 and selected five-star weapons to R1; preserve three/four-star settings, equipment IDs, account data, and other team settings. Offer Undo if using the local edit pattern.
- Add Use account data / 使用账号数据: fill owned character levels/constellations/talents and assigned owned weapon refinements using the configured roster. Unowned characters/weapon shortages must be visibly identified; do not silently invent ownership.
- Fix normal account-prefill resolution as well as the shortcut. Group owned equipped and inventory weapon instances by weapon key; deduplicate physical IDs; sort refinement descending with deterministic ties. Assign the highest refinement to the first roster slot using that weapon, then the second-highest to the second slot, etc.
- Explicit hypothetical per-character refinement overrides remain valid and visibly override account defaults. Account-prefill mode must not borrow the same physical weapon twice. If there are fewer copies than slots, distinguish the unmatched slot rather than suggesting the account owns another high-refinement copy.
- All roster displays and calculations must use the same slot-aware resolution, including energy slot conversion. Avoid leaving independent max-refinement implementations behind.
- Tests cover equipped+inventory copies, duplicate physical IDs, repeated weapon IDs, unequal refinements, shortage, no account, and explicit hypothetical overrides.

## Artifacts mode

- Preserve current/equipped damage evaluation, real-inventory artifact optimization/swapping, generated optimal artifacts/stats, requirements, detailed damage/buff/stat inspection, and save/apply actions.
- Characters and selected weapons are fixed for artifact search. Artifact-set seeds, main-stat preferences, ER/CR settings and existing pool restrictions retain their established meaning.
- Actual inventory allocations must not reuse one artifact ID on multiple team members.

## Builds mode

- Preserve all-weapons, owned-weapons-at-imported-refinements, and artifact-set comparisons. Keep candidate refinements and artifact assumptions apparent without adding intrusive new IA.
- Provide Apply to roster for a selected equipment suggestion, allowing iterative optimization.
- Add an account-equipment improvement task: search owned weapon copies and available actual artifacts for an improvement to this team. Return a feasible coordinated allocation, not a concatenation of independent rankings; no repeated physical weapon or artifact IDs. Respect reservations belonging to other teams.
- Preserve supported theoretical/generated artifact comparisons; owned weapon restriction must not force actual artifacts.
- Separate local result scopes for actual-account and catalog/generated runs so stale results cannot masquerade as the other scope.

## Investment mode

- Retain account-based next-three independent one-copy recommendations and full investment path. Do not replace the full-path capability with a short recommendation list.
- Reuse shared roster and skill/environment panel. Below selector put alternate weapon targets, upgrade limits, and sparse future change points.
- Include constellation-dependent direct skill counts AND reaction-count bumps in the additional panel. Optional per-constellation ER changes belong here too.
- Shared default counts already include effects at the configured starting constellation. Evaluate a future count as authored baseline count + default deltas strictly after the starting constellation through candidate constellation + user future deltas. Never reapply bonuses from C0 that are already included.
- Show default future changes as inspectable/itemized entries and permit customization. Include newly appearing formula/reaction lines, not just existing baseline rows.
- Define explicit threshold/delta semantics, including negative changes and reset/default behavior. Preserve old exact per-constellation user overrides through conversion or a documented lossless representation; no silent loss of customization.
- Single-skill investment analysis is supported: use the same selected single formula and its reaction/context, assessing upgrades for that objective. Do not silently run the stored full combo instead.
- Reset-to-C0/R1 uses the shared shortcut, resolving defaults at the new configured constellation while protecting explicitly authored custom counts from silent destruction.

## Characters mode

- Character-replacement search is a mode of the selected team, starting from a preset or custom team.
- Tasks: replace one slot; replace selected slots (keep others fixed); one-click replace every unowned character using account data, preserving owned members.
- Candidate pool choices: owned characters + owned weapons; owned characters + any compatible weapon; all characters + any compatible weapon. These are mutually exclusive alternatives. Artifact basis is independent.
- Owned character stats default to account data; hypothetical candidates use explicit rarity-group constellation/refinement assumptions. Distinguish unavailable account information and insufficient owned roster/copies.
- Inherit shared damage objective, environment and unchanged-member configuration. Do not retain the old standalone search's hardcoded anchor/default environment as an invisible override.
- Replacements cannot reuse removed-character formula IDs. Seed replacement action counts from supported defaults, preserve unchanged members' authored counts, and let users inspect candidate counts/builds before applying.
- For single-formula search, keep its damage source fixed unless an explicit supported replacement objective is defined; visibly explain an incompatible selected slot rather than evaluating another target silently.
- Search distinct characters and physical owned weapon copies. Use bounded screening with multiple weapon variants and detailed finalist artifact optimization. Multi-slot search is approximate; retain candidate diversity and label best-found/partial results honestly.
- Rank by damage only. Display damage tradeoff relative to the top result; energy/survivability are judged by the user, not enforced secretly.
- Apply a result into the same team's shared roster/configuration, followed by optional artifact/loadout application. Preserve presets via normal team delta updates.

## Saved loadouts and reservation semantics

- User-facing freeze/frozen terminology becomes Saved loadout / 配装方案 and reserved artifacts / 预留圣遗物 where appropriate. In-game artifact locking remains a separate concept.
- One saved loadout per team for now; multiple/pinned loadouts are out of scope.
- A saved loadout is an artifact allocation snapshot, not a frozen roster. Roster edits (including C/R, weapon and character edits) stay available. Do not disable them because a saved allocation exists.
- Existing saved artifact IDs must survive. Editing a roster does not silently rewrite/remove its saved loadout or release its reservations. If incompatible with the edited roster, show that status and explicit update/remove/apply actions.
- Other teams' optimization respects reserved artifacts and existing explicit reuse policy. Optimizing the owning team can use its own saved artifacts in the candidate pool to build a replacement allocation; they are not forced as immutable current equipment.
- Saving replaces that team's one allocation through the existing conflict-resolution pattern. Never equate reserved status with in-game locked status.
- Correct/delete stale comments encountered in touched code, including the false weapon-refinement-hidden comment.

## Routing and persistence

- Adopt one canonical analysis route with team and mode reflected in the URL. Recommended `/team-comp/analysis?team=<id>&mode=<mode>`; grid has no team. Saved loadouts use `/team-comp/loadouts`. Validate invalid IDs/modes and avoid URL/render/effect loops.
- Old public routes/bookmarks may fall back to the main site; do not retain internal compatibility shims solely for old routes. Update all internal links, navigation, onboarding and applicable tests.
- URL changes alone may not need a schema change; persisted shape/meaning changes always do. Inspect current origin and existing local version bumps before assigning one version per affected store for this change set.
- Team/setup changes must migrate local persisted state, cloud store envelopes/snapshots, and any import/export boundary that actually carries the changed fields. Composition-only export must remain composition-only.
- Preserve realistic old team/preset deltas, exact-count overrides, reactions, environments, energy timelines, saved loadout IDs/profile scoping, and unmodified user settings. Document deterministic conflict precedence for formerly independent damage/investment inputs. Do not silently discard divergent investment environment/reaction settings; preserve them as explicit mode exceptions or losslessly retained data pending reconciliation.
- Invalidate derived result caches whose old assumptions cannot be reconciled. Do not let stale cached results crash hydration.
- Add tests through public hydration/merge/import/cloud adapter paths using realistic pre-change fixtures, not only fresh-state unit tests. Include missing optional fields, default/preset and custom teams, profile scopes, old exact overrides, single/combo selections, cache invalidation, unknown safe input handling.
- Remove obsolete types/components/call paths after migrating callers. Old data shapes belong only in migration modules. No internal re-export compatibility shims.

## Execution ownership and acceptance

1. Workspace agent: shared components and mode shell, routes/navigation/session context, Artifacts/Builds/Energy integration, saved-loadout editing behavior and wording/i18n. Own workspace integration; coordinate APIs with other agents.
2. Investment/persistence agent: sparse change-point model/UI/evaluation including reactions and single-skill objective; team/setup/schema/cloud migrations and migration tests. Own central persisted team model/schema edits. Coordinate session schema additions with workspace agent.
3. Roster/characters agent: slot-aware owned-copy resolution and shortcuts; Characters engine/UI/tasks and tests. Coordinate shared panel apply callbacks and i18n keys with workspace agent.
4. Root: documentation, coordination, final evidence review. Implementation belongs to workers. Agents may request an additional targeted worker once a slot is free.

Acceptance: all five modes use the exact same two mounted components above the selector; per-team work survives mode/team switches; source assumptions stay independent; loadouts do not freeze roster; owned defaults do not duplicate weapons; investment preserves customizations and supports single hits; replacement search has explicit scope/objective; migration fixtures hydrate without session crashes. Run appropriate targeted tests, type-check, Biome/UI invariants, dependency checks, production build and related tests. Commit validated scopes with safe pathspecs; never push without user request.

## Implementation evidence

Specification committed as `a3cdc422`. The five-mode shared workspace, canonical routing, editable saved loadouts, physical weapon-copy resolution, account equipment improvement, character replacement, and investment change-point panel are implemented.

Agreed integration contract: `InvestmentPanel` receives `{ teamComp, setupConfig, teamBuild, configs, objectiveCombo, singleObjective, ignoredCharIds? }` and renders no duplicate shared header/roster/skill panel. The workspace supplies the effective shared objective and environment. Ignored combo contributors do not suppress an explicitly selected single-skill objective.

Implemented migrations: local team store 22 -> 23, cloud team envelope 4 -> 5, derived result cache 5 -> 6, session navigation 0 -> 1. Sparse future changes use `{ charId, constellation, formulaId, delta }`; legacy exact count maps retain exact semantics as `legacyCountOverrides`. Divergent old investment setup is retained in inspectable `legacyInputs`, with explicit adopt/reset actions. Shared damage configuration has canonical precedence. Migration tests exercise persisted hydration and cloud adapter boundaries. Persisted comparison/investment results require matching input signatures; obsolete artifact runtime cache fields are removed.

Shortcut reconciliation: on a configured constellation change, rebuild a character's stored default counts only if its aggregate formula/count map exactly matches the old constellation's catalog defaults. Preserve matching reaction settings. Edited/custom count maps remain untouched; the existing explicit Reset combo action remains available. This avoids applying old-constellation defaults after C0/R1 reset without destroying authored rotations or requiring guessed provenance.

Validation: the integrated full suite passed 290 test files, with 9,952 tests passing and 2 skipped. Production build and dependency checks passed. Browser checks covered English and Chinese at 320px, Energy at 768px, and Characters at 1440px. At narrow widths the five local modes use a readable 12px, three-column/two-row selector without outer overflow. Canonical team/mode URLs and the shared input hierarchy were verified. Account equipment search requires a selected weapon for every nonempty roster slot and cannot apply a partial team result.

After the full suite, the final completeness guard and canonical owned-weapon collector passed 17 targeted tests across five files. The current revision then passed production build, repository lint (877 files), and dependency checks (861 modules / 4,469 dependencies). The canonical collector deduplicates equipped/inventory physical IDs before creating comparison refinement candidates.
