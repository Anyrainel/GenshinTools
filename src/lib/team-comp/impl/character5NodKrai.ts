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
import { cbs } from "../helpers";
import type { OptionDef, ReactionType } from "../types";

// ═══════════════════════════════════════════════════════════════
// 5★ Nod-Krai Characters
// ═══════════════════════════════════════════════════════════════

const columbinaOption = {
  label: { zh: "主要月曜反应", en: "Dominant Lunar Reaction" },
  choices: [
    { value: "lunarCharged", label: { zh: "月感电", en: "Lunar-Charged" } },
    { value: "lunarBloom", label: { zh: "月绽放", en: "Lunar-Bloom" } },
    {
      value: "lunarCrystallize",
      label: { zh: "月结晶", en: "Lunar-Crystallize" },
    },
  ] as const,
  default: "lunarBloom",
} satisfies OptionDef;

@RegisterCharacter("columbina", columbinaOption)
class Columbina extends CharacterBase {
  private readonly o = resolveOption(columbinaOption, this.option);

  readonly buffs = (() => {
    const buffs: InstanceType<typeof StatBuff | typeof ScalingBuff>[] = [
      // P3: Moonsign Benediction — per 1000 Max HP, lunar reaction baseDmg% +0.2%, cap 7%
      new ScalingBuff(
        cbs(this, "P3", []),
        { receiver: "team", filter: { reactions: [...LUNAR_REACTIONS] } },
        [],
        "hp",
        "baseDmg%",
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
        [{ key: "reactionDmg%", value: this.constellation >= 5 ? 0.49 : 0.4 }]
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
      if (this.teamMeta.countByRegion("Nod-Krai") >= 2) {
        const c2Map = {
          lunarCharged: { stat: "atk" as const, scale: 0.01 },
          lunarBloom: { stat: "em" as const, scale: 0.0035 },
          lunarCrystallize: { stat: "def" as const, scale: 0.01 },
        };
        const c2 = c2Map[this.o];
        buffs.push(
          new ScalingBuff(
            cbs(this, "C2", ["E"]),
            { receiver: "onField" },
            [],
            "hp",
            c2.stat,
            c2.scale
          )
        );
      }
    }

    // C6: +80% CD for elements involved in the dominant Lunar reaction
    // "依据参与反应的元素类型，使队伍中的所有角色造成的对应元素类型伤害的暴击伤害提升80%"
    // All lunar reactions involve Hydro plus a second element
    if (this.constellation >= 6) {
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

  protected readonly formulaMap = (() => {
    const isE13 = this.constellation >= 3;

    let eInterferenceMult = 0;
    let eInterferenceHits = 1;
    let eInterferenceElement: Element = "Electro";
    let eInterferenceReaction: ReactionType = "lunarCharged";

    if (this.o === "lunarCharged") {
      eInterferenceMult = isE13 ? 0.1 : 0.0847;
      eInterferenceElement = "Electro";
      eInterferenceReaction = "lunarCharged";
    } else if (this.o === "lunarBloom") {
      eInterferenceMult = isE13 ? 0.0299 : 0.0253;
      eInterferenceHits = 5;
      eInterferenceElement = "Dendro";
      eInterferenceReaction = "lunarBloom";
    } else if (this.o === "lunarCrystallize") {
      eInterferenceMult = isE13 ? 0.1875 : 0.1588;
      eInterferenceElement = "Geo";
      eInterferenceReaction = "lunarCrystallize";
    }

    return {
      "columbina-charge": {
        label: { zh: "重击", en: "CA" },
        parts: [
          {
            formula: new LunarDirectFormula(
              0.0272,
              { element: "Dendro", ability: "charge", reaction: "lunarBloom" },
              "hp"
            ),
            hits: 3,
          },
        ],
      },
      "columbina-skill-interference": {
        label: { zh: "E伤害", en: "E" },
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
          },
        ],
      },
    };
  })();
}

const neferOption = {
  label: { zh: "伪秘之帷层数", en: "Veil of Falsehood Stacks" },
  choices: [
    { value: "0", label: { zh: "0 层", en: "0 stacks" } },
    {
      value: "1",
      label: { zh: "1 层 (+6%) (C0上限)", en: "1 stack (+6%) (C0 max)" },
    },
    {
      value: "3",
      label: {
        zh: "3 层 (+18/24%，精通+100/200)",
        en: "3 stacks (+18/24%, EM +100/200)",
      },
    },
    {
      value: "5",
      label: {
        zh: "5 层 (+40%，精通+200) (C2上限)",
        en: "5 stacks (+40%, EM +200) (C2 max)",
      },
    },
  ] as const,
  default: "5",
} satisfies OptionDef;

@RegisterCharacter("nefer", neferOption)
class Nefer extends CharacterBase {
  // Veil of Falsehood: only under Ascendant Gleam (≥2 Nod-Krai); cap 1 at C0-1, 5 at C2+
  private readonly veilStacks = (() => {
    if (this.teamMeta.countByRegion("Nod-Krai") < 2) return 0;
    const requested = Number.parseInt(resolveOption(neferOption, this.option));
    return Math.min(requested, this.constellation >= 2 ? 5 : 1);
  })();

  readonly buffs = [
    // P3 (combat passive): Per EM → +0.0175% Lunar-Bloom BaseDmg, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      [],
      "em",
      "baseDmg%",
      0.000175,
      0.14
    ),
    // P1: EM +100/200 when Veil stacks ≥3 (C0-1 cap=1, so this never fires at C0-1)
    new StatBuff(
      cbs(this, this.constellation >= 2 ? "P1/C2" : "P1", ["charge"]),
      { receiver: "selfOnField" },
      [
        {
          key: "em",
          value:
            this.veilStacks >= 3 ? (this.constellation >= 2 ? 200 : 100) : 0,
        },
      ]
    ),
    // P1 (Ascendant Gleam): Veil stacks → dmg% per stack
    // Base: 6% per stack (cap 1). C2: 8% per stack (cap 5, max 140% of original = +40%)
    // Ascendant Gleam condition captured in veilStacks (returns 0 if <2 Nod-Krai)
    ...(this.veilStacks > 0
      ? [
          new StatBuff(
            cbs(this, this.constellation >= 2 ? "P1/C2" : "P1", ["charge"]),
            { receiver: "selfOnField", filter: { abilities: ["charge"] } },
            [
              {
                key: "dmg%",
                value:
                  this.veilStacks * (this.constellation >= 2 ? 0.08 : 0.06),
              },
            ]
          ),
        ]
      : []),
    // C1: Phantasm shades LunarBloom BaseDmg += 60% EM
    // "该效果同样会受到「伪秘之帷」的加成" — Veil's dmg% buff already applies multiplicatively
    new ScalingBuff(
      cbs(this, "C1", ["charge"]),
      {
        receiver: "selfOnField",
        filter: { reactions: ["lunarBloom"], abilities: ["charge"] },
      },
      [],
      "em",
      "baseDmg",
      this.constellation >= 1 ? 0.6 : 0
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
                value: this.veilStacks * (this.constellation >= 5 ? 0.49 : 0.4),
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
    ...(this.constellation >= 6 && this.teamMeta.countByRegion("Nod-Krai") >= 2
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "selfOnField", filter: { reactions: ["lunarBloom"] } },
            [{ key: "elevated%", value: 0.15 }]
          ),
        ]
      : []),
  ];

  // Phantasm Performance self (2 hits): Lv10 44.4%+57.7% ATK + 88.7%+115.3% EM = 102.1% ATK + 204.0% EM
  // Lv13 (C3+): 52.4%+68.1% ATK + 104.7%+136.1% EM = 120.5% ATK + 240.8% EM
  // C6: Self Hit 2 → 85% EM LunarBloom; extra 120% EM LunarBloom at end
  // Phantasm shades (3 hits, LunarBloom): Lv10 172.8%+172.8%+230.4% = 576.0% EM
  // Lv13 (C3+): 204.0%+204.0%+272.0% = 680.0% EM
  // Q total: Lv10 (404.4%+606.5%) ATK + (808.7%+1213.1%) EM = 1010.9% ATK + 2021.8% EM
  // Lv13 (C5+): 1193.4% ATK + 2386.8% EM
  protected readonly formulaMap = (() => {
    const hasHydro = this.teamMeta.countByElement("Hydro") > 0;
    const isE13 = this.constellation >= 3;
    const isC6 = this.constellation >= 6;
    const shadesEmMult = isE13 ? 6.8 : 5.76;
    // Q Hit 1: Lv10 404.4% ATK + 808.7% EM, Lv13 (C5+) 477.4% ATK + 954.7% EM
    // Q Hit 2: Lv10 606.5% ATK + 1213.1% EM, Lv13 (C5+) 716.0% ATK + 1432.1% EM
    const q1AtkMult = this.constellation >= 5 ? 4.774 : 4.044;
    const q1EmMult = this.constellation >= 5 ? 9.547 : 8.087;
    const q2AtkMult = this.constellation >= 5 ? 7.16 : 6.065;
    const q2EmMult = this.constellation >= 5 ? 14.321 : 12.131;
    // Self hit parts depend on C6 (Hit 2 converts to LunarBloom)
    const selfParts: FormulaPart[] = isC6
      ? [
          {
            // Self Hit 1 only: Lv10 44.4% ATK + 88.7% EM, Lv13 52.4% ATK + 104.7% EM
            formula: new DirectFormula(
              isE13 ? 0.524 : 0.444,
              { element: "Dendro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: isE13 ? 1.047 : 0.887 }
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
            // Self Hit 1+2 combined: Lv10 102.1% ATK + 204.0% EM, Lv13 120.5% ATK + 240.8% EM
            formula: new DirectFormula(
              isE13 ? 1.205 : 1.021,
              { element: "Dendro", ability: "charge", reaction: "none" },
              "atk",
              { key: "em", multiplier: isE13 ? 2.408 : 2.04 }
            ),
          },
        ];
    return {
      ...(hasHydro
        ? {
            "nefer-phantasm": {
              label: {
                zh: isC6 ? "6命 E伤害" : "E伤害",
                en: isC6 ? "C6 E" : "E",
              },
              parts: [
                ...selfParts,
                {
                  formula: new LunarDirectFormula(
                    shadesEmMult,
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
          }
        : {}),
      "nefer-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new DirectFormula(
              q1AtkMult,
              { element: "Dendro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: q1EmMult }
            ),
          },
          {
            formula: new DirectFormula(
              q2AtkMult,
              { element: "Dendro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: q2EmMult }
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
    // P3: Per 100 ATK → +0.7% Lunar-Charged BaseDmg, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      [],
      "atk",
      "baseDmg%",
      0.00007,
      0.14
    ),
    // P1 (Moonsign Ascendant Gleam): Flins's Lunar-Charged reactions +20% DMG
    ...(this.teamMeta.countByRegion("Nod-Krai") >= 2
      ? [
          new StatBuff(
            cbs(this, "P1", ["passive"]),
            {
              receiver: "selfOnField",
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
    ...(this.constellation >= 2 && this.teamMeta.countByRegion("Nod-Krai") >= 2
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
              receiver: "selfOnField",
              filter: { reactions: ["lunarCharged"] },
            },
            [{ key: "elevated%", value: 0.35 }]
          ),
        ]
      : []),
    // C6 team elevated% requires Moonsign Ascendant Gleam
    // "月兆·满辉：队伍中附近的所有角色造成的月感电反应伤害擢升10%" — requires ≥2 Nod-Krai
    ...(this.constellation >= 6 && this.teamMeta.countByRegion("Nod-Krai") >= 2
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
  protected readonly formulaMap = (() => {
    const spearstormMult = this.constellation >= 5 ? 3.791 : 3.211;
    const qInitMult = this.constellation >= 3 ? 5.522 : 4.677;
    // LunarDirectFormula passes raw game% — directCoeff (×3 for lunarCharged) applied internally
    const qMidMult = this.constellation >= 3 ? 0.345 : 0.292;
    const qFinalMult = this.constellation >= 3 ? 2.485 : 2.105;
    const tsMainMult = this.constellation >= 3 ? 1.518 : 1.286;
    const tsExtraMult = this.constellation >= 3 ? 2.209 : 1.871;
    const isAscendantGleam = this.teamMeta.countByRegion("Nod-Krai") >= 2;
    // Moonsign Ascendant Gleam + thunderclouds (from prior lunarCharged) for extra Q/TS hits
    const hasExtraHits =
      isAscendantGleam && this.teamMeta.hasReaction("lunarCharged");
    const skillTag = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    const burstTag = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const lunarTag = {
      element: "Electro" as const,
      ability: "burst" as const,
      reaction: "lunarCharged" as const,
    };
    // Q normal: initial + 2 mid + final; Ascendant Gleam with thunderclouds: +2 extra mid
    const qMidHits = hasExtraHits ? 4 : 2;
    return {
      "flins-spearstorm": {
        label: {
          zh: this.constellation >= 2 ? "2命 E伤害" : "E伤害",
          en: this.constellation >= 2 ? "C2 E" : "E",
        },
        parts: [
          { formula: new DirectFormula(spearstormMult, skillTag) },
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
      "flins-burst-total": {
        label: { zh: "Q伤害(3段)", en: "Q (3-seg)" },
        parts: [
          // Initial Electro DMG (regular, not lunar)
          { formula: new DirectFormula(qInitMult, burstTag) },
          // Middle phase Lunar-Charged hits
          {
            formula: new LunarDirectFormula(qMidMult, lunarTag),
            hits: qMidHits,
          },
          // Final phase Lunar-Charged hit
          { formula: new LunarDirectFormula(qFinalMult, lunarTag) },
        ],
      },
      "flins-thunderous": {
        label: { zh: "Q雷霆交响", en: "Q Thunderous Symphony" },
        parts: [
          { formula: new LunarDirectFormula(tsMainMult, lunarTag) },
          ...(hasExtraHits
            ? [{ formula: new LunarDirectFormula(tsExtraMult, lunarTag) }]
            : []),
        ],
      },
    };
  })();
}

@RegisterCharacter("lauma")
class Lauma extends CharacterBase {
  readonly buffs = [
    // P3 (combat passive): Per EM → +0.0175% Lunar-Bloom BaseDmg, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      [],
      "em",
      "baseDmg%",
      0.000175,
      0.14
    ),
    // P1: Moonsign buffs are mutually exclusive (不同月兆等级提供的强化效果无法叠加)
    // Nascent Gleam: Bloom/Hyperbloom/Burgeon can crit, CR 15% CD 100%
    // Ascendant Gleam: Lunar-Bloom CR +10%, CD +20% (replaces Nascent Gleam)
    ...(this.teamMeta.countByRegion("Nod-Krai") >= 2
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
      [{ key: "resReduction%", value: this.constellation >= 5 ? 0.34 : 0.25 }]
    ),
    // Q Pale Hymn: Bloom/Hyperbloom/Burgeon DMG + EM×500%/590.2%
    // C2: +500% EM on top (non-Ascendant-Gleam extra Pale Hymn enhancement)
    new ScalingBuff(
      cbs(this, this.constellation >= 2 ? "Q/C2" : "Q", ["Q"]),
      {
        receiver: "team",
        filter: { reactions: ["bloom", "hyperbloom", "burgeon"] },
      },
      [],
      "em",
      "baseDmg",
      (this.constellation >= 3 ? 5.902 : 5.0) +
        (this.constellation >= 2 ? 5.0 : 0)
    ),
    // Q Pale Hymn: Lunar-Bloom DMG + EM×400%/472.3%
    // C2: +400% EM on top (non-Ascendant-Gleam extra Pale Hymn enhancement)
    new ScalingBuff(
      cbs(this, this.constellation >= 2 ? "Q/C2" : "Q", ["Q"]),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      [],
      "em",
      "baseDmg",
      (this.constellation >= 3 ? 4.723 : 4.0) +
        (this.constellation >= 2 ? 4.0 : 0)
    ),
    // C2 (Ascendant Gleam): Lunar-Bloom DMG +40%
    // "月兆·满辉：队伍中附近的所有角色造成的月绽放反应伤害提升40%"
    // Requires both C2 and Moonsign Ascendant Gleam (≥2 Nod-Krai characters)
    ...(this.constellation >= 2 && this.teamMeta.countByRegion("Nod-Krai") >= 2
      ? [
          new StatBuff(
            cbs(this, "C2", []),
            { receiver: "team", filter: { reactions: ["lunarBloom"] } },
            [{ key: "reactionDmg%", value: 0.4 }]
          ),
        ]
      : []),
    // C6: Lunar-Bloom elevated 25% (requires Moonsign Ascendant Gleam)
    ...(this.constellation >= 6 && this.teamMeta.countByRegion("Nod-Krai") >= 2
      ? [
          new StatBuff(
            cbs(this, "C6", []),
            { receiver: "team", filter: { reactions: ["lunarBloom"] } },
            [{ key: "elevated%", value: 0.25 }]
          ),
        ]
      : []),
  ];

  // E press: Lv10 218.9%, Lv13 (C5+) 258.4%
  // Frostgrove Sanctuary: Lv10 172.8% ATK + 345.6% EM, Lv13 (C5+) 204.0% ATK + 408.0% EM
  protected readonly formulaMap = (() => {
    const pressMult = this.constellation >= 5 ? 2.584 : 2.189;
    const sanctAtkMult = this.constellation >= 5 ? 2.04 : 1.728;
    const sanctEmMult = this.constellation >= 5 ? 4.08 : 3.456;

    const hold1Mult = this.constellation >= 5 ? 3.359 : 2.845;
    const hold2Mult = this.constellation >= 5 ? 3.23 : 2.736;
    const hasHydro = this.teamMeta.countByElement("Hydro") > 0;
    const hasNascentGleam = this.teamMeta.countByRegion("Nod-Krai") >= 1;

    return {
      "lauma-press": {
        label: { zh: "E伤害", en: "E" },
        parts: [
          {
            formula: new DirectFormula(pressMult, {
              element: "Dendro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "lauma-sanctuary": {
        label: { zh: "E持续伤害(单次)", en: "E DoT (×1)" },
        parts: [
          {
            formula: new DirectFormula(
              sanctAtkMult,
              { element: "Dendro", ability: "skill", reaction: "none" },
              "atk",
              { key: "em", multiplier: sanctEmMult }
            ),
          },
        ],
      },
      ...(hasNascentGleam && hasHydro
        ? {
            "lauma-hold": {
              label: {
                zh: "E长按伤害",
                en: "E Hold",
              },
              parts: [
                {
                  formula: new DirectFormula(hold1Mult, {
                    element: "Dendro",
                    ability: "skill",
                    reaction: "none",
                  }),
                },
                {
                  formula: new LunarDirectFormula(
                    hold2Mult * 3,
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
          }
        : {}),
      ...(this.constellation >= 6
        ? {
            "lauma-c6-normal": {
              label: {
                zh: "6命 普攻伤害",
                en: "C6 Normal",
              },
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
          }
        : {}),
    };
  })();
}

@RegisterCharacter("ineffa")
class Ineffa extends CharacterBase {
  readonly buffs = [
    // P3: Per 100 ATK → +0.7% Lunar-Charged BaseDmg, cap 14%
    new ScalingBuff(
      cbs(this, "P3", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      [],
      "atk",
      "baseDmg%",
      0.00007,
      0.14
    ),
    // P2: After Q, Ineffa's EM and the active on-field character's EM = 6% of Ineffa ATK
    // "提升伊涅芙与队伍中自己当前场上角色的元素精通" → onField (closest approximation per U1)
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "onField" },
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

  // Birgitta Discharge: Lv10 172.8%, Lv13 (C3+) 204.0%, every 2s ≈ 10 ticks
  // P1: If thunderclouds nearby (from lunarCharged), each discharge also does 65% ATK lunarCharged hit
  // Q: Lv10 1218.2%, Lv13 (C5+) 1438.2%
  protected readonly formulaMap = (() => {
    const dischargeMult = this.constellation >= 3 ? 2.04 : 1.728;
    const qMult = this.constellation >= 5 ? 14.382 : 12.182;
    const hasHydro = this.teamMeta.countByElement("Hydro") > 0;
    return {
      "ineffa-birgitta": {
        label: { zh: "E伤害×10", en: "E (×10)" },
        parts: [
          {
            formula: new DirectFormula(dischargeMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 10,
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
                },
              ]
            : []),
        ],
      },
      "ineffa-burst": {
        label: {
          zh: this.constellation >= 2 ? "2命 Q伤害" : "Q伤害",
          en: this.constellation >= 2 ? "C2 Q" : "Q",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
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
                },
              ]
            : []),
        ],
      },
      // C6: After thundercloud lightning burst, 135% ATK Electro as Lunar-Charged DMG (once/3.5s)
      // Requires C1 Carrier Flow Composite (always available at C6) and thunderclouds (Hydro teammate)
      ...(this.constellation >= 6 && hasHydro
        ? {
            "ineffa-c6-thundercloud": {
              label: { zh: "6命 雷暴云伤害", en: "C6 Thundercloud" },
              parts: [
                {
                  formula: new LunarDirectFormula(1.35, {
                    element: "Electro",
                    ability: "skill",
                    reaction: "lunarCharged",
                  }),
                },
              ],
            },
          }
        : {}),
    };
  })();
}
