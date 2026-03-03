# Mobile UX Audit (375x812 viewport)

Comprehensive review of all pages and tabs at mobile resolution. Findings are grouped by severity, then by page.

---

## CRITICAL

### 1. No visible tab bar on mobile (AppBar — affects Account Data, Artifact Filter, Archive)
- **File**: `src/components/layout/AppBar.tsx:483` — `hidden md:block`
- The tab switcher for sub-tabs (e.g. Characters/Recommendations/Inventory/Evaluation) is completely hidden below 768px. Users must open the hamburger menu to discover and switch tabs. There's no visual indicator of which tab is active or that other tabs exist.
- **Impact**: Primary in-page navigation is invisible. Users may never discover sub-tabs.

### 2. AppBar action buttons overflow off-screen (Account Data)
- **File**: `src/components/layout/AppBar.tsx:322-334`
- The `alwaysShow` action buttons ("Switch Account", "Import") render with full text labels at all viewport sizes. Combined with hamburger + logo + overflow button, they push past the 375px edge. In English, the Import button and More (⋯) button are partially/fully hidden off-screen.
- **Impact**: Overflow menu (Help, Theme, Language) is inaccessible on mobile.

### 3. Drag-and-drop unusable on touch devices (Tier List)
- **File**: `src/components/tier-list/TierTable.tsx:107-116`
- `@dnd-kit` uses only `PointerSensor` with `distance: 5`. On touch devices, a 5px finger movement initiates drag instead of scroll. No `TouchSensor` with delay constraint exists.
- **Impact**: Core feature (ranking characters/weapons by tier) is broken on phones.

### 4. Weapon names unreadable in Archive Weapons tab
- **File**: `src/components/archive/WeaponCard.tsx:48`
- 2-column layout gives ~120px per name after the icon. With `line-clamp-2`, most weapon names are truncated to initials or 2-3 characters ("Lightb Moon:", "S S", "U M"). Many 3-star weapons show no name at all.
- **Impact**: Weapons list is unusable — users cannot identify weapons.

### 5. Extremely small "+" buttons for stats (Artifact Filter — Configure)
- **File**: `src/components/artifact-builds/StatSelect.tsx:155-167`
- Add buttons for main stats and substats are **16x16px** (`compact ? "h-4 w-4"`). Minimum recommended touch target is 44x44px.
- **Impact**: Nearly impossible to tap accurately on mobile.

---

## MAJOR

### 6. Stat combobox dropdowns only 20px tall (Artifact Filter — Configure)
- **File**: `src/components/artifact-builds/StatSelect.tsx`
- Stat selector buttons ("ATK%", "EM", "CR") are only 20px tall, far below the 44px minimum.

### 7. Text too small on Filters tab (Artifact Filter — Filters)
- **File**: `src/components/artifact-builds/ArtifactConfigCard.tsx:77,90,100`
- Multiple elements use 10–11px font: "Optional — skip if CR+CD auto-lock is enabled" at 10px, column headers at 11px, stat badges at 11px.

### 8. Filters tab 4-column layout cramped at 375px (Artifact Filter)
- **File**: `src/components/artifact-builds/ArtifactConfigCard.tsx`
- Each column is ~76px wide. Headers wrap 3+ lines at 11px font. The notice text wraps into 6 lines at 10px. Too dense for mobile.

### 9. Build action buttons too small (Artifact Filter — Configure)
- Three-dot menus and visibility toggles on builds are **28x28px**, well below 44px minimum.

### 10. Role/archetype dropdowns only 25px tall (Artifact Filter — Configure)
- "On-Field", "Off-Field", "DPS", "Support", "C0+" selector buttons are only 25px tall.

### 11. AppBar title truncated on Filters tab (Artifact Filter)
- "Download Image" button takes ~210px, leaving "GG Artif..." for the title.

### 12. Artifact main stat labels clipped in character cards (Account Data — Characters)
- **File**: `src/components/account-data/CharacterCard.tsx`
- Container width (30–31px) is narrower than text (34px). The "%" suffix is partially cut off.

### 13. Character name truncation in Recommendations (Account Data)
- **File**: `src/components/account-data/RecommendationCard.tsx`
- Names with 3+ characters get truncated ("哥伦...", "茜特..."), making cards hard to identify.

### 14. Damage formula requires excessive horizontal scroll (Team Comp — Detail)
- **File**: `src/components/team-comp/FormulaBreakdown.tsx:900-901`
- Formula renders at 867px natural width inside 317px visible area. ~63% is hidden off-screen including critical damage zones.

### 15. Fixed filter header consumes ~40% of viewport (Team Comp — List)
- **File**: `src/pages/TeamComp.tsx:224-289`
- Element icons (7) + region chips (8) + "New Team" buttons occupy ~230px of 583px available content area.

### 16. Talent multiplier labels truncated (Archive — Character Detail)
- Long skill descriptions like "Spiritbreath Thorn/Surging Blade DMG Interva" cut off without wrapping.

### 17. Character name truncation in Archive (Archive — Characters)
- **File**: `src/components/archive/CharacterArchiveView.tsx:161`
- Long names truncated with `line-clamp-1` at ~80px. All 5 Traveler variants are indistinguishable.

### 18. Filter panel checkboxes too small (Tier List)
- Checkboxes are 16x16px, labels 20px tall. Only 13px gap between adjacent options.

