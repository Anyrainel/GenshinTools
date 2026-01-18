# shadcn/ui Component Customizations

This document tracks intentional customizations made to shadcn/ui components in this project.

> **Last Verified**: 2026-01-18
> **shadcn Version**: Latest (npx shadcn@latest)
> **Style**: new-york

## Overview

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Identical | 21 | Stock shadcn components (may have formatting differences) |
| 🔧 Customized | 6 | Intentionally modified for project needs |

## Stock Components (Identical to shadcn)

These components match the latest shadcn and can be safely updated:

`accordion`, `alert`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `hover-card`, `label`, `navigation-menu`, `popover`, `progress`, `radio-group`, `scroll-area`, `sheet`, `slider`, `sonner`, `switch`, `table`, `tabs`, `toggle-group`, `tooltip`

## Customized Components

### `button.tsx`

**Purpose**: Custom hover colors and sizing for the Genshin aesthetic

| Property | shadcn Default | Our Customization |
|----------|----------------|-------------------|
| `outline` hover | `hover:bg-accent` | `hover:bg-blue-500/20 hover:border-blue-400/40` |
| `ghost` hover | `hover:bg-accent` | `hover:bg-blue-500/20` |
| Default height | `h-9` | `h-10` |
| `sm` height | `h-8` | `h-9` |
| `lg` height | `h-10` | `h-11` |
| `icon` size | `h-9 w-9` | `h-10 w-10` |
| Focus ring | `ring-1` | `ring-2` with `ring-offset-2` |
| Shadow | `shadow` on default/outline | No shadow |

### `badge.tsx`

**Purpose**: Pill-shaped badges without bold text

| Property | shadcn Default | Our Customization |
|----------|----------------|-------------------|
| Border radius | `rounded-md` | `rounded-full` (pill) |
| Font weight | `font-semibold` | Removed (regular weight) |
| Extra classes | - | `whitespace-nowrap` |
| Shadow | `shadow` on default/destructive | No shadow |

### `card.tsx`

**Purpose**: Semantic HTML and adjusted styling

| Property | shadcn Default | Our Customization |
|----------|----------------|-------------------|
| `Card` radius | `rounded-xl` | `rounded-lg` |
| `Card` shadow | `shadow` | No shadow |
| `CardTitle` element | `<div>` | `<h3>` |
| `CardTitle` size | No size class | `text-2xl` |
| `CardDescription` element | `<div>` | `<p>` |

### `input.tsx`

**Purpose**: Taller inputs with visible background and enhanced focus

| Property | shadcn Default | Our Customization |
|----------|----------------|-------------------|
| Height | `h-9` | `h-10` |
| Background | `bg-transparent` | `bg-background` |
| Padding | `py-1` | `py-2` |
| Shadow | `shadow-sm` | No shadow |
| Focus ring | `ring-1` | `ring-2` with `ring-offset-2` |

### `select.tsx`

**Purpose**: Better UX with scroll isolation and clearer icon

| Property | shadcn Default | Our Customization |
|----------|----------------|-------------------|
| Trigger icon | `ChevronDown` | `ChevronsUpDown` |
| Max height | `max-h-[--radix-select-content-available-height]` | `max-h-96` |
| Scroll behavior | None | `onWheel={(e) => e.stopPropagation()}` |
| Transform origin | `origin-[--radix-select-content-transform-origin]` | Removed |

### `toggle.tsx` (+ `alert-dialog.tsx`)

**Purpose**: Vite compatibility (no Next.js directives)

| Property | shadcn Default | Our Customization |
|----------|----------------|-------------------|
| `"use client"` directive | Present | Removed |

> **Note**: The `"use client"` directive is required for Next.js but unnecessary for Vite projects. These components still work identically but without the directive.

## Custom Components (Not from shadcn)

### `lightweight-select.tsx`

A completely custom select component, not derived from shadcn. Used for simpler dropdown needs without Radix UI overhead.

## Maintenance Notes

### Updating shadcn Components

When updating shadcn components, be careful with the customized ones listed above. For stock components, you can safely run:

```bash
npx shadcn@latest add <component-name> --overwrite
```

For customized components, review the diff before accepting changes.

### Comparing Current State

To compare your current components against the latest shadcn:

```bash
mkdir temp-shadcn-compare
npx shadcn@latest add <components...> --path temp-shadcn-compare --yes
# Use a diff tool to compare temp-shadcn-compare/ vs src/components/ui/
```

### Removed Components

The following shadcn components were **removed** as unused:
- `toast.tsx` - Replaced by Sonner
- `toaster.tsx` - Replaced by Sonner
- `empty.tsx` - Was custom, never used
- `use-toast.ts` (hook) - Replaced by Sonner's `toast()`
