import type { Element } from "@/data/types";
import { LUNAR_REACTIONS } from "../constants";
import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarDirectFormula,
  LunarFormula,
  TransformFormula,
} from "../damageFormulas";
import {
  CharacterBase,
  type FormulaEntry,
  type FormulaPart,
  RegisterCharacter,
  resolveOption,
} from "../damageModels";
import type { OptionDef } from "../damageModels";
import { cbs } from "../helpers";
import type { ComboDescriptor, ReactionType } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Nod-Krai Characters
// ═══════════════════════════════════════════════════════════════

const columbinaOption = {
  label: { zh: "主要月曜反应", en: "Dominant Reaction" },
  choices: [
    {
      value: "lunarBloom",
      label: { zh: "月绽放", en: "Lunar-Bloom" },
      when: (tm) => tm.hasReaction("lunarBloom"),
    },
    {
      value: "lunarCharged",
      label: { zh: "月感电", en: "Lunar-Charged" },
      when: (tm) => tm.hasReaction("lunarCharged"),
    },
    {
      value: "lunarCrystallize",
      label: { zh: "月结晶", en: "Lunar-Crystallize" },
      when: (tm) => tm.hasReaction("lunarCrystallize"),
    },
    {
      value: "none",
      label: { zh: "--", en: "--" },
      when: (tm) =>
        LUNAR_REACTIONS.every((r) => !tm.hasReaction(r as ReactionType)),
    },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("columbina", columbinaOption)
class Columbina extends CharacterBase {
  private readonly o = resolveOption(columbinaOption, this.option);

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P3: Moonsign Benediction — per 1000 Max HP, lunar reaction reactionBaseDmg% +0.2%, cap 7%
      new ScalingBuff(
        cbs(this, "P3", []),
        { receiver: "team", filter: { reactions: [...LUNAR_REACTIONS] } },
        [],
        "hp",
        "reactionBaseDmg%",
        0.000002,
        0.07
      ),
      // P1: Lunacy's Lure — on Gravity Interference, CR +5% × 3 = +15%
      // Columbina gains the buff regardless of on-field status (Gravity Interference can trigger off-field)
      new StatBuff(cbs(this, "P1", ["E"]), { receiver: "self" }, [
        { key: "cr", value: 0.15 },
      ]),
      // Q: Lunar Reaction DMG Bonus +40% (Lv10) / +49% (C5+)
      new StatBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "team", filter: { reactions: [...LUNAR_REACTIONS] } },
        [{ key: "reactionDmg%", value: this.param("Q", 2) }]
      ),
      // C1–C6 cumulative "elevated" bonus:
      // C1: 1.5%, C2: 7%, C3: 1.5%, C4: 1.5%, C5: 1.5%, C6: 7%
      ...(() => {
        let v = 0;
        const c = this.constellation;
        if (c >= 1) v += 0.015;
        if (c >= 2) v += 0.07;
        if (c >= 3) v += 0.015;
        if (c >= 4) v += 0.015;
        if (c >= 5) v += 0.015;
        if (c >= 6) v += 0.07;
        return v > 0
          ? [
              new StatBuff(
                cbs(this, "C1", []),
                {
                  receiver: "team",
                  filter: { reactions: [...LUNAR_REACTIONS] },
                },
                [{ key: "elevated%", value: v }]
              ),
            ]
          : [];
      })(),
    ];

    // C2: HP +40% for 8s on Gravity Interference (no Moonsign requirement)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
          { key: "hp%", value: 0.4 },
        ])
      );

      // C2 (Ascendant Gleam): On-field buff based on dominant Lunar reaction type
      // "月兆·满辉：皎辉效果持续期间..." — requires ≥2 Nod-Krai
      // Lunar-Charged → ATK +1% Max HP; Lunar-Bloom → EM +0.35% Max HP; Lunar-Crystallize → DEF +1% Max HP
      if (this.o !== "none" && this.teamMeta.countByFaction("Moonsign") >= 2) {
        const c2Map = {
          lunarCharged: { stat: "atk" as const, scale: 0.01 },
          lunarBloom: { stat: "em" as const, scale: 0.0035 },
          lunarCrystallize: { stat: "def" as const, scale: 0.01 },
        };
        const c2 = c2Map[this.o];
        buffs.push(
          new ScalingBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "teamOnField" },
            [],
            "hp",
            c2.stat,
            c2.scale
          )
        );
      }
    }

    // C4: HP%-based baseDmg on dominant Lunar reaction — once per 15s, modeled via
    // separate formula entry with bespokeBuff (self buff cannot use maxStacks)

    // C6: +80% CD for elements involved in the dominant Lunar reaction
    // "依据参与反应的元素类型，使队伍中的所有角色造成的对应元素类型伤害的暴击伤害提升80%"
    // All lunar reactions involve Hydro plus a second element
    if (this.constellation >= 6 && this.o !== "none") {
      const c6Elements = {
        lunarCharged: ["Electro" as const, "Hydro" as const],
        lunarBloom: ["Dendro" as const, "Hydro" as const],
        lunarCrystallize: ["Geo" as const, "Hydro" as const],
      }[this.o];
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "team", filter: { elements: c6Elements } },
          [{ key: "cd", value: 0.8 }]
        )
      );
    }

    return buffs;
  })();

  // Rotation: E > Q > swap; off-field enabler. Ripple ticks ~12 over 25s, ~2 Gravity Interferences, ~3 CAs if driving
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "columbina-skill-initial", count: 1 },
      { id: "columbina-burst", count: 1 },
      { id: "columbina-charge", count: 0 },
      {
        id: "columbina-skill-interference",
        count: 4,
        bonus: [
          { minC: 2, delta: 1 },
          { minC: 4, delta: -1 },
        ],
      },
      {
        id: "columbina-skill-interference-c4",
        count: 0,
        bonus: [{ minC: 4, delta: 1 }],
      },
      { id: "columbina-ripple", count: 12 },
    ];
  }

  protected readonly formulaMap = (() => {
    let eInterferenceMult = 0;
    let eInterferenceHits = 1;
    let eInterferenceElement: Element = "Electro";
    let eInterferenceReaction: ReactionType = "lunarCharged";

    if (this.o === "lunarCharged") {
      eInterferenceMult = this.param("E", 3);
      eInterferenceElement = "Electro";
      eInterferenceReaction = "lunarCharged";
    } else if (this.o === "lunarBloom") {
      eInterferenceMult = this.param("E", 4);
      eInterferenceHits = 5;
      eInterferenceElement = "Dendro";
      eInterferenceReaction = "lunarBloom";
    } else if (this.o === "lunarCrystallize") {
      eInterferenceMult = this.param("E", 5);
      eInterferenceElement = "Geo";
      eInterferenceReaction = "lunarCrystallize";
    }

    return {
      "columbina-skill-initial": {
        label: { zh: "E初始", en: "E Initial" },
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
      "columbina-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
      "columbina-charge": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new LunarDirectFormula(
              this.param("A", 6),
              { element: "Dendro", ability: "charge", reaction: "lunarBloom" },
              "hp"
            ),
            hits: 3,
          },
        ],
      },
      "columbina-skill-interference": {
        label: { zh: "E干涉", en: "E Interference" },
        parts: [
          {
            formula: new LunarDirectFormula(
              eInterferenceMult,
              {
                element: eInterferenceElement,
                ability: "skill",
                reaction: eInterferenceReaction,
              },
              "hp"
            ),
            hits: eInterferenceHits,
            offField: true,
          },
        ],
      },
      // C4: One interference per rotation receives HP%-based baseDmg bonus (once per 15s)
      "columbina-skill-interference-c4": {
        label: { zh: "E初次干涉", en: "E First Interference" },
        minC: 4,
        when: this.o !== "none",
        parts: [
          {
            formula: new LunarDirectFormula(
              eInterferenceMult,
              {
                element: eInterferenceElement,
                ability: "skill",
                reaction: eInterferenceReaction,
              },
              "hp"
            ),
            hits: eInterferenceHits,
            offField: true,
            bespokeBuff: new ScalingBuff(
              cbs(this, "C4", ["E"]),
              {
                receiver: "selfOnField",
                filter: {
                  abilities: ["skill"],
                  reactions: [eInterferenceReaction],
                },
              },
              [],
              "hp",
              "baseDmg",
              this.o !== "none"
                ? {
                    lunarCharged: 0.125,
                    lunarBloom: 0.025,
                    lunarCrystallize: 0.125,
                  }[this.o]
                : 0
            ),
          },
        ],
      },
      // Gravity Ripple continuous Hydro DMG: Lv10 16.8% HP, Lv13 (C3+) 19.9% HP per tick
      "columbina-ripple": {
        label: { zh: "E涟漪 (x1)", en: "E Ripple (×1)" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 2),
              { element: "Hydro", ability: "skill", reaction: "none" },
              "hp"
            ),
            offField: true,
          },
        ],
      },
    };
  })();
}

