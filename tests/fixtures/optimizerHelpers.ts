/**
 * Shared test helpers for optimizer / team-comp test files.
 *
 * Centralises makeArt, makeBuildMatch, drain, emptySheets and
 * getFirstFormulaId so they are defined once instead of copy-pasted
 * across every test file.
 */
import type { ArtifactData } from "@/data/types";
import type { BuildMatchResult } from "@/lib/account-data/artifactScore";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import type { TeamBuild } from "@/lib/team-comp/calc/teamBuild";

// ── Artifact factory ────────────────────────────────────────────────────────

let artCounter = 0;

/**
 * Create a test artifact.
 *
 * @param slot      - artifact slot
 * @param setKey    - artifact set id (defaults to crimson_witch_of_flames)
 * @param mainStat  - explicit main-stat; when omitted a sensible default for
 *                    the slot is chosen
 * @param substats  - sub-stat overrides (default: cr/cd/atk/em)
 */
export function makeArt(
  slot: ArtifactData["slotKey"],
  setKey = "crimson_witch_of_flames",
  mainStat?: ArtifactData["mainStatKey"],
  substats: ArtifactData["substats"] = { cr: 7.0, cd: 14.0, atk: 20, em: 20 }
): ArtifactData {
  const mainStats: Record<string, ArtifactData["mainStatKey"]> = {
    flower: "hp",
    plume: "atk",
    sands: "hp%",
    goblet: "pyro%",
    circlet: "cr",
  };
  return {
    id: `test-art-${++artCounter}`,
    setKey,
    slotKey: slot,
    rarity: 5,
    level: 20,
    mainStatKey: mainStat ?? mainStats[slot] ?? "hp",
    lock: false,
    substats,
  };
}

// ── Build-match factory ─────────────────────────────────────────────────────

/**
 * Minimal BuildMatchResult for optimizer scoring.
 *
 * @param artifactSet - the set key to use in the build (default CW)
 */
export function makeBuildMatch(
  artifactSet = "crimson_witch_of_flames"
): BuildMatchResult {
  return {
    build: {
      id: "test-build",
      characterId: "hu_tao",
      visible: true,
      name: "Test Build",
      composition: "4pc",
      artifactSet,
      roles: ["dps"],
      sandsWeights: [{ stat: "hp%", weight: 100 }],
      gobletWeights: [{ stat: "pyro%", weight: 100 }],
      circletWeights: [{ stat: "cr", weight: 100 }],
      normalizer: 0,
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "em", weight: 50 },
        { stat: "hp%", weight: 50 },
      ],
    },
    buildIndex: 0,
    statWeights: { cr: 100, cd: 100, em: 50, "hp%": 50 },
    setMatched: true,
    setDifferent: false,
    mainStatMatches: 3,
    mainStatMismatches: [],
  };
}

// ── Async-generator drain ───────────────────────────────────────────────────

/** Collect all yields from an async generator into an array. */
export async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

// ── Empty stat-sheets ───────────────────────────────────────────────────────

/**
 * Build an empty-StatSheet record for the given character IDs.
 * If no IDs are passed the common Hu Tao team is used.
 */
export function emptySheets(...charIds: string[]): Record<string, StatSheet> {
  const ids =
    charIds.length > 0
      ? charIds
      : ["hu_tao", "xingqiu", "zhongli", "kaedehara_kazuha"];
  const sheets: Record<string, StatSheet> = {};
  for (const id of ids) sheets[id] = new StatSheet([]);
  return sheets;
}

// ── Formula-ID helper ───────────────────────────────────────────────────────

/** Return the first formula ID registered for `charId` on `tb`. */
export function getFirstFormulaId(tb: TeamBuild, charId: string): string {
  const formulas = tb.getFormulaIds()[charId];
  return Object.keys(formulas)[0];
}
