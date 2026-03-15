#!/usr/bin/env tsx
/**
 * Optimizer Testbed: Run V1 and V2 team optimizers on all preset teams.
 *
 * For each team in the preset:
 *   1. Pick the first formula of the DPS (first character) as the optimization target
 *   2. Run the team optimizer (V1 or V2) once → get optimized artifact assignment
 *   3. Evaluate ALL carry formulas on the optimized build for comparison
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/optimizer-testbed.ts <account-export.json>
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/optimizer-testbed.ts --v1-only <file>
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/optimizer-testbed.ts --v2-only <file>
 *
 * Output:
 *   scripts/output/optimizer-v1-results.json
 *   scripts/output/optimizer-v2-results.json
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Side-effect barrel: registers all character/weapon/artifact implementations.
import "@/lib/team-comp/index";

import {
  convertGOODToAccountData,
  type GOODData,
} from "@/lib/account-data/goodConversion";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  TeamOptimizerOptions,
  TeamOptYield,
  TeamOptimizationResult,
  PerCharConfig,
} from "@/lib/team-comp/teamOptimizer";
import { runTeamOptimization as runV1 } from "@/lib/team-comp/teamOptimizer";
import { runTeamOptimization as runV2 } from "@/lib/team-comp/optimizerV2";
import { runTeamOptimization as runMona } from "@/lib/team-comp/optimizerMona";
import type {
  AccountData,
  ArtifactData,
  Build,
  CharacterData,
  GlobalStatWeights,
  Slot,
} from "@/data/types";
import type { CalcContext, CharCompConfig } from "@/lib/team-comp/types";
import { matchBuild, type BuildMatchResult } from "@/lib/account-data/artifactScore";
import { artifactsById } from "@/data/constants";

// ─── Build preset import ─────────────────────────────────────────────────────

import allBuildsJson from "@/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";

const presetBuilds = allBuildsJson.builds as Record<string, Build>;
const characterBuildIds = allBuildsJson.characterBuilds as Record<string, string[]>;

function getBuildsForChar(charId: string): Build[] {
  const ids = characterBuildIds[charId];
  if (!ids) return [];
  return ids.map((id) => presetBuilds[id]).filter((b): b is Build => !!b);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ArtifactConfig {
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
  targetEr: Record<string, number>;
  targetCr?: Record<string, number>;
  selectedFormula: { charId: string; formulaId: string } | null;
  optimizationResult: unknown;
  calcContext?: Partial<CalcContext>;
  reactionOverrides?: Record<string, unknown>;
  formulaMode?: "single" | "combo";
  combos?: unknown[];
  selectedCombo?: string | null;
  enemyElementAura?: string;
}

interface TeamCompData {
  teams: Team[];
  author?: string;
  description?: string;
}

interface FormulaResult {
  formulaId: string;
  labelEn: string;
  damage: number;
}

export interface TeamResult {
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  /** The formula used for optimization */
  optimizedFormulaId: string;
  /** Damage reported by the optimizer for the target formula */
  optimizedDamage: number;
  /** Time taken for the single optimization run */
  optimizeTimeSec: number;
  /** All carry formulas evaluated on the optimized build */
  formulaResults: FormulaResult[];
  error?: string;
  /** Per-character artifacts assigned by optimizer (charId -> slotKey -> artifactId) */
  artifactAssignment: Record<string, Record<string, string>>;
  failReasons: Record<string, string>;
}

