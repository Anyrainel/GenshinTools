# Project Specification: GenshinTools

## 1. Vision & Purpose

**GenshinTools** is a specialized suite of utilities designed for advanced _Genshin Impact_ players who require granular control over their game data.

The project exists to solve specific high-complexity problems that generic tools often overlook:

- **Deep Account Analytics**: Players need to visualize their progress holistically. This includes importing data from external sources (GOOD/Enka), analyzing inventory distribution, and evaluating artifacts against rigorous, mathematical standards.
- **Structured Meta-Game Management**: Content creators need tools to organize characters and weapons into persistent, elementally-sorted structures, moving beyond simple static images.
- **Offline Theorycrafting**: A "dry-dock" environment for experimenting with team compositions and loadouts without the constraints of the running game client.

### Core Philosophy

1.  **User-Centric Complexity**: We do not shy away from complex features (e.g., mathematical artifact scoring). We assume the user is knowledgeable and wants power.
2.  **Privacy & Offline-First**: Data handling is local. We use Tauri to wrap the application, ensuring that users' imported account data never leaves their machine unless they explicitly export it.
3.  **Visual Excellence**: The tool should feel like a premium extension of the game itself—immersive, high-contrast, and responsive.

---

## 2. Technical Architecture

The architecture is designed for **maintainability**, **type safety**, and **static data integrity**.

### 2.1 Technology Stack

- **Frontend Core**: React + TypeScript + Vite.
- **Styling**: Tailwind CSS + shadcn/ui.
- **Desktop Wrapper**: Tauri (Rust) for offline capabilities and file system access.
- **State Management**: Zustand (with distinct stores per domain module).
- **Data Pipeline**: Python (ETL scripts) -> Static JSON.

### 2.2 Data Flow

The application operates on a **Static Data** model.

- **Ingestion**: Game data (characters, weapons, artifacts) is fetched and processed by Python scripts in `scripts/`.
- **Consumption**: The frontend consumes these processed JSON files as read-only sources of truth.
- **User Data**: User configurations (tier lists, artifact builds) are stored in `localStorage` via Zustand persistence or explicit file save/load (JSON).

### 2.3 Type Safety

We enforce a strict **Zero `any` Policy**.

- All external data shapes must be typed in `src/data/types.ts`.
- Runtime data (e.g., imported JSON) must be validated or cast with type guards before use.

---

## 3. Design System

Review the codebase's styling philosophy to maintain visual consistency.

### 3.1 Centralized Theme (`theme.ts`)

To avoid "Tailwind Soup" and inconsistent UI states, we use a centralized **Tokens & Slots** approach.

- **Tokens**: Semantic colors like `THEME.rarity.bg[5]` (5-star background) or `THEME.element.text.Pyro`.
- **Slots**: Complex component styles are defined as multi-class strings in `src/lib/theme.ts` (e.g., `THEME.picker.itemWrapper`).

**Developers must**:

- Prefer `THEME` constants over raw utility strings for repeated UI elements.
- Use the `cn()` utility to merge `THEME` styles with context-specific overrides.

### 3.2 Visual Language

- **High Contrast**: Dark mode by default (`bg-gray-900`).
- **Game Fidelity**: Use official-style assets and colors (rarity colors, element colors) to match the game's aesthetic.
- **Interactive**: Hover states, transitions, and "clicky" feedback are mandatory for interactive elements.

---

## 4. Domain Concepts

### 4.1 Artifact Filtering

**Problem**: Generic "Score = Crit Rate x 2 + Crit DMG" is insufficient for healers, shielders, or complex scalers (e.g., Def-scaling Geo units).
**Solution**:

- **Weighted Scoring**: We implement a "Build" system where users define weights for _every_ stat.
- **Intelligent Merging**: The system calculates the union of all desired stats across all active builds to generate a minimal set of lock/trash rules.

### 4.2 Account Data Management

**Problem**: Players have disparate data sources (in-game, scanners, external sites like Enka.Network).
**Solution**:

- **Unified Data Model**: We internalize the **GOOD (Genshin Open Object Description)** format as the canonical data structure.
- **Import Strategy**:
  - **File Import**: native GOOD JSON files from scanners.
  - **UID Import**: Fetches public showcase data via Enka.Network API and converts it to GOOD format, preserving existing "extra" artifacts/weapons not currently on showcased characters.
- **Visualization**:
  - **Summary View**: A dashboard combining **Tier List** logic with **Artifact Scoring**. It answers: "Do my S-Tier characters have good builds?"
  - **inventory/Weights**: Deep dives into raw data and scoring configurations.

### 4.3 Tier Lists (Character & Weapon)

**Problem**: Standard tier list makers are unstructured images. Weapon tier lists specifically suffer from "too many items" clutter.
**Solution**:

- **Structured Data**: The tier list is a data structure, not a canvas.
  - **Characters**: Filtered/Sorted by **Element**.
  - **Weapons**: Filtered/Sorted by **Secondary Stat** (e.g., CRIT Rate, EM) and **Rarity**.
- **Stateful**: Draggable items are moved between data buckets (`S`, `A`, `Pool`), triggering re-renders.
- **Persistence**: User lists are saved to `localStorage` and can be exported as JSON or rendered to PNG.

### 4.4 Team Builder

**Problem**: Text-based team notes are hard to visualize.
**Solution**:

- **Card-Based Metaphor**: Teams are collections of 4 "Character Cards", each containing "Weapon Cards" and "Artifact Set Cards".
- **Contextual Pickers**: When selecting a weapon for "Raiden Shogun", the picker should prioritize Polearms.

---

## 5. Developer Workflow

### 5.1 Adding Features

1.  **Define Data**: Does this need new static data? Update `scripts/` and run the update command.
2.  **Define State**: Create a new slice in `src/stores/` if the feature has independent global state.
3.  **UI Construction**: Assemble the view using `src/components/shared` primitives and `THEME` tokens.
4.  **Localization**: Add all user-facing strings to `i18n-app.ts`. **No hardcoded text.**

### 5.2 Code Standards

- **Component File Structure**: `Component.tsx` should focus on rendering. Complex logic (e.g., math) belongs in `hooks/` or `utils/`.
- **Comments**: Explain _Why_, not _What_. (e.g., "Use 0.33 coefficient because the game rounds down internal values").

---
