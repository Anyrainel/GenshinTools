import {
  ScalingBuff,
  ScalingSkillBuff,
  StatBuff,
  StaticSkillBuff,
} from "../damageBuffs";
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
} from "../damageModels";
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
        cbs(this, ["E", "Q"], "P2"),
        { receiver: "onField", filter: { elements: ["Hydro", "Cryo"] } },
        [{ key: "resReduction%", value: shred }]
      ),
    ];
    // C1: All 4 Hydro/Cryo → team Cryo DMG CD +60%
    if (this.constellation >= 1 && this.hydroCryo >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, ["E", "Q"], "C1"),
          { receiver: "team", filter: { elements: ["Cryo"] } },
          [{ key: "cd", value: 0.6 }]
        )
      );
    }
    // C2: Cold Storage → on-field (others) Cryo DMG gets baseDmg from Escoffier's ATK ×240%
    if (this.constellation >= 2) {
      buffs.push(
        new ScalingBuff(
          cbs(this, ["E"], "C2"),
          { receiver: "onField", filter: { elements: ["Cryo"] } },
          [],
          "atk",
          "baseDmg",
          2.4
        )
      );
    }
    return buffs;
  })();

  // E: Frosty Parfait Lv10: 216.0%, Lv13 (C3+): 255.0%, ~6 ticks over 20s
  // Q: Scoring Cuts Lv10: 1067.0%, Lv13 (C5+): 1259.7%
  // C6: Special Parfait 500% ATK ×6 (skill DMG)
  protected readonly formulaMap = (() => {
    const parfaitMult = this.constellation >= 3 ? 2.55 : 2.16;
    const qMult = this.constellation >= 5 ? 12.597 : 10.67;
    const formulas: Record<string, FormulaEntry> = {
      "escoffier-skill-parfait": {
        label: { zh: "冻霜芭菲连击", en: "Frosty Parfait Ticks (×6)" },
        parts: [
          {
            formula: new DirectFormula(parfaitMult, {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
            hits: 6,
          },
        ],
      },
      "escoffier-burst": {
        label: { zh: "花刀技法", en: "Scoring Cuts" },
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
    // C6: Special-Grade Frosty Parfait 500% ATK ×6
    if (this.constellation >= 6) {
      formulas["escoffier-c6-parfait"] = {
        label: { zh: "特级冻霜芭菲", en: "C6 Special Parfait (×6)" },
        parts: [
          {
            formula: new DirectFormula(5.0, {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
            hits: 6,
          },
        ],
      };
    }
    return formulas;
  })();
}

@RegisterCharacter("emilie")
class Emilie extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<
      typeof StatBuff | typeof StaticSkillBuff | typeof ScalingBuff
    >[] = [
      // P2: vs Burning enemies, per 1000 ATK → DMG +15% (cap 36%)
      new ScalingBuff(
        cbs(this, [], "P2"),
        { receiver: "selfOnField" },
        [],
        "atk",
        "dmg%",
        0.00015,
        0.36
      ),
      // C1: E and P1 Cleardew DMG +20%
      new StaticSkillBuff(
        cbs(this, ["E"], "C1"),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        this.constellation,
        (c) => (c >= 1 ? [{ key: "dmg%", value: 0.2 }] : [])
      ),
      // C2: E/Q/Cleardew hit → enemies' Dendro RES -30%
      new StaticSkillBuff(
        cbs(this, ["E", "Q"], "C2"),
        { receiver: "onField", filter: { elements: ["Dendro"] } },
        this.constellation,
        (c) => (c >= 2 ? [{ key: "resReduction%", value: 0.3 }] : [])
      ),
      // C6: After E/Q, Normal/Charged become Dendro + baseDmg from ATK ×300%
      new StaticSkillBuff(
        cbs(this, ["E"], "C6"),
        {
          receiver: "selfOnField",
          filter: { abilities: ["normal", "charge"] },
        },
        this.constellation,
        (c) => (c >= 6 ? [{ key: "baseDmg%", value: 3.0 }] : [])
      ),
    ];
    return buffs;
  })();

  // E Lv2 Case: 151.2%×2 per tick (Lv10), 178.5%×2 (Lv13 C3+), ~7 ticks over 22s
  // P1 Cleardew Cologne: 600% ATK (not skill DMG), fires every 2 scent collections
  // Q Lv3 Case: 391.0% (Lv10), 461.6% (Lv13 C5+), ~4 drops over 2.8s
  protected readonly formulaMap = (() => {
    const lv2TickMult = this.constellation >= 3 ? 1.785 * 2 : 1.512 * 2;
    const qMult = this.constellation >= 5 ? 4.616 : 3.91;
    return {
      "emilie-skill-lv2": {
        label: { zh: "柔灯之匣·二阶连击", en: "Lv2 Case Ticks (×7)" },
        parts: [
          {
            formula: new DirectFormula(lv2TickMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 7,
          },
        ],
      },
      "emilie-cleardew": {
        label: { zh: "清露香氛", en: "Cleardew Cologne" },
        parts: [
          {
            formula: new DirectFormula(6.0, {
              element: "Dendro",
              ability: "special",
              reaction: "none",
            }),
          },
        ],
      },
      "emilie-burst": {
        label: { zh: "香氛演绎总伤", en: "Aromatic Explication Total" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Dendro",
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

@RegisterCharacter("sigewinne")
class Sigewinne extends CharacterBase {
  readonly buffs = (() => {
    const isC1 = this.constellation >= 1;
    const buffs: StatBuff[] = [
      // P1: HP > 30k → E baseDmg +80 (C1: 100) per 1000 HP. Max 2800 (C1: 3500)
      new ScalingBuff(
        cbs(this, ["E"], "P1"),
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
          cbs(this, ["E", "Q"], "C2"),
          { receiver: "onField", filter: { elements: ["Hydro"] } },
          [{ key: "resReduction%", value: 0.35 }]
        )
      );
    }

    // C6: HP → Q CR+20%, CD+110% (0.4% CR, 2.2% CD per 1000 HP)
    if (this.constellation >= 6) {
      buffs.push(
        new ScalingBuff(
          cbs(this, ["Q"], "C6"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "hp",
          "cr",
          0.000004,
          0.2
        ),
        new ScalingBuff(
          cbs(this, ["Q"], "C6"),
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

  // E Bubble DMG Lv10: 4.10% HP × 5 bounces
  // Lv13 (C3+): 4.84% HP × 5
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 0.0484 : 0.041;
    return {
      "sigewinne-skill": {
        label: { zh: "激愈水球(×5)", en: "Bolstering Bubblebalm (×5)" },
        parts: [
          {
            formula: new DirectFormula(
              0,
              { element: "Hydro", ability: "skill", reaction: "none" },
              "atk",
              { key: "hp", multiplier: eMult }
            ),
            hits: 5,
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
    new ScalingSkillBuff(
      cbs(this, ["E"], "P1"),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "burst"], elements: ["Electro"] },
      },
      [],
      "atk",
      "baseDmg",
      this.constellation,
      (c) => ({ scale: c >= 2 ? 0.9 : 0.6 })
    ),
    // P2: BoL ≥100% + changes → CR +10% × 2 stacks = +20%
    new StatBuff(cbs(this, ["E"], "P2"), { receiver: "selfOnField" }, [
      { key: "cr", value: 0.2 },
    ]),
    // C4: Q DMG +2% per 1% BoL (max 200%) — at full BoL ~120%+
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "dmg%", value: 2.0 }] : [])
    ),
    // C6: After E, +10% CR, +70% CD for 12s
    new StaticSkillBuff(
      cbs(this, ["E"], "C6"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) =>
        c >= 6
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
    // Lv10 total: 76.7×3 + 49.6×3 = 378.9%; Lv13 (C3+): 92.9×3 + 60.2×3 = 459.3%
    const nMult = this.constellation >= 3 ? 4.593 : 3.789;
    return {
      "clorinde-normal": {
        label: { zh: "夜巡连段", en: "Night Vigil Rotation" },
        parts: [
          {
            formula: new DirectFormula(nMult, {
              element: "Electro",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "clorinde-normal-aggravate": {
        label: { zh: "夜巡连段(超激化)", en: "Night Vigil (Aggravate)" },
        parts: [
          {
            formula: new AmplifyFormula(nMult, {
              element: "Electro",
              ability: "normal",
              reaction: "aggravate",
            }),
          },
        ],
      },
      "clorinde-burst": {
        label: { zh: "残光将终", en: "Last Lightfall" },
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
    const buffs: InstanceType<typeof StatBuff | typeof StaticSkillBuff>[] = [];
    // P1: After E, self Normal/Charged/Plunge DMG +40%
    buffs.push(
      new StatBuff(
        cbs(this, ["E"], "P1"),
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
      new StatBuff(cbs(this, [], "P2"), { receiver: "selfOnField" }, [
        { key: "atk%", value: Math.min(nonGeoCount, 2) * 0.2 },
      ])
    );
    // C2: 3 shrapnel → E CR +36%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C2"),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "cr", value: 0.36 }]
        )
      );
    }
    // C4: Q hit → enemy Geo RES -20%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C4"),
          { receiver: "onField", filter: { elements: ["Geo"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }
    // C6: 3 extra shrapnel → E CD +135% (45% × 3)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C6"),
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
        label: { zh: "典仪式晶火(6弹片)", en: "Crystalshot (6 shrapnel)" },
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
      cbs(this, ["E"], "P2"),
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
    new StaticSkillBuff(
      cbs(this, ["Q"]),
      { receiver: "team" },
      this.constellation,
      (c) => {
        const perStack = c >= 3 ? 0.0031 : 0.0025;
        const maxStacks = c >= 1 ? 400 : 300;
        const avgStacks = Math.min(250, maxStacks);
        return [{ key: "dmg%", value: perStack * avgStacks }];
      }
    ),
    // C2: Fanfare overflow → HP% buff (0.35% per point, cap 140%)
    new StaticSkillBuff(
      cbs(this, [], "C2"),
      { receiver: "self" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "hp%", value: 1.4 }] : [])
    ),
  ];

  // E Salon Members: scale with HP, ~10 ticks over 30s, ×1.4 power bonus
  // Combined per tick Lv10: 31.47% HP, Lv13 (C5+): 37.15% HP
  // ×1.4 (4 members) = 44.06% / 52.01% per tick
  protected readonly formulaMap = (() => {
    const combinedTick =
      this.constellation >= 5
        ? (0.1267 + 0.0687 + 0.1761) * 1.4
        : (0.1073 + 0.0582 + 0.1492) * 1.4;
    return {
      "furina-salon-total": {
        label: { zh: "沙龙成员(×10)", en: "Salon Members Total (×10)" },
        parts: [
          {
            formula: new DirectFormula(
              combinedTick,
              {
                element: "Hydro",
                ability: "skill",
                reaction: "none",
              },
              "hp"
            ),
            hits: 10,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("neuvillette")
class Neuvillette extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof StaticSkillBuff>[] = [];

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
          cbs(
            this,
            [
              "vaporize",
              "frozen",
              "electroCharged",
              "bloom",
              "swirl",
              "crystallize",
            ],
            "P1"
          ),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "baseDmg%", value: 0.6 }]
        )
      );
    }

    // P2: HP above 30% → Hydro DMG% (cap 30%). Assume near full HP → 30%
    buffs.push(
      new StatBuff(cbs(this, [], "P2"), { receiver: "selfOnField" }, [
        { key: "hydro%", value: 0.3 },
      ])
    );

    // C2: 3 stacks → Charged CD +42%
    if (canP1React && this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, [], "C2"),
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
        label: { zh: "衡平推裁(×10)", en: "Equitable Judgment (×10)" },
        parts: [
          {
            formula: new DirectFormula(
              0,
              { element: "Hydro", ability: "charge", reaction: "none" },
              "atk",
              { key: "hp", multiplier: tickMult }
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
        cbs(this, ["charge"], "P1/C1"),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "dmg%", value: this.constellation >= 1 ? 2.0 : 0.5 }]
      ),
      // P2: Prosecution Edict (max 5 stacks * 6% = 30% ATK)
      new StatBuff(cbs(this, ["E"], "P2"), { receiver: "selfOnField" }, [
        { key: "atk%", value: 0.3 },
      ]),
    ];

    // C2: Each P2 stack gives +40% Q DMG (max 5 = 200%)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C2"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 2.0 }]
        )
      );
    }
    // C6: Gracious Rebuke +10% CR, +80% CD
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, ["charge"], "C6"),
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
        label: { zh: "寒烈的惩裁·斥逐拳全套", en: "Chilling Penalty N5 Combo" },
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
        label: { zh: "惩戒·凌跃拳", en: "Rebuke: Vaulting Fist" },
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
        label: { zh: "黑金狼噬(全命中)", en: "Darkgold Wolfbite" },
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
    const buffs: InstanceType<typeof StatBuff | typeof StaticSkillBuff>[] = [];
    // P2: DMG to Pyro-affected enemies +60%, +20% per Pyro teammate (excl self), cap 100%
    const pyroCount = Math.max(this.teamMeta.countByElement("Pyro") - 1, 0);
    const p2Bonus = Math.min(0.6 + pyroCount * 0.2, 1.0);
    buffs.push(
      new StatBuff(cbs(this, [], "P2"), { receiver: "selfOnField" }, [
        { key: "dmg%", value: p2Bonus },
      ])
    );
    // C2: Self CD +60% (3 stacks × 20%)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, [], "C2"), { receiver: "selfOnField" }, [
          { key: "cd", value: 0.6 },
        ])
      );
    }
    // C4: Pyro charged hit → enemy Pyro RES -20%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, ["charge"], "C4"),
          { receiver: "onField", filter: { elements: ["Pyro"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
    }
    return buffs;
  })();

  // Prop Arrow: Lv10 311.0%, Lv13 (C3+) 367.2% (C3 boosts Normal talent)
  protected readonly formulaMap = (() => {
    const propMult = this.constellation >= 3 ? 3.672 : 3.11;
    return {
      "lyney-prop": {
        label: { zh: "隐具魔术箭", en: "Prop Arrow" },
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
      "lyney-prop-vape": {
        label: { zh: "隐具魔术箭(蒸发)", en: "Prop Arrow (Vape)" },
        parts: [
          {
            formula: new DirectFormula(propMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "vaporize",
            }),
          },
        ],
      },
    };
  })();
}
