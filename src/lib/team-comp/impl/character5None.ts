import type { Element } from "@/data/types";

import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarFormula,
  TransformFormula,
} from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef, TeamMeta } from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ None Characters
// ═══════════════════════════════════════════════════════════════

// Eligible elements for P1 虚境裂隙: Frozen(Hydro), Superconduct(Electro),
// Cryo Swirl(Anemo), Cryo Crystallize(Geo), plus other Cryo teammates
const skirkRiftEligible = (tm: TeamMeta): number =>
  tm.countByElement("Hydro") +
  Math.max(0, tm.countByElement("Cryo") - 1) + // exclude Skirk
  tm.countByElement("Electro") +
  tm.countByElement("Anemo") +
  tm.countByElement("Geo");

const skirkOption = {
  label: { zh: "虚境裂隙", en: "Void Rifts" },
  choices: [
    {
      value: "3",
      label: { zh: "3枚", en: "3 Rifts" },
      when: (tm) => skirkRiftEligible(tm) >= 3,
    },
    {
      value: "2",
      label: { zh: "2枚", en: "2 Rifts" },
      when: (tm) => skirkRiftEligible(tm) >= 2,
    },
    {
      value: "1",
      label: { zh: "1枚", en: "1 Rift" },
      when: (tm) => skirkRiftEligible(tm) >= 1,
    },
    { value: "0", label: { zh: "0枚", en: "0 Rifts" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("skirk", skirkOption)
class Skirk extends CharacterBase {
  private readonly riftCount = Number.parseInt(
    resolveOption(skirkOption, this.option)
  );

  // P2 死河渡断: 1 per Hydro teammate + 1 per non-Skirk Cryo teammate (max 3)
  // Always active (20s duration covers rotation)
  private readonly deathCrossingStacks = Math.min(
    this.teamMeta.countByElement("Hydro") +
      Math.max(0, this.teamMeta.countByElement("Cryo") - 1),
    3
  );

  // P3: +1 E level handled by CharacterBase._effectiveLevels via TeamMeta.talentPassiveBonuses()

  readonly buffs = (() => {
    const stacks = this.deathCrossingStacks;
    const riftCount = this.riftCount;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // P2 死河渡断: Normal ATK baseDmg% (110%/120%/170% → +10%/+20%/+70%)
    if (stacks > 0) {
      const normalPct = [0, 0.1, 0.2, 0.7][stacks];
      const burstPct = [0, 0.05, 0.15, 0.6][stacks];
      buffs.push(
        new StatBuff(
          cbs(this, "P2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [{ key: "baseDmg%", value: normalPct }]
        ),
        new StatBuff(
          cbs(this, "P2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "baseDmg%", value: burstPct }]
        )
      );
    }

    // Q 凋尽 "All Shall Wither": per-NA-hit baseDmg% from Extinction rift absorption
    // Q params 4-7: 0/1/2/3 rift absorption DMG bonus
    const witherPct = [
      this.param("Q", 4),
      this.param("Q", 5),
      this.param("Q", 6),
      this.param("Q", 7),
    ][riftCount];
    // "All Shall Wither" fires on each NA hit, canceled after 10 triggers
    // Self buff → modeled via formula hit counts, not maxStacks.
    buffs.push(
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["normal"] } },
        [{ key: "baseDmg%", value: witherPct }]
      )
    );

    // Q 蛇之狡谋 bonus: ATK per point over 50 → baseDmg for burst hits
    // Subtlety: 45 base + C2(10) + 8 per rift; bonus capped at 12 (C2: 22)
    const subtletyTotal =
      45 + (this.constellation >= 2 ? 10 : 0) + 8 * riftCount;
    const subtletyCap = this.constellation >= 2 ? 22 : 12;
    const subtletyBonusPts = Math.min(
      Math.max(subtletyTotal - 50, 0),
      subtletyCap
    );
    if (subtletyBonusPts > 0) {
      const subtletyPerPt = this.param("Q", 3);
      buffs.push(
        new ScalingBuff(
          cbs(this, this.constellation >= 2 ? "Q/C2" : "Q", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "atk",
          "baseDmg",
          subtletyBonusPts * subtletyPerPt
        )
      );
    }

    // C2: After 极恶技·尽 (Extinction), ATK +70% for 12.5s (all abilities)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.7 },
        ])
      );
    }

    // C4: Death's Crossing also grants ATK +10%/20%/40%
    if (this.constellation >= 4 && stacks > 0) {
      const c4Pct = [0, 0.1, 0.2, 0.4][stacks];
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: c4Pct },
        ])
      );
    }

    return buffs;
  })();

  // E Normal Combo: 5-hit (Lv10/11/13/14)
  //   N1: 262.6/281.1/318.2/336.7, N2: 236.8/253.5/287.0/303.7
  //   N3: 149.7×2/160.3×2/181.4×2/191.9×2, N4: 159.2×2/170.4×2/192.9×2/204.2×2
  //   N5: 388.7/416.1/471.0/498.4
  // E CA: 88.1×3/94.3×3/106.7×3/112.9×3
  // Q Burst: 5×slash + final slash
  protected readonly formulaMap = (() => {
    const riftCount = this.riftCount;
    const n1 = this.param("E", 1);
    const n2 = this.param("E", 2);
    const cryoNormal = {
      element: "Cryo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const cryoBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "skirk-e-normal": {
        label: { zh: "EQ后 普攻x5", en: "E+Q NA Combo (x5)" },
        parts: [
          { formula: new DirectFormula(n1, cryoNormal) },
          { formula: new DirectFormula(n2, cryoNormal) },
          {
            formula: new DirectFormula(this.param("E", 3), cryoNormal),
            hits: 2,
          },
          {
            formula: new DirectFormula(this.param("E", 5), cryoNormal),
            hits: 2,
          },
          { formula: new DirectFormula(this.param("E", 7), cryoNormal) },
        ],
      },
      "skirk-e-normal-2": {
        label: { zh: "EQ后 普攻x2", en: "E+Q NAx2" },
        parts: [
          { formula: new DirectFormula(n1, cryoNormal) },
          { formula: new DirectFormula(n2, cryoNormal) },
        ],
      },
      "skirk-e-charge": {
        label: { zh: "EQ后 重击", en: "E+Q CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 8), {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
      "skirk-burst": {
        label: { zh: "满蛇谋 Q", en: "Full Subtlety Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), cryoBurst),
            hits: 5,
          },
          { formula: new DirectFormula(this.param("Q", 2), cryoBurst) },
        ],
      },
      // C1: Each 虚境裂隙 absorbed → 晶刃 (500% ATK, Cryo, CA DMG)
      "skirk-c1-blade": {
        label: {
          zh: `晶刃×${riftCount || 1}`,
          en: `Crystal Blade ×${riftCount || 1}`,
        },
        minC: 1,
        when: riftCount > 0,
        parts: [
          {
            formula: new DirectFormula(5.0, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
            hits: riftCount || 1,
          },
        ],
      },
      // C6 极恶技·斩: burst coordinated (750% ATK per stack)
      "skirk-c6-burst-coord": {
        label: {
          zh: `Q协同×${riftCount || 1}`,
          en: `Q Coord ×${riftCount || 1}`,
        },
        minC: 6,
        when: riftCount > 0,
        parts: [
          {
            formula: new DirectFormula(7.5, cryoBurst),
            hits: riftCount || 1,
          },
        ],
      },
      // C6: N3/N5 trigger → 3 coordinated attacks each, max 2 triggers per combo
      "skirk-c6-normal-coord": {
        label: {
          zh: `普攻协同×${Math.min(riftCount || 1, 2) * 3}`,
          en: `NA Coord ×${Math.min(riftCount || 1, 2) * 3}`,
        },
        minC: 6,
        when: riftCount > 0,
        parts: [
          {
            formula: new DirectFormula(1.8, cryoNormal),
            hits: Math.min(riftCount || 1, 2) * 3,
          },
        ],
      },
    };
  })();

  // Rotation: tE > sQ (Extinction) > 4×N5D > 1 CA (rift absorb) > Q (Ruin) (freeze carry)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "skirk-e-normal", count: 4 },
      { id: "skirk-e-normal-2", count: 4 },
      { id: "skirk-e-charge", count: 3 },
      { id: "skirk-burst", count: 1 },
      { id: "skirk-c1-blade", count: 1 },
      { id: "skirk-c6-burst-coord", count: 1 },
      { id: "skirk-c6-normal-coord", count: 4 },
    ];
  }
}

