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
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { OptionDef } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Mondstadt Characters
// ═══════════════════════════════════════════════════════════════

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
    const buffs: InstanceType<
      | typeof StatBuff
      | typeof StaticSkillBuff
      | typeof ScalingBuff
      | typeof ScalingSkillBuff
    >[] = [
      // P1: Transient Blossoms deal +25% DMG vs enemies HP <50% (assume active)
      new StatBuff(
        cbs(this, ["low-hp"], "P1"),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [{ key: "dmg%", value: 0.25 }]
      ),
      // P1: Silver Isotoma — Transient Blossom DMG +240% DEF
      // Only when Silver Isotoma exists (Hexerei: Secret Rite)
      ...(isHexerei
        ? [
            new ScalingSkillBuff(
              cbs(this, ["E"], "P1"),
              { receiver: "selfOnField", filter: { abilities: ["skill"] } },
              [],
              "def",
              "baseDmg",
              this.constellation,
              (c) => ({ scale: c >= 3 ? 2.84 : 2.4 })
            ),
          ]
        : []),
      // P2: After Q, nearby party EM +125 for 10s
      new StatBuff(cbs(this, ["Q"], "P2"), { receiver: "team" }, [
        { key: "em", value: 125 },
      ]),
      // P4: After Solar Isotoma, team DMG +4% per 1000 DEF (cap 12%)
      new ScalingBuff(
        cbs(this, ["E"], "P4"),
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
              cbs(this, ["E"], "P4"),
              { receiver: "team", filter: { abilities: [...allAbilities] } },
              [],
              "def",
              "dmg%",
              0.0001,
              0.3
            ),
          ]
        : []),
      // C1: After E, DEF +50% for 20s
      new StaticSkillBuff(
        cbs(this, ["E"], "C1"),
        { receiver: "self" },
        this.constellation,
        (c) => (c >= 1 ? [{ key: "def%", value: 0.5 }] : [])
      ),
      // C4: Active characters in Solar Isotoma field: Plunge DMG +30%
      new StaticSkillBuff(
        cbs(this, ["E"], "C4"),
        { receiver: "onField", filter: { abilities: ["plunge"] } },
        this.constellation,
        (c) => (c >= 4 ? [{ key: "dmg%", value: 0.3 }] : [])
      ),
      // C6: In Solar Isotoma with Crystallize shield, DMG +17% (assume active)
      new StaticSkillBuff(
        cbs(this, ["E"], "C6"),
        { receiver: "onField" },
        this.constellation,
        (c) => (c >= 6 ? [{ key: "dmg%", value: 0.17 }] : [])
      ),
    ];

    // C2: Fatal Reckoning — burst DMG +30% DEF × 4 stacks = +120% DEF as baseDmg
    if (this.constellation >= 2) {
      buffs.push(
        new ScalingBuff(
          cbs(this, ["Q"], "C2"),
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
          cbs(this, ["Q"], "C6"),
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
        label: { zh: "刹那之花", en: "Transient Blossom" },
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
        label: { zh: "元素爆发+生灭之花", en: "Burst + Fatal Blossoms" },
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
      new StatBuff(cbs(this, ["Q"], "P2"), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.2 },
      ]),
    ];

    if (this.constellation >= 1) {
      // C1: DMG +15% against enemies with HP > 50% (assume active)
      buffs.push(
        new StatBuff(cbs(this, [], "C1"), { receiver: "selfOnField" }, [
          { key: "dmg%", value: 0.15 },
        ])
      );
    }
    if (this.constellation >= 2) {
      // C2: On taking DMG, ATK +10% and ATK SPD +5% × 3 stacks = +30% / +15%
      buffs.push(
        new StatBuff(cbs(this, [], "C2"), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.3 },
          { key: "atkSpd%", value: 0.15 },
        ])
      );
    }
    if (this.constellation >= 4) {
      // C4: 2nd/3rd E cast in combo deals +40% DMG — averaged over 3 hits (approx 26.6%)
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C4"),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "dmg%", value: 0.4 * (2 / 3) }]
        )
      );
    }
    if (this.constellation >= 6) {
      // C6: After E, next 2 normals DMG +30% and ATK SPD +30%
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C6"),
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
    const nTotal = 8.1; // Lv10 N1-N4 total 810%

    return {
      "diluc-skill": {
        label: { zh: "逆焰之刃三段", en: "Searing Onslaught (3 hits)" },
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
          zh: "逆焰之刃三段(全蒸发)",
          en: "Searing Onslaught (All Vape)",
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
        label: { zh: "黎明(斩击+爆裂)", en: "Dawn (Slash + Explosion)" },
        parts: [
          {
            formula: new DirectFormula(qSlash + qExplosion, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "diluc-weave-vape": {
        label: { zh: "输出循环(EAEAEA)", en: "Weave Combo (E + 4xN)" },
        parts: [
          {
            formula: new AmplifyFormula(eMult, {
              element: "Pyro",
              ability: "skill",
              reaction: "vaporize",
            }),
          },
          {
            formula: new DirectFormula(nTotal, {
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

@RegisterCharacter("mona")
class Mona extends CharacterBase {
  readonly buffs = [
    // P3 (combat): 20% of ER as Hydro DMG%
    new ScalingBuff(
      cbs(this, ["passive"], "P3"),
      { receiver: "selfOnField" },
      [],
      "er",
      "hydro%",
      0.2
    ),
    // Q: Stellaris Phantasm — Omen DMG Bonus +60%
    new StatBuff(cbs(this, ["Q"]), { receiver: "onField" }, [
      { key: "dmg%", value: 0.6 },
    ]),
    // C1: Hydro reaction effects +15%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C1"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 1 ? [{ key: "reactionDmg%", value: 0.15 }] : [])
    ),
    // C2: Charged ATK hit → team EM +80
    new StaticSkillBuff(
      cbs(this, ["charge"], "C2"),
      { receiver: "team" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "em", value: 80 }] : [])
    ),
    // C4: Omen targets +15% CR
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "cr", value: 0.15 }] : [])
    ),
  ];

  // Q: Bubble explosion Lv10 796%, Lv13 (C3+) 940%
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 3 ? 9.4 : 7.96;
    return {
      "mona-burst": {
        label: { zh: "泡影破裂", en: "Illusory Bubble Explosion" },
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
    new StaticSkillBuff(
      cbs(this, ["orb"], "C2"),
      { receiver: "team" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "atkSpd%", value: 0.15 }] : [])
    ),
    // C4: Q field: Anemo RES -40%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "onField", filter: { elements: ["Anemo"] } },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "resReduction%", value: 0.4 }] : [])
    ),
  ];

  // E: Lv10 526%, Lv13 (C5+) 621%
  // Q: Lv10 765%, Lv13 (C3+) 903%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 6.21 : 5.26;
    const qMult = this.constellation >= 3 ? 9.03 : 7.65;
    return {
      "jean-skill": {
        label: { zh: "风压剑", en: "Gale Blade" },
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
        label: { zh: "蒲公英之风", en: "Dandelion Breeze" },
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
        new StatBuff(cbs(this, ["E"], "C2"), { receiver: "team" }, [
          { key: "resReduction%", value: 0.24 },
        ])
      );
    }
    // C4: E or Q → Venti & active members Anemo DMG +25%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, ["E", "Q"], "C4"),
          { receiver: "team" }, // Approximation for active members
          [{ key: "anemo%", value: 0.25 }]
        )
      );
    }
    // C6: Q targets take -20% RES, Venti gets +100% CD against them
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C6"), { receiver: "team" }, [
          { key: "resReduction%", value: 0.2 },
        ]),
        new StatBuff(cbs(this, ["Q"], "C6-CD"), { receiver: "selfOnField" }, [
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
    return {
      "venti-burst-total": {
        label: { zh: "风神之诗(总风伤)", en: "Wind's Grand Ode (Total Anemo)" },
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

@RegisterCharacter("klee")
class Klee extends CharacterBase {
  readonly buffs = [
    // C1: After spark explosion, self ATK +60% for 12s
    new StaticSkillBuff(
      cbs(this, [], "C1"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 1 ? [{ key: "atk%", value: 0.6 }] : [])
    ),
    // C2: Enemies hit by mines: -23% DEF for 10s
    new StaticSkillBuff(
      cbs(this, ["E"], "C2"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "defReduction%", value: 0.23 }] : [])
    ),
    // C6: Q active → party +10% Pyro DMG, self +50% Pyro DMG
    new StaticSkillBuff(
      cbs(this, ["Q"], "C6"),
      { receiver: "team" },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "pyro%", value: 0.1 }] : [])
    ),
    new StaticSkillBuff(
      cbs(this, ["Q"], "C6"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "pyro%", value: 0.5 }] : [])
    ),
  ];

  // Charged ATK: Lv10 283% (no constellation boost, C3=E, C5=Q)
  protected readonly formulaMap = {
    "klee-charged": {
      label: { zh: "重击", en: "Charged ATK" },
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
      label: { zh: "重击(蒸发)", en: "Charged ATK (Vape)" },
      parts: [
        {
          formula: new DirectFormula(2.83, {
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
      cbs(this, ["E"]),
      {
        receiver: "onField",
        filter: { elements: ["Physical" as const, "Cryo"] },
      },
      [{ key: "resReduction%", value: 0.25 }]
    ),
    // C1: After consuming Grimheart, Physical DMG +30%
    new StaticSkillBuff(
      cbs(this, ["E"], "C1"),
      { receiver: "selfOnField", filter: { elements: ["Physical"] } },
      this.constellation,
      (c) => (c >= 1 ? [{ key: "dmg%", value: 0.3 }] : [])
    ),
    // C4: Lightfall DMG +25% vs enemies HP < 50% (assume active)
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "dmg%", value: 0.25 }] : [])
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
    // E Hold: Lv10 442%, Lv13 (C5+) 522%
    const eHoldMult = this.constellation >= 5 ? 5.22 : 4.42;
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
      "eula-skill-hold": {
        label: { zh: "冰潮的涡旋(长按)", en: "Icetide Vortex (Hold)" },
        parts: [
          {
            formula: new DirectFormula(eHoldMult, {
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
