#!/usr/bin/env tsx
/**
 * Optimizer Benchmark: Deterministic regression testing for the artifact optimizer.
 *
 * Uses frozen inventory data and tracks multiple solutions per problem. The goal
 * is to guarantee the optimizer always finds the best-known solution.
 *
 * Commands:
 *   init <account.json>       Copy account data to fixtures, generate problem list
 *   seed <results.json> ...   Import solutions from testbed result files
 *   run [options]             Run optimizer on all/filtered problems, compare & update
 *   verify                   Re-evaluate all stored solutions with current calc code
 *   status                   Show solution store summary
 *   refresh                  Re-import & cache problem configs from team presets
 *   enrich [options]         Generate solutions from backup algorithms (V1, etc.)
 *   compare --problem KEY    StatSheet diff between current result & best stored solution
 *   fuzz-combo               Fuzz-test AST combo vs evaluateCombo (all teams × all formulas)
 *
 * Common options:
 *   --filter PATTERN          Filter problems by team/char name
 *   --problem KEY             Run a single problem by key (teamId::formulaId)
 *   --timeout SECS            Per-team timeout (default: 30)
 *   --algo v1|v2|astar|mona|monaV2  Algorithm to run (default: v2)
 *   --parallel N              Run N problems in parallel (default: CPU cores - 4)
 *   --sequential              Disable parallelism (requires --filter or --problem)
 *   --max-arts N              Max artifacts per slot for B&B pre-filtering
 *   --diag                    Enable diagnostic logging
 *
 * Usage:
 *   npm run benchmark -- init account.json
 *   npm run benchmark -- run
 *   npm run benchmark -- run --problem "team-123::varka-normal" --diag
 *   npm run benchmark -- enrich --algo v1 --timeout 60
 *   npm run benchmark -- compare --problem varka-normal --algo v2
 */

import {
  type WriteStream,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import type { AccountData, ArtifactData, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import {
  getTargetMainStatsForSlot,
  scoreMainStat,
  scoreSlot,
} from "@/lib/account-data/artifactScore";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import {
  type CompiledTeamDamage,
  compileComboTeamDamage,
  fillVarsFromArtifacts,
  fillVarsFromSheet,
} from "@/lib/team-comp/calc/formulaCompiler";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  buildSheetFromMainAndSubs,
  getRollValues,
} from "@/lib/team-comp/generator/constrainedGreedy";
import { runCharacterBnB } from "@/lib/team-comp/optimizer";
import { detectEquippedSets } from "@/lib/team-comp/teamOptUtils";
import type {
  CalcContext,
  ComboFormula,
  StatKey,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import type { CharOptConfig } from "@/lib/team-comp/types";

import {
  C,
  type ConstraintViolation,
  DEFAULT_CALC_CONTEXT,
  DEFAULT_GLOBAL_CONFIG,
  type Team,
  type TeamResult,
  buildPerChar,
  buildTeamSlotConfig,
  fmt,
  getAllArtifacts,
  getCarryFormulaIds,
  getTeamCombo,
  loadAccountData,
  loadTeamPreset,
  preloadGameStats,
  runOptimizerOnTeam,
} from "./runner";

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = resolve("tests/benchmark/data");
const LOG_DIR = resolve(DATA_DIR, "logs");
const ACCOUNT_PATH = resolve(DATA_DIR, "account.json");
const SOLUTIONS_PATH = resolve(DATA_DIR, "solutions.json");
const PROBLEMS_PATH = resolve(DATA_DIR, "problems.json");

// ─── Log file tee ─────────────────────────────────────────────────────────────

let _logStream: WriteStream | null = null;

/** Start tee-ing console output to a timestamped log file. Returns the path. */
function startLogFile(command: string): string {
  mkdirSync(LOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logPath = resolve(LOG_DIR, `${command}_${ts}.log`);
  _logStream = createWriteStream(logPath, { flags: "a" });

  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    _logStream?.write(
      `${stripVTControlCharacters(args.map(String).join(" "))}\n`
    );
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    _logStream?.write(
      `[ERR] ${stripVTControlCharacters(args.map(String).join(" "))}\n`
    );
  };

  return logPath;
}

/** Close the log file stream. */
function stopLogFile(): void {
  _logStream?.end();
  _logStream = null;
}

interface Solution {
  /** charId -> slotKey -> artifactId */
  artifactAssignment: Record<string, Record<string, string>>;
  /** Damage when this solution was recorded */
  recordedDamage: number;
  /** ISO timestamp */
  foundAt: string;
  /** Algorithm that found it */
  algorithm: string;
  /** Time in seconds the optimizer took to reach this solution */
  solveTimeSec?: number;
}

interface Problem {
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  formulaId: string;
  /** All known solutions, newest last */
  solutions: Solution[];
}

interface SolutionStore {
  /** When account data was frozen */
  accountFrozenAt: string;
  /** Source account file name */
  sourceAccountFile: string;
  /** problemKey -> Problem */
  problems: Record<string, Problem>;
}

type RunComparison =
  | { status: "new_best"; damage: number }
  | { status: "matched_best"; damage: number; bestDamage: number }
  | { status: "regression"; damage: number; bestDamage: number; pct: number }
  | { status: "no_solutions"; damage: number }
  | { status: "infeasible"; damage: number; violations: ConstraintViolation[] }
  | {
      status: "damage_mismatch";
      damage: number;
      reportedDamage: number;
      delta: number;
    }
  | { status: "error"; message: string };

/** Pre-resolved problem config cached by `refresh`. */
interface CachedProblem {
  key: string;
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  formulaId: string;
  formulaLabel: string;
  configs: TeamSlotConfig[];
  combatOpts: Record<string, string>;
  enemyAura?: string;
  calcContext: CalcContext;
  perChar: Record<string, CharOptConfig>;
  /** Multi-line combo formula (only for combo problems). */
  combo?: ComboFormula;
}

interface ProblemCache {
  refreshedAt: string;
  problems: CachedProblem[];
}

// ─── Solution Store I/O ──────────────────────────────────────────────────────

function loadStore(): SolutionStore {
  if (existsSync(SOLUTIONS_PATH)) {
    return JSON.parse(readFileSync(SOLUTIONS_PATH, "utf-8")) as SolutionStore;
  }
  return {
    accountFrozenAt: "",
    sourceAccountFile: "",
    problems: {},
  };
}

function saveStore(store: SolutionStore): void {
  writeFileSync(SOLUTIONS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function loadProblemCache(): ProblemCache | null {
  if (!existsSync(PROBLEMS_PATH)) return null;
  return JSON.parse(readFileSync(PROBLEMS_PATH, "utf-8")) as ProblemCache;
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Re-evaluate an artifact assignment with current calc code.
 * Returns damage, or null if artifacts are missing.
 * When `combo` is provided, uses evaluateCombo for multi-line combo problems.
 */
function evaluateAssignment(
  team: Team,
  formulaId: string,
  assignment: Record<string, Record<string, string>>,
  accountData: AccountData,
  inventory: ArtifactData[],
  combo?: ComboFormula
): number | null {
  const artById = new Map<string, ArtifactData>();
  for (const a of inventory) artById.set(a.id, a);

  for (const slots of Object.values(assignment)) {
    for (const artId of Object.values(slots)) {
      if (!artById.has(artId)) return null;
    }
  }

  try {
    const configs: TeamSlotConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildTeamSlotConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }
    if (configs.length === 0) return null;

    // Detect actual equipped sets and override config when they differ.
    // Without this, solutions stored with off-set artifacts would be
    // evaluated with the team-config set bonuses, inflating damage.
    const artifactPieces: Record<string, ArtifactData[]> = {};
    for (const [cid, slots] of Object.entries(assignment)) {
      const pieces: ArtifactData[] = [];
      for (const artId of Object.values(slots)) {
        const art = artById.get(artId);
        if (art) pieces.push(art);
      }
      artifactPieces[cid] = pieces;
    }

    for (const cfg of configs) {
      const pieces = artifactPieces[cfg.charId];
      if (!pieces) continue;
      const detected = detectEquippedSets(pieces);
      cfg.artifactSetId = detected.artifactSetId;
      cfg.artifactHalfSetIds = detected.artifactHalfSetIds;
    }

    const teamBuild = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyAura as import("@/data/types").Element | undefined
    );

    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      rollMultiplier: DEFAULT_CALC_CONTEXT.rollMultiplier,
      substatBudget: DEFAULT_CALC_CONTEXT.substatBudget,
    };

    const carryCharId = team.characters[0]!;

    const artifactStats: Record<string, StatSheet> = {};
    for (const [cid, pieces] of Object.entries(artifactPieces)) {
      artifactStats[cid] = StatSheet.fromArtifacts(pieces);
    }

    // Always use evaluateCombo for consistency with the optimizer/runner path
    const effectiveCombo = combo ?? singleFormulaCombo(carryCharId, formulaId);

    // Validate formula exists before evaluating (evaluateCombo silently
    // returns 0 for missing formulas instead of throwing)
    if (!combo) {
      const allFormulas = teamBuild.getFormulaIds();
      const charFormulas = allFormulas[carryCharId];
      if (!charFormulas?.[formulaId]) return null;
    }

    return teamBuild.getComboDamageResult(
      effectiveCombo,
      artifactStats,
      calcContext
    ).totalDamage;
  } catch {
    return null;
  }
}

/**
 * Check whether an artifact assignment meets the team's minEr/minCr constraints.
 * Returns an array of violations (empty = all constraints met).
 */
function checkArtifactUniqueness(
  assignment: Record<string, Record<string, string>>
): string[] {
  const seen = new Map<string, string>(); // artId → charId
  const dupes: string[] = [];
  for (const [charId, slots] of Object.entries(assignment)) {
    for (const artId of Object.values(slots)) {
      const prev = seen.get(artId);
      if (prev) {
        dupes.push(`${artId} used by both ${prev} and ${charId}`);
      } else {
        seen.set(artId, charId);
      }
    }
  }
  return dupes;
}

function checkConstraints(
  team: Team,
  assignment: Record<string, Record<string, string>>,
  accountData: AccountData,
  inventory: ArtifactData[]
): ConstraintViolation[] {
  // Check artifact uniqueness first
  const dupes = checkArtifactUniqueness(assignment);
  if (dupes.length > 0) {
    return dupes.map((d) => ({
      kind: "er" as const,
      charId: `DUPLICATE: ${d}`,
      actual: 0,
      required: 1,
    }));
  }

  const artById = new Map<string, ArtifactData>();
  for (const a of inventory) artById.set(a.id, a);

  for (const slots of Object.values(assignment)) {
    for (const artId of Object.values(slots)) {
      if (!artById.has(artId)) return []; // can't check, treat as ok
    }
  }

  try {
    const configs: TeamSlotConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildTeamSlotConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }
    if (configs.length === 0) return [];

    // Detect actual equipped sets (same as evaluateAssignment)
    const artifactPieces: Record<string, ArtifactData[]> = {};
    for (const [cid, slots] of Object.entries(assignment)) {
      const pieces: ArtifactData[] = [];
      for (const artId of Object.values(slots)) {
        const art = artById.get(artId);
        if (art) pieces.push(art);
      }
      artifactPieces[cid] = pieces;
    }
    for (const cfg of configs) {
      const pieces = artifactPieces[cfg.charId];
      if (!pieces) continue;
      const detected = detectEquippedSets(pieces);
      cfg.artifactSetId = detected.artifactSetId;
      cfg.artifactHalfSetIds = detected.artifactHalfSetIds;
    }

    const teamBuild = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyAura as import("@/data/types").Element | undefined
    );

    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      rollMultiplier: DEFAULT_CALC_CONTEXT.rollMultiplier,
      substatBudget: DEFAULT_CALC_CONTEXT.substatBudget,
    };

    const carryCharId = team.characters[0]!;

    const artifactStats: Record<string, StatSheet> = {};
    for (const [cid, pieces] of Object.entries(artifactPieces)) {
      artifactStats[cid] = StatSheet.fromArtifacts(pieces);
    }

    const postStats = teamBuild.getTeamStats(
      artifactStats,
      carryCharId,
      calcContext
    );

    const perChar = buildPerChar(team, carryCharId, accountData);
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

    return violations;
  } catch {
    return [];
  }
}

function assignmentsEqual(
  a: Record<string, Record<string, string>>,
  b: Record<string, Record<string, string>>
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    const aSlots = a[aKeys[i]];
    const bSlots = b[bKeys[i]];
    const aSlotKeys = Object.keys(aSlots).sort();
    const bSlotKeys = Object.keys(bSlots).sort();
    if (aSlotKeys.length !== bSlotKeys.length) return false;
    for (let j = 0; j < aSlotKeys.length; j++) {
      if (aSlotKeys[j] !== bSlotKeys[j]) return false;
      if (aSlots[aSlotKeys[j]] !== bSlots[bSlotKeys[j]]) return false;
    }
  }
  return true;
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

interface BenchmarkContext {
  store: SolutionStore;
  accountData: AccountData;
  inventory: ArtifactData[];
  artById: Map<string, ArtifactData>;
  teams: Team[];
  teamById: Map<string, Team>;
}

