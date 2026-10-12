/** Run the current ER engine on an explicit team/timeline JSON file. */
import { readFileSync } from "node:fs";
import type {
  CalcMode,
  EROptions,
  ERTimeline,
  ParticleMode,
  TeamMember,
} from "../src/domain/combat/energy/types";

async function main() {
  const args = process.argv.slice(2);
  if (!args[0] || args[0] === "help") {
    console.log(
      "Usage: npx tsx scripts/er_calc_cli.ts run-json <file> [--particle-mode expected|max] [--calc-mode zero-energy-start|full-energy-repeat|zero-energy-repeat]\n" +
        "JSON: { team: TeamMember[], timeline: { actions: [], periodic: [] }, options?: EROptions }"
    );
    return;
  }
  if (args[0] !== "run-json") {
    throw new Error(
      "Bundled rotation presets and their fuzz commands were retired. Use run-json with an explicit current-format team and timeline."
    );
  }
  if (!args[1]) throw new Error("Usage: run-json <file>");
  let particleMode: ParticleMode | undefined;
  let calcMode: CalcMode | undefined;
  for (let index = 2; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === "--particle-mode") {
      if (value !== "expected" && value !== "max")
        throw new Error("--particle-mode must be expected or max.");
      particleMode = value;
    } else if (flag === "--calc-mode") {
      if (
        value !== "zero-energy-start" &&
        value !== "full-energy-repeat" &&
        value !== "zero-energy-repeat"
      )
        throw new Error("Invalid --calc-mode.");
      calcMode = value;
    } else {
      throw new Error("Unknown option: " + flag);
    }
  }
  const data = JSON.parse(readFileSync(args[1], "utf8")) as {
    team: TeamMember[];
    timeline: ERTimeline;
    options?: EROptions;
  };
  if (
    !data ||
    !Array.isArray(data.team) ||
    !Array.isArray(data.timeline?.actions) ||
    !Array.isArray(data.timeline?.periodic)
  ) {
    throw new Error(
      "Expected team array and a current timeline with actions and periodic arrays."
    );
  }
  const options = { ...data.options };
  if (particleMode) options.particleMode = particleMode;
  if (calcMode) options.calcMode = calcMode;
  if (
    options.particleMode !== undefined &&
    options.particleMode !== "expected" &&
    options.particleMode !== "max"
  )
    throw new Error("Invalid JSON particleMode.");
  if (
    options.calcMode !== undefined &&
    options.calcMode !== "zero-energy-start" &&
    options.calcMode !== "full-energy-repeat" &&
    options.calcMode !== "zero-energy-repeat"
  )
    throw new Error("Invalid JSON calcMode.");
  const { calculateTeamER } = await import(
    "../src/domain/combat/energy/erCalculator.js"
  );
  console.log(
    JSON.stringify(calculateTeamER(data.team, data.timeline, options), null, 2)
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
