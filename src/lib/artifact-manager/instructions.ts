import type { ArtifactData } from "@/data/types";
import type {
  IGOODArtifact,
  IGOODSubstat,
} from "@/lib/account-data/goodConversion";
import {
  artifactIdToGOODKey,
  charIdToGOODKey,
  internalStatToGOODKey,
} from "./keys";
import type { ManagePayload } from "./types";

/**
 * Convert internal ArtifactData to GOOD v3 format for the manage API.
 * Includes all identity fields used for matching plus informational fields.
 */
export function toGOODArtifact(
  art: ArtifactData,
  locationCharId?: string
): IGOODArtifact {
  const setKey = artifactIdToGOODKey(art.setKey);
  if (!setKey) {
    throw new Error(`Unknown artifact set: ${art.setKey}`);
  }

  const substats: IGOODSubstat[] = Object.entries(art.substats).map(
    ([key, value]) => {
      const goodKey = internalStatToGOODKey(key);
      if (!goodKey) throw new Error(`Unknown stat key: ${key}`);
      const sub: IGOODSubstat = {
        key: goodKey,
        value: Math.round(value * 10) / 10,
      };
      if (art.initialValues?.[key as keyof typeof art.initialValues] != null) {
        sub.initialValue =
          art.initialValues[key as keyof typeof art.initialValues];
      }
      return sub;
    }
  );

  const mainStatKey = internalStatToGOODKey(art.mainStatKey);
  if (!mainStatKey) throw new Error(`Unknown main stat: ${art.mainStatKey}`);

  const location = locationCharId
    ? (charIdToGOODKey(locationCharId) ?? "")
    : "";

  const good: IGOODArtifact = {
    setKey,
    slotKey: art.slotKey,
    rarity: art.rarity,
    level: art.level,
    mainStatKey,
    substats,
    location,
    lock: art.lock,
  };

  if (art.totalRolls !== undefined) good.totalRolls = art.totalRolls;
  if (art.astralMark !== undefined) good.astralMark = art.astralMark;
  if (art.elixirCrafted !== undefined) good.elixirCrafted = art.elixirCrafted;

  if (art.unactivatedSubstats) {
    good.unactivatedSubstats = Object.entries(art.unactivatedSubstats).map(
      ([key, value]) => {
        const goodKey = internalStatToGOODKey(key);
        if (!goodKey) throw new Error(`Unknown stat key: ${key}`);
        return { key: goodKey, value };
      }
    );
  }

  return good;
}

export function buildTriageInstructions(
  toLock: ArtifactData[],
  toUnlock: ArtifactData[]
): ManagePayload {
  const lock: IGOODArtifact[] = [];
  const lockIds: string[] = [];
  const unlock: IGOODArtifact[] = [];
  const unlockIds: string[] = [];

  for (const art of toLock) {
    if (art.lock) continue;
    lock.push(toGOODArtifact(art));
    lockIds.push(art.id);
  }
  for (const art of toUnlock) {
    if (!art.lock) continue;
    unlock.push(toGOODArtifact(art));
    unlockIds.push(art.id);
  }

  return { request: { lock, unlock }, lockIds, unlockIds };
}
