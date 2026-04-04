import type { Element, ReactionType } from "@/data/types";
import { ScalingBuff, StatBuff } from "../damageBuffs";
import { DirectFormula } from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  RegisterCharacter,
  type StatSheet,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { E, type Expr, simplify } from "../expr";
import type { ExprStats } from "../exprStats";
import { cbs } from "../helpers";
import type { ComboDescriptor, StatEntry, StatKey } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Mondstadt Characters
// ═══════════════════════════════════════════════════════════════

const durinOption = {
  label: { zh: "形态", en: "Form" },
  choices: [
    { value: "white", label: { zh: "白焰之龙", en: "White Flame" } },
    {
      value: "white-c4",
      label: { zh: "白焰之龙(无限层)", en: "White (unlimited)" },
      when: (tm) => (tm.constellations.durin ?? 0) >= 4,
    },
    { value: "dark", label: { zh: "黑蚀之龙", en: "Dark Decay" } },
    {
      value: "dark-c4",
      label: { zh: "黑蚀(14层)", en: "Dark (14 stacks)" },
      when: (tm) => (tm.constellations.durin ?? 0) >= 4,
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("durin", durinOption)
class Durin extends CharacterBase {
  private readonly form = resolveOption(durinOption, this.option);
  private readonly isWhite = this.form === "white" || this.form === "white-c4";
  private readonly isC4Form =
    this.form === "white-c4" || this.form === "dark-c4";

  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    // P4: Hexerei Secret Rite enhances P1 effects by 75%
    const hexMult = isHexerei ? 1.75 : 1.0;
    const { isWhite, isC4Form } = this;

    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    if (isWhite) {
      // P1 (White Flame): Pyro RES -20% (×hexMult) + corresponding reaction element RES
      const p1Val = 0.2 * hexMult;
      const reactionEls: [ReactionType, Element][] = [
        ["vaporize", "Hydro"],
        ["melt", "Cryo"],
        ["overloaded", "Electro"],
        ["burning", "Dendro"],
        ["burgeon", "Dendro"],
        ["swirl", "Anemo"],
        ["crystallize", "Geo"],
      ];
      const triggers: string[] = ["Q"];
      const elements: Element[] = ["Pyro"];
      for (const [reaction, el] of reactionEls) {
        if (!this.teamMeta.hasReaction(reaction)) continue;
        if (!triggers.includes(reaction)) triggers.push(reaction);
        if (!elements.includes(el)) elements.push(el);
      }
      if (triggers.length > 1) {
        buffs.push(
          new StatBuff(
            cbs(this, "P1", triggers),
            { receiver: "team", filter: { elements } },
            [{ key: "resReduction%", value: p1Val }]
          )
        );
      }
    } else {
      // P1 (Dark Decay): Vaporize/Melt DMG +40% (×hexMult)
      // Dragon of Dark Decay persists off-field; use "self" so Durin's burst benefits
      // whether he is on-field or not
      buffs.push(
        new StatBuff(
          cbs(this, "P1", ["Q"]),
          {
            receiver: "self",
            filter: { reactions: ["vaporize", "melt"] },
          },
          [{ key: "reactionDmg%", value: 0.4 * hexMult }]
        )
      );
    }

    // P2: After Q, 10 stacks of Primordial Fusion. Dragon ticks consume 1 stack,
    // boosting DMG by 3% per 100 ATK (cap 75%). Only dragon ticks consume stacks,
    // not the initial Q hits. Modeled via bespokeBuff on the buffed-tick formula parts.
    // (P2 buff instance stored for use in formulaMap below.)

    // C1 (White Flame): On-field team baseDmg from ATK ×60% per stack, 20 stacks (28 at C4)
    // ("Stack counts for characters in the party who have Cycle of Enlightenment
    //  are managed individually.")
    // C1 (Dark Decay): Self baseDmg from ATK ×150% per stack, 20 stacks consumed 2
    //  per hit = 10 effective triggers (14 at C4). Self buff → modeled via bespokeBuff
    //  on dragon tick formula parts in formulaMap.
    if (this.constellation >= 1 && isWhite) {
      const c1Stacks = isC4Form ? 28 : 20;
      for (const cid of Object.keys(this.teamMeta.elements)) {
        if (cid === this.charId) continue;
        buffs.push(
          new ScalingBuff(
            { ...cbs(this, "C1", ["Q"]), maxStacks: c1Stacks },
            {
              receiver: "otherOnField",
              charId: cid,
              filter: {
                abilities: ["normal", "charge", "plunge", "skill", "burst"],
              },
            },
            [],
            "atk",
            "baseDmg",
            0.6
          )
        );
      }
    }

    // C2: After burst, Pyro DMG +50% for team + corresponding reaction element DMG +50%
    if (this.constellation >= 2) {
      const c2Elements: Element[] = ["Pyro"];
      const teamEls = Object.values(this.teamMeta.elements);
      for (const el of [
        "Hydro",
        "Cryo",
        "Electro",
        "Dendro",
        "Anemo",
        "Geo",
      ] as const) {
        if (teamEls.includes(el)) c2Elements.push(el);
      }
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "team", filter: { elements: c2Elements.sort() } },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
    }

    // C4: Burst DMG +40% — dragon fires off-field, use "self"
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, "C4", []),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }

    // C6: Burst ignores 30% DEF (always) — dragon fires off-field, use "self"
    // White Flame: enemy DEF -30% (team debuff)
    // Dark Decay: ignores additional 40% DEF (total 70%)
    if (this.constellation >= 6) {
      if (isWhite) {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "self", filter: { abilities: ["burst"] } },
            [{ key: "defIgnore%", value: 0.3 }]
          ),
          new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "team" }, [
            { key: "defReduction%", value: 0.3 },
          ])
        );
      } else {
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "self", filter: { abilities: ["burst"] } },
            [{ key: "defIgnore%", value: 0.7 }]
          )
        );
      }
    }

    return buffs;
  })();

  // Q: Burst initial (3 hits) + Dragon ticks over 20s
  // White: 1s interval → 20 ticks; Dark: 1.25s interval → 16 ticks
  // P2: 10 stacks of Primordial Fusion consumed by dragon ticks (not initial hits)
  // C1 Dark: 10 effective triggers (14 at C4), modeled via bespokeBuff
  // Split dragon ticks into buffed (P2, and C1 for dark) + unbuffed parts
  protected readonly formulaMap: Record<string, FormulaEntry> = ((): Record<
    string,
    FormulaEntry
  > => {
    const { isWhite, isC4Form } = this;
    // Q initial — 3 separate hits with different multipliers, must NOT be summed (S3)
    // White: Q param1 + param2 + param3; Dark: Q param4 + param5 + param6
    // Dragon ticks (White): Q param7, 20 ticks over 20s (1s interval)
    // Dragon ticks (Dark): Q param8, 16 ticks over 20s (1.25s interval)
    const dragonWhiteMult = this.param("Q", 7);
    const dragonDarkMult = this.param("Q", 8);

    // P2 bespokeBuff: per 100 ATK → +3% baseDmg% (cap 75%), only on P2-buffed ticks
    const p2Buff = new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [],
      "atk",
      "baseDmg%",
      0.0003,
      0.75
    );

    // C1 Dark bespokeBuff: ATK ×150% as baseDmg per trigger
    // 20 stacks consumed 2 per hit = 10 triggers; C4 → 14 triggers
    const c1DarkBuff =
      this.constellation >= 1 && !isWhite
        ? new ScalingBuff(
            cbs(this, "C1", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [],
            "atk",
            "baseDmg",
            1.5
          )
        : null;
    const c1DarkTriggers = isC4Form ? 14 : 10;

    const burstTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };

    const p2Stacks = 10;
    const whiteTotalTicks = 20;
    const darkTotalTicks = 16;

    const skillTag = {
      element: "Pyro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const skillEntries = {
      // E: Confirmation of Purity (param1) — single AoE hit
      "durin-skill-purity": {
        label: { zh: "E白化之是", en: "E Purity" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), skillTag) }],
      } as FormulaEntry,
      // E: Denial of Darkness (param2+param3+param4) — 3 consecutive hits
      "durin-skill-darkness": {
        label: { zh: "E黑度之否", en: "E Darkness" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), skillTag) },
          { formula: new DirectFormula(this.param("E", 3), skillTag) },
          { formula: new DirectFormula(this.param("E", 4), skillTag) },
        ],
      } as FormulaEntry,
    };

    if (isWhite) {
      return {
        ...skillEntries,
        "durin-burst-white": {
          label: { zh: "Q初段+龙息×20", en: "Q Initial+Breath×20" },
          parts: [
            { formula: new DirectFormula(this.param("Q", 1), burstTag) },
            { formula: new DirectFormula(this.param("Q", 2), burstTag) },
            { formula: new DirectFormula(this.param("Q", 3), burstTag) },
            {
              formula: new DirectFormula(dragonWhiteMult, burstTag),
              hits: p2Stacks,
              offField: true,
              bespokeBuff: p2Buff,
            },
            {
              formula: new DirectFormula(dragonWhiteMult, burstTag),
              hits: whiteTotalTicks - p2Stacks,
              offField: true,
            },
          ],
        },
      };
    }

    // Dark mode: P2 and C1 both apply to dragon ticks.
    // P2 has 10 stacks; C1 has 10 triggers (14 at C4).
    // Both P2 and C1 apply to the first 10 ticks. C1 may apply to up to 4 more at C4.
    if (c1DarkBuff) {
      // Both P2 (10 stacks) and C1 share the first min(p2Stacks, c1DarkTriggers) ticks
      const bothBuffedTicks = Math.min(p2Stacks, c1DarkTriggers);
      const c1OnlyTicks = c1DarkTriggers - bothBuffedTicks;
      const unbuffedTicks = darkTotalTicks - c1DarkTriggers;

      const parts: FormulaEntry["parts"] = [
        { formula: new DirectFormula(this.param("Q", 4), burstTag) },
        { formula: new DirectFormula(this.param("Q", 5), burstTag) },
        { formula: new DirectFormula(this.param("Q", 6), burstTag) },
      ];

      // Ticks with both P2 and C1 buffs
      if (bothBuffedTicks > 0) {
        // bespokeBuff only supports a single buff instance. Combine P2 + C1 via
        // anonymous subclass that merges both dynamicBuffs and dynamicBuffsExpr.
        const combinedBuff = new (class extends ScalingBuff {
          private readonly p2 = p2Buff;
          override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
            return [
              ...super.dynamicBuffs(selfStats),
              ...this.p2.dynamicBuffs(selfStats),
            ];
          }
          override dynamicBuffsExpr(
            selfStats: ExprStats
          ): { key: StatKey; expr: Expr }[] {
            return [
              ...super.dynamicBuffsExpr(selfStats),
              ...this.p2.dynamicBuffsExpr(selfStats),
            ];
          }
        })(
          cbs(this, "C1/P2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "atk",
          "baseDmg",
          1.5
        );
        parts.push({
          formula: new DirectFormula(dragonDarkMult, burstTag),
          hits: bothBuffedTicks,
          offField: true,
          bespokeBuff: combinedBuff,
        });
      }

      // C4: extra ticks with only C1 buff (no P2 stacks left)
      if (c1OnlyTicks > 0) {
        parts.push({
          formula: new DirectFormula(dragonDarkMult, burstTag),
          hits: c1OnlyTicks,
          offField: true,
          bespokeBuff: c1DarkBuff,
        });
      }

      // Remaining ticks with no P2 or C1 buff
      if (unbuffedTicks > 0) {
        parts.push({
          formula: new DirectFormula(dragonDarkMult, burstTag),
          hits: unbuffedTicks,
          offField: true,
        });
      }

      return {
        ...skillEntries,
        "durin-burst-dark": {
          label: { zh: "Q初段+龙息×16", en: "Q Initial+Breath×16" },
          parts,
        },
      };
    }

    // Dark mode without C1: just P2 stacks on first 10 ticks
    return {
      ...skillEntries,
      "durin-burst-dark": {
        label: { zh: "Q初段+龙息×16", en: "Q Initial+Breath×16" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 4), burstTag) },
          { formula: new DirectFormula(this.param("Q", 5), burstTag) },
          { formula: new DirectFormula(this.param("Q", 6), burstTag) },
          {
            formula: new DirectFormula(dragonDarkMult, burstTag),
            hits: p2Stacks,
            offField: true,
            bespokeBuff: p2Buff,
          },
          {
            formula: new DirectFormula(dragonDarkMult, burstTag),
            hits: darkTotalTicks - p2Stacks,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (off-field burst DPS, 3 initial hits + dragon ticks baked in)
  protected override get comboDescriptor(): ComboDescriptor {
    return this.isWhite
      ? [{ id: "durin-burst-white", count: 1 }]
      : [{ id: "durin-burst-dark", count: 1 }];
  }
}

