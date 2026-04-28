# Repo Invariants

Read this for substantial UI work. These rules are not model-failure defenses;
they are repository contracts.

## Theme And Color

- The app supports 9 generated theme palettes through `ThemeContext` and
  `src/lib/themeGenerator.ts`.
- Never hardcode hex, RGB, or HSL values in UI components unless editing an
  established token generator or a narrowly scoped visualization that already
  owns its color scale.
- Prefer Tailwind theme tokens and helper utilities:
  - `getElementColor`
  - `getRarityColor`
  - `getTierColor`
- Do not add opacity modifiers to `text-muted-foreground` or `border-border`.
  They are already low-emphasis in the current themes.
- Use `text-muted-foreground` only for secondary or low-attention text.

## Class Names And Components

- Use `cn()` from `src/lib/utils.ts` when class names are conditional.
- Prefer existing `src/components/ui/` primitives, Radix wrappers, Vaul drawer
  patterns, and local shared components over custom controls.
- For mobile/desktop dialog variants, follow the existing Drawer/Popover/Dialog
  pattern used by `src/components/shared/ItemPicker.tsx`.
- Use lucide icons for common UI actions when an icon exists.

## Assets And Entity Display

- Always wrap image paths with `getAssetUrl(path)`.
- Use `src/components/shared/ItemIcon.tsx` for prominent character, weapon, or
  artifact identity display.
- Use `src/components/shared/CharAvatar.tsx` for compact inline character
  identity display.
- Text-only entity references are acceptable for prose, table cells with other
  strong context, or very dense metadata; use visual identity when the user must
  scan many entities.

## I18n

- Static UI text lives in `src/data/i18n-ui.ts`.
- Dynamic app terms and enum labels live in `src/data/i18n-app.ts`.
- Generated game entity names live in `src/data/i18n-game.ts`.
- `t.ui()` calls must use string literals, not constructed keys.
- Visible labels should read like player-facing product copy, not developer
  implementation notes.
- Chinese copy should use natural community wording and official/game-appropriate
  names. Do not translate game concepts literally from English.

## Error And Async Handling

- UI actions and async flows should report user-visible failures with the local
  toast, dialog, or empty-state pattern near the call site.
- Preserve existing partial-success patterns for import/conversion flows.
- Throw for invalid internal invariants, corrupted bundled/generated data, or
  impossible states.
- Return `null` only for expected absence or infeasible domain outcomes.
- Use domain-specific unions/results when callers need to branch on known
  recoverable failure modes.
- Do not introduce a repo-wide generic `Result<T>` abstraction.

## Store And Persistence Boundaries

- Before changing persisted store shape, inspect the store, migration code,
  schema healing, `partialize`, `migrate`, `merge`, and nearby tests.
- Default-only behavior changes usually belong in live defaults/schema healing,
  not forced migrations.
- Reserve persisted-store version bumps for real semantic or shape migrations.
- When removing retired UI preferences, remove stale store/schema plumbing too.
