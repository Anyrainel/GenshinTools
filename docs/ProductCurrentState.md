# GG Artifact – Product Current State

> **Document Purpose:** This document provides a comprehensive overview of the current state of GG Artifact (ggartifact.com), a suite of tools for Genshin Impact players. It is intended to serve as a foundation for product ideation and future roadmap planning.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [Pages & Features](#3-pages--features)
   - [Home](#31-home)
   - [Account Data](#32-account-data)
   - [Artifact Filter](#33-artifact-filter)
   - [Character Tier List](#34-character-tier-list)
   - [Weapon Tier List](#35-weapon-tier-list)
   - [Team Builder](#36-team-builder)
4. [Cross-Cutting Capabilities](#4-cross-cutting-capabilities)
5. [Data & Persistence](#5-data--persistence)
6. [Distribution Channels](#6-distribution-channels)

---

## 1. Product Overview

**GG Artifact** is a free, community-focused web application that helps Genshin Impact players:

- **Optimize artifact management** through customizable filter configurations
- **Analyze account progress** with automated artifact scoring
- **Rank characters and weapons** using interactive tier list makers
- **Plan team compositions** in a visual workspace

The application is designed to be **language-agnostic** (English & Chinese), **mobile-responsive**, and **works entirely client-side** (no backend server required). User data persists in browser local storage.

### Value Proposition

| User Need | How GG Artifact Addresses It |
|-----------|------------------------------|
| "I have too many artifacts to manage" | Generates optimized lock/trash filter configurations |
| "How good are my character builds?" | Provides quantitative artifact scoring with weight customization |
| "Which characters should I build next?" | Interactive tier lists with drag-and-drop prioritization |
| "I need to plan my team compositions" | Visual team builder with smart filtering |

---

## 2. User Personas

### Primary Persona: The Artifact Optimizer
- **Goals:** Efficiently manage artifact inventory, knows which artifacts to keep/trash
- **Pain Points:** In-game artifact management is tedious; afraid of accidentally trashing good pieces
- **Key Features Used:** Artifact Filter, Account Data (especially artifact scoring)

### Secondary Persona: The Roster Manager
- **Goals:** Track progression across many characters, prioritize who to build next
- **Pain Points:** No in-game way to rank or compare character investments
- **Key Features Used:** Character Tier List, Account Data Summary View

### Tertiary Persona: The Theory Crafter
- **Goals:** Plan team compositions, compare weapon options
- **Pain Points:** Need to reference external resources, no central planning tool
- **Key Features Used:** Team Builder, Weapon Tier List

---

## 3. Pages & Features

### 3.1 Home

**Purpose:** Landing page that introduces all available tools and guides users to relevant features.

**Layout:** A hero section with app branding, followed by feature rows that highlight each tool with:
- A problem statement (e.g., "How good are my builds?")
- A brief guideline explaining the solution
- A call-to-action button linking to the tool

**Current Tools Displayed (in order):**
1. Account Data
2. Artifact Filter
3. Character Tier List
4. Weapon Tier List
5. Team Builder

**Visual Treatment:**
- Each feature row has a unique background image from Genshin Impact
- Premium design with gradient overlays, golden accents, and hover animations
- Mobile-responsive layout that stacks content vertically

---

### 3.2 Account Data

**Purpose:** Import, visualize, and analyze account data including characters, weapons, and artifacts.

**Entry Points:**
- Home page feature link
- Global navigation

**Data Sources:**
- **GOOD Format Import:** JSON file exported from scanning tools (Irminsul, Inventory Kamera)
- **Enka Network API:** Direct import via player UID (limited to showcase characters)

**Sub-Views (Tabs):**

#### 3.2.1 Characters Tab
- Displays all imported characters in a filterable grid
- Each **Character Card** shows:
  - Character portrait with constellation badge
  - Level and ascension status
  - Talent levels (Normal Attack, Skill, Burst)
  - Equipped weapon with level/refinement
  - Equipped artifact sets (supports both 4pc and 2pc+2pc displays)
  - Per-artifact stats display
  - **Artifact Score** with hover card showing detailed breakdown

**Filtering Capabilities:**
- By Element (Pyro, Hydro, Cryo, etc.)
- By Weapon Type (Sword, Claymore, Polearm, Bow, Catalyst)
- By Region (Mondstadt, Liyue, Inazuma, Sumeru, Fontaine, Natlan, Snezhnaya)
- By Rarity (4★, 5★)
- Sorting by Tier (if tier list configured) or Release Date

#### 3.2.2 Summary Tab
- **At-a-glance view** of all characters organized by tier
- Shows character icon, artifact set icons, and total artifact score
- Characters sorted by score within each tier
- Quickly identifies highest/lowest scoring builds

#### 3.2.3 Inventory Tab
- **Weapons Section:**
  - Grouped by "Max Level" vs "Other"
  - Shows weapon icon, name, level, refinement, and secondary stat
  - Count badge if duplicates exist
- **Artifacts Section:**
  - Grouped by "Max Level" (Lv.20) vs "Other"
  - Shows artifact icon, set name, slot, main stat, and substats
  - Collapsible sections for managing large inventories

#### 3.2.4 Stat Weights Tab
- Configure **artifact scoring weights** for each character
- **Global Settings:**
  - Punishment factor for flat stats (HP, ATK, DEF)
- **Per-Character Weights Table:**
  - Columns: ATK%, HP%, DEF%, CR, CD, EM, ER, Elemental DMG%, Healing%
  - Each cell is a 0-100 slider/input
  - Search to filter characters
  - Warning indicator if weight configuration is invalid

**Scoring Algorithm:**
- Score = Stat Value × Normalization Factor × (Weight / 100) × Punishment Factor
- Normalization converts all stats to "Critical Damage equivalent"
- In-app explainer dialog documents the full formula

**Actions:**
- **Import:** Open import dialog
- **Clear:** Remove all account data

---

### 3.3 Artifact Filter

**Purpose:** Configure desired artifact builds for characters and generate optimized filter configurations for use in-game (via scanner tools).

**Sub-Views (Tabs):**

#### 3.3.1 Configure Builds Tab

**Layout:** Virtualized list of all game characters, each with:
- Character icon and name
- Visibility toggle (can hide characters from filter computation)
- List of configured builds

**Build Card Features:**
- **Artifact Set Selection:**
  - 4-piece set picker (single set)
  - 2+2 piece set picker (two different sets with same bonus effect)
- **Main Stat Requirements per Slot:**
  - Sands: ATK%, HP%, DEF%, EM, ER
  - Goblet: ATK%, HP%, DEF%, Elemental DMG%, Physical DMG%
  - Circlet: ATK%, HP%, DEF%, CR, CD, Healing%, EM
- **Substat Requirements:**
  - Select up to 4 desired substats
  - Specify minimum roll count (e.g., "at least 2 of CR/CD")

**Build Management:**
- Add new builds per character
- Duplicate existing builds
- Delete builds
- Visual completion indicator (checkmark when build is fully configured)

**Filtering:**
- Same filter sidebar as Account Data (Element, Weapon, Region, Rarity, Tier sorting)

#### 3.3.2 Compute Filters Tab

**Purpose:** View the merged/optimized artifact filter configurations.

**Display:**
- Organized by artifact set
- For each set, shows aggregated filter rules:
  - Which main stats to accept per slot
  - Which substats to look for
  - Which characters need this set (for reference)
  - Pass chance indicator (warns if filter is too permissive)

**Compute Options:**
- **Skip Dual-Crit Builds:** Exclude builds requiring both CR and CD
- **Expand Elemental Goblets:** Treat any element% as any element%
- **Expand Crit Circlets:** In 4pc builds, treat CR or CD as both
- **Merge Single-Flex Variants:** Combine similar configurations
- **Find Common Subsets:** Identify shared requirements across builds

**Actions:**
- **Download as Image:** Export current view as PNG for sharing
- **Search:** Filter displayed sets by name

**Overall Page Actions:**
- **Import:** Load builds from preset or local file
- **Export:** Save current builds to JSON file (with author/description metadata)
- **Clear:** Remove all build configurations

---

### 3.4 Character Tier List

**Purpose:** Create and share custom character tier lists.

**Layout:**
- **Header:** Title (customizable) + action buttons
- **Tier Grid:** Rows for each tier (S, A, B, C, D) with characters
- **Pool Area:** Unranked characters grouped by element

**Interaction Model:**
- **Drag and Drop:** Move characters between tiers and pool
- Characters within each tier are grouped by element
- Smooth animations and visual feedback during drag

**Customization Dialog:**
- Rename tier list title
- Rename individual tiers (e.g., "S" → "Must Pull")
- Hide tiers entirely

**Display Options:**
- **Show Weapon Types:** Overlay weapon type icon on character portraits
- **Show Travelers:** Include/exclude Traveler variants

**Actions:**
- **Import:** Load tier list from preset or local file
- **Export:** Save tier list to JSON file
- **Clear:** Reset to empty state
- **Download as Image:** Export tier list as high-quality PNG

---

### 3.5 Weapon Tier List

**Purpose:** Rank weapons within their type categories.

**Layout:** Same tier grid structure as Character Tier List, but with:
- Weapons grouped by weapon type (Sword, Claymore, etc.)
- Weapon icons show rarity background

**Filtering Options:**
- **By Rarity:** 5★, 4★, 3★ toggles
- **By Secondary Stat:** Filter to specific substats (CR, CD, ATK%, EM, ER, etc.)

**Actions:** Same as Character Tier List (Import, Export, Clear, Download Image)

---

### 3.6 Team Builder

**Purpose:** Visual workspace for planning team compositions.

**Layout:** Responsive grid of Team Cards

**Team Card Structure:**
- **Header Row:** Team number, editable name, copy/delete buttons
- **Grid Layout (4 columns):**
  - Row 1: Element icons for selected characters
  - Row 2: Character pickers (4 slots)
  - Row 3: Weapon pickers (4 slots, filtered by character's weapon type)
  - Row 4: Artifact set pickers (4 slots, supports both 4pc and 2+2pc)

**Smart Features:**
- Weapon picker auto-filters to compatible weapon types
- Clearing a character also clears their weapon and artifact
- Ghost/placeholder card always available to add new teams

**Actions:**
- **Copy Team:** Duplicate an existing team composition
- **Delete Team:** Remove a team (with confirmation on mobile)

---

## 4. Cross-Cutting Capabilities

### 4.1 Internationalization (i18n)

- **Supported Languages:** English, Chinese (Simplified)
- **Coverage:** All UI text, game terminology (character names, stats, etc.)
- **Implementation:** Client-side translation with language context

### 4.2 Theming

- **Available Themes:** 10+ themes inspired by Genshin regions
  - Abyss (default dark), Dusk, Mondstadt, Liyue, Inazuma, Sumeru, Fontaine, Natlan, Snezhnaya, Nod-Krai
- **Dynamic Generation:** Theme colors computed from base HSL values
- **Rarity Colors:** Consistent 3★/4★/5★ backgrounds across all themes

### 4.3 Responsive Design

- **Breakpoints:** Mobile-first with adaptations at sm/md/lg/xl
- **Mobile Optimizations:**
  - Sheet/drawer dialogs instead of popovers
  - Compact item icons and reduced spacing
  - Touch-friendly drag-and-drop
  - Collapsible sidebars

### 4.4 Universal Item Picker

A reusable picker component used throughout the app for:
- Characters (with element/weapon filters)
- Weapons (with type/rarity filters)
- Artifacts (with 4pc and 2pc+2pc modes)

Features:
- Search by name
- Filter chips for quick filtering
- Tooltip previews
- Responsive sizing

### 4.5 Import/Export Pattern

Consistent across all major features:
- **Import:** From built-in presets or local JSON file
- **Export:** To JSON file with author/description metadata
- **Clear:** Reset with confirmation dialog

### 4.6 Image Export

Available for:
- Character Tier List
- Weapon Tier List
- Artifact Filter (Compute view)

Features:
- High-resolution PNG output
- Date-stamped filenames
- Loading indicator during generation

---

## 5. Data & Persistence

### 5.1 Storage Strategy

| Data Type | Storage | Persistence |
|-----------|---------|-------------|
| Account Data (characters, artifacts) | localStorage | Until cleared |
| Build Configurations | localStorage | Versioned, persisted |
| Tier List Assignments | localStorage | Persisted |
| Stat Weight Configs | localStorage | Persisted |
| Team Compositions | localStorage | Persisted |
| UI Preferences (theme, language) | localStorage | Persisted |

### 5.2 Data Import/Export

- **GOOD Format:** Industry-standard JSON schema for Genshin data interchange
- **Enka Network:** API-based import using player UID
- **Custom JSON Formats:** For builds, tier lists, and configurations

### 5.3 Static Game Data

- Characters, Weapons, Artifacts sourced from data mining
- Images served from CDN or local assets
- Updated via Python scripts in `scripts/` directory

---

## 6. Distribution Channels

### 6.1 Web Application
- **URL:** https://ggartifact.com
- **Hosting:** Cloudflare Pages
- **PWA Support:** Not currently implemented

### 6.2 Desktop Application
- **Technology:** Tauri (Rust-based wrapper)
- **Platform:** Windows (primary)
- **Benefits:** Offline capability, native performance
- **Distribution:** Manual download (no auto-update currently)

---

## Document Revision

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-23 | Product Team | Initial comprehensive documentation |
| 1.1 | 2026-01-23 | Product Team | Removed gaps section (moved to PRODUCT_ROADMAP.md), updated Team Builder to reflect 2+2pc support |

---

*This document is intended for internal product planning. For user-facing documentation, please refer to the README files.*
