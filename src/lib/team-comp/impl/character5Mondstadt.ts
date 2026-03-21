import type { Element, ReactionType } from "@/data/types";
import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { cbs } from "../helpers";

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
      // P1 (White Flame): Pyro RES -20% (×hexMult) + corresponding reaction element RES
      const p1Val = 0.2 * hexMult;
      const reactionEls: [ReactionType, Element][] = [
        ["vaporize", "Hydro"],
        ["melt", "Cryo"],
        ["overloaded", "Electro"],
        ["burning", "Dendro"],
        ["burgeon", "Dendro"],
        ["swirl", "Anemo"],
        ["crystallize", "Geo"],
      ];
      const triggers: string[] = ["Q"];
      const elements: Element[] = ["Pyro"];
      for (const [reaction, el] of reactionEls) {
        if (!this.teamMeta.hasReaction(reaction)) continue;
        if (!triggers.includes(reaction)) triggers.push(reaction);
        if (!elements.includes(el)) elements.push(el);
      }
      if (triggers.length > 1) {
        buffs.push(
          new StatBuff(
            cbs(this, "P1", triggers),
            { receiver: "team", filter: { elements } },
            [{ key: "resReduction%", value: p1Val }]
          )
        );
      }
    } else {
      // P1 (Dark Decay): Vaporize/Melt DMG +40% (×hexMult)
      // Dragon of Dark Decay persists off-field; use "self" so Durin's burst benefits
      // whether he is on-field or not
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["Q"]),
          {
            receiver: "self",
            filter: { reactions: ["vaporize", "melt"] },
          },
          [{ key: "reactionDmg%", value: 0.4 * hexMult }]
        )
      );
    }

    // P2: After Q, per 100 ATK → burst tick DMG +3% (cap 75%) — modeled as baseDmg%
    // baseDmg% is the correct key for "deal X% of original damage"
    // Dragon fires off-field; receiver is "self" not "selfOnField"
    // Self buff → modeled via formula hit counts, not maxStacks.
    buffs.push(
      new ScalingBuff(
        cbs(this, "P2", ["Q"]),
        { receiver: "self", filter: { abilities: ["burst"] } },
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
        // C1 White Flame: "all other nearby party members" → otherOnField
        buffs.push(
          new ScalingBuff(
            { ...cbs(this, "C1", ["Q"]), maxStacks: 20 },
            {
              receiver: "otherOnField",
              filter: {
                abilities: ["normal", "charge", "plunge", "skill", "burst"],
              },
            },
            [],
            "atk",
            "baseDmg",
            0.6
          )
        );
      } else {
        // C1 Dark Decay: Durin gains stacks (20, consumed 2 per hit = 10 triggers).
        // Self buff → modeled via formula hit counts, not maxStacks.
        buffs.push(
          new ScalingBuff(
            cbs(this, "C1", ["Q"]),
            { receiver: "self", filter: { abilities: ["burst"] } },
            [],
            "atk",
            "baseDmg",
            1.5
          )
        );
      }
    }

    // C2: After burst, Pyro DMG +50% for team + corresponding reaction element DMG +50%
    if (this.constellation >= 2) {
      const c2Elements: Element[] = ["Pyro"];
      const teamEls = Object.values(this.teamMeta.elements);
      for (const el of [
        "Hydro",
        "Cryo",
        "Electro",
        "Dendro",
        "Anemo",
        "Geo",
      ] as const) {
        if (teamEls.includes(el)) c2Elements.push(el);
      }
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "team", filter: { elements: c2Elements.sort() } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    // C4: Burst DMG +40% — dragon fires off-field, use "self"
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", []),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }

    // C6: Burst ignores 30% DEF (always) — dragon fires off-field, use "self"
    // White Flame: enemy DEF -30% (team debuff)
    // Dark Decay: ignores additional 40% DEF (total 70%)
    if (this.constellation >= 6) {
      if (isWhite) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "self", filter: { abilities: ["burst"] } },
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
            { receiver: "self", filter: { abilities: ["burst"] } },
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
    // Q initial — 3 separate hits with different multipliers, must NOT be summed (S3)
    // White Lv10: 214.1%, 173.5%, 201.3%; Lv13 (C3+): 252.8%, 204.9%, 237.7%
    // Dark  Lv10: 225.8%, 183.2%, 201.3%; Lv13 (C3+): 266.6%, 216.2%, 237.7%
    const hasC3 = this.constellation >= 3;
    const qW1 = hasC3 ? 2.528 : 2.141;
    const qW2 = hasC3 ? 2.049 : 1.735;
    const qW3 = hasC3 ? 2.377 : 2.013;
    const qD1 = hasC3 ? 2.666 : 2.258;
    const qD2 = hasC3 ? 2.162 : 1.832;
    const qD3 = hasC3 ? 2.377 : 2.013;

    // Dragon ticks (White): Lv10 170.4%, Lv13 (C3+) 201.1%, 10 ticks over 20s
    // Dragon ticks (Dark): Lv10 233.7%, Lv13 (C3+) 275.9%, 10 ticks over 20s
    const dragonWhiteMult = hasC3 ? 2.011 : 1.704;
    const dragonDarkMult = hasC3 ? 2.759 : 2.337;

    const burstTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    if (isWhite) {
      return {
        "durin-burst-white": {
          label: { zh: "Q初段+龙息×10", en: "Q Initial+Breath×10" },
          parts: [
            { formula: new DirectFormula(qW1, burstTag) },
            { formula: new DirectFormula(qW2, burstTag) },
            { formula: new DirectFormula(qW3, burstTag) },
            {
              formula: new DirectFormula(dragonWhiteMult, burstTag),
              hits: 10,
              offField: true,
            },
          ],
        },
      };
    }
    return {
      "durin-burst-dark": {
        label: { zh: "Q初段+龙息×10", en: "Q Initial+Breath×10" },
        parts: [
          { formula: new DirectFormula(qD1, burstTag) },
          { formula: new DirectFormula(qD2, burstTag) },
          { formula: new DirectFormula(qD3, burstTag) },
          {
            formula: new DirectFormula(dragonDarkMult, burstTag),
            hits: 10,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (off-field burst DPS, 3 initial hits + 10 dragon ticks baked in)
  protected override get defaultRotation(): Record<string, number> {
    return this.form === "white"
      ? { "durin-burst-white": 1 }
      : { "durin-burst-dark": 1 };
  }
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
      // Transient Blossoms proc off-field; receiver is "self" not "selfOnField"
      new StatBuff(
        cbs(this, "P1", ["enemy-low-hp"]),
        { receiver: "self", filter: { abilities: ["skill"] } },
        [{ key: "dmg%", value: 0.25 }]
      ),
      // P4: Silver Isotoma — Transient Blossom DMG +240% DEF (fixed passive, not talent-dependent)
      // Only when Silver Isotoma exists (Hexerei: Secret Rite)
      // receiver: "self" — Silver Isotoma fires while Albedo is off-field
      ...(isHexerei
        ? [
            new ScalingBuff(
              cbs(this, "P4", ["E"]),
              { receiver: "self", filter: { abilities: ["skill"] } },
              [],
              "def",
              "baseDmg",
              2.4
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
      // C1: Transient Blossoms regenerate 1.2 Energy (skip per U9)
      // C1: Also, after E, Albedo's DEF +50% for 20s
      ...(this.constellation >= 1
        ? [
            new StatBuff(cbs(this, "C1", ["E"]), { receiver: "self" }, [
              { key: "def%", value: 0.5 },
            ]),
          ]
        : []),
      // C4: Active characters in Solar Isotoma field: Plunge DMG +30%
      ...(this.constellation >= 4
        ? [
            new StatBuff(
              cbs(this, "C4", ["E"]),
              { receiver: "onField", filter: { abilities: ["plunge"] } },
              [{ key: "dmg%", value: 0.3 }]
            ),
          ]
        : []),
      // C6: In Solar Isotoma with Crystallize shield (or Moondrifts), DMG +17%
      // Crystallize shield is produced by Geo reactions; gated on hasShielder() as proxy
      // (Moondrifts branch requires Nod-Krai characters, modeled separately as TODO)
      ...(this.constellation >= 6 && this.teamMeta.hasShielder()
        ? [
            new StatBuff(cbs(this, "C6", ["E"]), { receiver: "onField" }, [
              { key: "dmg%", value: 0.17 },
            ]),
          ]
        : []),
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
    // Fatal Blossom Lv10: 129.6% per blossom, Lv13 (C5+): 153% per blossom, 7 blossoms
    const fatalMult = this.constellation >= 5 ? 1.53 : 1.296;
    return {
      "albedo-blossom": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(
              blossomMult,
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
            offField: true,
          },
        ],
      },
      "albedo-burst": {
        label: { zh: "Q爆发+生灭之花×7", en: "Q Burst + Fatal Blossom ×7" },
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
            hits: 7,
          },
        ],
      },
    };
  })();

  // Rotation: E (place isotoma) + ~5 blossom procs + Q (off-field sub-DPS)
  protected override get defaultRotation() {
    return { "albedo-blossom": 5, "albedo-burst": 1 };
  }
}

const dilucOption = {
  label: { zh: "敌人血量", en: "Enemy HP" },
  choices: [
    {
      value: "above50",
      label: { zh: ">50%（C1生效）", en: ">50% (C1 active)" },
    },
    {
      value: "below50",
      label: { zh: "<50%（C1不生效）", en: "<50% (C1 inactive)" },
    },
  ] as const,
  default: "above50",
} satisfies OptionDef;

@RegisterCharacter("diluc", dilucOption)
class Diluc extends CharacterBase {
  private readonly hp = resolveOption(dilucOption, this.option);

  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: After Q, Pyro DMG +20% during infusion
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.2 },
      ]),
    ];

    if (this.constellation >= 1 && this.hp === "above50") {
      // C1: DMG +15% against enemies with HP > 50%
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["enemy-high-hp"]),
          { receiver: "selfOnField" },
          [{ key: "dmg%", value: 0.15 }]
        )
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
      // Self buff → modeled via formula hit counts, not maxStacks.
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

    // E: 3 separate hits with different multipliers — must NOT be summed (S3)
    // Lv10: 170%, 176%, 232%; Lv13 (C3+): 201%, 207%, 274%
    const e1 = eLevel === 13 ? 2.01 : 1.7;
    const e2 = eLevel === 13 ? 2.07 : 1.76;
    const e3 = eLevel === 13 ? 2.74 : 2.32;
    const qSlash = qLevel === 13 ? 4.34 : 3.67;
    const qExplosion = qLevel === 13 ? 4.34 : 3.67;
    const highPlungeMult = 4.42; // Lv10 High Plunge DMG

    const hasXianyun = this.teamMeta.characters.includes("xianyun");
    const pyroSkill = {
      element: "Pyro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };

    return {
      "diluc-skill": {
        label: { zh: "E三段", en: "E (3 hits)" },
        parts: [
          { formula: new DirectFormula(e1, pyroSkill) },
          { formula: new DirectFormula(e2, pyroSkill) },
          { formula: new DirectFormula(e3, pyroSkill) },
        ],
      },
      "diluc-burst": {
        label: { zh: "Q斩击+爆炸", en: "Q Slash + Explosion" },
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
                zh: "下落攻击",
                en: "Plunge",
              },
              parts: [
                {
                  formula: new DirectFormula(highPlungeMult, {
                    element: "Pyro",
                    ability: "plunge",
                    reaction: "none",
                  }),
                },
              ],
            },
          }
        : {}),
    };
  })();

  // Rotation: Q > N1E > N1E > N1E (vape carry)
  protected override get defaultRotation() {
    return {
      "diluc-skill": 1,
      "diluc-burst": 1,
      "diluc-plunge-xianyun": 3,
    };
  }
}

