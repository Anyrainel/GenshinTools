import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountData, CharacterData } from "@/data/types";
import {
  DEFAULT_MIN_SCORE_DIFF,
  DEFAULT_TIER_THRESHOLDS,
} from "@/lib/account-data/resourceTips";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { migrateAccountStore } from "@/stores/migration/account";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import { useTriageStore } from "@/stores/useTriageStore";
import { createArtifactScoreResult } from "../fixtures";

// Reset store before each test
beforeEach(() => {
  useAccountStore.getState().clearAccounts();
  useAccountScoreCacheStore.getState().clearAllScores();
  const triageSettings = structuredClone(DEFAULT_TRIAGE_SETTINGS);
  useTriageStore.setState({
    settings: triageSettings,
    settingsByProfileId: {
      0: structuredClone(DEFAULT_TRIAGE_SETTINGS),
    },
  });
  const resourceSettings = {
    thresholds: { ...DEFAULT_TIER_THRESHOLDS },
    minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
    panelOpen: false,
    showCraft: true,
    showReroll: true,
    showLevelup: true,
  };
  useResourceRecStore.setState({
    ...resourceSettings,
    settingsByProfileId: {
      0: structuredClone(resourceSettings),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to create sample account data
function createSampleAccountData(
  overrides: Partial<AccountData> = {}
): AccountData {
  return {
    characters: [],
    extraArtifacts: [],
    extraWeapons: [],
    ...overrides,
  };
}

// Helper to create sample character data
function createSampleCharacter(
  overrides: Partial<CharacterData> = {}
): CharacterData {
  return {
    key: "kaedehara_kazuha",
    constellation: 0,
    level: 90,
    talent: { auto: 10, skill: 10, burst: 10 },
    artifacts: {},
    ...overrides,
  };
}

describe("useAccountStore", () => {
  describe("initial state", () => {
    it("starts with null activeAccountId", () => {
      const state = useAccountStore.getState();
      expect(state.activeAccountId).toBeNull();
    });

    it("starts with empty accounts object", () => {
      const state = useAccountStore.getState();
      expect(state.accounts).toEqual({});
    });
  });

  describe("addOrUpdateAccount", () => {
    it("adds initial account data", () => {
      const data = createSampleAccountData({
        characters: [createSampleCharacter()],
      });

      useAccountStore.getState().addOrUpdateAccount(0, { data });

      const state = useAccountStore.getState();
      expect(state.accounts[0].data).toEqual(data);
      expect(state.accounts[0].data.characters.length).toBe(1);
      expect(state.activeAccountId).toBe(0);
    });

    it("replaces existing account data", () => {
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: createSampleAccountData({
          characters: [createSampleCharacter({ key: "venti" })],
        }),
      });

      const newData = createSampleAccountData({
        characters: [
          createSampleCharacter({ key: "kaedehara_kazuha" }),
          createSampleCharacter({ key: "xingqiu" }),
        ],
      });
      useAccountStore.getState().addOrUpdateAccount(0, { data: newData });

      const state = useAccountStore.getState();
      expect(state.accounts[0].data.characters.length).toBe(2);
      expect(state.accounts[0].data.characters[0].key).toBe("kaedehara_kazuha");
    });
  });

  describe("applyAccountImport", () => {
    it("stamps imports with the current time", () => {
      const now = new Date("2026-04-28T12:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const data = createSampleAccountData({
        characters: [createSampleCharacter()],
      });

      applyAccountImport({ accountId: 0, data, name: "Default" });

      expect(useAccountStore.getState().accounts[0].lastUpdate).toBe(
        now.getTime()
      );
    });

    it("preserves an explicit import timestamp", () => {
      const importedAt = 1_777_777_777_000;
      const data = createSampleAccountData();

      applyAccountImport({
        accountId: 0,
        data,
        lastUpdate: importedAt,
      });

      expect(useAccountStore.getState().accounts[0].lastUpdate).toBe(
        importedAt
      );
    });

    it("clones customized triage and resource settings for a new profile", () => {
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: createSampleAccountData(),
      });
      useAccountStore.getState().setActiveAccount(0);
      useTriageStore.getState().updateSettings({ mainStatThreshold: 88 });
      useResourceRecStore.getState().setPanelOpen(true);

      const result = applyAccountImport({
        accountId: 800000001,
        data: createSampleAccountData(),
        name: "Main",
        setAsActive: 800000001,
      });

      expect(result.clonedProfileSettings).toEqual(["triage", "resources"]);
      expect(
        useTriageStore.getState().settingsByProfileId[800000001]
          .mainStatThreshold
      ).toBe(88);
      expect(useTriageStore.getState().settings.mainStatThreshold).toBe(88);
      expect(
        useResourceRecStore.getState().settingsByProfileId[800000001].panelOpen
      ).toBe(true);
      expect(useResourceRecStore.getState().panelOpen).toBe(true);
    });

    it("does not materialize default settings for a new profile", () => {
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: createSampleAccountData(),
      });
      useAccountStore.getState().setActiveAccount(0);

      const result = applyAccountImport({
        accountId: 800000002,
        data: createSampleAccountData(),
        setAsActive: 800000002,
      });

      expect(result.clonedProfileSettings).toEqual([]);
      expect(
        useTriageStore.getState().settingsByProfileId[800000002]
      ).toBeUndefined();
      expect(
        useResourceRecStore.getState().settingsByProfileId[800000002]
      ).toBeUndefined();
      expect(useTriageStore.getState().settings).toEqual(
        DEFAULT_TRIAGE_SETTINGS
      );
      expect(useResourceRecStore.getState().thresholds).toEqual(
        DEFAULT_TIER_THRESHOLDS
      );
    });

    it("does not overwrite settings when importing into an existing profile", () => {
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: createSampleAccountData(),
      });
      useAccountStore.getState().addOrUpdateAccount(800000003, {
        data: createSampleAccountData(),
      });
      useAccountStore.getState().setActiveAccount(0);
      useTriageStore.getState().updateSettings({ mainStatThreshold: 90 });
      useResourceRecStore.getState().setPanelOpen(true);
      useTriageStore.setState((state) => ({
        settingsByProfileId: {
          ...state.settingsByProfileId,
          800000003: {
            ...structuredClone(DEFAULT_TRIAGE_SETTINGS),
            mainStatThreshold: 70,
          },
        },
      }));
      useResourceRecStore.setState((state) => ({
        settingsByProfileId: {
          ...state.settingsByProfileId,
          800000003: {
            thresholds: { ...DEFAULT_TIER_THRESHOLDS },
            minScoreDiff: structuredClone(DEFAULT_MIN_SCORE_DIFF),
            panelOpen: false,
            showCraft: true,
            showReroll: true,
            showLevelup: true,
          },
        },
      }));

      const result = applyAccountImport({
        accountId: 800000003,
        data: createSampleAccountData(),
        setAsActive: 800000003,
      });

      expect(result.clonedProfileSettings).toEqual([]);
      expect(
        useTriageStore.getState().settingsByProfileId[800000003]
          .mainStatThreshold
      ).toBe(70);
      expect(
        useResourceRecStore.getState().settingsByProfileId[800000003].panelOpen
      ).toBe(false);
    });
  });

  describe("setActiveAccount", () => {
    it("sets the active account ID", () => {
      useAccountStore
        .getState()
        .addOrUpdateAccount(123456789, { data: createSampleAccountData() });
      useAccountStore.getState().setActiveAccount(123456789);

      const state = useAccountStore.getState();
      expect(state.activeAccountId).toBe(123456789);
    });
  });

  describe("promoteToUid", () => {
    it("renames storage key, id field, and updates activeAccountId", () => {
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: createSampleAccountData({
          characters: [createSampleCharacter()],
        }),
      });
      useAccountStore.getState().setActiveAccount(0);

      useAccountStore.getState().promoteToUid(0, 800000001);

      const state = useAccountStore.getState();
      expect(state.accounts[800000001]).toBeDefined();
      expect(state.accounts[800000001].id).toBe(800000001);
      expect(state.accounts[0]).toBeUndefined();
      expect(state.activeAccountId).toBe(800000001);
    });
  });

  describe("clearAccounts", () => {
    it("clears accounts dictionary", () => {
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: createSampleAccountData({
          characters: [createSampleCharacter()],
        }),
      });

      useAccountStore.getState().clearAccounts();

      const state = useAccountStore.getState();
      expect(state.accounts).toEqual({});
      expect(state.activeAccountId).toBeNull();
    });
  });
});

