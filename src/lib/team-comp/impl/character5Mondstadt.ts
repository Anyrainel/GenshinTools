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
// 5★ Mondstadt Characters
// ═══════════════════════════════════════════════════════════════

const durinOption = {
  label: { zh: "形态", en: "Form" },
  choices: [
    { value: "white", label: { zh: "白焰之龙", en: "White Flame" } },
    { value: "dark", label: { zh: "黑蚀之龙", en: "Dark Decay" } },
  ] as const,
  default: "white",
} satisfies OptionDef;

@RegisterCharacter("durin", durinOption)
class Durin extends CharacterBase {
  private readonly form = resolveOption(durinOption, this.option);

  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    // P4: Hexerei Secret Rite enhances P1 effects by 75%
    const hexMult = isHexerei ? 1.75 : 1.0;
    const isWhite = this.form === "white";

    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    if (isWhite) {
      // P1 (White Flame): Pyro RES -20% (×hexMult) on Pyro/Burning reactions
      const canPyroReact =
        this.teamMeta.hasReaction("vaporize") ||
        this.teamMeta.hasReaction("melt") ||
        this.teamMeta.hasReaction("overloaded") ||
        this.teamMeta.hasReaction("burning") ||
        this.teamMeta.hasReaction("burgeon") ||
        this.teamMeta.hasReaction("swirl") ||
        this.teamMeta.hasReaction("crystallize");

      if (canPyroReact) {
        buffs.push(
          new StatBuff(
            cbs(this, "P1", [
              "Q",
              "vaporize",
              "melt",
              "overloaded",
              "burning",
              "burgeon",
              "swirl",
              "crystallize",
            ]),
            { receiver: "team" },
            [{ key: "resReduction%", value: 0.2 * hexMult }]
          )
        );
      }
    } else {
      // P1 (Dark Decay): Vaporize/Melt DMG +40% (×hexMult)
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["Q"]),
          {
            receiver: "selfOnField",
            filter: { reactions: ["vaporize", "melt"] },
          },
          [{ key: "reactionDmg%", value: 0.4 * hexMult }]
        )
      );
    }

    // P2: After Q, per 100 ATK → burst tick DMG +3% (cap 75%) — modeled as baseDmg%
    // baseDmg% is the correct key for "deal X% of original damage"
    buffs.push(
      new ScalingBuff(
        cbs(this, "P2", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "atk",
        "baseDmg%",
        0.0003,
        0.75
      )
    );

    // C1 (White Flame): On-field team baseDmg from ATK ×60% per stack, 20 stacks
    // C1 (Dark Decay): Self baseDmg from ATK ×150% per stack, 20 stacks (consumes 2)
    // Modeled as flat baseDmg scaling from ATK — 20 triggers for White, 10 for Dark
    if (this.constellation >= 1) {
      if (isWhite) {
        buffs.push(
          new ScalingBuff(
            cbs(this, "C1", ["Q"]),
            { receiver: "onField" },
            [],
            "atk",
            "baseDmg",
            0.6
          )
        );
      } else {
        buffs.push(
          new ScalingBuff(
            cbs(this, "C1", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [],
            "atk",
            "baseDmg",
            1.5
          )
        );
      }
    }

    // C2: After burst, Pyro DMG +50% for team (+ reaction element)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "team" }, [
          { key: "pyro%", value: 0.5 },
        ])
      );
    }

    // C4: Burst DMG +40%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", []),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }

    // C6: Burst ignores 30% DEF (always)
    // White Flame: enemy DEF -30% (team debuff)
    // Dark Decay: ignores additional 40% DEF (total 70%)
    if (this.constellation >= 6) {
      if (isWhite) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "defIgnore%", value: 0.3 }]
          ),
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "team" }, [
            { key: "defReduction%", value: 0.3 },
          ])
        );
      } else {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "defIgnore%", value: 0.7 }]
          )
        );
      }
    }

    return buffs;
  })();

  // Q: Burst initial (3 hits) + Dragon ticks (10 hits over 20s)
  protected readonly formulaMap: Record<string, FormulaEntry> = ((): Record<
    string,
    FormulaEntry
  > => {
    const isWhite = this.form === "white";
    // Q initial (White): Lv10 214.1%+173.5%+201.3%=588.9%, Lv13 (C3+) 252.8%+204.9%+237.7%=695.4%
    // Q initial (Dark): Lv10 225.8%+183.2%+201.3%=610.3%, Lv13 (C3+) 266.6%+216.2%+237.7%=720.5%
    const qWhiteInitMult = this.constellation >= 3 ? 6.954 : 5.889;
    const qDarkInitMult = this.constellation >= 3 ? 7.205 : 6.103;

    // Dragon ticks (White): Lv10 170.4%, Lv13 (C3+) 201.1%, 10 ticks over 20s
    // Dragon ticks (Dark): Lv10 233.7%, Lv13 (C3+) 275.9%, 10 ticks over 20s
    const dragonWhiteMult = this.constellation >= 3 ? 2.011 : 1.704;
    const dragonDarkMult = this.constellation >= 3 ? 2.759 : 2.337;

    const burstTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    if (isWhite) {
      return {
        "durin-burst-white": {
          label: { zh: "白焰之龙总伤", en: "White Flame Burst + Dragon" },
          parts: [
            { formula: new DirectFormula(qWhiteInitMult, burstTag) },
            { formula: new DirectFormula(dragonWhiteMult, burstTag), hits: 10 },
          ],
        },
      };
    }
    return {
      "durin-burst-dark": {
        label: { zh: "黑蚀之龙总伤", en: "Dark Decay Burst + Dragon" },
        parts: [
          { formula: new DirectFormula(qDarkInitMult, burstTag) },
          { formula: new DirectFormula(dragonDarkMult, burstTag), hits: 10 },
        ],
      },
      "durin-burst-dark-vape": {
        label: { zh: "黑蚀之龙(蒸发)", en: "Dark Decay Burst (Vape)" },
        parts: [
          {
            formula: new AmplifyFormula(qDarkInitMult, {
              ...burstTag,
              reaction: "vaporize",
            }),
          },
          {
            formula: new AmplifyFormula(dragonDarkMult, {
              ...burstTag,
              reaction: "vaporize",
            }),
            hits: 10,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("albedo")
class Albedo extends CharacterBase {
  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    const allAbilities = [
      "normal",
      "charge",
      "plunge",
      "skill",
      "burst",
    ] as const;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Transient Blossoms deal +25% DMG vs enemies HP <50% (assume active)
      new StatBuff(
        cbs(this, "P1", ["enemy-low-hp"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [{ key: "dmg%", value: 0.25 }]
      ),
      // P4: Silver Isotoma — Transient Blossom DMG +240% DEF
      // Only when Silver Isotoma exists (Hexerei: Secret Rite)
      ...(isHexerei
        ? [
            new ScalingBuff(
              cbs(this, "P4", ["E"]),
              { receiver: "selfOnField", filter: { abilities: ["skill"] } },
              [],
              "def",
              "baseDmg",
              this.constellation >= 3 ? 2.84 : 2.4
            ),
          ]
        : []),
      // P2: After Q, nearby party EM +125 for 10s
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "team" }, [
        { key: "em", value: 125 },
      ]),
      // P4: After Solar Isotoma, team DMG +4% per 1000 DEF (cap 12%)
      new ScalingBuff(
        cbs(this, "P4", ["E"]),
        { receiver: "team", filter: { abilities: [...allAbilities] } },
        [],
        "def",
        "dmg%",
        0.00004,
        0.12
      ),
      // P4 (Hexerei): After Silver Isotoma, Hexerei members DMG +10% per 1000 DEF (cap 30%)
      // Receiver "team" is an approximation; faction-scoped receivers are not supported.
      ...(isHexerei
        ? [
            new ScalingBuff(
              cbs(this, "P4", ["E"]),
              { receiver: "team", filter: { abilities: [...allAbilities] } },
              [],
              "def",
              "dmg%",
              0.0001,
              0.3
            ),
          ]
        : []),
      // C1: Transient Blossoms regenerate 1.2 Energy (no stat buff)
      // (Energy is handled by the engine, no StatBuff needed here)
      // C4: Active characters in Solar Isotoma field: Plunge DMG +30%
      new StatBuff(
        cbs(this, "C4", ["E"]),
        { receiver: "onField", filter: { abilities: ["plunge"] } },
        this.constellation >= 4 ? [{ key: "dmg%", value: 0.3 }] : []
      ),
      // C6: In Solar Isotoma with Crystallize shield, DMG +17% (assume active)
      new StatBuff(
        cbs(this, "C6", ["E"]),
        { receiver: "onField" },
        this.constellation >= 6 ? [{ key: "dmg%", value: 0.17 }] : []
      ),
    ];

    // C2: Fatal Reckoning — burst DMG +30% DEF × 4 stacks = +120% DEF as baseDmg
    if (this.constellation >= 2) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "def",
          "baseDmg",
          1.2
        )
      );
    }

    // C6: Fatal Blossom DMG +250% DEF for 20s (after Silver Isotoma destroyed by Q)
    if (this.constellation >= 6 && isHexerei) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "def",
          "baseDmg",
          2.5
        )
      );
    }

    return buffs;
  })();

  protected readonly formulaMap = (() => {
    // Transient Blossom Lv10: 240% DEF, Lv13 (C3+): 284% DEF
    const blossomMult = this.constellation >= 3 ? 2.84 : 2.4;
    // Burst Lv10: 661%, Lv13 (C5+): 780%
    const burstMult = this.constellation >= 5 ? 7.8 : 6.61;
    // Fatal Blossom Lv10: 129.6% × 7, Lv13 (C5+): 153% × 7
    const fatalMult = (this.constellation >= 5 ? 1.53 : 1.296) * 7;
    return {
      "albedo-blossom": {
        label: { zh: "E 刹那之花", en: "E Transient Blossom" },
        parts: [
          {
            formula: new DirectFormula(
              blossomMult,
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
          },
        ],
      },
      "albedo-burst": {
        label: { zh: "Q 元素爆发+生灭之花", en: "Q Burst + Fatal Blossoms" },
        parts: [
          {
            formula: new DirectFormula(burstMult, {
              element: "Geo",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(fatalMult, {
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

@RegisterCharacter("diluc")
class Diluc extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: After Q, Pyro DMG +20% during infusion
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.2 },
      ]),
    ];

    if (this.constellation >= 1) {
      // C1: DMG +15% against enemies with HP > 50% (assume active)
      buffs.push(
        new StatBuff(cbs(this, "C1", []), { receiver: "selfOnField" }, [
          { key: "dmg%", value: 0.15 },
        ])
      );
    }
    if (this.constellation >= 2) {
      // C2: On taking DMG, ATK +10% and ATK SPD +5% × 3 stacks = +30% / +15%
      buffs.push(
        new StatBuff(cbs(this, "C2", []), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.3 },
          { key: "atkSpd%", value: 0.15 },
        ])
      );
    }
    if (this.constellation >= 4) {
      // C4: 2nd/3rd E cast in combo deals +40% DMG — averaged over 3 hits (approx 26.6%)
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "dmg%", value: 0.4 * (2 / 3) }]
        )
      );
    }
    if (this.constellation >= 6) {
      // C6: After E, next 2 normals DMG +30% and ATK SPD +30%
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [
            { key: "dmg%", value: 0.3 },
            { key: "atkSpd%", value: 0.3 },
          ]
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    const eLevel = this.constellation >= 3 ? 13 : 10;
    const qLevel = this.constellation >= 5 ? 13 : 10;

    const eMult = eLevel === 13 ? 6.82 : 5.78;
    const qSlash = qLevel === 13 ? 4.34 : 3.67;
    const qExplosion = qLevel === 13 ? 4.34 : 3.67;
    const highPlungeMult = 4.42; // Lv10 High Plunge DMG

    const hasXianyun = this.teamMeta.characters.includes("xianyun");

    return {
      "diluc-skill": {
        label: { zh: "E 逆焰之刃三段", en: "E Searing Onslaught (3 hits)" },
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
      "diluc-skill-vape": {
        label: {
          zh: "E 逆焰之刃三段(全蒸发)",
          en: "E Searing Onslaught (All Vape)",
        },
        parts: [
          {
            formula: new AmplifyFormula(eMult, {
              element: "Pyro",
              ability: "skill",
              reaction: "vaporize",
            }),
          },
        ],
      },
      "diluc-burst": {
        label: { zh: "Q 黎明(斩击+爆裂)", en: "Q Dawn (Slash + Explosion)" },
        parts: [
          {
            formula: new DirectFormula(qSlash, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(qExplosion, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      ...(hasXianyun
        ? {
            "diluc-plunge-xianyun": {
              label: {
                zh: "A 高空下落攻击(附魔/蒸发)",
                en: "A High Plunge (Infused/Vape)",
              },
              parts: [
                {
                  formula: new AmplifyFormula(highPlungeMult, {
                    element: "Pyro",
                    ability: "plunge",
                    reaction: "vaporize",
                  }),
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("mona")
class Mona extends CharacterBase {
  readonly buffs = [
    // P3 (combat): 20% of ER as Hydro DMG%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "selfOnField" },
      [],
      "er",
      "hydro%",
      0.2
    ),
    // Q: Stellaris Phantasm — Omen DMG Bonus +60%
    new StatBuff(cbs(this, "Q", ["Q"]), { receiver: "onField" }, [
      { key: "dmg%", value: 0.6 },
    ]),
    // C1: Hydro reaction effects +15%
    new StatBuff(
      cbs(this, "C1", ["Q"]),
      { receiver: "onField" },
      this.constellation >= 1 ? [{ key: "reactionDmg%", value: 0.15 }] : []
    ),
    // C2: Charged ATK hit → team EM +80
    new StatBuff(
      cbs(this, "C2", ["charge"]),
      { receiver: "team" },
      this.constellation >= 2 ? [{ key: "em", value: 80 }] : []
    ),
    // C4: Omen targets +15% CR
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "onField" },
      this.constellation >= 4 ? [{ key: "cr", value: 0.15 }] : []
    ),
  ];

  // Q: Bubble explosion Lv10 796%, Lv13 (C3+) 940%
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 3 ? 9.4 : 7.96;
    return {
      "mona-burst": {
        label: { zh: "Q 泡影破裂", en: "Q Illusory Bubble Explosion" },
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
    };
  })();
}

@RegisterCharacter("jean")
class Jean extends CharacterBase {
  readonly buffs = [
    // C2: Jean picks up particle -> Team ATK SPD +15%
    new StatBuff(
      cbs(this, "C2", ["orb"]),
      { receiver: "team" },
      this.constellation >= 2 ? [{ key: "atkSpd%", value: 0.15 }] : []
    ),
    // C4: Q field: Anemo RES -40%
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "team", filter: { elements: ["Anemo"] } },
      this.constellation >= 4 ? [{ key: "resReduction%", value: 0.4 }] : []
    ),
  ];

  // E: Lv10 526%, Lv13 (C5+) 621%
  // Q: Lv10 765%, Lv13 (C3+) 903%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 6.21 : 5.26;
    const qMult = this.constellation >= 3 ? 9.03 : 7.65;
    return {
      "jean-skill": {
        label: { zh: "E 风压剑", en: "E Gale Blade" },
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
      "jean-burst": {
        label: { zh: "Q 蒲公英之风", en: "Q Dandelion Breeze" },
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

@RegisterCharacter("venti")
class Venti extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    // C2: E decreases Anemo/Phys RES by 24%
    // Simplified as general resReduction
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
          { key: "resReduction%", value: 0.24 },
        ])
      );
    }
    // C4: On pickup → Venti Anemo DMG +25%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E", "Q"]), { receiver: "self" }, [
          { key: "anemo%", value: 0.25 },
        ])
      );
    }
    // C6: Q targets take -20% Anemo/absorbed element RES; Venti gets +100% CD
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "team" }, [
          { key: "resReduction%", value: 0.2 },
        ]),
        new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "selfOnField" }, [
          { key: "cd", value: 1.0 },
        ])
      );
    }

    return buffs;
  })();

  // DoT Lv10: 20 × 67.7% = 1354.0%
  // DoT Lv13 (C3+): 20 × 79.9% = 1598.0%
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 3 ? 15.98 : 13.54;
    const ePressMult = this.constellation >= 5 ? 5.87 : 4.97;
    // NA talent maxes at Lv10 without external buffs.
    const naTotal = 6.153;
    const windsunderMult = 2.5;

    return {
      "venti-windsunder": {
        label: { zh: "飓风箭伤害", en: "Windsunder Arrows Combo" },
        parts: [
          {
            formula: new DirectFormula(naTotal * windsunderMult, {
              element: "Anemo",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "venti-burst-total": {
        label: {
          zh: "Q 风神之诗(总风伤)",
          en: "Q Wind's Grand Ode (Total Anemo)",
        },
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
      ...(this.constellation >= 2
        ? {
            "venti-c2-skill": {
              label: {
                zh: "C2 风起之时高天之歌伤害",
                en: "C2 Skyward Sonnet DMG",
              },
              parts: [
                {
                  formula: new DirectFormula(ePressMult * 3.0, {
                    element: "Anemo",
                    ability: "skill",
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

@RegisterCharacter("klee")
class Klee extends CharacterBase {
  readonly buffs = [
    // P1: Explosive Spark — next Charged ATK after E/Normal proc costs no stamina and deals +50% DMG (assume active)
    new StatBuff(
      cbs(this, "P1", ["E", "normal"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: 0.5 }]
    ),
    // C2: Enemies hit by mines: -23% DEF for 10s
    new StatBuff(
      cbs(this, "C2", ["E"]),
      { receiver: "team" },
      this.constellation >= 2 ? [{ key: "defReduction%", value: 0.23 }] : []
    ),
    // C6: Q active → party +10% Pyro DMG
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "team" },
      this.constellation >= 6 ? [{ key: "pyro%", value: 0.1 }] : []
    ),
  ];

  // Charged ATK: Lv10 283% (no constellation boost, C3=E, C5=Q)
  protected readonly formulaMap = {
    "klee-charged": {
      label: { zh: "A 重击", en: "A Charged ATK" },
      parts: [
        {
          formula: new DirectFormula(2.83, {
            element: "Pyro",
            ability: "charge",
            reaction: "none",
          }),
        },
      ],
    },
    "klee-charged-vape": {
      label: { zh: "A 重击(蒸发)", en: "A Charged ATK (Vape)" },
      parts: [
        {
          formula: new AmplifyFormula(2.83, {
            element: "Pyro",
            ability: "charge",
            reaction: "vaporize",
          }),
        },
      ],
    },
  };
}

@RegisterCharacter("eula")
class Eula extends CharacterBase {
  readonly buffs = [
    // E (Hold, 2 stacks): Physical RES -25%, Cryo RES -25%
    new StatBuff(
      cbs(this, "E", ["E"]),
      {
        receiver: "team",
        filter: { elements: ["Physical" as const, "Cryo"] },
      },
      [{ key: "resReduction%", value: 0.25 }]
    ),
    // C1: After consuming Grimheart, Physical DMG +30%
    new StatBuff(
      cbs(this, "C1", ["E"]),
      { receiver: "selfOnField" },
      this.constellation >= 1 ? [{ key: "phys%", value: 0.3 }] : []
    ),
    // C4: Lightfall DMG +25% vs enemies HP < 50% (assume active)
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      this.constellation >= 4 ? [{ key: "dmg%", value: 0.25 }] : []
    ),
  ];

  // Q: Lightfall Sword — base + per-stack DMG
  // Typical stacks: C0-C5 ~13, C6 ~20
  // Lv10: 725.6% + 148.2% × stacks, Lv13 (C3+): 922.3% + 188.4% × stacks
  protected readonly formulaMap = (() => {
    const baseMult = this.constellation >= 3 ? 9.223 : 7.256;
    const stackMult = this.constellation >= 3 ? 1.884 : 1.482;
    const stacks = this.constellation >= 6 ? 20 : 13;
    const totalMult = baseMult + stackMult * stacks;
    const maxMult = baseMult + stackMult * 30;
    return {
      "eula-burst-lightfall": {
        label: {
          zh: `光降之剑(${stacks}层)`,
          en: `Lightfall Sword (${stacks} stacks)`,
        },
        parts: [
          {
            formula: new DirectFormula(totalMult, {
              element: "Physical",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "eula-burst-lightfall-max": {
        label: {
          zh: "光降之剑(30层)",
          en: "Lightfall Sword (30 stacks)",
        },
        parts: [
          {
            formula: new DirectFormula(maxMult, {
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
