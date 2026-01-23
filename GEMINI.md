# Genshin Tools - Project Context

## Overview

This is a **React + TypeScript + Vite** application using **Tailwind CSS** and **shadcn/ui**. It provides utilities for Genshin Impact players (Artifact Filter, Tier List Maker, Team Builder).

- **Desktop App:** Wrapped with **Tauri** (`src-tauri/`) for offline capability.
- **Data Pipeline:** Python scripts (`scripts/`) fetch and preprocess game data using `uv` for dependency management.
- **Web Deployment:** Hosted on **Cloudflare Pages**.

## Project Structure

### Core Domains

The application is divided into distinct functional domains, each with its own state store and component subdirectory:

- **Account Data** (`src/components/account-data`): Logic for imported GOOD/Enka data, inventory management, and artifact scoring.
- **Tier Lists** (`src/components/tier-list`): Logic for Character and Weapon tier lists, including drag-and-drop grids and customization dialogs.
- **Artifact Filter** (`src/components/artifact-filter`): The rule engine for generating lock/trash scripts.
- **Team Builder** (`src/components/team-builder`): Create and manage team compositions.

### Application Pages

| Page | Route | Purpose | Layout |
|------|-------|---------|--------|
| `Home` | `/` | Landing page with navigation cards | `WideLayout` |
| `ArtifactFilter` | `/artifact-filter` | Configure builds, compute lock/trash filters | `SidebarLayout` |
| `AccountData` | `/account-data` | Import GOOD/Enka data, view characters | `SidebarLayout` |
| `TierList` | `/tier-list` | Character tier list with drag-drop | `WideLayout` |
| `WeaponTierList` | `/weapon-tier-list` | Weapon tier list with rarity filters | `WideLayout` |

### Key Directories

- **`src/components/layout`**: Core layout shells (`SidebarLayout`, `AppBar`, `WideLayout`).
- **`src/components/ui`**: Reusable shadcn/ui primitives.
- **`src/components/shared`**: Common domain components (e.g., `ItemPicker`, `ToolHeader`, `Control`s).
- **`src/stores`**: Zustand state management. **One store per domain** (e.g., `useAccountStore`, `useTierStore`).
- **`src/data`**: Static data resources (Characters/Weapons/Artifacts JSON), types (`types.ts`), and localization (`i18n-app.ts`).
- **`scripts/`**: Python ETL scripts for fetching game data.

## Data Flow Philosophy

1. **Static Data Rule**: The frontend treats `src/data/*.json` as the immutable source of truth for Game Data.
2. **User Data Rule**: User data (Artifacts, Tier Lists) enters via **GOOD Format** (JSON import) or Enka API, and persists in `localStorage`.
3. **ZERO `any` Policy**: All data crossing the boundary (Network/File -> App) must be typed and validated.

## Workflows & Commands

### Development

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (Web) |
| `npm run build:tauri` | Production build (Tauri Desktop) |
| `npm run preview` | Preview production build |
| `npm run lint` | Check lint + format (Biome) |
| `npm run lint:fix` | Auto-fix lint + format |
| `npm run type-check` | TypeScript check (src + tests) |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

### Deployment (Cloudflare Pages)

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node Version:** Latest LTS (managed by Cloudflare or `.nvmrc`)

### Data Updates

Data ingestion logic resides in `scripts/`.

- **Full Update:** Run `update_data.cmd` (Windows) to fetch and process all data.
- **Single Script:** Use `uv`:
  ```bash
  uv run --project scripts/pyproject.toml scripts/codedump.py
  ```

## Development Guidelines

### 1. Architecture & Layouts

- **`SidebarLayout`**: The standard layout for tools requires filters. Uses a `Sheet` (Drawer) on mobile and a fixed sidebar on desktop (lg+).
- **`AppBar`**: Sticky header for all pages. Handles navigation and page-specific actions.
  - **Actions Pattern**: Pass `ActionConfig[]` to `AppBar`.
  - **Dialog Controls**: For actions that open dialogs (Import/Export), use **Ref forwarding** (`useImperativeHandle`).
    - Example: `<ImportControl ref={importRef} ... />` then call `importRef.current.open()`.
- **Responsive Design**:
  - **Mobile First**: Use `Hidden` utilities or `lg:block` to differentiate mobile/desktop layouts.
  - **Drawers vs Popovers**: Use `Drawer` (via `vaul`) for complex interactions on mobile, and `Popover` on desktop. See `ItemPicker.tsx` for the canonical example.

### 2. Styling Strategy

- **Design System (`src/lib/styles.ts`)**:
  - **`THEME` / `STYLES`**: Import these constants for standardized tokens.
  - **Tokens**: `THEME.rarity.bg[5]`, `THEME.layout.page`, `THEME.grid.cards`.
  - **Elements**: `THEME.element.text['Pyro']`.
- **Utility**: Always use `cn()` to merge `THEME` styles with overrides.
- **Layers**: `tailwind.config.ts` (base) > `index.css` (globals) > `styles.ts` (tokens) > inline (one-offs).

### 3. Component Patterns

- **`ItemPicker`**: The universal picker for Characters, Weapons, and Artifacts.
  - Supports "4pc" and "2pc+2pc" artifact selection modes.
  - Adapts display (Grid vs List) based on type.
- **Controls**: `ImportControl`, `ExportControl`, `ClearAllControl` are standardized.
  - Use `variant="tier-list"` vs `variant="default"` to switch specific i18n label sets.
- **`ItemIcon`**: The canonical way to render Game Items with correct rarity backgrounds.
- **Tooltips**: Essential for Game Items. Use `CharacterTooltip`, `WeaponTooltip`, etc. extensions.

### 4. Code Quality Standards

- **Zero `any`**: All external data (Import/API) must be validated.
- **Localization**: UI text in `i18n-app.ts`. Game terms via helpers.
- **Performance**: High-cardinality lists key by ID. Use `memo` for expensive list items (like `TierTable` cells).

### 5. Testing

Tests use **Vitest** with **React Testing Library**.

- **Structure**: Tests live in `tests/` mirroring `src/`.
- **Path Aliases**: Use `@/` in tests.
- **Store Testing**: Store tests require `useStore.getState()` to verify state changes after actions.