async function loadContext(): Promise<BenchmarkContext> {
  if (!existsSync(ACCOUNT_PATH)) {
    console.error(`${C.red}No account fixture. Run 'init' first.${C.reset}`);
    process.exit(1);
  }
  await preloadGameStats();
  const store = loadStore();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);
  const artById = new Map<string, ArtifactData>();
  for (const a of inventory) artById.set(a.id, a);
  const teamPreset = loadTeamPreset();
  const teams = teamPreset.teams;
  const teamById = new Map<string, Team>();
  for (const t of teams) teamById.set(t.id, t);
  return { store, accountData, inventory, artById, teams, teamById };
}

/** Resolve the combo for a problem — returns the ComboFormula if it's a combo problem. */
function resolveCombo(formulaId: string, team: Team): ComboFormula | undefined {
  if (formulaId === "__combo__") return getTeamCombo(team) ?? undefined;
  return undefined;
}

function findBestSolution(
  problem: Problem,
  team: Team,
  accountData: AccountData,
  inventory: ArtifactData[]
): { bestSol: Solution | null; bestDamage: number } {
  let bestSol: Solution | null = null;
  let bestDamage = Number.NEGATIVE_INFINITY;
  const combo = resolveCombo(problem.formulaId, team);
  for (const sol of problem.solutions) {
    const dmg = evaluateAssignment(
      team,
      problem.formulaId,
      sol.artifactAssignment,
      accountData,
      inventory,
      combo
    );
    if (dmg !== null && dmg > bestDamage) {
      bestDamage = dmg;
      bestSol = sol;
    }
  }
  return { bestSol, bestDamage };
}

interface StoreSolutionResult {
  stored: boolean;
  duplicate: boolean;
  constraintViolations: ConstraintViolation[];
}

/**
 * Validate constraints and store a solution if it passes.
 * All code paths that store solutions MUST use this function to ensure
 * consistent constraint enforcement across all algorithms.
 */
function tryStoreSolution(
  store: SolutionStore,
  key: string,
  team: Team,
  formulaId: string,
  assignment: Record<string, Record<string, string>>,
  damage: number,
  algorithm: string,
  accountData: AccountData,
  inventory: ArtifactData[],
  opts?: {
    solveTimeSec?: number;
    foundAt?: string;
    teamName?: string;
  }
): StoreSolutionResult {
  if (!assignment || Object.keys(assignment).length === 0 || damage <= 0) {
    return { stored: false, duplicate: false, constraintViolations: [] };
  }

  const violations = checkConstraints(team, assignment, accountData, inventory);
  if (violations.length > 0) {
    return {
      stored: false,
      duplicate: false,
      constraintViolations: violations,
    };
  }

  if (!store.problems[key]) {
    const charIds = team.characters.filter((c): c is string => !!c);
    store.problems[key] = {
      teamId: team.id,
      teamName: opts?.teamName ?? charIds.join("/"),
      characters: charIds,
      carryCharId: team.characters[0]!,
      formulaId,
      solutions: [],
    };
  }

  const existing = store.problems[key].solutions;
  if (
    existing.some((s) => assignmentsEqual(s.artifactAssignment, assignment))
  ) {
    return { stored: false, duplicate: true, constraintViolations: [] };
  }

  const sol: Solution = {
    artifactAssignment: assignment,
    recordedDamage: damage,
    foundAt: opts?.foundAt ?? new Date().toISOString(),
    algorithm,
  };
  if (opts?.solveTimeSec !== undefined) {
    sol.solveTimeSec = opts.solveTimeSec;
  }
  existing.push(sol);
  return { stored: true, duplicate: false, constraintViolations: [] };
}

function logConstraintViolations(
  violations: ConstraintViolation[],
  indent = "    "
): void {
  for (const v of violations) {
    if (v.charId.startsWith("DUPLICATE:")) {
      console.log(
        `${indent}${C.red}[DUPLICATE]${C.reset} ${v.charId.slice(11)}`
      );
    } else {
      const label = v.kind === "er" ? "ER" : "CR";
      console.log(
        `${indent}${C.red}[CONSTRAINT FAIL]${C.reset} ${v.charId}: ${label} = ${(v.actual * 100).toFixed(1)}% < required ${(v.required * 100).toFixed(1)}%`
      );
    }
  }
}

// ─── Parallel Worker Pool ────────────────────────────────────────────────────

