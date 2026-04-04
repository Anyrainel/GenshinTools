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

@RegisterCharacter("varesa")
class Varesa extends CharacterBase {
  readonly buffs = [
    // P1: Fiery Passion Tag-Team Triple Jump → Plunge ground impact +180% ATK
    // Consumed after 1 plunge hit per E, but rotation is E→plunge so every plunge has P1.
    // Modeled as always-active self buff (no maxStacks on self buffs).
    new ScalingBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
      [],
      "atk",
      "baseDmg",
      1.8
    ),
    // P2: Nightsoul Burst → Varesa's ATK +35% (max 2 stacks = 70%)
    new StatBuff(cbs(this, "P2", ["nightsoul-burst"]), { receiver: "self" }, [
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

  // Flying Kick (Lv10): 621.2%  |  (Lv13 C3+): 733.4%
  // Fiery Passion High Plunge (Lv10): 552.0%
  // Fiery Passion High Plunge (Lv13 C5+): 669.0%
  // Volcano Kablam (Lv10): 724.8%
  // Volcano Kablam (Lv13 C3+): 855.6%
  protected readonly formulaMap = (() => {
    const naMult = this.param("A", 16);
    const electroSkill = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "varesa-e": {
        label: { zh: "E初始", en: "E Initial" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), electroSkill) },
        ],
      },
      "varesa-e-fp": {
        label: { zh: "E后续", en: "E Following" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), electroSkill) },
        ],
      },
      "varesa-kick": {
        label: { zh: "Q飞踢", en: "Q Flying Kick" },
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
      // Q Fiery Passion Flying Kick (param2): enhanced Q kick, rarely used since Apex Drive
      "varesa-fp-kick": {
        label: { zh: "Q飞踢(激情)", en: "Q FP Flying Kick" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "varesa-plunge": {
        label: { zh: "下落(高空)", en: "Plunge (High)" },
        parts: [
          {
            formula: new DirectFormula(naMult, {
              element: "Electro",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      // C4: Diligent Refinement — first plunge after Q gets +500% ATK as baseDmg (cap 20000)
      // Separated from varesa-plunge because the buff is consumed after one ground impact hit.
      ...(this.constellation >= 4
        ? {
            "varesa-plunge-c4": {
              label: { zh: "C4下落(高空)", en: "C4 Plunge (High)" },
              minC: 4 as const,
              parts: [
                {
                  formula: new DirectFormula(naMult, {
                    element: "Electro",
                    ability: "plunge",
                    reaction: "none",
                  }),
                  bespokeBuff: new ScalingBuff(
                    cbs(this, "C4", ["Q"]),
                    {
                      receiver: "selfOnField",
                      filter: { abilities: ["plunge"] },
                    },
                    [],
                    "atk",
                    "baseDmg",
                    5.0,
                    20000
                  ),
                },
              ],
            } satisfies FormulaEntry,
          }
        : {}),
      "varesa-kablam": {
        label: {
          zh: "Q下落",
          en: "Q Volcano Kablam",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 5), {
              element: "Electro",
              // Note: Considered Plunge DMG in-game, so use ability: "plunge"
              ability: "plunge",
              reaction: "none",
            }),
            // C4: Fiery Passion/Apex Drive active → this Q instance +100% DMG
            ...(this.constellation >= 4
              ? {
                  bespokeBuff: new StatBuff(
                    cbs(this, "C4", ["Q"]),
                    {
                      receiver: "selfOnField",
                      filter: { abilities: ["plunge"] },
                    },
                    [{ key: "dmg%", value: 1.0 }]
                  ),
                }
              : {}),
          },
        ],
      },
    };
  })();

  // Rotation: Q > ECP ×4 + sQ ×2 (~20s, plunge carry, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "varesa-kick", count: 1 },
      ...(this.constellation >= 4
        ? [
            { id: "varesa-plunge-c4", count: 1 },
            { id: "varesa-plunge", count: 3 },
          ]
        : [{ id: "varesa-plunge", count: 4 }]),
      { id: "varesa-kablam", count: 2 },
    ];
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
            bespokeBuff: new ScalingBuff(
              cbs(this, "P2", ["Q"]),
              { receiver: "self", filter: { abilities: ["burst"] } },
              [],
              "em",
              "baseDmg",
              12.0
            ),
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
      new StatBuff(cbs(this, "P1", ["nightsoul-burst"]), { receiver: "self" }, [
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
      // Q: FS bonus to Sunfell Slice (200 × param3 ATK, scales with Q talent)
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "atk",
        "baseDmg",
        200 * this.param("Q", 3)
      ),
      // Q: FS bonus to Flamestrider Normal Attacks (200 × param4 ATK)
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["normal"] } },
        [],
        "atk",
        "baseDmg",
        200 * this.param("Q", 4)
      ),
      // Q: FS bonus to Flamestrider Charged Attacks (200 × param5 ATK)
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [],
        "atk",
        "baseDmg",
        200 * this.param("Q", 5)
      ),
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
      // C2 Ring form: nearby enemy DEF -20% — approximation: always active
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
          { key: "defReduction%", value: 0.2 },
        ])
      );
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [],
          "atk",
          "baseDmg",
          0.6
        )
      );
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [],
          "atk",
          "baseDmg",
          0.9
        )
      );
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "atk",
          "baseDmg",
          1.2
        )
      );
    }

    // C6: Flamestrider summons Scorching Ring → nearby enemy DEF -20%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(cbs(this, "C6", ["E"]), { receiver: "team" }, [
          { key: "defReduction%", value: 0.2 },
        ])
      );
    }

    return buffs;
  })();

  // Q Sunfell Slice: Lv10 800.6%, Lv13 (C3+) 945.2%
  // FS and C2 ATK bonuses are applied as baseDmg ScalingBuffs (see buffs above)
  protected readonly formulaMap = (() => {
    // CA: Cyclic (Lv10 195.5%, Lv13 236.9%) + Final (Lv10 272%, Lv13 329.6%)
    const caCyclicMult = this.param("E", 10);
    const sprintMult = this.param("E", 9);

    return {
      "mavuika-sunfell": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
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
            formula: new DirectFormula(this.param("E", 4), {
              element: "Pyro",
              ability: "normal",
              reaction: "none",
            }),
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
            formula: new DirectFormula(this.param("E", 11), {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
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
  readonly buffs = [
    // P1: Per eligible element type, Shining Shell DMG bonus (non-linear)
    // 1 type → +15%, 2 → +35%, 3 → +65%
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "dmg%", value: [0, 0.15, 0.35, 0.65][this.eligibleTypes] }]
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
      new StatBuff(cbs(this, "P2", ["nightsoul-burst"]), { receiver: "self" }, [
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
      "xilonen-normal": {
        label: {
          zh: "E普攻4段",
          en: "N4 (Blade Roller)",
        },
        minC: 6,
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
        label: { zh: "Q伤害", en: "Q Initial" },
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
      { id: "xilonen-normal", count: 3 },
      { id: "xilonen-burst-beats", count: 1 },
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
        cbs(this, "P2", ["nightsoul-burst"]),
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
      // C1+: Heavy bite with +66% HP baseDmg (C6 makes every bite heavy)
      "mualani-bite-heavy": {
        label: { zh: "普攻(强化)", en: "NA (Enhanced)" },
        minC: 1,
        parts: [
          {
            formula: new DirectFormula(biteMult, biteTag, "hp"),
            bespokeBuff: new ScalingBuff(
              cbs(this, "C1", ["E"]),
              {
                receiver: "selfOnField",
                filter: { abilities: ["normal"] },
              },
              [],
              "hp",
              "baseDmg",
              0.66
            ),
          },
        ],
      },
      // Normal bite (no C1 bonus). At C6 all bites are enhanced, so this is disabled.
      "mualani-bite-normal": {
        label: { zh: "普攻", en: "NA" },
        when: this.constellation < 6,
        parts: [
          {
            formula: new DirectFormula(biteMult, biteTag, "hp"),
          },
        ],
      },
      "mualani-burst": {
        label: { zh: "Q伤害", en: "Q" },
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
      {
        id: "mualani-bite-heavy",
        count: 0,
        bonus: [
          { minC: 1, delta: 1 },
          { minC: 6, delta: 2 },
        ],
      },
      {
        id: "mualani-bite-normal",
        count: 3,
        bonus: [
          { minC: 1, delta: -1 },
          { minC: 6, delta: -2 },
        ],
      },
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
        cbs(this, "P2", ["nightsoul-burst"]),
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
    // Modeled via bespokeBuff on separate first-cannon formula entry (see formulaMap).

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
      // C2: First Scalespiker Cannon gets +100% DMG via bespokeBuff
      ...(this.constellation >= 2
        ? {
            "kinich-cannon-first": {
              label: { zh: "E首发", en: "E First" },
              minC: 2 as const,
              parts: [
                {
                  formula: new DirectFormula(this.param("E", 2), {
                    element: "Dendro",
                    ability: "skill",
                    reaction: "none",
                  }),
                  bespokeBuff: new StatBuff(
                    cbs(this, "C2", ["E"]),
                    {
                      receiver: "selfOnField",
                      filter: { abilities: ["skill"] },
                    },
                    [{ key: "dmg%", value: 1.0 }]
                  ),
                },
                // C6 bounce: 700% ATK, also gets C2 buff (inherits bespokeBuff scope)
                ...(this.constellation >= 6
                  ? [
                      {
                        formula: new DirectFormula(7.0, {
                          element: "Dendro",
                          ability: "skill",
                          reaction: "none",
                        }),
                        bespokeBuff: new StatBuff(
                          cbs(this, "C2", ["E"]),
                          {
                            receiver: "selfOnField",
                            filter: { abilities: ["skill"] },
                          },
                          [{ key: "dmg%", value: 1.0 }]
                        ),
                      },
                    ]
                  : []),
              ],
            } satisfies FormulaEntry,
          }
        : {}),
      "kinich-cannon": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
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
                },
              ]
            : []),
        ],
      },
      "kinich-burst": {
        label: { zh: "Q 1斩+5龙息", en: "Q 1 Slash + 5 Breaths" },
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
  // C2: first cannon gets +100% DMG via separate formula entry
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      ...(this.constellation >= 2
        ? [
            { id: "kinich-cannon-first", count: 1 },
            { id: "kinich-cannon", count: 3 },
          ]
        : [{ id: "kinich-cannon", count: 4 }]),
      { id: "kinich-burst", count: 1 },
    ];
  }
}
