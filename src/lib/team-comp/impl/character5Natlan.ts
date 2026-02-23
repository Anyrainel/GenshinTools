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
        cbs(this, "P1", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
        [],
        "atk",
        "baseDmg",
        1.8
      ),
      // P2: Nightsoul Burst → ATK +35% (max 2 stacks = 70%)
      new StatBuff(
        cbs(this, "P2", ["nightsoul-burst"]),
        { receiver: "selfOnField" },
        [{ key: "atk%", value: 0.7 }]
      ),
    ];

    // C4: Burst in Fiery Passion → DMG +100%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 1.0 }]
        )
      );
    }

    // C6: Plunge and Burst → CR +10%, CD +100%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q", "plunge"]),
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
        label: { zh: "A 炽热激情高空坠地", en: "A Fiery Passion High Plunge" },
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
        label: {
          zh: "Q 大火山崩落(下落伤害)",
          en: "Q Volcano Kablam (Plunge)",
        },
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
      cbs(this, "P1", ["E"]),
      { receiver: "onField", filter: { elements: ["Pyro", "Hydro"] } },
      this.constellation,
      (c) => [{ key: "resReduction%", value: c >= 2 ? 0.4 : 0.2 }]
    ),
    // P2: EM → baseDmg for Frostfall Storm (skill, 90% EM)
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      0.9
    ),
    // P2: EM → baseDmg for Q Ice Storm (burst, 1200% EM)
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [],
      "em",
      "baseDmg",
      12.0
    ),
    // C2: Self EM +125, team (shielded/followed) EM +250
    new StaticSkillBuff(
      cbs(this, "C2", ["E"]),
      { receiver: "self" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "em", value: 125 }] : [])
    ),
    new StaticSkillBuff(
      cbs(this, "C2", ["E"]),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "em", value: 250 }] : [])
    ),
    // C6: 40 stacks → team Pyro/Hydro DMG +60%, self DMG +100%
    new StaticSkillBuff(
      cbs(this, "C6", ["E"]),
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
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "dmg%", value: 1.0 }] : [])
    ),
  ];

  protected readonly formulaMap = (() => {
    // E Obsidian Tzitzimitl: Lv10 131.3%, Lv13 (C3+) 155.0%
    const eBaseMult = this.constellation >= 3 ? 1.55 : 1.313;
    // E Frostfall Storm: Lv10 30.6%, Lv13 (C3+) 36.2%
    const eStormMult = this.constellation >= 3 ? 0.362 : 0.306;
    // Q Ice Storm: Lv10 967.7%, Lv13 (C5+) 1142.4%
    const qMult = this.constellation >= 5 ? 11.424 : 9.677;
    // Q Spiritvessel Skull: Lv10 241.9%, Lv13 (C5+) 285.6%
    const qSkullMult = this.constellation >= 5 ? 2.856 : 2.419;
    return {
      "citlali-skill": {
        label: { zh: "E 黑曜星魔", en: "E Obsidian Tzitzimitl" },
        parts: [
          {
            formula: new DirectFormula(eBaseMult, {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "citlali-skill-storm": {
        label: { zh: "E 霜陨风暴", en: "E Frostfall Storm" },
        parts: [
          {
            formula: new DirectFormula(eStormMult, {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "citlali-burst": {
        label: { zh: "Q 冰风暴", en: "Q Ice Storm" },
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
      "citlali-burst-skull": {
        label: { zh: "Q 宿灵之髑", en: "Q Spiritvessel Skull" },
        parts: [
          {
            formula: new DirectFormula(qSkullMult, {
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
        cbs(this, "P1", ["nightsoul"]),
        { receiver: "selfOnField" },
        [{ key: "atk%", value: 0.3 }]
      ),
      // P2 "Kiongozi": After Q, on-field DMG +0.2% per Spirit (max 200 = 40%)
      // Assume full 200 Spirit → 40%. C4 adds +10% and removes decay.
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "onField" }, [
        {
          key: "dmg%",
          value: this.constellation >= 4 ? 0.5 : 0.4,
        },
      ]),
    ];
    // C1: ATK +40% after gaining Fighting Spirit
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(cbs(this, "C1", []), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.4 },
        ])
      );
    }
    // C2: Base ATK +200, Ring form → enemy DEF -20%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "selfOnField" }, [
          { key: "baseAtk", value: 200 },
        ])
      );
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "onField" }, [
          { key: "defReduction%", value: 0.2 },
        ])
      );
    }
    return buffs;
  })();

  // Q Sunfell Slice: Lv10 800.6%, Lv13 (C3+) 945.2%
  // + Fighting Spirit bonus: 200 × 2.9%/3.4% ATK = 580%/680% extra baseDmg
  protected readonly formulaMap = (() => {
    const eLvl = this.constellation >= 5 ? 13 : 10;
    const qLvl = this.constellation >= 3 ? 13 : 10;

    let sunfellMult = qLvl === 13 ? 9.452 : 8.006;
    let n1Mult = eLvl === 13 ? 1.372 : 1.132;
    let caMult = eLvl === 13 ? 3.296 : 2.72;
    const sprintMult = eLvl === 13 ? 1.936 : 1.598;

    const sunfellFs = qLvl === 13 ? 6.8 : 5.8;
    const nFs = qLvl === 13 ? 1.24 : 1.02;
    const caFs = qLvl === 13 ? 2.48 : 2.04;

    sunfellMult += sunfellFs;
    n1Mult += nFs;
    caMult += caFs;

    if (this.constellation >= 2) {
      sunfellMult += 1.2;
      n1Mult += 0.6;
      caMult += 0.9;
    }

    return {
      "mavuika-sunfell": {
        label: { zh: "Q 满战意坠日斩", en: "Q Sunfell Slice (Max Spirit)" },
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
      "mavuika-combo": {
        label: { zh: "满战意Q后 A1+重击+冲刺", en: "Post-Q N1+CA+Sprint" },
        parts: [
          {
            formula: new DirectFormula(n1Mult, {
              element: "Pyro",
              ability: "normal",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(caMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(sprintMult, {
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
      cbs(this, "P1", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: [0, 0.15, 0.35, 0.65][this.eligibleTypes] }]
    ),
    // C6: After Spiritbinding Conversion, Shining Shell CD +120%
    new StaticSkillBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "cd", value: 1.2 }] : [])
    ),
  ];

  protected readonly formulaMap = (() => {
    const shellMult = this.constellation >= 3 ? 1.037 : 0.878;
    const shiningMult = this.constellation >= 3 ? 3.54 : 2.998;
    const shiningCount =
      this.eligibleTypes === 0
        ? 0
        : this.eligibleTypes + (this.constellation >= 1 ? 2 : 1);
    const normalCount = 6 - shiningCount;
    // Q Radiant Soulseeker Shell: Lv10 372.2%, Lv13 (C5+) 439.4%
    const qMult = this.constellation >= 5 ? 4.394 : 3.722;
    // Q Soulseeker Shell: Lv10 186.1%, Lv13 (C5+) 219.7%
    const qNormMult = this.constellation >= 5 ? 2.197 : 1.861;
    // Q Galesplitting: Lv10 158.4%, Lv13 (C5+) 187%
    const qInitMult = this.constellation >= 5 ? 1.87 : 1.584;
    const qRadiantCount = this.eligibleTypes === 0 ? 0 : this.eligibleTypes * 2;
    const qNormalCount = 6 - qRadiantCount;

    const baseTag = {
      element: "Anemo" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const qTag = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    return {
      "chasca-shining-volley": {
        label: {
          zh: "E 一轮6枚追影弹直伤",
          en: "E 6 Shadowhunt Shells Volley",
        },
        parts: [
          ...Array(normalCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(shellMult, baseTag),
            })),
          ...Array(shiningCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(shiningMult, baseTag),
            })),
        ],
      },
      "chasca-burst": {
        label: {
          zh: "Q 裂风+6枚索魂弹(爆发)",
          en: "Q Galesplitting + 6 Soulseeker Shells",
        },
        parts: [
          { formula: new DirectFormula(qInitMult, qTag) },
          ...Array(qNormalCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(qNormMult, qTag),
            })),
          ...Array(qRadiantCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(qMult, qTag),
            })),
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
        cbs(this, "E", ["E"]),
        { receiver: "team" },
        this.constellation,
        (c) => [{ key: "resReduction%", value: c >= 3 ? 0.425 : 0.36 }]
      ),
      // P1: Fewer than 2 samples → Normal/Plunge DMG +30%
      new StatBuff(
        cbs(this, "P1", ["A1"]),
        {
          receiver: "selfOnField",
          filter: { abilities: ["normal", "plunge"] },
        },
        [{ key: "dmg%", value: 0.3 }]
      ),
      // P2: Nightsoul Burst → DEF +20%
      new StatBuff(
        cbs(this, "P2", ["nightsoul-burst"]),
        { receiver: "selfOnField" },
        [{ key: "def%", value: 0.2 }]
      ),
    ];

    // C2: Element-dependent team buffs
    if (this.constellation >= 2) {
      if (Object.values(this.teamMeta.elements).includes("Pyro")) {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
            { key: "atk%", value: 0.45 },
          ])
        );
      }
      if (Object.values(this.teamMeta.elements).includes("Hydro")) {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
            { key: "hp%", value: 0.45 },
          ])
        );
      }
      if (Object.values(this.teamMeta.elements).includes("Cryo")) {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
            { key: "cd", value: 0.6 },
          ])
        );
      }
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
          { key: "geo%", value: 0.5 },
        ])
      ); // Geo is always active
    }

    // C4: +65% Xilonen DEF as Base DMG for Normal/Charged/Plunging
    if (this.constellation >= 4) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C4", ["E"]),
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
        label: { zh: "A 刃轮巡猎·全套四闪", en: "A Blade Roller N4 Combo" },
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
        label: { zh: "E 音火锻淬·突进伤害", en: "E Yohual's Scratch (Rush)" },
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
        label: { zh: "Q 豹烈律动", en: "Q Ocelotlicue Point!" },
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
      cbs(this, "C4", ["Q"]),
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
        label: { zh: "A 巨浪鲨鲨撕咬", en: "A Sharky's Surging Bite" },
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
        label: { zh: "A 巨浪撕咬(蒸发)", en: "A Surging Bite (Vape)" },
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
        label: { zh: "Q 爆瀑飞弹", en: "Q Boomsharka-laka" },
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
        cbs(this, "P2", ["nightsoul"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "atk",
        "baseDmg",
        6.4 // 320% × 2 stacks = 640% of ATK
      ),
      // C1: Scalespiker Cannon CD +100%
      new StaticSkillBuff(
        cbs(this, "C1", ["E"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        this.constellation,
        (c) => (c >= 1 ? [{ key: "cd", value: 1.0 }] : [])
      ),
      // C2: Dendro RES -30% on E hit
      new StaticSkillBuff(
        cbs(this, "C2", ["E"]),
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
        label: { zh: "E 迴猎贯鳞炮", en: "E Scalespiker Cannon" },
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
        label: {
          zh: "E 迴猎贯鳞炮(蔓激化)",
          en: "E Scalespiker Cannon (Spread)",
        },
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
        label: { zh: "Q 圣龙致意", en: "Q Dragonlord (init + breath ×5)" },
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
