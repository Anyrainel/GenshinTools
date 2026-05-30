import { DirectFormula, LunarDirectFormula } from "../core/damageFormula";
import { CharacterBase } from "../core/implModel";
import { RegisterCharacter, resolveOption } from "../core/registry";
import { DynamicCapScalingBuff, ScalingBuff, StatBuff } from "../core/statBuff";
import type { ComboTemplate, FormulaEntry, OptionDef } from "../types";
import { cbs } from "./helpers";

const zibaiOption = {
  label: { zh: "时隙浮光消耗", en: "Float-Light Points" },
  choices: [
    {
      value: "100",
      label: { zh: "100 点（6命满点）", en: "100 pts (C6 Full)" },
    },
    { value: "70", label: { zh: "70 点", en: "70 pts" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("zibai", zibaiOption)
class Zibai extends CharacterBase {
  private readonly floatLightPts = resolveOption(zibaiOption, this.option);
  readonly buffs = (() => {
    const geoCount = Math.max(this.teamMeta.countByElement("Geo") - 1, 0);
    const hydroCount = this.teamMeta.countByElement("Hydro");

    const buffs: StatBuff[] = [
      // P3: Per 100 DEF → +0.7% Lunar-Crystallize Base DMG, cap 14%
      // "月结晶反应的基础伤害" → reactionBaseDmg% (separate zone from baseDmg%/倍率乘区)
      new ScalingBuff(
        cbs(this, "P3", ["passive"]),
        { receiver: "team", filter: { reactions: ["lunarCrystallize"] } },
        [],
        "def",
        "reactionBaseDmg%",
        0.00007,
        0.14
      ),
      // P2: Other Geo → DEF +15% each; Other Hydro → EM +60 each
      new StatBuff(cbs(this, "P2", ["A4"]), { receiver: "self" }, [
        { key: "def%", value: geoCount * 0.15 },
        { key: "em", value: hydroCount * 60 },
      ]),
      // P1: Steed 2nd hit baseDmg +60% DEF (via ScalingBuff, not baked into talent mult)
      // Must not bake into LunarDirectFormula talent mult as DirectCoeff would scale it
      new ScalingBuff(
        cbs(this, "P1", ["E"]),
        {
          receiver: "selfOnField",
          filter: { abilities: ["skill"], reactions: ["lunarCrystallize"] },
        },
        [],
        "def",
        "baseDmg",
        0.6
      ),
    ];

    if (this.constellation >= 2) {
      // C2: Team Lunar-Crystallize Reaction DMG +30%
      buffs.push(
        new StatBuff(
          cbs(this, "C2", ["E"]),
          { receiver: "team", filter: { reactions: ["lunarCrystallize"] } },
          [{ key: "reactionDmg%", value: 0.3 }]
        )
      );
      // C2 Moonsign Ascendant Gleam: Steed 2nd hit baseDmg +550% DEF
      // "月兆·满辉：突破天赋月下素娥降仙的效果获得提升" — requires Ascendant Gleam
      // Must not bake into LunarDirectFormula talent mult as DirectCoeff would scale it
      if (this.teamMeta.countByFaction("Moonsign") >= 2) {
        buffs.push(
          new ScalingBuff(
            cbs(this, "C2", ["E"]),
            {
              receiver: "selfOnField",
              filter: { abilities: ["skill"], reactions: ["lunarCrystallize"] },
            },
            [],
            "def",
            "baseDmg",
            5.5
          )
        );
      }
    }

    if (this.constellation >= 4) {
      // C4 Scattermoon Splendor: N4 additional attack deals 250% of original Lunar-Crystallize DMG
      // "造成相当于原本250%的月结晶反应伤害" → baseDmg% +1.5 (i.e. 1+1.5=2.5×)
      // Scoped to normal+lunarCrystallize so it only hits the N4 Gleam part, not regular N1-N4 hits
      buffs.push(
        new StatBuff(
          cbs(this, "C4", ["E"]),
          {
            receiver: "selfOnField",
            filter: { abilities: ["normal"], reactions: ["lunarCrystallize"] },
          },
          [{ key: "baseDmg%", value: 1.5 }]
        )
      );
    }

    if (this.constellation >= 6 && this.floatLightPts === "100") {
      // C6: Spirit Steed and Lunar-Crystallize DMG elevated by 48% (30 excess points × 1.6%)
      // Assume the 3s buff covers all lunar crystallize hits.
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          {
            receiver: "selfOnField",
            filter: { reactions: ["lunarCrystallize"] },
          },
          [{ key: "elevated%", value: 0.48 }]
        )
      );
    }
    return buffs;
  })();

  protected readonly formulaMap = (() => {
    const steed1 = this.param("E", 1);
    // Steed 2nd: "视为月结晶反应伤害" → LunarDirectFormula with raw game%
    // P1 (+60% DEF) and C2 (+550% DEF) are ScalingBuffs above, not baked in here
    // Lv10: 253.7% DEF, Lv13: 299.6% DEF — directCoeff (×1.6) applied internally
    const steed2Talent = this.param("E", 2);

    // Moonsign: Ascendant Gleam (满辉) requires 2+ Moonsign faction members
    const hasAscendantGleam = this.teamMeta.countByFaction("Moonsign") >= 2;

    return {
      "zibai-e-combo": {
        label: {
          zh: "E普攻4段",
          en: "E NA x4",
        },
        // Each hit is a separate part so that baseDmg buffs apply correctly per hit.
        // N3 has 2 equal-multiplier hits → hits: 2 with per-hit talent value.
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 6),
              { element: "Geo", ability: "normal", reaction: "none" },
              "def"
            ),
          },
          {
            formula: new DirectFormula(
              this.param("E", 7),
              { element: "Geo", ability: "normal", reaction: "none" },
              "def"
            ),
          },
          {
            formula: new DirectFormula(
              this.param("E", 8),
              { element: "Geo", ability: "normal", reaction: "none" },
              "def"
            ),
            hits: 2,
          },
          {
            formula: new DirectFormula(
              this.param("E", 10),
              { element: "Geo", ability: "normal", reaction: "none" },
              "def"
            ),
          },
          ...(hasAscendantGleam
            ? [
                {
                  // N4 Gleam: "视为月结晶反应伤害" → LunarDirectFormula
                  // C4 Scattermoon Splendor (+150% baseDmg%) applied via StatBuff above
                  formula: new LunarDirectFormula(
                    this.param("E", 3),
                    {
                      element: "Geo",
                      ability: "normal",
                      reaction: "lunarCrystallize",
                    },
                    "def"
                  ),
                },
              ]
            : []),
        ],
      },
      "zibai-steed": {
        label: { zh: "E", en: "E" },
        parts: [
          {
            formula: new DirectFormula(
              steed1,
              { element: "Geo", ability: "skill", reaction: "none" },
              "def"
            ),
          },
          {
            // Steed 2nd is Lunar-Crystallize DMG → LunarDirectFormula
            formula: new LunarDirectFormula(
              steed2Talent,
              {
                element: "Geo",
                ability: "skill",
                reaction: "lunarCrystallize",
              },
              "def"
            ),
            // C1: first Steed's 2nd-hit LC reactionDmg% +220%
            ...(this.constellation >= 1
              ? {
                  bespokeBuffs: [
                    new StatBuff(
                      { ...cbs(this, "C1", ["E"]), maxStacks: 1 },
                      {
                        receiver: "selfOnField",
                        filter: { reactions: ["lunarCrystallize"] },
                      },
                      [{ key: "reactionDmg%", value: 2.2 }]
                    ),
                  ],
                }
              : {}),
          },
        ],
      },
      "zibai-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Geo", ability: "burst", reaction: "none" },
              "def"
            ),
          },
          {
            // Q 2nd is Lunar-Crystallize DMG → LunarDirectFormula
            formula: new LunarDirectFormula(
              this.param("Q", 2),
              {
                element: "Geo",
                ability: "burst",
                reaction: "lunarCrystallize",
              },
              "def"
            ),
          },
        ],
      },
    };
  })();

  // Rotation: E > 3×N4 combo > Steed casts > Q (Geo carry, 15s Lunar Phase Shift).
  // Steed costs 70 of a 100-max Phase Shift Radiance pool (10/s passive + 5/NA hit
  // + 35/nearby Lunar-Crystallize), so the cap is seldom reached: ~3 casts at C0,
  // and C1's immediate +100 Radiance plus the higher cap bring it to ~4. These are
  // best-estimate rotation counts, not frame-verified.
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "zibai-e-combo", count: 3 },
      { id: "zibai-steed", count: 3, bonus: [{ minC: 1, delta: 1 }] },
      { id: "zibai-burst", count: 1 },
    ];
  }
}

