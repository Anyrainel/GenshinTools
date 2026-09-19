import { beforeAll, describe, expect, it } from "vitest";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import "@/lib/dmgcalc";
import { singleFormulaCombo } from "@/lib/dmgcalc/core/combo";
import { DirectFormula } from "@/lib/dmgcalc/core/damageFormula";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/dmgcalc/core/formulaCompiler";
import { getInfusionOptionKey } from "@/lib/dmgcalc/core/infusion";
import { createCharacter } from "@/lib/dmgcalc/core/registry";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import { getFormulaReactions } from "@/lib/dmgcalc/core/teamFormulaCatalog";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import type { CalcContext, TeamSlotConfig } from "@/lib/dmgcalc/types";

describe("explicit physical attack infusion", () => {
  beforeAll(async () => {
    await Promise.all([
      characterStatsResource.preload(),
      weaponStatsResource.preload(),
    ]);
    team = new TeamMeta(ids, { bennett: 6, dori: 6 });
  });
  const ids = ["bennett", "candace", "chongyun", "dori"];
  let team: TeamMeta;
  function character(id: string, source?: string, meta = team) {
    return createCharacter(
      id,
      90,
      meta.constellations[id] ?? 0,
      meta,
      source ? { [getInfusionOptionKey(id)]: source } : {}
    );
  }

  it.each([
    ["bennett", "Pyro"],
    ["candace", "Hydro"],
    ["chongyun", "Cryo"],
  ])("uses selected %s field even with competing fields", (source, element) => {
    const entry = character("candace", source).getFormulaEntry(
      "candace-normal"
    )!;
    expect(entry.parts.length).toBeGreaterThan(0);
    for (const part of entry.parts) {
      expect(part.formula).toBeInstanceOf(DirectFormula);
      expect(part.formula.tag.element).toBe(element);
    }
    expect(
      character("candace").getFormulaEntry("candace-normal")!.parts[0].formula
        .tag.element
    ).toBe("Physical");
  });

  it("does not allow a missing field or Bennett below C6", () => {
    for (const meta of [
      new TeamMeta(["candace"]),
      new TeamMeta(["candace", "bennett"], { bennett: 5 }),
    ]) {
      expect(
        character("candace", "bennett", meta).getFormulaEntry("candace-normal")!
          .parts[0].formula.tag.element
      ).toBe("Physical");
    }
  });

  it("preserves elemental attack modes and skill/burst damage", () => {
    const dori = character("dori", "bennett");
    expect(
      dori.getFormulaEntry("dori-normal")!.parts[0].formula.tag.element
    ).toBe("Pyro");
    expect(
      dori.getFormulaEntry("dori-c6-normal")!.parts[0].formula.tag.element
    ).toBe("Electro");
    expect(
      character("bennett", "candace").getFormulaEntry("bennett-burst")!.parts[0]
        .formula.tag.element
    ).toBe("Pyro");
    const bowTeam = new TeamMeta(["fischl", "bennett"], { bennett: 6 });
    const original = character("fischl", undefined, bowTeam);
    const infused = character("fischl", "bennett", bowTeam);
    expect(
      Object.values(infused.allFormulaEntries).flatMap((entry) =>
        entry.parts.map((part) => part.formula.tag)
      )
    ).toEqual(
      Object.values(original.allFormulaEntries).flatMap((entry) =>
        entry.parts.map((part) => part.formula.tag)
      )
    );
  });

  it("keeps standard and compiled damage equal with elemental buffs", () => {
    const configs: TeamSlotConfig[] = [
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 6,
        weaponId: "favonius_sword",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "chongyun",
        charLevel: 90,
        constellation: 0,
        weaponId: "favonius_greatsword",
        refinement: 1,
        artifactSet: null,
      },
    ];
    const build = new TeamBuild(configs, {
      [getInfusionOptionKey("chongyun")]: "bennett",
    });
    const sheets = {
      bennett: new StatSheet([]),
      chongyun: new StatSheet([{ key: "pyro%", value: 0.466 }]),
    };
    const context: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };
    build.teamStats.setArtifacts(sheets, context);
    const entry = build.catalog.formulaIndex.get("chongyun-normal")!;
    expect(getFormulaReactions("chongyun", entry, "Cryo", () => true)).toEqual(
      expect.arrayContaining(["melt", "vaporize"])
    );
    const reaction = { reaction: "melt" as const };
    const expected = build.getDamageResult(
      "chongyun",
      "chongyun-normal",
      context,
      reaction
    ).totalDamage;
    const unreacted = build.getDamageResult(
      "chongyun",
      "chongyun-normal",
      context
    ).totalDamage;
    expect(expected / unreacted).toBeCloseTo(2, 6);
    const compiled = compileComboTeamDamage(
      build,
      singleFormulaCombo("chongyun", "chongyun-normal", reaction),
      "chongyun",
      sheets,
      context
    );
    const vars = new Float64Array(compiled.numVars);
    fillVarsFromSheet(
      sheets.chongyun,
      compiled.varMapping,
      compiled.charIdxMap?.get("chongyun") ?? 0,
      vars
    );
    expect(compiled.evaluate(vars)).toBeCloseTo(expected, 6);
    expect(expected).toBeGreaterThan(0);
  });
});
