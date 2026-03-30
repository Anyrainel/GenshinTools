import { i18nGameData } from "@/data/i18n-game";

function englishToGOODKey(en: string): string {
  return en
    .split(/\s+/)
    .map((word) => {
      const clean = word.replace(/[^a-zA-Z0-9]/g, "");
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    })
    .join("");
}

const charGOODKeys = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.characters)) {
  charGOODKeys.set(id, englishToGOODKey(data.en));
}

const artifactGOODKeys = new Map<string, string>();
for (const [id, data] of Object.entries(i18nGameData.artifacts)) {
  artifactGOODKeys.set(id, englishToGOODKey(data.en));
}

export function charIdToGOODKey(charId: string): string | undefined {
  return charGOODKeys.get(charId);
}

export function artifactIdToGOODKey(setId: string): string | undefined {
  return artifactGOODKeys.get(setId);
}

// Reverse lookups: GOOD PascalCase → internal snake_case ID
const goodKeyToChar = new Map<string, string>();
for (const [id, goodKey] of charGOODKeys) {
  goodKeyToChar.set(goodKey, id);
}

const goodKeyToArtifact = new Map<string, string>();
for (const [id, goodKey] of artifactGOODKeys) {
  goodKeyToArtifact.set(goodKey, id);
}

export function goodKeyToCharId(goodKey: string): string | undefined {
  return goodKeyToChar.get(goodKey);
}

export function goodKeyToArtifactSetId(goodKey: string): string | undefined {
  return goodKeyToArtifact.get(goodKey);
}
