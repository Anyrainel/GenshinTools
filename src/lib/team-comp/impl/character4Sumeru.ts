import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  CatalyzeFormula,
  DirectFormula,
  TransformFormula,
} from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Sumeru Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("sethos")
class Sethos extends CharacterBase {
  readonly buffs = [
    // P2: EM × 700% → baseDmg for Shadowpiercing Shot
    new ScalingBuff(
      cbs(this, "P2", ["charge"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [],
      "em",
      "baseDmg",
      7.0
    ),
    // C1: Shadowpiercing Shot CR +15%
    new StatBuff(
      cbs(this, "C1", ["charge"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation >= 1 ? [{ key: "cr", value: 0.15 }] : []
    ),
    // C2: Self Electro DMG +30% (2 stacks × 15%)
    new StatBuff(
      cbs(this, "C2", []),
      { receiver: "selfOnField" },
      this.constellation >= 2 ? [{ key: "electro%", value: 0.3 }] : []
    ),
    // C4: Team EM +80 on multi-hit
    new StatBuff(
      cbs(this, "C4", ["charge"]),
      { receiver: "team" },
      this.constellation >= 4 ? [{ key: "em", value: 80 }] : []
    ),
  ];

  protected readonly formulaMap = (() => {
    const atkMult = this.constellation >= 3 ? 2.975 : 2.52;
    const emMult = this.constellation >= 3 ? 2.859 : 2.422;
    return {
      "sethos-shadowpiercer": {
        label: { zh: "贯影箭伤害", en: "Shadowpiercing Shot" },
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
      "sethos-shadowpiercer-aggravate": {
        label: {
          zh: "贯影箭伤害(超激化)",
          en: "Shadowpiercing Shot (Aggravate)",
        },
        parts: [
          {
            formula: new CatalyzeFormula(
              atkMult,
              { element: "Electro", ability: "charge", reaction: "aggravate" },
              "atk",
              { key: "em", multiplier: emMult }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("kaveh")
class Kaveh extends CharacterBase {
  readonly buffs = [
    // P2: During Q, self EM +100 (25×4 stacks)
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
      { key: "em", value: 100 },
    ]),
    // Q: Normal ATK SPD +15%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.15 }]
    ),
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
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "self", filter: { reactions: ["bloom", "lunarBloom"] } },
      this.constellation >= 4 ? [{ key: "reactionDmg%", value: 0.6 }] : []
    ),
  ];

  protected readonly formulaMap = (() => {
    return {
      "kaveh-core": {
        label: { zh: "草原核伤害(含Q加成)", en: "Dendro Core DMG (w/ Q Buff)" },
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
    // Q: Anemo DMG Bonus — Lv10 32.4%, Lv13 (C5+) 38.3%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { elements: ["Anemo"] } },
      [{ key: "anemo%", value: this.constellation >= 5 ? 0.383 : 0.324 }]
    ),
    // P2: Under Q, Anemo DMG gets flat baseDmg from 32% of Faruzan's base ATK
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "onField", filter: { elements: ["Anemo"] } },
      [],
      "atk",
      "baseDmg",
      0.32
    ),
    // C6: Under Q, Anemo CRIT DMG +40%
    new StatBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "onField", filter: { elements: ["Anemo"] } },
      this.constellation >= 6 ? [{ key: "cd", value: 0.4 }] : []
    ),
  ];

  protected readonly formulaMap = (() => {
    const vortexMult = this.constellation >= 3 ? 2.295 : 1.944;
    return {
      "faruzan-vortex": {
        label: { zh: "E 风压坍陷风涡", en: "E Pressurized Collapse Vortex" },
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
}

@RegisterCharacter("layla")
class Layla extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];
    // C4: Team Normal/Charged baseDmg + 5% of Layla's HP
    if (this.constellation >= 4) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C4", ["E"]),
          { receiver: "team", filter: { abilities: ["normal", "charge"] } },
          [],
          "hp",
          "baseDmg",
          0.05
        )
      );
    }
    // C6: Shooting Stars and Starlight Slugs DMG +40%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", []), { receiver: "selfOnField" }, [
          { key: "dmg%", value: 0.4 },
        ])
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
    new StatBuff(
      cbs(this, "C2", ["E"]),
      { receiver: "self" },
      this.constellation >= 2 ? [{ key: "hp%", value: 0.2 }] : []
    ),
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
    // C4: After Q, team EM +60 for 12s (not self)
    new StatBuff(
      cbs(this, "C4", ["Q"]),
      { receiver: "onField" },
      this.constellation >= 4 ? [{ key: "em", value: 60 }] : []
    ),
  ];

  protected readonly formulaMap = {};
}
