# Genshin Tools - Agent Context

## Overview

**React 19 + TypeScript + Vite 7** app using **Tailwind CSS 3** and **shadcn/ui**. Provides utilities for Genshin Impact players: Account Data, Artifact Filter, Tier List, Archive, and Team Comp.

- **UI**: shadcn/ui, Radix primitives, Vaul (drawers), Lucide icons, Sonner (toasts)
- **State**: Zustand 5 (Immer + persist middleware)
- **Desktop**: Tauri 2 (`src-tauri/`)
- **Edge**: Cloudflare Workers (`functions/api/`, Wrangler)
- **Quality**: Biome (lint/format), Husky + lint-staged
- **Testing**: Vitest 4 + React Testing Library, Playwright (`e2e/`)
- **Data Pipeline**: Python scripts (`scripts/`) with `uv`

Hosted on **Cloudflare Pages** (`npm run build` → `dist/`).

---

## ⚠️ Reusable Components — USE THESE, DON'T REBUILD

Before building any UI, check this section. Re-inventing these is a common mistake.

### Game Item Display

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Any game item icon (character, weapon, artifact) | `ItemIcon` | `shared/ItemIcon.tsx` | `imagePath`, `size` (xs/sm/md/lg/xl), `rarity` (1-5), `badge`, `level`, `elementBadge`, `lock`, `frozen`, `imagePath2` (for 2pc+2pc split) |
| Artifact icon with data | `ArtifactIcon` | `shared/ArtifactIcon.tsx` | `artifact`, `artInfo`, `slot`, `size` |
| Character name/element/rarity header | `CharacterInfo` | `shared/CharacterInfo.tsx` | `character`, `showDate?`, `children` |
| Artifact stat breakdown | `StatDisplay` | `account-data/StatDisplay.tsx` | `artifact`, `scoreResult?`, `compact?` |
| 5-slot artifact grid | `ArtifactSlotGrid` | `team-comp/ArtifactSlotGrid.tsx` | `charId`, `artifactsObj`, `onSwap?` |

**Sizing:** Use exported `ICON_CONFIG` and `SIZE_CLASSES` from `ItemIcon.tsx` for consistent dimensions.

### Pickers & Selectors

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Pick a character, weapon, or artifact | `ItemPicker` | `shared/ItemPicker.tsx` | `type` ('character'/'weapon'/'artifact'), `value`, `onChange`, `filter?`, `triggerSize?`, `menuSize?`, `frozen?` |
| 4-slot team picker (char+weapon+artifact) | `TeamPickerGrid` | `shared/TeamPickerGrid.tsx` | `characters`, `weapons`, `artifacts`, `onChange`, `accountData?` (auto-prefill), `frozenCharIds?` |
| Stat multi-select | `StatSelect` | `artifact-builds/StatSelect.tsx` | `values`, `onValuesChange`, `options`, `maxLength`, `compact?` |
| Stat multi-select with weights | `WeightedStatSelect` | `artifact-builds/WeightedStatSelect.tsx` | `values`, `options`, `maxLength`, `weightPresets?` |
| Weight slider (0-100%) | `WeightPopover` | `shared/WeightPopover.tsx` | `value`, `onChange`, `label?` |
| 2pc+2pc artifact builder | `ArtifactMixedBuilder` | `shared/ArtifactMixedBuilder.tsx` | `mixedSlot1`, `mixedSlot2`, `pickingSlot`, `confirmMixedSet` |

`ItemPicker` is responsive: Popover on desktop, Drawer on mobile. It has built-in search, filter chips, tier sorting, and owned-only filter.

### Tooltips & Preview Cards

