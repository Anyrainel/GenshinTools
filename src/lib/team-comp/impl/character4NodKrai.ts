import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";
import type { AbilityType } from "../types";

/** NA/CA/PA/E/Q — excludes "special" and "sprint" */
const COMBAT_ABILITIES: AbilityType[] = [
  "normal",
  "charge",
  "plunge",
  "skill",
  "burst",
];

// ═══════════════════════════════════════════════════════════════
// 4★ Nod-Krai Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("illuga")
class Illuga extends CharacterBase {
  private readonly hydroGeo =
    this.teamMeta.countByElement("Hydro") + this.teamMeta.countByElement("Geo");

  readonly buffs = (() => {
    const isC6 = this.constellation >= 6;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1 (C6 enhanced): After E/Q, other party members Geo CR/CD + EM
      // "队伍中附近的其他角色" → otherOnField (excludes Illuga himself)
      new StatBuff(
        cbs(this, isC6 ? "P1/C6" : "P1", ["E", "Q"]),
        { receiver: "otherOnField", filter: { elements: ["Geo"] } },
        [
          { key: "cr", value: isC6 ? 0.1 : 0.05 },
          { key: "cd", value: isC6 ? 0.3 : 0.1 },
        ]
      ),
      // P1 EM only active at Moonsign Ascendant Gleam (≥2 Nod-Krai)
      new StatBuff(
        cbs(this, isC6 ? "P1/C6" : "P1", ["E", "Q"]),
        { receiver: "otherOnField" },
        this.teamMeta.countByFaction("Moonsign") >= 2
          ? [{ key: "em", value: isC6 ? 80 : 50 }]
          : []
      ),
      // Q: Nightingale's Song — EM → Geo baseDmg (either/or with LC tier below)
      // Buffs NA/CA/PA/E/Q only (excludes special)
      // Lv10: 60.5% EM, Lv13 (C3+): 71.4% EM
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        {
          receiver: "onField",
          filter: {
            elements: ["Geo"],
            reactions: ["none"],
            abilities: COMBAT_ABILITIES,
          },
        },
        [],
        "em",
        "baseDmg",
        this.constellation >= 3 ? 0.714 : 0.605
      ),
      // Q: Nightingale's Song — LunarCrystallize tier EM → baseDmg (replaces Geo tier above)
      // Lv10: 406.7% EM, Lv13 (C3+): 480.1% EM
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        {
          receiver: "onField",
          filter: {
            reactions: ["lunarCrystallize"],
            abilities: COMBAT_ABILITIES,
          },
        },
        [],
        "em",
        "baseDmg",
        this.constellation >= 3 ? 4.801 : 4.067
      ),
    ];
    // P2: Hydro/Geo count enhances Nightingale's Song (either/or with LC tier below)
    // 1/2/3 → +7%/14%/24% EM as additional Geo baseDmg
    const p2Tiers = [0, 0.07, 0.14, 0.24] as const;
    const p2Scale = p2Tiers[Math.min(this.hydroGeo, 3)];
    if (p2Scale > 0) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "P2", ["Q"]),
          {
            receiver: "onField",
            filter: {
              elements: ["Geo"],
              reactions: ["none"],
              abilities: COMBAT_ABILITIES,
            },
          },
          [],
          "em",
          "baseDmg",
          p2Scale
        )
      );
    }
    // P2: LunarCrystallize tier — 48%/96%/160% EM (replaces Geo tier above, not additive)
    const p2LunarTiers = [0, 0.48, 0.96, 1.6] as const;
    const p2LunarScale = p2LunarTiers[Math.min(this.hydroGeo, 3)];
    if (p2LunarScale > 0) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "P2", ["Q"]),
          {
            receiver: "onField",
            filter: {
              reactions: ["lunarCrystallize"],
              abilities: COMBAT_ABILITIES,
            },
          },
          [],
          "em",
          "baseDmg",
          p2LunarScale
        )
      );
    }
    // C4: During Q, on-field DEF +200
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "onField" }, [
          { key: "def", value: 200 },
        ])
      );
    }
    return buffs;
  })();

  // Rotation: E > Q > swap (support buffer, C2 Aedon fires per 7 stacks; 21 base stacks ≈ 3 triggers)
  protected override get defaultRotation() {
    return { "illuga-c2-aedon": 3 };
  }

  // C2: Aedon summon per 7 Nightingale's Song stacks consumed
  // 400% EM + 200% DEF, Geo Burst DMG
  protected readonly formulaMap = {
    ...(this.constellation >= 2
      ? {
          "illuga-c2-aedon": {
            label: { zh: "C2阿咚", en: "C2 Aedon" },
            parts: [
              {
                formula: new DirectFormula(
                  4.0,
                  { element: "Geo", ability: "burst", reaction: "none" },
                  "em",
                  { key: "def", multiplier: 2.0 }
                ),
              },
            ],
          },
        }
      : {}),
  };
}

