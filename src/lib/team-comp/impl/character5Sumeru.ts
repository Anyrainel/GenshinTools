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
// 5★ Sumeru Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("dehya")
class Dehya extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<
      typeof StatBuff | typeof StaticSkillBuff | typeof ScalingBuff
    >[] = [];

    // C1: HP +20%, E DMG +3.6% Max HP (baseDmg), Q DMG +6% Max HP (baseDmg)
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(cbs(this, [], "C1"), { receiver: "self" }, [
          { key: "hp%", value: 0.2 },
        ]),
        new ScalingBuff(
          cbs(this, ["E"], "C1"),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [],
          "hp",
          "baseDmg",
          0.036
        ),
        new ScalingBuff(
          cbs(this, ["Q"], "C1"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "hp",
          "baseDmg",
          0.06
        )
      );
    }

    // C2: When active character in E field is attacked, next coordinated attack DMG +50%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C2"),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    // C6: Leonine Bite CR +10%, after crits CD +15% × 4 stacks (max +60%)
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C6"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.6 },
          ]
        )
      );
    }

    return buffs;
  })();

  // Q Leonine Bite: Flame-Mane's Fist ×4 + Incineration Drive ×1 (dual ATK+HP scaling)
  // Fist Lv10: 177.7% ATK + 3.05% HP, Lv13 (C3+): 209.7% ATK + 3.60% HP
  // Drive Lv10: 250.7% ATK + 4.30% HP, Lv13 (C3+): 296.0% ATK + 5.07% HP
  protected readonly formulaMap = (() => {
    const fistAtk = this.constellation >= 3 ? 2.097 : 1.777;
    const fistHp = this.constellation >= 3 ? 0.036 : 0.0305;
    const driveAtk = this.constellation >= 3 ? 2.96 : 2.507;
    const driveHp = this.constellation >= 3 ? 0.0507 : 0.043;
    const tag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "dehya-burst-combo": {
        label: { zh: "炎啸狮子咬连段", en: "Leonine Bite Combo" },
        parts: [
          {
            formula: new DirectFormula(fistAtk, tag, "atk", {
              key: "hp",
              multiplier: fistHp,
            }),
            hits: 4,
          },
          {
            formula: new DirectFormula(driveAtk, tag, "atk", {
              key: "hp",
              multiplier: driveHp,
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("alhaitham")
class Alhaitham extends CharacterBase {
  readonly buffs = [
    // P2: EM × 0.1% → Projection & Q DMG bonus (cap 100%)
    new ScalingBuff(
      cbs(this, [], "P2"),
      { receiver: "selfOnField" },
      [],
      "em",
      "dmg%",
      0.001,
      1.0
    ),
    // C2: EM +50 per Mirror generated (max 4 stacks = 200)
    new StaticSkillBuff(
      cbs(this, ["E"], "C2"),
      { receiver: "self" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "em", value: 200 }] : [])
    ),
    // C4: Per Mirror consumed (max 3), other party EM +30 (total 90)
    // Per Mirror generated (max 3), self Dendro% +10% (total 30%)
    ...(() => {
      if (this.constellation < 4) return [];
      return [
        new StatBuff(cbs(this, ["Q"], "C4"), { receiver: "onField" }, [
          { key: "em", value: 90 },
        ]),
        new StatBuff(cbs(this, ["Q"], "C4"), { receiver: "selfOnField" }, [
          { key: "dendro%", value: 0.3 },
        ]),
      ];
    })(),
    // C6: CR +10%, CD +70% when mirrors are maxed (assume active)
    new StaticSkillBuff(
      cbs(this, ["E"], "C6"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) =>
        c >= 6
          ? [
              { key: "cr", value: 0.1 },
              { key: "cd", value: 0.7 },
            ]
          : []
    ),
  ];

  protected readonly formulaMap = (() => {
    // 2-Mirror Projection per hit: Lv10 121.0% ATK + 241.9% EM, C3+: 142.8% ATK + 285.6% EM
    // × 2 mirrors
    const projAtk = (this.constellation >= 3 ? 1.428 : 1.21) * 2;
    const projEm = (this.constellation >= 3 ? 2.856 : 2.419) * 2;
    // Burst single-instance: Lv10 218.9% ATK + 175.1% EM, C5+: 258.4% ATK + 206.7% EM
    // With 3 mirrors consumed = 10 hits
    const burstAtk = (this.constellation >= 5 ? 2.584 : 2.189) * 10;
    const burstEm = (this.constellation >= 5 ? 2.067 : 1.751) * 10;
    const projTag = {
      element: "Dendro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "alhaitham-projection": {
        label: { zh: "光幕攻击(2镜)", en: "Projection (2 Mirrors)" },
        parts: [
          {
            formula: new DirectFormula(projAtk, projTag, "atk", {
              key: "em",
              multiplier: projEm,
            }),
          },
        ],
      },
      "alhaitham-proj-spread": {
        label: { zh: "光幕攻击(蔓激化)", en: "Projection 2M (Spread)" },
        parts: [
          {
            formula: new CatalyzeFormula(
              projAtk,
              { element: "Dendro", ability: "skill", reaction: "spread" },
              "atk",
              { key: "em", multiplier: projEm }
            ),
          },
        ],
      },
      "alhaitham-burst": {
        label: { zh: "元素爆发(3镜)", en: "Burst (3 Mirrors, 10 hits)" },
        parts: [
          {
            formula: new DirectFormula(
              burstAtk,
              { element: "Dendro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: burstEm }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("wanderer")
class Wanderer extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [];

    // P1: On E, if Pyro absorbed → +30% ATK, Cryo → +20% CR
    if (Object.values(this.teamMeta.elements).includes("Pyro")) {
      buffs.push(
        new StatBuff(cbs(this, ["E-Pyro"], "P1"), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.3 },
        ])
      );
    }
    if (Object.values(this.teamMeta.elements).includes("Cryo")) {
      buffs.push(
        new StatBuff(cbs(this, ["E-Cryo"], "P1"), { receiver: "selfOnField" }, [
          { key: "cr", value: 0.2 },
        ])
      );
    }

    // C1: On E, Normal/Charged ATK SPD +10%
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C1"),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge"] },
          },
          [{ key: "atkSpd%", value: 0.1 }]
        )
      );
    }

    // C2: On E, Burst DMG +200% (max)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "C2"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 2.0 }]
        )
      );
    }

    return buffs;
  })();

  // E Hover N3 (Lv10 NA + Lv10 E): (135.8+128.5+188.4) * 1.537 = 695.8%
  // E Hover N3 (Lv10 NA + Lv13 E C5+): 452.7 * 1.614 = 730.7%
  // C6: +40% extra instance = 730.7 * 1.4 = 1023.0%
  // E Hover CA (Lv10 NA + Lv10 E): 237.7 * 1.430 = 339.9%
  // E Hover CA (Lv10 NA + Lv13 E C5+): 237.7 * 1.491 = 354.4%
  // Q Burst (Lv10): 5 * 265.0% = 1325.0%
  // Q Burst (Lv13 C3+): 5 * 312.8% = 1564.0%
  protected readonly formulaMap = (() => {
    let eNMult = this.constellation >= 5 ? 7.307 : 6.958;
    if (this.constellation >= 6) eNMult *= 1.4;

    const eCMult = this.constellation >= 5 ? 3.544 : 3.399;
    const qMult = this.constellation >= 3 ? 15.64 : 13.25;

    return {
      "wanderer-normal": {
        label: { zh: "空居·不生断(全套)", en: "Kuugo: Fushoudan (N3)" },
        parts: [
          {
            formula: new DirectFormula(eNMult, {
              element: "Anemo",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "wanderer-charge": {
        label: { zh: "空居·刀风界", en: "Kuugo: Toufukai" },
        parts: [
          {
            formula: new DirectFormula(eCMult, {
              element: "Anemo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "wanderer-burst": {
        label: { zh: "狂言·式乐五番", en: "Kyougen: Five Ceremonial Plays" },
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

@RegisterCharacter("nahida")
class Nahida extends CharacterBase {
  readonly buffs = [
    // P1: Q field grants EM = highest party EM × 25% (cap 250)
    new ScalingBuff(
      cbs(this, ["Q"], "P1"),
      { receiver: "onField" },
      [],
      "em",
      "em",
      0.25,
      250
    ),
    // P2: EM above 200 → Tri-Karma DMG +0.1%/EM (cap 80%)
    new ScalingBuff(
      cbs(this, [], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [],
      "em",
      "dmg%",
      0.001,
      0.8,
      200
    ),
    // P2: EM above 200 → Tri-Karma CR +0.03%/EM (cap 24%)
    new ScalingBuff(
      cbs(this, [], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [],
      "em",
      "cr",
      0.0003,
      0.24,
      200
    ),
    // C2: Quicken → DEF -30% for 8s
    new StaticSkillBuff(
      cbs(this, ["E", "quicken"], "C2"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "defReduction%", value: 0.3 }] : [])
    ),
    // C2: Bloom/Hyperbloom/Burgeon can crit (CR 20%, CD 100%)
    new StaticSkillBuff(
      cbs(this, ["E"], "C2"),
      {
        receiver: "team",
        filter: { reactions: ["bloom", "hyperbloom", "burgeon"] },
      },
      this.constellation,
      (c) =>
        c >= 2
          ? [
              { key: "reactionCr", value: 0.2 },
              { key: "reactionCd", value: 1.0 },
            ]
          : []
    ),
    // C4: Self EM +140 (model 3 enemies average)
    new StaticSkillBuff(
      cbs(this, ["E"], "C4"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "em", value: 140 }] : [])
    ),
  ];

  // Tri-Karma: Lv10 185.8% ATK + 371.5% EM, Lv13 (C3+) 219.3% ATK + 438.6% EM
  protected readonly formulaMap = (() => {
    const atkMult = this.constellation >= 3 ? 2.193 : 1.858;
    const emMult = this.constellation >= 3 ? 4.386 : 3.715;
    return {
      "nahida-karma": {
        label: { zh: "灭净三业", en: "Tri-Karma Purification" },
        parts: [
          {
            formula: new DirectFormula(
              atkMult,
              { element: "Dendro", ability: "skill", reaction: "none" },
              "atk",
              { key: "em", multiplier: emMult }
            ),
          },
        ],
      },
      "nahida-karma-spread": {
        label: { zh: "灭净三业(蔓激化)", en: "Tri-Karma (Spread)" },
        parts: [
          {
            formula: new DirectFormula(
              atkMult,
              { element: "Dendro", ability: "skill", reaction: "spread" },
              "atk",
              { key: "em", multiplier: emMult }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("cyno")
class Cyno extends CharacterBase {
  readonly buffs = [
    // Q: EM +100 and Normal ATK SPD +20% during Pactsworn Pathclearer
    new StatBuff(cbs(this, ["Q"]), { receiver: "selfOnField" }, [
      { key: "em", value: 100 },
    ]),
    new StatBuff(
      cbs(this, ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.2 }]
    ),
    // P2: Normal ATK DMG += 150% EM as baseDmg (during Q)
    new ScalingBuff(
      cbs(this, ["Q"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [],
      "em",
      "baseDmg",
      1.5
    ),
    // P2: Duststalker Bolt DMG += 250% EM as baseDmg
    new ScalingBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      2.5
    ),
    // P1: Mortuary Rite (Judication) +35% DMG
    new StatBuff(
      cbs(this, ["E"], "P1"),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: 0.35 }]
    ),
    // C2: Normal ATK hit → Electro DMG +10% × 5 stacks = +50%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C2"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "electro%", value: 0.5 }] : [])
    ),
  ];

  protected readonly formulaMap = (() => {
    // Burst N1-N5 combo: Lv10 154.7+163+206.8+102.2×2+258.6 = 887.5%
    // C3+ (Q level): Lv13 187.5+197.5+250.6+123.8×2+313.4 = 1196.6%
    const nMult = this.constellation >= 3 ? 11.966 : 8.875;
    // Mortuary Rite: Lv10 282.2%, C5+ 333.2%
    const eMult = this.constellation >= 5 ? 3.332 : 2.822;
    return {
      "cyno-normal": {
        label: { zh: "启途誓使连段", en: "Pathclearer Combo" },
        parts: [
          {
            formula: new DirectFormula(nMult, {
              element: "Electro",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "cyno-normal-aggravate": {
        label: { zh: "启途誓使连段(超激化)", en: "Pathclearer (Aggravate)" },
        parts: [
          {
            formula: new AmplifyFormula(nMult, {
              element: "Electro",
              ability: "normal",
              reaction: "aggravate",
            }),
          },
        ],
      },
      "cyno-skill": {
        label: { zh: "冥祭", en: "Mortuary Rite" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("nilou")
class Nilou extends CharacterBase {
  readonly buffs = (() => {
    // P1: Golden Chalice's Bounty requires ALL members Dendro/Hydro, ≥1 of each
    const elements = Object.values(this.teamMeta.elements);
    const allDendroHydro = elements.every(
      (e) => e === "Dendro" || e === "Hydro"
    );
    const hasDendro = elements.some((e) => e === "Dendro");
    const hasHydro = elements.some((e) => e === "Hydro");
    const isBountiful = allDendroHydro && hasDendro && hasHydro;

    const buffs: StatBuff[] = [];

    if (isBountiful) {
      // P1: EM +100 to all nearby characters (on Dendro hit trigger)
      buffs.push(
        new StatBuff(cbs(this, ["E"], "P1"), { receiver: "team" }, [
          { key: "em", value: 100 },
        ])
      );
      // P2: Per 1000 HP above 30000 → Bloom DMG +9% (max 400%)
      buffs.push(
        new ScalingBuff(
          cbs(this, [], "P2"),
          { receiver: "onField", filter: { reactions: ["bloom"] } },
          [],
          "hp",
          "reactionDmg%",
          0.00009,
          4.0,
          30000
        )
      );
    }

    // C2: Hydro RES -35% on Bloom hit
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, ["bloom"], "C2"), { receiver: "onField" }, [
          { key: "resReduction%", value: 0.35 },
        ])
      );
    }

    // C4: E 3rd step → Q DMG +50% for 8s
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, ["E"], "C4"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    // C6: Per 1000 HP → CR +0.6% (cap 30%), CD +1.2% (cap 60%)
    if (this.constellation >= 6) {
      buffs.push(
        new ScalingBuff(
          cbs(this, [], "C6"),
          { receiver: "self" },
          [],
          "hp",
          "cr",
          0.000006,
          0.3
        ),
        new ScalingBuff(
          cbs(this, [], "C6"),
          { receiver: "self" },
          [],
          "hp",
          "cd",
          0.000012,
          0.6
        )
      );
    }

    return buffs;
  })();

  // Q total: Lv10 (33.2%+40.6%) HP = 73.8% HP, Lv13 (C3+) (39.2%+47.9%) = 87.1% HP
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 3 ? 0.871 : 0.738;
    return {
      "nilou-burst": {
        label: { zh: "浮莲舞步(全段)", en: "Dance of Abzendegi (Full)" },
        parts: [
          {
            formula: new DirectFormula(
              0,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "atk",
              { key: "hp", multiplier: qMult }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("tighnari")
class Tighnari extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: After Wreath Arrow, EM +50
      new StatBuff(
        cbs(this, ["charge"], "P1"),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "em", value: 50 }]
      ),
      // P2: Each point of EM → Charged ATK +0.06% & Q DMG +0.06% (Max 60%)
      new ScalingBuff(
        cbs(this, [], "P2"),
        {
          receiver: "selfOnField",
          filter: { abilities: ["charge", "burst"] },
        },
        [],
        "em",
        "dmg%",
        0.0006,
        0.6
      ),
    ];
    // C1: Charged Attack CR +15%
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, ["charge"], "C1"),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "cr", value: 0.15 }]
        )
      );
    }
    // C2: Within Vijnana-Khanda Field with enemies → +20% Dendro DMG
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, ["E"], "C2"), { receiver: "selfOnField" }, [
          { key: "dendro%", value: 0.2 },
        ])
      );
    }
    // C4: Q unleashed + reactions → Team EM +120
    if (this.constellation >= 4) {
      const canC4React =
        this.teamMeta.hasReaction("burning") ||
        this.teamMeta.hasReaction("bloom") ||
        this.teamMeta.hasReaction("quicken") ||
        this.teamMeta.hasReaction("spread");

      buffs.push(
        new StatBuff(
          cbs(
            this,
            canC4React ? ["Q", "burning", "bloom", "quicken", "spread"] : ["Q"],
            "C4"
          ),
          { receiver: "team" },
          [{ key: "em", value: canC4React ? 120 : 60 }]
        )
      );
    }
    return buffs;
  })();

  // Lv10: 157.0% + 4 × 69.5% = 435.0%
  // C6: + 150.0% = 585.0%
  // Q Lv10: 6 × 100.1% + 6 × 122.4% = 1335.0%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 6 ? 5.85 : 4.35;
    const qMult = this.constellation >= 5 ? 15.84 : 13.35; // approximate Q upgrade
    return {
      "tighnari-charge": {
        label: { zh: "花筥箭+藏蕴花矢", en: "Wreath Arrow + Clusterbloom" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Dendro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "tighnari-burst": {
        label: { zh: "造生缠藤箭(全中)", en: "Fashioner's Tanglevine Shaft" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}