const neferOption = {
  label: { zh: "伪秘之帷层数", en: "Veil of Falsehood Stacks" },
  choices: [
    {
      value: "5",
      label: { zh: "5 层 (C2上限)", en: "5 stacks (C2 max)" },
      when: (tm) => (tm.constellations.nefer ?? 0) >= 2,
    },
    {
      value: "3",
      label: { zh: "3 层 (C0上限)", en: "3 stacks (C0 max)" },
    },
    { value: "1", label: { zh: "1 层", en: "1 stack" } },
    { value: "0", label: { zh: "0 层", en: "0 stacks" } },
  ] as const,
} satisfies OptionDef;

@RegisterCharacter("nefer", neferOption)
class Nefer extends CharacterBase {
  // Veil of Falsehood: only under Ascendant Gleam (≥2 Nod-Krai); cap 3 at C0-1, 5 at C2+
  private readonly veilStacks = (() => {
    if (this.teamMeta.countByFaction("Moonsign") < 2) return 0;
    const requested = Number.parseInt(resolveOption(neferOption, this.option));
    return Math.min(requested, this.constellation >= 2 ? 5 : 3);
  })();

  readonly buffs = [
    // P3 (combat passive): Per EM → +0.0175% Lunar-Bloom reactionBaseDmg%, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      [],
      "em",
      "reactionBaseDmg%",
      0.000175,
      0.14
    ),
    // P1: EM +100/200 when Veil stacks ≥3 (C0-1 cap=3, C2+ cap=5)
    new StatBuff(
      cbs(this, this.constellation >= 2 ? "P1/C2" : "P1", ["charge"]),
      { receiver: "self" },
      [
        {
          key: "em",
          value: (() => {
            // C2: 200 EM at 5 stacks, 100 EM at 3 stacks; C0-1: 100 EM at 3 stacks
            if (this.constellation >= 2 && this.veilStacks >= 5) return 200;
            if (this.veilStacks >= 3) return 100;
            return 0;
          })(),
        },
      ]
    ),
    // P1 (Ascendant Gleam): Veil stacks → baseDmg% per stack
    // 8% per stack; cap 3 at C0-1, cap 5 at C2+
    // Ascendant Gleam condition captured in veilStacks (returns 0 if <2 Nod-Krai)
    ...(this.veilStacks > 0
      ? [
          new StatBuff(
            cbs(this, this.constellation >= 2 ? "P1/C2" : "P1", ["charge"]),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [
              {
                key: "baseDmg%",
                value: this.veilStacks * 0.08,
              },
            ]
          ),
        ]
      : []),
    // C1: Phantasm shades LunarBloom BaseDmg += 60% EM
    // "该效果同样会受到「伪秘之帷」的加成" — pre-multiply by Veil baseDmg% since
    // flatBaseDmg sits outside the (1+baseDmg%) zone in LunarDirectFormula
    new ScalingBuff(
      cbs(this, "C1", ["charge"]),
      {
        receiver: "selfOnField",
        filter: { reactions: ["lunarBloom"], abilities: ["charge"] },
      },
      [],
      "em",
      "baseDmg",
      this.constellation >= 1 ? 0.6 * (1 + this.veilStacks * 0.08) : 0
    ),
    // Q Veil consumption: Burst DMG +40%/49% per Veil of Falsehood stack
    // "施放时，奈芙尔还会消耗所有的「伪秘之帷」，提升本次元素爆发造成的伤害"
    ...(this.veilStacks > 0
      ? [
          new StatBuff(
            cbs(this, this.constellation >= 2 ? "P1/C2" : "P1", ["Q"]),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [
              {
                key: "dmg%",
                value: this.veilStacks * this.param("Q", 5),
              },
            ]
          ),
        ]
      : []),
    // C4: Dendro RES -20% during Shadow Dance
    // "使附近敌人的草元素抗性降低20%" → element-filtered shred (Dendro only)
    ...(this.constellation >= 4
      ? [
          new StatBuff(
            cbs(this, "C4", ["E"]),
            { receiver: "team", filter: { elements: ["Dendro"] } },
            [{ key: "resReduction%", value: 0.2 }]
          ),
        ]
      : []),
    // C6 (Moonsign Ascendant Gleam): Nefer's Lunar-Bloom DMG elevated 15%
    // "月兆·满辉 奈芙尔造成的月绽放反应伤害擢升15%" — requires ≥2 Nod-Krai
    ...(this.constellation >= 6 && this.teamMeta.countByFaction("Moonsign") >= 2
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "self", filter: { reactions: ["lunarBloom"] } },
            [{ key: "elevated%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  // Phantasm Performance self (2 hits, different multipliers):
  //   Hit 1: Lv10 44.4% ATK + 88.7% EM, Lv13 (C3+) 52.4% ATK + 104.7% EM
  //   Hit 2: Lv10 57.7% ATK + 115.3% EM, Lv13 (C3+) 68.1% ATK + 136.1% EM
  // C6: Self Hit 2 → 85% EM LunarBloom; extra 120% EM LunarBloom at end
  // Phantasm shades (3 hits, LunarBloom):
  //   Hit 1+2: Lv10 172.8% EM ×2, Lv13 (C3+) 204.0% EM ×2
  //   Hit 3: Lv10 230.4% EM, Lv13 (C3+) 272.0% EM
  // Q total: Lv10 (404.4%+606.5%) ATK + (808.7%+1213.1%) EM = 1010.9% ATK + 2021.8% EM
  // Lv13 (C5+): 1193.4% ATK + 2386.8% EM

  // Rotation: E > 3[CA] > E > 3[CA] > E > 3[CA] > Q (on-field Lunar-Bloom carry, 9 CAs, 3 E casts per rotation)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "nefer-skill", count: 3 },
      { id: "nefer-phantasm", count: 9 },
      { id: "nefer-burst", count: 0 },
    ];
  }

