import { ScalingBuff, StatBuff, StaticSkillBuff } from "../damageBuffs";
import { AmplifyFormula, DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Liyue Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("lan_yan")
class LanYan extends CharacterBase {
  readonly buffs = [
    // C4: After Q, team EM +60 for 12s
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "team" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "em", value: 60 }] : [])
    ),
    // P2: E DMG boosted by EM×309%
    new ScalingBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      3.09
    ),
    // P2: Q DMG boosted by EM×774%
    new ScalingBuff(
      cbs(this, ["Q"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [],
      "em",
      "baseDmg",
      7.74
    ),
  ];

  // E ring: Lv10 173.3%×2 = 346.6%, Lv13 (C3+) 204.5%×2 = 409%
  // Q: Lv10 433.9%×3, Lv13 (C5+) 512.3%×3
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 2.045 * 2 : 1.733 * 2;
    const qMult = this.constellation >= 5 ? 5.123 * 3 : 4.339 * 3;
    return {
      "lanyan-skill": {
        label: { zh: "凤缕随翦舞", en: "Swallow-Wisp (rings ×2)" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "lanyan-burst": {
        label: { zh: "鹍弦踏月出(×3)", en: "Lustrous Moonrise (×3)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("gaming")
class Gaming extends CharacterBase {
  readonly buffs = [
    // P2: At ≥50% HP, Charmed Cloudstrider DMG +20%
    new StatBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
      [{ key: "dmg%", value: 0.2 }]
    ),
    // C2: Healing overflow → ATK +20%
    new StaticSkillBuff(
      cbs(this, [], "C2"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "atk%", value: 0.2 }] : [])
    ),
    // C6: E plunge CR +20%, CD +40%
    new StaticSkillBuff(
      cbs(this, [], "C6"),
      { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
      this.constellation,
      (c) =>
        c >= 6
          ? [
              { key: "cr", value: 0.2 },
              { key: "cd", value: 0.4 },
            ]
          : []
    ),
  ];

  // E Charmed Cloudstrider: Lv10 414.7%, Lv13 (C3+) 489.6% (Pyro plunge)
  // Q Man Chai: Lv10 666.7%, Lv13 (C5+) 787.1%
  protected readonly formulaMap = (() => {
    const plungeMult = this.constellation >= 3 ? 4.896 : 4.147;
    const qMult = this.constellation >= 5 ? 7.871 : 6.667;
    return {
      "gaming-cloudstrider": {
        label: { zh: "踏云献瑞", en: "Charmed Cloudstrider" },
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
      "gaming-burst": {
        label: { zh: "文仔砸击", en: "Man Chai Smash" },
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

@RegisterCharacter("yaoyao")
class Yaoyao extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    if (this.constellation >= 1) {
      // C1: Active characters in radish AoE gain 15% Dendro DMG Bonus
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C1"), { receiver: "onField" }, [
          { key: "dendro%", value: 0.15 },
        ])
      );
    }
    if (this.constellation >= 4) {
      // C4: 0.3% of Max HP -> EM (max 120)
      buffs.push(
        new ScalingBuff(
          cbs(this, ["E", "Q"], "C4"),
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

    return {
      "yaoyao-skill": {
        label: { zh: "白玉萝卜(单次)", en: "White Jade Radish" },
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
      "yaoyao-burst": {
        label: { zh: "技能伤害", en: "Moonjade Descent (Initial)" },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "yaoyao-burst-radish": {
        label: { zh: "桂子仙机白玉萝卜(单次)", en: "Adeptal Legacy Radish" },
        parts: [
          {
            formula: new DirectFormula(qRadishMult, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      ...(this.constellation >= 6
        ? {
            "yaoyao-c6-radish": {
              label: { zh: "超厉害·大萝卜", en: "Mega Radish (C6)" },
              parts: [
                {
                  formula: new DirectFormula(0.75, {
                    element: "Dendro",
                    ability: "skill", // Yuegui Throwing Mode throws it, so it's a skill
                    reaction: "none",
                  }),
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("xiangling")
class Xiangling extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Pick up chili pepper → +10% ATK
      new StatBuff(cbs(this, ["E"], "P2"), { receiver: "onField" }, [
        { key: "atk%", value: 0.1 },
      ]),
    ];

    // C1: Guoba reduces Pyro RES by 15%
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C1"), { receiver: "team" }, [
          { key: "resReduction%", value: 0.15 },
        ])
      );
    }
    // C6: +15% Pyro DMG during Pyronado
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C6"), { receiver: "team" }, [
          { key: "pyro%", value: 0.15 },
        ])
      );
    }

    return buffs;
  })();

  // Pyronado Swings Lv10: 130 + 158 + 197 = 485%
  // Pyronado Swings Lv13: 153 + 187 + 233 = 573%
  // Pyronado tick: 202% (Lv10) / 238% (Lv13)
  // C0-C3 Duration 10s: ~10 hits
  // C4+ Duration 14s: ~14 hits
  protected readonly formulaMap = (() => {
    const ticks = this.constellation >= 4 ? 14 : 10;
    const baseMult = this.constellation >= 3 ? 573.0 : 485.0;
    const tickMult = this.constellation >= 3 ? 238.0 : 202.0;
    const totalMult = baseMult + ticks * tickMult;

    return {
      "xiangling-pyronado": {
        label: { zh: "旋火轮及挥舞(总伤)", en: "Pyronado Total" },
        parts: [
          {
            formula: new DirectFormula(totalMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "xiangling-pyronado-vape": {
        label: { zh: "旋火轮及挥舞(全蒸发)", en: "Pyronado Total (Vape)" },
        parts: [
          {
            formula: new AmplifyFormula(totalMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "vaporize",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("chongyun")
class Chongyun extends CharacterBase {
  readonly buffs = [
    // P1: Sword, Claymore, Polearm chars in E field get Normal ATK SPD +8%
    new StatBuff(
      cbs(this, ["E"], "P1"),
      { receiver: "onField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.08 }]
    ),
    // P2: After E field disappears, enemies' Cryo RES -10% for 8s
    new StatBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "onField", filter: { elements: ["Cryo"] } },
      [{ key: "resReduction%", value: 0.1 }]
    ),
    // C6: Q deals +15% DMG to low-HP enemies
    new StaticSkillBuff(
      cbs(this, ["Q"], "C6"),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "dmg%", value: 0.15 }] : [])
    ),
  ];

  protected readonly formulaMap = (() => {
    // Q: 3 blades (C6: 4), Lv10 256% each, Lv13 (C3+) 303%
    const qMult = this.constellation >= 3 ? 3.03 : 2.56;
    const blades = this.constellation >= 6 ? 4 : 3;
    return {
      "chongyun-burst": {
        label: { zh: "灵刃·云开星落", en: "Cloud-Parting Star" },
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
}

@RegisterCharacter("xinyan")
class Xinyan extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Shield grants Physical DMG +15%
      new StatBuff(cbs(this, ["E"], "P2"), { receiver: "onField" }, [
        { key: "phys%", value: 0.15 },
      ]),
    ];

    if (this.constellation >= 2) {
      // C2: Riff Revolution physical DMG gains +100% CRIT Rate
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C2"),
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
          cbs(this, ["E"], "C4"),
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
        label: { zh: "热情拂扫(挥舞伤害)", en: "Sweeping Fervor (Swing)" },
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
        label: { zh: "重击循环伤害", en: "Charged ATK Cyclic DMG" },
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
        label: { zh: "叛逆刮弦(物理伤害)", en: "Riff Revolution (Physical)" },
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
}

@RegisterCharacter("xingqiu")
class Xingqiu extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: Xingqiu gains a 20% Hydro DMG Bonus
      new StatBuff(cbs(this, ["P2"]), { receiver: "self" }, [
        { key: "hydro%", value: 0.2 },
      ]),
    ];

    // C2: Rain Swords decrease Hydro RES by 15%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C2"), { receiver: "team" }, [
          { key: "resReduction%", value: 0.15 },
        ])
      );
    }

    return buffs;
  })();

  // E Skill (Lv10): 302% + 344% = 646.0%
  // E Skill (Lv13 C5+): 357% + 406% = 763.0%
  // C4 multiplies E DMG by 1.5x during Q (applied directly to multiplier)
  // Raincutter Sword Rain DMG (Lv10): 97.7%
  // Raincutter Sword Rain DMG (Lv13 C3+): 115.0%
  protected readonly formulaMap = (() => {
    let eMult = this.constellation >= 5 ? 7.63 : 6.46;
    if (this.constellation >= 4) eMult *= 1.5;

    const qMult = this.constellation >= 3 ? 1.15 : 0.977;
    const totalHits = this.constellation >= 6 ? 56 : 50;

    return {
      "xingqiu-skill": {
        label: { zh: "画雨笼山(双击总和)", en: "Fatal Rainscreen" },
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
      "xingqiu-burst-tick": {
        label: { zh: "裁雨留虹(单支)", en: "Raincutter (Per Sword)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "xingqiu-burst-total": {
        label: { zh: "裁雨留虹(总伤害)", en: "Raincutter (Total)" },
        parts: [
          {
            formula: new DirectFormula(qMult * totalHits, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("yanfei")
class Yanfei extends CharacterBase {
  readonly buffs = (() => {
    const maxSeals = this.constellation >= 6 ? 4 : 3;
    const buffs: StatBuff[] = [
      // P1: Each consumed Scarlet Seal grants 5% Pyro DMG Bonus (assuming max seals used)
      new StatBuff(cbs(this, ["A1"], "P1"), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.05 * maxSeals },
      ]),
    ];

    // Q: Brilliance grants Charged Attack DMG bonus
    // Lv10: 54%, Lv13 (C5+): 62%
    buffs.push(
      new StaticSkillBuff(
        cbs(this, ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        this.constellation,
        (c) => [{ key: "dmg%", value: c >= 5 ? 0.62 : 0.54 }]
      )
    );

    if (this.constellation >= 2) {
      // C2: CA CRIT Rate +20% (assuming enemy below 50% HP)
      buffs.push(
        new StatBuff(
          cbs(this, ["charge"], "C2"),
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
          zh: "满印重击(含法兽灼眼)",
          en: "Max Seals Charged ATK (incl. P2)",
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
        label: { zh: "丹书立约", en: "Signed Edict" },
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
        label: { zh: "凭此结契", en: "Done Deal" },
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

@RegisterCharacter("beidou")
class Beidou extends CharacterBase {
  readonly buffs = [
    // P2: After max-counter E, Normal/Charged DMG +15% and ATK SPD +15% for 10s
    new StatBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["normal", "charge"] } },
      [
        { key: "dmg%", value: 0.15 },
        { key: "atkSpd%", value: 0.15 },
      ]
    ),
    // C6: During Q, enemies' Electro RES -15%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C6"),
      { receiver: "onField", filter: { elements: ["Electro"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "resReduction%", value: 0.15 }] : [])
    ),
  ];

  protected readonly formulaMap = (() => {
    // Q Lightning DMG: Lv10 173%, Lv13 (C5+) 204%
    const qMult = this.constellation >= 5 ? 2.04 : 1.73;
    return {
      "beidou-burst-lightning": {
        label: { zh: "斫雷闪雷", en: "Stormbreaker Lightning" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("ningguang")
class Ningguang extends CharacterBase {
  readonly buffs = [
    // P2: Passing through Jade Screen → Geo DMG +12%
    new StatBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "team", filter: { elements: ["Geo"] } },
      [{ key: "dmg%", value: 0.12 }]
    ),
  ];

  // E: Lv10 415%, Lv13 (C5+) 490%
  // Q: 12 gems Lv10 157%×12 = 1884%, Lv13 (C3+) 185%×12 = 2220%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 4.9 : 4.15;
    const qGemMult = this.constellation >= 3 ? 1.85 : 1.57;
    return {
      "ningguang-skill": {
        label: { zh: "璇玑屏", en: "Jade Screen" },
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
        label: { zh: "天权崩玉(12宝石)", en: "Starshatter (12 gems)" },
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

    const buffs: StatBuff[] = [
      // Q + P2: Adds Base DMG based on Yun Jin's DEF to team's Normal Attacks
      new ScalingBuff(
        cbs(this, ["A4", "Q"], "P2"),
        { receiver: "team", filter: { abilities: ["normal"] } },
        [],
        "def",
        "baseDmg",
        totalQScale
      ),
    ];

    if (this.constellation >= 2) {
      // C2: +15% Normal Attack DMG to team
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C2"),
          { receiver: "team", filter: { abilities: ["normal"] } },
          [{ key: "dmg%", value: 0.15 }]
        )
      );
    }
    if (this.constellation >= 4) {
      // C4: Crystallize grants +20% DEF
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C4"), { receiver: "self" }, [
          { key: "def%", value: 0.2 },
        ])
      );
    }
    if (this.constellation >= 6) {
      // C6: Normal ATK SPD +12% under Q
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C6"),
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
  // Q Skill DMG Lv10: 439%, Lv13: 519%
  protected readonly formulaMap = (() => {
    const eLevel = this.constellation >= 5 ? 13 : 10;
    const qLevel = this.constellation >= 3 ? 13 : 10;

    const ePressMult = eLevel === 13 ? 3.169 : 2.684;
    const eCharge1Mult = eLevel === 13 ? 5.545 : 4.697;
    const eCharge2Mult = eLevel === 13 ? 7.922 : 6.71;

    const qMult = qLevel === 13 ? 5.19 : 4.39;

    return {
      "yun_jin-skill-press": {
        label: { zh: "旋云开相(点按)", en: "Opening Flourish (Press)" },
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
        label: { zh: "旋云开相(一段蓄力)", en: "Opening Flourish (Charge 1)" },
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
        label: { zh: "旋云开相(二段蓄力)", en: "Opening Flourish (Charge 2)" },
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
        label: { zh: "破嶂见旌仪", en: "Cliffbreaker's Banner" },
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
}
