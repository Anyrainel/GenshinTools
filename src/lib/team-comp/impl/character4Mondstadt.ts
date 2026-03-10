import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";
import type { StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Mondstadt Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("dahlia")
class Dahlia extends CharacterBase {
  readonly buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
    // P2: Q active field ATK SPD based on max HP (up to 20%)
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "onField" },
      [],
      "hp",
      "atkSpd%",
      0.000005,
      0.2
    ),
    // C6: Active character under Favonian Favor → additional ATK SPD +10%
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "onField" }, [
            { key: "atkSpd%", value: 0.1 },
          ]),
        ]
      : []),
  ];

  // E: Sacramental Shower — Lv10 419%, Lv13 (C5+) 494.7%
  // Q: Radiant Psalter — Lv10 731.5%, Lv13 (C3+) 863.6%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 4.947 : 4.19;
    const qMult = this.constellation >= 3 ? 8.636 : 7.315;
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
}

@RegisterCharacter("mika")
class Mika extends CharacterBase {
  readonly buffs = [
    // E: Soulwind -> active character ATK SPD (Lv10: 22%, Lv13: 25%)
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "onField" }, [
      { key: "atkSpd%", value: this.constellation >= 5 ? 0.25 : 0.22 },
    ]),
    // P1+P2: E Soulwind Detector → on-field Physical DMG +10% per stack
    // Max 3 (P1) + 1 (P2) = 4 stacks; C6 adds 1 more → 5 stacks at C6
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "onField", filter: { elements: ["Physical"] } },
      [{ key: "dmg%", value: this.constellation >= 6 ? 0.5 : 0.4 }]
    ),
    // C6: Soulwind → Physical CD +60%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E"]),
            { receiver: "onField", filter: { elements: ["Physical"] } },
            [{ key: "cd", value: 0.6 }]
          ),
        ]
      : []),
  ];

  // Pure healer/support — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("razor")
class Razor extends CharacterBase {
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
    // Soul companion scaling: Lv10 = 43.2%, Lv13 (C3+) = 51.0%
    const wolfScaling = this.constellation >= 3 ? 0.51 : 0.432;

    return {
      "razor-burst-na": {
        label: { zh: "Q普攻一套", en: "Q Normal Combo" },
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
      // C6: Every 10s, charged sword releases lightning on next Normal Attack
      // Deals 100% ATK Electro DMG — separate hit, insignificant
    };
  })();
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
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "onField" }, [
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
    // Q: DEF → ATK conversion: 72% (Lv10) / 85% (Lv13 C5+), C6 adds +50%
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "selfOnField" },
      [],
      "def",
      "atk",
      (this.constellation >= 5 ? 0.85 : 0.72) +
        (this.constellation >= 6 ? 0.5 : 0)
    ),
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
            { receiver: "onField" },
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
            { receiver: "onField" },
            [{ key: "em", value: 90 * c6Mult }]
          )
        );
      }
    }
    return buffs;
  })();

  // E: Oz tick DMG Lv10 160%, Lv13 (C3+) 189%
  // C6 extends Oz duration by 2s (10s → 12s), so 12 hits instead of 10
  protected readonly formulaMap = (() => {
    const ozTickMult = this.constellation >= 3 ? 1.89 : 1.6;
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
          { formula: new DirectFormula(ozTickMult, tag), hits: ozHits },
          // C6: Oz coordinated attack, 30% ATK Electro per active character hit
          ...(this.constellation >= 6
            ? [{ formula: new DirectFormula(0.3, tag), hits: ozHits }]
            : []),
        ],
      },
    };
  })();
}

