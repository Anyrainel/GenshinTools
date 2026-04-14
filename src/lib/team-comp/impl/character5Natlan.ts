import { LUNAR_REACTIONS } from "../constants";
import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  DirectFormula,
  LunarFormula,
  TransformFormula,
} from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  type OptionDef,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor, ElementalOrPhysical, StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Natlan Characters
// ═══════════════════════════════════════════════════════════════

// Varesa rotation state machine (user-approved):
// E→逐击tap(=CA)→PA is always a bundled sequence. NS limit=40, E+20, PA+25.
// After first eaa: NS=45→cap 40→enters 炽热激情(FP). FP plunge consumes all NS.
//
// C0: eaa → EAAq repeat (1 normal + 1 FP cycle, sQ after FP plunge enters 极限驱动)
// C2: eaaq → EAAq repeat (C2: every PA→极限驱动, so sQ available after normal PA too)
// C6: EAAq ×4 repeat (C6: E restores NS to max→always FP, +30 energy on 极限驱动)
//
// P1 (虹色坠击): gained from E, consumed on plunge hit. Since E→CA→PA is bundled,
// every PA has P1 active. C0: +50% ATK non-FP / +180% ATK in FP. C1+: always +180%.
// C1 also grants 虹色坠击 from sQ itself → sQ gets P1 +180% at C1+.
//
// C4: Full Q from normal state → 精進勇猛 (+500% ATK on next plunge, cap 20000).
//     sQ from 极限驱动 → this Q +100% DMG. Both modeled via bespokeBuff.
//
// OptionMap: skip-q (default) vs full-q. Full Q is often skipped for DPS (long animation).

