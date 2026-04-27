---
name: frontend-guide
description: >
  UI design decision guide for building consistent frontend pages.
  TRIGGER when: building new pages, components, or layouts — any task that
  produces user-facing HTML/JSX and requires non-trivial UX design.
  DO NOT TRIGGER for: backend logic, data processing, tests, or build config.
  Skip if instruction is already mechanically clear on UI component changes.
---

# Frontend Guide

This skill helps you build UI that matches the existing app. Read from top to bottom — each section is a decision point. Stop reading when you have what you need.

**Critical context:** This app supports 9 themes (Abyss, Mondstadt, Liyue, Inazuma, Sumeru, Fontaine, Natlan, Snezhnaya, Nod-Krai). All themes are generated from 3 HSL seeds via `src/lib/themeGenerator.ts`. Every visual choice must work across all themes — never hardcode colors or assume a specific palette.

## 1. Pick a Layout

Every page lives inside `<PageLayout>` (handles AppBar, viewport, gradient background). Your job is choosing the inner layout.

| Situation                                  | Layout                                                                      | File                                            |
| ------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------- |
| Sidebar filters + scrollable content       | `SidebarLayout`                                                             | `src/components/layout/SidebarLayout.tsx`       |
| Dense table/data with inline filter bar    | `WideLayout`                                                                | `src/components/layout/WideLayout.tsx`          |
| Simple scrollable content, optional header | `ScrollLayout`                                                              | `src/components/layout/ScrollLayout.tsx`        |
| Browse list → detail panel (archive style) | `SidebarDetailLayout`                                                       | `src/components/layout/SidebarDetailLayout.tsx` |
| Tool/calculator with stacked sections      | No layout component — use `flex-1 overflow-y-auto` with `max-w-6xl mx-auto` |

All layouts handle responsive behavior (sidebar → Sheet on mobile, sticky headers, scroll boundaries). Don't reinvent these patterns.

## 2. Card & Section Surfaces

**The app's visual identity comes from gradient backgrounds, not flat colors.** The theme system generates `--gradient-card` and `--gradient-select` CSS variables for each theme. These are the primary surface treatments.

**Card surfaces** — use the gradient card system from `src/components/team-comp/cardStyles.ts`:

```tsx
// Card container
className =
  "rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg";

// Card header (darker gradient, reversed direction)
className = "bg-gradient-select border-b border-border/70 px-4 py-2.5";

// Card body
className = "p-3 md:p-4";
```

**When to use what:**
| Surface | Class | Use for |
|---|---|---|
| Card/section container | `bg-gradient-card border border-border shadow-lg` | Primary content panels |
| Card/section header | `bg-gradient-select border-b border-border/70` | Section titles, toolbar bars |
| Small inputs (select, number) | `bg-background/50 border border-border` | Form elements inside cards |
| Action buttons inside cards | `border border-border hover:bg-accent` | Inline action triggers |

**Never use:**

- `bg-card` alone for card surfaces — it's the flat fallback color (very dark), not the visual treatment. It creates lifeless dark boxes that don't match the app.
- `bg-card/30`, `bg-card/50` — invisible against the page gradient.
- Any hardcoded `hsl()` or hex colors for surfaces — breaks theming.

## 3. Show Characters and Items

**Choose based on context:**

| Context                                                   | Use                         | Why                                  |
| --------------------------------------------------------- | --------------------------- | ------------------------------------ |
| Prominent, unique (team card, detail panel)               | `ItemIcon`                  | Rarity bg, badges, proper sizing     |
| Compact, repeated many times (timeline blocks, list rows) | `CharAvatar` or raw `<img>` | Lightweight, doesn't dominate layout |
| Text-only reference                                       | Never                       | Hard to scan, no visual identity     |

**`ItemIcon`** from `src/components/shared/ItemIcon.tsx`:

```tsx
<ItemIcon characterId="bennett" size="xs" />
<ItemIcon characterId="bennett" badge={6} level="Lv.90" elementBadge="Pyro" />
```

Sizes: `xs` (40px), `sm` (48px), `md` (56px), `lg` (64px), `xl` (80px).

**Circular avatar** — for inline/compact contexts where 40px is too large:

```tsx
// See CharAvatar in src/components/ercalc/CharAvatar.tsx
<CharAvatar charId="bennett" size={20} />
```

Use 18-24px for inline blocks, paired with action labels or short text.

## 4. Use Element Colors

Import `getElementColor` from `src/lib/utils.ts`.

| Variant      | Use for                                 | Example                                             |
| ------------ | --------------------------------------- | --------------------------------------------------- |
| `"text"`     | Character names, labels                 | `text-element-pyro` (full saturation)               |
| `"bg"`       | Action blocks, timeline tags, bar fills | `bg-element-pyro/60`                                |
| `"border"`   | Card borders with element accent        | `border-element-pyro/40`                            |
| `"bgSubtle"` | Never as sole background                | `bg-element-pyro/20` — pair with `bg-gradient-card` |

**Element colors on cards:** Use `bg-gradient-card` as the base surface + element `"border"` for accent + element `"text"` for character name. Never use element `"bgSubtle"` as the only card background.

## 5. Typography Hierarchy

| Level          | Classes                         | Use for                       |
| -------------- | ------------------------------- | ----------------------------- |
| Page title     | `text-xl md:text-2xl font-bold` | WideLayout titles             |
| Section header | `text-sm font-semibold`         | Section/card headings         |
| Label          | `text-sm font-medium`           | Form labels, row headers      |
| Body           | `text-sm`                       | Default content               |
| Small          | `text-xs`                       | Badges, chips, secondary info |
| Muted          | `text-muted-foreground`         | Non-essential info only       |