async function runParallel(
  tasks: { team: Team; formulaId: string; key: string; combo?: ComboFormula }[],
  algorithm: "v1" | "v2" | "astar" | "mona" | "monaV2",
  timeoutSec: number,
  workerCount: number,
  maxArtsPerSlot: number,
  diag: boolean,
  onResult: (taskIdx: number, result: TeamResult) => void,
  lagrangian?: boolean
): Promise<TeamResult[]> {
  const cp = await import("node:child_process");
  const workerScript = fileURLToPath(new URL("./worker.ts", import.meta.url));
  const numWorkers = Math.min(workerCount, tasks.length);

  return new Promise<TeamResult[]>((resolveAll, rejectAll) => {
    const results: TeamResult[] = new Array(tasks.length);
    let nextIdx = 0;
    let completed = 0;
    let rejected = false;
    const children: ReturnType<typeof cp.fork>[] = [];

    function dispatchNext(child: ReturnType<typeof cp.fork>): void {
      if (nextIdx < tasks.length) {
        const idx = nextIdx++;
        const { team, formulaId, combo } = tasks[idx];
        const perCharMs =
          algorithm !== "v1" ? (timeoutSec * 1000) / 4 : undefined;
        child.send({
          type: "run",
          team,
          algorithm,
          timeoutMs: timeoutSec * 1000,
          perCharMs,
          maxArtsPerSlot: maxArtsPerSlot || undefined,
          formulaIdOverride: formulaId,
          combo,
          teamIdx: idx,
          lagrangian: lagrangian || undefined,
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

    const workerArgs = [ACCOUNT_PATH];
    if (diag) workerArgs.push("--diag");

    for (let i = 0; i < numWorkers; i++) {
      const child = cp.fork(workerScript, workerArgs, {
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
            if (completed === tasks.length) {
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
        if (
          code !== 0 &&
          code !== null &&
          !rejected &&
          completed < tasks.length
        ) {
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

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdInit(accountFile: string): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });

  console.log(`Copying account data → ${ACCOUNT_PATH}`);
  copyFileSync(resolve(accountFile), ACCOUNT_PATH);

  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);
  console.log(
    `  ${accountData.characters.length} characters, ${inventory.length} artifacts`
  );

  const teamPreset = loadTeamPreset();
  let problemCount = 0;
  for (const team of teamPreset.teams) {
    const formulas = getCarryFormulaIds(team);
    problemCount += formulas.length;
  }
  console.log(`  ${teamPreset.teams.length} teams, ${problemCount} problems`);

  if (!existsSync(SOLUTIONS_PATH)) {
    const store: SolutionStore = {
      accountFrozenAt: new Date().toISOString(),
      sourceAccountFile: basename(accountFile),
      problems: {},
    };
    saveStore(store);
    console.log("  Created empty solution store");
  } else {
    console.log(
      `  Solution store already exists (${Object.keys(loadStore().problems).length} problems)`
    );
  }

  console.log(
    `\n${C.green}Done. Run 'seed' to import existing results, then 'run' to benchmark.${C.reset}`
  );
}

async function cmdSeed(resultFiles: string[]): Promise<void> {
  const { store, accountData, inventory, teamById } = await loadContext();

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;
  let constraintFails = 0;

  for (const file of resultFiles) {
    console.log(`Reading ${basename(file)}...`);
    const data = JSON.parse(readFileSync(resolve(file), "utf-8"));
    const results: TeamResult[] = data.results ?? [];
    const algo = data.algorithm ?? "v2";

    for (const r of results) {
      let baseTeamId: string;
      let formulaId: string;
      if (r.teamId.includes("::")) {
        const lastSep = r.teamId.lastIndexOf("::");
        baseTeamId = r.teamId.substring(0, lastSep);
        formulaId = r.teamId.substring(lastSep + 2);
      } else {
        baseTeamId = r.teamId;
        formulaId = r.optimizedFormulaId;
      }

      const problemKey = `${baseTeamId}::${formulaId}`;
      const team = teamById.get(baseTeamId);
      if (!team) {
        skipped++;
        continue;
      }

      const result = tryStoreSolution(
        store,
        problemKey,
        team,
        formulaId,
        r.artifactAssignment,
        r.optimizedDamage,
        algo,
        accountData,
        inventory,
        {
          foundAt: data.timestamp ?? new Date().toISOString(),
          teamName:
            r.teamName?.replace(/ \[.*\]$/, "") ?? r.characters.join("/"),
        }
      );

      if (result.duplicate) {
        duplicates++;
      } else if (result.constraintViolations.length > 0) {
        constraintFails++;
        for (const v of result.constraintViolations) {
          const label = v.kind === "er" ? "ER" : "CR";
          console.log(
            `  ${C.red}[CONSTRAINT]${C.reset} ${problemKey}: ${v.charId} ${label} = ${(v.actual * 100).toFixed(1)}% < ${(v.required * 100).toFixed(1)}%`
          );
        }
      } else if (result.stored) {
        imported++;
      } else {
        skipped++;
      }
    }
  }

  saveStore(store);
  console.log(
    `\n${C.green}Imported ${imported} solutions${C.reset} (${duplicates} duplicates, ${skipped} skipped` +
      `${constraintFails > 0 ? `, ${C.red}${constraintFails} constraint violations rejected${C.reset}` : ""})`
  );
  console.log(
    `Solution store: ${Object.keys(store.problems).length} problems, ` +
      `${Object.values(store.problems).reduce((s, p) => s + p.solutions.length, 0)} total solutions`
  );
}

async function cmdVerify(): Promise<void> {
  const { store, accountData, inventory, teamById } = await loadContext();

  let totalSolutions = 0;
  let verified = 0;
  let invalid = 0;
  let calcChanges = 0;
  let unchanged = 0;
  const changes: {
    key: string;
    idx: number;
    recorded: number;
    current: number;
  }[] = [];

  const problemKeys = Object.keys(store.problems).sort();
  console.log(`Verifying ${problemKeys.length} problems...\n`);

  for (const key of problemKeys) {
    const problem = store.problems[key];
    const team = teamById.get(problem.teamId);
    if (!team) {
      console.log(`  ${C.yellow}SKIP${C.reset} ${key}: team not in presets`);
      continue;
    }

    const combo = resolveCombo(problem.formulaId, team);
    for (let si = 0; si < problem.solutions.length; si++) {
      totalSolutions++;
      const sol = problem.solutions[si];
      const dmg = evaluateAssignment(
        team,
        problem.formulaId,
        sol.artifactAssignment,
        accountData,
        inventory,
        combo
      );

      if (dmg === null) {
        invalid++;
        console.log(
          `  ${C.red}INVALID${C.reset} ${key} [${si}]: artifacts missing`
        );
        continue;
      }

      verified++;
      const pctDiff = Math.abs(dmg - sol.recordedDamage) / sol.recordedDamage;
      if (pctDiff > 0.001) {
        calcChanges++;
        changes.push({
          key,
          idx: si,
          recorded: sol.recordedDamage,
          current: dmg,
        });
        sol.recordedDamage = dmg;
      } else {
        unchanged++;
      }
    }
  }

  if (calcChanges > 0) {
    saveStore(store);
  }

  console.log(`\n${C.bold}═══ Verification Summary ═══${C.reset}\n`);
  console.log(`  Total solutions:  ${totalSolutions}`);
  console.log(`  Verified:         ${verified}`);
  console.log(
    `  Invalid:          ${invalid > 0 ? C.red : ""}${invalid}${invalid > 0 ? C.reset : ""}`
  );
  console.log(`  Unchanged:        ${unchanged}`);
  console.log(
    `  Calc changes:     ${calcChanges > 0 ? C.yellow : ""}${calcChanges}${calcChanges > 0 ? C.reset : ""}`
  );

  if (changes.length > 0) {
    console.log(
      `\n  ${C.yellow}Calc changes (recorded damage updated):${C.reset}`
    );
    for (const ch of changes) {
      const pct = (((ch.current - ch.recorded) / ch.recorded) * 100).toFixed(2);
      console.log(
        `    ${ch.key} [${ch.idx}]: ${fmt(ch.recorded)} → ${fmt(ch.current)} (${pct}%)`
      );
    }
  }
}

async function cmdPurgeInvalid(): Promise<void> {
  const { store, accountData, inventory, teamById } = await loadContext();

  let totalSolutions = 0;
  let purged = 0;
  let kept = 0;
  let skipped = 0;
  const purgedList: {
    key: string;
    idx: number;
    algorithm: string;
    violations: ConstraintViolation[];
  }[] = [];

  const problemKeys = Object.keys(store.problems).sort();
  console.log(
    `\n${C.bold}═══ Purging solutions that violate minEr/minCr ═══${C.reset}\n`
  );
  console.log(`Checking ${problemKeys.length} problems...\n`);

  for (const key of problemKeys) {
    const problem = store.problems[key];
    const team = teamById.get(problem.teamId);
    if (!team) {
      skipped += problem.solutions.length;
      continue;
    }

    const validSolutions: Solution[] = [];
    for (let si = 0; si < problem.solutions.length; si++) {
      totalSolutions++;
      const sol = problem.solutions[si];
      const violations = checkConstraints(
        team,
        sol.artifactAssignment,
        accountData,
        inventory
      );

      if (violations.length > 0) {
        purged++;
        purgedList.push({
          key,
          idx: si,
          algorithm: sol.algorithm,
          violations,
        });
        for (const v of violations) {
          if (v.charId.startsWith("DUPLICATE:")) {
            console.log(
              `  ${C.red}PURGE${C.reset} ${key} [${si}] (${sol.algorithm}): ${v.charId.slice(11)}`
            );
          } else {
            const label = v.kind === "er" ? "ER" : "CR";
            console.log(
              `  ${C.red}PURGE${C.reset} ${key} [${si}] (${sol.algorithm}): ` +
                `${v.charId} ${label} = ${(v.actual * 100).toFixed(1)}% < required ${(v.required * 100).toFixed(1)}%`
            );
          }
        }
      } else {
        kept++;
        validSolutions.push(sol);
      }
    }
    problem.solutions = validSolutions;
  }

  if (purged > 0) {
    saveStore(store);
  }

  console.log(`\n${C.bold}═══ Purge Summary ═══${C.reset}\n`);
  console.log(`  Total solutions:  ${totalSolutions}`);
  console.log(`  Kept:             ${C.green}${kept}${C.reset}`);
  console.log(
    `  Purged:           ${purged > 0 ? C.red : ""}${purged}${purged > 0 ? C.reset : ""}`
  );
  if (skipped > 0) {
    console.log(`  Skipped (no team): ${skipped}`);
  }
}

async function cmdRun(opts: {
  filter?: string;
  problemKey?: string;
  timeoutSec: number;
  algo: "v1" | "v2" | "astar" | "mona" | "monaV2";
  parallel: number;
  maxArtsPerSlot: number;
  diag: boolean;
  lagrangian: boolean;
}): Promise<void> {
  const logPath = startLogFile("run");
  console.log(`Log file: ${logPath}`);

  if (opts.diag) {
    (globalThis as unknown as Record<string, boolean>).__TEAM_OPT_DIAG__ = true;
  }

  const { store, accountData, inventory, teams, teamById } =
    await loadContext();

  // Build problem list
  type ProblemRun = {
    key: string;
    team: Team;
    formulaId: string;
    label: string;
    combo?: ComboFormula;
  };
  const problemsToRun: ProblemRun[] = [];

  if (opts.problemKey) {
    const problem = store.problems[opts.problemKey];
    if (!problem) {
      const matches = Object.keys(store.problems).filter((k) =>
        k.includes(opts.problemKey!)
      );
      if (matches.length === 0) {
        console.error(
          `${C.red}Problem not found: ${opts.problemKey}${C.reset}`
        );
        console.log("Available problems:");
        for (const k of Object.keys(store.problems).slice(0, 20)) {
          console.log(`  ${k}`);
        }
        process.exit(1);
      }
      for (const k of matches) {
        const p = store.problems[k];
        const team = teamById.get(p.teamId);
        if (team) {
          problemsToRun.push({
            key: k,
            team,
            formulaId: p.formulaId,
            label: p.teamName,
            combo: resolveCombo(p.formulaId, team),
          });
        }
      }
    } else {
      const team = teamById.get(problem.teamId);
      if (!team) {
        console.error(
          `${C.red}Team not in presets: ${problem.teamId}${C.reset}`
        );
        process.exit(1);
      }
      problemsToRun.push({
        key: opts.problemKey,
        team,
        formulaId: problem.formulaId,
        label: problem.teamName,
        combo: resolveCombo(problem.formulaId, team),
      });
    }
  } else {
    const matchesFilter = (key: string, team: Team) =>
      !opts.filter ||
      key.toLowerCase().includes(opts.filter.toLowerCase()) ||
      team.name?.toLowerCase().includes(opts.filter.toLowerCase()) ||
      team.characters.some((c) =>
        c?.toLowerCase().includes(opts.filter!.toLowerCase())
      );

    for (const team of teams) {
      const formulas = getCarryFormulaIds(team);
      for (const { formulaId, label } of formulas) {
        const key = `${team.id}::${formulaId}`;
        if (!matchesFilter(key, team)) continue;
        problemsToRun.push({ key, team, formulaId, label });
      }

      // Add combo problem if team has multi-line default combo
      const teamCombo = getTeamCombo(team);
      if (teamCombo) {
        const comboKey = `${team.id}::__combo__`;
        if (!matchesFilter(comboKey, team)) continue;
        problemsToRun.push({
          key: comboKey,
          team,
          formulaId: "__combo__",
          label: "Combo",
          combo: teamCombo,
        });
      }
    }
  }

  console.log(
    `\n${C.bold}═══ Running ${opts.algo.toUpperCase()} on ${problemsToRun.length} problems (${opts.timeoutSec}s timeout${opts.parallel > 0 ? `, ${opts.parallel} workers` : ""}) ═══${C.reset}\n`
  );

  // Stats
  let newBests = 0;
  let matched = 0;
  let regressions = 0;
  let noSolutions = 0;
  let errors = 0;
  let constraintFails = 0;
  let damageMismatches = 0;
  const regList: {
    key: string;
    comp: RunComparison & { status: "regression" };
  }[] = [];
  const constraintFailList: { key: string; formulaId: string }[] = [];
  const damageMismatchList: {
    key: string;
    comp: RunComparison & { status: "damage_mismatch" };
  }[] = [];
  const newBestList: {
    key: string;
    comp: RunComparison & { status: "new_best" };
  }[] = [];

  function processResult(
    ri: number,
    key: string,
    team: Team,
    formulaId: string,
    result: TeamResult
  ): void {
    if (result.error) {
      errors++;
      console.log(
        `  ${C.red}[ERR]${C.reset} ${ri + 1}/${problemsToRun.length} ${team.characters.filter(Boolean).join("/")} → ${formulaId}: ${result.error}`
      );
      return;
    }

    const authoritativeDamage = evaluateAssignment(
      team,
      formulaId,
      result.artifactAssignment,
      accountData,
      inventory,
      resolveCombo(formulaId, team)
    );
    if (authoritativeDamage == null) {
      errors++;
      console.log(
        `  ${C.red}[ERR]${C.reset} ${ri + 1}/${problemsToRun.length} ${team.characters.filter(Boolean).join("/")} → ${formulaId}: failed to re-evaluate returned assignment`
      );
      return;
    }

    const violations = checkConstraints(
      team,
      result.artifactAssignment,
      accountData,
      inventory
    );
    if (violations.length > 0) {
      constraintFails++;
      constraintFailList.push({ key, formulaId });
      console.log(
        `  ${C.red}INF${C.reset} ${ri + 1}/${problemsToRun.length} ${C.bold}${team.characters.filter(Boolean).join("/")}${C.reset} → ${formulaId} ` +
          `(${result.optimizeTimeSec.toFixed(1)}s) ${C.cyan}${fmt(authoritativeDamage)}${C.reset} ${C.red}INFEASIBLE${C.reset}`
      );
      logConstraintViolations(violations, "    ");
      return;
    }

    const damageDelta = authoritativeDamage - result.optimizedDamage;
    const hasDamageMismatch = Math.abs(damageDelta) > 0.5;
    if (hasDamageMismatch) {
      damageMismatches++;
      damageMismatchList.push({
        key,
        comp: {
          status: "damage_mismatch",
          damage: authoritativeDamage,
          reportedDamage: result.optimizedDamage,
          delta: damageDelta,
        },
      });
    }

    const problem = store.problems[key];
    let comp: RunComparison;

    if (!problem || problem.solutions.length === 0) {
      comp = { status: "no_solutions", damage: authoritativeDamage };
    } else {
      const { bestDamage } = findBestSolution(
        problem,
        team,
        accountData,
        inventory
      );

      if (bestDamage <= 0) {
        comp = { status: "no_solutions", damage: authoritativeDamage };
      } else if (authoritativeDamage > bestDamage + 0.5) {
        comp = { status: "new_best", damage: authoritativeDamage };
      } else if (authoritativeDamage >= bestDamage - 0.5) {
        comp = {
          status: "matched_best",
          damage: authoritativeDamage,
          bestDamage,
        };
      } else {
        const pct = ((authoritativeDamage - bestDamage) / bestDamage) * 100;
        comp = {
          status: "regression",
          damage: authoritativeDamage,
          bestDamage,
          pct,
        };
      }
    }

    const charNames = team.characters.filter(Boolean).join("/");
    const statusIcon = hasDamageMismatch
      ? `${C.red}!${C.reset}`
      : comp.status === "new_best"
        ? `${C.green}*${C.reset}`
        : comp.status === "matched_best"
          ? `${C.green}ok${C.reset}`
          : comp.status === "regression"
            ? `${C.red}X${C.reset}`
            : `${C.cyan}+${C.reset}`;

    const timeStr = `${result.optimizeTimeSec.toFixed(1)}s`;
    let extraInfo = "";
    if (comp.status === "regression") {
      extraInfo = ` ${C.red}(${comp.pct.toFixed(2)}% vs best ${fmt(comp.bestDamage)})${C.reset}`;
    } else if (comp.status === "new_best") {
      extraInfo = ` ${C.green}NEW BEST${C.reset}`;
    }

    // Compare solve time against best stored solution's time
    const existingSolutions = store.problems[key]?.solutions ?? [];
    const bestTime = existingSolutions.reduce((min, s) => {
      if (s.solveTimeSec != null && s.solveTimeSec < min) return s.solveTimeSec;
      return min;
    }, Number.POSITIVE_INFINITY);
    if (
      bestTime < Number.POSITIVE_INFINITY &&
      result.optimizeTimeSec > bestTime * 1.5
    ) {
      const ratio = result.optimizeTimeSec / bestTime;
      extraInfo += ` ${C.yellow}${ratio.toFixed(1)}x slower${C.reset}`;
    }
    if (hasDamageMismatch) {
      extraInfo +=
        ` ${C.red}DMG MISMATCH${C.reset}` +
        ` ${C.dim}[reported ${fmt(result.optimizedDamage)}, recalculated ${fmt(authoritativeDamage)}, delta ${damageDelta >= 0 ? "+" : ""}${fmt(damageDelta)}]${C.reset}`;
    }

    console.log(
      `  ${statusIcon} ${ri + 1}/${problemsToRun.length} ${C.bold}${charNames}${C.reset} → ${formulaId} ` +
        `(${timeStr}) ${C.cyan}${fmt(authoritativeDamage)}${C.reset}${extraInfo}`
    );

    switch (comp.status) {
      case "new_best":
        newBests++;
        newBestList.push({ key, comp });
        break;
      case "matched_best":
        matched++;
        break;
      case "regression":
        regressions++;
        regList.push({ key, comp });
        break;
      case "no_solutions":
        noSolutions++;
        break;
    }

    // Validate constraints and store solution (uniform across all algorithms)
    const storeResult = tryStoreSolution(
      store,
      key,
      team,
      formulaId,
      result.artifactAssignment,
      authoritativeDamage,
      opts.algo,
      accountData,
      inventory,
      { solveTimeSec: result.optimizeTimeSec }
    );

    if (storeResult.constraintViolations.length > 0) {
      logConstraintViolations(storeResult.constraintViolations);
      constraintFails++;
      constraintFailList.push({ key, formulaId });
    }
  }

  if (opts.parallel > 0) {
    // Parallel execution
    const tasks = problemsToRun.map((p) => ({
      team: p.team,
      formulaId: p.formulaId,
      key: p.key,
      combo: p.combo,
    }));
    const results = await runParallel(
      tasks,
      opts.algo,
      opts.timeoutSec,
      opts.parallel,
      opts.maxArtsPerSlot,
      opts.diag,
      (idx, result) => {
        const { key, team, formulaId } = problemsToRun[idx];
        processResult(idx, key, team, formulaId, result);
      },
      opts.lagrangian || undefined
    );
  } else {
    // Sequential execution
    for (let ri = 0; ri < problemsToRun.length; ri++) {
      const { key, team, formulaId, combo } = problemsToRun[ri];
      const result = await runOptimizerOnTeam(
        team,
        accountData,
        inventory,
        opts.algo,
        opts.timeoutSec * 1000,
        opts.algo !== "v1" ? (opts.timeoutSec * 1000) / 4 : undefined,
        formulaId,
        opts.maxArtsPerSlot || undefined,
        combo,
        opts.lagrangian || undefined
      );
      processResult(ri, key, team, formulaId, result);
    }
  }

  saveStore(store);

  // ── Retry regressions sequentially with 2× timeout ──
  // Parallel runs can miss optimal solutions due to CPU contention.
  // Retry each regression with dedicated CPU time before reporting failure.
  if (regList.length > 0 && opts.parallel > 0) {
    const retryTimeout = opts.timeoutSec * 2;
    console.log(
      `\n${C.bold}═══ Retrying ${regList.length} regression(s) sequentially (${retryTimeout}s timeout) ═══${C.reset}\n`
    );

    const confirmedRegs: typeof regList = [];
    for (const reg of regList) {
      const { key } = reg;
      const problem = store.problems[key];
      const team = teamById.get(problem.teamId);
      if (!team) {
        confirmedRegs.push(reg);
        continue;
      }
      const retryResult = await runOptimizerOnTeam(
        team,
        accountData,
        inventory,
        opts.algo,
        retryTimeout * 1000,
        opts.algo !== "v1" ? (retryTimeout * 1000) / 4 : undefined,
        problem.formulaId,
        opts.maxArtsPerSlot || undefined,
        resolveCombo(problem.formulaId, team),
        opts.lagrangian || undefined
      );
      const retryDamage = evaluateAssignment(
        team,
        problem.formulaId,
        retryResult.artifactAssignment,
        accountData,
        inventory,
        resolveCombo(problem.formulaId, team)
      );
      if (retryDamage == null) {
        console.log(
          `  ${C.red}[ERR]${C.reset} ${key} → failed to re-evaluate returned assignment`
        );
        confirmedRegs.push(reg);
        continue;
      }

      const { bestDamage } = findBestSolution(
        problem,
        team,
        accountData,
        inventory
      );
      if (retryDamage >= bestDamage - 0.5) {
        console.log(
          `  ${C.green}ok${C.reset} ${key} → ${fmt(retryDamage)} ` +
            `(was ${fmt(reg.comp.damage)}, recovered in ${retryResult.optimizeTimeSec.toFixed(1)}s)`
        );
        matched++;
        regressions--;

        const storeResult = tryStoreSolution(
          store,
          key,
          team,
          problem.formulaId,
          retryResult.artifactAssignment,
          retryDamage,
          opts.algo,
          accountData,
          inventory,
          { solveTimeSec: retryResult.optimizeTimeSec }
        );
        if (storeResult.constraintViolations.length > 0) {
          logConstraintViolations(storeResult.constraintViolations);
        }
      } else if (retryDamage > bestDamage) {
        console.log(
          `  ${C.green}*${C.reset} ${key} → ${fmt(retryDamage)} ${C.green}NEW BEST${C.reset}`
        );
        newBests++;
        regressions--;
        newBestList.push({
          key,
          comp: {
            status: "new_best" as const,
            damage: retryDamage,
          },
        });

        const storeResult = tryStoreSolution(
          store,
          key,
          team,
          problem.formulaId,
          retryResult.artifactAssignment,
          retryDamage,
          opts.algo,
          accountData,
          inventory,
          { solveTimeSec: retryResult.optimizeTimeSec }
        );
        if (storeResult.constraintViolations.length > 0) {
          logConstraintViolations(storeResult.constraintViolations);
        }
      } else {
        const pct = ((retryDamage - bestDamage) / bestDamage) * 100;
        console.log(
          `  ${C.red}X${C.reset} ${key} → ${fmt(retryDamage)} ` +
            `(${pct.toFixed(2)}% vs best ${fmt(bestDamage)}, confirmed)`
        );
        confirmedRegs.push({
          key,
          comp: {
            status: "regression" as const,
            damage: retryDamage,
            bestDamage,
            pct,
          },
        });
      }
    }
    regList.length = 0;
    regList.push(...confirmedRegs);
    saveStore(store);
  }

  // ── Retry constraint failures sequentially with 2× timeout ──
  // Tight ER/CR constraints can fail under CPU contention — retry with dedicated time.
  if (constraintFailList.length > 0 && opts.parallel > 0) {
    const retryTimeout = opts.timeoutSec * 2;
    console.log(
      `\n${C.bold}═══ Retrying ${constraintFailList.length} constraint failure(s) sequentially (${retryTimeout}s timeout) ═══${C.reset}\n`
    );

    const stillFailing: typeof constraintFailList = [];
    for (const cf of constraintFailList) {
      const problem = store.problems[cf.key];
      const team = teamById.get(problem?.teamId ?? "");
      if (!team || !problem) {
        stillFailing.push(cf);
        continue;
      }
      const retryResult = await runOptimizerOnTeam(
        team,
        accountData,
        inventory,
        opts.algo,
        retryTimeout * 1000,
        opts.algo !== "v1" ? (retryTimeout * 1000) / 4 : undefined,
        cf.formulaId,
        opts.maxArtsPerSlot || undefined,
        resolveCombo(cf.formulaId, team),
        opts.lagrangian || undefined
      );
      const retryDamage = evaluateAssignment(
        team,
        cf.formulaId,
        retryResult.artifactAssignment,
        accountData,
        inventory,
        resolveCombo(cf.formulaId, team)
      );
      if (retryDamage == null) {
        console.log(
          `  ${C.red}[ERR]${C.reset} ${cf.key} → failed to re-evaluate returned assignment`
        );
        stillFailing.push(cf);
        continue;
      }

      const storeResult = tryStoreSolution(
        store,
        cf.key,
        team,
        cf.formulaId,
        retryResult.artifactAssignment,
        retryDamage,
        opts.algo,
        accountData,
        inventory,
        { solveTimeSec: retryResult.optimizeTimeSec }
      );

      if (storeResult.constraintViolations.length === 0) {
        const damageDelta = retryDamage - retryResult.optimizedDamage;
        const mismatchInfo =
          Math.abs(damageDelta) > 0.5
            ? ` ${C.red}DMG MISMATCH${C.reset}${C.dim}[reported ${fmt(retryResult.optimizedDamage)}, recalculated ${fmt(retryDamage)}, delta ${damageDelta >= 0 ? "+" : ""}${fmt(damageDelta)}]${C.reset}`
            : "";
        console.log(
          `  ${C.green}ok${C.reset} ${cf.key} → ${fmt(retryDamage)} (constraint recovered in ${retryResult.optimizeTimeSec.toFixed(1)}s)${mismatchInfo}`
        );
        constraintFails--;
      } else {
        console.log(
          `  ${C.red}X${C.reset} ${cf.key} → constraints still violated (confirmed)`
        );
        logConstraintViolations(storeResult.constraintViolations, "    ");
        stillFailing.push(cf);
      }
    }
    constraintFailList.length = 0;
    constraintFailList.push(...stillFailing);
    saveStore(store);
  }

  console.log(`\n${C.bold}═══ Benchmark Summary ═══${C.reset}\n`);
  console.log(`  New bests:     ${C.green}${newBests}${C.reset}`);
  console.log(`  Matched best:  ${matched}`);
  console.log(
    `  Regressions:   ${regressions > 0 ? C.red : ""}${regressions}${regressions > 0 ? C.reset : ""}`
  );
  console.log(`  No prior:      ${noSolutions}`);
  console.log(
    `  Errors:        ${errors > 0 ? C.red : ""}${errors}${errors > 0 ? C.reset : ""}`
  );
  console.log(
    `  Constraint fails: ${constraintFails > 0 ? C.red : ""}${constraintFails}${constraintFails > 0 ? C.reset : ""}`
  );
  console.log(
    `  Damage mismatches: ${damageMismatches > 0 ? C.red : ""}${damageMismatches}${damageMismatches > 0 ? C.reset : ""}`
  );

  if (regList.length > 0) {
    console.log(`\n  ${C.red}REGRESSIONS:${C.reset}`);
    for (const { key, comp } of regList) {
      console.log(
        `    ${key}: ${fmt(comp.damage)} vs best ${fmt(comp.bestDamage)} (${comp.pct.toFixed(2)}%)`
      );
    }
  }

  if (newBestList.length > 0) {
    console.log(`\n  ${C.green}NEW BESTS:${C.reset}`);
    for (const { key, comp } of newBestList) {
      console.log(`    ${key}: ${fmt(comp.damage)}`);
    }
  }

  if (damageMismatchList.length > 0) {
    console.log(`\n  ${C.red}DAMAGE MISMATCHES:${C.reset}`);
    for (const { key, comp } of damageMismatchList) {
      console.log(
        `    ${key}: reported ${fmt(comp.reportedDamage)} vs recalculated ${fmt(comp.damage)} ` +
          `(${comp.delta >= 0 ? "+" : ""}${fmt(comp.delta)})`
      );
    }
  }

  if (
    regressions > 0 ||
    constraintFails > 0 ||
    damageMismatches > 0 ||
    errors > 0
  ) {
    const failureParts: string[] = [];
    if (regressions > 0) failureParts.push(`${regressions} regression(s)`);
    if (constraintFails > 0) {
      failureParts.push(`${constraintFails} infeasible result(s)`);
    }
    if (damageMismatches > 0) {
      failureParts.push(`${damageMismatches} damage mismatch(es)`);
    }
    if (errors > 0) failureParts.push(`${errors} error(s)`);
    console.log(
      `\n${C.red}FAIL: ${failureParts.join(", ")} detected${C.reset}`
    );
    stopLogFile();
    process.exit(1);
  }
  stopLogFile();
}

async function cmdStatus(): Promise<void> {
  const store = loadStore();
  const problems = Object.entries(store.problems);

  console.log(`${C.bold}Solution Store Status${C.reset}\n`);
  console.log(`  Account:     ${store.sourceAccountFile}`);
  console.log(`  Frozen at:   ${store.accountFrozenAt}`);
  console.log(`  Problems:    ${problems.length}`);
  console.log(
    `  Solutions:   ${problems.reduce((s, [, p]) => s + p.solutions.length, 0)}`
  );

  if (problems.length > 0) {
    console.log(`\n  ${C.bold}Problems:${C.reset}`);
    for (const [key, problem] of problems.sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      const bestDmg = Math.max(
        ...problem.solutions.map((s) => s.recordedDamage)
      );
      console.log(
        `    ${problem.teamName} → ${problem.formulaId}  ` +
          `[${problem.solutions.length} solutions, best: ${fmt(bestDmg)}]`
      );
    }
  }
}

// ─── Refresh ─────────────────────────────────────────────────────────────────

async function cmdRefresh(): Promise<void> {
  const { store, accountData, teams } = await loadContext();

  const cached: CachedProblem[] = [];
  let skipped = 0;

  for (const team of teams) {
    const carryCharId = team.characters[0];
    if (!carryCharId) continue;

    const configs: TeamSlotConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildTeamSlotConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }
    if (configs.length === 0) {
      skipped++;
      continue;
    }

    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      rollMultiplier: DEFAULT_CALC_CONTEXT.rollMultiplier,
      substatBudget: DEFAULT_CALC_CONTEXT.substatBudget,
    };

    const perChar = buildPerChar(team, carryCharId, accountData);
    const formulas = getCarryFormulaIds(team);

    for (const { formulaId, label } of formulas) {
      const key = `${team.id}::${formulaId}`;

      if (!store.problems[key]) {
        const charIds = team.characters.filter((c): c is string => !!c);
        store.problems[key] = {
          teamId: team.id,
          teamName: team.name || charIds.join("/"),
          characters: charIds,
          carryCharId,
          formulaId,
          solutions: [],
        };
      }

      cached.push({
        key,
        teamId: team.id,
        teamName: team.name || team.characters.filter(Boolean).join("/"),
        characters: team.characters.filter((c): c is string => !!c),
        carryCharId,
        formulaId,
        formulaLabel: label,
        configs,
        combatOpts: team.opts || {},
        enemyAura: team.enemyAura,
        calcContext,
        perChar,
      });
    }

    // Add combo problem if the team has a multi-line default combo
    const teamCombo = getTeamCombo(team);
    if (teamCombo) {
      const comboKey = `${team.id}::__combo__`;
      if (!store.problems[comboKey]) {
        const charIds = team.characters.filter((c): c is string => !!c);
        store.problems[comboKey] = {
          teamId: team.id,
          teamName: team.name || charIds.join("/"),
          characters: charIds,
          carryCharId,
          formulaId: "__combo__",
          solutions: [],
        };
      }

      cached.push({
        key: comboKey,
        teamId: team.id,
        teamName: team.name || team.characters.filter(Boolean).join("/"),
        characters: team.characters.filter((c): c is string => !!c),
        carryCharId,
        formulaId: "__combo__",
        formulaLabel: "Combo",
        configs,
        combatOpts: team.opts || {},
        enemyAura: team.enemyAura,
        calcContext,
        perChar,
        combo: teamCombo,
      });
    }
  }

  const cache: ProblemCache = {
    refreshedAt: new Date().toISOString(),
    problems: cached,
  };

  writeFileSync(PROBLEMS_PATH, JSON.stringify(cache, null, 2), "utf-8");
  saveStore(store);

  console.log(
    `${C.green}Refreshed ${cached.length} problems${C.reset} (${skipped} teams skipped)`
  );
  console.log(`  Cached to ${PROBLEMS_PATH}`);
  console.log(
    `  Solution store: ${Object.keys(store.problems).length} problems`
  );
}

// ─── Enrich ──────────────────────────────────────────────────────────────────

async function cmdEnrich(opts: {
  filter?: string;
  problemKey?: string;
  algo: "v1" | "v2" | "astar" | "mona" | "monaV2";
  timeoutSec: number;
  parallel: number;
  maxArtsPerSlot: number;
  diag: boolean;
}): Promise<void> {
  const logPath = startLogFile("enrich");
  console.log(`Log file: ${logPath}`);

  if (opts.diag) {
    (globalThis as unknown as Record<string, boolean>).__TEAM_OPT_DIAG__ = true;
  }

  const { store, accountData, inventory, teamById } = await loadContext();

  const problemKeys = Object.keys(store.problems).sort();
  const toRun: {
    key: string;
    team: Team;
    formulaId: string;
    combo?: ComboFormula;
  }[] = [];

  for (const key of problemKeys) {
    if (opts.problemKey) {
      if (!key.includes(opts.problemKey)) continue;
    } else if (opts.filter) {
      const problem = store.problems[key];
      const matchesFilter =
        key.toLowerCase().includes(opts.filter.toLowerCase()) ||
        problem.teamName.toLowerCase().includes(opts.filter.toLowerCase()) ||
        problem.characters.some((c) =>
          c.toLowerCase().includes(opts.filter!.toLowerCase())
        );
      if (!matchesFilter) continue;
    }

    const problem = store.problems[key];
    const team = teamById.get(problem.teamId);
    if (!team) continue;
    toRun.push({
      key,
      team,
      formulaId: problem.formulaId,
      combo: resolveCombo(problem.formulaId, team),
    });
  }

  console.log(
    `\n${C.bold}═══ Enriching ${toRun.length} problems with ${opts.algo.toUpperCase()} (${opts.timeoutSec}s timeout${opts.parallel > 0 ? `, ${opts.parallel} workers` : ""}) ═══${C.reset}\n`
  );

  let added = 0;
  let duplicates = 0;
  let constraintFails = 0;
  let damageMismatches = 0;
  let errors = 0;

  function processEnrichResult(
    i: number,
    key: string,
    team: Team,
    formulaId: string,
    result: TeamResult
  ): void {
    const charNames = team.characters.filter(Boolean).join("/");

    if (result.error) {
      errors++;
      console.log(
        `  ${C.red}[ERR]${C.reset} ${i + 1}/${toRun.length} ${charNames} → ${formulaId}: ${result.error}`
      );
      return;
    }

    if (
      !result.artifactAssignment ||
      Object.keys(result.artifactAssignment).length === 0 ||
      result.optimizedDamage <= 0
    ) {
      console.log(
        `  ${C.dim}[SKIP]${C.reset} ${i + 1}/${toRun.length} ${charNames} → ${formulaId}: no assignment`
      );
      return;
    }

    const authoritativeDamage = evaluateAssignment(
      team,
      formulaId,
      result.artifactAssignment,
      accountData,
      inventory,
      resolveCombo(formulaId, team)
    );
    if (authoritativeDamage == null) {
      errors++;
      console.log(
        `  ${C.red}[ERR]${C.reset} ${i + 1}/${toRun.length} ${charNames} → ${formulaId}: failed to re-evaluate returned assignment`
      );
      return;
    }

    const damageDelta = authoritativeDamage - result.optimizedDamage;
    const hasDamageMismatch = Math.abs(damageDelta) > 0.5;
    if (hasDamageMismatch) {
      damageMismatches++;
    }

    const storeResult = tryStoreSolution(
      store,
      key,
      team,
      formulaId,
      result.artifactAssignment,
      authoritativeDamage,
      opts.algo,
      accountData,
      inventory
    );

    if (storeResult.constraintViolations.length > 0) {
      constraintFails++;
      console.log(
        `  ${C.red}[CONSTRAINT]${C.reset} ${i + 1}/${toRun.length} ${charNames} → ${formulaId} ${C.cyan}${fmt(authoritativeDamage)}${C.reset}`
      );
      logConstraintViolations(storeResult.constraintViolations, "    ");
    } else if (storeResult.duplicate) {
      duplicates++;
      console.log(
        `  ${C.dim}[DUP]${C.reset} ${i + 1}/${toRun.length} ${charNames} → ${formulaId} ${C.cyan}${fmt(authoritativeDamage)}${C.reset}${
          hasDamageMismatch
            ? ` ${C.red}DMG MISMATCH${C.reset}${C.dim}[reported ${fmt(result.optimizedDamage)}, recalculated ${fmt(authoritativeDamage)}, delta ${damageDelta >= 0 ? "+" : ""}${fmt(damageDelta)}]${C.reset}`
            : ""
        }`
      );
    } else if (storeResult.stored) {
      added++;
      const problem = store.problems[key];
      const bestDmg = Math.max(
        ...problem.solutions.map((s) => s.recordedDamage)
      );
      const isNewBest = authoritativeDamage >= bestDmg - 0.5;
      const icon = isNewBest ? `${C.green}*${C.reset}` : `${C.cyan}+${C.reset}`;
      console.log(
        `  ${icon} ${i + 1}/${toRun.length} ${charNames} → ${formulaId} ${C.cyan}${fmt(authoritativeDamage)}${C.reset}${isNewBest ? ` ${C.green}NEW BEST${C.reset}` : ""}${
          hasDamageMismatch
            ? ` ${C.red}DMG MISMATCH${C.reset}${C.dim}[reported ${fmt(result.optimizedDamage)}, recalculated ${fmt(authoritativeDamage)}, delta ${damageDelta >= 0 ? "+" : ""}${fmt(damageDelta)}]${C.reset}`
            : ""
        }`
      );
    }
  }

  if (opts.parallel > 0) {
    const tasks = toRun.map((p) => ({
      team: p.team,
      formulaId: p.formulaId,
      key: p.key,
      combo: p.combo,
    }));
    await runParallel(
      tasks,
      opts.algo,
      opts.timeoutSec,
      opts.parallel,
      opts.maxArtsPerSlot,
      opts.diag,
      (idx, result) => {
        const { key, team, formulaId } = toRun[idx];
        processEnrichResult(idx, key, team, formulaId, result);
      }
    );
  } else {
    for (let i = 0; i < toRun.length; i++) {
      const { key, team, formulaId, combo } = toRun[i];
      const result = await runOptimizerOnTeam(
        team,
        accountData,
        inventory,
        opts.algo,
        opts.timeoutSec * 1000,
        opts.algo !== "v1" ? (opts.timeoutSec * 1000) / 4 : undefined,
        formulaId,
        opts.maxArtsPerSlot || undefined,
        combo
      );
      processEnrichResult(i, key, team, formulaId, result);
    }
  }

  saveStore(store);
  console.log(
    `\n${C.green}Enriched: ${added} new solutions${C.reset} (${duplicates} duplicates, ${errors} errors` +
      `${constraintFails > 0 ? `, ${C.red}${constraintFails} constraint violations rejected${C.reset}` : ""}` +
      `${damageMismatches > 0 ? `, ${C.red}${damageMismatches} damage mismatches${C.reset}` : ""})`
  );
  stopLogFile();
}

// ─── Compare ─────────────────────────────────────────────────────────────────

/** Format a stat value (percentages as %, flat values as integer). */
function fmtStatVal(key: StatKey, value: number): string {
  const pctKeys = new Set([
    "atk%",
    "hp%",
    "def%",
    "cr",
    "cd",
    "er",
    "dmg%",
    "pyro%",
    "hydro%",
    "anemo%",
    "electro%",
    "dendro%",
    "cryo%",
    "geo%",
    "phys%",
    "heal%",
    "baseDmg%",
    "reactionBaseDmg%",
    "elevated%",
    "reactionDmg%",
    "reactionCr",
    "reactionCd",
    "defReduction%",
    "defIgnore%",
    "resReduction%",
  ]);
  if (pctKeys.has(key)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return Math.round(value).toLocaleString("en-US");
}

interface StatDiffEntry {
  key: StatKey;
  filterKey: string;
  currentVal: number;
  bestVal: number;
  diff: number;
}

function computeSheetDiff(
  current: StatSheet,
  best: StatSheet
): StatDiffEntry[] {
  const allKeys = new Set<string>();
  const currentDump = new Map<string, number>();
  const bestDump = new Map<string, number>();

  for (const entry of current.dump()) {
    const k = `${entry.key}|${entry.filterKey}`;
    allKeys.add(k);
    currentDump.set(k, (currentDump.get(k) ?? 0) + entry.value);
  }
  for (const entry of best.dump()) {
    const k = `${entry.key}|${entry.filterKey}`;
    allKeys.add(k);
    bestDump.set(k, (bestDump.get(k) ?? 0) + entry.value);
  }

  const diffs: StatDiffEntry[] = [];
  for (const k of allKeys) {
    const [key, filterKey] = k.split("|");
    const cv = currentDump.get(k) ?? 0;
    const bv = bestDump.get(k) ?? 0;
    const diff = cv - bv;
    if (Math.abs(diff) > 1e-6) {
      diffs.push({
        key: key as StatKey,
        filterKey,
        currentVal: cv,
        bestVal: bv,
        diff,
      });
    }
  }

  diffs.sort((a, b) => {
    const aF = a.filterKey ? 1 : 0;
    const bF = b.filterKey ? 1 : 0;
    if (aF !== bF) return aF - bF;
    return a.key.localeCompare(b.key);
  });

  return diffs;
}

function printStatDiff(label: string, diffs: StatDiffEntry[]): void {
  if (diffs.length === 0) {
    console.log(`  ${C.dim}${label}: (identical)${C.reset}`);
    return;
  }
  console.log(`  ${C.bold}${label}:${C.reset}`);
  for (const d of diffs) {
    const sign = d.diff > 0 ? "+" : "";
    const color = d.diff > 0 ? C.green : C.red;
    const filterInfo = d.filterKey ? ` ${C.dim}[${d.filterKey}]${C.reset}` : "";
    console.log(
      `    ${d.key}${filterInfo}: ` +
        `${fmtStatVal(d.key, d.bestVal)} → ${fmtStatVal(d.key, d.currentVal)} ` +
        `${color}(${sign}${fmtStatVal(d.key, d.diff)})${C.reset}`
    );
  }
}

async function cmdCompare(opts: {
  problemKey: string;
  algo?: "v1" | "v2" | "astar" | "mona" | "monaV2";
  timeoutSec: number;
  maxArtsPerSlot: number;
  diag: boolean;
}): Promise<void> {
  if (opts.diag) {
    (globalThis as unknown as Record<string, boolean>).__TEAM_OPT_DIAG__ = true;
  }

  const { store, accountData, inventory, artById, teamById } =
    await loadContext();

  const matches = Object.keys(store.problems).filter((k) =>
    k.includes(opts.problemKey)
  );
  if (matches.length === 0) {
    console.error(
      `${C.red}No problems matching "${opts.problemKey}"${C.reset}`
    );
    process.exit(1);
  }

  for (const key of matches) {
    const problem = store.problems[key];
    const team = teamById.get(problem.teamId);
    if (!team) {
      console.log(`${C.yellow}SKIP${C.reset} ${key}: team not in presets`);
      continue;
    }

    console.log(
      `\n${C.bold}═══ ${problem.teamName} → ${problem.formulaId} ═══${C.reset}\n`
    );

    const { bestSol, bestDamage } = findBestSolution(
      problem,
      team,
      accountData,
      inventory
    );

    if (!bestSol) {
      console.log(`  ${C.yellow}No valid stored solutions${C.reset}`);
      continue;
    }

    console.log(
      `  ${C.bold}Best stored:${C.reset} ${fmt(bestDamage)} (${bestSol.algorithm}, ${bestSol.foundAt.slice(0, 10)})`
    );

    let currentAssignment: Record<string, Record<string, string>> | null = null;
    let currentDamage = 0;

    if (opts.algo) {
      const result = await runOptimizerOnTeam(
        team,
        accountData,
        inventory,
        opts.algo,
        opts.timeoutSec * 1000,
        opts.algo !== "v1" ? (opts.timeoutSec * 1000) / 4 : undefined,
        problem.formulaId,
        opts.maxArtsPerSlot || undefined
      );

      if (result.error) {
        console.log(`  ${C.red}Optimizer error: ${result.error}${C.reset}`);
        continue;
      }

      const authoritativeDamage = evaluateAssignment(
        team,
        problem.formulaId,
        result.artifactAssignment,
        accountData,
        inventory,
        resolveCombo(problem.formulaId, team)
      );
      if (authoritativeDamage == null) {
        console.log(
          `  ${C.red}Failed to re-evaluate returned assignment${C.reset}`
        );
        continue;
      }

      currentAssignment = result.artifactAssignment;
      currentDamage = authoritativeDamage;

      const pct = ((currentDamage - bestDamage) / bestDamage) * 100;
      const color = currentDamage >= bestDamage - 0.5 ? C.green : C.red;
      const damageDelta = authoritativeDamage - result.optimizedDamage;
      const mismatchInfo =
        Math.abs(damageDelta) > 0.5
          ? ` ${C.red}DMG MISMATCH${C.reset}${C.dim}[reported ${fmt(result.optimizedDamage)}, recalculated ${fmt(authoritativeDamage)}, delta ${damageDelta >= 0 ? "+" : ""}${fmt(damageDelta)}]${C.reset}`
          : "";
      console.log(
        `  ${C.bold}Current ${opts.algo.toUpperCase()}:${C.reset} ${color}${fmt(currentDamage)}${C.reset} (${pct >= 0 ? "+" : ""}${pct.toFixed(3)}%)${mismatchInfo}`
      );
    } else {
      if (problem.solutions.length < 2) {
        console.log(`  ${C.dim}Only 1 solution — nothing to compare${C.reset}`);
        continue;
      }
      const lastSol = problem.solutions[problem.solutions.length - 1];
      const lastDmg = evaluateAssignment(
        team,
        problem.formulaId,
        lastSol.artifactAssignment,
        accountData,
        inventory,
        resolveCombo(problem.formulaId, team)
      );
      if (lastDmg === null) continue;
      currentAssignment = lastSol.artifactAssignment;
      currentDamage = lastDmg;
      console.log(
        `  ${C.bold}Latest solution:${C.reset} ${fmt(currentDamage)} (${lastSol.algorithm})`
      );
    }

    if (!currentAssignment) continue;

    // Build TeamBuild for stat comparison
    const configs: TeamSlotConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildTeamSlotConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }
    if (configs.length === 0) continue;

    const teamBuild = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyAura as import("@/data/types").Element | undefined
    );
    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      rollMultiplier: DEFAULT_CALC_CONTEXT.rollMultiplier,
      substatBudget: DEFAULT_CALC_CONTEXT.substatBudget,
    };

    // ── 1) Artifact stat diff per character ──
    console.log(`\n  ${C.magenta}── Artifact Stat Diffs ──${C.reset}`);

    const currentArtSheets: Record<string, StatSheet> = {};
    const bestArtSheets: Record<string, StatSheet> = {};

    for (const cid of problem.characters) {
      const currentSlots = currentAssignment[cid] ?? {};
      const bestSlots = bestSol.artifactAssignment[cid] ?? {};

      const currentPieces: ArtifactData[] = Object.values(currentSlots)
        .map((id) => artById.get(id))
        .filter((a): a is ArtifactData => !!a);
      const bestPieces: ArtifactData[] = Object.values(bestSlots)
        .map((id) => artById.get(id))
        .filter((a): a is ArtifactData => !!a);

      currentArtSheets[cid] = StatSheet.fromArtifacts(currentPieces);
      bestArtSheets[cid] = StatSheet.fromArtifacts(bestPieces);

      const currentIds = new Set(Object.values(currentSlots));
      const bestIds = new Set(Object.values(bestSlots));
      const same = [...currentIds].filter((id) => bestIds.has(id)).length;
      const total = Math.max(currentIds.size, bestIds.size);

      if (same === total && total > 0) {
        console.log(
          `\n  ${C.bold}${cid}${C.reset}: ${C.dim}same artifacts${C.reset}`
        );
        continue;
      }

      console.log(
        `\n  ${C.bold}${cid}${C.reset}: ${same}/${total} artifacts shared`
      );

      const artDiff = computeSheetDiff(
        currentArtSheets[cid],
        bestArtSheets[cid]
      );
      printStatDiff("  Artifact stats", artDiff);
    }

    // ── 2) Internal dump diff (post-buff team stats) ──
    console.log(`\n  ${C.magenta}── Post-Buff Team Stats Diffs ──${C.reset}`);

    const currentPostStats = teamBuild.getTeamStats(
      currentArtSheets,
      problem.carryCharId,
      calcContext
    );
    const bestPostStats = teamBuild.getTeamStats(
      bestArtSheets,
      problem.carryCharId,
      calcContext
    );

    for (const cid of problem.characters) {
      const currentSheet = currentPostStats[cid];
      const bestSheet = bestPostStats[cid];
      if (!currentSheet || !bestSheet) continue;

      const postDiff = computeSheetDiff(currentSheet, bestSheet);
      if (postDiff.length === 0) {
        console.log(
          `\n  ${C.bold}${cid}${C.reset} post-buff: ${C.dim}(identical)${C.reset}`
        );
      } else {
        console.log(`\n  ${C.bold}${cid}${C.reset} post-buff:`);
        printStatDiff("  Team stats", postDiff);
      }
    }

    // Auto-add current solution if it passes constraints
    if (currentDamage > 0 && currentAssignment) {
      const storeResult = tryStoreSolution(
        store,
        key,
        team,
        problem.formulaId,
        currentAssignment,
        currentDamage,
        opts.algo ?? "compare",
        accountData,
        inventory
      );
      if (storeResult.stored) {
        saveStore(store);
        console.log(`\n  ${C.cyan}Added as new solution${C.reset}`);
      } else if (storeResult.constraintViolations.length > 0) {
        console.log(
          `\n  ${C.red}Solution violates constraints — not stored${C.reset}`
        );
        logConstraintViolations(storeResult.constraintViolations, "    ");
      }
    }
  }
}

// ─── Diagnose Command ────────────────────────────────────────────────────────

/**
 * Reverse-engineer what weights would have ranked optimal artifacts better.
 * For each problem, compares the substat profiles of optimal vs top-ranked
 * artifacts to identify systematic weight biases.
 */
async function cmdReverseWeights(filter?: string): Promise<void> {
  const { store, accountData, inventory, artById, teamById } =
    await loadContext();
  const globalConfig = DEFAULT_GLOBAL_CONFIG;

  // Accumulate per-stat "rank penalty" across all problems to find systematic biases
  const statRankPenalties: Record<
    string,
    { sumRank: number; count: number; slots: string[] }
  > = {};

  for (const [key, problem] of Object.entries(store.problems)) {
    if (filter && !key.includes(filter)) continue;
    const team = teamById.get(problem.teamId);
    if (!team) continue;

    const { bestSol } = findBestSolution(problem, team, accountData, inventory);
    if (!bestSol) continue;

    const carryId = problem.carryCharId;
    const perChar = buildPerChar(team, carryId, accountData);
    const carryConfig = perChar[carryId];
    if (!carryConfig?.buildMatch) continue;

    const baseWeights = carryConfig.buildMatch.statWeights;
    const bestCarrySlots = bestSol.artifactAssignment[carryId] ?? {};

    let hasIssue = false;
    for (const slot of allSlots) {
      const bestArtId = bestCarrySlots[slot];
      const bestArt = bestArtId ? artById.get(bestArtId) : null;
      if (!bestArt) continue;

      // Rank the optimal artifact
      const slotArts = inventory
        .filter((a) => a.slotKey === slot)
        .map((a) => {
          let score = scoreSlot(
            a,
            baseWeights as Record<string, number>,
            globalConfig
          );
          if (carryConfig.buildMatch) {
            const rec = getTargetMainStatsForSlot(
              slot,
              carryConfig.buildMatch.build
            );
            if (rec.has(a.mainStatKey)) {
              score += scoreMainStat(
                a.mainStatKey,
                a.rarity,
                globalConfig,
                a.level
              );
            }
          }
          return { art: a, score };
        })
        .sort((a, b) => b.score - a.score);

      const rank = slotArts.findIndex((x) => x.art.id === bestArtId);
      if (rank < 10) continue; // Only care about poorly ranked slots

      if (!hasIssue) {
        console.log(
          `\n${C.bold}${problem.teamName} → ${problem.formulaId}${C.reset}` +
            ` | weights: ${JSON.stringify(baseWeights)}`
        );
        hasIssue = true;
      }

      const top = slotArts[0];
      const opt = slotArts[rank];

      // Compare substats
      console.log(
        `  ${slot}: optimal rank #${rank + 1} | main: ${bestArt.mainStatKey} vs top: ${top.art.mainStatKey}`
      );
      console.log(
        `    Optimal (${opt.score.toFixed(1)}): ${JSON.stringify(bestArt.substats)}`
      );
      console.log(
        `    Top #1  (${top.score.toFixed(1)}): ${JSON.stringify(top.art.substats)}`
      );

      // What substats does the optimal have MORE of vs the top?
      const optSubs = bestArt.substats ?? {};
      const topSubs = top.art.substats ?? {};
      const allStats = new Set([
        ...Object.keys(optSubs),
        ...Object.keys(topSubs),
      ]);
      const diffs: string[] = [];
      for (const stat of allStats) {
        const optVal = optSubs[stat as SubStat] ?? 0;
        const topVal = topSubs[stat as SubStat] ?? 0;
        const diff = optVal - topVal;
        if (Math.abs(diff) > 0.01) {
          diffs.push(`${stat}: ${diff > 0 ? "+" : ""}${diff.toFixed(1)}`);
          // Track for aggregate analysis
          if (!statRankPenalties[stat]) {
            statRankPenalties[stat] = { sumRank: 0, count: 0, slots: [] };
          }
          // If optimal has LESS of this stat, it means the weight is too high for this stat
          if (diff < 0) {
            statRankPenalties[stat].sumRank += rank;
            statRankPenalties[stat].count++;
            statRankPenalties[stat].slots.push(`${problem.formulaId}/${slot}`);
          }
        }
      }
      // Also track main stat difference
      if (bestArt.mainStatKey !== top.art.mainStatKey) {
        const mainKey = `MAIN:${top.art.mainStatKey}→${bestArt.mainStatKey}`;
        if (!statRankPenalties[mainKey]) {
          statRankPenalties[mainKey] = { sumRank: 0, count: 0, slots: [] };
        }
        statRankPenalties[mainKey].sumRank += rank;
        statRankPenalties[mainKey].count++;
        statRankPenalties[mainKey].slots.push(`${problem.formulaId}/${slot}`);
      }
      console.log(`    Diff (opt-top): ${diffs.join(", ")}`);
    }
  }

  // Print aggregate analysis
  console.log(
    `\n${C.bold}═══ Aggregate: Stats that penalize optimal artifacts ═══${C.reset}`
  );
  console.log(
    "  (Stats where optimal has LESS than top-ranked → weight too high)\n"
  );
  const entries = Object.entries(statRankPenalties)
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].sumRank - a[1].sumRank);
  for (const [stat, data] of entries) {
    console.log(
      `  ${stat}: ${data.count} cases, avg rank=${(data.sumRank / data.count).toFixed(0)}` +
        ` | ${data.slots.join(", ")}`
    );
  }
}

/**
 * Diagnose WHY V2 can't find the optimal solution for a specific problem.
 * Traces the carry character's artifact pool, slot rankings, and B&B results.
 */
async function cmdCarryDiagnose(opts: {
  problemKey: string;
  timeoutSec: number;
}): Promise<void> {
  const { store, accountData, inventory, artById, teamById } =
    await loadContext();

  const matches = Object.keys(store.problems).filter((k) =>
    k.includes(opts.problemKey)
  );
  if (matches.length === 0) {
    console.error(
      `${C.red}No problems matching "${opts.problemKey}"${C.reset}`
    );
    process.exit(1);
  }

  for (const key of matches) {
    const problem = store.problems[key];
    const team = teamById.get(problem.teamId);
    if (!team) continue;

    console.log(
      `\n${C.bold}═══ DIAGNOSE: ${problem.teamName} → ${problem.formulaId} ═══${C.reset}\n`
    );

    const { bestSol, bestDamage } = findBestSolution(
      problem,
      team,
      accountData,
      inventory
    );
    if (!bestSol) {
      console.log(`  ${C.yellow}No valid stored solutions${C.reset}`);
      continue;
    }

    const carryId = problem.carryCharId;
    console.log(
      `  Best: ${fmt(bestDamage)} (${bestSol.algorithm}) | carry: ${carryId}`
    );

    // Set up V2 context
    const configs: TeamSlotConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildTeamSlotConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }
    if (configs.length === 0) continue;

    const teamBuild = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyAura as import("@/data/types").Element | undefined
    );
    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      rollMultiplier: DEFAULT_CALC_CONTEXT.rollMultiplier,
      substatBudget: DEFAULT_CALC_CONTEXT.substatBudget,
    };
    const perChar = buildPerChar(team, carryId, accountData);
    const carryConfig = perChar[carryId];
    if (!carryConfig) {
      console.log(`  ${C.red}No carry config${C.reset}`);
      continue;
    }

    const globalConfig = DEFAULT_GLOBAL_CONFIG;

    // ── 1) Carry artifact ranking per slot ──
    console.log(`\n  ${C.magenta}── Carry Artifact Ranking ──${C.reset}`);
    const bestCarrySlots = bestSol.artifactAssignment[carryId] ?? {};

    // Compute weight scores for ranking (same as prepareSlotData)
    const baseWeights = carryConfig.buildMatch?.statWeights ?? {
      cr: 100,
      cd: 100,
    };
    console.log(`  Build weights: ${JSON.stringify(baseWeights)}`);
    console.log(
      `  Set constraint: ${carryConfig.artifactSetId ?? carryConfig.artifactHalfSetIds?.join("+") ?? "none"}`
    );
    console.log(
      `  ER target: ${carryConfig.minEr} | CR target: ${carryConfig.minCr}`
    );

    for (const slot of allSlots) {
      const bestArtId = bestCarrySlots[slot];
      const bestArt = bestArtId ? artById.get(bestArtId) : null;

      // Get all artifacts for this slot, sorted by weight score
      const slotArts = inventory
        .filter((a) => a.slotKey === slot)
        .map((a) => {
          const weights = baseWeights;
          let score = scoreSlot(
            a,
            weights as Record<string, number>,
            globalConfig
          );
          if (carryConfig.buildMatch) {
            const rec = getTargetMainStatsForSlot(
              slot,
              carryConfig.buildMatch.build
            );
            if (rec.has(a.mainStatKey)) {
              score += scoreMainStat(
                a.mainStatKey,
                a.rarity,
                globalConfig,
                a.level
              );
            }
          }
          return { art: a, score };
        })
        .sort((a, b) => b.score - a.score);

      const rank = slotArts.findIndex((x) => x.art.id === bestArtId);
      const total = slotArts.length;

      if (!bestArt) {
        console.log(`  ${slot}: ${C.yellow}no optimal artifact${C.reset}`);
        continue;
      }

      const topScore = slotArts[0]?.score ?? 0;
      const optEntry = slotArts[rank];
      const color = rank < 5 ? C.green : rank < 20 ? C.yellow : C.red;
      console.log(
        `  ${slot}: optimal rank ${color}#${rank + 1}/${total}${C.reset}` +
          ` | score=${optEntry?.score.toFixed(1)} (top=${topScore.toFixed(1)})` +
          ` | main=${bestArt.mainStatKey} set=${bestArt.setKey}` +
          ` | id=${bestArtId}`
      );

      // Show the top-3 and where the gap is
      if (rank >= 3) {
        for (let i = 0; i < Math.min(3, slotArts.length); i++) {
          const e = slotArts[i];
          console.log(
            `    #${i + 1}: score=${e.score.toFixed(1)} main=${e.art.mainStatKey} set=${e.art.setKey} id=${e.art.id}`
          );
        }
      }
    }

    // ── 2) Run carry-only B&B and see what it finds ──
    console.log(`\n  ${C.magenta}── Carry-only B&B ──${C.reset}`);

    // Build heuristic base sheets (same as the optimizer would)
    const baseSheets: Record<string, StatSheet> = {};
    for (const cid of problem.characters) {
      // Use the BEST solution's support artifacts as base
      const solSlots = bestSol.artifactAssignment[cid] ?? {};
      const pieces: ArtifactData[] = Object.values(solSlots)
        .map((id) => artById.get(id))
        .filter((a): a is ArtifactData => !!a);
      if (cid !== carryId) {
        baseSheets[cid] = StatSheet.fromArtifacts(pieces);
      } else {
        baseSheets[cid] = new StatSheet([]);
      }
    }

    // Get the optimal carry artifacts as an excluded set from other characters
    const supportArtIds = new Set<string>();
    for (const [cid, slots] of Object.entries(bestSol.artifactAssignment)) {
      if (cid === carryId) continue;
      for (const artId of Object.values(slots)) supportArtIds.add(artId);
    }

    const benchCombo: ComboFormula = {
      id: "__bench__",
      label: { zh: "", en: "" },
      lines: [{ charId: carryId, formulaId: problem.formulaId, count: 1 }],
    };

    const carryResult = runCharacterBnB(
      carryId,
      carryConfig,
      teamBuild,
      carryId,
      inventory,
      globalConfig,
      baseSheets,
      calcContext,
      supportArtIds, // exclude support artifacts
      benchCombo,
      15, // topK
      performance.now() + opts.timeoutSec * 1000, // deadline
      undefined, // warmStartThreshold
      0 // maxArtsPerSlot
    );

    console.log(
      `  B&B result: ${fmt(carryResult.collector.best?.damage ?? 0)} (${carryResult.evaluations} evals)${carryResult.failReason ? ` FAIL: ${carryResult.failReason.kind}` : ""}`
    );

    // Now evaluate the best solution's carry artifacts through the same pipeline
    const bestCarryPieces = allSlots.map((s) => {
      const id = bestCarrySlots[s];
      return id ? (artById.get(id) ?? null) : null;
    });
    const bestCarrySheet = StatSheet.fromArtifacts(
      bestCarryPieces.filter((a): a is ArtifactData => a != null)
    );
    const bestSheets = { ...baseSheets, [carryId]: bestCarrySheet };
    teamBuild.getTeamStats(bestSheets, carryId, calcContext);
    const bestDmgResult = teamBuild.getDamageResult(
      carryId,
      problem.formulaId,
      calcContext
    );
    console.log(
      `  Optimal carry damage: ${fmt(bestDmgResult.totalDamage)} (with best supports)`
    );

    const bnbBest = carryResult.collector.best;
    if (bnbBest) {
      const bnbIds = allSlots.map((_, i) => bnbBest.artifacts[i]?.id ?? "?");
      const optIds = allSlots.map((s) => bestCarrySlots[s] ?? "?");
      const shared = bnbIds.filter((id, i) => id === optIds[i]).length;
      console.log(`  B&B vs optimal: ${shared}/5 artifacts match`);
      console.log(`  B&B artifacts:  [${bnbIds.join(", ")}]`);
      console.log(`  Opt artifacts:  [${optIds.join(", ")}]`);

      // Show the slot differences
      for (let i = 0; i < 5; i++) {
        if (bnbIds[i] !== optIds[i]) {
          const bnbArt = bnbBest.artifacts[i];
          const optArt = artById.get(optIds[i]);
          console.log(
            `  ${allSlots[i]} DIFF: V2=${bnbArt?.mainStatKey}/${bnbArt?.setKey} ` +
              `vs Opt=${optArt?.mainStatKey}/${optArt?.setKey}`
          );
        }
      }
    }

    // ── 3) Check: does V2 get same result with no support exclusion? ──
    console.log(
      `\n  ${C.magenta}── Carry B&B (no exclusion, support context from best) ──${C.reset}`
    );
    const noExclResult = runCharacterBnB(
      carryId,
      carryConfig,
      teamBuild,
      carryId,
      inventory,
      globalConfig,
      baseSheets,
      calcContext,
      undefined,
      benchCombo,
      15,
      performance.now() + opts.timeoutSec * 1000,
      undefined,
      0
    );
    console.log(
      `  No-excl B&B: ${fmt(noExclResult.collector.best?.damage ?? 0)} ` +
        `(${noExclResult.evaluations} evals)`
    );

    if (noExclResult.collector.best) {
      const ids = allSlots.map(
        (_, i) => noExclResult.collector.best!.artifacts[i]?.id ?? "?"
      );
      const optIds = allSlots.map((s) => bestCarrySlots[s] ?? "?");
      const shared = ids.filter((id, i) => id === optIds[i]).length;
      console.log(`  Artifacts match: ${shared}/5`);
      if (shared < 5) {
        for (let i = 0; i < 5; i++) {
          if (ids[i] !== optIds[i]) {
            const bnbArt = noExclResult.collector.best!.artifacts[i];
            const optArt = artById.get(optIds[i]);
            console.log(
              `  ${allSlots[i]}: V2=${bnbArt?.mainStatKey}/${bnbArt?.setKey} ` +
                `vs Opt=${optArt?.mainStatKey}/${optArt?.setKey}`
            );
          }
        }
      }
    }
  }
}

