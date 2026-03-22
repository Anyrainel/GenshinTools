#!/usr/bin/env tsx
/**
 * QA Damage Calculator CLI
 *
 * Validates damage formula implementations against real gameplay evidence from
 * the community (YouTube videos, Reddit posts, theorycrafting spreadsheets).
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/qa-dmg.ts [options] <testcase.json...>
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/qa-dmg.ts [options] <directory/>
 *
 * Options:
 *   --verbose          Show label and note for each formula result
 *   --report-out FILE  Write a Markdown summary report to FILE
 *
 * Test case format: see docs/DmgQA/README.md
 * Run from project root: npm run qa:dmg -- docs/DmgQA/testcases/
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Side-effect barrel: registers all character/weapon/artifact implementations.
import "@/lib/team-comp/index";

import {
  buildArtifactStats,
  type AllBuildsPreset,
  type ArtifactStatsOverride,
  type PresetBuildEntry,
} from "./buildArtifactStats";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import type { StatSheet } from "@/lib/team-comp/damageModels";
import type { CalcContext, TeamSlotConfig } from "@/lib/team-comp/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * QA scenario: level-100 enemy with 10% all elemental/physical resistance.
 * assumeCrit = true gives crit-assuming (expected) damage, not average.
 */
const QA_CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  assumeCrit: true,
};

// ─── Test Case Schema ─────────────────────────────────────────────────────────

interface ArtifactSpec {
  /** "4pc" for a single 4-piece set, "2pc+2pc" for two 2-piece half-sets. */
  type: "4pc" | "2pc+2pc";
  /** Full 4-piece set ID (required for type "4pc"). E.g. "crimson_witch_of_flames". */
  setId?: string;
  /** Half-set ID 1 (required for type "2pc+2pc"). */
  id1?: string;
  /** Half-set ID 2 (required for type "2pc+2pc"). */
  id2?: string;
}

interface RosterEntry {
  charId: string;
  /** Character level. Defaults to 90. */
  charLevel?: number;
  /** Constellation level 0–6. Defaults to 0. */
  constellation?: number;
  weaponId: string;
  /** Weapon refinement 1–5. Defaults to 1. */
  refinement?: number;
  artifacts: ArtifactSpec;
  /**
   * Override the preset's main-stat selection for artifact generation.
   * Useful when the preset's first choice doesn't match the team setup.
   */
  artifactOverride?: ArtifactStatsOverride;
}

interface ExpectedRange {
  /** Minimum acceptable computed damage. */
  min: number;
  /** Maximum acceptable computed damage. */
  max: number;
  /** Human-readable note (displayed in --verbose mode). */
  note?: string;
}

interface QATestCase {
  name: string;
  description?: string;
  /** URL to the reference source (video, post, spreadsheet). */
  source?: string;
  /** charId of the character whose formulas are being validated. */
  target: string;
  roster: RosterEntry[];
  /** Per-provider combat option overrides (key = charId or weaponId). */
  combatOpts?: Record<string, string>;
  /**
   * Expected damage per formula ID. Omit to run in "discovery" mode —
   * the tool will print all computed values without pass/fail checks.
   */
  expected?: Record<string, ExpectedRange>;
}

// ─── Preset Loading ───────────────────────────────────────────────────────────

function loadPresetBuilds(): Record<string, PresetBuildEntry> {
  const presetPath = resolve(
    "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json"
  );
  const raw = readFileSync(presetPath, "utf-8");
  return (JSON.parse(raw) as AllBuildsPreset).builds;
}

// ─── Config Builders ──────────────────────────────────────────────────────────

