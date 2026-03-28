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
import type { ComboDescriptor, ElementalOrPhysical } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Mondstadt Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("dahlia")
class Dahlia extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
    // P2: Q active field ATK SPD based on max HP (up to 20%)
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "teamOnField" },
      [],
      "hp",
      "atkSpd%",
      0.000005,
      0.2
    ),
    // C6: Active character under Favonian Favor → additional ATK SPD +10%
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "teamOnField" }, [
            { key: "atkSpd%", value: 0.1 },
          ]),
        ]
      : []),
  ];

  // E: Sacramental Shower — param1
  // Q: Radiant Psalter — param1
  protected readonly formulaMap = (() => {
    const eMult = this.param("E", 1);
    const qMult = this.param("Q", 1);
    return {
      "dahlia-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "dahlia-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
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

  // Rotation: EQ (shield/ATK SPD support)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "dahlia-skill", count: 1 },
      { id: "dahlia-burst", count: 1 },
    ];
  }
}

@RegisterCharacter("mika")
class Mika extends CharacterBase {
  readonly buffs = [
    // E: Soulwind -> active character ATK SPD — param4
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "teamOnField" }, [
      { key: "atkSpd%", value: this.param("E", 4) },
    ]),
    // P1+P2: E Soulwind Detector → on-field Physical DMG +10% per stack
    // Max 3 (P1) + 1 (P2) = 4 stacks; C6 adds 1 more → 5 stacks at C6
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "teamOnField", filter: { elements: ["Physical"] } },
      [{ key: "dmg%", value: this.constellation >= 6 ? 0.5 : 0.4 }]
    ),
    // C6: Soulwind → Physical CD +60%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E"]),
            { receiver: "teamOnField", filter: { elements: ["Physical"] } },
            [{ key: "cd", value: 0.6 }]
          ),
        ]
      : []),
  ];

  // Pure healer/support — no damage formulas modeled
  protected readonly formulaMap = {};
}

