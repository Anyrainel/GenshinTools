import type {
  AccountData,
  ArtifactData,
  CharacterData,
  Slot,
} from "@/data/types";
import { nextArtifactId, nextWeaponId } from "./idUtils";

function cloneData(data: AccountData): AccountData {
  return JSON.parse(JSON.stringify(data));
}

function findCharByKey(
  data: AccountData,
  key: string
): CharacterData | undefined {
  return data.characters.find((c) => c.key === key);
}

// ─── Character stats ──────────────────────────────────────────────────────────

export function updateCharacterStats(
  data: AccountData,
  charKey: string,
  updates: {
    constellation?: number;
    level?: number;
    talent?: { auto: number; skill: number; burst: number };
  }
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  if (updates.constellation !== undefined)
    char.constellation = updates.constellation;
  if (updates.level !== undefined) char.level = updates.level;
  if (updates.talent !== undefined) char.talent = updates.talent;

  return result;
}

// ─── Weapon operations ────────────────────────────────────────────────────────

export function updateWeaponStats(
  data: AccountData,
  charKey: string,
  updates: { level?: number; refinement?: number }
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char?.weapon) return result;

  if (updates.level !== undefined) char.weapon.level = updates.level;
  if (updates.refinement !== undefined)
    char.weapon.refinement = updates.refinement;

  return result;
}

/** Unequip weapon from character → moves to inventory */
export function unequipWeapon(data: AccountData, charKey: string): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char?.weapon) return result;

  result.extraWeapons.push(char.weapon);
  char.weapon = undefined;
  return result;
}

/**
 * Change the weapon type (key) for a character.
 * Picks from inventory if available, or takes from another character (swap).
 * If neither, creates a new weapon with default stats.
 */
export function changeWeapon(
  data: AccountData,
  charKey: string,
  newWeaponKey: string
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  // Check inventory first
  const invIdx = result.extraWeapons.findIndex((w) => w.key === newWeaponKey);
  if (invIdx >= 0) {
    const weapon = result.extraWeapons.splice(invIdx, 1)[0];
    if (char.weapon) result.extraWeapons.push(char.weapon);
    char.weapon = weapon;
    return result;
  }

  // Check other characters
  const otherChar = result.characters.find(
    (c) => c.key !== charKey && c.weapon?.key === newWeaponKey
  );
  if (otherChar) {
    const temp = char.weapon;
    char.weapon = otherChar.weapon;
    otherChar.weapon = temp;
    return result;
  }

  // Create new weapon
  if (char.weapon) result.extraWeapons.push(char.weapon);
  char.weapon = {
    id: nextWeaponId(result),
    key: newWeaponKey,
    level: 90,
    refinement: 1,
    lock: false,
  };
  return result;
}

// ─── Artifact operations ──────────────────────────────────────────────────────

/** Unequip artifact from slot → moves to inventory */
export function unequipArtifact(
  data: AccountData,
  charKey: string,
  slot: Slot
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  const art = char.artifacts[slot];
  if (!art) return result;

  result.extraArtifacts.push(art);
  delete char.artifacts[slot];
  return result;
}

/** Delete artifact from slot (permanently remove) */
export function deleteArtifact(
  data: AccountData,
  charKey: string,
  slot: Slot
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  delete char.artifacts[slot];
  return result;
}

/** Equip an artifact from inventory onto a character's slot */
export function equipArtifactFromInventory(
  data: AccountData,
  charKey: string,
  slot: Slot,
  artifactId: string
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  const invIdx = result.extraArtifacts.findIndex((a) => a.id === artifactId);
  if (invIdx === -1) return result;

  const art = result.extraArtifacts.splice(invIdx, 1)[0];

  // Stash old artifact
  const oldArt = char.artifacts[slot];
  if (oldArt) {
    result.extraArtifacts.push(oldArt);
  }

  char.artifacts[slot] = art;
  return result;
}

/** Swap a specific artifact with one from another character */
export function swapArtifactWithCharacter(
  data: AccountData,
  charKey: string,
  slot: Slot,
  otherCharKey: string,
  otherSlot: Slot
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  const other = findCharByKey(result, otherCharKey);
  if (!char || !other) return result;

  const temp = char.artifacts[slot];
  char.artifacts[slot] = other.artifacts[otherSlot];
  if (temp) {
    other.artifacts[otherSlot] = temp;
  } else {
    delete other.artifacts[otherSlot];
  }
  return result;
}

