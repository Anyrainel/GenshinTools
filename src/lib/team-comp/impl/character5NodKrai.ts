import type { Element } from "@/data/types";
import { LUNAR_REACTIONS } from "../constants";
import {
  ScalingBuff,
  ScalingMultiBuff,
  ScalingSkillBuff,
  StatBuff,
  StaticSkillBuff,
} from "../damageBuffs";
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
    const buffs: InstanceType<
      typeof StatBuff | typeof StaticSkillBuff | typeof ScalingBuff
    >[] = [
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
      new StatBuff(cbs(this, "P1", ["E"]), { receiver: "selfOnField" }, [
        { key: "cr", value: 0.15 },
      ]),
      // Q: Lunar Reaction DMG Bonus +40% (Lv10) / +49% (C5+)
      new StaticSkillBuff(
        cbs(this, "Q", ["Q"]),
        { receiver: "team", filter: { reactions: [...LUNAR_REACTIONS] } },
        this.constellation,
        (c) => [{ key: "reactionDmg%", value: c >= 5 ? 0.49 : 0.4 }]
      ),
      // C1–C6 cumulative "elevated" bonus:
      // C1: 1.5%, C2: 7%, C3: 1.5%, C4: 1.5%, C5: 1.5%, C6: 7%
      new StaticSkillBuff(
        cbs(this, "C1", []),
        { receiver: "team", filter: { reactions: [...LUNAR_REACTIONS] } },
        this.constellation,
        (c) => {
          let v = 0;
          if (c >= 1) v += 0.015;
          if (c >= 2) v += 0.07;
          if (c >= 3) v += 0.015;
          if (c >= 4) v += 0.015;
          if (c >= 5) v += 0.015;
          if (c >= 6) v += 0.07;
          return v > 0 ? [{ key: "elevated%", value: v }] : [];
        }
      ),
    ];

    // C2: HP +40% for 8s on Gravity Interference
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, "C2", ["E"]), { receiver: "self" }, [
          { key: "hp%", value: 0.4 },
        ])
      );

      // C2: On-field buff based on dominant Lunar reaction type
      // Lunar-Charged → ATK +1% Max HP; Lunar-Bloom → EM +0.35% Max HP; Lunar-Crystallize → DEF +1% Max HP
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

    // C6: +80% CD for the element matching the dominant Lunar reaction
    if (this.constellation >= 6) {
      const c6Element = {
        lunarCharged: "Electro" as const,
        lunarBloom: "Dendro" as const,
        lunarCrystallize: "Geo" as const,
      }[this.o];
      buffs.push(
        new StatBuff(
          cbs(this, "C6", ["Q"]),
          { receiver: "onField", filter: { elements: [c6Element] } },
          [{ key: "cd", value: 0.8 }]
        )
      );
    }

    return buffs;
  })();

  protected readonly formulaMap = (() => {
    const isE13 = this.constellation >= 3;
    const isQ13 = this.constellation >= 5;

    const eInitMult = isE13 ? 0.355 : 0.301;
    const eRippleMult = isE13 ? 0.199 : 0.168;

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

    const qMult = isQ13 ? 0.685 : 0.58;

    return {
      "columbina-charge": {
        label: { zh: "A 月露涤荡", en: "A Moondew Cleanse" },
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
      "columbina-skill": {
        label: { zh: "E 万古潮汐", en: "E Eternal Tides" },
        parts: [
          {
            formula: new DirectFormula(
              eInitMult,
              { element: "Hydro", ability: "skill", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
      "columbina-skill-ripple": {
        label: { zh: "E 引力涟漪持续伤害", en: "E Gravity Ripple" },
        parts: [
          {
            formula: new DirectFormula(
              eRippleMult,
              { element: "Hydro", ability: "skill", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
      "columbina-skill-interference": {
        label: { zh: "E 引力干涉", en: "E Gravity Interference" },
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
      "columbina-burst": {
        label: { zh: "Q 她的乡愁", en: "Q Moonlit Melancholy" },
        parts: [
          {
            formula: new DirectFormula(
              qMult,
              { element: "Hydro", ability: "burst", reaction: "none" },
              "hp"
            ),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("nefer")
class Nefer extends CharacterBase {
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
    // P1: EM +100 when Veil of Falsehood stacks hit threshold (C2: +200)
    new StaticSkillBuff(
      cbs(this, "P1", ["E"]),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => [{ key: "em", value: c >= 2 ? 200 : 100 }]
    ),
    // C4: Dendro RES -20% during Shadow Dance
    new StaticSkillBuff(
      cbs(this, "C4", ["E"]),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "resReduction%", value: 0.2 }] : [])
    ),
    // C6: Nefer's Lunar-Bloom DMG elevated 15%
    new StaticSkillBuff(
      cbs(this, "C6", []),
      { receiver: "selfOnField", filter: { reactions: ["lunarBloom"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "elevated%", value: 0.15 }] : [])
    ),
  ];

  // Phantasm shades (3 hits): Lv10 172.8%+172.8%+230.4% = 576.0% EM
  // Lv13 (C3+): 204.0%+204.0%+272.0% = 680.0% EM
  // Q total: Lv10 (404.4%+606.5%) ATK + (808.7%+1213.1%) EM = 1010.9% ATK + 2021.8% EM
  // Lv13 (C5+): 1193.4% ATK + 2386.8% EM
  protected readonly formulaMap = (() => {
    const shadesEmMult = this.constellation >= 3 ? 6.8 : 5.76;
    const qAtkMult = this.constellation >= 5 ? 11.934 : 10.109;
    const qEmMult = this.constellation >= 5 ? 23.868 : 20.218;
    return {
      "nefer-shades": {
        label: { zh: "E 幻戏虚影(3段)", en: "E Phantasm Shades (3 hits)" },
        parts: [
          {
            formula: new DirectFormula(
              0,
              { element: "Dendro", ability: "skill", reaction: "none" },
              "atk",
              { key: "em", multiplier: shadesEmMult }
            ),
          },
        ],
      },
      "nefer-burst": {
        label: { zh: "Q 真眸幻戏(全段)", en: "Q True Eye's Phantasm (Full)" },
        parts: [
          {
            formula: new DirectFormula(
              qAtkMult,
              { element: "Dendro", ability: "burst", reaction: "none" },
              "atk",
              { key: "em", multiplier: qEmMult }
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
    // Passive 2 (combat): Per 100 ATK → +0.7% Lunar-Charged BaseDmg, cap 14%
    new ScalingBuff(
      cbs(this, "P1", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      [],
      "atk",
      "baseDmg%",
      0.00007,
      0.14
    ),
    // A1: Flins's Lunar-Charged reactions +20% DMG
    new StatBuff(
      cbs(this, "P1", ["A1"]),
      { receiver: "selfOnField", filter: { reactions: ["lunarCharged"] } },
      [{ key: "reactionDmg%", value: 0.2 }]
    ),
    // A4: EM = 8% ATK (cap 160). C4 enhances to 10% ATK (cap 220)
    new ScalingBuff(
      cbs(this, "P2", ["A4"]),
      { receiver: "self" },
      [],
      "atk",
      "em",
      this.constellation >= 4 ? 0.1 : 0.08,
      this.constellation >= 4 ? 220 : 160
    ),
    // C2: Electro RES -25% (Ascendant Gleam)
    new StaticSkillBuff(
      cbs(this, "C2", ["E"]),
      { receiver: "onField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "resReduction%", value: 0.25 }] : [])
    ),
    // C4: ATK +20%
    new StaticSkillBuff(
      cbs(this, "C4", []),
      { receiver: "self" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "atk%", value: 0.2 }] : [])
    ),
    // C6: Lunar-Charged elevated 35% self, team 10%
    new StaticSkillBuff(
      cbs(this, "C6", []),
      { receiver: "selfOnField", filter: { reactions: ["lunarCharged"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "elevated%", value: 0.35 }] : [])
    ),
    new StaticSkillBuff(
      cbs(this, "C6", []),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "elevated%", value: 0.1 }] : [])
    ),
  ];

  // E Spearstorm: Lv10 321.1%, Lv13 (C5+) 379.1%
  // Q initial: Lv10 467.7%, Lv13 (C3+) 552.2% (regular Electro)
  // Q Lunar-Charged phases: LunarFormula (reaction-based, EM-scaled)
  // Thunderous Symphony: LunarFormula
  protected readonly formulaMap = (() => {
    const spearstormMult = this.constellation >= 5 ? 3.791 : 3.211;
    const qInitMult = this.constellation >= 3 ? 5.522 : 4.677;
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
    return {
      "flins-spearstorm": {
        label: { zh: "E 北国枪阵", en: "E Northland Spearstorm" },
        parts: [{ formula: new DirectFormula(spearstormMult, skillTag) }],
      },
      "flins-burst-total": {
        label: { zh: "Q 旧仪·夜客致访(总计)", en: "Q Ancient Ritual Total" },
        parts: [
          // Initial Electro DMG
          { formula: new DirectFormula(qInitMult, burstTag) },
          // Middle + Final phase Lunar-Charged (×2 mid + 1 final = 3 hits)
          { formula: new LunarFormula(1.0, lunarTag), hits: 3 },
        ],
      },
      "flins-thunderous": {
        label: { zh: "Q 雷霆交响", en: "Q Thunderous Symphony" },
        parts: [{ formula: new LunarFormula(1.0, lunarTag) }],
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
    // P1 (Moonsign Nascent): After E, Bloom/Hyperbloom/Burgeon can crit, CR 15% CD 100%
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
    // E: Dendro+Hydro RES decrease 25% (Lv10) / 34% (Lv13, C5+)
    new StatBuff(cbs(this, "E", ["E"]), { receiver: "onField" }, [
      { key: "resReduction%", value: this.constellation >= 5 ? 0.34 : 0.25 },
    ]),
    // Q Pale Hymn: Bloom/Hyperbloom/Burgeon DMG + EM×500%/590.2%
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      {
        receiver: "team",
        filter: { reactions: ["bloom", "hyperbloom", "burgeon"] },
      },
      [],
      "em",
      "baseDmg",
      this.constellation >= 3 ? 5.902 : 5.0
    ),
    // Q Pale Hymn: Lunar-Bloom DMG + EM×400%/472.3%
    new ScalingBuff(
      cbs(this, "Q", ["Q"]),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      [],
      "em",
      "baseDmg",
      this.constellation >= 3 ? 4.723 : 4.0
    ),
    // C2 (Ascendant Gleam): Lunar-Bloom DMG +40%
    new StaticSkillBuff(
      cbs(this, "C2", []),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "reactionDmg%", value: 0.4 }] : [])
    ),
    // C6: Lunar-Bloom elevated 25%
    new StaticSkillBuff(
      cbs(this, "C6", []),
      { receiver: "team", filter: { reactions: ["lunarBloom"] } },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "elevated%", value: 0.25 }] : [])
    ),
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

    return {
      "lauma-press": {
        label: { zh: "E 狩猎祷歌", en: "E Hymn of Hunting" },
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
        label: { zh: "E 霜林圣域(单次)", en: "E Frostgrove Sanctuary (×1)" },
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
      ...(hasHydro
        ? {
            "lauma-hold": {
              label: {
                zh: "【如有水队友】E长按伤害",
                en: "E Hold DMG (3 Verdant Dews)",
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
                  formula: new DirectFormula(
                    0,
                    {
                      element: "Dendro",
                      ability: "skill",
                      reaction: "lunarBloom",
                    },
                    "atk",
                    { key: "em", multiplier: hold2Mult * 3 }
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
                zh: "【C6】普攻1段伤害",
                en: "C6 Normal 1-Hit DMG",
              },
              parts: [
                {
                  formula: new DirectFormula(
                    0,
                    {
                      element: "Dendro",
                      ability: "normal",
                      reaction: "lunarBloom",
                    },
                    "atk",
                    { key: "em", multiplier: 1.5 }
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
      cbs(this, "P2", ["passive"]),
      { receiver: "team", filter: { reactions: ["lunarCharged"] } },
      [],
      "atk",
      "baseDmg%",
      0.00007,
      0.14
    ),
    // P2: After Q, team EM = 6% of Ineffa ATK
    new ScalingBuff(
      cbs(this, "P2", ["Q"]),
      { receiver: "team" },
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
  // Q: Lv10 1218.2%, Lv13 (C5+) 1438.2%
  protected readonly formulaMap = (() => {
    const dischargeMult = this.constellation >= 3 ? 2.04 : 1.728;
    const qMult = this.constellation >= 5 ? 14.382 : 12.182;
    return {
      "ineffa-birgitta": {
        label: { zh: "E 薇尔琪塔放电(×10)", en: "E Birgitta Discharge (×10)" },
        parts: [
          {
            formula: new DirectFormula(dischargeMult, {
              element: "Electro",
              ability: "skill",
              reaction: "none",
            }),
            hits: 10,
          },
        ],
      },
      "ineffa-burst": {
        label: { zh: "Q 至高律令", en: "Q Cyclonic Exterminator" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Electro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}
