import { StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  type DamageFormula,
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
import type { OptionDef } from "../damageModels";
import { E, type Expr, simplify } from "../expr";
import type { ExprStats } from "../exprStats";
import { cbs } from "../helpers";
import type { CalcContext, DamageTag, DisplayPart } from "../types";

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

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const currentBol = this.getBol();
    const talentDmg = E.mul(
      stats.get(this.scalingKey),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = E.mul(
      stats.get("atk"),
      E.const(currentBol * this.masqueScale)
    );
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
  }

  override createAmplified(reaction: "vaporize" | "melt"): DamageFormula {
    return new ArlecchinoNormalAmplifyFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.hitIndex,
      this.initialBol,
      this.masqueScale
    );
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

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const currentBol = this.getBol();
    const talentDmg = E.mul(
      stats.get(this.scalingKey),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = E.mul(
      stats.get("atk"),
      E.const(currentBol * this.masqueScale)
    );
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
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

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const talentDmg = E.mul(
      stats.get(this.scalingKey),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = this.hasC6
      ? E.mul(stats.get("atk"), E.const(this.initialBol * 7.0))
      : E.const(0);
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
  }

  override createAmplified(reaction: "vaporize" | "melt"): DamageFormula {
    return new ArlecchinoBurstAmplifyFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.initialBol,
      this.hasC6
    );
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

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const talentDmg = E.mul(
      stats.get(this.scalingKey),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = this.hasC6
      ? E.mul(stats.get("atk"), E.const(this.initialBol * 7.0))
      : E.const(0);
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = E.add(stats.get("baseDmg", this.tag), extraBaseDmg);
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
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
    new StatBuff(cbs(this, "P3", []), { receiver: "self" }, [
      { key: "pyro%", value: 0.4 },
    ]),
    // C6: After E, Normal ATK and Q: CR +10%, CD +70% for 20s
    new StatBuff(
      cbs(this, "C6", ["E"]),
      { receiver: "selfOnField", filter: { abilities: ["normal", "burst"] } },
      this.constellation >= 6
        ? [
            { key: "cr", value: 0.1 },
            { key: "cd", value: 0.7 },
          ]
        : []
    ),
  ];

  // Rotation: E > teammates > C absorb > 6[N3D] > Q (KQM, ~20s carry window)
  protected override get defaultRotation() {
    return {
      "arlecchino-normal": 3,
      "arlecchino-burst": 1,
      "arlecchino-c2-bloodfire": 1,
    };
  }

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
    const burstBaseTag = {
      element: "Pyro" as const,
      ability: "burst" as const,
      reaction: "none" as const,
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

    return {
      "arlecchino-normal": {
        label: {
          zh: "普攻6段7击",
          en: "Normal Combo (6-Hit 7-Strike)",
        },
        parts: comboParts,
      },
      "arlecchino-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new ArlecchinoBurstFormula(
              qMult,
              burstBaseTag,
              initialBol,
              this.constellation >= 6
            ),
          },
        ],
      },
      ...(this.constellation >= 2
        ? {
            "arlecchino-c2-bloodfire": {
              label: { zh: "2命厄月血火", en: "C2 Balemoon Bloodfire" },
              parts: [
                {
                  formula: new DirectFormula(9.0, {
                    element: "Pyro",
                    ability: "skill",
                    reaction: "none",
                  }),
                },
              ],
            },
          }
        : {}),
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

  // Rotation: rQ > E > 4[N3C] (~9s melee, International team, KQM)
  protected override get defaultRotation() {
    return { "tartaglia-melee-combo": 4, "tartaglia-burst-melee": 1 };
  }

  // Burst Melee (Lv10): 835.0%
  // Burst Melee (Lv13 C5+): 986.0%
  protected readonly formulaMap = (() => {
    const c3Plus = this.constellation >= 3;
    const [n1, n2, n3] = c3Plus ? [0.931, 0.997, 1.349] : [0.768, 0.823, 1.113];
    const [ca1, ca2] = c3Plus ? [1.442, 1.724] : [1.19, 1.423];
    const qMult = this.constellation >= 5 ? 9.86 : 8.35;
    const blastMult = this.constellation >= 5 ? 2.55 : 2.16;
    const meleeNormalTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const meleeChargeTag = {
      element: "Hydro" as const,
      ability: "charge" as const,
      reaction: "none" as const,
    };
    return {
      "tartaglia-melee-combo": {
        label: { zh: "E普攻+重击", en: "E Melee N3C Combo" },
        parts: [
          { formula: new DirectFormula(n1, meleeNormalTag) },
          { formula: new DirectFormula(n2, meleeNormalTag) },
          { formula: new DirectFormula(n3, meleeNormalTag) },
          { formula: new DirectFormula(ca1, meleeChargeTag) },
          { formula: new DirectFormula(ca2, meleeChargeTag) },
        ],
      },
      "tartaglia-burst-melee": {
        label: {
          zh: "Q斩击+断流爆发",
          en: "Q Slash + Riptide Blast",
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
