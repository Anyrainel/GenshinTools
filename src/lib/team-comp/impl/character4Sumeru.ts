import { ScalingBuff, StatBuff, StaticSkillBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
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
      cbs(this, ["charge"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [],
      "em",
      "baseDmg",
      7.0
    ),
    // C1: Shadowpiercing Shot CR +15%
    new StaticSkillBuff(
      cbs(this, ["charge"], "C1"),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      this.constellation,
      (c) => (c >= 1 ? [{ key: "cr", value: 0.15 }] : [])
    ),
    // C2: Self Electro DMG +30% (2 stacks × 15%)
    new StaticSkillBuff(
      cbs(this, [], "C2"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "electro%", value: 0.3 }] : [])
    ),
    // C4: Team EM +80 on multi-hit
    new StaticSkillBuff(
      cbs(this, ["charge"], "C4"),
      { receiver: "team" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "em", value: 80 }] : [])
    ),
  ];

  // On-field Electro charged shot DPS — formula is primarily EM-based via P2
  protected readonly formulaMap = {};
}

@RegisterCharacter("kaveh")
class Kaveh extends CharacterBase {
  readonly buffs = [
    // P2: During Q, self EM +100 (25×4 stacks)
    new StatBuff(cbs(this, ["Q"], "P2"), { receiver: "selfOnField" }, [
      { key: "em", value: 100 },
    ]),
    // Q: Normal ATK SPD +15%
    new StatBuff(
      cbs(this, ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "atkSpd%", value: 0.15 }]
    ),
    // Q: Bloom burst DMG bonus (team Dendro Cores)
    new StatBuff(
      cbs(this, ["Q"]),
      { receiver: "team", filter: { reactions: ["bloom"] } },
      [
        {
          key: "reactionDmg%",
          value: this.constellation >= 3 ? 0.584 : 0.495,
        },
      ]
    ),
    // C4: Self-triggered Bloom DMG +60%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "selfOnField", filter: { reactions: ["bloom"] } },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "reactionDmg%", value: 0.6 }] : [])
    ),
  ];

  // E: Lv10 367.2%, Lv13 (C5+) 433.5%
  // Q: Lv10 288.0%, Lv13 (C3+) 340.0%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 4.335 : 3.672;
    const qMult = this.constellation >= 3 ? 3.4 : 2.88;
    return {
      "kaveh-skill": {
        label: { zh: "画则巧施", en: "Artistic Ingenuity" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "kaveh-burst": {
        label: { zh: "繁绘隅穹", en: "Painted Dome" },
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

@RegisterCharacter("faruzan")
class Faruzan extends CharacterBase {
  readonly buffs = [
    // Q: Anemo RES -30%
    new StatBuff(
      cbs(this, ["Q"]),
      { receiver: "onField", filter: { elements: ["Anemo"] } },
      [{ key: "resReduction%", value: 0.3 }]
    ),
    // Q: Anemo DMG Bonus — Lv10 32.4%, Lv13 (C5+) 38.3%
    new StaticSkillBuff(
      cbs(this, ["Q"]),
      { receiver: "team", filter: { elements: ["Anemo"] } },
      this.constellation,
      (c) => [{ key: "dmg%", value: c >= 5 ? 0.383 : 0.324 }]
    ),
    // P2: Under Q, Anemo DMG gets flat baseDmg from 32% of Faruzan's base ATK
    new ScalingBuff(
      cbs(this, ["Q"], "P2"),
      { receiver: "onField", filter: { elements: ["Anemo"] } },
      [],
      "atk",
      "baseDmg",
      0.32
    ),
    // C6: Under Q, Anemo CRIT DMG +40%
    new StaticSkillBuff(
      cbs(this, ["Q"], "C6"),
      { receiver: "onField", filter: { elements: ["Anemo"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "cd", value: 0.4 }] : [])
    ),
  ];

  // Support — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("layla")
class Layla extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<
      typeof StatBuff | typeof ScalingBuff | typeof StaticSkillBuff
    >[] = [];
    // C4: Team Normal/Charged baseDmg + 5% of Layla's HP
    if (this.constellation >= 4) {
      buffs.push(
        new ScalingBuff(
          cbs(this, ["E"], "C4"),
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
        new StatBuff(cbs(this, [], "C6"), { receiver: "selfOnField" }, [
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
      cbs(this, ["Q"]),
      { receiver: "onField", filter: { abilities: ["normal"] } },
      [{ key: "dmg%", value: 0.2 }]
    ),
    // P2: Per 1000 Max HP, Normal ATK Elemental DMG +0.5%
    new ScalingBuff(
      cbs(this, ["Q"], "P2"),
      { receiver: "onField", filter: { abilities: ["normal"] } },
      [],
      "hp",
      "dmg%",
      0.000005
    ),
    // C2: After E hit, self Max HP +20% for 15s
    new StaticSkillBuff(
      cbs(this, ["E"], "C2"),
      { receiver: "self" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "hp%", value: 0.2 }] : [])
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
    new StaticSkillBuff(
      cbs(this, ["Q"], "C4"),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "em", value: 60 }] : [])
    ),
  ];

  protected readonly formulaMap = {};
}