const albedoOption = {
  label: { zh: "敌人血量（被动1）", en: "Enemy HP (P1)" },
  choices: [
    {
      value: "below50",
      label: { zh: "HP<50%", en: "HP<50%" },
    },
    {
      value: "above50",
      label: { zh: "HP≥50%", en: "HP≥50%" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("albedo", albedoOption)
class Albedo extends CharacterBase {
  private readonly enemyHp = resolveOption(albedoOption, this.option);

  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    const allAbilities = [
      "normal",
      "charge",
      "plunge",
      "skill",
      "burst",
    ] as const;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Transient Blossoms deal +25% DMG vs enemies HP <50%
      // Transient Blossoms proc off-field; receiver is "self" not "selfOnField"
      ...(this.enemyHp === "below50"
        ? [
            new StatBuff(
              cbs(this, "P1", ["enemy-low-hp"]),
              { receiver: "self", filter: { abilities: ["skill"] } },
              [{ key: "dmg%", value: 0.25 }]
            ),
          ]
        : []),
      // P4: Silver Isotoma — Transient Blossom DMG +240% DEF (fixed passive, not talent-dependent)
      // Only when Silver Isotoma exists (Hexerei: Secret Rite)
      // receiver: "self" — Silver Isotoma fires while Albedo is off-field
      ...(isHexerei
        ? [
            new ScalingBuff(
              cbs(this, "P4", ["E"]),
              { receiver: "self", filter: { abilities: ["skill"] } },
              [],
              "def",
              "baseDmg",
              2.4
            ),
          ]
        : []),
      // P2: After Q, nearby party EM +125 for 10s
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "team" }, [
        { key: "em", value: 125 },
      ]),
      // P4: After Solar Isotoma, team DMG +4% per 1000 DEF (cap 12%)
      new ScalingBuff(
        cbs(this, "P4", ["E"]),
        { receiver: "team", filter: { abilities: [...allAbilities] } },
        [],
        "def",
        "dmg%",
        0.00004,
        0.12
      ),
      // P4 (Hexerei): After Silver Isotoma, Hexerei members DMG +10% per 1000 DEF (cap 30%)
      // Receiver "team" is an approximation; faction-scoped receivers are not supported.
      ...(isHexerei
        ? [
            new ScalingBuff(
              cbs(this, "P4", ["E"]),
              { receiver: "team", filter: { abilities: [...allAbilities] } },
              [],
              "def",
              "dmg%",
              0.0001,
              0.3
            ),
          ]
        : []),
      // C1: Transient Blossoms regenerate 1.2 Energy (skip per U9)
      // C1: Also, after E, Albedo's DEF +50% for 20s
      ...(this.constellation >= 1
        ? [
            new StatBuff(cbs(this, "C1", ["E"]), { receiver: "self" }, [
              { key: "def%", value: 0.5 },
            ]),
          ]
        : []),
      // C4: Active characters in Solar Isotoma field: Plunge DMG +30%
      ...(this.constellation >= 4
        ? [
            new StatBuff(
              cbs(this, "C4", ["E"]),
              { receiver: "teamOnField", filter: { abilities: ["plunge"] } },
              [{ key: "dmg%", value: 0.3 }]
            ),
          ]
        : []),
      // C6: In Solar Isotoma with Crystallize shield or Moondrifts, DMG +17%
      // Crystallize shield via hasShielder(); Moondrifts via lunarCrystallize reaction
      ...(this.constellation >= 6 &&
      (this.teamMeta.hasShielder() ||
        this.teamMeta.hasReaction("lunarCrystallize"))
        ? [
            new StatBuff(cbs(this, "C6", ["E"]), { receiver: "teamOnField" }, [
              { key: "dmg%", value: 0.17 },
            ]),
          ]
        : []),
    ];

    // C2: Fatal Reckoning — burst DMG +30% DEF × 4 stacks = +120% DEF as baseDmg
    if (this.constellation >= 2) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "def",
          "baseDmg",
          1.2
        )
      );
    }

    // C6: Fatal Blossom DMG +250% DEF for 20s (after Silver Isotoma destroyed by Q)
    if (this.constellation >= 6 && isHexerei) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [],
          "def",
          "baseDmg",
          2.5
        )
      );
    }

    return buffs;
  })();

  protected readonly formulaMap = (() => {
    return {
      // E placement DMG (param1, ATK-scaled)
      "albedo-skill-placement": {
        label: { zh: "E设置", en: "E Placement" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Geo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "albedo-blossom": {
        label: { zh: "E刹那之花", en: "E Blossom" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 2),
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
            offField: true,
          },
        ],
      },
      "albedo-burst": {
        label: { zh: "Q爆发+生灭之花×7", en: "Q + Fatal Blossom ×7" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Geo",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Geo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 7,
          },
        ],
      },
      // C2: Off-field auto-trigger — 3 Fatal Blossoms × 300% DEF (burst-typed)
      // Triggers when Fatal Reckoning stacks reach 4 while Albedo is off-field
      "albedo-c2-offfield": {
        label: {
          zh: "后台生灭之花×3",
          en: "Fatal Blossom ×3",
        },
        minC: 2,
        parts: [
          {
            formula: new DirectFormula(
              3.0,
              { element: "Geo", ability: "burst", reaction: "none" },
              "def"
            ),
            hits: 3,
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E (place isotoma) + ~5 blossom procs + Q (off-field sub-DPS)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "albedo-blossom", count: 5 },
      { id: "albedo-burst", count: 1 },
    ];
  }
}

const dilucOption = {
  label: { zh: "敌人血量（1命）", en: "Enemy HP (C1)" },
  choices: [
    {
      value: "above50",
      label: { zh: "HP>50%", en: "HP >50%" },
    },
    {
      value: "below50",
      label: { zh: "HP≤50%", en: "HP≤50%" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("diluc", dilucOption)
class Diluc extends CharacterBase {
  private readonly hp = resolveOption(dilucOption, this.option);

  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: After Q, Pyro DMG +20% during infusion
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
        { key: "pyro%", value: 0.2 },
      ]),
    ];

    if (this.constellation >= 1 && this.hp === "above50") {
      // C1: DMG +15% against enemies with HP > 50%
      buffs.push(
        new StatBuff(
          cbs(this, "C1", ["enemy-high-hp"]),
          { receiver: "selfOnField" },
          [{ key: "dmg%", value: 0.15 }]
        )
      );
    }
    if (this.constellation >= 2) {
      // C2: On taking DMG, ATK +10% and ATK SPD +5% × 3 stacks = +30% / +15%
      buffs.push(
        new StatBuff(cbs(this, "C2", []), { receiver: "selfOnField" }, [
          { key: "atk%", value: 0.3 },
          { key: "atkSpd%", value: 0.15 },
        ])
      );
    }
    // C4: 2nd/3rd E cast in combo deals +40% DMG — applied via bespokeBuff on parts[1] and parts[2]
    if (this.constellation >= 6) {
      // C6: After E, next 2 normals DMG +30% and ATK SPD +30%
      // Self buff → modeled via formula hit counts, not maxStacks.
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["normal"] } },
          [
            { key: "dmg%", value: 0.3 },
            { key: "atkSpd%", value: 0.3 },
          ]
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    const pyroSkill = {
      element: "Pyro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };

    const c4Bespoke =
      this.constellation >= 4
        ? new StatBuff(
            cbs(this, "C4", ["E"]),
            { receiver: "selfOnField", filter: { abilities: ["skill"] } },
            [{ key: "dmg%", value: 0.4 }]
          )
        : undefined;

    return {
      "diluc-skill": {
        label: { zh: "E三段", en: "E (3 hits)" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), pyroSkill) },
          {
            formula: new DirectFormula(this.param("E", 2), pyroSkill),
            bespokeBuff: c4Bespoke,
          },
          {
            formula: new DirectFormula(this.param("E", 3), pyroSkill),
            bespokeBuff: c4Bespoke,
          },
        ],
      },
      "diluc-burst": {
        label: { zh: "Q斩击+DoT+爆炸", en: "Q Slash+DoT+Explosion" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 3), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "diluc-plunge": {
        label: {
          zh: "下落攻击",
          en: "Plunge",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 11), {
              element: "Pyro",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: Q > N1E > N1E > N1E (vape carry)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "diluc-skill", count: 1 },
      { id: "diluc-burst", count: 1 },
      { id: "diluc-plunge", count: 0 },
    ];
  }
}