@RegisterCharacter("mona")
class Mona extends CharacterBase {
  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2 (combat): 20% of ER as Hydro DMG% (Waterborne Destiny)
      // Personal passive, always active — use "self" (no on-field restriction)
      new ScalingBuff(
        cbs(this, "P2", ["passive"]),
        { receiver: "self" },
        [],
        "er",
        "hydro%",
        0.2
      ),
      // Q: Stellaris Phantasm — Omen: opponents take +60% DMG (enemy debuff, benefits all)
      new StatBuff(cbs(this, "Q", ["Q"]), { receiver: "team" }, [
        { key: "dmg%", value: 0.6 },
      ]),
      // C1: Hydro reaction effects +15% (EC, Lunar-Charged, Vaporize, Hydro Swirl, Lunar-Crystallize)
      // "When any of your own party members hits an opponent affected by an Omen" → team-wide
      ...(this.constellation >= 1
        ? [
            new StatBuff(
              cbs(this, "C1", ["Q"]),
              {
                receiver: "team",
                filter: {
                  reactions: [
                    "electroCharged",
                    "lunarCharged",
                    "vaporize",
                    "swirl",
                    "lunarCrystallize",
                  ],
                },
              },
              [{ key: "reactionDmg%", value: 0.15 }]
            ),
          ]
        : []),
      // C2: Charged Attack hit → all nearby party members EM +80 for 12s
      ...(this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", ["charge"]), { receiver: "team" }, [
              { key: "em", value: 80 },
            ]),
          ]
        : []),
      // C4: Omen targets +15% CR (all party members attacking affected opponents)
      // C4 also: Hexerei party members gain +15% CD (approximated as team since faction-scoped not supported)
      ...(this.constellation >= 4
        ? [
            new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
              { key: "cr", value: 0.15 },
            ]),
            ...(isHexerei
              ? [
                  new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
                    { key: "cd", value: 0.15 },
                  ]),
                ]
              : []),
          ]
        : []),
      // C6: After entering Illusory Torrent, next Charged Attack +60%/s up to +180% (3s)
      // Modeled at max; ramp-up not tracked (insignificant accuracy difference)
      // C6 also: Charged Attacks against Omen enemies deal 200% original DMG (baseDmg% +1.0)
      ...(this.constellation >= 6
        ? [
            new StatBuff(
              cbs(this, "C6", ["E"]),
              { receiver: "selfOnField", filter: { abilities: ["charge"] } },
              [{ key: "dmg%", value: 1.8 }]
            ),
            new StatBuff(
              cbs(this, "C6", ["Q"]),
              { receiver: "selfOnField", filter: { abilities: ["charge"] } },
              [{ key: "baseDmg%", value: 1.0 }]
            ),
          ]
        : []),
    ];
    // P4 (Hexerei): Astral Glow of Mercury — when other party members trigger Vaporize,
    // consumes stacks (max 3), each stack increases that Vaporize DMG by 5% → max +15%
    // "队伍中自己的其他角色" → otherOnField (benefits other characters, not Mona)
    // Assumed: max 3 stacks always available (maintained via Mona's NA/charge hits)
    if (isHexerei && this.teamMeta.hasReaction("vaporize")) {
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["normal", "charge", "vaporize"]),
          { receiver: "otherOnField", filter: { reactions: ["vaporize"] } },
          [{ key: "reactionDmg%", value: 0.15 }]
        )
      );
    }
    return buffs;
  })();

  // Q: Bubble explosion Lv10 796%, Lv13 (C3+) 940%
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 3 ? 9.4 : 7.96;
    return {
      "mona-burst": {
        label: { zh: "Q伤害", en: "Q" },
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

  // Rotation: Q (omen support, bubble explosion)
  protected override get defaultRotation() {
    return { "mona-burst": 1 };
  }
}

@RegisterCharacter("jean")
class Jean extends CharacterBase {
  readonly buffs = [
    // C1: Hold E DMG +40%
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["E"]),
            { receiver: "selfOnField", filter: { abilities: ["skill"] } },
            [{ key: "dmg%", value: 0.4 }]
          ),
        ]
      : []),
    // C2: Jean picks up particle -> Team ATK SPD +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["orb"]), { receiver: "team" }, [
            { key: "atkSpd%", value: 0.15 },
          ]),
        ]
      : []),
    // C4: Q field: Anemo RES -40%
    ...(this.constellation >= 4
      ? [
          new StatBuff(
            cbs(this, "C4", ["Q"]),
            { receiver: "team", filter: { elements: ["Anemo"] } },
            [{ key: "resReduction%", value: 0.4 }]
          ),
        ]
      : []),
  ];

  // E: Lv10 526%, Lv13 (C5+) 620%
  // Q: Lv10 765%, Lv13 (C3+) 903%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 6.2 : 5.26;
    const qMult = this.constellation >= 3 ? 9.03 : 7.65;
    return {
      "jean-skill": {
        label: { zh: "E伤害", en: "E" },
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
        label: { zh: "Q伤害", en: "Q" },
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

  // Rotation: E×2 + Q (Anemo support, 6s E CD)
  protected override get defaultRotation() {
    return { "jean-skill": 1, "jean-burst": 1 };
  }
}

@RegisterCharacter("venti")
class Venti extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // C2: E decreases Anemo RES and Physical RES each by 12%;
    // launched opponents take an additional 12% of each while airborne.
    // Assumed: 12% base + 12% airborne = 24% total for both Anemo and Physical.
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "team", filter: { elements: ["Anemo", "Physical"] } },
          [{ key: "resReduction%", value: 0.24 }]
        )
      );
      // C2: Wherever a Breeze Blows — press E deals 300% of original DMG
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "baseDmg%", value: 2.0 }]
        )
      );
    }
    // C4: After E/Q → Venti and active party members gain 25% Anemo DMG
    // "温迪与队伍中自己的当前场上其他角色" → onField (provider + active)
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E", "Q"]), { receiver: "onField" }, [
          { key: "anemo%", value: 0.25 },
        ])
      );
    }
    // C6: Q targets take -20% Anemo RES
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "team", filter: { elements: ["Anemo"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
      // C6: Absorbed element also gets -20% RES (S10 pattern)
      const c6AbsorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
      const c6TeamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of c6AbsorbElements) {
        if (!c6TeamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: [el] } },
            [{ key: "resReduction%", value: 0.2 }]
          )
        );
      }
      // C6: Venti gains +100% CRIT DMG against affected opponents
      buffs.push(
        new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "self" }, [
          { key: "cd", value: 1.0 },
        ])
      );
    }

    // P4 (Hexerei): While Stormeye active, after on-field character triggers Swirl,
    // that character's DMG +50% for 4s; Venti's Q deals 135% original DMG (baseDmg% +0.35).
    // "该角色造成的伤害提升50%" → universal dmg% buff, not element-specific
    if (
      this.teamMeta.countByFaction("Hexerei") >= 2 &&
      this.teamMeta.hasReaction("swirl")
    ) {
      buffs.push(
        new StatBuff(cbs(this, "P4", ["Q", "swirl"]), { receiver: "onField" }, [
          { key: "dmg%", value: 0.5 },
        ])
      );
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["Q", "swirl"]),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [{ key: "baseDmg%", value: 0.35 }]
        )
      );
    }

    return buffs;
  })();

  // DoT Lv10: 67.7% per tick, 20 ticks
  // DoT Lv13 (C3+): 79.9% per tick, 20 ticks
  protected readonly formulaMap = (() => {
    const qTickMult = this.constellation >= 3 ? 0.799 : 0.677;
    const ePressMult = this.constellation >= 5 ? 5.86 : 4.97;
    // NA per-hit multipliers at Lv10, each ×2.5 for Windsunder Arrow
    // Must NOT sum different multipliers into one part (S3)
    // N1: 40.3%×2, N2: 87.7%, N3: 103.5%, N4: 51.5%×2, N5: 100.1%, N6: 140%
    const ws = 2.5; // windsunder multiplier
    const naTag = {
      element: "Anemo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    return {
      "venti-windsunder": {
        label: { zh: "Q 普攻飓风箭", en: "Q Windsunder Arrow" },
        parts: [
          { formula: new DirectFormula(0.403 * ws, naTag), hits: 2 }, // N1
          { formula: new DirectFormula(0.877 * ws, naTag) }, // N2
          { formula: new DirectFormula(1.035 * ws, naTag) }, // N3
          { formula: new DirectFormula(0.515 * ws, naTag), hits: 2 }, // N4
          { formula: new DirectFormula(1.001 * ws, naTag) }, // N5
          { formula: new DirectFormula(1.4 * ws, naTag) }, // N6
          // C1: 2 tracking arrows per Windsunder hit at 20% original DMG each
          ...(this.constellation >= 1
            ? [
                {
                  formula: new DirectFormula(0.403 * ws * 0.2, naTag),
                  hits: 2 * 2,
                }, // N1 C1
                {
                  formula: new DirectFormula(0.877 * ws * 0.2, naTag),
                  hits: 2,
                }, // N2 C1
                {
                  formula: new DirectFormula(1.035 * ws * 0.2, naTag),
                  hits: 2,
                }, // N3 C1
                {
                  formula: new DirectFormula(0.515 * ws * 0.2, naTag),
                  hits: 2 * 2,
                }, // N4 C1
                {
                  formula: new DirectFormula(1.001 * ws * 0.2, naTag),
                  hits: 2,
                }, // N5 C1
                { formula: new DirectFormula(1.4 * ws * 0.2, naTag), hits: 2 }, // N6 C1
              ]
            : []),
        ],
      },
      "venti-burst-total": {
        label: {
          zh: "Q×20",
          en: "Q×20",
        },
        parts: [
          {
            formula: new DirectFormula(qTickMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 20,
            offField: true,
          },
        ],
      },
      // C2: Wherever a Breeze Blows — press E deals 300% of original DMG
      ...(this.constellation >= 2
        ? {
            "venti-c2-skill": {
              label: {
                zh: "2命 E伤害",
                en: "C2 E",
              },
              parts: [
                {
                  formula: new DirectFormula(ePressMult, {
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

  // Rotation: Q (burst ticks baked in) + 1 Windsunder NA string + C2 E
  protected override get defaultRotation() {
    return {
      "venti-windsunder": 1,
      "venti-burst-total": 1,
      "venti-c2-skill": 1,
    };
  }
}

@RegisterCharacter("klee")
class Klee extends CharacterBase {
  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Explosive Spark — next Charged ATK after E/Normal proc costs no stamina and deals +50% DMG (assume active)
      new StatBuff(
        cbs(this, "P1", ["E", "normal"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "dmg%", value: 0.5 }]
      ),
      // C1: After Chained Reactions proc, Klee's ATK +60% for 12s (assume active)
      ...(this.constellation >= 1
        ? [
            new StatBuff(cbs(this, "C1", []), { receiver: "selfOnField" }, [
              { key: "atk%", value: 0.6 },
            ]),
          ]
        : []),
      // C2: Enemies hit by mines: -23% DEF for 10s
      ...(this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
              { key: "defReduction%", value: 0.23 },
            ]),
          ]
        : []),
      // C6: Q active → other party members +10% Pyro DMG, Klee +50% Pyro DMG
      // ZH: "队伍中所有其他角色获得10%火元素伤害加成" → excludes Klee → "other"
      ...(this.constellation >= 6
        ? [
            new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "other" }, [
              { key: "pyro%", value: 0.1 },
            ]),
            new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "selfOnField" }, [
              { key: "pyro%", value: 0.5 },
            ]),
          ]
        : []),
    ];
    if (isHexerei) {
      // P4 (Hexerei): Boom-Boom Strike with 3 Boom Badges → deals 150% original DMG
      // Assumed: max 3 stacks maintained (1 from NA, 1 from E, 1 from Q)
      // 150% original = baseDmg% +0.5 (i.e., 1 + 0.5 = 1.5× original)
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["normal", "E", "Q"]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "baseDmg%", value: 0.5 }]
        )
      );
    }
    return buffs;
  })();

  // Charged ATK: Lv10 283% (no constellation boost, C3=E, C5=Q)
  protected readonly formulaMap = {
    "klee-charged": {
      label: { zh: "重击", en: "CA" },
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
  };

  // Rotation: ~6 Charged Attacks per rotation (N1C or N2C combos during Q window)
  protected override get defaultRotation() {
    return { "klee-charged": 6 };
  }
}

