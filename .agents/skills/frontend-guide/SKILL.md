---
name: frontend-guide
description: >
  UI design decision guide for GenshinTools frontend work. Use when building,
  refactoring, reviewing, or materially changing user-facing React/TypeScript
  UI, including pages, layouts, components, dialogs, cards, controls,
  responsive behavior, visual systems, interaction states, or UX quality.
  Skip for backend-only logic, data processing, tests, build config, or tiny
  mechanical edits where the UI pattern is already obvious from nearby code.
---

# Frontend Guide

Use this skill to make GenshinTools UI changes fit the existing app instead of
inventing a new visual system. Keep the entrypoint light: load reference files
only when the task needs that detail.

## Core Workflow

1. Identify the page family and task shape: account data, archive, team comp,
   tier list, calculator, dialog/drawer, dense table, card grid, or detail panel.
2. Inspect 2-3 nearby examples in the same family before choosing structure or
   styling. Prefer current code over this guide when they conflict.
3. Apply the hard repo invariants from `references/repo-invariants.md`.
4. Pick an existing layout/component pattern before adding new structure.
5. Use player-facing labels and i18n-backed strings for visible text.
6. Verify the changed surface at mobile and desktop widths. For larger visual
   changes, also check at least one non-default theme.

## When To Load References

- `references/repo-invariants.md`: Always read before substantial UI edits.
  It contains hard constraints for theming, assets, i18n, component imports,
  error handling, and store/persistence boundaries.
- `references/layout-and-surfaces.md`: Read when creating or reorganizing a
  page, choosing card/surface styles, displaying characters/items, or adding
  filters/toolbars.
- `references/ux-checklist.md`: Read when adding interactions, forms, async
  states, dense data views, responsive behavior, or before finishing a visible
  UI change.

## Decision Priorities

Use this order when rules compete:

1. Repo invariants and accessibility.
2. Existing page-family patterns.
3. Player workflow clarity and scanability.
4. Visual polish consistent with the theme system.
5. Local convenience or implementation speed.

## Fast Defaults

- Use `cn()` from `src/lib/utils.ts` for conditional classes.
- Use existing layout components from `src/components/layout/` before custom
  scroll shells.
- Use `bg-gradient-card` / `bg-gradient-select` for primary content panels and
  their headers; use lower-emphasis `bg-card/*` surfaces only when nearby code
  clearly uses them as nested chrome or subtle secondary containers.
- Use `ItemIcon` or `CharAvatar` when identity scanning matters; text-only
  references are acceptable only for low-emphasis prose or compact metadata.
- Use shared filter chips from `src/components/shared/FilterChip.tsx` and
  `src/components/shared/FilterChipGroup.tsx` when the selection semantics fit.
- Keep body text at `text-sm` and compact metadata at `text-xs`; do not add
  opacity modifiers to `text-muted-foreground`.
- Group inputs separately from computed outputs, especially in calculators and
  recommendation/evaluation views.

## Finish Checklist

- Visible strings use `t.ui()` literal keys or the relevant app/game i18n path.
- Images and game assets pass through `getAssetUrl(path)`.
- The layout has no accidental page scroll, nested scroll conflict, or mobile
  horizontal overflow.
- Loading, empty, disabled, error, and destructive states are represented when
  the workflow can reach them.
- Keyboard/focus behavior is preserved for dialogs, popovers, menus, and form
  controls.
