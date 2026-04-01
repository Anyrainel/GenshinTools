import type { AccountData, ArtifactData } from "@/data/types";
import type {
  IGOODArtifact,
  IGOODSubstat,
} from "@/lib/account-data/goodConversion";
import type { Team } from "@/stores/useTeamStore";
import {
  artifactIdToGOODKey,
  charIdToGOODKey,
  internalStatToGOODKey,
} from "./keys";
import type { EquipPayload, ManagePayload } from "./types";

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

/**
 * Build equip instructions for a team's optimized artifacts.
 * Sends ALL optimized artifacts — the API returns `already_correct`
 * for ones that are already equipped on the target character.
 */
export function buildEquipInstructions(
  team: Team,
  optimizedArtifactsByChar: Record<string, Record<string, ArtifactData>>,
  accountData: AccountData | null
): EquipPayload {
  // Build owner map: artifact ID → character ID currently wearing it
  const ownerMap = new Map<string, string>();
  if (accountData) {
    for (const char of accountData.characters) {
      for (const art of Object.values(char.artifacts)) {
        if (art) ownerMap.set(art.id, char.key);
      }
    }
  }

  const equip: { artifact: IGOODArtifact; location: string }[] = [];
  const artifactIds: string[] = [];
  const swapMap = new Map<
    string,
    { fromChar: string | null; toChar: string }
  >();

  for (const charId of team.characters) {
    if (!charId) continue;
    const optimized = optimizedArtifactsByChar[charId];
    if (!optimized) continue;

    const targetGOODKey = charIdToGOODKey(charId);
    if (!targetGOODKey) continue;

    for (const art of Object.values(optimized)) {
      const currentOwner = ownerMap.get(art.id) ?? null;
      const good = toGOODArtifact(art, currentOwner ?? undefined);

      equip.push({ artifact: good, location: targetGOODKey });
      artifactIds.push(art.id);
      swapMap.set(art.id, { fromChar: currentOwner, toChar: charId });
    }
  }

  return { request: { equip }, artifactIds, swapMap };
}