@RegisterCharacter("aloy")
class Aloy extends CharacterBase {
  // No constellations available — collab-exclusive character
  readonly buffs = [
    // P1: Self ATK +16% when gaining Coil, other party members ATK +8% (10s)
    // "队伍中附近的其他角色" → receiver: "other"
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "self" }, [
      { key: "atk%", value: 0.16 },
    ]),
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "other" }, [
      { key: "atk%", value: 0.08 },
    ]),
    // P2: During Rushing Ice, Cryo DMG +3.5%/s for max 10s = +35%
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "selfOnField" }, [
      { key: "cryo%", value: 0.35 },
    ]),
  ];

  protected readonly formulaMap = {
    "aloy-burst": {
      label: { zh: "Q伤害", en: "Q" },
      parts: [
        {
          formula: new DirectFormula(this.param("Q", 1), {
            element: "Cryo",
            ability: "burst",
            reaction: "none",
          }),
        },
      ],
    },
  };

  // Rotation: E > Q (sub-DPS, minimal field time)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "aloy-burst", count: 1 }];
  }
}

// P3 cross-resonance: Traveler gains buffs for every element resonated with.
// All damage-affecting stats; DEF (+20%) is skipped per U9 (defense stat).
function travelerP3Buffs(self: CharacterBase): InstanceType<typeof StatBuff>[] {
  const src = cbs(self, "P3", ["passive"]);
  const tgt = { receiver: "self" as const };
  return [
    new StatBuff(src, tgt, [{ key: "cr", value: 0.1 }]), // Anemo
    new StatBuff(src, tgt, [{ key: "er", value: 0.2 }]), // Electro
    new StatBuff(src, tgt, [{ key: "em", value: 60 }]), // Dendro
    new StatBuff(src, tgt, [{ key: "hp%", value: 0.2 }]), // Hydro
    new StatBuff(src, tgt, [{ key: "atk%", value: 0.2 }]), // Pyro
    new StatBuff(src, tgt, [{ key: "cd", value: 0.2 }]), // Cryo
  ];
}