// ─── Fuzz: AST vs Standard Equivalence ───────────────────────────────────────

async function cmdFuzz(opts: {
  filter?: string;
  problemKey?: string;
  trials: number;
}): Promise<void> {
  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);
  const problemCache = loadProblemCache();

  if (!problemCache) {
    console.error("No problem cache. Run: benchmark refresh");
    process.exit(1);
  }

  // Group inventory by slot
  const bySlot: Record<string, ArtifactData[]> = {};
  for (const art of inventory) {
    const sk = art.slotKey;
    const bucket = bySlot[sk];
    if (bucket) {
      bucket.push(art);
    } else {
      bySlot[sk] = [art];
    }
  }
  const slotKeys = allSlots;

  // Filter problems
  let problems = problemCache.problems;
  if (opts.problemKey) {
    problems = problems.filter((p) =>
      p.key.toLowerCase().includes(opts.problemKey!.toLowerCase())
    );
  } else if (opts.filter) {
    const f = opts.filter.toLowerCase();
    problems = problems.filter(
      (p) =>
        p.teamName.toLowerCase().includes(f) ||
        p.characters.some((c) => c.toLowerCase().includes(f))
    );
  }

  if (problems.length === 0) {
    console.error("No problems matched filter.");
    process.exit(1);
  }

  console.log(
    `${C.bold}═══ Fuzz: AST vs Standard on ${problems.length} problems × ${opts.trials} trials ═══${C.reset}\n`
  );

  let totalTrials = 0;
  let totalMismatches = 0;
  let totalErrors = 0;

  for (const prob of problems) {
    let teamBuild: TeamBuild;
    try {
      teamBuild = new TeamBuild(
        prob.configs,
        prob.combatOpts,
        prob.enemyAura as import("@/data/types").Element | undefined
      );
    } catch (e) {
      console.log(
        `  ${C.yellow}SKIP${C.reset} ${prob.key} — TeamBuild error: ${e instanceof Error ? e.message : e}`
      );
      continue;
    }

    const calcContext = prob.calcContext;
    const carryCharId = prob.carryCharId;
    const formulaId = prob.formulaId;
    const charIds = prob.characters;

    // Build base sheets (empty — we supply all artifacts in the tuple)
    const baseSheets: Record<string, StatSheet> = {};
    for (const cid of charIds) {
      baseSheets[cid] = new StatSheet([]);
    }

    // Compile AST
    let compiled: CompiledTeamDamage;
    try {
      compiled = compileComboTeamDamage(
        teamBuild,
        singleFormulaCombo(carryCharId, formulaId),
        carryCharId,
        baseSheets,
        calcContext
      );
    } catch (e) {
      console.log(
        `  ${C.red}ERROR${C.reset} ${prob.key} — Compile error: ${e instanceof Error ? e.message : e}`
      );
      totalErrors++;
      continue;
    }

    const compiledVars = new Float64Array(compiled.numVars);
    const charIdx = compiled.charIdxMap?.get(carryCharId) ?? 0;

    // Run trials with random artifact tuples
    let mismatches = 0;
    for (let t = 0; t < opts.trials; t++) {
      // Pick one random artifact per slot
      const pieces: [
        ArtifactData | null,
        ArtifactData | null,
        ArtifactData | null,
        ArtifactData | null,
        ArtifactData | null,
      ] = [null, null, null, null, null];

      for (let s = 0; s < 5; s++) {
        const pool = bySlot[slotKeys[s]];
        if (pool && pool.length > 0) {
          pieces[s] = pool[Math.floor(Math.random() * pool.length)]!;
        }
      }

      // Old path: getTeamStats → getDamageResult
      const charSheet = StatSheet.fromArtifacts(pieces);
      const artSheets = { ...baseSheets, [carryCharId]: charSheet };
      teamBuild.teamStats.setArtifacts(artSheets, calcContext);
      const oldDamage = teamBuild.getDamageResult(
        carryCharId,
        formulaId,
        calcContext
      ).totalDamage;

      // New path: compiled AST
      compiledVars.fill(0);
      fillVarsFromArtifacts(pieces, compiled.varMapping, charIdx, compiledVars);
      const newDamage = compiled.evaluate(compiledVars);

      // Compare with relative tolerance
      const relErr =
        oldDamage === 0
          ? newDamage === 0
            ? 0
            : Number.POSITIVE_INFINITY
          : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);

      if (relErr > 1e-9) {
        mismatches++;
        if (mismatches <= 3) {
          console.log(
            `  ${C.red}MISMATCH${C.reset} ${prob.key} trial ${t}: ` +
              `old=${oldDamage.toFixed(2)} new=${newDamage.toFixed(2)} ` +
              `relErr=${(relErr * 100).toFixed(6)}%`
          );
          // Print artifact main stats for debugging
          const artDesc = pieces
            .map((a) => (a ? `${a.slotKey}:${a.mainStatKey}` : "null"))
            .join(", ");
          console.log(`    artifacts: [${artDesc}]`);
        }
      }
      totalTrials++;
    }

    totalMismatches += mismatches;
    const status =
      mismatches === 0
        ? `${C.green}ok${C.reset}`
        : `${C.red}X ${mismatches} mismatches${C.reset}`;
    console.log(
      `  ${status} ${prob.key} (${opts.trials} trials, ${compiled.numVars} vars)`
    );
  }

  console.log(
    `\n${C.bold}═══ Fuzz Summary ═══${C.reset}\n` +
      `  Total trials:     ${totalTrials}\n` +
      `  Mismatches:       ${totalMismatches === 0 ? `${C.green}0${C.reset}` : `${C.red}${totalMismatches}${C.reset}`}\n` +
      `  Compile errors:   ${totalErrors === 0 ? "0" : `${C.red}${totalErrors}${C.reset}`}`
  );

  process.exit(totalMismatches > 0 || totalErrors > 0 ? 1 : 0);
}