@RegisterCharacter("jahoda")
class Jahoda extends CharacterBase {
  readonly buffs = [
    // P2: After Q heals at >70% HP, on-field EM +100
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "onField" }, [
      { key: "em", value: 100 },
    ]),
    // C6 (Moonsign Ascendant Gleam): After E flask full, Moonsign characters CR +5%, CD +40%
    // "月兆·满辉：...月兆角色的暴击率提升5%，暴击伤害提升40%" — requires ≥2 Moonsign
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "team", factions: ["Moonsign"] },
      this.constellation >= 6 && this.teamMeta.countByFaction("Moonsign") >= 2
        ? [
            { key: "cr", value: 0.05 },
            { key: "cd", value: 0.4 },
          ]
        : []
    ),
  ];

  // Healer/support — no damage formulas modeled
  protected readonly formulaMap = {};
}

@RegisterCharacter("aino")
class Aino extends CharacterBase {
  readonly buffs = [
    // P2: Burst DMG increased by 50% of EM → flat baseDmg on burst
    new ScalingBuff(
      cbs(this, "P2", []),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [],
      "em",
      "baseDmg",
      0.5
    ),
    // C1: After E/Q, self EM +80, other active party members EM +80 (non-stacking)
    ...(() => {
      if (this.constellation < 1) return [];
      return [
        new StatBuff(cbs(this, "C1", ["E", "Q"]), { receiver: "self" }, [
          { key: "em", value: 80 },
        ]),
        new StatBuff(
          cbs(this, "C1", ["E", "Q"]),
          { receiver: "otherOnField" },
          [{ key: "em", value: 80 }]
        ),
      ];
    })(),
    // C6: After Q, electroCharged/bloom/lunarCharged/lunarBloom/lunarCrystallize DMG +15%
    // Ascendant Gleam (≥2 Nod-Krai): +20% more (total 35%)
    ...(() => {
      if (this.constellation < 6) return [];
      const moonsign = this.teamMeta.countByFaction("Moonsign");
      const bonus = moonsign >= 2 ? 0.35 : 0.15;
      const reactions = [
        "electroCharged" as const,
        "bloom" as const,
        "lunarCharged" as const,
        "lunarBloom" as const,
        "lunarCrystallize" as const,
      ];
      return [
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "onField", filter: { reactions } },
          [{ key: "reactionDmg%", value: bonus }]
        ),
      ];
    })(),
  ];

  // Rotation: E > Q > swap (off-field sub-DPS, Q 14 hits baked in)
  protected override get defaultRotation() {
    return { "aino-skill": 1, "aino-burst-total": 1, "aino-c2-ball": 1 };
  }

  // E: Musecatcher — Stage 1 + Stage 2 (separate hits, different multipliers)
  // Stage 1: Lv10 118.1%, Lv13 (C5+) 139.4%
  // Stage 2: Lv10 339.8%, Lv13 (C5+) 401.2%
  // Q: Water Ball DMG Lv10: 36.2%, Lv13 (C3+): 42.7%
  // ~14 hits over 14s duration
  protected readonly formulaMap = (() => {
    const eStage1 = this.constellation >= 5 ? 1.394 : 1.181;
    const eStage2 = this.constellation >= 5 ? 4.012 : 3.398;
    const qMult = this.constellation >= 3 ? 0.427 : 0.362;
    return {
      "aino-skill": {
        label: { zh: "E伤害", en: "E DMG" },
        parts: [
          {
            formula: new DirectFormula(eStage1, {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(eStage2, {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "aino-burst-total": {
        label: { zh: "Q×14", en: "Q ×14" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 14,
          },
        ],
      },
      ...(this.constellation >= 2
        ? {
            "aino-c2-ball": {
              label: { zh: "C2水弹×3", en: "C2 Ball ×3" },
              parts: [
                {
                  formula: new DirectFormula(
                    0.25,
                    {
                      element: "Hydro",
                      ability: "burst",
                      reaction: "none",
                    },
                    "atk",
                    { key: "em", multiplier: 1.0 }
                  ),
                  hits: 3,
                },
              ],
            },
          }
        : {}),
    };
  })();
}