// Traveler (Anemo)
// P3 cross-resonance: Anemo resonance -> self +10% CRIT Rate
// C6: Enemies hit by Gust Surge have Anemo/absorbed element RES -20%
@RegisterCharacter("traveler_anemo")
class TravelerAnemo extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P3 cross-resonance: all elements Traveler has resonated with
      ...travelerP3Buffs(this),
      // C2: Energy Recharge +16%
      ...(this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", ["passive"]), { receiver: "self" }, [
              { key: "er", value: 0.16 },
            ]),
          ]
        : []),
      // C6: Enemies hit by Gust Surge have Anemo RES -20%
      ...(this.constellation >= 6
        ? [
            new StatBuff(
              cbs(this, "C6", ["Q"]),
              { receiver: "team", filter: { elements: ["Anemo"] } },
              [{ key: "resReduction%", value: 0.2 }]
            ),
          ]
        : []),
    ];
    // C6: Absorbed element also gets -20% RES (S10 pattern)
    if (this.constellation >= 6) {
      const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
      const teamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of absorbElements) {
        if (!teamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: [el] } },
            [{ key: "resReduction%", value: 0.2 }]
          )
        );
      }
    }
    return buffs;
  })();

  // E Palm Vortex: Press = cutting ticks + storm explosion; Hold = stronger versions
  // param1: Initial Cutting DMG, param2: Max Cutting DMG
  // param3: Initial Storm DMG, param4: Max Storm DMG
  // Q Gust Surge: 8 ticks Anemo + 8 ticks absorbed element
  // param1: Tornado DMG, param2: Additional Elemental DMG
  protected readonly formulaMap = (() => {
    const qTick = this.param("Q", 1);
    const absorbTick = this.param("Q", 2);
    const anemoSkill = {
      element: "Anemo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const anemoBurst = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    const formulas: Record<string, FormulaEntry> = {
      "traveler-anemo-skill-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), anemoSkill) },
          { formula: new DirectFormula(this.param("E", 3), anemoSkill) },
        ],
      },
      "traveler-anemo-skill-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), anemoSkill) },
          { formula: new DirectFormula(this.param("E", 4), anemoSkill) },
        ],
      },
      "traveler-anemo-burst": {
        label: { zh: "Q伤害×8", en: "Q (×8)" },
        parts: [
          {
            formula: new DirectFormula(qTick, anemoBurst),
            hits: 8,
            offField: true,
          },
        ],
      },
    };
    // Add absorbed-element variant formulas (S10 pattern)
    const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
    const teamEls = new Set(Object.values(this.teamMeta.elements));
    for (const el of absorbElements) {
      if (!teamEls.has(el)) continue;
      formulas[`traveler-anemo-burst-${el.toLowerCase()}`] = {
        label: {
          zh: `Q伤害×8+吸收(${el})`,
          en: `Q (×8) + Absorbed (${el})`,
        },
        parts: [
          {
            formula: new DirectFormula(qTick, anemoBurst),
            hits: 8,
            offField: true,
          },
          {
            formula: new DirectFormula(absorbTick, {
              element: el,
              ability: "burst",
              reaction: "none",
            }),
            hits: 8,
            offField: true,
          },
        ],
      };
    }
    return formulas;
  })();

  // Rotation: E (hold) > Q (Anemo support, quickswap)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "traveler-anemo-skill-hold", count: 1 },
      { id: "traveler-anemo-burst", count: 1 },
    ];
  }
}

