import type { ArtifactData, SubStat } from "@/data/types";
import {
  type RollTable,
  buildRollTable,
  gameRound,
  isAlreadyPrecise,
  solveArtifact,
} from "./artifactSolver";

export type ValidationResult = { solved: ArtifactData } | { error: string };

/**
 * Validate artifact substats against the solver and return precise values.
 * Returns { solved } with precise substat values on success,
 * or { error } with an i18n-keyed error message on failure.
 */
export function validateAndSolveArtifact(art: ArtifactData): ValidationResult {
  const rarity = art.rarity;

  // Skip validation for 3★ and below, or empty substats
  if (rarity < 4 || Object.keys(art.substats).length === 0) {
    return { solved: art };
  }

  const solverRarity = rarity as 4 | 5;
  const table = buildRollTable();

  // 1. Validate activated substats
  const activatedResult = validateActivatedSubstats(art, solverRarity, table);
  if ("error" in activatedResult) return activatedResult;

  // 2. Validate unactivated substats (each must be a valid 1-roll value)
  const unactivatedResult = validateUnactivatedSubstats(
    art,
    solverRarity,
    table
  );
  if ("error" in unactivatedResult) return unactivatedResult;

  // 3. Construct solved artifact
  const solved: ArtifactData = {
    ...art,
    substats: activatedResult.substats,
  };
  if (unactivatedResult.unactivatedSubstats) {
    solved.unactivatedSubstats = unactivatedResult.unactivatedSubstats;
  }
  return { solved };
}

function validateActivatedSubstats(
  art: ArtifactData,
  rarity: 4 | 5,
  table: RollTable
): { substats: ArtifactData["substats"] } | { error: string } {
  const invalidStats: string[] = [];

  for (const [stat, value] of Object.entries(art.substats)) {
    if (value === undefined) continue;
    const key = `${stat}:${rarity}`;
    const displayMap = table.get(key);
    if (!displayMap || !displayMap.has(gameRound(stat, value))) {
      invalidStats.push(stat);
    }
  }

  if (invalidStats.length > 0) {
    return { error: `charEdit.invalidSubstat:${invalidStats.join(",")}` };
  }

  // If already precise, return original substats without overwriting
  if (isAlreadyPrecise(art.substats)) {
    return { substats: art.substats };
  }

  // Run solver
  const solved = solveArtifact({
    rarity,
    level: art.level,
    substats: art.substats,
  });
  if (solved === null) {
    return { error: "charEdit.invalidRollCombination" };
  }

  return { substats: solved as ArtifactData["substats"] };
}

function validateUnactivatedSubstats(
  art: ArtifactData,
  rarity: 4 | 5,
  table: RollTable
):
  | { unactivatedSubstats?: ArtifactData["unactivatedSubstats"] }
  | { error: string } {
  if (!art.unactivatedSubstats) return {};

  const entries = Object.entries(art.unactivatedSubstats).filter(
    ([, v]) => v !== undefined
  ) as [string, number][];
  if (entries.length === 0) return {};

  const invalidStats: string[] = [];

  for (const [stat, value] of entries) {
    const key = `${stat}:${rarity}`;
    const displayMap = table.get(key);
    const rounded = gameRound(stat, value);
    if (!displayMap?.get(rounded)?.has(1)) {
      invalidStats.push(stat);
    }
  }

  if (invalidStats.length > 0) {
    return { error: `charEdit.invalidSubstat:${invalidStats.join(",")}` };
  }

  return { unactivatedSubstats: art.unactivatedSubstats };
}
