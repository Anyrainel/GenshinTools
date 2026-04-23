import type { Slot } from "@/data/enums";
/**
 * Comprehensive tests for frozen artifact inventory filtering.
 *
 * Tests the pure `computeTeamInventory` function extracted from `useTeamInventory`
 * to verify that frozen artifacts are correctly excluded from the optimizer pool
 * across all reuse modes, team configurations, and edge cases.
 *
 * Scenarios covered:
 * 1. Same-team frozen: artifacts from frozen chars in the current team are excluded
 * 2. Cross-team frozen: artifacts frozen in OTHER teams are excluded from the pool
 * 3. Standalone frozen: individually frozen artifacts are excluded
 * 4. Reuse mode "none": no frozen artifacts are reusable by anyone
 * 5. Reuse mode "sameChar": same-char gets per-char extras, others don't
 * 6. Reuse mode "forceReuse": matching set configs get force-reused
 * 7. Per-char extras don't leak to other characters
 * 8. Multiple teams frozen simultaneously
 * 9. Partially frozen teams
 * 10. Edge cases: empty slots, null artifacts, missing characters
 */
import type { ArtifactData } from "@/data/types";
import {
  type ComputeInventoryParams,
  computeTeamInventory,
} from "@/hooks/useTeamInventory";
import type { ArtifactReuseMode, FrozenTeam } from "@/stores/useFreezeStore";
import { describe, expect, it } from "vitest";

let artCounter = 0;

function makeArt(
  slot: Slot,
  setKey = "crimson_witch_of_flames",
  id?: string
): ArtifactData {
  return {
    id: id ?? `frozen-test-art-${++artCounter}`,
    setKey,
    slotKey: slot,
    rarity: 5,
    level: 20,
    mainStatKey: slot === "flower" ? "hp" : slot === "plume" ? "atk" : "hp%",
    lock: false,
    substats: { cr: 7, cd: 14, atk: 20, em: 20 },
  };
}

function makeFullSet(
  setKey = "crimson_witch_of_flames",
  prefix?: string
): Record<Slot, ArtifactData> {
  const pfx = prefix ? `${prefix}-` : "";
  return {
    flower: makeArt("flower", setKey, `${pfx}flower`),
    plume: makeArt("plume", setKey, `${pfx}plume`),
    sands: makeArt("sands", setKey, `${pfx}sands`),
    goblet: makeArt("goblet", setKey, `${pfx}goblet`),
    circlet: makeArt("circlet", setKey, `${pfx}circlet`),
  };
}

function frozenTeam(
  charIds: string[],
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
): FrozenTeam {
  return { frozenCharIds: charIds, artifactsByChar };
}

function artIds(arts: Record<Slot, ArtifactData | null>): string[] {
  return Object.values(arts)
    .filter((a): a is ArtifactData => a != null)
    .map((a) => a.id);
}

function availableIds(params: ComputeInventoryParams): Set<string> {
  const result = computeTeamInventory(params);
  return new Set(result.availableArtifacts.map((a) => a.id));
}

function baseParams(
  overrides: Partial<ComputeInventoryParams> = {}
): ComputeInventoryParams {
  return {
    allArtifacts: [],
    frozenTeams: {},
    reuseMode: "none",
    standaloneFrozenIds: [],
    teamId: "teamB",
    teamCharacters: [],
    teamArtifacts: [],
    ...overrides,
  };
}

