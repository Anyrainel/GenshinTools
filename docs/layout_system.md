# GenshinTools Layout System

## Overview

**What is this?** A prescriptive design specification for responsive layouts, component patterns, and mobile compatibility. This is the **target state**—not a description of current code.

**Why does it exist?** The app currently has inconsistent responsive behavior. This document defines a unified system to achieve mobile-first, consistent layouts across all pages.

**Current state:** The app works on desktop. Many patterns described here are **not yet implemented**—they need to be built.

> [!IMPORTANT]
> All code snippets in this document are for **demonstration purposes only**. The actual implementation may be more complex and should use appropriate naming conventions and code organization.

### Implementation Checklist

| Section | Status |
|---------|--------|
| Breakpoints | ✅ Done |
| Tailwind Config | ✅ Done |
| Page Shell / AppBar | ✅ Done |
| Layout Components | ✅ Done |
| Component Standards | ✅ Done |

### How to use this document

1. **Read the section** for the component/pattern you're implementing
2. **Follow the specs** (classes, props, behavior)

## 1. Breakpoints

| Breakpoint | Width | Role |
|------------|-------|------|
| `sm` | 640px | Default |
| `md` | 768px | Mobile → Tablet |
| `lg` | 1024px | Tablet → Compact Desktop |
| `xl` | 1280px | Comfort spacing |
| `2xl` | 1536px | 4K efficiency |

---

## 2. Tailwind Configuration

### Container

```typescript
container: {
  center: true,
  padding: {
    DEFAULT: "1rem",
    md: "1.5rem",
    lg: "2rem",
    "2xl": "3rem",
  },
  screens: {
    sm: "100%",
    md: "100%",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1600px",
  },
},
```

### Custom Tokens

```typescript
extend: {
  width: {
    "sidebar": "17.5rem",     // 280px
    "sidebar-wide": "20rem",  // 320px
  },
  minWidth: {
    "card": "22rem",          // 352px
  },
},
```

---

## 3. Page Shell

```
Desktop (md+)                        Mobile (< md)
┌────────────────────────────────┐   ┌────────────────────────────────┐
│  AppBar  (h-14)                │   │  AppBar (h-14, hides on scroll)│
├────────────────────────────────┤   ├────────────────────────────────┤
│  Tab Bar (h-12, if tabs)       │   │  View Content  (flex-1)        │
├────────────────────────────────┤   │                                │
│  View Content  (flex-1)        │   │  (tabs in hamburger menu)      │
└────────────────────────────────┘   └────────────────────────────────┘
```

### AppBar

> Rename `ToolHeader` → `AppBar` in codebase.

```tsx
interface AppBarProps {
  actions?: ActionConfig[];  // See Action Controls section
  tabs?: { value: string; label: string; icon: LucideIcon }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}
```

| Element | Collapse Point | Behavior |
|---------|----------------|----------|
| Navigation | `< lg` | Hamburger Sheet |
| Secondary actions | `< md` | Overflow menu |
| Theme/language | `< md` | Overflow submenu |

**Mobile scroll behavior (< md)**: Hides on scroll down, reappears on scroll up.

**Tabs** (when provided):

| Context | Rendering |
|---------|---------------|
| Desktop (`md+`) | Inline tab bar below AppBar (`h-12`, `max-w-md`, centered) |
| Mobile (`< md`) | Merged into hamburger Sheet as second-level nav (Collapsible) |

Tab content: Icon + label.

### Action Controls

Actions in AppBar that open dialogs. AppBar receives callbacks; pages manage their own dialogs.

```tsx
interface ActionConfig {
  key: string;
  icon: LucideIcon;
  label: string;
  onTrigger: () => void;
  alwaysShow?: boolean;  // If true, always visible; otherwise collapses < md
}

interface ControlHandle {
  open: () => void;
}
```

**Control pattern:** Controls expose `.open()` via ref using `forwardRef` + `useImperativeHandle`. They only render dialogs, no buttons.

**Page usage:**
```tsx
const importRef = useRef<ControlHandle>(null);

const secondaryActions: ActionConfig[] = [
  { key: "import", icon: Upload, label: "Import", onTrigger: () => importRef.current?.open() },
];

<ImportControl ref={importRef} options={...} onApply={...} />
<AppBar secondaryActions={secondaryActions} />
```

**AppBar behavior:**
- Desktop (`md+`): Renders each action as a Button
- Mobile (`< md`): Renders actions in DropdownMenu

---

## 4. Layout Components

Three layout components centralize responsive behavior.

### Page-to-Layout Mapping

| Page | Layout | Notes |
|------|--------|-------|
| TierList, WeaponTierList | WideLayout | Filter sidebar + draggable grid |
| ArtifactFilter | SidebarLayout | Filter sidebar + build cards |
| AccountData | SidebarLayout | Filter sidebar + character/artifact views |
| TeamBuilder | ScrollLayout | Card grid |
| Home | ScrollLayout | Navigation cards |

### 4.1 SidebarLayout

For filtering + browsing workflows.

