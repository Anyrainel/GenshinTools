import { ScalingBuff, StatBuff } from "../damageBuffs";
import {
  AmplifyFormula,
  CatalyzeFormula,
  type DamageFormula,
  DirectFormula,
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
import type {
  CalcContext,
  ComboDescriptor,
  DamageTag,
  DisplayPart,
} from "../types";

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
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const currentBol = this.getBol();
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = E.mul(
      stats.get("atk", this.tag),
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
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
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
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const currentBol = this.getBol();
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = E.mul(
      stats.get("atk", this.tag),
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
    const extraBaseDmg =
      stats.get("atk", this.tag) * currentBol * this.masqueScale;
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
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg = this.hasC6
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
      : 0;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = this.hasC6
      ? E.mul(stats.get("atk", this.tag), E.const(this.initialBol * 7.0))
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
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
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
    const talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    const extraBaseDmg = this.hasC6
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
      : 0;
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag) + extraBaseDmg;
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  protected override getBaseDmgExpr(stats: ExprStats): Expr {
    const talentDmg = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    const extraBaseDmg = this.hasC6
      ? E.mul(stats.get("atk", this.tag), E.const(this.initialBol * 7.0))
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
      ? stats.get("atk", this.tag) * this.initialBol * 7.0
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
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "arlecchino-normal", count: 3 },
      { id: "arlecchino-burst", count: 1 },
      { id: "arlecchino-c2-bloodfire", count: 1 },
    ];
  }

  get formulaMap() {
    const nMults = [
      this.param("A", 1),
      this.param("A", 2),
      this.param("A", 3),
      this.param("A", 4),
      this.param("A", 4),
      this.param("A", 5),
      this.param("A", 6),
    ];
    const initialBol = Number.parseInt(this.initialBolStr) / 100;
    const masqueScale =
      this.constellation >= 1 ? this.param("A", 12) + 1.0 : this.param("A", 12);

    const normalBaseTag = {
      element: "Pyro" as const,
      ability: "normal" as const,
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
          en: "Normal (6N 7-Hit)",
        },
        parts: comboParts,
      },
      "arlecchino-burst": {
        label: { zh: "Q伤害", en: "Q" },
        parts: [
          {
            formula: new ArlecchinoBurstFormula(
              this.param("Q", 1),
              { element: "Pyro", ability: "burst", reaction: "none" },
              initialBol,
              this.constellation >= 6
            ),
          },
        ],
      },
      "arlecchino-e-cleave": {
        label: { zh: "E切斩", en: "E Cleave" },
        parts: [
          {
            formula: new DirectFormula(this.param("E", 2), {
              element: "Pyro",
              ability: "skill",
              reaction: "none",
            }),
          },
        ],
      },
      "arlecchino-c2-bloodfire": {
        label: { zh: "厄月血火", en: "Balemoon Bloodfire" },
        minC: 2,
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
    };
  }
}

@RegisterCharacter("tartaglia")
class Tartaglia extends CharacterBase {
  readonly buffs = [
    // P3: +1 Normal ATK level for party — handled by CharacterBase._effectiveLevels
    // P1: Riptide extends duration (utility)
    // C4: Riptide triggers every 4s (utility)
  ];

  // Rotation: rQ > E > 4[N3C] (~9s melee, International team, KQM)
  protected override get comboDescriptor(): ComboDescriptor {
    return [
      { id: "tartaglia-melee-combo", count: 4 },
      { id: "tartaglia-burst-melee", count: 1 },
      { id: "tartaglia-riptide-slash", count: 6 },
      { id: "tartaglia-stance-change", count: 1 },
    ];
  }

  // Burst Melee (Lv10): 835.0%
  // Burst Melee (Lv13 C5+): 986.0%
  protected readonly formulaMap = (() => {
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
    const meleeSkillTag = {
      element: "Hydro" as const,
      ability: "skill" as const,
      reaction: "none" as const,
    };
    return {
      "tartaglia-melee-combo": {
        label: { zh: "E普攻+重击", en: "E Melee N3C Combo" },
        parts: [
          { formula: new DirectFormula(this.param("E", 2), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 3), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 4), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 9), meleeChargeTag) },
          { formula: new DirectFormula(this.param("E", 10), meleeChargeTag) },
        ],
      },
      "tartaglia-melee-n4n5n6": {
        label: { zh: "E近战N4+N5+N6", en: "E Melee N4+N5+N6" },
        parts: [
          { formula: new DirectFormula(this.param("E", 5), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 6), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 7), meleeNormalTag) },
          { formula: new DirectFormula(this.param("E", 8), meleeNormalTag) },
        ],
      },
      "tartaglia-burst-melee": {
        label: {
          zh: "Q斩击+断流爆发",
          en: "Q Slash + Riptide",
        },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 1), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
          {
            formula: new DirectFormula(this.param("Q", 2), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "tartaglia-burst-ranged": {
        label: { zh: "Q远程", en: "Q Ranged" },
        parts: [
          {
            formula: new DirectFormula(this.param("Q", 3), {
              element: "Hydro",
              ability: "burst",
              reaction: "none",
            }),
          },
        ],
      },
      "tartaglia-riptide-slash": {
        label: { zh: "断流·斩", en: "Riptide Slash" },
        parts: [
          { formula: new DirectFormula(this.param("E", 11), meleeSkillTag) },
        ],
      },
      "tartaglia-stance-change": {
        label: { zh: "E状态激发", en: "E Stance Change" },
        parts: [
          { formula: new DirectFormula(this.param("E", 1), meleeSkillTag) },
        ],
      },
    };
  })();
}
