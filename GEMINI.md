# Genshin Tools - Project Context

## Overview

This is a **React + TypeScript + Vite** application using **Tailwind CSS** and **shadcn/ui**. It provides utilities for Genshin Impact players (Artifact Filter, Tier List Maker, Team Builder).

- **Desktop App:** Wrapped with **Tauri** (`src-tauri/`) for offline capability.
- **Data Pipeline:** Python scripts (`scripts/`) fetch and preprocess game data using `uv` for dependency management.

## Key Directories

- `src/components/ui`: Reusable shadcn/ui primitives.
- `src/components/shared`: Common domain components (e.g., `ItemPicker`, `CharacterTooltip`).
- `src/constants/theme.ts`: **Centralized style constants** (colors, layouts, picker styles). **Use this.**
- `src/stores`: Zustand state management with persistence.
- `src/data`: Static data resources, types, and localization (`i18n-app.ts`).
- `scripts/`: Python ETL scripts.

## Workflows & Commands

### Development

- **Frontend:** `npm run dev`
- **Tauri App:** `npm run tauri dev`
- **Linting:** `npm run lint`

### Data Updates

Data ingestion logic resides in `scripts/`.

- **Full Update:** Run `update_data.cmd` (Windows) to fetch and process all data.
- **Single Script:** Use `uv`:
  ```bash
  uv run --project scripts/pyproject.toml scripts/codedump.py
  ```

## Development Guidelines

### Styling

- **Utility:** **ALWAYS** use `cn()` from `@/lib/utils` to merge Tailwind classes.
- **Theming:** Define reusable Tailwind class strings in `src/lib/theme.ts`. Avoid magic strings for complex, repeated UI elements.
- **Layers:** `tailwind.config.ts` > `src/index.css` > `theme.ts` > Component inline classes.
- **Consistency:** Follow existing layout patterns (e.g., specific gaps, border weights, and hover effects like `cursor-help` for tooltips).

### Code Quality

- **DRY:** Abstract reusable logic and UI into `src/components/shared/` or domain-specific subdirectories (e.g., `src/components/account-data/`).
- **Types:** Strictly define types in `src/data/types.ts` or local type files (e.g., `goodTypes.ts`). **AVOID `any`**; use `unknown` and type guards/assertions if dealing with raw external JSON.
- **Comments:** **Sparingly.** Explain _why_ a complex logic exists. Do not explain _what_ the code does.

### Common Patterns

- **Page Structure:** Every main tool page starts with a `ToolHeader`.
- **Standard Actions:** Use standardized control components inside `ToolHeader` actions:
  - `ImportControl`: For JSON/GOOD data imports.
  - `ExportControl`: For data exports.
  - `ClearAllControl`: For resetting state.
- **Item Icons:** Always use the `ItemIcon` component for characters, weapons, and artifacts. It standardizes rarity backgrounds, shapes, and corner labels (C#/R#).
- **Tooltips:** Almost all game items should provide hover tooltips using `CharacterTooltip`, `WeaponTooltip`, or `ArtifactTooltip`.
- **Localization:** **NO HARDCODED STRINGS.** All UI text must be in `src/data/i18n-app.ts` and accessed via `t.ui()`. Game data names should use `t.character()`, `t.weaponName()`, `t.artifact()`, etc.
- **Assets:** Game assets are served from `public/`. Access them via `getAssetUrl()` helper.
- **Icons:** Use `lucide-react`.
