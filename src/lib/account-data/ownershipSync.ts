import { characters, weapons } from "@/data/resources";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { ALWAYS_OWNED_CHARACTER_IDS } from "./alwaysOwned";

const allCharacterIds = new Set(characters.map((c) => c.id));
const allWeaponIds = new Set(weapons.map((w) => w.id));

/**
 * GOOD import (exhaustive): the file contains the user's full roster.
 * Characters NOT in the import are marked unowned.
 */
export function syncOwnershipExhaustive(
  profileId: string,
  importedCharacterKeys: string[]
) {
  const imported = new Set(importedCharacterKeys);
  const unownedIds: string[] = [];
  for (const id of allCharacterIds) {
    if (!imported.has(id) && !ALWAYS_OWNED_CHARACTER_IDS.has(id)) {
      unownedIds.push(id);
    }
  }
  useOwnershipStore
    .getState()
    .setProfileCharacterOwnership(profileId, unownedIds);
}

/**
 * GOOD import (exhaustive) for weapons: weapons NOT in the import are marked unowned.
 * Only applies when the GOOD data contains a non-empty weapons array.
 */
export function syncWeaponOwnershipExhaustive(
  profileId: string,
  importedWeaponKeys: string[]
) {
  const imported = new Set(importedWeaponKeys);
  const unownedIds: string[] = [];
  for (const id of allWeaponIds) {
    if (!imported.has(id)) {
      unownedIds.push(id);
    }
  }
  useOwnershipStore.getState().setProfileWeaponOwnership(profileId, unownedIds);
}

/**
 * Mona import (additive): only marks imported characters as owned.
 * Does not touch characters absent from the import.
 */
export function syncOwnershipAdditive(
  profileId: string,
  importedCharacterKeys: string[]
) {
  useOwnershipStore
    .getState()
    .bulkSetOwned(profileId, "character", importedCharacterKeys, true);
}
