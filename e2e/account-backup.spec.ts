import { expect, type Page, test } from "@playwright/test";

const APP_URL = process.env.E2E_BASE_URL ?? "http://localhost:5174";
const BACKUP_ROUTE = `${APP_URL}/account/cloud-backup`;
const PROFILE_ID = 600000001;

type E2eUser = {
  sub: string;
  name: string;
  email: string;
};

type E2eState = {
  accounts?: Record<string, unknown>;
  activeAccountId?: number | null;
  builds?: {
    deltas?: unknown[];
    characterWeapons?: Record<string, string[]>;
    author?: string;
    description?: string;
    updatedAt?: number;
  };
  teams?: {
    compDeltas?: unknown[];
    configsByTeamId?: Record<string, unknown>;
    author?: string;
    description?: string;
    updatedAt?: number;
  };
  characterTiers?: {
    tierLists?: Record<string, unknown>;
    activeTierListId?: number;
    nextId?: number;
    updatedAt?: number;
  };
  weaponTiers?: {
    tierLists?: Record<string, unknown>;
    activeTierListId?: number;
    nextId?: number;
    updatedAt?: number;
  };
  artifactTiers?: {
    tierLists?: Record<string, unknown>;
    activeTierListId?: number;
    nextId?: number;
    updatedAt?: number;
  };
};

type BackupHeadResponse = {
  changed: boolean;
  headSetRev: string;
  heads: Array<{
    partitionKey: string;
    metadata: { records: Array<{ kind: string; count: number }> };
  }>;
};

type DomainPart = "account" | "builds" | "teams" | "tiers";

