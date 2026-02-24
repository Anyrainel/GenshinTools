import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Mondstadt Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("dahlia")
class Dahlia extends CharacterBase {
  // Pure shielder/utility support — ATK SPD buff not tracked in StatKey? (Wait, now it is!)
  readonly buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
    // Q: Radiant Psalter → On-field active character ATK SPD +10%
    new StatBuff(cbs(this, "Q", ["Q"]), { receiver: "onField" }, [
      { key: "atkSpd%", value: 0.1 },
    ]),
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
  ];

  // E: Sacramental Shower — Lv10 419%, Lv13 (C5+) 494.7%
  // Q: Radiant Psalter — Lv10 731.5%, Lv13 (C3+) 863.6%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 4.947 : 4.19;
    const qMult = this.constellation >= 3 ? 8.636 : 7.315;
    return {
      "dahlia-skill": {
        label: { zh: "元素战技", en: "Sacramental Shower" },
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
        label: { zh: "元素爆发", en: "Radiant Psalter" },
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
    // Max 3 (P1) + 1 (P2) = 4 stacks = 40%
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "onField", filter: { elements: ["Physical"] } },
      [{ key: "dmg%", value: 0.4 }]
    ),
    // C6: Soulwind → Physical CD +60%
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "onField", filter: { elements: ["Physical"] } },
      this.constellation >= 6 ? [{ key: "cd", value: 0.6 }] : []
    ),
  ];

  // Pure healer/support — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("razor")
