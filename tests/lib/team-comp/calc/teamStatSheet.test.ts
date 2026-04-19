import { preloadGameStats } from "@/lib/gameStatsLoader";
import { getBuffInstanceKey } from "@/lib/team-comp/calc/statBuff";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { TeamStatSheet } from "@/lib/team-comp/calc/teamStatSheet";
import type { CalcContext, TeamSlotConfig } from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";

await preloadGameStats();

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

function emptySheets(...charIds: string[]): Record<string, StatSheet> {
  const sheets: Record<string, StatSheet> = {};
  for (const id of charIds) sheets[id] = new StatSheet([]);
  return sheets;
}

// ── Team Configurations ──

const NATIONAL_TEAM: TeamSlotConfig[] = [
  {
    charId: "xiangling",
    charLevel: 90,
    constellation: 6,
    weaponId: "the_catch",
    refinement: 5,
    artifactSetId: "emblem_of_severed_fate",
    artifactHalfSetIds: [],
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSetId: "noblesse_oblige",
    artifactHalfSetIds: [],
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSetId: "emblem_of_severed_fate",
    artifactHalfSetIds: [],
  },
  {
    charId: "raiden_shogun",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_catch",
    refinement: 5,
    artifactSetId: "emblem_of_severed_fate",
    artifactHalfSetIds: [],
  },
];

const KAZUHA_TEAM: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 1,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSetId: "crimson_witch_of_flames",
    artifactHalfSetIds: [],
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSetId: "viridescent_venerer",
    artifactHalfSetIds: [],
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSetId: "emblem_of_severed_fate",
    artifactHalfSetIds: [],
  },
  {
    charId: "yelan",
    charLevel: 90,
    constellation: 0,
    weaponId: "aqua_simulacra",
    refinement: 1,
    artifactSetId: "emblem_of_severed_fate",
    artifactHalfSetIds: [],
  },
];

function buildTeamStatSheet(
  configs: TeamSlotConfig[],
  combatOpts = {}
): { teamBuild: TeamBuild; statSheet: TeamStatSheet } {
  const teamBuild = new TeamBuild(configs, combatOpts);
  const charIds = configs.map((c) => c.charId);
  const statSheet = new TeamStatSheet(
    teamBuild.charBuilds,
    teamBuild.teamResonance,
    teamBuild.extraBuffs,
    teamBuild.teamMeta,
    configs,
    charIds
  );
  return { teamBuild, statSheet };
}

function assertStatSheetParity(
  actual: StatSheet,
  expected: StatSheet,
  label: string
): void {
  const actualDump = [...actual.dump()];
  const expectedDump = [...expected.dump()];

  const actualMap = new Map<string, number>();
  for (const { key, filterKey, value } of actualDump) {
    actualMap.set(`${key}|${filterKey}`, value);
  }
  const expectedMap = new Map<string, number>();
  for (const { key, filterKey, value } of expectedDump) {
    expectedMap.set(`${key}|${filterKey}`, value);
  }

  for (const [k, v] of expectedMap) {
    const av = actualMap.get(k);
    expect(av, `${label}: missing key ${k}`).toBeDefined();
    expect(av, `${label}: mismatch on ${k}`).toBeCloseTo(v, 10);
  }

  for (const [k] of actualMap) {
    expect(expectedMap.has(k), `${label}: unexpected key ${k}`).toBe(true);
  }
}

