import {
  type ComboCountOverrides,
  type MinErOverrides,
  type TeamInvestment,
  buildEffectivePerChar,
  comboLineKey,
  deriveComboForAllocation,
  getEffectiveMinEr,
} from "@/lib/team-comp/analyzer";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import type {
  ComboDescriptor,
  ComboFormula,
  ComboLine,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

// ─── Helpers ───

/** Create a minimal mock TeamBuild that returns given descriptors per character. */
function mockTeamBuild(
  descriptors: Record<string, ComboDescriptor>
): TeamBuild {
  return {
    getComboDescriptor(charId: string): ComboDescriptor {
      return descriptors[charId] ?? [];
    },
  } as unknown as TeamBuild;
}

function makeLine(
  charId: string,
  formulaId: string,
  count: number,
  reaction?: ReactionOverride
): ComboLine {
  return { charId, formulaId, count, reaction };
}

function makeCombo(lines: ComboLine[]): ComboFormula {
  return { id: "test", label: { zh: "", en: "" }, lines };
}

function makeAllocation(
  entries: Record<string, { constellation: number }>
): TeamInvestment {
  const result: TeamInvestment = {};
  for (const [charId, { constellation }] of Object.entries(entries)) {
    result[charId] = {
      constellation,
      weaponId: "w1",
      refinement: 1,
      is5StarWeapon: false,
    };
  }
  return result;
}

// ─── comboLineKey ───

describe("comboLineKey", () => {
  it("returns formulaId for direct damage (no reaction)", () => {
    expect(comboLineKey("burst")).toBe("burst");
    expect(comboLineKey("burst", undefined)).toBe("burst");
    expect(comboLineKey("burst", {})).toBe("burst");
  });

  it("returns formulaId:reactionType for reaction lines", () => {
    expect(comboLineKey("burst", { reaction: "vaporize" })).toBe(
      "burst:vaporize"
    );
    expect(comboLineKey("skill", { reaction: "melt" })).toBe("skill:melt");
  });
});

// ─── deriveComboForAllocation ───

describe("deriveComboForAllocation", () => {
  it("uses template counts when no descriptor and no overrides", () => {
    const teamBuild = mockTeamBuild({});
    const combo = makeCombo([
      makeLine("charA", "burst", 3),
      makeLine("charA", "skill", 5),
    ]);
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    expect(result.lines[0].count).toBe(3);
    expect(result.lines[1].count).toBe(5);
  });

  it("uses descriptor counts (proportional) when no overrides", () => {
    const teamBuild = mockTeamBuild({
      charA: [
        { id: "burst", count: 2 },
        { id: "skill", count: 10 },
      ],
    });
    const combo = makeCombo([
      makeLine("charA", "burst", 3),
      makeLine("charA", "skill", 5),
    ]);
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    // burst: descriptor says 2, template says 3 — proportional: round(3/3 * 2) = 2
    expect(result.lines[0].count).toBe(2);
    // skill: descriptor says 10, template says 5 — proportional: round(5/5 * 10) = 10
    expect(result.lines[1].count).toBe(10);
  });

  it("applies constellation-dependent descriptor bonuses", () => {
    const teamBuild = mockTeamBuild({
      charA: [{ id: "burst", count: 3, bonus: [{ minC: 2, delta: 2 }] }],
    });
    const combo = makeCombo([makeLine("charA", "burst", 3)]);

    // At C0: descriptor = 3
    const resultC0 = deriveComboForAllocation(
      makeAllocation({ charA: { constellation: 0 } }),
      combo,
      teamBuild
    );
    expect(resultC0.lines[0].count).toBe(3);

    // At C2: descriptor = 3 + 2 = 5
    const resultC2 = deriveComboForAllocation(
      makeAllocation({ charA: { constellation: 2 } }),
      combo,
      teamBuild
    );
    expect(resultC2.lines[0].count).toBe(5);
  });

  it("applies combo overrides, taking priority over descriptor", () => {
    const teamBuild = mockTeamBuild({
      charA: [
        { id: "burst", count: 3 },
        { id: "skill", count: 5 },
      ],
    });
    const combo = makeCombo([
      makeLine("charA", "burst", 3),
      makeLine("charA", "skill", 5),
    ]);
    const allocation = makeAllocation({ charA: { constellation: 0 } });
    const overrides: ComboCountOverrides = {
      charA: { 0: { burst: 99 } },
    };

    const result = deriveComboForAllocation(
      allocation,
      combo,
      teamBuild,
      overrides
    );

    // burst: override = 99
    expect(result.lines[0].count).toBe(99);
    // skill: no override, uses descriptor = 5
    expect(result.lines[1].count).toBe(5);
  });

  it("override can set count to 0", () => {
    const teamBuild = mockTeamBuild({
      charA: [{ id: "burst", count: 5 }],
    });
    const combo = makeCombo([makeLine("charA", "burst", 5)]);
    const allocation = makeAllocation({ charA: { constellation: 0 } });
    const overrides: ComboCountOverrides = {
      charA: { 0: { burst: 0 } },
    };

    const result = deriveComboForAllocation(
      allocation,
      combo,
      teamBuild,
      overrides
    );

    expect(result.lines[0].count).toBe(0);
  });

  it("applies per-constellation overrides correctly", () => {
    const teamBuild = mockTeamBuild({
      charA: [{ id: "burst", count: 3 }],
    });
    const combo = makeCombo([makeLine("charA", "burst", 3)]);
    const overrides: ComboCountOverrides = {
      charA: {
        0: { burst: 1 },
        2: { burst: 10 },
      },
    };

    // C0 → override = 1
    const resultC0 = deriveComboForAllocation(
      makeAllocation({ charA: { constellation: 0 } }),
      combo,
      teamBuild,
      overrides
    );
    expect(resultC0.lines[0].count).toBe(1);

    // C1 → no override at C1, falls through to descriptor = 3
    const resultC1 = deriveComboForAllocation(
      makeAllocation({ charA: { constellation: 1 } }),
      combo,
      teamBuild,
      overrides
    );
    expect(resultC1.lines[0].count).toBe(3);

    // C2 → override = 10
    const resultC2 = deriveComboForAllocation(
      makeAllocation({ charA: { constellation: 2 } }),
      combo,
      teamBuild,
      overrides
    );
    expect(resultC2.lines[0].count).toBe(10);
  });

  it("handles reaction-keyed overrides (formulaId:reactionType)", () => {
    const teamBuild = mockTeamBuild({
      charA: [{ id: "burst", count: 6 }],
    });
    const combo = makeCombo([
      makeLine("charA", "burst", 3, { reaction: "vaporize" }),
      makeLine("charA", "burst", 3), // direct (no reaction)
    ]);
    const overrides: ComboCountOverrides = {
      charA: {
        0: {
          "burst:vaporize": 8, // override only the vaporize line
        },
      },
    };
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = deriveComboForAllocation(
      allocation,
      combo,
      teamBuild,
      overrides
    );

    // burst:vaporize → override = 8
    expect(result.lines[0].count).toBe(8);
    // burst (direct) → no override, proportional: round(3/6 * 6) = 3
    expect(result.lines[1].count).toBe(3);
  });

  it("distributes descriptor count proportionally across reaction variants", () => {
    const teamBuild = mockTeamBuild({
      charA: [{ id: "burst", count: 12 }],
    });
    // Template: burst split 1:3 between vaporize and direct
    const combo = makeCombo([
      makeLine("charA", "burst", 3, { reaction: "vaporize" }),
      makeLine("charA", "burst", 9), // direct
    ]);
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    // Proportional: vaporize = round(3/12 * 12) = 3, direct = round(9/12 * 12) = 9
    expect(result.lines[0].count).toBe(3);
    expect(result.lines[1].count).toBe(9);
  });

  it("handles multi-character teams", () => {
    const teamBuild = mockTeamBuild({
      charA: [{ id: "burst", count: 5 }],
      charB: [{ id: "skill", count: 8 }],
    });
    const combo = makeCombo([
      makeLine("charA", "burst", 3),
      makeLine("charB", "skill", 4),
    ]);
    const overrides: ComboCountOverrides = {
      charB: { 0: { skill: 2 } },
    };
    const allocation = makeAllocation({
      charA: { constellation: 0 },
      charB: { constellation: 0 },
    });

    const result = deriveComboForAllocation(
      allocation,
      combo,
      teamBuild,
      overrides
    );

    // charA burst: no override, descriptor = 5
    expect(result.lines[0].count).toBe(5);
    // charB skill: override = 2
    expect(result.lines[1].count).toBe(2);
  });

  it("per-variant overrides work independently for reaction splits", () => {
    const teamBuild = mockTeamBuild({
      charA: [{ id: "burst", count: 6 }],
    });
    // Template splits burst into vaporize (2) and direct (4)
    const combo = makeCombo([
      makeLine("charA", "burst", 2, { reaction: "vaporize" }),
      makeLine("charA", "burst", 4), // direct
    ]);
    // Grid stores per-variant overrides using comboLineKey
    const overrides: ComboCountOverrides = {
      charA: {
        0: {
          "burst:vaporize": 5, // override vaporize variant
          burst: 8, // override direct variant (lineKey = formulaId)
        },
      },
    };
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = deriveComboForAllocation(
      allocation,
      combo,
      teamBuild,
      overrides
    );

    // vaporize: lineKey-specific override = 5
    expect(result.lines[0].count).toBe(5);
    // direct: lineKey "burst" override = 8
    expect(result.lines[1].count).toBe(8);
  });

  it("preserves reaction overrides on the derived lines", () => {
    const teamBuild = mockTeamBuild({});
    const reaction: ReactionOverride = {
      reaction: "vaporize",
      partReactions: { 0: "none" },
      partHits: { 1: 3 },
    };
    const combo = makeCombo([makeLine("charA", "burst", 5, reaction)]);
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    expect(result.lines[0].reaction).toEqual(reaction);
  });
});

// ─── getEffectiveMinEr ───

describe("getEffectiveMinEr", () => {
  it("returns 1.0 when no perChar and no overrides", () => {
    expect(getEffectiveMinEr("charA", 0)).toBe(1.0);
  });

  it("returns base perChar value when no override", () => {
    const perChar = { charA: { minEr: 1.4, minCr: 0 } };
    expect(getEffectiveMinEr("charA", 0, perChar)).toBe(1.4);
  });

  it("per-constellation override takes priority over perChar", () => {
    const perChar = { charA: { minEr: 1.4, minCr: 0 } };
    const overrides: MinErOverrides = { charA: { 0: 1.8 } };
    expect(getEffectiveMinEr("charA", 0, perChar, overrides)).toBe(1.8);
  });

  it("different constellations can have different overrides", () => {
    const perChar = { charA: { minEr: 1.3, minCr: 0 } };
    const overrides: MinErOverrides = { charA: { 0: 1.6, 2: 1.2 } };

    expect(getEffectiveMinEr("charA", 0, perChar, overrides)).toBe(1.6);
    expect(getEffectiveMinEr("charA", 1, perChar, overrides)).toBe(1.3); // no override at C1
    expect(getEffectiveMinEr("charA", 2, perChar, overrides)).toBe(1.2);
  });
});

// ─── buildEffectivePerChar ───

describe("buildEffectivePerChar", () => {
  it("returns original perChar when no minEr overrides", () => {
    const perChar = { charA: { minEr: 1.3, minCr: 0.5 } };
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    expect(buildEffectivePerChar(allocation, perChar)).toBe(perChar);
    expect(buildEffectivePerChar(allocation, perChar, {})).toBe(perChar);
  });

  it("applies per-constellation minEr overrides", () => {
    const perChar = {
      charA: { minEr: 1.3, minCr: 0.5 },
      charB: { minEr: 1.4, minCr: 0.3 },
    };
    const overrides: MinErOverrides = {
      charA: { 2: 1.0 },
    };
    const allocation = makeAllocation({
      charA: { constellation: 2 },
      charB: { constellation: 0 },
    });

    const result = buildEffectivePerChar(allocation, perChar, overrides)!;

    // charA at C2: override = 1.0
    expect(result.charA.minEr).toBe(1.0);
    expect(result.charA.minCr).toBe(0.5); // preserved from perChar
    // charB at C0: no override, uses base
    expect(result.charB.minEr).toBe(1.4);
    expect(result.charB.minCr).toBe(0.3);
  });

  it("returns 1.0 default for characters missing from perChar", () => {
    const overrides: MinErOverrides = { charA: { 0: 1.5 } };
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = buildEffectivePerChar(allocation, undefined, overrides)!;

    expect(result.charA.minEr).toBe(1.5);
    expect(result.charA.minCr).toBe(0);
  });
});
