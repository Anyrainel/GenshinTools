import type { Slot } from "@/data/enums";
import type { AccountData, ArtifactData, CharacterData } from "@/data/types";
import { getMaxIds } from "../idUtils";
import type { PresentSections } from "./goodConversion";
import {
  artifactFingerprint,
  mergeEnkaImportWithInventory,
} from "./mergeEnkaImport";

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

interface LocatedArtifact {
  artifact: ArtifactData;
  characterKey?: string;
}

interface ExistingArtifactLocation extends LocatedArtifact {
  kind: "character" | "extra";
}

function collectLocatedArtifacts(data: AccountData): LocatedArtifact[] {
  const located: LocatedArtifact[] = [];
  for (const character of data.characters) {
    for (const artifact of Object.values(character.artifacts)) {
      if (artifact) {
        located.push({ artifact, characterKey: character.key });
      }
    }
  }
  for (const artifact of data.extraArtifacts) {
    located.push({ artifact });
  }
  return located;
}

/**
 * Add or update a subset of scanned artifacts without treating missing
 * artifacts as deleted. Used by GOODScanner's recent-artifact scan mode.
 */
export function mergeRecentArtifactsIntoAccount(
  existing: AccountData,
  incoming: AccountData
): MergeResult {
  const characters = existing.characters.map((character) => ({
    ...character,
    artifacts: { ...character.artifacts } as Partial<
      Record<Slot, ArtifactData>
    >,
  }));
  const extraArtifacts = [...existing.extraArtifacts];
  const charByKey = new Map(
    characters.map((character) => [character.key, character])
  );
  let nextArtifactId = getMaxIds(existing).maxA + 1;

  const findExistingByFingerprint = (
    fingerprint: string
  ): ExistingArtifactLocation | null => {
    for (const character of characters) {
      for (const artifact of Object.values(character.artifacts)) {
        if (artifact && artifactFingerprint(artifact) === fingerprint) {
          return { kind: "character", characterKey: character.key, artifact };
        }
      }
    }
    for (const artifact of extraArtifacts) {
      if (artifactFingerprint(artifact) === fingerprint) {
        return { kind: "extra", artifact };
      }
    }
    return null;
  };

  const removeById = (artifactId: string): void => {
    for (const character of characters) {
      for (const [slot, artifact] of Object.entries(character.artifacts)) {
        if (artifact?.id === artifactId) {
          delete character.artifacts[slot as Slot];
          return;
        }
      }
    }
    const index = extraArtifacts.findIndex(
      (artifact) => artifact.id === artifactId
    );
    if (index >= 0) extraArtifacts.splice(index, 1);
  };

  const placeArtifact = (
    artifact: ArtifactData,
    characterKey?: string
  ): void => {
    const character = characterKey ? charByKey.get(characterKey) : undefined;
    if (!character) {
      extraArtifacts.push(artifact);
      return;
    }

    const displaced = character.artifacts[artifact.slotKey];
    if (displaced && displaced.id !== artifact.id) {
      extraArtifacts.push(displaced);
    }
    character.artifacts[artifact.slotKey] = artifact;
  };

  const seenIncoming = new Set<string>();
  for (const incomingArtifact of collectLocatedArtifacts(incoming)) {
    const fingerprint = artifactFingerprint(incomingArtifact.artifact);
    if (seenIncoming.has(fingerprint)) continue;
    seenIncoming.add(fingerprint);

    const existingLocation = findExistingByFingerprint(fingerprint);
    const artifact = {
      ...incomingArtifact.artifact,
      id: existingLocation?.artifact.id ?? `artifact-${nextArtifactId++}`,
    };

    if (existingLocation) {
      removeById(existingLocation.artifact.id);
    }

    const targetCharacterKey = incomingArtifact.characterKey
      ? charByKey.has(incomingArtifact.characterKey)
        ? incomingArtifact.characterKey
        : undefined
      : existingLocation?.characterKey;

    placeArtifact(artifact, targetCharacterKey);
  }

  return {
    data: {
      ...existing,
      characters,
      extraArtifacts,
    },
    artifactIdMap: new Map(),
  };
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