| Need | Component | Path | Props |
|------|-----------|------|-------|
| Character preview on hover | `CharacterTooltip` | `shared/CharacterTooltip.tsx` | `characterId` |
| Weapon preview on hover | `WeaponTooltip` | `shared/WeaponTooltip.tsx` | `weaponId` |
| Artifact set effects on hover | `ArtifactTooltip` | `shared/ArtifactTooltip.tsx` | `setId`, `hideFourPieceEffect?` |
| 2pc+2pc set effects on hover | `MixedSetTooltip` | `shared/MixedSetTooltip.tsx` | `id1`, `id2` |
| Artifact detail (hover + mobile drawer) | `ArtifactDataHoverCard` | `account-data/ArtifactDataHoverCard.tsx` | `artifact`, `slot`, `children` (trigger) |

### Filter Panels

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Full character filter panel | `CharacterFilterSidebar` | `shared/CharacterFilterSidebar.tsx` | `filters`, `onFiltersChange`, `hasTierData?` |
| Tri-state sort toggle | `SortToggleGroup` | `shared/SortToggleGroup.tsx` | `value`, `onChange`, `label?` |

`CharacterFilterSidebar` provides: owned-only, element, rarity, weapon type, region, tier/release sort.

### Page Layouts

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Standard page wrapper (AppBar + error boundary) | `PageLayout` | `layout/PageLayout.tsx` | AppBar props passthrough, `children` |
| Content + sidebar (drawer on mobile) | `SidebarLayout` | `layout/SidebarLayout.tsx` | `sidebar`, `children`, `triggerIcon?` |
| Sidebar + detail view (archive pattern) | `SidebarDetailLayout` | `layout/SidebarDetailLayout.tsx` | `sidebar`, `children`, `mobileGrid?`, `hasSelection`, `onBack` |
| Dense tabular layout with filters | `WideLayout` | `layout/WideLayout.tsx` | `title`, `actions?`, `filters?` (FilterGroup[]), `children` |
| Simple centered scroll container | `ScrollLayout` | `layout/ScrollLayout.tsx` | `children` |

### Action Dialogs (Import/Export/Clear)

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

### Tier List Rendering

| Need | Component | Path | Key Props |
|------|-----------|------|-----------|
| Universal tier grid (3 responsive modes) | `TierLayout` | `tier-list/TierLayout.tsx` | `mode` ('compact'/'tablet'/'desktop'), `iconSize`, `allTiers`, `itemsPerTier`, `groups`, `getItemGroup`, `getItemName` |

### Error Boundaries

| Need | Component | Path |
|------|-----------|------|
| Full-page error | `PageErrorBoundary` | `shared/ErrorBoundary.tsx` |
| Section-level error | `SectionErrorBoundary` | `shared/ErrorBoundary.tsx` |

---

## Styling Rules

- Use `cn()` (from `lib/utils.ts`) to merge Tailwind classes. Never concatenate class strings manually.
- **NEVER** use opacity on `text-muted-foreground` (e.g., `text-muted-foreground/50`). It's already muted — opacity makes text unreadable.
- Same for `border-muted-foreground/` — use `border-border` or `border-muted-foreground` without opacity.
- Color helpers: `getRarityColor(rarity, "bg"|"text")`, `getElementColor(element, "bg"|"text")`, `getTierColor(tier, "bg"|"text")`.
- Asset URLs: always use `getAssetUrl(path)` for images (handles Vite BASE_URL for GitHub Pages).
- Theme: 9 palettes via `ThemeContext` + `themeGenerator.ts`. CSS variables applied at runtime.

---

## Responsive Patterns

- **Mobile first**: Design for small screens, add desktop breakpoints.
- **Mobile ↔ Desktop dialogs**: Use `Drawer` (vaul) for mobile, `Popover`/`Dialog` for desktop. See `ItemPicker.tsx` for the canonical pattern.
- Many components accept `compact?: boolean` for mobile optimization.
- Use `useMediaQuery()` hook for responsive logic.
- `SidebarLayout` handles mobile (Sheet trigger) vs desktop (fixed sidebar) automatically.

---

## Project Structure

### Directory Map

