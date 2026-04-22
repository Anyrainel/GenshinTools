import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/lib/gameStatsLoader";
import { getSourceIcon, getSourceName } from "@/lib/team-comp/buffDisplayUtils";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import "@/lib/team-comp/index";
import { createExtraStatBuffs } from "@/lib/team-comp/calc/statBuff";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import type { ExtraBuff } from "@/lib/team-comp/types";
import type { CalcContext, TeamSlotConfig } from "@/lib/team-comp/types";

await preloadGameStats();

// ─── TeamBuild integration: extra buffs affect stat sheets ───

const baseConfigs: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 0,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: null,
  },
  {
    charId: "zhongli",
    charLevel: 90,
    constellation: 0,
    weaponId: "black_tassel",
    refinement: 5,
    artifactSet: null,
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "favonius_sword",
    refinement: 5,
    artifactSet: null,
  },
];

describe("TeamBuild with extraBuffs", () => {
  it("team-wide atk% buff increases all characters' ATK", () => {
    const emptySheets: Record<string, StatSheet> = {};
    for (const c of baseConfigs) {
      emptySheets[c.charId] = new StatSheet([]);
    }

    const tbWithout = new TeamBuild(baseConfigs);
    const statsWithout = tbWithout.getTeamStats(emptySheets, "hu_tao");

    const extraBuffs: ExtraBuff[] = [
      {
        id: "food-atk",
        target: "team",
        stats: [{ key: "atk%", value: 0.2 }],
      },
    ];
    const tbWith = new TeamBuild(baseConfigs, {}, undefined, extraBuffs);
    const statsWith = tbWith.getTeamStats(emptySheets, "hu_tao");

    // Every character should have higher ATK
    for (const c of baseConfigs) {
      const atkBefore = statsWithout[c.charId]!.get("atk", null);
      const atkAfter = statsWith[c.charId]!.get("atk", null);
      expect(atkAfter).toBeGreaterThan(atkBefore);
    }
  });

  it("per-character buff only affects the targeted character", () => {
    const emptySheets: Record<string, StatSheet> = {};
    for (const c of baseConfigs) {
      emptySheets[c.charId] = new StatSheet([]);
    }

    const extraBuffs: ExtraBuff[] = [
      {
        id: "custom-cr",
        target: "hu_tao",
        stats: [{ key: "cr", value: 0.15 }],
      },
    ];

    const tbWithout = new TeamBuild(baseConfigs);
    const tbWith = new TeamBuild(baseConfigs, {}, undefined, extraBuffs);

    const statsWithout = tbWithout.getTeamStats(emptySheets, "hu_tao");
    const statsWith = tbWith.getTeamStats(emptySheets, "hu_tao");

    // Hu Tao should have +0.15 CR
    const htCrBefore = statsWithout.hu_tao!.get("cr", null);
    const htCrAfter = statsWith.hu_tao!.get("cr", null);
    expect(htCrAfter - htCrBefore).toBeCloseTo(0.15);

    // Xingqiu should be unaffected
    const xqCrBefore = statsWithout.xingqiu!.get("cr", null);
    const xqCrAfter = statsWith.xingqiu!.get("cr", null);
    expect(xqCrAfter).toBeCloseTo(xqCrBefore);
  });

  it("extra buffs propagate through extraBuffs field for reconstruction", () => {
    const extraBuffs: ExtraBuff[] = [
      {
        id: "food-em",
        target: "team",
        stats: [{ key: "em", value: 120 }],
      },
    ];
    const tb = new TeamBuild(baseConfigs, {}, undefined, extraBuffs);
    expect(tb.extraBuffs).toBe(extraBuffs);
    expect(tb.extraBuffs).toHaveLength(1);
  });
});

// ─── createExtraStatBuffs unit tests ───

describe("createExtraStatBuffs", () => {
  it("converts team-wide ExtraBuff to StatBuff with correct source/target", () => {
    const buffs = createExtraStatBuffs([
      {
        id: "food-1",
        presetId: "gateau_debord",
        target: "team",
        stats: [{ key: "atk", value: 384 }],
      },
    ]);
    expect(buffs).toHaveLength(1);
    expect(buffs[0]!.source.type).toBe("extra");
    expect(buffs[0]!.source.id).toBe("gateau_debord");
    expect(buffs[0]!.target.receiver).toBe("team");
    expect(buffs[0]!.target.charId).toBeUndefined();
  });

  it("strips food: prefix from presetId for source.id", () => {
    const buffs = createExtraStatBuffs([
      {
        id: "food-1",
        presetId: "food:frosting_essential_oil",
        target: "team",
        stats: [{ key: "atk%", value: 0.2 }],
      },
    ]);
    expect(buffs[0]!.source.id).toBe("frosting_essential_oil");
  });

  it("converts per-character ExtraBuff with charId on target", () => {
    const buffs = createExtraStatBuffs([
      {
        id: "custom-1",
        target: "hu_tao",
        stats: [{ key: "cr", value: 0.15 }],
      },
    ]);
    expect(buffs).toHaveLength(1);
    expect(buffs[0]!.source.type).toBe("extra");
    expect(buffs[0]!.source.id).toBe("custom-1"); // no presetId → uses id
    expect(buffs[0]!.target.receiver).toBe("team");
    expect(buffs[0]!.target.charId).toBe("hu_tao");
  });
});

