# Team analysis workspace refactor

Status: implementation specification, updated 2026-10-12. Source: decisions and UI corrections in this session. The latest requirements below supersede the original implementation where it diverged.

## Product and layout contract

- Keep the existing site shell and site-level tab bar. Never insert custom navigation/content above it.
- Consolidate the selected-team calculations into one analysis page. Top-level destinations are Analysis / 队伍分析 and Saved Loadouts / 配装方案; character replacement is a calculation mode, not an independent Team Builder page.
- Analysis without a selected team shows the existing searchable/filterable team grid. Put a concise Select a team / 选择队伍 cue inside its existing page header, not below the long grid.
- Selected-team details have the team name and a labeled Switch team / 切换队伍 control within the page. Switching teams preserves saved setup, mode-specific controls, and valid results for each team.
- Above the calculation selector render exactly one TeamRosterCard and one FormulaSelectorCard, preserving their existing headings. They stay mounted and have no calculation-mode-dependent variants, hiding, resets, or duplicated state.
- Selector order/names: Artifacts / 圣遗物; Builds / 配装; Investment / 补金; Characters / 角色; Energy / 充能. It follows the two shared blocks. All mode-specific settings and results follow the selector.
- Keep theme tokens, existing component/layout primitives, responsive behavior, literal i18n keys, and natural zh/en language. Controls must fit narrow phones and sidebar-constrained desktop content.
- Reuse the Artifacts `OptionButtonRow` / `OptionButtonCell` / `OptionButton` submode controls. Add no unsolicited subtitles around selectors. Each calculator places visible settings after the selector, then its run action, then results; actions do not belong in the title.

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
- Add Use account data / 使用账号数据: fill owned character levels/constellations/talents and assigned owned weapon refinements using the configured roster. Missing characters use C0 and missing weapon copies use R1, without ownership/shortage notices. Both shortcuts align to the right of the roster title bar.
- Fix normal account-prefill resolution as well as the shortcut. Group owned equipped and inventory weapon instances by weapon key; deduplicate physical IDs; sort refinement descending with deterministic ties. Assign the highest refinement to the first roster slot using that weapon, then the second-highest to the second slot, etc.
- Explicit hypothetical per-character refinement overrides remain valid. Account-prefill mode must not borrow the same physical weapon twice; unmatched slots default to R1. Do not add text to label hypothetical overrides.
- All roster displays and calculations must use the same slot-aware resolution, including energy slot conversion. Avoid leaving independent max-refinement implementations behind.
- Tests cover equipped+inventory copies, duplicate physical IDs, repeated weapon IDs, unequal refinements, shortage, no account, and explicit hypothetical overrides.

## Artifacts mode

- Preserve current/equipped damage evaluation, real-inventory artifact optimization/swapping, generated optimal artifacts/stats, requirements, detailed damage/buff/stat inspection, and save/apply actions.
- Characters and selected weapons are fixed for artifact search. Artifact-set seeds, main-stat preferences, ER/CR settings and existing pool restrictions retain their established meaning.
- Actual inventory allocations must not reuse one artifact ID on multiple team members.

## Builds mode

- Two submodes: weapons and artifact sets. Weapon calculation settings contain a toggle to restrict candidates to owned weapons at imported refinements; all/owned are not separate submodes.
- Provide Apply to roster for a selected equipment suggestion, allowing iterative optimization.
- Builds always compares theoretical/generated artifact builds, regardless of weapon ownership. Remove the separate account-equipment improvement card and its unused engine; real inventory artifact optimization belongs to Artifacts.
- Preserve separate all/owned weapon result scopes so a cached unrestricted result cannot masquerade as an owned-only result.

## Investment mode

- One calculation produces the full investment path and readable next-N pull recommendations derived from that same path, including alternate branches. No independent account-investment run/card.
- Reuse shared roster and skill/environment panel. Below selector put alternate weapon targets, upgrade limits, and sparse future change points.
- Use one compact per-character configuration grid: small identity labels, 3/4-star and 5-star comparison weapon inputs, and existing Select controls for C0-C6/R1-R5 ceilings. No duplicated roster portraits or dynamic ceiling labels.
- Include constellation-dependent direct skill counts AND reaction-count bumps in the additional panel. Optional per-constellation ER changes belong here too.
- Shared default counts already include effects at the configured starting constellation. Evaluate a future count as authored baseline count + default deltas strictly after the starting constellation through candidate constellation + user future deltas. Never reapply bonuses from C0 that are already included.
- Show default future changes as inspectable/itemized entries and permit customization. Include newly appearing formula/reaction lines, not just existing baseline rows.
- Each character column contains its own future constellation changes and an Add change popover. Show absolute skill/reaction counts and minimum ER at Cn, not deltas. Minimum ER is another change point. Preserve old exact/delta overrides through lossless data representation and versioned migration where needed.
- Single-skill investment analysis is supported: use the same selected single formula and its reaction/context, assessing upgrades for that objective. Do not silently run the stored full combo instead.
- Reset-to-C0/R1 uses the shared shortcut, resolving defaults at the new configured constellation while protecting explicitly authored custom counts from silent destruction.

## Characters mode