const razorOption = {
  label: { zh: "敌人血量(2命)", en: "Enemy HP (C2)" },
  choices: [
    {
      value: "below30",
      label: { zh: "HP<30%", en: "HP<30%" },
    },
    {
      value: "above30",
      label: { zh: "HP≥30%", en: "HP≥30%" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("razor", razorOption)
class Razor extends CharacterBase {
  private readonly enemyHp = resolveOption(razorOption, this.option);

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // Q: Normal ATK SPD +40% (Lv10/Lv13 is 40%)
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["normal"] } },
        [{ key: "atkSpd%", value: 0.4 }]
      ),
      // C1: On elemental particle pickup → self DMG +10%
      ...(this.constellation >= 1
        ? [
            new StatBuff(cbs(this, "C1", []), { receiver: "selfOnField" }, [
              { key: "dmg%", value: 0.1 },
            ]),
          ]
        : []),
      // C2: CRIT Rate +10% vs enemies <30% HP
      ...(this.constellation >= 2 && this.enemyHp === "below30"
        ? [
            new StatBuff(
              cbs(this, "C2", ["enemy-low-hp"]),
              { receiver: "selfOnField" },
              [{ key: "cr", value: 0.1 }]
            ),
          ]
        : []),
      // C4: E tap hit → enemy DEF -15%
      ...(this.constellation >= 4
        ? [
            new StatBuff(cbs(this, "C4", ["E"]), { receiver: "team" }, [
              { key: "defReduction%", value: 0.15 },
            ]),
          ]
        : []),
      // C6: After consuming Electro Sigils → CR +10%, CD +50% for 15s
      // Under peak-damage model, sigil consumption is routine (Q activation + E hold)
      ...(this.constellation >= 6
        ? [
            new StatBuff(cbs(this, "C6", ["E"]), { receiver: "selfOnField" }, [
              { key: "cr", value: 0.1 },
              { key: "cd", value: 0.5 },
            ]),
          ]
        : []),
    ];
    // P4 (Hexerei): Wolf Within DMG increased by 70% of Razor's ATK
    // Always-on when Hexerei active (≥2 Hexerei in team)
    if (this.teamMeta.countByFaction("Hexerei") >= 2) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "P4", ["Q"]),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [],
          "atk",
          "baseDmg",
          0.7
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    // Normal attack hits at Lv10 (A is not upgraded by C3/C5)
    const naHits = [1.71, 1.47, 1.84, 2.43];
    // Soul companion scaling — Q param2
    const wolfScaling = this.param("Q", 2);

    return {
      "razor-burst-na": {
        label: { zh: "Q普攻（4段）", en: "Q Normal (4-hit)" },
        parts: [
          // Physical normal attack hits (4 distinct multipliers)
          ...naHits.map((mult) => ({
            formula: new DirectFormula(mult, {
              element: "Physical" as const,
              ability: "normal" as const,
              reaction: "none" as const,
            }),
          })),
          // Wolf companion hits (scales off each normal hit's multiplier)
          ...naHits.map((mult) => ({
            formula: new DirectFormula(mult * wolfScaling, {
              element: "Electro" as const,
              ability: "burst" as const,
              reaction: "none" as const,
            }),
          })),
        ],
      },
      // C6: Lupus Fulguris lightning (100% ATK Electro DMG, once per 10s during Q)
      "razor-c6-lightning": {
        label: { zh: "狼魂落雷", en: "Lupus Lightning" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(1.0, {
              element: "Electro" as const,
              ability: "normal" as const,
              reaction: "none" as const,
            }),
          },
        ],
      } satisfies FormulaEntry,
      // P4 (Hexerei): Secret Rite lightning — 150% ATK Electro AoE, once per 1s on sigil overflow
      ...(this.teamMeta.countByFaction("Hexerei") >= 2
        ? {
            "razor-p4-lightning": {
              label: { zh: "P4秘仪落雷", en: "P4 Secret Rite Lightning" },
              parts: [
                {
                  formula: new DirectFormula(1.5, {
                    element: "Electro" as const,
                    ability: "skill" as const,
                    reaction: "none" as const,
                  }),
                },
              ],
            } satisfies FormulaEntry,
          }
        : {}),
    };
  })();

  // Rotation: Q > 4×N4 combo (physical carry, ~15s burst window)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "razor-burst-na", count: 4 },
      { id: "razor-c6-lightning", count: 1 },
      { id: "razor-p4-lightning", count: 5 },
    ];
  }
}

@RegisterCharacter("diona")
class Diona extends CharacterBase {
  readonly buffs = [
    // C2: Icy Paws DMG +15%
    // Diona is typically off-field; "self" ensures the buff always applies to her skill
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "self", filter: { abilities: ["skill"] } },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : []),
    // C6: In Q field, HP > 50% → EM +200 (assume active)
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "teamOnField" }, [
            { key: "em", value: 200 },
          ]),
        ]
      : []),
  ];

  // Shielder/healer — no significant damage formulas
  protected readonly formulaMap = {};
}

@RegisterCharacter("noelle")
class Noelle extends CharacterBase {
  readonly buffs = [
    // C2: Charged Attack DMG +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", []),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : []),
    // Q: DEF → ATK conversion — Q param3
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "selfOnField" },
      [],
      "def",
      "atk",
      this.param("Q", 3)
    ),
    // C6: +50% DEF → ATK conversion
    ...(this.constellation >= 6
      ? [
          new ScalingBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "selfOnField" },
            [],
            "def",
            "atk",
            0.5
          ),
        ]
      : []),
  ];

  // Pure on-field DPS with Q infusion — formulas depend on Normal ATK multipliers
  protected readonly formulaMap = {};
}