```tsx
interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  triggerIcon?: LucideIcon;       // Default: Filter
  triggerLabel?: string;          // Default: "Filters"
  children: React.ReactNode;
  className?: string;
}
```

| Element | Classes |
|---------|---------|
| Wrapper | `container h-full overflow-hidden flex flex-col md:flex-row gap-4 md:gap-6` |
| Mobile trigger | Button with icon + label, `md:hidden` |
| Sheet | `w-80` from left; sidebar rendered inside |
| Desktop sidebar | `hidden md:flex w-sidebar 2xl:w-sidebar-wide shrink-0 overflow-y-auto` |
| Main panel | `flex-1 min-w-0 overflow-y-auto` |

---

### 4.2 WideLayout

For dense tabular data with inline filters.

```tsx
interface FilterGroup {
  key: string;
  content: React.ReactNode;     // Checkbox group
}

interface WideLayoutProps {
  title: React.ReactNode;             // Left side of header
  actions?: React.ReactNode;          // Right side (customize button, etc.)
  filters?: FilterGroup[];            // Groups managed by layout for wrapping/Sheet
  children: React.ReactNode;
  className?: string;
}
```

| Element | Classes |
|---------|---------|
| Wrapper | `w-full flex-1 min-h-0 flex flex-col px-4 md:px-6 xl:px-8` |
| Header | `shrink-0 sticky top-0 z-10 bg-background` |
| Header layout | `flex items-center justify-between` |
| Filter bar (desktop) | `flex flex-wrap gap-4` with dividers between groups |
| Filter Sheet (mobile) | Triggered by icon button; groups stack `space-y-4` |
| Content | `flex-1 overflow-y-auto` |

**Filter group rendering**:

| Context | Layout |
|---------|--------|
| Desktop | Groups inline with `flex-wrap`; divider between groups |
| Sheet | Groups stack vertically; items use 2-column grid |
| Item spacing | `gap-x-4 gap-y-2` |
| Structure | Checkbox + label, no headings |

**Table-to-Tabs**: When `viewport_width < column_count × min_column_width`, restructure into tabs.

---

### 4.3 ScrollLayout

For card grids, single-column content, and other simple scrollable layouts.

```tsx
interface ScrollLayoutProps {
  children: React.ReactNode;
  className?: string;           // Applied to inner container
}
```

| Element | Classes |
|---------|---------|
| Wrapper | `container flex-1 min-h-0 overflow-y-auto` |
| Content | Children rendered directly |

Pages control inner layout (grid, sections, etc.).

## 5. Component Standards

### Spacing

| Token | Use |
|-------|-----|
| `gap-2` | Icon, button groups |
| `gap-4` | Card lists, grids |
| `gap-6` | Panel, section separations |

### Icon Sizes

| Name | Class |
|------|-------|
| xs | `size-6` |
| sm | `size-8` |
| md | `size-12` |
| lg | `size-16` |

### Touch Targets

Minimum interactive element size: `44px` (11 in Tailwind's spacing scale = `size-11`).

### Dialogs

**Full-Screen Modals (Mobile):**

These dialogs need full-screen treatment on mobile (`< md`):

- **TierCustomizationDialog**
- **AccountImportControl**
- **StatWeightView explanation**

Use `Drawer` (shadcn/Vaul) from bottom with full height:

```tsx
<Drawer>
  <DrawerContent className="h-full max-h-[100dvh]">
    <DrawerHeader className="shrink-0">...</DrawerHeader>
    <div className="flex-1 overflow-y-auto px-4">...</div>
    <DrawerFooter className="shrink-0">...</DrawerFooter>
  </DrawerContent>
</Drawer>
```

On desktop (`md+`), use standard Dialog.

**Standard Dialogs:**

| Type | Classes |
|------|---------|
| Base | `w-[calc(100%-2rem)]` (full width with margin) |
| Desktop | `sm:max-w-md` (confirmations) or `sm:max-w-lg` (forms) |
| Height | `max-h-[85vh]` with internal scroll if needed |

- **AlertDialog**: Destructive confirmations (clear, reset, delete)
- **Dialog**: Forms, pickers, settings

### Tooltips

Desktop-only feature. On mobile, hover interactions don't exist and gestures conflict with other actions.

- Use for: Quick hints, stat explanations, button labels
- Mobile: Content should be understandable without tooltips

### HoverCards

Most hovercards (character previews, weapon stats) are desktop-only enhancements.

**Exception: ArtifactScoreHoverCard**

This contains unique content not shown elsewhere. Use hybrid hover + click pattern:

| Trigger | Behavior |
|---------|----------|
| Desktop hover | Shows temporarily, disappears on mouse leave |
| Click/Tap | Pins open until click outside |

---

## 6. Philosophy

- **Config**: Fine-grained tokens and responsive container definitions
- **Usage**: Frugal class application; avoid per-instance breakpoint stacking
- **Fixed components**: Sidebar, container, AppBar — exact specs
- **Flexible components**: Cards, grids — methodology defined, sizing derived from content

