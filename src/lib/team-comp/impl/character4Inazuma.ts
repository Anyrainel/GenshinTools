import { CrossScalingBuff, ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula, TransformFormula } from "../damageFormulas";
import {
  CharacterBase,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { cbs } from "../helpers";

// ═══════════════════════════════════════════════════════════════
// 4★ Inazuma Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("kirara")
class Kirara extends CharacterBase {
  readonly buffs = [
    // C6: After E/Q, team All Elemental DMG +12% (excludes Physical)
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E", "Q"]),
            {
              receiver: "team",
              filter: {
                elements: [
                  "Pyro",
                  "Hydro",
                  "Cryo",
                  "Electro",
                  "Anemo",
                  "Geo",
                  "Dendro",
                ],
              },
            },
            [{ key: "dmg%", value: 0.12 }]
          ),
        ]
      : []),
  ];

  // Rotation: E > swap > on-field NA triggers C4 every 3.8s (~5 procs per rotation)
  protected override get defaultRotation() {
    return { "kirara-c4-steed": 5 };
  }

  protected readonly formulaMap = {
    // C4: Steed of Skanda — 200% ATK as Dendro DMG (considered Burst DMG)
    ...(this.constellation >= 4
      ? {
          "kirara-c4-steed": {
            label: { zh: "C4驰骋", en: "C4 Steed of Skanda" },
            parts: [
              {
                formula: new DirectFormula(2.0, {
                  element: "Dendro",
                  ability: "burst",
                  reaction: "none",
                }),
              },
            ],
          },
        }
      : {}),
  };
}

