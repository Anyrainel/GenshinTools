import { CrossScalingBuff, ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula, TransformFormula } from "../damageFormulas";
import {
  CharacterBase,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor } from "../types";

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
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "kirara-c4-steed", count: 5 }];
  }

  protected readonly formulaMap = {
    // C4: Steed of Skanda — 200% ATK as Dendro DMG (considered Burst DMG)
    "kirara-c4-steed": {
      label: { zh: "驰骋", en: "Steed of Skanda" },
      minC: 4,
      parts: [
        {
          formula: new DirectFormula(2.0, {
            element: "Dendro",
            ability: "burst",
            reaction: "none",
          }),
          offField: true,
        },
      ],
    },
  };
}

@RegisterCharacter("shikanoin_heizou")
class ShikanoinHeizou extends CharacterBase {
  readonly buffs = [
    // P2: E hit → party (excl Heizou) EM +80 for 10s
    // "队伍中所有角色（不包括鹿野院平藏自己）" → all party members, not just active
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "other" }, [
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
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "heizou-skill", count: 2 },
      { id: "heizou-burst", count: 1 },
    ];
  }

  // E max stacks: param1 + 4*param2 + param3
  // Q: param1
  protected readonly formulaMap = (() => {
    const eMult =
      this.param("E", 1) + 4 * this.param("E", 2) + this.param("E", 3);
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
            formula: new DirectFormula(this.param("Q", 1), {
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
    // C6: Self EM +150 when HP < 25% (S6: conditional on OptionMap)
    // Works off-field → receiver: "self"
    ...(this.constellation >= 6 && this.hpState === "critical"
      ? [
          new StatBuff(cbs(this, "C6", ["low-hp"]), { receiver: "self" }, [
            { key: "em", value: 150 },
          ]),
        ]
      : []),
  ];

  // Rotation: E (off-field ring) > Q > swap; hyperbloom ~8 seeds per rotation, C4 ~4 procs
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "shinobu-burst", count: 1 },
      { id: "shinobu-hyperbloom", count: 8 },
      { id: "shinobu-c4-thundergrass", count: 4 },
    ];
  }

  // Q: Single hit param1 % HP
  // HP ≥ 50%: normal duration → 7 hits; HP ≤ 50%: extended duration → 12 hits
  protected readonly formulaMap = (() => {
    const qHits = this.hpState === "high" ? 7 : 12;
    const canHyperbloom = this.teamMeta.hasReaction("hyperbloom");
    return {
      "shinobu-burst": {
        label: { zh: `Q×${qHits}`, en: `Q (×${qHits})` },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              {
                element: "Electro",
                ability: "burst",
                reaction: "none",
              },
              "hp"
            ),
            hits: qHits,
            offField: true,
          },
        ],
      },
      "shinobu-hyperbloom": {
        label: { zh: "E超绽放", en: "E Hyperbloom" },
        when: canHyperbloom,
        parts: [
          {
            formula: new TransformFormula(0, {
              element: "Electro",
              ability: "skill",
              reaction: "hyperbloom",
            }),
            offField: true,
          },
        ],
      },
      // C4: Thundergrass Mark — 9.7% Max HP as Electro DMG
      "shinobu-c4-thundergrass": {
        label: { zh: "雷草印", en: "Thundergrass Mark" },
        minC: 4,
        parts: [
          {
            formula: new DirectFormula(
              0.097,
              { element: "Electro", ability: "skill", reaction: "none" },
              "hp"
            ),
            offField: true,
          },
        ],
      },
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

  // Rotation: E (hold roll + kick) > Q > Daruma ~7 ticks (healer/swirl support)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "sayu-e-kick", count: 1 },
      { id: "sayu-q-initial", count: 1 },
      { id: "sayu-daruma", count: 7 },
    ];
  }

  protected readonly formulaMap = (() => {
    const anemoBurst = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "sayu-e-kick": {
        label: { zh: "E舞踢", en: "E Kick" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 4), {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "sayu-q-initial": {
        label: { zh: "Q初击", en: "Q Initial" },
        parts: [{ formula: new DirectFormula(this.param("Q", 1), anemoBurst) }],
      },
      "sayu-daruma": {
        label: { zh: "Q达摩", en: "Q Daruma" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 4), anemoBurst),
            offField: true,
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
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "thoma-burst-collapse", count: 15 }];
  }

  // Q Fiery Collapse: Q param2 ATK + 2.2% HP (P2)
  protected readonly formulaMap = {
    "thoma-burst-collapse": {
      label: { zh: "Q崩破", en: "Q Collapse" },
      parts: [
        {
          formula: new DirectFormula(
            this.param("Q", 2),
            { element: "Pyro", ability: "burst", reaction: "none" },
            "atk",
            { key: "hp", multiplier: 0.022 }
          ),
          offField: true,
        },
      ],
    },
  };
}

