import { retiredWeaponIds } from "@/data/retiredWeaponIds";
import { i18nGameData } from "@/generated/i18n-game";

/** Normalize a string for entity name comparison (remove non-alphanumeric, lowercase). */
export const normalizeEntityName = (str: string): string =>
  str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const charNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.characters)) {
  charNameMap.set(normalizeEntityName(data.en), id);
}

export const weaponNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.weapons)) {
  weaponNameMap.set(normalizeEntityName(data.en), id);
}
// GOOD keys strip spaces/punctuation, so the old underscore IDs also cover
// exported PascalCase and display names such as WeaponSword / Weapon: Sword.
for (const [retiredId, releasedId] of Object.entries(retiredWeaponIds)) {
  weaponNameMap.set(normalizeEntityName(retiredId), releasedId);
}

export const artifactNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.artifacts)) {
  artifactNameMap.set(normalizeEntityName(data.en), id);
}
