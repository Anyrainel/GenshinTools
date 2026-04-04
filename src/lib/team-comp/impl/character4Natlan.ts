import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import {
  CharacterBase,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor, ElementalOrPhysical } from "../types";

// ═══════════════════════════════════════════════════════════════
// 4★ Natlan Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("ifa")
class Ifa extends CharacterBase {
  // P1 Rescue Essentials: ~80 team Nightsoul pts baseline.
  // C0: 80 pts → 80 Rescue Essentials (cap 150)
  // C2: 80 base + (80−60)×4 = 160 Rescue Essentials (cap 200)
  private readonly rescueEssentials = this.constellation >= 2 ? 160 : 80;

  readonly buffs = [
    // P1: Rescue Essentials — Swirl/EC reactionDmg% = pts × 1.5%
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "team", filter: { reactions: ["swirl", "electroCharged"] } },
      [{ key: "reactionDmg%", value: this.rescueEssentials * 0.015 }]
    ),
    // P1: Rescue Essentials — Lunar-Charged reactionDmg% = pts × 0.2%
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      [{ key: "reactionDmg%", value: this.rescueEssentials * 0.002 }]
    ),
    // P2: When nearby party members trigger Nightsoul Bursts, Ifa's EM +80
    new StatBuff(cbs(this, "P2", ["nightsoul-burst"]), { receiver: "self" }, [
      { key: "em", value: 80 },
    ]),
    // C4: After Q, self EM +100
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "self" }, [
            { key: "em", value: 100 },
          ]),
        ]
      : []),
  ];

  // Q Skill DMG: Lv10 915.3%, Lv13 (C5+) 1080.5%
  // Q Sedation Mark DMG: Lv10 196.1%, Lv13 (C5+) 231.5% per mark (up to 4)
  protected readonly formulaMap = (() => {
    // Sedation Marks: one per unique team element (Pyro/Hydro/Cryo/Electro)
    const markElements: ElementalOrPhysical[] = [];
    for (const [id, el] of Object.entries(this.teamMeta.elements)) {
      if (
        el != null &&
        id !== this.charId &&
        ["Pyro", "Hydro", "Cryo", "Electro"].includes(el) &&
        !markElements.includes(el)
      )
        markElements.push(el);
    }

    const markMult = this.param("Q", 2);
    const markParts = markElements.map((el) => ({
      formula: new DirectFormula(markMult, {
        element: el,
        ability: "burst" as const,
        reaction: "none" as const,
      }),
    }));

    return {
      "ifa-burst": {
        label: {
          zh: `Q伤害${markParts.length > 0 ? `+${markParts.length}镇静标记` : ""}`,
          en: `Q Burst${markParts.length > 0 ? ` + ${markParts.length} Sedation Mark${markParts.length > 1 ? "s" : ""}` : ""}`,
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
          },
          ...markParts,
        ],
      },
    };
  })();
}

