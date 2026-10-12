import "@/providers/reference/statLoaders";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { singleFormulaCombo } from "@/domain/combat/damage/core/combo";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { TeamSlotConfig } from "@/domain/combat/damage/types";
import { allSlots, type Slot } from "@/domain/enums";
import type { ArtifactData, WeaponData } from "@/domain/models";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type { AccountEquipmentOptions } from "@/domain/team/accountEquipmentTypes";
import { computeTeamInventory } from "@/domain/team/artifactInventory";
import type { TeamOptimizerOptions } from "@/domain/team/types";
import { runAccountEquipmentSearch } from "@/services/combat/accountEquipment";
import "@/domain/combat/damage/index";

type Allocation = Record<string, Record<Slot, ArtifactData>>;
const optimizer = vi.hoisted(() => ({
  allocation: {} as Allocation,
  calls: vi.fn(),
}));
vi.mock("@/services/combat/optimizer/teamOptimization", () => ({
  runTeamOptimization: async function* (options: TeamOptimizerOptions) {
    optimizer.calls(options);
    // Supply an allocation at the optimizer boundary. The account task must
    // independently reject infeasible output before presenting/applying it.
    yield { done: true, bestArtifactsByChar: optimizer.allocation };
  },
}));

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

function pieces(prefix: string): Record<Slot, ArtifactData> {
  return Object.fromEntries(
    allSlots.map((slot) => [
      slot,
      {
        id: `${prefix}-${slot}`,
        slotKey: slot,
        setKey: "gladiators_finale",
        rarity: 5,
        level: 20,
        lock: false,
        mainStatKey:
          slot === "flower" ? "hp" : slot === "plume" ? "atk" : "atk%",
        substats: { cr: 10, cd: 20, er: 12 },
      },
    ])
  ) as Record<Slot, ArtifactData>;
}
function weapon(id: string, refinement: number): WeaponData {
  return { id, key: "staff_of_homa", refinement, level: 90, lock: false };
}
const configs: TeamSlotConfig[] = ["hu_tao", "zhongli"].map((charId) => ({
  charId,
  charLevel: 90,
  constellation: 0,
  weaponId: "staff_of_homa",
  refinement: 1,
  artifactSet: null,
}));
const first = pieces("first");
const second = pieces("second");
const team = new TeamBuild(configs);
const formulaId = Object.keys(team.catalog.getFormulaIds().hu_tao)[0];

function options(): AccountEquipmentOptions {
  return {
    configs,
    setupConfig: { combatOptions: {} },
    accountData: {
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          artifacts: first,
          weapon: weapon("equipped-r4", 4),
        },
      ],
      extraWeapons: [weapon("inventory-r2", 2), weapon("equipped-r4", 5)],
      extraArtifacts: Object.values(second),
    },
    weaponStats: weaponStatsResource.peek()!,
    combo: singleFormulaCombo("hu_tao", formulaId),
    calcContext: {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    },
    inventory: [...Object.values(first), ...Object.values(second)],
    baseSheets: {
      hu_tao: StatSheet.fromArtifacts(Object.values(first)),
      zhongli: StatSheet.fromArtifacts(Object.values(second)),
    },
    perCharExtraArtifacts: {},
  };
}
async function search(overrides: Partial<AccountEquipmentOptions> = {}) {
  for await (const update of runAccountEquipmentSearch({
    ...options(),
    ...overrides,
  }))
    if (update.kind === "result") return update.result;
  throw new Error("Search did not complete");
}

beforeEach(() => {
  optimizer.allocation = { hu_tao: first, zhongli: second };
  optimizer.calls.mockClear();
});

