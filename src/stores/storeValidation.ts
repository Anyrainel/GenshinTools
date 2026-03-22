/**
 * Validation & repair functions for zustand-persisted data.
 *
 * These run on every rehydration (inside `merge`) to guarantee that
 * deserialized data always matches the expected shape. When a field is
 * missing or has the wrong type, these functions repair it in-place
 * so consumers never see partially-valid objects.
 */

import type { AccountData, ArtifactData, CharacterData } from "@/data/types";

// ─── ArtifactData ───

/** Ensure an ArtifactData object has all required fields. Mutates in-place. */
export function repairArtifact(art: ArtifactData): void {
  if (
    art.substats == null ||
    typeof art.substats !== "object" ||
    Array.isArray(art.substats)
  ) {
    art.substats = {};
  }
  if (typeof art.level !== "number") art.level = 0;
  if (typeof art.rarity !== "number") (art as { rarity: number }).rarity = 5;
  if (typeof art.lock !== "boolean") art.lock = false;
}

/** Walk all artifacts in a record (character equipment slots) and repair them. */
function repairArtifactRecord(
  artifacts: Partial<Record<string, ArtifactData | null>>
): void {
  for (const art of Object.values(artifacts)) {
    if (art) repairArtifact(art);
  }
}

// ─── CharacterData ───

/** Ensure a CharacterData object has all required fields. Mutates in-place. */
function repairCharacter(char: CharacterData): void {
  if (!char.artifacts || typeof char.artifacts !== "object") {
    char.artifacts = {};
  }
  repairArtifactRecord(char.artifacts);
  if (!char.talent || typeof char.talent !== "object") {
    char.talent = { auto: 1, skill: 1, burst: 1 };
  }
}

// ─── AccountData ───

/** Ensure an AccountData object has all required fields. Mutates in-place. */
export function repairAccountData(data: AccountData): void {
  if (!Array.isArray(data.characters)) data.characters = [];
  for (const char of data.characters) repairCharacter(char);

  if (!Array.isArray(data.extraArtifacts)) data.extraArtifacts = [];
  for (const art of data.extraArtifacts) repairArtifact(art);

  if (!Array.isArray(data.extraWeapons)) data.extraWeapons = [];
}
