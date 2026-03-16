/**
 * Tests for idealArtifactGen — specifically verifying 2+2pc set assignment.
 */
import { artifactHalfSetsById, artifactsById } from "@/data/constants";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import {
  type IdealGenOptions,
  runIdealArtifactGen,
} from "@/lib/team-comp/idealArtifactGen";
import type { CalcContext, CharCompConfig } from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";
import { drain, getFirstFormulaId } from "../../fixtures/optimizerHelpers";

await preloadGameStats();

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  assumeCrit: false,
};

// ── 2+2pc set assignment ────────────────────────────────────────────────────

describe("idealArtifactGen — 2+2pc set assignment", () => {
  const HALF_SET_1 = "atk%-18";
  const HALF_SET_2 = "em-80";

  // Expected concrete 5★ sets for each half-set
  const expected5Star1 =
    artifactHalfSetsById[HALF_SET_1]?.setIds.find(
      (id) => artifactsById[id]?.rarity === 5
    ) ?? "";
  const expected5Star2 =
    artifactHalfSetsById[HALF_SET_2]?.setIds.find(
      (id) => artifactsById[id]?.rarity === 5
    ) ?? "";

  function make2pc2pcConfigs(): CharCompConfig[] {
    return [
      {
        charId: "diluc",
        charLevel: 90,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [HALF_SET_1, HALF_SET_2],
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "sacrificial_sword",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 0,
        weaponId: "aquila_favonia",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "iron_sting",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
  }

  it("2+2pc carry should have 3 slots from set1 and 2 slots from set2", async () => {
    const configs = make2pc2pcConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: IdealGenOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      formulaId,
      calcContext: CTX,
    };

    const results = await drain(runIdealArtifactGen(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);

    const arts = final.artifactsByChar.diluc;
    expect(arts).toBeDefined();

    // Slots 1-3 (flower, plume, sands) should use the first half-set's concrete set
    expect(arts.flower.setKey).toBe(expected5Star1);
    expect(arts.plume.setKey).toBe(expected5Star1);
    expect(arts.sands.setKey).toBe(expected5Star1);

    // Slots 4-5 (goblet, circlet) should use the second half-set's concrete set
    expect(arts.goblet.setKey).toBe(expected5Star2);
    expect(arts.circlet.setKey).toBe(expected5Star2);

    // The two sets must be different
    expect(expected5Star1).not.toBe(expected5Star2);
  });

  it("2+2pc should not be detected as 4pc by set counting", async () => {
    const configs = make2pc2pcConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: IdealGenOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      formulaId,
      calcContext: CTX,
    };

    const results = await drain(runIdealArtifactGen(opts));
    const final = results[results.length - 1];
    const arts = final.artifactsByChar.diluc;

    // Count occurrences of each setKey
    const counts: Record<string, number> = {};
    for (const art of Object.values(arts)) {
      counts[art.setKey] = (counts[art.setKey] ?? 0) + 1;
    }

    // No single set should have 4+ pieces (that would be misdetected as 4pc)
    for (const count of Object.values(counts)) {
      expect(count).toBeLessThan(4);
    }

    // Should have exactly 2 distinct sets
    expect(Object.keys(counts)).toHaveLength(2);
  });

  it("works when caller explicitly passes correct setKeysByChar (mimics UI)", async () => {
    const configs = make2pc2pcConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    // This is exactly what TeamOptDetail.tsx does for 2+2pc
    const opts: IdealGenOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      formulaId,
      calcContext: CTX,
      setKeysByChar: {
        diluc: {
          flower: expected5Star1,
          plume: expected5Star1,
          sands: expected5Star1,
          goblet: expected5Star2,
          circlet: expected5Star2,
        },
      },
    };

    const results = await drain(runIdealArtifactGen(opts));
    const final = results[results.length - 1];
    const arts = final.artifactsByChar.diluc;

    expect(arts.flower.setKey).toBe(expected5Star1);
    expect(arts.sands.setKey).toBe(expected5Star1);
    expect(arts.goblet.setKey).toBe(expected5Star2);
    expect(arts.circlet.setKey).toBe(expected5Star2);
  });

  it("same half-set for both 2pc slots still produces distinct concrete sets", async () => {
    // Both 2pc slots use "atk%-18" — sk1 and sk2 must still differ
    const configs: CharCompConfig[] = [
      {
        charId: "diluc",
        charLevel: 90,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [HALF_SET_1, HALF_SET_1], // same half-set!
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "sacrificial_sword",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 0,
        weaponId: "aquila_favonia",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "iron_sting",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: IdealGenOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      formulaId,
      calcContext: CTX,
    };

    const results = await drain(runIdealArtifactGen(opts));
    const final = results[results.length - 1];
    const arts = final.artifactsByChar.diluc;

    // Slots 1-3 and 4-5 must use DIFFERENT concrete sets
    const set1 = arts.flower.setKey;
    const set2 = arts.goblet.setKey;
    expect(set1).not.toBe(set2);
    expect(arts.plume.setKey).toBe(set1);
    expect(arts.sands.setKey).toBe(set1);
    expect(arts.circlet.setKey).toBe(set2);
  });

  it("derives correct sets even when caller passes empty setKeysByChar", async () => {
    const configs = make2pc2pcConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: IdealGenOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      formulaId,
      calcContext: CTX,
      setKeysByChar: {}, // caller passes empty — should still derive from configs
    };

    const results = await drain(runIdealArtifactGen(opts));
    const final = results[results.length - 1];
    const arts = final.artifactsByChar.diluc;

    // Should still have correct 3+2 split from derived defaults
    expect(arts.flower.setKey).toBe(expected5Star1);
    expect(arts.plume.setKey).toBe(expected5Star1);
    expect(arts.sands.setKey).toBe(expected5Star1);
    expect(arts.goblet.setKey).toBe(expected5Star2);
    expect(arts.circlet.setKey).toBe(expected5Star2);
  });
});
