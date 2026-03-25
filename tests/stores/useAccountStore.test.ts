import type { AccountData, CharacterData } from "@/data/types";
import { migrateAccountStore, useAccountStore } from "@/stores/useAccountStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test
beforeEach(() => {
  useAccountStore.getState().clearAccounts();
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

      useAccountStore.getState().addOrUpdateAccount("default", { data });

      const state = useAccountStore.getState();
      expect(state.accounts.default.data).toEqual(data);
      expect(state.accounts.default.data.characters.length).toBe(1);
      expect(state.activeAccountId).toBe("default");
    });

    it("replaces existing account data", () => {
      useAccountStore.getState().addOrUpdateAccount("default", {
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
      useAccountStore
        .getState()
        .addOrUpdateAccount("default", { data: newData });

      const state = useAccountStore.getState();
      expect(state.accounts.default.data.characters.length).toBe(2);
      expect(state.accounts.default.data.characters[0].key).toBe(
        "kaedehara_kazuha"
      );
    });
  });

  describe("setActiveAccount", () => {
    it("sets the active account ID", () => {
      useAccountStore
        .getState()
        .addOrUpdateAccount("123456789", { data: createSampleAccountData() });
      useAccountStore.getState().setActiveAccount("123456789");

      const state = useAccountStore.getState();
      expect(state.activeAccountId).toBe("123456789");
    });
  });

  describe("promoteToUid", () => {
    it("renames storage key, id field, and updates activeAccountId", () => {
      useAccountStore.getState().addOrUpdateAccount("default", {
        data: createSampleAccountData({
          characters: [createSampleCharacter()],
        }),
      });
      useAccountStore.getState().setActiveAccount("default");

      useAccountStore.getState().promoteToUid("default", "800000001");

      const state = useAccountStore.getState();
      expect(state.accounts["800000001"]).toBeDefined();
      expect(state.accounts["800000001"].id).toBe("800000001");
      expect(state.accounts.default).toBeUndefined();
      expect(state.activeAccountId).toBe("800000001");
    });
  });

  describe("clearAccounts", () => {
    it("clears accounts dictionary", () => {
      useAccountStore.getState().addOrUpdateAccount("default", {
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

describe("per-character score staleness", () => {
  const sampleData = createSampleAccountData({
    characters: [
      createSampleCharacter({ key: "hu_tao" }),
      createSampleCharacter({ key: "xiangling" }),
      createSampleCharacter({ key: "xingqiu" }),
    ],
  });

  beforeEach(() => {
    useAccountStore.getState().addOrUpdateAccount("test", { data: sampleData });
    useAccountStore.getState().setActiveAccount("test");
    // addOrUpdateAccount marks staleScoreCharIds = true; clear it for targeted tests
    useAccountStore.getState().setScores({
      hu_tao: null,
      xiangling: null,
      xingqiu: null,
    });
  });

  describe("invalidateScores", () => {
    it("marks all stale when called without args", () => {
      useAccountStore.getState().invalidateScores();
      expect(useAccountStore.getState().staleScoreCharIds).toBe(true);
    });

    it("marks specific characters stale", () => {
      useAccountStore.getState().invalidateScores(["hu_tao"]);
      expect(useAccountStore.getState().staleScoreCharIds).toEqual(["hu_tao"]);
    });

    it("accumulates multiple per-character invalidations", () => {
      useAccountStore.getState().invalidateScores(["hu_tao"]);
      useAccountStore.getState().invalidateScores(["xiangling"]);
      const stale = useAccountStore.getState().staleScoreCharIds;
      expect(stale).toEqual(expect.arrayContaining(["hu_tao", "xiangling"]));
      expect((stale as string[]).length).toBe(2);
    });

    it("deduplicates repeated invalidation of same character", () => {
      useAccountStore.getState().invalidateScores(["hu_tao"]);
      useAccountStore.getState().invalidateScores(["hu_tao"]);
      expect(useAccountStore.getState().staleScoreCharIds).toEqual(["hu_tao"]);
    });

    it("per-character invalidation is no-op when already fully stale", () => {
      useAccountStore.getState().invalidateScores(); // all stale
      useAccountStore.getState().invalidateScores(["hu_tao"]);
      expect(useAccountStore.getState().staleScoreCharIds).toBe(true);
    });

    it("global invalidation overrides per-character list", () => {
      useAccountStore.getState().invalidateScores(["hu_tao"]);
      useAccountStore.getState().invalidateScores(); // all stale
      expect(useAccountStore.getState().staleScoreCharIds).toBe(true);
    });
  });

  describe("mergeScores", () => {
    it("merges partial scores with existing", () => {
      useAccountStore.getState().mergeScores({
        hu_tao: { subScore: 10, mainScore: 5, totalScore: 15 },
      });
      const scores = useAccountStore.getState().accounts.test.scores;
      expect(scores.hu_tao).toEqual({
        subScore: 10,
        mainScore: 5,
        totalScore: 15,
      });
      // Other scores preserved
      expect(scores.xiangling).toBeNull();
      expect(scores.xingqiu).toBeNull();
    });

    it("clears per-character staleness only for scored characters", () => {
      useAccountStore.getState().invalidateScores(["hu_tao", "xiangling"]);
      useAccountStore.getState().mergeScores({
        hu_tao: { subScore: 10, mainScore: 5, totalScore: 15 },
      });
      // hu_tao cleared, xiangling remains stale
      expect(useAccountStore.getState().staleScoreCharIds).toEqual([
        "xiangling",
      ]);
    });

    it("clears full staleness (true) to empty after scoring", () => {
      useAccountStore.getState().invalidateScores(); // true
      useAccountStore.getState().mergeScores({
        hu_tao: { subScore: 10, mainScore: 5, totalScore: 15 },
        xiangling: null,
        xingqiu: null,
      });
      expect(useAccountStore.getState().staleScoreCharIds).toEqual([]);
    });

    it("is a no-op on empty stale list", () => {
      // staleScoreCharIds already [] from beforeEach
      const before = useAccountStore.getState().staleScoreCharIds;
      useAccountStore.getState().mergeScores({ hu_tao: null });
      expect(useAccountStore.getState().staleScoreCharIds).toEqual(before);
    });
  });

  describe("addOrUpdateAccount", () => {
    it("marks all stale when data changes", () => {
      // Clear staleness first
      useAccountStore.getState().setScores({});
      expect(useAccountStore.getState().staleScoreCharIds).toEqual([]);

      // Update with new data object → marks all stale
      const newData = createSampleAccountData({
        characters: [createSampleCharacter({ key: "venti" })],
      });
      useAccountStore.getState().addOrUpdateAccount("test", { data: newData });
      expect(useAccountStore.getState().staleScoreCharIds).toBe(true);
    });

    it("does not change staleness when data is same reference", () => {
      // Clear staleness
      useAccountStore.getState().setScores({});
      expect(useAccountStore.getState().staleScoreCharIds).toEqual([]);

      // Same data reference → no stale change
      const existingData = useAccountStore.getState().accounts.test.data;
      useAccountStore
        .getState()
        .addOrUpdateAccount("test", { data: existingData });
      expect(useAccountStore.getState().staleScoreCharIds).toEqual([]);
    });
  });
});

// ─── Migration tests ──────────────────────────────────────────────────────────
// These verify that persisted data from before the multi-account refactor
// (commit 9c3f53ead0a5c85f3f0ce661f9195fbf366fd1e0 and earlier) is correctly
// migrated to the current v4 format.

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

  describe("v0 / v1 → v4 (old single-account format)", () => {
    it("migrates v1 data with a UID to a UID-keyed account", () => {
      const persisted = {
        accountData: sampleAccountData,
        scores: { hu_tao: { subScore: 42, mainScore: 10, totalScore: 52 } },
        lastUid: "800000000",
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 1);

      expect(result.accounts["800000000"]).toBeDefined();
      expect(result.accounts["800000000"].id).toBe("800000000");
      expect(result.accounts["800000000"].name).toBe("800000000");
      expect(result.accounts["800000000"].data).toEqual(sampleAccountData);
      expect(result.accounts["800000000"].scores).toEqual(persisted.scores);
      expect(result.activeAccountId).toBe("800000000");
      expect(result.staleScoreCharIds).toEqual([]);
      // No uid field on the account
      expect(
        (result.accounts["800000000"] as Record<string, unknown>).uid
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

      expect(result.accounts.default).toBeDefined();
      expect(result.accounts.default.id).toBe("default");
      expect(result.accounts.default.name).toBe("Default Account");
      expect(result.accounts.default.data).toEqual(sampleAccountData);
      expect(result.activeAccountId).toBe("default");
      expect(result.staleScoreCharIds).toBe(true);
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
      expect(result.staleScoreCharIds).toEqual([]);
    });

    it("returns empty accounts when v0 data has no accountData", () => {
      const result = migrateAccountStore({}, 0);

      expect(result.accounts).toEqual({});
      expect(result.activeAccountId).toBeNull();
    });
  });

  describe("v2 → v4 (multi-account with separate uid field)", () => {
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
      expect(result.accounts["800000000"].id).toBe("800000000");
      expect(
        (result.accounts["800000000"] as Record<string, unknown>).uid
      ).toBeUndefined();
      expect(result.accounts["800000000"].name).toBe("Main");
      expect(result.activeAccountId).toBe("800000000");
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
      expect(result.accounts.default).toBeUndefined();
      // Now stored under the UID
      expect(result.accounts["800000002"]).toBeDefined();
      expect(result.accounts["800000002"].id).toBe("800000002");
      expect(
        (result.accounts["800000002"] as Record<string, unknown>).uid
      ).toBeUndefined();
      expect(result.accounts["800000002"].name).toBe("MyAccount");
      // activeAccountId updated to follow
      expect(result.activeAccountId).toBe("800000002");
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

      expect(result.accounts.default).toBeDefined();
      expect(result.accounts.default.id).toBe("default");
      expect(
        (result.accounts.default as Record<string, unknown>).uid
      ).toBeUndefined();
      expect(result.activeAccountId).toBe("default");
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

      expect(result.accounts.default).toBeUndefined();
      expect(result.accounts["900000001"]).toBeDefined();
      expect(result.accounts["900000001"].id).toBe("900000001");
      expect(result.accounts["700000002"]).toBeDefined();
      expect(result.accounts["700000002"].id).toBe("700000002");
      expect(result.activeAccountId).toBe("900000001");
      expect(result.staleScoreCharIds).toBe(true);
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

  describe("v3 → v4 (isScoresStale → staleScoreCharIds)", () => {
    it("converts false isScoresStale to empty array", () => {
      const persisted = {
        accounts: {},
        activeAccountId: null,
        isScoresStale: false,
      };

      const result = migrateAccountStore(persisted, 3);

      expect(result.staleScoreCharIds).toEqual([]);
    });

    it("converts true isScoresStale to true (all stale)", () => {
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

      expect(result.staleScoreCharIds).toBe(true);
      expect(result.accounts["800000000"]).toBeDefined();
    });
  });

  describe("v4+ → passthrough", () => {
    it("returns the state unchanged for current version", () => {
      const persisted = {
        accounts: {},
        activeAccountId: null,
        staleScoreCharIds: [],
      };

      const result = migrateAccountStore(persisted, 4);

      expect(result).toBe(persisted);
    });
  });
});
