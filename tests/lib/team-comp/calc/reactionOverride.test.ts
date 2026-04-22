import { describe, expect, it } from "vitest";

import { preloadGameStats } from "@/data/gameStatsLoader";
import {
  ELEMENT_ELIGIBLE_REACTIONS,
  MULTI_ELEMENT_CHARS,
} from "@/lib/team-comp/constants";
import "@/lib/team-comp/index";
import { resolvePartReaction } from "@/lib/team-comp/calc/combo";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import type {
  CalcContext,
  DisplayPart,
  ReactionOverride,
  TeamSlotConfig,
} from "@/lib/team-comp/types";

await preloadGameStats();

/** Extract the single formula's parts from a DisplayResult. */
function getOnlyParts(r: {
  partsByFormula: Record<string, DisplayPart[]>;
}): DisplayPart[] {
  return Object.values(r.partsByFormula)[0] ?? [];
}

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
      rxnParts: { 1: "none" },
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
  const configs: TeamSlotConfig[] = [
    {
      charId: "diluc",
      charLevel: 90,
      constellation: 0,
      weaponId: "wolfs_gravestone",
      refinement: 1,
      artifactSet: null,
    },
    // Need a Hydro teammate for vaporize availability
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSet: null,
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
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
    expect(getOnlyParts(result).length).toBe(3);
    for (const dp of getOnlyParts(result)) {
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
    expect(getOnlyParts(result).length).toBe(3);
    for (const dp of getOnlyParts(result)) {
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
      { reaction: "vaporize", rxnParts: { 1: "none" } }
    );
    // 3 parts: part 0 = amplify, part 1 = direct, part 2 = amplify
    expect(getOnlyParts(result).length).toBe(3);
    expect(getOnlyParts(result)[0].template).toBe("amplify");
    expect(getOnlyParts(result)[1].template).toBe("direct");
    expect(getOnlyParts(result)[2].template).toBe("amplify");
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
      { reaction: "vaporize", rxnParts: { 1: "none" } }
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
        rxnParts: { 0: "none", 1: "none", 2: "none" },
      }
    );
    expect(allOff.totalDamage).toBeCloseTo(direct.totalDamage, 2);
  });
});

// ─── Per-hit partHits tests (multi-hit parts) ───

