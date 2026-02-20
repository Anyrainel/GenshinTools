import { LUNAR_REACTIONS } from "../constants";
import {
  ScalingBuff,
  ScalingMultiBuff,
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
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { OptionDef } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Natlan Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("varesa")
class Varesa extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: Fiery Passion Tag-Team Triple Jump → Plunge ground impact +180% ATK
      new ScalingBuff(
        cbs(this, ["E"], "P1"),
        { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
        [],
        "atk",
        "baseDmg",
        1.8
      ),
      // P2: Nightsoul Burst → ATK +35% (max 2 stacks = 70%)
      new StatBuff(
        cbs(this, ["nightsoul-burst"], "P2"),
        { receiver: "selfOnField" },
        [{ key: "atk%", value: 0.7 }]
      ),
    ];

    // C4: Burst in Fiery Passion → DMG +100%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C4"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 1.0 }]
        )
      );
    }

    // C6: Plunge and Burst → CR +10%, CD +100%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, ["Q", "plunge"], "C6"),
          {
            receiver: "selfOnField",
            filter: { abilities: ["plunge", "burst"] },
          },
          [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 1.0 },
          ]
        )
      );
    }

    return buffs;
  })();

  // Fiery Passion High Plunge (Lv10): 552.0%
  // Fiery Passion High Plunge (Lv13 C5+): 669.0%
  // Volcano Kablam (Lv10): 724.8%
  // Volcano Kablam (Lv13 C3+): 855.6%
  protected readonly formulaMap = (() => {
    const naMult = this.constellation >= 5 ? 6.69 : 5.52;
    const qMult = this.constellation >= 3 ? 8.556 : 7.248;
    return {
      "varesa-plunge": {
        label: { zh: "炽热激情高空坠地", en: "Fiery Passion High Plunge" },
        parts: [
          {
            formula: new DirectFormula(naMult, {
              element: "Electro",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      "varesa-kablam": {
        label: { zh: "大火山崩落(下落伤害)", en: "Volcano Kablam (Plunge)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              // Note: Considered Plunge DMG in-game, so use ability: "plunge"
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("citlali")
class Citlali extends CharacterBase {
  readonly buffs = [
    // P1: After Frozen/Melt, enemies' Pyro/Hydro RES -20% (C2: -40%)
    new StaticSkillBuff(
      cbs(this, ["E"], "P1"),
      { receiver: "onField", filter: { elements: ["Pyro", "Hydro"] } },
      this.constellation,
      (c) => [{ key: "resReduction%", value: c >= 2 ? 0.4 : 0.2 }]
    ),
    // P2: EM → baseDmg for Frostfall Storm (skill, 90% EM)
    new ScalingBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      0.9
    ),
    // P2: EM → baseDmg for Q Ice Storm (burst, 1200% EM)
    new ScalingBuff(
      cbs(this, ["Q"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [],
      "em",
      "baseDmg",
      12.0
    ),
    // C2: Self EM +125, team (shielded/followed) EM +250
    new StaticSkillBuff(
      cbs(this, ["E"], "C2"),
      { receiver: "self" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "em", value: 125 }] : [])
    ),
    new StaticSkillBuff(
      cbs(this, ["E"], "C2"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "em", value: 250 }] : [])
    ),
    // C6: 40 stacks → team Pyro/Hydro DMG +60%, self DMG +100%
    new StaticSkillBuff(
      cbs(this, ["E"], "C6"),
      {
        receiver: "team",
      },
      this.constellation,
      (c) =>
        c >= 6
          ? [
              { key: "pyro%", value: 0.6 },
              { key: "hydro%", value: 0.6 },
            ]
          : []
    ),
    new StaticSkillBuff(
      cbs(this, ["E"], "C6"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "dmg%", value: 1.0 }] : [])
    ),
  ];

  protected readonly formulaMap = (() => {
    // Q Ice Storm: Lv10 967.7%, Lv13 (C5+) 1142.4%
    const qMult = this.constellation >= 5 ? 11.424 : 9.677;
    return {
      "citlali-burst": {
        label: { zh: "冰风暴", en: "Ice Storm" },
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

@RegisterCharacter("mavuika")
class Mavuika extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof StaticSkillBuff>[] = [
      // P1: After Nightsoul Burst, self ATK +30%
      new StatBuff(
        cbs(this, ["nightsoul"], "P1"),
        { receiver: "selfOnField" },
        [{ key: "atk%", value: 0.3 }]
      ),
      // P2 "Kiongozi": After Q, on-field DMG +0.2% per Spirit (max 200 = 40%)
      // Assume full 200 Spirit → 40%. C4 adds +10% and removes decay.
      new StatBuff(cbs(this, ["Q"], "P2"), { receiver: "onField" }, [
        {
          key: "dmg%",
          value: this.constellation >= 4 ? 0.5 : 0.4,
        },
      ]),
    ];
    // C1: ATK +40% after gaining Fighting Spirit
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(cbs(this, [], "C1"), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.4 },
        ])
      );
    }
    // C2: Base ATK +200, Ring form → enemy DEF -20%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C2"), { receiver: "selfOnField" }, [
          { key: "baseAtk", value: 200 },
        ])
      );
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C2"), { receiver: "onField" }, [
          { key: "defReduction%", value: 0.2 },
        ])
      );
    }
    return buffs;
  })();

  // Q Sunfell Slice: Lv10 800.6%, Lv13 (C3+) 945.2%
  // + Fighting Spirit bonus: 200 × 2.9%/3.4% ATK = 580%/680% extra baseDmg
  // Flamestrider Normal combo (5 hits): Lv10 686.1%, Lv13 (C5+) 831.4%
  protected readonly formulaMap = (() => {
    const sunfellMult = this.constellation >= 3 ? 9.452 : 8.006;
    const comboMult =
      this.constellation >= 5
        ? 1.372 + 1.416 + 1.676 + 1.67 + 2.18
        : 1.132 + 1.169 + 1.383 + 1.378 + 1.799;
    return {
      "mavuika-sunfell": {
        label: { zh: "坠日斩", en: "Sunfell Slice" },
        parts: [
          {
            formula: new DirectFormula(sunfellMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "mavuika-flamestrider": {
        label: { zh: "驰轮车连击", en: "Flamestrider Normal Combo" },
        parts: [
          {
            formula: new DirectFormula(comboMult, {
              element: "Pyro",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("chasca")
class Chasca extends CharacterBase {
  // Count unique eligible element types in team (Pyro/Hydro/Cryo/Electro)
  private readonly eligibleTypes = (() => {
    const eligible = new Set<string>();
    for (const [id, el] of Object.entries(this.teamMeta.elements)) {
      if (
        id !== this.charId &&
        ["Pyro", "Hydro", "Cryo", "Electro"].includes(el)
      )
        eligible.add(el);
    }
    return Math.min(eligible.size, 3);
  })();

  readonly buffs = [
    // P1: Per eligible element type, Shining Shell DMG bonus (non-linear)
    // 1 type → +15%, 2 → +35%, 3 → +65%
    new StatBuff(
      cbs(this, ["E"], "P1"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: [0, 0.15, 0.35, 0.65][this.eligibleTypes] }]
    ),
    // C6: After Spiritbinding Conversion, Shining Shell CD +120%
    new StaticSkillBuff(
      cbs(this, ["E"], "C6"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "cd", value: 1.2 }] : [])
    ),
  ];

  protected readonly formulaMap = (() => {
    // Shining Shadowhunt Shell: Lv10 299.8%, Lv13 (C3+) 354%
    // 6 shells per volley, assumed all Shining with 3 eligible types
    const shellMult = this.constellation >= 3 ? 3.54 : 2.998;
    const shellCount = Math.min(3 + this.eligibleTypes, 6);
    // Q Radiant Soulseeker Shell: Lv10 372.2%, Lv13 (C5+) 439.4%
    const qMult = this.constellation >= 5 ? 4.394 : 3.722;
    return {
      "chasca-shining-volley": {
        label: { zh: "焕光追影弹齐射", en: "Shining Shell Volley" },
        parts: [
          {
            formula: new DirectFormula(shellMult, {
              element: "Anemo",
              ability: "charge",
              reaction: "none",
            }),
            hits: shellCount,
          },
        ],
      },
      "chasca-burst": {
        label: { zh: "溢光索魂弹", en: "Radiant Soulseeker Shells" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 6,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("xilonen")
class Xilonen extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // E: Source Samples — RES shred
      // -36% RES at Lv10, -42.5% at Lv13 (C3+)
      new StaticSkillBuff(
        cbs(this, ["E"]),
        { receiver: "team" },
        this.constellation,
        (c) => [{ key: "resReduction%", value: c >= 3 ? 0.425 : 0.36 }]
      ),
      // P1: Fewer than 2 samples → Normal/Plunge DMG +30%
      new StatBuff(
        cbs(this, ["A1"], "P1"),
        {
          receiver: "selfOnField",
          filter: { abilities: ["normal", "plunge"] },
        },
        [{ key: "dmg%", value: 0.3 }]
      ),
      // P2: Nightsoul Burst → DEF +20%
      new StatBuff(
        cbs(this, ["nightsoul-burst"], "P2"),
        { receiver: "selfOnField" },
        [{ key: "def%", value: 0.2 }]
      ),
    ];

    // C2: Element-dependent team buffs
    if (this.constellation >= 2) {
      if (Object.values(this.teamMeta.elements).includes("Pyro")) {
        buffs.push(
          new StatBuff(cbs(this, ["E"], "C2"), { receiver: "team" }, [
            { key: "atk%", value: 0.45 },
          ])
        );
      }
      if (Object.values(this.teamMeta.elements).includes("Hydro")) {
        buffs.push(
          new StatBuff(cbs(this, ["E"], "C2"), { receiver: "team" }, [
            { key: "hp%", value: 0.45 },
          ])
        );
      }
      if (Object.values(this.teamMeta.elements).includes("Cryo")) {
        buffs.push(
          new StatBuff(cbs(this, ["E"], "C2"), { receiver: "team" }, [
            { key: "cd", value: 0.6 },
          ])
        );
      }
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C2"), { receiver: "team" }, [
          { key: "geo%", value: 0.5 },
        ])
      ); // Geo is always active
    }

    // C4: +65% Xilonen DEF as Base DMG for Normal/Charged/Plunging
    if (this.constellation >= 4) {
      buffs.push(
        new ScalingBuff(
          cbs(this, ["E"], "C4"),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "plunge"] },
          },
          [],
          "def",
          "baseDmg",
          0.65
        )
      );
    }

    return buffs;
  })();

  // E Blade Roller N4 (Lv10): 110.7 + 108.8 + 130.1 + 170.1 = 519.7% DEF
  // E Rush DMG (Lv10): 322.6% DEF
  // E Rush DMG (Lv13 C3+): 380.8% DEF
  // Q Lv10: 506.3% DEF
  // Q Lv13 C5+: 597.7% DEF
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 3.808 : 3.226;
    const qMult = this.constellation >= 5 ? 5.977 : 5.063;
    return {
      "xilonen-normal": {
        label: { zh: "刃轮巡猎·全套四闪", en: "Blade Roller N4 Combo" },
        parts: [
          {
            formula: new DirectFormula(
              5.197, // N4 doesn't scale with constellations up to C6
              { element: "Geo", ability: "normal", reaction: "none" },
              "def"
            ),
          },
        ],
      },
      "xilonen-skill": {
        label: { zh: "音火锻淬·突进伤害", en: "Yohual's Scratch (Rush)" },
        parts: [
          {
            formula: new DirectFormula(
              eMult,
              {
                element: "Geo",
                ability: "skill",
                reaction: "none",
              },
              "def"
            ),
          },
        ],
      },
      "xilonen-burst": {
        label: { zh: "豹烈律动", en: "Ocelotlicue Point!" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              {
                element: "Geo",
                ability: "burst",
                reaction: "none",
              },
              "def"
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("mualani")
class Mualani extends CharacterBase {
  readonly buffs = [
    // C4: Q DMG +75%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "dmg%", value: 0.75 }] : [])
    ),
  ];

  // Surging Bite: base 15.62% + 3×7.81% + surging 39.06% = 78.11% HP (Lv10)
  // Lv13 (C3+): 18.45% + 3×9.22% + 46.11% = 92.22% HP
  // Q: 105.2%/124.2% HP (Lv10/Lv13 C5+)
  protected readonly formulaMap = (() => {
    const biteMult = this.constellation >= 3 ? 0.9222 : 0.7811;
    const burstMult = this.constellation >= 5 ? 1.242 : 1.052;
    return {
      "mualani-bite": {
        label: { zh: "巨浪鲨鲨撕咬", en: "Sharky's Surging Bite" },
        parts: [
          {
            formula: new DirectFormula(
              0,
              {
                element: "Hydro",
                ability: "normal",
                reaction: "none",
              },
              "atk",
              { key: "hp", multiplier: biteMult }
            ),
          },
        ],
      },
      "mualani-bite-vape": {
        label: { zh: "巨浪撕咬(蒸发)", en: "Surging Bite (Vape)" },
        parts: [
          {
            formula: new DirectFormula(
              0,
              {
                element: "Hydro",
                ability: "normal",
                reaction: "vaporize",
              },
              "atk",
              { key: "hp", multiplier: biteMult }
            ),
          },
        ],
      },
      "mualani-burst": {
        label: { zh: "爆瀑飞弹", en: "Boomsharka-laka" },
        parts: [
          {
            formula: new DirectFormula(
              0,
              {
                element: "Hydro",
                ability: "burst",
                reaction: "none",
              },
              "atk",
              { key: "hp", multiplier: burstMult }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("kinich")
class Kinich extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<
      typeof StatBuff | typeof ScalingBuff | typeof StaticSkillBuff
    >[] = [
      // P2: After Nightsoul Burst, Hunter's Experience ×2 → +640% ATK as baseDmg to Scalespiker
      // We model the ATK scaling as a ScalingBuff applied to self Skill
      new ScalingBuff(
        cbs(this, ["nightsoul"], "P2"),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "atk",
        "baseDmg",
        6.4 // 320% × 2 stacks = 640% of ATK
      ),
      // C1: Scalespiker Cannon CD +100%
      new StaticSkillBuff(
        cbs(this, ["E"], "C1"),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        this.constellation,
        (c) => (c >= 1 ? [{ key: "cd", value: 1.0 }] : [])
      ),
      // C2: Dendro RES -30% on E hit
      new StaticSkillBuff(
        cbs(this, ["E"], "C2"),
        { receiver: "onField", filter: { elements: ["Dendro"] } },
        this.constellation,
        (c) => (c >= 2 ? [{ key: "resReduction%", value: 0.3 }] : [])
      ),
    ];
    return buffs;
  })();

  // Scalespiker Cannon: Lv10 1237.4%, Lv13 (C3+) 1460.8%
  // Q initial: Lv10 241.2%, Lv13 (C5+) 284.8% + Dragon Breath 217.3%/256.6% ×5
  protected readonly formulaMap = (() => {
    const cannonMult = this.constellation >= 3 ? 14.608 : 12.374;
    const qInit = this.constellation >= 5 ? 2.848 : 2.412;
    const qBreath = this.constellation >= 5 ? 2.566 : 2.173;
    return {
      "kinich-cannon": {
        label: { zh: "迴猎贯鳞炮", en: "Scalespiker Cannon" },
        parts: [
          {
            formula: new DirectFormula(cannonMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "kinich-cannon-spread": {
        label: { zh: "迴猎贯鳞炮(蔓激化)", en: "Scalespiker Cannon (Spread)" },
        parts: [
          {
            formula: new DirectFormula(cannonMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "spread",
            }),
          },
        ],
      },
      "kinich-burst": {
        label: { zh: "圣龙致意", en: "Dragonlord (init + breath ×5)" },
        parts: [
          {
            formula: new DirectFormula(qInit, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(qBreath, {
              element: "Dendro",
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