function toTeamSlotConfig(entry: RosterEntry): TeamSlotConfig {
  let artifactSetId: string | null = null;
  let artifactHalfSetIds: string[] = [];

  if (entry.artifacts.type === "4pc") {
    artifactSetId = entry.artifacts.setId ?? null;
    artifactHalfSetIds = [];
  } else {
    artifactSetId = null;
    artifactHalfSetIds = [entry.artifacts.id1, entry.artifacts.id2].filter(
      (id): id is string => Boolean(id)
    );
  }

  return {
    charId: entry.charId,
    charLevel: entry.charLevel ?? 90,
    constellation: entry.constellation ?? 0,
    weaponId: entry.weaponId,
    refinement: entry.refinement ?? 1,
    artifactSetId,
    artifactHalfSetIds,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

interface FormulaResult {
  formulaId: string;
  labelEn: string;
  damage: number;
  expected?: ExpectedRange;
  status: "pass" | "fail" | "unchecked";
}

interface TestCaseResult {
  name: string;
  source?: string;
  target: string;
  teamIds: string[];
  formulaResults: FormulaResult[];
  error?: string;
}

async function runTestCase(
  testCase: QATestCase,
  builds: Record<string, PresetBuildEntry>
): Promise<TestCaseResult> {
  const result: TestCaseResult = {
    name: testCase.name,
    source: testCase.source,
    target: testCase.target,
    teamIds: testCase.roster.map((r) => r.charId),
    formulaResults: [],
  };

  try {
    const configs = testCase.roster.map(toTeamSlotConfig);

    // Generate representative artifact stats for every roster member
    const artifactStats: Record<string, StatSheet> = {};
    for (const entry of testCase.roster) {
      const setId =
        entry.artifacts.type === "4pc" ? (entry.artifacts.setId ?? null) : null;
      artifactStats[entry.charId] = buildArtifactStats(
        entry.charId,
        setId,
        builds,
        entry.artifactOverride
      );
    }

    const team = new TeamBuild(configs, testCase.combatOpts ?? {});
    const teamStats = team.getTeamStats(artifactStats, testCase.target);

    const targetBuild = team.charBuilds[testCase.target];
    if (!targetBuild) {
      result.error = `Target "${testCase.target}" not found in roster`;
      return result;
    }

    const formulaIds = targetBuild.getFormulaIds();

    // Compute every formula the target character exposes
    for (const [formulaId, label] of Object.entries(formulaIds)) {
      const dmg = team.getDamageResult(
        testCase.target,
        formulaId,
        teamStats,
        QA_CTX
      );
      const damage = dmg.totalDamage;
      const expected = testCase.expected?.[formulaId];
      const status: FormulaResult["status"] = expected
        ? damage >= expected.min && damage <= expected.max
          ? "pass"
          : "fail"
        : "unchecked";

      result.formulaResults.push({
        formulaId,
        labelEn: label.en || label.zh || formulaId,
        damage,
        expected,
        status,
      });
    }

    // Report formulas listed in expected but absent from the implementation
    if (testCase.expected) {
      for (const [fId, exp] of Object.entries(testCase.expected)) {
        if (!formulaIds[fId]) {
          result.formulaResults.push({
            formulaId: fId,
            labelEn: "(MISSING — formula not implemented)",
            damage: 0,
            expected: exp,
            status: "fail",
          });
        }
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

// ─── Console Output ───────────────────────────────────────────────────────────

function printTestResult(result: TestCaseResult, verbose: boolean): void {
  const HR = "═".repeat(70);
  console.log(`\n${C.bold}${HR}${C.reset}`);
  console.log(`${C.bold}  ${result.name}${C.reset}`);
  if (result.source)
    console.log(`  ${C.dim}Source: ${result.source}${C.reset}`);
  console.log(
    `  Target: ${C.bold}${result.target}${C.reset}  │  Team: ${result.teamIds.join(", ")}`
  );
  console.log(`  Enemy: Lv100 · 10% RES · Assume CRIT`);
  console.log(HR);

  if (result.error) {
    console.log(`  ${C.red}ERROR: ${result.error}${C.reset}`);
    return;
  }

  const ID_W = 38;
  const DMG_W = 13;
  console.log(
    `  ${"Formula ID".padEnd(ID_W)} ${"Damage".padStart(DMG_W)}  Status`
  );
  console.log(`  ${"─".repeat(ID_W + DMG_W + 14)}`);

  for (const fr of result.formulaResults) {
    const dmgStr = fmt(fr.damage).padStart(DMG_W);
    let statusStr: string;

    if (fr.status === "pass") {
      statusStr = `${C.green}✓ PASS${C.reset}`;
      if (fr.expected)
        statusStr += ` ${C.dim}(${fmt(fr.expected.min)}–${fmt(fr.expected.max)})${C.reset}`;
    } else if (fr.status === "fail") {
      const mid = fr.expected ? (fr.expected.min + fr.expected.max) / 2 : 0;
      const ratio = mid > 0 ? fr.damage / mid : 0;
      statusStr = `${C.red}✗ FAIL${C.reset}`;
      if (fr.expected)
        statusStr += ` ${C.dim}(expected ${fmt(fr.expected.min)}–${fmt(fr.expected.max)}, ratio=${ratio.toFixed(2)}x)${C.reset}`;
    } else {
      statusStr = `${C.dim}—${C.reset}`;
    }

    console.log(
      `  ${fr.formulaId.padEnd(ID_W)} ${dmgStr}  ${statusStr}`
    );
    if (verbose) {
      console.log(`      ${C.dim}[${fr.labelEn}]${C.reset}`);
      if (fr.expected?.note)
        console.log(`      ${C.dim}Note: ${fr.expected.note}${C.reset}`);
    }
  }

  const passed = result.formulaResults.filter((f) => f.status === "pass").length;
  const failed = result.formulaResults.filter((f) => f.status === "fail").length;
  const unchecked = result.formulaResults.filter(
    (f) => f.status === "unchecked"
  ).length;

  console.log("");
  const failClr = failed > 0 ? C.red : "";
  console.log(
    `  Result: ${C.green}${passed} passed${C.reset}` +
      `, ${failClr}${failed} failed${C.reset}` +
      `, ${C.dim}${unchecked} unchecked${C.reset}`
  );
}

// ─── Markdown Report ──────────────────────────────────────────────────────────

function generateMarkdownReport(results: TestCaseResult[]): string {
  const lines: string[] = [
    "# Damage QA Report",
    "",
    `> **Generated:** ${new Date().toISOString()}  `,
    `> **Enemy:** Level 100, 10% all elemental resistance, assume critical hit  `,
    `> **Artifact Budget:** 5 × +20 5★ pieces, ~30 effective substat rolls (good-not-godroll)`,
    "",
    "## Summary",
    "",
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalUnchecked = 0;
  const errors: string[] = [];

  for (const r of results) {
    if (r.error) errors.push(`${r.name}: ${r.error}`);
    for (const fr of r.formulaResults) {
      if (fr.status === "pass") totalPassed++;
      else if (fr.status === "fail") totalFailed++;
      else totalUnchecked++;
    }
  }

  lines.push(
    "| Metric | Count |",
    "|---|---|",
    `| ✅ Passed | ${totalPassed} |`,
    `| ❌ Failed | ${totalFailed} |`,
    `| — Unchecked | ${totalUnchecked} |`,
    ""
  );

  if (errors.length > 0) {
    lines.push("### Errors", "");
    for (const e of errors) lines.push(`- ❌ ${e}`);
    lines.push("");
  }

  lines.push("---", "", "## Test Cases", "");

  for (const r of results) {
    const passed = r.formulaResults.filter((f) => f.status === "pass").length;
    const failed = r.formulaResults.filter((f) => f.status === "fail").length;
    const unchecked = r.formulaResults.filter(
      (f) => f.status === "unchecked"
    ).length;
    const icon = r.error || failed > 0 ? "❌" : passed > 0 ? "✅" : "⬜";

    lines.push(`### ${icon} ${r.name}`, "");
    if (r.source) lines.push(`**Source:** ${r.source}  `);
    lines.push(
      `**Target:** \`${r.target}\` · **Team:** ${r.teamIds.map((id) => `\`${id}\``).join(", ")}  `,
      `**Result:** ${passed} passed · ${failed} failed · ${unchecked} unchecked`,
      ""
    );

    if (r.error) {
      lines.push(`> ❌ **Error:** \`${r.error}\``, "");
      continue;
    }

    lines.push(
      "| Formula ID | Damage | Expected Range | Status |",
      "|---|---|---|---|"
    );

    for (const fr of r.formulaResults) {
      const dmgStr = fmt(fr.damage);
      const expStr = fr.expected
        ? `${fmt(fr.expected.min)} – ${fmt(fr.expected.max)}${fr.expected.note ? ` *(${fr.expected.note})*` : ""}`
        : "—";
      const statusStr =
        fr.status === "pass" ? "✅" : fr.status === "fail" ? "❌" : "—";
      lines.push(
        `| \`${fr.formulaId}\` | ${dmgStr} | ${expStr} | ${statusStr} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");

  const reportOutIdx = args.indexOf("--report-out");
  const reportOutPath =
    reportOutIdx !== -1 ? args[reportOutIdx + 1] : undefined;

  const inputs = args.filter(
    (a) => !a.startsWith("--") && a !== reportOutPath
  );

  if (inputs.length === 0) {
    console.log(
      "Usage: qa-dmg.ts [--verbose] [--report-out <file.md>] <testcase.json | directory/> ..."
    );
    console.log(
      "Run from project root: npm run qa:dmg -- docs/DmgQA/testcases/"
    );
    process.exit(0);
  }

  // Collect .json test case files
  const files: string[] = [];
  for (const arg of inputs) {
    const p = resolve(arg);
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) {
      console.warn(`${C.yellow}Warning: not found: ${p}${C.reset}`);
      continue;
    }
    if (st.isDirectory()) {
      files.push(
        ...readdirSync(p)
          .filter((f) => f.endsWith(".json"))
          .sort()
          .map((f) => join(p, f))
      );
    } else {
      files.push(p);
    }
  }

  if (files.length === 0) {
    console.error("No .json test case files found.");
    process.exit(1);
  }

  // Load preset builds (used for artifact stat generation)
  let builds: Record<string, PresetBuildEntry>;
  try {
    builds = loadPresetBuilds();
  } catch (err) {
    console.error(`Failed to load preset builds: ${err}`);
    process.exit(1);
  }

  // Preload game stat data (character_stats.json + weapon_stats.json)
  console.log("Loading game stats...");
  await preloadGameStats();
  console.log(`Ready. Running ${files.length} test case(s)...\n`);

  const allResults: TestCaseResult[] = [];

  for (const file of files) {
    let testCase: QATestCase;
    try {
      testCase = JSON.parse(readFileSync(file, "utf-8")) as QATestCase;
    } catch (err) {
      console.error(`${C.red}Failed to parse ${file}: ${err}${C.reset}`);
      continue;
    }

    const result = await runTestCase(testCase, builds);
    printTestResult(result, verbose);
    allResults.push(result);
  }

  // Overall summary
  const totalPassed = allResults
    .flatMap((r) => r.formulaResults)
    .filter((f) => f.status === "pass").length;
  const totalFailed = allResults
    .flatMap((r) => r.formulaResults)
    .filter((f) => f.status === "fail").length;

  const HR = "═".repeat(70);
  console.log(`\n${C.bold}${HR}${C.reset}`);
  const failClr = totalFailed > 0 ? C.red : C.green;
  console.log(
    `${C.bold}  Overall: ${C.green}${totalPassed} passed${C.reset}` +
      `${C.bold}, ${failClr}${totalFailed} failed${C.reset}`
  );
  console.log(`${C.bold}${HR}${C.reset}`);

  // Optional markdown report
  if (reportOutPath) {
    const md = generateMarkdownReport(allResults);
    writeFileSync(resolve(reportOutPath), md, "utf-8");
    console.log(`\nReport written → ${reportOutPath}`);
  }

  if (totalFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