---

## MINOR

### 19. Touch targets below recommended minimum across AppBar
- All AppBar buttons are 36px tall. Hamburger menu button is 29x36px. Recommended minimum is 44x44px.

### 20. Dense artifact substat grid hard to read (Account Data — Characters)
- 6-column grid of substats at 12px font with minimal spacing. Hard to scan quickly.

### 21. Weapon name truncation in character cards (Account Data — Characters)
- Long weapon names like "A Day Carved From Rising..." get truncated.

### 22. Overflow menu items are 32px tall (global)
- Menu items (Export, Clear, Help, Theme, Language) are 32px — below 44px recommendation.

### 23. Navigation drawer items are 36px tall (global)
- Sub-items in hamburger menu are 36px — slightly below 44px recommendation.

### 24. "Add Build" button only 28px tall (Artifact Filter — Configure)
- Full-width but only 28px tall.

### 25. Filter chip touch targets too small (Archive)
- **File**: `src/components/archive/FilterChip.tsx:15`
- Element/weapon icons ~37x25px. Labels hidden on mobile, leaving only 16x16 icon.

### 26. Search placeholder overflows (Archive — Characters)
- "Search names, skills, passives, constellations..." extends beyond the input field.

### 27. Element tab touch targets narrow (Tier List — Characters)
- Each tab is 49px wide with zero gap between them. Risk of mis-taps.

### 28. No "All Elements" tab (Tier List — Characters)
- Users must tap through each of 7 elements one by one to review full tier list.

### 29. Level/Constellation/Refine selects are 20px tall (Team Comp — Detail)
- "Lv. 90", "C6", "R5" buttons are 20px — below 44px minimum.

### 30. No scroll indicator for formula tabs (Team Comp — Detail)
- 9 formula tabs, only 1 visible. No gradient fade, arrow, or dots to hint at more.

### 31. Min. ER inputs are 36x20px (Team Comp — Detail)
- Very small for mobile tapping.

### 32. Enemy settings inputs below minimum (Team Comp — Detail)
- Enemy Lv input 56x24px, Enemy RES 40x24px, Assume CRIT checkbox 16x16px.

### 33. Team card header controls compact (Team Comp — List)
- Preset dropdown 112x29px, name input 140x28px, 3-dot menu 28x28px.

---

## COSMETIC

### 34. 10px font for supplementary labels (Account Data)
- "Lv. 89", "4件套", "+20" labels use 10px — at the edge of legibility.

### 35. No empty state differentiation (Account Data — Recommendations)
- When no tier assignments exist, 114 characters appear in "Pool" with no clear call-to-action.

### 36. Artifact set picker icons lack text labels (Artifact Filter — Configure)
- Grid of artifact icons with no labels. Users must identify sets by icon memory (search bar mitigates).

### 37. Main stat headers wrap to 2 lines (Artifact Filter — Configure)
- "Sands Main Stat" → "Sands Main / Stat" across two lines.

### 38. Tier label text small (Tier List)
- 14px font in 28px tall bar — functional but compact.

### 39. Weapon type badge overlay small (Tier List)
- 16–20px informational badges on 48px icons — partially obscures portraits.

### 40. Inconsistent weapon card layout (Archive — Weapons)
- `flex-wrap` produces uneven rows when weapon type sections have odd counts.

### 41. Build section role dropdowns crowded (Archive — Character Detail)
- "Off-Field", "Support", "C0+" row wraps awkwardly at 375px.

### 42. "DMG B..." truncation in formula viewport (Team Comp — Detail)
- Rightmost visible zone label cut off mid-word.

### 43. Partial tab visibility in formula tab bar (Team Comp — Detail)
- Second tab shows only a sliver — unclear if it's a tab or decoration.

---

## Cross-Cutting Themes

| Theme | Affected Pages | Count |
|-------|---------------|-------|
| **Touch targets below 44px** | All pages | 15+ instances |
| **Text truncation** | All pages | 8 instances |
| **Hidden tab bar on mobile** | Account Data, Artifact Filter, Archive | 1 root cause |
| **Font size below 12px** | Account Data, Artifact Filter | 3 instances |
| **AppBar overflow** | Account Data, Artifact Filter | 2 instances |

### Top Recommendations (by impact)

1. **Show tab bar on mobile** — Add a horizontal scrollable tab strip below AppBar for `< md` viewports. Single fix addresses the #1 discoverability problem across 3 pages.
2. **Add TouchSensor to dnd-kit** — Add `TouchSensor` with ~200ms delay activation to `TierTable.tsx`. Single fix makes tier list usable on phones.
3. **Collapse AppBar actions to icons on mobile** — Render `alwaysShow` buttons as icon-only below `sm` breakpoint to prevent overflow.
4. **Increase minimum touch target to 44px** — Systematic pass on all interactive elements (buttons, selects, checkboxes, toggles). Use padding to enlarge hit area without changing visual size.
5. **Increase minimum font to 12px on mobile** — Replace `text-[10px]` and `text-[11px]` with `text-xs` (12px) minimum.
6. **Fix weapon card layout in Archive** — Increase name area width or switch to list layout for weapons.
7. **Stack formula zones vertically on mobile** — Wrap damage formula into 2–3 zones per row below `md` breakpoint.
8. **Make Team Comp filter header collapsible** — Or move filters to a drawer to reclaim viewport space.