- `src/pages/` — Route-level page components (Home, AccountData, ArtifactBuilds, TierList, Archive, TeamComp)
- `src/components/{domain}/` — Domain UI: `account-data`, `artifact-builds`, `tier-list`, `team-comp`, `archive`
- `src/components/shared/` — Cross-domain reusable components (see table above)
- `src/components/ui/` — shadcn/ui primitives + custom widgets (`tour`, `responsive-dialog`, `weighted-select`)
- `src/components/layout/` — Layout shells (PageLayout, AppBar, SidebarLayout, etc.)
- `src/stores/` — One Zustand store per domain (persist to `localStorage`)
- `src/data/` — Static JSON resources, `types.ts`, `constants.ts`, localization files
- `src/lib/` — Pure logic: filter computation, artifact scoring, damage calculation (`team-comp/`), build evaluation, insight engine
- `src/hooks/` — `useResolvedBuilds`, `useAsyncCompute`, `useMediaQuery`, `useGlobalScroll`
- `src/contexts/` — `LanguageContext` (EN/ZH), `ThemeContext` (9-palette via `themeGenerator.ts`)
- `src/presets/` — Bundled preset JSONs for artifact builds, character tier lists, weapon tier lists
- `src/config/` — Navigation config (`appNavigation.tsx`), character info
- `scripts/` — Python ETL (Enka, Hakush.in, HoYoLab, Fandom). Run `update_data.cmd` or `uv run --project scripts/pyproject.toml scripts/<script>.py`
- `docs/` — Design docs, product specs, roadmap

### Pages & Tabs

Navigation config: `src/config/appNavigation.tsx`.

| Route | Page | Tabs |
|-------|------|------|
| `/` | Home | — |
| `/account-data` | Account Data | Characters, Recommendations, Inventory, Evaluation, Triage |
| `/artifact-filter` | Artifact Filter | Configure, Compute Filters, AutoTune |
| `/tier-list` | Tier List | Characters, Weapons |
| `/archive` | Archive | Characters, Weapons, Artifacts, Bosses |
| `/team-comp` | Team Comp | — (detail view via internal state) |

---

## Data Flow

1. **Static game data** (`src/data/*.json`) is the immutable source of truth.
2. **User data** enters via GOOD Format (JSON), Mona/yas Format (artifact-only JSON), Enka.Network (UID), or preset subscription → persists in `localStorage`.
3. **Preset system**: presets in `src/presets/artifact-builds/` serve as the **Immutable Base**. They DO NOT exist in `useBuildsStore` directly.
4. **Build Store (`useBuildsStore`)**: Contains **ONLY** User Overrides, Custom Builds, and Ordering. It is a Delta Store. **DO NOT** read `builds` directly for scoring.
5. **Build Resolution**: `useResolvedBuilds` (single char) / `useAllResolvedBuilds` (all chars) are the **Single Source of Truth**. They merge Preset Base + Store Deltas.
   - **Rule**: Always use these hooks to get builds. Never traverse `useBuildsStore.builds` or `presetRegistry` manually.
6. **Merge → Filter pipeline**: `greedyMerge` / `smartMerge` → `computeFilters` → lock/trash scripts.
7. **Zero `any`**: all external data must be typed and validated.

---

## Key Domain Systems

### Build Evaluation & Insight Engine (Account Data)

`src/lib/account-data/`:
- **Build Evaluation** (`buildEvaluation.ts`): Per-character archetype classification (DPS/Support), slot completion, efficiency tiers (S/A/B/C/F).
- **Insight Engine** (`insightEngine.ts`): Generates actionable recommendations (EQUIP, SWAP, UPGRADE, REROLL, FARM, FIX_MAIN) with score differentials.
- **Triage** (`triage/`): Probability-based artifact evaluation with P/Q/N/T tiers and special rules.
- **AutoTune** (`scoring/autoTune.ts`): Generates stat weights via marginal damage analysis using real TeamBuild calculator.