/** Update artifact stats in-place (level, mainStat, substats, etc.) */
export function updateArtifactStats(
  data: AccountData,
  charKey: string,
  slot: Slot,
  updates: Partial<
    Pick<
      ArtifactData,
      | "level"
      | "rarity"
      | "mainStatKey"
      | "substats"
      | "lock"
      | "unactivatedSubstats"
    >
  >
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  const art = char.artifacts[slot];
  if (!art) return result;

  if (updates.level !== undefined) art.level = updates.level;
  if (updates.rarity !== undefined) art.rarity = updates.rarity;
  if (updates.mainStatKey !== undefined) art.mainStatKey = updates.mainStatKey;
  if (updates.substats !== undefined) art.substats = updates.substats;
  if (updates.lock !== undefined) art.lock = updates.lock;
  if (updates.unactivatedSubstats !== undefined)
    art.unactivatedSubstats = updates.unactivatedSubstats;

  return result;
}

/** Move entries from unactivatedSubstats into substats and delete the field */
export function activateUnactivatedSubstat(
  data: AccountData,
  charKey: string,
  slot: Slot
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  const art = char.artifacts[slot];
  if (!art?.unactivatedSubstats) return result;

  const unactivated = art.unactivatedSubstats;
  if (Object.keys(unactivated).length === 0) {
    art.unactivatedSubstats = undefined;
    return result;
  }

  Object.assign(art.substats, unactivated);
  art.unactivatedSubstats = undefined;
  return result;
}

/** Create a new artifact and equip it in a slot */
export function createAndEquipArtifact(
  data: AccountData,
  charKey: string,
  slot: Slot,
  setKey: string,
  mainStatKey: string,
  rarity = 5
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  const oldArt = char.artifacts[slot];
  if (oldArt) result.extraArtifacts.push(oldArt);

  char.artifacts[slot] = {
    id: nextArtifactId(result),
    setKey,
    slotKey: slot,
    level: 20,
    rarity: rarity as ArtifactData["rarity"],
    mainStatKey: mainStatKey as ArtifactData["mainStatKey"],
    lock: false,
    substats: {},
  };
  return result;
}

// ─── Inventory operations (extra/unequipped items) ───────────────────────────

/** Delete a weapon from inventory (extraWeapons) by id */
export function deleteInventoryWeapon(
  data: AccountData,
  weaponId: string
): AccountData {
  const result = cloneData(data);
  result.extraWeapons = result.extraWeapons.filter((w) => w.id !== weaponId);
  return result;
}

/** Delete an artifact from inventory (extraArtifacts) by id */
export function deleteInventoryArtifact(
  data: AccountData,
  artifactId: string
): AccountData {
  const result = cloneData(data);
  result.extraArtifacts = result.extraArtifacts.filter(
    (a) => a.id !== artifactId
  );
  return result;
}

// ─── Save validation ──────────────────────────────────────────────────────────

/**
 * Strip incomplete newly-created artifacts before persisting.
 * A newly-created artifact is "incomplete" if it has fewer than 4 substats
 * or has a substat that duplicates its main stat.
 */
export function stripIncompleteNewArtifacts(
  data: AccountData,
  newlyCreatedIds: ReadonlySet<string>
): AccountData {
  if (newlyCreatedIds.size === 0) return data;
  const result = cloneData(data);
  for (const c of result.characters) {
    for (const slot of Object.keys(c.artifacts) as Slot[]) {
      const art = c.artifacts[slot];
      if (art && newlyCreatedIds.has(art.id)) {
        const activatedCount = Object.keys(art.substats).length;
        const unactivatedCount = Object.keys(
          art.unactivatedSubstats ?? {}
        ).length;
        const totalCount = activatedCount + unactivatedCount;
        const allKeys = [
          ...Object.keys(art.substats),
          ...Object.keys(art.unactivatedSubstats ?? {}),
        ];
        const hasMainDupe = allKeys.includes(art.mainStatKey);
        if (totalCount < 4 || hasMainDupe) {
          delete c.artifacts[slot];
        }
      }
    }
  }
  return result;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/** Get all inventory artifacts for a specific slot */
export function getInventoryArtifactsForSlot(
  data: AccountData,
  slot: Slot
): ArtifactData[] {
  return data.extraArtifacts.filter((a) => a.slotKey === slot);
}
