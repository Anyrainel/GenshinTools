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
  RegisterCharacter,
  type StatSheet,
  resolveOption,
} from "../damageModels";
import { cbs } from "../helpers";
import type { CalcContext, DamageTag, DisplayPart, OptionDef } from "../types";

class ArlecchinoNormalFormula extends DirectFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly hitIndex: number,
    private readonly initialBol: number,
    private readonly masqueScale: number
  ) {
    super(talentMultiplier, tag, "atk");
  }

  private getBol() {
    return this.initialBol * 0.925 ** this.hitIndex;
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const currentBol = this.getBol();
    const talentDmg = stats.get(this.scalingKey) * this.talentMultiplier;
    const extraBaseDmg = stats.get("atk") * currentBol * this.masqueScale;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const currentBol = this.getBol();
    const extraBaseDmg = stats.get("atk") * currentBol * this.masqueScale;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

class ArlecchinoNormalAmplifyFormula extends AmplifyFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly hitIndex: number,
    private readonly initialBol: number,
    private readonly masqueScale: number
  ) {
    super(talentMultiplier, tag, "atk");
  }

  private getBol() {
    return this.initialBol * 0.925 ** this.hitIndex;
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const currentBol = this.getBol();
    const talentDmg = stats.get(this.scalingKey) * this.talentMultiplier;
    const extraBaseDmg = stats.get("atk") * currentBol * this.masqueScale;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const currentBol = this.getBol();
    const extraBaseDmg = stats.get("atk") * currentBol * this.masqueScale;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

class ArlecchinoBurstFormula extends DirectFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly initialBol: number,
    private readonly hasC6: boolean
  ) {
    super(talentMultiplier, tag, "atk");
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const talentDmg = stats.get(this.scalingKey) * this.talentMultiplier;
    const extraBaseDmg = this.hasC6
      ? stats.get("atk") * this.initialBol * 7.0
      : 0;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const extraBaseDmg = this.hasC6
      ? stats.get("atk") * this.initialBol * 7.0
      : 0;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

class ArlecchinoBurstAmplifyFormula extends AmplifyFormula {
  constructor(
    talentMultiplier: number,
    tag: DamageTag,
    private readonly initialBol: number,
    private readonly hasC6: boolean
  ) {
    super(talentMultiplier, tag, "atk");
  }

  protected override getBaseDmg(stats: StatSheet): number {
    const talentDmg = stats.get(this.scalingKey) * this.talentMultiplier;
    const extraBaseDmg = this.hasC6
      ? stats.get("atk") * this.initialBol * 7.0
      : 0;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const part = super.display(stats, charLevel, ctx);
    const extraBaseDmg = this.hasC6
      ? stats.get("atk") * this.initialBol * 7.0
      : 0;
    part.statValues = {
      ...part.statValues,
      baseDmg: (part.statValues.baseDmg || 0) + extraBaseDmg,
    };
    return part;
  }
}

// ═══════════════════════════════════════════════════════════════
// 5★ Snezhnaya Characters
// ═══════════════════════════════════════════════════════════════

const arlecchinoOption = {
  label: { zh: "初始生命之契", en: "Initial BoL" },
  choices: [
    { value: "130", label: { zh: "130% 生命之契", en: "130%" } },
    { value: "155", label: { zh: "155% 生命之契", en: "155%" } },
    { value: "200", label: { zh: "200% 生命之契", en: "200%" } },
  ] as const,
  default: "130",
} satisfies OptionDef;

@RegisterCharacter("arlecchino", arlecchinoOption)
class Arlecchino extends CharacterBase {
  private readonly initialBolStr = resolveOption(arlecchinoOption, this.option);

  readonly buffs = [
    // P3: In combat, unconditional Pyro DMG +40%
    new StatBuff(cbs(this, "P3", []), { receiver: "selfOnField" }, [
      { key: "pyro%", value: 0.4 },
    ]),
    // C6: After E, Normal ATK and Q: CR +10%, CD +70% for 20s
    new StaticSkillBuff(
      cbs(this, "C6", ["E"]),
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

  get formulaMap() {
    const c3Plus = this.constellation >= 3;
    const nMults = c3Plus
      ? [1.138, 1.248, 1.566, 0.89, 0.89, 1.676, 2.045]
      : [0.939, 1.03, 1.293, 0.734, 0.734, 1.383, 1.688];
    const initialBol = Number.parseInt(this.initialBolStr) / 100;
    const baseMasque = c3Plus ? 2.884 : 2.38;
    const masqueScale = this.constellation >= 1 ? baseMasque + 1.0 : baseMasque;

    const qMult = this.constellation >= 5 ? 7.871 : 6.667;

    const normalBaseTag = {
      element: "Pyro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const normalMeltTag = { ...normalBaseTag, reaction: "melt" as const };
    const normalVapeTag = { ...normalBaseTag, reaction: "vaporize" as const };
    const qMeltTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "melt" as const,
    };
    const qVapeTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "vaporize" as const,
    };

    const comboParts = nMults.map((mult, i) => ({
      formula: new ArlecchinoNormalFormula(
        mult,
        normalBaseTag,
        i,
        initialBol,
        masqueScale
      ),
    }));

    const comboMeltParts = nMults.map((mult, i) => ({
      formula:
        i === 0 || i === 3
          ? new ArlecchinoNormalAmplifyFormula(
              mult,
              normalMeltTag,
              i,
              initialBol,
              masqueScale
            )
          : new ArlecchinoNormalFormula(
              mult,
              normalBaseTag,
              i,
              initialBol,
              masqueScale
            ),
    }));

    const comboVapeParts = nMults.map((mult, i) => ({
      formula:
        i === 0 || i === 3
          ? new ArlecchinoNormalAmplifyFormula(
              mult,
              normalVapeTag,
              i,
              initialBol,
              masqueScale
            )
          : new ArlecchinoNormalFormula(
              mult,
              normalBaseTag,
              i,
              initialBol,
              masqueScale
            ),
    }));

    const hasCryo =
      this.teamMeta.elements[this.charId] === "Cryo" ||
      Object.keys(this.teamMeta.elements).some(
        (k) => k !== this.charId && this.teamMeta.elements[k] === "Cryo"
      );
    const hasHydro =
      this.teamMeta.elements[this.charId] === "Hydro" ||
      Object.keys(this.teamMeta.elements).some(
        (k) => k !== this.charId && this.teamMeta.elements[k] === "Hydro"
      );

    return {
      "arlecchino-normal": {
        label: {
          zh: "A 普攻连段(6段7击)",
          en: "A Normal Combo (6-Hit 7-Strike)",
        },
        parts: comboParts,
      },
      ...(hasCryo
        ? {
            "arlecchino-normal-melt": {
              label: {
                zh: "A 普攻连段(融化1/4段)",
                en: "A Normal Combo (Melt)",
              },
              parts: comboMeltParts,
            },
            "arlecchino-burst-melt": {
              label: { zh: "Q 厄月将升(融化)", en: "Q Balemoon Rising (Melt)" },
              parts: [
                {
                  formula: new ArlecchinoBurstAmplifyFormula(
                    qMult,
                    qMeltTag,
                    initialBol,
                    this.constellation >= 6
                  ),
                },
              ],
            },
          }
        : {}),
      ...(hasHydro
        ? {
            "arlecchino-normal-vape": {
              label: {
                zh: "A 普攻连段(蒸发1/4段)",
                en: "A Normal Combo (Vape)",
              },
              parts: comboVapeParts,
            },
            "arlecchino-burst-vape": {
              label: { zh: "Q 厄月将升(蒸发)", en: "Q Balemoon Rising (Vape)" },
              parts: [
                {
                  formula: new ArlecchinoBurstAmplifyFormula(
                    qMult,
                    qVapeTag,
                    initialBol,
                    this.constellation >= 6
                  ),
                },
              ],
            },
          }
        : {}),
      "arlecchino-burst": {
        label: { zh: "Q 厄月将升", en: "Q Balemoon Rising" },
        parts: [
          {
            formula: new ArlecchinoBurstFormula(
              qMult,
              normalBaseTag,
              initialBol,
              this.constellation >= 6
            ),
          },
        ],
      },
    };
  }
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
    const blastMult = this.constellation >= 5 ? 2.55 : 2.16;
    return {
      "tartaglia-melee-combo": {
        label: { zh: "E 魔王武装 N3C 连击", en: "E Melee N3C Combo" },
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
          zh: "Q近战+断流·爆伤害",
          en: "Q Light of Obliteration (Melee)",
        },
        parts: [
          {
            formula: new DirectFormula(qMult, {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(blastMult, {
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