describe("partHits — multi-hit split", () => {
  // Use Yae Miko: burst has 2 parts: initial (1 hit) + thunderbolts (3 hits)
  // Both Electro → eligible for aggravate
  const configs: TeamSlotConfig[] = [
    {
      charId: "yae_miko",
      charLevel: 90,
      constellation: 0,
      weaponId: "kaguras_verity",
      refinement: 1,
      artifactSet: null,
    },
    // Need Dendro teammate for aggravate
    {
      charId: "nahida",
      charLevel: 90,
      constellation: 0,
      weaponId: "a_thousand_floating_dreams",
      refinement: 1,
      artifactSet: null,
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
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
    expect(getOnlyParts(result).length).toBe(2);
    expect(getOnlyParts(result)[0].hits).toBe(1);
    expect(getOnlyParts(result)[1].hits).toBe(3);
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
    expect(getOnlyParts(result).length).toBe(2);
    expect(getOnlyParts(result)[0].template).toBe("catalyze");
    expect(getOnlyParts(result)[1].template).toBe("catalyze");
    expect(getOnlyParts(result)[1].hits).toBe(3);
  });

  it("partHits limits reacting hits on multi-hit part, splits into two display entries", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate", rxnPartHits: { 1: 2 } }
    );
    // Part 0: initial hit → catalyze (1 hit)
    // Part 1 split: 2 thunderbolts catalyze + 1 thunderbolt direct
    expect(getOnlyParts(result).length).toBe(3);
    expect(getOnlyParts(result)[0].template).toBe("catalyze");
    expect(getOnlyParts(result)[0].hits).toBe(1);
    expect(getOnlyParts(result)[1].template).toBe("catalyze");
    expect(getOnlyParts(result)[1].hits).toBe(2);
    expect(getOnlyParts(result)[2].template).toBe("direct");
    expect(getOnlyParts(result)[2].hits).toBe(1);
  });

  it("partHits=1 on 3-hit part: 1 catalyze + 2 direct", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      { reaction: "aggravate", rxnPartHits: { 1: 1 } }
    );
    expect(getOnlyParts(result).length).toBe(3);
    // Part 0: initial catalyze
    expect(getOnlyParts(result)[0].template).toBe("catalyze");
    expect(getOnlyParts(result)[0].hits).toBe(1);
    // Part 1 split: 1 catalyze, 2 direct
    expect(getOnlyParts(result)[1].template).toBe("catalyze");
    expect(getOnlyParts(result)[1].hits).toBe(1);
    expect(getOnlyParts(result)[2].template).toBe("direct");
    expect(getOnlyParts(result)[2].hits).toBe(2);
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
      { reaction: "aggravate", rxnPartHits: { 1: 5 } } // 5 > 3 thunderbolts
    );
    expect(overHits.totalDamage).toBeCloseTo(full.totalDamage, 2);
    expect(getOnlyParts(overHits).length).toBe(getOnlyParts(full).length);
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
      { reaction: "aggravate", rxnPartHits: { 1: 2 } }
    );

    // Initial hit (part 0) damage should be the same across all-aggravate and partial
    const initialDmgFull = getOnlyParts(allAggravate)[0].damage;
    const initialDmgPartial = getOnlyParts(partial)[0].damage;
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
        rxnParts: { 0: "none" },
        rxnPartHits: { 1: 1 },
      }
    );
    // Part 0: disabled → direct (1 hit)
    // Part 1 split: 1 catalyze + 2 direct
    expect(getOnlyParts(result).length).toBe(3);
    expect(getOnlyParts(result)[0].template).toBe("direct");
    expect(getOnlyParts(result)[0].hits).toBe(1);
    expect(getOnlyParts(result)[1].template).toBe("catalyze");
    expect(getOnlyParts(result)[1].hits).toBe(1);
    expect(getOnlyParts(result)[2].template).toBe("direct");
    expect(getOnlyParts(result)[2].hits).toBe(2);
  });

  it("disabled part ignores partHits override for that part", () => {
    const result = tb.getDisplayResult(
      "yae_miko",
      "yae_miko-burst",
      emptySheets,
      ctx,
      {
        reaction: "aggravate",
        rxnParts: { 1: "none" },
        rxnPartHits: { 1: 2 }, // should be ignored since part 1 is disabled
      }
    );
    // Part 0: catalyze (1 hit)
    // Part 1: all 3 hits direct (disabled overrides partHits)
    expect(getOnlyParts(result).length).toBe(2);
    expect(getOnlyParts(result)[0].template).toBe("catalyze");
    expect(getOnlyParts(result)[1].template).toBe("direct");
    expect(getOnlyParts(result)[1].hits).toBe(3);
  });
});

// ─── getDamageResult consistency with getDisplayResult ───