const xianyunOption = {
  label: { zh: "风翎层数", en: "Storm Pinion Stacks" },
  choices: [
    { value: "4", label: { zh: "4 层", en: "4 stacks" } },
    { value: "3", label: { zh: "3 层", en: "3 stacks" } },
    { value: "2", label: { zh: "2 层", en: "2 stacks" } },
    { value: "1", label: { zh: "1 层", en: "1 stack" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("xianyun", xianyunOption)
class Xianyun extends CharacterBase {
  private readonly stormPinionStacks = resolveOption(
    xianyunOption,
    this.option
  );

  readonly buffs = (() => {
    const crByStacks = { "1": 0.04, "2": 0.06, "3": 0.08, "4": 0.1 } as const;
    const buffs: StatBuff[] = [
      // P1: E hit → Team Plunge CR (per stack count: 1→4%/2→6%/3→8%/4→10%)
      new StatBuff(
        cbs(this, "P1", ["E"]),
        { receiver: "team", filter: { abilities: ["plunge"] } },
        [{ key: "cr", value: crByStacks[this.stormPinionStacks] }]
      ),
      // P2: Q Starwicker → Plunge Base DMG +200% ATK (max 9000)
      // C2: Enhances to 400% ATK (max 18000)
      // Q starts with 8 Adeptal Assistance stacks, consumed 1 per plunge
      new ScalingBuff(
        { ...cbs(this, "P2/C2", ["Q"]), maxStacks: 8 },
        { receiver: "teamOnField", filter: { abilities: ["plunge"] } },
        [],
        "atk",
        "baseDmg",
        this.constellation >= 2 ? 4.0 : 2.0,
        this.constellation >= 2 ? 18000 : 9000
      ),
    ];

    // C2: After E → Xianyun ATK +20%
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
          { key: "atk%", value: 0.2 },
        ])
      );
    }

    // C6: Driftcloud Wave (Plunge) CD +70%
    if (this.constellation >= 6) {
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["E"]),
          { receiver: "selfOnField", filter: { abilities: ["plunge"] } },
          [{ key: "cd", value: 0.7 }]
        )
      );
    }

    return buffs;
  })();

  // E Driftcloud Wave 3-Skyladder (Lv10): 607.7%
  // E Driftcloud Wave 3-Skyladder (Lv13 C5+): 717.4%
  protected readonly formulaMap = (() => {
    const burstTag = {
      element: "Anemo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "xianyun-skyladder": {
        label: { zh: "E步天梯", en: "E Skyladder" },
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
      "xianyun-driftcloud": {
        label: {
          zh: "E下落×3",
          en: "E Driftcloud ×3",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 4), {
              element: "Anemo",
              // Driftcloud Wave is considered Plunging Attack DMG
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      // Minimal 1-step E: Skyladder only (no Driftcloud), lowest multiplier, fastest cast
      "xianyun-driftcloud-1step": {
        label: { zh: "E下落×1", en: "E Driftcloud ×1" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Anemo",
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      "xianyun-q-initial": {
        label: { zh: "Q初始伤害", en: "Q Initial DMG" },
        parts: [{ formula: new DirectFormula(this.param("Q", 1), burstTag) }],
      },
      "xianyun-q-starwicker": {
        label: { zh: "Q竹星伤害", en: "Q Starwicker DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 2), burstTag),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: Q > E (3 Skyladders) > Driftcloud Wave (plunge support)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "xianyun-q-initial", count: 1 },
      { id: "xianyun-driftcloud", count: 1 },
    ];
  }
}

@RegisterCharacter("baizhu")
class Baizhu extends CharacterBase {
  readonly buffs = [
    // P1: Active HP ≥50% → Baizhu Dendro DMG +25% (assume active)
    new StatBuff(cbs(this, "P1", []), { receiver: "self" }, [
      { key: "dendro%", value: 0.25 },
    ]),
    // P2: Per 1000 HP (cap 50k), on-field characters gain:
    // Burning/Bloom/Hyperbloom/Burgeon +2%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "teamOnField",
        filter: {
          reactions: ["burning", "bloom", "hyperbloom", "burgeon"],
        },
      },
      [],
      "hp",
      "reactionDmg%",
      0.00002,
      1.0
    ),
    // Aggravate/Spread +0.8%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "teamOnField",
        filter: { reactions: ["aggravate", "spread"] },
      },
      [],
      "hp",
      "reactionDmg%",
      0.000008,
      0.4
    ),
    // Lunar-Bloom +0.7%
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      {
        receiver: "teamOnField",
        filter: { reactions: ["lunarBloom"] },
      },
      [],
      "hp",
      "reactionDmg%",
      0.000007,
      0.35
    ),
    // C4: After Q, team EM +80 for 15s
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
            { key: "em", value: 80 },
          ]),
        ]
      : []),
    // C6: Spiritvein DMG +8% Max HP
    new ScalingBuff(
      cbs(this, "C6", ["Q"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [],
      "hp",
      "baseDmg",
      this.constellation >= 6 ? 0.08 : 0
    ),
  ];

  protected readonly formulaMap = (() => {
    return {
      "baizhu-skill": {
        label: { zh: "E 游丝徵灵", en: "E Gossamer Sprite" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 3,
            offField: true,
          },
        ],
      },
      "baizhu-burst": {
        label: { zh: "Q 灵气脉", en: "Q Spiritvein" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 7), {
              element: "Dendro",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      // C2 Splice initiates 1 attack before returning (250% ATK Dendro, counted
      // as Skill DMG). The 3-hit count belongs to the regular E sprite, not Splice.
      "baizhu-c2-sprite": {
        label: { zh: "游丝徵灵·切", en: "Gossamer Splice" },
        minC: 2,
        parts: [
          {
            formula: new DirectFormula(2.5, {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E > Q (Dendro healer/support)
  // Q Spiritvein triggers on shield refresh/break; ~3 hits as conservative estimate.
  // C2: active character's hits unleash a Gossamer Sprite: Splice (~2 per rotation, 5s ICD).
  // C6: each Gossamer Sprite and each C2 Splice hit generates one extra Seamless
  // Shield, and each shield triggers one additional Spiritvein. With 1 E sprite +
  // 2 C2 splices, that adds 3 extra Spiritvein instances at C6.
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "baizhu-skill", count: 1 },
      { id: "baizhu-burst", count: 3, bonus: [{ minC: 6, delta: 3 }] },
      { id: "baizhu-c2-sprite", count: 0, bonus: [{ minC: 2, delta: 2 }] },
    ];
  }
}

const yelanOption = {
  label: { zh: "Q增伤", en: "Q DMG Bonus" },
  choices: [
    { value: "50", label: { zh: "50%（满层）", en: "50% (max)" } },
    { value: "40", label: { zh: "40%", en: "40%" } },
    { value: "30", label: { zh: "30%", en: "30%" } },
    { value: "25", label: { zh: "25%（均值）", en: "25% (avg)" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("yelan", yelanOption)
class Yelan extends CharacterBase {
  private readonly o = resolveOption(yelanOption, this.option, this.teamMeta);
  readonly buffs = (() => {
    const elements = new Set(Object.values(this.teamMeta.elements));
    const count = elements.size;
    const p1Bonus = count === 4 ? 0.3 : count * 0.06;

    // P2: on-field DMG +1%, ramping +3.5%/s, max 50%. Option is the actual DMG% value.
    const dmgBonus = Number(this.o) / 100;

    const buffs: StatBuff[] = [
      // P1: +6%/12%/18%/30% Max HP based on unique element count
      new StatBuff(cbs(this, "P1", ["A1"]), { receiver: "self" }, [
        { key: "hp%", value: p1Bonus },
      ]),
      // P2: Q ramps DMG% for on-field, scales with talent level and option tier
      new StatBuff(cbs(this, "P2", ["A4", "Q"]), { receiver: "teamOnField" }, [
        { key: "dmg%", value: dmgBonus },
      ]),
    ];

    if (this.constellation >= 4) {
      // C4: 10% team Max HP per marked enemy, max 40%. Assume 40% for optimization.
      buffs.push(
        new StatBuff(cbs(this, "C4", ["E"]), { receiver: "team" }, [
          { key: "hp%", value: 0.4 },
        ])
      );
    }

    return buffs;
  })();

  // E Skill DMG Lv10: 40.7% Max HP, Lv13 (C5+): 48.1% Max HP
  // Q Throw DMG Lv10: 8.77% Max HP, Lv13 (C3+): 10.35% Max HP
  // C6 Mastermind Barb DMG: 20.84% × 156% = 32.51% Max HP (×5)
  protected readonly formulaMap = (() => {
    const barbMult = this.param("A", 7);
    const c6BarbMult = barbMult * 1.56;

    const qThrowMult = this.param("Q", 2);

    const formulas: Record<string, FormulaEntry> = {
      "yelan-skill": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 1),
              { element: "Hydro", ability: "skill", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
      "yelan-burst-throw": {
        label: {
          zh: "Q单次×3",
          en: "Q Exquisite Throw ×3",
        },
        parts: [
          {
            formula: new DirectFormula(
              qThrowMult,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
            hits: 3,
            offField: true,
          },
        ],
      },
      "yelan-burst-throw-onfield": {
        label: {
          zh: "Q(前台)×3",
          en: "Q Throw (on-field) ×3",
        },
        parts: [
          {
            formula: new DirectFormula(
              qThrowMult,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
            hits: 3,
          },
        ],
      },
    };

    // C2: Extra water arrow fires once per 1.8s during Q (~8 procs over 15s), 14% Max HP each
    formulas["yelan-c2-arrow"] = {
      label: {
        zh: "额外水箭×8",
        en: "Extra Arrow (x8)",
      },
      minC: 2,
      parts: [
        {
          formula: new DirectFormula(
            0.14,
            { element: "Hydro", ability: "burst", reaction: "none" },
            "hp"
          ),
          hits: 8,
          offField: true,
        },
      ],
    };
    formulas["yelan-c2-arrow-onfield"] = {
      label: {
        zh: "水箭(前台)×8",
        en: "Arrow (on-field) ×8",
      },
      minC: 2,
      parts: [
        {
          formula: new DirectFormula(
            0.14,
            { element: "Hydro", ability: "burst", reaction: "none" },
            "hp"
          ),
          hits: 8,
        },
      ],
    };

    formulas["yelan-c6-barb"] = {
      label: {
        zh: "重击",
        en: "CA",
      },
      minC: 6,
      parts: [
        {
          formula: new DirectFormula(
            c6BarbMult,
            { element: "Hydro", ability: "charge", reaction: "none" }, // CA DMG
            "hp"
          ),
          hits: 5,
        },
      ],
    };

    return formulas;
  })();

  // Rotation: E > Q > ~15 throw procs (off-field Hydro sub-DPS, 1 proc/sec over 15s)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "yelan-skill", count: 1 },
      { id: "yelan-burst-throw", count: 15 },
    ];
  }
}

const xiaoOption = {
  label: { zh: "E层数", en: "E Stacks" },
  choices: [
    { value: "3", label: { zh: "3层", en: "3 stacks" } },
    { value: "2", label: { zh: "2层", en: "2 stacks" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("xiao", xiaoOption)
class Xiao extends CharacterBase {
  private readonly p2Stacks = Number(resolveOption(xiaoOption, this.option));

  readonly buffs = [
    // P1: During Q, all DMG +5%, +5% per 3s, max 25%
    // Average over 15s duration ≈ 15%
    new StatBuff(cbs(this, "P1", ["Q"]), { receiver: "selfOnField" }, [
      { key: "dmg%", value: 0.15 },
    ]),
    // P2: Using E increases E DMG by 15% per stack (max 3 stacks)
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["skill"] } },
      [{ key: "dmg%", value: 0.15 * this.p2Stacks }]
    ),
    // Q: Bane of All Evil — Normal/Charged/Plunge DMG Bonus
    // Lv10: 95.2%, Lv13 (C5+): 108.9%
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "plunge"] },
      },
      [{ key: "dmg%", value: this.param("Q", 1) }]
    ),
  ];

  // High Plunge DMG (Lv10): 404.0%
  // E Skill DMG (Lv10): 404.0% — param1
  protected readonly formulaMap = (() => {
    return {
      "xiao-plunge-high": {
        label: { zh: "下落(高空)", en: "Plunge (High)" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 13), {
              element: "Anemo", // Q converts PHY to Anemo
              ability: "plunge",
              reaction: "none",
            }),
          },
        ],
      },
      "xiao-skill": {
        label: { zh: "E风轮两立", en: "E Lemniscatic" },
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
    };
  })();

  // Rotation: EE > Q > 11×high plunge (Anemo carry, ~15s Q window)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "xiao-skill", count: 2 },
      { id: "xiao-plunge-high", count: 11 },
    ];
  }
}

const zhongliOption = {
  label: { zh: "C0：岩脊共鸣", en: "C0: Stele Resonance" },
  choices: [
    {
      value: "yes",
      label: { zh: "有附近的岩元素创造物", en: "Nearby Geo construct present" },
    },
    {
      value: "no",
      label: { zh: "无附近的岩元素创造物", en: "No nearby Geo construct" },
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("zhongli", zhongliOption)
class Zhongli extends CharacterBase {
  // At C1+, two steles can coexist and resonate with each other (always active)
  private readonly hasResonance =
    this.constellation >= 1 ||
    resolveOption(zhongliOption, this.option) === "yes";

  readonly buffs = [
    // E (Shield): Jade Shield — decreases all nearby enemies' Elemental RES
    // and Physical RES by 20% (universal shred, modeled as resReduction%)
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "team" }, [
      { key: "resReduction%", value: 0.2 },
    ]),
    // P2: Dominance of Earth — Normal/Charged/Plunge DMG +1.39% Max HP as baseDmg
    new ScalingBuff(
      cbs(this, "P2"),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "plunge"] },
      },
      [],
      "hp",
      "baseDmg",
      0.0139
    ),
  ];

  protected readonly formulaMap = (() => {
    // P2: Dominance of Earth — E-type (Hold/Stele/Resonance) extra HP term (1.9% Max HP)
    const eHpExtra = { key: "hp" as const, multiplier: 0.019 };

    const geoSkillTag = {
      element: "Geo" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };

    return {
      "zhongli-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          {
            // Press only creates the Stone Stele (no Hold AoE)
            formula: new DirectFormula(
              this.param("E", 1),
              geoSkillTag,
              "atk",
              eHpExtra
            ),
          },
        ],
      },
      "zhongli-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          {
            // Hold AoE Geo DMG
            formula: new DirectFormula(
              this.param("E", 4),
              geoSkillTag,
              "atk",
              eHpExtra
            ),
          },
          {
            // Stone Stele creation AoE Geo DMG
            formula: new DirectFormula(
              this.param("E", 1),
              geoSkillTag,
              "atk",
              eHpExtra
            ),
          },
        ],
      },
      "zhongli-resonance": {
        label: {
          zh: "E共鸣",
          en: "E Resonance",
        },
        when: this.hasResonance,
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 2),
              geoSkillTag,
              "atk",
              eHpExtra
            ),
            offField: true,
          },
        ],
      },
      "zhongli-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Geo", ability: "burst", reaction: "none" },
              "atk",
              { key: "hp" as const, multiplier: 0.33 }
            ),
          },
        ],
      },
    };
  })();

  // Rotation: hE > Q > ~10 resonance ticks (shield support, 20s rotation)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "zhongli-hold", count: 1 },
      { id: "zhongli-resonance", count: 10 },
      { id: "zhongli-burst", count: 1 },
    ];
  }
}