@RegisterCharacter("fischl")
class Fischl extends CharacterBase {
  private readonly isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;

  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    if (this.isHexerei) {
      // P4: Hexerei: Secret Rite — buffs to on-field characters when Oz is present
      // C6: After Oz coordinated attack, P4 ATK% and EM effects are increased by 100%
      // Under peak-damage model, C6 coordinated attacks are always active → doubled values
      const c6Mult = this.constellation >= 6 ? 2 : 1;
      if (this.teamMeta.hasReaction("overloaded")) {
        buffs.push(
          new StatBuff(
            cbs(this, this.constellation >= 6 ? "P4/C6" : "P4", [
              "E",
              "overloaded",
            ]),
            { receiver: "teamOnField" },
            [{ key: "atk%", value: 0.225 * c6Mult }]
          )
        );
      }
      if (
        this.teamMeta.hasReaction("electroCharged") ||
        this.teamMeta.hasReaction("lunarCharged")
      ) {
        buffs.push(
          new StatBuff(
            cbs(this, this.constellation >= 6 ? "P4/C6" : "P4", [
              "E",
              "electroCharged",
              "lunarCharged",
            ]),
            { receiver: "teamOnField" },
            [{ key: "em", value: 90 * c6Mult }]
          )
        );
      }
    }
    return buffs;
  })();

  // E: Oz tick DMG — param1
  // C6 extends Oz duration by 2s (10s → 12s), so 12 hits instead of 10
  protected readonly formulaMap = (() => {
    const ozTickMult = this.param("E", 1);
    const ozHits = this.constellation >= 6 ? 12 : 10;
    const tag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "fischl-oz-total": {
        label: { zh: "E奥兹连击", en: "E Oz Combo" },
        parts: [
          {
            formula: new DirectFormula(ozTickMult, tag),
            hits: ozHits,
            offField: true,
          },
          // C6: Oz coordinated attack, 30% ATK Electro per active character hit
          ...(this.constellation >= 6
            ? [
                {
                  formula: new DirectFormula(0.3, tag),
                  hits: ozHits,
                  offField: true,
                },
              ]
            : []),
        ],
      },
    };
  })();

  // Rotation: E/Q to summon Oz, one Oz duration per rotation (hits baked in)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "fischl-oz-total", count: 1 }];
  }
}

@RegisterCharacter("barbara")
class Barbara extends CharacterBase {
  readonly buffs = [
    // C2: During E, active character gains Hydro DMG +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "teamOnField" }, [
            { key: "hydro%", value: 0.15 },
          ]),
        ]
      : []),
  ];

  // Healer — no significant damage formulas
  protected readonly formulaMap = {};
}

