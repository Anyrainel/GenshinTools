/**
 * CLI wrapper for the ER calculator — runs our engine on preset rotations
 * or custom team/timeline JSON, outputting structured results for comparison
 * with gcsim.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.node.json scripts/er_calc_cli.ts presets
 *   npx tsx --tsconfig tsconfig.node.json scripts/er_calc_cli.ts run <preset_id> [--particle-mode expected|min|max]
 *   npx tsx --tsconfig tsconfig.node.json scripts/er_calc_cli.ts run-json <json_file>
 *   npx tsx --tsconfig tsconfig.node.json scripts/er_calc_cli.ts fuzz <preset_id> [--variations N]
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic import with path resolution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`ER Calculator CLI

Commands:
  presets                     List all preset rotations
  run <preset_id>            Calculate ER for a preset
  run-json <file>            Calculate ER from a JSON team/timeline file
  fuzz <preset_id>           Generate rotation variations and compare

Options:
  --particle-mode <mode>     min | expected | max (default: expected)
  --calc-mode <mode>         zero-energy-start | full-energy-repeat | zero-energy-repeat
  --variations <N>           Number of fuzz variations (default: 10)
  --json                     Output as JSON
`);
    return;
  }

  // Import our modules (tsx handles the @/ alias via tsconfig)
  const { calculateTeamER } = await import(
    "../src/lib/ercalc/erCalculator.js"
  );
  const { TEAM_PRESETS: presetRotations } = await import(
    "../src/data/ercalc/presetRotations.js"
  );

  if (command === "presets") {
    for (const p of presetRotations) {
      const teamStr = p.team.map((m: any) => m.id).join(", ");
      console.log(`  ${p.id.padEnd(25)}  [${teamStr}]`);
    }
    return;
  }

  if (command === "run") {
    const presetId = args[1];
    if (!presetId) {
      console.error("Usage: run <preset_id>");
      process.exit(1);
    }

    const preset = presetRotations.find((p: any) => p.id === presetId);
    if (!preset) {
      console.error(
        `Preset '${presetId}' not found. Available: ${presetRotations.map((p: any) => p.id).join(", ")}`
      );
      process.exit(1);
    }

    const particleMode = getArg(args, "--particle-mode") || "expected";
    const calcMode = getArg(args, "--calc-mode") || "full-energy-repeat";
    const asJson = args.includes("--json");

    const results = calculateTeamER(preset.team, preset.timeline, {
      particleMode,
      calcMode,
      timeline2: preset.timeline2,
    });

    if (asJson) {
      const output = {
        preset: presetId,
        particleMode,
        calcMode,
        results: results.map((r: any, i: number) => ({
          charId: preset.team[i].id,
          element: preset.team[i].element,
          burstCost: preset.team[i].burstCost,
          weaponType: preset.team[i].weaponType,
          erNeeded: r.erNeeded,
          energyBreakdown: r.energyBreakdown,
          hasQ: r.hasQ,
        })),
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`\nPreset: ${presetId}  (${particleMode}, ${calcMode})`);
      console.log("-".repeat(60));
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const m = preset.team[i];
        const er = r.erNeeded === Infinity ? "∞" : `${Math.round(r.erNeeded)}%`;
        console.log(
          `  ${m.id.padEnd(20)} ${m.element.padEnd(8)} cost=${m.burstCost}  ER=${er}` +
            `  particle=${r.energyBreakdown?.particleEnergy?.toFixed(1) ?? "?"}` +
            `  flat=${r.energyBreakdown?.flatEnergy?.toFixed(1) ?? "?"}`
        );
      }
    }
    return;
  }

  if (command === "run-json") {
    const filePath = args[1];
    if (!filePath) {
      console.error("Usage: run-json <json_file>");
      process.exit(1);
    }
    const fs = await import("fs");
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const results = calculateTeamER(data.team, data.timeline, data.options);
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (command === "fuzz") {
    const presetId = args[1];
    if (!presetId) {
      console.error("Usage: fuzz <preset_id>");
      process.exit(1);
    }

    const preset = presetRotations.find((p: any) => p.id === presetId);
    if (!preset) {
      console.error(`Preset '${presetId}' not found.`);
      process.exit(1);
    }

    const numVariations = parseInt(getArg(args, "--variations") || "10");
    const asJson = args.includes("--json");

    const variations = generateVariations(preset, numVariations);
    const allResults: any[] = [];

    for (const variant of variations) {
      const results = calculateTeamER(
        variant.team,
        variant.timeline,
        { particleMode: "expected", calcMode: "full-energy-repeat" }
      );
      allResults.push({
        label: variant.label,
        timeline: variant.timeline,
        results: results.map((r: any, i: number) => ({
          charId: variant.team[i].id,
          erNeeded: r.erNeeded,
          particleEnergy: r.energyBreakdown?.particleEnergy,
          flatEnergy: r.energyBreakdown?.flatEnergy,
        })),
      });
    }

    if (asJson) {
      console.log(JSON.stringify({ preset: presetId, variations: allResults }, null, 2));
    } else {
      console.log(`\nFuzz results for: ${presetId} (${allResults.length} variations)\n`);
      for (const v of allResults) {
        console.log(`--- ${v.label} (${v.timeline.length} actions) ---`);
        for (const r of v.results) {
          const er = r.erNeeded === Infinity ? "∞" : `${Math.round(r.erNeeded)}%`;
          console.log(
            `  ${r.charId.padEnd(20)} ER=${er.padEnd(8)}` +
              `  particle=${r.particleEnergy?.toFixed(1) ?? "?"}` +
              `  flat=${r.flatEnergy?.toFixed(1) ?? "?"}`
          );
        }
      }
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

/**
 * Generate rotation variations from a preset for fuzzy testing.
 *
 * Variations include:
 * 1. Original (baseline)
 * 2. Add N NAs per character (tests NA energy model)
 * 3. Double E casts (tests particle accumulation)
 * 4. Remove some E casts (tests energy starvation)
 * 5. Shuffle character order
 * 6. Add wait actions (tests absorption rules)
 */
