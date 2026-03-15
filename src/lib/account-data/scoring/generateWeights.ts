/**
 * Offline Weight Generator
 *
 * Runs the pipeline against game data and writes output JSON.
 * Usage: npx vite-node src/lib/account-data/scoring/generateWeights.ts
 *
 * Requires game stats to be loadable (uses Vite's module resolution for JSON imports).
 */

/// <reference types="node" />
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preloadGameStats } from "@/lib/gameStatsLoader";
// Register all character/weapon/artifact implementations
import "@/lib/team-comp";
import { formatPipelineBuild, runPipeline } from "./pipeline";
import type { PipelineResult } from "./pipeline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../../../..");

async function main() {
  console.log("Loading game stats...");
  await preloadGameStats();

  console.log("Running pipeline (real TeamBuild damage calculator)...");
  const result = runPipeline();

  console.log(
    `Generated ${result.builds.length} builds, ${result.errors.length} errors`
  );

  // Print each build
  for (const build of result.builds) {
    console.log(`\n${formatPipelineBuild(build)}`);
  }

  // Print errors
  if (result.errors.length > 0) {
    console.log("\n=== ERRORS ===");
    for (const err of result.errors) {
      console.log(`  ${err.characterId}: ${err.error}`);
    }
  }

  // Write output JSON (the full PipelineResult for the UI to consume)
  const outputDir = resolve(PROJECT_ROOT, "src/data/generated");
  mkdirSync(outputDir, { recursive: true });

  const outputPath = resolve(outputDir, "v2_weights.json");
  writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nWeights written to: ${outputPath}`);
}

// CLI entry point
main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
