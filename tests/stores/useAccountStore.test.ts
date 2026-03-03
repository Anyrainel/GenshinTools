import type { AccountData, CharacterData } from "@/data/types";
import { useAccountStore } from "@/stores/useAccountStore";
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

      useAccountStore
        .getState()
        .addOrUpdateAccount("default", { uid: "", data });

      const state = useAccountStore.getState();
      expect(state.accounts.default.data).toEqual(data);
      expect(state.accounts.default.data.characters.length).toBe(1);
      expect(state.activeAccountId).toBe("default");
    });

    it("replaces existing account data", () => {
      // Set initial data
      useAccountStore.getState().addOrUpdateAccount("default", {
        uid: "",
        data: createSampleAccountData({
          characters: [createSampleCharacter({ key: "venti" })],
        }),
      });

      // Replace with new data
      const newData = createSampleAccountData({
        characters: [
          createSampleCharacter({ key: "kaedehara_kazuha" }),
          createSampleCharacter({ key: "xingqiu" }),
        ],
      });
      useAccountStore
        .getState()
        .addOrUpdateAccount("default", { uid: "", data: newData });

      const state = useAccountStore.getState();
      expect(state.accounts.default.data.characters.length).toBe(2);
      expect(state.accounts.default.data.characters[0].key).toBe(
        "kaedehara_kazuha"
      );
    });
  });

  describe("setActiveAccount", () => {
    it("sets the active account ID", () => {
      useAccountStore.getState().addOrUpdateAccount("acc-1", {
        uid: "123",
        data: createSampleAccountData(),
      });
      useAccountStore.getState().setActiveAccount("acc-1");

      const state = useAccountStore.getState();
      expect(state.activeAccountId).toBe("acc-1");
    });
  });

  describe("clearAccounts", () => {
    it("clears accounts dictionary", () => {
      useAccountStore.getState().addOrUpdateAccount("default", {
        uid: "",
        data: createSampleAccountData({
          characters: [createSampleCharacter()],
        }),
      });

      // Clear
      useAccountStore.getState().clearAccounts();

      const state = useAccountStore.getState();
      expect(state.accounts).toEqual({});
      expect(state.activeAccountId).toBeNull();
    });
  });
});
