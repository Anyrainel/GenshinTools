#!/usr/bin/env tsx
/**
 * Optimizer Comparison: Compare V1 and V2 optimizer results.
 *
 * Reads the JSON output files from optimizer-testbed.ts and generates
 * a comparison report showing damage differences per team/formula.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/optimizer-compare.ts [--report-out FILE]
 *
 * Reads from:
 *   scripts/output/optimizer-v1-results.json
 *   scripts/output/optimizer-v2-results.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Types (match testbed output) ────────────────────────────────────────────

interface FormulaResult {
  formulaId: string;
  labelEn: string;
  damage: number;
}

interface TeamResult {
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
}

interface TestbedOutput {
  algorithm: "v1" | "v2";
  timestamp: string;
  accountFile: string;
  totalTeams: number;
  results: TeamResult[];
}

interface FormulaComparison {
  formulaId: string;
  labelEn: string;
  v1Damage: number;
  v2Damage: number;
  diff: number;
  diffPct: number;
  winner: "v1" | "v2" | "tie";
}

interface TeamComparison {
  teamId: string;
  teamName: string;
  characters: string[];
  carryCharId: string;
  optimizedFormulaId: string;
  /** Optimizer-reported damage for the target formula */
  v1OptDamage: number;
  v2OptDamage: number;
  v1TimeSec: number;
  v2TimeSec: number;
  formulas: FormulaComparison[];
  v1Error?: string;
  v2Error?: string;
  /** Different artifact assignments between v1 and v2 */
  artifactDiffs: Record<
    string,
    { slot: string; v1ArtId: string; v2ArtId: string }[]
  >;
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