// Traveler (Geo)
// P3 cross-resonance: Geo resonance -> self +20% DEF
// C1: Party within Wake of Earth gets +10% CRIT Rate
@RegisterCharacter("traveler_geo")
class TravelerGeo extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff>[] = [
    // P3 cross-resonance: all elements Traveler has resonated with
    ...travelerP3Buffs(this),
    // C1: Inside Wake of Earth, party CRIT Rate +10% (on-field only, requires proximity)
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["Q"]), { receiver: "teamOnField" }, [
            { key: "cr", value: 0.1 },
          ]),
        ]
      : []),
  ];

  // E Starfell Sword: 446% Geo DMG (Lv10), 527% (Lv13 C5+)
  // Q Wake of Earth: 266% per shockwave x 4 (Lv10), 314% x 4 (Lv13 C3+)
  protected readonly formulaMap = {
    "traveler-geo-skill": {
      label: { zh: "E伤害", en: "E" },
      parts: [
        {
          formula: new DirectFormula(this.param("E", 1), {
            element: "Geo",
            ability: "skill",
            reaction: "none",
          }),
          // C2: Meteorite explosion deals additional Geo DMG equal to Starfell Sword DMG
          hits: this.constellation >= 2 ? 2 : 1,
        },
      ],
    },
    "traveler-geo-burst": {
      label: {
        zh: "Q伤害×4",
        en: "Q (×4)",
      },
      parts: [
        {
          formula: new DirectFormula(this.param("Q", 1), {
            element: "Geo",
            ability: "burst",
            reaction: "none",
          }),
          hits: 4,
        },
      ],
    },
  };

  // Rotation: 3×E > Q (Geo sub-DPS, 6s CD with P1)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "traveler-geo-skill", count: 3 },
      { id: "traveler-geo-burst", count: 1 },
    ];
  }
}

