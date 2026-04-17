# Genshin Tools — Agent Context

## Overview

**React 19 + TypeScript + Vite 7** app using **Tailwind CSS 3** and **shadcn/ui**. Provides utilities for Genshin Impact players: Account Data, Artifact Filter, Tier List, Archive, and Team Comp.

- **UI**: shadcn/ui, Radix primitives, Vaul (drawers), Lucide icons, Sonner (toasts)
- **State**: Zustand 5 (Immer + persist middleware)
- **Desktop**: Tauri 2 (`src-tauri/`)
- **Edge**: Cloudflare Workers (`functions/api/`, Wrangler)
- **Quality**: Biome (lint/format), Husky + lint-staged
- **Testing**: Vitest 4 + React Testing Library, Playwright (`e2e/`)
- **Data Pipeline**: Python scripts (`scripts/`) with `uv`

Hosted on **Cloudflare Pages** (`npm run build` → `dist/`).

---

## Commands

- `npm run dev` — Vite + Wrangler dev server (Cloudflare Functions proxy)
- `npm run dev:vite` — Vite only (no Cloudflare Functions)
- `npm run build` / `build:tauri` — Production build (Web / Tauri Desktop)
- `npm run lint` / `lint:fix` — Biome check / auto-fix
- `npm run type-check` — TypeScript check (src + tests tsconfigs)
- `npm run test` / `test:watch` / `test:coverage` — Vitest unit tests
- `npm run test:e2e` / `test:e2e:ui` — Playwright e2e tests

### Safe Variants (use these instead of piping)

- `npm run type-check:head` / `lint:head` / `test:head` — First 20 lines. Pass `-- N` to change.
- `npm run type-check:tail` / `lint:tail` / `test:tail` — Last 20 lines.
- `npm run type-check:headtail` / `lint:headtail` / `test:headtail` — First 15 + last 15.
- `npm run type-check:filter -- "Error"` / `lint:filter` / `test:filter` — Grep output.

---

## Styling Rules

- Use `cn()` (from `lib/utils.ts`) to merge Tailwind classes. Never concatenate class strings manually.
- **NEVER** use opacity on `text-muted-foreground` (e.g., `text-muted-foreground/50`). It's already muted — opacity makes text unreadable. Same for `border-muted-foreground/` — use `border-border` or `border-muted-foreground` without opacity.
- Use `text-muted-foreground` only for text that is not important and most users can skip.
- Color helpers: `getRarityColor(rarity, "bg"|"text")`, `getElementColor(element, "bg"|"text")`, `getTierColor(tier, "bg"|"text")`.
- Asset URLs: always use `getAssetUrl(path)` for images (handles Vite BASE_URL for GitHub Pages).
- Theme: 9 palettes via `ThemeContext` + `themeGenerator.ts`. CSS variables applied at runtime.

---

## Responsive Patterns

- **Mobile first**: Design for small screens, add desktop breakpoints.
- **Mobile ↔ Desktop dialogs**: Use `Drawer` (vaul) for mobile, `Popover`/`Dialog` for desktop. See `ItemPicker.tsx` for the canonical pattern.
- Many components accept `compact?: boolean` for mobile optimization.
- Use `useMediaQuery()` hook for responsive logic.
- `SidebarLayout` handles mobile (Sheet trigger) vs desktop (fixed sidebar) automatically.

---

## Project Structure

- `src/pages/` — Route-level page components (Home, AccountData, ArtifactBuilds, TierList, Archive, TeamComp)
- `src/components/{domain}/` — Domain UI: `account-data`, `artifact-builds`, `tier-list`, `team-comp`, `archive`
- `src/components/shared/` — Cross-domain reusable components (see `docs/agent-ui-components.md`)
- `src/components/ui/` — shadcn/ui primitives + custom widgets (`tour`, `responsive-dialog`, `weighted-select`)
- `src/components/layout/` — Layout shells (PageLayout, AppBar, SidebarLayout, etc.)
- `src/stores/` — One Zustand store per domain (persist to `localStorage`)
- `src/data/` — Static JSON resources, `types.ts`, `constants.ts`, localization files
- `src/lib/` — Pure logic: filter computation, artifact scoring, damage calculation (`team-comp/`), build evaluation, insight engine
- `src/hooks/` — `useResolvedBuilds`, `useAsyncCompute`, `useMediaQuery`, `useGlobalScroll`
- `src/contexts/` — `LanguageContext` (EN/ZH), `ThemeContext` (9-palette via `themeGenerator.ts`)
- `src/presets/` — Bundled preset JSONs for artifact builds, character tier lists, weapon tier lists
- `src/config/` — Navigation config (`appNavigation.tsx`), character info
- `scripts/` — Python ETL (Enka, Hakush.in, HoYoLab, Fandom). Run `update_data.cmd` or `uv run --project scripts/pyproject.toml scripts/<script>.py`
- `docs/` — Design docs, product specs, roadmap

### Pages & Tabs

Navigation config: `src/config/appNavigation.tsx`.

