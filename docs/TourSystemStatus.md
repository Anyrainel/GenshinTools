# Tour System & E2E Testing Status

## 1. Problem Overview
The core objective is to ensure **Tour Dialogs (Popovers)** remain fully visible within the viewport across all device sizes (Mobile, Tablet, Desktop). Previously, dialogs anchored to elements near the screen edges would clip or render off-screen.

We implemented extensive E2E tests to verify `collisionPadding` and auto-positioning logic, but encountered environmental and state-specific hurdles during verification.

## 2. Current State

### Infrastructure
- **Framework**: Playwright
- **Config**: `playwright.config.ts` configured for:
  - `mobile` (iPhone SE)
  - `tablet` (iPad Mini)
  - `desktop` (1920x1080)
- **Test Specs**: `e2e/tour.spec.ts`
  - Validates `artifact-filter`, `tier-list`, and `account-data` tours.
  - Checks if tour step popovers stay within viewport bounds (0,0 to width,height).
  - Uses a robust "Help" button trigger mechanism (requires Dev mode).

### App Modifications
- **Testability**:
  - `AppBar` actions now include `data-tour-step-id` attributes.
  - The **Help** button (which triggers tours) is now `alwaysShow: true` in Dev mode to avoid being hidden in the mobile hamburger menu during tests.
- **Data**: Verified that `TierList` requires local data (`src/data/characters.json`) to render "Pool" targets.

### Test Results
1.  **Artifact Filter**:
    *   **Mobile**: ✅ **PASSED**. This confirms the critical collision detection logic works on constrained screens.
2.  **Tier List**:
    *   **Status**: ⚠️ **Flaky**. Requires local data generation.
    *   **Fix**: Run scraper (see below) to ensure `tl-unassigned` target exists.
3.  **Account Data**:
    *   **Status**: ❌ **Failing (Desktop)**.
    *   **Issue**: The test successfully locates the target button (`ad-import`) and clicks "Help", but the Tour Overlay does not appear within the timeout. Potentially a Z-index/Stacking Context issue or `0x0` rect detection issue on the desktop layout.

## 3. Testing Guide

### Prerequisites
1.  **Populate Data** (Critical for `tier-list`):
    ```bash
    uv run --project scripts/pyproject.toml scripts/codedump.py
    ```

### Running Tests
- **Run All**:
  ```bash
  npm run test:e2e
  ```
- **Debug Mode (UI)**:
  ```bash
  npm run test:e2e:ui
  ```
- **Target Specific Project & Tour**:
  ```bash
  npx playwright test --project=mobile --grep="artifact-filter"
  ```

### Next Steps / Troubleshooting
- **Account Data Failure**: Investigate why `TourOverlay` logic (in `Tour.tsx`) ignores the `ad-import` target on Desktop. Use `console.log` in `tour.tsx` to print `targets` array length.
- **Visual Debugging**: Use the Playwright UI (`test:e2e:ui`) to inspect the DOM snapshot at the moment of failure. Check if the "Import" button has a non-zero width/height.
