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
// 5★ Liyue Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("zibai")
class Zibai extends CharacterBase {
  readonly buffs = (() => {
    const geoCount = Math.max(this.teamMeta.countByElement("Geo") - 1, 0);
    const hydroCount = this.teamMeta.countByElement("Hydro");

    const buffs: StatBuff[] = [
      // P3: Per 100 DEF → +0.7% Lunar-Crystallize BaseDmg, cap 14%
      new ScalingBuff(
        cbs(this, "P3", ["passive"]),
        { receiver: "team", filter: { reactions: ["lunarCrystallize"] } },
        [],
        "def",
        "reactionDmg%",
        0.00007,
        0.14
      ),
      // P2: Other Geo → DEF +15% each; Other Hydro → EM +60 each
      new StatBuff(cbs(this, "P2", ["A4"]), { receiver: "self" }, [
        { key: "def%", value: geoCount * 0.15 },
        { key: "em", value: hydroCount * 60 },
      ]),
    ];

    if (this.constellation >= 2) {
      // C2: Team Lunar-Crystallize Reaction DMG +30%
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "team", filter: { reactions: ["lunarCrystallize"] } },
          [{ key: "reactionDmg%", value: 0.3 }]
        )
      );
    }

    if (this.constellation >= 6) {
      // C6: Spirit Steed and Lunar-Crystallize DMG elevated by 48% (assuming 30 excess points consumed)
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "elevated%", value: 0.48 }]
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    // E/Q Levels (max 10 normally, 13 if C3/C5)
    const eLevel = this.constellation >= 3 ? 13 : 10;
    const qLevel = this.constellation >= 5 ? 13 : 10;

    // Normal Attacks in Phase Shift (DEF Scaled)
    const n1 = 1.018;
    const n2 = 0.938;
    const n3 = 0.622; // x2
    const n4 = 1.569;
    const n4Gleam = 0.53; // Reaction DMG — only with Moonsign: Ascendant Gleam (满辉)

    const steed1 = eLevel === 13 ? 3.666 : 3.106;
    let steed2 = eLevel === 13 ? 2.996 : 2.537;

    // P1: +60% DEF to Steed 2-hit
    steed2 += 0.6;
    // C2: +550% DEF to Steed 2-hit
    if (this.constellation >= 2) {
      steed2 += 5.5;
    }

    const q1 = qLevel === 13 ? 2.698 : 2.285;
    const q2 = qLevel === 13 ? 3.777 : 3.199;

    // Moonsign: Ascendant Gleam (满辉) requires 2+ Nod-Krai characters
    const hasAscendantGleam = this.teamMeta.countByRegion("Nod-Krai") >= 2;

    return {
      "zibai-e-combo": {
        label: {
          zh: "A 月转时隙普攻(四段全中)",
          en: "A Phase Shift Normal Combo (N1-N4)",
        },
        parts: [
          {
            formula: new DirectFormula(
              n1 + n2 + n3 * 2 + n4,
              { element: "Geo", ability: "normal", reaction: "none" },
              "def"
            ),
          },
          ...(hasAscendantGleam
            ? [
                {
                  formula: new DirectFormula(
                    n4Gleam,
                    {
                      element: "Geo",
                      ability: "normal",
                      reaction: "lunarCrystallize",
                    },
                    "def"
                  ),
                },
              ]
            : []),
        ],
      },
      "zibai-steed": {
        label: { zh: "E 灵驹飞踏", en: "E Spirit Steed's Stride" },
        parts: [
          {
            formula: new DirectFormula(
              steed1,
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
          },
          {
            formula: new DirectFormula(
              steed2,
              {
                element: "Geo",
                ability: "skill",
                reaction: "lunarCrystallize",
              },
              "def"
            ),
          },
        ],
      },
      "zibai-burst": {
        label: { zh: "Q 三垣威仪法", en: "Q Tri-Sphere Eminence" },
        parts: [
          {
            formula: new DirectFormula(
              q1,
              { element: "Geo", ability: "burst", reaction: "none" },
              "def"
            ),
          },
          {
            formula: new DirectFormula(
              q2,
              {
                element: "Geo",
                ability: "burst",
                reaction: "lunarCrystallize",
              },
              "def"
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("xianyun")
class Xianyun extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: E hit → Team Plunge CR +10% (max 4 stacks = 10% exactly per text)
      new StatBuff(
        cbs(this, "P1", ["E"]),
        { receiver: "team", filter: { abilities: ["plunge"] } },
        [{ key: "cr", value: 0.1 }]
      ),
      // P2: Q Starwicker → Plunge Base DMG +200% ATK (max 9000)
      // C2: Enhances to 400% ATK (max 18000)
      new ScalingBuff(
        cbs(this, "P2/C2", ["Q"]),
        { receiver: "onField", filter: { abilities: ["plunge"] } },
        [],
        "atk",
        "baseDmg",
        this.constellation >= 2 ? 4.0 : 2.0,
        this.constellation >= 2 ? 18000 : 9000
      ),
    ];

    // C2: After E → Xianyun ATK +20%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2-ATK", ["E"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.2 },
        ])
      );
    }

    // C6: Driftcloud Wave (Plunge) CD +70%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
          [{ key: "cd", value: 0.7 }]
        )
      );
    }

    return buffs;
  })();

  // E Driftcloud Wave 3-Skyladder (Lv10): 607.7%
  // E Driftcloud Wave 3-Skyladder (Lv13 C5+): 717.4%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 7.174 : 6.077;
    return {
      "xianyun-driftcloud": {
        label: {
          zh: "A 闲云冲击波(三段跳)",
          en: "A Driftcloud Wave (3 Skyladders)",
        },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Anemo",
              // Driftcloud Wave is considered Plunging Attack DMG
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("baizhu")
class Baizhu extends CharacterBase {
  readonly buffs = [
    // P1: Active HP ≥50% → Baizhu Dendro DMG +25% (assume active)
    new StatBuff(cbs(this, "P1", []), { receiver: "selfOnField" }, [
      { key: "dendro%", value: 0.25 },
    ]),
    // P2: Per 1000 HP (cap 50k), on-field characters gain:
    // Burning/Bloom/Hyperbloom/Burgeon +2%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "onField",
        filter: {
          reactions: ["burning", "bloom", "hyperbloom", "burgeon"],
        },
      },
      [],
      "hp",
      "reactionDmg%",
      0.00002,
      1.0
    ),
    // Aggravate/Spread +0.8%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "onField",
        filter: { reactions: ["aggravate", "spread"] },
      },
      [],
      "hp",
      "reactionDmg%",
      0.000008,
      0.4
    ),
    // Lunar-Bloom +0.7%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "onField",
        filter: { reactions: ["lunarBloom"] },
      },
      [],
      "hp",
      "reactionDmg%",
      0.000007,
      0.35
    ),
    // C4: After Q, team EM +80 for 15s
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "team" },
      this.constellation >= 4 ? [{ key: "em", value: 80 }] : []
    ),
    // C6: Spiritvein DMG +8% Max HP
    new ScalingBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [],
      "hp",
      "baseDmg",
      this.constellation >= 6 ? 0.08 : 0
    ),
  ];

  protected readonly formulaMap = (() => {
    // Q Spiritvein DMG: Lv10 174.7%, Lv13 (C3+) 206.3%
    // ~6 Seamless Shields over 14s duration
    const qMult = this.constellation >= 3 ? 2.063 : 1.747;
    return {
      "baizhu-burst": {
        label: { zh: "Q 灵气脉总伤", en: "Q Spiritveins Total" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Dendro",
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

@RegisterCharacter("yelan")
class Yelan extends CharacterBase {
  readonly buffs = (() => {
    const elements = new Set(Object.values(this.teamMeta.elements));
    const count = elements.size;
    const p1Bonus = count === 4 ? 0.3 : count * 0.06;

    const buffs: StatBuff[] = [
      // P1: +6%/12%/18%/30% Max HP based on unique element count
      new StatBuff(cbs(this, "P1", ["A1"]), { receiver: "self" }, [
        { key: "hp%", value: p1Bonus },
      ]),
      // P2: Q ramps DMG% for on-field, avg 25% (up to 50%)
      new StatBuff(cbs(this, "P2", ["A4", "Q"]), { receiver: "onField" }, [
        { key: "dmg%", value: 0.25 },
      ]),
    ];

    if (this.constellation >= 4) {
      // C4: 10% team Max HP per marked enemy, max 40%. Assume 40% for optimization.
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E"]), { receiver: "team" }, [
          { key: "hp%", value: 0.4 },
        ])
      );
    }

    return buffs;
  })();

  // E Skill DMG Lv10: 40.7% Max HP, Lv13 (C5+): 48.1% Max HP
  // Q Throw DMG Lv10: 8.77% Max HP, Lv13 (C3+): 10.35% Max HP
  // C6 Mastermind Barb DMG: 20.84% × 156% = 32.51% Max HP (×5)
  protected readonly formulaMap = (() => {
    const qLevel = this.constellation >= 3 ? 13 : 10;
    const eLevel = this.constellation >= 5 ? 13 : 10;

    const barbMult = 0.2084;
    const c6BarbMult = barbMult * 1.56;

    const eMult = eLevel === 13 ? 0.481 : 0.407;
    const qThrowMult = qLevel === 13 ? 0.1035 : 0.0877;

    const formulas: Record<string, FormulaEntry> = {
      "yelan-skill": {
        label: { zh: "E 萦络纵命索", en: "E Lingering Lifeline" },
        parts: [
          {
            formula: new DirectFormula(
              eMult,
              { element: "Hydro", ability: "skill", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
      "yelan-burst-throw": {
        label: {
          zh: "Q 玄掷玲珑(单次3箭)",
          en: "Q Exquisite Throw (3 Arrows)",
        },
        parts: [
          {
            formula: new DirectFormula(
              qThrowMult,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
            hits: 3,
          },
        ],
      },
    };

    if (this.constellation >= 6) {
      formulas["yelan-c6-barb"] = {
        label: {
          zh: "运筹帷幄破局矢(总5矢)",
          en: "Mastermind Barbs (Total 5)",
        },
        parts: [
          {
            formula: new DirectFormula(
              c6BarbMult,
              { element: "Hydro", ability: "charge", reaction: "none" }, // CA DMG
              "hp"
            ),
            hits: 5,
          },
        ],
      };
    }

    return formulas;
  })();
}

@RegisterCharacter("xiao")
class Xiao extends CharacterBase {
  readonly buffs = [
    // P1: During Q, all DMG +5%, +5% per 3s, max 25%
    // Average over 15s duration ≈ 15%
    new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "selfOnField" }, [
      { key: "dmg%", value: 0.15 },
    ]),
    // P2: Using E increases E DMG by 15% (max 3 stacks). Average assumption: 30%
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: 0.3 }]
    ),
    // Q: Bane of All Evil — Normal/Charged/Plunge DMG Bonus
    // Lv10: 95.2%, Lv13 (C5+): 108.9%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "plunge"] },
      },
      [{ key: "dmg%", value: this.constellation >= 5 ? 1.089 : 0.952 }]
    ),
  ];

  // High Plunge DMG (Lv10): 404.0%
  protected readonly formulaMap = (() => {
    return {
      "xiao-plunge-high": {
        label: { zh: "A 靖妖傩舞·高空坠地", en: "A High Plunge (Q)" },
        parts: [
          {
            formula: new DirectFormula(4.04, {
              element: "Anemo", // Q converts PHY to Anemo
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("zhongli")
class Zhongli extends CharacterBase {
  readonly buffs = [
    // E (Shield): Jade Shield — decreases all nearby enemies' Elemental RES
    // and Physical RES by 20% (universal shred, modeled as resReduction%)
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "team" }, [
      { key: "resReduction%", value: 0.2 },
    ]),
  ];

  protected readonly formulaMap = (() => {
    const qLevel = this.constellation >= 5 ? 13 : 10;
    const qMult = qLevel === 13 ? 10.84 : 9.0;

    // P2: Dominance of Earth — Q DMG extra term based on HP (33% Max HP)
    const qExtra = { key: "hp" as const, multiplier: 0.33 };

    return {
      "zhongli-burst": {
        label: { zh: "Q 天星(包含炊金馔玉)", en: "Q Planet Befall (incl. P2)" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              { element: "Geo", ability: "burst", reaction: "none" },
              "atk",
              qExtra
            ),
          },
        ],
      },
    };
  })();
}

// 5-Star Character Implementations
// ═══════════════════════════════════════════════════════════════

const huTaoOption = {
  label: { zh: "生命值状态", en: "HP State" },
  choices: [
    { value: "high", label: { zh: "生命值 > 50%", en: "HP > 50%" } },
    { value: "low", label: { zh: "生命值 ≤ 50%", en: "HP ≤ 50%" } },
    {
      value: "1",
      label: { zh: "生命值为 1 (C6触发)", en: "HP = 1 (C6 Triggered)" },
    },
  ] as const,
  default: "low",
} satisfies OptionDef;

@RegisterCharacter("hu_tao", huTaoOption)
class HuTao extends CharacterBase {
  private readonly hpState = resolveOption(huTaoOption, this.option);

  readonly buffs = (() => {
    const isLowHP = this.hpState === "low" || this.hpState === "1";
    const isC6Trigger = this.hpState === "1" && this.constellation >= 6;

    const buffs: StatBuff[] = [
      // P1: After E ends, team (excl. self) CR +12%
      new StatBuff(cbs(this, "P1", ["E"]), { receiver: "team" }, [
        { key: "cr", value: 0.12 },
      ]),
      // E: Guide to Afterlife — HP → ATK conversion
      // Lv10: 6.26% HP, Lv13 (C3+): 7.15% HP
      new ScalingBuff(
        cbs(this, "E", ["E"]),
        { receiver: "selfOnField" },
        [],
        "hp",
        "atk",
        this.constellation >= 3 ? 0.0715 : 0.0626
      ),
    ];

    if (isLowHP) {
      // P2: Below 50% HP → +33% Pyro DMG
      buffs.push(
        new StatBuff(cbs(this, "P2", ["low-hp"]), { receiver: "selfOnField" }, [
          { key: "pyro%", value: 0.33 },
        ])
      );
    }

    if (isC6Trigger) {
      // C6: +100% CR, +200% all RES (RES omitted as it is purely defensive)
      buffs.push(
        new StatBuff(cbs(this, "C6", ["low-hp"]), { receiver: "selfOnField" }, [
          { key: "cr", value: 1.0 },
        ])
      );
    }

    return buffs;
  })();

  // Charged ATK (Normal ATK talent, no constellation boost): Lv10 242.6%
  // Q (low HP): Lv10 617%, Lv13 (C5+) 706%
  // Q (high HP): Lv10 494%, Lv13 (C5+) 565%
  protected readonly formulaMap = (() => {
    const isLowHP = this.hpState === "low" || this.hpState === "1";

    const qMultLv10 = isLowHP ? 6.17 : 4.94;
    const qMultLv13 = isLowHP ? 7.06 : 5.65;
    const qMult = this.constellation >= 5 ? qMultLv13 : qMultLv10;

    const pyroTag = {
      element: "Pyro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    return {
      "hutao-charged": {
        label: { zh: "重击", en: "Charged ATK" },
        parts: [{ formula: new DirectFormula(2.426, pyroTag) }],
      },
      "hutao-charged-vape": {
        label: { zh: "重击(蒸发)", en: "Charged ATK (Vape)" },
        parts: [
          {
            formula: new AmplifyFormula(2.426, {
              ...pyroTag,
              reaction: "vaporize",
            }),
          },
        ],
      },
      "hutao-burst": {
        label: { zh: "Q 安神秘法", en: "Q Burst" },
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
      "hutao-burst-vape": {
        label: { zh: "Q 安神秘法(蒸发)", en: "Q Burst (Vape)" },
        parts: [
          {
            formula: new AmplifyFormula(qMult, {
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

@RegisterCharacter("shenhe")
class Shenhe extends CharacterBase {
  readonly buffs = [
    // E: Icy Quill — ATK-based flat DMG added to Cryo hits
    // Lv10: 87.64% ATK, Lv13 (C3+): 103.5% ATK
    new ScalingBuff(
      cbs(this, "E", ["E"]),
      { receiver: "onField", filter: { elements: ["Cryo"] } },
      [],
      "atk",
      "baseDmg",
      this.constellation >= 3 ? 1.035 : 0.8764
    ),
    // P1: Q field → on-field Cryo DMG +15%
    new StatBuff(
      cbs(this, "P1", ["Q"]),
      { receiver: "onField", filter: { elements: ["Cryo"] } },
      [{ key: "dmg%", value: 0.15 }]
    ),
    // P2: Press E → team Skill/Burst DMG +15%
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "team", filter: { abilities: ["skill", "burst"] } },
      [{ key: "dmg%", value: 0.15 }]
    ),
    // C2: Q field → Cryo CD +15%
    new StatBuff(
      cbs(this, "C2", ["Q"]),
      { receiver: "onField", filter: { elements: ["Cryo"] } },
      this.constellation >= 2 ? [{ key: "cd", value: 0.15 }] : []
    ),
  ];

  // E Press: Lv10 301%, Lv13 (C3+) 355%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 3.55 : 3.01;
    return {
      "shenhe-skill": {
        label: { zh: "E 仰灵威召将役咒(点按)", en: "E Spring Spirit (Press)" },
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
    };
  })();
}

@RegisterCharacter("ganyu")
class Ganyu extends CharacterBase {
  readonly buffs = [
    // P1: After Frostflake Arrow, next Frostflake +20% CR for 5s
    new StatBuff(
      cbs(this, "P1", ["charge"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "cr", value: 0.2 }]
    ),
    // P2: Q field: +20% Cryo DMG to active members
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "onField" }, [
      { key: "cryo%", value: 0.2 },
    ]),
    // C1: Cryo RES -15% on Frostflake hit for 6s (enemy debuff — benefits whole team)
    new StatBuff(
      cbs(this, "C1", ["charge"]),
      { receiver: "team", filter: { elements: ["Cryo"] } },
      this.constellation >= 1 ? [{ key: "resReduction%", value: 0.15 }] : []
    ),
    // C4: Opponents in Q field take increased DMG, ramps 5%→25%
    // Average ≈ 15% over Q duration
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "onField" },
      this.constellation >= 4 ? [{ key: "dmg%", value: 0.15 }] : []
    ),
  ];

  // Frostflake Arrow + Bloom (Normal ATK talent — no constellation level boost)
  // Arrow Lv10: 230%, Bloom Lv10: 392%, Total: 622%
  protected readonly formulaMap = {
    "ganyu-frostflake": {
      label: { zh: "A 霜华矢+霜华绽发", en: "A Frostflake Arrow + Bloom" },
      parts: [
        {
          formula: new DirectFormula(2.3 + 3.92, {
            element: "Cryo",
            ability: "charge",
            reaction: "none",
          }),
        },
      ],
    },
    "ganyu-frostflake-melt": {
      label: { zh: "A 霜华矢+绽发(融化)", en: "A Frostflake + Bloom (Melt)" },
      parts: [
        {
          formula: new AmplifyFormula(2.3 + 3.92, {
            element: "Cryo",
            ability: "charge",
            reaction: "melt",
          }),
        },
      ],
    },
  };
}

@RegisterCharacter("keqing")
class Keqing extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: After Q, self CR +15%, ER +15%
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
        { key: "cr", value: 0.15 },
        { key: "er", value: 0.15 },
      ]),
    ];

    const canC4ElectroReact =
      this.teamMeta.hasReaction("overloaded") ||
      this.teamMeta.hasReaction("electroCharged") ||
      this.teamMeta.hasReaction("superconduct") ||
      this.teamMeta.hasReaction("swirl") ||
      this.teamMeta.hasReaction("crystallize") ||
      this.teamMeta.hasReaction("quicken") ||
      this.teamMeta.hasReaction("aggravate") ||
      this.teamMeta.hasReaction("hyperbloom");

    if (canC4ElectroReact && this.constellation >= 4) {
      // C4: After Electro reaction, self ATK +25%
      buffs.push(
        new StatBuff(
          cbs(this, "C4", [
            "overloaded",
            "electroCharged",
            "superconduct",
            "swirl",
            "crystallize",
            "quicken",
            "aggravate",
            "hyperbloom",
          ]),
          { receiver: "selfOnField" },
          [{ key: "atk%", value: 0.25 }]
        )
      );
    }

    if (this.constellation >= 6) {
      // C6: 4 stacks × 6% = 24% Electro DMG
      buffs.push(
        new StatBuff(cbs(this, "C6", []), { receiver: "selfOnField" }, [
          { key: "electro%", value: 0.24 },
        ])
      );
    }

    return buffs;
  })();

  // Charged ATK: Lv10 152%+170% = 322% (no constellation boost)
  // Q: Lv10 initial 158% + 8×43.2% + final 340% = 843.6%, Lv13 (C3+) 994.8%
  protected readonly formulaMap = (() => {
    const qTotal =
      this.constellation >= 3 ? 1.87 + 0.51 * 8 + 4.01 : 1.58 + 0.432 * 8 + 3.4;
    return {
      "keqing-charged": {
        label: { zh: "A 重击", en: "A Charged ATK" },
        parts: [
          {
            formula: new DirectFormula(3.22, {
              element: "Electro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "keqing-charged-aggravate": {
        label: { zh: "A 重击(超激化)", en: "A Charged ATK (Aggravate)" },
        parts: [
          {
            formula: new DirectFormula(3.22, {
              element: "Electro",
              ability: "charge",
              reaction: "aggravate",
            }),
          },
        ],
      },
      "keqing-burst": {
        label: { zh: "Q 天街巡游", en: "Q Starward Sword" },
        parts: [
          {
            formula: new DirectFormula(qTotal, {
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

@RegisterCharacter("qiqi")
class Qiqi extends CharacterBase {
  // Primarily a healer; minimal damage-relevant buffs
  readonly buffs = [];

  protected readonly formulaMap = (() => {
    // E Herald of Frost DMG Lv10: 64.96% × ~8 hits over duration
    // Lv13 (C3+): 76.7% × 8
    return {
      "skill-hit": {
        label: { zh: "E 寒病鬼差(×8)", en: "E Herald of Frost (×8)" },
        parts: [
          {
            formula: new DirectFormula(
              (this.constellation >= 3 ? 0.767 : 0.6496) * 8,
              { element: "Cryo", ability: "skill", reaction: "none" }
            ),
          },
        ],
      },
    };
  })();
}
