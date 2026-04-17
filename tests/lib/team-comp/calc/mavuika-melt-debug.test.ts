import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/lib/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/team-comp/calc/formulaCompiler";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import type {
  CalcContext,
  FormulaOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import "@/lib/team-comp/index";

await preloadGameStats();

describe("Mavuika melt Q damage investigation", () => {
  const configs: TeamSlotConfig[] = [
    {
      charId: "mavuika",
      charLevel: 90,
      constellation: 0,
      weaponId: "a_thousand_blazing_suns",
      refinement: 1,
      artifactSetId: "obsidian_codex",
      artifactHalfSetIds: ["nightsoul-dmg%-15"],
    },
    {
      charId: "citlali",
      charLevel: 90,
      constellation: 2,
      weaponId: "starcallers_watch",
      refinement: 1,
      artifactSetId: "scroll_of_the_hero_of_cinder_city",
      artifactHalfSetIds: ["nightsoul-energy-6"],
    },
    {
      charId: "xilonen",
      charLevel: 90,
      constellation: 0,
      weaponId: "freedomsworn",
      refinement: 1,
      artifactSetId: "archaic_petra",
      artifactHalfSetIds: ["geo%-15"],
    },
    {
      charId: "bennett",
      charLevel: 90,
      constellation: 6,
      weaponId: "mistsplitter_reforged",
      refinement: 2,
      artifactSetId: "noblesse_oblige",
      artifactHalfSetIds: ["burst-dmg%-20"],
    },
  ];

  const calcContext: CalcContext = {
    enemyLevel: 103,
    enemyRes: 10,
  };

  const meltOverride: FormulaOverride = {
    reaction: "melt",
  };

  it("shows buff breakdown for Mavuika Q melt", () => {
    const teamBuild = new TeamBuild(configs);

    const emptySheets: Record<string, StatSheet> = {};
    for (const c of configs) emptySheets[c.charId] = new StatSheet([]);

    // Display path
    const displayResult = teamBuild.getDisplayResult(
      "mavuika",
      "mavuika-sunfell",
      emptySheets,
      calcContext,
      meltOverride
    );

    console.log("=== Display Result (no artifacts) ===");
    console.log("Total damage:", displayResult.totalDamage);
    const parts = Object.values(displayResult.partsByFormula).flat();
    for (const part of parts) {
      console.log(`Part: damage=${part.damage}, hits=${part.hits}`);
      if (part.statValues) {
        console.log("  Stats:", JSON.stringify(part.statValues));
      }
    }

    // Team stats
    const teamStats = teamBuild.getTeamStats(
      emptySheets,
      "mavuika",
      calcContext
    );
    const mavStats = teamStats.mavuika!;

    const tag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "melt" as const,
    };
    console.log("\n=== Mavuika final stats (burst/Pyro tag) ===");
    console.log("ATK:", mavStats.get("atk", tag));
    console.log("EM:", mavStats.get("em", tag));
    console.log("CR:", mavStats.get("cr", tag));
    console.log("CD:", mavStats.get("cd", tag));
    console.log("DMG%:", mavStats.get("dmg%", tag));
    console.log("BaseDmg:", mavStats.get("baseDmg", tag));
    console.log("BaseDmg%:", mavStats.get("baseDmg%", tag));
    console.log("DefReduction%:", mavStats.get("defReduction%", tag));
    console.log("DefIgnore%:", mavStats.get("defIgnore%", tag));
    console.log("ResReduction%:", mavStats.get("resReduction%", tag));
    console.log("ReactionDmg%:", mavStats.get("reactionDmg%", tag));
    console.log("Elevated%:", mavStats.get("elevated%", tag));

    // Resolved buffs
    console.log("\n=== Resolved Buffs ===");
    for (const b of displayResult.buffs) {
      const active = b.active ? "ACTIVE" : "inactive";
      const srcId = `${b.source.type}:${b.source.id}`;
      const entries =
        b.staticEntries.length > 0
          ? b.staticEntries.map((e) => `${e.key}=${e.value}`).join(", ")
          : "";
      const dynEntries = b.dynamicEntries?.length
        ? ` + dynamic: ${b.dynamicEntries.map((e) => `${e.key}=${e.value}`).join(", ")}`
        : "";
      console.log(
        `  [${active}] ${srcId} (from ${b.providerCharId}): ${entries}${dynEntries}`
      );
    }

    // Compiled formula
    const compiled = compileComboTeamDamage(
      teamBuild,
      singleFormulaCombo("mavuika", "mavuika-sunfell", meltOverride),
      "mavuika",
      emptySheets,
      calcContext
    );

    const vars = new Float64Array(compiled.numVars);
    const charIdx = compiled.charIdxMap?.get("mavuika") ?? 0;
    fillVarsFromSheet(emptySheets.mavuika!, compiled.varMapping, charIdx, vars);
    const compiledDmg = compiled.evaluate(vars);

    console.log("\n=== Compiled vs Display ===");
    console.log("Display damage:", displayResult.totalDamage);
    console.log("Compiled damage:", compiledDmg);
    console.log(
      "Ratio (compiled/display):",
      compiledDmg / displayResult.totalDamage
    );

    expect(compiledDmg).toBeCloseTo(displayResult.totalDamage, -1);
  });
});
