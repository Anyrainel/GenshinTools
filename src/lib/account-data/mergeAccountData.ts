import type {
  AccountData,
  ArtifactData,
  CharacterData,
  WeaponData,
} from "@/data/types";
import type { PresentSections } from "./goodConversion";
import { mergeEnkaImportWithInventory } from "./mergeEnkaImport";

const getMaxIds = (data: AccountData) => {
  let maxA = -1;
  let maxW = -1;
  const parse = (id: string, prefix: string) => {
    const num = Number.parseInt(id.replace(prefix, ""), 10);
    return Number.isNaN(num) ? -1 : num;
  };

  const checkA = (art: ArtifactData) => {
    const val = parse(art.id, "artifact-");
    if (val > maxA) maxA = val;
  };
  const checkW = (wp: WeaponData) => {
    const val = parse(wp.id, "weapon-");
    if (val > maxW) maxW = val;
  };

  for (const c of data.characters) {
    for (const a of Object.values(c.artifacts)) {
      if (a) checkA(a);
    }
    if (c.weapon) checkW(c.weapon);
  }
  for (const art of data.extraArtifacts) {
    checkA(art);
  }
  for (const wp of data.extraWeapons) {
    checkW(wp);
  }

  return { maxA, maxW };
};

const reassignIds = (
  data: AccountData,
  startArtifactId: number,
  startWeaponId: number
) => {
  let aId = startArtifactId;
  let wId = startWeaponId;

  for (const char of data.characters) {
    for (const slot of Object.keys(char.artifacts) as Array<
      keyof typeof char.artifacts
    >) {
      const art = char.artifacts[slot];
      if (art) art.id = `artifact-${aId++}`;
    }
    if (char.weapon) {
      char.weapon.id = `weapon-${wId++}`;
    }
  }
  for (const art of data.extraArtifacts) {
    art.id = `artifact-${aId++}`;
  }
  for (const wp of data.extraWeapons) {
    wp.id = `weapon-${wId++}`;
  }
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
): AccountData {
  if (sections.characters && sections.weapons && sections.artifacts) {
    return incoming;
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
  reassignIds(result, 0, 0);
  return result;
}

export function mergeAccountData(
  oldData: AccountData,
  newData: AccountData
): AccountData {
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
  reassignIds(mergedData, 0, 0);
  return mergedData;
}