test.describe("account cloud backup E2E", () => {
  test.describe.configure({ mode: "default", timeout: 60_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "stateful account backup coverage runs once on desktop"
    );
    await openBackupPage(page);
    await page.evaluate(() => {
      window.__ggE2E.signOut();
      window.__ggE2E.clearDomainData();
    });
  });

  test("keeps backup controls disabled when signed out", async ({ page }) => {
    await expect(
      page.getByText("Sign in before using manual cloud backup.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Back Up" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Restore" })).toBeDisabled();
  });

  test("uploads and restores all backed-up data in a separate browser session", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "restore");
    const source = makeDomainState("source", 101);

    await signIn(page, user);
    await seedDomainData(page, source);
    await clickBackupAndWaitForHeads(page, [
      "builds/all",
      "profile.app/600000001",
      "profile.artifacts/600000001",
      "profile.game/600000001",
      "teams/all",
      "tiers/all",
    ]);

    const restoreContext = await browser.newContext();
    const restorePage = await restoreContext.newPage();
    try {
      await openBackupPage(restorePage);
      await signIn(restorePage, user);
      await seedDomainData(restorePage, makeEmptyDomainState());
      await restoreAllCloudData(restorePage);

      await expect
        .poll(() => readLocalPayloadsByPartition(restorePage), {
          message: "restored browser should receive uploaded source data",
          timeout: 15_000,
        })
        .toMatchObject({
          "profile.app/600000001": {
            name: "Account source",
            lastImportedAt: 101,
          },
          "profile.game/600000001": {
            characters: [
              {
                key: "amber",
                level: 80,
              },
            ],
            weapons: [{ key: "favonius_warbow" }, { key: "the_stringless" }],
          },
          "profile.artifacts/600000001": {
            artifacts: [
              {
                level: 20,
                setKey: "CrimsonWitchOfFlames",
                slotKey: "flower",
              },
            ],
          },
          "builds/all": {
            deltas: source.builds?.deltas,
            characterWeapons: { amber: ["favonius_warbow"] },
            author: "Build author source",
          },
          "teams/all": {
            compDeltas: source.teams?.compDeltas,
            configsByTeamId: source.teams?.configsByTeamId,
            author: "Team author source",
          },
          "tiers/all": {
            character: {
              lists: [
                {
                  title: "Character tiers source",
                  tierAssignments: { amber: { tier: "S", position: 0 } },
                },
              ],
            },
            weapon: {
              lists: [
                {
                  title: "Weapon tiers source",
                  tierAssignments: {
                    favonius_warbow: { tier: "A", position: 0 },
                  },
                },
              ],
            },
            artifact: {
              lists: [
                {
                  title: "Artifact tiers source",
                  tierAssignments: {
                    CrimsonWitchOfFlames: { tier: "B", position: 0 },
                  },
                },
              ],
            },
          },
        });
    } finally {
      await restoreContext.close();
    }
  });

  test("isolates cloud heads and restore contents by authenticated user", async ({
    browser,
    page,
  }, testInfo) => {
    const userA = userFor(testInfo, "isolation-a");
    const userB = userFor(testInfo, "isolation-b");

    await signIn(page, userA);
    await seedDomainData(page, makeDomainState("source", 201));
    await clickBackupAndWaitForHeads(page, ["profile.game/600000001"]);
    await expect
      .poll(() => readBackupPartitionKeys(page))
      .toContain("profile.game/600000001");

    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();
    try {
      await openBackupPage(userBPage);
      await signIn(userBPage, userB);
      await expect.poll(() => readBackupPartitionKeys(userBPage)).toEqual([]);

      await seedDomainData(userBPage, makeDomainState("other-user", 202));
      await clickBackupAndWaitForHeads(userBPage, ["profile.game/600000001"]);
      await expect
        .poll(() => readBackupRecordCounts(userBPage))
        .toMatchObject({
          characters: 1,
          weapons: 2,
          artifacts: 1,
        });
    } finally {
      await userBContext.close();
    }

    const userARestoreContext = await browser.newContext();
    const userARestorePage = await userARestoreContext.newPage();
    try {
      await openBackupPage(userARestorePage);
      await signIn(userARestorePage, userA);
      await seedDomainData(userARestorePage, makeEmptyDomainState());
      await restoreAllCloudData(userARestorePage);
      await expect
        .poll(() => readLocalPayloadsByPartition(userARestorePage), {
          timeout: 15_000,
        })
        .toMatchObject({
          "profile.app/600000001": {
            name: "Account source",
          },
          "profile.game/600000001": {
            characters: [{ level: 80, constellation: 0 }],
          },
          "profile.artifacts/600000001": {
            artifacts: [
              {
                level: 20,
                setKey: "CrimsonWitchOfFlames",
                slotKey: "flower",
              },
            ],
          },
        });
    } finally {
      await userARestoreContext.close();
    }
  });

  test("switching signed-in accounts changes the cloud backup namespace in the same browser", async ({
    page,
  }, testInfo) => {
    const userA = userFor(testInfo, "switch-a");
    const userB = userFor(testInfo, "switch-b");

    await signIn(page, userA);
    await seedDomainData(page, makeDomainState("source", 241));
    await clickBackupAndWaitForHeads(page, ["profile.game/600000001"]);
    await expect
      .poll(() => readBackupRecordCounts(page))
      .toMatchObject({
        characters: 1,
        weapons: 2,
        artifacts: 1,
      });

    await signOut(page);
    await signIn(page, userB);
    await expect
      .poll(() => readBackupPartitionKeys(page), {
        message: "second signed-in account should start with empty cloud data",
      })
      .toEqual([]);

    await replaceDomainData(page, makeDomainState("other-user", 242));
    await clickBackupAndWaitForHeads(page, ["profile.game/600000001"]);
    await expect
      .poll(() => readCloudPayloadsByPartition(page))
      .toMatchObject({
        "profile.game/600000001": {
          characters: [{ key: "amber", constellation: 1 }],
        },
      });

    await signOut(page);
    await signIn(page, userA);
    await expect
      .poll(() => readCloudPayloadsByPartition(page))
      .toMatchObject({
        "profile.game/600000001": {
          characters: [{ key: "amber", constellation: 0 }],
        },
      });
  });

  test("restores a new device through the UI without opening conflict choices", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "new-device");
    const source = makeDomainState("source", 281);

    await signIn(page, user);
    await seedDomainData(page, source);
    await clickBackupAndWaitForHeads(page, [
      "builds/all",
      "profile.app/600000001",
      "profile.artifacts/600000001",
      "profile.game/600000001",
      "teams/all",
      "tiers/all",
    ]);

    const newDeviceContext = await browser.newContext();
    const newDevicePage = await newDeviceContext.newPage();
    try {
      await openBackupPage(newDevicePage);
      await newDevicePage.evaluate(() => window.__ggE2E.clearDomainData());
      await signIn(newDevicePage, user);
      await expect
        .poll(() => previewManualPlan(newDevicePage, "download"))
        .toMatchObject({
          status: "needs-download",
          automaticPartitionIds: expect.arrayContaining([
            "builds/all",
            "profile.app/600000001",
            "profile.artifacts/600000001",
            "profile.game/600000001",
            "teams/all",
            "tiers/all",
          ]),
          choices: [],
        });

      await newDevicePage.getByRole("button", { name: "Restore" }).click();
      await expect(
        newDevicePage.getByRole("dialog", { name: "Restore" })
      ).not.toBeVisible();
      await expect
        .poll(() => readConflictIds(newDevicePage), {
          message: "first restore on a new device should not mark conflicts",
        })
        .toEqual([]);
      await expect
        .poll(() => readLocalPayloadsByPartition(newDevicePage), {
          message: "new device should restore cloud data automatically",
          timeout: 15_000,
        })
        .toMatchObject({
          "profile.app/600000001": {
            name: "Account source",
            lastImportedAt: 281,
          },
          "profile.game/600000001": {
            characters: [{ key: "amber", level: 80 }],
          },
          "builds/all": {
            author: "Build author source",
          },
          "teams/all": {
            author: "Team author source",
          },
        });
    } finally {
      await newDeviceContext.close();
    }
  });

  test("restores automatic cloud changes while leaving unselected local conflicts alone", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "mixed-restore");
    const source = makeDomainState("source", 321);

    await signIn(page, user);
    await seedDomainData(page, source);
    await clickBackupAndWaitForHeads(page, [
      "builds/all",
      "profile.app/600000001",
      "profile.artifacts/600000001",
      "profile.game/600000001",
      "teams/all",
      "tiers/all",
    ]);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    try {
      await openBackupPage(secondPage);
      await signIn(secondPage, user);
      await seedDomainData(secondPage, makeTeamsOnlyState("local", 322));

      await expect
        .poll(() => previewManualPlan(secondPage, "download"))
        .toMatchObject({
          status: "conflict",
          automaticPartitionIds: expect.arrayContaining([
            "builds/all",
            "profile.app/600000001",
            "profile.artifacts/600000001",
            "profile.game/600000001",
            "tiers/all",
          ]),
          choices: [
            expect.objectContaining({
              id: "teams/all",
              kind: "download-overwrite-local",
            }),
          ],
        });

      await secondPage.getByRole("button", { name: "Restore" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Restore" })
      ).toBeVisible();
      await secondPage
        .getByRole("dialog", { name: "Restore" })
        .getByRole("button", { name: "Restore" })
        .click();

      await expect
        .poll(() => readLocalPayloadsByPartition(secondPage), {
          message:
            "automatic restore should apply cloud-only data but keep unselected team conflict local",
          timeout: 15_000,
        })
        .toMatchObject({
          "profile.app/600000001": { name: "Account source" },
          "profile.game/600000001": {
            characters: [{ key: "amber", level: 80 }],
          },
          "builds/all": { author: "Build author source" },
          "teams/all": { author: "Team author local" },
          "tiers/all": {
            character: {
              lists: [{ title: "Character tiers source" }],
            },
          },
        });
    } finally {
      await secondContext.close();
    }
  });

  test("uploads automatic local changes while leaving unselected cloud conflicts alone", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "mixed-upload");

    await signIn(page, user);
    await seedDomainData(page, makeTeamsOnlyState("source", 341));
    await clickBackupAndWaitForHeads(page, ["teams/all"]);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    try {
      await openBackupPage(secondPage);
      await signIn(secondPage, user);
      await seedDomainData(secondPage, makeDomainState("local", 342));

      await expect
        .poll(() => previewManualPlan(secondPage, "upload"))
        .toMatchObject({
          status: "conflict",
          automaticPartitionIds: expect.arrayContaining([
            "builds/all",
            "profile.app/600000001",
            "profile.artifacts/600000001",
            "profile.game/600000001",
            "tiers/all",
          ]),
          choices: [
            expect.objectContaining({
              id: "teams/all",
              kind: "upload-overwrite-cloud",
            }),
          ],
        });

      await secondPage.getByRole("button", { name: "Back Up" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Back Up" })
      ).toBeVisible();
      await secondPage
        .getByRole("dialog", { name: "Back Up" })
        .getByRole("button", { name: "Back Up" })
        .click();

      await expect
        .poll(() => readCloudPayloadsByPartition(secondPage), {
          message:
            "automatic upload should write local-only data but keep unselected team conflict in cloud",
          timeout: 15_000,
        })
        .toMatchObject({
          "profile.app/600000001": { name: "Account local" },
          "profile.game/600000001": {
            characters: [{ key: "amber", level: 80 }],
          },
          "builds/all": { author: "Build author local" },
          "teams/all": { author: "Team author source" },
          "tiers/all": {
            character: {
              lists: [{ title: "Character tiers local" }],
            },
          },
        });

      await secondPage.getByRole("button", { name: "Back Up" }).click();
      await secondPage
        .getByRole("dialog", { name: "Back Up" })
        .getByLabel("Custom Teams, Team configs")
        .check();
      await secondPage
        .getByRole("dialog", { name: "Back Up" })
        .getByRole("button", { name: "Back Up" })
        .click();
      await expect
        .poll(() => readCloudPayloadsByPartition(secondPage))
        .toMatchObject({
          "teams/all": { author: "Team author local" },
        });
    } finally {
      await secondContext.close();
    }
  });

  test("reconciles account edits from one browser with team edits from another browser", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "account-team-reconcile");
    const baseline = makeDomainState("baseline", 361);
    const accountEdit = makeStateWithChangedParts(
      "baseline",
      361,
      "account-a",
      362,
      ["account"]
    );
    const teamEdit = makeStateWithChangedParts(
      "baseline",
      361,
      "teams-b",
      363,
      ["teams"]
    );

    await signIn(page, user);
    await seedDomainData(page, baseline);
    await clickBackupAndWaitForHeads(page, [
      "builds/all",
      "profile.app/600000001",
      "profile.artifacts/600000001",
      "profile.game/600000001",
      "teams/all",
      "tiers/all",
    ]);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    try {
      await openBackupPage(secondPage);
      await signIn(secondPage, user);
      await seedDomainData(secondPage, makeEmptyDomainState());
      await restoreAllCloudData(secondPage);

      await replaceDomainData(page, accountEdit);
      await page.getByRole("button", { name: "Back Up" }).click();
      await expect
        .poll(() => readCloudPayloadsByPartition(page))
        .toMatchObject({
          "profile.app/600000001": { name: "Account account-a" },
          "teams/all": { author: "Team author baseline" },
        });

      await replaceDomainData(secondPage, teamEdit);
      await expect
        .poll(() => previewManualPlan(secondPage, "download"))
        .toMatchObject({
          status: "needs-download",
          automaticPartitionIds: ["profile.app/600000001"],
          choices: [],
        });

      await secondPage.getByRole("button", { name: "Restore" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Restore" })
      ).not.toBeVisible();
      await expect
        .poll(() => readLocalPayloadsByPartition(secondPage), {
          message:
            "restore should bring account edits from cloud without overwriting local team edits",
          timeout: 15_000,
        })
        .toMatchObject({
          "profile.app/600000001": { name: "Account account-a" },
          "profile.game/600000001": {
            characters: [{ key: "amber", level: 80 }],
          },
          "teams/all": { author: "Team author teams-b" },
        });

      await expect
        .poll(() => previewManualPlan(secondPage, "upload"))
        .toMatchObject({
          automaticPartitionIds: ["teams/all"],
          choices: [],
        });
      await secondPage.getByRole("button", { name: "Back Up" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Back Up" })
      ).not.toBeVisible();
      await expect
        .poll(() => readCloudPayloadsByPartition(secondPage), {
          message:
            "backup should publish local team edits while preserving cloud account edits",
          timeout: 15_000,
        })
        .toMatchObject({
          "profile.app/600000001": { name: "Account account-a" },
          "teams/all": { author: "Team author teams-b" },
        });
    } finally {
      await secondContext.close();
    }
  });

  test("reconciles team edits from one browser with build edits from another browser", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "team-build-reconcile");
    const baseline = makeDomainState("baseline", 371);
    const teamEdit = makeStateWithChangedParts(
      "baseline",
      371,
      "teams-a",
      372,
      ["teams"]
    );
    const buildEdit = makeStateWithChangedParts(
      "baseline",
      371,
      "builds-b",
      373,
      ["builds"]
    );

    await signIn(page, user);
    await seedDomainData(page, baseline);
    await clickBackupAndWaitForHeads(page, [
      "builds/all",
      "profile.app/600000001",
      "profile.artifacts/600000001",
      "profile.game/600000001",
      "teams/all",
      "tiers/all",
    ]);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    try {
      await openBackupPage(secondPage);
      await signIn(secondPage, user);
      await seedDomainData(secondPage, makeEmptyDomainState());
      await restoreAllCloudData(secondPage);

      await replaceDomainData(page, teamEdit);
      await page.getByRole("button", { name: "Back Up" }).click();
      await expect
        .poll(() => readCloudPayloadsByPartition(page))
        .toMatchObject({
          "builds/all": { author: "Build author baseline" },
          "teams/all": { author: "Team author teams-a" },
        });

      await replaceDomainData(secondPage, buildEdit);
      await expect
        .poll(() => previewManualPlan(secondPage, "upload"))
        .toMatchObject({
          status: "needs-download",
          automaticPartitionIds: ["builds/all"],
          choices: [],
        });

      await secondPage.getByRole("button", { name: "Back Up" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Back Up" })
      ).not.toBeVisible();
      await expect
        .poll(() => readCloudPayloadsByPartition(secondPage), {
          message:
            "backup should publish local build edits without overwriting cloud team edits",
          timeout: 15_000,
        })
        .toMatchObject({
          "builds/all": { author: "Build author builds-b" },
          "teams/all": { author: "Team author teams-a" },
        });

      await expect
        .poll(() => previewManualPlan(secondPage, "download"))
        .toMatchObject({
          automaticPartitionIds: ["teams/all"],
          choices: [],
        });
      await secondPage.getByRole("button", { name: "Restore" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Restore" })
      ).not.toBeVisible();
      await expect
        .poll(() => readLocalPayloadsByPartition(secondPage), {
          message:
            "restore should bring cloud team edits without overwriting local build edits",
          timeout: 15_000,
        })
        .toMatchObject({
          "builds/all": { author: "Build author builds-b" },
          "teams/all": { author: "Team author teams-a" },
        });
    } finally {
      await secondContext.close();
    }
  });

  test("reports no-op backup and restore without writing extra heads", async ({
    page,
  }, testInfo) => {
    await signIn(page, userFor(testInfo, "noop"));
    await seedDomainData(page, makeDomainState("source", 301));
    await clickBackupAndWaitForHeads(page, ["profile.game/600000001"]);
    const firstHead = await readStableBackupHead(page);

    await page.getByRole("button", { name: "Back Up" }).click();
    await expect(
      page.getByText(
        "No local changes are available to upload for this account."
      )
    ).toBeVisible();
    await expect.poll(() => readStableBackupHead(page)).toEqual(firstHead);

    await page.getByRole("button", { name: "Restore" }).click();
    await expect(
      page.getByText(
        "No cloud changes are available to restore for this account."
      )
    ).toBeVisible();
    await expect.poll(() => readStableBackupHead(page)).toEqual(firstHead);
  });

  test("keeps conflict rows unchanged until the user explicitly chooses an overwrite", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "conflict");

    await signIn(page, user);
    await seedDomainData(page, makeDomainState("initial", 401));
    await clickBackupAndWaitForHeads(page, ["teams/all"]);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    try {
      await openBackupPage(secondPage);
      await signIn(secondPage, user);
      await seedDomainData(secondPage, makeDomainState("local", 402));

      await replaceDomainData(page, makeDomainState("remote", 403));
      await page.getByRole("button", { name: "Back Up" }).click();
      await expect
        .poll(() => teamAuthorFromHead(page))
        .toBe("Team author remote");

      await secondPage.getByRole("button", { name: "Back Up" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Back Up" })
      ).toBeVisible();
      await expect(
        secondPage.getByLabel("Custom Teams, Team configs")
      ).toBeVisible();
      await expect(
        secondPage
          .getByText("Keep this browser and the cloud backup as they are.")
          .first()
      ).toBeVisible();
      await secondPage
        .getByRole("dialog", { name: "Back Up" })
        .getByRole("button", { name: "Back Up" })
        .click();
      await expect(
        secondPage.getByText(
          "No data groups were included, so both sides were left unchanged."
        )
      ).toBeVisible();
      await expect
        .poll(() => teamAuthorFromHead(page))
        .toBe("Team author remote");

      await secondPage.getByRole("button", { name: "Back Up" }).click();
      await secondPage
        .getByRole("dialog", { name: "Back Up" })
        .getByLabel("Custom Teams, Team configs")
        .check();
      await secondPage
        .getByRole("dialog", { name: "Back Up" })
        .getByRole("button", { name: "Back Up" })
        .click();
      await expect
        .poll(() => teamAuthorFromHead(page))
        .toBe("Team author local");
    } finally {
      await secondContext.close();
    }
  });

  test("requires an explicit restore choice before overwriting changed local data", async ({
    browser,
    page,
  }, testInfo) => {
    const user = userFor(testInfo, "restore-conflict");
    await signIn(page, user);
    await seedDomainData(page, makeDomainState("initial", 501));
    await clickBackupAndWaitForHeads(page, ["teams/all"]);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    try {
      await openBackupPage(secondPage);
      await signIn(secondPage, user);
      await seedDomainData(secondPage, makeDomainState("local", 502));

      await replaceDomainData(page, makeDomainState("remote", 503));
      await page.getByRole("button", { name: "Back Up" }).click();
      await expect
        .poll(() => teamAuthorFromHead(page))
        .toBe("Team author remote");

      await secondPage.getByRole("button", { name: "Restore" }).click();
      await expect(
        secondPage.getByRole("dialog", { name: "Restore" })
      ).toBeVisible();
      await expect(
        secondPage.getByLabel("Custom Teams, Team configs")
      ).toBeVisible();
      await expect(
        secondPage
          .getByText("Keep this browser and the cloud backup as they are.")
          .first()
      ).toBeVisible();
      await secondPage
        .getByRole("dialog", { name: "Restore" })
        .getByRole("button", { name: "Restore" })
        .click();
      await expect(
        secondPage.getByText(
          "No data groups were included, so both sides were left unchanged."
        )
      ).toBeVisible();
      await expect
        .poll(() => readLocalPayloadsByPartition(secondPage))
        .toMatchObject({
          "teams/all": { author: "Team author local" },
        });

      await secondPage.getByRole("button", { name: "Restore" }).click();
      await secondPage
        .getByRole("dialog", { name: "Restore" })
        .getByLabel("Custom Teams, Team configs")
        .check();
      await secondPage
        .getByRole("dialog", { name: "Restore" })
        .getByRole("button", { name: "Restore" })
        .click();
      await expect
        .poll(() => readLocalPayloadsByPartition(secondPage))
        .toMatchObject({
          "teams/all": { author: "Team author remote" },
        });
    } finally {
      await secondContext.close();
    }
  });

  test("requires an explicit upload choice before deleting cloud data for a removed profile", async ({
    page,
  }, testInfo) => {
    await signIn(page, userFor(testInfo, "delete"));
    await seedDomainData(page, makeDomainState("source", 601));
    await clickBackupAndWaitForHeads(page, ["profile.game/600000001"]);

    await replaceDomainData(page, makeEmptyDomainState());
    await page.getByRole("button", { name: "Back Up" }).click();
    await expect(page.getByRole("dialog", { name: "Back Up" })).toBeVisible();
    await expect(
      page.getByLabel("Characters, Weapons [600000001]")
    ).toBeVisible();

    await page
      .getByRole("dialog", { name: "Back Up" })
      .getByRole("button", { name: "Back Up" })
      .click();
    await expect
      .poll(() => readBackupPartitionKeys(page))
      .toContain("profile.game/600000001");

    await page.getByRole("button", { name: "Back Up" }).click();
    const dialog = page.getByRole("dialog", { name: "Back Up" });
    await dialog.getByLabel("Characters, Weapons [600000001]").check();
    await dialog.getByLabel("Artifacts [600000001]").check();
    await page
      .getByRole("dialog", { name: "Back Up" })
      .getByLabel("Frozen loadouts, Profile settings [600000001]")
      .check();
    await page
      .getByRole("dialog", { name: "Back Up" })
      .getByRole("button", { name: "Back Up" })
      .click();
    await expect
      .poll(() => readBackupPartitionKeys(page))
      .not.toContain("profile.game/600000001");
    await expect
      .poll(() => readBackupPartitionKeys(page))
      .not.toContain("profile.artifacts/600000001");
    await expect
      .poll(() => readBackupPartitionKeys(page))
      .not.toContain("profile.app/600000001");
  });
});