// ─── Fuzz-Combo: AST Combo vs evaluateCombo Equivalence ──────────────────────

type MainStat = import("@/data/types").MainStat;
type Slot = import("@/data/types").Slot;

const MAIN_STAT_POOLS: Record<Slot, readonly MainStat[]> = {
  flower: ["hp"],
  plume: ["atk"],
  sands: ["atk%", "hp%", "def%", "em", "er"],
  goblet: [
    "atk%",
    "hp%",
    "def%",
    "em",
    "pyro%",
    "hydro%",
    "electro%",
    "cryo%",
    "dendro%",
    "anemo%",
    "geo%",
    "phys%",
  ],
  circlet: ["atk%", "hp%", "def%", "em", "cr", "cd"],
};

const ALL_SUBSTATS: SubStat[] = [
  "hp",
  "hp%",
  "atk",
  "atk%",
  "def",
  "def%",
  "em",
  "er",
  "cr",
  "cd",
];

function randomMainStats(): Record<Slot, MainStat> {
  const pick = <T>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];
  return {
    flower: "hp",
    plume: "atk",
    sands: pick(MAIN_STAT_POOLS.sands),
    goblet: pick(MAIN_STAT_POOLS.goblet),
    circlet: pick(MAIN_STAT_POOLS.circlet),
  };
}

