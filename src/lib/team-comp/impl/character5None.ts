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
// 5★ None Characters
// ═══════════════════════════════════════════════════════════════

const durinOption = {
  label: { zh: "形态", en: "Form" },
  choices: [
    { value: "white", label: { zh: "白焰之龙", en: "White Flame" } },
    { value: "dark", label: { zh: "黑蚀之龙", en: "Dark Decay" } },
  ] as const,
  default: "white",
} satisfies OptionDef;

@RegisterCharacter("durin", durinOption)
class Durin extends CharacterBase {
  private readonly form = resolveOption(durinOption, this.option);

  readonly buffs = (() => {
    const isHexerei = this.teamMeta.countByFaction("Hexerei") >= 2;
    // P4: Hexerei Secret Rite enhances P1 effects by 75%
    const hexMult = isHexerei ? 1.75 : 1.0;
    const isWhite = this.form === "white";

    const buffs: InstanceType<
      typeof StatBuff | typeof StaticSkillBuff | typeof ScalingBuff
    >[] = [];

    if (isWhite) {
      // P1 (White Flame): Pyro RES -20% (×hexMult) on Pyro/Burning reactions
      const canPyroReact =
        this.teamMeta.hasReaction("vaporize") ||
        this.teamMeta.hasReaction("melt") ||
        this.teamMeta.hasReaction("overloaded") ||
        this.teamMeta.hasReaction("burning") ||
        this.teamMeta.hasReaction("burgeon") ||
        this.teamMeta.hasReaction("swirl") ||
        this.teamMeta.hasReaction("crystallize");

      if (canPyroReact) {
        buffs.push(
          new StatBuff(
            cbs(
              this,
              [
                "Q",
                "vaporize",
                "melt",
                "overloaded",
                "burning",
                "burgeon",
                "swirl",
                "crystallize",
              ],
              "P1"
            ),
            { receiver: "onField" },
            [{ key: "resReduction%", value: 0.2 * hexMult }]
          )
        );
      }
    } else {
      // P1 (Dark Decay): Vaporize/Melt DMG +40% (×hexMult)
      buffs.push(
        new StatBuff(
          cbs(this, ["Q"], "P1"),
          {
            receiver: "selfOnField",
            filter: { reactions: ["vaporize", "melt"] },
          },
          [{ key: "reactionDmg%", value: 0.4 * hexMult }]
        )
      );
    }

    // P2: After Q, per 100 ATK → burst tick DMG +3% (cap 75%) — modeled as baseDmg%
    // baseDmg% is the correct key for "deal X% of original damage"
    buffs.push(
      new ScalingBuff(
        cbs(this, ["Q"], "P2"),
        { receiver: "selfOnField", filter: { abilities: ["burst"] } },
        [],
        "atk",
        "baseDmg%",
        0.0003,
        0.75
      )
    );

    // C1 (White Flame): On-field team baseDmg from ATK ×60% per stack, 20 stacks
    // C1 (Dark Decay): Self baseDmg from ATK ×150% per stack, 20 stacks (consumes 2)
    // Modeled as flat baseDmg scaling from ATK — 20 triggers for White, 10 for Dark
    if (this.constellation >= 1) {
      if (isWhite) {
        buffs.push(
          new ScalingBuff(
            cbs(this, ["Q"], "C1"),
            { receiver: "onField" },
            [],
            "atk",
            "baseDmg",
            0.6
          )
        );
      } else {
        buffs.push(
          new ScalingBuff(
            cbs(this, ["Q"], "C1"),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [],
            "atk",
            "baseDmg",
            1.5
          )
        );
      }
    }

    // C2: After burst, Pyro DMG +50% for team (+ reaction element)
    if (this.constellation >= 2) {
      buffs.push(
        new StatBuff(cbs(this, ["Q"], "C2"), { receiver: "team" }, [
          { key: "pyro%", value: 0.5 },
        ])
      );
    }

    // C4: Burst DMG +40%
    if (this.constellation >= 4) {
      buffs.push(
        new StatBuff(
          cbs(this, [], "C4"),
          { receiver: "selfOnField", filter: { abilities: ["burst"] } },
          [{ key: "dmg%", value: 0.4 }]
        )
      );
    }

    // C6: Burst ignores 30% DEF (always)
    // White Flame: enemy DEF -30% (team debuff)
    // Dark Decay: ignores additional 40% DEF (total 70%)
    if (this.constellation >= 6) {
      if (isWhite) {
        buffs.push(
          new StatBuff(
            cbs(this, ["Q"], "C6"),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "defIgnore%", value: 0.3 }]
          ),
          new StatBuff(cbs(this, ["Q"], "C6"), { receiver: "onField" }, [
            { key: "defReduction%", value: 0.3 },
          ])
        );
      } else {
        buffs.push(
          new StatBuff(
            cbs(this, ["Q"], "C6"),
            { receiver: "selfOnField", filter: { abilities: ["burst"] } },
            [{ key: "defIgnore%", value: 0.7 }]
          )
        );
      }
    }