function generateVariations(preset: any, count: number): any[] {
  const variants: any[] = [];
  const team = preset.team;
  const timeline = preset.timeline;

  // 1. Baseline
  variants.push({ label: "baseline", team, timeline });

  // 2. Add 1 NA after each E for each character
  {
    const tl: any[] = [];
    for (const act of timeline) {
      tl.push(act);
      if (act.action === "E" || act.action === "holdE") {
        tl.push({ char: act.char, action: "NA" });
      }
    }
    variants.push({ label: "+1 NA after each E", team, timeline: tl });
  }

  // 3. Add 2 NAs after each E
  {
    const tl: any[] = [];
    for (const act of timeline) {
      tl.push(act);
      if (act.action === "E" || act.action === "holdE") {
        tl.push({ char: act.char, action: "NA" });
        tl.push({ char: act.char, action: "NA" });
      }
    }
    variants.push({ label: "+2 NAs after each E", team, timeline: tl });
  }

  // 4. Add NAs for the on-field carry only (first char that has Q last)
  {
    const carry = team[0]; // Assume first char is carry for simplicity
    const tl = [...timeline];
    // Add 3 NAs at the end for the carry
    for (let n = 0; n < 3; n++) {
      tl.push({ char: carry.id, action: "NA" });
    }
    variants.push({ label: `+3 NAs for ${carry.id} at end`, team, timeline: tl });
  }

  // 5. Double all E casts
  {
    const tl: any[] = [];
    for (const act of timeline) {
      tl.push(act);
      if (act.action === "E") {
        tl.push({ ...act }); // duplicate the E
      }
    }
    variants.push({ label: "double all E casts", team, timeline: tl });
  }

  // 6. Remove periodicE ticks (if any)
  {
    const tl = timeline.filter((a: any) => a.action !== "periodicE");
    if (tl.length < timeline.length) {
      variants.push({ label: "no periodicE", team, timeline: tl });
    }
  }

  // 7. Add wait between each action
  {
    const tl: any[] = [];
    let lastChar = timeline[0]?.char;
    for (const act of timeline) {
      if (act.char !== lastChar) {
        tl.push({ char: act.char, action: "wait" });
      }
      tl.push(act);
      lastChar = act.char;
    }
    variants.push({ label: "+wait on swap", team, timeline: tl });
  }

  // 8-N. Add varying NA counts (1-5) for each team member
  for (let naCount = 1; naCount <= Math.min(5, count - variants.length + 1); naCount++) {
    for (const member of team) {
      if (variants.length >= count) break;
      const tl = [...timeline];
      // Insert NAs before the character's Q
      const qIdx = tl.findIndex(
        (a: any) => a.char === member.id && (a.action === "Q" || a.action === "specialQ")
      );
      if (qIdx >= 0) {
        const nas = Array.from({ length: naCount }, () => ({
          char: member.id,
          action: "NA",
        }));
        tl.splice(qIdx, 0, ...nas);
        variants.push({
          label: `+${naCount} NAs for ${member.id} before Q`,
          team,
          timeline: tl,
        });
      }
    }
  }

  return variants.slice(0, count);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
