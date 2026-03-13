import type {
  AccountData,
  ArtifactData,
  CharacterData,
  Slot,
  WeaponData,
} from "@/data/types";

// ─── ID generation ────────────────────────────────────────────────────────────

function getMaxIds(data: AccountData) {
  let maxA = -1;
  let maxW = -1;
  const parse = (id: string, prefix: string) => {
    const num = Number.parseInt(id.replace(prefix, ""), 10);
    return Number.isNaN(num) ? -1 : num;
  };

  for (const c of data.characters) {
    for (const a of Object.values(c.artifacts)) {
      if (a) {
        const val = parse(a.id, "artifact-");
        if (val > maxA) maxA = val;
      }
    }
    if (c.weapon) {
      const val = parse(c.weapon.id, "weapon-");
      if (val > maxW) maxW = val;
    }
  }
  for (const art of data.extraArtifacts) {
    const val = parse(art.id, "artifact-");
    if (val > maxA) maxA = val;
  }
  for (const wp of data.extraWeapons) {
    const val = parse(wp.id, "weapon-");
    if (val > maxW) maxW = val;
  }

  return { maxA, maxW };
}

function nextArtifactId(data: AccountData): string {
  return `artifact-${getMaxIds(data).maxA + 1}`;
}

function nextWeaponId(data: AccountData): string {
  return `weapon-${getMaxIds(data).maxW + 1}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneData(data: AccountData): AccountData {
  return JSON.parse(JSON.stringify(data));
}

function findCharByKey(
  data: AccountData,
  key: string
): CharacterData | undefined {
  return data.characters.find((c) => c.key === key);
}

/** Find which character has a specific weapon equipped (by weapon id) */
function findCharWithWeapon(
  data: AccountData,
  weaponId: string
): CharacterData | undefined {
  return data.characters.find((c) => c.weapon?.id === weaponId);
}

/** Find which character has a specific artifact equipped (by artifact id) */
function findCharWithArtifact(
  data: AccountData,
  artifactId: string
): { char: CharacterData; slot: Slot } | undefined {
  for (const c of data.characters) {
    for (const [slot, art] of Object.entries(c.artifacts)) {
      if (art && art.id === artifactId) {
        return { char: c, slot: slot as Slot };
      }
    }
  }
  return undefined;
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

/** Delete weapon from character (permanently remove) */
export function deleteWeapon(data: AccountData, charKey: string): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char?.weapon) return result;

  char.weapon = undefined;
  return result;
}

/**
 * Equip a weapon from inventory onto a character.
 * If the character already has a weapon, the old one goes to inventory.
 */
export function equipWeaponFromInventory(
  data: AccountData,
  charKey: string,
  weaponId: string
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  const invIdx = result.extraWeapons.findIndex((w) => w.id === weaponId);
  if (invIdx === -1) return result;

  const weapon = result.extraWeapons.splice(invIdx, 1)[0];

  // Stash old weapon
  if (char.weapon) {
    result.extraWeapons.push(char.weapon);
  }

  char.weapon = weapon;
  return result;
}

/**
 * Swap weapons between two characters.
 * If targetChar has no weapon, the weapon is simply moved.
 */
export function swapWeaponWithCharacter(
  data: AccountData,
  charKey: string,
  otherCharKey: string
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  const other = findCharByKey(result, otherCharKey);
  if (!char || !other) return result;

  const temp = char.weapon;
  char.weapon = other.weapon;
  other.weapon = temp;
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

/** Create a new weapon and equip it */
export function createAndEquipWeapon(
  data: AccountData,
  charKey: string,
  weaponKey: string,
  level = 90,
  refinement = 1
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  if (char.weapon) result.extraWeapons.push(char.weapon);

  char.weapon = {
    id: nextWeaponId(result),
    key: weaponKey,
    level,
    refinement,
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
    Pick<ArtifactData, "level" | "rarity" | "mainStatKey" | "substats" | "lock">
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

  return result;
}

/** Change the artifact set for a slot. Tries inventory, then other chars, then creates new. */
export function changeArtifactSet(
  data: AccountData,
  charKey: string,
  slot: Slot,
  newSetKey: string
): AccountData {
  const result = cloneData(data);
  const char = findCharByKey(result, charKey);
  if (!char) return result;

  // Check inventory for matching set + slot
  const invIdx = result.extraArtifacts.findIndex(
    (a) => a.setKey === newSetKey && a.slotKey === slot
  );
  if (invIdx >= 0) {
    const art = result.extraArtifacts.splice(invIdx, 1)[0];
    const oldArt = char.artifacts[slot];
    if (oldArt) result.extraArtifacts.push(oldArt);
    char.artifacts[slot] = art;
    return result;
  }

  // Stash old, create new
  const oldArt = char.artifacts[slot];
  if (oldArt) result.extraArtifacts.push(oldArt);

  const mainStatKey =
    slot === "flower" ? "hp" : slot === "plume" ? "atk" : "atk%";

  char.artifacts[slot] = {
    id: nextArtifactId(result),
    setKey: newSetKey,
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey,
    lock: false,
    substats: {},
  };
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

// ─── Query helpers ────────────────────────────────────────────────────────────

/** Get all inventory weapons */
export function getInventoryWeapons(data: AccountData): WeaponData[] {
  return data.extraWeapons;
}

/** Get all inventory artifacts for a specific slot */
export function getInventoryArtifactsForSlot(
  data: AccountData,
  slot: Slot
): ArtifactData[] {
  return data.extraArtifacts.filter((a) => a.slotKey === slot);
}

/** Get all equipped artifacts on other characters for a specific slot */
export function getEquippedArtifactsOnOthers(
  data: AccountData,
  charKey: string,
  slot: Slot
): { artifact: ArtifactData; ownerKey: string }[] {
  const results: { artifact: ArtifactData; ownerKey: string }[] = [];
  for (const c of data.characters) {
    if (c.key === charKey) continue;
    const art = c.artifacts[slot];
    if (art) {
      results.push({ artifact: art, ownerKey: c.key });
    }
  }
  return results;
}

/** Get all equipped weapons on other characters */
export function getEquippedWeaponsOnOthers(
  data: AccountData,
  charKey: string
): { weapon: WeaponData; ownerKey: string }[] {
  const results: { weapon: WeaponData; ownerKey: string }[] = [];
  for (const c of data.characters) {
    if (c.key === charKey) continue;
    if (c.weapon) {
      results.push({ weapon: c.weapon, ownerKey: c.key });
    }
  }
  return results;
}
