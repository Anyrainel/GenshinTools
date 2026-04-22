import { calculateTeamER } from "@/lib/ercalc/erCalculator";
import type {
  ERTimeline,
  PeriodicProc,
  TeamMember,
  TimelineAction,
} from "@/lib/ercalc/erCalculator";
import { describe, it } from "vitest";

/** Legacy flat timeline shape for test readability: supports periodicE entries
 *  that get converted into periodic procs attached to the next real action. */
type LegacyEntry = {
  char: string;
  action: TimelineAction["action"] | "periodicE";
};

function flatToERT(flat: LegacyEntry[]): ERTimeline {
  const actions: TimelineAction[] = [];
  const periodic: PeriodicProc[] = [];
  const pending: string[] = [];
  for (const e of flat) {
    if (e.action === "periodicE") {
      pending.push(e.char);
    } else {
      const idx = actions.length;
      for (const src of pending)
        periodic.push({ sourceChar: src, trigger: "E", targetIndex: idx });
      pending.length = 0;
      actions.push({ char: e.char, action: e.action });
    }
  }
  if (pending.length && actions.length > 0) {
    const last = actions.length - 1;
    for (const src of pending)
      periodic.push({ sourceChar: src, trigger: "E", targetIndex: last });
  }
  return { actions, periodic };
}

interface TeamScenario {
  team: TeamMember[];
  timeline: LegacyEntry[];
  enemyParticles?: number;
}