// ─── Score staleness tests ────────────────────────────────────────────────────

describe("account score cache integration", () => {
  const sampleData = createSampleAccountData({
    characters: [
      createSampleCharacter({ key: "hu_tao" }),
      createSampleCharacter({ key: "xiangling" }),
      createSampleCharacter({ key: "xingqiu" }),
    ],
  });

  beforeEach(() => {
    useAccountStore.getState().addOrUpdateAccount(1, { data: sampleData });
    useAccountStore.getState().setActiveAccount(1);
    // addOrUpdateAccount marks profile 1 stale; clear it for targeted tests.
    useAccountScoreCacheStore.getState().setScores(1, {
      hu_tao: null,
      xiangling: null,
      xingqiu: null,
    });
  });

  describe("invalidateScores", () => {
    it("marks all stale when called without args", () => {
      useAccountScoreCacheStore.getState().invalidateScores(1);
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toBe(true);
    });

    it("marks specific characters stale", () => {
      useAccountScoreCacheStore.getState().invalidateScores(1, ["hu_tao"]);
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual(["hu_tao"]);
    });

    it("accumulates multiple per-character invalidations", () => {
      useAccountScoreCacheStore.getState().invalidateScores(1, ["hu_tao"]);
      useAccountScoreCacheStore.getState().invalidateScores(1, ["xiangling"]);
      const stale =
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1];
      expect(stale).toEqual(expect.arrayContaining(["hu_tao", "xiangling"]));
      expect((stale as string[]).length).toBe(2);
    });

    it("deduplicates repeated invalidation of same character", () => {
      useAccountScoreCacheStore.getState().invalidateScores(1, ["hu_tao"]);
      useAccountScoreCacheStore.getState().invalidateScores(1, ["hu_tao"]);
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual(["hu_tao"]);
    });

    it("per-character invalidation is no-op when already fully stale", () => {
      useAccountScoreCacheStore.getState().invalidateScores(1); // all stale
      useAccountScoreCacheStore.getState().invalidateScores(1, ["hu_tao"]);
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toBe(true);
    });

    it("global invalidation overrides per-character list", () => {
      useAccountScoreCacheStore.getState().invalidateScores(1, ["hu_tao"]);
      useAccountScoreCacheStore.getState().invalidateScores(1); // all stale
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toBe(true);
    });

    it("global invalidation marks every cached profile", () => {
      useAccountScoreCacheStore.getState().setScores(2, { raiden: null });

      useAccountScoreCacheStore
        .getState()
        .invalidateScores(undefined, ["hu_tao"]);

      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual(["hu_tao"]);
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[2]
      ).toEqual(["hu_tao"]);
    });
  });

  describe("mergeScores", () => {
    it("merges partial scores with existing", () => {
      const mockScore = createArtifactScoreResult();
      useAccountScoreCacheStore.getState().mergeScores(1, {
        hu_tao: mockScore,
      });
      const scores = useAccountScoreCacheStore.getState().scoresByProfileId[1];
      expect(scores.hu_tao).toEqual(mockScore);
      // Other scores preserved
      expect(scores.xiangling).toBeNull();
      expect(scores.xingqiu).toBeNull();
    });

    it("clears per-character staleness only for scored characters", () => {
      useAccountScoreCacheStore
        .getState()
        .invalidateScores(1, ["hu_tao", "xiangling"]);
      useAccountScoreCacheStore.getState().mergeScores(1, {
        hu_tao: createArtifactScoreResult(),
      });
      // hu_tao cleared, xiangling remains stale
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual(["xiangling"]);
    });

    it("clears full staleness (true) to empty after scoring", () => {
      useAccountScoreCacheStore.getState().invalidateScores(1); // true
      useAccountScoreCacheStore.getState().mergeScores(1, {
        hu_tao: createArtifactScoreResult(),
        xiangling: null,
        xingqiu: null,
      });
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual([]);
    });

    it("is a no-op on empty stale list", () => {
      const before =
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1];
      useAccountScoreCacheStore.getState().mergeScores(1, { hu_tao: null });
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual(before);
    });
  });

  describe("addOrUpdateAccount", () => {
    it("marks all stale when data changes", () => {
      // Clear staleness first
      useAccountScoreCacheStore.getState().setScores(1, {});
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual([]);

      // Update with new data object → marks all stale
      const newData = createSampleAccountData({
        characters: [createSampleCharacter({ key: "venti" })],
      });
      useAccountStore.getState().addOrUpdateAccount(1, { data: newData });
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toBe(true);
    });

    it("does not change staleness when data is same reference", () => {
      // Clear staleness
      useAccountScoreCacheStore.getState().setScores(1, {});
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual([]);

      // Same data reference → no stale change
      const existingData = useAccountStore.getState().accounts[1].data;
      useAccountStore.getState().addOrUpdateAccount(1, { data: existingData });
      expect(
        useAccountScoreCacheStore.getState().staleScoreCharIdsByProfileId[1]
      ).toEqual([]);
    });

    it("renames score cache when profile 0 is promoted to a UID", () => {
      useAccountScoreCacheStore.getState().setScores(0, {
        hu_tao: createArtifactScoreResult(),
      });
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: createSampleAccountData(),
      });

      useAccountStore.getState().promoteToUid(0, 800000001);

      expect(
        useAccountScoreCacheStore.getState().scoresByProfileId[0]
      ).toBeUndefined();
      expect(
        useAccountScoreCacheStore.getState().scoresByProfileId[800000001].hu_tao
      ).toBeDefined();
    });

    it("removes score cache when account profiles are deleted or cleared", () => {
      useAccountScoreCacheStore.getState().setScores(1, {
        hu_tao: createArtifactScoreResult(),
      });

      useAccountStore.getState().deleteAccount(1);
      expect(
        useAccountScoreCacheStore.getState().scoresByProfileId[1]
      ).toBeUndefined();

      useAccountStore.getState().addOrUpdateAccount(2, {
        data: createSampleAccountData(),
      });
      useAccountScoreCacheStore.getState().setScores(2, { raiden: null });
      useAccountStore.getState().clearAccounts();

      expect(useAccountScoreCacheStore.getState().scoresByProfileId).toEqual(
        {}
      );
    });
  });
});

