import { expect, test } from "@playwright/test";
import fixture from "../tests/fixtures/goodscanner-v3.json" with {
  type: "json",
};

test("one account-management toggle controls continuous sync with deterministic UID routing", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 720 });
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
    // This scenario starts on an existing profile; first-run default creation has unit coverage.
    localStorage.setItem(
      "genshin-account-storage",
      JSON.stringify({
        version: 8,
        state: {
          activeAccountId: 600000001,
          accounts: {
            600000001: {
              id: 600000001,
              name: "Sync test",
              lastUpdate: 0,
              data: { characters: [], extraWeapons: [], extraArtifacts: [] },
            },
          },
        },
      })
    );
    localStorage.setItem("score-v1-300-announced", "1");
  });
  let revision = 1;
  let sessionId = "background-test";
  let detectedUid: string | undefined = "600000001";
  let level = 20;
  let polls = 0;
  await page.route("http://127.0.0.1:8765/continuous", async (route) => {
    polls += 1;
    await route.fulfill({
      json: {
        sessionId,
        revision,
        updatedAt: 1793900000000 + revision,
        data: {
          ...fixture,
          metadata: detectedUid
            ? { uid: detectedUid, nickname: "Detected alt" }
            : undefined,
          characters: fixture.characters.map((character) => ({
            ...character,
            level,
          })),
        },
      },
    });
  });
  await page.goto("/account-data/inventory");
  const preset = page.getByRole("dialog", {
    name: "Preset Builds Loaded",
    exact: true,
  });
  // The unrelated first-use build prompt is dismissed through its public action.
  await preset.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByText("Preset loaded", { exact: true })).toHaveCount(0);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Accounts", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Accounts", exact: true }).click();
  }
  const manager = page.getByRole("dialog", {
    name: "Manage Profiles",
    exact: true,
  });
  const syncToggle = manager.getByRole("switch", {
    name: "Continuous Sync (Capture)",
  });
  await expect(syncToggle).not.toBeChecked();
  await expect(
    manager.getByRole("textbox", { name: "Port", exact: true })
  ).toHaveValue("8765");
  await expect(
    manager.getByRole("textbox", { name: "Port", exact: true })
  ).toBeVisible();
  await expect(
    manager.getByText(/Automatically sync GGScanner inventory/)
  ).toBeVisible();
  await expect(
    manager.getByRole("button", { name: "Start sync", exact: true })
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("sync-settings-off.png"),
    animations: "disabled",
  });
  expect(polls).toBe(0);
  await syncToggle.click();
  const status = page.getByRole("region", {
    name: "Continuous Sync (Capture)",
  });
  await expect(status).toContainText(/Last sync: \d+[sm] ago/);
  await expect(status).toContainText("Port 8765");
  await expect(status.getByRole("button")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("sync-settings.png"),
    animations: "disabled",
  });
  await manager.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    status.getByRole("status").getByText(/Last sync: \d+[sm] ago/)
  ).toBeVisible();
  expect(
    await status
      .getByRole("status")
      .getByText(/Last sync: \d+[sm] ago/)
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(status).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("background-sync.png") });
  revision = 2;
  level = 21;
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("genshin-account-storage")!).state
            .accounts["600000001"].data.characters[0]?.level
      )
    )
    .toBe(21);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  detectedUid = "700000002";
  level = 22;
  revision = 3;
  await expect
    .poll(() =>
      page.evaluate(() => {
        const accounts = JSON.parse(
          localStorage.getItem("genshin-account-storage")!
        ).state.accounts;
        return [
          accounts["600000001"].data.characters[0]?.level,
          accounts["700000002"]?.data.characters[0]?.level,
        ];
      })
    )
    .toEqual([21, 22]);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("genshin-scanner-sync-storage")!).state
          .enabled
    )
  ).toBe(true);
  // An unidentified capture creates Default, leaving both UID profiles untouched.
  detectedUid = undefined;
  sessionId = "next-login";
  revision = 1;
  level = 23;
  await expect
    .poll(() =>
      page.evaluate(() => {
        const accounts = JSON.parse(
          localStorage.getItem("genshin-account-storage")!
        ).state.accounts;
        return [
          accounts["600000001"].data.characters[0]?.level,
          accounts["700000002"]?.data.characters[0]?.level,
          accounts["0"]?.data.characters[0]?.level,
        ];
      })
    )
    .toEqual([21, 22, 23]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/account-data/inventory");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Accounts", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Accounts", exact: true }).click();
  }
  await manager
    .getByRole("switch", { name: "Continuous Sync (Capture)" })
    .click();
  await expect(status).toHaveCount(0);
  const stoppedAt = polls;
  await page.waitForTimeout(3300);
  expect(polls).toBe(stoppedAt);
  await page.reload();
  await expect(status).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.setItem("app_language", "zh");
    localStorage.setItem("app_theme", "liyue");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "liyue");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "更多", exact: true }).click();
    await page.getByRole("menuitem", { name: "账号管理", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "账号管理", exact: true }).click();
  }
  const chineseManager = page.getByRole("dialog", {
    name: "管理账号配置",
    exact: true,
  });
  await expect(
    chineseManager.getByRole("switch", { name: "持续同步（抓包）" })
  ).not.toBeChecked();
  await expect(
    chineseManager.getByRole("textbox", { name: "端口", exact: true })
  ).toBeVisible();
  await expect(
    chineseManager.getByText(/自动同步 GGScanner 库存/)
  ).toBeVisible();
  expect(
    await chineseManager.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("sync-settings-zh-liyue.png"),
    animations: "disabled",
  });
});