// Traveler (Electro)
// E: Abundance Amulets grant ER +20% to absorbing party members
// P2: Increases amulet ER bonus by 10% of Traveler's ER
// P3 cross-resonance: Electro resonance -> self +20% ER
// C2: Falling Thunder hits -> enemies Electro RES -15%
@RegisterCharacter("traveler_electro")
class TravelerElectro extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
    // E: Abundance Amulets grant ER bonus to absorbing characters (E param4)
    // Amulets are pickup objects — only the on-field character can absorb them
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "teamOnField" }, [
      { key: "er", value: this.param("E", 4) },
    ]),
    // P2: Increases amulet ER bonus by 10% of Traveler's ER
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "teamOnField" },
      [],
      "er",
      "er",
      0.1
    ),
    // P3 cross-resonance: all elements Traveler has resonated with
    ...travelerP3Buffs(this),
    // C2: Falling Thunder hits -> Electro RES -15% for 8s
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["Q"]),
            { receiver: "team", filter: { elements: ["Electro"] } },
            [{ key: "resReduction%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  // E Lightning Blade: 142% per hit x 3 (Lv10), 167% x 3 (Lv13 C5+)
  // Q Bellowing Thunder: 205.9% initial + 59% per Falling Thunder x 12 (Lv10)
  // Q (C3+, Lv13): 243.1% initial + 69.7% x 12
  protected readonly formulaMap = (() => {
    const electroBurst = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "traveler-electro-skill": {
        label: { zh: "E伤害×3", en: "E (×3)" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
      "traveler-electro-burst": {
        label: {
          zh: "Q伤害×12",
          en: "Q (×12)",
        },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), electroBurst) },
          {
            formula: new DirectFormula(this.param("Q", 2), electroBurst),
            hits: 12,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (Electro battery/support, 13.5s CD)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "traveler-electro-skill", count: 1 },
      { id: "traveler-electro-burst", count: 1 },
    ];
  }
}

// Traveler (Dendro)
// P1: Lea Lotus Lamp grants on-field character EM +6/s, max 10 stacks = +60 EM
// P2: Every point of Traveler's EM -> E DMG +0.15%, Q DMG +0.1%
// P3 cross-resonance: Dendro resonance -> self +60 EM
// C6: Lotuslight Transfiguration → +12% DMG for corresponding element
const travelerDendroOption = {
  label: { zh: "莲光遍照", en: "Lotuslight" },
  choices: [
    { value: "60", label: { zh: "满层+60", en: "Max +60 EM" } },
    { value: "30", label: { zh: "均值+30", en: "Avg +30 EM" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("traveler_dendro", travelerDendroOption)
class TravelerDendro extends CharacterBase {
  private readonly lotusEM = Number.parseInt(
    resolveOption(travelerDendroOption, this.option)
  );
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Lea Lotus Lamp - Overflowing Lotuslight (max 10 stacks) -> on-field char EM
      // Ramps +6 EM/s over 10s; option selects max (60) or average (30)
      new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "teamOnField" }, [
        { key: "em", value: this.lotusEM },
      ]),
      // P2: Verdant Luxury — Traveler's own EM boosts E DMG by 0.15% per EM point
      new ScalingBuff(
        cbs(this, "P2", ["A4"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "em",
        "dmg%",
        0.0015
      ),
      // P2: Verdant Luxury — Traveler's own EM boosts Q DMG by 0.1% per EM point
      new ScalingBuff(
        cbs(this, "P2", ["A4"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "em",
        "dmg%",
        0.001
      ),
      // P3 cross-resonance: all elements Traveler has resonated with
      ...travelerP3Buffs(this),
      // C6: Lotuslight Transfiguration → +12% DMG for corresponding element
      // Base Dendro (when no transfiguration occurs)
      ...(this.constellation >= 6
        ? [
            new StatBuff(
              cbs(this, "C6", ["Q"]),
              { receiver: "teamOnField", filter: { elements: ["Dendro"] } },
              [{ key: "dmg%", value: 0.12 }]
            ),
          ]
        : []),
    ];
    // C6: Transfigured element also gets +12% DMG (S10 pattern: Hydro/Electro/Pyro)
    if (this.constellation >= 6) {
      const transfigElements = ["Hydro", "Electro", "Pyro"] as const;
      const teamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of transfigElements) {
        if (!teamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "teamOnField", filter: { elements: [el] } },
            [{ key: "dmg%", value: 0.12 }]
          )
        );
      }
    }
    return buffs;
  })();

  // E Razorgrass Blade: 415% Dendro (Lv10), 490% (Lv13 C3+)
  // Q Lea Lotus Lamp: 144.3% per tick x 12 (Lv10), 170.3% x 12 (Lv13 C5+)
  protected readonly formulaMap = (() => {
    return {
      "traveler-dendro-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-dendro-burst": {
        label: {
          zh: "Q伤害×12",
          en: "Q (×12)",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 12,
            offField: true,
          },
        ],
      },
      "traveler-dendro-burst-explosion": {
        label: {
          zh: "Q火幻变爆发",
          en: "Q Pyro Explosion",
        },
        when: this.teamMeta.countByElement("Pyro") > 0,
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: 2×E > Q (Dendro support, 8s CD)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "traveler-dendro-skill", count: 2 },
      { id: "traveler-dendro-burst", count: 1 },
    ];
  }
}

// Traveler (Hydro)
// P3 cross-resonance: Hydro resonance -> self +20% HP
// Primarily a self-sustain / utility character - no notable team buff passives
@RegisterCharacter("traveler_hydro")
class TravelerHydro extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff>[] = [
    // P3 cross-resonance: all elements Traveler has resonated with
    ...travelerP3Buffs(this),
  ];

  // E Aquacrest Saber (Torrent Surge): 340.7% Hydro (Lv10), 402.2% (Lv13 C3+)
  // Q Rising Waters: 183.4% per tick x 4 (Lv10), 216.5% x 4 (Lv13 C5+)
  protected readonly formulaMap = (() => {
    return {
      "traveler-hydro-skill": {
        label: {
          zh: "E伤害",
          en: "E",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      // E Spiritbreath Thorn (Pneuma-aligned Hydro DMG, fires after Torrent Surge)
      "traveler-hydro-thorn": {
        label: { zh: "E灵息之刺", en: "E Spiritbreath Thorn" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 3), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "traveler-hydro-burst": {
        label: { zh: "Q伤害×4", en: "Q (×4)" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 4,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: 2×E > Q (Hydro sub-DPS, 10s CD)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "traveler-hydro-skill", count: 2 },
      { id: "traveler-hydro-thorn", count: 2 },
      { id: "traveler-hydro-burst", count: 1 },
    ];
  }
}

// Traveler (Pyro)
// C1: While Blazing/Scorching Threshold active, on-field character deals +6% DMG
// P3 cross-resonance: Pyro resonance -> self +20% ATK
// C4: After Q Plains Scorcher, self +20% Pyro DMG% for 9s
// C6: During Nightsoul's Blessing, NA/CA/Plunge → Pyro + CD +40%
@RegisterCharacter("traveler_pyro")
class TravelerPyro extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff>[] = [
    // P3 cross-resonance: all elements Traveler has resonated with
    ...travelerP3Buffs(this),
    // C1: While Threshold active, on-field character deals +6% DMG
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["E"]), { receiver: "teamOnField" }, [
            { key: "dmg%", value: 0.06 },
          ]),
        ]
      : []),
    // C1: If on-field character is in Nightsoul's Blessing, +9% more DMG
    // Single teamOnField buff with Nightsoul faction filter covers all Nightsoul characters including Traveler Pyro
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["E"]),
            { receiver: "teamOnField", factions: ["Nightsoul"] },
            [{ key: "dmg%", value: 0.09 }]
          ),
        ]
      : []),
    // C4: After Q, self +20% Pyro DMG Bonus (火元素伤害加成)
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "selfOnField" }, [
            { key: "pyro%", value: 0.2 },
          ]),
        ]
      : []),
    // C6: During Nightsoul's Blessing, NA/CA/Plunge CRIT DMG +40%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E"]),
            {
              receiver: "selfOnField",
              filter: { abilities: ["normal", "charge", "plunge"] },
            },
            [{ key: "cd", value: 0.4 }]
          ),
        ]
      : []),
  ];

  // E Flowfire Blade (Blazing Threshold): 50.5% per tick x 12 (Lv10), 59.7% x 12 (Lv13 C3+)
  // Q Plains Scorcher: 769% Nightsoul-Pyro (Lv10), 907.8% (Lv13 C5+)
  protected readonly formulaMap = (() => {
    return {
      "traveler-pyro-skill": {
        label: {
          zh: "E伤害×12",
          en: "E (×12)",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 12,
            offField: true,
          },
        ],
      },
      "traveler-pyro-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      // Plunge (High): param11. Element is Physical normally, but C6 converts
      // NA/CA/Plunge to Pyro during Nightsoul's Blessing.
      "traveler-pyro-plunge": {
        label: {
          zh: "下落攻击(高空)",
          en: "Plunge (High)",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 11), {
              element: this.constellation >= 6 ? "Pyro" : "Physical",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: hE > Q > swap (off-field Pyro support)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "traveler-pyro-skill", count: 1 },
      { id: "traveler-pyro-burst", count: 1 },
    ];
  }
}

