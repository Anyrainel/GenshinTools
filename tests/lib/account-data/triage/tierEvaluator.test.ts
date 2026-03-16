import type { SubStat } from "@/data/types";
import { evaluateTier } from "@/lib/account-data/triage/tierEvaluator";
import type {
  DemandTierEntry,
  TierCondition,
  TriageRule,
} from "@/lib/account-data/triage/types";
import { describe, expect, it } from "vitest";

function makeRule(opts: {
  desired: SubStat[];
  optional?: SubStat[];
  fillers?: SubStat[];
  conditions: TierCondition[];
  subN?: number;
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
      subN: opts.subN ?? opts.desired.length,
      hasCrCd: opts.desired.includes("cr") && opts.desired.includes("cd"),
      hasFillers: (opts.fillers ?? []).length > 0,
      conditions: opts.conditions,
    },
  };
}

describe("evaluateTier", () => {
  it("returns T when no conditions match", () => {
    const rule = makeRule({
      desired: ["cr", "cd", "atk%"],
      conditions: [{ k: 3, crcd: false, is4L: false, fill: false, tier: "P" }],
    });
    const result = evaluateTier(["hp%", "def%", "er", "em"], false, rule);
    expect(result.tier).toBe("T");
    expect(result.hitCount).toBe(0);
    expect(result.matchedCondition).toBeNull();
  });

  it("matches first qualifying condition (best tier)", () => {
    const rule = makeRule({
      desired: ["cr", "cd", "atk%"],
      conditions: [
        { k: 3, crcd: false, is4L: false, fill: false, tier: "P" },
        { k: 2, crcd: false, is4L: false, fill: false, tier: "Q" },
        { k: 1, crcd: false, is4L: false, fill: false, tier: "N" },
      ],
    });
    const result = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(result.tier).toBe("Q");
    expect(result.hitCount).toBe(2);
  });

  it("crcd condition requires both cr and cd", () => {
    const rule = makeRule({
      desired: ["cr", "cd", "atk%"],
      conditions: [
        { k: 2, crcd: true, is4L: false, fill: false, tier: "P" },
        { k: 2, crcd: false, is4L: false, fill: false, tier: "Q" },
      ],
    });
    // Has cr+atk% but NOT cd → crcd fails, falls to Q
    const r1 = evaluateTier(["cr", "atk%", "er", "em"], false, rule);
    expect(r1.tier).toBe("Q");

    // Has cr+cd → crcd passes
    const r2 = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(r2.tier).toBe("P");
  });

  it("is4L condition requires 4-line artifact", () => {
    const rule = makeRule({
      desired: ["cr", "cd"],
      conditions: [
        { k: 2, crcd: false, is4L: true, fill: false, tier: "P" },
        { k: 2, crcd: false, is4L: false, fill: false, tier: "Q" },
      ],
    });
    const r3L = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(r3L.tier).toBe("Q");

    const r4L = evaluateTier(["cr", "cd", "er", "em"], true, rule);
    expect(r4L.tier).toBe("P");
  });

  it("fill condition requires filler stat present when hitCount == subN", () => {
    const rule = makeRule({
      desired: ["cr", "cd"],
      fillers: ["atk"],
      subN: 2,
      conditions: [
        { k: 2, crcd: false, is4L: false, fill: true, tier: "P" },
        { k: 2, crcd: false, is4L: false, fill: false, tier: "Q" },
      ],
    });
    // Has both desired but no filler → fill fails
    const r1 = evaluateTier(["cr", "cd", "er", "em"], false, rule);
    expect(r1.tier).toBe("Q");
    expect(r1.hasFill).toBe(false);

    // Has both desired + filler
    const r2 = evaluateTier(["cr", "cd", "atk", "em"], false, rule);
    expect(r2.tier).toBe("P");
    expect(r2.hasFill).toBe(true);
  });

  it("counts optional hits correctly", () => {
    const rule = makeRule({
      desired: ["cr", "cd"],
      optional: ["atk%", "er"],
      conditions: [{ k: 2, crcd: false, is4L: false, fill: false, tier: "Q" }],
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
      subN: 2,
      conditions: [{ k: 2, crcd: false, is4L: false, fill: false, tier: "Q" }],
    });
    const result = evaluateTier(["cr", "cd", "atk", "er"], false, rule);
    expect(result.hitCount).toBe(2);
    expect(result.hitOptional).toBe(1);
    expect(result.hasFill).toBe(true);
    expect(result.hitTotal).toBe(4); // 2 desired + 1 optional + 1 filler
  });
});
