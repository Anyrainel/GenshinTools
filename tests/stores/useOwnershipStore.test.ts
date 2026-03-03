import {
  migrateOwnershipStore,
  useOwnershipStore,
} from "@/stores/useOwnershipStore";
import { beforeEach, describe, expect, it } from "vitest";

const PROFILE = "800000001";

beforeEach(() => {
  useOwnershipStore.getState().clearAll();
});

describe("useOwnershipStore (profile-based)", () => {
  describe("initial state", () => {
    it("treats all characters as owned by default when no profile exists", () => {
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(true);
    });

    it("treats all weapons as owned by default when no profile exists", () => {
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "staff_of_homa")
      ).toBe(true);
    });

    it("starts with empty profiles", () => {
      expect(useOwnershipStore.getState().profiles).toEqual({});
    });
  });

  describe("setOwned", () => {
    it("marks a character as unowned", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", false);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(false);
    });

    it("marks a weapon as unowned", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "weapon", "staff_of_homa", false);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "staff_of_homa")
      ).toBe(false);
    });

    it("marks an unowned character back to owned", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", false);
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", true);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(true);
      expect(
        useOwnershipStore.getState().profiles[PROFILE]?.unownedCharacters.hu_tao
      ).toBeUndefined();
    });

    it("auto-creates profile on first write", () => {
      useOwnershipStore
        .getState()
        .setOwned("new_profile", "character", "hu_tao", false);

      expect(useOwnershipStore.getState().profiles.new_profile).toBeDefined();
    });
  });

  describe("toggleOwned", () => {
    it("toggles character from owned to unowned", () => {
      useOwnershipStore.getState().toggleOwned(PROFILE, "character", "hu_tao");

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(false);
    });

    it("toggles character from unowned back to owned", () => {
      useOwnershipStore.getState().toggleOwned(PROFILE, "character", "hu_tao");
      useOwnershipStore.getState().toggleOwned(PROFILE, "character", "hu_tao");

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(true);
    });

    it("toggles weapon ownership independently", () => {
      useOwnershipStore.getState().toggleOwned(PROFILE, "weapon", "amos_bow");

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "amos_bow")
      ).toBe(false);
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "staff_of_homa")
      ).toBe(true);
    });
  });

  describe("bulkSetOwned", () => {
    it("marks multiple characters as owned", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", false);
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "xingqiu", false);

      useOwnershipStore
        .getState()
        .bulkSetOwned(PROFILE, "character", ["hu_tao", "xingqiu"], true);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(true);
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "xingqiu")
      ).toBe(true);
    });

    it("marks multiple weapons as unowned", () => {
      useOwnershipStore
        .getState()
        .bulkSetOwned(PROFILE, "weapon", ["amos_bow", "staff_of_homa"], false);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "amos_bow")
      ).toBe(false);
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "staff_of_homa")
      ).toBe(false);
    });

    it("does not affect other items when bulk setting", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "zhongli", false);
      useOwnershipStore
        .getState()
        .bulkSetOwned(PROFILE, "character", ["hu_tao"], false);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "zhongli")
      ).toBe(false);
    });

    it("handles empty array gracefully", () => {
      useOwnershipStore.getState().bulkSetOwned(PROFILE, "character", [], true);

      // Profile may or may not be created, but no crash
      const profile = useOwnershipStore.getState().profiles[PROFILE];
      if (profile) {
        expect(profile.unownedCharacters).toEqual({});
      }
    });
  });

  describe("setProfileCharacterOwnership", () => {
    it("atomically replaces the unowned character set", () => {
      // Start with some ownership data
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", false);

      // Replace with new unowned set
      useOwnershipStore
        .getState()
        .setProfileCharacterOwnership(PROFILE, ["xingqiu", "zhongli"]);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(true); // was unowned, now owned again
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "xingqiu")
      ).toBe(false);
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "zhongli")
      ).toBe(false);
    });

    it("does not affect weapon ownership", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "weapon", "amos_bow", false);

      useOwnershipStore
        .getState()
        .setProfileCharacterOwnership(PROFILE, ["hu_tao"]);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "amos_bow")
      ).toBe(false);
    });
  });

  describe("promoteProfile", () => {
    it("renames profile key preserving data", () => {
      useOwnershipStore
        .getState()
        .setOwned("default", "character", "hu_tao", false);

      useOwnershipStore.getState().promoteProfile("default", PROFILE);

      expect(useOwnershipStore.getState().profiles.default).toBeUndefined();
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(false);
    });

    it("is a no-op if oldId does not exist", () => {
      useOwnershipStore.getState().promoteProfile("nonexistent", PROFILE);
      expect(useOwnershipStore.getState().profiles[PROFILE]).toBeUndefined();
    });

    it("is a no-op if oldId === newId", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", false);

      useOwnershipStore.getState().promoteProfile(PROFILE, PROFILE);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(false);
    });
  });

  describe("deleteProfile", () => {
    it("removes profile data", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", false);

      useOwnershipStore.getState().deleteProfile(PROFILE);

      expect(useOwnershipStore.getState().profiles[PROFILE]).toBeUndefined();
      // After deletion, isOwned returns true (default)
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(true);
    });
  });

  describe("clearAll", () => {
    it("resets all profiles", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "hu_tao", false);
      useOwnershipStore
        .getState()
        .setOwned("other", "weapon", "amos_bow", false);

      useOwnershipStore.getState().clearAll();

      expect(useOwnershipStore.getState().profiles).toEqual({});
      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
      ).toBe(true);
    });
  });

  describe("profile isolation", () => {
    it("different profiles have independent ownership", () => {
      useOwnershipStore
        .getState()
        .setOwned("profile_a", "character", "hu_tao", false);

      expect(
        useOwnershipStore.getState().isOwned("profile_a", "character", "hu_tao")
      ).toBe(false);
      expect(
        useOwnershipStore.getState().isOwned("profile_b", "character", "hu_tao")
      ).toBe(true);
    });
  });

  describe("type isolation", () => {
    it("character and weapon ownership are independent", () => {
      useOwnershipStore
        .getState()
        .setOwned(PROFILE, "character", "staff_of_homa", false);

      expect(
        useOwnershipStore.getState().isOwned(PROFILE, "weapon", "staff_of_homa")
      ).toBe(true);
      expect(
        useOwnershipStore
          .getState()
          .isOwned(PROFILE, "character", "staff_of_homa")
      ).toBe(false);
    });
  });
});

