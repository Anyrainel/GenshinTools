import { LUNAR_REACTIONS } from "../constants";
import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarFormula,
  TransformFormula,
} from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { OptionDef } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Natlan Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("varesa")
class Varesa extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P1: Fiery Passion Tag-Team Triple Jump → Plunge ground impact +180% ATK
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
    ];

    // C4: Burst in Fiery Passion/Apex Drive → DMG +100%
    // Volcano Kablam's damage is "considered Plunging Attack DMG", so include "plunge" too.
    // Also includes "burst" for the Fiery Passion Flying Kick Q variant.
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["Q"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["burst", "plunge"] },
          },
          [{ key: "dmg%", value: 1.0 }]
        )
      );
      // C4 Diligent Refinement branch — only active without Fiery Passion/Apex Drive;
      // low-priority branch, model but gate via CombatOpts if needed.
      // In normal Varesa DPS rotation (Fiery Passion/Apex Drive active), this branch
      // does NOT apply. Included for completeness; the +100% burst branch above takes
      // precedence in peak-damage scenarios.
      buffs.push(
        new ScalingBuff(
          cbs(this, "C4", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
          [],
          "atk",
          "baseDmg",
          5.0,
          20000
        )
      );
    }

    // C6: Plunge and Burst → CR +10%, CD +100%
    if (this.constellation >= 6) {
      buffs.push(
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
        )
      );
    }

    return buffs;
  })();

  // Fiery Passion High Plunge (Lv10): 552.0%
  // Fiery Passion High Plunge (Lv13 C5+): 669.0%
  // Volcano Kablam (Lv10): 724.8%
  // Volcano Kablam (Lv13 C3+): 855.6%
  protected readonly formulaMap = (() => {
    const naMult = this.constellation >= 5 ? 6.69 : 5.52;
    const qMult = this.constellation >= 3 ? 8.556 : 7.248;
    return {
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
      "varesa-kablam": {
        label: {
          zh: "Q下落",
          en: "Q Volcano Kablam (Plunge)",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              // Note: Considered Plunge DMG in-game, so use ability: "plunge"
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("citlali")
class Citlali extends CharacterBase {
  readonly buffs = [
    // P1: After Frozen/Melt, enemies' Pyro/Hydro RES -20% (C2: -40%)
    new StatBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "team", filter: { elements: ["Pyro", "Hydro"] } },
      [{ key: "resReduction%", value: this.constellation >= 2 ? 0.4 : 0.2 }]
    ),
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
    // P2: EM → baseDmg for Q Ice Storm (burst, 1200% EM)
    // Ice Storm fires when Q is cast (Citlali is on-field at that moment),
    // but we use "self" so this also covers off-field Skull explosions.
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "self", filter: { abilities: ["burst"] } },
      [],
      "em",
      "baseDmg",
      12.0
    ),
    // C1: Stellar Blade — on-field active character (not Citlali) gains +200% EM as baseDmg
    // 10 base stacks (+3 per Frozen/Melt every 8s) — forgiving stacks, assume always active
    ...(this.constellation >= 1
      ? [
          new ScalingBuff(
            cbs(this, "C1", ["E"]),
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
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "otherOnField" }, [
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
    // E Frostfall Storm: Lv10 30.6%, Lv13 (C3+) 36.2%
    const eStormMult = this.constellation >= 3 ? 0.362 : 0.306;
    // Frostfall Storm ticks (1/s): C0-C3 ~12s, C4-C5 ~16s (C4 skull
    // returns 16 Nightsoul pts every 8s), C6 20s (storm never stops)
    const eHits =
      this.constellation >= 6 ? 20 : this.constellation >= 4 ? 16 : 12;
    // Q Ice Storm: Lv10 967.7%, Lv13 (C5+) 1142.4%
    const qMult = this.constellation >= 5 ? 11.424 : 9.677;
    // Q Spiritvessel Skull (guaranteed, 1 per target): Lv10 241.9%, Lv13 (C5+) 285.6%
    const qSkullMult = this.constellation >= 5 ? 2.856 : 2.419;
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
    return {
      "citlali-e-total": {
        label: { zh: "E总伤害", en: "E Total" },
        parts: [
          { formula: new DirectFormula(eStormMult, skillTag), hits: eHits },
          // C4: Obsidian Spiritvessel Skull (1800% EM, once per 8s)
          ...(this.constellation >= 4
            ? [
                {
                  formula: new DirectFormula(18.0, skillTag, "em"),
                  hits: this.constellation >= 6 ? 3 : 2,
                },
              ]
            : []),
        ],
      },
      "citlali-burst-total": {
        label: { zh: "Q总伤害", en: "Q Total" },
        parts: [
          { formula: new DirectFormula(qMult, burstTag) },
          { formula: new DirectFormula(qSkullMult, burstTag) },
        ],
      },
    };
  })();
}

@RegisterCharacter("mavuika")
class Mavuika extends CharacterBase {
  readonly buffs = (() => {
    const qLvl = this.constellation >= 3 ? 13 : 10;
    const buffs: StatBuff[] = [
      // P1: After nearby party member triggers Nightsoul Burst, Mavuika's ATK +30%
      new StatBuff(cbs(this, "P1", ["nightsoul-burst"]), { receiver: "self" }, [
        { key: "atk%", value: 0.3 },
      ]),
      // P2 "Kiongozi": After Q, on-field DMG +0.2% per Spirit (max 200 = 40%)
      // Assume full 200 Spirit → 40%. C4 adds +10% and removes decay.
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "onField" }, [
        {
          key: "dmg%",
          value: this.constellation >= 4 ? 0.5 : 0.4,
        },
      ]),
      // Q: FS bonus to Sunfell Slice (200 × 2.9%/3.4% ATK, scales with Q talent)
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "atk",
        "baseDmg",
        qLvl === 13 ? 6.8 : 5.8
      ),
      // Q: FS bonus to Flamestrider Normal Attacks (200 × 0.51%/0.62% ATK)
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["normal"] } },
        [],
        "atk",
        "baseDmg",
        qLvl === 13 ? 1.24 : 1.02
      ),
      // Q: FS bonus to Flamestrider Charged Attacks (200 × 1.02%/1.24% ATK)
      new ScalingBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [],
        "atk",
        "baseDmg",
        qLvl === 13 ? 2.48 : 2.04
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
    const eLvl = this.constellation >= 5 ? 13 : 10;
    const qLvl = this.constellation >= 3 ? 13 : 10;

    const sunfellMult = qLvl === 13 ? 9.452 : 8.006;
    const n1Mult = eLvl === 13 ? 1.372 : 1.132;
    // CA: Cyclic (Lv10 195.5%, Lv13 236.9%) + Final (Lv10 272%, Lv13 329.6%)
    const caCyclicMult = eLvl === 13 ? 2.369 : 1.955;
    const caFinalMult = eLvl === 13 ? 3.296 : 2.72;
    const sprintMult = eLvl === 13 ? 1.936 : 1.598;

    return {
      "mavuika-sunfell": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(sunfellMult, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "mavuika-combo": {
        label: { zh: "Q普攻+重击+冲刺", en: "Post-Q N1+CA+Sprint" },
        parts: [
          {
            formula: new DirectFormula(n1Mult, {
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
            formula: new DirectFormula(caFinalMult, {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(sprintMult, {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("chasca")
class Chasca extends CharacterBase {
  // Count unique eligible element types in team (Pyro/Hydro/Cryo/Electro)
  private readonly eligibleTypes = (() => {
    const eligible = new Set<string>();
    for (const [id, el] of Object.entries(this.teamMeta.elements)) {
      if (
        el != null &&
        id !== this.charId &&
        ["Pyro", "Hydro", "Cryo", "Electro"].includes(el)
      )
        eligible.add(el);
    }
    return Math.min(eligible.size, 3);
  })();

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
    const shellMult = this.constellation >= 3 ? 1.037 : 0.878;
    const shiningMult = this.constellation >= 3 ? 3.54 : 2.998;
    const shiningCount =
      this.eligibleTypes === 0
        ? 0
        : this.eligibleTypes + (this.constellation >= 1 ? 2 : 1);
    const normalCount = 6 - shiningCount;
    // Q Radiant Soulseeker Shell: Lv10 372.2%, Lv13 (C5+) 439.4%
    const qMult = this.constellation >= 5 ? 4.394 : 3.722;
    // Q Soulseeker Shell: Lv10 186.1%, Lv13 (C5+) 219.7%
    const qNormMult = this.constellation >= 5 ? 2.197 : 1.861;
    // Q Galesplitting: Lv10 158.4%, Lv13 (C5+) 187%
    const qInitMult = this.constellation >= 5 ? 1.87 : 1.584;
    const qRadiantCount = this.eligibleTypes === 0 ? 0 : this.eligibleTypes * 2;
    const qNormalCount = 6 - qRadiantCount;

    const baseTag = {
      element: "Anemo" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    const qTag = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    return {
      "chasca-shining-volley": {
        label: {
          zh: "E一轮6枚",
          en: "E 6-Shell Volley",
        },
        parts: [
          ...Array(normalCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(shellMult, baseTag),
            })),
          ...Array(shiningCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(shiningMult, baseTag),
            })),
        ],
      },
      "chasca-burst": {
        label: {
          zh: "Q+6弹",
          en: "Q + 6 Shells",
        },
        parts: [
          { formula: new DirectFormula(qInitMult, qTag) },
          ...Array(qNormalCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(qNormMult, qTag),
            })),
          ...Array(qRadiantCount)
            .fill(0)
            .map(() => ({
              formula: new DirectFormula(qMult, qTag),
            })),
        ],
      },
    };
  })();
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
    const resValue = this.constellation >= 3 ? 0.45 : 0.36;
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

    // C2: Element-dependent onField buffs
    if (this.constellation >= 2) {
      if (this.teamPHEC.has("Pyro")) {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "onField" }, [
            { key: "atk%", value: 0.45 },
          ])
        );
      }
      if (this.teamPHEC.has("Hydro")) {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "onField" }, [
            { key: "hp%", value: 0.45 },
          ])
        );
      }
      if (this.teamPHEC.has("Cryo")) {
        buffs.push(
          new StatBuff(cbs(this, "C2", ["E"]), { receiver: "onField" }, [
            { key: "cd", value: 0.6 },
          ])
        );
      }
      // C2 Geo Source Sample always active at C2: Geo characters → DMG dealt +50%
      // Approximated as geo% since Geo characters primarily deal Geo DMG
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "onField" }, [
          { key: "geo%", value: 0.5 },
        ])
      );
    }

    // C4: Blooming Blessing — all party members gain +65% Xilonen DEF as Base DMG
    // for Normal/Charged/Plunging Attacks. Buff applies to whoever is on field.
    if (this.constellation >= 4) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C4", ["E"]),
          {
            receiver: "onField",
            filter: { abilities: ["normal", "charge", "plunge"] },
          },
          [],
          "def",
          "baseDmg",
          0.65
        )
      );
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
    const qTag = {
      element: "Geo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const qBeatMult = this.constellation >= 5 ? 5.977 : 5.063;
    return {
      ...(this.constellation >= 6
        ? {
            "xilonen-normal": {
              label: {
                zh: "E普攻4段",
                en: "Normal N4 Combo (Blade Roller)",
              },
              parts: [
                { formula: new DirectFormula(1.107, nTag, "def") },
                { formula: new DirectFormula(1.088, nTag, "def") },
                { formula: new DirectFormula(1.301, nTag, "def") },
                { formula: new DirectFormula(1.701, nTag, "def") },
              ],
            },
          }
        : {}),
      // Q extra beats: only when ≤1 converted sample
      ...(this.convertedSamples <= 1
        ? {
            "xilonen-burst-beats": {
              label: { zh: "Q额外节拍(×2)", en: "Q Extra Beats (×2)" },
              parts: [
                {
                  formula: new DirectFormula(qBeatMult, qTag, "def"),
                  hits: 2,
                },
              ],
            },
          }
        : {}),
    };
  })();
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

    // C1: First Surging Bite after entering Nightsoul's Blessing +66% Max HP
    // We model the single Surging Bite (the peak hit) — C1 applies to that first bite
    if (this.constellation >= 1) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C1", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [],
          "hp",
          "baseDmg",
          0.66
        )
      );
    }

    return buffs;
  })();

  // Surging Bite: base 15.62% + 3×7.81% + surging 39.06% = 78.11% HP (Lv10)
  // Lv13 (C3+): 18.45% + 3×9.22% + 46.11% = 92.22% HP
  // Q: 105.2%/124.2% HP (Lv10/Lv13 C5+)
  protected readonly formulaMap = (() => {
    const biteMult = this.constellation >= 3 ? 0.9222 : 0.7811;
    const burstMult = this.constellation >= 5 ? 1.242 : 1.052;
    return {
      "mualani-bite": {
        label: { zh: "普攻", en: "NA" },
        parts: [
          {
            formula: new DirectFormula(
              biteMult,
              {
                element: "Hydro",
                ability: "normal",
                reaction: "none",
              },
              "hp"
            ),
          },
        ],
      },
      "mualani-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              burstMult,
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
    // We model this as always applying to the Scalespiker (peak damage)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "dmg%", value: 1.0 }]
        )
      );
    }

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
    const cannonMult = this.constellation >= 3 ? 14.608 : 12.374;
    const qInit = this.constellation >= 5 ? 2.848 : 2.412;
    const qBreath = this.constellation >= 5 ? 2.566 : 2.173;
    // C6 bounce: 700% ATK, Dendro Skill DMG — fires once per cannon shot
    const c6BouncePart = {
      formula: new DirectFormula(7.0, {
        element: "Dendro",
        ability: "skill",
        reaction: "none",
      }),
    };
    return {
      "kinich-cannon": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(cannonMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
          ...(this.constellation >= 6 ? [c6BouncePart] : []),
        ],
      },
      "kinich-cannon-spread": {
        label: {
          zh: "E(蔓激化)",
          en: "E(Spread)",
        },
        parts: [
          {
            formula: new CatalyzeFormula(cannonMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "spread",
            }),
          },
          ...(this.constellation >= 6 ? [c6BouncePart] : []),
        ],
      },
      "kinich-burst": {
        label: { zh: "Q 1斩+5龙息", en: "Q 1 Slash + 5 Breaths" },
        parts: [
          {
            formula: new DirectFormula(qInit, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(qBreath, {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            hits: 5,
          },
        ],
      },
    };
  })();
}