@RegisterCharacter("mona")
class Mona extends CharacterBase {
  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P2 (combat): 20% of ER as Hydro DMG% (Waterborne Destiny)
      // Personal passive, always active — use "self" (no on-field restriction)
      new ScalingBuff(
        cbs(this, "P2", ["passive"]),
        { receiver: "self" },
        [],
        "er",
        "hydro%",
        0.2
      ),
      // Q: Stellaris Phantasm — Omen: opponents take DMG bonus (talent-level-dependent, param10)
      new StatBuff(cbs(this, "Q", ["Q"]), { receiver: "team" }, [
        { key: "dmg%", value: this.param("Q", 10) },
      ]),
      // C1: Hydro reaction effects +15% (EC, Lunar-Charged, Vaporize, Hydro Swirl, Lunar-Crystallize)
      // "When any of your own party members hits an opponent affected by an Omen" → team-wide
      // Off-field party members get 160% of the bonus (24% instead of 15%), modeled as base 15% + extra 9%
      ...(this.constellation >= 1
        ? [
            new StatBuff(
              cbs(this, "C1", ["Q"]),
              {
                receiver: "team",
                filter: {
                  reactions: [
                    "electroCharged",
                    "lunarCharged",
                    "vaporize",
                    "swirl",
                    "lunarCrystallize",
                  ],
                },
              },
              [{ key: "reactionDmg%", value: 0.15 }]
            ),
            // C1 off-field enhancement: 160% of 15% = 24%, extra 9% for off-field teammates
            new StatBuff(
              cbs(this, "C1", ["Q"]),
              {
                receiver: "otherOffField",
                filter: {
                  reactions: [
                    "electroCharged",
                    "lunarCharged",
                    "vaporize",
                    "swirl",
                    "lunarCrystallize",
                  ],
                },
              },
              [{ key: "reactionDmg%", value: 0.09 }]
            ),
          ]
        : []),
      // C2: Charged Attack hit → all nearby party members EM +80 for 12s
      ...(this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", ["charge"]), { receiver: "team" }, [
              { key: "em", value: 80 },
            ]),
          ]
        : []),
      // C4: Omen targets +15% CR (all party members attacking affected opponents)
      // C4 also: Hexerei party members gain +15% CD (approximated as team since faction-scoped not supported)
      ...(this.constellation >= 4
        ? [
            new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
              { key: "cr", value: 0.15 },
            ]),
            ...(isHexerei
              ? [
                  new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
                    { key: "cd", value: 0.15 },
                  ]),
                ]
              : []),
          ]
        : []),
      // C6: After entering Illusory Torrent, next Charged Attack +60%/s up to +180% (3s)
      // Modeled at max; ramp-up not tracked (insignificant accuracy difference)
      // C6 also: Charged Attacks against Omen enemies deal 200% original DMG (baseDmg% +1.0)
      ...(this.constellation >= 6
        ? [
            new StatBuff(
              cbs(this, "C6", ["E"]),
              { receiver: "selfOnField", filter: { abilities: ["charge"] } },
              [{ key: "dmg%", value: 1.8 }]
            ),
            new StatBuff(
              cbs(this, "C6", ["Q"]),
              { receiver: "selfOnField", filter: { abilities: ["charge"] } },
              [{ key: "baseDmg%", value: 1.0 }]
            ),
          ]
        : []),
    ];
    // P4 (Hexerei): Astral Glow of Mercury — when other party members trigger Vaporize,
    // consumes stacks (max 3), each stack increases that Vaporize DMG by 5% → max +15%
    // "队伍中自己的其他角色" → otherOnField (benefits other characters, not Mona)
    // Assumed: max 3 stacks always available (maintained via Mona's NA/charge hits)
    if (isHexerei && this.teamMeta.hasReaction("vaporize")) {
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["normal", "charge", "vaporize"]),
          { receiver: "otherOnField", filter: { reactions: ["vaporize"] } },
          [{ key: "reactionDmg%", value: 0.15 }]
        )
      );
    }
    return buffs;
  })();

  // E: Mirror Reflection of Doom — DoT (param1) + Explosion (param2)
  // Q: Bubble explosion — Q param2
  protected readonly formulaMap = (() => {
    return {
      "mona-skill": {
        label: { zh: "E幻愿", en: "E Phantom" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Hydro",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      "mona-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: Q (omen support, bubble explosion)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "mona-burst", count: 1 }];
  }
}

@RegisterCharacter("jean")
class Jean extends CharacterBase {
  readonly buffs = [
    // C1: Hold E DMG +40%
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["E"]),
            { receiver: "selfOnField", filter: { abilities: ["skill"] } },
            [{ key: "dmg%", value: 0.4 }]
          ),
        ]
      : []),
    // C2: Jean picks up particle -> Team ATK SPD +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(cbs(this, "C2", ["orb"]), { receiver: "team" }, [
            { key: "atkSpd%", value: 0.15 },
          ]),
        ]
      : []),
    // C4: Q field: Anemo RES -40%
    ...(this.constellation >= 4
      ? [
          new StatBuff(
            cbs(this, "C4", ["Q"]),
            { receiver: "team", filter: { elements: ["Anemo"] } },
            [{ key: "resReduction%", value: 0.4 }]
          ),
        ]
      : []),
  ];

  // E: param1
  // Q: param1
  protected readonly formulaMap = (() => {
    return {
      "jean-skill": {
        label: { zh: "E伤害", en: "E" },
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
      "jean-burst": {
        label: { zh: "Q爆发+出入领域", en: "Q Burst + Field DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E×2 + Q (Anemo support, 6s E CD)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "jean-skill", count: 1 },
      { id: "jean-burst", count: 1 },
    ];
  }
}

@RegisterCharacter("venti")
class Venti extends CharacterBase {
  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // C2: E decreases Anemo RES and Physical RES each by 12%;
    // launched opponents take an additional 12% of each while airborne.
    // Assumed: 12% base + 12% airborne = 24% total for both Anemo and Physical.
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "team", filter: { elements: ["Anemo", "Physical"] } },
          [{ key: "resReduction%", value: 0.24 }]
        )
      );
      // C2: Wherever a Breeze Blows — press E deals 300% of original DMG
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["Q"]),
          { receiver: "selfOnField", filter: { abilities: ["skill"] } },
          [{ key: "baseDmg%", value: 2.0 }]
        )
      );
    }
    // C4: After E/Q → Venti and active party members gain 25% Anemo DMG
    // "温迪与队伍中自己的当前场上其他角色" → self (Venti's off-field Q ticks benefit) + otherOnField (teammates)
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E", "Q"]), { receiver: "self" }, [
          { key: "anemo%", value: 0.25 },
        ]),
        new StatBuff(
          cbs(this, "C4", ["E", "Q"]),
          { receiver: "otherOnField" },
          [{ key: "anemo%", value: 0.25 }]
        )
      );
    }
    // C6: Q targets take -20% Anemo RES
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "team", filter: { elements: ["Anemo"] } },
          [{ key: "resReduction%", value: 0.2 }]
        )
      );
      // C6: Absorbed element also gets -20% RES (S10 pattern)
      const c6AbsorbElements = ["Pyro", "Hydro", "Cryo", "Electro"] as const;
      const c6TeamEls = new Set(Object.values(this.teamMeta.elements));
      for (const el of c6AbsorbElements) {
        if (!c6TeamEls.has(el)) continue;
        buffs.push(
          new StatBuff(
            cbs(this, "C6", ["Q"]),
            { receiver: "team", filter: { elements: [el] } },
            [{ key: "resReduction%", value: 0.2 }]
          )
        );
      }
      // C6: Venti gains +100% CRIT DMG against affected opponents
      buffs.push(
        new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "self" }, [
          { key: "cd", value: 1.0 },
        ])
      );
    }

    // P4 (Hexerei): While Stormeye active, after on-field character triggers Swirl,
    // that character's DMG +50% for 4s; Venti's Q deals 135% original DMG (baseDmg% +0.35).
    // "该角色造成的伤害提升50%" → universal dmg% buff, not element-specific
    if (
      this.teamMeta.countByFaction("Hexerei") >= 2 &&
      this.teamMeta.hasReaction("swirl")
    ) {
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["Q", "swirl"]),
          { receiver: "teamOnField" },
          [{ key: "dmg%", value: 0.5 }]
        )
      );
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["Q", "swirl"]),
          { receiver: "self", filter: { abilities: ["burst"] } },
          [{ key: "baseDmg%", value: 0.35 }]
        )
      );
    }

    return buffs;
  })();

  // Q DoT: param1, 20 ticks
  // E Press: param1
  protected readonly formulaMap = (() => {
    // NA per-hit multipliers (A param1–param6), each × windsunder scaling (A param12)
    // Must NOT sum different multipliers into one part (S3)
    // N1: param1×2, N2: param2, N3: param3, N4: param4×2, N5: param5, N6: param6
    const ws = this.param("A", 12); // windsunder multiplier
    const n1 = this.param("A", 1);
    const n2 = this.param("A", 2);
    const n3 = this.param("A", 3);
    const n4 = this.param("A", 4);
    const n5 = this.param("A", 5);
    const n6 = this.param("A", 6);
    const naTag = {
      element: "Anemo" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    return {
      "venti-windsunder": {
        label: { zh: "Q 普攻飓风箭", en: "Q Windsunder Arrow" },
        parts: [
          { formula: new DirectFormula(n1 * ws, naTag), hits: 2 }, // N1
          { formula: new DirectFormula(n2 * ws, naTag) }, // N2
          { formula: new DirectFormula(n3 * ws, naTag) }, // N3
          { formula: new DirectFormula(n4 * ws, naTag), hits: 2 }, // N4
          { formula: new DirectFormula(n5 * ws, naTag) }, // N5
          { formula: new DirectFormula(n6 * ws, naTag) }, // N6
          // C1: 2 tracking arrows per Windsunder hit at 20% original DMG each
          ...(this.constellation >= 1
            ? [
                {
                  formula: new DirectFormula(n1 * ws * 0.2, naTag),
                  hits: 2 * 2,
                }, // N1 C1
                {
                  formula: new DirectFormula(n2 * ws * 0.2, naTag),
                  hits: 2,
                }, // N2 C1
                {
                  formula: new DirectFormula(n3 * ws * 0.2, naTag),
                  hits: 2,
                }, // N3 C1
                {
                  formula: new DirectFormula(n4 * ws * 0.2, naTag),
                  hits: 2 * 2,
                }, // N4 C1
                {
                  formula: new DirectFormula(n5 * ws * 0.2, naTag),
                  hits: 2,
                }, // N5 C1
                { formula: new DirectFormula(n6 * ws * 0.2, naTag), hits: 2 }, // N6 C1
              ]
            : []),
        ],
      },
      "venti-burst-total": {
        label: {
          zh: "Q×20",
          en: "Q×20",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Anemo",
              ability: "burst",
              reaction: "none",
            }),
            hits: 20,
            offField: true,
          },
        ],
      },
      // E Press DMG (param1) — C2 "Wherever a Breeze Blows" baseDmg% +2.0 applied via buff
      "venti-skill": {
        label: {
          zh: "E点按",
          en: "E Press",
        },
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
      // E Hold DMG (param3)
      "venti-skill-hold": {
        label: {
          zh: "E长按",
          en: "E Hold",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 3), {
              element: "Anemo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: Q (burst ticks baked in) + 1 Windsunder NA string + C2 E
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "venti-windsunder", count: 1 },
      { id: "venti-burst-total", count: 1 },
      { id: "venti-skill", count: 1 },
    ];
  }
}

