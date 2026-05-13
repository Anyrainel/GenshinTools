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
   - [Tier List](#34-tier-list)
   - [Archive](#35-archive)
   - [Team Comp](#36-team-comp)
4. [Cross-Cutting Capabilities](#4-cross-cutting-capabilities)
5. [Data & Persistence](#5-data--persistence)
6. [Distribution Channels](#6-distribution-channels)

---

## 1. Product Overview

**GG Artifact** is a free, community-focused web application that helps Genshin Impact players:

- **Optimize artifact management** through customizable filter configurations and probability-based triage
- **Analyze account progress** with automated artifact scoring, build evaluation, and actionable recommendations
- **Rank characters and weapons** using interactive tier list makers
- **Plan and optimize team compositions** with a full damage calculator, rotation modeling, and branch-and-bound artifact optimizer
- **Browse game data** via an in-app archive of characters, weapons, artifacts, and bosses

The application is designed to be **language-agnostic** (English & Chinese), **mobile-responsive**, and **works entirely client-side** (no backend server required). User data persists in browser local storage.

### Value Proposition

| User Need | How GG Artifact Addresses It |
|-----------|------------------------------|
| "I have too many artifacts to manage" | Generates optimized lock/trash filter configurations; probability-based triage recommends keep/trash decisions |
| "How good are my character builds?" | Quantitative artifact scoring with AutoTune-generated weights derived from real damage calculations |
| "Which characters should I build next?" | Interactive tier lists with drag-and-drop prioritization; build evaluation grades across account |
| "I need to plan my team compositions" | Visual team builder with damage calculator, rotation modeling, and automatic artifact optimizer |
| "What artifacts should I equip?" | Recommendation engine suggests equips, swaps, upgrades, and farm priorities |
| "I want to look up game data" | In-app archive with character stats, weapon stats, artifact set details, and boss information |

---

## 2. User Personas

### Primary Persona: The Artifact Optimizer
- **Goals:** Efficiently manage artifact inventory, know which artifacts to keep/trash, equip optimal pieces
- **Pain Points:** In-game artifact management is tedious; afraid of accidentally trashing good pieces
- **Key Features Used:** Artifact Filter, Account Data (scoring, triage, recommendations)

### Secondary Persona: The Roster Manager
- **Goals:** Track progression across many characters, prioritize who to build next
- **Pain Points:** No in-game way to rank or compare character investments
- **Key Features Used:** Tier List, Account Data (evaluation, characters view)

### Tertiary Persona: The Theory Crafter
- **Goals:** Plan team compositions, compare weapon options, maximize team damage
- **Pain Points:** Need to reference external resources, no central planning tool with real damage numbers
- **Key Features Used:** Team Comp (damage calculator, optimizer, combo builder), Archive, AutoTune

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
3. Tier List
4. Archive
5. Team Comp

**Visual Treatment:**
- Each feature row has a unique background image from Genshin Impact
- Premium design with gradient overlays, golden accents, and hover animations
- Mobile-responsive layout that stacks content vertically

---

### 3.2 Account Data

**Purpose:** Import, visualize, and analyze account data including characters, weapons, and artifacts. Provides actionable insights through scoring, evaluation, triage, and recommendations.

**Entry Points:**
- Home page feature link
- Global navigation

**Data Sources:**
- **GOOD Format Import:** JSON file exported from scanning tools (Irminsul, Inventory Kamera)
- **Enka Network API:** Direct import via player UID (limited to showcase characters)

**Sub-Views (5 Tabs):**

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

#### 3.2.2 Recommendations Tab
- **Actionable insights** generated from account data and damage analysis
- Recommendation categories:
  - **Equip:** Which artifacts to equip on which characters
  - **Swap:** Which artifacts to move between characters for better builds
  - **Upgrade:** Which artifacts to level up for maximum impact
  - **Farm Priorities:** Where to farm next based on build gaps
- Uses real damage calculator (TeamBuild) for marginal analysis
- Action cards categorized by type with clear next steps

#### 3.2.3 Inventory Tab
- **Weapons Section:**
  - Grouped by "Max Level" vs "Other"
  - Shows weapon icon, name, level, refinement, and secondary stat
  - Count badge if duplicates exist
- **Artifacts Section:**
  - Grouped by "Max Level" (Lv.20) vs "Other"
  - Shows artifact icon, set name, slot, main stat, and substats
  - Collapsible sections for managing large inventories

#### 3.2.4 Evaluation Tab
- **Build completion analysis** across all characters
- Per-character build completion and efficiency ratings
- Tier-based visual indicators (S/A/B/C ratings)
- Detailed breakdowns per build configuration
- Quickly identifies strongest and weakest builds in the account

#### 3.2.5 Triage Tab
- **Probability-based artifact evaluation** for keep/trash decisions
- **Tier System:** P/Q/N/T tiers based on rarity calculations
  - Evaluates artifacts by the probability of their stat combinations
- **Condition Tables:** Tier evaluation based on stat combinations
- **Supply/Demand Resolution:** Configurable quota system for artifact recommendations
- **Special Rules (SP1–SP6):**
  - ER hoard protection
  - Double crit handling
  - Level/equip protection
- **Flexible Patterns:** Configurable rules for dual-crit locks and ER hoarding
- **Help Dialog:** Visual bar diagrams explaining probability-based decisions

**Actions:**
- **Import:** Open import dialog
- **Clear:** Remove all account data

---

### 3.3 Artifact Filter

**Purpose:** Configure desired artifact builds for characters, generate optimized filter configurations, and auto-generate stat weights using damage-based analysis.

**Sub-Views (3 Tabs):**

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

#### 3.3.3 AutoTune Tab

**Purpose:** Automatically generate optimal artifact stat weights using real damage calculations.

**How It Works:**
- Uses the Team Comp damage calculator (TeamBuild) to perform marginal analysis
- Algorithm: baseline artifact stats → constrained greedy allocation → midpoint weight normalization
- Evaluates damage sensitivity per substat (+1 average roll) and normalizes to 0–100 scale

**Features:**
- **Batch AutoTune:** Multi-team weight optimization flow
  - Team selection interface
  - Combo/rotation line configuration using character `defaultRotation` data
  - Damage-weighted formula selection
- **Results Display:** Per-character weight tables with shared components (ComboTable, MainStatColumn, SubstatPills)
- **Worker Thread:** Async computation for responsive UI
- **Tunable Substats:** CR, CD, ATK%, HP%, DEF%, EM, ER, ATK, HP, DEF

**Overall Page Actions:**
- **Import:** Load builds from preset or local file
- **Export:** Save current builds to JSON file (with author/description metadata)
- **Clear:** Remove all build configurations

---

### 3.4 Tier List

**Purpose:** Create and share custom character and weapon tier lists in a unified page.

**Sub-Views (2 Tabs):**

#### 3.4.1 Characters Tab

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

#### 3.4.2 Weapons Tab

**Layout:** Same tier grid structure as Characters tab, but with:
- Weapons grouped by weapon type (Sword, Claymore, etc.)
- Weapon icons show rarity background

**Filtering Options:**
- **By Rarity:** 5★, 4★, 3★ toggles
- **By Secondary Stat:** Filter to specific substats (CR, CD, ATK%, EM, ER, etc.)

**Actions (both tabs):**
- **Import:** Load tier list from preset or local file
- **Export:** Save tier list to JSON file
- **Clear:** Reset to empty state
- **Download as Image:** Export tier list as high-quality PNG

---

### 3.5 Archive

**Purpose:** In-app reference encyclopedia for browsing game data without leaving the tool.

**Sub-Views (4 Tabs):**

#### 3.5.1 Characters Tab
- Browse full character encyclopedia
- Base stats at multiple ascension levels
- Skills, talents, passives, and constellations

#### 3.5.2 Weapons Tab
- Complete weapon database
- Stats and passives by type/rarity

#### 3.5.3 Artifacts Tab
- Full artifact set encyclopedia
- Set bonus details (2pc and 4pc effects)

#### 3.5.4 Bosses Tab
- Enemy/boss reference database
- Boss information and details

---

### 3.6 Team Comp

**Purpose:** Visual workspace for planning team compositions with an integrated damage calculator, rotation modeler, and artifact optimizer.

**Layout:** Responsive grid of Team Cards with drill-down detail view.

#### Team Card Structure
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

#### Damage Calculator

Each team has an integrated damage calculator powered by a full damage engine:

**Formula System (6 formula types):**
- **DirectFormula:** Base scaling × stat × talent multiplier × DEF mult × RES mult × CRIT mult
- **AmplifyFormula:** Melt/Vaporize with element multipliers (2.0× forward, 1.5× reverse) + EM bonus
- **CatalyzeFormula:** Spread/Aggravate with additive EM scaling
- **TransformFormula:** Overloaded/Superconduct/Swirl/Bloom/Hyperbloom with level-based coefficients
- **LunarFormula:** Nod-Krai lunar reactions (lunarCharged/lunarBloom/lunarCrystallize)
- **LunarDirectFormula:** Direct damage with lunar-specific scaling

**Reaction Support:** 17+ reaction types including standard (Vaporize, Melt, Overloaded, Superconduct, Swirl, Bloom, Hyperbloom, Burgeon, Frozen, Shatter, Electro-Charged), catalyze (Spread, Aggravate), and lunar variants.

**Buff System:**
- **StatBuff:** Static + dynamic entries (resolved from character stats)
- **ScalingBuff:** Input→output stat scaling with caps/thresholds (e.g., EM → DMG%)
- **CrossScalingBuff:** Two-stat scaling combinations
- Buff targets: self, selfOnField, selfOffField, otherOnField, onField, team
- Team resonance buffs (Pyro +ATK%, Hydro +HP%, Geo DMG bonus, Dendro EM, etc.)

**Damage Display Layers:**
- **Current damage:** With existing equipped artifacts
- **Optimized damage:** After running the artifact optimizer
- **Ideal damage:** With perfect rolls (100% substat potential) + gold main stats
- **Marginal gains:** Damage gain per +1 average substat roll per stat

**Detail View Components:**
- **Formula Breakdown:** Detailed damage formula math display
- **Buff Ledger:** All buffs affecting each character with provenance tracking
- **Stat Sheet Panel:** Full stat table with ER/CR requirements
- **Reaction Selector:** Per-formula reaction override controls
- **Enemy Element Aura:** Persistent aura on enemy (e.g., burning) for reaction triggers

#### Combo/Rotation Builder

- **ComboFormula:** Named multi-character rotations with per-line specifications
  - Each line: character + formula + hit count + optional reaction override
- **evaluateCombo():** Calculates total damage for a full rotation
- **Default Rotations:** All characters have populated `defaultRotation` data (formulaId → hit count)
- **Single vs Combo mode:** Optimize for single formula or full rotation damage

#### Artifact Optimizer (V2 Branch-and-Bound)

**Architecture:** Per-character branch-and-bound → team conflict-aware DFS

**Per-Character B&B:**
- Depth-first search over artifact slot combinations
- Set composition patterns: 4pc and 2+2 arrangements
- Upper-bound pruning using "super-artifacts" (best possible stats per slot)
- ER/CR constraint enforcement
- ~100k+ evaluations per character depending on inventory size

**Team Optimization (3-phase):**
1. **Carry 1:** Main DPS character optimization
2. **Support:** All non-DPS team members
3. **Carry 2:** Sub-DPS or off-field nuker (combo mode)

**Conflict-Aware DFS:** Finds best team artifact assignment where no artifact is shared across characters.

**Performance:**
- Dynamic hyperparameters: top-K scales 100–300 based on inventory size
- Worker thread parallelization (Web Worker per character)
- Deadline-based early stopping for responsive UI
- Marginal-gain artifact scoring and ranking

#### Team Freeze/Pin System

- **Freeze Characters:** Lock specific characters' optimized artifacts
- **Cross-Team Tracking:** Prevents same artifact being assigned to frozen slots in other teams
- **Batch Operations:** Freeze/unfreeze all in team or select specific characters
- **Visual Indicators:** Frozen state badges on team cards
- Frozen teams display at top of team list

**Character Implementations:** 70+ characters with individually coded formulas, buffs, and mechanics organized by rarity and region (Mondstadt, Liyue, Inazuma, Sumeru, Fontaine, Natlan, Nod-Krai).

**Actions:**
- **Copy Team:** Duplicate an existing team composition
- **Delete Team:** Remove a team
- **Import/Export:** Save and load team compositions with presets
- **Artifact Swap Dialog:** Optimize by swapping artifacts between team members

---

## 4. Cross-Cutting Capabilities

### 4.1 Internationalization (i18n)

- **Supported Languages:** English, Chinese (Simplified)
- **Coverage:** All UI text, game terminology (character names, stats, etc.)
- **Implementation:** Client-side translation with language context

### 4.2 Theming

- **Available Themes:** 9 themes inspired by Genshin regions
  - Abyss (default dark), Mondstadt, Liyue, Inazuma, Sumeru, Fontaine, Natlan, Snezhnaya, Nod-Krai
- **Dynamic Generation:** Theme colors computed from base HSL values
- **Rarity Colors:** Consistent 3★/4★/5★ backgrounds across all themes

### 4.3 Responsive Design

- **Breakpoints:** Mobile-first with adaptations at sm/md/lg/xl/2xl
- **Mobile Optimizations:**
  - Sheet/drawer dialogs instead of popovers
  - Compact item icons and reduced spacing
  - Touch-friendly drag-and-drop
  - Collapsible sidebars
- **Desktop (2xl):** Full horizontal navigation with tab buttons
- **Tablet/Mobile (< 2xl):** Hamburger menu (Sheet component)

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

### 4.7 Onboarding Tour

- Interactive guided tour system with spotlight step IDs on key UI elements
- Help button accessible from navigation
- Per-page tour steps for new users

---

## 5. Data & Persistence

### 5.1 Storage Strategy

| Data Type | Storage | Persistence |
|-----------|---------|-------------|
| Account Data (characters, artifacts) | localStorage | Until cleared |
| Build Configurations | localStorage | Versioned, persisted |
| Tier List Assignments | localStorage | Persisted |
| Team Compositions | localStorage (Zustand) | Persisted |
| Frozen Team Artifacts | localStorage (Zustand) | Persisted |
| Triage Configuration | localStorage (Zustand) | Persisted |
| UI Preferences (theme, language) | localStorage | Persisted |

### 5.2 Data Import/Export

- **GOOD Format:** Industry-standard JSON schema for Genshin data interchange
- **Enka Network:** API-based import using player UID
- **Custom JSON Formats:** For builds, tier lists, team compositions, and configurations

### 5.3 Static Game Data

- Characters, Weapons, Artifacts sourced from data mining
- Images served from CDN or local assets
- Updated via Python scripts in `scripts/` directory

---

## 6. Distribution Channels

### 6.1 Web Application
- **URL:** https://ggartifact.com
- **Hosting:** Cloudflare Workers, with GitHub Pages as a static fallback
- **PWA Support:** Not currently implemented

### 6.2 Desktop Delivery (Retired)
- **Status:** Not currently offered
- **Primary delivery:** Browser-only web application via Cloudflare Workers and GitHub Pages

---

## Document Revision

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-23 | Product Team | Initial comprehensive documentation |
| 1.1 | 2026-01-23 | Product Team | Removed gaps section (moved to PRODUCT_ROADMAP.md), updated Team Builder to reflect 2+2pc support |
| 2.0 | 2026-03-17 | Product Team | Major rewrite: added Archive page, Team Comp damage calculator/optimizer/rotation system, AutoTune, Triage V2, Evaluation tab, Recommendations tab, Team Freeze system, updated themes and cross-cutting features |

---

*This document is intended for internal product planning. For user-facing documentation, please refer to the README files.*
