import { describe, expect, it } from "vitest";
import type { ReactionType } from "@/data/enums";
import { resolveComboDescriptor } from "@/lib/dmgcalc/core/combo";
import type { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { ReactionComboGridRow } from "@/lib/dmgcalc/core/teamFormulaCatalog";
import { MULTI_CONTRIBUTOR_REACTIONS } from "@/lib/dmgcalc/core/teamReaction";
import type {
  ComboFormula,
  ComboLine,
  ComboTemplate,
  ReactionComboEntry,
  ReactionOverride,
} from "@/lib/dmgcalc/types";
import {
  buildEffectivePerChar,
  comboLineKey,
  comboOverrideKey,
  deriveComboForAllocation,
  getEffectiveMinEr,
  minErOverrideKey,
  rxCharOverrideKey,
  rxDeltaOverrideKey,
} from "@/lib/team-comp/analyzer/analyzer";
import type {
  ComboCountOverrides,
  MinErOverrides,
  TeamInvestment,
} from "@/lib/team-comp/analyzer/types";

/** Create a minimal mock TeamBuild that returns given descriptors per character. */
function mockTeamBuild(
  descriptors: Record<string, ComboTemplate>,
  rxOpts?: {
    rxDescriptor?: ReactionComboEntry[];
    guessOnFieldChar?: (formulaId: string) => string | undefined;
  }
): TeamBuild {
  const rxDesc = rxOpts?.rxDescriptor ?? [];
  return {
    catalog: {
      resolveCombo(
        charId: string,
        constellation: number
      ): Record<string, number> {
        const desc = descriptors[charId] ?? [];
        return resolveComboDescriptor(desc, constellation);
      },
      formulaIndex: new Map(
        rxDesc.flatMap((e) =>
          e.eligible.map(
            (c) =>
              [`${e.id}-${c}`, { statsCharId: c }] as [
                string,
                { statsCharId: string },
              ]
          )
        )
      ),
      getReactionComboGrid: (): ReactionComboGridRow[] =>
        rxDesc.map((e) => {
          const baseReaction = e.id.startsWith("rx-")
            ? e.id.slice(3)
            : undefined;
          const isMulti =
            baseReaction != null &&
            MULTI_CONTRIBUTOR_REACTIONS.has(baseReaction as ReactionType);
          const counts: Record<string, number> = {};
          for (const c of e.eligible) counts[c] = 0;
          if (e.eligible.length > 0) {
            counts[e.onFieldCharId] = Math.max(
              0,
              e.total - (e.eligible.length - 1)
            );
            for (const c of e.eligible) {
              if (c !== e.onFieldCharId) counts[c] = 1;
            }
          }
          return {
            baseId: e.id,
            label: { en: e.id, zh: e.id },
            isMultiContributor: isMulti,
            onFieldCharId: e.onFieldCharId,
            baseTotal: e.total,
            counts,
            eligible: new Set(e.eligible),
            bonus: e.bonus,
          };
        }),
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

// ─── comboOverrideKey / minErOverrideKey ───

describe("override key builders", () => {
  it("comboOverrideKey builds flat key", () => {
    expect(comboOverrideKey("charA", 0, "burst")).toBe("charA|0|burst");
    expect(comboOverrideKey("charA", 2, "burst:vaporize")).toBe(
      "charA|2|burst:vaporize"
    );
  });

  it("minErOverrideKey builds flat key", () => {
    expect(minErOverrideKey("charA", 0)).toBe("charA|0");
    expect(minErOverrideKey("charB", 6)).toBe("charB|6");
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
      [comboOverrideKey("charA", 0, "burst")]: 99,
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
      [comboOverrideKey("charA", 0, "burst")]: 0,
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
      [comboOverrideKey("charA", 0, "burst")]: 1,
      [comboOverrideKey("charA", 2, "burst")]: 10,
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
      [comboOverrideKey("charA", 0, "burst:vaporize")]: 8,
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
      [comboOverrideKey("charB", 0, "skill")]: 2,
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
      [comboOverrideKey("charA", 0, "burst:vaporize")]: 5,
      [comboOverrideKey("charA", 0, "burst")]: 8,
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
      rxnParts: { 0: "none" },
      rxnPartHits: { 1: 3 },
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
    const overrides: MinErOverrides = {
      [minErOverrideKey("charA", 0)]: 1.8,
    };
    expect(getEffectiveMinEr("charA", 0, perChar, overrides)).toBe(1.8);
  });

  it("different constellations can have different overrides", () => {
    const perChar = { charA: { minEr: 1.3, minCr: 0 } };
    const overrides: MinErOverrides = {
      [minErOverrideKey("charA", 0)]: 1.6,
      [minErOverrideKey("charA", 2)]: 1.2,
    };

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
      [minErOverrideKey("charA", 2)]: 1.0,
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
    const overrides: MinErOverrides = {
      [minErOverrideKey("charA", 0)]: 1.5,
    };
    const allocation = makeAllocation({ charA: { constellation: 0 } });

    const result = buildEffectivePerChar(allocation, undefined, overrides)!;

    expect(result.charA.minEr).toBe(1.5);
    expect(result.charA.minCr).toBe(0);
  });
});

// Analyzer override keys — rxCharOverrideKey / rxDeltaOverrideKey

describe("rxCharOverrideKey", () => {
  it("builds _rx-char|{charId}|{formulaId} format", () => {
    expect(rxCharOverrideKey("flins", "rx-lunarCharged")).toBe(
      "_rx-char|flins|rx-lunarCharged"
    );
    expect(rxCharOverrideKey("linnea", "rx-lunarCrystallize")).toBe(
      "_rx-char|linnea|rx-lunarCrystallize"
    );
  });
});

describe("rxDeltaOverrideKey", () => {
  it("builds _rx-delta|{charId}|{formulaId} format", () => {
    expect(rxDeltaOverrideKey("linnea", "rx-lunarCrystallize")).toBe(
      "_rx-delta|linnea|rx-lunarCrystallize"
    );
    expect(rxDeltaOverrideKey("zibai", "rx-lunarCharged")).toBe(
      "_rx-delta|zibai|rx-lunarCharged"
    );
  });
});

// deriveComboForAllocation — rx- line expansion

describe("deriveComboForAllocation — rx- handling", () => {
  it("resolves per-triggerer rx- template lines with correct counts", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCrystallize",
        total: 15,
        eligible: ["linnea", "columbina"],
        onFieldCharId: "linnea",
        bonus: [],
      },
    ];
    const teamBuild = mockTeamBuild(
      {},
      { rxDescriptor, guessOnFieldChar: () => "linnea" }
    );
    const combo = makeCombo([
      makeLine("linnea", "rx-lunarCrystallize-linnea", 15),
      makeLine("columbina", "rx-lunarCrystallize-columbina", 1),
    ]);
    const allocation = makeAllocation({
      linnea: { constellation: 0 },
      columbina: { constellation: 0 },
    });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    expect(
      result.lines.find((l) => l.formulaId === "rx-lunarCrystallize-linnea")!
        .count
    ).toBe(14);
    expect(
      result.lines.find((l) => l.formulaId === "rx-lunarCrystallize-columbina")!
        .count
    ).toBe(1);
  });

  it("default: per-character counts from descriptor", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCharged",
        total: 9,
        eligible: ["flins", "columbina", "zibai"],
        onFieldCharId: "flins",
        bonus: [],
      },
    ];
    const teamBuild = mockTeamBuild(
      {},
      { rxDescriptor, guessOnFieldChar: () => "flins" }
    );
    const combo = makeCombo([
      makeLine("flins", "rx-lunarCharged-flins", 7),
      makeLine("columbina", "rx-lunarCharged-columbina", 1),
      makeLine("zibai", "rx-lunarCharged-zibai", 1),
    ]);
    const allocation = makeAllocation({
      flins: { constellation: 0 },
      columbina: { constellation: 0 },
      zibai: { constellation: 0 },
    });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    expect(
      result.lines.find((l) => l.formulaId === "rx-lunarCharged-flins")!.count
    ).toBe(7);
    expect(
      result.lines.find((l) => l.formulaId === "rx-lunarCharged-columbina")!
        .count
    ).toBe(1);
    expect(
      result.lines.find((l) => l.formulaId === "rx-lunarCharged-zibai")!.count
    ).toBe(1);
  });

  it("rxCharOverrideKey redistributes counts across characters", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCharged",
        total: 9,
        eligible: ["flins", "columbina"],
        onFieldCharId: "flins",
        bonus: [],
      },
    ];
    const teamBuild = mockTeamBuild(
      {},
      { rxDescriptor, guessOnFieldChar: () => "flins" }
    );
    const combo = makeCombo([
      makeLine("flins", "rx-lunarCharged-flins", 8),
      makeLine("columbina", "rx-lunarCharged-columbina", 1),
    ]);
    const allocation = makeAllocation({
      flins: { constellation: 0 },
      columbina: { constellation: 0 },
    });
    const overrides: ComboCountOverrides = {
      [rxCharOverrideKey("flins", "rx-lunarCharged")]: 5,
      [rxCharOverrideKey("columbina", "rx-lunarCharged")]: 4,
    };

    const result = deriveComboForAllocation(
      allocation,
      combo,
      teamBuild,
      overrides
    );

    expect(
      result.lines.find((l) => l.formulaId === "rx-lunarCharged-flins")!.count
    ).toBe(5);
    expect(
      result.lines.find((l) => l.formulaId === "rx-lunarCharged-columbina")!
        .count
    ).toBe(4);
  });

  it("rxDeltaOverrideKey changes the delta value", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCrystallize",
        total: 15,
        eligible: ["linnea"],
        onFieldCharId: "linnea",
        bonus: [{ charId: "linnea", minC: 2, delta: 12 }],
      },
    ];
    const teamBuild = mockTeamBuild(
      {},
      { rxDescriptor, guessOnFieldChar: () => "linnea" }
    );
    const combo = makeCombo([
      makeLine("linnea", "rx-lunarCrystallize-linnea", 15),
    ]);
    const allocation = makeAllocation({
      linnea: { constellation: 2 },
    });
    // Override delta from 12 to 20
    const overrides: ComboCountOverrides = {
      [rxDeltaOverrideKey("linnea", "rx-lunarCrystallize")]: 20,
    };

    const result = deriveComboForAllocation(
      allocation,
      combo,
      teamBuild,
      overrides
    );

    const rxLines = result.lines.filter((l) =>
      l.formulaId.startsWith("rx-lunarCrystallize")
    );
    expect(rxLines).toHaveLength(1);
    // base 15 + overridden delta 20 = 35
    expect(rxLines[0].count).toBe(35);
  });

  it("constellation gating: delta only applies when char meets minC", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCrystallize",
        total: 15,
        eligible: ["linnea"],
        onFieldCharId: "linnea",
        bonus: [{ charId: "linnea", minC: 2, delta: 12 }],
      },
    ];
    const teamBuild = mockTeamBuild(
      {},
      { rxDescriptor, guessOnFieldChar: () => "linnea" }
    );
    const combo = makeCombo([
      makeLine("linnea", "rx-lunarCrystallize-linnea", 15),
    ]);

    // C0: delta not applied
    const resultC0 = deriveComboForAllocation(
      makeAllocation({ linnea: { constellation: 0 } }),
      combo,
      teamBuild
    );
    expect(
      resultC0.lines.find((l) => l.formulaId === "rx-lunarCrystallize-linnea")!
        .count
    ).toBe(15);

    // C1: still not enough
    const resultC1 = deriveComboForAllocation(
      makeAllocation({ linnea: { constellation: 1 } }),
      combo,
      teamBuild
    );
    expect(
      resultC1.lines.find((l) => l.formulaId === "rx-lunarCrystallize-linnea")!
        .count
    ).toBe(15);

    // C2: delta kicks in → 15 + 12 = 27
    const resultC2 = deriveComboForAllocation(
      makeAllocation({ linnea: { constellation: 2 } }),
      combo,
      teamBuild
    );
    expect(
      resultC2.lines.find((l) => l.formulaId === "rx-lunarCrystallize-linnea")!
        .count
    ).toBe(27);
  });

  it("non-eligible characters are filtered out (no combo line emitted)", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCharged",
        total: 9,
        eligible: ["flins", "zibai"],
        onFieldCharId: "flins",
        bonus: [],
      },
    ];
    const teamBuild = mockTeamBuild(
      {},
      { rxDescriptor, guessOnFieldChar: () => "flins" }
    );
    // Template only has per-triggerer lines for eligible chars
    const combo = makeCombo([
      makeLine("flins", "rx-lunarCharged-flins", 8),
      makeLine("zibai", "rx-lunarCharged-zibai", 1),
    ]);
    const allocation = makeAllocation({
      flins: { constellation: 0 },
      zibai: { constellation: 0 },
      pyroChar: { constellation: 0 },
    });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    const rxLines = result.lines.filter((l) =>
      l.formulaId.startsWith("rx-lunarCharged")
    );
    for (const line of rxLines) {
      expect(line.count).toBeGreaterThan(0);
    }
    // flins gets 8, zibai gets 1, pyroChar not in descriptor → no line
    expect(
      rxLines.find((l) => l.formulaId === "rx-lunarCharged-flins")!.count
    ).toBe(8);
    expect(
      rxLines.find((l) => l.formulaId === "rx-lunarCharged-zibai")!.count
    ).toBe(1);
    expect(rxLines.map((l) => l.charId)).not.toContain("pyroChar");
  });

  it("rx- lines mixed with regular lines", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCharged",
        total: 9,
        eligible: ["charA"],
        onFieldCharId: "charA",
        bonus: [],
      },
    ];
    const teamBuild = mockTeamBuild(
      { charA: [{ id: "burst", count: 5 }] },
      { rxDescriptor, guessOnFieldChar: () => "charA" }
    );
    const combo = makeCombo([
      makeLine("charA", "burst", 3),
      makeLine("charA", "rx-lunarCharged-charA", 9),
    ]);
    const allocation = makeAllocation({
      charA: { constellation: 0 },
      charB: { constellation: 0 },
    });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    const burstLine = result.lines.find((l) => l.formulaId === "burst");
    expect(burstLine).toBeDefined();
    expect(burstLine!.count).toBe(5);

    const rxLines = result.lines.filter(
      (l) => l.formulaId === "rx-lunarCharged-charA"
    );
    expect(rxLines).toHaveLength(1);
    expect(rxLines[0].charId).toBe("charA");
    expect(rxLines[0].count).toBe(9);
  });

  it("duplicate rx- template lines are deduplicated (only first emits)", () => {
    const rxDescriptor: ReactionComboEntry[] = [
      {
        id: "rx-lunarCharged",
        total: 9,
        eligible: ["flins"],
        onFieldCharId: "flins",
        bonus: [],
      },
    ];
    const teamBuild = mockTeamBuild(
      {},
      { rxDescriptor, guessOnFieldChar: () => "flins" }
    );
    const combo = makeCombo([
      makeLine("flins", "rx-lunarCharged-flins", 9),
      makeLine("flins", "rx-lunarCharged-flins", 9),
    ]);
    const allocation = makeAllocation({
      flins: { constellation: 0 },
    });

    const result = deriveComboForAllocation(allocation, combo, teamBuild);

    const rxLines = result.lines.filter(
      (l) => l.formulaId === "rx-lunarCharged-flins"
    );
    // Both lines get resolved count applied (9 each since only 1 eligible)
    expect(rxLines).toHaveLength(2);
    expect(rxLines[0].count).toBe(9);
  });
});
