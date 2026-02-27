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
// 5★ Sumeru Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("dehya")
class Dehya extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // C1: HP +20%, E DMG +3.6% Max HP (baseDmg), Q DMG +6% Max HP (baseDmg)
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(cbs(this, "C1", []), { receiver: "self" }, [
          { key: "hp%", value: 0.2 },
        ]),
        new ScalingBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [],
          "hp",
          "baseDmg",
          0.036
        ),
        new ScalingBuff(
          cbs(this, "C1", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "hp",
          "baseDmg",
          0.06
        )
      );
    }

    // C2: When active character in E field is attacked, next coordinated attack DMG +50%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    // C6: Leonine Bite CR +10%, after crits CD +15% × 4 stacks (max +60%)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.6 },
          ]
        )
      );
    }

    return buffs;
  })();

  // Q Leonine Bite: Flame-Mane's Fist ×10 + Incineration Drive ×1 (dual ATK+HP scaling)
  // Fist Lv10: 177.7% ATK + 3.05% HP, Lv13 (C3+): 209.7% ATK + 3.60% HP
  // Drive Lv10: 250.7% ATK + 4.30% HP, Lv13 (C3+): 296.0% ATK + 5.07% HP
  protected readonly formulaMap = (() => {
    const fistAtk = this.constellation >= 3 ? 2.097 : 1.777;
    const fistHp = this.constellation >= 3 ? 0.036 : 0.0305;
    const driveAtk = this.constellation >= 3 ? 2.96 : 2.507;
    const driveHp = this.constellation >= 3 ? 0.0507 : 0.043;
    const qTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "dehya-burst-combo": {
        label: {
          zh: "Q连段10+1",
          en: "Q Combo (10+1 hits)",
        },
        parts: [
          {
            formula: new DirectFormula(fistAtk, qTag, "atk", {
              key: "hp",
              multiplier: fistHp,
            }),
            hits: 10,
          },
          {
            formula: new DirectFormula(driveAtk, qTag, "atk", {
              key: "hp",
              multiplier: driveHp,
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("alhaitham")
class Alhaitham extends CharacterBase {
  readonly buffs = [
    // P2: EM × 0.1% → Projection (skill) & Q (burst) DMG bonus (cap 100%)
    new ScalingBuff(
      cbs(this, "P2", []),
      { receiver: "selfOnField", filter: { abilities: ["skill", "burst"] } },
      [],
      "em",
      "dmg%",
      0.001,
      1.0
    ),
    // C2: EM +50 per Mirror generated (max 4 stacks = 200)
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
            { key: "em", value: 200 },
          ]),
        ]
      : []),
    // C4: Per Mirror consumed (max 3), other party EM +30 (total 90)
    // Per Mirror generated (max 3), self Dendro% +10% (total 30%)
    ...(() => {
      if (this.constellation < 4) return [];
      return [
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "otherOnField" }, [
          { key: "em", value: 90 },
        ]),
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "selfOnField" }, [
          { key: "dendro%", value: 0.3 },
        ]),
      ];
    })(),
    // C6: CR +10%, CD +70% when mirrors are maxed (assume active)
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["E"]), { receiver: "selfOnField" }, [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.7 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // 3-Mirror Projection per hit: Lv10 121.0% ATK + 241.9% EM, C3+: 142.8% ATK + 285.6% EM
    const projAtk = this.constellation >= 3 ? 1.428 : 1.21;
    const projEm = this.constellation >= 3 ? 2.856 : 2.419;
    // Burst single-instance: Lv10 218.9% ATK + 175.1% EM, C5+: 258.4% ATK + 206.7% EM
    // With 3 mirrors consumed = 10 hits
    const burstAtk = this.constellation >= 5 ? 2.584 : 2.189;
    const burstEm = this.constellation >= 5 ? 2.067 : 1.751;
    const projTag = {
      element: "Dendro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "alhaitham-projection": {
        label: { zh: "E伤害(3镜)", en: "E (3 Mirrors)" },
        parts: [
          {
            formula: new DirectFormula(projAtk, projTag, "atk", {
              key: "em",
              multiplier: projEm,
            }),
            hits: 3,
          },
        ],
      },
      "alhaitham-proj-spread": {
        label: { zh: "E(蔓激化)", en: "E (Spread)" },
        parts: [
          {
            formula: new CatalyzeFormula(
              projAtk,
              { element: "Dendro", ability: "skill", reaction: "spread" },
              "atk",
              { key: "em", multiplier: projEm }
            ),
            hits: 3,
          },
        ],
      },
      "alhaitham-burst": {
        label: { zh: "Q×10 3镜", en: "Q ×10 (3 Mirrors)" },
        parts: [
          {
            formula: new DirectFormula(
              burstAtk,
              { element: "Dendro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: burstEm }
            ),
            hits: 10,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("wanderer")
class Wanderer extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    // P1: On E, if Pyro absorbed → +30% ATK, Cryo → +20% CR (max 2 buffs)
    // C4: Also obtain a random untriggered buff (max 3 buffs).
    // Under peak-damage model, C4 gives the best untriggered offensive buff.
    const hasPyro = Object.values(this.teamMeta.elements).includes("Pyro");
    const hasCryo = Object.values(this.teamMeta.elements).includes("Cryo");
    const p1Pyro = hasPyro || (this.constellation >= 4 && hasCryo);
    const p1Cryo = hasCryo || (this.constellation >= 4 && hasPyro);
    if (p1Pyro) {
      buffs.push(
        new StatBuff(
          cbs(this, hasPyro ? "P1" : "P1/C4", ["E-Pyro"]),
          { receiver: "selfOnField" },
          [{ key: "atk%", value: 0.3 }]
        )
      );
    }
    if (p1Cryo) {
      buffs.push(
        new StatBuff(
          cbs(this, hasCryo ? "P1" : "P1/C4", ["E-Cryo"]),
          { receiver: "selfOnField" },
          [{ key: "cr", value: 0.2 }]
        )
      );
    }

    // C1: On E, Normal/Charged ATK SPD +10%
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge"] },
          },
          [{ key: "atkSpd%", value: 0.1 }]
        )
      );
    }

    // C2: On E, Burst DMG +200% (max)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 2.0 }]
        )
      );
    }

    // C6: Each Kuugo: Fushoudan hit deals an additional instance at 40% of original DMG
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [{ key: "baseDmg%", value: 0.4 }]
        )
      );
    }

    return buffs;
  })();

  // E Hover Normal: NA Lv10 multipliers × E multiplier (Kuugo: Fushoudan)
  // N1=135.8%, N2=128.5%, N3=94.2%×2 (4 hits total)
  // E Lv10: 153.7%, E Lv13 (C5+): 161.4%
  // E Hover CA: CA Lv10 237.7% × E multiplier (Kuugo: Toufukai)
  // E Lv10: 143.0%, E Lv13 (C5+): 149.1%
  // Q Burst (Lv10): 265.0%×5, (Lv13 C3+): 312.8%×5
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 1.614 : 1.537;
    const n1 = 1.358 * eMult;
    const n2 = 1.285 * eMult;
    const n3 = 0.942 * eMult;
    const ca = 2.377 * (this.constellation >= 5 ? 1.491 : 1.43);
    const qMult = this.constellation >= 3 ? 3.128 : 2.65;
    const normalTag = {
      element: "Anemo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    return {
      "wanderer-normal": {
        label: { zh: "普攻全套", en: "A Kuugo: Fushoudan (N3)" },
        parts: [
          { formula: new DirectFormula(n1, normalTag) },
          { formula: new DirectFormula(n2, normalTag) },
          { formula: new DirectFormula(n3, normalTag), hits: 2 },
        ],
      },
      "wanderer-charge": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(ca, {
              element: "Anemo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "wanderer-burst": {
        label: {
          zh: "Q×5",
          en: "Q ×5",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 5,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("nahida")
class Nahida extends CharacterBase {
  // Q Pyro bonus: DMG% on Tri-Karma based on Pyro char count (C1 adds +1 virtual Pyro)
  // Lv10: 1 Pyro → +26.8%, 2 Pyro → +40.2%; Lv13 (C5): +31.6% / +47.4%
  // "火元素：当纳西妲处于摩耶之殿当中时，提升元素战技「所闻遍计」的灭净三业造成的伤害"
  private readonly pyroBonusDmg = (() => {
    const pyroCount =
      this.teamMeta.countByElement("Pyro") + (this.constellation >= 1 ? 1 : 0);
    const isQ13 = this.constellation >= 5;
    if (pyroCount >= 2) return isQ13 ? 0.474 : 0.402;
    if (pyroCount >= 1) return isQ13 ? 0.316 : 0.268;
    return 0;
  })();

  readonly buffs = [
    // P1: Q field grants EM = highest party EM × 25% (cap 250)
    new ScalingBuff(
      cbs(this, "P1", ["Q"]),
      { receiver: "onField" },
      [],
      "em",
      "em",
      0.25,
      250
    ),
    // P2: EM above 200 → Tri-Karma DMG +0.1%/EM (cap 80%)
    // Tri-Karma fires off-field, so use "self" not "selfOnField"
    new ScalingBuff(
      cbs(this, "P2", []),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "em",
      "dmg%",
      0.001,
      0.8,
      200
    ),
    // P2: EM above 200 → Tri-Karma CR +0.03%/EM (cap 24%)
    new ScalingBuff(
      cbs(this, "P2", []),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "em",
      "cr",
      0.0003,
      0.24,
      200
    ),
    // C2: Quicken → DEF -30% for 8s
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["E", "quicken"]),
            { receiver: "team" },
            [{ key: "defReduction%", value: 0.3 }]
          ),
        ]
      : []),
    // C2: Burning/Bloom/Hyperbloom/Burgeon can crit (CR 20%, CD 100%)
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["E"]),
            {
              receiver: "team",
              filter: {
                reactions: ["bloom", "burgeon", "burning", "hyperbloom"],
              },
            },
            [
              { key: "reactionCr", value: 0.2 },
              { key: "reactionCd", value: 1.0 },
            ]
          ),
        ]
      : []),
    // C2: Lunar-Bloom DMG CRIT Rate +10%, CRIT DMG +20%
    // "受到月绽放反应伤害的暴击率提升10%，暴击伤害提升20%"
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["E"]),
            {
              receiver: "team",
              filter: { reactions: ["lunarBloom"] },
            },
            [
              { key: "reactionCr", value: 0.1 },
              { key: "reactionCd", value: 0.2 },
            ]
          ),
        ]
      : []),
    // C4: Self EM +140 (model 3 enemies average)
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["E"]), { receiver: "selfOnField" }, [
            { key: "em", value: 140 },
          ]),
        ]
      : []),
    // Q: Pyro element bonus → Tri-Karma DMG% (requires Q field active; assumed under peak model)
    // C1 adds +1 virtual Pyro/Electro/Hydro to the count for Q effect tiers
    ...(this.pyroBonusDmg > 0
      ? [
          new StatBuff(
            cbs(this, "Q", ["Q"]),
            { receiver: "self", filter: { abilities: ["skill"] } },
            [{ key: "dmg%", value: this.pyroBonusDmg }]
          ),
        ]
      : []),
  ];

  // Tri-Karma: Lv10 185.8% ATK + 371.5% EM, Lv13 (C3+) 219.3% ATK + 438.6% EM
  protected readonly formulaMap = (() => {
    const atkMult = this.constellation >= 3 ? 2.193 : 1.858;
    const emMult = this.constellation >= 3 ? 4.386 : 3.715;
    return {
      "nahida-karma": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(
              atkMult,
              { element: "Dendro", ability: "skill", reaction: "none" },
              "atk",
              { key: "em", multiplier: emMult }
            ),
          },
        ],
      },
      "nahida-karma-spread": {
        label: { zh: "E(蔓激化)", en: "E (Spread)" },
        parts: [
          {
            // Spread is a Catalyze reaction (additive flat bonus) — must use CatalyzeFormula
            formula: new CatalyzeFormula(
              atkMult,
              { element: "Dendro", ability: "skill", reaction: "spread" },
              "atk",
              { key: "em", multiplier: emMult }
            ),
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "nahida-c6-karma": {
              label: {
                zh: "6命 E伤害",
                en: "C6 E",
              },
              parts: [
                {
                  formula: new DirectFormula(
                    2.0,
                    { element: "Dendro", ability: "skill", reaction: "none" },
                    "atk",
                    { key: "em", multiplier: 4.0 }
                  ),
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("cyno")
class Cyno extends CharacterBase {
  readonly buffs = [
    // Q: EM +100 and Normal ATK SPD +20% during Pactsworn Pathclearer
    new StatBuff(cbs(this, "Q", ["Q"]), { receiver: "selfOnField" }, [
      { key: "em", value: 100 },
    ]),
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["normal"] } },
            [{ key: "atkSpd%", value: 0.2 }]
          ),
        ]
      : []),
    // P2: Normal ATK DMG += 150% EM as baseDmg (during Q)
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [],
      "em",
      "baseDmg",
      1.5
    ),
    // P2: Duststalker Bolt DMG += 250% EM as baseDmg
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      2.5
    ),
    // P1: Mortuary Rite (Judication) +35% DMG
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: 0.35 }]
    ),
    // C2: Normal ATK hit → Electro DMG +10% × 5 stacks = +50%
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "selfOnField" }, [
            { key: "electro%", value: 0.5 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // Burst N1-N5 combo (5 distinct multipliers, N4 hits twice = 6 total hits)
    // Lv10: N1=154.7%, N2=163.0%, N3=206.8%, N4=102.2%×2, N5=258.6%
    // Lv13 (C3+): N1=187.5%, N2=197.5%, N3=250.6%, N4=123.8%×2, N5=313.4%
    const n1 = this.constellation >= 3 ? 1.875 : 1.547;
    const n2 = this.constellation >= 3 ? 1.975 : 1.63;
    const n3 = this.constellation >= 3 ? 2.506 : 2.068;
    const n4 = this.constellation >= 3 ? 1.238 : 1.022;
    const n5 = this.constellation >= 3 ? 3.134 : 2.586;
    // Mortuary Rite: Lv10 282.2%, C5+ 333.2%
    const eMult = this.constellation >= 5 ? 3.332 : 2.822;

    const normalBaseTag = {
      element: "Electro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const normalAggTag = {
      ...normalBaseTag,
      reaction: "aggravate" as const,
    };
    const eBaseTag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const eAggTag = { ...eBaseTag, reaction: "aggravate" as const };

    const comboParts = [
      { formula: new DirectFormula(n1, normalBaseTag) },
      { formula: new DirectFormula(n2, normalBaseTag) },
      { formula: new DirectFormula(n3, normalBaseTag) },
      { formula: new DirectFormula(n4, normalBaseTag), hits: 2 },
      { formula: new DirectFormula(n5, normalBaseTag) },
      { formula: new DirectFormula(eMult, eBaseTag) },
    ];

    // Aggravate: N1/N3/N5 trigger Aggravate (3 hits), N2/N4 direct (3 hits)
    const comboAggParts = [
      { formula: new CatalyzeFormula(n1, normalAggTag) },
      { formula: new DirectFormula(n2, normalBaseTag) },
      { formula: new CatalyzeFormula(n3, normalAggTag) },
      { formula: new DirectFormula(n4, normalBaseTag), hits: 2 },
      { formula: new CatalyzeFormula(n5, normalAggTag) },
      { formula: new CatalyzeFormula(eMult, eAggTag) },
    ];

    const hasDendro =
      this.teamMeta.elements[this.charId] === "Dendro" ||
      Object.keys(this.teamMeta.elements).some(
        (k) => k !== this.charId && this.teamMeta.elements[k] === "Dendro"
      );

    return {
      "cyno-combo": {
        label: { zh: "Q普攻+E", en: "Q Normal+E" },
        parts: comboParts,
      },
      ...(hasDendro
        ? {
            "cyno-combo-aggravate": {
              label: {
                zh: "Q普攻+E(超激化)",
                en: "Q Normal+E (Aggravate)",
              },
              parts: comboAggParts,
            },
          }
        : {}),
      // C6 "Day of the Jackal": Each Normal ATK fires an extra Duststalker Bolt
      // (100% ATK, Electro skill DMG). ~5 bolts per combo. P2 EM->baseDmg applies automatically.
      ...(this.constellation >= 6
        ? {
            "cyno-c6-bolts": {
              label: { zh: "6命追影牙", en: "C6 Duststalker Bolts" },
              parts: [{ formula: new DirectFormula(1.0, eBaseTag), hits: 5 }],
            },
            ...(hasDendro
              ? {
                  "cyno-c6-bolts-aggravate": {
                    label: {
                      zh: "6命追影牙(超激化)",
                      en: "C6 Bolts (Aggravate)",
                    },
                    parts: [
                      { formula: new CatalyzeFormula(1.0, eAggTag), hits: 3 },
                      { formula: new DirectFormula(1.0, eBaseTag), hits: 2 },
                    ],
                  },
                }
              : {}),
          }
        : {}),
    };
  })();
}