// ─── Migration tests ──────────────────────────────────────────────────────────
// These verify that persisted data from before the multi-account refactor
// (commit 9c3f53ead0a5c85f3f0ce661f9195fbf366fd1e0 and earlier) is correctly
// migrated to the current source-data-only account format.

describe("migrateAccountStore", () => {
  const sampleAccountData: AccountData = {
    characters: [
      {
        key: "hu_tao",
        level: 90,
        constellation: 1,
        talent: { auto: 10, skill: 10, burst: 8 },
        artifacts: {},
      },
    ],
    extraArtifacts: [],
    extraWeapons: [],
  };

  describe("v0 / v1 → current (old single-account format)", () => {
    it("migrates v1 data with a UID to a UID-keyed account", () => {
      const persisted = {
        accountData: sampleAccountData,
        scores: { hu_tao: { subScore: 42, mainScore: 10, totalScore: 52 } },
        lastUid: "800000000",
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 1);

      expect(result.accounts["800000000"]).toBeDefined();
      expect(result.accounts[800000000].id).toBe(800000000);
      expect(result.accounts[800000000].name).toBe("800000000");
      expect(result.accounts[800000000].data).toEqual(sampleAccountData);
      expect(result.activeAccountId).toBe(800000000);
      // No uid field on the account
      expect(
        (result.accounts[800000000] as Record<string, unknown>).uid
      ).toBeUndefined();
      expect(
        (result.accounts[800000000] as Record<string, unknown>).scores
      ).toBeUndefined();
    });

    it("migrates v1 data without a UID to a 'default' account", () => {
      const persisted = {
        accountData: sampleAccountData,
        scores: {},
        lastUid: "",
        isScoresStale: true,
      };

      const result = migrateAccountStore(persisted, 1);

      expect(result.accounts[0]).toBeDefined();
      expect(result.accounts[0].id).toBe(0);
      expect(result.accounts[0].name).toBe("Default Account");
      expect(result.accounts[0].data).toEqual(sampleAccountData);
      expect(result.activeAccountId).toBe(0);
      expect(
        (result.accounts[0] as Record<string, unknown>).scores
      ).toBeUndefined();
    });

    it("migrates v0 data identically to v1", () => {
      const persisted = {
        accountData: sampleAccountData,
        scores: {},
        lastUid: "700000001",
        isScoresStale: false,
      };

      const v0Result = migrateAccountStore(persisted, 0);
      const v1Result = migrateAccountStore(persisted, 1);

      expect(v0Result.accounts["700000001"]).toBeDefined();
      expect(v0Result.activeAccountId).toBe(v1Result.activeAccountId);
    });

    it("returns empty accounts when v1 data has no accountData", () => {
      const persisted = { accountData: null, scores: {}, lastUid: "" };

      const result = migrateAccountStore(persisted, 1);

      expect(result.accounts).toEqual({});
      expect(result.activeAccountId).toBeNull();
    });

    it("returns empty accounts when v0 data has no accountData", () => {
      const result = migrateAccountStore({}, 0);

      expect(result.accounts).toEqual({});
      expect(result.activeAccountId).toBeNull();
    });
  });

  describe("v2 → current (multi-account with separate uid field)", () => {
    it("strips uid field when uid matches storage key", () => {
      const persisted = {
        accounts: {
          "800000000": {
            id: "800000000",
            uid: "800000000",
            name: "Main",
            data: sampleAccountData,
            scores: {},
            lastUpdate: 1000,
          },
        },
        activeAccountId: "800000000",
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 2);

      expect(result.accounts["800000000"]).toBeDefined();
      expect(result.accounts[800000000].id).toBe(800000000);
      expect(
        (result.accounts[800000000] as Record<string, unknown>).uid
      ).toBeUndefined();
      expect(
        (result.accounts[800000000] as Record<string, unknown>).scores
      ).toBeUndefined();
      expect(result.accounts[800000000].name).toBe("Main");
      expect(result.activeAccountId).toBe(800000000);
    });

    it("promotes default profile to UID key when uid differs from storage key", () => {
      // User had default profile and manually set uid to "800000002" (old v2 behavior)
      const persisted = {
        accounts: {
          default: {
            id: "default",
            uid: "800000002",
            name: "MyAccount",
            data: sampleAccountData,
            scores: {},
            lastUpdate: 2000,
          },
        },
        activeAccountId: "default",
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 2);

      // Old "default" key is gone
      expect(result.accounts[0]).toBeUndefined();
      // Now stored under the UID
      expect(result.accounts["800000002"]).toBeDefined();
      expect(result.accounts[800000002].id).toBe(800000002);
      expect(
        (result.accounts[800000002] as Record<string, unknown>).uid
      ).toBeUndefined();
      expect(
        (result.accounts[800000002] as Record<string, unknown>).scores
      ).toBeUndefined();
      expect(result.accounts["800000002"].name).toBe("MyAccount");
      // activeAccountId updated to follow
      expect(result.activeAccountId).toBe(800000002);
    });

    it("preserves default profile when uid is empty", () => {
      const persisted = {
        accounts: {
          default: {
            id: "default",
            uid: "",
            name: "Default Account",
            data: sampleAccountData,
            scores: {},
            lastUpdate: 3000,
          },
        },
        activeAccountId: "default",
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 2);

      expect(result.accounts[0]).toBeDefined();
      expect(result.accounts[0].id).toBe(0);
      expect(
        (result.accounts[0] as Record<string, unknown>).uid
      ).toBeUndefined();
      expect(result.activeAccountId).toBe(0);
    });

    it("migrates multiple accounts, promoting only the ones with mismatched uid", () => {
      const persisted = {
        accounts: {
          default: {
            id: "default",
            uid: "900000001",
            name: "Alt",
            data: sampleAccountData,
            scores: {},
            lastUpdate: 100,
          },
          "700000002": {
            id: "700000002",
            uid: "700000002",
            name: "Main",
            data: sampleAccountData,
            scores: {},
            lastUpdate: 200,
          },
        },
        activeAccountId: "default",
        isScoresStale: true,
      };

      const result = migrateAccountStore(persisted, 2);

      expect(result.accounts[0]).toBeUndefined();
      expect(result.accounts[900000001]).toBeDefined();
      expect(result.accounts[900000001].id).toBe(900000001);
      expect(result.accounts[700000002]).toBeDefined();
      expect(result.accounts[700000002].id).toBe(700000002);
      expect(result.activeAccountId).toBe(900000001);
      expect(
        (result.accounts[900000001] as Record<string, unknown>).scores
      ).toBeUndefined();
    });

    it("handles empty accounts gracefully", () => {
      const persisted = {
        accounts: {},
        activeAccountId: null,
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 2);

      expect(result.accounts).toEqual({});
      expect(result.activeAccountId).toBeNull();
    });
  });

  describe("v3 → current (drop account score cache fields)", () => {
    it("drops false isScoresStale", () => {
      const persisted = {
        accounts: {},
        activeAccountId: null,
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 3);

      expect(
        (result as unknown as Record<string, unknown>).staleScoreCharIds
      ).toBeUndefined();
    });

    it("drops true isScoresStale and account scores", () => {
      const persisted = {
        accounts: {
          "800000000": {
            id: "800000000",
            data: sampleAccountData,
            scores: {},
            name: "Main",
            lastUpdate: 1000,
          },
        },
        activeAccountId: "800000000",
        isScoresStale: true,
      };

      const result = migrateAccountStore(persisted, 3);

      expect(result.accounts["800000000"]).toBeDefined();
      expect(
        (result.accounts[800000000] as Record<string, unknown>).scores
      ).toBeUndefined();
      expect(
        (result as unknown as Record<string, unknown>).staleScoreCharIds
      ).toBeUndefined();
    });
  });

  describe("v6+ → source-data normalization", () => {
    it("strips cache fields from current persisted state", () => {
      const persisted = {
        accounts: {
          800000000: {
            id: 800000000,
            name: "Main",
            data: sampleAccountData,
            scores: { hu_tao: null },
            lastUpdate: 1000,
          },
        },
        activeAccountId: null,
        staleScoreCharIds: [],
      };

      const result = migrateAccountStore(persisted, 6);

      expect(result.accounts[800000000].name).toBe("Main");
      expect(
        (result.accounts[800000000] as Record<string, unknown>).scores
      ).toBeUndefined();
      expect(
        (result as unknown as Record<string, unknown>).staleScoreCharIds
      ).toBeUndefined();
    });
  });
});