async function openBackupPage(page: Page): Promise<void> {
  await page.goto(BACKUP_ROUTE);
  await page.waitForFunction(() => Boolean(window.__ggE2E));
  await dismissBlockingDialogs(page);
}

async function signIn(page: Page, user: E2eUser): Promise<void> {
  await page.evaluate((nextUser) => window.__ggE2E.signIn(nextUser), user);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__ggE2E));
  await dismissBlockingDialogs(page);
  await expect(page.getByRole("button", { name: "Back Up" })).toBeEnabled();
}

async function signOut(page: Page): Promise<void> {
  await page.evaluate(() => window.__ggE2E.signOut());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__ggE2E));
  await dismissBlockingDialogs(page);
  await expect(page.getByRole("button", { name: "Back Up" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Restore" })).toBeDisabled();
}

async function seedDomainData(page: Page, state: E2eState): Promise<void> {
  await page.evaluate(
    (nextState) => window.__ggE2E.seedDomainData(nextState),
    state
  );
}

async function replaceDomainData(page: Page, state: E2eState): Promise<void> {
  await page.evaluate(
    (nextState) => window.__ggE2E.replaceDomainData(nextState),
    state
  );
}

async function readBackupHead(page: Page): Promise<BackupHeadResponse> {
  return page.evaluate(() =>
    window.__ggE2E.readBackupHead()
  ) as Promise<BackupHeadResponse>;
}

async function readStableBackupHead(page: Page): Promise<{
  headSetRev: string;
  heads: BackupHeadResponse["heads"];
}> {
  const head = await readBackupHead(page);
  return {
    headSetRev: head.headSetRev,
    heads: head.heads,
  };
}

async function readBackupPartitionKeys(page: Page): Promise<string[]> {
  const head = await readBackupHead(page);
  return head.heads.map((entry) => entry.partitionKey).sort();
}

async function readBackupRecordCounts(
  page: Page
): Promise<Record<string, number>> {
  const head = await readBackupHead(page);
  const counts: Record<string, number> = {};
  for (const record of head.heads.flatMap((entry) => entry.metadata.records)) {
    counts[record.kind] = record.count;
  }
  return counts;
}

async function readLocalPayloadsByPartition(
  page: Page
): Promise<Record<string, unknown>> {
  const partitions = (await page.evaluate(() =>
    window.__ggE2E.readLocalPartitions()
  )) as Array<{ namespace: string; partitionKey: string; payload: unknown }>;
  return Object.fromEntries(
    partitions.map((partition) => [
      `${partition.namespace}/${partition.partitionKey}`,
      partition.payload,
    ])
  );
}

async function readCloudPayloadsByPartition(
  page: Page
): Promise<Record<string, unknown>> {
  const partitions = (await page.evaluate(() =>
    window.__ggE2E.readCloudPartitions()
  )) as Array<{ namespace: string; partitionKey: string; payload: unknown }>;
  return Object.fromEntries(
    partitions.map((partition) => [
      `${partition.namespace}/${partition.partitionKey}`,
      partition.payload,
    ])
  );
}

async function restoreAllCloudData(page: Page): Promise<void> {
  await page.evaluate(() => window.__ggE2E.restoreAllCloudData());
}

async function readConflictIds(page: Page): Promise<string[]> {
  const metadata = (await page.evaluate(() =>
    window.__ggE2E.readCloudMetadata()
  )) as { conflictsById: Record<string, unknown> };
  return Object.keys(metadata.conflictsById).sort();
}

async function previewManualPlan(
  page: Page,
  direction: "upload" | "download"
): Promise<{
  status: string;
  automaticPartitionIds: string[];
  choices: Array<{ id: string; kind: string; reason: string }>;
}> {
  return page.evaluate((nextDirection) => {
    return window.__ggE2E.previewManualPlan(nextDirection);
  }, direction);
}

async function teamAuthorFromHead(page: Page): Promise<string | null> {
  const partitions = (await page.evaluate(() =>
    window.__ggE2E.readCloudPartitions()
  )) as Array<{
    namespace: string;
    payload: { author?: string };
  }>;
  return (
    partitions.find((partition) => partition.namespace === "teams")?.payload
      .author ?? null
  );
}

async function clickBackupAndWaitForHeads(
  page: Page,
  expectedPartitionKeys: string[]
): Promise<void> {
  await page.getByRole("button", { name: "Back Up" }).click();
  await expect
    .poll(() => readBackupPartitionKeys(page), {
      message: `cloud head should contain ${expectedPartitionKeys.join(", ")}`,
    })
    .toEqual(expect.arrayContaining(expectedPartitionKeys));
}

async function dismissBlockingDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const closeButton = page.getByRole("button", { name: "Close" }).last();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      return;
    }
    await page.waitForTimeout(300);
  }
}

