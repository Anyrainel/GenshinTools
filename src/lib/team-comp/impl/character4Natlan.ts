import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import {
  CharacterBase,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { OptionDef } from "../types";

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

  // Pure healer/support — no damage formulas modeled
  protected readonly formulaMap = {};
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
  default: "high",
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
      // Q: Kinetic Energy Scale — 0.5% ATK per Nightsoul pt (max 27% at 54 pts)
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "onField" },
        [],
        "atk",
        "atk",
        this.nightsoulLevel === "high" ? 0.27 : 0.135,
        this.nightsoulLevel === "high"
          ? this.constellation >= 5
            ? 810
            : 690
          : this.constellation >= 5
            ? 405
            : 345
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
        new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "onField" }, [
          { key: "dmg%", value: 0.25 },
        ])
      );
    }
    return buffs;
  })();

  // E: Lv10 515.5%, Lv13 (C3+) 608.6%
  // Q: Lv10 774.7%, Lv13 (C5+) 914.6%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 6.086 : 5.155;
    const qMult = this.constellation >= 5 ? 9.146 : 7.747;
    return {
      "iansan-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "iansan-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
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

@RegisterCharacter("ororon")
class Ororon extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // C6: After Hypersense, on-field ATK +30% (3 stacks × 10%)
      ...(this.constellation >= 6
        ? [
            new StatBuff(cbs(this, "C6", ["E"]), { receiver: "onField" }, [
              { key: "atk%", value: 0.3 },
            ]),
          ]
        : []),
    ];

    // C1: Nighttide enemies take 50% extra DMG from Hypersense — "伤害提升50%" → dmg%
    // Assumed active (peak model: E applied Nighttide before Hypersense triggers)
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["special"] } },
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
    const eMult = this.constellation >= 5 ? 4.199 : 3.557;
    const qMult = this.constellation >= 3 ? 3.706 : 3.139;
    const soundwaveMult = this.constellation >= 3 ? 0.705 : 0.598;

    // P1 Hypersense: 160% ATK Electro, ability: "special" (no damage tag per KQM)
    // C1 +50% dmg% is handled via StatBuff above, not baked here
    const hypersenseBase = 1.6;

    // C6: Q-triggered Hypersense — baseDmg%+1.0 applied via StatBuff above
    const c6QHypersense = hypersenseBase;

    return {
      "ororon-skill": {
        label: { zh: "E伤害", en: "E Skill" },
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
      "ororon-burst": {
        label: {
          zh: `Q+音波${this.constellation >= 6 ? "+6命超感" : ""}`,
          en: `Q + Soundwave${this.constellation >= 6 ? " + C6 Hypersense" : ""}`,
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          // Supersonic Oculus Soundwave: 1 rotation during 9s duration
          {
            formula: new DirectFormula(soundwaveMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          // C6: Q use triggers one Hypersense-equivalent hit (200% of Hypersense DMG)
          ...(this.constellation >= 6
            ? [
                {
                  formula: new DirectFormula(c6QHypersense, {
                    element: "Electro",
                    ability: "special",
                    reaction: "none",
                  }),
                },
              ]
            : []),
        ],
      },
      // P1 Hypersense: 160% ATK Electro DMG per trigger (≤ once per 1.8s)
      // Per-hit damage is fixed. Ignored due to insignificance.
    };
  })();
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
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "onField" }, [
          { key: "def%", value: 0.12 },
        ])
      );
    }
    return buffs;
  })();

  // Turbo Twirly Mounted: Lv10 158.0% DEF, Lv13 (C3+) 186.5% DEF
  // Q: Lv10 692.6% DEF, Lv13 (C5+) 817.7% DEF
  protected readonly formulaMap = (() => {
    const mountMult = this.constellation >= 3 ? 1.865 : 1.58;
    const qMult = this.constellation >= 5 ? 8.177 : 6.926;
    return {
      "kachina-twirly": {
        label: { zh: "E伤害", en: "E Skill" },
        parts: [
          {
            formula: new DirectFormula(
              mountMult,
              {
                element: "Geo",
                ability: "skill",
                reaction: "none",
              },
              "def"
            ),
          },
        ],
      },
      "kachina-burst": {
        label: { zh: "Q伤害", en: "Q Burst" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
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
    };
  })();
}
