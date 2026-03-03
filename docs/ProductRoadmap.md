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

## 2. P2: Feature Expansion

Lower-priority enhancements that extend existing features. Naming changes require implementing feature changes first.

### 2.6 Platform & Infrastructure

#### 2.6.1 PWA Support

**Rationale:** Progressive Web App capabilities would enable offline access and home screen installation on mobile.

**Scope:**
- Service worker for asset caching
- Web app manifest with icons
- Offline fallback UI

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