@RegisterCharacter("rosaria")
class Rosaria extends CharacterBase {
  readonly buffs = [
    // P1: E back-stab → self CRIT Rate +12% for 5s (assume always active, peak model)
    // ZH: 噬罪的告解从技能目标的背后攻击时，罗莎莉亚的暴击率提升12%，持续5秒。
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "selfOnField" }, [
      { key: "cr", value: 0.12 },
    ]),
    // P2: Q → other party members CR = 15% of Rosaria's CR (cap 15%)
    // ZH: "队伍中所有角色（不包括罗莎莉亚自己）" → excludes Rosaria → "other"
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "other" },
      [],
      "cr",
      "cr",
      0.15,
      0.15
    ),
    // C1: On CRIT hit → ATK SPD +10% (all attacks) and Normal Attack DMG +10%
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", []), { receiver: "selfOnField" }, [
            { key: "atkSpd%", value: 0.1 },
          ]),
          new StatBuff(
            cbs(this, "C1", []),
            { receiver: "selfOnField", filter: { abilities: ["normal"] } },
            [{ key: "dmg%", value: 0.1 }]
          ),
        ]
      : []),
    // C6: Q hit → Physical RES -20%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: ["Physical"] } },
            [{ key: "resReduction%", value: 0.2 }]
          ),
        ]
      : []),
  ];

  // Q initial: 2 separate hits with different multipliers — must NOT be summed (S3)
  // Q param1 + Q param2; Q ice lance tick: Q param3
  // KQM: 2s tick interval → 4 ticks (8s) / 6 ticks (C2, 12s)
  protected readonly formulaMap = (() => {
    const init1 = this.param("Q", 1);
    const init2 = this.param("Q", 2);
    const tickMult = this.param("Q", 3);
    const tickCount = this.constellation >= 2 ? 6 : 4;
    const cryoBurst = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "rosaria-burst": {
        label: {
          zh: `Q初击+冰棱×${tickCount}`,
          en: `Q Initial + Lance ×${tickCount}`,
        },
        parts: [
          { formula: new DirectFormula(init1, cryoBurst) },
          { formula: new DirectFormula(init2, cryoBurst) },
          {
            formula: new DirectFormula(tickMult, cryoBurst),
            hits: tickCount,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: EQ (off-field Cryo sub-DPS, burst ticks baked in)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "rosaria-burst", count: 1 }];
  }
}

@RegisterCharacter("sucrose")
class Sucrose extends CharacterBase {
  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    const allAbilities = [
      "normal",
      "charge",
      "plunge",
      "skill",
      "burst",
    ] as const;
    const absorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
    const teamElements = new Set(Object.values(this.teamMeta.elements));
    const presentAbsorbElements = absorbElements.filter((el) =>
      teamElements.has(el)
    );
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: E or Q hit → Others EM +20% of Sucrose's EM (excludes Sucrose)
      new ScalingBuff(
        cbs(this, "P2", ["E", "Q"]),
        { receiver: "other" },
        [],
        "em",
        "em",
        0.2
      ),
    ];
    // P1: Swirl element → matching-element party members EM +50 (excludes Sucrose)
    // Requires team to have a swirlable element (Pyro/Hydro/Cryo/Electro)
    if (this.teamMeta.hasReaction("swirl")) {
      buffs.push(
        new StatBuff(cbs(this, "P1", ["swirl"]), { receiver: "other" }, [
          { key: "em", value: 50 },
        ])
      );
    }
    // C6: Q Elemental Absorption → Team +20% DMG Bonus for the absorbed element
    // + Hexerei characters gain additional +8.57142% (approximated as "team", faction filter not supported)
    // Absorption can only be Pyro/Hydro/Cryo/Electro; model for each present in team
    if (this.constellation >= 6 && presentAbsorbElements.length > 0) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          {
            receiver: "team",
            filter: {
              elements: [
                ...presentAbsorbElements,
              ].sort() as ElementalOrPhysical[],
            },
          },
          [{ key: "dmg%", value: 0.2 }]
        )
      );
      if (isHexerei) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            {
              receiver: "team",
              filter: {
                elements: [
                  ...presentAbsorbElements,
                ].sort() as ElementalOrPhysical[],
              },
            },
            [{ key: "dmg%", value: 0.0857142 }]
          )
        );
      }
    }
    if (isHexerei) {
      // P4 (Hexerei): E → team DMG +5.71428%; Q → Hexerei team DMG +7.14285%
      // Both buffs are approximated as unfiltered dmg% (all ability types covered by text)
      // The Q buff is scoped to Hexerei — approximated as "team" (faction filter not supported)
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["E"]),
          { receiver: "team", filter: { abilities: [...allAbilities] } },
          [{ key: "dmg%", value: 0.0571428 }]
        ),
        new StatBuff(
          cbs(this, "P4", ["Q"]),
          { receiver: "team", filter: { abilities: [...allAbilities] } },
          [{ key: "dmg%", value: 0.0714285 }]
        )
      );
    }
    return buffs;
  })();

  // E: param1
  // Q DoT: param1
  protected readonly formulaMap = (() => {
    const eMult = this.param("E", 1);
    const qMult = this.param("Q", 1);
    return {
      "sucrose-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "sucrose-burst": {
        label: { zh: "Q持续", en: "Q DoT" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E×2 + Q (EM support/taser driver, C1 gives extra E charge)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "sucrose-skill", count: 2 },
      { id: "sucrose-burst", count: 1 },
    ];
  }
}

