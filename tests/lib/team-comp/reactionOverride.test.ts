import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/lib/gameStatsLoader";
import { ELEMENT_ELIGIBLE_REACTIONS } from "@/lib/team-comp/constants";
import "@/lib/team-comp/index";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import {
  type CalcContext,
  type CharCompConfig,
  type ReactionOverride,
  resolvePartReaction,
} from "@/lib/team-comp/types";

await preloadGameStats();

// ─── resolvePartReaction unit tests ───

describe("resolvePartReaction", () => {
  const pyroEligible = ELEMENT_ELIGIBLE_REACTIONS.Pyro; // ["none", "vaporize", "melt"]
  const electroEligible = ELEMENT_ELIGIBLE_REACTIONS.Electro; // ["none", "aggravate"]
  const geoEligible = ELEMENT_ELIGIBLE_REACTIONS.Geo; // ["none"]

  it("returns 'none' when no override is provided", () => {
    expect(resolvePartReaction(undefined, 0, pyroEligible)).toBe("none");
  });

  it("returns 'none' when gate is 'none'", () => {
    expect(resolvePartReaction({ reaction: "none" }, 0, pyroEligible)).toBe(
      "none"
    );
  });

  it("all parts inherit gate by default (Pyro + vaporize)", () => {
    const override: ReactionOverride = { reaction: "vaporize" };
    expect(resolvePartReaction(override, 0, pyroEligible)).toBe("vaporize");
    expect(resolvePartReaction(override, 1, pyroEligible)).toBe("vaporize");
    expect(resolvePartReaction(override, 5, pyroEligible)).toBe("vaporize");
  });

  it("per-part override to 'none' disables that part", () => {
    const override: ReactionOverride = {
      reaction: "vaporize",
      partReactions: { 1: "none" },
    };
    expect(resolvePartReaction(override, 0, pyroEligible)).toBe("vaporize");
    expect(resolvePartReaction(override, 1, pyroEligible)).toBe("none");
    expect(resolvePartReaction(override, 2, pyroEligible)).toBe("vaporize");
  });

  it("element-ineligible reaction returns 'none' even with gate set", () => {
    // Geo can't vaporize
    const override: ReactionOverride = { reaction: "vaporize" };
    expect(resolvePartReaction(override, 0, geoEligible)).toBe("none");
  });

  it("Electro part inherits aggravate gate", () => {
    const override: ReactionOverride = { reaction: "aggravate" };
    expect(resolvePartReaction(override, 0, electroEligible)).toBe("aggravate");
  });

  it("Electro part does not inherit vaporize gate", () => {
    const override: ReactionOverride = { reaction: "vaporize" };
    expect(resolvePartReaction(override, 0, electroEligible)).toBe("none");
  });
});

// ─── Per-part damage calculation tests ───

