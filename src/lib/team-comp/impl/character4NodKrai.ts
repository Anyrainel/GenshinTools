import type { Element } from "@/data/types";
import { DirectFormula } from "../calc/damageFormula";
import { CharacterBase } from "../calc/implModel";
import { RegisterCharacter } from "../calc/registry";
import { ScalingBuff, StatBuff } from "../calc/statBuff";
import type { FormulaEntry } from "../types";
import type { AbilityType, ComboTemplate } from "../types";
import { cbs } from "./helpers";

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
  protected override get comboDescriptor(): ComboTemplate {
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
    return {
      "illuga-skill-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 1),
              { element: "Geo", ability: "skill", reaction: "none" },
              "em",
              { key: "def", multiplier: this.param("E", 2) }
            ),
          },
        ],
      },
      "illuga-skill-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 3),
              { element: "Geo", ability: "skill", reaction: "none" },
              "em",
              { key: "def", multiplier: this.param("E", 4) }
            ),
          },
        ],
      },
      "illuga-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Geo", ability: "burst", reaction: "none" },
              "em",
              { key: "def", multiplier: this.param("Q", 2) }
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
  protected override get comboDescriptor(): ComboTemplate {
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
  // ~14 hits over 14s duration; P1 Ascendant Gleam fires more frequently → ~20 hits
  private readonly isAscendantGleam =
    this.teamMeta.countByFaction("Moonsign") >= 2;
  protected readonly formulaMap = (() => {
    const qHits = this.isAscendantGleam ? 20 : 14;
    return {
      "aino-skill": {
        label: { zh: "E伤害", en: "E DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "aino-burst-total": {
        label: {
          zh: `Q×${qHits}`,
          en: `Q ×${qHits}`,
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            hits: qHits,
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

// ═══════════════════════════════════════════════════════════════
// Prune — 4★ Anemo Catalyst (Hexerei)
// ═══════════════════════════════════════════════════════════════
// Modeling assumptions:
// - Swirl triggers: E hitting a PHEC aura (Pyro/Hydro/Cryo/Electro) converts
//   Banehunter Oathhammer to that element. We generate one converted-hammer
//   formula per PHEC element present in the team; if none exist, the special E
//   stays unavailable (the formula is gated by `when`).
// - P1: during Q Hunter-Seeker, bell swirl summons a 150% ATK converted hammer.
//   Modeled as a single coord hit per burst cycle per present PHEC element.
// - P2 Tolling Rally: teammate DMG +0.01% per Prune ATK over 1000, cap 35%.
//   Approximated as an always-on ScalingBuff once Prune is the sustained trigger.
// - P4 Hexerei: Prune +45% ATK after any teammate reaction under Tolling Rally.
//   Always-on under Hexerei active + any reaction available.
// - C2: ramping ATK from 10% → 40% during Hunter-Seeker mode. Assumed capped.
// - C4: ricochet adds a second converted-hammer hit at 80% ATK.
// - C6: team +350 ATK after teammate reaction (always-on under sustain).
@RegisterCharacter("prune")
class Prune extends CharacterBase {
  private readonly isHexereiActive =
    this.teamMeta.countByFaction("Hexerei") >= 2;

  // PHEC elements present in the team — each produces a converted-hammer variant.
  private readonly phecPresent: Element[] = (() => {
    const teamEls = new Set(
      Object.values(this.teamMeta.elements).filter(
        (e): e is Element => e !== undefined
      )
    );
    const order: Element[] = ["Pyro", "Hydro", "Cryo", "Electro"];
    return order.filter((el) => teamEls.has(el));
  })();

  private readonly canSwirl = this.teamMeta.hasReaction("swirl");

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // P2 Tolling Rally: 0.01% DMG per Prune ATK above 1000, max 35%.
    // Applies to NA/CA/plunge/E/Q of other teammates while under Tolling Rally.
    // Capped by threshold + scale + cap parameters of ScalingBuff.
    buffs.push(
      new ScalingBuff(
        cbs(this, "P2", ["E"]),
        {
          receiver: "other",
          filter: {
            abilities: ["normal", "charge", "plunge", "skill", "burst"],
          },
        },
        [],
        "atk",
        "dmg%",
        0.0001,
        0.35,
        1000
      )
    );

    // C2: Hunt the Witch — Prune +10% ATK base + +5% per hit, cap 40%.
    // Assume sustained max (40%) during Q Hunter-Seeker mode.
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["Q"]), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.4 },
        ])
      );
    }

    // Hexerei P4: after a Hexerei teammate under Tolling Rally triggers a
    // reaction, Prune gains +45% ATK; if the reaction is a Swirl, that
    // triggering Hexerei teammate also gains +20% ATK. Per U1 both bonuses
    // must be scoped to factions:["Hexerei"] — non-Hexerei teammates cannot
    // trigger the effect. Tolling Rally (P2) applies to all other party
    // members under peak assumptions, so membership is implied once another
    // Hexerei teammate exists.
    if (this.isHexereiActive) {
      const anyReaction =
        this.teamMeta.hasReaction("swirl") ||
        this.teamMeta.hasReaction("melt") ||
        this.teamMeta.hasReaction("vaporize") ||
        this.teamMeta.hasReaction("frozen") ||
        this.teamMeta.hasReaction("superconduct") ||
        this.teamMeta.hasReaction("electroCharged") ||
        this.teamMeta.hasReaction("overloaded") ||
        this.teamMeta.hasReaction("bloom") ||
        this.teamMeta.hasReaction("hyperbloom") ||
        this.teamMeta.hasReaction("burgeon") ||
        this.teamMeta.hasReaction("aggravate") ||
        this.teamMeta.hasReaction("spread") ||
        this.teamMeta.hasReaction("burning");
      if (anyReaction) {
        buffs.push(
          new StatBuff(cbs(this, "P4", ["E"]), { receiver: "self" }, [
            { key: "atk%", value: 0.45 },
          ])
        );
        // Swirl: the triggering Hexerei teammate also gains +20% ATK.
        if (this.canSwirl) {
          buffs.push(
            new StatBuff(
              cbs(this, "P4", ["swirl"]),
              { receiver: "other", factions: ["Hexerei"] },
              [{ key: "atk%", value: 0.2 }]
            )
          );
        }
      }
    }

    // C6: after a Tolling Rally teammate triggers a reaction, Prune + the
    // currently active nearby Tolling-Rally teammate gain +350 flat ATK.
    // Per U1, split self and otherOnField so off-field teammates without the
    // Tolling Rally trigger context don't receive the buff. Tolling Rally
    // (from P2) is applied to all non-Prune party members under peak
    // assumptions, so no extra filter is needed on the otherOnField buff.
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["E"]), { receiver: "self" }, [
          { key: "atk", value: 350 },
        ]),
        new StatBuff(cbs(this, "C6", ["E"]), { receiver: "otherOnField" }, [
          { key: "atk", value: 350 },
        ])
      );
    }

    return buffs;
  })();

  // E param1: bell hit (301% Lv10). E param2: converted hammer (368%).
  // Q param1: initial bell (174%). Q param2: Hunter-Seeker bell tick (126%).
  // ~12s burst window, 4-hit approximation on the bell tick.
  protected readonly formulaMap = (() => {
    const anemoSkill = {
      element: "Anemo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const anemoBurst = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const formulas: Record<string, FormulaEntry> = {
      "prune-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), anemoSkill) }],
      },
      "prune-burst-initial": {
        label: { zh: "Q生成", en: "Q Initial" },
        parts: [{ formula: new DirectFormula(this.param("Q", 1), anemoBurst) }],
      },
      "prune-burst-bell": {
        label: { zh: "Q诱巫饵铃", en: "Q Witchlure Bell Tick" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), anemoBurst),
            offField: true,
          },
        ],
      },
    };

    // Converted-hammer element: the actual absorbed element depends on in-game
    // aura priority (Pyro > Hydro > Electro > Cryo) and enemy state at swirl
    // time and cannot be determined from team composition alone. Per S10, we
    // follow the Traveler Anemo Q pattern: emit one variant per PHEC element
    // present in the team so the UI's formula selector lets the user compare
    // which absorption is active. Keep rotation shape — only one swirl-
    // converted hammer lands at a time.
    for (const convertedEl of this.phecPresent) {
      const suffix = convertedEl.toLowerCase();
      // Special E — converted hammer at 368% (E param2) in this element.
      formulas[`prune-special-e-${suffix}`] = {
        label: {
          zh: `特殊E(${convertedEl}转化)`,
          en: `Special E (${convertedEl} converted)`,
        },
        when: this.canSwirl,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: convertedEl,
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      };
      // C4 ricochet: 80% ATK in same converted element.
      formulas[`prune-c4-ricochet-${suffix}`] = {
        label: {
          zh: `C4回弹(${convertedEl})`,
          en: `C4 Ricochet (${convertedEl})`,
        },
        minC: 4,
        when: this.canSwirl,
        parts: [
          {
            formula: new DirectFormula(0.8, {
              element: convertedEl,
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      };
      // P1: Bell swirl summons 150% ATK converted hammer (Q-tagged).
      formulas[`prune-p1-hammer-${suffix}`] = {
        label: {
          zh: `P1寻猎锤(${convertedEl})`,
          en: `P1 Seeker Hammer (${convertedEl})`,
        },
        when: this.canSwirl,
        parts: [
          {
            formula: new DirectFormula(1.5, {
              element: convertedEl,
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      };
    }

    return formulas;
  })();

  // Rotation: E (trigger Swirl) → special E (converted hammer) → Q (off-field
  // Hunter-Seeker bell) → periodic P1 hammer triggers on Swirl. Only one
  // swirl-converted hammer lands per rotation, so the combo references the
  // first PHEC element's variant (aura-priority order). The other per-element
  // variants exist in formulaMap so the UI can compare absorption choices.
  protected override get comboDescriptor(): ComboTemplate {
    const base: ComboTemplate = [
      { id: "prune-skill", count: 1 },
      { id: "prune-burst-initial", count: 1 },
      { id: "prune-burst-bell", count: 4 },
    ];
    const primary = this.phecPresent[0];
    if (primary !== undefined) {
      const suffix = primary.toLowerCase();
      base.push({ id: `prune-special-e-${suffix}`, count: 1 });
      base.push({ id: `prune-c4-ricochet-${suffix}`, count: 1 });
      base.push({ id: `prune-p1-hammer-${suffix}`, count: 1 });
    }
    return base;
  }
}
