#!/usr/bin/env tsx
/**
 * Generator Regression Test: Deterministic golden-file testing for the
 * artifact generator across all team presets.
 *
 * Runs runGenerator in combo mode (every formula × 2) with random
 * ER/CR constraints, captures all UI-displayable data, and diffs against
 * a golden file.
 *
 * Commands:
 *   run [options]    Run generator on all teams, compare against golden file
 *
 * Options:
 *   --update         Overwrite golden file with new results
 *   --filter PAT     Filter teams by name (case-insensitive substring)
 *   --verbose        Print per-team progress
 *   --seed N         Override PRNG seed (default: 0xDEADBEEF)
 *
 * Usage:
 *   npm run regtest -- run
 *   npm run regtest -- run --update
 *   npm run regtest -- run --filter "Hu Tao"
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  C,
  type DiffEntry,
  type GoldenFile,
  PRNG_SEED,
  buildGeneratorProblem,
  deepDiff,
  fmt,
  formatSummary,
  formatTeamDiff,
  hasRegressions,
  loadTeamPreset,
  mulberry32,
  preloadGameStats,
  runGeneratorForTeam,
} from "./runner";

// ─── Paths ───────────────────────────────────────────────────────────────────

const GOLDEN_DIR = resolve("tests/regression/__golden__");
const GOLDEN_PATH = resolve(GOLDEN_DIR, "generator-results.json");

// ─── CLI Parsing ─────────────────────────────────────────────────────────────

function parseArgs(): {
  command: string;
  update: boolean;
  filter: string | null;
  verbose: boolean;
  seed: number;
} {
  const args = process.argv.slice(2);
  let command = "run";
  let update = false;
  let filter: string | null = null;
  let verbose = false;
  let seed = PRNG_SEED;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "run") {
      command = "run";
    } else if (arg === "--update") {
      update = true;
    } else if (arg === "--filter" && i + 1 < args.length) {
      filter = args[++i];
    } else if (arg === "--verbose") {
      verbose = true;
    } else if (arg === "--seed" && i + 1 < args.length) {
      seed = Number.parseInt(args[++i], 10);
    }
  }

  return { command, update, filter, verbose, seed };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (opts.command !== "run") {
    console.log(
      "Usage: npm run gen-bench -- run [--update] [--filter PAT] [--verbose]"
    );
    process.exit(0);
  }

  // Load game data
  console.log(`${C.dim}Loading game stats...${C.reset}`);
  await preloadGameStats();

  // Load team presets
  const preset = loadTeamPreset();
  const allTeams = preset.teams;

  // Build filter predicate. We always iterate ALL teams so the PRNG stays
  // deterministic regardless of filter, but only run matching ones.
  const filterPat = opts.filter?.toLowerCase() ?? null;
  const matchesFilter = (t: (typeof allTeams)[0]) =>
    filterPat == null ||
    t.name?.toLowerCase().includes(filterPat) ||
    t.characters.some((c) => c?.toLowerCase().includes(filterPat));

  const matchCount = allTeams.filter(matchesFilter).length;

  if (filterPat) {
    console.log(
      `${C.dim}Filtered to ${matchCount} teams matching "${opts.filter}"${C.reset}`
    );
  }

  console.log(`${C.bold}=== Generator Regression Test ===${C.reset}`);
  console.log(
    `${C.dim}Running ${matchCount} teams, seed=0x${opts.seed.toString(16).toUpperCase()}${C.reset}\n`
  );

  // Run generator for all teams (iterate all to keep PRNG stable)
  const rand = mulberry32(opts.seed);
  const goldenFile: GoldenFile = {
    version: 1,
    seed: opts.seed,
    generatedAt: new Date().toISOString(),
    teams: {},
  };

  let completed = 0;
  let errors = 0;

  for (const team of allTeams) {
    const teamLabel = team.name || team.characters.filter(Boolean).join(" / ");

    try {
      // Always build the problem (consumes PRNG), but only run if it matches filter
      const problem = buildGeneratorProblem(team, rand);
      if (!problem) {
        if (opts.verbose && matchesFilter(team)) {
          console.log(
            `${C.dim}  skip: ${teamLabel} (no valid configs)${C.reset}`
          );
        }
        continue;
      }

      if (!matchesFilter(team)) continue;

      if (opts.verbose) {
        process.stdout.write(`${C.dim}  running: ${teamLabel}...${C.reset}`);
      }

      const startMs = performance.now();
      const result = await runGeneratorForTeam(problem);
      const elapsedMs = performance.now() - startMs;

      goldenFile.teams[team.id] = result;
      completed++;

      if (opts.verbose) {
        console.log(
          `\r  ${C.green}done${C.reset}: ${teamLabel} (${fmt(result.damage)} dmg, ${(elapsedMs / 1000).toFixed(1)}s)`
        );
      }
    } catch (e) {
      if (!matchesFilter(team)) continue;
      errors++;
      console.error(
        `${C.red}  ERROR: ${teamLabel}: ${e instanceof Error ? e.message : String(e)}${C.reset}`
      );
    }
  }

  console.log(
    `\n${C.dim}Completed ${completed} teams${errors > 0 ? `, ${errors} errors` : ""}${C.reset}\n`
  );

  // Update or diff
  if (opts.update) {
    writeFileSync(GOLDEN_PATH, JSON.stringify(goldenFile, null, 2), "utf-8");
    console.log(`${C.green}Golden file written: ${GOLDEN_PATH}${C.reset}`);
    console.log(
      `${C.dim}${Object.keys(goldenFile.teams).length} teams saved${C.reset}`
    );
    process.exit(0);
  }

  // Compare mode
  if (!existsSync(GOLDEN_PATH)) {
    console.error(
      `${C.red}No golden file found at ${GOLDEN_PATH}${C.reset}\nRun with --update to create one:\n  npm run gen-bench -- run --update`
    );
    process.exit(2);
  }

  const oldGolden = JSON.parse(
    readFileSync(GOLDEN_PATH, "utf-8")
  ) as GoldenFile;

  // Diff each team — only compare teams that were actually run.
  // When --filter is active, teams not in the current run are simply skipped,
  // not reported as "REMOVED".
  const teamDiffs = new Map<string, DiffEntry[]>();
  const isFiltered = opts.filter != null;

  // Start with teams we ran
  const runTeamIds = new Set(Object.keys(goldenFile.teams));
  // In unfiltered mode, also report teams that were in golden but are now absent
  const allTeamIds = isFiltered
    ? runTeamIds
    : new Set([...Object.keys(oldGolden.teams), ...runTeamIds]);

  for (const teamId of allTeamIds) {
    const oldTeam = oldGolden.teams[teamId];
    const newTeam = goldenFile.teams[teamId];
    const teamName = newTeam?.teamName || oldTeam?.teamName || teamId;

    if (!oldTeam) {
      console.log(
        `${C.cyan}team "${teamName}" — NEW (not in golden file)${C.reset}`
      );
      teamDiffs.set(teamId, [
        { path: "(new team)", old: undefined, new: "added" },
      ]);
      continue;
    }

    if (!newTeam) {
      console.log(
        `${C.yellow}team "${teamName}" — REMOVED (in golden but not in current run)${C.reset}`
      );
      teamDiffs.set(teamId, [
        { path: "(removed team)", old: "present", new: undefined },
      ]);
      continue;
    }

    const diffs: DiffEntry[] = [];
    deepDiff(oldTeam, newTeam, "", diffs);
    teamDiffs.set(teamId, diffs);
    console.log(formatTeamDiff(teamName, diffs));
  }

  console.log(formatSummary(allTeamIds.size, teamDiffs));

  if (hasRegressions(teamDiffs)) {
    console.log(
      `\n${C.red}${C.bold}FAIL: Damage regressions detected.${C.reset}`
    );
    process.exit(1);
  }

  // Check if there are any diffs at all
  let totalDiffs = 0;
  for (const [, diffs] of teamDiffs) totalDiffs += diffs.length;

  if (totalDiffs === 0) {
    console.log(
      `\n${C.green}${C.bold}PASS: All results match golden file.${C.reset}`
    );
    process.exit(0);
  }

  console.log(`\n${C.red}${C.bold}FAIL: Diffs found vs golden file.${C.reset}`);
  console.log("Run with --update to accept these changes.");
  process.exit(1);
}

main().catch((e) => {
  console.error(`${C.red}Fatal error: ${e}${C.reset}`);
  process.exit(1);
});