@RegisterCharacter("shikanoin_heizou")
class ShikanoinHeizou extends CharacterBase {
  readonly buffs = [
    // P2: E hit → party (excl Heizou) EM +80 for 10s
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "otherOnField" }, [
      { key: "em", value: 80 },
    ]),
    // C1: After taking field, Normal ATK SPD +15% for 5s
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["swap-in"]),
            { receiver: "selfOnField", filter: { abilities: ["normal"] } },
            [{ key: "atkSpd%", value: 0.15 }]
          ),
        ]
      : []),
    // C6: E (4 stacks) → CR +16%, CD +32%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E"]),
            { receiver: "selfOnField", filter: { abilities: ["skill"] } },
            [
              { key: "cr", value: 0.16 },
              { key: "cd", value: 0.32 },
            ]
          ),
        ]
      : []),
  ];

  // Rotation: swap-in > E (full conviction) > Q > swap out (driver sub-DPS)
  protected override get defaultRotation() {
    return { "heizou-skill": 2, "heizou-burst": 1 };
  }

  // E max stacks (Lv10): 409.5% + 4*102.4% + 204.8% = 1023.9%
  // E max (Lv13 C3+): 483.5% + 4*120.9% + 241.7% = 1208.8%
  // Q (Lv10): 566.4%, Q (Lv13 C5+): 668.7%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 12.088 : 10.239;
    const qMult = this.constellation >= 5 ? 6.687 : 5.664;
    return {
      "heizou-skill": {
        label: { zh: "E(正论)", en: "E (Full Conviction)" },
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
        label: { zh: "Q", en: "Q" },
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

const kukiOption = {
  label: { zh: "HP状态", en: "HP State" },
  choices: [
    { value: "low", label: { zh: "HP ≤ 50%", en: "HP ≤ 50%" } },
    { value: "high", label: { zh: "HP ≥ 50%", en: "HP ≥ 50%" } },
    { value: "critical", label: { zh: "HP < 25%", en: "HP < 25%" } },
  ] as const,
  default: "low",
} satisfies OptionDef;

@RegisterCharacter("kuki_shinobu", kukiOption)
class KukiShinobu extends CharacterBase {
  private readonly hpState = resolveOption(kukiOption, this.option);

  readonly buffs = [
    // P1: HP ≤ 50% → Healing Bonus +15%
    ...(this.hpState !== "high"
      ? [
          new StatBuff(cbs(this, "P1", ["low-hp"]), { receiver: "self" }, [
            { key: "heal%", value: 0.15 },
          ]),
        ]
      : []),
    // P2: E ring DMG boosted by EM×25% (as flat baseDmg per hit)
    // Ring fires off-field → receiver: "self"; only E ring → filter skill
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      0.25
    ),
    // C6: Self EM +150 when HP < 25% (S6: conditional on CombatOpts)
    // Works off-field → receiver: "self"
    ...(this.constellation >= 6 && this.hpState === "critical"
      ? [
          new StatBuff(cbs(this, "C6", []), { receiver: "self" }, [
            { key: "em", value: 150 },
          ]),
        ]
      : []),
  ];

  // Rotation: E (off-field ring) > Q > swap; hyperbloom ~8 seeds per rotation, C4 ~4 procs
  protected override get defaultRotation() {
    return {
      "shinobu-burst": 1,
      "shinobu-hyperbloom": 8,
      "shinobu-c4-thundergrass": 4,
    };
  }

  // Q: Single hit 6.5%/7.7% HP
  // HP ≥ 50%: normal duration → 7 hits; HP ≤ 50%: extended duration → 12 hits
  // Lv13 (C5+) single hit 7.7% HP
  protected readonly formulaMap = (() => {
    const qHitMult = this.constellation >= 5 ? 0.077 : 0.065;
    const qHits = this.hpState === "high" ? 7 : 12;
    const canHyperbloom = this.teamMeta.hasReaction("hyperbloom");
    return {
      "shinobu-burst": {
        label: { zh: `Q×${qHits}`, en: `Q (×${qHits})` },
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
            hits: qHits,
          },
        ],
      },
      ...(canHyperbloom
        ? {
            "shinobu-hyperbloom": {
              label: { zh: "E超绽放", en: "E Hyperbloom" },
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
      // C4: Thundergrass Mark — 9.7% Max HP as Electro DMG
      ...(this.constellation >= 4
        ? {
            "shinobu-c4-thundergrass": {
              label: { zh: "C4雷草印", en: "C4 Thundergrass Mark" },
              parts: [
                {
                  formula: new DirectFormula(
                    0.097,
                    { element: "Electro", ability: "skill", reaction: "none" },
                    "hp"
                  ),
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
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // C6: EM → extra flat Daruma ATK-scaled damage
    // Per EM point: +0.2% ATK bonus damage on Daruma, capped at 400% ATK total extra
    // output = min(em × 0.002, 4.0) × atk → baseDmg
    if (this.constellation >= 6) {
      buffs.push(
        new CrossScalingBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [],
          "em",
          0.002,
          4.0,
          "atk",
          "baseDmg"
        )
      );
    }

    return buffs;
  })();

  // Rotation: E (hold roll) > Q; Daruma attacks ~7 times over 12s (healer/swirl support)
  protected override get defaultRotation() {
    return { "sayu-daruma": 7 };
  }

  protected readonly formulaMap = (() => {
    // Muji-Muji Daruma DMG: Lv10 = 94%, Lv13 (C3+) = 110%
    const darumaScaling = this.constellation >= 3 ? 1.1 : 0.94;
    return {
      "sayu-daruma": {
        label: { zh: "Q达摩", en: "Q Daruma" },
        parts: [
          {
            formula: new DirectFormula(darumaScaling, {
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

@RegisterCharacter("thoma")
class Thoma extends CharacterBase {
  readonly buffs = [
    // P1: Shield Strength +25% (5 stacks at 5%) - not modeled
    // C6: Shield proc → Team Normal, Charged, Plunge DMG +15%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E", "Q"]),
            {
              receiver: "team",
              filter: { abilities: ["normal", "charge", "plunge"] },
            },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  // Rotation: E > Q > swap; Fiery Collapse every 1s over 15s (C2: 18s)
  protected override get defaultRotation() {
    return { "thoma-burst-collapse": 15 };
  }

  // Q Fiery Collapse Lv10: 104% ATK + 2.2% HP (P2)
  // Lv13 (C5+): 123% ATK + 2.2% HP
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 5 ? 1.23 : 1.04;
    return {
      "thoma-burst-collapse": {
        label: { zh: "Q崩破", en: "Q Collapse" },
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

  // Rotation: E > Q > swap (Geo support, minimal field time)
  protected override get defaultRotation() {
    return { "gorou-skill": 1, "gorou-burst": 1 };
  }

  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 2.281 : 1.931;
    const qMult = this.constellation >= 5 ? 2.089 : 1.77;
    const ccMult = this.constellation >= 5 ? 1.303 : 1.104;
    const eTag = {
      element: "Geo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const qTag = {
      element: "Geo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const eBespokeTarget = {
      receiver: "selfOnField" as const,
      filter: { abilities: ["skill" as const] },
    };
    const qBespokeTarget = {
      receiver: "selfOnField" as const,
      filter: { abilities: ["burst" as const] },
    };
    return {
      "gorou-skill": {
        label: { zh: "E伤害", en: "E Skill" },
        parts: [
          {
            formula: new DirectFormula(eMult, eTag, "def"),
            bespokeBuff: new ScalingBuff(
              cbs(this, "P2", ["E"]),
              eBespokeTarget,
              [],
              "def",
              "baseDmg",
              1.56
            ),
          },
        ],
      },
      "gorou-burst": {
        label: { zh: "Q+结晶崩塌", en: "Q + Crystal Collapse" },
        parts: [
          {
            formula: new DirectFormula(qMult, qTag, "def"),
            bespokeBuff: new ScalingBuff(
              cbs(this, "P2", ["Q"]),
              qBespokeTarget,
              [],
              "def",
              "baseDmg",
              0.156
            ),
          },
          {
            formula: new DirectFormula(ccMult, qTag, "def"),
            bespokeBuff: new ScalingBuff(
              cbs(this, "P2", ["Q"]),
              qBespokeTarget,
              [],
              "def",
              "baseDmg",
              0.156
            ),
          },
        ],
      },
    };
  })();
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
    // C6: Buffed characters gain +60% Electro CRIT DMG
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E", "Q"]),
            { receiver: "onField", filter: { elements: ["Electro"] } },
            [{ key: "cd", value: 0.6 }]
          ),
        ]
      : []),
  ];

  // Rotation: E (ATK buff) > Q > swap (Electro support, buff bot)
  protected override get defaultRotation() {
    return { "sara-burst": 1 };
  }

  // Q Titanbreaker: Lv10 737.3%, Lv13 (C3+) 870.4% + 4×61.4%/72.5% Stormcluster (C4: 6×)
  protected readonly formulaMap = (() => {
    const titanMult = this.constellation >= 3 ? 8.704 : 7.373;
    const clusterMult = this.constellation >= 3 ? 0.725 : 0.614;
    const clusterCount = this.constellation >= 4 ? 6 : 4;
    return {
      "sara-burst": {
        label: {
          zh: `Q初始+雷砾×${clusterCount}`,
          en: `Q Initial + ${clusterCount}×Cluster`,
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
