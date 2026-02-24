import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula, TransformFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Inazuma Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("kirara")
class Kirara extends CharacterBase {
  readonly buffs = [
    // C6: After E/Q, team All Elemental DMG +12%
    new StatBuff(
      cbs(this, "C6", ["E", "Q"]),
      { receiver: "team" },
      this.constellation >= 6 ? [{ key: "dmg%", value: 0.12 }] : []
    ),
  ];

  // Pure shielder — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("shikanoin_heizou")
class ShikanoinHeizou extends CharacterBase {
  readonly buffs = [
    // P2: E hit → Team EM +80 for 10s
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "team" }, [
      { key: "em", value: 80 },
    ]),
    // C6: E (4 stacks) → CR +16%, CD +32%
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      this.constellation >= 6
        ? [
            { key: "cr", value: 0.16 },
            { key: "cd", value: 0.32 },
          ]
        : []
    ),
  ];

  // E max stacks (Lv10): 409.5% + 4*102.4% + 204.8% = 1023.9%
  // E max (Lv13 C3+): 483.5% + 4*120.9% + 241.7% = 1208.8%
  // Q (Lv10): 566.4%, Q (Lv13 C5+): 668.7%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 12.088 : 10.239;
    const qMult = this.constellation >= 5 ? 6.687 : 5.664;
    return {
      "heizou-skill": {
        label: { zh: "勠心拳(正论)", en: "Heartstopper Strike (Conviction)" },
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
      "heizou-burst": {
        label: { zh: "聚风蹴(真空弹)", en: "Vacuum Slugger" },
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

@RegisterCharacter("kuki_shinobu")
class KukiShinobu extends CharacterBase {
  readonly buffs = [
    // P2: E ring DMG boosted by EM×25% (as flat baseDmg per hit)
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField" },
      [],
      "em",
      "baseDmg",
      0.25
    ),
    // C6: Self EM +150 when HP < 25%
    new StatBuff(
      cbs(this, "C6", []),
      { receiver: "selfOnField" },
      this.constellation >= 6 ? [{ key: "em", value: 150 }] : []
    ),
  ];

  // Q: Single hit 6.5%/7.7% HP, 7 hits normal duration (total ~45.4%/53.6% HP)
  // Lv13 (C5+) single hit 7.7% HP
  protected readonly formulaMap = (() => {
    const qHitMult = this.constellation >= 5 ? 0.077 : 0.065;
    const canHyperbloom = this.teamMeta.hasReaction("hyperbloom");
    return {
      "shinobu-burst": {
        label: { zh: "刈山祭(×7)", en: "Kariyama Rite (×7)" },
        parts: [
          {
            formula: new DirectFormula(
              qHitMult,
              {
                element: "Electro",
                ability: "burst",
                reaction: "none",
              },
              "hp"
            ),
            hits: 7,
          },
        ],
      },
      ...(canHyperbloom
        ? {
            "shinobu-hyperbloom": {
              label: { zh: "超绽放种子伤害", en: "Hyperbloom Seed" },
              parts: [
                {
                  formula: new TransformFormula(0, {
                    element: "Electro",
                    ability: "skill",
                    reaction: "hyperbloom",
                  }),
                },
              ],
            },
          }
        : {}),
    };
  })();
}

@RegisterCharacter("sayu")
class Sayu extends CharacterBase {
  // Pure healer/VV support — no damage-relevant buffs
  readonly buffs: StatBuff[] = [];
  protected readonly formulaMap = {};
}

@RegisterCharacter("thoma")
class Thoma extends CharacterBase {
  readonly buffs = [
    // P1: Shield Strength +25% (5 stacks at 5%) - not modeled
    // C6: Shield proc → Team Normal, Charged, Plunge DMG +15%
    new StatBuff(
      cbs(this, "C6", ["E", "Q"]),
      {
        receiver: "team",
        filter: { abilities: ["normal", "charge", "plunge"] },
      },
      this.constellation >= 6 ? [{ key: "dmg%", value: 0.15 }] : []
    ),
  ];

  // Q Fiery Collapse Lv10: 104% ATK + 2.2% HP (P2)
  // Lv13 (C5+): 123% ATK + 2.2% HP
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 5 ? 1.23 : 1.04;
    return {
      "thoma-burst-collapse": {
        label: { zh: "炽火崩破(持续)", en: "Fiery Collapse (DoT)" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              { element: "Pyro", ability: "burst", reaction: "none" },
              "atk",
              { key: "hp", multiplier: 0.022 }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("gorou")
class Gorou extends CharacterBase {
  private readonly geoCount = this.teamMeta.countByElement("Geo");

  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    // E/Q: flat DEF — Lv10 371, Lv13 (C3+) 438
    const defFlat = this.constellation >= 3 ? 438 : 371;
    buffs.push(
      new StatBuff(cbs(this, "E", ["E", "Q"]), { receiver: "onField" }, [
        { key: "def", value: defFlat },
      ])
    );
    // E/Q: 3+ Geo → Geo DMG +15%
    if (this.geoCount >= 3) {
      buffs.push(
        new StatBuff(cbs(this, "E", ["E", "Q"]), { receiver: "onField" }, [
          { key: "geo%", value: 0.15 },
        ])
      );
    }
    // P1: After Q, team DEF +25%
    buffs.push(
      new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "team" }, [
        { key: "def%", value: 0.25 },
      ])
    );
    // C6: After E/Q, team Geo CD — 1 Geo +10%, 2 +20%, 3+ +40%
    if (this.constellation >= 6) {
      const cdTiers = [0, 0.1, 0.2, 0.4] as const;
      const cdValue = cdTiers[Math.min(this.geoCount, 3)];
      if (cdValue > 0) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["E", "Q"]),
            { receiver: "team", filter: { elements: ["Geo"] } },
            [{ key: "cd", value: cdValue }]
          )
        );
      }
    }
    return buffs;
  })();

  // Pure support — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("kujou_sara")
class KujouSara extends CharacterBase {
  readonly buffs = [
    // E/Q: ATK bonus = 77%/91% of Sara's Base ATK to active character
    // C5 boosts E talent → Lv13 ratio 91%
    new ScalingBuff(
      cbs(this, "E", ["E", "Q"]),
      { receiver: "onField" },
      [],
      "baseAtk",
      "atk",
      this.constellation >= 5 ? 0.91 : 0.77
    ),
    // C6: Buffed characters gain +60% Electro CD
    new StatBuff(
      cbs(this, "C6", ["E", "Q"]),
      { receiver: "onField" },
      this.constellation >= 6 ? [{ key: "cd", value: 0.6 }] : []
    ),
  ];

  // Q Titanbreaker: Lv10 737.3%, Lv13 (C3+) 870.4% + 4×61.4%/72.5% Stormcluster (C4: 6×)
  protected readonly formulaMap = (() => {
    const titanMult = this.constellation >= 3 ? 8.704 : 7.373;
    const clusterMult = this.constellation >= 3 ? 0.725 : 0.614;
    const clusterCount = this.constellation >= 4 ? 6 : 4;
    return {
      "sara-burst": {
        label: {
          zh: `Q天狗咒雷·金刚坏+${clusterCount}次雷砾伤害`,
          en: `Q Koukou Sendou (Titanbreaker+${clusterCount}×Cluster)`,
        },
        parts: [
          {
            formula: new DirectFormula(titanMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(clusterMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            hits: clusterCount,
          },
        ],
      },
    };
  })();
}
