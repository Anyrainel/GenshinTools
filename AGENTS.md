# Genshin Tools - Project Context

## Overview

**React 19 + TypeScript + Vite 7** app using **Tailwind CSS 3** and **shadcn/ui**. Provides utilities for Genshin Impact players: Artifact Filter, Tier List Maker, Account Analytics, Team Builder, and Archive.

- **UI**: shadcn/ui, Radix primitives, Vaul (drawers)
- **State**: Zustand 5 (Immer + persist middleware)
- **Desktop**: Tauri 2 (`src-tauri/`)
- **Edge**: Cloudflare Workers (`functions/api/`, Wrangler)
- **Quality**: Biome (lint/format), Husky + lint-staged
- **Testing**: Vitest 4 + React Testing Library, Playwright (`e2e/`)
- **Data Pipeline**: Python scripts (`scripts/`) with `uv`

Hosted on **Cloudflare Pages** (`npm run build` → `dist/`).

## Project Structure

### Pages & Routes

- `/` — Home
- `/account-data` — tabs: `characters`, `recommendations`, `inventory`, `evaluation`
- `/artifact-filter` — tabs: `configure`, `filters`
- `/tier-list` — tabs: `characters`, `weapons`
- `/archive` — tabs: `characters`, `weapons`, `artifacts`
- `/team-comp`

Navigation config: `src/config/appNavigation.tsx`. Layout shells: `src/components/layout/`.

### Directory Map

- `src/components/{domain}` — Domain UI: `account-data`, `artifact-builds`, `tier-list`, `team-comp`, `archive`
- `src/components/shared` — Cross-domain: `ItemPicker`, `ItemIcon`, `CharacterFilterSidebar`, controls, tooltips
- `src/components/ui` — shadcn/ui primitives + custom widgets (`tour`, `responsive-dialog`, `weighted-select`)
- `src/stores` — One Zustand store per domain (persist to `localStorage`)
- `src/data` — Static JSON resources, `types.ts`, `constants.ts`, localization (`i18n-ui.ts`, `i18n-app.ts`, `i18n-game.ts`)
- `src/lib` — Pure logic: merge algorithms, filter computation, artifact scoring, build evaluation, insight engine, preset system, build utilities, damage calculation (`team-comp/`)
- `src/hooks` — `useResolvedBuilds`, `useAsyncCompute`, `useMediaQuery`, `useGlobalScroll`
- `src/contexts` — `LanguageContext` (EN/ZH), `ThemeContext` (per-element palette via `themeGenerator.ts`)
- `src/presets` — Bundled preset JSONs for artifact builds, character tier lists, weapon tier lists
- `scripts/` — Python ETL (Enka, Hakush.in, HoYoLab, Fandom). Run `update_data.cmd` or `uv run --project scripts/pyproject.toml scripts/<script>.py`
- `docs/` — Design docs, product specs, roadmap

## Data Flow & Build System

1. **Static data** (`src/data/*.json`) is the immutable source of truth for game data.
2. **User data** enters via GOOD Format (JSON), Enka.Network (UID), or preset subscription → persists in `localStorage`.
3. **Preset system**: presets in `src/presets/artifact-builds/` serve as the **Immutable Base**. They DO NOT exist in `useBuildsStore` directly.
4. **Build Store (`useBuildsStore`)**: Contains **ONLY** User Overrides, Custom Builds, and Ordering (`characterToBuildIds`). It is a Delta Store. **DO NOT** read `builds` directly from the store for scoring!
5. **Build Resolution**: `useResolvedBuilds` (single char) / `useAllResolvedBuilds` (all chars) are the **Single Source of Truth**. They merge the `Preset Base` + `Store Deltas` to produce the effective `Build[]`.
   - **Rule**: Always use these hooks to get builds. Never traverse `useBuildsStore.builds` or `presetRegistry` manually.
6. **Merge → Filter pipeline**: `greedyMerge` / `smartMerge` → `computeFilters` → lock/trash scripts. See `src/lib/` for all algorithms.
7. **Zero `any`**: all external data (Import/API) must be typed and validated.

## Build Evaluation & Insight Engine (Account Data)

The `src/lib/account-data/` module powers the evaluation and recommendation tabs:

1. **Build Evaluation** (`buildEvaluation.ts`): Per-character build assessment — archetype classification (DPS/Support), scaling stat detection, slot completion tracking, and efficiency tier ratings (S/A/B/C/F).
2. **Insight Engine** (`insightEngine.ts`): Generates actionable recommendations using strategies: EQUIP (empty slot), SWAP (better artifact found), UPGRADE (level existing), REROLL (elixir/reroll), FARM (weakest slot), FIX_MAIN (wrong main stat). Each insight includes score differential and efficiency projections.

## Damage Calculation (Team Comp)

The `src/lib/team-comp/` module implements a full damage calculation pipeline:

