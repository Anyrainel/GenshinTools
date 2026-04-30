/**
 * Validation & repair functions for zustand-persisted data.
 *
 * These run on every rehydration (inside `merge`) to guarantee that
 * deserialized data always matches the expected shape. When a field is
 * missing or has the wrong type, these functions repair it in-place
 * so consumers never see partially-valid objects.
 */

import type {
  AccountData,
  ArtifactData,
  Build,
  CharacterData,
} from "@/data/types";

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

// ─── Build ───

/**
 * Ensure a Build object has all required fields. Mutates in-place.
 * Complements migrateBuild() — this focuses on structural shape guarantees
 * while migrateBuild() handles semantic migrations (halfSet IDs, normalizer).
 */
export function repairBuild(build: Build): void {
  if (typeof build.name !== "string") build.name = "";
  if (typeof build.visible !== "boolean") build.visible = true;
  if (build.composition !== "4pc" && build.composition !== "2pc+2pc")
    build.composition = "4pc";
  if (!Array.isArray(build.substats)) build.substats = [];
  if (!Array.isArray(build.sandsWeights)) build.sandsWeights = [];
  if (!Array.isArray(build.gobletWeights)) build.gobletWeights = [];
  if (!Array.isArray(build.circletWeights)) build.circletWeights = [];
  if (typeof build.normalizer !== "number") build.normalizer = 0;
}