function pctStr(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

// ─── Comparison Logic ────────────────────────────────────────────────────────

function compareTeams(
  v1Results: TeamResult[],
  v2Results: TeamResult[]
): TeamComparison[] {
  const comparisons: TeamComparison[] = [];

  // Index v2 by teamId for quick lookup
  const v2ByTeamId = new Map<string, TeamResult>();
  for (const r of v2Results) v2ByTeamId.set(r.teamId, r);

  for (const v1 of v1Results) {
    const v2 = v2ByTeamId.get(v1.teamId);
    if (!v2) continue;

    const formulas: FormulaComparison[] = [];

    // Index v2 formulas
    const v2FormulaMap = new Map<string, FormulaResult>();
    for (const f of v2.formulaResults) v2FormulaMap.set(f.formulaId, f);

    // All formula IDs from both
    const allFormulaIds = new Set([
      ...v1.formulaResults.map((f) => f.formulaId),
      ...v2.formulaResults.map((f) => f.formulaId),
    ]);

    for (const fid of allFormulaIds) {
      const f1 = v1.formulaResults.find((f) => f.formulaId === fid);
      const f2 = v2FormulaMap.get(fid);

      const v1Damage = f1?.damage ?? 0;
      const v2Damage = f2?.damage ?? 0;
      const diff = v2Damage - v1Damage;
      const diffPct = v1Damage > 0 ? (diff / v1Damage) * 100 : 0;
      const winner: "v1" | "v2" | "tie" =
        Math.abs(diffPct) < 0.01
          ? "tie"
          : v2Damage > v1Damage
            ? "v2"
            : "v1";

      formulas.push({
        formulaId: fid,
        labelEn: f1?.labelEn || f2?.labelEn || fid,
        v1Damage,
        v2Damage,
        diff,
        diffPct,
        winner,
      });
    }

    // Compare artifact assignments
    const artifactDiffs: TeamComparison["artifactDiffs"] = {};
    for (const cid of v1.characters) {
      const v1Arts = v1.artifactAssignment[cid] ?? {};
      const v2Arts = v2.artifactAssignment[cid] ?? {};
      const diffs: { slot: string; v1ArtId: string; v2ArtId: string }[] = [];
      const allSlots = new Set([
        ...Object.keys(v1Arts),
        ...Object.keys(v2Arts),
      ]);
      for (const slot of allSlots) {
        if (v1Arts[slot] !== v2Arts[slot]) {
          diffs.push({
            slot,
            v1ArtId: v1Arts[slot] ?? "(none)",
            v2ArtId: v2Arts[slot] ?? "(none)",
          });
        }
      }
      if (diffs.length > 0) artifactDiffs[cid] = diffs;
    }

    comparisons.push({
      teamId: v1.teamId,
      teamName: v1.teamName || v1.characters.join(" / "),
      characters: v1.characters,
      carryCharId: v1.carryCharId,
      optimizedFormulaId: v1.optimizedFormulaId,
      v1OptDamage: v1.optimizedDamage,
      v2OptDamage: v2.optimizedDamage,
      v1TimeSec: v1.optimizeTimeSec,
      v2TimeSec: v2.optimizeTimeSec,
      formulas,
      v1Error: v1.error,
      v2Error: v2.error,
      artifactDiffs,
    });
  }

  return comparisons;
}

// ─── Console Output ──────────────────────────────────────────────────────────

function printComparison(comparisons: TeamComparison[]): void {
  const HR = "═".repeat(90);

  let totalV1Wins = 0;
  let totalV2Wins = 0;
  let totalTies = 0;
  let totalV1Time = 0;
  let totalV2Time = 0;

  console.log(`\n${C.bold}${HR}${C.reset}`);
  console.log(`${C.bold}  Optimizer V1 vs V2 Comparison${C.reset}`);
  console.log(HR);

  for (const team of comparisons) {
    console.log(
      `\n${C.bold}  ${team.teamName}${C.reset}  (carry: ${C.cyan}${team.carryCharId}${C.reset})`
    );

    if (team.v1Error || team.v2Error) {
      if (team.v1Error)
        console.log(`    ${C.red}V1 Error: ${team.v1Error}${C.reset}`);
      if (team.v2Error)
        console.log(`    ${C.red}V2 Error: ${team.v2Error}${C.reset}`);
      continue;
    }

    // Show optimization time
    console.log(
      `    ${C.dim}Optimized for: ${team.optimizedFormulaId} | V1: ${team.v1TimeSec.toFixed(1)}s → ${fmt(team.v1OptDamage)} | V2: ${team.v2TimeSec.toFixed(1)}s → ${fmt(team.v2OptDamage)}${C.reset}`
    );

    totalV1Time += team.v1TimeSec;
    totalV2Time += team.v2TimeSec;

    const ID_W = 36;
    const DMG_W = 12;
    console.log(
      `    ${"Formula".padEnd(ID_W)} ${"V1 Damage".padStart(DMG_W)} ${"V2 Damage".padStart(DMG_W)} ${"Diff".padStart(10)}`
    );
    console.log(`    ${"─".repeat(ID_W + DMG_W * 2 + 14)}`);

    for (const f of team.formulas) {
      const diffColor =
        f.winner === "v2"
          ? C.green
          : f.winner === "v1"
            ? C.red
            : C.dim;
      const diffStr = `${diffColor}${pctStr(f.diffPct)}${C.reset}`;
      const winMarker =
        f.winner === "v2" ? `${C.green}▲${C.reset}` : f.winner === "v1" ? `${C.red}▼${C.reset}` : " ";

      console.log(
        `    ${f.formulaId.padEnd(ID_W)} ${fmt(f.v1Damage).padStart(DMG_W)} ${fmt(f.v2Damage).padStart(DMG_W)} ${diffStr.padStart(10 + 9)} ${winMarker}`
      );

      if (f.winner === "v1") totalV1Wins++;
      else if (f.winner === "v2") totalV2Wins++;
      else totalTies++;
    }

    // Print artifact diff summary
    const diffCount = Object.values(team.artifactDiffs).reduce(
      (s, d) => s + d.length,
      0
    );
    if (diffCount > 0) {
      console.log(
        `    ${C.dim}Artifact diffs: ${diffCount} slot(s) differ across ${Object.keys(team.artifactDiffs).length} character(s)${C.reset}`
      );
    }
  }

  // Summary
  console.log(`\n${C.bold}${HR}${C.reset}`);
  console.log(`${C.bold}  Summary${C.reset}`);
  console.log(HR);
  console.log(
    `  ${C.green}V2 wins: ${totalV2Wins}${C.reset}  │  ${C.red}V1 wins: ${totalV1Wins}${C.reset}  │  ${C.dim}Ties: ${totalTies}${C.reset}`
  );
  console.log(
    `  Total V1 time: ${totalV1Time.toFixed(1)}s  │  Total V2 time: ${totalV2Time.toFixed(1)}s  │  Ratio: ${(totalV2Time / (totalV1Time || 1)).toFixed(2)}x`
  );

  // Find biggest V2 wins and losses
  const allFormulas = comparisons.flatMap((t) =>
    t.formulas.map((f) => ({
      team: t.teamName,
      carry: t.carryCharId,
      ...f,
    }))
  );

  const sorted = [...allFormulas]
    .filter((f) => f.v1Damage > 0)
    .sort((a, b) => b.diffPct - a.diffPct);

  if (sorted.length > 0) {
    console.log(`\n  ${C.bold}Top 5 V2 improvements:${C.reset}`);
    for (const f of sorted.slice(0, 5)) {
      console.log(
        `    ${C.green}${pctStr(f.diffPct)}${C.reset} ${f.carry}/${f.formulaId} (${fmt(f.v1Damage)} → ${fmt(f.v2Damage)})`
      );
    }

    const losses = sorted.filter((f) => f.diffPct < -0.01);
    if (losses.length > 0) {
      console.log(`\n  ${C.bold}Top 5 V2 regressions:${C.reset}`);
      for (const f of losses.slice(-5).reverse()) {
        console.log(
          `    ${C.red}${pctStr(f.diffPct)}${C.reset} ${f.carry}/${f.formulaId} (${fmt(f.v1Damage)} → ${fmt(f.v2Damage)})`
        );
      }
    }
  }

  console.log(`${C.bold}${HR}${C.reset}\n`);
}

// ─── Markdown Report ─────────────────────────────────────────────────────────

function generateMarkdownReport(comparisons: TeamComparison[]): string {
  const lines: string[] = [
    "# Optimizer V1 vs V2 Comparison Report",
    "",
    `> **Generated:** ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
  ];

  let totalV1Wins = 0;
  let totalV2Wins = 0;
  let totalTies = 0;
  let totalV1Time = 0;
  let totalV2Time = 0;

  for (const team of comparisons) {
    for (const f of team.formulas) {
      if (f.winner === "v1") totalV1Wins++;
      else if (f.winner === "v2") totalV2Wins++;
      else totalTies++;
      totalV1Time += f.v1TimeSec;
      totalV2Time += f.v2TimeSec;
    }
  }

  lines.push(
    "| Metric | Value |",
    "|---|---|",
    `| V2 wins (higher damage) | ${totalV2Wins} |`,
    `| V1 wins (higher damage) | ${totalV1Wins} |`,
    `| Ties | ${totalTies} |`,
    `| V1 total time | ${totalV1Time.toFixed(1)}s |`,
    `| V2 total time | ${totalV2Time.toFixed(1)}s |`,
    `| V2/V1 time ratio | ${(totalV2Time / (totalV1Time || 1)).toFixed(2)}x |`,
    ""
  );

  lines.push("## Per-Team Results", "");

  for (const team of comparisons) {
    lines.push(
      `### ${team.teamName}`,
      "",
      `**Carry:** \`${team.carryCharId}\` | **Team:** ${team.characters.map((c) => `\`${c}\``).join(", ")}`,
      ""
    );

    if (team.v1Error || team.v2Error) {
      if (team.v1Error) lines.push(`> V1 Error: \`${team.v1Error}\``);
      if (team.v2Error) lines.push(`> V2 Error: \`${team.v2Error}\``);
      lines.push("");
      continue;
    }

    lines.push(
      `**Optimized for:** \`${team.optimizedFormulaId}\` | V1: ${team.v1TimeSec.toFixed(1)}s → ${fmt(team.v1OptDamage)} | V2: ${team.v2TimeSec.toFixed(1)}s → ${fmt(team.v2OptDamage)}`,
      "",
      "| Formula | V1 Damage | V2 Damage | Diff | Winner |",
      "|---|---|---|---|---|"
    );

    for (const f of team.formulas) {
      const winner =
        f.winner === "v2" ? "V2" : f.winner === "v1" ? "V1" : "Tie";
      lines.push(
        `| \`${f.formulaId}\` | ${fmt(f.v1Damage)} | ${fmt(f.v2Damage)} | ${pctStr(f.diffPct)} | ${winner} |`
      );
    }
    lines.push("");

    const diffCount = Object.values(team.artifactDiffs).reduce(
      (s, d) => s + d.length,
      0
    );
    if (diffCount > 0) {
      lines.push(
        `*${diffCount} artifact slot(s) differ between V1 and V2.*`,
        ""
      );
    }
  }

  return lines.join("\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const reportOutIdx = args.indexOf("--report-out");
  const reportOutPath =
    reportOutIdx !== -1 ? args[reportOutIdx + 1] : undefined;

  const outputDir = resolve("scripts/output");
  const v1Path = resolve(outputDir, "optimizer-v1-results.json");
  const v2Path = resolve(outputDir, "optimizer-v2-results.json");

  let v1Data: TestbedOutput;
  let v2Data: TestbedOutput;
  try {
    v1Data = JSON.parse(readFileSync(v1Path, "utf-8")) as TestbedOutput;
    v2Data = JSON.parse(readFileSync(v2Path, "utf-8")) as TestbedOutput;
  } catch (err) {
    console.error(
      `Failed to read result files. Run optimizer-testbed.ts first.\n${err}`
    );
    process.exit(1);
  }

  console.log(
    `V1: ${v1Data.results.length} teams (${v1Data.timestamp})\n` +
      `V2: ${v2Data.results.length} teams (${v2Data.timestamp})`
  );

  const comparisons = compareTeams(v1Data.results, v2Data.results);
  printComparison(comparisons);

  // Auto-generate report
  const reportPath = reportOutPath ?? resolve(outputDir, "comparison-report.md");
  const md = generateMarkdownReport(comparisons);
  writeFileSync(resolve(reportPath), md, "utf-8");
  console.log(`Report written → ${reportPath}`);
}

main();
