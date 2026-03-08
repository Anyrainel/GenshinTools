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
import { cbs } from "../helpers";
import type { OptionDef } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ None Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("skirk")
class Skirk extends CharacterBase {
  // Death's Crossing stacks: 1 per Hydro teammate + 1 per non-Skirk Cryo teammate (max 3)
  private readonly deathCrossingStacks = Math.min(
    this.teamMeta.countByElement("Hydro") +
      Math.max(0, this.teamMeta.countByElement("Cryo") - 1),
    3
  );

  // P3: +1 E level when all party members are Hydro or Cryo (≥1 of each)
  private readonly hasP3 = (() => {
    const elements = Object.values(this.teamMeta.elements).filter(
      (e) => e != null
    );
    return (
      elements.length > 0 &&
      elements.every((e) => e === "Hydro" || e === "Cryo") &&
      elements.some((e) => e === "Hydro")
    );
  })();

  readonly buffs = (() => {
    const stacks = this.deathCrossingStacks;
    const buffs: InstanceType<typeof StatBuff>[] = [];

    // P2: Normal ATK in E-mode: 110%/120%/170% of original → +10%/+20%/+70%
    // P2: Burst: 105%/115%/160% of original → +5%/+15%/+60%
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

    // C2: After Havoc: Extinction (E-mode Q), ATK +70% for 12.5s
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.7 },
        ])
      );
    }

    // C4: Death's Crossing also grants ATK +10%/20%/40% (total at 1/2/3 stacks)
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
  // Q Burst: 5×slash + final slash + subtlety bonus (12 pts, C2: 22 pts)
  protected readonly formulaMap = (() => {
    const hasC5 = this.constellation >= 5;
    const p3 = this.hasP3;
    // E level: base 10 (C5→13) + 1 if P3 active
    // Per-hit multipliers for E Normal Attack sequence
    const n1 = hasC5 ? (p3 ? 3.367 : 3.182) : p3 ? 2.811 : 2.626;
    const n2 = hasC5 ? (p3 ? 3.037 : 2.87) : p3 ? 2.535 : 2.368;
    const n3 = hasC5 ? (p3 ? 1.919 : 1.814) : p3 ? 1.603 : 1.497;
    const n4 = hasC5 ? (p3 ? 2.042 : 1.929) : p3 ? 1.704 : 1.592;
    const n5 = hasC5 ? (p3 ? 4.984 : 4.71) : p3 ? 4.161 : 3.887;
    // CA: per-hit multiplier (×3 hits)
    const caHit = hasC5 ? (p3 ? 1.129 : 1.067) : p3 ? 0.943 : 0.881;
    // C2 "Into the Abyss": +10 extra subtlety points counted for Q DMG bonus (cap 22 total)
    const hasC2 = this.constellation >= 2;
    const hasC3 = this.constellation >= 3; // C3 upgrades Q level
    // Q per-part multipliers
    const qSlash = hasC3 ? 2.609 : 2.21;
    const qFinal = hasC3 ? 4.348 : 3.683;
    const subtletyPts = hasC2 ? 22 : 12;
    const subtletyPerPt = hasC3 ? 0.4106 : 0.3478;
    const subtletyBonus = subtletyPts * subtletyPerPt;
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
        label: {
          zh: "E普攻5段",
          en: "E NA Combo (5-hit)",
        },
        parts: [
          { formula: new DirectFormula(n1, cryoNormal) },
          { formula: new DirectFormula(n2, cryoNormal) },
          { formula: new DirectFormula(n3, cryoNormal), hits: 2 },
          { formula: new DirectFormula(n4, cryoNormal), hits: 2 },
          { formula: new DirectFormula(n5, cryoNormal) },
        ],
      },
      "skirk-e-charge": {
        label: {
          zh: "E重击",
          en: "E CA",
        },
        parts: [
          {
            formula: new DirectFormula(caHit, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
      "skirk-burst": {
        label: {
          zh: "Q伤害",
          en: "Q",
        },
        parts: [
          { formula: new DirectFormula(qSlash, cryoBurst), hits: 5 },
          { formula: new DirectFormula(qFinal, cryoBurst) },
          { formula: new DirectFormula(subtletyBonus, cryoBurst) },
        ],
      },
      // C1: Each Void Rift absorbed summons a crystal blade (500% ATK Cryo, CA DMG)
      // Number of blades = deathCrossingStacks (Hydro/Cryo teammates, max 3)
      ...(this.constellation >= 1 && this.deathCrossingStacks > 0
        ? {
            "skirk-c1-blade": {
              label: {
                zh: `1命 水晶刀×${this.deathCrossingStacks}`,
                en: `C1 Crystal Blade ×${this.deathCrossingStacks}`,
              },
              parts: [
                {
                  formula: new DirectFormula(5.0, {
                    element: "Cryo",
                    ability: "charge",
                    reaction: "none",
                  }),
                  hits: this.deathCrossingStacks,
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("aloy")
class Aloy extends CharacterBase {
  // No constellations available — collab-exclusive character
  readonly buffs = [
    // P1: Self ATK +16% when gaining Coil, other party members ATK +8% (10s)
    // Team-wide +8%, then self gets additional +8% (delta) = 16% total for Aloy
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "self" }, [
      { key: "atk%", value: 0.08 },
    ]),
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "team" }, [
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
          formula: new DirectFormula(6.47, {
            element: "Cryo",
            ability: "burst",
            reaction: "none",
          }),
        },
      ],
    },
  };
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

  // Q Gust Surge: 8 ticks x 145% Anemo DMG (Lv10), 172% (Lv13 C3+)
  // Q Absorbed element: 8 ticks x 44.6% (Lv10) / 52.7% (Lv13 C3+)
  protected readonly formulaMap = (() => {
    const qTick = this.constellation >= 3 ? 1.72 : 1.45;
    const absorbTick = this.constellation >= 3 ? 0.527 : 0.446;
    const anemoBurst = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    const formulas: Record<string, FormulaEntry> = {
      "traveler-anemo-burst": {
        label: { zh: "Q伤害×8", en: "Q (×8)" },
        parts: [{ formula: new DirectFormula(qTick, anemoBurst), hits: 8 }],
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
          { formula: new DirectFormula(qTick, anemoBurst), hits: 8 },
          {
            formula: new DirectFormula(absorbTick, {
              element: el,
              ability: "burst",
              reaction: "none",
            }),
            hits: 8,
          },
        ],
      };
    }
    return formulas;
  })();
}

// Traveler (Geo)
// P3 cross-resonance: Geo resonance -> self +20% DEF
// C1: Party within Wake of Earth gets +10% CRIT Rate
@RegisterCharacter("traveler_geo")
class TravelerGeo extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff>[] = [
    // P3 cross-resonance: all elements Traveler has resonated with
    ...travelerP3Buffs(this),
    // C1: Inside Wake of Earth, party CRIT Rate +10%
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["Q"]), { receiver: "team" }, [
            { key: "cr", value: 0.1 },
          ]),
        ]
      : []),
  ];

  // E Starfell Sword: 446% Geo DMG (Lv10), 527% (Lv13 C5+)
  // Q Wake of Earth: 266% per shockwave x 4 (Lv10), 314% x 4 (Lv13 C3+)
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 5.27 : 4.46;
    const qTick = this.constellation >= 3 ? 3.14 : 2.66;
    return {
      "traveler-geo-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Geo",
              ability: "skill",
              reaction: "none",
            }),
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
            formula: new DirectFormula(qTick, {
              element: "Geo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 4,
          },
        ],
      },
    };
  })();
}