const varesaOption = {
  label: { zh: "使用Q开场", en: "Open with full Q" },
  choices: [
    {
      value: "skip-q",
      label: { zh: "不使用", en: "Skip" },
    },
    {
      value: "full-q",
      label: { zh: "使用Q", en: "Use Q" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("varesa", varesaOption)
class Varesa extends CharacterBase {
  private readonly useFullQ =
    resolveOption(varesaOption, this.option) === "full-q";

  readonly buffs = [
    // P1 is modeled per-formula via bespokeBuff (value differs by FP state and constellation)
    // P2: Nightsoul Burst → Varesa's ATK +35% (max 2 stacks = 70%)
    new StatBuff(cbs(this, "P2", ["Nightsoul Burst"]), { receiver: "self" }, [
      { key: "atk%", value: 0.7 },
    ]),
    // C6: Plunge and Burst → CR +10%, CD +100%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["Q", "plunge"]),
            {
              receiver: "selfOnField",
              filter: { abilities: ["plunge", "burst"] },
            },
            [
              { key: "cr", value: 0.1 },
              { key: "cd", value: 1.0 },
            ]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    const c = this.constellation;
    const electroSkill = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const electroCharge = {
      element: "Electro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const electroPlunge = {
      element: "Electro" as const,
      ability: "plunge" as const,
      reaction: "none" as const,
    };
    const electroBurst = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const plungeFilter = {
      receiver: "selfOnField" as const,
      filter: { abilities: ["plunge" as const] },
    };

    // P1 bespokeBuff helper: ATK → baseDmg on plunge
    const p1 = (value: number) =>
      new ScalingBuff(
        cbs(this, "P1", ["E"]),
        plungeFilter,
        [],
        "atk",
        "baseDmg",
        value
      );

    // P1 + C4 combined bespokeBuff: P1 scaling + C4 dmg% as static buff
    const p1WithC4 = (p1Value: number) =>
      new ScalingBuff(
        cbs(this, "P1/C4", ["E", "Q"]),
        plungeFilter,
        [{ key: "dmg%", value: 1.0 }],
        "atk",
        "baseDmg",
        p1Value
      );

    // C4 精進勇猛: +500% ATK baseDmg on first plunge after full Q (cap 20000)
    // Only active when full-q option is chosen (Q cast from normal state)
    const c4DR =
      c >= 4 && this.useFullQ
        ? new ScalingBuff(
            cbs(this, "C4", ["Q"]),
            plungeFilter,
            [],
            "atk",
            "baseDmg",
            5.0,
            20000
          )
        : undefined;

    return {
      // ── E ──
      "varesa-e": {
        label: { zh: "E", en: "E" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), electroSkill) },
        ],
      },
      "varesa-e-fp": {
        label: { zh: "E(激情)", en: "E (FP)" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), electroSkill) },
        ],
      },
      // ── CA (逐击 follow-up, triggered by tap after E) ──
      "varesa-ca": {
        label: { zh: "重击(逐击)", en: "CA (Follow-Up)" },
        parts: [
          { formula: new DirectFormula(this.param("A", 4), electroCharge) },
        ],
      },
      "varesa-ca-fp": {
        label: { zh: "重击(激情)", en: "CA (FP)" },
        parts: [
          { formula: new DirectFormula(this.param("A", 12), electroCharge) },
        ],
      },
      // ── Plunge ──
      // P1: +50% ATK at C0, +180% ATK at C1+ (user-approved)
      "varesa-pa": {
        label: { zh: "下落", en: "Plunge" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 8), electroPlunge),
            bespokeBuffs: [p1(c >= 1 ? 1.8 : 0.5)],
          },
        ],
      },
      // FP plunge always gets P1 +180%.
      "varesa-pa-fp": {
        label: { zh: "下落(激情)", en: "Plunge (FP)" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 16), electroPlunge),
            bespokeBuffs: [p1(1.8)],
          },
        ],
      },
      // C4+fullQ: first FP plunge also gets 精進勇猛 (+500% ATK baseDmg, cap 20000).
      // Split into separate formula so remaining pa-fp hits keep P1 without C4.
      ...(c4DR
        ? {
            "varesa-pa-fp-c4": {
              label: { zh: "下落(精進)", en: "Plunge (C4 DR)" },
              parts: [
                {
                  formula: new DirectFormula(
                    this.param("A", 16),
                    electroPlunge
                  ),
                  bespokeBuffs: [p1(1.8), c4DR!],
                },
              ],
            },
          }
        : {}),
      // ── Q (full burst) ──
      "varesa-q": {
        label: { zh: "Q飞踢", en: "Q Flying Kick" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), electroBurst) },
        ],
      },
      "varesa-q-fp": {
        label: { zh: "Q飞踢(激情)", en: "Q FP Kick" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), electroBurst),
            // C4: cast from FP/Apex Drive → +100% DMG
            ...(c >= 4
              ? {
                  bespokeBuffs: [
                    new StatBuff(
                      cbs(this, "C4", ["Q"]),
                      {
                        receiver: "selfOnField",
                        filter: { abilities: ["burst"] },
                      },
                      [{ key: "dmg%", value: 1.0 }]
                    ),
                  ],
                }
              : {}),
          },
        ],
      },
      // ── sQ (大火山崩落, 视为下落攻击伤害) ──
      "varesa-sq": {
        label: { zh: "大火山崩落", en: "Volcano Kablam" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 5), electroPlunge),
            // C1+: P1 applies to sQ (C1 grants 虹色坠击 from sQ itself)
            // C4+: sQ cast from 极限驱动 → +100% DMG
            // Combined via ScalingBuff staticBuffs when both active (user-approved)
            bespokeBuffs:
              c >= 4 && c >= 1
                ? [p1WithC4(1.8)]
                : c >= 4
                  ? [
                      new StatBuff(cbs(this, "C4", ["Q"]), plungeFilter, [
                        { key: "dmg%", value: 1.0 },
                      ]),
                    ]
                  : c >= 1
                    ? [p1(1.8)]
                    : undefined,
          },
        ],
      },
    };
  })();

  // Rotation varies by constellation (user-approved):
  // C0: eaa, EAAq — 1 normal cycle + 1 FP cycle + 1 sQ
  // C2: eaaq, EAAq — C2 every PA→极限驱動, sQ after each PA
  // C6: EAAq ×4 — always FP, sQ after every PA
  protected override get comboDescriptor(): ComboDescriptor {
    const c = this.constellation;
    const combo: ComboDescriptor = [];

    if (this.useFullQ) {
      // Full Q from normal state (C4: grants 精進勇猛 for first plunge)
      combo.push({ id: "varesa-q", count: 1 });
    }

    // 4 total E/CA/PA per rotation at all constellations (2 charges + cooldown).
    // Split between normal/FP varies; sQ count varies. (user-approved)
    // c4DR is truthy when C4+ and full-q option → 1 pa-fp hit becomes pa-fp-c4
    const hasC4DR = c >= 4 && this.useFullQ;

    if (c >= 6) {
      // C6: EAAq ×4 (always FP, E restores NS to max)
      combo.push(
        { id: "varesa-e-fp", count: 4 },
        { id: "varesa-ca-fp", count: 4 },
        { id: "varesa-pa-fp", count: hasC4DR ? 3 : 4 },
        ...(hasC4DR ? [{ id: "varesa-pa-fp-c4", count: 1 }] : []),
        { id: "varesa-sq", count: 4 }
      );
    } else if (c >= 2) {
      // C2: (eaaq + EAAq) ×2 — every PA→极限驱動, sQ after each
      combo.push(
        { id: "varesa-e", count: 2 },
        { id: "varesa-ca", count: 2 },
        { id: "varesa-pa", count: 2 },
        { id: "varesa-e-fp", count: 2 },
        { id: "varesa-ca-fp", count: 2 },
        { id: "varesa-pa-fp", count: hasC4DR ? 1 : 2 },
        ...(hasC4DR ? [{ id: "varesa-pa-fp-c4", count: 1 }] : []),
        { id: "varesa-sq", count: 4 }
      );
    } else {
      // C0-C1: (eaa + EAAq) ×2 — sQ only after FP plunge→极限驱動
      // C4 not possible here (c < 2 means c < 4)
      combo.push(
        { id: "varesa-e", count: 2 },
        { id: "varesa-ca", count: 2 },
        { id: "varesa-pa", count: 2 },
        { id: "varesa-e-fp", count: 2 },
        { id: "varesa-ca-fp", count: 2 },
        { id: "varesa-pa-fp", count: 2 },
        { id: "varesa-sq", count: 2 }
      );
    }

    return combo;
  }
}