@RegisterCharacter("barbara")
class Barbara extends CharacterBase {
  readonly buffs = [
    // C2: During E, active character gains Hydro DMG +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "onField" }, [
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
    // P2: Q → team CR = 15% of Rosaria's CR (cap 15%)
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "team" },
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
  // Lv10: 187%, 274%; Lv13 (C5+): 221%, 323%
  // Q ice lance tick: Lv10 238%, Lv13 (C5+) 280%; KQM: 2s tick interval → 4 ticks (8s) / 6 ticks (C2, 12s)
  protected readonly formulaMap = (() => {
    const init1 = this.constellation >= 5 ? 2.21 : 1.87;
    const init2 = this.constellation >= 5 ? 3.23 : 2.74;
    const tickMult = this.constellation >= 5 ? 2.8 : 2.38;
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
          },
        ],
      },
    };
  })();
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
      // P2: E or Q hit → Team EM +20% of Sucrose's EM
      new ScalingBuff(
        cbs(this, "P2", ["E", "Q"]),
        { receiver: "team" },
        [],
        "em",
        "em",
        0.2
      ),
    ];
    // P1: Swirl element → matching-element party members EM +50
    // Requires team to have a swirlable element (Pyro/Hydro/Cryo/Electro)
    if (this.teamMeta.hasReaction("swirl")) {
      buffs.push(
        new StatBuff(cbs(this, "P1", ["swirl"]), { receiver: "team" }, [
          { key: "em", value: 50 },
        ])
      );
    }
    // C6: Q Elemental Absorption → Team +20% DMG Bonus for the absorbed element
    // + Hexerei characters gain additional +8.57142% (approximated as "team", faction filter not supported)
    // Absorption can only be Pyro/Hydro/Cryo/Electro; model for each present in team
    if (this.constellation >= 6 && presentAbsorbElements.length > 0) {
      for (const el of presentAbsorbElements) {
        buffs.push(
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "team" }, [
            { key: `${el.toLowerCase()}%` as StatKey, value: 0.2 },
          ])
        );
      }
      if (isHexerei) {
        for (const el of presentAbsorbElements) {
          buffs.push(
            new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "team" }, [
              { key: `${el.toLowerCase()}%` as StatKey, value: 0.0857142 },
            ])
          );
        }
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

  // E: Lv10 380%, Lv13 (C3+) 449%
  // Q DoT: Lv10 266%, Lv13 (C5+) 314%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.49 : 3.8;
    const qMult = this.constellation >= 5 ? 3.14 : 2.66;
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
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("bennett")
class Bennett extends CharacterBase {
  readonly buffs = [
    // Q: Fantastic Voyage — baseATK → flat ATK to on-field
    // Lv10: 101%, Lv13 (C5+): 119%; C1 adds +20% base ATK bonus
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "onField" },
      [],
      "baseAtk",
      "atk",
      (() => {
        const base = this.constellation >= 5 ? 1.19 : 1.01;
        return this.constellation >= 1 ? base + 0.2 : base;
      })()
    ),
    // C6: Pyro DMG +15% within Q field (sword/claymore/polearm only — no filter)
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "onField" }, [
            { key: "pyro%", value: 0.15 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // E tap: Lv10 248%, Lv13 (C3+) 292%
    const eMult = this.constellation >= 3 ? 2.92 : 2.48;
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
    // Q Fiery Rain per wave: Lv10 50.5%, Lv13 (C3+) 59.7%, 18 waves
    const qWaveMult = this.constellation >= 3 ? 0.597 : 0.505;
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

  // E: Lv10 344%, Lv13 (C3+) 406%
  // Q icicle: Lv10 140%, Lv13 (C5+) 165%
  // KQM data: ~13 total hits (C0, 3 icicles stationary), ~17 hits (C6, 4 icicles)
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.06 : 3.44;
    const qMult = this.constellation >= 5 ? 1.65 : 1.4;
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
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("lisa")
class Lisa extends CharacterBase {
  readonly buffs = [
    // P2: Q hits decrease enemy DEF -15% for 10s
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "team" }, [
      { key: "defReduction%", value: 0.15 },
    ]),
  ];

  // E hold (3 stacks): Lv10 877%, Lv13 (C5+) 1035%
  // Q discharge: Lv10 65.8%, Lv13 (C3+) 77.7%, ~30 discharges over 15s
  // C4: each discharge fires 1-3 bolts (avg 2) → 60 hits
  protected readonly formulaMap = (() => {
    const eHoldMult = this.constellation >= 5 ? 10.35 : 8.77;
    const qDischargeMult = this.constellation >= 3 ? 0.777 : 0.658;
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
          },
        ],
      },
    };
  })();
}
