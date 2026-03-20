/**
 * Shared runner utilities for the optimizer benchmark.
 *
 * Contains all types, config builders, data loaders, and the main
 * `runOptimizerOnTeam` function used by both the benchmark CLI and
 * its parallel workers.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Side-effect barrel: registers all character/weapon/artifact implementations.
import "@/lib/team-comp/index";

import { artifactsById } from "@/data/constants";
import type {
  AccountData,
  ArtifactData,
  Build,
  CharacterData,
  Element,
  GlobalStatWeights,
  Slot,
} from "@/data/types";
import {
  type BuildMatchResult,
  matchBuild,
} from "@/lib/account-data/artifactScore";
import {
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/account-data/goodConversion";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild, hasOffFieldParts } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import { runTeamOptimization as runV2 } from "@/lib/team-comp/optimizerV2";
import type {
  PerCharConfig,
  TeamOptYield,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";
import type { CalcContext, CharCompConfig } from "@/lib/team-comp/types";
import { runTeamOptimization as runMona } from "./gen/mona";
import { runTeamOptimization as runV1 } from "./gen/v1";

// ─── Build preset import ─────────────────────────────────────────────────────

import allBuildsJson from "@/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";

const presetBuilds = allBuildsJson.builds as Record<string, Build>;
const characterBuildIds = allBuildsJson.characterBuilds as Record<
  string,
  string[]
>;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArtifactConfig {
  type: "4pc" | "2pc+2pc";
  setId?: string;
  id1?: string | number;
  id2?: string | number;
}

export interface Team {
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactConfig | null)[];
  reactions: string[];
  opts: Record<string, string>;
  minEr: Record<string, number>;
  minCr?: Record<string, number>;
  selectedFormula: { charId: string; formulaId: string } | null;
  optimizationResult: unknown;
  calcContext?: Partial<CalcContext>;
  reactionOverrides?: Record<string, unknown>;
  formulaMode?: "single" | "combo";
  combos?: unknown[];
  selectedCombo?: string | null;
  enemyElementAura?: string;
}

export interface TeamCompData {
  teams: Team[];
  author?: string;
  description?: string;
}

export interface FormulaResult {
  formulaId: string;
  labelEn: string;
  damage: number;
}

export interface ConstraintViolation {
  charId: string;
  kind: "er" | "cr";
  required: number;
  actual: number;
}

export interface TeamResult {
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  optimizedFormulaId: string;
  optimizedDamage: number;
  optimizeTimeSec: number;
  formulaResults: FormulaResult[];
  error?: string;
  artifactAssignment: Record<string, Record<string, string>>;
  failReasons: Record<string, string>;
  constraintViolations?: ConstraintViolation[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_CALC_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  assumeCrit: false,
};

export const DEFAULT_GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

export const DPS_TARGET_ER = 1.0;
export const TEAMMATE_TARGET_ER_5STAR = 1.5;
export const TEAMMATE_TARGET_ER_4STAR = 1.0;

// ─── Formatting ──────────────────────────────────────────────────────────────

export const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ─── Data Loading ────────────────────────────────────────────────────────────

export function loadAccountData(filePath: string): AccountData {
  const raw = readFileSync(filePath, "utf-8");
  const goodData = JSON.parse(raw) as GOODData;
  const { data, warnings } = convertGOODToAccountData(goodData);
  if (warnings.length > 0) {
    console.warn(
      `${C.yellow}Account import warnings: ${warnings.length} items skipped${C.reset}`
    );
  }
  return data;
}

export function loadTeamPreset(): TeamCompData {
  const presetPath = resolve(
    "src/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json"
  );
  const raw = readFileSync(presetPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { teams: parsed };
  return parsed as TeamCompData;
}

export function getAllArtifacts(accountData: AccountData): ArtifactData[] {
  return [
    ...accountData.extraArtifacts,
    ...accountData.characters.flatMap((c: CharacterData) =>
      (Object.values(c.artifacts || {}) as (ArtifactData | undefined)[]).filter(
        (a): a is ArtifactData => !!a
      )
    ),
  ];
}

// ─── Config Builders ─────────────────────────────────────────────────────────

export function getBuildsForChar(charId: string): Build[] {
  const ids = characterBuildIds[charId];
  if (!ids) return [];
  return ids.map((id) => presetBuilds[id]).filter((b): b is Build => !!b);
}

export function getArtifactSetRarity(
  goalArt:
    | { type: string; setId?: string; id1?: string | number }
    | null
    | undefined
): number {
  if (!goalArt) return 5;
  if (goalArt.type === "4pc" && goalArt.setId) {
    return artifactsById[goalArt.setId]?.rarity ?? 5;
  }
  if (goalArt.type === "2pc+2pc") {
    const id1 = String(goalArt.id1);
    return artifactsById[id1]?.rarity ?? 5;
  }
  return 5;
}

export function getTeammateTargetEr(
  goalArt:
    | { type: string; setId?: string; id1?: string | number }
    | null
    | undefined
): number {
  return getArtifactSetRarity(goalArt) >= 5
    ? TEAMMATE_TARGET_ER_5STAR
    : TEAMMATE_TARGET_ER_4STAR;
}

export function buildCharCompConfig(
  team: Team,
  index: number,
  accountData: AccountData
): CharCompConfig | null {
  const charId = team.characters[index];
  const weaponId = team.weapons[index];
  if (!charId || !weaponId) return null;

  const acctChar = accountData.characters.find(
    (c: CharacterData) => c.key === charId
  );

  const levelOverride = team.opts?.[`${charId}.overrideLevel`];
  const consOverride = team.opts?.[`${charId}.overrideConstellation`];

  const charLevel = levelOverride
    ? Number.parseInt(levelOverride)
    : (acctChar?.level ?? 90);
  const constellation =
    consOverride !== undefined
      ? Number.parseInt(consOverride)
      : (acctChar?.constellation ?? 0);

  let refinement = 1;
  if (acctChar?.weapon?.key === weaponId) {
    refinement = acctChar.weapon.refinement;
  } else {
    const allWeapons = [
      ...accountData.extraWeapons,
      ...accountData.characters
        .map((c: CharacterData) => c.weapon)
        .filter((w): w is NonNullable<typeof w> => !!w),
    ];
    const matchingWeapon = allWeapons.find((w) => w.key === weaponId);
    if (matchingWeapon) refinement = matchingWeapon.refinement;
  }

  const goalArt = team.artifacts[index];
  let artifactSetId: string | null = null;
  let artifactHalfSetIds: string[] = [];

  if (goalArt?.type === "4pc") {
    artifactSetId = goalArt.setId ?? null;
  } else if (goalArt?.type === "2pc+2pc") {
    artifactHalfSetIds = [String(goalArt.id1), String(goalArt.id2)];
  }

  return {
    charId,
    charLevel,
    constellation,
    weaponId,
    refinement,
    artifactSetId,
    artifactHalfSetIds,
  };
}

export function buildPerChar(
  team: Team,
  carryCharId: string,
  accountData: AccountData
): Record<string, PerCharConfig> {
  const perChar: Record<string, PerCharConfig> = {};
  for (let ci = 0; ci < team.characters.length; ci++) {
    const cid = team.characters[ci];
    if (!cid) continue;

    const goalArt = team.artifacts[ci];
    let goalSetId: string | null = null;
    let goalHalfSetIds: string[] = [];
    if (goalArt?.type === "4pc") {
      goalSetId = goalArt.setId ?? null;
    } else if (goalArt?.type === "2pc+2pc") {
      goalHalfSetIds = [String(goalArt.id1), String(goalArt.id2)];
    }

    const hasFavonius = team.weapons[ci]?.startsWith("favonius_") ?? false;
    const isDps = cid === carryCharId;

    const acctChar = accountData.characters.find(
      (c: CharacterData) => c.key === cid
    );
    const charArtifacts = (acctChar?.artifacts ?? {}) as Partial<
      Record<Slot, ArtifactData>
    >;
    const builds = getBuildsForChar(cid);
    const bm =
      builds.length > 0
        ? matchBuild(
            charArtifacts,
            builds,
            acctChar?.constellation ?? 0,
            DEFAULT_GLOBAL_CONFIG
          )
        : null;

    const minEr = isDps ? DPS_TARGET_ER : getTeammateTargetEr(goalArt);
    perChar[cid] = {
      minEr,
      minCr: hasFavonius ? (team.minCr?.[cid] ?? 0.05) : 0,
      buildMatch: bm ?? undefined,
      artifactSetId: goalSetId,
      artifactHalfSetIds: goalHalfSetIds,
    };
  }
  return perChar;
}

function buildBaseSheets(
  team: Team,
  accountData: AccountData
): Record<string, StatSheet> {
  const sheets: Record<string, StatSheet> = {};
  for (const charId of team.characters) {
    if (!charId) continue;
    const acctChar = accountData.characters.find(
      (c: CharacterData) => c.key === charId
    );
    if (!acctChar) continue;
    const artifacts = Object.values(acctChar.artifacts || {}).filter(
      (a): a is ArtifactData => !!a
    );
    sheets[charId] = StatSheet.fromArtifacts(artifacts);
  }
  return sheets;
}

export function getCarryFormulaIds(
  team: Team
): { formulaId: string; label: string }[] {
  const configs: CharCompConfig[] = [];
  for (let i = 0; i < team.characters.length; i++) {
    const charId = team.characters[i];
    const weaponId = team.weapons[i];
    if (!charId || !weaponId) continue;
    configs.push({
      charId,
      charLevel: 90,
      constellation: 0,
      weaponId,
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    });
  }
  if (configs.length === 0) return [];
  try {
    const tb = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyElementAura as Element | undefined
    );
    const carryId = team.characters[0]!;
    const formulas = tb.getFormulaIds()[carryId];
    if (!formulas) return [];
    return Object.entries(formulas).map(([fid, lbl]) => ({
      formulaId: fid,
      label: lbl.zh || lbl.en || fid,
    }));
  } catch {
    return [];
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

export { preloadGameStats };

export async function runOptimizerOnTeam(
  team: Team,
  accountData: AccountData,
  inventory: ArtifactData[],
  algorithm: "v1" | "v2" | "mona",
  timeoutMs = 120_000,
  perCharDeadlineMs?: number,
  formulaIdOverride?: string,
  maxArtsPerSlot?: number
): Promise<TeamResult> {
  const carryCharId = team.characters[0]!;
  const charIds = team.characters.filter((c): c is string => !!c);

  const result: TeamResult = {
    teamId: team.id,
    teamName: team.name || charIds.join(" / "),
    characters: charIds,
    carryCharId,
    optimizedFormulaId: "",
    optimizedDamage: 0,
    optimizeTimeSec: 0,
    formulaResults: [],
    artifactAssignment: {},
    failReasons: {},
  };

  try {
    const configs: CharCompConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildCharCompConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }

    if (configs.length === 0) {
      result.error = "No valid character configs";
      return result;
    }

    const teamBuild = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyElementAura as Element | undefined
    );

    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      assumeCrit:
        team.calcContext?.assumeCrit ?? DEFAULT_CALC_CONTEXT.assumeCrit,
    };

    const baseSheets = buildBaseSheets(team, accountData);
    const perChar = buildPerChar(team, carryCharId, accountData);

    const allFormulas = teamBuild.getFormulaIds();
    const carryFormulas = allFormulas[carryCharId];
    if (!carryFormulas || Object.keys(carryFormulas).length === 0) {
      result.error = `No formulas found for carry ${carryCharId}`;
      return result;
    }

    const formulaEntries = Object.entries(carryFormulas);
    let targetFormulaId: string;
    if (formulaIdOverride && carryFormulas[formulaIdOverride]) {
      targetFormulaId = formulaIdOverride;
    } else {
      targetFormulaId = formulaEntries[0][0];
    }
    result.optimizedFormulaId = targetFormulaId;

    const opts: TeamOptimizerOptions = {
      teamBuild,
      carryCharId,
      formulaId: targetFormulaId,
      inventory,
      calcContext,
      globalConfig: DEFAULT_GLOBAL_CONFIG,
      baseSheets,
      perChar,
      ...((algorithm === "v2" || algorithm === "mona") && timeoutMs > 0
        ? { teamDeadlineMs: performance.now() + timeoutMs }
        : {}),
      ...(maxArtsPerSlot ? { maxArtsPerSlot } : {}),
    };

    const runFn =
      algorithm === "v1" ? runV1 : algorithm === "mona" ? runMona : runV2;
    const startTime = performance.now();

    let finalResult: TeamOptimizationResult | null = null;
    const gen = runFn(opts);
    for await (const yielded of gen) {
      if (yielded.done) {
        finalResult = yielded;
        break;
      }
      if (performance.now() - startTime > timeoutMs) {
        gen.return(undefined as unknown as TeamOptYield);
        result.error = `TIMEOUT after ${(timeoutMs / 1000).toFixed(0)}s`;
        result.optimizeTimeSec = (performance.now() - startTime) / 1000;
        return result;
      }
    }

    result.optimizeTimeSec = (performance.now() - startTime) / 1000;

    if (!finalResult) {
      result.error = "Optimizer returned no result";
      return result;
    }

    result.optimizedDamage = finalResult.bestDamage;

    for (const [cid, arts] of Object.entries(finalResult.bestArtifactsByChar)) {
      result.artifactAssignment[cid] = {};
      for (const [slot, art] of Object.entries(arts)) {
        if (art) {
          result.artifactAssignment[cid][slot] = art.id;
        }
      }
    }

    if (finalResult.failReasons) {
      for (const [cid, reason] of Object.entries(finalResult.failReasons)) {
        result.failReasons[cid] =
          typeof reason === "string" ? reason : reason.kind;
      }
    }

    // Evaluate the target formula on the optimized build
    const optTeamBuild = finalResult.teamBuild ?? teamBuild;
    const artifactStats: Record<string, StatSheet> = {};
    for (const [cid, slotArts] of Object.entries(
      finalResult.bestArtifactsByChar
    )) {
      const pieces = Object.values(slotArts).filter(
        (a): a is ArtifactData => a != null
      );
      artifactStats[cid] = StatSheet.fromArtifacts(pieces);
    }

    const postStats = optTeamBuild.getTeamStats(
      artifactStats,
      carryCharId,
      calcContext
    );

    // ── Validate minEr / minCr constraints on the final solution ──
    const violations: ConstraintViolation[] = [];
    for (const [cid, charConfig] of Object.entries(perChar)) {
      if (charConfig.minEr > 0) {
        const er = postStats[cid]?.get("er", null) ?? 0;
        if (er < charConfig.minEr - 1e-6) {
          violations.push({
            charId: cid,
            kind: "er",
            required: charConfig.minEr,
            actual: er,
          });
        }
      }
      if (charConfig.minCr > 0) {
        const cr = postStats[cid]?.get("cr", null) ?? 0;
        if (cr < charConfig.minCr - 1e-6) {
          violations.push({
            charId: cid,
            kind: "cr",
            required: charConfig.minCr,
            actual: cr,
          });
        }
      }
    }
    if (violations.length > 0) {
      result.constraintViolations = violations;
    }

    for (const [formulaId, label] of formulaEntries) {
      try {
        // Compute off-field stats if the formula has off-field parts
        let offFieldStats: Record<string, StatSheet> | undefined;
        if (hasOffFieldParts(optTeamBuild, carryCharId, formulaId)) {
          const otherCharId = Object.keys(optTeamBuild.charBuilds).find(
            (id) => id !== carryCharId
          );
          if (otherCharId) {
            offFieldStats = optTeamBuild.getTeamStats(
              artifactStats,
              otherCharId,
              calcContext
            );
          }
        }
        const dmg = optTeamBuild.getDamageResult(
          carryCharId,
          formulaId,
          postStats,
          calcContext,
          undefined,
          offFieldStats
        );
        result.formulaResults.push({
          formulaId,
          labelEn: label.en || label.zh || formulaId,
          damage: dmg.totalDamage,
        });
      } catch {
        result.formulaResults.push({
          formulaId,
          labelEn: label.en || label.zh || formulaId,
          damage: 0,
        });
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