const citlaliOption = {
  label: { zh: "星刃层数", en: "Stellar Blade Stacks" },
  choices: [
    {
      value: "19",
      label: { zh: "19层", en: "19 stacks" },
      when: (tm) => (tm.constellations.citlali ?? 0) >= 1,
    },
    {
      value: "16",
      label: { zh: "16层", en: "16 stacks" },
      when: (tm) => (tm.constellations.citlali ?? 0) >= 1,
    },
    {
      value: "13",
      label: { zh: "13层", en: "13 stacks" },
      when: (tm) => (tm.constellations.citlali ?? 0) >= 1,
    },
    {
      value: "10",
      label: { zh: "10层", en: "10 stacks" },
      when: (tm) => (tm.constellations.citlali ?? 0) >= 1,
    },
    {
      value: "0",
      label: { zh: "--", en: "--" },
      when: (tm) => (tm.constellations.citlali ?? 0) < 1,
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("citlali", citlaliOption)
class Citlali extends CharacterBase {
  private readonly c1Stacks = resolveOption(citlaliOption, this.option);

  // P1 requires Frozen or Melt — team needs Hydro or Pyro alongside Citlali's Cryo
  private readonly canTriggerP1 =
    this.teamMeta.hasReaction("frozen") || this.teamMeta.hasReaction("melt");

  readonly buffs = [
    // P1: After Frozen/Melt, enemies' Pyro/Hydro RES -20% (C2: -40%)
    ...(this.canTriggerP1
      ? [
          new StatBuff(
            cbs(this, "P1", ["E"]),
            { receiver: "team", filter: { elements: ["Pyro", "Hydro"] } },
            [
              {
                key: "resReduction%",
                value: this.constellation >= 2 ? 0.4 : 0.2,
              },
            ]
          ),
        ]
      : []),
    // P2: EM → baseDmg for Frostfall Storm (skill, 90% EM)
    // Itzpapa deals damage even when Citlali is off-field → receiver "self"
    new ScalingBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "em",
      "baseDmg",
      0.9
    ),
    // P2: EM → baseDmg for Q Ice Storm only (1200% EM)
    // Applied as bespokeBuff on Ice Storm part, not as a global burst buff,
    // because the Q Skull should NOT receive this bonus.
    // (see formulaMap "citlali-burst-total" Ice Storm part)
    // C1: Stellar Blade — on-field active character (not Citlali) gains +200% EM as baseDmg
    // 10 base stacks (+3 per Frozen/Melt every 8s). OptionMap: 10/13/16/19.
    ...(this.constellation >= 1
      ? [
          new ScalingBuff(
            {
              ...cbs(this, "C1", ["E"]),
              maxStacks: Number(this.c1Stacks),
            },
            {
              receiver: "otherOnField",
              filter: {
                abilities: ["normal", "charge", "plunge", "skill", "burst"],
              },
            },
            [],
            "em",
            "baseDmg",
            2.0
          ),
        ]
      : []),
    // C2: Self EM +125, team (shielded/followed) EM +250
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
            { key: "em", value: 125 },
          ]),
          // "其他角色的元素精通提升250" → other (no on-field restriction)
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "other" }, [
            { key: "em", value: 250 },
          ]),
        ]
      : []),
    // C6: 40 stacks → team Pyro/Hydro DMG +60%, self (Citlali) DMG +100%
    // "all nearby party members" Pyro/Hydro DMG → team
    ...(this.constellation >= 6
      ? [
          new StatBuff(cbs(this, "C6", ["E"]), { receiver: "team" }, [
            { key: "pyro%", value: 0.6 },
            { key: "hydro%", value: 0.6 },
          ]),
          // Citlali's own DMG boost applies off-field too (Itzpapa) → receiver "self"
          new StatBuff(cbs(this, "C6", ["E"]), { receiver: "self" }, [
            { key: "dmg%", value: 1.0 },
          ]),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // Frostfall Storm ticks (1/s): C0-C3 ~12s, C4-C5 ~16s (C4 skull
    // returns 16 Nightsoul pts every 8s), C6 20s (storm never stops)
    const eHits =
      this.constellation >= 6 ? 20 : this.constellation >= 4 ? 16 : 12;
    const skillTag = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const burstTag = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const c4Skulls = this.constellation >= 6 ? 3 : 2;
    return {
      "citlali-e-total": {
        label: {
          zh: `E+风暴×${eHits}`,
          en: `E + Storm ×${eHits}`,
        },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), skillTag) },
          {
            formula: new DirectFormula(this.param("E", 5), skillTag),
            hits: eHits,
            offField: true,
          },
          // C4: Obsidian Spiritvessel Skull (1800% EM, once per 8s)
          // "该伤害不被视为元素爆发伤害" — not burst DMG; use "special" to exclude from P2 skill buff
          ...(this.constellation >= 4
            ? [
                {
                  formula: new DirectFormula(
                    18.0,
                    { element: "Cryo", ability: "special", reaction: "none" },
                    "em"
                  ),
                  hits: c4Skulls,
                  offField: true,
                },
              ]
            : []),
        ],
      },
      "citlali-burst-total": {
        label: { zh: "Q+骷髅爆炸", en: "Q + Skull" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), burstTag),
            // P2: Ice Storm only — +1200% EM as baseDmg (Skull does NOT get this)
            bespokeBuffs: [
              new ScalingBuff(
                cbs(this, "P2", ["Q"]),
                { receiver: "self", filter: { abilities: ["burst"] } },
                [],
                "em",
                "baseDmg",
                12.0
              ),
            ],
          },
          {
            formula: new DirectFormula(this.param("Q", 2), burstTag),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E Q > swap (off-field support, E total bakes in all hits, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "citlali-e-total", count: 1 },
      { id: "citlali-burst-total", count: 1 },
    ];
  }
}