describe("computeTeamInventory — frozen artifact exclusion", () => {
  // 1. Same-team frozen characters

  describe("same-team frozen characters", () => {
    it("excludes same-team frozen artifacts from available pool (reuseMode=none)", () => {
      const huTaoArts = makeFullSet("crimson_witch_of_flames", "hutao");
      const xqArts = makeFullSet("emblem_of_severed_fate", "xq");
      const allArtifacts = [
        ...Object.values(huTaoArts),
        ...Object.values(xqArts),
      ];

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "team1",
          teamCharacters: ["hu_tao", "xingqiu"],
          reuseMode: "none",
          frozenTeams: {
            team1: frozenTeam(["hu_tao"], {
              hu_tao: huTaoArts,
            }),
          },
        })
      );

      // Hu Tao's frozen artifacts must NOT be in available pool
      for (const id of artIds(huTaoArts)) {
        expect(result.availableArtifacts.map((a) => a.id)).not.toContain(id);
        expect(result.frozenArtifactIds.has(id)).toBe(true);
      }
      // Xingqiu's artifacts should still be available
      for (const id of artIds(xqArts)) {
        expect(result.availableArtifacts.map((a) => a.id)).toContain(id);
      }
      // No perCharExtraArtifacts (same team, not cross-team)
      expect(Object.keys(result.perCharExtraArtifacts)).toHaveLength(0);
    });

    it("excludes same-team frozen artifacts regardless of reuse mode", () => {
      const arts = makeFullSet("crimson_witch_of_flames", "same-team-reuse");
      const allArtifacts = Object.values(arts);

      for (const mode of [
        "none",
        "sameChar",
        "forceReuse",
      ] as ArtifactReuseMode[]) {
        const result = computeTeamInventory(
          baseParams({
            allArtifacts,
            teamId: "team1",
            teamCharacters: ["hu_tao"],
            reuseMode: mode,
            frozenTeams: {
              team1: frozenTeam(["hu_tao"], { hu_tao: arts }),
            },
          })
        );

        // Same-team frozen arts ALWAYS excluded from available pool
        expect(result.availableArtifacts).toHaveLength(0);
        // Same-team frozen chars do NOT get per-char extras
        expect(result.perCharExtraArtifacts.hu_tao).toBeUndefined();
      }
    });
  });

  // 2. Cross-team frozen characters

  describe("cross-team frozen characters", () => {
    it("excludes OTHER team frozen artifacts from pool (reuseMode=none)", () => {
      const teamAArts = makeFullSet("crimson_witch_of_flames", "teamA");
      const poolArts = makeFullSet("emblem_of_severed_fate", "pool");
      const allArtifacts = [
        ...Object.values(teamAArts),
        ...Object.values(poolArts),
      ];

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: ["xingqiu", "zhongli"],
          reuseMode: "none",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: teamAArts }),
          },
        })
      );

      // Team A's frozen artifacts must NOT be available for Team B
      for (const id of artIds(teamAArts)) {
        expect(result.availableArtifacts.map((a) => a.id)).not.toContain(id);
      }
      // Pool artifacts should be available
      expect(result.availableArtifacts).toHaveLength(5);
      // No extras — characters in teamB don't overlap with teamA
      expect(Object.keys(result.perCharExtraArtifacts)).toHaveLength(0);
    });

    it("cross-team frozen: different character → no extras even with sameChar mode", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "cross-diff");
      const poolArts = makeFullSet("emblem_of_severed_fate", "pool2");
      const allArtifacts = [
        ...Object.values(frozenArts),
        ...Object.values(poolArts),
      ];

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: ["xingqiu", "zhongli"], // neither is hu_tao
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // Even in sameChar mode, no extras for chars not in the frozen team
      expect(Object.keys(result.perCharExtraArtifacts)).toHaveLength(0);
      // Frozen artifacts still excluded from pool
      for (const id of artIds(frozenArts)) {
        expect(result.frozenArtifactIds.has(id)).toBe(true);
      }
    });

    it("cross-team frozen: same character → per-char extras with sameChar mode", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "cross-same");
      const poolArts = makeFullSet("emblem_of_severed_fate", "pool3");
      const allArtifacts = [
        ...Object.values(frozenArts),
        ...Object.values(poolArts),
      ];

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: ["hu_tao", "zhongli"], // hu_tao overlaps!
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // Frozen arts excluded from shared pool
      for (const id of artIds(frozenArts)) {
        expect(result.availableArtifacts.map((a) => a.id)).not.toContain(id);
      }
      // But hu_tao gets per-char extras
      expect(result.perCharExtraArtifacts.hu_tao).toBeDefined();
      expect(result.perCharExtraArtifacts.hu_tao).toHaveLength(5);
      // zhongli does NOT get extras
      expect(result.perCharExtraArtifacts.zhongli).toBeUndefined();
    });

    it("cross-team frozen: same character but reuseMode=none → NO per-char extras", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "cross-none");
      const allArtifacts = Object.values(frozenArts);

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: ["hu_tao", "zhongli"],
          reuseMode: "none",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // No extras in "none" mode
      expect(Object.keys(result.perCharExtraArtifacts)).toHaveLength(0);
      // Still excluded from pool
      expect(result.availableArtifacts).toHaveLength(0);
    });
  });

  // 3. Standalone frozen artifacts

  describe("standalone frozen artifacts", () => {
    it("standalone frozen IDs are excluded from the pool", () => {
      const a1 = makeArt("flower", "crimson_witch_of_flames", "standalone-1");
      const a2 = makeArt("plume", "crimson_witch_of_flames", "standalone-2");
      const a3 = makeArt("sands", "crimson_witch_of_flames", "standalone-3");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: [a1, a2, a3],
          standaloneFrozenIds: ["standalone-1", "standalone-3"],
          teamId: "teamB",
          teamCharacters: ["xingqiu"],
        })
      );

      const ids = result.availableArtifacts.map((a) => a.id);
      expect(ids).not.toContain("standalone-1");
      expect(ids).not.toContain("standalone-3");
      expect(ids).toContain("standalone-2");
      expect(result.frozenArtifactIds.has("standalone-1")).toBe(true);
      expect(result.frozenArtifactIds.has("standalone-3")).toBe(true);
    });

    it("standalone frozen + team frozen = both excluded", () => {
      const standaloneArt = makeArt(
        "flower",
        "crimson_witch_of_flames",
        "sa-1"
      );
      const teamFrozenArts = makeFullSet("emblem_of_severed_fate", "tf");
      const allArtifacts = [standaloneArt, ...Object.values(teamFrozenArts)];

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          standaloneFrozenIds: ["sa-1"],
          frozenTeams: {
            teamA: frozenTeam(["xq"], { xq: teamFrozenArts }),
          },
          teamId: "teamB",
          teamCharacters: ["zhongli"],
          reuseMode: "none",
        })
      );

      // Both standalone and team-frozen excluded
      expect(result.availableArtifacts).toHaveLength(0);
      expect(result.frozenArtifactIds.size).toBe(6); // 1 standalone + 5 team
    });
  });

  // 4. Multiple frozen teams

  describe("multiple frozen teams", () => {
    it("artifacts from ALL frozen teams are excluded", () => {
      const teamAArts = makeFullSet("crimson_witch_of_flames", "mft-a");
      const teamBArts = makeFullSet("emblem_of_severed_fate", "mft-b");
      const teamCArts = makeFullSet("noblesse_oblige", "mft-c");
      const freeArt = makeArt("flower", "gladiators_finale", "mft-free");
      const allArtifacts = [
        ...Object.values(teamAArts),
        ...Object.values(teamBArts),
        ...Object.values(teamCArts),
        freeArt,
      ];

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamD",
          teamCharacters: ["venti"],
          reuseMode: "none",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: teamAArts }),
            teamB: frozenTeam(["xingqiu"], { xingqiu: teamBArts }),
            teamC: frozenTeam(["zhongli"], { zhongli: teamCArts }),
          },
        })
      );

      // Only the free art should remain
      expect(result.availableArtifacts).toHaveLength(1);
      expect(result.availableArtifacts[0].id).toBe("mft-free");
      expect(result.frozenArtifactIds.size).toBe(15); // 3 teams × 5 artifacts
    });

    it("sameChar extras are collected from multiple teams", () => {
      const teamAArts = makeFullSet("crimson_witch_of_flames", "multi-a");
      const teamBArts = makeFullSet("emblem_of_severed_fate", "multi-b");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: [
            ...Object.values(teamAArts),
            ...Object.values(teamBArts),
          ],
          teamId: "teamC",
          teamCharacters: ["hu_tao", "xingqiu"],
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: teamAArts }),
            teamB: frozenTeam(["hu_tao"], { hu_tao: teamBArts }),
          },
        })
      );

      // hu_tao gets extras from both teams
      expect(result.perCharExtraArtifacts.hu_tao).toHaveLength(10);
      // xingqiu gets nothing (not frozen in other teams)
      expect(result.perCharExtraArtifacts.xingqiu).toBeUndefined();
      // All 10 artifacts excluded from shared pool
      expect(result.availableArtifacts).toHaveLength(0);
    });
  });

  // 5. Per-char extras isolation

  describe("per-char extras isolation", () => {
    it("per-char extras are NOT available in the shared pool", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "iso");
      const allArtifacts = Object.values(frozenArts);

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: ["hu_tao", "xingqiu"],
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // Shared pool is empty — frozen arts removed
      expect(result.availableArtifacts).toHaveLength(0);
      // Only hu_tao has extras
      expect(result.perCharExtraArtifacts.hu_tao).toHaveLength(5);
      expect(result.perCharExtraArtifacts.xingqiu).toBeUndefined();
    });

    it("extras for char A don't contain char B's frozen artifacts", () => {
      const huTaoArts = makeFullSet("crimson_witch_of_flames", "htf");
      const xqArts = makeFullSet("emblem_of_severed_fate", "xqf");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: [...Object.values(huTaoArts), ...Object.values(xqArts)],
          teamId: "teamB",
          teamCharacters: ["hu_tao", "xingqiu"],
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao", "xingqiu"], {
              hu_tao: huTaoArts,
              xingqiu: xqArts,
            }),
          },
        })
      );

      // hu_tao's extras = hu_tao's frozen arts from teamA
      const htExtras = new Set(
        result.perCharExtraArtifacts.hu_tao?.map((a) => a.id)
      );
      for (const id of artIds(huTaoArts)) {
        expect(htExtras.has(id)).toBe(true);
      }
      // hu_tao does NOT have xingqiu's arts
      for (const id of artIds(xqArts)) {
        expect(htExtras.has(id)).toBe(false);
      }

      // xingqiu's extras = xingqiu's frozen arts from teamA
      const xqExtras = new Set(
        result.perCharExtraArtifacts.xingqiu?.map((a) => a.id)
      );
      for (const id of artIds(xqArts)) {
        expect(xqExtras.has(id)).toBe(true);
      }
      // xingqiu does NOT have hu_tao's arts
      for (const id of artIds(huTaoArts)) {
        expect(xqExtras.has(id)).toBe(false);
      }
    });
  });

  // 6. Partially frozen teams

  describe("partially frozen teams", () => {
    it("only frozen chars' artifacts are excluded, unfrozen chars' artifacts remain", () => {
      const huTaoArts = makeFullSet("crimson_witch_of_flames", "pf-ht");
      const xqArts = makeFullSet("emblem_of_severed_fate", "pf-xq");
      const allArtifacts = [
        ...Object.values(huTaoArts),
        ...Object.values(xqArts),
      ];

      // Only hu_tao is frozen, xingqiu is not
      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "team1",
          teamCharacters: ["hu_tao", "xingqiu"],
          reuseMode: "none",
          frozenTeams: {
            team1: frozenTeam(["hu_tao"], {
              hu_tao: huTaoArts,
              // xingqiu data exists but NOT in frozenCharIds
              xingqiu: xqArts,
            }),
          },
        })
      );

      // Hu Tao's frozen arts excluded
      for (const id of artIds(huTaoArts)) {
        expect(result.frozenArtifactIds.has(id)).toBe(true);
      }
      // Xingqiu's arts NOT excluded (not in frozenCharIds)
      for (const id of artIds(xqArts)) {
        expect(result.frozenArtifactIds.has(id)).toBe(false);
        expect(result.availableArtifacts.map((a) => a.id)).toContain(id);
      }
    });
  });

  // 7. Edge cases

  describe("edge cases", () => {
    it("frozen character with null artifact slots", () => {
      const partialArts: Record<Slot, ArtifactData | null> = {
        flower: makeArt("flower", "crimson_witch_of_flames", "null-edge-1"),
        plume: null,
        sands: makeArt("sands", "crimson_witch_of_flames", "null-edge-2"),
        goblet: null,
        circlet: null,
      };

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: [partialArts.flower!, partialArts.sands!],
          teamId: "team1",
          teamCharacters: ["hu_tao"],
          reuseMode: "none",
          frozenTeams: {
            team1: frozenTeam(["hu_tao"], { hu_tao: partialArts }),
          },
        })
      );

      // Only non-null arts are tracked
      expect(result.frozenArtifactIds.size).toBe(2);
      expect(result.frozenArtifactIds.has("null-edge-1")).toBe(true);
      expect(result.frozenArtifactIds.has("null-edge-2")).toBe(true);
      expect(result.availableArtifacts).toHaveLength(0);
    });

    it("empty frozenCharIds array → no artifacts excluded", () => {
      const arts = makeFullSet("crimson_witch_of_flames", "empty-chars");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: Object.values(arts),
          teamId: "team1",
          teamCharacters: ["hu_tao"],
          reuseMode: "none",
          frozenTeams: {
            team1: {
              frozenCharIds: [],
              artifactsByChar: { hu_tao: arts },
            },
          },
        })
      );

      // Nothing frozen
      expect(result.frozenArtifactIds.size).toBe(0);
      expect(result.availableArtifacts).toHaveLength(5);
    });

    it("frozen team with missing artifactsByChar entry", () => {
      const freeArt = makeArt(
        "flower",
        "crimson_witch_of_flames",
        "missing-abc"
      );

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: [freeArt],
          teamId: "teamB",
          teamCharacters: ["xingqiu"],
          reuseMode: "none",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], {
              // hu_tao is in frozenCharIds but has no entry in artifactsByChar
            }),
          },
        })
      );

      // Nothing excluded
      expect(result.availableArtifacts).toHaveLength(1);
    });

    it("no frozen teams at all → everything available", () => {
      const arts = [makeArt("flower"), makeArt("plume"), makeArt("sands")];

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: arts,
          frozenTeams: {},
          teamId: "team1",
          teamCharacters: ["hu_tao"],
        })
      );

      expect(result.availableArtifacts).toHaveLength(3);
      expect(result.frozenArtifactIds.size).toBe(0);
    });

    it("artifact frozen in multiple teams → still excluded once", () => {
      // Same artifact data frozen in two different teams
      const sharedArts = makeFullSet("crimson_witch_of_flames", "shared");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: Object.values(sharedArts),
          teamId: "teamC",
          teamCharacters: ["zhongli"],
          reuseMode: "none",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: sharedArts }),
            teamB: frozenTeam(["hu_tao"], { hu_tao: sharedArts }),
          },
        })
      );

      // Still 5 unique frozen IDs
      expect(result.frozenArtifactIds.size).toBe(5);
      expect(result.availableArtifacts).toHaveLength(0);
    });

    it("team with null characters in roster", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "null-roster");
      const allArtifacts = Object.values(frozenArts);

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: [null, "hu_tao", null, "xingqiu"],
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // hu_tao should still get extras despite null slots in roster
      expect(result.perCharExtraArtifacts.hu_tao).toHaveLength(5);
    });
  });

  // 8. forceReuse mode

  describe("forceReuse mode", () => {
    it("matching set config → character added to forceReuseChars", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "force");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: Object.values(frozenArts),
          teamId: "teamB",
          teamCharacters: ["hu_tao", "xingqiu"],
          teamArtifacts: [
            { type: "4pc", setId: "crimson_witch_of_flames" }, // hu_tao wants CW 4pc
            null, // xingqiu no config
          ],
          reuseMode: "forceReuse",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // hu_tao is force-reused (frozen arts match 4pc CW config)
      expect(result.forceReuseChars.hu_tao).toBeDefined();
      const forceArts = result.forceReuseChars.hu_tao;
      expect(forceArts.flower?.id).toBe("force-flower");
    });

    it("non-matching set config → NOT force-reused", () => {
      const frozenArts = makeFullSet("emblem_of_severed_fate", "noforce");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: Object.values(frozenArts),
          teamId: "teamB",
          teamCharacters: ["hu_tao"],
          teamArtifacts: [
            { type: "4pc", setId: "crimson_witch_of_flames" }, // wants CW but frozen is EoSF
          ],
          reuseMode: "forceReuse",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // NOT force-reused (set doesn't match)
      expect(result.forceReuseChars.hu_tao).toBeUndefined();
      // But still gets per-char extras (it's sameChar base)
      expect(result.perCharExtraArtifacts.hu_tao).toHaveLength(5);
    });

    it("forceReuse with no team artifact config → not force-reused", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "noconf");

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: Object.values(frozenArts),
          teamId: "teamB",
          teamCharacters: ["hu_tao"],
          teamArtifacts: [null], // no config
          reuseMode: "forceReuse",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      expect(result.forceReuseChars.hu_tao).toBeUndefined();
      // Still gets extras
      expect(result.perCharExtraArtifacts.hu_tao).toHaveLength(5);
    });
  });

  // 9. Optimizer integration: getCharInventory simulation

  describe("optimizer getCharInventory simulation", () => {
    /**
     * Simulates the optimizer's getCharInventory function:
     * combines availableArtifacts + per-char extras for a specific character.
     */
    function getCharInventory(
      result: ReturnType<typeof computeTeamInventory>,
      charId: string
    ): ArtifactData[] {
      const extras = result.perCharExtraArtifacts[charId];
      return extras?.length
        ? [...result.availableArtifacts, ...extras]
        : result.availableArtifacts;
    }

    it("reuseMode=none: frozen artifacts from other team never visible to any character", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "opt-none");
      const freeArts = makeFullSet("emblem_of_severed_fate", "opt-free");
      const allArtifacts = [
        ...Object.values(frozenArts),
        ...Object.values(freeArts),
      ];
      const frozenIds = new Set(artIds(frozenArts));

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: ["hu_tao", "xingqiu", "zhongli", "kaedehara_kazuha"],
          reuseMode: "none",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // Check EVERY character's inventory
      for (const charId of [
        "hu_tao",
        "xingqiu",
        "zhongli",
        "kaedehara_kazuha",
      ]) {
        const inv = getCharInventory(result, charId);
        for (const art of inv) {
          expect(frozenIds.has(art.id)).toBe(false);
        }
      }
    });

    it("reuseMode=sameChar: only the matching character sees frozen artifacts", () => {
      const frozenArts = makeFullSet("crimson_witch_of_flames", "opt-same");
      const freeArts = makeFullSet("emblem_of_severed_fate", "opt-free2");
      const allArtifacts = [
        ...Object.values(frozenArts),
        ...Object.values(freeArts),
      ];
      const frozenIds = new Set(artIds(frozenArts));

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamB",
          teamCharacters: ["hu_tao", "xingqiu", "zhongli", "kaedehara_kazuha"],
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // hu_tao CAN see frozen arts (they're extras for hu_tao)
      const htInv = getCharInventory(result, "hu_tao");
      const htIds = new Set(htInv.map((a) => a.id));
      for (const id of frozenIds) {
        expect(htIds.has(id)).toBe(true);
      }

      // Other characters CANNOT see frozen arts
      for (const charId of ["xingqiu", "zhongli", "kaedehara_kazuha"]) {
        const inv = getCharInventory(result, charId);
        for (const art of inv) {
          expect(frozenIds.has(art.id)).toBe(false);
        }
      }
    });

    it("same-team frozen: even with sameChar mode, frozen chars' artifacts are invisible to all", () => {
      // Team1 has hu_tao frozen. When Team1 runs optimizer for xingqiu,
      // xingqiu must NOT see hu_tao's frozen arts even via extras.
      const frozenArts = makeFullSet("crimson_witch_of_flames", "opt-st");
      const xqArts = makeFullSet("emblem_of_severed_fate", "opt-st-xq");
      const allArtifacts = [
        ...Object.values(frozenArts),
        ...Object.values(xqArts),
      ];
      const frozenIds = new Set(artIds(frozenArts));

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "team1", // same team!
          teamCharacters: ["hu_tao", "xingqiu"],
          reuseMode: "sameChar",
          frozenTeams: {
            team1: frozenTeam(["hu_tao"], { hu_tao: frozenArts }),
          },
        })
      );

      // xingqiu's inventory should NOT contain hu_tao's frozen arts
      const xqInv = getCharInventory(result, "xingqiu");
      for (const art of xqInv) {
        expect(frozenIds.has(art.id)).toBe(false);
      }

      // hu_tao also should NOT get extras from same team
      expect(result.perCharExtraArtifacts.hu_tao).toBeUndefined();
    });

    it("complex scenario: 3 frozen teams, mixed reuse, verify complete isolation", () => {
      const t1Arts = makeFullSet("crimson_witch_of_flames", "c-t1");
      const t2Arts = makeFullSet("emblem_of_severed_fate", "c-t2");
      const t3Arts = makeFullSet("noblesse_oblige", "c-t3");
      const freeArts = makeFullSet("gladiators_finale", "c-free");
      const allArtifacts = [
        ...Object.values(t1Arts),
        ...Object.values(t2Arts),
        ...Object.values(t3Arts),
        ...Object.values(freeArts),
      ];
      const t1Ids = new Set(artIds(t1Arts));
      const t2Ids = new Set(artIds(t2Arts));
      const t3Ids = new Set(artIds(t3Arts));

      const result = computeTeamInventory(
        baseParams({
          allArtifacts,
          teamId: "teamD",
          teamCharacters: ["hu_tao", "xingqiu", "zhongli", "kaedehara_kazuha"],
          reuseMode: "sameChar",
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: t1Arts }),
            teamB: frozenTeam(["xingqiu"], { xingqiu: t2Arts }),
            teamC: frozenTeam(["venti"], { venti: t3Arts }), // venti NOT in teamD
          },
        })
      );

      // hu_tao: sees free arts + own extras from teamA
      const htInv = getCharInventory(result, "hu_tao");
      const htIds = new Set(htInv.map((a) => a.id));
      for (const id of t1Ids) expect(htIds.has(id)).toBe(true);
      for (const id of t2Ids) expect(htIds.has(id)).toBe(false);
      for (const id of t3Ids) expect(htIds.has(id)).toBe(false);

      // xingqiu: sees free arts + own extras from teamB
      const xqInv = getCharInventory(result, "xingqiu");
      const xqIds = new Set(xqInv.map((a) => a.id));
      for (const id of t2Ids) expect(xqIds.has(id)).toBe(true);
      for (const id of t1Ids) expect(xqIds.has(id)).toBe(false);
      for (const id of t3Ids) expect(xqIds.has(id)).toBe(false);

      // zhongli: only free arts (no frozen overlap)
      const zlInv = getCharInventory(result, "zhongli");
      for (const art of zlInv) {
        expect(t1Ids.has(art.id)).toBe(false);
        expect(t2Ids.has(art.id)).toBe(false);
        expect(t3Ids.has(art.id)).toBe(false);
      }

      // kazuha: only free arts
      const kaInv = getCharInventory(result, "kaedehara_kazuha");
      expect(kaInv).toHaveLength(5); // only free arts

      // venti is NOT in teamD, so no extras for venti
      expect(result.perCharExtraArtifacts.venti).toBeUndefined();
      // But venti's arts are still excluded from the pool
      for (const id of t3Ids) {
        expect(result.frozenArtifactIds.has(id)).toBe(true);
      }
    });
  });

  // 10. Regression: standalone frozen IDs were not included

  describe("regression: standalone frozen IDs in frozenArtifactIds set", () => {
    it("frozenArtifactIds includes both standalone and team-frozen IDs", () => {
      const teamArts = makeFullSet("crimson_witch_of_flames", "reg-team");
      const standaloneArt = makeArt(
        "flower",
        "gladiators_finale",
        "reg-standalone"
      );

      const result = computeTeamInventory(
        baseParams({
          allArtifacts: [...Object.values(teamArts), standaloneArt],
          standaloneFrozenIds: ["reg-standalone"],
          frozenTeams: {
            teamA: frozenTeam(["hu_tao"], { hu_tao: teamArts }),
          },
          teamId: "teamB",
          teamCharacters: ["xingqiu"],
          reuseMode: "none",
        })
      );

      // Both are in frozenArtifactIds
      expect(result.frozenArtifactIds.has("reg-standalone")).toBe(true);
      for (const id of artIds(teamArts)) {
        expect(result.frozenArtifactIds.has(id)).toBe(true);
      }
      // None available
      expect(result.availableArtifacts).toHaveLength(0);
    });
  });
});