describe("TeamStatSheet", () => {
  describe("parity with TeamBuild.getTeamStats — empty artifacts", () => {
    it("National team: all chars, all on-field contexts", () => {
      const { teamBuild, statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const sheets = emptySheets(...charIds);
      statSheet.setArtifacts(sheets);

      for (const onFieldCharId of charIds) {
        const expected = teamBuild.getTeamStats(sheets, onFieldCharId);
        const actual = statSheet.getAllPostStats(onFieldCharId);

        for (const charId of charIds) {
          assertStatSheetParity(
            actual[charId]!,
            expected[charId]!,
            `${charId} (onField=${onFieldCharId})`
          );
        }
      }
    });

    it("Kazuha team: all chars, all on-field contexts", () => {
      const { teamBuild, statSheet } = buildTeamStatSheet(KAZUHA_TEAM);
      const charIds = KAZUHA_TEAM.map((c) => c.charId);
      const sheets = emptySheets(...charIds);
      statSheet.setArtifacts(sheets);

      for (const onFieldCharId of charIds) {
        const expected = teamBuild.getTeamStats(sheets, onFieldCharId);
        const actual = statSheet.getAllPostStats(onFieldCharId);

        for (const charId of charIds) {
          assertStatSheetParity(
            actual[charId]!,
            expected[charId]!,
            `${charId} (onField=${onFieldCharId})`
          );
        }
      }
    });
  });

  describe("parity with TeamBuild.getTeamStats — with artifact stats", () => {
    it("National team: non-trivial artifact stats", () => {
      const { teamBuild, statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);

      const artStats: Record<string, StatSheet> = {
        xiangling: new StatSheet([
          { key: "atk%", value: 0.466 },
          { key: "pyro%", value: 0.466 },
          { key: "cr", value: 0.311 },
          { key: "em", value: 40 },
          { key: "atk", value: 311 },
        ]),
        bennett: new StatSheet([
          { key: "hp%", value: 0.466 },
          { key: "er", value: 0.518 },
          { key: "cr", value: 0.311 },
          { key: "hp", value: 4780 },
        ]),
        xingqiu: new StatSheet([
          { key: "atk%", value: 0.466 },
          { key: "hydro%", value: 0.466 },
          { key: "cr", value: 0.311 },
          { key: "atk", value: 311 },
        ]),
        raiden_shogun: new StatSheet([
          { key: "atk%", value: 0.466 },
          { key: "er", value: 0.518 },
          { key: "cr", value: 0.311 },
          { key: "cd", value: 0.622 },
        ]),
      };

      statSheet.setArtifacts(artStats);

      for (const onFieldCharId of charIds) {
        const expected = teamBuild.getTeamStats(artStats, onFieldCharId);
        const actual = statSheet.getAllPostStats(onFieldCharId);

        for (const charId of charIds) {
          assertStatSheetParity(
            actual[charId]!,
            expected[charId]!,
            `${charId} (onField=${onFieldCharId})`
          );
        }
      }
    });
  });

  describe("parity with TeamBuild.getTeamStats — with CalcContext", () => {
    it("applies perCharCrTarget correctly via setArtifacts ctx", () => {
      const { teamBuild, statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const sheets = emptySheets(...charIds);

      const ctxWithCr: CalcContext = {
        ...CTX,
        perCharCrTarget: { xiangling: 70, raiden_shogun: 85 },
      };

      statSheet.setArtifacts(sheets, ctxWithCr);

      for (const onFieldCharId of charIds) {
        const expected = teamBuild.getTeamStats(
          sheets,
          onFieldCharId,
          ctxWithCr
        );
        const actual = statSheet.getAllPostStats(onFieldCharId);

        for (const charId of charIds) {
          assertStatSheetParity(
            actual[charId]!,
            expected[charId]!,
            `${charId} (onField=${onFieldCharId}, withCr)`
          );
        }
      }
    });
  });

  describe("parity with TeamBuild.getTeamStatsExcluding", () => {
    it("excluding buffs produces same results", () => {
      const { teamBuild, statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const sheets = emptySheets(...charIds);
      statSheet.setArtifacts(sheets);

      const someBuffKeys = new Set<string>();
      for (const b of teamBuild.allStaticBuffs.slice(0, 3)) {
        someBuffKeys.add(getBuffInstanceKey(b.buff, b.providerCharId));
      }

      if (someBuffKeys.size === 0) return;

      for (const onFieldCharId of charIds) {
        const expected = teamBuild.getTeamStatsExcluding(
          sheets,
          onFieldCharId,
          undefined,
          someBuffKeys
        );
        const actual = statSheet.getAllPostStats(onFieldCharId, someBuffKeys);

        for (const charId of charIds) {
          assertStatSheetParity(
            actual[charId]!,
            expected[charId]!,
            `${charId} (onField=${onFieldCharId}, excluded)`
          );
        }
      }
    });
  });

  describe("setArtifacts cache invalidation", () => {
    it("changing artifacts produces different stats", () => {
      const { statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);

      statSheet.setArtifacts(emptySheets(...charIds));
      const statsEmpty = statSheet.getPostStats("xiangling", "xiangling");
      const atkEmpty = statsEmpty.get("atk", null);

      statSheet.setArtifacts({
        ...emptySheets(...charIds),
        xiangling: new StatSheet([{ key: "atk%", value: 1.0 }]),
      });
      const statsWithAtk = statSheet.getPostStats("xiangling", "xiangling");
      const atkWithAtk = statsWithAtk.get("atk", null);

      expect(atkWithAtk).toBeGreaterThan(atkEmpty);
    });
  });

  describe("getCharLevel", () => {
    it("returns correct char level from configs", () => {
      const { statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      expect(statSheet.getCharLevel("xiangling")).toBe(90);
      expect(statSheet.getCharLevel("bennett")).toBe(90);
    });
  });

  describe("getPreStats / getMidStats", () => {
    it("preStats are a subset of postStats (postStats has more contributions)", () => {
      const { statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      statSheet.setArtifacts(emptySheets(...charIds));

      const pre = statSheet.getPreStats("xiangling", "xiangling");
      const mid = statSheet.getMidStats("xiangling", "xiangling");
      const post = statSheet.getPostStats("xiangling", "xiangling");

      expect(pre).toBeDefined();
      expect(mid).toBeDefined();
      expect(post).toBeDefined();

      const preAtk = pre.get("atk", null);
      const postAtk = post.get("atk", null);
      expect(postAtk).toBeGreaterThanOrEqual(preAtk);
    });
  });

  describe("getIdleStats parity", () => {
    it("matches TeamBuild computeIdleStatSheets", () => {
      const { teamBuild, statSheet } = buildTeamStatSheet(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const sheets = emptySheets(...charIds);
      statSheet.setArtifacts(sheets);

      // biome-ignore lint/suspicious/noExplicitAny: accessing private method for parity testing
      const tbIdle = (teamBuild as any).computeIdleStatSheets(sheets);
      const tsIdle = statSheet.getIdleStats();

      for (const charId of charIds) {
        assertStatSheetParity(
          tsIdle[charId]!.onField,
          tbIdle[charId]!.onField,
          `${charId} idle onField`
        );
        assertStatSheetParity(
          tsIdle[charId]!.offField,
          tbIdle[charId]!.offField,
          `${charId} idle offField`
        );
      }
    });
  });

  describe("constructor collects allStaticBuffs internally", () => {
    it("allStaticBuffs matches TeamBuild.allStaticBuffs", () => {
      const { teamBuild, statSheet } = buildTeamStatSheet(NATIONAL_TEAM);

      // Same number of buffs
      expect(statSheet.allStaticBuffs.length).toBe(
        teamBuild.allStaticBuffs.length
      );

      // Same buff identity keys in same order
      const tsKeys = statSheet.allStaticBuffs.map((b) =>
        getBuffInstanceKey(b.buff, b.providerCharId)
      );
      const tbKeys = teamBuild.allStaticBuffs.map((b) =>
        getBuffInstanceKey(b.buff, b.providerCharId)
      );
      expect(tsKeys).toEqual(tbKeys);
    });
  });
});
