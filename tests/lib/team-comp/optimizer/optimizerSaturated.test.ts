/**
 * Test: Saturated character handling in the optimizer.
 *
 * Uses a real Hu Tao + Bennett team. Bennett's Q buff reads baseAtk only,
 * so his artifact substats produce zero marginal gains. The optimizer should
 * still assign sensible (level-20) artifacts via fallback weights.
 */
import { describe, expect, it } from "vitest";

import {
  type ArtifactData,
  type MainStat,
  type Slot,
  allSlots,
} from "@/data/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { runTeamOptimization } from "@/lib/team-comp/optimizer";
import type { TeamSlotConfig } from "@/lib/team-comp/types";
import "@/lib/team-comp/index";

await preloadGameStats();

let artIdCounter = 1;
function makeArt(
  slot: Slot,
  setKey: string,
  overrides: Partial<ArtifactData> = {}
): ArtifactData {
  const id = `sat-art-${artIdCounter++}`;
  const mainStatDefaults: Record<Slot, MainStat> = {
    flower: "hp",
    plume: "atk",
    sands: "atk%",
    goblet: "pyro%",
    circlet: "cr",
  };
  return {
    id,
    setKey,
    slotKey: slot,
    level: 20,
    rarity: 5,
    lock: false,
    mainStatKey: mainStatDefaults[slot],
    substats: { cr: 3.5, cd: 7.0, atk: 20, er: 5.8 },
    ...overrides,
  };
}

function makeFullSet(setKey: string, levelOverride?: number): ArtifactData[] {
  return allSlots.map((slot) =>
    makeArt(slot, setKey, levelOverride != null ? { level: levelOverride } : {})
  );
}

// ─── Test ───

