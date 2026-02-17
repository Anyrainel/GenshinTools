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

- `/` — Home (`WideLayout`)
- `/account-data` — tabs: `characters`, `recommendations`, `inventory`, `weights` (`SidebarLayout`)
- `/artifact-filter` — tabs: `configure`, `filters` (`SidebarLayout`)
- `/tier-list` — tabs: `characters`, `weapons` (`WideLayout`)
- `/archive` — tabs: `characters`, `weapons` (`SidebarLayout` / `ScrollLayout`)
- `/team-builder` (`ScrollLayout`)

Navigation config: `src/config/appNavigation.tsx`. Layout shells: `src/components/layout/`.

### Directory Map

- `src/components/{domain}` — Domain UI: `account-data`, `artifact-builds`, `tier-list`, `team-builder`, `archive`
- `src/components/shared` — Cross-domain: `ItemPicker`, `ItemIcon`, `CharacterFilterSidebar`, controls, tooltips
- `src/components/ui` — shadcn/ui primitives + custom widgets (`tour`, `responsive-dialog`, `weighted-select`)
- `src/stores` — One Zustand store per domain (persist to `localStorage`)
- `src/data` — Static JSON resources, `types.ts`, `constants.ts`, localization (`i18n-ui.ts`, `i18n-app.ts`, `i18n-game.ts`)
- `src/lib` — Pure logic: merge algorithms, filter computation, artifact scoring, insight engine, preset system, build utilities
- `src/hooks` — `useResolvedBuilds`, `useAsyncCompute`, `useMediaQuery`, `useGlobalScroll`
- `src/contexts` — `LanguageContext` (EN/ZH), `ThemeContext` (per-element palette via `themeGenerator.ts`)
- `src/presets` — Bundled preset JSONs for artifact builds, character tier lists, weapon tier lists
- `scripts/` — Python ETL (Enka, Hakush.in, HoYoLab, Fandom). Run `update_data.cmd` or `uv run --project scripts/pyproject.toml scripts/<script>.py`
- `docs/` — Design docs, product specs, roadmap

## Data Flow & Build System

1. **Static data** (`src/data/*.json`) is the immutable source of truth for game data.
2. **User data** enters via GOOD Format (JSON), Enka.Network (UID), or preset subscription → persists in `localStorage`.
3. **Preset system**: presets in `src/presets/artifact-builds/` seed the store on subscribe. Local edits overlay as deltas. See `presetRegistry.ts`, `presetLoader.ts`, and the `subscribePreset` action in `useBuildsStore`.
4. **Build resolution**: `useResolvedBuilds` hook merges preset + local data, derives source (`preset` | `modified` | `custom`). Ordering tracked in `characterToBuildIds`.
5. **Merge → Filter pipeline**: `greedyMerge` / `smartMerge` → `computeFilters` → lock/trash scripts. See `src/lib/` for all algorithms.
6. **Zero `any`**: all external data (Import/API) must be typed and validated.

## Commands

- `npm run dev` — Vite + Wrangler dev server (Cloudflare Functions proxy)
- `npm run dev:vite` — Vite only (no Cloudflare Functions)
- `npm run build` / `build:tauri` — Production build (Web / Tauri Desktop)
- `npm run lint` / `lint:fix` — Biome check / auto-fix
- `npm run type-check` — TypeScript check (src + tests tsconfigs)
- `npm run test` / `test:watch` / `test:coverage` — Vitest unit tests
- `npm run test:e2e` / `test:e2e:ui` — Playwright e2e tests

**ALWAYS use `npm run` scripts, NOT raw `npx` invocations.** The project scripts are configured to check both `src` and `tests` tsconfigs, etc.

## Development Rules

### Architecture

- **`SidebarLayout`**: Drawer on mobile, fixed sidebar on desktop (lg+). Standard for pages with filter panels.
- **`AppBar`**: Sticky header. Actions via `ActionConfig[]`; dialog controls use ref forwarding (`useImperativeHandle`).
- **Mobile first**: `Drawer` (vaul) for mobile interactions, `Popover` for desktop. See `ItemPicker.tsx`.

### Styling

- Always use `cn()` to merge styles. Layers: `tailwind.config.ts` → `index.css` → inline.
- `ThemeContext` + `themeGenerator.ts` for per-element color palettes.

### Localization

- **`i18n-ui.ts`**: Static UI strings. **CRITICAL**: `t.ui()` calls MUST use string literals (e.g. `t.ui('common.save')`), never dynamically constructed keys.
- **`i18n-app.ts`**: Dynamic/game terms. **`i18n-game.ts`**: Game entity names.

### Testing

- Unit tests in `tests/` mirror `src/`. Use `@/` path alias.
- Store tests: use `useStore.getState()` to verify state after actions.

### Terminal Hygiene

- Avoid `2>&1` redirection (triggers safety review).
- If redirecting to a file, delete it immediately after reading.