class Razor extends CharacterBase {
  readonly buffs = [
    // Q: Normal ATK SPD +40% (Lv10/Lv13 is 40%)
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.4 }]
    ),
    // C1: On elemental particle pickup → self DMG +10%
    new StatBuff(
      cbs(this, "C1", []),
      { receiver: "selfOnField" },
      this.constellation >= 1 ? [{ key: "dmg%", value: 0.1 }] : []
    ),
    // C4: E tap hit → enemy DEF -15%
    new StatBuff(
      cbs(this, "C4", ["E"]),
      { receiver: "team" },
      this.constellation >= 4 ? [{ key: "defReduction%", value: 0.15 }] : []
    ),
  ];

  protected readonly formulaMap = (() => {
    // Normal attack string total at Lv10 without external buffs
    const naTotal = 1.71 + 1.47 + 1.84 + 2.43; // = 7.45
    // Soul companion scaling: Lv10 = 43.2%, Lv13 = 51.0%
    const wolfScaling = this.constellation >= 3 ? 0.51 : 0.432;

    return {
      "razor-burst-na": {
        label: { zh: "Q后普攻一套伤害", en: "Q + NA Combo" },
        parts: [
          {
            formula: new DirectFormula(naTotal, {
              element: "Physical",
              ability: "normal",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(naTotal * wolfScaling, {
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

@RegisterCharacter("diona")
class Diona extends CharacterBase {
  readonly buffs = [
    // C2: Icy Paws DMG +15%
    new StatBuff(
      cbs(this, "C2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      this.constellation >= 2 ? [{ key: "dmg%", value: 0.15 }] : []
    ),
    // C6: In Q field, HP > 50% → EM +200 (assume active)
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "onField" },
      this.constellation >= 6 ? [{ key: "em", value: 200 }] : []
    ),
  ];

  // Shielder/healer — no significant damage formulas
  protected readonly formulaMap = {};
}

@RegisterCharacter("noelle")
class Noelle extends CharacterBase {
  readonly buffs = [
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
      const c6Mult = this.constellation >= 6 ? 2 : 1;
      if (this.teamMeta.hasReaction("overloaded")) {
        buffs.push(
          new StatBuff(
            cbs(this, "P4", ["E", "overloaded"]),
            { receiver: "onField" },
            [{ key: "atk%", value: 0.225 * c6Mult }]
          )
        );
      }
      if (this.teamMeta.hasReaction("electroCharged")) {
        buffs.push(
          new StatBuff(
            cbs(this, "P4", ["E", "electroCharged"]),
            { receiver: "onField" },
            [{ key: "em", value: 90 * c6Mult }]
          )
        );
      }
    }
    return buffs;
  })();

  // E: Oz tick DMG Lv10 160%, Lv13 (C3+) 189%, 10 ticks over duration
  protected readonly formulaMap = (() => {
    const ozTickMult = this.constellation >= 3 ? 1.89 : 1.6;
    const tag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "fischl-oz-total": {
        label: { zh: "奥兹连击", en: "Oz Ticks (×10)" },
        parts: [{ formula: new DirectFormula(ozTickMult, tag), hits: 10 }],
      },
    };
  })();
}

@RegisterCharacter("barbara")
class Barbara extends CharacterBase {
  readonly buffs = [
    // C2: During E, active character gains Hydro DMG +15%
    new StatBuff(
      cbs(this, "C2", ["E"]),
      { receiver: "onField" },
      this.constellation >= 2 ? [{ key: "hydro%", value: 0.15 }] : []
    ),
  ];

  // Healer — no significant damage formulas
  protected readonly formulaMap = {};
}

@RegisterCharacter("rosaria")
class Rosaria extends CharacterBase {
  readonly buffs = [
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
    // C1: On CRIT hit → ATK SPD +10% and Normal Attack DMG +10%
    new StatBuff(
      cbs(this, "C1", []),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      this.constellation >= 1
        ? [
            { key: "atkSpd%", value: 0.1 },
            { key: "dmg%", value: 0.1 },
          ]
        : []
    ),
    // C6: Q hit → Physical RES -20%
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "team", filter: { elements: ["Physical"] } },
      this.constellation >= 6 ? [{ key: "resReduction%", value: 0.2 }] : []
    ),
  ];

  // Q: Lv10 199%, Lv13 (C5+) 235% per ice lance tick (×6)
  protected readonly formulaMap = (() => {
    const tickMult = this.constellation >= 5 ? 2.35 : 1.99;
    return {
      "rosaria-burst": {
        label: { zh: "终命的圣礼(×6)", en: "Rites of Termination (×6)" },
        parts: [
          {
            formula: new DirectFormula(tickMult, {
              element: "Cryo",
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

@RegisterCharacter("sucrose")
class Sucrose extends CharacterBase {
  readonly buffs = [
    // P1: Swirl element → Team EM +50
    new StatBuff(cbs(this, "P1", []), { receiver: "team" }, [
      { key: "em", value: 50 },
    ]),
    // P2: E or Q hit → Team EM +20% of Sucrose's EM
    new ScalingBuff(
      cbs(this, "P2", ["E", "Q"]),
      { receiver: "team" },
      [],
      "em",
      "em",
      0.2
    ),
    // C6: Q Elemental Absorption → Team Elemental DMG +20%
    // Represented generally as dmg%
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "team" },
      this.constellation >= 6 ? [{ key: "dmg%", value: 0.2 }] : []
    ),
  ];

  // E: Lv10 380%, Lv13 (C3+) 449%
  // Q DoT: Lv10 266%, Lv13 (C5+) 315%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.49 : 3.8;
    const qMult = this.constellation >= 5 ? 3.15 : 2.66;
    return {
      "sucrose-skill": {
        label: { zh: "风灵作成·陆叁零捌", en: "Astable Anemohypostasis" },
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
        label: { zh: "禁·风灵作成(持续)", en: "Forbidden Creation (DoT)" },
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
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "onField" },
      this.constellation >= 6 ? [{ key: "pyro%", value: 0.15 }] : []
    ),
  ];

  protected readonly formulaMap = (() => {
    // E tap: Lv10 248%, Lv13 (C3+) 292%
    const eMult = this.constellation >= 3 ? 2.92 : 2.48;
    return {
      "bennett-skill": {
        label: { zh: "元素战技(点按)", en: "Skill (Tap)" },
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
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "team" },
      this.constellation >= 6 ? [{ key: "atk%", value: 0.15 }] : []
    ),
  ];

  protected readonly formulaMap = (() => {
    // Q Fiery Rain total: Lv10 910%, Lv13 (C3+) 1074%
    const qMult = this.constellation >= 3 ? 10.74 : 9.1;
    return {
      "amber-burst": {
        label: { zh: "元素爆发", en: "Fiery Rain Total" },
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

@RegisterCharacter("kaeya")
class Kaeya extends CharacterBase {
  readonly buffs: StatBuff[] = [];

  // E: Lv10 344%, Lv13 (C3+) 406%
  // Q icicle: Lv10 140%, Lv13 (C5+) 165%, 3 icicles ×~10 hits
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 4.06 : 3.44;
    const qMult = this.constellation >= 5 ? 1.65 : 1.4;
    const icicleCount = this.constellation >= 6 ? 4 : 3;
    return {
      "kaeya-skill": {
        label: { zh: "霜袭", en: "Frostgnaw" },
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
          zh: `凛冽轮舞(${icicleCount}棱×10)`,
          en: `Glacial Waltz (${icicleCount}×10)`,
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
            hits: icicleCount * 10,
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
  protected readonly formulaMap = (() => {
    const eHoldMult = this.constellation >= 5 ? 10.35 : 8.77;
    const qDischargeMult = this.constellation >= 3 ? 0.777 : 0.658;
    return {
      "lisa-hold": {
        label: { zh: "苍雷长按(三层)", en: "Violet Arc Hold (3 stacks)" },
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
        label: { zh: "蔷薇的雷光(×30)", en: "Lightning Rose (×30)" },
        parts: [
          {
            formula: new DirectFormula(qDischargeMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 30,
          },
        ],
      },
    };
  })();
}