describe("coordinated account equipment feasibility", () => {
  it("assigns distinct equipped and inventory copies at actual ranks despite duplicate physical IDs", async () => {
    const result = await search();
    expect(result).not.toBeNull();
    expect(new Set(result!.weaponCopyIds).size).toBe(2);
    expect([...result!.weaponCopyIds].sort()).toEqual([
      "equipped-r4",
      "inventory-r2",
    ]);
    expect(result!.configs.map((config) => config.refinement).sort()).toEqual([
      2, 4,
    ]);
    expect(
      new Set(
        Object.values(result!.artifactsByChar).flatMap((arts) =>
          Object.values(arts).map((art) => art!.id)
        )
      ).size
    ).toBe(10);
  });

  it("returns no allocation when two members have only one physical compatible copy", async () => {
    const accountData = options().accountData;
    accountData.extraWeapons = [weapon("equipped-r4", 5)];
    expect(await search({ accountData })).toBeNull();
    expect(optimizer.calls).not.toHaveBeenCalled();
  });

  it("rejects a duplicate artifact assignment even when all pieces are in the account pool", async () => {
    optimizer.allocation.zhongli = { ...second, flower: first.flower };
    expect(await search()).toBeNull();
  });

  it("keeps owning-team saved pieces available while rejecting another team's reserved pieces", async () => {
    const reserved = pieces("reserved");
    const pools = computeTeamInventory({
      allArtifacts: [
        ...Object.values(first),
        ...Object.values(second),
        ...Object.values(reserved),
      ],
      frozenTeams: {
        owner: {
          frozenCharIds: ["hu_tao"],
          artifactsByChar: { hu_tao: first },
        },
        other: {
          frozenCharIds: ["hu_tao"],
          artifactsByChar: { hu_tao: reserved },
        },
      },
      reuseMode: "none",
      standaloneFrozenIds: [],
      teamId: "owner",
      teamCharacters: ["hu_tao", "zhongli"],
      teamArtifacts: [null, null],
    });
    const input = {
      inventory: pools.availableArtifacts,
      perCharExtraArtifacts: pools.perCharExtraArtifacts,
    };
    expect(pools.availableArtifacts).toContain(first.flower);
    expect(pools.availableArtifacts).not.toContain(reserved.flower);
    expect(await search(input)).not.toBeNull();
    optimizer.allocation.hu_tao = { ...first, flower: reserved.flower };
    expect(await search(input)).toBeNull();
  });

  it("permits explicit same-character reservation reuse without leaking it to teammates", async () => {
    const reserved = pieces("same-char");
    const pools = computeTeamInventory({
      allArtifacts: [
        ...Object.values(first),
        ...Object.values(second),
        ...Object.values(reserved),
      ],
      frozenTeams: {
        other: {
          frozenCharIds: ["hu_tao"],
          artifactsByChar: { hu_tao: reserved },
        },
      },
      reuseMode: "sameChar",
      standaloneFrozenIds: [],
      teamId: "owner",
      teamCharacters: ["hu_tao", "zhongli"],
      teamArtifacts: [null, null],
    });
    const input = {
      inventory: pools.availableArtifacts,
      perCharExtraArtifacts: pools.perCharExtraArtifacts,
    };
    optimizer.allocation.hu_tao = { ...first, flower: reserved.flower };
    expect(await search(input)).not.toBeNull();
    optimizer.allocation.hu_tao = first;
    optimizer.allocation.zhongli = { ...second, flower: reserved.flower };
    expect(await search(input)).toBeNull();
  });

  it("keeps force-reused pieces fixed and removes their IDs from every other member's pool", async () => {
    // An optimizer proposal cannot replace the explicitly force-reused loadout.
    optimizer.allocation.hu_tao = second;
    const result = await search({
      forceReuseChars: { hu_tao: first },
      perCharExtraArtifacts: {
        hu_tao: Object.values(first),
        zhongli: Object.values(first),
      },
    });
    expect(result?.artifactsByChar.hu_tao).toEqual(first);
    expect(result?.artifactsByChar.zhongli).toEqual(second);
    const fixedIds = new Set(
      Object.values(first).map((artifact) => artifact.id)
    );
    for (const [call] of optimizer.calls.mock.calls as [
      TeamOptimizerOptions,
    ][]) {
      expect(call.perChar).not.toHaveProperty("hu_tao");
      expect(call.inventory.some((artifact) => fixedIds.has(artifact.id))).toBe(
        false
      );
      expect(
        call.perCharExtraArtifacts?.zhongli?.some((artifact) =>
          fixedIds.has(artifact.id)
        )
      ).toBe(false);
      expect(call.baseSheets?.hu_tao.getRaw("cr")).toBe(
        StatSheet.fromArtifacts(Object.values(first)).getRaw("cr")
      );
    }
  });
});