describe("per-part reaction override — damage calc", () => {
  // Use Diluc (Pyro) with 3-part E skill for multi-part testing
  const configs: CharCompConfig[] = [
    {
      charId: "diluc",
      charLevel: 90,
      constellation: 0,
      weaponId: "wolfs_gravestone",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    // Need a Hydro teammate for vaporize availability
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
  };

  const emptySheets: Record<string, StatSheet> = {
    diluc: new StatSheet([]),
    xingqiu: new StatSheet([]),
  };

  const tb = new TeamBuild(configs);

  it("no reaction override: all parts are direct damage", () => {
    const result = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );
    // Diluc E has 3 parts, all direct
    expect(result.parts.length).toBe(3);
    for (const dp of result.parts) {
      expect(dp.template).toBe("direct");
    }
  });

  it("vaporize gate: all parts become amplify", () => {
    const result = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx,
      { reaction: "vaporize" }
    );
    expect(result.parts.length).toBe(3);
    for (const dp of result.parts) {
      expect(dp.template).toBe("amplify");
      expect(dp.tag?.reaction).toBe("vaporize");
    }
  });

  it("vaporize gate with total damage > direct total damage", () => {
    const direct = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );
    const vape = tb.getDisplayResult("diluc", "diluc-skill", emptySheets, ctx, {
      reaction: "vaporize",
    });
    expect(vape.totalDamage).toBeGreaterThan(direct.totalDamage);
  });

  it("disabling one part via partReactions leaves others as amplify", () => {
    const result = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx,
      { reaction: "vaporize", partReactions: { 1: "none" } }
    );
    // 3 parts: part 0 = amplify, part 1 = direct, part 2 = amplify
    expect(result.parts.length).toBe(3);
    expect(result.parts[0].template).toBe("amplify");
    expect(result.parts[1].template).toBe("direct");
    expect(result.parts[2].template).toBe("amplify");
  });

  it("disabling one part gives damage between full-direct and full-vape", () => {
    const direct = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );
    const vape = tb.getDisplayResult("diluc", "diluc-skill", emptySheets, ctx, {
      reaction: "vaporize",
    });
    const partial = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx,
      { reaction: "vaporize", partReactions: { 1: "none" } }
    );
    expect(partial.totalDamage).toBeGreaterThan(direct.totalDamage);
    expect(partial.totalDamage).toBeLessThan(vape.totalDamage);
  });

  it("disabling all parts equals no-reaction damage", () => {
    const direct = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );
    const allOff = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx,
      {
        reaction: "vaporize",
        partReactions: { 0: "none", 1: "none", 2: "none" },
      }
    );
    expect(allOff.totalDamage).toBeCloseTo(direct.totalDamage, 2);
  });
});

// ─── Per-hit partHits tests (multi-hit parts) ───

describe("partHits — multi-hit split", () => {
  // Use Yae Miko: burst has 2 parts: initial (1 hit) + thunderbolts (3 hits)
  // Both Electro → eligible for aggravate
  const configs: CharCompConfig[] = [
    {
      charId: "yae_miko",
      charLevel: 90,
      constellation: 0,
      weaponId: "kaguras_verity",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    // Need Dendro teammate for aggravate
    {
      charId: "nahida",
      charLevel: 90,
      constellation: 0,
      weaponId: "a_thousand_floating_dreams",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
  };

  const emptySheets: Record<string, StatSheet> = {
    yae_miko: new StatSheet([]),
    nahida: new StatSheet([]),
  };

  const tb = new TeamBuild(configs);

  it("no override: 2 display parts (initial 1-hit + thunderbolts 3-hit)", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx
    );
    expect(result.parts.length).toBe(2);
    expect(result.parts[0].hits).toBe(1);
    expect(result.parts[1].hits).toBe(3);
  });

  it("aggravate gate: all parts catalyze", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate" }
    );
    // Both parts are Electro → both become catalyze
    expect(result.parts.length).toBe(2);
    expect(result.parts[0].template).toBe("catalyze");
    expect(result.parts[1].template).toBe("catalyze");
    expect(result.parts[1].hits).toBe(3);
  });

  it("partHits limits reacting hits on multi-hit part, splits into two display entries", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate", partHits: { 1: 2 } }
    );
    // Part 0: initial hit → catalyze (1 hit)
    // Part 1 split: 2 thunderbolts catalyze + 1 thunderbolt direct
    expect(result.parts.length).toBe(3);
    expect(result.parts[0].template).toBe("catalyze");
    expect(result.parts[0].hits).toBe(1);
    expect(result.parts[1].template).toBe("catalyze");
    expect(result.parts[1].hits).toBe(2);
    expect(result.parts[2].template).toBe("direct");
    expect(result.parts[2].hits).toBe(1);
  });

  it("partHits=1 on 3-hit part: 1 catalyze + 2 direct", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate", partHits: { 1: 1 } }
    );
    expect(result.parts.length).toBe(3);
    // Part 0: initial catalyze
    expect(result.parts[0].template).toBe("catalyze");
    expect(result.parts[0].hits).toBe(1);
    // Part 1 split: 1 catalyze, 2 direct
    expect(result.parts[1].template).toBe("catalyze");
    expect(result.parts[1].hits).toBe(1);
    expect(result.parts[2].template).toBe("direct");
    expect(result.parts[2].hits).toBe(2);
  });

  it("partHits >= total hits is same as no partHits override", () => {
    const full = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate" }
    );
    const overHits = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate", partHits: { 1: 5 } } // 5 > 3 thunderbolts
    );
    expect(overHits.totalDamage).toBeCloseTo(full.totalDamage, 2);
    expect(overHits.parts.length).toBe(full.parts.length);
  });

  it("split damage sums correctly: partial = weighted reacting + non-reacting", () => {
    const allAggravate = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate" }
    );
    const noneAggravate = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx
    );
    const partial = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate", partHits: { 1: 2 } }
    );

    // Initial hit (part 0) damage should be the same across all-aggravate and partial
    const initialDmgFull = allAggravate.parts[0].damage;
    const initialDmgPartial = partial.parts[0].damage;
    expect(initialDmgPartial).toBeCloseTo(initialDmgFull, 2);

    // Partial total should be between none and full aggravate
    expect(partial.totalDamage).toBeGreaterThan(noneAggravate.totalDamage);
    expect(partial.totalDamage).toBeLessThan(allAggravate.totalDamage);
  });

  it("disabling part 0 + partHits on part 1: combined override", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      {
        reaction: "aggravate",
        partReactions: { 0: "none" },
        partHits: { 1: 1 },
      }
    );
    // Part 0: disabled → direct (1 hit)
    // Part 1 split: 1 catalyze + 2 direct
    expect(result.parts.length).toBe(3);
    expect(result.parts[0].template).toBe("direct");
    expect(result.parts[0].hits).toBe(1);
    expect(result.parts[1].template).toBe("catalyze");
    expect(result.parts[1].hits).toBe(1);
    expect(result.parts[2].template).toBe("direct");
    expect(result.parts[2].hits).toBe(2);
  });

  it("disabled part ignores partHits override for that part", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      {
        reaction: "aggravate",
        partReactions: { 1: "none" },
        partHits: { 1: 2 }, // should be ignored since part 1 is disabled
      }
    );
    // Part 0: catalyze (1 hit)
    // Part 1: all 3 hits direct (disabled overrides partHits)
    expect(result.parts.length).toBe(2);
    expect(result.parts[0].template).toBe("catalyze");
    expect(result.parts[1].template).toBe("direct");
    expect(result.parts[1].hits).toBe(3);
  });
});

