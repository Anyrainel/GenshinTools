# Navigation Audit

Source of truth today:
- Routes: `src/App.tsx`
- Nav config: `src/components/layout/appNavigation.tsx`
- Tab canonicalization: `src/hooks/useCanonicalTabRoute.ts`

## Current Shape

Top-level groups are broadly right: Account Data, Artifact Filter, Team Comp, Tier List, Archive.

Discovery is now two-layered: the large Home cards orient users by top-level product area, and the compact "Find a tool" matrix below them gives keyword-level entry points to every child view.

Parent routes canonicalize to default children:
- `/account-data` -> `/account-data/characters`
- `/artifact-filter` -> `/artifact-filter/configure`
- `/team-comp` -> `/team-comp/damage`
- `/tier-list` -> `/tier-list/characters`
- `/archive` -> `/archive/characters`

## User Mental Models

- Setup data: import account data, import/build presets, import teams.
- Inspect inventory: characters, weapons, artifacts, ownership, scores.
- Configure build targets: per-character artifact goals and weights.
- Decide artifact actions: evaluate, recommend upgrades/swaps, spend resources, lock/unlock.
- Analyze teams: damage, optimization, frozen builds, investment, weapon/artifact choices.
- Rank character priorities; weapon/artifact tier lists are mostly for fun.
- Look up reference data: character kits, weapon effects, artifact sets, bosses.

## View Inventory

| Route | Role | Needs | Primary result | Navigation notes |
|---|---|---|---|---|
| `/` | Launcher/onboarding | None | Entry to tool groups plus keyword feature matrix | Default cards point to the most important child view for each group; the matrix gives one intent-oriented text link per sub-page. |
| `/account-data/*` | Account shell | Optional account import | Shared account actions, warnings, tab routing | App-bar actions are powerful but can hide mode changes like edit mode. |
| `/account-data/characters` | Inspect account roster | Account data | Character grid with equipped artifacts and scores | Edit is app-bar-only. Score settings affect many downstream views but look local. |
| `/account-data/inventory` | Inspect/maintain inventory | Account data | Character, weapon, artifact inventory sections | Scanner/sync is important upstream data refresh. Delete is hidden behind edit mode and item dialogs. |
| `/account-data/recommendations` | Artifact action planner | Account data plus valid builds | Tiered swap/upgrade recommendations; apply-to-game payload | Depends on Tier List priority, but that is surfaced late. Links to Team Comp Damage exist after results. |
| `/account-data/evaluation` | Build diagnostic dashboard | Account data plus valid builds | Completion scores by character/build/slot | Good "why is this build weak?" page. Should lead to Recommendations, Resources, and Configure Builds. |
| `/account-data/resources` | Resource spending planner | Account data plus valid builds | Craft/reroll/level-up suggestions | Advisory/manual; no apply-to-game flow. Dense settings need clearer policy ownership. |
| `/account-data/triage` | Lock-state workflow | Account data plus valid builds | Lock/unlock/no-change/protected artifact decisions; apply-to-game payload | Strong action lives in header while results are split into secondary categories. |
| `/artifact-filter/*` | Build-config shell | Build data optional | Import/export/clear presets and tab routing | Default preset prompt targets parent route; prefer `/artifact-filter/configure`. |
| `/artifact-filter/configure` | Build target config | Preset/import or local setup | Per-character builds, weapons, weights, set goals | Existing `?char=id` narrows filters but does not scroll/open a target. This is a key upstream page. |
| `/artifact-filter/filters` | Generated filter output | Valid builds | Artifact set/slot filters and print image | Character icons can jump back to Configure, but the navigation affordance is subtle. Search-empty and no-config states can blur together. |
| `/artifact-filter/weights` | Secondary AutoTune workflow | Valid DPS builds plus matching teams | Team-derived build weights applied back to builds | Not a main path yet. Keep discoverable for advanced users, but do not let it dominate navigation. |
| `/team-comp/*` | Team shell | Team data optional | Import/export/clear teams and tab routing | Damage, Investment, and Weapon Choice support `?team=id`; team selection updates URL with replace-style history. |
| `/team-comp/damage` | Team hub and damage detail | Teams; account data for inventory optimization | Team configs, damage results, artifact optimization, frozen outputs | Detail footer links to same-team Investment and Weapon Choice; frozen teams also link to Frozen. |
| `/team-comp/frozen` | Frozen build review/output | Frozen artifacts from Damage; account data for equip flow | Frozen teams/artifacts, batch equip instructions, image export | Empty state links to Team Damage. Operationally downstream from optimization. |
| `/team-comp/investment` | Investment analysis | Selected/configured team | Constellation/refinement/investment rankings | Detail footer links to same-team Damage and Weapon Choice. |
| `/team-comp/weapon` | Weapon/artifact choice analysis | Selected/configured team; account data for artifact mode | Weapon rankings and artifact reassignment suggestions | Detail footer links to same-team Damage and Investment. |
| `/tier-list/*` | Ranking shell | Game data; optional imports/account data | Editable ranking boards and exports | Desktop hides sibling rank boards until entering group. Character tab has list management; others do not. |
| `/tier-list/characters` | Character priorities | Game data; optional account ownership | Character tier assignments | Feeds Recommendations priority. Owned-only depends on Account Data but does not explain that dependency. |
| `/tier-list/weapons` | Recreational ranking | Game data; optional inventory ownership | Weapon tier assignments | Low utility. Do not treat ranks as an input to other workflows. |
| `/tier-list/artifacts` | Recreational ranking | Game data | Artifact set tier assignments by bucket | Low utility. Do not treat ranks as an input to Recommendations, Resources, or Triage. |
| `/archive/*` | Lookup shell | Bundled game data | Search/filter/select reference browser | Pure reference. Embedded builds/account data are convenience affordances while looking up kits, not a major flow. |
| `/archive/characters` | Character lookup | Character stats/kits; optional account/build data | Detail panel with stats, skills, builds/account links | Supports `?character=id`; clicks update URL with replace-style history. |
| `/archive/weapons` | Weapon lookup | Weapon stats/effects; optional ownership | Weapon sections, cards, detail drawer | Tooltip coverage is usually enough; selected-weapon deep links are optional, not a priority. |
| `/archive/artifacts` | Artifact set lookup | Artifact effects | Artifact set cards and half-set filtering | Tooltip coverage is usually enough; selected-set deep links are optional, not a priority. |
| `/archive/bosses` | Boss lookup | Leyline boss data | Schedule/mechanics/resistance detail | Supports `?boss=id`; clicks update URL with replace-style history. Search-empty handling is weak. |

