import type { Character } from "@/data/types";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Tests for the unreleased character ownership logic.
 *
 * Business rule: Characters with `releaseDate === null` are unreleased
 * and should always be treated as unowned, with the ownership toggle disabled.
 * This logic is applied in CharacterListItem, CharacterDetailPanel, and
 * the mobile character grid in CharacterArchiveView.
 */

beforeEach(() => {
  useOwnershipStore.getState().clearAll();
});

// Factory matching the Character type shape
function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "test_char",
    rarity: 5,
    element: "Pyro",
    weaponType: "Polearm",
    region: "Liyue",
    releaseDate: "2024-01-01",
    imageUrl: "https://example.com/char.png",
    imagePath: "/character/test_char.png",
    ...overrides,
  };
}

/**
 * Mirrors the logic used in CharacterArchiveView:
 * - `unreleased = character.releaseDate === null`
 * - `effectiveOwned = !unreleased && owned`
 * - dimming: `(unreleased || !owned) && "opacity-40"`
 */
function computeOwnershipDisplay(character: Character) {
  const owned = useOwnershipStore.getState().isOwned("character", character.id);
  const unreleased = character.releaseDate === null;
  const effectiveOwned = !unreleased && owned;
  const isDimmed = unreleased || !owned;
  const canToggle = !unreleased;
  return { owned, unreleased, effectiveOwned, isDimmed, canToggle };
}

describe("unreleased character ownership logic", () => {
  describe("released characters (releaseDate is set)", () => {
    const released = createCharacter({
      id: "hu_tao",
      releaseDate: "2021-03-03",
    });

    it("treats released characters as owned by default", () => {
      const result = computeOwnershipDisplay(released);

      expect(result.unreleased).toBe(false);
      expect(result.effectiveOwned).toBe(true);
      expect(result.isDimmed).toBe(false);
      expect(result.canToggle).toBe(true);
    });

    it("allows toggling ownership for released characters", () => {
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);
      const result = computeOwnershipDisplay(released);

      expect(result.owned).toBe(false);
      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
      expect(result.canToggle).toBe(true);
    });

    it("restores ownership when toggled back", () => {
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);
      useOwnershipStore.getState().setOwned("character", "hu_tao", true);
      const result = computeOwnershipDisplay(released);

      expect(result.effectiveOwned).toBe(true);
      expect(result.isDimmed).toBe(false);
    });
  });

  describe("unreleased characters (releaseDate is null)", () => {
    const unreleased = createCharacter({
      id: "upcoming_char",
      releaseDate: null,
    });

    it("is always treated as unowned regardless of store state", () => {
      // Store defaults to owned, but unreleased overrides
      const result = computeOwnershipDisplay(unreleased);

      expect(result.unreleased).toBe(true);
      expect(result.owned).toBe(true); // Store says owned
      expect(result.effectiveOwned).toBe(false); // But effective is false
      expect(result.isDimmed).toBe(true);
      expect(result.canToggle).toBe(false);
    });

    it("stays unowned even if explicitly set owned in store", () => {
      useOwnershipStore.getState().setOwned("character", "upcoming_char", true);
      const result = computeOwnershipDisplay(unreleased);

      expect(result.effectiveOwned).toBe(false);
      expect(result.isDimmed).toBe(true);
    });

    it("disables the toggle action", () => {
      const result = computeOwnershipDisplay(unreleased);
      expect(result.canToggle).toBe(false);
    });
  });

  describe("mixed scenarios", () => {
    it("handles released and unreleased characters independently", () => {
      const released = createCharacter({
        id: "released_char",
        releaseDate: "2024-06-01",
      });
      const upcoming = createCharacter({
        id: "upcoming_char",
        releaseDate: null,
      });

      // Mark released as unowned
      useOwnershipStore
        .getState()
        .setOwned("character", "released_char", false);

      const releasedResult = computeOwnershipDisplay(released);
      const upcomingResult = computeOwnershipDisplay(upcoming);

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
