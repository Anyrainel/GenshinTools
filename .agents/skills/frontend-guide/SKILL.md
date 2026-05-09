---
name: frontend-guide
description: >
  UI design decision guide for GenshinTools. Use only for open-ended frontend
  design work: new surfaces, substantial redesigns, or unclear UX/layout
  choices where the agent must choose the structure. Do not use for direct user
  instructions, bug fixes, copy tweaks, mechanical UI changes, or routine edits
  where nearby code already shows the pattern.
---

# Frontend Guide

Use this skill only when the task needs new design judgment for GenshinTools UI:
new surfaces, substantial redesigns, or ambiguous layout/interaction choices.
Keep the entrypoint light: load reference files only when the task needs that
detail.

Do not use this skill for direct implementation requests where the user already
specified what to change. In those cases, follow the user's instruction, inspect
nearby code, and make the narrowest compatible edit.

## Applicability

Use this skill for:

- Creating a new page, dialog, drawer, workflow, or dense visual surface.
- Redesigning or reorganizing an existing UI surface.
- Choosing layout, surface hierarchy, responsive behavior, interaction states,
  or explanatory structure when the request leaves those decisions open.
- Reviewing a proposed UI direction when the user asks for design guidance.

Skip this skill for:

- Explicit changes with a clear target, such as "make this 3 columns", "move
  this button", "rename this label", or "show this status text".
- Bug fixes, data/store changes, tests, generated data, build config, and import
  or persistence plumbing.
- Small follow-up refinements to an established component or page pattern.
- Copy or i18n wording updates unless the user asks for broader explanatory
  design.
- Routine control additions where the surrounding component already shows the
  correct pattern.

## Core Workflow

1. Identify the page family and task shape: account data, archive, team comp,
   tier list, calculator, dialog/drawer, dense table, card grid, or detail panel.
2. Inspect 2-3 nearby examples in the same family before choosing structure or
   styling. Prefer current code over this guide when they conflict.
3. Apply the hard repo invariants from `references/repo-invariants.md`.
4. For explanatory surfaces, load
   `references/explanatory-copy-and-visuals.md` before drafting copy or visual
   aids.
5. Pick an existing layout/component pattern before adding new structure.
6. Use player-facing labels and i18n-backed strings for visible text.
7. Verify the changed surface at mobile and desktop widths. For larger visual
   changes, also check at least one non-default theme.

## When To Load References

Only load these references after the task passes the applicability test above.

- `references/repo-invariants.md`: Read after this skill applies and before
  substantial design-led UI edits. It contains hard constraints for theming,
  assets, i18n, component imports, error handling, and store/persistence
  boundaries.
- `references/layout-and-surfaces.md`: Read when creating or reorganizing a
  page, choosing card/surface styles, displaying characters/items, or designing
  filters/toolbars.
- `references/explanatory-copy-and-visuals.md`: Read when writing help dialogs,
  onboarding, empty states, tooltips, algorithm explanations, score
  explanations, or any visual aid whose job is to teach behavior.
- `references/ux-checklist.md`: Read when adding design-led interactions,
  forms, async states, dense data views, responsive behavior, or before
  finishing a visible redesign.

## Decision Priorities

Use this order when rules compete:

1. Explicit user instructions for the requested surface.
2. Repo invariants and accessibility.
3. Accuracy against actual behavior and domain rules.
4. Existing page-family patterns.
5. Player workflow clarity, explanatory clarity, and scanability.
6. Visual polish consistent with the theme system.
7. Local convenience or implementation speed.

## Fast Defaults

- Use `cn()` from `src/lib/utils.ts` for conditional classes.
- Use existing layout components from `src/components/layout/` before custom
  scroll shells.
- Use `bg-gradient-card` / `bg-gradient-select` for primary content panels and
  their headers when the surrounding page family uses that surface language.
  Do not add decorative cards or boxes only to make explanatory content look
  designed.
- Use `ItemIcon` or `CharAvatar` when identity scanning matters; text-only
  references are acceptable only for low-emphasis prose or compact metadata.
- Use shared filter chips from `src/components/shared/FilterChip.tsx` and
  `src/components/shared/FilterChipGroup.tsx` when the selection semantics fit.
- Keep body text at `text-sm` and compact metadata at `text-xs`; do not add
  opacity modifiers to `text-muted-foreground`.
- Group inputs separately from computed outputs, especially in calculators and
  scored decision workflows.

## Finish Checklist

- Visible strings use `t.ui()` literal keys or the relevant app/game i18n path.
- Images and game assets pass through `getAssetUrl(path)`.
- The layout has no accidental page scroll, nested scroll conflict, or mobile
  horizontal overflow.
- Loading, empty, disabled, error, and destructive states are represented when
  the workflow can reach them.
- Keyboard/focus behavior is preserved for dialogs, popovers, menus, and form
  controls.
- Explanatory visuals encode real rules, ordering, inclusion, transformation,
  or state changes; remove visuals that only decorate the prose.