**Rules:**

- Minimum readable size is `text-xs` (12px). Never use `text-[10px]` or smaller.
- Never add opacity modifiers to `text-muted-foreground` — it's already muted.
- `font-semibold` (600) for headings, `font-medium` (500) for labels, `font-bold` (700) for emphasis values.
- Use `tabular-nums` on numbers that update or align in columns.

## 6. Interactive Controls

**Existing components to use first** (in `src/components/ui/`):

| Need                               | Component                         | Notes                                                                         |
| ---------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Mode selector (mutually exclusive) | `ToggleGroup` + `ToggleGroupItem` | `variant="outline"`, wrap in a flex row                                       |
| Dropdown select                    | `Select`                          | Radix-based, handles keyboard                                                 |
| On/off toggle                      | `Switch`                          | Paired with `Label`                                                           |
| Filter chips                       | `FilterChip`                      | `src/components/archive/FilterChip.tsx`                                       |
| Action button                      | `Button`                          | `variant="default"` / `"outline"` / `"ghost"`                                 |
| Number input                       | Native `<input type="number">`    | Style: `rounded-md border border-border bg-background/50 text-center text-xs` |

**Toolbar / control bar pattern** — use as a card header:

```tsx
<div className="bg-gradient-select border-b border-border/70 px-4 py-2.5 flex flex-wrap items-center gap-4">
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Label</span>
    {control}
  </div>
  <div className="h-5 w-px bg-border hidden sm:block" />
  ...
</div>
```

## 7. Responsive Patterns

**Breakpoints:** `sm` (640), `md` (768), `lg` (1024), `xl` (1280), `2xl` (1536)

**Common patterns:**

- Sidebar on desktop, Sheet on mobile → handled by `SidebarLayout`
- 4-column grid → `grid grid-cols-2 sm:grid-cols-4`
- Hide on mobile → `hidden md:flex` / `hidden lg:block`
- Full-width on mobile, inline on desktop → `basis-full md:basis-auto`

**Scrolling structure** (critical — don't break this):

- Outer container: `overflow-hidden` (prevents page scroll)
- Inner content area: `flex-1 min-h-0 overflow-y-auto`
- Sticky headers inside scroll: `sticky top-0 z-10`

## 8. UX Principles

**Group inputs vs outputs.** Users need to know what's configurable (inputs) vs what's computed (results). Put related inputs in the same card. Visually separate output sections.

**Label controls for players, not developers.** Mode selectors, dropdowns, and toggles should have:

- A short label (e.g., "Mode")
- A description explaining what the selected option does in plain language
- Presets with player-facing names instead of raw numbers (e.g., "None (Boss)" not "0")

**Show calculation context inline.** When the UI displays computed values, annotate the inputs that drive them:

- Timeline action blocks that produce particles → show `+N` particle count badge
- Burst actions that drain energy → show `-N` cost badge, ring highlight
- ER result bars → show `particleEnergy / burstCost` overlay

## 9. Anti-Patterns

| Don't                                    | Why                                              | Do instead                                          |
| ---------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| `bg-card` for card surfaces              | Flat dark box, doesn't match app visual identity | `bg-gradient-card` with `shadow-lg`                 |
| `bg-card/30`, `bg-card/50`               | Invisible against page gradient                  | `bg-gradient-card` or `bg-background/50` for inputs |
| `text-muted-foreground/50`               | Unreadable — already muted                       | `text-muted-foreground` without opacity             |
| Text-only character references           | Hard to scan, no visual identity                 | `ItemIcon` or `CharAvatar`                          |
| Abbreviated i18n ("周E", "hE", "W")      | Cryptic, not player-facing                       | Full words: "Hold E", "长按E", "Wait", "等待"       |
| Hardcoded hex/hsl colors                 | Breaks multi-theme support (9 themes)            | CSS variables via Tailwind classes                  |
| `text-[10px]` or smaller                 | Unreadable                                       | `text-xs` minimum                                   |
| Raw number inputs for presets            | Users don't know valid ranges                    | Dropdown with named presets                         |
| Inputs and outputs at same visual level  | No flow guidance                                 | Group inputs in one card, separate results          |
| Building UI without checking other pages | Inconsistent look                                | Screenshot 2-3 existing pages first for reference   |

## 10. Quick Reference: Key Files

| Purpose                                  | Path                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| UI primitives (35 components)            | `src/components/ui/`                                                     |
| Layout components                        | `src/components/layout/`                                                 |
| Theme generator (9 themes, 3 seeds each) | `src/lib/themeGenerator.ts`                                              |
| Card shared styles (gradient pattern)    | `src/components/team-comp/cardStyles.ts`                                 |
| Color helpers                            | `src/lib/utils.ts` — `getElementColor`, `getRarityColor`, `getTierColor` |
| Asset URL helper                         | `src/lib/utils.ts` — `getAssetUrl`                                       |
| Character/item display                   | `src/components/shared/ItemIcon.tsx`                                     |
| Character metadata                       | `src/data/charInfo.ts`, `src/data/resources.ts`                          |
| Theme CSS variables                      | `src/index.css` — `:root` layer (base only; themes override via JS)      |
| Tailwind config                          | `tailwind.config.ts`                                                     |
| i18n UI strings                          | `src/data/i18n-ui.ts`                                                    |
