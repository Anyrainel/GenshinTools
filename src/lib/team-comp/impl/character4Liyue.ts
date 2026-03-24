import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import {
  CharacterBase,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { cbs } from "../helpers";
import type { StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Liyue Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("lan_yan")
class LanYan extends CharacterBase {
  get buffs() {
    const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
    const teamElements = new Set(Object.values(this.teamMeta.elements));
    const presentAbsorbElements = absorbElements.filter((el) =>
      teamElements.has(el)
    );
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // C4: After Q, team EM +60 for 12s
      ...(this.constellation >= 4
        ? [
            new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
              { key: "em", value: 60 },
            ]),
          ]
        : []),
      // P2: E DMG boosted by EM×309%
      new ScalingBuff(
        cbs(this, "P2", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "em",
        "baseDmg",
        3.09
      ),
      // P2: Q DMG boosted by EM×774%
      new ScalingBuff(
        cbs(this, "P2", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "em",
        "baseDmg",
        7.74
      ),
    ];
    // P1: E Elemental Absorption → ring deals additional 50% DMG in that element (Skill DMG)
    // Absorption can only be Pyro/Hydro/Cryo/Electro; model for each present in team
    for (const el of presentAbsorbElements) {
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["skill"], elements: [el] },
          },
          [{ key: "baseDmg%", value: 0.5 }]
        )
      );
    }
    return buffs;
  }

  // E ring: Lv10 173.3%, Lv13 (C3+) 204.5%; hits 2 per ring
  // C1 adds a second Feathermoon Ring, doubling hits. C6 grants an extra E charge.
  // Q: Lv10 433.9% ×3 hits, Lv13 (C5+) 512.3% ×3 hits
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 2.045 : 1.733;
    const qMult = this.constellation >= 5 ? 5.123 : 4.339;
    // C1: 2 charges of E, but each cast still hit 1 time
    // E: propagate to 2 additional targets, but we simulate single target damage, so hit is 1
    return {
      "lanyan-skill": {
        label: { zh: "E伤害", en: "E Skill" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
            hits: 1,
          },
        ],
      },
      "lanyan-burst": {
        label: { zh: "Q伤害×3", en: "Q (×3)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 3,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (Anemo VV support)
  protected override get defaultCombo() {
    return { "lanyan-skill": 1, "lanyan-burst": 1 };
  }
}

@RegisterCharacter("gaming")
class Gaming extends CharacterBase {
  readonly buffs = [
    // P2: At ≥50% HP, Charmed Cloudstrider DMG +20%
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
      [{ key: "dmg%", value: 0.2 }]
    ),
    // C2: Healing overflow → ATK +20%
    ...(this.constellation >= 2 && this.teamMeta.hasHealer()
      ? [
          new StatBuff(cbs(this, "C2", ["heal"]), { receiver: "selfOnField" }, [
            { key: "atk%", value: 0.2 },
          ]),
        ]
      : []),
    // C6: E plunge CR +20%, CD +40%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
            [
              { key: "cr", value: 0.2 },
              { key: "cd", value: 0.4 },
            ]
          ),
        ]
      : []),
  ];

  // E Charmed Cloudstrider: Lv10 414.7%, Lv13 (C3+) 489.6% (Pyro plunge)
  // Q Man Chai Smash: Lv10 666.7%, Lv13 (C5+) 787.1% (Pyro burst)
  protected readonly formulaMap = (() => {
    const plungeMult = this.constellation >= 3 ? 4.896 : 4.147;
    const manchaiMult = this.constellation >= 5 ? 7.871 : 6.667;
    return {
      "gaming-cloudstrider": {
        label: { zh: "下落", en: "Plunge" },
        parts: [
          {
            formula: new DirectFormula(plungeMult, {
              element: "Pyro",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      "gaming-burst-manchai": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(manchaiMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: Q > 5×E plunge (Pyro plunge carry, ~12s Q window)
  protected override get defaultCombo() {
    return { "gaming-cloudstrider": 5, "gaming-burst-manchai": 1 };
  }
}

@RegisterCharacter("yaoyao")
class Yaoyao extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    if (this.constellation >= 1) {
      // C1: Active characters in radish AoE gain 15% Dendro DMG Bonus
      buffs.push(
        new StatBuff(cbs(this, "C1", ["E"]), { receiver: "teamOnField" }, [
          { key: "dendro%", value: 0.15 },
        ])
      );
    }
    if (this.constellation >= 4) {
      // C4: 0.3% of Max HP -> EM (max 120)
      buffs.push(
        new ScalingBuff(
          cbs(this, "C4", ["E", "Q"]),
          { receiver: "self" },
          [],
          "hp",
          "em",
          0.003,
          120
        )
      );
    }

    return buffs;
  })();

  // E Radish Lv10: 53.9%, Lv13 (C3+): 63.6%
  // Q Initial Lv10: 206.2%, Lv13 (C5+): 243.4%
  // Q Radish Lv10: 129.9%, Lv13 (C5+): 153.3%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 0.636 : 0.539;
    const qInitialMult = this.constellation >= 5 ? 2.434 : 2.062;
    const qRadishMult = this.constellation >= 5 ? 1.533 : 1.299;

    const dendroSkill = {
      element: "Dendro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const dendroBurst = {
      element: "Dendro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    // E: Yuegui Throwing Mode — 10 throws over 10s (1/sec)
    // C6: every 2 normal throws → 1 Mega Radish (max 2), replacing normal throw slots
    // C6: 8 normal + 2 mega = 10 total throws
    return {
      "yaoyao-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(eMult, dendroSkill),
            hits: this.constellation >= 6 ? 8 : 10,
            offField: true,
          },
          ...(this.constellation >= 6
            ? [
                {
                  formula: new DirectFormula(0.75, dendroSkill),
                  hits: 2,
                  offField: true,
                },
              ]
            : []),
        ],
      },
      // Q: initial burst hit + ~5 radishes from Jumping Mode Yuegui (unaffected by C6)
      "yaoyao-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          { formula: new DirectFormula(qInitialMult, dendroBurst) },
          {
            formula: new DirectFormula(qRadishMult, dendroBurst),
            hits: 5,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E + Q (Dendro healer/support, minimal field time)
  protected override get defaultCombo() {
    return { "yaoyao-skill": 1, "yaoyao-burst": 1 };
  }
}

@RegisterCharacter("xiangling")
class Xiangling extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Pick up chili pepper → +10% ATK
      new StatBuff(cbs(this, "P2", ["E"]), { receiver: "teamOnField" }, [
        { key: "atk%", value: 0.1 },
      ]),
    ];

    // C1: Guoba reduces Pyro RES by 15%
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "team", filter: { elements: ["Pyro"] } },
          [{ key: "resReduction%", value: 0.15 }]
        )
      );
    }
    // C6: +15% Pyro DMG during Pyronado
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "team" }, [
          { key: "pyro%", value: 0.15 },
        ])
      );
    }

    return buffs;
  })();

  // Pyronado Swings Lv10: 130%, 158%, 197%; Lv13: 153%, 187%, 233%
  // Pyronado tick: 202% (Lv10) / 238% (Lv13)
  // C0-C3 Duration 10s: ~10 ticks; C4+ Duration 14s: ~14 ticks
  protected readonly formulaMap = (() => {
    const isC3 = this.constellation >= 3;
    const swing1 = isC3 ? 1.53 : 1.3;
    const swing2 = isC3 ? 1.87 : 1.58;
    const swing3 = isC3 ? 2.33 : 1.97;
    const tickMult = isC3 ? 2.38 : 2.02;

    const pyroTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    return {
      "xiangling-pyronado-swing": {
        label: { zh: "Q 三段挥舞", en: "Q Swings" },
        parts: [
          { formula: new DirectFormula(swing1, pyroTag) },
          { formula: new DirectFormula(swing2, pyroTag) },
          { formula: new DirectFormula(swing3, pyroTag) },
        ],
      },
      "xiangling-pyronado-tick": {
        label: { zh: "Q 旋火轮", en: "Q Pyronado" },
        parts: [
          {
            formula: new DirectFormula(tickMult, pyroTag),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (off-field Pyronado sub-DPS)
  // C0-C3: ~10 ticks; C4+: ~14 ticks
  protected override get defaultCombo() {
    const ticks = this.constellation >= 4 ? 14 : 10;
    return { "xiangling-pyronado-swing": 1, "xiangling-pyronado-tick": ticks };
  }
}

const chongyunOption = {
  label: { zh: "敌人HP状态", en: "Enemy HP" },
  choices: [
    { value: "lower", label: { zh: "HP% < 重云", en: "HP% < Chongyun" } },
    { value: "higher", label: { zh: "HP% ≥ 重云", en: "HP% >= Chongyun" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("chongyun", chongyunOption)
class Chongyun extends CharacterBase {
  private readonly o = resolveOption(chongyunOption, this.option);

  readonly buffs = [
    // P1: Sword, Claymore, Polearm chars in E field get Normal ATK SPD +8%
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "teamOnField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.08 }]
    ),
    // P2: After E field disappears, enemies' Cryo RES -10% for 8s
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "team", filter: { elements: ["Cryo"] } },
      [{ key: "resReduction%", value: 0.1 }]
    ),
    // C6: Q deals +15% DMG to enemies with lower HP% than Chongyun
    ...(this.constellation >= 6 && this.o === "lower"
      ? [
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // E: Lv10 310%, Lv13 (C5+) 366%
    const eMult = this.constellation >= 5 ? 3.66 : 3.1;
    // Q: 3 blades (C6: 4), Lv10 256% each, Lv13 (C3+) 303%
    const qMult = this.constellation >= 3 ? 3.03 : 2.56;
    const blades = this.constellation >= 6 ? 4 : 3;
    return {
      "chongyun-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "chongyun-p2": {
        // P2: When E field disappears, a spirit blade strikes for 100% of E Skill DMG (Cryo)
        label: { zh: "P2 追冰剑诀", en: "Rimechaser Blade (P2)" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      ...(this.constellation >= 1
        ? {
            "chongyun-c1-blades": {
              // C1: Last hit of Normal combo releases 3 ice blades, each 50% ATK Cryo DMG
              label: { zh: "1命 普攻冰刃×3", en: "Normal Blades×3 (C1)" },
              parts: [
                {
                  formula: new DirectFormula(0.5, {
                    element: "Cryo",
                    ability: "normal",
                    reaction: "none",
                  }),
                  hits: 3,
                },
              ],
            },
          }
        : {}),
      "chongyun-burst": {
        label: { zh: "Q伤害×3", en: "Q (×3/4)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
            hits: blades,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (Cryo sub-DPS nuke, blades baked into Q)
  protected override get defaultCombo() {
    return { "chongyun-skill": 1, "chongyun-p2": 1, "chongyun-burst": 1 };
  }
}

@RegisterCharacter("xinyan")
class Xinyan extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Shield grants Physical DMG +15%
      new StatBuff(cbs(this, "P2", ["E"]), { receiver: "teamOnField" }, [
        { key: "phys%", value: 0.15 },
      ]),
    ];

    if (this.constellation >= 1) {
      // C1: After CRIT, Normal/Charged ATK SPD +12% for 5s
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["normal", "charge"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge"] },
          },
          [{ key: "atkSpd%", value: 0.12 }]
        )
      );
    }
    if (this.constellation >= 2) {
      // C2: Riff Revolution physical DMG gains +100% CRIT Rate
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["burst"], elements: ["Physical"] },
          },
          [{ key: "cr", value: 1.0 }]
        )
      );
    }
    if (this.constellation >= 4) {
      // C4: E Swing decreases Physical RES by 15%
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["E"]),
          { receiver: "team", filter: { elements: ["Physical"] } },
          [{ key: "resReduction%", value: 0.15 }]
        )
      );
    }
    // C6 ATK bonus is handled via DirectFormula extraTerm below

    return buffs;
  })();

  // E Swing DMG Lv10: 305%, Lv13 (C3+): 360%
  // CA Cyclic DMG Lv10: 123.6%
  // Q Skill DMG Lv10: 613%, Lv13 (C5+): 724%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 3.6 : 3.05;
    const qMult = this.constellation >= 5 ? 7.24 : 6.13;
    const caMult = 1.236;

    // C6: CA gains ATK equal to 50% of DEF
    const caExtraTerm =
      this.constellation >= 6
        ? { key: "def" as const, multiplier: caMult * 0.5 }
        : undefined;

    return {
      "xinyan-skill": {
        label: { zh: "E伤害", en: "E" },
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
      "xinyan-charge": {
        label: { zh: "重击循环", en: "CA Cyclic" },
        parts: [
          {
            formula: new DirectFormula(
              caMult,
              { element: "Physical", ability: "charge", reaction: "none" },
              "atk",
              caExtraTerm
            ),
          },
        ],
      },
      "xinyan-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Physical",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E > Q > 5×CA (physical carry with shield)
  protected override get defaultCombo() {
    return { "xinyan-skill": 1, "xinyan-burst": 1, "xinyan-charge": 5 };
  }
}

@RegisterCharacter("xingqiu")
class Xingqiu extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Xingqiu gains a 20% Hydro DMG Bonus (permanent passive)
      new StatBuff(cbs(this, "P2", ["passive"]), { receiver: "self" }, [
        { key: "hydro%", value: 0.2 },
      ]),
    ];

    // C2: Rain Swords decrease enemies' Hydro RES by 15%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "team", filter: { elements: ["Hydro"] } },
          [{ key: "resReduction%", value: 0.15 }]
        )
      );
    }

    if (this.constellation >= 4) {
      // C4: During Q, E DMG +50% ("画雨笼山造成的伤害提升50%")
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "baseDmg%", value: 0.5 }]
        )
      );
    }

    return buffs;
  })();

  // E Skill (Lv10): 302% + 344%; (Lv13 C5+): 357% + 406%
  // Raincutter Sword Rain DMG (Lv10): 97.7%
  // Raincutter Sword Rain DMG (Lv13 C3+): 115.3%
  protected readonly formulaMap = (() => {
    const eHit1 = this.constellation >= 5 ? 3.57 : 3.02;
    const eHit2 = this.constellation >= 5 ? 4.06 : 3.44;

    const qMult = this.constellation >= 3 ? 1.153 : 0.977;

    const hydroSkillTag = {
      element: "Hydro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };

    return {
      "xingqiu-skill": {
        label: { zh: "E伤害", en: "E (2 hits)" },
        parts: [
          { formula: new DirectFormula(eHit1, hydroSkillTag) },
          { formula: new DirectFormula(eHit2, hydroSkillTag) },
        ],
      },
      "xingqiu-burst-tick": {
        label: { zh: "Q伤害(单次)", en: "Q (×1)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: EQ > ~15 rain sword procs (off-field Hydro sub-DPS, 1 proc/sec over 15s Q)
  protected override get defaultCombo() {
    return { "xingqiu-skill": 1, "xingqiu-burst-tick": 15 };
  }
}

const yanfeiOption = {
  label: { zh: "敌人HP状态", en: "Enemy HP" },
  choices: [
    { value: "below-50", label: { zh: "HP < 50%", en: "HP < 50%" } },
    { value: "above-50", label: { zh: "HP ≥ 50%", en: "HP ≥ 50%" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("yanfei", yanfeiOption)
class Yanfei extends CharacterBase {
  private readonly o = resolveOption(yanfeiOption, this.option);

  readonly buffs = (() => {
    const maxSeals = this.constellation >= 6 ? 4 : 3;
    const buffs: StatBuff[] = [
      // P1: Each consumed Scarlet Seal grants 5% Pyro DMG Bonus (assuming max seals used)
      new StatBuff(cbs(this, "P1", ["A1"]), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.05 * maxSeals },
      ]),
    ];

    // Q: Brilliance grants Charged Attack DMG bonus
    // Lv10: 54%, Lv13 (C5+): 62%
    buffs.push(
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "dmg%", value: this.constellation >= 5 ? 0.62 : 0.54 }]
      )
    );

    if (this.constellation >= 2 && this.o === "below-50") {
      // C2: CA CRIT Rate +20% vs enemies below 50% HP
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["charge"]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "cr", value: 0.2 }]
        )
      );
    }
    return buffs;
  })();

  // E Lv10: 305%, Lv13 (C3+): 360%
  // Q Lv10: 328%, Lv13 (C5+): 388%
  // CA Max Seals Lv10: 245% (3 seals), 273% (4 seals)
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 3.6 : 3.05;
    const qMult = this.constellation >= 5 ? 3.88 : 3.28;
    const caMult = this.constellation >= 6 ? 2.73 : 2.45;

    return {
      "yanfei-charge": {
        label: {
          zh: "重击",
          en: "CA",
        },
        parts: [
          {
            formula: new DirectFormula(caMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
          // P2: CA CRIT hit deals extra 80% ATK as CA DMG
          {
            formula: new DirectFormula(0.8, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "yanfei-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "yanfei-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
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

  // Rotation: E > Q > 6×N3C (Pyro on-field carry, vape)
  protected override get defaultCombo() {
    return { "yanfei-skill": 2, "yanfei-burst": 1, "yanfei-charge": 6 };
  }
}

@RegisterCharacter("beidou")
class Beidou extends CharacterBase {
  readonly buffs = [
    // P2: After max-counter E, Normal/Charged DMG +15% and ATK SPD +15% for 10s
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal", "charge"] } },
      [
        { key: "dmg%", value: 0.15 },
        { key: "atkSpd%", value: 0.15 },
      ]
    ),
    // C6: During Q, enemies' Electro RES -15%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: ["Electro"] } },
            [{ key: "resReduction%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // Q Lightning DMG: Lv10 173%, Lv13 (C5+) 204%
    const qMult = this.constellation >= 5 ? 2.04 : 1.73;
    // E Max-Counter: Base + 2×(DMG Bonus on Hit Taken)
    // Lv10: Base 218.88%, Hit Bonus 288%; Lv13 (C3+): Base 258.4%, Hit Bonus 340%
    const eBaseMult = this.constellation >= 3 ? 2.584 : 2.1888;
    const eHitBonusMult = this.constellation >= 3 ? 3.4 : 2.88;
    const electroSkillTag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "beidou-skill-counter": {
        label: { zh: "E(满格反击)", en: "E Full Counter" },
        parts: [
          { formula: new DirectFormula(eBaseMult, electroSkillTag) },
          {
            formula: new DirectFormula(eHitBonusMult, electroSkillTag),
            hits: 2,
          },
        ],
      },
      "beidou-burst-lightning": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E counter > Q (~10 lightning discharges over 15s, 1/sec)
  protected override get defaultCombo() {
    return { "beidou-skill-counter": 1, "beidou-burst-lightning": 10 };
  }
}

@RegisterCharacter("ningguang")
class Ningguang extends CharacterBase {
  readonly buffs = [
    // P2: Passing through Jade Screen → Geo DMG +12% (only on-field character walks through)
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "teamOnField", filter: { elements: ["Geo"] } },
      [{ key: "geo%", value: 0.12 }]
    ),
  ];

  // E: Lv10 415%, Lv13 (C5+) 490%
  // Q: 12 gems Lv10 157%×12 = 1884%, Lv13 (C3+) 185%×12 = 2220%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 4.9 : 4.15;
    const qGemMult = this.constellation >= 3 ? 1.85 : 1.57;
    return {
      "ningguang-skill": {
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
      "ningguang-burst": {
        label: { zh: "Q伤害×12", en: "Q (×12)" },
        parts: [
          {
            formula: new DirectFormula(qGemMult, {
              element: "Geo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 12,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (Geo burst DPS, gems baked into Q ×12)
  protected override get defaultCombo() {
    return { "ningguang-skill": 2, "ningguang-burst": 1 };
  }
}

@RegisterCharacter("yun_jin")
class YunJin extends CharacterBase {
  readonly buffs = (() => {
    const qLevel = this.constellation >= 3 ? 13 : 10;
    const qBaseScale = qLevel === 13 ? 0.68 : 0.58;

    const elements = new Set(Object.values(this.teamMeta.elements));
    const count = elements.size;
    const p2Scales = [0, 0.025, 0.05, 0.075, 0.115];
    const p2Scale = p2Scales[Math.min(count, 4)] ?? 0;

    const totalQScale = qBaseScale + p2Scale;

    const buffs: StatBuff[] = [];

    // Q + P2: Adds Base DMG based on Yun Jin's DEF to team's Normal Attacks
    // Trigger Quota: 30 per character, independently counted
    // ("队伍中具有「飞云旗阵」的角色，其生效次数单独计算")
    for (const charId of Object.keys(this.teamMeta.elements)) {
      buffs.push(
        new ScalingBuff(
          { ...cbs(this, "P2", ["A4", "Q"]), maxStacks: 30 },
          { receiver: "team", charId, filter: { abilities: ["normal"] } },
          [],
          "def",
          "baseDmg",
          totalQScale
        )
      );
    }

    if (this.constellation >= 2) {
      // C2: +15% Normal Attack DMG to team
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "team", filter: { abilities: ["normal"] } },
          [{ key: "dmg%", value: 0.15 }]
        )
      );
    }
    if (
      this.constellation >= 4 &&
      (this.teamMeta.hasReaction("crystallize") ||
        this.teamMeta.hasReaction("lunarCrystallize"))
    ) {
      // C4: Crystallize/Lunar-Crystallize grants +20% DEF
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["crystallize", "lunarCrystallize"]),
          { receiver: "self" },
          [{ key: "def%", value: 0.2 }]
        )
      );
    }
    if (this.constellation >= 6) {
      // C6: Normal ATK SPD +12% under Q
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "team", filter: { abilities: ["normal"] } },
          [{ key: "atkSpd%", value: 0.12 }]
        )
      );
    }
    return buffs;
  })();

  // E Press DMG Lv10: 268.4% DEF, Lv13: 316.9% DEF
  // E Charge 1 DMG Lv10: 469.7% DEF, Lv13: 554.5% DEF
  // E Charge 2 DMG Lv10: 671.0% DEF, Lv13: 792.2% DEF
  // Q Skill DMG Lv10: 439%, Lv13: 518%
  protected readonly formulaMap = (() => {
    const eLevel = this.constellation >= 5 ? 13 : 10;
    const qLevel = this.constellation >= 3 ? 13 : 10;

    const ePressMult = eLevel === 13 ? 3.169 : 2.684;
    const eCharge1Mult = eLevel === 13 ? 5.545 : 4.697;
    const eCharge2Mult = eLevel === 13 ? 7.922 : 6.71;

    const qMult = qLevel === 13 ? 5.18 : 4.39;

    return {
      "yun_jin-skill-press": {
        label: { zh: "E点按", en: "E Tap" },
        parts: [
          {
            formula: new DirectFormula(
              ePressMult,
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
          },
        ],
      },
      "yun_jin-skill-charge1": {
        label: { zh: "E一蓄", en: "E Hold (Level 1)" },
        parts: [
          {
            formula: new DirectFormula(
              eCharge1Mult,
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
          },
        ],
      },
      "yun_jin-skill-charge2": {
        label: { zh: "E二蓄", en: "E Hold (Level 2)" },
        parts: [
          {
            formula: new DirectFormula(
              eCharge2Mult,
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
          },
        ],
      },
      "yun_jin-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            // Q Initial hit is ATK scaled
            formula: new DirectFormula(qMult, {
              element: "Geo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E hold (max charge) > Q (Geo support, buffs normal attackers)
  protected override get defaultCombo() {
    return { "yun_jin-skill-charge2": 1, "yun_jin-burst": 1 };
  }
}