| Route | Page | Tabs |
|-------|------|------|
| `/` | Home | — |
| `/account-data` | Account Data | Characters, Recommendations, Inventory, Evaluation, Triage |
| `/artifact-filter` | Artifact Filter | Configure, Compute Filters, AutoTune |
| `/tier-list` | Tier List | Characters, Weapons |
| `/archive` | Archive | Characters, Weapons, Artifacts, Bosses |
| `/team-comp` | Team Comp | — (detail view via internal state) |

---

## Domain References

- **Reusable UI Components** → `docs/agent-ui-components.md` — Read before building any UI.
- **Data Flow & Domain Systems** → `docs/agent-domains.md` — Build evaluation, damage calc, data flow architecture.
- **Data Mutation Map** → `docs/data-mutation-map.md` — Read before modifying any store, data import path, or artifact operation.

---

## i18n

- **`i18n-ui.ts`**: Static UI strings. **CRITICAL**: `t.ui()` calls MUST use string literals (e.g., `t.ui('common.save')`), never dynamically constructed keys. I18n tests enforce this.
- **`i18n-app.ts`**: Dynamic terms via custom hooks on `t`, for enum concept labels. No tests.
- **`i18n-game.ts`**: Game entity names, auto-generated by scrapers.
- **Usage**: `const { t } = useLanguage()` → `t.ui("key")`, `t.character("id")`, `t.weaponEffect("id")`.

### i18n Writing Rules

- **Write for real players, not developers.** Every string must read naturally to a Genshin player.
- **Chinese must be real Chinese, not abbreviated code-speak.** "等待" not "等", "长按E" not "长E", "持续产球" not "周E". Abbreviations are fine only when they're actual player community shorthand (e.g. 普攻, 重击, 下落).
- **English must be real words.** "Hold E" not "hE", "Wait" not "W", "Plunge" not "PA". Use Genshin's official English terminology when it exists (Normal Attack, Charged Attack, Elemental Skill, Elemental Burst).
- **Space-constrained labels** (e.g. timeline action blocks) can use shorter forms but must still be recognizable: "Hold E", "Tick E", "NA", "CA" are acceptable. Single-letter gibberish is not.
- **Inline i18n** (`language === "zh" ? "中文" : "English"`) is acceptable for small isolated features, but prefer adding entries to `i18n-ui.ts` for strings that appear in multiple places or are part of a larger feature.

---

## Error Handling Conventions

Library code (`src/lib/`) follows these patterns by domain:
- **Unrecoverable / data structure invalid** → `throw new Error("descriptive message")`. Caught at UI boundary with `toast.error()`.
- **Entity not found / infeasible** → `return null`. Caller checks before use. Used in solvers, constraint checkers, optional lookups.
- **Partial success (import/conversion)** → Return `{ data, warnings: ConversionWarning[] }`. Caller shows warning count toast, continues with partial data.
- **Stateful errors with context** → Discriminated union (e.g. `{ solved: T } | { error: string }`). Caller pattern-matches on discriminant.

Do NOT introduce a generic `Result<T>` type. The above patterns are sufficient for each domain.

---

## Store Refactor Rules

When a new feature requires incompatible changes to a store's data structure:
1. **Document the old shape** in code comments at the migration site — the old data structure is no longer visible in the codebase, so without comments the migration code looks like it's coding against imagined interfaces.
2. Always add proper migration logic with respect to the current origin version (treat pending changes and local-only commits as the same version).
3. Version the store data so there is an easier way to check for migration logic.
4. Add a migration test to ensure old format can migrate to the new format.

When smooth auto-migration isn't possible, discuss options with the user before proceeding.

---

## Multi-Agent Environment

Multiple agents may be working on this repo concurrently, sharing the same working tree and terminal. Key implications:
- Files you didn't touch may appear staged or modified — that's another agent working, not a bug.
- **Never** use destructive git commands (stash, reset --hard, restore, checkout --) that would wipe uncommitted work.
- Race conditions on commits are acceptable — if extra files get pulled into your commit, that's fine. Losing pending work is never acceptable.
- Don't use partial staging to isolate your files — pre-commit checks don't work with stash, and other agents may stage files between your commands.

---

## Commit Rules

- When blocked by type errors or trivial test errors, even if unrelated, fix them so the commit can succeed. For complex problems, pause and ask the user.
- All work goes to master branch unless specified. The beta branch is for local testing of unreleased characters/weapons, not for application features.

---

## Testing Rules

- When running tests (npm run test, vitest or benchmark.ts), do not repeatedly run expensive full suites with grep. Instead, direct output to a file under `test-results/` and check the file content.
- **Clean up `test-results/` files** once you no longer need to read them — don't pile up CLI output.
- Unit tests in `tests/` mirror `src/`. Use `@/` path alias.
- Store tests: use `useStore.getState()` to verify state after actions.

---

## Terminal & File Safety

- Avoid `|` pipe and `2>&1` / `>` redirection (triggers safety review). Use the safe command variants above.
- Never inline Python/JS code in terminal commands. Write a temporary file under `temp/`, run it, then delete it.
- **Never run destructive scripts directly on source files.** Write output to `.new` or `.tmp` first, diff/inspect, then replace.
- Before bulk file transformations, back up the target file.
- Test regex patterns with dry-run (print matches only) before applying.