  protected readonly formulaMap = (() => {
    const hasHydro = this.teamMeta.countByElement("Hydro") > 0;
    const isC6 = this.constellation >= 6;
    // Self hit parts depend on C6 (Hit 2 converts to LunarBloom)
    const selfParts: FormulaPart[] = isC6
      ? [
          {
            // Self Hit 1
            formula: new DirectFormula(
              this.param("E", 5),
              { element: "Dendro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("E", 6) }
            ),
          },
          {
            // C6 Self Hit 2: 85% EM as LunarBloom DMG
            formula: new LunarDirectFormula(
              0.85,
              {
                element: "Dendro",
                ability: "charge",
                reaction: "lunarBloom",
              },
              "em"
            ),
          },
        ]
      : [
          {
            // Self Hit 1
            formula: new DirectFormula(
              this.param("E", 5),
              { element: "Dendro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("E", 6) }
            ),
          },
          {
            // Self Hit 2
            formula: new DirectFormula(
              this.param("E", 7),
              { element: "Dendro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("E", 8) }
            ),
          },
        ];
    return {
      "nefer-phantasm": {
        label: {
          zh: "E重击",
          en: "E CA",
        },
        when: hasHydro,
        parts: [
          ...selfParts,
          {
            // Shade Hits 1+2 (same multiplier)
            formula: new LunarDirectFormula(
              this.param("E", 9),
              {
                element: "Dendro",
                ability: "charge",
                reaction: "lunarBloom",
              },
              "em"
            ),
            hits: 2,
          },
          {
            // Shade Hit 3
            formula: new LunarDirectFormula(
              this.param("E", 11),
              {
                element: "Dendro",
                ability: "charge",
                reaction: "lunarBloom",
              },
              "em"
            ),
          },
          // C6: Extra 120% EM LunarBloom hit at end of Phantasm Performance
          ...(isC6
            ? [
                {
                  formula: new LunarDirectFormula(
                    1.2,
                    {
                      element: "Dendro",
                      ability: "charge",
                      reaction: "lunarBloom",
                    },
                    "em"
                  ),
                },
              ]
            : []),
        ],
      },
      "nefer-skill": {
        label: { zh: "E", en: "E" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 1),
              { element: "Dendro", ability: "skill", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("E", 2) }
            ),
          },
        ],
      },
      "nefer-burst": {
        label: { zh: "Q", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("Q", 1),
              { element: "Dendro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("Q", 2) }
            ),
          },
          {
            formula: new DirectFormula(
              this.param("Q", 3),
              { element: "Dendro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("Q", 4) }
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("flins")
class Flins extends CharacterBase {
  readonly buffs = [
    // P3: Per 100 ATK → +0.7% Lunar-Charged reactionBaseDmg%, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      [],
      "atk",
      "reactionBaseDmg%",
      0.00007,
      0.14
    ),
    // P1 (Moonsign Ascendant Gleam): Flins's Lunar-Charged reactions +20% DMG
    ...(this.teamMeta.countByFaction("Moonsign") >= 2
      ? [
          new StatBuff(
            cbs(this, "P1", ["passive"]),
            {
              receiver: "self",
              filter: { reactions: ["lunarCharged"] },
            },
            [{ key: "reactionDmg%", value: 0.2 }]
          ),
        ]
      : []),
    // P2: EM = 8% ATK (cap 160). C4 enhances to 10% ATK (cap 220)
    new ScalingBuff(
      cbs(this, "P2", ["passive"]),
      { receiver: "self" },
      [],
      "atk",
      "em",
      this.constellation >= 4 ? 0.1 : 0.08,
      this.constellation >= 4 ? 220 : 160
    ),
    // C2: Electro RES -25% while Flins is on field (Moonsign Ascendant Gleam required)
    // "月兆·满辉：菲林斯在场上时...该敌人的雷元素抗性降低25%"
    // Requires both C2 and Ascendant Gleam (≥2 Nod-Krai characters)
    ...(this.constellation >= 2 && this.teamMeta.countByFaction("Moonsign") >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "team", filter: { elements: ["Electro"] } },
            [{ key: "resReduction%", value: 0.25 }]
          ),
        ]
      : []),
    // C4: ATK +20%
    ...(this.constellation >= 4
      ? [
          new StatBuff(cbs(this, "C4", []), { receiver: "self" }, [
            { key: "atk%", value: 0.2 },
          ]),
        ]
      : []),
    // C6: Lunar-Charged elevated 35% self, team 10%
    ...(this.constellation >= 6
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            {
              receiver: "self",
              filter: { reactions: ["lunarCharged"] },
            },
            [{ key: "elevated%", value: 0.35 }]
          ),
        ]
      : []),
    // C6 team elevated% requires Moonsign Ascendant Gleam
    // "月兆·满辉：队伍中附近的所有角色造成的月感电反应伤害擢升10%" — requires ≥2 Nod-Krai
    ...(this.constellation >= 6 && this.teamMeta.countByFaction("Moonsign") >= 2
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "team", filter: { reactions: ["lunarCharged"] } },
            [{ key: "elevated%", value: 0.1 }]
          ),
        ]
      : []),
  ];

  // E Spearstorm: Lv10 321.1%, Lv13 (C5+) 379.1%
  // Q initial: Lv10 467.7%, Lv13 (C3+) 552.2% (regular Electro, DirectFormula)
  // Q middle phases (LunarDirect): Lv10 29.2% ×2, Lv13 (C3+) 34.5% ×2
  //   Moonsign Ascendant Gleam adds 2 extra middle phases (need thunderclouds = hasHydro for lunarCharged)
  // Q final phase (LunarDirect): Lv10 210.5%, Lv13 (C3+) 248.5%
  // Thunderous Symphony (LunarDirect): Lv10 128.6%, Lv13 (C3+) 151.8%
  //   Moonsign Ascendant Gleam adds 1 extra hit (187.1%/220.9%)

  // Rotation: E > E > sQ > N4D×2 > N2 > E > sQ > N4D > N5 (on-field carry, ~10s field time)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "flins-normal", count: 2 },
      { id: "flins-spearstorm", count: 2, bonus: [{ minC: 1, delta: 1 }] },
      { id: "flins-thunderous", count: 2, bonus: [{ minC: 1, delta: 1 }] },
    ];
  }

  protected readonly formulaMap = (() => {
    const isAscendantGleam = this.teamMeta.countByFaction("Moonsign") >= 2;
    // Moonsign Ascendant Gleam + thunderclouds (from prior lunarCharged) for extra Q/TS hits
    const hasExtraHits =
      isAscendantGleam && this.teamMeta.hasReaction("lunarCharged");
    const lunarTag = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "lunarCharged" as const,
    };
    const normalTag = {
      element: "Electro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    // Q normal: initial + 2 mid + final; Ascendant Gleam with thunderclouds: +2 extra mid
    const qMidHits = hasExtraHits ? 4 : 2;
    return {
      "flins-normal": {
        label: { zh: "E普攻（5段）", en: "Normal (5-hit, E)" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), normalTag) },
          { formula: new DirectFormula(this.param("E", 2), normalTag) },
          { formula: new DirectFormula(this.param("E", 3), normalTag) },
          {
            formula: new DirectFormula(this.param("E", 4), normalTag),
            hits: 2,
          },
          { formula: new DirectFormula(this.param("E", 5), normalTag) },
        ],
      },
      "flins-spearstorm": {
        label: {
          zh: "E北国枪阵",
          en: "E Spearstorm",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 7), {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
          },
          // C2: After E, next Normal Attack deals bonus 50% ATK lunarCharged hit (once per E)
          ...(this.constellation >= 2 &&
          this.teamMeta.hasReaction("lunarCharged")
            ? [
                {
                  formula: new LunarDirectFormula(0.5, {
                    element: "Electro",
                    ability: "skill",
                    reaction: "lunarCharged",
                  }),
                },
              ]
            : []),
        ],
      },
      "flins-thunderous": {
        label: { zh: "Q雷霆交响", en: "Q Thunderous Symphony" },
        parts: [
          { formula: new LunarDirectFormula(this.param("Q", 6), lunarTag) },
          ...(hasExtraHits
            ? [
                {
                  formula: new LunarDirectFormula(this.param("Q", 7), lunarTag),
                },
              ]
            : []),
        ],
      },
      "flins-burst-total": {
        label: { zh: "Q满能量", en: "Q Full Energy" },
        parts: [
          // Initial Electro DMG (regular, not lunar)
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          // Middle phase Lunar-Charged hits
          {
            formula: new LunarDirectFormula(this.param("Q", 2), lunarTag),
            hits: qMidHits,
          },
          // Final phase Lunar-Charged hit
          { formula: new LunarDirectFormula(this.param("Q", 3), lunarTag) },
        ],
      },
    };
  })();
}

