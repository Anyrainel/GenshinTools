import type { CharacterStatsMap } from "@/data/gameStatsLoader";
import { getCharacterDisplayMeta } from "@/data/gameStatsLoader";
import type { CharacterResource } from "@/data/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Tests for the unreleased character ownership logic.
 *
 * Business rule: Characters with no releaseDate in stats are unreleased
 * and should always be treated as unowned/dimmed.
 * Ownership is now derived from AccountData — a character is owned if it
 * exists in the active account's character list.
 */

const TEST_PROFILE = "test_profile";

function setAccountCharacters(characterKeys: string[]) {
  useAccountStore.setState({
    activeAccountId: TEST_PROFILE,
    accounts: {
      [TEST_PROFILE]: {
        id: TEST_PROFILE,
        name: "Test",
        data: {
          characters: characterKeys.map((key) => ({
            key,
            constellation: 0,
            level: 90,
            talent: { auto: 1, skill: 1, burst: 1 },
            artifacts: {},
          })),
          extraArtifacts: [],
          extraWeapons: [],
        },
        scores: {},
        lastUpdate: Date.now(),
      },
    },
  });
}

beforeEach(() => {
  useAccountStore.setState({ activeAccountId: TEST_PROFILE, accounts: {} });
});

function createCharacter(
  overrides: Partial<CharacterResource> = {}
): CharacterResource {
  return {
    id: "test_char",
    rarity: 5,
    imagePath: "/character/test_char.png",
    ...overrides,
  };
}

/**
 * Mirrors the logic used in CharacterArchiveView:
 * - releaseDate comes from characterStats (getCharacterDisplayMeta)
 * - unreleased = no releaseDate (null/empty)
 * - owned = character exists in AccountData
 * - effectiveOwned = !unreleased && owned
 */
function computeOwnershipDisplay(
  character: CharacterResource,
  characterStatsMap?: CharacterStatsMap
) {
  const meta = getCharacterDisplayMeta(
    character,
    characterStatsMap?.[character.id]
  );
  const acc = useAccountStore.getState().accounts[TEST_PROFILE];
  const owned = acc
    ? acc.data.characters.some((c) => c.key === character.id)
    : false;
  const unreleased = !meta.releaseDate;
  const effectiveOwned = !unreleased && owned;
  const isDimmed = unreleased || !owned;
  return { owned, unreleased, effectiveOwned, isDimmed };
}

const statsReleased: CharacterStatsMap = {
  hu_tao: {
    rarity: 5,
    element: "Pyro",
    weaponType: "Polearm",
    region: "Liyue",
    releaseDate: "2021-03-03",
    levels: {},
  },
};
const statsUnreleased: CharacterStatsMap = {
  upcoming_char: {
    rarity: 5,
    element: "Pyro",
    weaponType: "Claymore",
    region: "Natlan",
    releaseDate: "",
    levels: {},
  },
};

describe("unreleased character ownership logic", () => {
  describe("released characters (releaseDate is set)", () => {
    const released = createCharacter({ id: "hu_tao" });

    it("treats released characters as owned when in account data", () => {
      setAccountCharacters(["hu_tao"]);
      const result = computeOwnershipDisplay(released, statsReleased);

      expect(result.unreleased).toBe(false);
      expect(result.effectiveOwned).toBe(true);
      expect(result.isDimmed).toBe(false);
    });

    it("treats released characters as unowned when not in account data", () => {
      setAccountCharacters([]);
      const result = computeOwnershipDisplay(released, statsReleased);

      expect(result.owned).toBe(false);
      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
    });
  });

  describe("unreleased characters (no releaseDate in stats)", () => {
    const unreleased = createCharacter({ id: "upcoming_char" });

    it("is always treated as not effectiveOwned regardless of account data", () => {
      setAccountCharacters(["upcoming_char"]);
      const result = computeOwnershipDisplay(unreleased, statsUnreleased);

      expect(result.unreleased).toBe(true);
      expect(result.owned).toBe(true);
      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
    });

    it("is dimmed when not in account data", () => {
      setAccountCharacters([]);
      const result = computeOwnershipDisplay(unreleased, statsUnreleased);

      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
    });
  });

  describe("mixed scenarios", () => {
    it("handles released and unreleased characters independently", () => {
      const mixedStats: CharacterStatsMap = {
        released_char: {
          rarity: 5,
          element: "Pyro",
          weaponType: "Sword",
          region: "Liyue",
          releaseDate: "2024-06-01",
          levels: {},
        },
        upcoming_char: {
          rarity: 5,
          element: "Pyro",
          weaponType: "Sword",
          region: "Natlan",
          releaseDate: "",
          levels: {},
        },
      };
      const released = createCharacter({ id: "released_char" });
      const upcoming = createCharacter({ id: "upcoming_char" });

      // Only upcoming_char is in account data, released_char is not
      setAccountCharacters(["upcoming_char"]);

      const releasedResult = computeOwnershipDisplay(released, mixedStats);
      const upcomingResult = computeOwnershipDisplay(upcoming, mixedStats);

      // Released but not in account: unowned, dimmed
      expect(releasedResult.effectiveOwned).toBe(false);
      expect(releasedResult.isDimmed).toBe(true);

      // Unreleased: always not effectiveOwned, dimmed
      expect(upcomingResult.effectiveOwned).toBe(false);
      expect(upcomingResult.isDimmed).toBe(true);
    });
  });
});
