import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import { CharacterBase, RegisterCharacter } from "../damageModels";
import { cbs } from "../helpers";
import type { AbilityType, ComboDescriptor } from "../types";

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
      // "队伍中附近的其他角色" → other (excludes Illuga himself, no on-field restriction)
      new StatBuff(
        cbs(this, isC6 ? "P1/C6" : "P1", ["E", "Q"]),
        { receiver: "other", filter: { elements: ["Geo"] } },
        [
          { key: "cr", value: isC6 ? 0.1 : 0.05 },
          { key: "cd", value: isC6 ? 0.3 : 0.1 },
        ]
      ),
      // P1 EM only active at Moonsign Ascendant Gleam (≥2 Nod-Krai)
      new StatBuff(
        cbs(this, isC6 ? "P1/C6" : "P1", ["E", "Q"]),
        { receiver: "other" },
        this.teamMeta.countByFaction("Moonsign") >= 2
          ? [{ key: "em", value: isC6 ? 80 : 50 }]
          : []
      ),
      // Q: Nightingale's Song — EM → Geo baseDmg (pure Geo only, LC gets higher tier below)
      // Despite game text "进一步提升", testing confirms only the higher tier applies — not both.
      // Lv10: 60.5% EM, Lv13 (C3+): 71.4% EM
      // 21 base stacks + up to 15 from Geo Constructs (3×5) = 36 max
      new ScalingBuff(
        { ...cbs(this, "Q", ["Q"]), maxStacks: 36 },
        {
          receiver: "teamOnField",
          filter: {
            elements: ["Geo"],
            reactions: ["none"],
            abilities: COMBAT_ABILITIES,
          },
        },
        [],
        "em",
        "baseDmg",
        this.param("Q", 3)
      ),
      // Q: Nightingale's Song — LunarCrystallize tier EM → baseDmg (replaces Geo tier above)
      // Lv10: 406.7% EM, Lv13 (C3+): 480.1% EM
      // Shares Nightingale's Song stack pool (36 max)
      new ScalingBuff(
        { ...cbs(this, "Q", ["Q"]), maxStacks: 36 },
        {
          receiver: "teamOnField",
          filter: {
            reactions: ["lunarCrystallize"],
            abilities: COMBAT_ABILITIES,
          },
        },
        [],
        "em",
        "baseDmg",
        this.param("Q", 4)
      ),
    ];
    // P2: Hydro/Geo count enhances Nightingale's Song (pure Geo only, LC gets higher tier below)
    // 1/2/3 → +7%/14%/24% EM as additional Geo baseDmg
    const p2Tiers = [0, 0.07, 0.14, 0.24] as const;
    const p2Scale = p2Tiers[Math.min(this.hydroGeo, 3)];
    if (p2Scale > 0) {
      buffs.push(
        new ScalingBuff(
          { ...cbs(this, "P2", ["Q"]), maxStacks: 36 },
          {
            receiver: "teamOnField",
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
          { ...cbs(this, "P2", ["Q"]), maxStacks: 36 },
          {
            receiver: "teamOnField",
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
        new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "teamOnField" }, [
          { key: "def", value: 200 },
        ])
      );
    }
    return buffs;
  })();

  // Rotation: E > Q > swap (support buffer, C2 Aedon fires per 7 stacks; 21 base stacks ≈ 3 triggers)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "illuga-skill-press", count: 1 },
      { id: "illuga-burst", count: 1 },
      { id: "illuga-c2-aedon", count: 3 },
    ];
  }

  // E press: Lv10 869% EM + 434% DEF, Lv13 (C5+) 1025% EM + 513% DEF
  // E hold: Lv10 1086% EM + 543% DEF, Lv13 (C5+) 1282% EM + 641% DEF
  // Q burst: Lv10 1489% EM + 744% DEF, Lv13 (C3+) 1758% EM + 879% DEF
  // C2: Aedon summon per 7 Nightingale's Song stacks consumed
  // 400% EM + 200% DEF, Geo Burst DMG
  protected readonly formulaMap = (() => {
    const ePressEmMult = this.param("E", 1);
    const ePressDefMult = this.param("E", 2);
    const eHoldEmMult = this.param("E", 3);
    const eHoldDefMult = this.param("E", 4);
    const qEmMult = this.param("Q", 1);
    const qDefMult = this.param("Q", 2);
    return {
      "illuga-skill-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          {
            formula: new DirectFormula(
              ePressEmMult,
              { element: "Geo", ability: "skill", reaction: "none" },
              "em",
              { key: "def", multiplier: ePressDefMult }
            ),
          },
        ],
      },
      "illuga-skill-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          {
            formula: new DirectFormula(
              eHoldEmMult,
              { element: "Geo", ability: "skill", reaction: "none" },
              "em",
              { key: "def", multiplier: eHoldDefMult }
            ),
          },
        ],
      },
      "illuga-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              qEmMult,
              { element: "Geo", ability: "burst", reaction: "none" },
              "em",
              { key: "def", multiplier: qDefMult }
            ),
          },
        ],
      },
      "illuga-c2-aedon": {
        label: { zh: "阿咚", en: "Aedon" },
        minC: 2,
        parts: [
          {
            formula: new DirectFormula(
              4.0,
              { element: "Geo", ability: "burst", reaction: "none" },
              "em",
              { key: "def", multiplier: 2.0 }
            ),
            offField: true,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("jahoda")
class Jahoda extends CharacterBase {
  readonly buffs = [
    // P2: After Q heals at >70% HP, on-field EM +100
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "teamOnField" }, [
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
          { receiver: "teamOnField", filter: { reactions } },
          [{ key: "reactionDmg%", value: bonus }]
        ),
      ];
    })(),
  ];

  // Rotation: E > Q > swap (off-field sub-DPS, Q 14 hits baked in)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "aino-skill", count: 1 },
      { id: "aino-burst-total", count: 1 },
      { id: "aino-c2-ball", count: 1 },
    ];
  }

  // E: Musecatcher — Stage 1 + Stage 2 (separate hits, different multipliers)
  // Stage 1: Lv10 118.1%, Lv13 (C5+) 139.4%
  // Stage 2: Lv10 339.8%, Lv13 (C5+) 401.2%
  // Q: Water Ball DMG Lv10: 36.2%, Lv13 (C3+): 42.7%
  // ~14 hits over 14s duration
  protected readonly formulaMap = (() => {
    const eStage1 = this.param("E", 1);
    const eStage2 = this.param("E", 2);
    const qMult = this.param("Q", 1);
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
            offField: true,
          },
        ],
      },
      "aino-c2-ball": {
        label: { zh: "水弹×3", en: "Ball ×3" },
        minC: 2,
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
            offField: true,
          },
        ],
      },
    };
  })();
}