@RegisterCharacter("mavuika")
class Mavuika extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: After nearby party member triggers Nightsoul Burst, Mavuika's ATK +30%
      new StatBuff(cbs(this, "P1", ["Nightsoul Burst"]), { receiver: "self" }, [
        { key: "atk%", value: 0.3 },
      ]),
      // P2 "Kiongozi": After Q, on-field DMG +0.2% per Spirit (max 200 = 40%)
      // Assume full 200 Spirit → 40%. C4 adds +10% and removes decay.
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "teamOnField" }, [
        {
          key: "dmg%",
          value: this.constellation >= 4 ? 0.5 : 0.4,
        },
      ]),
      // Q: FS bonus to Sunfell/Normal/Charged are merged into formulaMap
      // multipliers (not ScalingBuff) so they use final ATK, not preStats ATK.
    ];

    // C1: Mavuika's ATK +40% after gaining Fighting Spirit
    if (this.constellation >= 1) {
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["fighting-spirit"]),
          { receiver: "self" },
          [{ key: "atk%", value: 0.4 }]
        )
      );
    }

    // C2: Base ATK +200 (both forms)
    // Ring form: nearby enemy DEF -20% (enemy debuff → team receiver)
    // Flamestrider form: N1/CA/Sunfell DMG += 60%/90%/120% ATK as baseDmg
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
          { key: "baseAtk", value: 200 },
        ])
      );
      // C2 Ring form: nearby enemy DEF -20% (Ring form only).
      // C6 adds Scorching Ring DEF -20% (Flamestrider form only).
      // At C6, both forms have 20% shred — model as team-wide.
      // Below C6, only Ring form applies: use selfOffField + other to exclude
      // Mavuika's own on-field Flamestrider damage from the shred.
      if (this.constellation >= 6) {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
            { key: "defReduction%", value: 0.2 },
          ])
        );
      } else {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "selfOffField" }, [
            { key: "defReduction%", value: 0.2 },
          ])
        );
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "other" }, [
            { key: "defReduction%", value: 0.2 },
          ])
        );
      }
      // C2 FS bonus to Normal/Charged/Sunfell merged into formulaMap multipliers
      // (same reason as FS bonus above — must use final ATK, not preStats ATK)
    }

    // C6 Scorching Ring DEF -20% is merged into C2 block above (team-wide at C6)

    return buffs;
  })();

  // Q Sunfell Slice: Lv10 800.6%, Lv13 (C3+) 945.2%
  // FS and C2 ATK bonuses are merged into formula multipliers so they scale
  // with final ATK (postStats) rather than preStats ATK.
  protected readonly formulaMap = (() => {
    // FS bonus per ability: 200 × param × ATK (merged into talent multiplier)
    const fsBurst = 200 * this.param("Q", 3);
    const fsNormal = 200 * this.param("Q", 4);
    const fsCharge = 200 * this.param("Q", 5);
    // C2: additional ATK% bonus for Flamestrider attacks
    const c2Burst = this.constellation >= 2 ? 1.2 : 0;
    const c2Normal = this.constellation >= 2 ? 0.6 : 0;
    const c2Charge = this.constellation >= 2 ? 0.9 : 0;

    // CA: Cyclic (Lv10 195.5%, Lv13 236.9%) + Final (Lv10 272%, Lv13 329.6%)
    const caCyclicMult = this.param("E", 10) + fsCharge + c2Charge;
    const sprintMult = this.param("E", 9);

    return {
      "mavuika-sunfell": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1) + fsBurst + c2Burst, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "mavuika-combo": {
        label: { zh: "Q后 AZS", en: "Post-Q N1+CA+Sprint" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 4) + fsNormal + c2Normal,
              {
                element: "Pyro",
                ability: "normal",
                reaction: "none",
              }
            ),
          },
          {
            formula: new DirectFormula(caCyclicMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(sprintMult, {
              element: "Pyro",
              ability: "sprint",
              reaction: "none",
            }),
          },
        ],
      },
      "mavuika-szszzp": {
        label: { zh: "Q后 SZSZZP", en: "Post-Q SCSCC2" },
        parts: [
          {
            formula: new DirectFormula(sprintMult, {
              element: "Pyro",
              ability: "sprint",
              reaction: "none",
            }),
            hits: 2,
          },
          {
            formula: new DirectFormula(caCyclicMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
            hits: 3,
          },
          {
            formula: new DirectFormula(
              this.param("E", 11) + fsCharge + c2Charge,
              {
                element: "Pyro",
                ability: "charge",
                reaction: "none",
              }
            ),
          },
        ],
      },
      // Flamestrider N1-N5 full chain (E params 4-8)
      "mavuika-fs-normal": {
        label: { zh: "驰轮车N1-N5", en: "Flamestrider N1-N5" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 4) + fsNormal + c2Normal,
              { element: "Pyro", ability: "normal", reaction: "none" }
            ),
          },
          {
            formula: new DirectFormula(
              this.param("E", 5) + fsNormal + c2Normal,
              { element: "Pyro", ability: "normal", reaction: "none" }
            ),
          },
          {
            formula: new DirectFormula(
              this.param("E", 6) + fsNormal + c2Normal,
              { element: "Pyro", ability: "normal", reaction: "none" }
            ),
          },
          {
            formula: new DirectFormula(
              this.param("E", 7) + fsNormal + c2Normal,
              { element: "Pyro", ability: "normal", reaction: "none" }
            ),
          },
          {
            formula: new DirectFormula(
              this.param("E", 8) + fsNormal + c2Normal,
              { element: "Pyro", ability: "normal", reaction: "none" }
            ),
          },
        ],
      },
      // E initial Skill DMG (param1): one-time Pyro hit on E cast
      "mavuika-e-cast": {
        label: { zh: "E释放", en: "E Cast" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      // E Ring of Searing Radiance (Tap form): off-field periodic Pyro DMG at 2s intervals
      "mavuika-ring": {
        label: { zh: "E焚曜之环", en: "E Ring" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      // E Flamestrider Plunge DMG (param12): plunge during Flamestrider mode
      "mavuika-fs-plunge": {
        label: { zh: "驰轮车下落", en: "Flamestrider Plunge" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 12), {
              element: "Pyro",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      // C6: Ring hit → Flamestrider crash (200% ATK Pyro DMG per Ring attack, off-field)
      "mavuika-c6-crash": {
        label: { zh: "C6环撞击", en: "C6 Ring Crash" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(2.0, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      // C6: Scorching Ring deals 500% ATK as Pyro DMG every 3s (Flamestrider mode)
      "mavuika-c6-ring": {
        label: { zh: "焚曜之环·灼象", en: "Scorching Ring" },
        minC: 6,
        parts: [
          {
            formula: new DirectFormula(5.0, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: Q (Sunfell) > SCSCC2 combo in 7s Crucible window (Melt carry, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "mavuika-sunfell", count: 1 },
      { id: "mavuika-szszzp", count: 1 },
    ];
  }
}

@RegisterCharacter("chasca")
class Chasca extends CharacterBase {
  // Collect unique eligible element types in team (Pyro/Hydro/Cryo/Electro)
  private readonly eligibleElements = (() => {
    const eligible = new Set<string>();
    for (const [id, el] of Object.entries(this.teamMeta.elements)) {
      if (
        el != null &&
        id !== this.charId &&
        ["Pyro", "Hydro", "Cryo", "Electro"].includes(el)
      )
        eligible.add(el);
    }
    return [...eligible].slice(0, 3);
  })();
  private readonly eligibleTypes = this.eligibleElements.length;
  // P1 stacks: C2 adds +1 stack on swap-in, capped at 3
  private readonly p1Stacks = Math.min(
    this.eligibleTypes + (this.constellation >= 2 ? 1 : 0),
    3
  );
  readonly buffs = [
    // P1: Per eligible element type (+ C2 bonus), Shining Shell DMG bonus (non-linear)
    // 1 stack → +15%, 2 → +35%, 3 → +65%
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: [0, 0.15, 0.35, 0.65][this.p1Stacks] }]
    ),
    // C6: After Spiritbinding Conversion, Shining Shell CD +120%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", ["E"]),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [{ key: "cd", value: 1.2 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    const shellMult = this.param("E", 3);
    const shiningMult = this.param("E", 4);
    const shiningCount =
      this.eligibleTypes === 0
        ? 0
        : this.eligibleTypes + (this.constellation >= 1 ? 2 : 1);
    const normalCount = 6 - shiningCount;
    // Q Radiant Soulseeker Shell: Lv10 372.2%, Lv13 (C5+) 439.4%
    const qMult = this.param("Q", 3);
    // Q Soulseeker Shell: Lv10 186.1%, Lv13 (C5+) 219.7%
    const qNormMult = this.param("Q", 2);
    const qRadiantCount = this.eligibleTypes === 0 ? 0 : this.eligibleTypes * 2;
    const qNormalCount = 6 - qRadiantCount;

    const anemoChargeTag = {
      element: "Anemo" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const anemoBurstTag = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    // Helper: build a charge/burst tag for a specific element
    const chargeTagFor = (el: string) => ({
      element: el as ElementalOrPhysical,
      ability: "charge" as const,
      reaction: "none" as const,
    });
    const burstTagFor = (el: string) => ({
      element: el as ElementalOrPhysical,
      ability: "burst" as const,
      reaction: "none" as const,
    });

    // Distribute converted shells evenly across all eligible elements.
    // This prevents any single elemental DMG goblet from gaining an advantage.
    const elems = this.eligibleElements;
    const nElems = elems.length;

    // E: distribute shiningCount shells across eligible elements
    const shiningParts: { formula: DirectFormula }[] = [];
    if (nElems > 0) {
      const perElem = Math.floor(shiningCount / nElems);
      let remainder = shiningCount % nElems;
      for (const el of elems) {
        const count = perElem + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        for (let i = 0; i < count; i++) {
          shiningParts.push({
            formula: new DirectFormula(shiningMult, chargeTagFor(el)),
          });
        }
      }
    }

    // Q: distribute qRadiantCount shells across eligible elements
    const radiantParts: { formula: DirectFormula }[] = [];
    if (nElems > 0) {
      const perElem = Math.floor(qRadiantCount / nElems);
      let remainder = qRadiantCount % nElems;
      for (const el of elems) {
        const count = perElem + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        for (let i = 0; i < count; i++) {
          radiantParts.push({
            formula: new DirectFormula(qMult, burstTagFor(el)),
          });
        }
      }
    }

    // C2/C4 AoE procs: also spread across eligible elements (one per element)
    const c2Parts: { formula: DirectFormula }[] =
      this.constellation >= 2
        ? elems.map((el) => ({
            formula: new DirectFormula(4.0 / nElems, chargeTagFor(el)),
          }))
        : [];
    const c4Parts: { formula: DirectFormula }[] =
      this.constellation >= 4
        ? elems.map((el) => ({
            formula: new DirectFormula(4.0 / nElems, chargeTagFor(el)),
          }))
        : [];

    return {
      // E Resonance DMG (param1): one-time Anemo Skill hit on E cast
      "chasca-e-resonance": {
        label: { zh: "E共鸣", en: "E Resonance" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "chasca-shining-volley": {
        label: {
          zh: "E一轮6枚",
          en: "E 6-Shell Volley",
        },
        parts: [
          // Unconverted shells: Anemo
          ...Array(normalCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(shellMult, anemoChargeTag),
            })),
          // Shining (converted) shells: spread across eligible elements
          ...shiningParts,
          // C2: Shining Shell hit → 400% ATK AoE, spread across elements
          ...c2Parts,
        ],
      },
      "chasca-p2-burning": {
        label: { zh: "P2流焰追影弹", en: "P2 Burning Shadowhunt" },
        parts: [
          {
            formula: new DirectFormula(
              nElems > 0 ? shiningMult * 1.5 : shellMult * 1.5,
              nElems > 0 ? chargeTagFor(elems[0]) : anemoChargeTag
            ),
            offField: true,
          },
        ],
      },
      "chasca-burst": {
        label: {
          zh: "Q+6弹",
          en: "Q + 6 Shells",
        },
        parts: [
          // Galesplitting initial hit: always Anemo
          { formula: new DirectFormula(this.param("Q", 1), anemoBurstTag) },
          // Unconverted Soulseeker Shells: Anemo
          ...Array(qNormalCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(qNormMult, anemoBurstTag),
            })),
          // Radiant (converted) Soulseeker Shells: spread across eligible elements
          ...radiantParts,
          // C4: Radiant Shell hit → 400% ATK AoE, spread across elements
          ...c4Parts,
        ],
      },
    };
  })();

  // Rotation: E 4[C] (Q) + P2 proc (on-field carry, Q every ~2 rotations, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "chasca-shining-volley", count: 4 },
      { id: "chasca-p2-burning", count: 1 },
      { id: "chasca-burst", count: 1 },
    ];
  }
}

@RegisterCharacter("xilonen")
class Xilonen extends CharacterBase {
  // Count distinct Pyro/Hydro/Cryo/Electro elements among teammates.
  // Each qualifying element type converts one Geo Source Sample; same-element types do not stack.
  private readonly convertedSamples = (() => {
    const converted = new Set<string>();
    for (const el of Object.values(this.teamMeta.elements)) {
      if (el != null && ["Pyro", "Hydro", "Cryo", "Electro"].includes(el))
        converted.add(el);
    }
    return converted.size;
  })();

  // Which PHEC elements are present in the team
  private readonly teamPHEC = (() => {
    const present = new Set<string>();
    for (const el of Object.values(this.teamMeta.elements)) {
      if (el != null && ["Pyro", "Hydro", "Cryo", "Electro"].includes(el))
        present.add(el);
    }
    return present;
  })();

  readonly buffs = (() => {
    const resValue = this.param("E", 2);
    const buffs: StatBuff[] = [];

    // P2: Nightsoul Burst → Xilonen's DEF +20% (personal buff, works off-field)
    buffs.push(
      new StatBuff(cbs(this, "P2", ["Nightsoul Burst"]), { receiver: "self" }, [
        { key: "def%", value: 0.2 },
      ])
    );

    if (this.convertedSamples >= 2) {
      // ≥2 PHEC elements: RES shred for each PHEC element present in the team
      for (const el of this.teamPHEC) {
        buffs.push(
          new StatBuff(
            cbs(this, "E", ["E"]),
            {
              receiver: "team",
              filter: {
                elements: [el as "Pyro" | "Hydro" | "Cryo" | "Electro"],
              },
            },
            [{ key: "resReduction%", value: resValue }]
          )
        );
      }
      // Geo RES shred: depends on converted count and constellation
      if (this.convertedSamples === 2) {
        // Exactly 2 PHEC: 1 sample remains Geo → Geo RES shred is team-wide
        buffs.push(
          new StatBuff(
            cbs(this, "E", ["E"]),
            { receiver: "team", filter: { elements: ["Geo"] } },
            [{ key: "resReduction%", value: resValue }]
          )
        );
      } else if (this.constellation >= 2) {
        // 3 PHEC + C2: Geo RES becomes team-wide
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "team", filter: { elements: ["Geo"] } },
            [{ key: "resReduction%", value: resValue }]
          )
        );
      }
      // 3 PHEC + below C2: all 3 Source Samples are converted, no Geo sample remains.
      // Geo RES shred is NOT active.
    } else {
      // 0-1 PHEC: Geo Source Sample is always active in Nightsoul's Blessing
      // U6: resReduction% must use receiver "team"
      if (this.constellation >= 2) {
        buffs.push(
          new StatBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "team", filter: { elements: ["Geo"] } },
            [{ key: "resReduction%", value: resValue }]
          )
        );
      } else {
        buffs.push(
          new StatBuff(
            cbs(this, "E", ["E"]),
            { receiver: "team", filter: { elements: ["Geo"] } },
            [{ key: "resReduction%", value: resValue }]
          )
        );
      }
    }

    // P1: Fewer than 2 converted samples → Normal/Plunge DMG +30%
    if (this.convertedSamples < 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["A1"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "plunge"] },
          },
          [{ key: "dmg%", value: 0.3 }]
        )
      );
    }

    // C2: Each active Source Sample grants a buff to teammates matching that element.
    // Use charId to target each teammate individually based on their element.
    if (this.constellation >= 2) {
      const elementBuffMap: Record<string, { key: StatKey; value: number }> = {
        Geo: { key: "dmg%", value: 0.5 },
        Pyro: { key: "atk%", value: 0.45 },
        Hydro: { key: "hp%", value: 0.45 },
        Cryo: { key: "cd", value: 0.6 },
        // Electro: energy restore + CD reduction only, not modeled
      };
      for (const [charId, el] of Object.entries(this.teamMeta.elements)) {
        if (!el) continue;
        const buff = elementBuffMap[el];
        if (buff) {
          buffs.push(
            new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team", charId }, [
              { key: buff.key, value: buff.value },
            ])
          );
        }
      }
    }

    // C4: Blooming Blessing — all party members gain +65% Xilonen DEF as Base DMG
    // for Normal/Charged/Plunging Attacks. "该效果将在生效6次...时解除" → maxStacks: 6
    // "队伍中具有「荣花之赐」的角色，其生效次数单独计算" → per-character independent stacks.
    // Emit one ScalingBuff per teammate with charId so each gets its own stack pool.
    if (this.constellation >= 4) {
      for (const charId of Object.keys(this.teamMeta.elements)) {
        buffs.push(
          new ScalingBuff(
            { ...cbs(this, "C4", ["E"]), maxStacks: 6 },
            {
              receiver: "teamOnField",
              charId,
              filter: { abilities: ["normal", "charge", "plunge"] },
            },
            [],
            "def",
            "baseDmg",
            0.65
          )
        );
      }
    }

    // C6: Imperishable Night's Blessing — Normal/Plunge DMG +300% DEF
    if (this.constellation >= 6) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "plunge"] },
          },
          [],
          "def",
          "baseDmg",
          3.0
        )
      );
    }

    return buffs;
  })();

  // E Blade Roller N4 (Lv10): 110.7% + 108.8% + 130.1% + 170.1% DEF (4 separate parts)
  // Must be 4 parts (not 1 summed part) so that C4 baseDmg ScalingBuff applies once per hit.
  // N4 multipliers don't scale with constellations up to C6.
  // C6 unlocks on-field DPS rotation; formula is only shown at C6+
  // E Blade Roller N4: 110.7% + 108.8% + 130.1% + 170.1% DEF
  // Q Ardent Rhythm extra beats: Lv10 506.3% DEF ×2, Lv13 (C5+) 597.7% DEF ×2
  // Q extra beats only fire when ≤1 converted sample (mono-Geo / no-PHEC teams)
  protected readonly formulaMap = (() => {
    const nTag = {
      element: "Geo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    return {
      // E Rush DMG (param1): one-time Geo Skill hit on E cast, DEF-scaled
      "xilonen-e-rush": {
        label: { zh: "E突进", en: "E Rush" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 1),
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
          },
        ],
      },
      "xilonen-normal-2": {
        label: {
          zh: "E普攻2段",
          en: "E-NA2 (Blade Roller)",
        },
        minC: 0,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 10), nTag, "def"),
          },
          {
            formula: new DirectFormula(this.param("A", 11), nTag, "def"),
          },
        ],
      },
      "xilonen-normal": {
        label: {
          zh: "E普攻4段",
          en: "E-NA4 (Blade Roller)",
        },
        minC: 0,
        parts: [
          {
            formula: new DirectFormula(this.param("A", 10), nTag, "def"),
          },
          {
            formula: new DirectFormula(this.param("A", 11), nTag, "def"),
          },
          {
            formula: new DirectFormula(this.param("A", 12), nTag, "def"),
          },
          {
            formula: new DirectFormula(this.param("A", 13), nTag, "def"),
          },
        ],
      },
      // Q initial Skill DMG (param1): one-time Geo Burst hit, DEF-scaled
      "xilonen-q-initial": {
        label: { zh: "Q初始", en: "Q Initial" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Geo", ability: "burst", reaction: "none" },
              "def"
            ),
          },
        ],
      },
      // Q extra beats: only when ≤1 converted sample
      "xilonen-burst-beats": {
        label: { zh: "Q额外节拍(×2)", en: "Q Extra Beats (×2)" },
        when: this.convertedSamples <= 1,
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 5),
              { element: "Geo", ability: "burst", reaction: "none" },
              "def"
            ),
            hits: 2,
          },
        ],
      },
    };
  })();

  // Rotation: C6 on-field DPS 3×N4; mono-Geo Q extra beats once (KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "xilonen-normal-2", count: 1 },
      { id: "xilonen-e-rush", count: 1 },
    ];
  }
}

