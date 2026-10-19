import { expect, type Locator, type Page, test } from "@playwright/test";

const tours = [
  ["Artifact Filter", "/artifact-filter/configure"],
  ["Tier List", "/tier-list/characters"],
  ["Team Comp", "/team-comp/analysis"],
  ["Account Data", "/account-data/characters"],
] as const;

async function startHelp(page: Page) {
  const help = page.getByRole("button", { name: "Help", exact: true });
  if (await help.first().isVisible()) await help.first().click();
  else {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Help", exact: true }).click();
  }
}

async function fitsViewport(
  content: Locator,
  viewport: { width: number; height: number },
  tolerance: number
) {
  // Floating UI positions a new step after its content mounts; wait for the
  // measured placement instead of sampling the initial animation frame.
  await expect
    .poll(async () => {
      const box = await content.boundingBox();
      return (
        box !== null &&
        box.x >= -tolerance &&
        box.y >= -tolerance &&
        box.x + box.width <= viewport.width + tolerance &&
        box.y + box.height <= viewport.height + tolerance
      );
    })
    .toBe(true);
}

for (const [name, route] of tours) {
  test(`@visual ${name} help fits the viewport and completes`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("app_language", "en");
      localStorage.setItem(
        "greeting-storage",
        JSON.stringify({
          version: 1,
          state: { onboardingCompleted: true, lastSeenUpdate: "2099-01-01" },
        })
      );
    });
    await page.goto(route);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Missing test viewport");
    if (name === "Tier List" && viewport.width >= 1024) {
      // An empty list puts every character in Pool, making its highlighted
      // label taller than the desktop viewport. Exercise that real user state.
      await page
        .getByRole("button", { name: "Switch List", exact: true })
        .click();
      const manager = page.getByRole("dialog", {
        name: "Switch List",
        exact: true,
      });
      await manager
        .getByRole("button", { name: "Create New Tier List", exact: true })
        .click();
      await expect(manager).toBeHidden();
    }
    await startHelp(page);
    if (viewport.width < 1024) {
      const guide = page.getByRole("dialog", { name: "Guide", exact: true });
      await expect(guide).toContainText("Guide");
      await fitsViewport(guide, viewport, 1);
      await guide.getByRole("button", { name: "Got it", exact: true }).click();
      await expect(guide).toBeHidden();
    } else {
      const popover = page.locator('[data-slot="popover-content"]');
      await expect(popover).toContainText(/Step 1 of \d+/);
      const count = Number(
        (await popover.textContent())?.match(/Step 1 of (\d+)/)?.[1]
      );
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(10);
      for (let step = 1; step <= count; step++) {
        await expect(popover).toContainText(`Step ${step} of ${count}`);
        await fitsViewport(popover, viewport, 10);
        await popover
          .getByRole("button", {
            name: step === count ? "Finish" : "Next",
            exact: true,
          })
          .click();
      }
      await expect(popover).toBeHidden();
    }
    expect(errors).toEqual([]);
  });
}
