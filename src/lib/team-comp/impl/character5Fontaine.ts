import { ScalingBuff, StatBuff } from "../damageBuffs";
import { CatalyzeFormula, DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 5★ Fontaine Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("escoffier")
class Escoffier extends CharacterBase {
  private readonly hydroCryo =
    this.teamMeta.countByElement("Hydro") +
    this.teamMeta.countByElement("Cryo");

  readonly buffs = (() => {
    const shredTiers = [0, 0.05, 0.1, 0.15, 0.55] as const;
    const shred = shredTiers[Math.min(this.hydroCryo, 4)];
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: Hydro/Cryo RES shred based on # Hydro+Cryo in party
      new StatBuff(
        cbs(this, "P2", ["E", "Q"]),
        { receiver: "team", filter: { elements: ["Hydro", "Cryo"] } },
        [{ key: "resReduction%", value: shred }]
      ),
    ];
    // C1: All 4 Hydro/Cryo → team Cryo DMG CD +60%
    if (this.constellation >= 1 && this.hydroCryo >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E", "Q"]),
          { receiver: "team", filter: { elements: ["Cryo"] } },
          [{ key: "cd", value: 0.6 }]
        )
      );
    }
    // C2: Cold Storage → on-field (others) Cryo DMG gets baseDmg from Escoffier's ATK ×240%
    if (this.constellation >= 2) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "otherOnField", filter: { elements: ["Cryo"] } },
          [],
          "atk",
          "baseDmg",
          2.4
        )
      );
    }
    return buffs;
  })();

  // E: Skill cast Lv10: 90.7%, Lv13 (C3+): 107.1%
  // E: Frosty Parfait Lv10: 216.0%, Lv13 (C3+): 255.0%, 21 ticks over 20s
  // Q: Scoring Cuts Lv10: 1067.0%, Lv13 (C5+): 1259.7%
  protected readonly formulaMap = (() => {
    const skillCastMult = this.constellation >= 3 ? 1.071 : 0.907;
    const parfaitMult = this.constellation >= 3 ? 2.55 : 2.16;
    const qMult = this.constellation >= 5 ? 12.597 : 10.67;
    const skillTag = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "escoffier-skill-parfait": {
        label: {
          zh: "E 技能释放+21次冻霜芭菲",
          en: "E Skill Cast + Frosty Parfait (×21)",
        },
        parts: [
          {
            formula: new DirectFormula(skillCastMult, skillTag),
          },
          {
            formula: new DirectFormula(parfaitMult, skillTag),
            hits: 21,
          },
        ],
      },
      "escoffier-burst": {
        label: { zh: "Q 花刀技法", en: "Q Scoring Cuts" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("emilie")
class Emilie extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: vs Burning enemies, per 1000 ATK → DMG +15% (cap 36%)
      new ScalingBuff(
        cbs(this, "P2", []),
        { receiver: "selfOnField" },
        [],
        "atk",
        "dmg%",
        0.00015,
        0.36
      ),
      // C1: E and P1 Cleardew DMG +20%
      new StatBuff(
        cbs(this, "C1", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        this.constellation >= 1 ? [{ key: "dmg%", value: 0.2 }] : []
      ),
      // C2: E/Q/Cleardew hit → enemies' Dendro RES -30%
      new StatBuff(
        cbs(this, "C2", ["E", "Q"]),
        { receiver: "team", filter: { elements: ["Dendro"] } },
        this.constellation >= 2 ? [{ key: "resReduction%", value: 0.3 }] : []
      ),
      // C6: After E/Q, Normal/Charged become Dendro + flat baseDmg from ATK ×300%
      ...(this.constellation >= 6
        ? [
            new ScalingBuff(
              cbs(this, "C6", ["E"]),
              {
                receiver: "selfOnField",
                filter: { abilities: ["normal", "charge"] },
              },
              [],
              "atk",
              "baseDmg",
              3.0
            ),
          ]
        : []),
    ];
    return buffs;
  })();

  // E Lv2 Case: 151.2%×2 per tick (Lv10), 178.5%×2 (Lv13 C3+), ~7 ticks over 22s
  // P1 Cleardew Cologne: 600% ATK (not skill DMG), fires every 2 scent collections
  // Q Lv3 Case: 391.0% (Lv10), 461.6% (Lv13 C5+), ~4 drops over 2.8s
  protected readonly formulaMap = (() => {
    const lv2TickMult = this.constellation >= 3 ? 1.785 * 2 : 1.512 * 2;
    const qMult = this.constellation >= 5 ? 4.616 : 3.91;
    const hasPyro = this.teamMeta.countByElement("Pyro") > 0;

    const normalParts = [
      {
        formula: new DirectFormula(0.96, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
      {
        formula: new DirectFormula(0.887, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
      {
        formula: new DirectFormula(1.172, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
      {
        formula: new DirectFormula(1.485, {
          element: "Dendro",
          ability: "normal",
          reaction: "none",
        }),
      },
    ];

    return {
      ...(hasPyro
        ? {
            "emilie-skill-burning": {
              label: {
                zh: "E 二阶14击+5次清露",
                en: "E Lv2 14 Ticks + 5 Cleardew",
              },
              parts: [
                {
                  formula: new DirectFormula(lv2TickMult, {
                    element: "Dendro",
                    ability: "skill",
                    reaction: "none",
                  }),
                  hits: 14,
                },
                {
                  formula: new DirectFormula(6.0, {
                    element: "Dendro",
                    ability: "special",
                    reaction: "none",
                  }),
                  hits: 5,
                },
              ],
            },
          }
        : {}),
      "emilie-burst-9hit": {
        label: { zh: "Q 柔灯之匣·三阶9次", en: "Q Lv3 Case (9 Ticks)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 9,
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "emilie-c6-normal": {
              label: { zh: "A 一套普通攻击", en: "A Normal ATK Combo" },
              parts: normalParts,
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("sigewinne")
class Sigewinne extends CharacterBase {
  readonly buffs = (() => {
    const isC1 = this.constellation >= 1;
    const buffs: StatBuff[] = [
      // P1: HP > 30k → E baseDmg +80 (C1: 100) per 1000 HP. Max 2800 (C1: 3500)
      new ScalingBuff(
        cbs(this, "P1", ["E"]),
        { receiver: "team", filter: { abilities: ["skill"] } },
        [],
        "hp",
        "baseDmg",
        isC1 ? 0.1 : 0.08,
        isC1 ? 3500 : 2800,
        30000
      ),
    ];

    // C2: E or Q hit → Hydro RES -35%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E", "Q"]),
          { receiver: "team", filter: { elements: ["Hydro"] } },
          [{ key: "resReduction%", value: 0.35 }]
        )
      );
    }

    // C6: HP → Q CR+20%, CD+110% (0.4% CR, 2.2% CD per 1000 HP)
    if (this.constellation >= 6) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "hp",
          "cr",
          0.000004,
          0.2
        ),
        new ScalingBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "hp",
          "cd",
          0.000022,
          1.1
        )
      );
    }

    return buffs;
  })();

  // Q: Super Saturated Syringing Lv10: 21.2% HP, Lv13 (C5+): 25.0% HP
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 5 ? 0.25 : 0.212;
    return {
      "sigewinne-burst": {
        label: { zh: "Q伤害（命中6次）", en: "Q Super Saturated Syringing" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
            hits: 6,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("clorinde")
class Clorinde extends CharacterBase {
  readonly buffs = [
    // P1: After Electro reaction, +20% ATK (C2: 30%) × 3 stacks as baseDmg
    // on Normal ATK and Q Electro DMG
    new ScalingBuff(
      cbs(this, "P1", ["E"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "burst"], elements: ["Electro"] },
      },
      [],
      "atk",
      "baseDmg",
      this.constellation >= 2 ? 0.9 : 0.6
    ),
    // P2: BoL ≥100% + changes → CR +10% × 2 stacks = +20%
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "selfOnField" }, [
      { key: "cr", value: 0.2 },
    ]),
    // C4: Q DMG +2% per 1% BoL (max 200%) — at full BoL ~120%+
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      this.constellation >= 4 ? [{ key: "dmg%", value: 2.0 }] : []
    ),
    // C6: After E, +10% CR, +70% CD for 12s
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField" },
      this.constellation >= 6
        ? [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.7 },
          ]
        : []
    ),
  ];

  protected readonly formulaMap = (() => {
    // Q Last Lightfall: Lv10 228.4%×5, Lv13 (C5+) 269.6%×5
    const qMult = this.constellation >= 5 ? 2.696 : 2.284;
    // Swift Hunt rotation: 3× piercing shot (76.7%) + Impale Pact (49.6%×3)
    const swiftMult = this.constellation >= 3 ? 0.929 : 0.767;
    const impaleMult = this.constellation >= 3 ? 0.602 : 0.496;

    const normalBaseTag = {
      element: "Electro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const aggBaseTag = {
      ...normalBaseTag,
      reaction: "aggravate" as const,
    };

    const normalParts = [
      { formula: new DirectFormula(swiftMult, normalBaseTag), hits: 3 },
      { formula: new DirectFormula(impaleMult, normalBaseTag), hits: 3 },
      ...(this.constellation >= 1
        ? [{ formula: new DirectFormula(0.3, normalBaseTag), hits: 2 }]
        : []),
      ...(this.constellation >= 6
        ? [{ formula: new DirectFormula(2.0, normalBaseTag), hits: 1 }]
        : []),
    ];

    const aggParts = [
      { formula: new CatalyzeFormula(swiftMult, aggBaseTag), hits: 3 },
      { formula: new CatalyzeFormula(impaleMult, aggBaseTag), hits: 3 },
      ...(this.constellation >= 1
        ? [{ formula: new CatalyzeFormula(0.3, aggBaseTag), hits: 2 }]
        : []),
      ...(this.constellation >= 6
        ? [{ formula: new CatalyzeFormula(2.0, aggBaseTag), hits: 1 }]
        : []),
    ];

    return {
      "clorinde-normal": {
        label: { zh: "E 夜巡连段(驰猎+贯夜)", en: "E Night Vigil Rotation" },
        parts: normalParts,
      },
      "clorinde-normal-aggravate": {
        label: {
          zh: "E 夜巡连段(超激化/默认全覆盖)",
          en: "E Night Vigil (Aggravate)",
        },
        parts: aggParts,
      },
      "clorinde-burst": {
        label: { zh: "Q 残光将终", en: "Q Last Lightfall" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
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

@RegisterCharacter("navia")
class Navia extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    // P1: After E, self Normal/Charged/Plunge DMG +40%
    buffs.push(
      new StatBuff(
        cbs(this, "P1", ["E"]),
        {
          receiver: "selfOnField",
          filter: { abilities: ["normal", "charge", "plunge"] },
        },
        [{ key: "dmg%", value: 0.4 }]
      )
    );
    // P2: Per Pyro/Electro/Cryo/Hydro party member, ATK+20% (max 2 = 40%)
    const nonGeoCount =
      this.teamMeta.countByElement("Pyro") +
      this.teamMeta.countByElement("Electro") +
      this.teamMeta.countByElement("Cryo") +
      this.teamMeta.countByElement("Hydro");
    buffs.push(
      new StatBuff(cbs(this, "P2", []), { receiver: "selfOnField" }, [
        { key: "atk%", value: Math.min(nonGeoCount, 2) * 0.2 },
      ])
    );
    // C2: 3 shrapnel → E CR +36%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cr", value: 0.36 }]
        )
      );
    }
    // C4: Q hit → enemy Geo RES -20%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "team", filter: { elements: ["Geo"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }
    // C6: 3 extra shrapnel → E CD +135% (45% × 3)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cd", value: 1.35 }]
        )
      );
    }
    return buffs;
  })();

  // E (6 shrapnel): Lv10 710.6% × 2.0 × 1.45 = 2060.7%
  // Lv13 (C3+): 839.0% × 2.0 × 1.45 = 2433.1%
  protected readonly formulaMap = (() => {
    const baseMult = this.constellation >= 3 ? 8.39 : 7.106;
    const totalMult = baseMult * 2.0 * 1.45;
    return {
      "navia-crystalshot": {
        label: { zh: "E 典仪式晶火(6弹片)", en: "E Crystalshot (6 shrapnel)" },
        parts: [
          {
            formula: new DirectFormula(totalMult, {
              element: "Geo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("furina")
class Furina extends CharacterBase {
  readonly buffs = [
    // P2: Per 1000 Max HP → salon members DMG +0.7% (cap 28%)
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "hp",
      "dmg%",
      0.000007,
      0.28
    ),
    // Q: Let the People Rejoice — team DMG% based on Fanfare stacks
    // Per stack Lv10: 0.25%, Lv13 (C3+): 0.31%
    // Max stacks: 300 (C1: 400). Assume ~250 stacks in practice.
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team" },
      (() => {
        const perStack = this.constellation >= 3 ? 0.0031 : 0.0025;
        const maxStacks = this.constellation >= 1 ? 400 : 300;
        const avgStacks = Math.min(250, maxStacks);
        return [{ key: "dmg%", value: perStack * avgStacks }];
      })()
    ),
    // C2: Fanfare overflow → HP% buff (0.35% per point, cap 140%)
    new StatBuff(
      cbs(this, "C2", []),
      { receiver: "self" },
      this.constellation >= 2 ? [{ key: "hp%", value: 1.4 }] : []
    ),
  ];

  // E Salon Members: scale with HP
  // Gentilhomme Usher (乌瑟勋爵): 9 hits
  // Surintendante Chevalmarin (海薇玛夫人): 18 hits
  // Mademoiselle Crabaletta (谢贝蕾妲小姐): 5 hits
  // ×1.4 power bonus with 4 healthy team members
  protected readonly formulaMap = (() => {
    const isE13 = this.constellation >= 5;
    const usherMult = (isE13 ? 0.1267 : 0.1073) * 1.4;
    const chevalmarinMult = (isE13 ? 0.0687 : 0.0582) * 1.4;
    const crabalettaMult = (isE13 ? 0.1761 : 0.1492) * 1.4;
    const hydroTag = {
      element: "Hydro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "furina-salon-total": {
        label: {
          zh: "E 沙龙成员(一轮齐射)",
          en: "E Salon Members Total (Full Rotation)",
        },
        parts: [
          {
            formula: new DirectFormula(chevalmarinMult, hydroTag, "hp"),
            hits: 18,
          },
          {
            formula: new DirectFormula(usherMult, hydroTag, "hp"),
            hits: 9,
          },
          {
            formula: new DirectFormula(crabalettaMult, hydroTag, "hp"),
            hits: 5,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("neuvillette")
class Neuvillette extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    const canP1React =
      this.teamMeta.hasReaction("vaporize") ||
      this.teamMeta.hasReaction("frozen") ||
      this.teamMeta.hasReaction("electroCharged") ||
      this.teamMeta.hasReaction("bloom") ||
      this.teamMeta.hasReaction("swirl") ||
      this.teamMeta.hasReaction("crystallize");

    if (canP1React) {
      // P1: 3 stacks Past Draconic Glories → Charged deals 160% original DMG (+60%)
      buffs.push(
        new StatBuff(
          cbs(this, "P1", [
            "vaporize",
            "frozen",
            "electroCharged",
            "bloom",
            "swirl",
            "crystallize",
          ]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "baseDmg%", value: 0.6 }]
        )
      );
    }

    // P2: HP above 30% → Hydro DMG% (cap 30%). Assume near full HP → 30%
    buffs.push(
      new StatBuff(cbs(this, "P2", []), { receiver: "selfOnField" }, [
        { key: "hydro%", value: 0.3 },
      ])
    );

    // C2: 3 stacks → Charged CD +42%
    if (canP1React && this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", []),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "cd", value: 0.42 }]
        )
      );
    }

    return buffs;
  })();

  // Equitable Judgment: Lv10 14.47% HP/tick × 10 ticks = 144.7% HP
  // Lv13 (C3+ via Normal): 17.53% HP/tick × 10 = 175.3% HP
  protected readonly formulaMap = (() => {
    const tickMult = this.constellation >= 3 ? 0.1753 : 0.1447;
    return {
      "neuvillette-judgment": {
        label: { zh: "A 衡平推裁(×10)", en: "A Equitable Judgment (×10)" },
        parts: [
          {
            formula: new DirectFormula(
              tickMult,
              { element: "Hydro", ability: "charge", reaction: "none" },
              "hp"
            ),
            hits: 10,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("wriothesley")
class Wriothesley extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1/C1: Gracious Rebuke → CA DMG Bonus (50% or 200%)
      new StatBuff(
        cbs(this, "P1/C1", ["charge"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "dmg%", value: this.constellation >= 1 ? 2.0 : 0.5 }]
      ),
      // P2: Prosecution Edict (max 5 stacks * 6% = 30% ATK)
      new StatBuff(cbs(this, "P2", ["E"]), { receiver: "selfOnField" }, [
        { key: "atk%", value: 0.3 },
      ]),
    ];

    // C2: Each P2 stack gives +40% Q DMG (max 5 = 200%)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 2.0 }]
        )
      );
    }
    // C6: Gracious Rebuke +10% CR, +80% CD
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["charge"]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.8 },
          ]
        )
      );
    }

    return buffs;
  })();

  // E Enhanced N5 (Lv10 NA * Lv10 E): 670.0% * 1.703 = 1141.0%
  // E Enhanced N5 (Lv13 NA * Lv10 E): 811.9% * 1.703 = 1382.7%
  // Rebuke CA (Lv10): 275.3%
  // Rebuke CA (Lv13 C3+): 325.0%
  // C6 Rebuke CA creates additional 100% Base DMG icicle
  // Q Burst (Lv10): 5 * 228.96% + 76.32% = 1221.12%
  // Q Burst (Lv13 C5+): 5 * 270.30% + 90.10% = 1441.6%
  protected readonly formulaMap = (() => {
    const eNMult = this.constellation >= 3 ? 13.827 : 11.41;
    let cMult = this.constellation >= 3 ? 3.25 : 2.753;
    if (this.constellation >= 6) cMult *= 2; // +100% additional base DMG
    const qMult = this.constellation >= 5 ? 14.416 : 12.211;

    return {
      "wriothesley-normal": {
        label: {
          zh: "A 寒烈的惩裁·斥逐拳全套",
          en: "A Chilling Penalty N5 Combo",
        },
        parts: [
          {
            formula: new DirectFormula(eNMult, {
              element: "Cryo",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "wriothesley-charge": {
        label: { zh: "A 惩戒·凌跃拳", en: "A Rebuke: Vaulting Fist" },
        parts: [
          {
            formula: new DirectFormula(cMult, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "wriothesley-burst": {
        label: { zh: "Q 黑金狼噬(全命中)", en: "Q Darkgold Wolfbite" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("lyney")
class Lyney extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    // P2: DMG to Pyro-affected enemies +60%, +20% per Pyro teammate (excl self), cap 100%
    const pyroCount = Math.max(this.teamMeta.countByElement("Pyro") - 1, 0);
    const p2Bonus = Math.min(0.6 + pyroCount * 0.2, 1.0);
    buffs.push(
      new StatBuff(cbs(this, "P2", []), { receiver: "selfOnField" }, [
        { key: "dmg%", value: p2Bonus },
      ])
    );
    // C2: Self CD +60% (3 stacks × 20%)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", []), { receiver: "selfOnField" }, [
          { key: "cd", value: 0.6 },
        ])
      );
    }
    // C4: Pyro charged hit → enemy Pyro RES -20%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["charge"]),
          { receiver: "team", filter: { elements: ["Pyro"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }
    return buffs;
  })();

  // Prop Arrow: Lv10 311.0%, Lv13 (C3+) 367.2% (C3 boosts Normal talent)
  protected readonly formulaMap = (() => {
    const propMult = this.constellation >= 3 ? 3.672 : 3.11;
    const strikeMult = this.constellation >= 3 ? 4.505 : 3.816;
    const eMult =
      this.constellation >= 5 ? 3.553 + 1.131 * 5 : 3.01 + 0.958 * 5;

    return {
      "lyney-prop": {
        label: { zh: "隐具魔术箭伤害", en: "A Prop Arrow" },
        parts: [
          {
            formula: new DirectFormula(propMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "lyney-strike": {
        label: { zh: "礼花术弹伤害", en: "A Pyrotechnic Strike" },
        parts: [
          {
            formula: new DirectFormula(strikeMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "lyney-skill-max": {
        label: { zh: "满层E伤害", en: "E Bewildering Lights (Max Stacks)" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}