const iansanOption = {
  label: { zh: "暗夜仙力", en: "Nightsoul Points" },
  choices: [
    {
      value: "high",
      label: {
        zh: "≥ 54 点（最高档：+27% 攻击）",
        en: "≥ 54 pts (max: +27% ATK)",
      },
    },
    {
      value: "low",
      label: { zh: "～27 点（+13.5% 攻击）", en: "~27 pts (+13.5% ATK)" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("iansan", iansanOption)
class Iansan extends CharacterBase {
  private readonly nightsoulLevel = resolveOption(iansanOption, this.option);

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: After Swift Stormflight hit, Iansan's ATK +20% (personal buff, works off-field)
      new StatBuff(cbs(this, "P1", ["E", "charge"]), { receiver: "self" }, [
        { key: "atk%", value: 0.2 },
      ]),
      // Q: Kinetic Energy Scale — high: 27% ATK, low (~27 pts): 13.5% ATK
      // Max ATK Bonus is always 690 (Lv10) / 810 (Lv13 C5+) regardless of mode
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "teamOnField" },
        [],
        "atk",
        "atk",
        this.nightsoulLevel === "high"
          ? this.param("Q", 2)
          : this.param("Q", 3) * 27,
        this.param("Q", 4)
      ),
    ];
    // C2: While off-field with Precise Movement, on-field character (not Iansan) ATK +30%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "otherOnField" }, [
          { key: "atk%", value: 0.3 },
        ])
      );
    }
    // C6: Extreme Force — on-field DMG +25%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "teamOnField" }, [
          { key: "dmg%", value: 0.25 },
        ])
      );
    }
    return buffs;
  })();

  // E: Lv10 515.5%, Lv13 (C3+) 608.6%
  // Q: Lv10 774.7%, Lv13 (C5+) 914.6%
  protected readonly formulaMap = (() => {
    return {
      "iansan-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "iansan-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      // Swift Stormflight: Nightsoul charged attack (A talent Lv10 166.4%)
      // E grants one free Swift Stormflight per cast
      "iansan-swift-stormflight": {
        label: { zh: "雷霆飞缒", en: "Swift Stormflight" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 5), {
              element: "Electro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E > N1(Swift Stormflight) > Q (ATK support, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "iansan-skill", count: 1 },
      { id: "iansan-burst", count: 1 },
      { id: "iansan-swift-stormflight", count: 1 },
    ];
  }
}

@RegisterCharacter("ororon")
class Ororon extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // C6: After Hypersense, on-field ATK +30% (3 stacks × 10%)
      ...(this.constellation >= 6
        ? [
            new StatBuff(cbs(this, "C6", ["E"]), { receiver: "teamOnField" }, [
              { key: "atk%", value: 0.3 },
            ]),
          ]
        : []),
    ];

    // C1: Nighttide enemies take 50% extra DMG from Hypersense — "伤害提升50%" → dmg%
    // Assumed active (peak model: E applied Nighttide before Hypersense triggers)
    // Hypersense triggers off-field, so receiver is "self" (not "selfOnField")
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "self", filter: { abilities: ["special"] } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    if (this.constellation >= 6) {
      // C6: Q triggers one Hypersense at "200% of original DMG" ("造成原本200%的伤害") → baseDmg% +1.0
      // Note: filter by ability "special" also affects ororon-hypersense display at C6 —
      // engine limitation: baseDmg% scopes by ability type, not by individual formula entry.
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["special"] } },
          [{ key: "baseDmg%", value: 1.0 }]
        )
      );
    }

    // C2: After using Q, Ororon gains Spiritual Supersense: +8% Electro DMG Bonus
    // + up to 32% more based on enemies hit (max 4 extra enemies → +32%)
    // Assume max enemies hit (4 extra) → total +40% Electro DMG Bonus
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "self" }, [
          { key: "electro%", value: 0.4 },
        ])
      );
    }

    return buffs;
  })();

  // E: Lv10 355.7%, Lv13 (C5+) 419.9%
  // Q: Lv10 313.9%, Lv13 (C3+) 370.6%
  // Q Soundwave: Lv10 59.8%, Lv13 (C3+) 70.5%
  protected readonly formulaMap = (() => {
    // P1 Hypersense: 160% ATK Electro, ability: "special" (no damage tag per KQM)
    // C1 +50% dmg% is handled via StatBuff above, not baked here
    const hypersenseBase = 1.6;

    return {
      "ororon-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "ororon-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          // C6: Q use triggers one Hypersense-equivalent hit (200% of Hypersense DMG)
          ...(this.constellation >= 6
            ? [
                {
                  formula: new DirectFormula(hypersenseBase, {
                    element: "Electro",
                    ability: "special",
                    reaction: "none",
                  }),
                },
              ]
            : []),
        ],
      },
      // Supersonic Oculus Soundwave: rotating continuous damage during 9s duration
      "ororon-soundwave": {
        label: { zh: "音波", en: "Soundwave" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      // P1 Hypersense: 160% ATK Electro DMG per trigger, once per 1.8s.
      // With 80 max Nightsoul points, up to 8 triggers (consuming 10 pts each).
      // C1 +50% dmg% buff is already implemented via StatBuff scoped to ability: "special".
      "ororon-hypersense": {
        label: { zh: "P1超感×8", en: "P1 Hypersense ×8" },
        parts: [
          {
            formula: new DirectFormula(hypersenseBase, {
              element: "Electro",
              ability: "special",
              reaction: "none",
            }),
            hits: 8,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E Q N2 > swap (sub-DPS, Hypersense ×8 baked in, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "ororon-skill", count: 1 },
      { id: "ororon-burst", count: 1 },
      { id: "ororon-soundwave", count: 6 },
      { id: "ororon-hypersense", count: 1 },
    ];
  }
}

@RegisterCharacter("kachina")
class Kachina extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: After nearby party members trigger a Nightsoul Burst, Kachina's Geo DMG +20%
      new StatBuff(cbs(this, "P1", ["nightsoul-burst"]), { receiver: "self" }, [
        { key: "geo%", value: 0.2 },
      ]),
      // P2: Turbo Twirly's DMG is increased by 20% of Kachina's DEF
      // "提升值相当于卡齐娜的防御力的20%" → ScalingBuff def→baseDmg 0.2
      // Applies to Turbo Twirly hits (skill DMG), works off-field → receiver "self"
      new ScalingBuff(
        cbs(this, "P2", ["A2"]),
        { receiver: "self", filter: { abilities: ["skill"] } },
        [],
        "def",
        "baseDmg",
        0.2
      ),
    ];
    // C4: In Q field, on-field DEF% +8/12/16/20% (by enemy count, assume 2 → 12%)
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "teamOnField" }, [
          { key: "def%", value: 0.12 },
        ])
      );
    }
    return buffs;
  })();

  // Turbo Twirly Independent: Lv10 114.8% DEF, Lv13 (C3+) 135.5% DEF
  // Q: Lv10 692.6% DEF, Lv13 (C5+) 817.7% DEF
  protected readonly formulaMap = (() => {
    return {
      "kachina-twirly": {
        label: { zh: "E伤害", en: "E Skill" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 2),
              {
                element: "Geo",
                ability: "skill",
                reaction: "none",
              },
              "def"
            ),
            offField: true,
          },
        ],
      },
      "kachina-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              {
                element: "Geo",
                ability: "burst",
                reaction: "none",
              },
              "def"
            ),
          },
        ],
      },
      // C6: When shield is replaced/destroyed, deal 200% DEF as AoE Geo DMG (once per 5s)
      // No ability classification in game text; use "special" to exclude from P2 skill buff
      "kachina-c6": {
        label: { zh: "护盾破碎", en: "Shield Shatter" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(
              2.0,
              {
                element: "Geo",
                ability: "special",
                reaction: "none",
              },
              "def"
            ),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E (Turbo Twirly independent ~6 hits over 12s) > Q (sub-DPS, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "kachina-twirly", count: 6 },
      { id: "kachina-burst", count: 1 },
    ];
  }
}