function manekinFormulas(
  param: (skill: "A" | "E" | "Q", paramIndex: number) => number,
  element: Element
) {
  // All 14 variants (7 elements × 2 genders) share an identical kit:
  // - No constellations
  // - P2: Off-field ER regen (utility, no damage)
  // - P3: Random cosmetic change (no combat effect)
  const tag = (ability: "skill" | "burst") =>
    ({ element, ability, reaction: "none" as const }) as const;
  return {
    // - E: single hit of own element (2 charges)
    "manekin-skill": {
      label: { zh: "E伤害", en: "E" },
      parts: [{ formula: new DirectFormula(param("E", 1), tag("skill")) }],
    },
    // - Q: summon hit + trespass per tick (0.5s ICD, 8s duration → 16 ticks)
    "manekin-burst": {
      label: { zh: "Q生成+踏入×16", en: "Q Summon + Trespass×16" },
      parts: [
        { formula: new DirectFormula(param("Q", 1), tag("burst")) },
        {
          formula: new DirectFormula(param("Q", 2), tag("burst")),
          hits: 16,
        },
      ],
    },
    // - P1: When leaving field with Q active, Restricted Area explodes for 200% ATK
    "manekin-p1-explosion": {
      label: { zh: "P1 Q爆炸", en: "P1 Q Explosion" },
      parts: [
        { formula: new DirectFormula(2.0, tag("burst")), offField: true },
      ],
    },
  };
}

