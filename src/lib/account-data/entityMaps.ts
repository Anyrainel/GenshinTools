import { i18nBetaData } from "@/data/i18n-beta";
import { i18nGameData } from "@/data/i18n-game";

/** Normalize a string for entity name comparison (remove non-alphanumeric, lowercase). */
export const normalizeEntityName = (str: string): string =>
  str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

// ---------------------------------------------------------------------------
// Maps that include beta data (beta first, then game data overlay so released
// entries win on name collisions). Used by GOOD import.
// ---------------------------------------------------------------------------

export const charNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nBetaData.characters)) {
  charNameMap.set(normalizeEntityName(data.en), id);
}
for (const [id, data] of Object.entries(i18nGameData.characters)) {
  charNameMap.set(normalizeEntityName(data.en), id);
}

export const weaponNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nBetaData.weapons)) {
  weaponNameMap.set(normalizeEntityName(data.en), id);
}
for (const [id, data] of Object.entries(i18nGameData.weapons)) {
  weaponNameMap.set(normalizeEntityName(data.en), id);
}

export const artifactNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.artifacts)) {
  artifactNameMap.set(normalizeEntityName(data.en), id);
}

// ---------------------------------------------------------------------------
// Maps built from game data only (no beta). Used by HoYoLAB fetcher where
// beta entities aren't relevant.
// ---------------------------------------------------------------------------

export const gameOnlyCharNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.characters)) {
  gameOnlyCharNameMap.set(normalizeEntityName(data.en), id);
}

export const gameOnlyWeaponNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.weapons)) {
  gameOnlyWeaponNameMap.set(normalizeEntityName(data.en), id);
}

// Artifact maps are identical (no beta artifact entries), but exported
// separately for clarity and consistency.
export const gameOnlyArtifactNameMap = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.artifacts)) {
  gameOnlyArtifactNameMap.set(normalizeEntityName(data.en), id);
}
