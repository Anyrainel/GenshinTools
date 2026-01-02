# Genshin Tools - Project Context

## Overview

This is a **React + TypeScript + Vite** application using **Tailwind CSS** and **shadcn/ui**. It provides utilities for Genshin Impact players (Artifact Filter, Tier List Maker, Team Builder).

- **Desktop App:** Wrapped with **Tauri** (`src-tauri/`) for offline capability.
- **Data Pipeline:** Python scripts (`scripts/`) fetch and preprocess game data using `uv` for dependency management.

## Project Structure

### Core Domains

The application is divided into distinct functional domains, each with its own state store and component subdirectory:

- **Account Data** (`src/components/account-data`): Logic for imported GOOD/Enka data, inventory management, and artifact scoring.
- **Tier Lists** (`src/components/tier-list`): Logic for Character and Weapon tier lists, including drag-and-drop grids and customization dialogs.
- **Artifact Filter** (`src/components/artifact-filter`): The rule engine for generating lock/trash scripts.

### Key Directories

- `src/components/ui`: Reusable shadcn/ui primitives.
- `src/components/shared`: Common domain components (e.g., `ItemPicker`, `CharacterTooltip`).
- `src/lib/theme.ts`: **Centralized style constants** (Tokens & Slots). **Use this for all complex styles.**
- `src/stores`: Zustand state management. **One store per domain** (e.g., `useAccountStore`, `useTierStore`).
- `src/data`: Static data resources (Characters/Weapons/Artifacts JSON), types (`types.ts`), and localization (`i18n-app.ts`).
- `scripts/`: Python ETL scripts for fetching game data.

## Data Flow Philosophy

1. **Static Data Rule**: The frontend treats `src/data/*.json` as the immutable source of truth for Game Data.
2. **User Data Rule**: User data (Artifacts, Tier Lists) enters via **GOOD Format** (JSON import) or Enka API, and persists in `localStorage`.
3. **ZERO `any` Policy**: All data crossing the boundary (Network/File -> App) must be typed and validated.

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

### Development Guidelines

#### 1. Architecture & State

- **State vs Props**: Use local state for UI (dialog open/close). Use **Zustand** stores for domain data that persists (Tier Lists, Account Data).
- **Persistence**: Domain stores use `persist` middleware to save to `localStorage`.
- **Logic Separation**:
  - **Components**: Rendering only.
  - **`src/lib`**: Pure functions for complex logic (math, data conversion, parsing). E.g., `artifactScore.ts` should be testable without React.
  - **`src/hooks`**: Reusable UI behaviors (scroll, toast).

#### 2. Styling Strategy

- **Tokens & Slots**: logic resides in `src/lib/theme.ts`.
  - **Tokens**: `THEME.rarity.bg[5]`
  - **Slots**: `THEME.characterCard.container` (multi-class strings)
- **Utility**: Always use `cn()` to merge `THEME` styles with overrides.
- **Layers**: `tailwind.config.ts` (base) > `index.css` (globals) > `theme.ts` (components) > inline (one-offs).

#### 3. Code Quality Standards

- **Zero `any`**: All external data (Enka API, JSON imports) must be validated. Use `src/data/types.ts`.
- **Localization**: UI text belongs in `i18n-app.ts`. Game terms (names) belong in `i18n-game.ts` (handled via helpers).
- **Performance**: High-cardinality lists (Tier Tables, Inventory) key by ID. Avoid deep object comparisons in `useEffect` dependencies.

#### 4. Common Patterns

- **ToolHeader**: Every tool page has a header with `ImportControl` / `ExportControl` / `ClearAllControl`.
- **ItemIcon**: The canonical way to render Character/Weapon/Artifact icons with correct rarity backgrounds.
- **Tooltips**: Essential for Game Items. Use `CharacterTooltip` etc. wrapper components.
- **Assets**: Use `getAssetUrl(path)` helper. Never hardcode `/assets/` paths.