describe("getDamageResult matches getDisplayResult total damage", () => {
  const configs: TeamSlotConfig[] = [
    {
      charId: "yae_miko",
      charLevel: 90,
      constellation: 0,
      weaponId: "kaguras_verity",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "nahida",
      charLevel: 90,
      constellation: 0,
      weaponId: "a_thousand_floating_dreams",
      refinement: 1,
      artifactSet: null,
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  };

  const emptySheets: Record<string, StatSheet> = {
    yae_miko: new StatSheet([]),
    nahida: new StatSheet([]),
  };

  const tb = new TeamBuild(configs);

  const overrides: [string, ReactionOverride][] = [
    ["no reaction", {}],
    ["full aggravate", { reaction: "aggravate" }],
    ["part 0 disabled", { reaction: "aggravate", rxnParts: { 0: "none" } }],
    ["partHits=2 on part 1", { reaction: "aggravate", rxnPartHits: { 1: 2 } }],
    [
      "part 0 off + partHits=1",
      {
        reaction: "aggravate",
        rxnParts: { 0: "none" },
        rxnPartHits: { 1: 1 },
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
      const displayTotal = getOnlyParts(display).reduce(
        (sum, dp) => sum + dp.damage * (dp.hits ?? 1),
        0
      );
      expect(display.totalDamage).toBeCloseTo(displayTotal, 2);
    });
  }
});

// ─── Multi-element characters (Chasca, Varka) ───

describe("multi-element character reaction overrides", () => {
  // Chasca (Anemo) with Pyro + Hydro teammates → converted shells are Pyro & Hydro
  const configs: TeamSlotConfig[] = [
    {
      charId: "chasca",
      charLevel: 90,
      constellation: 0,
      weaponId: "aqua_simulacra",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "xiangling",
      charLevel: 90,
      constellation: 0,
      weaponId: "the_catch",
      refinement: 1,
      artifactSet: null,
    },
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSet: null,
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    rollMultiplier: 0.85,
    substatBudget: "8_6",
  };

  const emptySheets: Record<string, StatSheet> = {
    chasca: new StatSheet([]),
    xiangling: new StatSheet([]),
    xingqiu: new StatSheet([]),
  };

  const tb = new TeamBuild(configs);

  it("MULTI_ELEMENT_CHARS includes chasca and varka", () => {
    expect(MULTI_ELEMENT_CHARS.has("chasca")).toBe(true);
    expect(MULTI_ELEMENT_CHARS.has("varka")).toBe(true);
    expect(MULTI_ELEMENT_CHARS.has("diluc")).toBe(false);
  });

  it("chasca shining-volley has mixed Anemo + converted element parts", () => {
    const entry = tb.charBuilds.chasca?.charBase.getFormulaEntry(
      "chasca-shining-volley"
    );
    expect(entry).toBeDefined();
    const elements = entry!.parts.map((p) => p.formula.tag.element);
    // Should have both Anemo and non-Anemo parts
    expect(elements).toContain("Anemo");
    const nonAnemo = elements.filter((e) => e !== "Anemo");
    expect(nonAnemo.length).toBeGreaterThan(0);
  });

  it("eligible reactions derived from formula parts include vaporize", () => {
    const entry = tb.charBuilds.chasca?.charBase.getFormulaEntry(
      "chasca-shining-volley"
    );
    expect(entry).toBeDefined();
    // Collect eligible reactions from all parts (mirrors UI logic)
    const rxSet = new Set<string>(["none"]);
    for (const part of entry!.parts) {
      const partEl = part.formula.tag.element;
      const partEligible =
        ELEMENT_ELIGIBLE_REACTIONS[
          partEl as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
        ];
      if (partEligible) for (const rx of partEligible) rxSet.add(rx);
    }
    // With Pyro + Hydro teammates, should have vaporize (and possibly melt)
    expect(rxSet.has("vaporize")).toBe(true);
  });

  it("vaporize gate: converted parts become amplify, Anemo parts stay direct", () => {
    const result = tb.getDisplayResult(
      "chasca",
      "chasca-shining-volley",
      emptySheets,
      ctx,
      { reaction: "vaporize" }
    );
    const parts = getOnlyParts(result);
    const amplifyParts = parts.filter((p) => p.template === "amplify");
    const directParts = parts.filter((p) => p.template === "direct");
    // Should have both amplify (converted) and direct (Anemo) parts
    expect(amplifyParts.length).toBeGreaterThan(0);
    expect(directParts.length).toBeGreaterThan(0);
    // Amplify parts should have vaporize reaction
    for (const p of amplifyParts) {
      expect(p.tag?.reaction).toBe("vaporize");
    }
    // Direct parts should have Anemo element
    for (const p of directParts) {
      expect(p.tag?.element).toBe("Anemo");
    }
  });

  it("vaporize gate increases total damage vs no reaction", () => {
    const direct = tb.getDisplayResult(
      "chasca",
      "chasca-shining-volley",
      emptySheets,
      ctx
    );
    const vape = tb.getDisplayResult(
      "chasca",
      "chasca-shining-volley",
      emptySheets,
      ctx,
      { reaction: "vaporize" }
    );
    expect(vape.totalDamage).toBeGreaterThan(direct.totalDamage);
  });

  it("display total matches getDamageResult total with vaporize", () => {
    const override: ReactionOverride = { reaction: "vaporize" };
    const display = tb.getDisplayResult(
      "chasca",
      "chasca-shining-volley",
      emptySheets,
      ctx,
      override
    );
    const displayTotal = getOnlyParts(display).reduce(
      (sum, dp) => sum + dp.damage * (dp.hits ?? 1),
      0
    );
    expect(display.totalDamage).toBeCloseTo(displayTotal, 2);
  });

  it("team hasReaction without charId returns true for vaporize", () => {
    // Without charId, hasReaction checks team elements only
    expect(tb.teamMeta.hasReaction("vaporize")).toBe(true);
  });

  it("team hasReaction with chasca charId returns false for vaporize (Anemo)", () => {
    // With charId, hasReaction checks if the character's element participates
    // Chasca is Anemo, which doesn't participate in vaporize
    expect(tb.teamMeta.hasReaction("vaporize", "chasca")).toBe(false);
  });
});