@RegisterCharacter("klee")
class Klee extends CharacterBase {
  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P1: Explosive Spark — next Charged ATK after E/Normal proc costs no stamina and deals +50% DMG (assume active)
      new StatBuff(
        cbs(this, "P1", ["E", "normal"]),
        { receiver: "selfOnField", filter: { abilities: ["charge"] } },
        [{ key: "dmg%", value: 0.5 }]
      ),
      // C1: After Chained Reactions proc, Klee's ATK +60% for 12s (assume active)
      ...(this.constellation >= 1
        ? [
            new StatBuff(cbs(this, "C1", []), { receiver: "selfOnField" }, [
              { key: "atk%", value: 0.6 },
            ]),
          ]
        : []),
      // C2: Enemies hit by mines: -23% DEF for 10s
      ...(this.constellation >= 2
        ? [
            new StatBuff(cbs(this, "C2", ["E"]), { receiver: "team" }, [
              { key: "defReduction%", value: 0.23 },
            ]),
          ]
        : []),
      // C6: Q active → other party members +10% Pyro DMG, Klee +50% Pyro DMG
      // ZH: "队伍中所有其他角色获得10%火元素伤害加成" → excludes Klee → "other"
      ...(this.constellation >= 6
        ? [
            new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "other" }, [
              { key: "pyro%", value: 0.1 },
            ]),
            new StatBuff(cbs(this, "C6", ["Q"]), { receiver: "selfOnField" }, [
              { key: "pyro%", value: 0.5 },
            ]),
          ]
        : []),
    ];
    if (isHexerei) {
      // P4 (Hexerei): Boom-Boom Strike with 3 Boom Badges → deals 150% original DMG
      // Assumed: max 3 stacks maintained (1 from NA, 1 from E, 1 from Q)
      // 150% original = baseDmg% +0.5 (i.e., 1 + 0.5 = 1.5× original)
      buffs.push(
        new StatBuff(
          cbs(this, "P4", ["normal", "E", "Q"]),
          { receiver: "selfOnField", filter: { abilities: ["charge"] } },
          [{ key: "baseDmg%", value: 0.5 }]
        )
      );
    }
    return buffs;
  })();

  // Charged ATK: A param4 (talent-level-dependent)
  protected readonly formulaMap = (() => {
    return {
      "klee-skill": {
        label: { zh: "E弹跳+诡雷", en: "E Bounce + Mine" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 3,
          },
          {
            formula: new DirectFormula(this.param("E", 4), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 8,
          },
        ],
      },
      "klee-charged": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 4), {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      // Q: Sparks 'n' Splash — continuous Pyro DMG (Q param1)
      "klee-burst": {
        label: { zh: "Q轰轰火花", en: "Q Sparks" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      // C1: Chained Reactions — proc dealing 120% of Q DMG (burst-typed)
      "klee-c1-proc": {
        label: { zh: "火花", en: "Spark" },
        minC: 1,
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
            bespokeBuff: new StatBuff(
              cbs(this, "C1", []),
              { receiver: "selfOnField" },
              [{ key: "baseDmg%", value: 0.2 }]
            ),
          },
        ],
      },
      // C4: Sparkly Explosion — 555% ATK Pyro burst explosion when leaving field during Q
      "klee-c4-explosion": {
        label: { zh: "爆炸", en: "Explosion" },
        minC: 4,
        parts: [
          {
            formula: new DirectFormula(5.55, {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: ~6 Charged Attacks per rotation (N1C or N2C combos during Q window)
  protected override get comboDescriptor(): ComboDescriptor {
    return [{ id: "klee-charged", count: 6 }];
  }
}

const eulaOption = {
  label: { zh: "敌人血量（4命）", en: "Enemy HP (C4)" },
  choices: [
    {
      value: "below50",
      label: { zh: "HP<50%", en: "HP<50%" },
    },
    {
      value: "above50",
      label: { zh: "HP≥50%", en: "HP≥50%" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("eula", eulaOption)
class Eula extends CharacterBase {
  private readonly hp = resolveOption(eulaOption, this.option);

  readonly buffs = [
    // E (Hold, 2 stacks): Physical RES reduction (param4), Cryo RES reduction (param5)
    new StatBuff(
      cbs(this, "E", ["E"]),
      {
        receiver: "team",
        filter: { elements: ["Physical" as const] },
      },
      [{ key: "resReduction%", value: this.param("E", 4) }]
    ),
    new StatBuff(
      cbs(this, "E", ["E"]),
      {
        receiver: "team",
        filter: { elements: ["Cryo"] },
      },
      [{ key: "resReduction%", value: this.param("E", 5) }]
    ),
    // C1: After consuming Grimheart, Physical DMG +30%
    ...(this.constellation >= 1
      ? [
          new StatBuff(cbs(this, "C1", ["E"]), { receiver: "selfOnField" }, [
            { key: "phys%", value: 0.3 },
          ]),
        ]
      : []),
    // C4: Lightfall DMG +25% vs enemies HP < 50%
    ...(this.constellation >= 4 && this.hp === "below50"
      ? [
          new StatBuff(
            cbs(this, "C4", ["Q", "enemy-low-hp"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "dmg%", value: 0.25 }]
          ),
        ]
      : []),
  ];

  // Rotation: E tap + E hold + Q lightfall (physical carry)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "eula-skill-tap", count: 1 },
      { id: "eula-skill-hold", count: 1 },
      { id: "eula-burst-lightfall", count: 1 },
    ];
  }

  // E Tap: E param1; E Hold: E param2; Icewhirl Brand: E param3 × 2
  // Q initial Cryo hit: Q param1
  // Q Lightfall Sword — base (Q param2) + per-stack (Q param3) DMG
  // Typical stacks: C0-C5 ~13, C6 ~20
  // P1 Shattered Lightfall: 50% of Lightfall base DMG (on hold E consuming 2 Grimheart)
  protected readonly formulaMap = (() => {
    const qInitialMult = this.param("Q", 1);
    const baseMult = this.param("Q", 2);
    const stackMult = this.param("Q", 3);
    const stacks = this.constellation >= 6 ? 20 : 13;
    const totalMult = baseMult + stackMult * stacks;
    const maxMult = baseMult + stackMult * 30;
    const cryoSkill = {
      element: "Cryo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const physBurst = {
      element: "Physical" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "eula-skill-tap": {
        label: { zh: "E短按", en: "E Tap" },
        parts: [{ formula: new DirectFormula(this.param("E", 1), cryoSkill) }],
      },
      "eula-skill-hold": {
        label: {
          zh: "E长按+P1碎裂",
          en: "E Hold + P1 Shattered",
        },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), cryoSkill) },
          {
            formula: new DirectFormula(this.param("E", 3), cryoSkill),
            hits: 2,
          },
          { formula: new DirectFormula(baseMult * 0.5, physBurst) },
        ],
      },
      "eula-burst-lightfall": {
        label: {
          zh: `Q初击+光降${stacks}层`,
          en: `Q + Lightfall ×${stacks}`,
        },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
          { formula: new DirectFormula(totalMult, physBurst) },
        ],
      },
      "eula-burst-lightfall-max": {
        label: {
          zh: "Q初击+光降30层",
          en: "Q + Lightfall ×30",
        },
        parts: [
          {
            formula: new DirectFormula(qInitialMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
          { formula: new DirectFormula(maxMult, physBurst) },
        ],
      },
    };
  })();
}

@RegisterCharacter("varka")
class Varka extends CharacterBase {
  /** Priority element from team: Pyro > Hydro > Electro > Cryo */
  private readonly priorityElement: Element | null = (() => {
    const teamEls = Object.values(this.teamMeta.elements);
    const priority: Element[] = ["Pyro", "Hydro", "Electro", "Cryo"];
    for (const el of priority) {
      if (teamEls.includes(el)) return el;
    }
    return null;
  })();

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [];

    // C1: Lyrical Libation — first Four Winds or Azure Devour deals 200% original DMG
    // Modeled via bespokeBuff on dedicated C1 formula entries (not a global buff)

    // P1: Dawn Wind's March — per 1000 ATK, +10% Anemo DMG + priority element DMG, cap 25%
    // Only activates when PHEC characters are in the team (i.e., priorityElement exists)
    const pe = this.priorityElement;
    if (pe) {
      buffs.push(
        new ScalingBuff(
          cbs(this, "P1", []),
          {
            receiver: "self",
            filter: { elements: (["Anemo", pe] as Element[]).sort() },
          },
          [],
          "atk",
          "dmg%",
          0.0001,
          0.25
        )
      );
      // P1 pair bonus: baseDmg% for Sturm und Drang attacks (NA/CA/Skill)
      // >=2 Anemo OR >=2 same PHEC → 140% (baseDmg% +0.4)
      // >=2 Anemo AND >=2 same PHEC → 220% (baseDmg% +1.2)
      const hasAnemo2 = this.teamMeta.countByElement("Anemo") >= 2;
      const hasPhec2 = (["Pyro", "Hydro", "Electro", "Cryo"] as const).some(
        (e) => this.teamMeta.countByElement(e) >= 2
      );
      const pairBonus =
        hasAnemo2 && hasPhec2 ? 1.2 : hasAnemo2 || hasPhec2 ? 0.4 : 0;
      if (pairBonus > 0) {
        buffs.push(
          new StatBuff(
            cbs(this, "P1", []),
            {
              receiver: "selfOnField",
              filter: { abilities: ["normal", "charge", "skill"] },
            },
            [{ key: "baseDmg%", value: pairBonus }]
          )
        );
      }
    }
    // P2: Wind's Vanguard — Azure Fang's Oath stacks, +7.5% DMG per stack, max 4
    // Assume max stacks in sustained Swirl rotation (Varka is Anemo DPS)
    if (this.teamMeta.hasReaction("swirl")) {
      buffs.push(
        new StatBuff(
          cbs(this, "P2", ["swirl"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "skill"] },
          },
          [{ key: "dmg%", value: 0.075 * 4 }]
        )
      );
    }
    // C4: Swirl triggers 20% Anemo DMG bonus + corresponding element DMG bonus for all nearby party members
    // Swirl requires Anemo + one of {Pyro, Hydro, Electro, Cryo}; Varka is Anemo, so just needs a teammate
    if (this.constellation >= 4 && this.teamMeta.hasReaction("swirl")) {
      const c4Elements: Element[] = ["Anemo"];
      const teamEls = Object.values(this.teamMeta.elements);
      for (const el of ["Pyro", "Hydro", "Electro", "Cryo"] as const) {
        if (teamEls.includes(el)) c4Elements.push(el);
      }
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["swirl"]),
          { receiver: "team", filter: { elements: c4Elements.sort() } },
          [{ key: "dmg%", value: 0.2 }]
        )
      );
    }
    // C6: Azure Fang's Oath stacks increase CRIT DMG by 20% per stack, max 4 = 80%
    if (this.constellation >= 6 && this.teamMeta.hasReaction("swirl")) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["swirl"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal", "charge", "skill"] },
          },
          [{ key: "cd", value: 0.2 * 4 }]
        )
      );
    }
    return buffs;
  })();

  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "varka-e", count: 1 },
      { id: "varka-normal", count: 2 },
      { id: "varka-c1-special-e", count: 1 },
      { id: "varka-special-e", count: 2 },
      { id: "varka-special-ca", count: 0, bonus: [{ minC: 6, delta: 3 }] },
      { id: "varka-c1-special-ca", count: 0 },
      { id: "varka-burst", count: 0 },
    ];
  }

  protected readonly formulaMap = (() => {
    // Right hand uses the team's priority element.
    // When no PHEC teammate is present, right hand stays Anemo (no infusion).
    const el = this.priorityElement ?? ("Anemo" as Element);
    const rightEl = el;

    const eDmg = this.param("E", 1);

    // Each stage has two values: right hand (priority element) + left hand (Anemo)
    const sudN1Right = this.param("E", 3);
    const sudN2Right = this.param("E", 5);
    const sudN2Left = this.param("E", 4);
    const sudN3Right = this.param("E", 7);
    const sudN3Left = this.param("E", 6);
    const sudN4Right = this.param("E", 8);
    const sudN4Left = this.param("E", 9);
    const sudN5Right = this.param("E", 10);
    const sudN5Left = this.param("E", 11);

    const fwRight = this.param("E", 14);
    const fwLeft = this.param("E", 15);

    const azRight = this.param("E", 16);
    const azLeft = this.param("E", 17);

    const c2Mult = 8.0;

    const normalTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "normal" as const,
      reaction: "none" as const,
    });
    const skillTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "skill" as const,
      reaction: "none" as const,
    });
    const chargeTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "charge" as const,
      reaction: "none" as const,
    });
    const burstTag = (element: Element | "Anemo") => ({
      element: element as Element,
      ability: "burst" as const,
      reaction: "none" as const,
    });

    // C1 bespokeBuff: +100% baseDmg% (200% original DMG, consumed on first special E or CA)
    const c1Buff =
      this.constellation >= 1
        ? new StatBuff(
            cbs(this, "C1", ["E"]),
            {
              receiver: "selfOnField",
              filter: { abilities: ["skill", "charge"] },
            },
            [{ key: "baseDmg%", value: 1.0 }]
          )
        : null;

    const formulas: Record<string, FormulaEntry> = {};

    formulas["varka-e"] = {
      label: { zh: "E初始", en: "E Initial" },
      parts: [{ formula: new DirectFormula(eDmg, skillTag("Anemo")) }],
    };

    const naParts: { formula: DirectFormula; hits?: number }[] = [];
    const rTag = normalTag(rightEl);
    const aTag = normalTag("Anemo");

    // N1: single hit (right hand only)
    naParts.push({ formula: new DirectFormula(sudN1Right, rTag) });
    // N2–N5: right hand + left hand
    naParts.push({ formula: new DirectFormula(sudN2Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN2Left, aTag) });
    naParts.push({ formula: new DirectFormula(sudN3Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN3Left, aTag) });
    naParts.push({ formula: new DirectFormula(sudN4Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN4Left, aTag) });
    naParts.push({ formula: new DirectFormula(sudN5Right, rTag) });
    naParts.push({ formula: new DirectFormula(sudN5Left, aTag) });

    formulas["varka-normal"] = {
      label: { zh: "E后普攻5段", en: "E NA ×5" },
      parts: naParts,
    };

    // ── 2. Special E: Four Winds' Ascension (only when PHEC teammate present) ──
    if (this.priorityElement) {
      const fwParts: { formula: DirectFormula; hits?: number }[] = [
        { formula: new DirectFormula(fwRight, skillTag(el)) },
        { formula: new DirectFormula(fwLeft, skillTag("Anemo")) },
      ];
      if (this.constellation >= 2) {
        fwParts.push({ formula: new DirectFormula(c2Mult, skillTag("Anemo")) });
      }
      formulas["varka-special-e"] = {
        label: { zh: "特殊E", en: "Special E" },
        parts: fwParts,
      };

      // C1 Special E: first use deals 200% original DMG
      formulas["varka-c1-special-e"] = {
        label: { zh: "特殊E", en: "Special E" },
        minC: 1,
        parts: fwParts.map((p) => ({
          ...p,
          bespokeBuff: c1Buff ?? undefined,
        })),
      };

      // "特殊重击" — classified as charge per S4 rule
      const azParts: { formula: DirectFormula; hits?: number }[] = [
        { formula: new DirectFormula(azRight, chargeTag(el)), hits: 2 },
        { formula: new DirectFormula(azLeft, chargeTag("Anemo")), hits: 2 },
      ];
      if (this.constellation >= 2) {
        azParts.push({
          formula: new DirectFormula(c2Mult, chargeTag("Anemo")),
        });
      }
      formulas["varka-special-ca"] = {
        label: { zh: "E后特殊重击", en: "E Special CA" },
        parts: azParts,
      };

      // C1 Special CA: first use deals 200% original DMG
      formulas["varka-c1-special-ca"] = {
        label: { zh: "特殊重击", en: "Special CA" },
        minC: 1,
        parts: azParts.map((p) => ({
          ...p,
          bespokeBuff: c1Buff ?? undefined,
        })),
      };
    }

    formulas["varka-burst"] = {
      label: { zh: "Q", en: "Q" },
      parts: [
        { formula: new DirectFormula(this.param("Q", 1), burstTag(el)) },
        { formula: new DirectFormula(this.param("Q", 2), burstTag("Anemo")) },
      ],
    };

    return formulas;
  })();
}
