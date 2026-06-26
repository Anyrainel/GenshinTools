# Genshin Tools — Codex Context

## Project Snapshot

React 19 + TypeScript + Vite 7 app for Genshin Impact player tools. UI uses Tailwind CSS 3, shadcn/ui, Radix primitives, Vaul drawers, Lucide icons, and Sonner toasts. State is Zustand 5 with Immer and persist middleware. Cloudflare Workers use `worker/`, `dist/`, and Wrangler for deployment.

## Common Commands

- `npm run dev` — Vite dev server
- `npm run dev:vite` — Vite only
- `npm run build` — production web build
- `npm run lint` / `npm run lint:fix` — Biome check / auto-fix
- `npm run type-check` — TypeScript check for app and tests
- `npm run depcheck` — dependency boundary rules via dependency-cruiser
- `npm run test` / `npm run test:watch` / `npm run test:coverage` — Vitest
- `npm run regtest` — artifact generator golden-file regression test

## Production Deployment

- Production is auto-deployed after pushing to GitHub. For normal prod pushes, validate locally, push the intended commit to `origin/master`, and let the GitHub/Cloudflare deployment pipeline publish it.
- Do not run manual production deploy commands such as `wrangler deploy` or `npm run deploy:worker` unless the user explicitly asks for a manual Cloudflare deploy.

## Page Map

Use this as the first routing hint when the user refers to a page or tab in natural language. Navigation is defined in `src/components/layout/appNavigation.tsx`.

- Home (`/`) — `src/pages/Home.tsx`: app entry page with tool cards and onboarding links.

- Account Data (`/account-data`) — `src/pages/AccountData.tsx`: account import/export shell and tab router.
  - Characters (`/account-data/characters`) — `src/pages/account-data/CharacterView.tsx`: imported character roster, ownership filters, edit mode, and artifact score display.
  - Inventory (`/account-data/inventory`) — `src/pages/account-data/InventoryView.tsx`: imported weapons/artifacts inventory browsing, scanner entry, and edit/delete flows.
  - Recommendations (`/account-data/recommendations`) — `src/pages/account-data/RecommendationView.tsx`: artifact upgrade recommendations from account data, build configs, and scoring thresholds.
  - Evaluation (`/account-data/evaluation`) — `src/pages/account-data/EvaluationView.tsx`: build completion evaluation for owned characters against configured artifact builds.
  - Resources (`/account-data/resources`) — `src/pages/account-data/ResourceView.tsx`: resource spending suggestions for craft, reroll, and artifact level-up actions.
  - Triage (`/account-data/triage`) — `src/pages/account-data/TriageView.tsx`: artifact keep/lock/fodder triage using account data, build configs, and triage settings.

- Artifact Filter (`/artifact-filter`) — `src/pages/ArtifactBuilds.tsx`: artifact build import/export shell and tab router.
  - Configure (`/artifact-filter/configure`) — `src/pages/artifact-builds/CharacterBuildView.tsx`: per-character artifact build target configuration.
  - Compute Filters (`/artifact-filter/filters`) — `src/pages/artifact-builds/ArtifactBuildsView.tsx`: computed artifact set/slot filters from configured character builds.
  - AutoTune (`/artifact-filter/weights`) — `src/pages/artifact-builds/AutoTuneView.tsx`: team-aware AutoTune workflow for deriving weighted artifact formulas.

- Team Comp (`/team-comp`) — `src/pages/TeamComp.tsx`: team import/export shell and tab router.
  - Damage (`/team-comp/damage`) — `src/pages/team-comp/DamageView.tsx`: team grid plus selected-team damage detail calculator.
  - Frozen (`/team-comp/frozen`) — `src/pages/team-comp/FrozenView.tsx`: frozen artifacts/teams review and batch equip export.
  - Investment (`/team-comp/investment`) — `src/pages/team-comp/InvestmentView.tsx`: selected-team investment comparison/detail workflow.
  - Weapon Choice (`/team-comp/weapon`) — `src/pages/team-comp/WeaponChoiceView.tsx`: selected-team weapon comparison/detail workflow.

- Tier List (`/tier-list`) — `src/pages/TierList.tsx`: tier list import/export shell and tab router.
  - Characters (`/tier-list/characters`) — `src/pages/tier-list/CharacterTierListView.tsx`: editable character tier table with filters, presets, export, and customization.
  - Weapons (`/tier-list/weapons`) — `src/pages/tier-list/WeaponTierListView.tsx`: editable weapon tier table with weapon filters, presets, export, and customization.

- Archive (`/archive`) — `src/pages/Archive.tsx`: game data archive shell and tab router.
  - Characters (`/archive/characters`) — `src/pages/archive/CharacterArchiveView.tsx`: searchable character archive with filters and detail panel.
  - Weapons (`/archive/weapons`) — `src/pages/archive/WeaponArchiveView.tsx`: searchable weapon archive with type/rarity/stat filters.
  - Artifacts (`/archive/artifacts`) — `src/pages/archive/ArtifactArchiveView.tsx`: artifact set archive with half-set filtering and expandable rows.
  - Bosses (`/archive/bosses`) — `src/pages/archive/BossArchiveView.tsx`: ley line boss archive with search, schedule-aware default selection, and detail panel.

## Important Locations

- `src/components/{domain}/` — domain UI components
- `src/components/shared/` — reusable cross-domain UI
- `src/components/layout/` — page/layout shells
- `src/stores/` — persisted Zustand stores
- `src/data/` — static data, generated game data, localization files, shared types
- `src/lib/{domain}/` — domain-specific pure logic; avoid putting cross-cutting primitives here unless they truly belong to that domain
- `src/lib/artifact/` — shared artifact calculations and utilities, including basic scoring logic
- `src/lib/dmgcalc/` — comprehensive damage calculation engine and game entity implementations
- `src/lib/ercalc/` — event-based energy system emulation and ER calculation
- `scripts/` — Python/TypeScript data and audit tooling; Python scripts run with `uv`
- `docs/` — design notes, domain docs, trackers, and product specs

## Skills And Domain References

- For Genshin game data, formulas, damage implementations, or calculator review, use the `genshin-knowledge` skill first.
- For damage, energy, or gcsim batch work, use the dispatcher skills under `.agents/skills/`; they launch Codex `worker` subagents that read `.agents/agents/*.md`.
- For persisted stores, imports, conversions, or artifact mutation flows, inspect the relevant store, migration code, and nearby tests before editing.

## UI Rules

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

- `src/data/i18n-ui.ts`: static UI strings. `t.ui()` calls must use string literals, never constructed keys.
- `src/data/i18n-app.ts`: dynamic app terms and enum labels.
- `src/data/i18n-game.ts`: generated game entity names.
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

When changing persisted store shape:
0. If smooth migration is not possible, discuss options before implementing.
1. Document the old shape at the migration site as comments.
2. Always version the store data, but avoid multiple local version bumps for the same push.
3. Migrate from the current origin version; merge with any existing local migration bump. If default values changed, don't add migration to force the old default value.
4. Always add migration test for the old format, ensure all shapes of valid data can be migrated.

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

## File Safety

- Do not run destructive scripts directly on source files.
- For bulk transformations, write to `.new` or `.tmp`, inspect the diff, then replace.
- Before risky bulk edits, back up the target file.
- Test regex transformations with a dry run before applying.