@RegisterCharacter("bennett")
class Bennett extends CharacterBase {
  readonly buffs = [
    // Q: Fantastic Voyage — baseATK → flat ATK to on-field (param4)
    // C1 adds +20% base ATK bonus
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "teamOnField" },
      [],
      "baseAtk",
      "atk",
      (() => {
        const base = this.param("Q", 4);
        return this.constellation >= 1 ? base + 0.2 : base;
      })()
    ),
    // C6: Pyro DMG +15% within Q field (sword/claymore/polearm only — no filter)
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "teamOnField" }, [
            { key: "pyro%", value: 0.15 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // E tap: param1
    const eMult = this.param("E", 1);
    return {
      "bennett-skill": {
        label: { zh: "E点按", en: "E Skill (Tap)" },
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

  // Rotation: E×2 + Q (support, tap E has ~4s CD with P1)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "bennett-skill", count: 1 }];
  }
}

@RegisterCharacter("amber")
class Amber extends CharacterBase {
  readonly buffs = [
    // P1: Burst CR +10%
    new StatBuff(
      cbs(this, "P1", []),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [{ key: "cr", value: 0.1 }]
    ),
    // P2: After Aimed Shot weak point hit, ATK +15% for 10s
    new StatBuff(cbs(this, "P2", ["charge"]), { receiver: "selfOnField" }, [
      { key: "atk%", value: 0.15 },
    ]),
    // C6: Q → team ATK +15% for 10s
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "team" }, [
            { key: "atk%", value: 0.15 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // Q Fiery Rain per wave — Q param1, 18 waves
    const qWaveMult = this.param("Q", 1);
    return {
      "amber-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            formula: new DirectFormula(qWaveMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 18,
          },
        ],
      },
    };
  })();

  // Rotation: Q (burst support, 18 waves baked in)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "amber-burst", count: 1 }];
  }
}

@RegisterCharacter("kaeya")
class Kaeya extends CharacterBase {
  readonly buffs = [
    // C1: Normal/Charged CR +15% vs Cryo-affected enemies (Kaeya self-applies Cryo → always active)
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", []),
            {
              receiver: "selfOnField",
              filter: { abilities: ["normal", "charge"] },
            },
            [{ key: "cr", value: 0.15 }]
          ),
        ]
      : []),
  ];

  // E: param1
  // Q icicle: param1
  // KQM data: ~13 total hits (C0, 3 icicles stationary), ~17 hits (C6, 4 icicles)
  protected readonly formulaMap = (() => {
    const eMult = this.param("E", 1);
    const qMult = this.param("Q", 1);
    const qHits = this.constellation >= 6 ? 17 : 13;
    return {
      "kaeya-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "kaeya-burst": {
        label: {
          zh: `Q冰棱×${qHits}`,
          en: `Q Icicles ×${qHits}`,
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
            hits: qHits,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E×3 + Q (quickswap Cryo sub-DPS, 6s E CD, burst hits baked in)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "kaeya-skill", count: 3 },
      { id: "kaeya-burst", count: 1 },
    ];
  }
}

@RegisterCharacter("lisa")
class Lisa extends CharacterBase {
  readonly buffs = [
    // P2: Q hits decrease enemy DEF -15% for 10s
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "team" }, [
      { key: "defReduction%", value: 0.15 },
    ]),
  ];

  // E hold (3 stacks): E param4
  // Q discharge: Q param1, ~30 discharges over 15s
  // C4: each discharge fires 1-3 bolts (avg 2) → 60 hits
  protected readonly formulaMap = (() => {
    const eHoldMult = this.param("E", 4);
    const qDischargeMult = this.param("Q", 1);
    const qHitCount = this.constellation >= 4 ? 60 : 30;
    return {
      "lisa-hold": {
        label: { zh: "E长按(三层)", en: "E Hold (3 stacks)" },
        parts: [
          {
            formula: new DirectFormula(eHoldMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "lisa-burst": {
        label: {
          zh: `Q×${qHitCount}`,
          en: `Q (×${qHitCount})`,
        },
        parts: [
          {
            formula: new DirectFormula(qDischargeMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            hits: qHitCount,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E hold (3 stacks) + Q (sub-DPS, burst hits baked in)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "lisa-hold", count: 1 },
      { id: "lisa-burst", count: 1 },
    ];
  }
}