@RegisterCharacter("nilou")
class Nilou extends CharacterBase {
  readonly buffs = (() => {
    // P1: Golden Chalice's Bounty requires ALL members Dendro/Hydro, ≥1 of each
    const elements = Object.values(this.teamMeta.elements);
    const allDendroHydro = elements.every(
      (e) => e === "Dendro" || e === "Hydro"
    );
    const hasDendro = elements.some((e) => e === "Dendro");
    const hasHydro = elements.some((e) => e === "Hydro");
    const isBountiful = allDendroHydro && hasDendro && hasHydro;

    const buffs: StatBuff[] = [];

    if (isBountiful) {
      // P1: EM +100 to all nearby characters (on Dendro hit trigger)
      buffs.push(
        new StatBuff(cbs(this, "P1", ["E"]), { receiver: "team" }, [
          { key: "em", value: 100 },
        ])
      );
      // P2: Per 1000 HP above 30000 → Bloom DMG +9% (max 400%)
      buffs.push(
        new ScalingBuff(
          cbs(this, "P2", []),
          {
            receiver: "team",
            filter: { reactions: ["bloom", "lunarBloom"] },
          },
          [],
          "hp",
          "reactionDmg%",
          0.00009,
          4.0,
          30000
        )
      );
    }
    // C2: Hydro/Dendro RES -35% on Bloom hit
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["bloom", "lunarBloom"]),
          { receiver: "team", filter: { elements: ["Hydro", "Dendro"] } },
          [{ key: "resReduction%", value: 0.35 }]
        )
      );
    }

    // C4: E 3rd step → Q DMG +50% for 8s
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    // C6: Per 1000 HP → CR +0.6% (cap 30%), CD +1.2% (cap 60%)
    if (this.constellation >= 6) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", []),
          { receiver: "self" },
          [],
          "hp",
          "cr",
          0.000006,
          0.3
        ),
        new ScalingBuff(
          cbs(this, "C6", []),
          { receiver: "self" },
          [],
          "hp",
          "cd",
          0.000012,
          0.6
        )
      );
    }

    return buffs;
  })();

  // Q total: Lv10 (33.2%+40.6%) HP = 73.8% HP, Lv13 (C3+) (39.2%+47.9%) = 87.1% HP
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 3 ? 0.871 : 0.738;
    const elements = Object.values(this.teamMeta.elements);
    const allDendroHydro = elements.every(
      (e) => e === "Dendro" || e === "Hydro"
    );
    const hasDendro = elements.some((e) => e === "Dendro");
    const hasHydro = elements.some((e) => e === "Hydro");
    const isBountiful = allDendroHydro && hasDendro && hasHydro;

    return {
      "nilou-burst": {
        label: { zh: "Q 2段", en: "Q 2-hit" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
      ...(isBountiful
        ? {
            "nilou-bountiful-core": {
              label: { zh: "丰穰之核", en: "Bountiful Core DMG" },
              parts: [
                {
                  formula: new TransformFormula(0, {
                    element: "Dendro",
                    ability: "special",
                    reaction: "bloom",
                  }),
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("tighnari")
class Tighnari extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: After Wreath Arrow, EM +50
      new StatBuff(
        cbs(this, "P1", ["charge"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "em", value: 50 }]
      ),
      // P2: Each point of EM → Charged ATK +0.06% & Q DMG +0.06% (Max 60%)
      new ScalingBuff(
        cbs(this, "P2", []),
        {
          receiver: "selfOnField",
          filter: { abilities: ["charge", "burst"] },
        },
        [],
        "em",
        "dmg%",
        0.0006,
        0.6
      ),
    ];
    // C1: Charged Attack CR +15%
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["charge"]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "cr", value: 0.15 }]
        )
      );
    }
    // C2: Within Vijnana-Khanda Field with enemies → +20% Dendro DMG
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "selfOnField" }, [
          { key: "dendro%", value: 0.2 },
        ])
      );
    }
    // C4: Q unleashed + reactions → Team EM +120
    // C4 text: "若造生缠藤箭触发了燃烧、绽放、月绽放、原激化或蔓激化反应" (burning/bloom/lunarBloom/quicken/spread)
    if (this.constellation >= 4) {
      const canC4React =
        this.teamMeta.hasReaction("burning") ||
        this.teamMeta.hasReaction("bloom") ||
        this.teamMeta.hasReaction("lunarBloom") ||
        this.teamMeta.hasReaction("quicken") ||
        this.teamMeta.hasReaction("spread");

      buffs.push(
        new StatBuff(
          cbs(
            this,
            "C4",
            canC4React
              ? ["Q", "burning", "bloom", "lunarBloom", "quicken", "spread"]
              : ["Q"]
          ),
          { receiver: "team" },
          [{ key: "em", value: canC4React ? 120 : 60 }]
        )
      );
    }
    return buffs;
  })();

  // Charged Attack: Wreath Arrow Lv10 157.0% + 4× Clusterbloom 69.5%
  // C6: +1 extra Clusterbloom at 150.0%
  // Q: 6× Tanglevine Shaft Lv10 100.1% + 6× Secondary Shaft 122.4%
  // C3 boosts Q: Lv13 118.2% + 144.5%
  protected readonly formulaMap = (() => {
    const chargeTag = {
      element: "Dendro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const chargeSpreadTag = { ...chargeTag, reaction: "spread" as const };
    const burstTag = {
      element: "Dendro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    // Tanglevine: Lv10 100.1%, C3+ Lv13 118.2%
    const tangleMult = this.constellation >= 3 ? 1.182 : 1.001;
    // Secondary: Lv10 122.4%, C3+ Lv13 144.5%
    const secondaryMult = this.constellation >= 3 ? 1.445 : 1.224;

    return {
      "tighnari-charge": {
        label: { zh: "重击花筥箭", en: "CA Wreath + Clusterbloom" },
        parts: [
          { formula: new DirectFormula(1.57, chargeTag) },
          { formula: new DirectFormula(0.695, chargeTag), hits: 4 },
          ...(this.constellation >= 6
            ? [{ formula: new DirectFormula(1.5, chargeTag) }]
            : []),
        ],
      },
      "tighnari-charge-spread": {
        label: { zh: "重击花筥箭(蔓激化)", en: "CA (Spread)" },
        parts: [
          { formula: new CatalyzeFormula(1.57, chargeSpreadTag) },
          { formula: new CatalyzeFormula(0.695, chargeSpreadTag), hits: 4 },
          ...(this.constellation >= 6
            ? [{ formula: new CatalyzeFormula(1.5, chargeSpreadTag) }]
            : []),
        ],
      },
      "tighnari-burst": {
        label: {
          zh: "Q缠藤箭×6",
          en: "Q ×12",
        },
        parts: [
          { formula: new DirectFormula(tangleMult, burstTag), hits: 6 },
          { formula: new DirectFormula(secondaryMult, burstTag), hits: 6 },
        ],
      },
    };
  })();
}
