# GenshinTools Testing Guide

## Current Status

**391 passing tests, 50 test files** (as of 2026-01-18)

| Phase | Status | Summary |
|-------|--------|---------|
| 1. Infrastructure | ✅ | `vitest.config.ts`, `tests/setup.ts`, render utilities, fixtures |
| 2. Lib Functions | ✅ | `artifactScore`, `goodConversion`, `computeFilters`, `simpleMerge`, `enka`, `characterFilters` |
| 3. Store Testing | ✅ | `useBuildsStore`, `useTierStore`, `useAccountStore`, `useArtifactScoreStore` |
| 4. Shared Components | ✅ | `ItemIcon`, `ClearAllControl`, `ExportControl`, `ImportControl`, `ToolHeader`, `ItemPicker` |
| 5. Domain Components | ✅ | See coverage table below |
| 6. Integration Tests | ✅ | 7 files covering all page flows |
| 7. E2E (Playwright) | 🔜 | Future consideration |

---

## Test Coverage

### Component Tests

| Domain | Components |
|--------|------------|
| **Shared** | CharacterInfo, CharacterTooltip, ArtifactTooltip, WeaponTooltip, SortToggleGroup, CharacterFilterSidebar |
| **Account Data** | ArtifactScoreHoverCard, SlotProgressIndicator, StatDisplay, CharacterCard, SummaryView, InventoryView, CharacterView |
| **Artifact Filter** | ArtifactSelect, StatSelect, TitleCard, ArtifactCard, CharacterBuildCard, BuildCard, ArtifactConfigCard, ComputeView |
| **Tier List** | TierItemPreview, TierCustomizationDialog, TierItem, TierGrid, TierTable |
| **Team Builder** | TeamCard |

### Integration Tests

| Test File | Page Flow |
|-----------|-----------|
| `dataImportFlow` | GOOD import → store → scoring → display |
| `tierSortingFlow` | Tier assignments → character filtering/sorting |
| `buildFilterFlow` | Build config → filter computation |
| `teamBuilderFlow` | Team CRUD operations |
| `tierListFlow` | Character tier list operations |
| `weaponTierListFlow` | Weapon tier list operations |
| `accountDataFlow` | Account data import and scoring |

---

## Critical Patterns

### Zustand State Sync

**#1 cause of test failures.** Re-fetch state after mutations:

```typescript
// ❌ WRONG
const state = useStore.getState();
state.doSomething();
expect(state.value).toBe(expected); // Stale!

// ✅ CORRECT
useStore.getState().doSomething();
expect(useStore.getState().value).toBe(expected);
```

### Timestamp ID Collisions

Add 5ms delays when creating multiple items:

```typescript
useStore.getState().addItem();
await new Promise((r) => setTimeout(r, 5));
useStore.getState().addItem(); // Now has unique ID
```

### Store Reset

Always reset in `beforeEach`:

```typescript
beforeEach(() => useBuildsStore.getState().clearAll());
beforeEach(() => useTierStore.getState().resetTierList());
beforeEach(() => useAccountStore.getState().clearAccountData());
```

### Hidden State Deletion

Some stores delete keys instead of setting `false`:

```typescript
// ❌ expect(state.hidden[id]).toBe(false);
// ✅ expect(state.hidden[id]).toBeFalsy();
```

---

## Test Patterns

### Component Tests

```typescript
import { render, screen } from "@tests/utils/render";
import userEvent from "@testing-library/user-event";

describe("Component", () => {
  it("handles interaction", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    
    render(<Component onAction={onAction} />);
    await user.click(screen.getByRole("button"));
    
    expect(onAction).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
import { act } from "@testing-library/react";
import { useStore } from "@/stores/useStore";

describe("Integration: Flow", () => {
  beforeEach(() => useStore.getState().reset());

  it("completes user flow", () => {
    act(() => useStore.getState().action());
    expect(useStore.getState().result).toBeDefined();
  });
});
```

---

## Data Formats

| Type | Format | Example |
|------|--------|---------|
| Character ID | snake_case | `"hu_tao"` |
| Weapon ID | snake_case | `"staff_of_homa"` |
| Artifact Set ID | snake_case | `"crimson_witch_of_flames"` |

---

## Test Infrastructure

| Resource | Purpose |
|----------|---------|
| `tests/setup.ts` | Browser API mocks (matchMedia, localStorage, ResizeObserver, etc.) |
| `tests/fixtures/index.ts` | Factory functions and mock constants |
| `tests/utils/render.tsx` | Custom render with all providers |
| `tests/utils/viewport.ts` | Viewport switching helpers |

---

## Commands

```bash
npm run test                    # All tests
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
npx vitest run tests/lib/       # Specific directory
npx vitest run <file>           # Single file
```

---

## Rules for Writing Tests

1. **Zustand**: Always re-fetch state after mutations
2. **Timestamp IDs**: Add 5ms delay between rapid creates
3. **Imports**: Use `@tests/utils/render`, not `@testing-library/react`
4. **IDs**: Use snake_case (`"hu_tao"`, not `"HuTao"`)
5. **Bail out**: Use `.todo()` after 3 failed attempts, explain why

---

## Future: E2E Testing (Playwright)

Not yet implemented. When needed:

```bash
pnpm add -D @playwright/test
npx playwright install
```

- Config: `playwright.config.ts` with dev server integration
- Tests: `e2e/` directory covering navigation, drag-drop, file downloads
