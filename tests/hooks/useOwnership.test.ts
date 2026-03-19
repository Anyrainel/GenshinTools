import type { AccountData } from "@/data/types";
import { getIsOwned } from "@/hooks/useOwnership";
import { useAccountStore } from "@/stores/useAccountStore";
import { beforeEach, describe, expect, it } from "vitest";

const PROFILE = "uid_800000000";

function makeAccountData(overrides: Partial<AccountData> = {}): AccountData {
  return {
    characters: [],
    extraArtifacts: [],
    extraWeapons: [],
    ...overrides,
  };
}

function makeCharacter(
  key: string,
  opts: {
    constellation?: number;
    weaponKey?: string;
    weaponRefinement?: number;
  } = {}
) {
  return {
    key,
    constellation: opts.constellation ?? 0,
    level: 90,
    talent: { auto: 1, skill: 1, burst: 1 },
    weapon: opts.weaponKey
      ? {
          id: `${opts.weaponKey}_inst`,
          key: opts.weaponKey,
          level: 90,
          refinement: opts.weaponRefinement ?? 1,
          lock: false,
        }
      : undefined,
    artifacts: {},
  };
}

function setAccount(data: AccountData) {
  useAccountStore.setState({
    activeAccountId: PROFILE,
    accounts: {
      [PROFILE]: {
        id: PROFILE,
        name: "Test",
        data,
        scores: {},
        lastUpdate: Date.now(),
      },
    },
  });
}

beforeEach(() => {
  useAccountStore.setState({ activeAccountId: null, accounts: {} });
});

describe("getIsOwned", () => {
  describe("characters", () => {
    it("returns false when no account data exists", () => {
      expect(getIsOwned("character", "hu_tao")).toBe(false);
    });

    it("returns false for characters not in account data", () => {
      setAccount(
        makeAccountData({
          characters: [makeCharacter("hu_tao")],
        })
      );
      expect(getIsOwned("character", "ganyu")).toBe(false);
    });

    it("returns true for characters in account data", () => {
      setAccount(
        makeAccountData({
          characters: [makeCharacter("hu_tao"), makeCharacter("ganyu")],
        })
      );
      expect(getIsOwned("character", "hu_tao")).toBe(true);
      expect(getIsOwned("character", "ganyu")).toBe(true);
    });

    it("returns true for always-owned characters (Traveler) even without account data", () => {
      useAccountStore.setState({ activeAccountId: null, accounts: {} });
      // Traveler variants are always owned
      expect(getIsOwned("character", "traveler_anemo")).toBe(true);
      expect(getIsOwned("character", "traveler_geo")).toBe(true);
    });

    it("returns true for always-owned characters (Manekin/Manekina) even with empty account", () => {
      setAccount(makeAccountData());
      expect(getIsOwned("character", "manekin_pyro")).toBe(true);
      expect(getIsOwned("character", "manekina_cryo")).toBe(true);
    });

    it("returns true for always-owned characters regardless of account data", () => {
      setAccount(
        makeAccountData({
          characters: [makeCharacter("hu_tao")],
        })
      );
      // Traveler is not in the characters array but still always owned
      expect(getIsOwned("character", "traveler_dendro")).toBe(true);
    });
  });

  describe("weapons", () => {
    it("returns false when no account data exists", () => {
      expect(getIsOwned("weapon", "staff_of_homa")).toBe(false);
    });

    it("returns false for weapons not in account data", () => {
      setAccount(
        makeAccountData({
          characters: [makeCharacter("hu_tao", { weaponKey: "staff_of_homa" })],
        })
      );
      expect(getIsOwned("weapon", "primordial_jade_winged_spear")).toBe(false);
    });

    it("returns true for weapons equipped on characters", () => {
      setAccount(
        makeAccountData({
          characters: [makeCharacter("hu_tao", { weaponKey: "staff_of_homa" })],
        })
      );
      expect(getIsOwned("weapon", "staff_of_homa")).toBe(true);
    });

    it("returns true for weapons in extraWeapons", () => {
      setAccount(
        makeAccountData({
          extraWeapons: [
            {
              id: "w1",
              key: "skyward_harp",
              level: 90,
              refinement: 1,
              lock: false,
            },
          ],
        })
      );
      expect(getIsOwned("weapon", "skyward_harp")).toBe(true);
    });

    it("returns true when weapon appears in both equipped and extra", () => {
      setAccount(
        makeAccountData({
          characters: [makeCharacter("hu_tao", { weaponKey: "staff_of_homa" })],
          extraWeapons: [
            {
              id: "w2",
              key: "staff_of_homa",
              level: 90,
              refinement: 3,
              lock: false,
            },
          ],
        })
      );
      expect(getIsOwned("weapon", "staff_of_homa")).toBe(true);
    });

    it("returns false for characters without equipped weapons", () => {
      setAccount(
        makeAccountData({
          characters: [makeCharacter("hu_tao")], // no weapon
        })
      );
      expect(getIsOwned("weapon", "staff_of_homa")).toBe(false);
    });
  });

  describe("profile switching", () => {
    it("reflects the active profile's data", () => {
      const profileA = "uid_100";
      const profileB = "uid_200";

      useAccountStore.setState({
        activeAccountId: profileA,
        accounts: {
          [profileA]: {
            id: profileA,
            name: "A",
            data: makeAccountData({
              characters: [makeCharacter("hu_tao")],
            }),
            scores: {},
            lastUpdate: Date.now(),
          },
          [profileB]: {
            id: profileB,
            name: "B",
            data: makeAccountData({
              characters: [makeCharacter("ganyu")],
            }),
            scores: {},
            lastUpdate: Date.now(),
          },
        },
      });

      expect(getIsOwned("character", "hu_tao")).toBe(true);
      expect(getIsOwned("character", "ganyu")).toBe(false);

      // Switch active profile
      useAccountStore.setState({ activeAccountId: profileB });
      expect(getIsOwned("character", "hu_tao")).toBe(false);
      expect(getIsOwned("character", "ganyu")).toBe(true);
    });
  });
});