function userFor(
  testInfo: { title: string; project: { name: string }; workerIndex: number },
  marker: string
): E2eUser {
  const slug = [
    testInfo.title,
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    marker,
  ]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    sub: `e2e-${slug}`,
    name: `E2E ${marker}`,
    email: `${slug}@example.test`,
  };
}

function makeEmptyDomainState(): E2eState {
  return {
    accounts: {},
    activeAccountId: null,
    builds: { deltas: [], characterWeapons: {}, updatedAt: 1 },
    teams: { compDeltas: [], configsByTeamId: {}, updatedAt: 1 },
    characterTiers: {
      tierLists: { 1: emptyCharacterTierList() },
      updatedAt: 1,
    },
    weaponTiers: { tierLists: { 1: emptyTierList() }, updatedAt: 1 },
    artifactTiers: { tierLists: { 1: emptyTierList() }, updatedAt: 1 },
  };
}

function makeDomainState(marker: string, updatedAt: number): E2eState {
  return {
    accounts: {
      [PROFILE_ID]: makeAccount(marker, updatedAt),
    },
    activeAccountId: PROFILE_ID,
    builds: {
      deltas: [buildDelta(marker)],
      characterWeapons: { amber: ["favonius_warbow"] },
      author: `Build author ${marker}`,
      description: `Build description ${marker}`,
      updatedAt,
    },
    teams: {
      compDeltas: [teamDelta(marker)],
      configsByTeamId: {
        [`team-${marker}`]: { combatOptions: {}, charConfigs: {} },
      },
      author: `Team author ${marker}`,
      description: `Team description ${marker}`,
      updatedAt,
    },
    characterTiers: {
      tierLists: {
        1: {
          ...emptyCharacterTierList(),
          customTitle: `Character tiers ${marker}`,
          tierAssignments: { amber: { tier: "S", position: 0 } },
          author: `Tier author ${marker}`,
        },
      },
      activeTierListId: 1,
      nextId: 2,
      updatedAt,
    },
    weaponTiers: {
      tierLists: {
        1: {
          ...emptyTierList(),
          customTitle: `Weapon tiers ${marker}`,
          tierAssignments: { favonius_warbow: { tier: "A", position: 0 } },
        },
      },
      activeTierListId: 1,
      nextId: 2,
      updatedAt,
    },
    artifactTiers: {
      tierLists: {
        1: {
          ...emptyTierList(),
          customTitle: `Artifact tiers ${marker}`,
          tierAssignments: {
            CrimsonWitchOfFlames: { tier: "B", position: 0 },
          },
        },
      },
      activeTierListId: 1,
      nextId: 2,
      updatedAt,
    },
  };
}

