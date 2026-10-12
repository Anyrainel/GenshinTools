import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const themes = [
  ["abyss", "Abyss"],
  ["mondstadt", "Mondstadt"],
  ["liyue", "Liyue"],
  ["inazuma", "Inazuma"],
  ["sumeru", "Sumeru"],
  ["fontaine", "Fontaine"],
  ["natlan", "Natlan"],
  ["snezhnaya", "Snezhnaya"],
  ["nodkrai", "Nod-Krai"],
] as const;

test.beforeEach(async ({ page }) => {
  // Persisted preferences suppress unrelated onboarding/update prompts.
  // Domain data is never injected: scanner imports use the public file input.
  await page.addInitScript(() => {
    if (!localStorage.getItem("app_language"))
      localStorage.setItem("app_language", "en");
    localStorage.setItem(
      "greeting-storage",
      JSON.stringify({
        version: 1,
        state: { onboardingCompleted: true, lastSeenUpdate: "2099-01-01" },
      })
    );
  });
});

function bundleErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      ["script", "stylesheet"].includes(response.request().resourceType())
    ) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function responsiveShell(page: Page) {
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("margin", "0px");
  await expect(page.locator("body")).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)"
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
}

async function openTheme(page: Page) {
  const direct = page.getByRole("button", { name: "Theme", exact: true });
  if (await direct.isVisible()) await direct.click();
  else {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Theme", exact: true }).hover();
  }
}

async function dismissInitialBuildPrompt(page: Page) {
  await page
    .getByRole("dialog", { name: "Preset Builds Loaded", exact: true })
    .getByRole("button", { name: "Got it", exact: true })
    .click();
}

test("production chunks and nine themes render across responsive routes", async ({
  page,
}, testInfo) => {
  const errors = bundleErrors(page);
  await page.goto("/");
  const backgrounds = new Set<string>();
  for (const [id, label] of themes) {
    await openTheme(page);
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await responsiveShell(page);
    backgrounds.add(
      await page
        .locator("body")
        .evaluate((body) => getComputedStyle(body).backgroundColor)
    );
    const screenshot = testInfo.outputPath(`theme-${id}.png`);
    await page.screenshot({ path: screenshot, animations: "disabled" });
    await testInfo.attach(`theme-${id}`, {
      path: screenshot,
      contentType: "image/png",
    });
  }
  expect(backgrounds.size).toBeGreaterThan(1);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nodkrai");
  for (const route of [
    "/account-data/characters",
    "/account-data/inventory",
    "/artifact-filter/configure",
    "/team-comp/analysis",
    "/archive/characters",
  ]) {
    expect((await page.goto(route))?.status()).toBe(200);
    if (route === "/account-data/characters")
      await dismissInitialBuildPrompt(page);
    await responsiveShell(page);
  }
  const directLanguage = page.getByRole("button", {
    name: "Language",
    exact: true,
  });
  if (await directLanguage.isVisible()) await directLanguage.click();
  else {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Language", exact: true }).hover();
    await page.getByRole("menuitem", { name: "中文", exact: true }).click();
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  expect(errors).toEqual([]);
});

test("GOOD scanner upload reaches converted account and survives reload", async ({
  page,
}) => {
  const errors = bundleErrors(page);
  await page.goto("/account-data/characters");
  await dismissInitialBuildPrompt(page);
  await page
    .getByRole("button", { name: "Import", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Import Account Data",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Optional UID", exact: true })
    .fill("600000001");
  await dialog
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("tests/fixtures/goodscanner-v3.json"));
  await expect(dialog).toBeHidden();
  await page
    .getByRole("dialog", { name: "Scoring Revamped", exact: true })
    .getByRole("button", { name: "Got it", exact: true })
    .click();
  await expect(page.getByText("Amber", { exact: true }).first()).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("genshin-account-storage") ?? "null")
  );
  expect(saved.state.activeAccountId).toBe(600000001);
  expect(saved.state.accounts["600000001"].data).toMatchObject({
    characters: [
      {
        key: "amber",
        level: 20,
        constellation: 0,
        weapon: { key: "favonius_warbow", level: 1, refinement: 1 },
        artifacts: {
          flower: {
            setKey: "crimson_witch_of_flames",
            level: 20,
            astralMark: true,
            elixirCrafted: false,
            totalRolls: 9,
            initialValues: { "atk%": 5.8 },
          },
        },
      },
    ],
  });
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("genshin-achievement-storage") ?? "null"
        ).state.earnedIdsByProfileId["600000001"]
    )
  ).toEqual([81001]);
  await page.reload();
  await expect(page.getByText("Amber", { exact: true }).first()).toBeVisible();
  await page.goto("/account-data/inventory");
  await responsiveShell(page);
  // A partial second scan supplies one owned replacement while preserving the
  // artifact inventory imported above. This keeps the worker search tiny.
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Import", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Import Account Data", exact: true })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "owned-replacement.good.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "GOOD",
          version: 3,
          source: "yas-GOODScanner",
          characters: [
            {
              key: "Amber",
              level: 20,
              ascension: 1,
              constellation: 0,
              talent: { auto: 1, skill: 1, burst: 1 },
            },
            {
              key: "Kaeya",
              level: 20,
              ascension: 1,
              constellation: 0,
              talent: { auto: 1, skill: 1, burst: 1 },
            },
          ],
          weapons: [
            {
              key: "FavoniusWarbow",
              level: 1,
              ascension: 0,
              refinement: 1,
              location: "Amber",
              lock: true,
            },
            {
              key: "CoolSteel",
              level: 1,
              ascension: 0,
              refinement: 1,
              location: "Kaeya",
              lock: true,
            },
          ],
        })
      ),
    });
  await expect(
    page.getByRole("dialog", { name: "Import Account Data", exact: true })
  ).toBeHidden();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("genshin-account-storage") ?? "null")
            .state.accounts["600000001"].data.characters.length
      )
    )
    .toBe(2);
  await page.goto("/team-comp/analysis");
  await page
    .locator('[data-tour-step-id="tc-team-card"]')
    .getByRole("button", { name: "+", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").getByRole("img", { name: /amber/i }).click();
  await page
    .locator('[data-tour-step-id="tc-team-card"]')
    .getByRole("button", { name: "Analysis", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Rotation Total Multiple formulas",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Characters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Replace characters", exact: true })
  ).toBeVisible();
  await expect(
    page.locator("[data-character-comparison]").getByRole("checkbox")
  ).toHaveCount(0);
  await expect(page.locator("[data-replacement-slot]")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Character & weapon pool", exact: true })
  ).toBeVisible();
  const calculation = page.waitForEvent("worker", {
    predicate: (worker) => worker.url().includes("characterReplacement.worker"),
  });
  await page
    .getByRole("button", { name: "Find replacements", exact: true })
    .click();
  await calculation;
  await expect(page.locator("[data-replacement-slot]")).toHaveCount(4);
  await expect(
    page
      .getByRole("button", { name: "Apply to this team", exact: true })
      .first()
  ).toBeVisible({ timeout: 120000 });
  const replacement = page
    .locator("section")
    .filter({
      has: page.getByRole("button", {
        name: "Apply to this team",
        exact: true,
      }),
    })
    .first();
  await expect(replacement).toContainText(/[1-9][\d,.]*(?:[kmbKMB])? damage/);
  expect(errors).toEqual([]);
});