- Character-replacement search is a mode of the selected team, starting from a preset or custom team.
- Two submodes: replace characters and replace unowned characters. The first simultaneously computes independent replacement rankings for all four positions with the other members fixed, without slot selection. The second performs a joint replacement of every unowned character, preserving owned members; it is not a shortcut button.
- Candidate pool choices: owned characters + owned weapons; owned characters + any compatible weapon; all characters + any compatible weapon. Use generated artifacts, consistently with Builds. Use existing Select components throughout.
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
- Optimization respects frozen artifact allocations and the existing explicit cross-team reuse policy. Within the owning team, frozen characters keep their saved equipment and their pieces are excluded from the shared candidate pool. Partial freezes offer "Optimize remaining"; fully frozen teams must unfreeze before optimizing. This restores the pre-workspace behavior after the 2026-10-11 regression; saving a loadout must not silently release its optimization constraints.
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

Original specification committed as `a3cdc422`, initial implementation as `48563bfd`. The five-mode shared workspace, canonical routing, editable saved loadouts, physical weapon-copy resolution, character replacement, and investment change-point panel were implemented. The initial account-equipment card and independent next-pull calculation were incorrect interpretations and are removed by the 2026-10-12 correction; the requirements above are authoritative.

Agreed integration contract: `InvestmentPanel` receives `{ teamComp, setupConfig, teamBuild, configs, objectiveCombo, singleObjective, ignoredCharIds? }` and renders no duplicate shared header/roster/skill panel. The workspace supplies the effective shared objective and environment. Ignored combo contributors do not suppress an explicitly selected single-skill objective.

Implemented migrations: local team store 22 -> 23, cloud team envelope 4 -> 5, derived result cache 5 -> 6, session navigation 0 -> 1. Sparse future changes use `{ charId, constellation, formulaId, delta }`; legacy exact count maps retain exact semantics as `legacyCountOverrides`. Divergent old investment setup is retained in inspectable `legacyInputs`, with explicit adopt/reset actions. Shared damage configuration has canonical precedence. Migration tests exercise persisted hydration and cloud adapter boundaries. Persisted comparison/investment results require matching input signatures; obsolete artifact runtime cache fields are removed.

Shortcut reconciliation: on a configured constellation change, rebuild a character's stored default counts only if its aggregate formula/count map exactly matches the old constellation's catalog defaults. Preserve matching reaction settings. Edited/custom count maps remain untouched; the existing explicit Reset combo action remains available. This avoids applying old-constellation defaults after C0/R1 reset without destroying authored rotations or requiring guessed provenance.

Validation: the integrated full suite passed 290 test files, with 9,952 tests passing and 2 skipped. Production build and dependency checks passed. Browser checks covered English and Chinese at 320px, Energy at 768px, and Characters at 1440px. At narrow widths the five local modes use a readable 12px, three-column/two-row selector without outer overflow. Canonical team/mode URLs and the shared input hierarchy were verified. Account equipment search requires a selected weapon for every nonempty roster slot and cannot apply a partial team result.

After the full suite, the final completeness guard and canonical owned-weapon collector passed 17 targeted tests across five files. The current revision then passed production build, repository lint (877 files), and dependency checks (861 modules / 4,469 dependencies). The canonical collector deduplicates equipped/inventory physical IDs before creating comparison refinement candidates.

The preceding validation is historical evidence for the initial implementation, not acceptance of its UI. The 2026-10-12 correction must additionally verify the reused submode controls, settings/action order, compact per-member constellation changes, shared path-derived next-pull results, all-slot character rankings, and visible complete Energy toggle borders on desktop/mobile. No memory entry was found directing the added subtitles. The failure was specification drift plus implementation review focused on functional tests rather than the existing interaction patterns; AGENTS.md now makes these UI contracts explicit.

2026-10-12 correction: `absoluteCountTargets` is additive data for explicit absolute counts at future constellation thresholds. Existing `futureCountChanges`, legacy direct/reaction exact overrides, and exact-per-constellation ER maps retain their meaning. Targets anchor the count at their threshold and preserve subsequent default changes. ER popover edits expand a transition through its next actual value change; edits/deletions do not stop at the next repeated stored key. Versions are local team 23 -> 24, cloud team envelope 5 -> 6, result cache 6 -> 7. Public hydration and cloud roundtrip tests cover the old format and new targets.

Investment's configuration and both result views share one outer card. Next-N previews traverse only already evaluated monotone upgrade nodes from the same path run, retaining different first-choice branches and shorter terminal prefixes. Characters' normal run produces independent rankings for all positions; ownership constrains incoming candidates, while fixed members retain hypothetical configurations. Builds and Characters use generated artifacts. All three calculators reuse the existing submode controls; no native selects, independently invented mode selectors, or unsolicited explanatory subtitles remain in those panels.

Correction acceptance: final frozen-source `npm run check` passed 299 test files (10,042 tests passed, 2 skipped), TypeScript, lint, dependency checks, six tooling tests, and the 72-team artifact regression with zero differences. Production client/worker builds, Worker config/output/safety, four deployment-migration tests, 54 Worker tests, Wrangler dry run, and Python checks passed. The responsive public-workflow E2E passed at 320px and 1280px, with English/Chinese checks and all nine runtime palettes. It checks actual title/combobox bounds and complete inactive/active Energy borders, not merely outer-page overflow. Twenty-seven screenshots were captured; visual review covered English/Chinese phone cards and desktop layouts. Pre-run blank ranking/result panels are hidden; post-run rankings retain their status/error information. Tests also cover all four positions for 1- and 3-member persisted teams, compact prefix-preserving Apply, and cancellation/rejection of stale worker replies after local setting edits.
