# Genshin Tools — Codex Context

## Project Snapshot

React 19 + TypeScript 7 + Vite 8 app for Genshin Impact player tools, using Node 24 LTS. UI uses Tailwind CSS 4, shadcn/ui, radix-ui primitives, Vaul drawers, Lucide icons, and Sonner toasts. State is Zustand 5 with Immer and persist middleware. Cloudflare Workers use `worker/`, `dist/`, and Wrangler for deployment.

## Related Repositories

Use this map to select the repository before searching code. Related checkouts
are siblings; paths below are relative to the GenshinTools repository root.

| Repository | Local path | Purpose and routing hints |
| --- | --- | --- |
| GenshinTools | `.` | Genshin Impact website: account imports, artifact scoring/triage, build filters, team damage/optimization, and game archive. |
| HoyoData | `../HoyoData` | Shared Genshin Impact and Honkai: Star Rail data producer: datamine ingestion, normalization, reference exports, website catalogs/assets, and scanner mappings. Start here for upstream data/export pipeline changes; `genshintools` and `ggstarrail` targets refresh the respective websites. |
| GOODScanner (product name: GGScanner) | `../GOODScanner` | Windows scanner/capture/management app for both games: OCR, packet capture, account JSON exports, and in-game artifact/relic management. The local checkout retains the GOODScanner name. |
| GGStarRail | `../GGStarRail` | Honkai: Star Rail website: account imports, relic scoring/triage, build targets/filters, resource planning, tier lists, and game/achievement archive. Start here for Star Rail website behavior and UI. |

For cross-repository work, read the target repository's `AGENTS.md` and relevant
documentation before editing. Search the selected repository first; broaden only
when the task crosses a producer/consumer boundary or ownership remains unclear.

## Common Commands

- `npm run dev` — Vite dev server
- `npm run build` — production web build
- `npm run lint` / `npm run lint:fix` — Biome check / auto-fix
- `npm run type-check` — TypeScript check for app and tests
- `npm run check` — complete app, regression, architecture and Worker validation
- `npm run depcheck` — dependency boundary rules via dependency-cruiser
- `npm run test` / `npm run test:watch` / `npm run test:coverage` — Vitest
- `npm run regtest` — artifact generator golden-file regression test
- `npm run data:refresh` — delegates to HoyoData's `genshintools` target for all released source data, website catalogs/assets, character metadata, Enka stat IDs, GOODScanner mappings, and coverage checks. HoyoData must be beside this checkout, or pass `-- --hoyodata-root <path>`. `-- --cached-sources` exports cached raw data and rebuilds with cached website catalogs/artwork; beta scraping and damage/energy implementation work remain separate.

## Production Deployment

- Production is auto-deployed after pushing to GitHub. For normal prod pushes, validate locally, push the intended commit to `origin/main`, and let the GitHub/Cloudflare deployment pipeline publish it.
- Do not run manual production deploy commands such as `wrangler deploy` or `npm run deploy:worker` unless the user explicitly asks for a manual Cloudflare deploy.

## Page Map

Use this as the first routing hint when the user refers to a page or tab in natural language. Navigation is defined in `src/config/navigation.tsx`.

- Home (`/`) — `src/pages/home/HomePage.tsx`: app entry page with tool cards and onboarding links.

- Account Data (`/account-data`) — `src/pages/game-account/AccountDataPage.tsx`: account import/export shell and tab router.
  - Characters (`/account-data/characters`) — `src/pages/game-account/CharacterView.tsx`: imported character roster, ownership filters, edit mode, and artifact score display.
  - Inventory (`/account-data/inventory`) — `src/pages/game-account/InventoryView.tsx`: imported weapons/artifacts inventory browsing, scanner entry, and edit/delete flows.
  - Recommendations (`/account-data/recommendations`) — `src/pages/game-account/ScoreUpView.tsx`: artifact upgrade recommendations from account data, build configs, and scoring thresholds.
  - Evaluation (`/account-data/evaluation`) — `src/pages/game-account/EvaluationView.tsx`: build completion evaluation for owned characters against configured artifact builds.
  - Resources (`/account-data/resources`) — `src/pages/game-account/ResourceView.tsx`: resource spending suggestions for craft, reroll, and artifact level-up actions.
  - Triage (`/account-data/triage`) — `src/pages/game-account/TriageView.tsx`: artifact keep/lock/fodder triage using account data, build configs, and triage settings.

- Artifact Filter (`/artifact-filter`) — `src/pages/builds/BuildsPage.tsx`: artifact build import/export shell and tab router.
  - Configure (`/artifact-filter/configure`) — `src/pages/builds/CharacterBuildView.tsx`: per-character artifact build target configuration.
  - Compute Filters (`/artifact-filter/filters`) — `src/pages/builds/ArtifactBuildsView.tsx`: computed artifact set/slot filters from configured character builds.
  - AutoTune (`/artifact-filter/weights`) — `src/pages/builds/AutoTuneView.tsx`: team-aware AutoTune workflow for deriving weighted artifact formulas.

