import { characters } from "@/data/resources";
import { useOwnershipStore } from "@/stores/useOwnershipStore";

const allCharacterIds = new Set(characters.map((c) => c.id));

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
    if (!imported.has(id)) {
      unownedIds.push(id);
    }
  }
  useOwnershipStore
    .getState()
    .setProfileCharacterOwnership(profileId, unownedIds);
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