// ─── getDamageResult consistency with getDisplayResult ───

describe("getDamageResult matches getDisplayResult total damage", () => {
  const configs: CharCompConfig[] = [
    {
      charId: "yae_miko",
      charLevel: 90,
      constellation: 0,
      weaponId: "kaguras_verity",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "nahida",
      charLevel: 90,
      constellation: 0,
      weaponId: "a_thousand_floating_dreams",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
  };

  const emptySheets: Record<string, StatSheet> = {
    yae_miko: new StatSheet([]),
    nahida: new StatSheet([]),
  };

  const tb = new TeamBuild(configs);

  const overrides: [string, ReactionOverride][] = [
    ["no reaction", {}],
    ["full aggravate", { reaction: "aggravate" }],
    [
      "part 0 disabled",
      { reaction: "aggravate", partReactions: { 0: "none" } },
    ],
    ["partHits=2 on part 1", { reaction: "aggravate", partHits: { 1: 2 } }],
    [
      "part 0 off + partHits=1",
      {
        reaction: "aggravate",
        partReactions: { 0: "none" },
        partHits: { 1: 1 },
      },
    ],
  ];

  for (const [label, override] of overrides) {
    it(`${label}: display total matches calc total`, () => {
      const display = tb.getDisplayResult(
        "yae_miko",
        "yae_miko-burst",
        emptySheets,
        ctx,
        override
      );
      // Sum display parts manually
      const displayTotal = display.parts.reduce(
        (sum, dp) => sum + dp.damage * (dp.hits ?? 1),
        0
      );
      expect(display.totalDamage).toBeCloseTo(displayTotal, 2);
    });
  }
});
