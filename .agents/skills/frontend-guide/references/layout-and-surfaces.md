# Layout And Surfaces

Use this when creating or reorganizing pages, cards, filters, toolbars, or
entity displays.

## Layout Selection

Every page lives inside `PageLayout`; choose the inner layout from existing
components.

| Situation | Prefer | File |
| --- | --- | --- |
| Sidebar filters plus scrollable content | `SidebarLayout` | `src/components/layout/SidebarLayout.tsx` |
| Dense data with inline filter bar | `WideLayout` | `src/components/layout/WideLayout.tsx` |
| Simple scrollable content with optional header | `ScrollLayout` | `src/components/layout/ScrollLayout.tsx` |
| Browse list plus detail panel | `SidebarDetailLayout` | `src/components/layout/SidebarDetailLayout.tsx` |
| Tool/calculator with stacked sections | Existing page-local `flex-1 min-h-0 overflow-y-auto` pattern | Inspect sibling calculator pages |

Do not rebuild sidebar-to-sheet, sticky header, or scroll-boundary behavior when
a layout component already owns it.

## Scroll Structure

- Outer page shell: `overflow-hidden` when it owns the viewport.
- Scroll body: `flex-1 min-h-0 overflow-y-auto`.
- Sticky headers inside scroll: `sticky top-0 z-10`.
- Avoid nested scroll regions unless a current sibling page already uses the
  pattern successfully.

## Primary Surfaces

The app's main visual identity comes from theme-generated gradients.

Use for primary content panels:

```tsx
className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg"
```

Use for panel headers and toolbars:

```tsx
className="bg-gradient-select border-b border-border/70 px-4 py-2.5"
```

Use `bg-background/50 border border-border` for small inputs inside cards.

`bg-card`, `bg-card/30`, and `bg-card/50` are not banned everywhere. Treat them
as secondary chrome: nested rows, search fields, subtle detail boxes, or existing
page-family patterns. Do not use them as the default primary card treatment for
new major content panels.

## Typography

| Level | Default classes | Use for |
| --- | --- | --- |
| Page title | `text-xl md:text-2xl font-bold` | Page and WideLayout titles |
| Section header | `text-sm font-semibold` | Section and card headings |
| Label | `text-sm font-medium` | Form labels and row headers |
| Body | `text-sm` | Default content |
| Small | `text-xs` | Badges, chips, compact metadata |
| Muted | `text-muted-foreground` | Low-emphasis supporting text |

- Avoid `text-[10px]` or smaller for normal UI labels.
- Use `tabular-nums` for updating numbers, aligned stats, timers, and columns.
- Prefer wrapping over truncation when the text is meaningful to the user.

## Entity Display

| Context | Prefer | Notes |
| --- | --- | --- |
| Prominent, unique entity | `ItemIcon` | Detail panels, team cards, selected targets |
| Compact repeated entity | `CharAvatar` | Inline rows, chips, timeline blocks |
| Dense metadata or prose | Text only | Acceptable when identity is already obvious |

For element accents, import `getElementColor` from `src/lib/utils.ts`.
Use gradient card surfaces as the base, then add element text or border accents.
Do not use subtle element backgrounds as the only card background.

## Controls And Filters

| Need | Prefer |
| --- | --- |
| Mutually exclusive mode selector | `ToggleGroup` + `ToggleGroupItem` |
| Dropdown select | `Select` |
| On/off setting | `Switch` paired with `Label` |
| Filter chips | `FilterChip` or `FilterChipGroup` from `src/components/shared/` |
| Action button | `Button` with an existing variant |
| Numeric field | Native number input styled to match nearby controls |

Use `FilterChipGroup` when empty-means-all or controlled multi-select semantics
fit the feature. Keep special cases local when the abstraction cannot represent
the required behavior, such as a filter that must always keep at least one
option selected.

Toolbar/card-header pattern:

```tsx
<div className="bg-gradient-select border-b border-border/70 px-4 py-2.5 flex flex-wrap items-center gap-4">
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Label</span>
    {control}
  </div>
  <div className="h-5 w-px bg-border hidden sm:block" />
</div>
```