### Damage Calculation (Team Comp)

`src/lib/team-comp/`:
- **Character implementations** (`impl/`): 70+ characters with per-character formulas, buffs, and `defaultRotation` data.
- **Damage formulas** (`damageFormulas.ts`): 6 formula types (Direct, Amplify, Catalyze, Transform, Lunar, LunarDirect).
- **Buff system** (`damageBuffs.ts`): StatBuff, ScalingBuff, CrossScalingBuff with source tracking and buff validation.
- **Stat resolution** (`damageModels.ts`): StatSheet (immutable two-level map), zone-based damage with DamageTagFilter scoping.
- **Optimizer V2** (`optimizer/`): Branch-and-bound per-character → conflict-aware team DFS. Web Worker parallelization.
- **Combo/Rotation** (`types.ts`): Multi-character rotation evaluation with per-line reaction overrides.

### Cloudflare Functions (CORS Proxy)

`functions/api/enka/[[path]].ts` — proxies `/api/enka/*` → `https://enka.network/api/*` for CORS. Frontend caller: `src/lib/account-data/enkaFetcher.ts`.

---

## Localization

- **`i18n-ui.ts`**: Static UI strings. **CRITICAL**: `t.ui()` calls MUST use string literals (e.g., `t.ui('common.save')`), never dynamically constructed keys. I18n tests enforce this.
- **`i18n-app.ts`**: Dynamic terms via custom hooks on `t`, for enum concept labels. No tests.
- **`i18n-game.ts`**: Game entity names, auto-generated by scrapers.
- **Usage**: `const { t } = useLanguage()` → `t.ui("key")`, `t.character("id")`, `t.weaponEffect("id")`.

---

## Commands

- `npm run dev` — Vite + Wrangler dev server (Cloudflare Functions proxy)
- `npm run dev:vite` — Vite only (no Cloudflare Functions)
- `npm run build` / `build:tauri` — Production build (Web / Tauri Desktop)
- `npm run lint` / `lint:fix` — Biome check / auto-fix
- `npm run type-check` — TypeScript check (src + tests tsconfigs)
- `npm run test` / `test:watch` / `test:coverage` — Vitest unit tests
- `npm run test:e2e` / `test:e2e:ui` — Playwright e2e tests

### Safe & Piped Variants (Agent Use)
Agents must use these to avoid explicit pipe (`|`) or redirect (`2>&1`):
- `npm run type-check:head` / `lint:head` / `test:head` — First 20 lines. Pass `-- N` to change.
- `npm run type-check:tail` / `lint:tail` / `test:tail` — Last 20 lines.
- `npm run type-check:headtail` / `lint:headtail` / `test:headtail` — First 15 + last 15.
- `npm run type-check:filter -- "Error"` / `lint:filter -- "Pattern"` / `test:filter -- "Pattern"` — Grep output.

---

## Development Rules

### Architecture
- **`SidebarLayout`**: Drawer on mobile, fixed sidebar on desktop (lg+). Standard for pages with filter panels.
- **`AppBar`**: Sticky header. Actions via `ActionConfig[]`; dialog controls use ref forwarding (`useImperativeHandle`).
- **Mobile first**: `Drawer` (vaul) for mobile, `Popover` for desktop. See `ItemPicker.tsx`.

### Testing
- Unit tests in `tests/` mirror `src/`. Use `@/` path alias.
- Store tests: use `useStore.getState()` to verify state after actions.

### Terminal Hygiene
- Avoid `|` pipe and `2>&1` / `>` redirection (triggers safety review).
- Never inline Python/JS code in terminal commands. Write a temporary file under `temp/`, run it, then delete it.

### File Safety
- **Never run destructive scripts directly on source files.** Write output to `.new` or `.tmp` first, diff/inspect, then replace.
- Before bulk file transformations, back up the target file.
- Test regex patterns with dry-run (print matches only) before applying.
