# Reusable UI Components — USE THESE, DON'T REBUILD

Before building any UI, check this list. Re-inventing these is a common mistake.

## Game Item Display

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Any game item icon (character, weapon, artifact) | `ItemIcon` | `shared/ItemIcon.tsx` | `imagePath`, `size` (xs/sm/md/lg/xl), `rarity` (1-5), `badge`, `level`, `elementBadge`, `lock`, `frozen`, `imagePath2` (for 2pc+2pc split) |
| Artifact icon with data | `ArtifactIcon` | `shared/ArtifactIcon.tsx` | `artifact`, `artInfo`, `slot`, `size` |
| Character name/element/rarity header | `CharacterInfo` | `shared/CharacterInfo.tsx` | `character`, `showDate?`, `children` |
| Artifact stat breakdown | `StatDisplay` | `account-data/StatDisplay.tsx` | `artifact`, `scoreResult?`, `compact?` |
| 5-slot artifact grid | `ArtifactSlotGrid` | `team-comp/ArtifactSlotGrid.tsx` | `artifactsObj`, `onSwap?` |

**Sizing:** Use exported `ICON_CONFIG` and `SIZE_CLASSES` from `ItemIcon.tsx` for consistent dimensions.

## Pickers & Selectors

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Pick a character, weapon, or artifact | `ItemPicker` | `shared/ItemPicker.tsx` | `type` ('character'/'weapon'/'artifact'), `value`, `onChange`, `filter?`, `triggerSize?`, `menuSize?`, `frozen?` |
| 4-slot team picker (char+weapon+artifact) | `TeamPickerGrid` | `shared/TeamPickerGrid.tsx` | `characters`, `weapons`, `artifacts`, `onChange`, `accountData?` (auto-prefill), `frozenCharIds?` |
| Stat multi-select | `StatSelect` | `artifact-builds/StatSelect.tsx` | `values`, `onValuesChange`, `options`, `maxLength`, `compact?` |
| Stat multi-select with weights | `WeightedStatSelect` | `artifact-builds/WeightedStatSelect.tsx` | `values`, `options`, `maxLength`, `weightPresets?` |
| Weight slider (0-100%) | `WeightPopover` | `shared/WeightPopover.tsx` | `value`, `onChange`, `label?` |
| 2pc+2pc artifact builder | `ArtifactMixedBuilder` | `shared/ArtifactMixedBuilder.tsx` | `mixedSlot1`, `mixedSlot2`, `pickingSlot`, `confirmMixedSet` |

`ItemPicker` is responsive: Popover on desktop, Drawer on mobile. It has built-in search, filter chips, tier sorting, and owned-only filter.

## Tooltips & Preview Cards

| Need | Component | Path | Props |
|------|-----------|------|-------|
| Character preview on hover | `CharacterTooltip` | `shared/CharacterTooltip.tsx` | `characterId` |
| Weapon preview on hover | `WeaponTooltip` | `shared/WeaponTooltip.tsx` | `weaponId` |
| Artifact set effects on hover | `ArtifactTooltip` | `shared/ArtifactTooltip.tsx` | `setId`, `hideFourPieceEffect?` |
| 2pc+2pc set effects on hover | `MixedSetTooltip` | `shared/MixedSetTooltip.tsx` | `id1`, `id2` |
| Artifact detail (hover + mobile drawer) | `ArtifactDataHoverCard` | `account-data/ArtifactDataHoverCard.tsx` | `artifact`, `slot`, `children` (trigger) |

## Filter Panels

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Full character filter panel | `CharacterFilterSidebar` | `shared/CharacterFilterSidebar.tsx` | `filters`, `onFiltersChange`, `hasTierData?` |
| Tri-state sort toggle | `SortToggleGroup` | `shared/SortToggleGroup.tsx` | `value`, `onChange`, `label?` |

`CharacterFilterSidebar` provides: owned-only, element, rarity, weapon type, region, tier/release sort.

## Page Layouts

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Standard page wrapper (AppBar + error boundary) | `PageLayout` | `layout/PageLayout.tsx` | AppBar props passthrough, `children` |
| Content + sidebar (drawer on mobile) | `SidebarLayout` | `layout/SidebarLayout.tsx` | `sidebar`, `children`, `triggerIcon?` |
| Sidebar + detail view (archive pattern) | `SidebarDetailLayout` | `layout/SidebarDetailLayout.tsx` | `sidebar`, `children`, `mobileGrid?`, `hasSelection`, `onBack` |
| Dense tabular layout with filters | `WideLayout` | `layout/WideLayout.tsx` | `title`, `actions?`, `filters?` (FilterGroup[]), `children` |
| Simple centered scroll container | `ScrollLayout` | `layout/ScrollLayout.tsx` | `children` |

## Action Dialogs (Import/Export/Clear)

All use the **ref handle pattern**: `useRef<ControlHandle>()` → `ref.current?.open()`.

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Export with metadata | `ExportControl` | `shared/ExportControl.tsx` | `onExport(author, description)` |
| Import from preset or file | `ImportControl` | `shared/ImportControl.tsx` | `options`, `loadPreset`, `onApply` |
| Confirm-to-clear | `ClearAllControl` | `shared/ClearAllControl.tsx` | `onConfirm` |

Wire these to AppBar via `actions` prop:
```tsx
const exportRef = useRef<ControlHandle>(null);
<ExportControl ref={exportRef} onExport={handleExport} />
<PageLayout actions={[
  { key: "export", icon: Download, label: "Export", onTrigger: () => exportRef.current?.open() }
]} />
```

## Tier List Rendering

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Universal tier grid (3 responsive modes) | `TierLayout` | `tier-list/TierLayout.tsx` | `mode` ('compact'/'tablet'/'desktop'), `iconSize`, `allTiers`, `itemsPerTier`, `groups`, `getItemGroup`, `getItemName` |

## Error Boundaries

| Need | Component | Path |
|------|-----------|------|
| Full-page error | `PageErrorBoundary` | `shared/ErrorBoundary.tsx` |
| Section-level error | `SectionErrorBoundary` | `shared/ErrorBoundary.tsx` |