describe("Saturated character handling", () => {
  // Team: Hu Tao (carry) + Bennett (support, baseAtk-only buff)
  // Half-set IDs from resources.ts (not the same as set IDs)
  // crimson_witch_of_flames → "pyro%-15"
  // noblesse_oblige → "burst-dmg%-20"
  const configs: TeamSlotConfig[] = [
    {
      charId: "hu_tao",
      charLevel: 90,
      constellation: 1,
      weaponId: "staff_of_homa",
      refinement: 1,
      artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
    },
    {
      charId: "bennett",
      charLevel: 90,
      constellation: 6,
      weaponId: "mistsplitter_reforged",
      refinement: 1,
      artifactSet: null,
    },
  ];

  const teamBuild = new TeamBuild(configs);

  // Get Hu Tao's first formula
  const allFormulas = teamBuild.catalog.getFormulaIds();
  const huTaoFormulas = allFormulas.hu_tao;
  const formulaId = Object.keys(huTaoFormulas)[0];

  // Inventory: crimson witch for Hu Tao + generic artifacts for Bennett
  const inventory: ArtifactData[] = [
    ...makeFullSet("crimson_witch_of_flames"),
    ...makeFullSet("gladiators_finale"), // level 20
    ...makeFullSet("gladiators_finale", 0), // level 0 — should NOT be preferred
  ];

  const baseSheets: Record<string, StatSheet> = {};
  for (const c of configs) {
    baseSheets[c.charId] = new StatSheet([]);
  }

  it("saturation detection: Bennett empty vs super produce same damage", () => {
    const calcContext = {
      enemyLevel: 90,
      enemyRes: 10,
      rollMultiplier: 0.85,
      substatBudget: "8_6" as const,
    };

    // Empty sheet for Bennett
    const emptySheets = {
      hu_tao: new StatSheet([]),
      bennett: new StatSheet([]),
    };
    const postStatsEmpty = teamBuild.getTeamStats(
      emptySheets,
      "hu_tao",
      calcContext
    );
    const dmgEmpty = teamBuild.getDamageResult(
      "hu_tao",
      formulaId,
      calcContext
    ).totalDamage;

    // Super sheet for Bennett (high stats from artifacts)
    const superSheet = StatSheet.fromRaw({
      "atk%": 0.466,
      "hp%": 0.466,
      cr: 0.311,
      cd: 0.622,
      er: 0.518,
      em: 187,
      atk: 311,
      hp: 4780,
    });
    const superSheets = {
      hu_tao: new StatSheet([]),
      bennett: superSheet,
    };
    const postStatsSuper = teamBuild.getTeamStats(
      superSheets,
      "hu_tao",
      calcContext
    );
    const dmgSuper = teamBuild.getDamageResult(
      "hu_tao",
      formulaId,
      calcContext
    ).totalDamage;

    // Both should be equal — Bennett's artifacts don't affect Hu Tao's damage
    expect(dmgEmpty).toBeGreaterThan(0);
    expect(Math.abs(dmgSuper - dmgEmpty) / Math.max(dmgEmpty, 1)).toBeLessThan(
      0.001
    );
  });

  it("assigns level-20 artifacts to Bennett via fallback weights", async () => {
    const gen = runTeamOptimization({
      teamBuild,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: {
        enemyLevel: 90,
        enemyRes: 10,
        rollMultiplier: 0.85,
        substatBudget: "8_6" as const,
      },
      globalConfig: { flatHp: 0, flatAtk: 50, flatDef: 0 },
      baseSheets,
      perChar: {
        hu_tao: {
          minEr: 0,
          minCr: 0,
          artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
        },
        bennett: {
          minEr: 0,
          minCr: 0,
        },
      },
    });

    // Drain the generator to get the final result
    let result: Awaited<ReturnType<typeof gen.next>>["value"] | undefined;
    for await (const yielded of gen) {
      result = yielded;
    }

    expect(result).toBeDefined();
    expect(result!.done).toBe(true);

    if (!result!.done) return; // type guard

    const bennettArts = result!.bestArtifactsByChar.bennett;
    expect(bennettArts).toBeDefined();

    // Bennett should have artifacts assigned (not all null)
    const bennettPieces = allSlots
      .map((s) => bennettArts[s])
      .filter(Boolean) as ArtifactData[];
    expect(bennettPieces.length).toBeGreaterThan(0);

    // Debug: show what was assigned
    const bennettInfo = bennettPieces.map((a) => ({
      id: a.id,
      slot: a.slotKey,
      set: a.setKey,
      level: a.level,
    }));
    const huTaoInfo = allSlots
      .map((s) => result!.bestArtifactsByChar.hu_tao[s])
      .filter(Boolean)
      .map((a) => ({
        id: a!.id,
        slot: a!.slotKey,
        set: a!.setKey,
        level: a!.level,
      }));

    // Bennett's artifacts should prefer level 20 over level 0
    // (Hu Tao may take one gladiator piece for the flex slot, so allow at most 1 level-0)
    const level0Count = bennettPieces.filter((a) => a.level === 0).length;
    expect(level0Count).toBeLessThanOrEqual(1);

    // Bennett's artifacts should not overlap with Hu Tao's
    const huTaoArts = result!.bestArtifactsByChar.hu_tao;
    const huTaoIds = new Set(
      allSlots.map((s) => huTaoArts[s]?.id).filter(Boolean)
    );
    for (const art of bennettPieces) {
      expect(huTaoIds.has(art.id)).toBe(false);
    }

    // Hu Tao should have positive damage
    expect(result!.bestDamage).toBeGreaterThan(0);
  });

  it("does not mark constrained saturated supports as saturated", async () => {
    const erSupportInventory: ArtifactData[] = [
      ...makeFullSet("crimson_witch_of_flames"),
      makeArt("flower", "gladiators_finale", {
        substats: { er: 25.9, hp: 239, atk: 14, cr: 3.9 },
      }),
      makeArt("plume", "gladiators_finale", {
        substats: { er: 25.9, hp: 239, atk: 14, cr: 3.9 },
      }),
      makeArt("sands", "gladiators_finale", {
        mainStatKey: "er",
        substats: { er: 19.4, hp: 239, atk: 14, cr: 3.9 },
      }),
      makeArt("goblet", "gladiators_finale", {
        mainStatKey: "hp%",
        substats: { er: 25.9, hp: 239, atk: 14, cr: 3.9 },
      }),
      makeArt("circlet", "gladiators_finale", {
        mainStatKey: "heal%",
        substats: { er: 25.9, hp: 239, atk: 14, cr: 3.9 },
      }),
    ];

    const trace: unknown[] = [];
    (
      globalThis as typeof globalThis & {
        __TEAM_OPT_TRACE__?: (event: unknown) => void;
      }
    ).__TEAM_OPT_TRACE__ = (event) => {
      trace.push(event);
    };

    try {
      const gen = runTeamOptimization({
        teamBuild,
        carryCharId: "hu_tao",
        combo: singleFormulaCombo("hu_tao", formulaId),
        inventory: erSupportInventory,
        calcContext: {
          enemyLevel: 90,
          enemyRes: 10,
          rollMultiplier: 0.85,
          substatBudget: "8_6" as const,
        },
        globalConfig: { flatHp: 0, flatAtk: 50, flatDef: 0 },
        baseSheets,
        perChar: {
          hu_tao: {
            minEr: 0,
            minCr: 0,
            artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
          },
          bennett: {
            minEr: 2.0,
            minCr: 0,
          },
        },
      });

      let result: Awaited<ReturnType<typeof gen.next>>["value"] | undefined;
      for await (const yielded of gen) {
        result = yielded;
      }

      expect(result).toBeDefined();
      expect(result!.done).toBe(true);
      if (!result!.done) return;

      const phase1 = trace.find(
        (
          event
        ): event is {
          phase: "phase1";
          saturatedCharIds: string[];
          topKCounts: Record<string, number>;
        } =>
          typeof event === "object" &&
          event !== null &&
          "phase" in event &&
          event.phase === "phase1"
      );

      expect(phase1).toBeDefined();
      expect(phase1!.saturatedCharIds).not.toContain("bennett");
      expect(phase1!.topKCounts.bennett).toBeGreaterThan(0);
      expect(result!.failReasons.bennett).toBeUndefined();

      const bennettPieces = allSlots
        .map((s) => result!.bestArtifactsByChar.bennett[s])
        .filter(Boolean) as ArtifactData[];
      expect(bennettPieces.length).toBe(5);
    } finally {
      (
        globalThis as typeof globalThis & {
          __TEAM_OPT_TRACE__?: (event: unknown) => void;
        }
      ).__TEAM_OPT_TRACE__ = undefined;
    }
  });

  it("saturated def%-scaling support prefers def% substats via supStat fallback", async () => {
    // Swap Bennett → Gorou (supStat: ["def%"]). Gorou's buffs don't affect
    // Hu Tao's pyro damage (geo-only DMG bonus; def% scaling is for Geo
    // characters), so Gorou is saturated. Provide Gorou a choice between
    // def%-heavy and hp%-heavy artifacts at equal levels — the supStat
    // fallback should make def% pieces win.
    const gorouConfigs: TeamSlotConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
      },
      {
        charId: "gorou",
        charLevel: 90,
        constellation: 0,
        weaponId: "mistsplitter_reforged",
        refinement: 1,
        artifactSet: null,
      },
    ];

    const gorouTeam = new TeamBuild(gorouConfigs);
    const gorouFormulas = gorouTeam.catalog.getFormulaIds().hu_tao;
    const gorouFormulaId = Object.keys(gorouFormulas)[0];

    // Hu Tao gets her full crimson witch set. Gorou chooses between two
    // candidate artifacts per slot (same set, same level) that differ only
    // in which substat is large: def% vs hp%.
    const makeSub = (
      overrides: Partial<Record<string, number>>
    ): Record<string, number> => ({
      // Small neutral substats to avoid noise
      er: 5.8,
      atk: 20,
      ...overrides,
    });

    const gorouInventory: ArtifactData[] = [
      ...makeFullSet("crimson_witch_of_flames"),
      // def%-heavy candidates (one per slot)
      ...allSlots.map((slot) =>
        makeArt(slot, "gladiators_finale", {
          substats: makeSub({ "def%": 22 }),
        })
      ),
      // hp%-heavy candidates (one per slot)
      ...allSlots.map((slot) =>
        makeArt(slot, "gladiators_finale", {
          substats: makeSub({ "hp%": 22 }),
        })
      ),
    ];

    const gorouBaseSheets: Record<string, StatSheet> = {
      hu_tao: new StatSheet([]),
      gorou: new StatSheet([]),
    };

    const gen = runTeamOptimization({
      teamBuild: gorouTeam,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", gorouFormulaId),
      inventory: gorouInventory,
      calcContext: {
        enemyLevel: 90,
        enemyRes: 10,
        rollMultiplier: 0.85,
        substatBudget: "8_6" as const,
      },
      globalConfig: { flatHp: 0, flatAtk: 50, flatDef: 0 },
      baseSheets: gorouBaseSheets,
      perChar: {
        hu_tao: {
          minEr: 0,
          minCr: 0,
          artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
        },
        gorou: {
          minEr: 0,
          minCr: 0,
        },
      },
    });

    let result: Awaited<ReturnType<typeof gen.next>>["value"] | undefined;
    for await (const yielded of gen) {
      result = yielded;
    }

    expect(result).toBeDefined();
    expect(result!.done).toBe(true);
    if (!result!.done) return;

    const gorouPieces = allSlots
      .map((s) => result!.bestArtifactsByChar.gorou?.[s])
      .filter(Boolean) as ArtifactData[];
    expect(gorouPieces.length).toBeGreaterThan(0);

    const defPieces = gorouPieces.filter(
      (a) => (a.substats?.["def%"] ?? 0) > 0
    ).length;
    const hpPieces = gorouPieces.filter(
      (a) => (a.substats?.["hp%"] ?? 0) > 0
    ).length;
    expect(defPieces).toBeGreaterThan(hpPieces);
  });
});