- Team Comp (`/team-comp`) — `src/pages/teams/TeamAnalysisPage.tsx`: team import/export shell and tab router.
  - Analysis (/team-comp/analysis) — src/pages/teams/AnalysisView.tsx: damage, investment, weapon choice and optimization workspace.
  - Loadouts (/team-comp/loadouts) — src/pages/teams/FrozenView.tsx: saved artifact/team loadouts and batch equip export.

- Tier List (`/tier-list`) — `src/pages/tier-list/TierListPage.tsx`: tier list import/export shell and tab router.
  - Characters (`/tier-list/characters`) — `src/pages/tier-list/CharacterTierListView.tsx`: editable character tier table with filters, presets, export, and customization.
  - Weapons (`/tier-list/weapons`) — `src/pages/tier-list/WeaponTierListView.tsx`: editable weapon tier table with weapon filters, presets, export, and customization.

- Archive (`/archive`) — `src/pages/archive/ArchivePage.tsx`: game data archive shell and tab router.
  - Characters (`/archive/characters`) — `src/pages/archive/CharacterArchiveView.tsx`: searchable character archive with filters and detail panel.
  - Weapons (`/archive/weapons`) — `src/pages/archive/WeaponArchiveView.tsx`: searchable weapon archive with type/rarity/stat filters.
  - Artifacts (`/archive/artifacts`) — `src/pages/archive/ArtifactArchiveView.tsx`: artifact set archive with half-set filtering and expandable rows.
  - Bosses (`/archive/bosses`) — `src/pages/archive/BossArchiveView.tsx`: ley line boss archive with search, schedule-aware default selection, and detail panel.

## Repository architecture

The authoritative target layout and dependency rules are in
[docs/architecture.md](docs/architecture.md). That document supersedes older
general folder descriptions. Read it before reorganizing modules.

## Skills And Domain References

- For Genshin game data, formulas, damage implementations, or calculator review, use the `genshin-knowledge` skill first.
- For damage, energy, or gcsim batch work, use the dispatcher skills under `.agents/skills/`; they launch Codex `worker` subagents that read `.agents/agents/*.md`.
- When a new or changed character, weapon, artifact, or resonance grants CRIT Rate, update `src/domain/game-account/maxCrBuff.ts` and its tests so score-up recommendations use the same CR budget.
- For persisted stores, imports, conversions, or artifact mutation flows, inspect the relevant store, migration code, and nearby tests before editing.

## UI Rules

For new surfaces or substantial UI redesigns, read [docs/frontend-design.md](docs/frontend-design.md). It contains the compact reuse, copy and visual acceptance rules; explicit edits should follow the user's instruction and the existing pattern.

### Shared UI Entry Points

| Need | Source of truth |
| --- | --- |
| Theme colors and surfaces | `src/index.css`, `src/lib/theme/generator.ts`: use `bg-background`, `text-foreground`, `bg-primary`, `bg-gradient-card`, `bg-gradient-select` |
| Dynamic element, rarity, Tier and status classes | `src/components/shared/colors.ts`: `getElementColor(element, "text")`, `getRarityColor(rarity, "gradient")`, `getTierColor(tier, "header")`; compose with `cn()` |
| Raw colors for charts/canvas and game palettes | `src/config/gameColors.ts`, `src/lib/game/colors.ts`; edit color values in the palette, then run `npm run styles:generate` |
| Item identity and filter controls | `src/components/shared/ItemIcon.tsx`, `CharAvatar.tsx`, `FilterChip.tsx`, `FilterChipGroup.tsx` |
| Page structure | `src/components/layout/{PageLayout,SidebarLayout,WideLayout,ScrollLayout,SidebarDetailLayout}.tsx`; inspect a sibling page before creating a scroll shell |
| Responsive dialogs | `src/components/ui/responsive-dialog.tsx`; inspect its callers and `src/components/shared/ItemPicker.tsx` |

- Use complete literal Tailwind classes or the typed helpers; never interpolate color class names (such as `text-element-${element}`).
- `getRarityColor(rarity, "bg")` is a solid background; `"gradient"` is the item portrait/tooltip gradient. Keep these separate.
- `bg-item-badge`, `text-item-badge-foreground`, `bg-item-level` and `text-item-level-foreground` are item chrome tokens; use `ItemIcon` to compose them.
- UI invariant tests reject new literal colors, interpolated color utilities, and opacity on `text-muted-foreground` / `border-border` in components and pages (including adjacent CSS). Existing debt is capped by exact file/rule/fragment counts in `tests/fixtures/ui-invariants-baseline.json`; remove entries when fixing debt, never expand it to make a new violation pass. Dedicated chart palettes belong in the color definition module.