    return buffs;
  })();

  // E: White/Dark form skill hits
  // Q: Burst initial + Dragon ticks
  protected readonly formulaMap: Record<string, FormulaEntry> = ((): Record<
    string,
    FormulaEntry
  > => {
    const isWhite = this.form === "white";
    // E (Confirmation of Purity): Lv10 190.1%, Lv13 (C5+) 224.4%
    // E (Denial of Darkness): Lv10 130%+95.8%+116.4%=342.2%, Lv13 (C5+) 153.5%+113.1%+137.4%=404%
    const eWhiteMult = this.constellation >= 5 ? 2.244 : 1.901;
    const eDarkMult = this.constellation >= 5 ? 4.04 : 3.422;

    // Q initial (White): Lv10 214.1%+173.5%+201.3%=588.9%, Lv13 (C3+) 252.8%+204.9%+237.7%=695.4%
    // Q initial (Dark): Lv10 225.8%+183.2%+201.3%=610.3%, Lv13 (C3+) 266.6%+216.2%+237.7%=720.5%
    const qWhiteInitMult = this.constellation >= 3 ? 6.954 : 5.889;
    const qDarkInitMult = this.constellation >= 3 ? 7.205 : 6.103;

    // Dragon ticks (White): Lv10 170.4%, Lv13 (C3+) 201.1%, ~6 ticks over 20s
    // Dragon ticks (Dark): Lv10 233.7%, Lv13 (C3+) 275.9%, ~6 ticks over 20s
    const dragonWhiteMult = this.constellation >= 3 ? 2.011 : 1.704;
    const dragonDarkMult = this.constellation >= 3 ? 2.759 : 2.337;

    const burstTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
    };
    const skillTag = {
      element: "Pyro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };

    if (isWhite) {
      return {
        "durin-skill-white": {
          label: { zh: "白化之是", en: "Confirmation of Purity" },
          parts: [{ formula: new DirectFormula(eWhiteMult, skillTag) }],
        },
        "durin-burst-white": {
          label: { zh: "白焰之龙总伤", en: "White Flame Burst + Dragon" },
          parts: [
            { formula: new DirectFormula(qWhiteInitMult, burstTag) },
            { formula: new DirectFormula(dragonWhiteMult, burstTag), hits: 6 },
          ],
        },
      };
    }
    return {
      "durin-skill-dark": {
        label: { zh: "黑度之否", en: "Denial of Darkness" },
        parts: [{ formula: new DirectFormula(eDarkMult, skillTag) }],
      },
      "durin-burst-dark": {
        label: { zh: "黑蚀之龙总伤", en: "Dark Decay Burst + Dragon" },
        parts: [
          { formula: new DirectFormula(qDarkInitMult, burstTag) },
          { formula: new DirectFormula(dragonDarkMult, burstTag), hits: 6 },
        ],
      },
      "durin-burst-dark-vape": {
        label: { zh: "黑蚀之龙(蒸发)", en: "Dark Decay Burst (Vape)" },
        parts: [
          {
            formula: new AmplifyFormula(qDarkInitMult, {
              ...burstTag,
              reaction: "vaporize",
            }),
          },
          {
            formula: new AmplifyFormula(dragonDarkMult, {
              ...burstTag,
              reaction: "vaporize",
            }),
            hits: 6,
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("varka")
class Varka extends CharacterBase {
  readonly buffs = [
    // P1: Per 1000 ATK → +10% Anemo & Secondary Element (cap 25%)
    // Simplified as general DMG% to cover both.
    new ScalingBuff(
      cbs(this, ["Q"], "P1"),
      { receiver: "selfOnField" },
      [],
      "atk",
      "dmg%",
      0.0001,
      0.25
    ),
    // P1: Dual-element team gives 220% multiplier (baseDmg% +1.2) for NA/CA/E
    new StatBuff(
      cbs(this, ["team-comp"], "P1"),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      [{ key: "baseDmg%", value: 1.2 }]
    ),
    // P2: Swirl → +7.5% DMG per stack (max 4 = 30%)
    new StatBuff(
      cbs(this, ["swirl"], "P2"),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      [{ key: "dmg%", value: 0.3 }]
    ),
    // C4: Swirl → team gets 20% Anemo & Secondary (simplified as general DMG%)
    new StaticSkillBuff(
      cbs(this, ["swirl"], "C4"),
      { receiver: "team" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "dmg%", value: 0.2 }] : [])
    ),
    // C6: P2 stacks also give +20% CD each (max 4 = 80%)
    new StaticSkillBuff(
      cbs(this, ["swirl"], "C6"),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      this.constellation,
      (c) => (c >= 6 ? [{ key: "cd", value: 0.8 }] : [])
    ),
  ];

  // Sturm und Drang N5 (Lv10): 161.7+59.3+110.1+80.1+148.8+137.0+73.8+172.3+92.8 = 1035.9%
  // Northwind Avatar (Lv10): 606.5% + 326.6% = 933.1%
  // Northwind Avatar (Lv13 C5+): 716.0% + 385.6% = 1101.6%
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 5 ? 11.016 : 9.331;
    return {
      "varka-e-normal": {
        label: { zh: "狂飙突进全套连击", en: "Sturm und Drang N5 Combo" },
        parts: [
          {
            formula: new DirectFormula(10.359, {
              element: "Anemo", // represents combined elements
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "varka-burst": {
        label: { zh: "我即朔风(双重斩击)", en: "Northwind Avatar" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Anemo", // represents combined elements
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("skirk")
class Skirk extends CharacterBase {
  readonly buffs = [
    // P2: Death's Crossing max 3 stacks → Normal ATK in E-mode = 170% original (+70%)
    new StatBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "baseDmg%", value: 0.7 }]
    ),
    // P2: Burst DMG = 160% original (+60%)
    new StatBuff(
      cbs(this, ["E"], "P2"),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [{ key: "baseDmg%", value: 0.6 }]
    ),
    // C2: After Havoc: Extinction (E-mode Q), ATK +70% for 12.5s
    new StaticSkillBuff(
      cbs(this, ["Q"], "C2"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 2 ? [{ key: "atk%", value: 0.7 }] : [])
    ),
    // C4: Each Death's Crossing stack also ATK +10%/20%/40%. Max 3 stacks = 40%
    new StaticSkillBuff(
      cbs(this, ["E"], "C4"),
      { receiver: "selfOnField" },
      this.constellation,
      (c) => (c >= 4 ? [{ key: "atk%", value: 0.4 }] : [])
    ),
  ];

  // E Normal Combo (Lv10): 262.6+236.8+299.4+318.4+388.7 = 1505.9%
  // E Normal Combo (Lv13 C3+): 318.2+287.0+362.8+385.8+471.0 = 1824.8%
  // Q Burst w/ +12 Subtlety (Lv10): 5*221.0 + 368.3 + 12*34.78 = 1890.7%
  // Q Burst w/ +12 Subtlety (Lv13 C5+): 5*260.9 + 434.8 + 12*41.06 = 2232.0%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 18.248 : 15.059;
    const qMult = this.constellation >= 3 ? 22.32 : 18.907;
    return {
      "skirk-e-normal": {
        label: { zh: "七相一闪全套连续攻击", en: "Seven-Phase Flash NA Combo" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Cryo",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "skirk-burst": {
        label: { zh: "极恶技·灭(满狡谋)", en: "Havoc: Ruin (Max Subtlety)" },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Cryo",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("aloy")
class Aloy extends CharacterBase {
  // No constellations available — collab-exclusive character
  readonly buffs = [
    // P1: Self ATK +16% when gaining Coil, other party members ATK +8% (10s)
    new StatBuff(cbs(this, ["E"], "P1"), { receiver: "selfOnField" }, [
      { key: "atk%", value: 0.16 },
    ]),
    new StatBuff(cbs(this, ["E"], "P1"), { receiver: "team" }, [
      { key: "atk%", value: 0.08 },
    ]),
    // P2: During Rushing Ice, Cryo DMG +3.5%/s for max 10s = +35%
    new StatBuff(cbs(this, ["E"], "P2"), { receiver: "selfOnField" }, [
      { key: "cryo%", value: 0.35 },
    ]),
  ];

  protected readonly formulaMap = {
    "aloy-burst": {
      label: { zh: "元素爆发", en: "Prophecies of Dawn" },
      parts: [
        {
          formula: new DirectFormula(6.47, {
            element: "Cryo",
            ability: "burst",
            reaction: "none",
          }),
        },
      ],
    },
  };
}
