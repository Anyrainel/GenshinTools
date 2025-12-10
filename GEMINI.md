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

### Code Quality

- **DRY:** Look for opportunities to genericize components (e.g., generic tooltips in `shared/`).
- **Types:** Strictly define types in `src/data/types.ts`. Avoid `any`.
- **Comments:** **Sparingly.** Explain _why_ a complex logic exists. Do not explain _what_ the code does.

### Common Patterns

- **Localization:** Add new UI strings to `src/data/i18n-app.ts` under the appropriate key.
- **Assets:** Game assets are served from `public/`. Access them via `getAssetUrl()` helper.
- **Icons:** Use `lucide-react`.