- Use `cn()` from `src/lib/utils.ts` to merge Tailwind classes.
- Do not concatenate class strings manually when conditional classes are involved.
- Never use opacity on `text-muted-foreground` or `border-border`; use `text-muted-foreground`, `border-border` directly. Use them only when avoiding user attention (they are unnoticeable in current themes).
- Use helper colors where applicable: `getRarityColor`, `getElementColor`, `getTierColor`.
- Always wrap image paths with `getAssetUrl(path)`.
- The app has 9 runtime theme palettes via `ThemeContext` and `themeGenerator.ts`; avoid hardcoded visual colors in UI.
- For mobile/desktop dialog variants, prefer the existing Drawer/Popover/Dialog pattern used by `ItemPicker.tsx`.

## File conventions

- No re-export from other modules. Caller must import from source of truth.
- `constants.ts` must only `export const`. `types.ts` must only `export type` or `export interface`. `utils.ts` must only `export function`.
- Make extra effort to keep the codebase clean and avoid dependency mess (models in wrong places), overly-encompassing objects (models too big) or spaghetti code (models too small).

## i18n

- `src/i18n/messages.ts`: static UI strings. `t.ui()` calls must use string literals, never constructed keys.
- `src/i18n/gameTerms.ts`: dynamic app terms and enum labels.
- `src/generated/translations/i18n-game.ts`: generated game entity names.
- UI strings should read like player-facing product text, not developer notes.
- Chinese text must use natural community wording and official/game-appropriate names. Do not translate game concepts literally from English.

## Error Handling

Match the failure shape to what the caller can do with it:
- Throw for invalid internal invariants, corrupted bundled/generated data, or impossible states. These should fail loudly during development instead of forcing every caller to handle them.
- Return `null` only for expected absence or infeasible outcomes that are already normal in the domain, such as optional lookups or solver misses.
- Use domain-specific unions/results when the caller needs to branch on known failure modes and continue safely, especially for imports, parsing, validation, network fetches, and batch operations.
- Preserve partial-success patterns where they exist, such as returning converted data plus warnings for import/conversion flows.
- In UI actions and async flows, report user-visible failures with the local toast, dialog, or empty-state pattern near the call site. Do not swallow failures silently.

Do not introduce a repo-wide generic `Result<T>` abstraction. Prefer domain-specific result types that encode the actual recovery states.

## Store And Data Migrations

When changing persisted data shape **or meaning**:
0. If smooth migration is not possible, discuss options before implementing.
1. Document the old shape at the migration site as comments.
2. Always version the store data, but avoid multiple local version bumps for the same push.
3. Migrate from the current origin version; merge with any existing local migration bump. If default values changed, don't add migration to force the old default value.
4. Always add migration test for the old format, ensure all shapes of valid data can be migrated.
5. Treat unchanged fields with new semantics as schema changes too. This includes renamed or repurposed IDs, count/unit changes, enum meaning changes, and defaults copied into saved user data.
6. Apply the same versioned transform to every persistence boundary that carries the data (local stores, imports/exports, and cloud snapshots), and invalidate derived caches that cannot be reconciled safely.
7. Test from a realistic pre-change persisted fixture through the public hydration/import path; tests that create only fresh current-state data do not cover migration.

For non-store refactors, migrate callers to one clean import/implementation path; do not add re-export compatibility shims for internal code.
Must clean up old types and code paths, with one exception: the store migration (logic + old schema) should live under src/stores/migration/.

## Testing

- When running expensive tests or benchmarks with long output, redirect output to a file under `test-results/`, inspect that file, then remove it.
- Unit tests in `tests/` mirror `src/` and use the `@/` alias.

## Multi-Agent And Git Safety

Multiple agents may share the same workspace.
- Treat unexpected pending or staged files as someone else's work.
- Never use destructive cleanup commands such as `stash`, `reset --hard`, `restore`, or `checkout --` unless explicitly asked.
- Preserving pending work is more important than perfect commit boundaries.
- Do not use partial staging to isolate your changes in a file; pre-commit checks and concurrent agents make it unsafe.

Commit proactively without being asked: once a self-contained change scope is complete and validated, stage the files you touched and commit. Leaving finished work pending makes it harder for concurrent agents to tell your changes from theirs. Pushing stays opt-in — `origin/main` auto-deploys production, so only push when asked.

## File Safety

- Do not run destructive scripts directly on source files.
- For bulk transformations, write to `.new` or `.tmp`, inspect the diff, then replace.
- Before risky bulk edits, back up the target file.
- Test regex transformations with a dry run before applying.

Husky is installed by npm prepare. Commits gate types, architecture and relevant tests. Pushes run npm run check against a clean, unchanged HEAD; do not bypass failing hooks.
