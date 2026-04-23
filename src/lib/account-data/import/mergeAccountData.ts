import type { AccountData, CharacterData } from "@/data/types";
import { getMaxIds } from "../idUtils";
import type { PresentSections } from "./goodConversion";
import { mergeEnkaImportWithInventory } from "./mergeEnkaImport";

/** Result of any data operation that reassigns artifact IDs. */
export interface MergeResult {
  data: AccountData;
  /** Maps old artifact IDs → new artifact IDs. Empty when no reassignment occurred. */
  artifactIdMap: Map<string, string>;
}

/**
 * Reassign all artifact and weapon IDs to sequential values.
 * Returns a map of old artifact ID → new artifact ID for downstream consumers
 * (e.g. freeze store) to update their references.
 */
export const reassignIds = (
  data: AccountData,
  startArtifactId: number,
  startWeaponId: number
): Map<string, string> => {
  const artifactIdMap = new Map<string, string>();
  let aId = startArtifactId;
  let wId = startWeaponId;

  for (const char of data.characters) {
    for (const slot of Object.keys(char.artifacts) as Array<
      keyof typeof char.artifacts
    >) {
      const art = char.artifacts[slot];
      if (art) {
        const oldId = art.id;
        const newId = `artifact-${aId++}`;
        if (oldId !== newId) artifactIdMap.set(oldId, newId);
        art.id = newId;
      }
    }
    if (char.weapon) {
      char.weapon.id = `weapon-${wId++}`;
    }
  }
  for (const art of data.extraArtifacts) {
    const oldId = art.id;
    const newId = `artifact-${aId++}`;
    if (oldId !== newId) artifactIdMap.set(oldId, newId);
    art.id = newId;
  }
  for (const wp of data.extraWeapons) {
    wp.id = `weapon-${wId++}`;
  }

  return artifactIdMap;
};

/**
 * Merge a partial GOOD import with existing account data.
 *
 * Only sections that were present in the import overwrite existing data.
 * For example, importing artifacts-only keeps existing character stats and weapons.
 */
export function mergePartialAccountData(
  existing: AccountData,
  incoming: AccountData,
  sections: PresentSections
): MergeResult {
  if (sections.characters && sections.weapons && sections.artifacts) {
    return { data: incoming, artifactIdMap: new Map() };
  }

  const incomingCharMap = new Map(incoming.characters.map((c) => [c.key, c]));
  const merged: CharacterData[] = [];
  const seen = new Set<string>();

  for (const ec of existing.characters) {
    const ic = incomingCharMap.get(ec.key);
    merged.push({
      key: ec.key,
      level: sections.characters && ic ? ic.level : ec.level,
      constellation:
        sections.characters && ic ? ic.constellation : ec.constellation,
      talent: sections.characters && ic ? ic.talent : ec.talent,
      weapon: sections.weapons ? ic?.weapon : ec.weapon,
      artifacts: sections.artifacts && ic ? ic.artifacts : { ...ec.artifacts },
    });
    seen.add(ec.key);
  }

  // New characters only appear when the characters section is present
  if (sections.characters) {
    for (const ic of incoming.characters) {
      if (!seen.has(ic.key)) merged.push(ic);
    }
  }

  const result: AccountData = {
    characters: merged,
    extraArtifacts: sections.artifacts
      ? incoming.extraArtifacts
      : existing.extraArtifacts,
    extraWeapons: sections.weapons
      ? incoming.extraWeapons
      : existing.extraWeapons,
  };
  const artifactIdMap = reassignIds(result, 0, 0);
  return { data: result, artifactIdMap };
}

export function mergeAccountData(
  oldData: AccountData,
  newData: AccountData
): MergeResult {
  const { maxA, maxW } = getMaxIds(oldData);
  reassignIds(newData, maxA + 1, maxW + 1);

  const mergedCharacters = [...oldData.characters];
  for (const newChar of newData.characters) {
    const index = mergedCharacters.findIndex((c) => c.key === newChar.key);
    if (index >= 0) {
      mergedCharacters[index] = newChar;
    } else {
      mergedCharacters.push(newChar);
    }
  }

  const mergedExtraArtifacts = mergeEnkaImportWithInventory(oldData, newData);
  const mergedData: AccountData = {
    characters: mergedCharacters,
    extraArtifacts: mergedExtraArtifacts,
    extraWeapons: oldData.extraWeapons,
  };
  const artifactIdMap = reassignIds(mergedData, 0, 0);
  return { data: mergedData, artifactIdMap };
}
