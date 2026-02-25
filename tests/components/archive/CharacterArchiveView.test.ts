import type { CharacterResource } from "@/data/types";
import type { CharacterStatsMap } from "@/lib/gameStatsLoader";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Tests for the unreleased character ownership logic.
 *
 * Business rule: Characters with no releaseDate in stats are unreleased
 * and should always be treated as unowned, with the ownership toggle disabled.
 * This logic is applied in CharacterListItem, CharacterDetailPanel, and
 * the mobile character grid in CharacterArchiveView (using getCharacterDisplayMeta).
 */

beforeEach(() => {
  useOwnershipStore.getState().clearAll();
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
  const owned = useOwnershipStore.getState().isOwned("character", character.id);
  const unreleased = !meta.releaseDate;
  const effectiveOwned = !unreleased && owned;
  const isDimmed = unreleased || !owned;
  const canToggle = !unreleased;
  return { owned, unreleased, effectiveOwned, isDimmed, canToggle };
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

    it("treats released characters as owned by default", () => {
      const result = computeOwnershipDisplay(released, statsReleased);

      expect(result.unreleased).toBe(false);
      expect(result.effectiveOwned).toBe(true);
      expect(result.isDimmed).toBe(false);
      expect(result.canToggle).toBe(true);
    });

    it("allows toggling ownership for released characters", () => {
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);
      const result = computeOwnershipDisplay(released, statsReleased);

      expect(result.owned).toBe(false);
      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
      expect(result.canToggle).toBe(true);
    });

    it("restores ownership when toggled back", () => {
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);
      useOwnershipStore.getState().setOwned("character", "hu_tao", true);
      const result = computeOwnershipDisplay(released, statsReleased);

      expect(result.effectiveOwned).toBe(true);
      expect(result.isDimmed).toBe(false);
    });
  });

  describe("unreleased characters (no releaseDate in stats)", () => {
    const unreleased = createCharacter({ id: "upcoming_char" });

    it("is always treated as unowned regardless of store state", () => {
      const result = computeOwnershipDisplay(unreleased, statsUnreleased);

      expect(result.unreleased).toBe(true);
      expect(result.owned).toBe(true);
      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
      expect(result.canToggle).toBe(false);
    });

    it("stays unowned even if explicitly set owned in store", () => {
      useOwnershipStore.getState().setOwned("character", "upcoming_char", true);
      const result = computeOwnershipDisplay(unreleased, statsUnreleased);

      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
    });

    it("disables the toggle action", () => {
      const result = computeOwnershipDisplay(unreleased, statsUnreleased);
      expect(result.canToggle).toBe(false);
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

      useOwnershipStore
        .getState()
        .setOwned("character", "released_char", false);

      const releasedResult = computeOwnershipDisplay(released, mixedStats);
      const upcomingResult = computeOwnershipDisplay(upcoming, mixedStats);

      // Released: unowned, dimmed, toggleable
      expect(releasedResult.effectiveOwned).toBe(false);
      expect(releasedResult.isDimmed).toBe(true);
      expect(releasedResult.canToggle).toBe(true);

      // Unreleased: always unowned, dimmed, not toggleable
      expect(upcomingResult.effectiveOwned).toBe(false);
      expect(upcomingResult.isDimmed).toBe(true);
      expect(upcomingResult.canToggle).toBe(false);
    });
  });
});
