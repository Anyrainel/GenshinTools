import { weapons } from "@/data/resources";
import {
  syncOwnershipExhaustive,
  syncWeaponOwnershipExhaustive,
} from "@/lib/account-data/ownershipSync";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { beforeEach, describe, expect, it } from "vitest";

const PROFILE = "800000001";

beforeEach(() => {
  useOwnershipStore.getState().clearAll();
});

describe("syncOwnershipExhaustive", () => {
  it("marks characters not in the import as unowned", () => {
    syncOwnershipExhaustive(PROFILE, ["hu_tao", "xingqiu"]);

    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
    ).toBe(true);
    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "character", "xingqiu")
    ).toBe(true);
    // A character not in the import should be unowned
    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "character", "zhongli")
    ).toBe(false);
  });
});

describe("syncWeaponOwnershipExhaustive", () => {
  it("marks weapons not in the import as unowned", () => {
    const importedWeapons = ["staff_of_homa", "amos_bow"];
    syncWeaponOwnershipExhaustive(PROFILE, importedWeapons);

    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "weapon", "staff_of_homa")
    ).toBe(true);
    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "weapon", "amos_bow")
    ).toBe(true);

    // Pick a weapon that wasn't imported — should be unowned
    const otherWeapon = weapons.find((w) => !importedWeapons.includes(w.id))!;
    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "weapon", otherWeapon.id)
    ).toBe(false);
  });

  it("does not affect character ownership", () => {
    useOwnershipStore
      .getState()
      .setOwned(PROFILE, "character", "hu_tao", false);

    syncWeaponOwnershipExhaustive(PROFILE, ["staff_of_homa"]);

    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "character", "hu_tao")
    ).toBe(false);
  });

  it("handles empty import (all weapons unowned)", () => {
    syncWeaponOwnershipExhaustive(PROFILE, []);

    // Every weapon should be unowned
    expect(
      useOwnershipStore.getState().isOwned(PROFILE, "weapon", "staff_of_homa")
    ).toBe(false);
  });
});
