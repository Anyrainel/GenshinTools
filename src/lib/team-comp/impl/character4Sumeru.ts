import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula, TransformFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Sumeru Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("sethos")
class Sethos extends CharacterBase {
  readonly buffs = [
    // P2: EM × 700% → baseDmg for Shadowpiercing Shot
    // "4枚贯影箭命中敌人后" → removed after 4 hits.
    // Self buff → modeled as formula nuance (formula already has ≤4 shots).
    new ScalingBuff(
      cbs(this, "P2", ["charge"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [],
      "em",
      "baseDmg",
      7.0
    ),
    // C1: Shadowpiercing Shot CR +15%
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["charge"]),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [{ key: "cr", value: 0.15 }]
          ),
        ]
      : []),
    // C2: Self Electro DMG +30% (2 stacks × 15%)
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", []), { receiver: "selfOnField" }, [
            { key: "electro%", value: 0.3 },
          ]),
        ]
      : []),
    // C4: Team EM +80 on multi-hit
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["charge"]), { receiver: "team" }, [
            { key: "em", value: 80 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    const atkMult = this.constellation >= 3 ? 2.975 : 2.52;
    const emMult = this.constellation >= 3 ? 2.859 : 2.422;
    return {
      "sethos-shadowpiercer": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(
              atkMult,
              { element: "Electro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: emMult }
            ),
          },
        ],
      },
    };
  })();

  // Rotation: C E 3[C] — 4 Shadowpiercing Shots per 15s cycle (KQM)
  protected override get defaultRotation() {
    return { "sethos-shadowpiercer": 4 };
  }
}

@RegisterCharacter("kaveh")
class Kaveh extends CharacterBase {
  readonly buffs = [
    // P2: During Q, self EM +100 (25×4 stacks)
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
      { key: "em", value: 100 },
    ]),
    // C2: Normal ATK SPD +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["normal"] } },
            [{ key: "atkSpd%", value: 0.15 }]
          ),
        ]
      : []),
    // Q: Bloom burst DMG bonus (team Dendro Cores)
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { reactions: ["bloom", "lunarBloom"] } },
      [
        {
          key: "reactionDmg%",
          value: this.constellation >= 3 ? 0.584 : 0.495,
        },
      ]
    ),
    // C4: Self-triggered Bloom DMG +60%
    ...(this.constellation >= 4
      ? [
          new StatBuff(
            cbs(this, "C4", []),
            {
              receiver: "self",
              filter: { reactions: ["bloom", "lunarBloom"] },
            },
            [{ key: "reactionDmg%", value: 0.6 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    return {
      "kaveh-core": {
        label: { zh: "Q绽放", en: "Q Bloom" },
        parts: [
          {
            formula: new TransformFormula(0, {
              element: "Dendro",
              ability: "special",
              reaction: "bloom",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: Q E N# E N# E — on-field Bloom driver, ~5 cores detonated (KQM)
  protected override get defaultRotation() {
    return { "kaveh-core": 5 };
  }
}

@RegisterCharacter("faruzan")
class Faruzan extends CharacterBase {
  readonly buffs = [
    // Q: Anemo RES -30% (enemy debuff → always team)
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { elements: ["Anemo"] } },
      [{ key: "resReduction%", value: 0.3 }]
    ),
    // Q: Anemo DMG Bonus — Lv10 32.4%, Lv13 (C5+) 38.2%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { elements: ["Anemo"] } },
      [{ key: "anemo%", value: this.constellation >= 5 ? 0.382 : 0.324 }]
    ),
    // P2: Under Q, Anemo DMG gets flat baseDmg from 32% of Faruzan's BASE ATK (not total ATK)
    // Game text: "基于珐露珊基础攻击力的32%，提高造成的伤害"
    // "每0.8秒至多产生一次…生效1次后消失" — each 烈风护持 fires once then disappears,
    // but regenerates every 0.8s during Q. Effectively unlimited over a rotation.
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "onField",
        filter: {
          elements: ["Anemo"],
          abilities: ["normal", "charge", "plunge", "skill", "burst"],
        },
      },
      [],
      "baseAtk",
      "baseDmg",
      0.32
    ),
    // C6: Under Q, Anemo CRIT DMG +40%
    // Game text: "处于...效果影响下的角色" = all characters under Q buff (team-wide)
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: ["Anemo"] } },
            [{ key: "cd", value: 0.4 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    const vortexMult = this.constellation >= 3 ? 2.295 : 1.944;
    return {
      "faruzan-vortex": {
        label: { zh: "E伤害", en: "E Skill" },
        parts: [
          {
            formula: new DirectFormula(vortexMult, {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E charged-shot Q — Anemo support, 1 vortex per rotation (KQM)
  protected override get defaultRotation() {
    return { "faruzan-vortex": 1 };
  }
}

@RegisterCharacter("layla")
class Layla extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];
    // C4: Team Normal/Charged baseDmg + 5% of Layla's HP
    // "将在造成普通攻击或重击伤害后的0.05秒后移除" → maxStacks: 1
    if (this.constellation >= 4) {
      buffs.push(
        new ScalingBuff(
          { ...cbs(this, "C4", ["E"]), maxStacks: 1 },
          { receiver: "team", filter: { abilities: ["normal", "charge"] } },
          [],
          "hp",
          "baseDmg",
          0.05
        )
      );
    }
    // C6: Shooting Stars (E skill) and Starlight Slugs (Q burst) DMG +40%
    // Scoped to skill+burst only — does not apply to normal/charged attacks
    // Both are off-field attacks, so use "self" not "selfOnField"
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", []),
          {
            receiver: "self",
            filter: { abilities: ["skill", "burst"] },
          },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }
    return buffs;
  })();

  // Pure shielder — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("candace")
class Candace extends CharacterBase {
  readonly buffs = [
    // Q: Prayer of Crimson Crown — on-field Normal ATK Elemental DMG +20%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "onField", filter: { abilities: ["normal"] } },
      [{ key: "dmg%", value: 0.2 }]
    ),
    // P2: Per 1000 Max HP, Normal ATK Elemental DMG +0.5%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "onField", filter: { abilities: ["normal"] } },
      [],
      "hp",
      "dmg%",
      0.000005
    ),
    // C2: After E hit, self Max HP +20% for 15s
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
            { key: "hp%", value: 0.2 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = {};
}

@RegisterCharacter("dori")
class Dori extends CharacterBase {
  // Pure healer/energy battery — no damage-relevant buffs
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = {};
}

@RegisterCharacter("collei")
class Collei extends CharacterBase {
  readonly buffs = [
    // C4: After Q, all nearby characters (not Collei) EM +60 for 12s
    // Game text: "队伍中附近的所有角色（不包括柯莱自己）的元素精通提升60点"
    // "all nearby party members excluding self" → receiver: "other"
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "other" }, [
            { key: "em", value: 60 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = {};
}
