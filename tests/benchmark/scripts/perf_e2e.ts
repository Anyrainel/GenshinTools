#!/usr/bin/env tsx
/**
 * E2E performance comparison: full optimizer pipeline with and without AST.
 */
import "@/lib/team-comp/index";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import { runCharacterBnB } from "@/lib/team-comp/optimizer/characterBnB";
import type { GlobalStatWeights } from "@/data/types";
import type { CalcContext, CharCompConfig, PerCharConfig } from "@/lib/team-comp/types";
import { loadAccountData, getAllArtifacts } from "../runner";

const ACCOUNT_PATH = "tests/benchmark/data/account.json";

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const TEAMS: { label: string; configs: CharCompConfig[] }[] = [
  {
    label: "clorinde",
    configs: [
      { charId: "clorinde", charLevel: 90, constellation: 0, weaponId: "absolution", refinement: 1, artifactSetId: "fragment_of_harmonic_whimsy", artifactHalfSetIds: [] },
      { charId: "columbina", charLevel: 90, constellation: 0, weaponId: "nocturnes_curtain_call", refinement: 1, artifactSetId: "aubade_of_morningstar_and_moon", artifactHalfSetIds: [] },
      { charId: "ineffa", charLevel: 90, constellation: 0, weaponId: "fractured_halo", refinement: 1, artifactSetId: "silken_moons_serenade", artifactHalfSetIds: [] },
      { charId: "xilonen", charLevel: 90, constellation: 6, weaponId: "peak_patrol_song", refinement: 1, artifactSetId: "scroll_of_the_hero_of_cinder_city", artifactHalfSetIds: [] },
    ],
  },
  {
    label: "varka",
    configs: [
      { charId: "varka", charLevel: 90, constellation: 0, weaponId: "gest_of_the_mighty_wolf", refinement: 1, artifactSetId: "a_day_carved_from_rising_winds", artifactHalfSetIds: [] },
      { charId: "durin", charLevel: 90, constellation: 0, weaponId: "absolution", refinement: 1, artifactSetId: "noblesse_oblige", artifactHalfSetIds: [] },
      { charId: "venti", charLevel: 90, constellation: 0, weaponId: "elegy_for_the_end", refinement: 1, artifactSetId: "viridescent_venerer", artifactHalfSetIds: [] },
      { charId: "bennett", charLevel: 90, constellation: 6, weaponId: "aquila_favonia", refinement: 1, artifactSetId: "noblesse_oblige", artifactHalfSetIds: [] },
    ],
  },
  {
    label: "chasca",
    configs: [
      { charId: "chasca", charLevel: 90, constellation: 0, weaponId: "astral_vultures_crimson_plumage", refinement: 1, artifactSetId: "obsidian_codex", artifactHalfSetIds: [] },
      { charId: "citlali", charLevel: 90, constellation: 0, weaponId: "a_thousand_blazing_suns", refinement: 1, artifactSetId: "scroll_of_the_hero_of_cinder_city", artifactHalfSetIds: [] },
      { charId: "xilonen", charLevel: 90, constellation: 6, weaponId: "peak_patrol_song", refinement: 1, artifactSetId: "instructor", artifactHalfSetIds: [] },
      { charId: "bennett", charLevel: 90, constellation: 6, weaponId: "aquila_favonia", refinement: 1, artifactSetId: "noblesse_oblige", artifactHalfSetIds: [] },
    ],
  },
  {
    label: "raiden",
    configs: [
      { charId: "raiden_shogun", charLevel: 90, constellation: 0, weaponId: "the_catch", refinement: 5, artifactSetId: "emblem_of_severed_fate", artifactHalfSetIds: [] },
      { charId: "xilonen", charLevel: 90, constellation: 6, weaponId: "peak_patrol_song", refinement: 1, artifactSetId: "scroll_of_the_hero_of_cinder_city", artifactHalfSetIds: [] },
      { charId: "columbina", charLevel: 90, constellation: 0, weaponId: "nocturnes_curtain_call", refinement: 1, artifactSetId: "aubade_of_morningstar_and_moon", artifactHalfSetIds: [] },
      { charId: "furina", charLevel: 90, constellation: 0, weaponId: "splendor_of_tranquil_waters", refinement: 1, artifactSetId: "golden_troupe", artifactHalfSetIds: [] },
    ],
  },
];