function makeTeamsOnlyState(marker: string, updatedAt: number): E2eState {
  const empty = makeEmptyDomainState();
  const full = makeDomainState(marker, updatedAt);
  return {
    ...empty,
    teams: full.teams,
  };
}

function makeStateWithChangedParts(
  baseMarker: string,
  baseUpdatedAt: number,
  changedMarker: string,
  changedUpdatedAt: number,
  changedParts: DomainPart[]
): E2eState {
  const base = makeDomainState(baseMarker, baseUpdatedAt);
  const changed = makeDomainState(changedMarker, changedUpdatedAt);
  return {
    ...base,
    ...(changedParts.includes("account")
      ? {
          accounts: changed.accounts,
          activeAccountId: changed.activeAccountId,
        }
      : {}),
    ...(changedParts.includes("builds") ? { builds: changed.builds } : {}),
    ...(changedParts.includes("teams") ? { teams: changed.teams } : {}),
    ...(changedParts.includes("tiers")
      ? {
          characterTiers: changed.characterTiers,
          weaponTiers: changed.weaponTiers,
          artifactTiers: changed.artifactTiers,
        }
      : {}),
  };
}

function makeAccount(marker: string, updatedAt: number) {
  return {
    id: PROFILE_ID,
    name: `Account ${marker}`,
    lastUpdate: updatedAt,
    data: {
      characters: [
        {
          key: "amber",
          level: marker === "remote" ? 81 : marker === "conflict" ? 82 : 80,
          constellation: marker === "other-user" ? 1 : 0,
          talent: { auto: 1, skill: 2, burst: 3 },
          weapon: {
            id: `weapon-${marker}`,
            key: "favonius_warbow",
            level: 70,
            refinement: 2,
            lock: true,
          },
          artifacts: {},
        },
      ],
      extraArtifacts: [
        {
          id: `artifact-${marker}`,
          setKey: "CrimsonWitchOfFlames",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          lock: true,
          substats: { cr: marker === "conflict" ? 7.8 : 3.9, cd: 7.8 },
        },
      ],
      extraWeapons: [
        {
          id: `extra-weapon-${marker}`,
          key: "the_stringless",
          level: 80,
          refinement: 1,
          lock: true,
        },
      ],
    },
  };
}

