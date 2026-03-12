/**
 * CLI runner for V3 T-Factor extraction.
 *
 * Usage: npx tsx src/lib/account-data/scorev2/generateV3.ts
 *
 * Reads teams from:
 * 1. src/data/generated/team_comps_research.json (research teams)
 * 2. Flagship Teams preset (existing curated teams)
 *
 * Outputs: src/data/generated/v3_build_data.json
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { extractV3All, researchTeamToConfigs } from "./extractV3";
import {
  CHARACTER_BUILD_PROFILES,
  getFlagshipTeamsForChar,
} from "./teamDatabase";

// Import research teams
import researchJson from "@/data/generated/team_comps_research.json";

async function main() {
  console.log("Loading game stats...");
  await preloadGameStats();

  // Collect all teams (research + flagship)
  type TeamEntry = {
    name: string;
    characters: string[];
    dpsIndex: number;
    reaction: string;
    builds: { weapon: string; artifacts: string[] }[];
  };

  const allTeams: TeamEntry[] = [];

  // Add research teams
  for (const team of researchJson.teams) {
    allTeams.push(team);
  }
  console.log(`Loaded ${researchJson.teams.length} research teams`);

  // Add flagship teams (convert to research format)
  let flagshipCount = 0;
  for (const profile of CHARACTER_BUILD_PROFILES) {
    for (const teamCtx of profile.teams) {
      allTeams.push({
        name: `[Flagship] ${teamCtx.name}`,
        characters: [...teamCtx.characters],
        dpsIndex: teamCtx.dpsIndex,
        reaction: teamCtx.reaction,
        builds: teamCtx.builds.map((b) => ({
          weapon: b.weapon,
          artifacts: b.artifacts,
        })),
      });
      flagshipCount++;
    }
  }
  console.log(`Loaded ${flagshipCount} flagship teams`);
  console.log(`Total: ${allTeams.length} teams\n`);

  // Run V3 extraction
  console.log("Extracting V3 T-factors...");
  const startTime = Date.now();
  const builds = extractV3All(allTeams);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    `\nGenerated V3 data for ${builds.length} characters in ${elapsed}s\n`
  );

  // Print summary
  for (const build of builds) {
    const teamCount = build.teams.length;
    const topStats = Object.entries(build.displayWeights)
      .filter(([, w]) => w > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([s, w]) => `${s}:${w}`)
      .join(" ");

    console.log(
      `${build.characterId.padEnd(22)} ${build.element.padEnd(8)} ` +
        `${build.bestSands.padEnd(6)} ${build.bestGoblet.padEnd(10)} ${build.bestCirclet.padEnd(4)} ` +
        `${teamCount} teams  ${topStats}`
    );
  }

  // Write output
  const outPath = resolve(
    import.meta.dirname ?? ".",
    "../../../data/generated/v3_build_data.json"
  );

  const output = {
    meta: {
      generated: new Date().toISOString(),
      description: "V3 T-factor build data for multiplicative artifact scoring",
      characterCount: builds.length,
      totalTeams: allTeams.length,
    },
    builds,
  };

  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${outPath}`);
}

main().catch(console.error);
