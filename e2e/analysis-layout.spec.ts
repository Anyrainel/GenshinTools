import path from "node:path";
import { expect, test } from "@playwright/test";

test("@visual reserved inventory and its picker remain usable in a narrow loadout view", async ({
  page,
}, testInfo) => {
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
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/account-data/characters");
  await page
    .getByRole("dialog", { name: "Preset Builds Loaded" })
    .getByRole("button", { name: "Got it", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import", exact: true })
    .first()
    .click();
  const importer = page.getByRole("dialog", {
    name: "Import Game Account Data",
    exact: true,
  });
  await importer
    .getByRole("textbox", { name: "Optional UID" })
    .fill("600000001");
  await importer
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("tests/fixtures/goodscanner-v3.json"));
  await expect(importer).toBeHidden();
  await page
    .getByRole("dialog", { name: "Scoring Revamped" })
    .getByRole("button", { name: "Got it", exact: true })
    .click();
  await page.goto("/team-comp/loadouts");
  await page
    .getByRole("button", { name: "Reserve artifacts", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Reserve artifacts",
    exact: true,
  });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /Crimson Witch of Flames/ }).click();
  await expect(
    picker.getByRole("button", { name: "Reserve selected", exact: true })
  ).toBeEnabled();
  const bounds = await picker.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: testInfo.outputPath("reserve-picker-320.png"),
  });
  await picker
    .getByRole("button", { name: "Reserve selected", exact: true })
    .click();
  await expect(
    picker.getByText("Saved loadout", { exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Clear", exact: true })
  ).toBeVisible();
  for (const width of [320, 560, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(width);
    await expect(page.getByRole("combobox")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`loadouts-${width}.png`),
    });
  }
});

test("@visual phone analysis modes occupy distinct rows above the active calculation", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
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
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/team-comp/analysis");
  const card = page.locator('[data-tour-step-id="tc-team-card"]').first();
  await card.getByRole("button", { name: "+", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("img", { name: /amber/i }).click();
  await card.getByRole("button", { name: "+", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("img", { name: /kaeya/i }).click();
  await card.getByRole("button", { name: "+", exact: true }).nth(2).click();
  await page
    .getByRole("dialog")
    .getByRole("img", { name: /favonius.*warbow/i })
    .click();
  await card.getByRole("button", { name: "+", exact: true }).nth(2).click();
  await page
    .getByRole("dialog")
    .getByRole("img", { name: /cool.*steel/i })
    .click();
  await card.getByRole("button", { name: "Analysis", exact: true }).click();
  for (const title of ["Environment", "Single Skill", "Rotation Total"]) {
    const button = page.getByRole("button", { name: new RegExp(`^${title}`) });
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    const textLines = await button
      .getByText(title, { exact: true })
      .evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return Array.from(range.getClientRects(), ({ x, right }) => ({
          x,
          right,
        }));
      });
    expect(textLines).toHaveLength(1);
    for (const line of textLines) {
      expect(line.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(line.right).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    }
  }
  await page.getByRole("tab", { name: "Energy", exact: true }).click();
  const modes = page.getByRole("tablist");
  const boxes = await modes.getByRole("tab").evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    })
  );
  expect(boxes).toHaveLength(5);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      expect(
        a.x + a.width <= b.x + 1 ||
          b.x + b.width <= a.x + 1 ||
          a.y + a.height <= b.y + 1 ||
          b.y + b.height <= a.y + 1
      ).toBe(true);
    }
  }
  const bar = await modes.boundingBox();
  const panel = await page
    .getByRole("tabpanel", { name: "Energy", exact: true })
    .boundingBox();
  expect(bar).not.toBeNull();
  expect(panel).not.toBeNull();
  expect(panel!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320
  );
  await page.getByRole("radio", { name: "Empty", exact: true }).click();
  await page.getByRole("radio", { name: "Full", exact: true }).click();
  await modes.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("phone-analysis-energy.png"),
  });
  for (const width of [320, 560, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const mode of ["Builds", "Investment", "Characters"]) {
      await page.getByRole("tab", { name: mode, exact: true }).click();
      const calculation = page.getByRole("tabpanel", {
        name: mode,
        exact: true,
      });
      await calculation.scrollIntoViewIfNeeded();
      const controls = await calculation
        .getByRole("combobox")
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => {
              const { x, right } = element.getBoundingClientRect();
              return { x, right };
            })
        );
      for (const control of controls) {
        expect(control.x).toBeGreaterThanOrEqual(0);
        expect(control.right).toBeLessThanOrEqual(width);
      }
      if (mode === "Builds" && width === 1280) {
        const owned = await calculation
          .getByRole("checkbox", { name: "Owned weapons", exact: true })
          .boundingBox();
        const enemy = await calculation
          .getByText("Enemy Lv.", { exact: true })
          .boundingBox();
        expect(owned).not.toBeNull();
        expect(enemy).not.toBeNull();
        expect(
          Math.abs(owned!.y + owned!.height / 2 - enemy!.y - enemy!.height / 2)
        ).toBeLessThan(3);
      }
      if (mode === "Investment") {
        const pickers = calculation.getByRole("button", {
          name: "Wish 5★ comparison weapon",
          exact: true,
        });
        await expect(pickers).toHaveCount(2);
        for (const picker of await pickers.all())
          await expect(picker).toHaveText("+");
      }
      await page.screenshot({
        path: testInfo.outputPath(`${mode}-${width}.png`),
      });
    }
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole("tab", { name: "Energy", exact: true }).click();
  for (const theme of [
    "Abyss",
    "Mondstadt",
    "Liyue",
    "Inazuma",
    "Sumeru",
    "Fontaine",
    "Natlan",
    "Snezhnaya",
    "Nod-Krai",
  ]) {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Theme", exact: true })
      .press("ArrowRight");
    await page.getByRole("menuitem", { name: theme, exact: true }).click();
    for (const name of ["Empty", "Full"]) {
      const selected = page.getByRole("radio", { name, exact: true });
      const other = page.getByRole("radio", {
        name: name === "Empty" ? "Full" : "Empty",
        exact: true,
      });
      await selected.click();
      await expect(selected).toBeChecked();
      const border = await selected.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.borderColor,
          left: parseFloat(style.borderLeftWidth),
          right: parseFloat(style.borderRightWidth),
        };
      });
      expect(border.left).toBeGreaterThan(0);
      expect(border.right).toBeGreaterThan(0);
      const inactiveBorder = await other.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.borderColor,
          left: parseFloat(style.borderLeftWidth),
          right: parseFloat(style.borderRightWidth),
        };
      });
      expect(inactiveBorder.color).not.toBe(border.color);
      expect(inactiveBorder.left).toBeGreaterThan(0);
      expect(inactiveBorder.right).toBeGreaterThan(0);
      await modes.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`energy-${theme}-${name}.png`),
      });
    }
  }
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Language", exact: true })
    .press("ArrowRight");
  await page.getByRole("menuitem", { name: "中文", exact: true }).click();
  for (const [name, file] of [
    ["补金", "Investment"],
    ["角色", "Characters"],
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await page
      .getByRole("tabpanel", { name, exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${file}-zh-320.png`) });
  }
});