async function main() {
  await preloadGameStats();
  const accountData = loadAccountData(ACCOUNT_PATH);
  const inventory = getAllArtifacts(accountData);

  const globalConfig: GlobalStatWeights = { flatAtk: 0, flatHp: 0, flatDef: 0 };
  const ctx: CalcContext = { enemyLevel: 100, enemyRes: 0.1 };
  const TIMEOUT_SEC = 5;

  console.log(`Inventory: ${inventory.length} artifacts, timeout: ${TIMEOUT_SEC}s per run\n`);
  console.log("═══ E2E Optimizer: AST vs Standard (same B&B, only eval differs) ═══\n");
  console.log(
    `${"Team".padEnd(15)} ${"Formula".padEnd(25)} ` +
    `${"Std ms".padStart(8)} ${"AST ms".padStart(8)} ${"Speedup".padStart(8)} ` +
    `${"Std evals".padStart(12)} ${"AST evals".padStart(12)} ` +
    `${"Std eval/s".padStart(12)} ${"AST eval/s".padStart(12)} ` +
    `${"Dmg match".padStart(10)}`
  );
  console.log("─".repeat(125));

  for (const { label, configs } of TEAMS) {
    const tb = new TeamBuild(configs);
    const charIds = configs.map((c) => c.charId);
    const carryId = charIds[0];

    const allFormulas = tb.getFormulaIds();
    const formulaIds = Object.keys(allFormulas[carryId] ?? {});

    const baseSheets: Record<string, StatSheet> = {};
    for (const cid of charIds) baseSheets[cid] = new StatSheet([]);

    const charConfig: PerCharConfig = { minEr: 0, minCr: 0 };

    for (const formulaId of formulaIds.slice(0, 1)) {
      // Run 1: Standard (no AST)
      const t0std = performance.now();
      const stdResult = runCharacterBnB(
        carryId, charConfig, tb, carryId, formulaId,
        inventory, globalConfig, baseSheets, ctx,
        undefined, undefined, undefined, 5,
        performance.now() + TIMEOUT_SEC * 1000,
        undefined, 0, true, // _noCompile = true
      );
      const stdMs = performance.now() - t0std;

      // Run 2: AST enabled
      const t0ast = performance.now();
      const astResult = runCharacterBnB(
        carryId, charConfig, tb, carryId, formulaId,
        inventory, globalConfig, baseSheets, ctx,
        undefined, undefined, undefined, 5,
        performance.now() + TIMEOUT_SEC * 1000,
        undefined, 0, false, // _noCompile = false (default, AST enabled)
      );
      const astMs = performance.now() - t0ast;

      const stdDmg = stdResult.collector.best?.damage ?? 0;
      const astDmg = astResult.collector.best?.damage ?? 0;
      const stdEvals = stdResult.evaluations;
      const astEvals = astResult.evaluations;
      const speedup = stdMs / astMs;
      const stdRate = stdEvals / (stdMs / 1000);
      const astRate = astEvals / (astMs / 1000);
      const dmgMatch = stdDmg === 0 ? "n/a" :
        Math.abs(astDmg - stdDmg) / stdDmg < 0.001 ? "✓" :
        `Δ${((astDmg - stdDmg) / stdDmg * 100).toFixed(2)}%`;

      console.log(
        `${label.padEnd(15)} ${formulaId.padEnd(25)} ` +
        `${stdMs.toFixed(0).padStart(8)} ${astMs.toFixed(0).padStart(8)} ${speedup.toFixed(2).padStart(7)}x ` +
        `${fmt(stdEvals).padStart(12)} ${fmt(astEvals).padStart(12)} ` +
        `${fmt(Math.round(stdRate)).padStart(12)} ${fmt(Math.round(astRate)).padStart(12)} ` +
        `${dmgMatch.padStart(10)}`
      );
    }
  }
}

main().catch((e) => console.error(e));
