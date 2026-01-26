# GG Artifact – Product Roadmap

> **Document Purpose:** This document outlines future considerations, improvements, and strategic directions for GG Artifact. Items are organized by priority level.

---

## Table of Contents

1. [P1: Core Experience Improvements](#1-p1-core-experience-improvements)
2. [P2: Feature Expansion](#2-p2-feature-expansion)
3. [Future Considerations](#3-future-considerations)
4. [Open Questions](#4-open-questions)

---

## 1. P1: Core Experience Improvements

High-priority improvements that directly impact user value and retention.

### 1.1 Cloud Backup via Google Drive

**Problem:** Users risk losing all data if they clear browser storage or switch devices.

**Proposed Solution:**
- OAuth integration with Google Drive
- One-click backup/restore of all localStorage data
- Optional auto-sync on data changes
- No backend server required (Drive API is client-side capable)

**Considerations:**
- Privacy: Users control their own Drive storage
- Offline handling: Queue sync operations for when online

---

### 1.2 Interactive Onboarding & First-Visit Guide

**Problem:** New users land on Home without context, leading to confusion and drop-off.

**Proposed Solution:**
- First-visit detection (localStorage flag)
- Step-by-step tooltip walkthrough of main features
- Highlight one "quick win" flow (e.g., "Import via UID → See your artifact scores")
- Option to dismiss or replay later

---

### 1.3 Empty State Improvements

**Problem:** Current empty states are functional but don't guide users toward next actions.

**Proposed Solution:**
- Contextual suggestions per page (e.g., "Import data to see your characters")
- Link to onboarding if not completed
- Showcase sample data or screenshots

---

### 1.4 Artifact Filter Algorithm Redesign

#### 1.4.1 Consolidate Substat Threshold to Global Setting

**Problem:** Currently, each build card requires the user to specify "at least N of these substats" (e.g., "at least 2 of CR/CD/ER"). When configuring many characters, this becomes repetitive and adds cognitive load—most users want the same threshold across all builds.

**Current Behavior:**
- Each `BuildCard` has its own "at least N" input
- User must configure this for every build individually
- Silently treat CR/CD as must have substats
- Creates visual clutter and decision fatigue

**Proposed Behavior:**
- Remove the per-build "at least N" input from `BuildCard`
- Add a single global "minimum substat count" setting in the Compute stage
- The filter algorithm uses this global threshold for all builds
- Simplifies the per-build UI to just: artifact set + main stats + desired substats

**Benefit:** Configure once, apply everywhere. The mental model becomes: "I want artifacts with at least 2 good substats" as a global policy rather than per-character decision.

#### 1.4.2 Smarter Filter Quality Control

**Problem:** Generated filters can be too permissive or too strict; the pass chance indicator is informational only.

**Proposed Solutions:**
- Add configurable threshold to auto-bump "at least N+1" when probability is too high
- Introduce 4pc vs 2+2pc priority weighting during computation
- Show quality score per artifact set (not just pass chance)
- Consider iterative tightening: "Tighten this slot? (Currently 40% pass rate)"

---

### 1.5 Universal Label System

**Problem:** Build names are free-text and inconsistent. There's no structured way to categorize characters/weapons or express compatibility relationships.

**Proposed Solution:** A unified taxonomy of labels for both characters and weapons.

#### Character Labels
- **Scaling stats:** ATK, HP, DEF, EM
- **Roles:** Main DPS, Sub DPS, Support, Healer, Shielder
- **Damage profile:** Burst, Sustained, Reaction-based

**Application:**
- Replace free-text build names with label selectors
- Labels drive build recommendations and cross-character consistency

#### Weapon Labels
- **Stat buffs:** ATK%, DMG%, CR/CD, EM, ER
- **Conditional buffs:** On-hit, On-skill, On-burst, Team buffs
- **Special effects:** Shield strength, Healing bonus, Energy generation

**Application:**
- Enable filtering by effect type (beyond just secondary stat)
- Labels enable smarter recommendations and discovery
- Foundation for character-weapon matching and reverse lookups

**Value:** A unified label system creates a foundation for intelligent features across the app.

---

## 2. P2: Feature Expansion

Lower-priority enhancements that extend existing features. Naming changes require implementing feature changes first.

### 2.1 Rename "Character Tier List" to "Character Priority"

**Problem:** "Tier List" implies objective power ranking, but this feature is for personal prioritization. The current name creates false expectations.

**Proposed Change:**
- Rename "Character Tier List" → "Character Priority" or "Build Priority"
- Keep internal functionality as-is
- Update navigation, home page, and all references
- Aligns with the tight coupling to Account Data Summary view

**Rationale:** The feature is tightly integrated with Account Data (sorting characters, Summary view grouping). It's about "which characters do I want to focus on" rather than "which characters are objectively best."

**Dependency:** Best done after Character Priority integration improvements (2.4).

---

### 2.2 Rename "Weapon Tier List" to "Weapon Browser"

**Problem:** "Weapon Tier List" implies ranking, but users rarely need to rank weapons. The primary value is interactive filtering and lookup.

**Proposed Change:**
- Rename "Weapon Tier List" → "Weapon Browser" or "Weapon Reference"
- De-emphasize or remove the tier grid
- Position as a filter, lookup, and discovery tool

**Dependency:** Best done alongside or after Weapon Browser evolution (2.3).

### 2.3 Weapon Browser Evolution

#### User Needs Analysis

The current Weapon Tier List is underutilized because ranking weapons is rarely the user's actual goal. Here's what users actually need:

| User Need | Current Support | Gap |
|-----------|-----------------|-----|
| "What weapon should I use on this character?" | Artifact Filter has 3 weapon slots per character (note-taking) | No actual recommendations or compatibility data |
| "Is this weapon worth leveling?" | No reverse lookup | Cannot see which characters benefit from a weapon |
| "I want a weapon with a specific effect" | Filter by secondary stat only | Cannot filter by passive effect (e.g., "EM on hit", "team buff") |
| "Quick reference for weapon stats" | Tooltips show basic info | Missing passive descriptions, refinement scaling |

**Key Insight:** For 5★ characters, weapon recommendations are often well-documented. But for 4★ characters and older characters with shifting meta, finding exhaustive information is difficult. A comprehensive DPS calculator would solve this but requires significant complexity. A pragmatic alternative is curated character-weapon compatibility data.

#### 2.3.1 Per-Character Weapon Recommendations

**Rationale:** Connect characters to their recommended weapons with quality annotations.

**Proposed Implementation:**
- Data model: `characterId → [{ weaponId, rating: 'great' | 'good' | 'average' | 'niche' }]`
- Display in Character Card or dedicated Character → Weapon view
- Initial data can be sourced from existing Artifact Filter weapon selections + community guides

**Challenge:** Keeping recommendations up-to-date as meta shifts.

#### 2.3.2 Reverse Lookup: Best Characters for a Weapon

**Rationale:** Help users decide whether to invest in leveling a weapon.

**Proposed Implementation:**
- Invert the character → weapon mapping to show weapon → characters
- Display on Weapon tooltips or a dedicated Weapon detail view
- Show ratings (e.g., "Great for: Hu Tao, Xiao. Good for: Bennett")

**Use Case:** "I pulled Staff of Homa. Who benefits from it?"

#### 2.3.3 Advanced Weapon Filtering

**Problem:** Current filtering only supports secondary stat type, which is often insufficient.

**Proposed Filters:**

| Filter Type | Examples |
|-------------|----------|
| Secondary Stat | CR, CD, ATK%, EM, ER, HP%, DEF%, Phys% (already exists) |
| Passive Effect Category | Stat buff, Conditional buff, Team buff, Special effect |
| Stat Provided by Passive | ATK%, DMG%, CR, CD, EM, Healing, Shield |
| Trigger Condition | On-hit, On-skill, On-burst, After reaction, HP threshold |
| Target | Self, Active character, Team |

**Value:** Enables discovery of niche weapons for specific builds. E.g., "Show me 4★ Catalysts that provide EM on skill cast."

---

### 2.4 Team Builder Enhancement

#### Vision Statement

The current Team Builder is minimal. The goal is to evolve it into a comprehensive theory-crafting workspace.

**Current State:**
- Select 4 characters + weapons + artifact sets (4pc and 2+2pc)
- Visual card layout
- Copy/delete teams

**Open Questions:**
- What additional information would help theory-crafters?
- Should it integrate with external resources (team guides, rotation videos)?
- Should it simulate team DPS or reactions?

#### Potential Enhancements

| Feature | Description | Feasibility |
|---------|-------------|-------------|
| **Team Notes** | Free-text area per team for rotation notes, synergy explanations | Easy |
| **Resonance Indicator** | Show elemental resonance based on selected characters | Easy |
| **Role Tags** | Label each slot (e.g., Main DPS, Sub DPS, Support, Healer) | Easy |
| **Share Link** | Generate shareable URL for a team composition | Medium |
| **Community Showcase** | Browse/import popular team comps | Medium |
| **Import from Account** | Auto-populate team based on current account data | Medium |
| **Rotation Visualizer** | Timeline view of skill/burst order | Hard |
| **DPS Calculator** | Estimate team damage output | Hard (requires extensive data) |

---

### 2.5 Character Priority Integration with Account Data

**Current State:** Character tier assignments drive sorting in Account Data views.

**Potential Enhancement:**
- Show tier inline on Character Cards
- Allow quick in-place tier adjustment from Account Data

---

### 2.6 Platform & Infrastructure

#### 2.6.1 PWA Support

**Rationale:** Progressive Web App capabilities would enable offline access and home screen installation on mobile.

**Scope:**
- Service worker for asset caching
- Web app manifest with icons
- Offline fallback UI

#### 2.6.2 Tauri Auto-Update

**Rationale:** Desktop users currently must manually download new versions.

**Scope:**
- Implement Tauri's updater plugin
- Host update manifests on CDN
- In-app update notifications

---

## 3. Future Considerations

Lower-priority items that require further evaluation before committing resources.

### 3.1 Native Mobile App

**Rationale:** While web is mobile-responsive, a native app could provide better UX and push notifications.

**Considerations:**
- React Native or Capacitor wrapper
- Significant investment; evaluate after PWA adoption metrics

---

### 3.2 WCAG Accessibility Compliance

**Rationale:** Ensure the app is usable by players with disabilities.

**Scope:**
- Keyboard navigation audit
- Screen reader compatibility
- Color contrast verification
- Focus management in modals/drawers

---

### 3.3 Automated Data Pipeline

**Rationale:** Currently, game data updates require manual script runs.

**Scope:**
- Scheduled CI/CD job to fetch latest data
- Auto-create PRs for review
- Version tracking for data freshness

---

### 3.4 Character Information Expansion

**Problem:** Character data is minimal compared to weapons/artifacts. Missing: talents, constellations, base stats.

**Considerations:**
- Significant i18n effort (all text must be bilingual)
- Increases bundle size and load time
- Could be lazy-loaded as needed

**Recommendation:** Evaluate demand before implementing. Consider linking to external wiki instead.

---

### 3.5 Community Preset Marketplace

**Rationale:** Currently limited built-in presets. Community contributions could enrich the ecosystem.

**Scope:**
- GitHub-based contribution workflow
- Curated vs. user-submitted presets
- Rating/popularity metrics

---

## 4. Open Questions

Strategic questions that need further exploration before committing to solutions.

| Question | Context |
|----------|---------|
| Should the app have user accounts? | Cloud backup can work without accounts (Google Drive auth), but accounts would enable cross-platform sync, preferences, and community features. |
| How to balance feature richness vs. load time? | More game data = better experience but slower initial load. Lazy loading? Code splitting? |
| What's the right level of "wiki" content? | Should the app be a tool-only, or should it include reference content (character guides, tier lists, etc.)? |
| How to handle game meta changes? | Character rankings shift with patches. Should tier lists be versioned or labeled by patch? |
| Is there demand for collaboration? | Multiple users editing the same tier list or build configs? |

---

## Document Revision

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-23 | Product Team | Initial roadmap based on current state analysis and user feedback |
| 1.1 | 2026-01-23 | Product Team | Expanded label system to cover weapons; rewrote Weapon Browser section with comprehensive user needs analysis |
| 1.2 | 2026-01-23 | Product Team | Reorganized by priority (P1/P2); extracted label system as standalone P1 concept |
| 1.3 | 2026-01-23 | Product Team | Moved naming changes from P0 to P2 (depends on feature implementation) |

---

*This document captures ideas at various stages of exploration. Not all items will be implemented. Priorities may shift based on user feedback and resource availability.*