// ─── Display integration: extra buffs appear in getDisplayResult().buffs ───

const CTX: CalcContext = {
  enemyLevel: 90,
  enemyRes: 10,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

function getFirstFormulaId(tb: TeamBuild, charId: string): string {
  const ids = tb.catalog.getFormulaIds()[charId];
  if (!ids) throw new Error(`No formulas for ${charId}`);
  return Object.keys(ids)[0]!;
}

describe("extra buffs in DisplayResult", () => {
  const emptySheets: Record<string, StatSheet> = {};
  for (const c of baseConfigs) {
    emptySheets[c.charId] = new StatSheet([]);
  }

  it("team-wide food buff appears in buffs with source.type extraBuff", () => {
    const extraBuffs: ExtraBuff[] = [
      {
        id: "food-atk",
        presetId: "gateau_debord",
        target: "team",
        stats: [{ key: "atk", value: 384 }],
      },
    ];
    const tb = new TeamBuild(baseConfigs, {}, undefined, extraBuffs);
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const dr = tb.getDisplayResult("hu_tao", formulaId, emptySheets, CTX);

    const extraBuff = dr.buffs.find((b) => b.source.type === "extra");
    expect(extraBuff).toBeDefined();
    expect(extraBuff!.source.id).toBe("gateau_debord");
    expect(extraBuff!.active).toBe(true);
  });

  it("team-wide food buff is active for any calcTarget", () => {
    const extraBuffs: ExtraBuff[] = [
      {
        id: "food-cr",
        target: "team",
        stats: [{ key: "cr", value: 0.2 }],
      },
    ];
    const tb = new TeamBuild(baseConfigs, {}, undefined, extraBuffs);

    // Check for hu_tao as calc target
    const fHt = getFirstFormulaId(tb, "hu_tao");
    const drHt = tb.getDisplayResult("hu_tao", fHt, emptySheets, CTX);
    const buffHt = drHt.buffs.find((b) => b.source.type === "extra");
    expect(buffHt).toBeDefined();
    expect(buffHt!.active).toBe(true);

    // Check for xingqiu as calc target
    const fXq = getFirstFormulaId(tb, "xingqiu");
    const drXq = tb.getDisplayResult("xingqiu", fXq, emptySheets, CTX);
    const buffXq = drXq.buffs.find((b) => b.source.type === "extra");
    expect(buffXq).toBeDefined();
    expect(buffXq!.active).toBe(true);
  });

  it("per-character status buff is active only for matching calcTarget", () => {
    const extraBuffs: ExtraBuff[] = [
      {
        id: "status-1",
        target: "hu_tao",
        stats: [{ key: "cr", value: 0.15 }],
      },
    ];
    const tb = new TeamBuild(baseConfigs, {}, undefined, extraBuffs);

    // Active for hu_tao
    const fHt = getFirstFormulaId(tb, "hu_tao");
    const drHt = tb.getDisplayResult("hu_tao", fHt, emptySheets, CTX);
    const buffHt = drHt.buffs.find((b) => b.source.type === "extra");
    expect(buffHt).toBeDefined();
    expect(buffHt!.active).toBe(true);

    // Inactive for xingqiu
    const fXq = getFirstFormulaId(tb, "xingqiu");
    const drXq = tb.getDisplayResult("xingqiu", fXq, emptySheets, CTX);
    const buffXq = drXq.buffs.find((b) => b.source.type === "extra");
    expect(buffXq).toBeDefined();
    expect(buffXq!.active).toBe(false);
  });
});

// ─── buffDisplayUtils: getSourceIcon / getSourceName for extraBuff ───

describe("buffDisplayUtils for extraBuff source", () => {
  it("getSourceIcon returns imagePath from envBuffsById for known preset", () => {
    const icon = getSourceIcon({ type: "extra", id: "gateau_debord" });
    expect(icon).toBe("/food/gateau_debord.webp");
  });

  it("getSourceIcon returns undefined for unknown/custom id", () => {
    const icon = getSourceIcon({ type: "extra", id: "custom-unknown" });
    expect(icon).toBeUndefined();
  });

  it("getSourceName returns translated name via t.envBuff", () => {
    const mockT = {
      envBuff: (id: string) => `translated:${id}`,
    } as unknown as Parameters<typeof getSourceName>[1];
    const name = getSourceName({ type: "extra", id: "gateau_debord" }, mockT);
    expect(name).toBe("translated:gateau_debord");
  });
});
