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
// 5★ None Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("varka")
class Varka extends CharacterBase {
  readonly buffs = [
    // P1: Per 1000 ATK → +10% Anemo & Secondary Element (cap 25%)
    // Simplified as general DMG% to cover both.
    new ScalingBuff(
      cbs(this, "P1", ["Q"]),
      { receiver: "selfOnField" },
      [],
      "atk",
      "dmg%",
      0.0001,
      0.25
    ),
    // P1: Dual-element team gives 220% multiplier (baseDmg% +1.2) for NA/CA/E
    new StatBuff(
      cbs(this, "P1", ["team-comp"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      [{ key: "baseDmg%", value: 1.2 }]
    ),
    // P2: Swirl → +7.5% DMG per stack (max 4 = 30%)
    new StatBuff(
      cbs(this, "P2", ["swirl"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      [{ key: "dmg%", value: 0.3 }]
    ),
    // C4: Swirl → team gets 20% Anemo & Secondary (simplified as general DMG%)
    new StatBuff(
      cbs(this, "C4", ["swirl"]),
      { receiver: "team" },
      this.constellation >= 4 ? [{ key: "dmg%", value: 0.2 }] : []
    ),
    // C6: P2 stacks also give +20% CD each (max 4 = 80%)
    new StatBuff(
      cbs(this, "C6", ["swirl"]),
      {
        receiver: "selfOnField",
        filter: { abilities: ["normal", "charge", "skill"] },
      },
      this.constellation >= 6 ? [{ key: "cd", value: 0.8 }] : []
    ),
  ];

  // Sturm und Drang N5 (Lv10): 161.7+59.3+110.1+80.1+148.8+137.0+73.8+172.3+92.8 = 1035.9%
  // Northwind Avatar (Lv10): 606.5% + 326.6% = 933.1%
  // Northwind Avatar (Lv13 C5+): 716.0% + 385.6% = 1101.6%
  protected readonly formulaMap = (() => {
    const qMult = this.constellation >= 5 ? 11.016 : 9.331;
    return {
      "varka-e-normal": {
        label: { zh: "A 狂飙突进全套连击", en: "A Sturm und Drang N5 Combo" },
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
        label: { zh: "Q 我即朔风(双重斩击)", en: "Q Northwind Avatar" },
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
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [{ key: "baseDmg%", value: 0.7 }]
    ),
    // P2: Burst DMG = 160% original (+60%)
    new StatBuff(
      cbs(this, "P2", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["burst"] } },
      [{ key: "baseDmg%", value: 0.6 }]
    ),
    // C2: After Havoc: Extinction (E-mode Q), ATK +70% for 12.5s
    new StatBuff(
      cbs(this, "C2", ["Q"]),
      { receiver: "selfOnField" },
      this.constellation >= 2 ? [{ key: "atk%", value: 0.7 }] : []
    ),
    // C4: Each Death's Crossing stack also ATK +10%/20%/40%. Max 3 stacks = 40%
    new StatBuff(
      cbs(this, "C4", ["E"]),
      { receiver: "selfOnField" },
      this.constellation >= 4 ? [{ key: "atk%", value: 0.4 }] : []
    ),
  ];

  // E Normal Combo (Lv10): 262.6+236.8+299.4+318.4+388.7 = 1505.9%
  // E Normal Combo (Lv13 C3+): 318.2+287.0+362.8+385.8+471.0 = 1824.8%
  // Q Burst w/ +12 Subtlety (Lv10): 5*221.0 + 368.3 + 12*34.78 = 1890.7%
  // Q Burst w/ +12 Subtlety (Lv13 C5+): 5*260.9 + 434.8 + 12*41.06 = 2232.0%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 5 ? 18.248 : 15.059;
    const eChargeMult = this.constellation >= 5 ? 3.201 : 2.643; // 106.7*3=320.1, 88.1*3=264.3
    const qMult = this.constellation >= 3 ? 22.32 : 18.907;
    return {
      "skirk-e-normal": {
        label: {
          zh: "E七相一闪普攻一套（5段）伤害",
          en: "Seven-Phase Flash NA Combo (5-hit)",
        },
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
      "skirk-e-charge": {
        label: {
          zh: "E七相一闪重击伤害",
          en: "Seven-Phase Flash CA DMG",
        },
        parts: [
          {
            formula: new DirectFormula(eChargeMult, {
              element: "Cryo",
              ability: "charge",
              reaction: "none",
            }),
          },
        ],
      },
      "skirk-burst": {
        label: {
          zh: "满蛇之狡谋Q斩击全部伤害",
          en: "Havoc: Ruin (Max Subtlety)",
        },
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
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "selfOnField" }, [
      { key: "atk%", value: 0.16 },
    ]),
    new StatBuff(cbs(this, "P1", ["E"]), { receiver: "team" }, [
      { key: "atk%", value: 0.08 },
    ]),
    // P2: During Rushing Ice, Cryo DMG +3.5%/s for max 10s = +35%
    new StatBuff(cbs(this, "P2", ["E"]), { receiver: "selfOnField" }, [
      { key: "cryo%", value: 0.35 },
    ]),
  ];

  protected readonly formulaMap = {
    "aloy-burst": {
      label: { zh: "Q 元素爆发", en: "Q Prophecies of Dawn" },
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