function buildDelta(marker: string) {
  return {
    kind: "custom",
    id: `build-${marker}`,
    displayIndex: 0,
    value: {
      id: `build-${marker}`,
      characterId: "amber",
      visible: true,
      name: `Pyro build ${marker}`,
      composition: "4pc",
      artifactSet: "CrimsonWitchOfFlames",
      substats: [{ stat: "cr", weight: marker === "remote" ? 90 : 80 }],
      sandsWeights: [{ stat: "atk%", weight: 100 }],
      gobletWeights: [{ stat: "pyro%", weight: 100 }],
      circletWeights: [{ stat: "cr", weight: 100 }],
      normalizer: 1,
    },
  };
}

function teamDelta(marker: string) {
  return {
    kind: "custom",
    id: `team-${marker}`,
    displayIndex: 0,
    value: {
      id: `team-${marker}`,
      name: `Team ${marker}`,
      slots: [
        { charId: "amber", weaponId: "favonius_warbow", artifactSet: null },
        { charId: null, weaponId: null, artifactSet: null },
        { charId: null, weaponId: null, artifactSet: null },
        { charId: null, weaponId: null, artifactSet: null },
      ],
      reactions: [],
    },
  };
}

function emptyCharacterTierList() {
  return {
    ...emptyTierList(),
    linkedAccountId: null,
  };
}

function emptyTierList() {
  return {
    id: 1,
    tierAssignments: {},
    tierCustomization: {},
    customTitle: "",
    author: "",
    description: "",
    linkedAccountId: null,
  };
}