describe("migrateOwnershipStore", () => {
  it("migrates v0 flat shape to profile-based under active account ID", () => {
    // Mock localStorage for account store
    const mockAccountData = {
      state: { activeAccountId: "900000001" },
    };
    localStorage.setItem(
      "genshin-account-storage",
      JSON.stringify(mockAccountData)
    );

    const oldState = {
      unownedCharacters: { hu_tao: true, xingqiu: true },
      unownedWeapons: { amos_bow: true },
    };

    const migrated = migrateOwnershipStore(oldState, 0);

    expect(migrated.profiles["900000001"]).toEqual({
      unownedCharacters: { hu_tao: true, xingqiu: true },
      unownedWeapons: { amos_bow: true },
    });

    localStorage.removeItem("genshin-account-storage");
  });

  it("falls back to 'default' profile ID when no account store data", () => {
    localStorage.removeItem("genshin-account-storage");

    const oldState = {
      unownedCharacters: { hu_tao: true },
      unownedWeapons: {},
    };

    const migrated = migrateOwnershipStore(oldState, 0);

    expect(migrated.profiles.default).toEqual({
      unownedCharacters: { hu_tao: true },
      unownedWeapons: {},
    });
  });

  it("passes through v1 state unchanged", () => {
    const v1State = {
      profiles: {
        "800000001": {
          unownedCharacters: { hu_tao: true },
          unownedWeapons: {},
        },
      },
    };

    const result = migrateOwnershipStore(v1State, 1);
    expect(result).toBe(v1State);
  });
});