interface TestbedOutput {
  algorithm: "v1" | "v2" | "mona";
  timestamp: string;
  accountFile: string;
  totalTeams: number;
  results: TeamResult[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_CALC_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  assumeCrit: false,
};

const DEFAULT_GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

/** ER targets: DPS always 1.0; teammates 1.5 for 5★ sets, 1.0 for 4★ sets */
const DPS_TARGET_ER = 1.0;
const TEAMMATE_TARGET_ER_5STAR = 1.5;
const TEAMMATE_TARGET_ER_4STAR = 1.0;

function getArtifactSetRarity(goalArt: ArtifactConfig | null | undefined): number {
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

function getTeammateTargetEr(goalArt: ArtifactConfig | null | undefined): number {
  return getArtifactSetRarity(goalArt) >= 5
    ? TEAMMATE_TARGET_ER_5STAR
    : TEAMMATE_TARGET_ER_4STAR;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function fmt(n: number): string {
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

function loadTeamPreset(): TeamCompData {
  const presetPath = resolve(
    "src/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json"
  );
  const raw = readFileSync(presetPath, "utf-8");
  const parsed = JSON.parse(raw);
  // Handle both Team[] and TeamCompData formats
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

function buildCharCompConfig(
  team: Team,
  index: number,
  accountData: AccountData
): CharCompConfig | null {
  const charId = team.characters[index];
  const weaponId = team.weapons[index];
  if (!charId || !weaponId) return null;

  // Resolve character level/constellation from account data
  const acctChar = accountData.characters.find(
    (c: CharacterData) => c.key === charId
  );

  // Check for level/constellation overrides in combatOpts
  const levelOverride = team.opts?.[`${charId}.overrideLevel`];
  const consOverride = team.opts?.[`${charId}.overrideConstellation`];

  const charLevel = levelOverride
    ? parseInt(levelOverride)
    : acctChar?.level ?? 90;
  const constellation =
    consOverride !== undefined
      ? parseInt(consOverride)
      : acctChar?.constellation ?? 0;

  // Resolve weapon refinement from account data
  let refinement = 1;
  if (acctChar?.weapon?.key === weaponId) {
    refinement = acctChar.weapon.refinement;
  } else {
    // Search all weapons in account
    const allWeapons = [
      ...accountData.extraWeapons,
      ...accountData.characters
        .map((c: CharacterData) => c.weapon)
        .filter((w): w is NonNullable<typeof w> => !!w),
    ];
    const matchingWeapon = allWeapons.find((w) => w.key === weaponId);
    if (matchingWeapon) refinement = matchingWeapon.refinement;
  }

  // Resolve artifact sets from team preset goal
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

function buildPerChar(
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

    // Resolve buildMatch from preset builds
    const acctChar = accountData.characters.find((c: CharacterData) => c.key === cid);
    const charArtifacts = (acctChar?.artifacts ?? {}) as Partial<Record<Slot, ArtifactData>>;
    const builds = getBuildsForChar(cid);
    const bm = builds.length > 0
      ? matchBuild(charArtifacts, builds, acctChar?.constellation ?? 0, DEFAULT_GLOBAL_CONFIG)
      : null;

    // DPS: 1.0 (no requirement). Teammates: 1.5 for 5★ sets, 1.0 for 4★ sets.
    // Ignore preset ER values — use rarity-based defaults.
    const targetEr = isDps ? DPS_TARGET_ER : getTeammateTargetEr(goalArt);
    perChar[cid] = {
      targetEr,
      targetCr: hasFavonius ? (team.targetCr?.[cid] ?? 0.05) : 0,
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

/** Get all formula IDs for the carry (first character) of a team. */
function getCarryFormulaIds(team: Team): { formulaId: string; label: string }[] {
  const configs: CharCompConfig[] = [];
  for (let i = 0; i < team.characters.length; i++) {
    const charId = team.characters[i];
    const weaponId = team.weapons[i];
    if (!charId || !weaponId) continue;
    // Minimal config — just enough to build TeamBuild for formula discovery
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
    const tb = new TeamBuild(configs, team.opts || {}, team.enemyElementAura as any);
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

export async function runOptimizerOnTeam(
  team: Team,
  accountData: AccountData,
  inventory: ArtifactData[],
  algorithm: "v1" | "v2" | "mona",
  timeoutMs: number = 120_000,
  perCharDeadlineMs?: number,
  /** If provided, optimize for this specific formula instead of picking the first */
  formulaIdOverride?: string,
  /** Max artifacts per slot for B&B pre-filtering (V2 only). 0 = no limit. */
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
    // Build configs
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
      team.enemyElementAura as any
    );

    const calcContext: CalcContext = {
      enemyLevel: team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      assumeCrit:
        team.calcContext?.assumeCrit ?? DEFAULT_CALC_CONTEXT.assumeCrit,
    };

    const baseSheets = buildBaseSheets(team, accountData);
    const perChar = buildPerChar(team, carryCharId, accountData);

    // Get all formulas for the carry character
    const allFormulas = teamBuild.getFormulaIds();
    const carryFormulas = allFormulas[carryCharId];
    if (!carryFormulas || Object.keys(carryFormulas).length === 0) {
      result.error = `No formulas found for carry ${carryCharId}`;
      return result;
    }

    // Pick target formula: override > selectedFormula > first formula
    const formulaEntries = Object.entries(carryFormulas);
    let targetFormulaId: string;
    if (formulaIdOverride && carryFormulas[formulaIdOverride]) {
      targetFormulaId = formulaIdOverride;
    } else {
      targetFormulaId = formulaEntries[0][0];
    }
    result.optimizedFormulaId = targetFormulaId;

    // ── Step 1: Run optimizer ONCE for the target formula ──
    const opts: TeamOptimizerOptions = {
      teamBuild,
      carryCharId,
      formulaId: targetFormulaId,
      inventory,
      calcContext,
      globalConfig: DEFAULT_GLOBAL_CONFIG,
      baseSheets,
      perChar,
      ...((algorithm === "v2") && timeoutMs > 0
        ? { teamDeadlineMs: performance.now() + timeoutMs }
        : (algorithm === "mona") && perCharDeadlineMs
          ? { perCharDeadlineMs }
          : {}),
      ...(maxArtsPerSlot ? { maxArtsPerSlot } : {}),
    };

    const runFn = algorithm === "v1" ? runV1 : algorithm === "v2" ? runV2 : runMona;
    const startTime = performance.now();

    let finalResult: TeamOptimizationResult | null = null;
    const gen = runFn(opts);
    for await (const yielded of gen) {
      if (yielded.done) {
        finalResult = yielded;
        break;
      }
      // Check timeout on each progress yield
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

    // Store artifact assignment
    for (const [cid, arts] of Object.entries(finalResult.bestArtifactsByChar)) {
      result.artifactAssignment[cid] = {};
      for (const [slot, art] of Object.entries(arts)) {
        if (art) {
          result.artifactAssignment[cid][slot] = art.id;
        }
      }
    }

    // Collect fail reasons
    if (finalResult.failReasons) {
      for (const [cid, reason] of Object.entries(finalResult.failReasons)) {
        result.failReasons[cid] = reason;
      }
    }

    // ── Step 2: Evaluate ALL carry formulas on the optimized build ──
    // Build artifact stat sheets from the optimized assignment
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

    // Evaluate each formula
    const postStats = optTeamBuild.getTeamStats(
      artifactStats,
      carryCharId,
      calcContext
    );

    for (const [formulaId, label] of formulaEntries) {
      try {
        const dmg = optTeamBuild.getDamageResult(
          carryCharId,
          formulaId,
          postStats,
          calcContext
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

// ─── Console Output ──────────────────────────────────────────────────────────

function printTeamProgress(
  teamIdx: number,
  totalTeams: number,
  team: Team,
  algorithm: string,
  teamResult: TeamResult
): void {
  const charIds = team.characters.filter((c): c is string => !!c);
  const teamLabel = team.name || charIds.join(" / ");

  if (teamResult.error) {
    console.log(
      `  ${C.red}[${algorithm}] ${teamIdx + 1}/${totalTeams} ${teamLabel}: ERROR - ${teamResult.error}${C.reset}`
    );
    return;
  }

  console.log(
    `  ${C.dim}[${algorithm}]${C.reset} ${teamIdx + 1}/${totalTeams} ${C.bold}${teamLabel}${C.reset} ` +
      `(${teamResult.optimizeTimeSec.toFixed(1)}s) ` +
      `opt: ${C.cyan}${fmt(teamResult.optimizedDamage)}${C.reset} [${teamResult.optimizedFormulaId}]`
  );
}

// ─── Parallel Worker Pool (child_process.fork) ───────────────────────────

async function runParallel(
  teams: Team[],
  algorithm: "v1" | "v2" | "mona",
  accountFile: string,
  timeoutSec: number,
  workerCount: number,
  onResult: (teamIdx: number, result: TeamResult) => void
): Promise<TeamResult[]> {
  const cp = await import("node:child_process");
  const workerScript = fileURLToPath(
    new URL("./optimizer-worker.ts", import.meta.url)
  );
  const numWorkers = Math.min(workerCount, teams.length);

  return new Promise<TeamResult[]>((resolveAll, rejectAll) => {
    const results: TeamResult[] = new Array(teams.length);
    let nextIdx = 0;
    let completed = 0;
    let rejected = false;
    const children: ReturnType<typeof cp.fork>[] = [];

    function dispatchNext(child: ReturnType<typeof cp.fork>): void {
      if (nextIdx < teams.length) {
        const idx = nextIdx++;
        const perCharMs =
          (algorithm === "v2" || algorithm === "mona") ? (timeoutSec * 1000) / 4 : undefined;
        child.send({
          type: "run",
          team: teams[idx],
          algorithm,
          timeoutMs: timeoutSec * 1000,
          perCharMs,
          teamIdx: idx,
        });
      }
    }

    function cleanup(): void {
      for (const c of children) {
        try {
          c.kill();
        } catch {}
      }
    }

    console.log(`  Spawning ${numWorkers} worker processes...`);

    // Inherit tsx's execArgv so children can handle TypeScript + path aliases
    const tsxExecArgv: string[] = [];
    for (let ai = 0; ai < process.execArgv.length; ai++) {
      const flag = process.execArgv[ai];
      if (flag === "--require" || flag === "--import") {
        tsxExecArgv.push(flag, process.execArgv[ai + 1]);
        ai++;
      }
    }

    for (let i = 0; i < numWorkers; i++) {
      const child = cp.fork(workerScript, [accountFile], {
        execArgv: tsxExecArgv,
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      });

      child.on(
        "message",
        (msg: { type: string; teamIdx?: number; result?: TeamResult }) => {
          if (msg.type === "ready") {
            dispatchNext(child);
          } else if (msg.type === "result" && msg.teamIdx !== undefined) {
            results[msg.teamIdx] = msg.result!;
            onResult(msg.teamIdx, msg.result!);
            completed++;
            if (completed === teams.length) {
              cleanup();
              resolveAll(results);
            } else {
              dispatchNext(child);
            }
          }
        }
      );

      child.on("error", (err) => {
        if (!rejected) {
          rejected = true;
          console.error(`Worker ${i} error:`, err);
          cleanup();
          rejectAll(err);
        }
      });

      child.on("exit", (code) => {
        if (code !== 0 && code !== null && !rejected && completed < teams.length) {
          rejected = true;
          console.error(`Worker ${i} exited with code ${code}`);
          cleanup();
          rejectAll(new Error(`Worker exited with code ${code}`));
        }
      });

      children.push(child);
    }
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

// Timeout is handled inside the optimizer runner via elapsed time checks.

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // Parse account file: skip flags and their values
  const flagsWithValue = new Set(["--limit", "--timeout", "--parallel", "--filter", "--max-arts"]);
  let accountFile: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      if (flagsWithValue.has(args[i])) i++; // skip value
      continue;
    }
    accountFile = args[i];
    break;
  }

  if (!accountFile) {
    console.log(
      "Usage: npx tsx --tsconfig tsconfig.scripts.json scripts/optimizer-testbed.ts <account-export.json>\n" +
        "Options: --v1-only  --v2-only  --mona-only  --combined  --per-formula  --limit N  --timeout SECS  --parallel N  --filter PATTERN  --max-arts N"
    );
    process.exit(0);
  }

  const onlyV1 = args.includes("--v1-only");
  const onlyV2 = args.includes("--v2-only");
  const onlyMona = args.includes("--mona-only");
  const perFormula = args.includes("--per-formula");
  const limitIdx = args.indexOf("--limit");
  const teamLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;
  const timeoutIdx = args.indexOf("--timeout");
  const perTeamTimeoutSec = timeoutIdx >= 0 ? parseInt(args[timeoutIdx + 1]) : 120;
  const parallelIdx = args.indexOf("--parallel");
  const parallelCount = parallelIdx >= 0 ? parseInt(args[parallelIdx + 1]) : 0;
  const maxArtsIdx = args.indexOf("--max-arts");
  const maxArtsPerSlot = maxArtsIdx >= 0 ? parseInt(args[maxArtsIdx + 1]) : 0;

  // Enable diagnostic logging
  if (args.includes("--diag")) {
    (globalThis as any).__TEAM_OPT_DIAG__ = true;
    (globalThis as any).__MONA_DEBUG__ = true;
  }

  console.log("Loading game stats...");
  await preloadGameStats();

  console.log("Loading account data...");
  const accountData = loadAccountData(resolve(accountFile));
  console.log(
    `  ${accountData.characters.length} characters, ` +
      `${getAllArtifacts(accountData).length} artifacts`
  );

  console.log("Loading team presets...");
  const teamPreset = loadTeamPreset();
  console.log(`  ${teamPreset.teams.length} teams`);

  const inventory = getAllArtifacts(accountData);
  const outputDir = resolve("scripts/output");
  mkdirSync(outputDir, { recursive: true });

  const onlyCombined = args.includes("--combined");
  const algorithms: ("v1" | "v2" | "mona" | "combined")[] = [];
  if (onlyV1) {
    algorithms.push("v1");
  } else if (onlyV2) {
    algorithms.push("v2");
  } else if (onlyMona) {
    algorithms.push("mona");
  } else if (onlyCombined) {
    algorithms.push("combined");
  } else {
    algorithms.push("v1", "v2", "mona");
  }

  const filterIdx = args.indexOf("--filter");
  const filterPattern = filterIdx >= 0 ? args[filterIdx + 1]?.toLowerCase() : undefined;
  let teamsToRun = teamPreset.teams.slice(0, teamLimit);
  if (filterPattern) {
    teamsToRun = teamsToRun.filter(
      (t) => t.name.toLowerCase().includes(filterPattern) ||
             t.characters.some((c) => c?.toLowerCase().includes(filterPattern))
    );
  }
  console.log(
    `Per-team timeout: ${perTeamTimeoutSec}s  |  Teams to run: ${teamsToRun.length}` +
      (parallelCount > 0 ? `  |  Parallel workers: ${parallelCount}` : "")
  );

  for (const algo of algorithms) {
    console.log(
      `\n${C.bold}═══ Running ${algo.toUpperCase()} optimizer on ${teamsToRun.length} teams ═══${C.reset}\n`
    );

    const output: TestbedOutput = {
      algorithm: algo,
      timestamp: new Date().toISOString(),
      accountFile,
      totalTeams: teamsToRun.length,
      results: [],
    };

    if (parallelCount > 0 && !perFormula) {
      // ── Parallel execution via worker_threads ──
      output.results = await runParallel(
        teamsToRun,
        algo,
        accountFile,
        perTeamTimeoutSec,
        parallelCount,
        (idx, result) =>
          printTeamProgress(idx, teamsToRun.length, teamsToRun[idx], algo, result)
      );
    } else if (perFormula) {
      // ── Per-formula mode: run optimizer once per formula per team ──
      let runIdx = 0;
      for (let i = 0; i < teamsToRun.length; i++) {
        const team = teamsToRun[i];
        const formulas = getCarryFormulaIds(team);
        if (formulas.length === 0) {
          console.log(`  ${C.dim}[${algo}]${C.reset} ${i + 1}/${teamsToRun.length} ${team.name || "?"}: no formulas`);
          continue;
        }
        for (const { formulaId, label } of formulas) {
          runIdx++;
          let teamResult: TeamResult;
          if (algo === "combined") {
            // Run V1 first (fast), then Mona, keep the best
            const v1Result = await runOptimizerOnTeam(
              team, accountData, inventory, "v1",
              perTeamTimeoutSec * 1000, undefined, formulaId
            );
            const monaPerChar = (perTeamTimeoutSec * 1000) / 4;
            const monaResult = await runOptimizerOnTeam(
              team, accountData, inventory, "mona",
              perTeamTimeoutSec * 1000, monaPerChar, formulaId
            );
            const v1Dmg = v1Result.error ? 0 : v1Result.optimizedDamage;
            const monaDmg = monaResult.error ? 0 : monaResult.optimizedDamage;
            teamResult = v1Dmg >= monaDmg ? v1Result : monaResult;
            teamResult.optimizeTimeSec = v1Result.optimizeTimeSec + monaResult.optimizeTimeSec;
          } else {
            const perCharMs =
              (algo === "v2" || algo === "mona") ? (perTeamTimeoutSec * 1000) / 4 : undefined;
            teamResult = await runOptimizerOnTeam(
              team, accountData, inventory, algo,
              perTeamTimeoutSec * 1000, perCharMs, formulaId, maxArtsPerSlot
            );
          }
          // Tag teamId with formula to keep entries unique
          teamResult.teamId = `${team.id}::${formulaId}`;
          teamResult.teamName = `${team.name || team.characters.filter(Boolean).join("/")} [${label}]`;

          output.results.push(teamResult);

          const charIds = team.characters.filter((c): c is string => !!c);
          const teamLabel = team.name || charIds.join(" / ");
          if (teamResult.error) {
            console.log(
              `  ${C.red}[${algo}] ${runIdx} ${teamLabel} → ${label}: ERROR - ${teamResult.error}${C.reset}`
            );
          } else {
            console.log(
              `  ${C.dim}[${algo}]${C.reset} ${runIdx} ${C.bold}${teamLabel}${C.reset} → ${label} ` +
                `(${teamResult.optimizeTimeSec.toFixed(1)}s) ` +
                `opt: ${C.cyan}${fmt(teamResult.optimizedDamage)}${C.reset}`
            );
          }
        }
      }
    } else {
      // ── Sequential execution ──
      for (let i = 0; i < teamsToRun.length; i++) {
        const team = teamsToRun[i];

        // For V2/Mona, set per-character deadline to 1/4 of total timeout (4 chars)
        const perCharMs =
          (algo === "v2" || algo === "mona") ? (perTeamTimeoutSec * 1000) / 4 : undefined;
        const teamResult = await runOptimizerOnTeam(
          team,
          accountData,
          inventory,
          algo,
          perTeamTimeoutSec * 1000,
          perCharMs,
          undefined,
          maxArtsPerSlot
        );

        output.results.push(teamResult);
        printTeamProgress(i, teamsToRun.length, team, algo, teamResult);
      }
    }

    const suffix = perFormula ? "-per-formula" : "";
    const outPath = resolve(outputDir, `optimizer-${algo}-results${suffix}.json`);
    writeFileSync(
      outPath,
      JSON.stringify(
        output,
        (_key, value) => {
          // Handle Sets that can't be serialized
          if (value instanceof Set) return [...value];
          return value;
        },
        2
      ),
      "utf-8"
    );
    console.log(`\n${C.green}Results written → ${outPath}${C.reset}`);
  }
}

// Only run main() when this file is the entry point (not when imported by worker)
const _thisFile = fileURLToPath(import.meta.url);
const _entryFile = process.argv[1];
if (_entryFile && resolve(_entryFile) === resolve(_thisFile)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
