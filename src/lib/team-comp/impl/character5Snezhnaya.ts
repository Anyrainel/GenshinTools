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
// 5★ Snezhnaya Characters
// ═══════════════════════════════════════════════════════════════

@RegisterCharacter("arlecchino")
class Arlecchino extends CharacterBase {
  readonly buffs = [
    // P3: In combat, unconditional Pyro DMG +40%
    new StatBuff(cbs(this, [], "P3"), { receiver: "selfOnField" }, [
      { key: "pyro%", value: 0.4 },
    ]),
    // Masque of Red Death: ATK × 238% × BoL% added to Normal ATK damage
    // At 100% BoL (assumed): 238% ATK → baseDmg on normals
    // Lv10: 238%, Lv13 (C3+): 288.4%; C1 adds +100% → total doubled
    new ScalingSkillBuff(
      cbs(this, ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal"] } },
      [],
      "atk",
      "baseDmg",
      this.constellation,
      (c) => {
        const base = c >= 3 ? 2.884 : 2.38;
        return { scale: c >= 1 ? base + 1.0 : base };
      }
    ),
    // C6: After E, Normal ATK and Q: CR +10%, CD +70% for 20s
    new StaticSkillBuff(
      cbs(this, ["E"], "C6"),
      { receiver: "selfOnField", filter: { abilities: ["normal", "burst"] } },
      this.constellation,
      (c) =>
        c >= 6
          ? [
              { key: "cr", value: 0.1 },
              { key: "cd", value: 0.7 },
            ]
          : []
    ),
  ];

  protected readonly formulaMap = (() => {
    // N1-N6 combo: Lv10 93.9+103+129.3+146.8+138.3+168.8 = 780.1%
    // Lv13 (C3+ via N): 113.8+124.8+156.6+178+167.6+204.5 = 945.3%
    const nMult = this.constellation >= 3 ? 9.453 : 7.801;
    return {
      "arlecchino-normal": {
        label: { zh: "普攻连段(红死)", en: "Normal Combo (Red Death)" },
        parts: [
          {
            formula: new DirectFormula(nMult, {
              element: "Pyro",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "arlecchino-normal-vape": {
        label: { zh: "普攻连段(蒸发)", en: "Normal Combo (Vape)" },
        parts: [
          {
            formula: new AmplifyFormula(nMult, {
              element: "Pyro",
              ability: "normal",
              reaction: "vaporize",
            }),
          },
        ],
      },
    };
  })();
}

@RegisterCharacter("tartaglia")
class Tartaglia extends CharacterBase {
  readonly buffs = [
    // P3: +1 Normal ATK level for party (not modeled as stat buff)
    // P1: Riptide extends duration (utility)
    // C4: Riptide triggers every 4s (utility)
  ];

  // Melee N3C (Lv10): 76.8 + 82.3 + 111.3 + 119.0 + 142.3 = 531.7%
  // Melee N3C (Lv13 C3+): 93.1 + 99.7 + 134.9 + 144.2 + 172.4 = 644.3%
  // Burst Melee (Lv10): 835.0%
  // Burst Melee (Lv13 C5+): 986.0%
  protected readonly formulaMap = (() => {
    const eMult = this.constellation >= 3 ? 6.443 : 5.317;
    const qMult = this.constellation >= 5 ? 9.86 : 8.35;
    return {
      "tartaglia-melee-combo": {
        label: { zh: "魔王武装 N3C 连击", en: "Melee N3C Combo" },
        parts: [
          {
            formula: new DirectFormula(eMult, {
              element: "Hydro",
              ability: "normal",
              reaction: "none",
            }),
          },
        ],
      },
      "tartaglia-burst-melee": {
        label: {
          zh: "尽灭水光(近战大招)",
          en: "Light of Obliteration (Melee)",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
    };
  })();
}