// 5-Star Character Implementations

const huTaoOption = {
  label: { zh: "生命值状态", en: "HP State" },
  choices: [
    { value: "low", label: { zh: "生命值 ≤ 50%", en: "HP ≤ 50%" } },
    { value: "high", label: { zh: "生命值 > 50%", en: "HP > 50%" } },
    {
      value: "1",
      label: { zh: "生命值为 1 (C6触发)", en: "HP = 1 (C6 Triggered)" },
      when: (tm) => (tm.constellations.hu_tao ?? 0) >= 6,
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("hu_tao", huTaoOption)
class HuTao extends CharacterBase {
  private readonly hpState = resolveOption(huTaoOption, this.option);

  readonly buffs = (() => {
    const isLowHP = this.hpState === "low" || this.hpState === "1";
    const isC6Trigger = this.hpState === "1" && this.constellation >= 6;

    const buffs: StatBuff[] = [
      // P1: After E ends, all party members except Hu Tao get CR +12%
      // "队伍中所有角色（不包括胡桃自己）" = all party members excluding self → "other"
      new StatBuff(cbs(this, "P1", ["E"]), { receiver: "other" }, [
        { key: "cr", value: 0.12 },
      ]),
      // E: Guide to Afterlife — HP → ATK conversion
      // Lv10: 6.26% HP, Lv13 (C3+): 7.15% HP
      // Cap: "不能超过胡桃基础攻击力的400%" → min(rate * hp, baseAtk * 4)
      new DynamicCapScalingBuff(
        cbs(this, "E", ["E"]),
        { receiver: "selfOnField" },
        [],
        "hp",
        "atk",
        this.param("E", 2),
        "baseAtk",
        4
      ),
    ];

    if (isLowHP) {
      // P2: Below 50% HP → +33% Pyro DMG
      buffs.push(
        new StatBuff(cbs(this, "P2", ["low-hp"]), { receiver: "selfOnField" }, [
          { key: "pyro%", value: 0.33 },
        ])
      );
    }

    if (isC6Trigger) {
      // C6: +100% CR, +200% all RES (RES omitted as it is purely defensive)
      buffs.push(
        new StatBuff(cbs(this, "C6", ["low-hp"]), { receiver: "selfOnField" }, [
          { key: "cr", value: 1.0 },
        ])
      );
    }

    return buffs;
  })();

  // Charged ATK (Normal ATK talent, no constellation boost): Lv10 242.6%
  // Blood Blossom (E Skill DMG): Lv10 115%, Lv13 (C3+) 136%; C2: +10% Max HP
  // Q (low HP): Lv10 617%, Lv13 (C5+) 706%
  // Q (high HP): Lv10 494%, Lv13 (C5+) 565%
  protected readonly formulaMap = (() => {
    const isLowHP = this.hpState === "low" || this.hpState === "1";

    // C2: Blood Blossom DMG += 10% Max HP at time of application
    const bbExtra =
      this.constellation >= 2
        ? { key: "hp" as const, multiplier: 0.1 }
        : undefined;

    return {
      "hutao-charged": {
        label: { zh: "E重击", en: "E CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 8), {
              element: "Pyro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "hutao-blood-blossom": {
        label: { zh: "E血梅香(单次)", en: "E Blood Blossom (x1)" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 3),
              { element: "Pyro", ability: "skill", reaction: "none" },
              "atk",
              bbExtra
            ),
            offField: true,
          },
        ],
      },
      // blood blossom is hard to predict timing, so omit the vape version
      "hutao-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", isLowHP ? 2 : 1), {
              element: "Pyro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E > 9×N1C > Q (Pyro vape carry, 9s E window)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "hutao-charged", count: 9 },
      { id: "hutao-blood-blossom", count: 2 },
      { id: "hutao-burst", count: 1 },
    ];
  }
}

const shenheOption = {
  label: { zh: "E技能类型", en: "E Skill Type" },
  choices: [
    {
      value: "both",
      label: { zh: "点按+长按", en: "Press+Hold" },
      when: (tm) => (tm.constellations.shenhe ?? 0) >= 1,
    },
    { value: "press", label: { zh: "点按", en: "Press" } },
    { value: "hold", label: { zh: "长按", en: "Hold" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("shenhe", shenheOption)
class Shenhe extends CharacterBase {
  private readonly eType = resolveOption(shenheOption, this.option);

  readonly buffs = [
    // E: Icy Quill — ATK-based flat DMG added to Cryo hits
    // Lv10: 82.2% ATK, Lv13 (C3+): 97% ATK
    // Quota: press 5 / hold 7 per character (stacks counted independently).
    // C1+ "both" mode: press+hold grant separate quills (5+7=12 total).
    // C6: ONLY Normal+Charged Cryo triggers stop consuming quota (unlimited);
    //     Plunge/Skill/Burst Cryo hits still consume the press/hold quota.
    ...Object.keys(this.teamMeta.elements).flatMap((charId) => {
      const scale = this.param("E", 3);
      const isC6 = this.constellation >= 6;

      // Pre-C6: all Cryo abilities share one quota pool.
      // C6: split into an unlimited Normal/Charged pool and a quota-limited
      //     Plunge/Skill/Burst pool.
      const abilityGroups = isC6
        ? ([
            {
              suffix: "unlimited",
              abilities: ["normal", "charge"],
              capped: false,
            },
            {
              suffix: "quota",
              abilities: ["plunge", "skill", "burst"],
              capped: true,
            },
          ] as const)
        : ([
            {
              suffix: "",
              abilities: ["normal", "charge", "plunge", "skill", "burst"],
              capped: true,
            },
          ] as const);

      const buildQuill = (
        abilities: readonly (
          | "normal"
          | "charge"
          | "plunge"
          | "skill"
          | "burst"
        )[],
        internalKey: string,
        maxStacks: number | undefined
      ) =>
        new ScalingBuff(
          {
            ...cbs(this, "E", ["E"]),
            ...(internalKey && { internalKey }),
            ...(maxStacks != null && { maxStacks }),
          },
          {
            receiver: "team" as const,
            charId,
            filter: { elements: ["Cryo" as const], abilities: [...abilities] },
          },
          [],
          "atk",
          "baseDmg",
          scale
        );

      return abilityGroups.flatMap((group) => {
        if (this.eType === "both") {
          // Separate press (5 stacks) and hold (7 stacks) quills.
          return [
            buildQuill(
              group.abilities,
              `press${group.suffix}`,
              group.capped ? 5 : undefined
            ),
            buildQuill(
              group.abilities,
              `hold${group.suffix}`,
              group.capped ? 7 : undefined
            ),
          ];
        }
        return [
          buildQuill(
            group.abilities,
            group.suffix,
            group.capped ? (this.eType === "press" ? 5 : 7) : undefined
          ),
        ];
      });
    }),
    // P1: Q field → on-field Cryo DMG +15% ("冰元素伤害加成提高15%")
    new StatBuff(
      cbs(this, "P1", ["Q"]),
      { receiver: "teamOnField", filter: { elements: ["Cryo"] } },
      [{ key: "cryo%", value: 0.15 }]
    ),
    // P2: Press E → team Skill/Burst DMG +15%; Hold E → team Normal/Charged/Plunge DMG +15%
    // C1+ "both" mode: both effects active (press+hold in same rotation)
    ...(this.eType === "both"
      ? [
          new StatBuff(
            cbs(this, "P2", ["E"]),
            {
              receiver: "team",
              filter: { abilities: ["skill", "burst"] },
            },
            [{ key: "dmg%", value: 0.15 }]
          ),
          new StatBuff(
            cbs(this, "P2", ["E"]),
            {
              receiver: "team",
              filter: { abilities: ["normal", "charge", "plunge"] },
            },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : [
          new StatBuff(
            cbs(this, "P2", ["E"]),
            {
              receiver: "team",
              filter: {
                abilities:
                  this.eType === "hold"
                    ? ["normal", "charge", "plunge"]
                    : ["skill", "burst"],
              },
            },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]),
    // Q: Enemies in field lose Cryo RES and Physical RES (talent-level-dependent: 6% at Lv1, 15% at Lv10)
    new StatBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { elements: ["Cryo", "Physical"] } },
      [{ key: "resReduction%", value: this.param("Q", 2) }]
    ),
    // C2: Q field → Cryo CD +15%
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["Q"]),
            { receiver: "teamOnField", filter: { elements: ["Cryo"] } },
            [{ key: "cd", value: 0.15 }]
          ),
        ]
      : []),
  ];

  // E Press: Lv10 251%, Lv13 (C3+) 296%
  protected readonly formulaMap = (() => {
    return {
      "shenhe-skill": {
        label: { zh: "E点按", en: "E Spring Spirit Press" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "shenhe-skill-hold": {
        label: { zh: "E长按", en: "E Hold" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "shenhe-q-initial": {
        label: { zh: "Q技能伤害", en: "Q Skill DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "shenhe-q-dot": {
        label: { zh: "Q持续伤害", en: "Q DoT" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 3), {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
    };
  })();

  // Rotation: E press > Q (Cryo buffer/support, minimal personal damage)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "shenhe-skill", count: 1 },
      { id: "shenhe-skill-hold", count: 0, bonus: [{ minC: 1, delta: 1 }] },
    ];
  }
}

const ganyuOption = {
  label: { zh: "C4增伤", en: "C4 DMG Bonus" },
  choices: [
    { value: "25", label: { zh: "25%", en: "25%" } },
    { value: "20", label: { zh: "20%", en: "20%" } },
    { value: "15", label: { zh: "15%", en: "15%" } },
    { value: "10", label: { zh: "10%", en: "10%" } },
    { value: "5", label: { zh: "5%", en: "5%" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("ganyu", ganyuOption)
class Ganyu extends CharacterBase {
  private readonly o = resolveOption(ganyuOption, this.option, this.teamMeta);
  readonly buffs = [
    // P1: After Frostflake Arrow, next Frostflake +20% CR for 5s
    new StatBuff(
      cbs(this, "P1", ["charge"]),
      { receiver: "selfOnField", filter: { abilities: ["charge"] } },
      [{ key: "cr", value: 0.2 }]
    ),
    // P2: Q field: +20% Cryo DMG to active members
    new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "teamOnField" }, [
      { key: "cryo%", value: 0.2 },
    ]),
    // C1: Cryo RES -15% on Frostflake hit for 6s (enemy debuff — benefits whole team)
    ...(this.constellation >= 1
      ? [
          new StatBuff(
            cbs(this, "C1", ["charge"]),
            { receiver: "team", filter: { elements: ["Cryo"] } },
            [{ key: "resReduction%", value: 0.15 }]
          ),
        ]
      : []),
    // C4: Opponents in Q field take increased DMG, ramps 5%→25%
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", ["Q"]), { receiver: "team" }, [
            { key: "dmg%", value: Number(this.o) / 100 },
          ]),
        ]
      : []),
  ];

  // Frostflake Arrow + Bloom (Normal ATK talent — no constellation level boost)
  // Arrow Lv10: 230%, Bloom Lv10: 392%, Total: 622%
  // Q Ice Shard (Q talent): Lv10 126%, Lv13 (C3+) 149%
  protected readonly formulaMap = (() => {
    const qShardMult = this.param("Q", 1);
    const cryoBurstTag = {
      element: "Cryo" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "ganyu-frostflake": {
        label: { zh: "重击+绽发", en: "CA + Bloom" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 9), {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("A", 10), {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "ganyu-skill": {
        label: { zh: "E技能伤害", en: "E Skill DMG" },
        parts: [
          {
            // Initial dash damage
            formula: new DirectFormula(this.param("E", 2), {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
          },
          {
            // Ice Lotus bloom on expiry (same multiplier, off-field)
            formula: new DirectFormula(this.param("E", 2), {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
            offField: true,
          },
        ],
      },
      "ganyu-q-shard": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(qShardMult, cryoBurstTag),
            offField: true,
          },
        ],
      },
      "ganyu-q-shard-onfield": {
        label: { zh: "Q(前台)", en: "Q (on-field)" },
        parts: [
          {
            formula: new DirectFormula(qShardMult, cryoBurstTag),
          },
        ],
      },
    };
  })();

  // Rotation: 6×CA + Q (~10 shards over 15s, Cryo carry melt/freeze)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "ganyu-frostflake", count: 6 },
      { id: "ganyu-q-shard", count: 10 },
    ];
  }
}

@RegisterCharacter("keqing")
class Keqing extends CharacterBase {
  readonly buffs = (() => {
    const buffs: StatBuff[] = [
      // P2: After Q, self CR +15%, ER +15%
      new StatBuff(cbs(this, "P2", ["Q"]), { receiver: "selfOnField" }, [
        { key: "cr", value: 0.15 },
        { key: "er", value: 0.15 },
      ]),
    ];

    const canC4ElectroReact =
      this.teamMeta.hasReaction("overloaded") ||
      this.teamMeta.hasReaction("electroCharged") ||
      this.teamMeta.hasReaction("lunarCharged") ||
      this.teamMeta.hasReaction("superconduct") ||
      this.teamMeta.hasReaction("swirl") ||
      this.teamMeta.hasReaction("crystallize") ||
      this.teamMeta.hasReaction("lunarCrystallize") ||
      this.teamMeta.hasReaction("quicken") ||
      this.teamMeta.hasReaction("aggravate") ||
      this.teamMeta.hasReaction("hyperbloom");

    if (canC4ElectroReact && this.constellation >= 4) {
      // C4: After Electro reaction, self ATK +25%
      buffs.push(
        new StatBuff(
          cbs(this, "C4", [
            "overloaded",
            "electroCharged",
            "lunarCharged",
            "superconduct",
            "swirl",
            "crystallize",
            "lunarCrystallize",
            "quicken",
            "aggravate",
            "hyperbloom",
          ]),
          { receiver: "selfOnField" },
          [{ key: "atk%", value: 0.25 }]
        )
      );
    }

    if (this.constellation >= 6) {
      // C6: 4 stacks × 6% = 24% Electro DMG
      buffs.push(
        new StatBuff(cbs(this, "C6", []), { receiver: "selfOnField" }, [
          { key: "electro%", value: 0.24 },
        ])
      );
    }

    return buffs;
  })();

  // Charged ATK: Lv10 152%+170% = 322% (no constellation boost)
  // Q: Lv10 initial 158% + 8×43.2% + final 340%, Lv13 (C3+) 187% + 8×51% + 401%
  protected readonly formulaMap = (() => {
    const electroSkillTag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const electroBurstTag = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    return {
      "keqing-stiletto": {
        label: { zh: "E雷楔", en: "E Stiletto" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), electroSkillTag) },
        ],
      },
      "keqing-skill-slash": {
        label: { zh: "E斩击", en: "E Slash (re-cast)" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), electroSkillTag) },
          // C1: 50% ATK Electro DMG at blink start and terminus (2 hits)
          ...(this.constellation >= 1
            ? [{ formula: new DirectFormula(0.5, electroSkillTag), hits: 2 }]
            : []),
        ],
      },
      "keqing-skill-thunderclap": {
        label: { zh: "E雷暴连斩", en: "E Thunderclap Slash" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 3), electroSkillTag),
            hits: 2,
          },
        ],
      },
      "keqing-charged": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new DirectFormula(this.param("A", 7), {
              element: "Electro",
              ability: "charge",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("A", 8), {
              element: "Electro",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "keqing-burst": {
        label: { zh: "Q 全10段", en: "Q 10 hits" },
        parts: [
          { formula: new DirectFormula(this.param("Q", 1), electroBurstTag) },
          {
            formula: new DirectFormula(this.param("Q", 2), electroBurstTag),
            hits: 8,
          },
          { formula: new DirectFormula(this.param("Q", 3), electroBurstTag) },
        ],
      },
    };
  })();

  // Rotation: E stiletto > E slash (re-cast) > Q > 5×N1C (Electro aggravate carry)
  protected override get comboDescriptor(): ComboTemplate {
    return [
      { id: "keqing-stiletto", count: 1 },
      { id: "keqing-skill-slash", count: 1 },
      { id: "keqing-charged", count: 5 },
      { id: "keqing-burst", count: 1 },
    ];
  }
}

@RegisterCharacter("qiqi")
class Qiqi extends CharacterBase {
  readonly buffs = [
    // C2: Normal/Charged ATK DMG +15% vs Cryo-affected enemies
    // Qiqi is Cryo so enemies will always be Cryo-affected; always active
    ...(this.constellation >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["normal", "charge"]),
            {
              receiver: "selfOnField",
              filter: { abilities: ["normal", "charge"] },
            },
            [{ key: "dmg%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  protected readonly formulaMap = (() => {
    // E Herald of Frost DMG: Lv10 64.8%, Lv13 (C5+ upgrades E): 76.5%
    // ~8 hits over 15s duration
    // C3 upgrades Q (Preserver of Fortune), C5 upgrades E (Herald of Frost)
    return {
      "qiqi-skill-hit": {
        label: { zh: "E初始+鬼差×9", en: "E Initial + Herald ×9" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 8), {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("E", 5), {
              element: "Cryo",
              ability: "skill",
              reaction: "none",
            }),
            hits: 9,
            offField: true,
          },
        ],
      },
      "qiqi-burst": {
        label: { zh: "Q伤害", en: "Q DMG" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 3), {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();

  // Rotation: E (healer, hits baked into E ×8)
  protected override get comboDescriptor(): ComboTemplate {
    return [{ id: "qiqi-skill-hit", count: 1 }];
  }
}
