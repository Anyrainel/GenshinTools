import { describe, expect, it } from "vitest";
import type { SubStat } from "@/data/enums";
import { evaluateTier } from "@/lib/account-data/triage/tierEvaluator";
import type {
  TierCondition,
  TriageRule,
} from "@/lib/account-data/triage/types";

function makeRule(opts: {
  desired: SubStat[];
  optional?: SubStat[];
  fillers?: SubStat[];
  conditions: TierCondition[];
  desiredSubstatCount?: number;
}): TriageRule {
  return {
    characterId: "test",
    buildId: "b1",
    demandSource: { type: "4pc", setKey: "test_set" },
    slot: "flower",
    mainStat: "hp",
    desired: opts.desired,
    optional: opts.optional ?? [],
    fillers: opts.fillers ?? [],
    tierEntry: {
      desiredSubstatCount: opts.desiredSubstatCount ?? opts.desired.length,
      hasCritPair: opts.desired.includes("cr") && opts.desired.includes("cd"),
      hasFillers: (opts.fillers ?? []).length > 0,
      conditions: opts.conditions,
    },
  };
}

describe("evaluateTier", () => {
  it("returns fodder when no conditions match", () => {
    const rule = makeRule({
      desired: ["cr", "cd", "atk%"],
      conditions: [
        {
          requiredDesiredHits: 3,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "prime",
          rarity: 0,
        },
      ],
    });
    const result = evaluateTier(["hp%", "def%", "er", "em"], false, rule);
    expect(result.tier).toBe("fodder");
    expect(result.hitCount).toBe(0);
    expect(result.matchedCondition).toBeNull();
  });

  it("matches first qualifying condition (best tier)", () => {
    const rule = makeRule({
      desired: ["cr", "cd", "atk%"],
      conditions: [
        {
          requiredDesiredHits: 3,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "prime",
          rarity: 0,
        },
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "solid",
          rarity: 0,
        },
        {
          requiredDesiredHits: 1,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "filler",
          rarity: 0,
        },
      ],
    });
    const result = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(result.tier).toBe("solid");
    expect(result.hitCount).toBe(2);
  });

  it("crit-pair condition requires both cr and cd", () => {
    const rule = makeRule({
      desired: ["cr", "cd", "atk%"],
      conditions: [
        {
          requiredDesiredHits: 2,
          requiresCritPair: true,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "prime",
          rarity: 0,
        },
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "solid",
          rarity: 0,
        },
      ],
    });
    // Has cr+atk% but NOT cd → crit-pair requirement fails, falls to solid.
    const r1 = evaluateTier(["cr", "atk%", "er", "em"], false, rule);
    expect(r1.tier).toBe("solid");

    // Has cr+cd → crit-pair requirement passes.
    const r2 = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(r2.tier).toBe("prime");
  });

  it("four-initial-substat condition requires 4-line artifact", () => {
    const rule = makeRule({
      desired: ["cr", "cd"],
      conditions: [
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: true,
          requiresFillerHit: false,
          tier: "prime",
          rarity: 0,
        },
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "solid",
          rarity: 0,
        },
      ],
    });
    const r3L = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(r3L.tier).toBe("solid");

    const r4L = evaluateTier(["cr", "cd", "er", "em"], true, rule);
    expect(r4L.tier).toBe("prime");
  });

  it("filler-hit condition requires filler stat present when all desired substats hit", () => {
    const rule = makeRule({
      desired: ["cr", "cd"],
      fillers: ["atk"],
      desiredSubstatCount: 2,
      conditions: [
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: true,
          tier: "prime",
          rarity: 0,
        },
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "solid",
          rarity: 0,
        },
      ],
    });
    // Has both desired but no filler → fill fails
    const r1 = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(r1.tier).toBe("solid");
    expect(r1.hasFill).toBe(false);

    // Has both desired + filler
    const r2 = evaluateTier(["cr", "cd", "atk", "em"], false, rule);
    expect(r2.tier).toBe("prime");
    expect(r2.hasFill).toBe(true);
  });

  it("counts optional hits correctly", () => {
    const rule = makeRule({
      desired: ["cr", "cd"],
      optional: ["atk%", "er"],
      conditions: [
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "solid",
          rarity: 0,
        },
      ],
    });
    const result = evaluateTier(["cr", "cd", "atk%", "em"], false, rule);
    expect(result.hitCount).toBe(2);
    expect(result.hitOptional).toBe(1);
    expect(result.hitTotal).toBe(3);
  });

  it("hitTotal includes filler bonus", () => {
    const rule = makeRule({
      desired: ["cr", "cd"],
      optional: ["er"],
      fillers: ["atk"],
      desiredSubstatCount: 2,
      conditions: [
        {
          requiredDesiredHits: 2,
          requiresCritPair: false,
          requiresFourInitialSubstats: false,
          requiresFillerHit: false,
          tier: "solid",
          rarity: 0,
        },
      ],
    });
    const result = evaluateTier(["cr", "cd", "atk", "er"], false, rule);
    expect(result.hitCount).toBe(2);
    expect(result.hitOptional).toBe(1);
    expect(result.hasFill).toBe(true);
    expect(result.hitTotal).toBe(4); // 2 desired + 1 optional + 1 filler
  });
});
