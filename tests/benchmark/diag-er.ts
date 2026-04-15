#!/usr/bin/env tsx
/**
 * Diagnostic: Compare compiled ER check vs getTeamStats ER for a constraint-failing team.
 * Run: npx tsx --tsconfig tsconfig.test.json tests/benchmark/diag-er.ts
 */

import "@/lib/team-comp/index";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ArtifactData, Element } from "@/data/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/formulaCompiler";
import { ConstraintChecker } from "@/lib/team-comp/optimizer/constraintChecker";
import { defaultOnFieldCharId } from "@/lib/team-comp/reactionResolve";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/team-comp/types";

import {
  type Team,
  preloadGameStats as benchPreload,
  buildPerChar,
  buildTeamSlotConfig,
  getAllArtifacts,
  loadAccountData,
  loadTeamPreset,
  runOptimizerOnTeam,
} from "./runner";

async function main() {
  await preloadGameStats();

  // Load problem cache
  const problemsPath = resolve("tests/benchmark/data/problems.json");
  const problemsData = JSON.parse(readFileSync(problemsPath, "utf-8"));

  // Find the ayato problem
  const cachedProblem = problemsData.problems.find(
    (p: { key?: string }) =>
      p.key?.includes("PwS4YGfWKKLK2JX8WT") &&
      p.key?.includes("ayato-shunsuiken")
  );
  if (!cachedProblem) {
    console.log("Cached problem not found, available keys:");
    for (const p of problemsData.problems.slice(0, 5)) console.log(" ", p.key);
    return;
  }

  console.log(`Problem: ${cachedProblem.key}`);
  console.log(`Team: ${cachedProblem.teamName}`);

  const configs: TeamSlotConfig[] = cachedProblem.configs;
  const teamBuild = new TeamBuild(
    configs,
    cachedProblem.combatOpts || {},
    cachedProblem.enemyAura as Element | undefined
  );
  const calcContext: CalcContext = cachedProblem.calcContext ?? {
    enemyLevel: 100,
    enemyRes: 0.1,
  };
  const carryCharId = cachedProblem.carryCharId;
  const constraintCharId = "kaedehara_kazuha";
  const minEr = cachedProblem.perChar?.[constraintCharId]?.minEr ?? 2.0;

  console.log(`Carry: ${carryCharId}`);
  console.log(
    `Constraint char: ${constraintCharId}, minEr: ${(minEr * 100).toFixed(0)}%`
  );

  // Base sheets: empty for all chars (same as optimizer init)
  const emptySheets: Record<string, StatSheet> = {};
  for (const cfg of configs) emptySheets[cfg.charId] = new StatSheet([]);

  // ConstraintChecker erFloor (what B&B uses)
  const checker = new ConstraintChecker(
    teamBuild,
    constraintCharId,
    emptySheets,
    calcContext,
    minEr,
    0
  );
  console.log(
    `\nConstraintChecker erFloor (empty sheets): ${(checker.erFloor * 100).toFixed(4)}%`
  );
  console.log(`erGap: ${(checker.erGap * 100).toFixed(4)}%`);

  // Compile combo with ER check
  const combo: ComboFormula = {
    id: "ayato-shunsuiken",
    label: { zh: "", en: "" },
    lines: [{ charId: carryCharId, formulaId: "ayato-shunsuiken", count: 1 }],
  };

  const compiled = compileComboTeamDamage(
    teamBuild,
    combo,
    constraintCharId,
    emptySheets,
    calcContext,
    undefined,
    constraintCharId,
    minEr,
    0
  );

  console.log(`\nCompiled formula: numVars=${compiled.numVars}`);
  console.log(`Has evaluateEr: ${!!compiled.evaluateEr}`);

  if (compiled.evaluateEr) {
    // Test 1: empty vars (should give erFloor - minEr)
    const emptyVars = new Float64Array(compiled.numVars);
    const erEmpty = compiled.evaluateEr(emptyVars);
    console.log(
      `evaluateEr(empty): ${erEmpty.toFixed(6)} → ER = ${((erEmpty + minEr) * 100).toFixed(4)}%`
    );
    console.log(
      `Expected (erFloor - minEr): ${(checker.erFloor - minEr).toFixed(6)}`
    );
    console.log(
      `Match: ${Math.abs(erEmpty - (checker.erFloor - minEr)) < 1e-6}`
    );

    // Test 2: fill with a known ER sands (should add ~51.8% ER)
    // Create a fake artifact stat sheet with just ER
    const testErSheet = new StatSheet([{ key: "er", value: 0.518 }]);
    const testVars = new Float64Array(compiled.numVars);
    const constraintCharIdx = compiled.charIdxMap?.get(constraintCharId) ?? 0;
    fillVarsFromSheet(
      testErSheet,
      compiled.varMapping,
      constraintCharIdx,
      testVars
    );
    const erWithSands = compiled.evaluateEr(testVars);
    console.log(
      `\nevaluateEr(+51.8% ER): ${erWithSands.toFixed(6)} → ER = ${((erWithSands + minEr) * 100).toFixed(4)}%`
    );
    console.log(
      `Expected ER: ${((checker.erFloor + 0.518) * 100).toFixed(4)}%`
    );

    // Test 3: getTeamStats with the same sheet
    const sheetsWithEr = { ...emptySheets, [constraintCharId]: testErSheet };
    const statsWithEr = teamBuild.getTeamStats(
      sheetsWithEr,
      carryCharId,
      calcContext
    );
    const gtsEr = statsWithEr[constraintCharId]?.get("er", null) ?? 0;
    console.log(`getTeamStats ER: ${(gtsEr * 100).toFixed(4)}%`);
    console.log(
      `Compiled ER vs getTeamStats ER: diff = ${((erWithSands + minEr - gtsEr) * 100).toFixed(6)}%`
    );
  }

  // Print all chars' ER in various scenarios
  console.log("\n=== ER for all chars with empty sheets ===");
  const allStats = teamBuild.getTeamStats(
    emptySheets,
    carryCharId,
    calcContext
  );
  for (const cfg of configs) {
    const er = allStats[cfg.charId]?.get("er", null) ?? 0;
    console.log(`  ${cfg.charId}: ${(er * 100).toFixed(2)}%`);
  }

  console.log("\n=== ER for all chars with default off-field ===");
  const offFieldCharId = defaultOnFieldCharId(carryCharId, configs);
  const nullStats = teamBuild.getTeamStats(
    emptySheets,
    offFieldCharId,
    calcContext
  );
  for (const cfg of configs) {
    const er = nullStats[cfg.charId]?.get("er", null) ?? 0;
    console.log(`  ${cfg.charId}: ${(er * 100).toFixed(2)}%`);
  }
}

main().catch(console.error);