@RegisterCharacter("lauma")
class Lauma extends CharacterBase {
  readonly buffs = [
    // P3 (combat passive): Per EM → +0.0175% Lunar-Bloom reactionBaseDmg%, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      [],
      "em",
      "reactionBaseDmg%",
      0.000175,
      0.14
    ),
    // P1: Moonsign buffs are mutually exclusive (不同月兆等级提供的强化效果无法叠加)
    // Nascent Gleam: Bloom/Hyperbloom/Burgeon can crit, CR 15% CD 100%
    // Ascendant Gleam: Lunar-Bloom CR +10%, CD +20% (replaces Nascent Gleam)
    ...(this.teamMeta.countByFaction("Moonsign") >= 2
      ? [
          new StatBuff(
            cbs(this, "P1", ["E"]),
            {
              receiver: "team",
              filter: { reactions: ["lunarBloom"] },
            },
            [
              { key: "reactionCr", value: 0.1 },
              { key: "reactionCd", value: 0.2 },
            ]
          ),
        ]
      : [
          new StatBuff(
            cbs(this, "P1", ["E"]),
            {
              receiver: "team",
              filter: { reactions: ["bloom", "hyperbloom", "burgeon"] },
            },
            [
              { key: "reactionCr", value: 0.15 },
              { key: "reactionCd", value: 1.0 },
            ]
          ),
        ]),
    // P2: Per EM → Sanctuary (E skill) DMG +0.04%, cap 32%
    new ScalingBuff(
      cbs(this, "P2", ["passive"]),
      { receiver: "self", filter: { abilities: ["skill"] } },
      [],
      "em",
      "dmg%",
      0.0004,
      0.32
    ),
    // E: Dendro+Hydro RES decrease 25% (Lv10) / 34% (Lv13, C5+)
    // "使该敌人的草元素抗性与水元素抗性降低" → scoped to Dendro and Hydro only
    new StatBuff(
      cbs(this, "E", ["E"]),
      { receiver: "team", filter: { elements: ["Dendro", "Hydro"] } },
      [{ key: "resReduction%", value: this.param("E", 8) }]
    ),
    // Q Pale Hymn: Bloom/Hyperbloom/Burgeon DMG + EM×500%/590.2%
    // C2: +500% EM on top (non-Ascendant-Gleam extra Pale Hymn enhancement)
    // 18 base stacks + up to 18 from Moon Song (3×6) = 36 max
    new ScalingBuff(
      {
        ...cbs(this, this.constellation >= 2 ? "Q/C2" : "Q", ["Q"]),
        maxStacks: 36,
      },
      {
        receiver: "team",
        filter: { reactions: ["bloom", "hyperbloom", "burgeon"] },
      },
      [],
      "em",
      "baseDmg",
      this.param("Q", 3) + (this.constellation >= 2 ? 5.0 : 0)
    ),
    // Q Pale Hymn: Lunar-Bloom DMG + EM×400%/472.3%
    // C2: +400% EM on top (non-Ascendant-Gleam extra Pale Hymn enhancement)
    // Shares Pale Hymn stack pool (36 max)
    new ScalingBuff(
      {
        ...cbs(this, this.constellation >= 2 ? "Q/C2" : "Q", ["Q"]),
        maxStacks: 36,
      },
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      [],
      "em",
      "baseDmg",
      this.param("Q", 4) + (this.constellation >= 2 ? 4.0 : 0)
    ),
    // C2 (Ascendant Gleam): Lunar-Bloom DMG +40%
    // "月兆·满辉：队伍中附近的所有角色造成的月绽放反应伤害提升40%"
    // Requires both C2 and Moonsign Ascendant Gleam (≥2 Nod-Krai characters)
    ...(this.constellation >= 2 && this.teamMeta.countByFaction("Moonsign") >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", []),
            { receiver: "team", filter: { reactions: ["lunarBloom"] } },
            [{ key: "reactionDmg%", value: 0.4 }]
          ),
        ]
      : []),
    // C6: Lunar-Bloom elevated 25% (requires Moonsign Ascendant Gleam)
    ...(this.constellation >= 6 && this.teamMeta.countByFaction("Moonsign") >= 2
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "team", filter: { reactions: ["lunarBloom"] } },
            [{ key: "elevated%", value: 0.25 }]
          ),
        ]
      : []),
  ];

  // Rotation: Hold E > Q > swap (off-field support). Sanctuary ticks every 2s for 15s ≈ 7 hits.
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "lauma-sanctuary", count: 7 },
      { id: "lauma-hold", count: 1 },
      { id: "lauma-c6-normal", count: 0 },
      { id: "lauma-c6-sanctuary", count: 1 },
    ];
  }

  // E press: Lv10 218.9%, Lv13 (C5+) 258.4%
  // Frostgrove Sanctuary: Lv10 172.8% ATK + 345.6% EM, Lv13 (C5+) 204.0% ATK + 408.0% EM
  protected readonly formulaMap = (() => {
    const hasHydro = this.teamMeta.countByElement("Hydro") > 0;
    const hasNascentGleam = this.teamMeta.countByFaction("Moonsign") >= 1;

    return {
      "lauma-press": {
        label: { zh: "E点按", en: "E Press" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 1), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "lauma-sanctuary": {
        label: { zh: "E持续(单次)", en: "E DoT (×1)" },
        parts: [
          {
            formula: new DirectFormula(
              this.param("E", 4),
              { element: "Dendro", ability: "skill", reaction: "none" },
              "atk",
              { key: "em", multiplier: this.param("E", 5) }
            ),
            offField: true,
          },
        ],
      },
      "lauma-hold": {
        label: {
          zh: "E长按",
          en: "E Hold",
        },
        when: hasNascentGleam && hasHydro,
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
          {
            // Per Verdant Dew (max 3 consumed) — multiplier-scaling single hit
            formula: new LunarDirectFormula(
              this.param("E", 3) * 3,
              {
                element: "Dendro",
                ability: "skill",
                reaction: "lunarBloom",
              },
              "em"
            ),
          },
        ],
      },
      "lauma-c6-normal": {
        label: {
          zh: "普攻",
          en: "Normal",
        },
        minC: 6,
        parts: [
          {
            formula: new LunarDirectFormula(
              1.5,
              {
                element: "Dendro",
                ability: "normal",
                reaction: "lunarBloom",
              },
              "em"
            ),
          },
        ],
      },
      // C6: Frostgrove Sanctuary extra Lunar-Bloom hit per tick (185% EM, up to 8 times)
      "lauma-c6-sanctuary": {
        label: {
          zh: "圣域×8",
          en: "Sanctuary ×8",
        },
        minC: 6,
        parts: [
          {
            formula: new LunarDirectFormula(
              1.85,
              {
                element: "Dendro",
                ability: "skill",
                reaction: "lunarBloom",
              },
              "em"
            ),
            hits: 8,
            offField: true,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("ineffa")
class Ineffa extends CharacterBase {
  readonly buffs = [
    // P3: Per 100 ATK → +0.7% Lunar-Charged reactionBaseDmg%, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      [],
      "atk",
      "reactionBaseDmg%",
      0.00007,
      0.14
    ),
    // P2: After Q, Ineffa's EM and the active on-field character's EM = 6% of Ineffa ATK
    // "提升伊涅芙与队伍中自己当前场上角色的元素精通" → Ineffa always (self) + active character excl. self (otherOnField)
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "self" },
      [],
      "atk",
      "em",
      0.06
    ),
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "otherOnField" },
      [],
      "atk",
      "em",
      0.06
    ),
    // C1: Lunar-Charged DMG +2.5% per 100 ATK (cap 50%)
    ...(this.constellation >= 1
      ? [
          new ScalingBuff(
            cbs(this, "C1", ["E"]),
            { receiver: "team", filter: { reactions: ["lunarCharged"] } },
            [],
            "atk",
            "reactionDmg%",
            0.00025,
            0.5
          ),
        ]
      : []),
  ];

  // Rotation: E > Q > swap (off-field sub-DPS). Birgitta 10 hits baked in formula. C6 triggers ~6 times over 20s.
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "ineffa-skill-initial", count: 1 },
      { id: "ineffa-birgitta", count: 1 },
      { id: "ineffa-burst", count: 1 },
      { id: "ineffa-c6-thundercloud", count: 6 },
    ];
  }

  // Birgitta Discharge: Lv10 172.8%, Lv13 (C3+) 204.0%, every 2s ≈ 10 ticks
  // P1: If thunderclouds nearby (from lunarCharged), each discharge also does 65% ATK lunarCharged hit
  // Q: Lv10 1218.2%, Lv13 (C5+) 1438.2%
  protected readonly formulaMap = (() => {
    const hasHydro = this.teamMeta.countByElement("Hydro") > 0;
    return {
      "ineffa-skill-initial": {
        label: { zh: "E初始", en: "E Initial" },
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
      "ineffa-birgitta": {
        label: { zh: "E×10", en: "E×10" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 4), {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 10,
            offField: true,
          },
          ...(hasHydro
            ? [
                {
                  // P1: Additional Lunar-Charged hit per discharge (65% ATK, viewed as lunarCharged DMG)
                  // Raw game% passed; directCoeff (×3) applied internally
                  formula: new LunarDirectFormula(0.65, {
                    element: "Electro",
                    ability: "skill",
                    reaction: "lunarCharged",
                  }),
                  hits: 10,
                  offField: true,
                },
              ]
            : []),
        ],
      },
      "ineffa-burst": {
        label: {
          zh: "Q",
          en: "Q",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
          // C2: Punishment Edict — 300% ATK lunarCharged AoE on delay/death (once per Q)
          ...(this.constellation >= 2 && hasHydro
            ? [
                {
                  formula: new LunarDirectFormula(3.0, {
                    element: "Electro",
                    ability: "burst",
                    reaction: "lunarCharged",
                  }),
                  offField: true,
                },
              ]
            : []),
        ],
      },
      // C6: After thundercloud lightning burst, 135% ATK Electro as Lunar-Charged DMG (once/3.5s)
      // Requires C1 Carrier Flow Composite (always available at C6) and thunderclouds (Hydro teammate)
      "ineffa-c6-thundercloud": {
        label: { zh: "额外雷击", en: "Extra Lightning" },
        minC: 6,
        when: hasHydro,
        parts: [
          {
            formula: new LunarDirectFormula(1.35, {
              element: "Electro",
              ability: "skill",
              reaction: "lunarCharged",
            }),
            offField: true,
          },
        ],
      },
    };
  })();
}