// Manekin/Manekina rotation: 2×E (2 charges) > Q > swap (off-field support)
const manekinDefaultRotation: ComboDescriptor = [
  { id: "manekin-skill", count: 2 },
  { id: "manekin-burst", count: 1 },
  { id: "manekin-p1-explosion", count: 1 },
];

@RegisterCharacter("manekin_anemo")
class ManekinAnemo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Anemo"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekin_cryo")
class ManekinCryo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Cryo"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekin_dendro")
class ManekinDendro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Dendro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekin_electro")
class ManekinElectro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Electro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekin_geo")
class ManekinGeo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(this.param.bind(this), "Geo");
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekin_hydro")
class ManekinHydro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Hydro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekin_pyro")
class ManekinPyro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Pyro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekina_anemo")
class ManekinaAnemo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Anemo"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekina_cryo")
class ManekinaCryo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Cryo"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekina_dendro")
class ManekinaDendro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Dendro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekina_electro")
class ManekinaElectro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Electro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekina_geo")
class ManekinaGeo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(this.param.bind(this), "Geo");
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekina_hydro")
class ManekinaHydro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Hydro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}

@RegisterCharacter("manekina_pyro")
class ManekinaPyro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas(
    this.param.bind(this),
    "Pyro"
  );
  protected override get comboDescriptor(): ComboDescriptor {
    return manekinDefaultRotation;
  }
}
