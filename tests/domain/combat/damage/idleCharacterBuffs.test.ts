import "@/providers/reference/statLoaders";
import { describe, expect, it } from "vitest";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { TeamSlotConfig } from "@/domain/combat/damage/types";
import type { StatKey } from "@/domain/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

function slot(
  charId: string,
  weaponId: string,
  constellation = 0
): TeamSlotConfig {
  return {
    charId,
    weaponId,
    constellation,
    charLevel: 90,
    refinement: 1,
    artifactSet: null,
  };
}

function panelStat(sheet: StatSheet, key: StatKey): number {
  if (key.endsWith("%")) return sheet.getIdleStats()[key] ?? 0;
  return sheet.get(key, null);
}

describe("character idle activation conditions", () => {
  it.each<{
    charId: string;
    weaponId: string;
    constellation: number;
    stat: StatKey;
    combatBonus: number;
  }>([
    {
      charId: "diluc",
      weaponId: "favonius_greatsword",
      constellation: 2,
      stat: "atk",
      combatBonus: 0.3,
    },
    {
      charId: "sethos",
      weaponId: "favonius_warbow",
      constellation: 2,
      stat: "electro%",
      combatBonus: 0.3,
    },
    {
      charId: "keqing",
      weaponId: "favonius_sword",
      constellation: 6,
      stat: "electro%",
      combatBonus: 0.24,
    },
    {
      charId: "arlecchino",
      weaponId: "favonius_lance",
      constellation: 0,
      stat: "pyro%",
      combatBonus: 0.4,
    },
    {
      charId: "odette",
      weaponId: "favonius_sword",
      constellation: 2,
      stat: "atk",
      combatBonus: 0.42,
    },
  ])(
    "$charId keeps its combat-only $stat bonus out of both idle field states",
    ({ charId, weaponId, constellation, stat, combatBonus }) => {
      const build = new TeamBuild([
        slot(charId, weaponId, constellation),
        slot("lisa", "favonius_codex"),
      ]);
      const base = build.charBuilds[charId].baseStatSheet;
      const combat = build.getTeamStats({}, charId)[charId];
      const idle = build.teamStats.getIdleStats()[charId];
      expect(panelStat(idle.onField, stat)).toBeCloseTo(
        panelStat(base, stat),
        8
      );
      expect(panelStat(idle.offField, stat)).toBeCloseTo(
        panelStat(base, stat),
        8
      );
      expect(panelStat(combat, stat)).toBeCloseTo(
        panelStat(base, stat) +
          combatBonus * (stat === "atk" ? base.get("baseAtk", null) : 1),
        8
      );
    }
  );

  it.each([
    ["xingqiu", "favonius_sword", "hydro%", 0.2],
    ["neuvillette", "favonius_codex", "hydro%", 0.3],
  ] as const)(
    "%s retains its inherent elemental bonus in idle stats",
    (charId, weaponId, stat, bonus) => {
      const build = new TeamBuild([slot(charId, weaponId)]);
      const base = build.charBuilds[charId].baseStatSheet;
      build.getTeamStats({}, charId);
      const idle = build.teamStats.getIdleStats()[charId];
      for (const sheet of [idle.onField, idle.offField]) {
        expect(panelStat(sheet, stat)).toBeCloseTo(
          panelStat(base, stat) + bonus,
          8
        );
      }
    }
  );

  it("Mona converts idle ER including weapon and artifacts into Hydro bonus", () => {
    const build = new TeamBuild([slot("mona", "favonius_codex")]);
    build.getTeamStats(
      { mona: new StatSheet([{ key: "er", value: 0.2 }]) },
      "mona"
    );
    const idle = build.teamStats.getIdleStats().mona;
    for (const sheet of [idle.onField, idle.offField]) {
      expect(panelStat(sheet, "hydro%")).toBeCloseTo(
        sheet.get("er", null) * 0.2,
        8
      );
    }
  });

  it("Yelan and Navia retain party-composition HP and ATK bonuses while idle", () => {
    const build = new TeamBuild([
      slot("yelan", "favonius_warbow"),
      slot("navia", "favonius_greatsword"),
      slot("lisa", "favonius_codex"),
    ]);
    build.getTeamStats({}, "navia");
    const idle = build.teamStats.getIdleStats();
    for (const field of ["onField", "offField"] as const) {
      const yelanBase = build.charBuilds.yelan.baseStatSheet;
      expect(idle.yelan[field].get("hp", null)).toBeCloseTo(
        yelanBase.get("hp", null) + yelanBase.get("baseHp", null) * 0.18,
        8
      );
      const naviaBase = build.charBuilds.navia.baseStatSheet;
      expect(idle.navia[field].get("atk", null)).toBeCloseTo(
        naviaBase.get("atk", null) + naviaBase.get("baseAtk", null) * 0.4,
        8
      );
    }
  });

  it("Zibai retains party-composition DEF and EM while idle", () => {
    const build = new TeamBuild([
      slot("zibai", "favonius_sword"),
      slot("zhongli", "favonius_lance"),
      slot("xingqiu", "favonius_sword"),
    ]);
    build.getTeamStats({}, "zibai");
    const idle = build.teamStats.getIdleStats().zibai;
    const base = build.charBuilds.zibai.baseStatSheet;
    for (const sheet of [idle.onField, idle.offField]) {
      expect(sheet.get("def", null)).toBeCloseTo(
        base.get("def", null) + base.get("baseDef", null) * 0.15,
        8
      );
      expect(sheet.get("em", null)).toBeCloseTo(base.get("em", null) + 60, 8);
    }
  });

  it.each([
    ["flins", "favonius_lance", "atk", 0.08, 160],
    ["sandrone", "favonius_sword", "atk", 0.08, 160],
    ["linnea", "favonius_warbow", "def", 0.05, Number.POSITIVE_INFINITY],
  ] as const)(
    "%s retains its unconditional stat-to-EM conversion while idle",
    (charId, weaponId, input, factor, cap) => {
      const build = new TeamBuild([slot(charId, weaponId)]);
      build.getTeamStats({}, charId);
      const idle = build.teamStats.getIdleStats()[charId];
      const baseEm = build.charBuilds[charId].baseStatSheet.get("em", null);
      for (const sheet of [idle.onField, idle.offField]) {
        expect(sheet.get("em", null)).toBeCloseTo(
          baseEm + Math.min(sheet.get(input, null) * factor, cap),
          8
        );
      }
    }
  );

  it.each([
    "traveler_anemo",
    "traveler_geo",
    "traveler_electro",
    "traveler_dendro",
    "traveler_hydro",
    "traveler_pyro",
    "traveler_cryo",
  ])("%s retains permanent resonance unlocks while idle", (charId) => {
    const build = new TeamBuild([slot(charId, "favonius_sword", 2)]);
    build.getTeamStats({}, charId);
    const idle = build.teamStats.getIdleStats()[charId];
    const base = build.charBuilds[charId].baseStatSheet;
    for (const sheet of [idle.onField, idle.offField]) {
      expect(sheet.get("hp", null)).toBeCloseTo(
        base.get("hp", null) + base.get("baseHp", null) * 0.2,
        8
      );
      expect(sheet.get("def", null)).toBeCloseTo(
        base.get("def", null) + base.get("baseDef", null) * 0.2,
        8
      );
      expect(sheet.get("atk", null)).toBeCloseTo(
        base.get("atk", null) + base.get("baseAtk", null) * 0.2,
        8
      );
      expect(sheet.get("er", null)).toBeCloseTo(
        base.get("er", null) + 0.2 + (charId === "traveler_anemo" ? 0.16 : 0),
        8
      );
      expect(sheet.get("em", null)).toBeCloseTo(
        base.get("em", null) +
          60 +
          (charId === "traveler_cryo"
            ? Math.min(sheet.get("atk", null) * 0.08, 160)
            : 0),
        8
      );
      expect(sheet.get("cr", null)).toBeCloseTo(base.get("cr", null) + 0.1, 8);
      expect(sheet.get("cd", null)).toBeCloseTo(base.get("cd", null) + 0.2, 8);
    }
  });

  it("Nilou C6 retains HP-based CRIT stats while idle", () => {
    const build = new TeamBuild([slot("nilou", "favonius_sword", 6)]);
    build.getTeamStats(
      { nilou: new StatSheet([{ key: "hp", value: 10000 }]) },
      "nilou"
    );
    const idle = build.teamStats.getIdleStats().nilou;
    const base = build.charBuilds.nilou.baseStatSheet;
    for (const sheet of [idle.onField, idle.offField]) {
      expect(sheet.get("cr", null)).toBeCloseTo(
        base.get("cr", null) + Math.min(sheet.get("hp", null) * 0.000006, 0.3),
        8
      );
      expect(sheet.get("cd", null)).toBeCloseTo(
        base.get("cd", null) + Math.min(sheet.get("hp", null) * 0.000012, 0.6),
        8
      );
    }
  });

  it("Lyney C2 can build CRIT DMG by idling on field and loses it off field", () => {
    const build = new TeamBuild([slot("lyney", "favonius_warbow", 2)]);
    build.getTeamStats({}, "lyney");
    const idle = build.teamStats.getIdleStats().lyney;
    const baseCd = build.charBuilds.lyney.baseStatSheet.get("cd", null);
    expect(idle.onField.get("cd", null)).toBeCloseTo(baseCd + 0.6, 8);
    expect(idle.offField.get("cd", null)).toBeCloseTo(baseCd, 8);
  });

  it("Flins C4's permanent ATK bonus feeds his enhanced idle EM conversion", () => {
    const build = new TeamBuild([slot("flins", "favonius_lance", 4)]);
    build.getTeamStats({}, "flins");
    const idle = build.teamStats.getIdleStats().flins;
    const base = build.charBuilds.flins.baseStatSheet;
    for (const sheet of [idle.onField, idle.offField]) {
      expect(sheet.get("atk", null)).toBeCloseTo(
        base.get("atk", null) + base.get("baseAtk", null) * 0.2,
        8
      );
      expect(sheet.get("em", null)).toBeCloseTo(
        base.get("em", null) + Math.min(sheet.get("atk", null) * 0.1, 220),
        8
      );
    }
  });

  it("Linnea shares idle EM with the active Moonsign teammate", () => {
    const build = new TeamBuild([
      slot("linnea", "favonius_warbow"),
      slot("flins", "favonius_lance"),
    ]);
    build.getTeamStats({}, "flins");
    const idle = build.teamStats.getIdleStats();
    const sharedEm = idle.linnea.onField.get("def", null) * 0.05;
    const flinsBaseEm = build.charBuilds.flins.baseStatSheet.get("em", null);
    const flinsOwnEm = Math.min(
      idle.flins.onField.get("atk", null) * 0.08,
      160
    );
    expect(idle.flins.onField.get("em", null)).toBeCloseTo(
      flinsBaseEm + flinsOwnEm + sharedEm,
      8
    );
    expect(idle.flins.offField.get("em", null)).toBeCloseTo(
      flinsBaseEm + flinsOwnEm,
      8
    );
  });
});
