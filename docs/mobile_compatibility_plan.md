# Mobile Compatibility Plan

This document outlines the strategy for retrofitting the GenshinTools React application to support mobile devices effectively.

> **Design Principle**: **Desktop First, Mobile Adaptive**. The existing Desktop experience must remaining **unchanged**. All mobile accommodations will be triggered via responsive breakpoints (`lg:hidden`, etc.) or user-agent detection where necessary.

## 1. Global Layout & Viewport

### Current State
- `App.tsx` uses `h-screen`, causing issues on mobile browsers with dynamic address bars.
- `THEME.layout.pageContainer` assumes a fixed layout.

### Changes
- **Viewport Height**: Replace `h-screen` with `h-dvh` (dynamic viewport height). This is a safe change for desktop (modern browsers support `dvh` or fallback gracefully).
- **Root Layout**: Ensure `flex-col` works correctly with `overflow-hidden`.
- **Paddings**: Audit `container` usage. Desktop keeps `mx-auto`, Mobile gets `px-4`.

## 2. Navigation & Header

### Strategy
- **Prioritize Import**: The user journey often starts with Import. This action must remain visible or extremely accessible (Primary Action).
- **Secondary Actions**: Export, Clear, and other page-specific actions can be collapsed into a "More" menu (`EllipsisVertical`) to save space.

### Changes
- **Responsive ToolHeader**:
    - **Desktop**: **UNCHANGED**. All buttons (Import, Export, Clear) remain visible.
    - **Mobile**:
        - **Left**: Title/Back button.
        - **Right**:
            - **Primary**: Import Icon Button (visible).
            - **Secondary**: "More" Dropdown Menu containing Export, Clear, Settings, etc.

## 3. Tier List Redesign (Mobile)

### Problem
The current 2D Grid (Rows=Tiers, Cols=Elements/Categories) is impossible to view on mobile without excessive bidirectional scrolling.

### Solution: Categorized Vertical Lists via Tabs
Instead of trying to show the entire Matrix at once, we will pivot the view based on the **Category** (Element/Group).

#### Design
- **Desktop**: **UNCHANGED** (Full Grid View).
- **Mobile**: **Category Tabs View**.
    1.  **Category Tabs**: Scrollable horizontal Tab bar at the top for Elements.
    2.  **Vertical Stacking**: Inside the active Tab, stacking Tiers vertically (S, A, B...).
    3.  **Interaction**:
        - **Drag & Drop**: Enabled within the list.
        - **Assigning New Items**: "Unranked" Drawer or Tap-to-Move context menu.

## 4. Weapon Tier List

### Changes
- **Filters**:
    - **Desktop**: **UNCHANGED** (Inline checkboxes).
    - **Mobile**: Move Filters to a **Filter Sheet** (Button: "Filters" with badge count).
- **Layout**:
    - **Desktop**: **UNCHANGED** (Full Grid View).
    - **Mobile**: "Category Tabs" -> "Vertical Stack" redesign.

## 5. Account Data Views

### 5.1 Tabs
- **Desktop**: **UNCHANGED**.
- **Mobile**: Add `overflow-x-auto` to `TabsList` to allow horizontal scrolling if tabs overflow.

### 5.2 Views
- **CharacterView**:
    - **Desktop**: Sidebar + Grid.
    - **Mobile**: Filter Sheet + Grid (already implemented).
- **InventoryView / SummaryView**:
    - **Desktop**: **UNCHANGED**.
    - **Mobile**: Wrap tables in `overflow-x-auto`.

## 6. Team Builder

### Changes
- **Grid Layout**:
    - **Desktop**: **UNCHANGED** (`minmax(440px)`).
    - **Mobile**: `minmax(300px, 1fr)` or full width.
- **Team Card Internal Layout**:
    - **Desktop**: **UNCHANGED** (Matrix: Attributes on Left, Members in Columns).
    - **Mobile**: **List of Members**.
        - Transposes the data to fit vertical scrolling.

## 7. Home Page (`Home.tsx`)
- **Desktop**: **UNCHANGED** (Row layout with Split view).
- **Mobile**: Flex-col layout (Stack Image top, Content bottom), full-width buttons.

## 8. Artifact Filter (`ArtifactFilter.tsx`)
- **ConfigureView**: Already Responsive.
- **ComputeView**:
    - **Desktop**: **UNCHANGED**.
    - **Mobile**: Wrap results table in `overflow-x-auto`.

## 9. Phasing Strategy

### Phase 1: Foundation (Global Layout & Home)
- **Goal**: App opens on mobile without scrolling the body, Home page looks good.
- **Tasks**:
    - Fix `App.tsx` and `theme.ts` (`h-dvh`).
    - Make `Home.tsx` cards responsive (flex-col on mobile).
- **Verification**: Open Home on mobile simulator.

### Phase 2: Navigation & Header
- **Goal**: Header actions are usable on mobile.
- **Tasks**:
    - Refactor `ToolHeader` to support `mobileActionMenu`.
    - Implement "More" dropdown.
- **Verification**: Check header on all pages.

### Phase 3: Tier Lists (Char & Weapon)
- **Goal**: Usable Tier Lists on mobile.
- **Tasks**:
    - Implement `MobileTierList` (Category Tabs).
    - Move Weapon Filters to Sheet.
- **Verification**: Build Tier Lists on mobile.

### Phase 4: Complex Views (Team & Account)
- **Goal**: Complex data entry is usable.
- **Tasks**:
    - Refactor `TeamCard` for mobile layout (Member List).
    - Fix `TeamBuilder` grid width.
    - Fix `AccountData` tabs and table scrolling.
- **Verification**: Build a Team and check Inventory on mobile.