1. **Character implementations** (`impl/`): Per-character formula definitions, buff providers, and talent scalings.
2. **Damage models** (`damageModels.ts`): Zone-based damage calculation (Base DMG, DMG Bonus, CRIT, RES, DEF, Elevate/Reaction).
3. **Buff system** (`damageBuffs.ts`): Stackable team-wide and character-specific buffs with source tracking.
4. **Optimizer** (`optimizer.ts`): Artifact assignment optimizer that maximizes total team damage.
5. **Stat resolution**: Idle → Combat stat pipeline with weapon, artifact, ascension, and buff contributions.

## Cloudflare Functions (CORS Proxy)

The `functions/` directory contains Cloudflare Pages Functions that run on the edge. Currently used as a CORS proxy for the Enka.Network API:

- **Route**: `functions/api/enka/[[path]].ts` — catch-all handler that proxies `/api/enka/*` → `https://enka.network/api/*`
- **Purpose**: Bypass CORS restrictions when fetching player data from Enka.Network
- **Frontend caller**: `src/lib/account-data/enkaFetcher.ts` — calls `fetch("/api/enka/uid/<uid>")` when running on Cloudflare Pages (ggartifact.com, *.pages.dev) or localhost:8788 (Wrangler). Falls back to `corsproxy.io` on other hosts (e.g. GitHub Pages).
- **Dev**: `npm run dev` starts Vite + Wrangler together so Functions are available locally on port 8788. `npm run dev:vite` skips Wrangler (Functions unavailable, fallback proxy used).

## Commands

- `npm run dev` — Vite + Wrangler dev server (Cloudflare Functions proxy)
- `npm run dev:vite` — Vite only (no Cloudflare Functions)
- `npm run build` / `build:tauri` — Production build (Web / Tauri Desktop)
- `npm run lint` / `lint:fix` — Biome check / auto-fix
- `npm run type-check` — TypeScript check (src + tests tsconfigs)
- `npm run test` / `test:watch` / `test:coverage` — Vitest unit tests
- `npm run test:e2e` / `test:e2e:ui` — Playwright e2e tests

### Safe & Piped Variants (Agent Use)
You must use these to avoid explicit pipe (`|`) or redirect (`2>&1`) in the terminal:
- `npm run type-check:head` / `lint:head` / `test:head` — Limits output to first 20 lines (avoids spam). Pass `-- N` to change (e.g. `npm run test:head -- 100`).
- `npm run type-check:tail` / `lint:tail` / `test:tail` — Shows only the last 20 lines (error summaries). Pass `-- N` to change.
- `npm run type-check:headtail` / `lint:headtail` / `test:headtail` — First 15 + last 15 lines (skips middle). Pass `-- N` to change.
- `npm run type-check:filter -- "Error"` / `lint:filter -- "Pattern"` / `test:filter -- "Pattern"` — Greps output for pattern.
  - Example: `npm run type-check:filter -- "character5.ts"` to find errors in a specific file.

## Development Rules

### Architecture

- **`SidebarLayout`**: Drawer on mobile, fixed sidebar on desktop (lg+). Standard for pages with filter panels.
- **`AppBar`**: Sticky header. Actions via `ActionConfig[]`; dialog controls use ref forwarding (`useImperativeHandle`).
- **Mobile first**: `Drawer` (vaul) for mobile interactions, `Popover` for desktop. See `ItemPicker.tsx`.

### Styling

- Always use `cn()` to merge styles. Layers: `tailwind.config.ts` → `index.css` → inline.
- `ThemeContext` + `themeGenerator.ts` for 9 color palettes.

### Localization

- **`i18n-ui.ts`**: Static UI strings. **CRITICAL**: `t.ui()` calls MUST use string literals (e.g. `t.ui('common.save')`), never dynamically constructed keys. I18n test will ensure all i18n-ui labels are referenced by code.
- **`i18n-app.ts`**: Dynamic terms, meant to be consumed via custom hooks on `t`, usually for labels of enum concepts. No tests.
- **`i18n-game.ts`**: Game entity names, auto-generated by scrapers.

### Testing

- Unit tests in `tests/` mirror `src/`. Use `@/` path alias.
- Store tests: use `useStore.getState()` to verify state after actions.

### Terminal Hygiene

- Avoid `|` pipe and `2>&1` / `>` redirection (triggers safety review).
- Never inline Python/JS code in terminal commands (e.g. python -c "..." or node -e "..."). Write a temporary .py/.js fil under temp/, run it, then delete it. Consider all side effects and failure modes, avoid dangerous actions and defer to user decision.

### File Safety

- **Never run destructive scripts (regex replace, refactor, migration) directly on source files.** Always write output to a `.new` or `.tmp` copy first, diff/inspect the result, and only then replace the original.
- Before any bulk file transformation, make a backup copy of the target file.
- Test regex patterns with dry-run (print matches only) before applying replacements.
