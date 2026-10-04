import { describe, expect, it } from "vitest";
import type { ArtifactData, Build } from "@/data/types";
import {
  buildTriageStatistics,
  countKeepReasons,
} from "@/lib/account-data/triage/statistics";
import type {
  QualityTier,
  TriageDecision,
  TriageDemandGroup,
  TriageRuleId,
  TriageSpecialRule,
} from "@/lib/account-data/triage/types";

function art(
  id: string,
  slotKey: ArtifactData["slotKey"] = "flower",
  setKey = "set_a"
): ArtifactData {
  return { id, slotKey, setKey, rarity: 5 } as ArtifactData;
}
function group(
  setKey: string,
  slot: TriageDemandGroup["slot"],
  demand: number
): TriageDemandGroup {
  return { source: { type: "4pc", setKey }, slot, demand };
}
describe("triage statistics gap", () => {
  it("counts only Prime/Solid supply and prevents surplus in another slot or main-stat group from masking a gap", () => {
    const demandGroups = new Map([
      ["flowers", group("set_a", "flower", 1)],
      ["cr-circlet", group("set_a", "circlet", 2)],
      ["cd-circlet", group("set_a", "circlet", 1)],
      ["other-set", group("set_b", "flower", 4)],
    ]);
    const entries: {
      key: string;
      tier: QualityTier;
      slot: ArtifactData["slotKey"];
    }[] = [
      { key: "flowers", tier: "prime", slot: "flower" },
      { key: "flowers", tier: "solid", slot: "flower" },
      { key: "flowers", tier: "solid", slot: "flower" },
      { key: "cr-circlet", tier: "filler", slot: "circlet" },
      { key: "cr-circlet", tier: "fodder", slot: "circlet" },
      { key: "cd-circlet", tier: "solid", slot: "circlet" },
      { key: "cd-circlet", tier: "prime", slot: "circlet" },
    ];
    const supply = entries.map((entry, i) => ({
      artifact: art(String(i), entry.slot),
      embryoKey: entry.key,
      tier: entry.tier,
    }));
    const result = buildTriageStatistics({
      activeGroups: [],
      buildGroups: [],
      demandGroups,
      supply,
      artifacts: supply.map((entry) => entry.artifact),
      decisions: [],
    });
    expect(result.sets.map((row) => [row.key, row.gap])).toEqual([
      ["4pc:set_b", 4],
      ["4pc:set_a", 2],
    ]);
    const row = result.sets[1];
    expect(row.demand).toBe(4);
    expect(row.slots.flower.gap).toBe(0);
    expect(row.slots.circlet.gap).toBe(2);
    expect(row.supplyByTier).toEqual({
      prime: 2,
      solid: 3,
      filler: 1,
      fodder: 1,
    });
    // Even though total good supply exceeds demand, the CR circlet group is short.
    expect(result.totalGap).toBe(6);
  });

  it("includes unmatched artifacts as fodder without filling demand, and excludes four-star inventory", () => {
    const result = buildTriageStatistics({
      activeGroups: [],
      buildGroups: [],
      demandGroups: new Map([["d", group("set_a", "flower", 2)]]),
      supply: [],
      artifacts: [art("unmatched"), { ...art("four-star"), rarity: 4 }],
      decisions: [],
    });
    expect(result.sets[0].gap).toBe(2);
    expect(result.sets[0].supplyByTier.fodder).toBe(1);
    expect(result.totalSupply).toBe(1);
  });

  it("counts every configured build but ranks by active counts, including characters with zero active builds", () => {
    const b = { id: "b" } as Build;
    const result = buildTriageStatistics({
      activeGroups: [
        { characterId: "b", builds: [b, b] },
        { characterId: "a", builds: [b] },
      ],
      buildGroups: [
        { characterId: "a", builds: [b, b, b] },
        { characterId: "b", builds: [b, b] },
        { characterId: "inactive", builds: [b] },
      ],
      demandGroups: new Map(),
      supply: [],
      artifacts: [],
      decisions: [],
    });
    expect(result.characters).toEqual([
      { characterId: "b", totalBuildCount: 2, activeBuildCount: 2 },
      { characterId: "a", totalBuildCount: 3, activeBuildCount: 1 },
      { characterId: "inactive", totalBuildCount: 1, activeBuildCount: 0 },
    ]);
    expect(result.totalBuilds).toBe(6);
    expect(result.totalActiveBuilds).toBe(3);
  });
});

describe("exclusive keep reasons", () => {
  function decision(
    id: string,
    ruleId: TriageRuleId,
    label: TriageDecision["label"] = "lock",
    specialRules: TriageSpecialRule[] = []
  ): TriageDecision {
    return {
      artifact: art(id),
      label,
      specialRules,
      decidingResult: { ruleId } as TriageDecision["decidingResult"],
      allResults: [],
      supplyDemand: null,
    };
  }
  it("uses the actual keep reason, counts protections, and never double-counts a matching flex tag", () => {
    const decisions = [
      decision("prime", "primeTierKeep", "lock", ["offPiecePattern"]),
      decision("solid", "solidTierKeep"),
      decision("filler", "fillerShortfallKeep"),
      decision("flex", "offPiecePattern", "lock", [
        "offPiecePattern",
        "levelProtected",
      ]),
      decision("hoard", "doubleCrit", "lock", [
        "offPiecePattern",
        "doubleCrit",
      ]),
      decision("floor", "setSlotFloorKeep"),
      decision("concentration", "concentrationValue"),
      decision("protected", "noDemand", "unlock", ["equippedProtected"]),
      decision("ignored", "noDemand", "unlock", ["offPiecePattern"]),
      decision("prime", "primeTierKeep"),
    ];
    expect(countKeepReasons(decisions)).toEqual({
      prime: 1,
      solid: 1,
      filler: 1,
      flex: 1,
      other: 4,
    });
  });
});
