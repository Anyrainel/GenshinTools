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

## 2. P2: Feature Expansion

Lower-priority enhancements that extend existing features. Naming changes require implementing feature changes first.

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
| How to handle game meta changes? | Character rankings shift with patches. Should tier lists be versioned or labeled by patch? |

---

*This document captures ideas at various stages of exploration. Not all items will be implemented. Priorities may shift based on user feedback and resource availability.*