const eulaOption = {
  label: { zh: "敌人血量", en: "Enemy HP" },
  choices: [
    {
      value: "below50",
      label: { zh: "<50%（C4生效）", en: "<50% (C4 active)" },
    },
    {
      value: "above50",
      label: { zh: ">50%（C4不生效）", en: ">50% (C4 inactive)" },
    },
  ] as const,
  default: "below50",
} satisfies OptionDef;

@RegisterCharacter("eula", eulaOption)
class Eula extends CharacterBase {
  private readonly hp = resolveOption(eulaOption, this.option);

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
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["E"]), { receiver: "selfOnField" }, [
            { key: "phys%", value: 0.3 },
          ]),
        ]
      : []),
    // C4: Lightfall DMG +25% vs enemies HP < 50%
    ...(this.constellation >= 4 && this.hp === "below50"
      ? [
          new StatBuff(
            cbs(this, "C4", ["Q", "enemy-low-hp"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "dmg%", value: 0.25 }]
          ),
        ]
      : []),
  ];

  // Rotation: E tap + E hold + Q lightfall (physical carry)
  protected override get defaultRotation() {
    return {
      "eula-skill-tap": 1,
      "eula-skill-hold": 1,
      "eula-burst-lightfall": 1,
    };
  }

  // E Tap: Lv10 264%, Lv13 (C5+) 311%
  // E Hold: Lv10 442%, Lv13 (C5+) 522%; Icewhirl Brand: 173%/204% × 2
  // Q initial Cryo hit: Lv10 442%, Lv13 (C3+) 522%
  // Q Lightfall Sword — base + per-stack DMG
  // Typical stacks: C0-C5 ~13, C6 ~20
  // Lv10: 725.6% + 148.2% × stacks, Lv13 (C3+): 922.3% + 188.4% × stacks
  // P1 Shattered Lightfall: 50% of Lightfall base DMG (on hold E consuming 2 Grimheart)
  protected readonly formulaMap = (() => {
    const hasC5 = this.constellation >= 5;
    const hasC3 = this.constellation >= 3;
    const tapMult = hasC5 ? 3.11 : 2.64;
    const holdMult = hasC5 ? 5.22 : 4.42;
    const icewhirlMult = hasC5 ? 2.04 : 1.73;
    const qInitialMult = hasC3 ? 5.22 : 4.42;
    const baseMult = hasC3 ? 9.223 : 7.256;
    const stackMult = hasC3 ? 1.884 : 1.482;
    const stacks = this.constellation >= 6 ? 20 : 13;
    const totalMult = baseMult + stackMult * stacks;
    const maxMult = baseMult + stackMult * 30;
    const cryoSkill = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const physBurst = {
      element: "Physical" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "eula-skill-tap": {
        label: { zh: "E短按", en: "E Tap" },
        parts: [{ formula: new DirectFormula(tapMult, cryoSkill) }],
      },
      "eula-skill-hold": {
        label: {
          zh: "E长按+P1碎裂",
          en: "E Hold + P1 Shattered",
        },
        parts: [
          { formula: new DirectFormula(holdMult, cryoSkill) },
          {
            formula: new DirectFormula(icewhirlMult, cryoSkill),
            hits: 2,
          },
          { formula: new DirectFormula(baseMult * 0.5, physBurst) },
        ],
      },
      "eula-burst-lightfall": {
        label: {
          zh: `Q初击+光降${stacks}层`,
          en: `Q + Lightfall (${stacks} stacks)`,
        },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
          { formula: new DirectFormula(totalMult, physBurst) },
        ],
      },
      "eula-burst-lightfall-max": {
        label: {
          zh: "Q初击+光降30层",
          en: "Q + Lightfall (30 stacks)",
        },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
          { formula: new DirectFormula(maxMult, physBurst) },
        ],
      },
    };
  })();
}

