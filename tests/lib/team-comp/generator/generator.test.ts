import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
/**
 * Tests for generator — verifying 2+2pc set assignment and 4★ flex slot promotion.
 */
import { artifactHalfSetsById, artifactsById } from "@/data/gameResources";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/dmgcalc/core/combo";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { CalcContext, TeamSlotConfig } from "@/lib/dmgcalc/types";
import {
  type GeneratorOptions,
  runGenerator,
} from "@/lib/team-comp/generator/generator";

import "@/lib/dmgcalc";
import { drain, getFirstFormulaId } from "../../../fixtures/optimizerHelpers";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

// ── 2+2pc set assignment ────────────────────────────────────────────────────

describe("generator — 2+2pc set assignment", () => {
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

  function make2pc2pcConfigs(): TeamSlotConfig[] {
    return [
      {
        charId: "diluc",
        charLevel: 90,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSet: { type: "2pc+2pc", halfSetIds: [HALF_SET_1, HALF_SET_2] },
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "sacrificial_sword",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 0,
        weaponId: "aquila_favonia",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "iron_sting",
        refinement: 1,
        artifactSet: null,
      },
    ];
  }

  it("2+2pc carry should have 3 slots from set1 and 2 slots from set2", async () => {
    const configs = make2pc2pcConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
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

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
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
    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
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

    const results = await drain(runGenerator(opts));
    const final = results[results.length - 1];
    const arts = final.artifactsByChar.diluc;

    expect(arts.flower.setKey).toBe(expected5Star1);
    expect(arts.sands.setKey).toBe(expected5Star1);
    expect(arts.goblet.setKey).toBe(expected5Star2);
    expect(arts.circlet.setKey).toBe(expected5Star2);
  });

  it("same half-set for both 2pc slots still produces distinct concrete sets", async () => {
    // Both 2pc slots use "atk%-18" — sk1 and sk2 must still differ
    const configs: TeamSlotConfig[] = [
      {
        charId: "diluc",
        charLevel: 90,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSet: { type: "2pc+2pc", halfSetIds: [HALF_SET_1, HALF_SET_1] }, // same half-set!
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "sacrificial_sword",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 0,
        weaponId: "aquila_favonia",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "iron_sting",
        refinement: 1,
        artifactSet: null,
      },
    ];
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
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

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
      setKeysByChar: {}, // caller passes empty — should still derive from configs
    };

    const results = await drain(runGenerator(opts));
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

// ── 4★ flex slot promotion ──────────────────────────────────────────────────

describe("generator — 4★ flex slot promotion", () => {
  /** Build a team where the support uses a 4-star 4pc set. */
  function make4StarSupportConfigs(): TeamSlotConfig[] {
    return [
      {
        charId: "diluc",
        charLevel: 90,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
      },
      {
        charId: "xingqiu",
        charLevel: 90,
        constellation: 0,
        weaponId: "sacrificial_sword",
        refinement: 1,
        artifactSet: { type: "4pc", setId: "instructor" }, // 4★ set
      },
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 0,
        weaponId: "aquila_favonia",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "kaedehara_kazuha",
        charLevel: 90,
        constellation: 0,
        weaponId: "iron_sting",
        refinement: 1,
        artifactSet: null,
      },
    ];
  }

  it("4★ set support should have exactly one 5★ flex slot in sands/goblet/circlet", async () => {
    const configs = make4StarSupportConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);

    const arts = final.artifactsByChar.xingqiu;
    expect(arts).toBeDefined();

    // Count how many slots are 5★ vs 4★
    const flexSlots: Slot[] = [];
    const fourStarSlots: Slot[] = [];
    for (const slot of allSlots) {
      if (arts[slot].rarity === 5) {
        flexSlots.push(slot);
      } else {
        fourStarSlots.push(slot);
        expect(arts[slot].rarity).toBe(4);
      }
    }

    // Exactly one flex slot, and it must be sands/goblet/circlet
    expect(flexSlots).toHaveLength(1);
    expect(["sands", "goblet", "circlet"]).toContain(flexSlots[0]);

    // The flex slot should use a 5★ set key (not the 4★ instructor set)
    const flexArt = arts[flexSlots[0]];
    expect(flexArt.setKey).not.toBe("instructor");
    expect(artifactsById[flexArt.setKey]?.rarity).toBe(5);

    // The 4 remaining slots should use the 4★ set
    expect(fourStarSlots).toHaveLength(4);
    for (const slot of fourStarSlots) {
      expect(arts[slot].setKey).toBe("instructor");
    }
  });

  it("5★ set carry should have no flex slot (all 5★)", async () => {
    const configs = make4StarSupportConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
    const final = results[results.length - 1];

    const arts = final.artifactsByChar.diluc;
    for (const slot of allSlots) {
      expect(arts[slot].rarity).toBe(5);
    }
  });

  it("flex slot has higher level (20) than other 4★ slots (16)", async () => {
    const configs = make4StarSupportConfigs();
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
    const final = results[results.length - 1];
    const arts = final.artifactsByChar.xingqiu;

    for (const slot of allSlots) {
      if (arts[slot].rarity === 5) {
        expect(arts[slot].level).toBe(20);
      } else {
        expect(arts[slot].level).toBe(16);
      }
    }
  });
});
