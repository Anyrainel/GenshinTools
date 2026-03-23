import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import "@/lib/team-comp/index";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type { ExtraBuff } from "@/lib/team-comp/extraBuffTypes";
import { resolveExtraBuffEntries } from "@/lib/team-comp/extraBuffTypes";
import type { TeamSlotConfig } from "@/lib/team-comp/types";

await preloadGameStats();

// ─── resolveExtraBuffEntries unit tests ───

describe("resolveExtraBuffEntries", () => {
  it("returns empty for no buffs", () => {
    expect(resolveExtraBuffEntries([], "hu_tao")).toEqual([]);
  });

  it("collects team-wide buffs", () => {
    const buffs: ExtraBuff[] = [
      {
        id: "1",
        target: "team",
        stats: [{ key: "atk%", value: 0.2 }],
      },
    ];
    const entries = resolveExtraBuffEntries(buffs, "hu_tao");
    expect(entries).toEqual([{ key: "atk%", value: 0.2 }]);
  });

  it("collects character-targeted buffs", () => {
    const buffs: ExtraBuff[] = [
      {
        id: "1",
        target: "hu_tao",
        stats: [{ key: "cr", value: 0.1 }],
      },
    ];
    expect(resolveExtraBuffEntries(buffs, "hu_tao")).toEqual([
      { key: "cr", value: 0.1 },
    ]);
    // Other character should NOT receive it
    expect(resolveExtraBuffEntries(buffs, "xingqiu")).toEqual([]);
  });

  it("sums duplicate keys from multiple buffs", () => {
    const buffs: ExtraBuff[] = [
      {
        id: "1",
        target: "team",
        stats: [{ key: "atk%", value: 0.1 }],
      },
      {
        id: "2",
        target: "team",
        stats: [{ key: "atk%", value: 0.15 }],
      },
    ];
    const entries = resolveExtraBuffEntries(buffs, "hu_tao");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.key).toBe("atk%");
    expect(entries[0]!.value).toBeCloseTo(0.25);
  });

  it("combines team-wide and per-character buffs", () => {
    const buffs: ExtraBuff[] = [
      {
        id: "1",
        target: "team",
        stats: [{ key: "atk%", value: 0.1 }],
      },
      {
        id: "2",
        target: "hu_tao",
        stats: [{ key: "cr", value: 0.05 }],
      },
    ];
    const entries = resolveExtraBuffEntries(buffs, "hu_tao");
    expect(entries).toHaveLength(2);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("atk%");
    expect(keys).toContain("cr");
  });
});

// ─── TeamBuild integration: extra buffs affect stat sheets ───

const baseConfigs: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 0,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "zhongli",
    charLevel: 90,
    constellation: 0,
    weaponId: "black_tassel",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "favonius_sword",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
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
      const atkBefore = statsWithout[c.charId]!.get("atk");
      const atkAfter = statsWith[c.charId]!.get("atk");
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
    const htCrBefore = statsWithout.hu_tao!.get("cr");
    const htCrAfter = statsWith.hu_tao!.get("cr");
    expect(htCrAfter - htCrBefore).toBeCloseTo(0.15);

    // Xingqiu should be unaffected
    const xqCrBefore = statsWithout.xingqiu!.get("cr");
    const xqCrAfter = statsWith.xingqiu!.get("cr");
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