describe("ER diagnostic", () => {
  it("prints ER values for common teams with realistic rotations", () => {
    const scenarios: Record<string, TeamScenario> = {
      "National (Bennett funnel to XL)": {
        team: [
          { id: "bennett", element: "Pyro", burstCost: 60 },
          { id: "xiangling", element: "Pyro", burstCost: 80 },
          { id: "xingqiu", element: "Hydro", burstCost: 80 },
          { id: "sucrose", element: "Anemo", burstCost: 80 },
        ],
        // Bennett E → XL catches, Bennett E again → XL catches,
        // Bennett E → self catch, XL Guoba (4 periodicE), XQ double E, Sucrose E
        timeline: [
          { char: "bennett", action: "E" },
          { char: "xiangling", action: "Q" }, // XL absorbs Bennett E particles
          { char: "bennett", action: "E" },
          { char: "xiangling", action: "E" }, // deploy Guoba, XL absorbs Bennett E2
          { char: "xiangling", action: "periodicE" },
          { char: "xiangling", action: "periodicE" },
          { char: "xiangling", action: "periodicE" },
          { char: "xiangling", action: "periodicE" },
          { char: "bennett", action: "E" },
          { char: "bennett", action: "Q" }, // Bennett absorbs own E3
          { char: "xingqiu", action: "E" },
          { char: "xingqiu", action: "E" }, // sac sword
          { char: "xingqiu", action: "Q" },
          { char: "sucrose", action: "E" },
          { char: "sucrose", action: "E" }, // sac fragments
          { char: "sucrose", action: "Q" },
        ],
      },
      "Raiden National": {
        team: [
          { id: "raiden_shogun", element: "Electro", burstCost: 90 },
          { id: "bennett", element: "Pyro", burstCost: 60 },
          { id: "xiangling", element: "Pyro", burstCost: 80 },
          { id: "xingqiu", element: "Hydro", burstCost: 80 },
        ],
        // Realistic rotation: Raiden E deploy → supports burst → Raiden Q field time
        // Raiden periodicE procs are interleaved during other chars' field time
        timeline: [
          { char: "raiden_shogun", action: "E" }, // deploy coordinated attack
          { char: "bennett", action: "E" },
          { char: "raiden_shogun", action: "periodicE" }, // proc during Bennett
          { char: "bennett", action: "Q" },
          { char: "xiangling", action: "E" }, // deploy Guoba
          { char: "raiden_shogun", action: "periodicE" }, // proc during XL
          { char: "xiangling", action: "Q" },
          { char: "xiangling", action: "periodicE" }, // Guoba proc
          { char: "raiden_shogun", action: "periodicE" }, // proc during XL field
          { char: "xiangling", action: "periodicE" }, // Guoba proc
          { char: "xiangling", action: "periodicE" }, // Guoba proc
          { char: "xingqiu", action: "E" },
          { char: "raiden_shogun", action: "periodicE" }, // proc during XQ
          { char: "xingqiu", action: "E" },
          { char: "xingqiu", action: "Q" },
          { char: "raiden_shogun", action: "periodicE" }, // proc during XQ
          { char: "raiden_shogun", action: "Q" }, // Raiden burst
        ],
      },
      "Hu Tao Double Hydro": {
        team: [
          { id: "hu_tao", element: "Pyro", burstCost: 60 },
          { id: "xingqiu", element: "Hydro", burstCost: 80 },
          { id: "yelan", element: "Hydro", burstCost: 70 },
          { id: "zhongli", element: "Geo", burstCost: 40 },
        ],
        timeline: [
          { char: "zhongli", action: "holdE" },
          { char: "zhongli", action: "Q" },
          { char: "xingqiu", action: "E" },
          { char: "xingqiu", action: "E" },
          { char: "xingqiu", action: "Q" },
          { char: "yelan", action: "E" },
          { char: "yelan", action: "E" },
          { char: "yelan", action: "Q" },
          { char: "hu_tao", action: "E" }, // deploy infusion
          { char: "hu_tao", action: "periodicE" }, // blood blossom proc
          { char: "hu_tao", action: "Q" },
          // Zhongli pillar procs during rotation
          { char: "zhongli", action: "periodicE" },
          { char: "zhongli", action: "periodicE" },
          { char: "zhongli", action: "periodicE" },
          { char: "zhongli", action: "periodicE" },
          { char: "zhongli", action: "periodicE" },
          { char: "zhongli", action: "periodicE" },
        ],
      },
      "Fav Bennett National + enemy particles": {
        team: [
          {
            id: "bennett",
            element: "Pyro",
            burstCost: 60,
            weaponId: "favonius_sword",
          },
          { id: "xiangling", element: "Pyro", burstCost: 80 },
          {
            id: "xingqiu",
            element: "Hydro",
            burstCost: 80,
            constellation: 6,
          },
          { id: "sucrose", element: "Anemo", burstCost: 80 },
        ],
        timeline: [
          { char: "bennett", action: "E" },
          { char: "xiangling", action: "Q" }, // XL absorbs Bennett E + Fav
          { char: "bennett", action: "E" },
          { char: "xiangling", action: "E" },
          { char: "xiangling", action: "periodicE" },
          { char: "xiangling", action: "periodicE" },
          { char: "xiangling", action: "periodicE" },
          { char: "xiangling", action: "periodicE" },
          { char: "bennett", action: "E" },
          { char: "bennett", action: "Q" },
          { char: "xingqiu", action: "E" },
          { char: "xingqiu", action: "E" },
          { char: "xingqiu", action: "Q" },
          { char: "sucrose", action: "E" },
          { char: "sucrose", action: "E" },
          { char: "sucrose", action: "Q" },
        ],
        enemyParticles: 12,
      },
      "Freeze (Ayaka + Shenhe + Kokomi + Kazuha)": {
        team: [
          { id: "kamisato_ayaka", element: "Cryo", burstCost: 80 },
          { id: "shenhe", element: "Cryo", burstCost: 80 },
          { id: "sangonomiya_kokomi", element: "Hydro", burstCost: 70 },
          { id: "kaedehara_kazuha", element: "Anemo", burstCost: 60 },
        ],
        timeline: [
          { char: "sangonomiya_kokomi", action: "E" }, // deploy jellyfish
          { char: "shenhe", action: "E" },
          { char: "shenhe", action: "Q" },
          { char: "kaedehara_kazuha", action: "E" },
          { char: "kaedehara_kazuha", action: "Q" },
          { char: "kamisato_ayaka", action: "E" },
          { char: "kamisato_ayaka", action: "Q" },
          { char: "sangonomiya_kokomi", action: "periodicE" }, // jellyfish proc
          { char: "sangonomiya_kokomi", action: "periodicE" },
          { char: "sangonomiya_kokomi", action: "periodicE" },
          { char: "sangonomiya_kokomi", action: "Q" },
        ],
      },
      "Mono Geo (Itto + Gorou + Albedo + Zhongli)": {
        team: [
          { id: "arataki_itto", element: "Geo", burstCost: 70 },
          { id: "gorou", element: "Geo", burstCost: 80 },
          { id: "albedo", element: "Geo", burstCost: 40 },
          { id: "zhongli", element: "Geo", burstCost: 40 },
        ],
        timeline: [
          { char: "zhongli", action: "holdE" },
          { char: "albedo", action: "E" }, // deploy
          { char: "gorou", action: "E" },
          { char: "gorou", action: "Q" },
          { char: "arataki_itto", action: "E" },
          { char: "arataki_itto", action: "Q" },
          // Periodic procs during Itto field time
          { char: "albedo", action: "periodicE" },
          { char: "albedo", action: "periodicE" },
          { char: "albedo", action: "periodicE" },
          { char: "zhongli", action: "periodicE" },
          { char: "zhongli", action: "periodicE" },
        ],
      },
    };
    for (const [name, scenario] of Object.entries(scenarios)) {
      const opts = scenario.enemyParticles
        ? { enemyParticles: scenario.enemyParticles }
        : {};
      const results = calculateTeamER(
        scenario.team,
        flatToERT(scenario.timeline),
        opts
      );
      console.log(`\n=== ${name} ===`);
      for (const r of results) {
        const b = r.energyBreakdown;
        const qInfo =
          r.bindingQIndex != null
            ? ` [binding Q at idx ${r.bindingQIndex}]`
            : "";
        console.log(
          `  ${r.characterId}: ${r.erNeeded === Number.POSITIVE_INFINITY ? "∞" : r.erNeeded.toFixed(0)}% ER` +
            ` (particles=${b.particleEnergy.toFixed(1)}, flat=${b.flatEnergy.toFixed(1)})${qInfo}`
        );
      }
    }
  });
});
