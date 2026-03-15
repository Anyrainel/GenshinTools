/**
 * Test: Saturated character detection and heuristic fill in optimizer V2.
 *
 * Uses a real Hu Tao + Bennett team. Bennett's Q buff reads baseAtk only,
 * so his artifacts should not affect team damage → detected as saturated.
 */
import { describe, expect, it } from "vitest";

import {
  type ArtifactData,
  type MainStat,
  type Slot,
  allSlots,
} from "@/data/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import { runTeamOptimization } from "@/lib/team-comp/optimizerV2";
import type { CharCompConfig } from "@/lib/team-comp/types";
import "@/lib/team-comp/index";

await preloadGameStats();

// ─── Helpers ───

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
  const configs: CharCompConfig[] = [
    {
      charId: "hu_tao",
      charLevel: 90,
      constellation: 1,
      weaponId: "staff_of_homa",
      refinement: 1,
      artifactSetId: "crimson_witch_of_flames",
      artifactHalfSetIds: ["pyro%-15"],
    },
    {
      charId: "bennett",
      charLevel: 90,
      constellation: 6,
      weaponId: "mistsplitter_reforged",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];

  const teamBuild = new TeamBuild(configs);

  // Get Hu Tao's first formula
  const allFormulas = teamBuild.getFormulaIds();
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
    const calcContext = { enemyLevel: 90, enemyRes: 10, assumeCrit: false };

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
      postStatsEmpty,
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
      postStatsSuper,
      calcContext
    ).totalDamage;

    // Both should be equal — Bennett's artifacts don't affect Hu Tao's damage
    expect(dmgEmpty).toBeGreaterThan(0);
    expect(Math.abs(dmgSuper - dmgEmpty) / Math.max(dmgEmpty, 1)).toBeLessThan(
      0.001
    );
  });

  it("detects Bennett as saturated and assigns level-20 artifacts", async () => {
    const gen = runTeamOptimization({
      teamBuild,
      carryCharId: "hu_tao",
      formulaId,
      inventory,
      calcContext: { enemyLevel: 90, enemyRes: 10, assumeCrit: false },
      globalConfig: { flatHp: 0, flatAtk: 50, flatDef: 0 },
      baseSheets,
      perChar: {
        hu_tao: {
          targetEr: 0,
          targetCr: 0,
          artifactSetId: "crimson_witch_of_flames",
          artifactHalfSetIds: ["pyro%-15"],
        },
        bennett: {
          targetEr: 0,
          targetCr: 0,
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
});