## Workflow Map

Core setup:
1. Import account data.
2. Configure artifact builds.
3. Optionally rank character priorities.
4. Use diagnostics/action views.

Account artifact loop:
`Import Account -> Inventory/Characters -> Configure Builds -> Evaluation -> Recommendations/Resources/Triage -> Apply to Game or manual spending`

Build filter loop:
`Configure Builds -> Compute Filters -> jump back to Configure by character`

Secondary AutoTune loop:
`Configure Builds + Team Comp Damage teams -> AutoTune -> Apply weights -> Compute Filters/Evaluation`

Team optimization loop:
`Team Comp Damage -> Optimize artifacts -> Freeze -> Frozen -> Batch equip/apply`

Team analysis loop:
`Team Comp Damage setup -> Investment or Weapon/Artifact Choice -> return to Damage config`

Reference lookup:
`Archive entity -> inspect bundled details; optionally edit builds/account data in the embedded convenience controls`

## Affordance Gaps

- Prerequisites are mostly taught by empty states. This is usually enough; persistent status should be local and actionable, not a global checkmark banner.
- Cross-view continuation is inconsistent: some empty states link upstream, but normal states often do not expose "continue in..." actions.
- Account Data powers many features, but ownership/account dependency is not consistently labeled near owned-only filters and optimizer controls.
- Artifact build configuration is the shared prerequisite for many Account Data views, but it is not visually treated as a setup dependency.

## Current Home Discovery

Home keeps the large image cards as the primary orientation layer, then adds a compact "Find a tool" matrix below the fold.

- Matrix groups reuse app-bar category names and top-level order: Account Data, Team DMG, Builds, Tier List, Archive.
- Each sub-page has one primary intent-oriented link; labels are user goals, not raw tab names.
- Category groups use subtle background surfaces for structure, while links stay text-first.
- The matrix intentionally starts below the main cards so it improves search/discovery without competing with the visual landing experience.

## Remaining Direction

- Add local prerequisite/status affordances only when they explain a disabled/changed action:
  - Owned-only filter: show account data is driving ownership.
  - Optimizer/apply controls: show inventory/account source age or missing data only near the control.
  - Recommendation/Triage empty states: keep import/build CTAs as the primary prerequisite teaching.
  - Avoid a persistent global banner that merely says data exists.
- Consider contextual continuation links where they are specific and actionable:
  - Evaluation result sections -> Recommendations, Resources, Triage, Configure Builds when the action is directly relevant.
  - Recommendations/Triage -> Inventory source status and Apply to Game
  - Archive Character -> Configure Build or Account Character only as embedded convenience.
  - Boss Archive -> Team Comp Damage only if the future UI has boss-targeted damage context.
- Optional future deep links:
  - `/team-comp/weapon?team=id&mode=weapon|artifact` if Weapon Choice mode should be URL-addressable.
  - `/artifact-filter/configure?char=id&build=id` if current `char=id` targeting should open/scroll a specific card/build rather than only filter.