// ─── Varka ───────────────────────────────────────────────────

@RegisterCharacter("varka")
class Varka extends CharacterBase {
  /** Priority element from team: Pyro > Hydro > Electro > Cryo */
  private readonly priorityElement: Element | null = (() => {
    const teamEls = Object.values(this.teamMeta.elements);
    const priority: Element[] = ["Pyro", "Hydro", "Electro", "Cryo"];
    for (const el of priority) {
      if (teamEls.includes(el)) return el;
    }
    return null;
  })();

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // C1: Lyrical Libation — first Four Winds or Azure Devour deals 200% original DMG
    // = baseDmg% +1.0 (doubles the damage), scoped to skill (Four Winds) and charge (Azure Devour)
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["skill", "charge"] },
          },
          [{ key: "baseDmg%", value: 1.0 }]
        )
      );
    }

    // P1: Dawn Wind's March — per 1000 ATK, +10% Anemo DMG + priority element DMG, cap 25%
    // Only activates when PHEC characters are in the team (i.e., priorityElement exists)
    const pe = this.priorityElement;
    if (pe) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "P1", []),
          {
            receiver: "selfOnField",
            filter: { elements: (["Anemo", pe] as Element[]).sort() },
          },
          [],
          "atk",
          "dmg%",
          0.0001,
          0.25
        )
      );

      // P1 pair bonus: baseDmg% for Sturm und Drang attacks (NA/CA/Skill)
      // >=2 Anemo OR >=2 same PHEC → 140% (baseDmg% +0.4)
      // >=2 Anemo AND >=2 same PHEC → 220% (baseDmg% +1.2)
      const hasAnemo2 = this.teamMeta.countByElement("Anemo") >= 2;
      const hasPhec2 = (["Pyro", "Hydro", "Electro", "Cryo"] as const).some(
        (e) => this.teamMeta.countByElement(e) >= 2
      );
      const pairBonus =
        hasAnemo2 && hasPhec2 ? 1.2 : hasAnemo2 || hasPhec2 ? 0.4 : 0;
      if (pairBonus > 0) {
        buffs.push(
          new StatBuff(
            cbs(this, "P1", []),
            {
              receiver: "selfOnField",
              filter: { abilities: ["normal", "charge", "skill"] },
            },
            [{ key: "baseDmg%", value: pairBonus }]
          )
        );
      }
    }

    // P2: Wind's Vanguard — Azure Fang's Oath stacks, +7.5% DMG per stack, max 4
    // Assume max stacks in sustained Swirl rotation (Varka is Anemo DPS)
    if (this.teamMeta.hasReaction("swirl")) {
      buffs.push(
        new StatBuff(
          cbs(this, "P2", ["swirl"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "skill"] },
          },
          [{ key: "dmg%", value: 0.075 * 4 }]
        )
      );
    }

    // C4: Swirl triggers 20% Anemo DMG bonus + corresponding element DMG bonus for all nearby party members
    // Swirl requires Anemo + one of {Pyro, Hydro, Electro, Cryo}; Varka is Anemo, so just needs a teammate
    if (this.constellation >= 4 && this.teamMeta.hasReaction("swirl")) {
      const c4Elements: Element[] = ["Anemo"];
      const teamEls = Object.values(this.teamMeta.elements);
      for (const el of ["Pyro", "Hydro", "Electro", "Cryo"] as const) {
        if (teamEls.includes(el)) c4Elements.push(el);
      }
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["swirl"]),
          { receiver: "team", filter: { elements: c4Elements.sort() } },
          [{ key: "dmg%", value: 0.2 }]
        )
      );
    }

    // C6: Azure Fang's Oath stacks increase CRIT DMG by 20% per stack, max 4 = 80%
    if (this.constellation >= 6 && this.teamMeta.hasReaction("swirl")) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["swirl"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "skill"] },
          },
          [{ key: "cd", value: 0.2 * 4 }]
        )
      );
    }

    return buffs;
  })();

  // Rotation: E > 2×N5 > 2×Four Winds > 2×Azure Devour > Q (Anemo carry)
  protected override get defaultRotation() {
    return {
      "varka-normal": 2,
      "varka-four-winds": 2,
      "varka-azure-devour": 2,
      "varka-burst": 0,
    };
  }

  protected readonly formulaMap = (() => {
    // Right hand uses the team's priority element.
    // When no PHEC teammate is present, right hand stays Anemo (no infusion).
    const el = this.priorityElement ?? ("Anemo" as Element);
    const rightEl = el;

    // Skill talent levels: C3 upgrades E (Lv10 → Lv13)
    const eLv13 = this.constellation >= 3;
    // Burst talent levels: C5 upgrades Q (Lv10 → Lv13)
    const qLv13 = this.constellation >= 5;

    // ── Sturm und Drang Normal Attack multipliers (E talent) ──
    // Each stage has two values: right hand (priority element) + left hand (Anemo)
    // Lv10 / Lv13 from game data
    const sudN1Right = eLv13 ? 1.96 : 1.617;
    // Stage 1 is single-hit (only right hand — game data lists one multiplier)
    const sudN2Right = eLv13 ? 0.718 : 0.593;
    const sudN2Left = eLv13 ? 1.334 : 1.101;
    const sudN3Right = eLv13 ? 0.971 : 0.801;
    const sudN3Left = eLv13 ? 1.804 : 1.488;
    const sudN4Right = eLv13 ? 1.66 : 1.37;
    const sudN4Left = eLv13 ? 0.894 : 0.738;
    const sudN5Right = eLv13 ? 2.088 : 1.723;
    const sudN5Left = eLv13 ? 1.125 : 0.928;

    // ── Four Winds' Ascension multipliers (E talent) ──
    const fwRight = eLv13 ? 3.735 : 3.164;
    const fwLeft = eLv13 ? 2.011 : 1.704;

    // ── Azure Devour multipliers (E talent) ──
    const azRight = eLv13 ? 1.989 : 1.685;
    const azLeft = eLv13 ? 1.071 : 0.907;

    // ── Burst multipliers (Q talent) ──
    const q1 = qLv13 ? 7.16 : 6.065;
    const q2 = qLv13 ? 3.856 : 3.266;

    // ── C2: extra 800% ATK Anemo AoE hit ──
    const c2Mult = 8.0;

    const normalTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "normal" as const,
      reaction: "none" as const,
    });
    const skillTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "skill" as const,
      reaction: "none" as const,
    });
    const chargeTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "charge" as const,
      reaction: "none" as const,
    });
    const burstTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "burst" as const,
      reaction: "none" as const,
    });

    const formulas: Record<string, FormulaEntry> = {};

    // ── 1. Sturm und Drang Normal Attacks (5 stages combined) ──
    // Each stage: right hand (priority element or Anemo) + left hand (Anemo)
    // Stage 1 is single-hit (only right hand listed as one multiplier)
    const naParts: { formula: DirectFormula; hits?: number }[] = [];

    const rTag = normalTag(rightEl);
    const aTag = normalTag("Anemo");

    // N1: single hit (right hand only per game data — 161.7%/196%)
    naParts.push({ formula: new DirectFormula(sudN1Right, rTag) });

    // N2: right hand + left hand
    naParts.push({ formula: new DirectFormula(sudN2Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN2Left, aTag) });

    // N3: right hand + left hand
    naParts.push({ formula: new DirectFormula(sudN3Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN3Left, aTag) });

    // N4: right hand + left hand
    naParts.push({ formula: new DirectFormula(sudN4Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN4Left, aTag) });

    // N5: right hand + left hand
    naParts.push({ formula: new DirectFormula(sudN5Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN5Left, aTag) });

    formulas["varka-normal"] = {
      label: { zh: "狂飙突进普攻5段", en: "Sturm und Drang NA (5 stages)" },
      parts: naParts,
    };

    // ── 2. Four Winds' Ascension (only when PHEC teammate present) ──
    if (this.priorityElement) {
      const fwParts: { formula: DirectFormula; hits?: number }[] = [
        { formula: new DirectFormula(fwRight, skillTag(el)) },
        { formula: new DirectFormula(fwLeft, skillTag("Anemo")) },
      ];
      // C2: extra 800% ATK Anemo AoE hit
      if (this.constellation >= 2) {
        fwParts.push({ formula: new DirectFormula(c2Mult, skillTag("Anemo")) });
      }
      formulas["varka-four-winds"] = {
        label: { zh: "E四风将起", en: "E Four Winds' Ascension" },
        parts: fwParts,
      };

      // ── 3. Azure Devour (only when PHEC teammate present) ──
      // "特殊重击" — still classified as charge per S4 rule (no "不被视为重击伤害")
      const azParts: { formula: DirectFormula; hits?: number }[] = [
        { formula: new DirectFormula(azRight, chargeTag(el)), hits: 2 },
        { formula: new DirectFormula(azLeft, chargeTag("Anemo")), hits: 2 },
      ];
      // C2: extra 800% ATK Anemo AoE hit
      if (this.constellation >= 2) {
        azParts.push({
          formula: new DirectFormula(c2Mult, chargeTag("Anemo")),
        });
      }
      formulas["varka-azure-devour"] = {
        label: { zh: "E重击苍噬", en: "E Azure Devour" },
        parts: azParts,
      };
    }

    // ── 4. Q: Northwind Avatar (2 hits) ──
    // First hit uses priority element, second is always Anemo
    formulas["varka-burst"] = {
      label: { zh: "Q我即朔风", en: "Q Northwind Avatar" },
      parts: [
        { formula: new DirectFormula(q1, burstTag(el)) },
        { formula: new DirectFormula(q2, burstTag("Anemo")) },
      ],
    };

    return formulas;
  })();
}