@RegisterCharacter("mualani")
class Mualani extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: Wavechaser's Exploits — up to 3 stacks before Q, each +15% Max HP
      // Assume max 3 stacks (easy to maintain with a Natlan team triggering Nightsoul Burst)
      // → +45% Max HP added to Q base damage as a ScalingBuff
      new ScalingBuff(
        cbs(this, "P2", ["Nightsoul Burst"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "hp",
        "baseDmg",
        0.45
      ),
      // C4: Q DMG +75%
      ...(this.constellation >= 4
        ? [
            new StatBuff(
              cbs(this, "C4", ["Q"]),
              { receiver: "selfOnField", filter: { abilities: ["burst"] } },
              [{ key: "dmg%", value: 0.75 }]
            ),
          ]
        : []),
    ];

    return buffs;
  })();

  // Surging Bite: base 15.62% + 3×7.81% + surging 39.06% = 78.11% HP (Lv10)
  // Lv13 (C3+): 18.45% + 3×9.22% + 46.11% = 92.22% HP
  // Q: 105.2%/124.2% HP (Lv10/Lv13 C5+)
  protected readonly formulaMap = (() => {
    const biteMult =
      this.param("E", 1) + 3 * this.param("E", 2) + this.param("E", 3);
    const biteTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    return {
      "mualani-bite": {
        label: { zh: "E撕咬（3层）", en: "E Bite(3 stacks)" },
        parts: [
          {
            formula: new DirectFormula(biteMult, biteTag, "hp"),
            ...(this.constellation >= 1
              ? {
                  bespokeBuffs: [
                    new ScalingBuff(
                      {
                        ...cbs(this, "C1", ["E"]),
                        // C1-C5: 1 heavy out of 3 bites. C6: all bites heavy (no stack limit).
                        maxStacks: this.constellation >= 6 ? undefined : 1,
                      },
                      {
                        receiver: "selfOnField",
                        filter: { abilities: ["normal"] },
                      },
                      [],
                      "hp",
                      "baseDmg",
                      0.66
                    ),
                  ],
                }
              : {}),
          },
        ],
      },
      "mualani-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              {
                element: "Hydro",
                ability: "burst",
                reaction: "none",
              },
              "hp"
            ),
          },
        ],
      },
    };
  })();

  // Rotation: E combo (3 Surging Bites) > Q (~16s rotation, vape carry, KQM)
  // C0: 3 normal bites. C1-C5: 1 heavy + 2 normal. C6: 3 heavy.
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "mualani-bite", count: 3 },
      { id: "mualani-burst", count: 1 },
    ];
  }
}

