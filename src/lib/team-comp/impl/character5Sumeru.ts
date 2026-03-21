import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula, TransformFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { resolveOption } from "../damageModels";
import type { OptionDef } from "../damageModels";
import type { StatSheet } from "../damageModels";
import { E, type Expr, simplify } from "../expr";
import type { ExprStats } from "../exprStats";
import { cbs } from "../helpers";
import type { StatEntry, StatKey } from "../types";

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
          { receiver: "self", filter: { abilities: ["skill"] } },
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
          { receiver: "self", filter: { abilities: ["skill"] } },
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

  // E Molten Inferno: Field DMG (coordinated attack) ~4 hits over 12s
  // Lv10: 108.4% ATK + 1.86% HP, Lv13 (C5+): 127.9% ATK + 2.19% HP
  // Q Leonine Bite: Flame-Mane's Fist ×10 + Incineration Drive ×1 (dual ATK+HP scaling)
  // Fist Lv10: 177.7% ATK + 3.05% HP, Lv13 (C3+): 209.7% ATK + 3.60% HP
  // Drive Lv10: 250.7% ATK + 4.30% HP, Lv13 (C3+): 296.0% ATK + 5.07% HP
  protected readonly formulaMap = (() => {
    const fieldAtk = this.constellation >= 5 ? 1.279 : 1.084;
    const fieldHp = this.constellation >= 5 ? 0.0219 : 0.0186;
    const fistAtk = this.constellation >= 3 ? 2.097 : 1.777;
    const fistHp = this.constellation >= 3 ? 0.036 : 0.0305;
    const driveAtk = this.constellation >= 3 ? 2.96 : 2.507;
    const driveHp = this.constellation >= 3 ? 0.0507 : 0.043;
    const eTag = {
      element: "Pyro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const qTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "dehya-molten-inferno": {
        label: { zh: "E净世焚火", en: "E Molten Inferno" },
        parts: [
          {
            formula: new DirectFormula(fieldAtk, eTag, "atk", {
              key: "hp",
              multiplier: fieldHp,
            }),
            hits: 4,
            offField: true,
          },
        ],
      },
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

  // Rotation: E > teammates > E Q(10+1) — E field 1 activation, Q 1 activation (KQM)
  protected override get defaultRotation() {
    return { "dehya-molten-inferno": 1, "dehya-burst-combo": 1 };
  }
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
        // Game text: "队伍中附近的其他角色" → other (all teammates, not just on-field)
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "other" }, [
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

  // Rotation: Q > N3D N3D N1E N3D N3CD N3D — ~7 Projection triggers + 1 Q (KQM)
  protected override get defaultRotation() {
    return { "alhaitham-projection": 7, "alhaitham-burst": 1 };
  }
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

  // Rotation: E > N2C ×5 > Q — hover carry with charged attacks (KQM)
  protected override get defaultRotation() {
    return { "wanderer-normal": 5, "wanderer-charge": 5, "wanderer-burst": 1 };
  }
}

const nahidaOption = {
  label: { zh: "蕴种印敌人数量", en: "Enemies Marked" },
  choices: [
    { value: "1", label: { zh: "1个敌人", en: "1 enemy" } },
    { value: "2", label: { zh: "2个敌人", en: "2 enemies" } },
    { value: "3", label: { zh: "3个敌人", en: "3 enemies" } },
    { value: "4", label: { zh: "4个或以上", en: "4+ enemies" } },
  ] as const,
  default: "1",
} satisfies OptionDef;

@RegisterCharacter("nahida", nahidaOption)
class Nahida extends CharacterBase {
  private readonly enemyCount = Number.parseInt(
    resolveOption(nahidaOption, this.option)
  );
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
    // "依据队伍中元素精通最高的角色的元素精通数值的25%，提高领域内当前场上角色的元素精通"
    new (class extends StatBuff {
      override dynamicBuffs(
        _selfStats: StatSheet,
        teamStats: StatSheet[]
      ): StatEntry[] {
        const maxEm = Math.max(...teamStats.map((s) => s.get("em", null)));
        return [{ key: "em", value: Math.min(maxEm * 0.25, 250) }];
      }
      override dynamicBuffsExprTeam(
        _selfStats: ExprStats,
        teamExprStats: ExprStats[]
      ): { key: StatKey; expr: Expr }[] {
        // max(team_em_1, ..., team_em_n) × 0.25, capped at 250
        let maxEm: Expr = teamExprStats[0]!.get("em", null);
        for (let i = 1; i < teamExprStats.length; i++) {
          maxEm = E.max(maxEm, teamExprStats[i]!.get("em", null));
        }
        return [
          {
            key: "em",
            expr: simplify(E.min(E.mul(maxEm, E.const(0.25)), E.const(250))),
          },
        ];
      }
    })(cbs(this, "P1", ["Q"]), { receiver: "onField" }, []),
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
    // C4: Self EM +100/120/140/160 based on enemies marked (1/2/3/4+)
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["E"]), { receiver: "self" }, [
            {
              key: "em",
              value:
                [100, 120, 140, 160][Math.min(this.enemyCount, 4) - 1] ?? 100,
            },
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
            offField: true,
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
                  hits: 6,
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: E Q > off-field — ~8 Tri-Karma procs per 20s; C6 adds 6 Karmic Oblivion (KQM)
  protected override get defaultRotation() {
    return {
      "nahida-karma": 8,
      "nahida-c6-karma": 1,
    };
  }
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
    // Applied via bespokeBuff on C6 bolts to avoid leaking to Mortuary Rite (also ability: "skill")
    // P1: Mortuary Rite (Judication) +35% DMG — applied via bespokeBuff on formula part
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
    const eBaseTag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };

    return {
      "cyno-combo": {
        label: { zh: "Q普攻+E", en: "Q Normal+E" },
        parts: [
          {
            formula: new DirectFormula(n1, normalBaseTag),
          },
          { formula: new DirectFormula(n2, normalBaseTag) },
          {
            formula: new DirectFormula(n3, normalBaseTag),
          },
          { formula: new DirectFormula(n4, normalBaseTag), hits: 2 },
          {
            formula: new DirectFormula(n5, normalBaseTag),
          },
          {
            formula: new DirectFormula(eMult, eBaseTag),
            // P1: Judication +35% DMG applies only to Mortuary Rite, not Duststalker Bolts
            bespokeBuff: new StatBuff(
              cbs(this, "P1", ["E"]),
              { receiver: "selfOnField", filter: { abilities: ["skill"] } },
              [{ key: "dmg%", value: 0.35 }]
            ),
          },
        ],
      },
      // C6 "Day of the Jackal": Each Normal ATK fires an extra Duststalker Bolt
      // (100% ATK, Electro skill DMG). ~5 bolts per combo. P2 EM->baseDmg applies automatically.
      ...(this.constellation >= 6
        ? {
            "cyno-c6-bolts": {
              label: { zh: "6命渡荒之雷", en: "C6 Duststalker Bolts" },
              parts: [
                {
                  formula: new DirectFormula(1.0, eBaseTag),
                  hits: 5,
                  // P2: Duststalker Bolt DMG += 250% EM as baseDmg
                  bespokeBuff: new ScalingBuff(
                    cbs(this, "P2", ["E"]),
                    {
                      receiver: "selfOnField",
                      filter: { abilities: ["skill"] },
                    },
                    [],
                    "em",
                    "baseDmg",
                    2.5
                  ),
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: EQ > E > 6[N4E] — 6 N5+E combos during burst (4TF, KQM)
  protected override get defaultRotation() {
    return {
      "cyno-combo": 6,
      "cyno-c6-bolts": 6,
    };
  }
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
      // Note: lunarBloom is not bloom, so should not be included.
      buffs.push(
        new ScalingBuff(
          cbs(this, "P2", []),
          {
            receiver: "team",
            filter: { reactions: ["bloom"] },
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

  // Q: Lv10 Skill DMG 33.2% HP + Lingering Aeon 40.6% HP, Lv13 (C3+) 39.2% + 47.9%
  protected readonly formulaMap = (() => {
    const qHit1 = this.constellation >= 3 ? 0.392 : 0.332;
    const qHit2 = this.constellation >= 3 ? 0.479 : 0.406;
    const elements = Object.values(this.teamMeta.elements);
    const allDendroHydro = elements.every(
      (e) => e === "Dendro" || e === "Hydro"
    );
    const hasDendro = elements.some((e) => e === "Dendro");
    const hasHydro = elements.some((e) => e === "Hydro");
    const isBountiful = allDendroHydro && hasDendro && hasHydro;

    const qTag = {
      element: "Hydro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "nilou-burst": {
        label: { zh: "Q 2段", en: "Q 2-hit" },
        parts: [
          { formula: new DirectFormula(qHit1, qTag, "hp") },
          { formula: new DirectFormula(qHit2, qTag, "hp") },
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
                  offField: true,
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: Q E E E E — off-field Bloom support, 1 Q + ~5 Bountiful Cores (KQM)
  protected override get defaultRotation() {
    return {
      "nilou-burst": 1,
      "nilou-bountiful-core": 5,
    };
  }
}

@RegisterCharacter("tighnari")
class Tighnari extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: After Wreath Arrow, EM +50 (no ability restriction)
      new StatBuff(cbs(this, "P1", ["charge"]), { receiver: "selfOnField" }, [
        { key: "em", value: 50 },
      ]),
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

  // Rotation: E 3[CA] Q — quickswap Spread carry (KQM)
  protected override get defaultRotation() {
    return { "tighnari-charge": 3, "tighnari-burst": 1 };
  }
}
