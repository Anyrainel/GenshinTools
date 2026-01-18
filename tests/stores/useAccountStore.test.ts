import type { AccountData, CharacterData } from "@/data/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test
beforeEach(() => {
  useAccountStore.getState().clearAccountData();
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
    it("starts with null account data", () => {
      const state = useAccountStore.getState();
      expect(state.accountData).toBeNull();
    });

    it("starts with empty lastUid", () => {
      const state = useAccountStore.getState();
      expect(state.lastUid).toBe("");
    });
  });

  describe("setAccountData", () => {
    it("sets account data", () => {
      const data = createSampleAccountData({
        characters: [createSampleCharacter()],
      });

      useAccountStore.getState().setAccountData(data);

      const state = useAccountStore.getState();
      expect(state.accountData).toEqual(data);
      expect(state.accountData?.characters.length).toBe(1);
    });

    it("replaces existing account data", () => {
      // Set initial data
      useAccountStore.getState().setAccountData(
        createSampleAccountData({
          characters: [createSampleCharacter({ key: "venti" })],
        })
      );

      // Replace with new data
      const newData = createSampleAccountData({
        characters: [
          createSampleCharacter({ key: "kaedehara_kazuha" }),
          createSampleCharacter({ key: "xingqiu" }),
        ],
      });
      useAccountStore.getState().setAccountData(newData);

      const state = useAccountStore.getState();
      expect(state.accountData?.characters.length).toBe(2);
      expect(state.accountData?.characters[0].key).toBe("kaedehara_kazuha");
    });
  });

  describe("setLastUid", () => {
    it("sets the last used UID", () => {
      useAccountStore.getState().setLastUid("123456789");

      const state = useAccountStore.getState();
      expect(state.lastUid).toBe("123456789");
    });
  });

  describe("clearAccountData", () => {
    it("clears account data to null", () => {
      // Set up data first
      useAccountStore.getState().setAccountData(
        createSampleAccountData({
          characters: [createSampleCharacter()],
        })
      );

      // Clear
      useAccountStore.getState().clearAccountData();

      const state = useAccountStore.getState();
      expect(state.accountData).toBeNull();
    });

    it("preserves lastUid when clearing account data", () => {
      useAccountStore.getState().setLastUid("123456789");
      useAccountStore.getState().setAccountData(createSampleAccountData());

      useAccountStore.getState().clearAccountData();

      const state = useAccountStore.getState();
      expect(state.accountData).toBeNull();
      expect(state.lastUid).toBe("123456789");
    });
  });
});