@RegisterCharacter("gorou")
class Gorou extends CharacterBase {
  private readonly geoCount = this.teamMeta.countByElement("Geo");

  readonly buffs = (() => {
    const buffs: StatBuff[] = [];
    // E/Q: flat DEF — E param2
    buffs.push(
      new StatBuff(cbs(this, "E", ["E", "Q"]), { receiver: "teamOnField" }, [
        { key: "def", value: this.param("E", 2) },
      ])
    );
    // E/Q: 3+ Geo → Geo DMG bonus (E param3)
    if (this.geoCount >= 3) {
      buffs.push(
        new StatBuff(cbs(this, "E", ["E", "Q"]), { receiver: "teamOnField" }, [
          { key: "geo%", value: this.param("E", 3) },
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
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "gorou-skill", count: 1 },
      { id: "gorou-burst", count: 1 },
    ];
  }

  protected readonly formulaMap = (() => {
    const qTag = {
      element: "Geo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
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
            formula: new DirectFormula(this.param("E", 1), {
              element: "Geo",
              ability: "skill",
              reaction: "none",
            }),
            bespokeBuff: new ScalingBuff(
              cbs(this, "P2", ["E"]),
              {
                receiver: "selfOnField" as const,
                filter: { abilities: ["skill" as const] },
              },
              [],
              "def",
              "baseDmg",
              1.56
            ),
          },
        ],
      },
      "gorou-burst": {
        label: { zh: "Q+结晶���塌", en: "Q + Crystal Collapse" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), qTag, "def"),
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
            formula: new DirectFormula(this.param("Q", 2), qTag, "def"),
            bespokeBuff: new ScalingBuff(
              cbs(this, "P2", ["Q"]),
              qBespokeTarget,
              [],
              "def",
              "baseDmg",
              0.156
            ),
            offField: true,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("kujou_sara")
class KujouSara extends CharacterBase {
  readonly buffs = [
    // E/Q: ATK bonus = E param2 of Sara's Base ATK to active character
    new ScalingBuff(
      cbs(this, "E", ["E", "Q"]),
      { receiver: "teamOnField" },
      [],
      "baseAtk",
      "atk",
      this.param("E", 2)
    ),
    // C6: Buffed characters gain +60% Electro CRIT DMG
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E", "Q"]),
            { receiver: "teamOnField", filter: { elements: ["Electro"] } },
            [{ key: "cd", value: 0.6 }]
          ),
        ]
      : []),
  ];

  // Rotation: E (ATK buff + damage) > Q > swap (Electro support, buff bot)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "sara-skill", count: 1 },
      { id: "sara-burst", count: 1 },
    ];
  }

  // E Ambush: E param1; Q Titanbreaker: Q param1 + Stormcluster Q param2 (C4: 6×)
  protected readonly formulaMap = (() => {
    const clusterCount = this.constellation >= 4 ? 6 : 4;
    return {
      "sara-skill": {
        label: { zh: "E伏伤害", en: "E Ambush" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "sara-burst": {
        label: {
          zh: `Q初始+雷砾×${clusterCount}`,
          en: `Q Initial + ${clusterCount}×Cluster`,
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
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