// Traveler (Electro)
// E: Abundance Amulets grant ER +20% to absorbing party members
// P2: Increases amulet ER bonus by 10% of Traveler's ER
// P3 cross-resonance: Electro resonance -> self +20% ER
// C2: Falling Thunder hits -> enemies Electro RES -15%
@RegisterCharacter("traveler_electro")
class TravelerElectro extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
    // E: Abundance Amulets grant ER +20% to absorbing characters (team utility)
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "team" }, [
      { key: "er", value: 0.2 },
    ]),
    // P2: Increases amulet ER bonus by 10% of Traveler's ER
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "team" },
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
    const eHit = this.constellation >= 5 ? 1.67 : 1.42;
    const qInitial = this.constellation >= 3 ? 2.431 : 2.059;
    const qTick = this.constellation >= 3 ? 0.697 : 0.59;
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
            formula: new DirectFormula(eHit, {
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
          { formula: new DirectFormula(qInitial, electroBurst) },
          { formula: new DirectFormula(qTick, electroBurst), hits: 12 },
        ],
      },
    };
  })();
}

// Traveler (Dendro)
// P1: Lea Lotus Lamp grants on-field character EM +6/s, max 10 stacks = +60 EM
// P2: Every point of Traveler's EM -> E DMG +0.15%, Q DMG +0.1%
// P3 cross-resonance: Dendro resonance -> self +60 EM
// C6: Lotuslight Transfiguration → +12% DMG for corresponding element
@RegisterCharacter("traveler_dendro")
class TravelerDendro extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Lea Lotus Lamp - Overflowing Lotuslight (max 10 stacks) -> on-field char +60 EM
      new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "onField" }, [
        { key: "em", value: 60 },
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
              { receiver: "onField", filter: { elements: ["Dendro"] } },
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
            { receiver: "onField", filter: { elements: [el] } },
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
    const eMult = this.constellation >= 3 ? 4.9 : 4.15;
    const qTick = this.constellation >= 5 ? 1.703 : 1.443;
    return {
      "traveler-dendro-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
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
            formula: new DirectFormula(qTick, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 12,
          },
        ],
      },
    };
  })();
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
    const eMult = this.constellation >= 3 ? 4.022 : 3.407;
    const qTick = this.constellation >= 5 ? 2.165 : 1.834;
    return {
      "traveler-hydro-skill": {
        label: {
          zh: "E伤害",
          en: "E",
        },
        parts: [
          {
            formula: new DirectFormula(eMult, {
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
            formula: new DirectFormula(qTick, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 4,
          },
        ],
      },
    };
  })();
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
          new StatBuff(cbs(this, "C1", ["E"]), { receiver: "onField" }, [
            { key: "dmg%", value: 0.06 },
          ]),
        ]
      : []),
    // C1: If on-field character is in Nightsoul's Blessing, +9% more DMG
    // Traveler Pyro enters Nightsoul's Blessing via own E, so self qualifies too
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["E"]), { receiver: "selfOnField" }, [
            { key: "dmg%", value: 0.09 },
          ]),
          new StatBuff(
            cbs(this, "C1", ["E"]),
            { receiver: "onField", regions: ["Natlan"] },
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
    const eTick = this.constellation >= 3 ? 0.597 : 0.505;
    const qMult = this.constellation >= 5 ? 9.078 : 7.69;
    return {
      "traveler-pyro-skill": {
        label: {
          zh: "E伤害×12",
          en: "E (×12)",
        },
        parts: [
          {
            formula: new DirectFormula(eTick, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 12,
          },
        ],
      },
      "traveler-pyro-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

function manekinFormulas(element: Element) {
  // All 14 variants (7 elements × 2 genders) share an identical kit:
  // - No constellations
  // - P2: Off-field ER regen (utility, no damage)
  // - P3: Random cosmetic change (no combat effect)
  const tag = (ability: "skill" | "burst") =>
    ({ element, ability, reaction: "none" as const }) as const;
  return {
    // - E: 241.9% single hit of own element (2 charges)
    "manekin-skill": {
      label: { zh: "E伤害", en: "E" },
      parts: [{ formula: new DirectFormula(2.419, tag("skill")) }],
    },
    // - Q: 583.2% summon hit + 50.4% per trespass (0.5s ICD, 8s duration → 16 ticks)
    "manekin-burst": {
      label: { zh: "Q生成+踏入×16", en: "Q Summon + Trespass ×16" },
      parts: [
        { formula: new DirectFormula(5.832, tag("burst")) },
        { formula: new DirectFormula(0.504, tag("burst")), hits: 16 },
      ],
    },
    // - P1: When leaving field with Q active, Restricted Area explodes for 200% ATK
    "manekin-p1-explosion": {
      label: { zh: "P1 Q爆炸", en: "P1 Q Explosion" },
      parts: [{ formula: new DirectFormula(2.0, tag("burst")) }],
    },
  };
}

@RegisterCharacter("manekin_anemo")
class ManekinAnemo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Anemo");
}

@RegisterCharacter("manekin_cryo")
class ManekinCryo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Cryo");
}

@RegisterCharacter("manekin_dendro")
class ManekinDendro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Dendro");
}

@RegisterCharacter("manekin_electro")
class ManekinElectro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Electro");
}

@RegisterCharacter("manekin_geo")
class ManekinGeo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Geo");
}

@RegisterCharacter("manekin_hydro")
class ManekinHydro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Hydro");
}

@RegisterCharacter("manekin_pyro")
class ManekinPyro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Pyro");
}

@RegisterCharacter("manekina_anemo")
class ManekinaAnemo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Anemo");
}

@RegisterCharacter("manekina_cryo")
class ManekinaCryo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Cryo");
}

@RegisterCharacter("manekina_dendro")
class ManekinaDendro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Dendro");
}

@RegisterCharacter("manekina_electro")
class ManekinaElectro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Electro");
}

@RegisterCharacter("manekina_geo")
class ManekinaGeo extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Geo");
}

@RegisterCharacter("manekina_hydro")
class ManekinaHydro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Hydro");
}

@RegisterCharacter("manekina_pyro")
class ManekinaPyro extends CharacterBase {
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = manekinFormulas("Pyro");
}
