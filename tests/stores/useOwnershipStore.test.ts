import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useOwnershipStore.getState().clearAll();
});

describe("useOwnershipStore", () => {
  describe("initial state", () => {
    it("treats all characters as owned by default", () => {
      expect(useOwnershipStore.getState().isOwned("character", "hu_tao")).toBe(
        true
      );
    });

    it("treats all weapons as owned by default", () => {
      expect(
        useOwnershipStore.getState().isOwned("weapon", "staff_of_homa")
      ).toBe(true);
    });

    it("starts with empty unowned records", () => {
      const state = useOwnershipStore.getState();
      expect(state.unownedCharacters).toEqual({});
      expect(state.unownedWeapons).toEqual({});
    });
  });

  describe("setOwned", () => {
    it("marks a character as unowned", () => {
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);

      expect(useOwnershipStore.getState().isOwned("character", "hu_tao")).toBe(
        false
      );
    });

    it("marks a weapon as unowned", () => {
      useOwnershipStore.getState().setOwned("weapon", "staff_of_homa", false);

      expect(
        useOwnershipStore.getState().isOwned("weapon", "staff_of_homa")
      ).toBe(false);
    });

    it("marks an unowned character back to owned", () => {
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);
      useOwnershipStore.getState().setOwned("character", "hu_tao", true);

      expect(useOwnershipStore.getState().isOwned("character", "hu_tao")).toBe(
        true
      );
      // Should remove from unowned record, not just toggle
      expect(
        useOwnershipStore.getState().unownedCharacters.hu_tao
      ).toBeUndefined();
    });
  });

  describe("toggleOwned", () => {
    it("toggles character from owned to unowned", () => {
      useOwnershipStore.getState().toggleOwned("character", "hu_tao");

      expect(useOwnershipStore.getState().isOwned("character", "hu_tao")).toBe(
        false
      );
    });

    it("toggles character from unowned back to owned", () => {
      useOwnershipStore.getState().toggleOwned("character", "hu_tao");
      useOwnershipStore.getState().toggleOwned("character", "hu_tao");

      expect(useOwnershipStore.getState().isOwned("character", "hu_tao")).toBe(
        true
      );
    });

    it("toggles weapon ownership independently", () => {
      useOwnershipStore.getState().toggleOwned("weapon", "amos_bow");

      expect(useOwnershipStore.getState().isOwned("weapon", "amos_bow")).toBe(
        false
      );
      // Other weapons remain unaffected
      expect(
        useOwnershipStore.getState().isOwned("weapon", "staff_of_homa")
      ).toBe(true);
    });
  });

  describe("bulkSetOwned", () => {
    it("marks multiple characters as owned", () => {
      // First mark them unowned
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);
      useOwnershipStore.getState().setOwned("character", "xingqiu", false);

      useOwnershipStore
        .getState()
        .bulkSetOwned("character", ["hu_tao", "xingqiu"], true);

      expect(useOwnershipStore.getState().isOwned("character", "hu_tao")).toBe(
        true
      );
      expect(useOwnershipStore.getState().isOwned("character", "xingqiu")).toBe(
        true
      );
    });

    it("marks multiple weapons as unowned", () => {
      useOwnershipStore
        .getState()
        .bulkSetOwned("weapon", ["amos_bow", "staff_of_homa"], false);

      expect(useOwnershipStore.getState().isOwned("weapon", "amos_bow")).toBe(
        false
      );
      expect(
        useOwnershipStore.getState().isOwned("weapon", "staff_of_homa")
      ).toBe(false);
    });

    it("does not affect other items when bulk setting", () => {
      useOwnershipStore.getState().setOwned("character", "zhongli", false);
      useOwnershipStore.getState().bulkSetOwned("character", ["hu_tao"], false);

      // zhongli should still be unowned
      expect(useOwnershipStore.getState().isOwned("character", "zhongli")).toBe(
        false
      );
    });

    it("handles empty array gracefully", () => {
      useOwnershipStore.getState().bulkSetOwned("character", [], true);

      expect(useOwnershipStore.getState().unownedCharacters).toEqual({});
    });
  });

  describe("clearAll", () => {
    it("resets all ownership to default (all owned)", () => {
      useOwnershipStore.getState().setOwned("character", "hu_tao", false);
      useOwnershipStore.getState().setOwned("weapon", "amos_bow", false);

      useOwnershipStore.getState().clearAll();

      expect(useOwnershipStore.getState().isOwned("character", "hu_tao")).toBe(
        true
      );
      expect(useOwnershipStore.getState().isOwned("weapon", "amos_bow")).toBe(
        true
      );
      expect(useOwnershipStore.getState().unownedCharacters).toEqual({});
      expect(useOwnershipStore.getState().unownedWeapons).toEqual({});
    });
  });

  describe("type isolation", () => {
    it("character and weapon ownership are independent", () => {
      // Mark character "staff_of_homa" as unowned (same ID, different type)
      useOwnershipStore
        .getState()
        .setOwned("character", "staff_of_homa", false);

      // Weapon with same ID should still be owned
      expect(
        useOwnershipStore.getState().isOwned("weapon", "staff_of_homa")
      ).toBe(true);
      expect(
        useOwnershipStore.getState().isOwned("character", "staff_of_homa")
      ).toBe(false);
    });
  });
});
