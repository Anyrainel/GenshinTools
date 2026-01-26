import { type Page, expect, test } from "@playwright/test";

/**
 * E2E tests for tour dialogs across different viewport sizes.
 * Verifies that tour dialogs remain within viewport bounds on all screen sizes.
 *
 * These tests rely on the tour auto-start mechanism: when visiting a page
 * for the first time (localStorage key not set), the tour starts automatically.
 */

interface TourConfig {
  id: string;
  route: string;
  stepCount: number;
  /** Tab value to navigate to before tour starts */
  initialTab?: string;
}

const TOURS: TourConfig[] = [
  {
    id: "artifact-filter",
    route: "/#/artifact-filter",
    stepCount: 3,
    initialTab: "configure",
  },
  { id: "tier-list", route: "/#/tier-list", stepCount: 4 },
  {
    id: "account-data",
    route: "/#/account-data",
    stepCount: 4,
    initialTab: "characters",
  },
];

/**
 * Navigate to page and trigger tour via Help button
 */
const isMobile = (page: Page) => {
  const size = page.viewportSize();
  return size ? size.width < 1024 : false;
};

/**
 * Navigate to page and trigger tour via Help button
 */
async function startTour(page: Page, tour: TourConfig) {
  // Navigate to the page
  const url = tour.initialTab
    ? `${tour.route}?tab=${tour.initialTab}`
    : tour.route;

  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // Check if we expect a tour or a guide
  const mobile = isMobile(page);

  // DEBUG: Verify target element exists (only critical for Desktop Tour)
  if (!mobile) {
    const firstStepId =
      tour.id === "artifact-filter"
        ? "af-presets"
        : tour.id === "tier-list"
          ? "tl-unassigned"
          : "ad-import";
    const target = page
      .locator(`[data-tour-step-id*="${firstStepId}"]`)
      .first();
    await expect(target)
      .toBeVisible({ timeout: 5000 })
      .catch((e) => {
        console.log(`Target element ${firstStepId} not found on ${page.url()}`);
        throw e;
      });
  }

  // Click the Help button (if not already started)
  // const mobile = isMobile(page); // already defined above

  // Check if tour/guide is already visible (auto-start)
  let isStarted = false;
  if (mobile) {
    if (await page.locator('div[role="dialog"] >> text="Guide"').isVisible()) {
      isStarted = true;
    }
  } else {
    if (await page.locator(".fixed.inset-0.z-\\[100\\]").isVisible()) {
      isStarted = true;
    }
  }

  if (!isStarted) {
    await expect(async () => {
      // Determine which menu contains the help button
      const helpButton = page.locator('button:has-text("Help")');
      if (await helpButton.isVisible()) {
        // If hidden in menu, check more menu
        await helpButton.click();
      } else {
        // Fallback: Check if it's in the "More" dropdown (vertical dots)
        const moreMenu = page
          .locator("button:has(.lucide-more-vertical)")
          .first();
        if (await moreMenu.isVisible()) {
          await moreMenu.click();
          await page.locator('[role="menuitem"] >> text="Help"').click();
        }
      }

      if (mobile) {
        // Check visibility
        const drawer = page.locator('div[role="dialog"] >> text="Guide"');
        await expect(drawer).toBeVisible({ timeout: 2000 });
      } else {
        const tourOverlay = page.locator(".fixed.inset-0.z-\\[100\\]");
        await expect(tourOverlay).toBeVisible({ timeout: 2000 });
      }
    }).toPass({ timeout: 10000 });
  }
}

/**
 * Verify the tour popover (Desktop Only)
 */
async function verifyPopoverInViewport(page: Page, stepIndex: number) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport set");

  const popover = page.locator("[data-radix-popper-content-wrapper]");
  await expect(popover).toBeVisible({ timeout: 5000 });

  const box = await popover.boundingBox();
  if (!box)
    throw new Error(
      `Step ${stepIndex + 1}: Could not get popover bounding box`
    );

  const tolerance = 10;
  expect(box.x).toBeGreaterThanOrEqual(-tolerance);
  expect(box.y).toBeGreaterThanOrEqual(-tolerance);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + tolerance);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + tolerance);

  const nextButton = popover.locator(
    'button:has-text("Next"), button:has-text("Finish")'
  );
  await expect(nextButton).toBeVisible({ timeout: 3000 });
  await nextButton.click();
  await page.waitForTimeout(400);
}

// Generate tests for each tour
for (const tour of TOURS) {
  test.describe(`Tour: ${tour.id}`, () => {
    test("completes tour (Desktop) or guide (Mobile)", async ({ page }) => {
      test.slow();
      test.setTimeout(45000);
      page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
      page.on("pageerror", (err) =>
        console.log(`BROWSER ERROR: ${err.message}`)
      );

      const mobile = isMobile(page);

      await startTour(page, tour);

      if (mobile) {
        // Verify Guide Content and Close
        // Content check (generic)
        await expect(page.locator('div[role="dialog"]')).toContainText("1.");

        // Close "Got it"
        await page.locator('button:has-text("Got it")').click();

        // Verify closed
        await expect(
          page.locator('div[role="dialog"] >> text="Guide"')
        ).not.toBeVisible();
      } else {
        // Desktop Tour Steps
        for (let step = 0; step < tour.stepCount; step++) {
          await verifyPopoverInViewport(page, step);
        }
        // Verify tour has completed
        const tourOverlay = page.locator(".fixed.inset-0.z-\\[100\\]");
        await expect(tourOverlay).not.toBeVisible({ timeout: 3000 });
      }
    });
  });
}
