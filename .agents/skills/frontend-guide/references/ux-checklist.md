# UX Checklist

Use this for interaction-heavy UI, dense data views, forms, async states,
responsive work, or final review of visible changes.

## Workflow Clarity

- Group configurable inputs separately from computed outputs.
- Label controls for players, not developers.
- Prefer named presets over raw numeric options when users need context.
- Show calculation context inline when a value depends on hidden inputs:
  particle gains, burst costs, score components, thresholds, ownership, or
  selected build assumptions.
- Do not duplicate engine logic in the UI to explain results unless the engine
  exposes that explanation as data.

## Interaction States

- Provide visible hover, focus, active, disabled, loading, empty, and error
  states when the workflow can reach them.
- Do not rely on hover for primary actions; support click/tap-visible controls.
- Disable or guard repeated async actions while the operation is in flight.
- Destructive actions need confirmation, undo, or a clearly local recovery path.
- Icon-only buttons need accessible labels.

## Forms And Settings

- Inputs need visible labels.
- Complex settings need short helper text near the control.
- Validation errors should appear near the field or affected section.
- Settings that affect persisted behavior must be wired through UI, store,
  schema/default handling, and tests together.

## Responsive Rules

- Check at least one mobile and one desktop viewport.
- Avoid horizontal scroll on mobile.
- Prefer `grid grid-cols-2 sm:grid-cols-4` for simple 4-column card grids.
- Use `basis-full md:basis-auto` when controls should wrap on mobile and align
  inline on desktop.
- Use `hidden md:flex` / `hidden lg:block` only for genuinely secondary content;
  do not hide required controls without an alternate path.
- Make fixed-format controls stable with explicit dimensions, aspect ratios, or
  grid tracks so dynamic labels and hover states do not shift layout.

## Accessibility

- Preserve semantic controls and keyboard access for dialogs, popovers, menus,
  tabs, and forms.
- Keep focus states visible.
- Do not convey status by color alone; add text, icon, shape, or position.
- Ensure meaningful images have alt text and decorative images are ignored by
  assistive tech.
- Respect reduced-motion preferences for nonessential animation.

## Visual Review

- Compare against 2-3 sibling screens in the same page family.
- Check text fit in buttons, chips, cards, sidebars, and dialogs.
- Avoid oversized hero-style typography inside dense tools, cards, and panels.
- Prefer concise player-facing copy over implementation detail.
- For theme-sensitive surface work, spot-check at least one alternate theme.

## Common Anti-Patterns To Catch

| Avoid | Prefer |
| --- | --- |
| Primary cards built with only `bg-card` | `bg-gradient-card` primary surfaces |
| `text-muted-foreground/50` | `text-muted-foreground` |
| Raw hex/HSL colors in components | Theme tokens and helper color utilities |
| Text-only identity in scan-heavy grids | `ItemIcon` or `CharAvatar` |
| Abbreviated player actions like `hE` or `W` | Full labels such as `Hold E` or `Wait` |
| Raw numeric presets without explanation | Named presets with short helper text |
| UI-side recalculation of engine warnings | Engine-provided warnings or explicit unimplemented notices |