function randomSubRolls(): Record<Slot, Partial<Record<SubStat, number>>> {
  const result = {} as Record<Slot, Partial<Record<SubStat, number>>>;
  for (const slot of allSlots) {
    result[slot] = {};
    const shuffled = [...ALL_SUBSTATS].sort(() => Math.random() - 0.5);
    for (const sub of shuffled.slice(0, 4)) {
      result[slot][sub] = Math.floor(Math.random() * 6) + 1;
    }
  }
  return result;
}

async function cmdFuzzCombo(opts: {
  filter?: string;
  problemKey?: string;
  trials: number;
}): Promise<void> {
  await preloadGameStats();
  const problemCache = loadProblemCache();

  if (!problemCache) {
    console.error("No problem cache. Run: benchmark refresh");
    process.exit(1);
  }

  // Deduplicate teams (multiple problems can share the same team)
  const teamMap = new Map<
    string,
    {
      configs: TeamSlotConfig[];
      charIds: string[];
      calcContext: CalcContext;
      teamName: string;
      combatOpts: Record<string, string>;
      enemyAura?: string;
    }
  >();
  for (const prob of problemCache.problems) {
    if (teamMap.has(prob.teamId)) continue;
    if (
      opts.problemKey &&
      !prob.key.toLowerCase().includes(opts.problemKey.toLowerCase())
    )
      continue;
    if (opts.filter) {
      const f = opts.filter.toLowerCase();
      if (
        !prob.teamName.toLowerCase().includes(f) &&
        !prob.characters.some((c) => c.toLowerCase().includes(f))
      )
        continue;
    }
    teamMap.set(prob.teamId, {
      configs: prob.configs,
      charIds: prob.characters,
      calcContext: prob.calcContext,
      teamName: prob.teamName,
      combatOpts: prob.combatOpts,
      enemyAura: prob.enemyAura,
    });
  }

  const teams = [...teamMap.entries()];
  if (teams.length === 0) {
    console.error("No teams matched filter.");
    process.exit(1);
  }

  console.log(
    `${C.bold}═══ Fuzz-Combo: AST Combo vs evaluateCombo on ${teams.length} teams × ${opts.trials} trials ═══${C.reset}\n`
  );

  const rv = getRollValues();
  let totalTrials = 0;
  let totalMismatches = 0;
  let totalErrors = 0;
  let totalTeamsOk = 0;

  for (const [teamId, team] of teams) {
    let teamBuild: TeamBuild;
    try {
      teamBuild = new TeamBuild(
        team.configs,
        team.combatOpts,
        team.enemyAura as import("@/data/types").Element | undefined
      );
    } catch (e) {
      console.log(
        `  ${C.yellow}SKIP${C.reset} ${team.teamName} — TeamBuild error: ${e instanceof Error ? e.message : e}`
      );
      continue;
    }

    // Build combo with ALL formulas from ALL characters
    const allFormulas = teamBuild.getFormulaIds();
    const comboLines: ComboFormula["lines"] = [];
    for (const [charId, formulas] of Object.entries(allFormulas)) {
      for (const formulaId of Object.keys(formulas)) {
        comboLines.push({ charId, formulaId, count: 1 });
      }
    }

    if (comboLines.length === 0) {
      console.log(`  ${C.yellow}SKIP${C.reset} ${team.teamName} — no formulas`);
      continue;
    }

    const combo: ComboFormula = {
      id: `fuzz-${teamId}`,
      label: { zh: team.teamName, en: team.teamName },
      lines: comboLines,
    };

    let teamMismatches = 0;
    let teamErrors = 0;

    // Test with each character as the swap char
    for (const swapCharId of team.charIds) {
      // Compile once per swapChar
      let compiled: CompiledTeamDamage;
      try {
        // Build baseline sheets for supports (random) baked into the compiled form
        const baseSheets: Record<string, StatSheet> = {};
        for (const cid of team.charIds) {
          if (cid === swapCharId) {
            baseSheets[cid] = new StatSheet([]);
          } else {
            baseSheets[cid] = buildSheetFromMainAndSubs(
              randomMainStats(),
              randomSubRolls(),
              rv
            );
          }
        }

        compiled = compileComboTeamDamage(
          teamBuild,
          combo,
          swapCharId,
          baseSheets,
          team.calcContext
        );

        const charIdx = compiled.charIdxMap?.get(swapCharId) ?? 0;

        // Run trials with random artifact sheets for the swap char
        for (let t = 0; t < opts.trials; t++) {
          const swapSheet = buildSheetFromMainAndSubs(
            randomMainStats(),
            randomSubRolls(),
            rv
          );

          // Old path: evaluateCombo
          const sheets = { ...baseSheets, [swapCharId]: swapSheet };
          const oldDamage = teamBuild.getComboDamageResult(
            combo,
            sheets,
            team.calcContext
          ).totalDamage;

          // New path: compiled AST
          const vars = new Float64Array(compiled.numVars);
          vars.fill(0);
          fillVarsFromSheet(swapSheet, compiled.varMapping, charIdx, vars);
          const newDamage = compiled.evaluate(vars);

          const relErr =
            oldDamage === 0
              ? newDamage === 0
                ? 0
                : Number.POSITIVE_INFINITY
              : Math.abs(newDamage - oldDamage) / Math.abs(oldDamage);

          if (relErr > 1e-9) {
            teamMismatches++;
            if (teamMismatches <= 3) {
              console.log(
                `  ${C.red}MISMATCH${C.reset} ${team.teamName} swap=${swapCharId} trial=${t}: ` +
                  `old=${oldDamage.toFixed(2)} new=${newDamage.toFixed(2)} ` +
                  `relErr=${(relErr * 100).toFixed(6)}%`
              );
            }
          }
          totalTrials++;
        }
      } catch (e) {
        teamErrors++;
        totalErrors++;
        console.log(
          `  ${C.red}ERROR${C.reset} ${team.teamName} swap=${swapCharId}: ${e instanceof Error ? e.message : e}`
        );
      }
    }

    totalMismatches += teamMismatches;
    const status =
      teamMismatches === 0 && teamErrors === 0
        ? `${C.green}ok${C.reset}`
        : teamMismatches > 0
          ? `${C.red}X ${teamMismatches} mismatches${C.reset}`
          : `${C.red}X ${teamErrors} errors${C.reset}`;
    console.log(
      `  ${status} ${team.teamName} (${comboLines.length} formulas, ${team.charIds.length} swap chars × ${opts.trials} trials)`
    );
    if (teamMismatches === 0 && teamErrors === 0) totalTeamsOk++;
  }

  console.log(
    `\n${C.bold}═══ Fuzz-Combo Summary ═══${C.reset}\n` +
      `  Teams:            ${totalTeamsOk}/${teams.length} OK\n` +
      `  Total trials:     ${totalTrials}\n` +
      `  Mismatches:       ${totalMismatches === 0 ? `${C.green}0${C.reset}` : `${C.red}${totalMismatches}${C.reset}`}\n` +
      `  Compile errors:   ${totalErrors === 0 ? "0" : `${C.red}${totalErrors}${C.reset}`}`
  );

  process.exit(totalMismatches > 0 || totalErrors > 0 ? 1 : 0);
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function parseFlagInt(
  args: string[],
  flag: string,
  defaultVal: number
): number {
  const val = parseFlag(args, flag);
  return val !== undefined ? Number.parseInt(val) : defaultVal;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(
      "Usage:\n" +
        "  benchmark init <account.json>    Initialize fixtures\n" +
        "  benchmark seed <results.json>... Import solutions from testbed results\n" +
        "  benchmark run [options]           Run benchmark\n" +
        "  benchmark verify                  Re-evaluate stored solutions\n" +
        "  benchmark status                  Show solution store\n" +
        "  benchmark refresh                 Re-import & cache problem configs from presets\n" +
        "  benchmark enrich [options]        Generate solutions from backup algorithms\n" +
        "  benchmark compare --problem KEY   StatSheet diff between current & best solution\n" +
        "\nCommon options:\n" +
        "  --filter PATTERN   Filter by team/char name\n" +
        "  --problem KEY      Run single problem (supports partial match)\n" +
        "  --timeout SECS     Per-team timeout (default: 30)\n" +
        "  --algo v1|v2|astar|mona|monaV2       Algorithm (default: v2 for run, v1 for enrich)\n" +
        "  --parallel N       Run N problems in parallel (default: CPU cores - 4)\n" +
        "  --sequential       Disable parallelism (requires --filter or --problem)\n" +
        "  --max-arts N       Max artifacts per slot for B&B pre-filtering\n" +
        "  --diag             Enable diagnostic logging"
    );
    process.exit(0);
  }

  switch (command) {
    case "init": {
      const accountFile = args[1];
      if (!accountFile) {
        console.error("Usage: benchmark init <account.json>");
        process.exit(1);
      }
      await cmdInit(accountFile);
      break;
    }

    case "seed": {
      const files = args.slice(1);
      if (files.length === 0) {
        console.error(
          "Usage: benchmark seed <results.json> [results2.json ...]"
        );
        process.exit(1);
      }
      await cmdSeed(files);
      break;
    }

    case "verify": {
      await cmdVerify();
      break;
    }

    case "purge-invalid": {
      await cmdPurgeInvalid();
      break;
    }

    case "run": {
      const filter = parseFlag(args, "--filter");
      const problemKey = parseFlag(args, "--problem");
      if (args.includes("--sequential") && !filter && !problemKey) {
        console.error(
          "Error: --sequential requires --filter or --problem to avoid running all problems serially.\n" +
            "Use --parallel 1 if you really want single-threaded full runs."
        );
        process.exit(1);
      }
      await cmdRun({
        filter,
        problemKey,
        timeoutSec: parseFlagInt(args, "--timeout", 30),
        algo: (parseFlag(args, "--algo") ?? "v2") as
          | "v1"
          | "v2"
          | "astar"
          | "mona"
          | "monaV2",
        parallel: args.includes("--sequential")
          ? 0
          : parseFlagInt(
              args,
              "--parallel",
              Math.max(1, availableParallelism() - 4)
            ),
        maxArtsPerSlot: parseFlagInt(args, "--max-arts", 0),
        diag: args.includes("--diag"),
        lagrangian: args.includes("--lagrangian"),
      });
      break;
    }

    case "status": {
      await cmdStatus();
      break;
    }

    case "refresh": {
      await cmdRefresh();
      break;
    }

    case "enrich": {
      const enrichFilter = parseFlag(args, "--filter");
      const enrichProblemKey = parseFlag(args, "--problem");
      if (args.includes("--sequential") && !enrichFilter && !enrichProblemKey) {
        console.error(
          "Error: --sequential requires --filter or --problem to avoid running all problems serially.\n" +
            "Use --parallel 1 if you really want single-threaded full runs."
        );
        process.exit(1);
      }
      await cmdEnrich({
        filter: enrichFilter,
        problemKey: enrichProblemKey,
        algo: (parseFlag(args, "--algo") ?? "v1") as
          | "v1"
          | "v2"
          | "astar"
          | "mona"
          | "monaV2",
        timeoutSec: parseFlagInt(args, "--timeout", 30),
        parallel: args.includes("--sequential")
          ? 0
          : parseFlagInt(
              args,
              "--parallel",
              Math.max(1, availableParallelism() - 4)
            ),
        maxArtsPerSlot: parseFlagInt(args, "--max-arts", 0),
        diag: args.includes("--diag"),
      });
      break;
    }

    case "compare": {
      const problemKey = parseFlag(args, "--problem");
      if (!problemKey) {
        console.error(
          "Usage: benchmark compare --problem KEY [--algo v1|v2|astar|mona|monaV2] [--timeout SECS]"
        );
        process.exit(1);
      }
      await cmdCompare({
        problemKey,
        algo: parseFlag(args, "--algo") as
          | "v1"
          | "v2"
          | "astar"
          | "mona"
          | "monaV2"
          | undefined,
        timeoutSec: parseFlagInt(args, "--timeout", 30),
        maxArtsPerSlot: parseFlagInt(args, "--max-arts", 0),
        diag: args.includes("--diag"),
      });
      break;
    }

    case "reverse-weights": {
      const filter =
        parseFlag(args, "--filter") || parseFlag(args, "--problem");
      await cmdReverseWeights(filter ?? undefined);
      break;
    }

    case "carry-diagnose": {
      const problemKey = parseFlag(args, "--problem");
      if (!problemKey) {
        console.error(
          "Usage: benchmark carry-diagnose --problem KEY [--timeout SECS]"
        );
        process.exit(1);
      }
      await cmdCarryDiagnose({
        problemKey,
        timeoutSec: parseFlagInt(args, "--timeout", 120),
      });
      break;
    }

    case "fuzz": {
      await cmdFuzz({
        filter: parseFlag(args, "--filter"),
        problemKey: parseFlag(args, "--problem"),
        trials: parseFlagInt(args, "--trials", 200),
      });
      break;
    }

    case "fuzz-combo": {
      await cmdFuzzCombo({
        filter: parseFlag(args, "--filter"),
        problemKey: parseFlag(args, "--problem"),
        trials: parseFlagInt(args, "--trials", 50),
      });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

const _thisFile = fileURLToPath(import.meta.url);
const _entryFile = process.argv[1];
if (_entryFile && resolve(_entryFile) === resolve(_thisFile)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
