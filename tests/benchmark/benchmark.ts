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
 *
 * Common options:
 *   --filter PATTERN          Filter problems by team/char name
 *   --problem KEY             Run a single problem by key (teamId::formulaId)
 *   --timeout SECS            Per-team timeout (default: 30)
 *   --algo v1|v2              Algorithm to run (default: v2)
 *   --parallel N              Run N problems in parallel via child_process.fork
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
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { AccountData, ArtifactData } from "@/data/types";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  CharCompConfig,
  StatKey,
} from "@/lib/team-comp/types";
import type { PerCharConfig } from "@/lib/team-comp/types";

import {
  C,
  DEFAULT_CALC_CONTEXT,
  DEFAULT_GLOBAL_CONFIG,
  type Team,
  type TeamResult,
  buildCharCompConfig,
  buildPerChar,
  fmt,
  getAllArtifacts,
  getArtifactSetRarity,
  getCarryFormulaIds,
  loadAccountData,
  loadTeamPreset,
  preloadGameStats,
  runOptimizerOnTeam,
} from "./runner";

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = resolve("tests/benchmark/data");
const ACCOUNT_PATH = resolve(DATA_DIR, "account.json");
const SOLUTIONS_PATH = resolve(DATA_DIR, "solutions.json");
const PROBLEMS_PATH = resolve(DATA_DIR, "problems.json");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Solution {
  /** charId -> slotKey -> artifactId */
  artifactAssignment: Record<string, Record<string, string>>;
  /** Damage when this solution was recorded */
  recordedDamage: number;
  /** ISO timestamp */
  foundAt: string;
  /** Algorithm that found it */
  algorithm: string;
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
  configs: CharCompConfig[];
  combatOpts: Record<string, string>;
  enemyElementAura?: string;
  calcContext: CalcContext;
  perChar: Record<string, PerCharConfig>;
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
 */
function evaluateAssignment(
  team: Team,
  formulaId: string,
  assignment: Record<string, Record<string, string>>,
  accountData: AccountData,
  inventory: ArtifactData[]
): number | null {
  const artById = new Map<string, ArtifactData>();
  for (const a of inventory) artById.set(a.id, a);

  for (const slots of Object.values(assignment)) {
    for (const artId of Object.values(slots)) {
      if (!artById.has(artId)) return null;
    }
  }

  try {
    const configs: CharCompConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildCharCompConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }
    if (configs.length === 0) return null;

    const teamBuild = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyElementAura as import("@/data/types").Element | undefined
    );

    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      assumeCrit:
        team.calcContext?.assumeCrit ?? DEFAULT_CALC_CONTEXT.assumeCrit,
    };

    const carryCharId = team.characters[0]!;

    const artifactStats: Record<string, StatSheet> = {};
    for (const [cid, slots] of Object.entries(assignment)) {
      const pieces: ArtifactData[] = [];
      for (const artId of Object.values(slots)) {
        const art = artById.get(artId);
        if (art) pieces.push(art);
      }
      artifactStats[cid] = StatSheet.fromArtifacts(pieces);
    }

    const postStats = teamBuild.getTeamStats(
      artifactStats,
      carryCharId,
      calcContext
    );
    const dmg = teamBuild.getDamageResult(
      carryCharId,
      formulaId,
      postStats,
      calcContext
    );
    return dmg.totalDamage;
  } catch {
    return null;
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

// ─── Parallel Worker Pool ────────────────────────────────────────────────────

async function runParallel(
  tasks: { team: Team; formulaId: string; key: string }[],
  algorithm: "v1" | "v2",
  timeoutSec: number,
  workerCount: number,
  maxArtsPerSlot: number,
  diag: boolean,
  onResult: (taskIdx: number, result: TeamResult) => void
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
        const { team, formulaId } = tasks[idx];
        const perCharMs =
          algorithm === "v2" ? (timeoutSec * 1000) / 4 : undefined;
        // Override team's selectedFormula so worker optimizes the right formula
        const teamForWorker = {
          ...team,
          selectedFormula: { charId: team.characters[0]!, formulaId },
        };
        child.send({
          type: "run",
          team: teamForWorker,
          algorithm,
          timeoutMs: timeoutSec * 1000,
          perCharMs,
          maxArtsPerSlot: maxArtsPerSlot || undefined,
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
  const store = loadStore();

  if (!existsSync(ACCOUNT_PATH)) {
    console.error(
      `${C.red}No account fixture found. Run 'init' first.${C.reset}`
    );
    process.exit(1);
  }

  await preloadGameStats();
  const teamPreset = loadTeamPreset();
  const teamById = new Map<string, Team>();
  for (const t of teamPreset.teams) teamById.set(t.id, t);

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

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

      if (
        !r.artifactAssignment ||
        Object.keys(r.artifactAssignment).length === 0
      ) {
        skipped++;
        continue;
      }
      if (r.optimizedDamage <= 0) {
        skipped++;
        continue;
      }

      if (!store.problems[problemKey]) {
        store.problems[problemKey] = {
          teamId: baseTeamId,
          teamName:
            r.teamName?.replace(/ \[.*\]$/, "") ?? r.characters.join("/"),
          characters: r.characters,
          carryCharId: r.carryCharId,
          formulaId,
          solutions: [],
        };
      }

      const problem = store.problems[problemKey];
      const isDuplicate = problem.solutions.some((s) =>
        assignmentsEqual(s.artifactAssignment, r.artifactAssignment)
      );

      if (isDuplicate) {
        duplicates++;
        continue;
      }

      problem.solutions.push({
        artifactAssignment: r.artifactAssignment,
        recordedDamage: r.optimizedDamage,
        foundAt: data.timestamp ?? new Date().toISOString(),
        algorithm: algo,
      });
      imported++;
    }
  }

  saveStore(store);
  console.log(
    `\n${C.green}Imported ${imported} solutions${C.reset} (${duplicates} duplicates, ${skipped} skipped)`
  );
  console.log(
    `Solution store: ${Object.keys(store.problems).length} problems, ` +
      `${Object.values(store.problems).reduce((s, p) => s + p.solutions.length, 0)} total solutions`
  );
}

async function cmdVerify(): Promise<void> {
  const store = loadStore();
  if (!existsSync(ACCOUNT_PATH)) {
    console.error(`${C.red}No account fixture. Run 'init' first.${C.reset}`);
    process.exit(1);
  }

  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);
  const teamPreset = loadTeamPreset();
  const teamById = new Map<string, Team>();
  for (const t of teamPreset.teams) teamById.set(t.id, t);

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

    for (let si = 0; si < problem.solutions.length; si++) {
      totalSolutions++;
      const sol = problem.solutions[si];
      const dmg = evaluateAssignment(
        team,
        problem.formulaId,
        sol.artifactAssignment,
        accountData,
        inventory
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

async function cmdRun(opts: {
  filter?: string;
  problemKey?: string;
  timeoutSec: number;
  algo: "v1" | "v2";
  parallel: number;
  maxArtsPerSlot: number;
  diag: boolean;
}): Promise<void> {
  const store = loadStore();
  if (!existsSync(ACCOUNT_PATH)) {
    console.error(`${C.red}No account fixture. Run 'init' first.${C.reset}`);
    process.exit(1);
  }

  if (opts.diag) {
    (globalThis as unknown as Record<string, boolean>).__TEAM_OPT_DIAG__ = true;
  }

  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);
  const teamPreset = loadTeamPreset();
  const teamById = new Map<string, Team>();
  for (const t of teamPreset.teams) teamById.set(t.id, t);

  // Build problem list
  type ProblemRun = {
    key: string;
    team: Team;
    formulaId: string;
    label: string;
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
      });
    }
  } else {
    for (const team of teamPreset.teams) {
      const formulas = getCarryFormulaIds(team);
      for (const { formulaId, label } of formulas) {
        const key = `${team.id}::${formulaId}`;
        if (
          opts.filter &&
          !key.toLowerCase().includes(opts.filter.toLowerCase()) &&
          !team.name?.toLowerCase().includes(opts.filter.toLowerCase()) &&
          !team.characters.some((c) =>
            c?.toLowerCase().includes(opts.filter!.toLowerCase())
          )
        ) {
          continue;
        }
        problemsToRun.push({ key, team, formulaId, label });
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
  const regList: {
    key: string;
    comp: RunComparison & { status: "regression" };
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

    const problem = store.problems[key];
    let comp: RunComparison;

    if (!problem || problem.solutions.length === 0) {
      comp = { status: "no_solutions", damage: result.optimizedDamage };
    } else {
      let bestDamage = Number.NEGATIVE_INFINITY;
      for (const sol of problem.solutions) {
        const dmg = evaluateAssignment(
          team,
          formulaId,
          sol.artifactAssignment,
          accountData,
          inventory
        );
        if (dmg !== null && dmg > bestDamage) bestDamage = dmg;
      }

      if (bestDamage <= 0) {
        comp = { status: "no_solutions", damage: result.optimizedDamage };
      } else if (result.optimizedDamage > bestDamage + 0.5) {
        comp = { status: "new_best", damage: result.optimizedDamage };
      } else if (result.optimizedDamage >= bestDamage - 0.5) {
        comp = {
          status: "matched_best",
          damage: result.optimizedDamage,
          bestDamage,
        };
      } else {
        const pct = ((result.optimizedDamage - bestDamage) / bestDamage) * 100;
        comp = {
          status: "regression",
          damage: result.optimizedDamage,
          bestDamage,
          pct,
        };
      }
    }

    const charNames = team.characters.filter(Boolean).join("/");
    const statusIcon =
      comp.status === "new_best"
        ? `${C.green}★${C.reset}`
        : comp.status === "matched_best"
          ? `${C.green}✓${C.reset}`
          : comp.status === "regression"
            ? `${C.red}✗${C.reset}`
            : `${C.cyan}+${C.reset}`;

    const timeStr = `${result.optimizeTimeSec.toFixed(1)}s`;
    let extraInfo = "";
    if (comp.status === "regression") {
      extraInfo = ` ${C.red}(${comp.pct.toFixed(2)}% vs best ${fmt(comp.bestDamage)})${C.reset}`;
    } else if (comp.status === "new_best") {
      extraInfo = ` ${C.green}NEW BEST${C.reset}`;
    }

    console.log(
      `  ${statusIcon} ${ri + 1}/${problemsToRun.length} ${C.bold}${charNames}${C.reset} → ${formulaId} ` +
        `(${timeStr}) ${C.cyan}${fmt(result.optimizedDamage)}${C.reset}${extraInfo}`
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

    // Add solution to store if assignment differs
    if (
      result.artifactAssignment &&
      Object.keys(result.artifactAssignment).length > 0 &&
      result.optimizedDamage > 0
    ) {
      if (!store.problems[key]) {
        const charIds = team.characters.filter((c): c is string => !!c);
        store.problems[key] = {
          teamId: team.id,
          teamName: charIds.join("/"),
          characters: charIds,
          carryCharId: team.characters[0]!,
          formulaId,
          solutions: [],
        };
      }

      const existing = store.problems[key].solutions;
      const isDuplicate = existing.some((s) =>
        assignmentsEqual(s.artifactAssignment, result.artifactAssignment)
      );

      if (!isDuplicate) {
        existing.push({
          artifactAssignment: result.artifactAssignment,
          recordedDamage: result.optimizedDamage,
          foundAt: new Date().toISOString(),
          algorithm: opts.algo,
        });
      }
    }
  }

  if (opts.parallel > 0) {
    // Parallel execution
    const tasks = problemsToRun.map((p) => ({
      team: p.team,
      formulaId: p.formulaId,
      key: p.key,
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
      }
    );
  } else {
    // Sequential execution
    for (let ri = 0; ri < problemsToRun.length; ri++) {
      const { key, team, formulaId } = problemsToRun[ri];
      const result = await runOptimizerOnTeam(
        team,
        accountData,
        inventory,
        opts.algo,
        opts.timeoutSec * 1000,
        opts.algo === "v2" ? (opts.timeoutSec * 1000) / 4 : undefined,
        formulaId,
        opts.maxArtsPerSlot || undefined
      );
      processResult(ri, key, team, formulaId, result);
    }
  }

  saveStore(store);

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

  if (regressions > 0) {
    console.log(
      `\n${C.red}FAIL: ${regressions} regression(s) detected${C.reset}`
    );
    process.exit(1);
  }
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
  if (!existsSync(ACCOUNT_PATH)) {
    console.error(`${C.red}No account fixture. Run 'init' first.${C.reset}`);
    process.exit(1);
  }

  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const teamPreset = loadTeamPreset();
  const store = loadStore();

  const cached: CachedProblem[] = [];
  let skipped = 0;

  for (const team of teamPreset.teams) {
    const carryCharId = team.characters[0];
    if (!carryCharId) continue;

    const configs: CharCompConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildCharCompConfig(team, i, accountData);
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
      assumeCrit:
        team.calcContext?.assumeCrit ?? DEFAULT_CALC_CONTEXT.assumeCrit,
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
        enemyElementAura: team.enemyElementAura,
        calcContext,
        perChar,
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
  algo: "v1" | "v2";
  timeoutSec: number;
  parallel: number;
  maxArtsPerSlot: number;
  diag: boolean;
}): Promise<void> {
  const store = loadStore();
  if (!existsSync(ACCOUNT_PATH)) {
    console.error(`${C.red}No account fixture. Run 'init' first.${C.reset}`);
    process.exit(1);
  }

  if (opts.diag) {
    (globalThis as unknown as Record<string, boolean>).__TEAM_OPT_DIAG__ = true;
  }

  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);
  const teamPreset = loadTeamPreset();
  const teamById = new Map<string, Team>();
  for (const t of teamPreset.teams) teamById.set(t.id, t);

  const problemKeys = Object.keys(store.problems).sort();
  const toRun: { key: string; team: Team; formulaId: string }[] = [];

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
    toRun.push({ key, team, formulaId: problem.formulaId });
  }

  console.log(
    `\n${C.bold}═══ Enriching ${toRun.length} problems with ${opts.algo.toUpperCase()} (${opts.timeoutSec}s timeout${opts.parallel > 0 ? `, ${opts.parallel} workers` : ""}) ═══${C.reset}\n`
  );

  let added = 0;
  let duplicates = 0;
  let errors = 0;

  function processEnrichResult(
    i: number,
    key: string,
    team: Team,
    formulaId: string,
    result: TeamResult
  ): void {
    const problem = store.problems[key];
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

    const isDuplicate = problem.solutions.some((s) =>
      assignmentsEqual(s.artifactAssignment, result.artifactAssignment)
    );

    if (isDuplicate) {
      duplicates++;
      console.log(
        `  ${C.dim}[DUP]${C.reset} ${i + 1}/${toRun.length} ${charNames} → ${formulaId} ${C.cyan}${fmt(result.optimizedDamage)}${C.reset}`
      );
    } else {
      added++;
      problem.solutions.push({
        artifactAssignment: result.artifactAssignment,
        recordedDamage: result.optimizedDamage,
        foundAt: new Date().toISOString(),
        algorithm: opts.algo,
      });

      const bestDmg = Math.max(
        ...problem.solutions.map((s) => s.recordedDamage)
      );
      const isNewBest = result.optimizedDamage >= bestDmg - 0.5;
      const icon = isNewBest ? `${C.green}★${C.reset}` : `${C.cyan}+${C.reset}`;
      console.log(
        `  ${icon} ${i + 1}/${toRun.length} ${charNames} → ${formulaId} ${C.cyan}${fmt(result.optimizedDamage)}${C.reset}${isNewBest ? ` ${C.green}NEW BEST${C.reset}` : ""}`
      );
    }
  }

  if (opts.parallel > 0) {
    const tasks = toRun.map((p) => ({
      team: p.team,
      formulaId: p.formulaId,
      key: p.key,
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
      const { key, team, formulaId } = toRun[i];
      const result = await runOptimizerOnTeam(
        team,
        accountData,
        inventory,
        opts.algo,
        opts.timeoutSec * 1000,
        opts.algo === "v2" ? (opts.timeoutSec * 1000) / 4 : undefined,
        formulaId,
        opts.maxArtsPerSlot || undefined
      );
      processEnrichResult(i, key, team, formulaId, result);
    }
  }

  saveStore(store);
  console.log(
    `\n${C.green}Enriched: ${added} new solutions${C.reset} (${duplicates} duplicates, ${errors} errors)`
  );
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
  algo?: "v1" | "v2";
  timeoutSec: number;
  maxArtsPerSlot: number;
  diag: boolean;
}): Promise<void> {
  const store = loadStore();
  if (!existsSync(ACCOUNT_PATH)) {
    console.error(`${C.red}No account fixture. Run 'init' first.${C.reset}`);
    process.exit(1);
  }

  if (opts.diag) {
    (globalThis as unknown as Record<string, boolean>).__TEAM_OPT_DIAG__ = true;
  }

  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);
  const artById = new Map<string, ArtifactData>();
  for (const a of inventory) artById.set(a.id, a);

  const teamPreset = loadTeamPreset();
  const teamById = new Map<string, Team>();
  for (const t of teamPreset.teams) teamById.set(t.id, t);

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

    // Find best stored solution
    let bestSol: Solution | null = null;
    let bestDamage = Number.NEGATIVE_INFINITY;
    for (const sol of problem.solutions) {
      const dmg = evaluateAssignment(
        team,
        problem.formulaId,
        sol.artifactAssignment,
        accountData,
        inventory
      );
      if (dmg !== null && dmg > bestDamage) {
        bestDamage = dmg;
        bestSol = sol;
      }
    }

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
        opts.algo === "v2" ? (opts.timeoutSec * 1000) / 4 : undefined,
        problem.formulaId,
        opts.maxArtsPerSlot || undefined
      );

      if (result.error) {
        console.log(`  ${C.red}Optimizer error: ${result.error}${C.reset}`);
        continue;
      }

      currentAssignment = result.artifactAssignment;
      currentDamage = result.optimizedDamage;

      const pct = ((currentDamage - bestDamage) / bestDamage) * 100;
      const color = currentDamage >= bestDamage - 0.5 ? C.green : C.red;
      console.log(
        `  ${C.bold}Current ${opts.algo.toUpperCase()}:${C.reset} ${color}${fmt(currentDamage)}${C.reset} (${pct >= 0 ? "+" : ""}${pct.toFixed(3)}%)`
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
        inventory
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
    const configs: CharCompConfig[] = [];
    for (let i = 0; i < team.characters.length; i++) {
      const cfg = buildCharCompConfig(team, i, accountData);
      if (cfg) configs.push(cfg);
    }
    if (configs.length === 0) continue;

    const teamBuild = new TeamBuild(
      configs,
      team.opts || {},
      team.enemyElementAura as import("@/data/types").Element | undefined
    );
    const calcContext: CalcContext = {
      enemyLevel:
        team.calcContext?.enemyLevel ?? DEFAULT_CALC_CONTEXT.enemyLevel,
      enemyRes: team.calcContext?.enemyRes ?? DEFAULT_CALC_CONTEXT.enemyRes,
      assumeCrit:
        team.calcContext?.assumeCrit ?? DEFAULT_CALC_CONTEXT.assumeCrit,
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

    // Auto-add current solution if it's new
    if (
      currentDamage > 0 &&
      currentAssignment &&
      !problem.solutions.some((s) =>
        assignmentsEqual(s.artifactAssignment, currentAssignment!)
      )
    ) {
      problem.solutions.push({
        artifactAssignment: currentAssignment,
        recordedDamage: currentDamage,
        foundAt: new Date().toISOString(),
        algorithm: opts.algo ?? "compare",
      });
      saveStore(store);
      console.log(`\n  ${C.cyan}Added as new solution${C.reset}`);
    }
  }
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

// ─── Main ────────────────────────────────────────────────────────────────────

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
        "  --algo v1|v2       Algorithm (default: v2 for run, v1 for enrich)\n" +
        "  --parallel N       Run N problems in parallel via child_process.fork\n" +
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

    case "run": {
      await cmdRun({
        filter: parseFlag(args, "--filter"),
        problemKey: parseFlag(args, "--problem"),
        timeoutSec: parseFlagInt(args, "--timeout", 30),
        algo: (parseFlag(args, "--algo") ?? "v2") as "v1" | "v2",
        parallel: parseFlagInt(args, "--parallel", 0),
        maxArtsPerSlot: parseFlagInt(args, "--max-arts", 0),
        diag: args.includes("--diag"),
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
      await cmdEnrich({
        filter: parseFlag(args, "--filter"),
        problemKey: parseFlag(args, "--problem"),
        algo: (parseFlag(args, "--algo") ?? "v1") as "v1" | "v2",
        timeoutSec: parseFlagInt(args, "--timeout", 30),
        parallel: parseFlagInt(args, "--parallel", 0),
        maxArtsPerSlot: parseFlagInt(args, "--max-arts", 0),
        diag: args.includes("--diag"),
      });
      break;
    }

    case "compare": {
      const problemKey = parseFlag(args, "--problem");
      if (!problemKey) {
        console.error(
          "Usage: benchmark compare --problem KEY [--algo v1|v2] [--timeout SECS]"
        );
        process.exit(1);
      }
      await cmdCompare({
        problemKey,
        algo: parseFlag(args, "--algo") as "v1" | "v2" | undefined,
        timeoutSec: parseFlagInt(args, "--timeout", 30),
        maxArtsPerSlot: parseFlagInt(args, "--max-arts", 0),
        diag: args.includes("--diag"),
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