@RegisterCharacter("kinich")
class Kinich extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2: After Nightsoul Burst, Hunter's Experience ×2 → +640% ATK as baseDmg to Scalespiker
      // We model the ATK scaling as a ScalingBuff applied to self Skill
      new ScalingBuff(
        cbs(this, "P2", ["Nightsoul Burst"]),
        { receiver: "selfOnField", filter: { abilities: ["skill"] } },
        [],
        "atk",
        "baseDmg",
        6.4 // 320% × 2 stacks = 640% of ATK
      ),
      // C1: Scalespiker Cannon CD +100%
      ...(this.constellation >= 1
        ? [
            new StatBuff(
              cbs(this, "C1", ["E"]),
              { receiver: "selfOnField", filter: { abilities: ["skill"] } },
              [{ key: "cd", value: 1.0 }]
            ),
          ]
        : []),
      // C2: Dendro RES -30% on E hit
      ...(this.constellation >= 2
        ? [
            new StatBuff(
              cbs(this, "C2", ["E"]),
              { receiver: "team", filter: { elements: ["Dendro"] } },
              [{ key: "resReduction%", value: 0.3 }]
            ),
          ]
        : []),
    ];

    // C2: First Scalespiker Cannon after entering Nightsoul's Blessing +100% DMG
    // Modeled via bespokeBuff with maxStacks: 1 on kinich-cannon (see formulaMap).

    // C4: Hail to the Almighty Dragonlord Q DMG +70%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.7 }]
        )
      );
    }

    return buffs;
  })();

  // Scalespiker Cannon: Lv10 1237.4%, Lv13 (C3+) 1460.8%
  // Q initial: Lv10 241.2%, Lv13 (C5+) 284.8% + Dragon Breath 217.3%/256.6% ×5
  // C6: bounce fires once per Scalespiker Cannon hit (not per active-character attack cadence);
  //     700% ATK Dendro Skill DMG — inherits P2 baseDmg and C2 dmg% buffs automatically
  //     because those buffs are scoped to ability:"skill" which the bounce also uses.
  protected readonly formulaMap = (() => {
    return {
      // Loop Shot: 2 hits per loop (param1 ×2), Dendro Skill DMG
      "kinich-loop": {
        label: { zh: "E环绕射击", en: "E Loop Shot" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 2,
          },
        ],
      },
      "kinich-cannon": {
        label: { zh: "E炮击", en: "E Cannon" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
            ...(this.constellation >= 2
              ? {
                  bespokeBuffs: [
                    new StatBuff(
                      { ...cbs(this, "C2", ["E"]), maxStacks: 1 },
                      {
                        receiver: "selfOnField",
                        filter: { abilities: ["skill"] },
                      },
                      [{ key: "dmg%", value: 1.0 }]
                    ),
                  ],
                }
              : {}),
          },
          // C6 bounce: 700% ATK, Dendro Skill DMG — fires once per cannon shot
          ...(this.constellation >= 6
            ? [
                {
                  formula: new DirectFormula(7.0, {
                    element: "Dendro",
                    ability: "skill",
                    reaction: "none",
                  }),
                  ...(this.constellation >= 2
                    ? {
                        bespokeBuffs: [
                          new StatBuff(
                            { ...cbs(this, "C2", ["E"]), maxStacks: 1 },
                            {
                              receiver: "selfOnField",
                              filter: { abilities: ["skill"] },
                            },
                            [{ key: "dmg%", value: 1.0 }]
                          ),
                        ],
                      }
                    : {}),
                },
              ]
            : []),
        ],
      },
      "kinich-burst": {
        label: { zh: "Q+5龙息", en: "Q + 5 Breaths" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 5,
            // Ajaw CAN fire off-field, but Kinich stays on-field after Q in practice.
            // Do NOT add offField here — intentional on-field modeling.
          },
        ],
      },
    };
  })();

  // Rotation: shE Q 5[N2 shE] — ~4 Scalespiker Cannons + Q (Burning carry, KQM)
  // C2: first cannon gets +100% DMG via bespokeBuff with maxStacks: 1
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "kinich-cannon", count: 4 },
      { id: "kinich-burst", count: 1 },
    ];
  }
}
