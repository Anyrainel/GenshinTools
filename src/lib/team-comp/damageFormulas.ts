import type { StatSheet } from "./damageModels";
import { E, type Expr, simplify } from "./expr";
import type { ExprStats } from "./exprStats";
import type {
  CalcContext,
  DamageTag,
  DisplayPart,
  ReactionType,
  StatKey,
} from "./types";

const LEVEL_MULTIPLIERS: Record<number, number> = {
  70: 765.640231,
  80: 1077.443668,
  90: 1446.853458,
  95: 1561.468,
  100: 1674.8092,
};

// ─── Reaction Coefficients (for transformative reactions) ───

const TRANSFORMATIVE_COEFFICIENTS: Partial<Record<ReactionType, number>> = {
  burning: 0.25,
  superconduct: 1.5, // buffed in 5.2 (was 0.5)
  swirl: 0.6,
  electroCharged: 2.0, // buffed in 5.2 (was 1.2)
  shatter: 3.0, // buffed in 5.2 (was 1.5)
  overloaded: 2.75, // buffed in 5.2 (was 2.0)
  bloom: 2.0,
  burgeon: 3.0,
  hyperbloom: 3.0,
};

/**
 * Amplifying reaction coefficients by (reaction, triggeringElement).
 * Forward reactions (e.g., Pyro into Cryo = melt) = 2.0x
 * Reverse reactions (e.g., Cryo into Pyro = melt) = 1.5x
 */
const AMPLIFYING_BASES: Partial<
  Record<ReactionType, Partial<Record<string, number>>>
> = {
  melt: { Pyro: 2.0, Cryo: 1.5 },
  vaporize: { Hydro: 2.0, Pyro: 1.5 },
};

// ─── Catalyze (Additive) Coefficients ───

const CATALYZE_COEFFICIENTS: Partial<Record<ReactionType, number>> = {
  aggravate: 1.15,
  spread: 1.25,
};

// ─── Lunar Reaction Coefficients (reaction-based variant) ───

const LUNAR_REACTION_COEFFICIENTS: Partial<Record<ReactionType, number>> = {
  lunarCharged: 1.8,
  lunarCrystallize: 0.96,
  lunarBloom: 2.0,
};

/**
 * DirectCoeff for character abilities dealing Lunar DMG.
 * lunarCharged: ×3 (inline multiplier to talent scaling)
 * lunarCrystallize: ×1.6 (trailing multiplier)
 * lunarBloom: 1.0 (no extra coefficient — talent multiplier already accounts for it)
 */
const LUNAR_DIRECT_COEFFICIENTS: Partial<Record<ReactionType, number>> = {
  lunarCharged: 3.0,
  lunarCrystallize: 1.6,
  lunarBloom: 1.0,
};

// ═══════════════════════════════════════════════════════════════
// DamageFormula Hierarchy
// ═══════════════════════════════════════════════════════════════
//
// Covers the standard Genshin damage formulas (see DmgResearch.md).
// Each formula receives a DamageTag describing its full context:
// element, ability type, and reaction type.
//
// All stat reads use `stats.get(key, this.tag)` so that
// DamageTagFilter-scoped buffs are correctly included/excluded.

type ScalingKey = "atk" | "hp" | "def" | "em";

/** Additional stat term for talents that scale off two stats (e.g., X% ATK + Y% EM). */
type ExtraScalingTerm = { key: ScalingKey; multiplier: number };

export abstract class DamageFormula {
  constructor(
    readonly talentMultiplier: number,
    readonly tag: DamageTag,
    readonly scalingKey: ScalingKey = "atk",
    readonly extraTerm?: ExtraScalingTerm
  ) {
    this.validateReaction();
  }

  abstract calc(stats: StatSheet, charLevel: number, ctx: CalcContext): number;

  abstract display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart;

  /** Subclasses override to restrict which reaction types are valid. */
  protected validateReaction(): void {}

  /** Build the scalingKeys/scalingMulti arrays from constructor fields. */
  protected getScalingInfo(): { keys: StatKey[]; multi: number[] } {
    const keys: StatKey[] = [this.scalingKey];
    const multi: number[] = [this.talentMultiplier];
    if (this.extraTerm) {
      keys.push(this.extraTerm.key);
      multi.push(this.extraTerm.multiplier);
    }
    return { keys, multi };
  }

  protected computeDefMult(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): number {
    const defReduction = stats.get("defReduction%", this.tag);
    const defIgnore = stats.get("defIgnore%", this.tag);
    return (
      (charLevel + 100) /
      (charLevel +
        100 +
        (ctx.enemyLevel + 100) * (1 - defReduction) * (1 - defIgnore))
    );
  }

  protected computeResMult(stats: StatSheet, ctx: CalcContext): number {
    const resReduction = stats.get("resReduction%", this.tag);
    const effectiveRes = ctx.enemyRes - resReduction;

    if (effectiveRes < 0) {
      return 1 - effectiveRes / 2;
    }
    if (effectiveRes <= 0.75) {
      return 1 - effectiveRes;
    }
    return 1 / (1 + 4 * effectiveRes);
  }

  protected computeCritMult(stats: StatSheet, _ctx: CalcContext): number {
    const cr = stats.get("cr", this.tag) + stats.get("reactionCr", this.tag);
    const cd = stats.get("cd", this.tag) + stats.get("reactionCd", this.tag);

    // critRateTarget bonus is applied to all team members' stats in
    // TeamBuild.getTeamStats / getDisplayResult, so it's already in `cr`.
    // Always uses expected-value formula; display-layer critMode adjusts UI numbers.

    return 1 + Math.max(0, Math.min(cr, 1.0)) * cd;
  }

  protected computeDmgBonusMult(stats: StatSheet): number {
    // dmg% includes generic, ability-scoped, and element-scoped entries (element keys normalized in StatSheet)
    return 1 + stats.get("dmg%", this.tag);
  }

  /**
   * Base damage with multiplicative baseDmg% layer (§8.7, "deal X% original DMG").
   * Formula: talentDmg × (1 + baseDmg%) + flatBaseDmg
   */
  protected getBaseDmg(stats: StatSheet): number {
    let talentDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    if (this.extraTerm) {
      talentDmg +=
        stats.get(this.extraTerm.key, this.tag) * this.extraTerm.multiplier;
    }
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }

  // ─── Expr Builders (for AST-based compilation) ───

  /**
   * Build an Expr that computes the same value as calc().
   * Used by the formula compiler to generate optimized evaluation functions.
   */
  abstract buildExpr(
    stats: ExprStats,
    charLevel: number,
    ctx: CalcContext
  ): Expr;

  protected computeDefMultExpr(
    stats: ExprStats,
    charLevel: number,
    ctx: CalcContext
  ): Expr {
    const defReduction = stats.get("defReduction%", this.tag);
    const defIgnore = stats.get("defIgnore%", this.tag);
    const charDef = charLevel + 100;
    const enemyDef = ctx.enemyLevel + 100;
    // charDef / (charDef + enemyDef × (1 - defReduction) × (1 - defIgnore))
    return simplify(
      E.div(
        E.const(charDef),
        E.add(
          E.const(charDef),
          E.mul(
            E.const(enemyDef),
            E.add(E.const(1), E.mul(E.const(-1), defReduction)),
            E.add(E.const(1), E.mul(E.const(-1), defIgnore))
          )
        )
      )
    );
  }

  protected computeResMultExpr(stats: ExprStats, ctx: CalcContext): Expr {
    const resReduction = stats.get("resReduction%", this.tag);
    // resReduction% is almost always a constant (team buff, not artifact stat).
    // Resolve the 3-way branch at compile time if possible.
    if (resReduction.tag === "const") {
      const effectiveRes = ctx.enemyRes - resReduction.value;
      if (effectiveRes < 0) return E.const(1 - effectiveRes / 2);
      if (effectiveRes <= 0.75) return E.const(1 - effectiveRes);
      return E.const(1 / (1 + 4 * effectiveRes));
    }
    // Variable case (rare): build piecewise with min/max
    // effectiveRes = enemyRes - resReduction
    const effRes = E.add(
      E.const(ctx.enemyRes),
      E.mul(E.const(-1), resReduction)
    );
    // Use the middle branch (1 - effectiveRes) as the most common case
    // This is a simplification; for full piecewise we'd need conditional nodes.
    // In practice, resReduction is always constant.
    return simplify(E.add(E.const(1), E.mul(E.const(-1), effRes)));
  }

  protected computeCritMultExpr(stats: ExprStats, _ctx: CalcContext): Expr {
    const cr = E.add(
      stats.get("cr", this.tag),
      stats.get("reactionCr", this.tag)
    );
    const cd = E.add(
      stats.get("cd", this.tag),
      stats.get("reactionCd", this.tag)
    );
    // Always expected-value formula; display-layer critMode adjusts UI numbers.
    // 1 + clamp(cr, 0, 1) * cd
    return simplify(
      E.add(E.const(1), E.mul(E.clamp(cr, E.const(0), E.const(1)), cd))
    );
  }

  protected computeDmgBonusMultExpr(stats: ExprStats): Expr {
    return simplify(E.add(E.const(1), stats.get("dmg%", this.tag)));
  }

  protected getBaseDmgExpr(stats: ExprStats): Expr {
    let talentDmg: Expr = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    if (this.extraTerm) {
      talentDmg = E.add(
        talentDmg,
        E.mul(
          stats.get(this.extraTerm.key, this.tag),
          E.const(this.extraTerm.multiplier)
        )
      );
    }
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    // talentDmg × (1 + baseDmg%) + flatBaseDmg
    return simplify(
      E.add(E.mul(talentDmg, E.add(E.const(1), baseDmgPct)), flatBaseDmg)
    );
  }

  /** Create an amplified variant (vaporize/melt) with the same params. */
  createAmplified(reaction: "vaporize" | "melt"): DamageFormula {
    return new AmplifyFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.scalingKey,
      this.extraTerm
    );
  }

  /** Create a catalyzed variant (spread/aggravate) with the same params. */
  createCatalyzed(reaction: "spread" | "aggravate"): DamageFormula {
    return new CatalyzeFormula(
      this.talentMultiplier,
      { ...this.tag, reaction },
      this.scalingKey,
      this.extraTerm
    );
  }

  /** Create a direct (no reaction) variant with the same params. */
  createDirect(): DamageFormula {
    return new DirectFormula(
      this.talentMultiplier,
      { ...this.tag, reaction: "none" },
      this.scalingKey,
      this.extraTerm
    );
  }
}

/** Direct damage: BaseDmg × DmgBonus × DEFMult × RESMult × CritMult */
export class DirectFormula extends DamageFormula {
  protected override validateReaction(): void {
    if (this.tag.reaction !== "none") {
      throw new Error(
        `DirectFormula requires reaction "none", got "${this.tag.reaction}"`
      );
    }
  }

  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): number {
    const baseDmg = this.getBaseDmg(stats);
    const dmgBonusMult = this.computeDmgBonusMult(stats);
    const defMult = this.computeDefMult(stats, charLevel, ctx);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);
    const elevated = stats.get("elevated%", this.tag);

    return (
      baseDmg * dmgBonusMult * defMult * resMult * critMult * (1 + elevated)
    );
  }

  buildExpr(stats: ExprStats, charLevel: number, ctx: CalcContext): Expr {
    const baseDmg = this.getBaseDmgExpr(stats);
    const dmgBonusMult = this.computeDmgBonusMultExpr(stats);
    const defMult = this.computeDefMultExpr(stats, charLevel, ctx);
    const resMult = this.computeResMultExpr(stats, ctx);
    const critMult = this.computeCritMultExpr(stats, ctx);
    const elevated = stats.get("elevated%", this.tag);
    return simplify(
      E.mul(
        baseDmg,
        dmgBonusMult,
        defMult,
        resMult,
        critMult,
        E.add(E.const(1), elevated)
      )
    );
  }

  display(stats: StatSheet, charLevel: number, ctx: CalcContext): DisplayPart {
    const { keys, multi } = this.getScalingInfo();

    const baseDmg = this.getBaseDmg(stats);
    const dmgBonusMult = this.computeDmgBonusMult(stats);
    const defMult = this.computeDefMult(stats, charLevel, ctx);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);
    const elevated = stats.get("elevated%", this.tag);
    const damage =
      baseDmg * dmgBonusMult * defMult * resMult * critMult * (1 + elevated);

    const statValues: Partial<Record<StatKey, number>> = {
      [this.scalingKey]: stats.get(this.scalingKey, this.tag),
      "dmg%": stats.get("dmg%", this.tag),
      cr: stats.get("cr", this.tag) + stats.get("reactionCr", this.tag),
      cd: stats.get("cd", this.tag) + stats.get("reactionCd", this.tag),
      "defReduction%": stats.get("defReduction%", this.tag),
      "defIgnore%": stats.get("defIgnore%", this.tag),
      "resReduction%": stats.get("resReduction%", this.tag),
    };
    if (this.extraTerm) {
      statValues[this.extraTerm.key] = stats.get(this.extraTerm.key, this.tag);
    }
    // Include baseDmg% and flat baseDmg if non-zero
    const bdp = stats.get("baseDmg%", this.tag);
    const fbd = stats.get("baseDmg", this.tag);
    if (bdp !== 0) statValues["baseDmg%"] = bdp;
    if (fbd !== 0) statValues.baseDmg = fbd;
    if (elevated !== 0) statValues["elevated%"] = elevated;

    return {
      template: "direct",
      statValues,
      params: {
        charLevel,
        enemyLevel: ctx.enemyLevel,
        enemyRes: ctx.enemyRes,
      },
      scalingKeys: keys,
      scalingMulti: multi,
      damage,
      tag: this.tag,
    };
  }
}

/** Amplifying reactions: Direct × ReactionBase × (1 + EMBonus + ReactionDmgBonus%) */
export class AmplifyFormula extends DirectFormula {
  protected override validateReaction(): void {
    if (this.tag.reaction !== "melt" && this.tag.reaction !== "vaporize") {
      throw new Error(
        `AmplifyFormula requires reaction "melt" or "vaporize", got "${this.tag.reaction}"`
      );
    }
  }

  override buildExpr(
    stats: ExprStats,
    charLevel: number,
    ctx: CalcContext
  ): Expr {
    const directExpr = super.buildExpr(stats, charLevel, ctx);
    const reactionBase =
      AMPLIFYING_BASES[this.tag.reaction]?.[this.tag.element] ?? 1.0;
    const em = stats.get("em", this.tag);
    // emBonus = 2.78 * em / (1400 + em)
    const emBonus = E.div(E.mul(E.const(2.78), em), E.add(E.const(1400), em));
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    // ampMult = reactionBase * (1 + emBonus + reactionDmgBonus)
    const ampMult = E.mul(
      E.const(reactionBase),
      E.add(E.const(1), emBonus, reactionDmgBonus)
    );
    return simplify(E.mul(directExpr, ampMult));
  }

  override calc(stats: StatSheet, charLevel: number, ctx: CalcContext): number {
    const directDmg = super.calc(stats, charLevel, ctx);
    const reactionBase =
      AMPLIFYING_BASES[this.tag.reaction]?.[this.tag.element] ?? 1.0;
    const em = stats.get("em", this.tag);
    const emBonus = (2.78 * em) / (1400 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const ampMult = reactionBase * (1 + emBonus + reactionDmgBonus);

    return directDmg * ampMult;
  }

  override display(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DisplayPart {
    const base = super.display(stats, charLevel, ctx);
    const reactionCoeff =
      AMPLIFYING_BASES[this.tag.reaction]?.[this.tag.element] ?? 1.0;
    const em = stats.get("em", this.tag);
    const emCoeff = 2.78;
    const emBonus = (emCoeff * em) / (1400 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const ampMult = reactionCoeff * (1 + emBonus + reactionDmgBonus);

    return {
      ...base,
      template: "amplify",
      statValues: {
        ...base.statValues,
        em,
        "reactionDmg%": reactionDmgBonus,
      },
      params: {
        ...base.params,
        reactionCoeff,
        emCoeff,
      },
      damage: base.damage * ampMult,
      tag: this.tag,
    };
  }
}

/** Additive reactions (Spread/Aggravate): BaseDmg + FlatAdditive, then normal multipliers */
export class CatalyzeFormula extends DamageFormula {
  protected override validateReaction(): void {
    if (this.tag.reaction !== "spread" && this.tag.reaction !== "aggravate") {
      throw new Error(
        `CatalyzeFormula requires reaction "spread" or "aggravate", got "${this.tag.reaction}"`
      );
    }
  }

  buildExpr(stats: ExprStats, charLevel: number, ctx: CalcContext): Expr {
    let scalingDmg: Expr = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    if (this.extraTerm) {
      scalingDmg = E.add(
        scalingDmg,
        E.mul(
          stats.get(this.extraTerm.key, this.tag),
          E.const(this.extraTerm.multiplier)
        )
      );
    }
    const em = stats.get("em", this.tag);
    const emBonus = E.div(E.mul(E.const(5), em), E.add(E.const(1200), em));
    const reactionCoeff = CATALYZE_COEFFICIENTS[this.tag.reaction] ?? 0;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    // flatBonus = levelMult * reactionCoeff * (1 + emBonus + reactionDmgBonus)
    const flatBonus = E.mul(
      E.const(levelMult * reactionCoeff),
      E.add(E.const(1), emBonus, reactionDmgBonus)
    );

    const flatBaseDmg = stats.get("baseDmg", this.tag);
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    // baseDmg = scalingDmg * (1 + baseDmgPct) + flatBonus + flatBaseDmg
    const baseDmg = E.add(
      E.mul(scalingDmg, E.add(E.const(1), baseDmgPct)),
      flatBonus,
      flatBaseDmg
    );
    const dmgBonusMult = this.computeDmgBonusMultExpr(stats);
    const defMult = this.computeDefMultExpr(stats, charLevel, ctx);
    const resMult = this.computeResMultExpr(stats, ctx);
    const critMult = this.computeCritMultExpr(stats, ctx);
    const elevated = stats.get("elevated%", this.tag);

    return simplify(
      E.mul(
        baseDmg,
        dmgBonusMult,
        defMult,
        resMult,
        critMult,
        E.add(E.const(1), elevated)
      )
    );
  }

  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): number {
    let scalingDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    if (this.extraTerm) {
      scalingDmg +=
        stats.get(this.extraTerm.key, this.tag) * this.extraTerm.multiplier;
    }
    const em = stats.get("em", this.tag);
    const emBonus = (5 * em) / (1200 + em);
    const reactionCoeff = CATALYZE_COEFFICIENTS[this.tag.reaction] ?? 0;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const flatBonus =
      levelMult * reactionCoeff * (1 + emBonus + reactionDmgBonus);

    const flatBaseDmg = stats.get("baseDmg", this.tag);
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const baseDmg = scalingDmg * (1 + baseDmgPct) + flatBonus + flatBaseDmg;
    const dmgBonusMult = this.computeDmgBonusMult(stats);
    const defMult = this.computeDefMult(stats, charLevel, ctx);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);
    const elevated = stats.get("elevated%", this.tag);

    return (
      baseDmg * dmgBonusMult * defMult * resMult * critMult * (1 + elevated)
    );
  }

  display(stats: StatSheet, charLevel: number, ctx: CalcContext): DisplayPart {
    const { keys, multi } = this.getScalingInfo();

    const em = stats.get("em", this.tag);
    const emCoeff = 5;
    const emBonus = (emCoeff * em) / (1200 + em);
    const reactionCoeff = CATALYZE_COEFFICIENTS[this.tag.reaction] ?? 0;
    const levelCoeff = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const flatBonus =
      levelCoeff * reactionCoeff * (1 + emBonus + reactionDmgBonus);

    let scalingDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    if (this.extraTerm) {
      scalingDmg +=
        stats.get(this.extraTerm.key, this.tag) * this.extraTerm.multiplier;
    }
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    const baseDmg = scalingDmg * (1 + baseDmgPct) + flatBonus + flatBaseDmg;
    const dmgBonusMult = this.computeDmgBonusMult(stats);
    const defMult = this.computeDefMult(stats, charLevel, ctx);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);
    const elevated = stats.get("elevated%", this.tag);
    const damage =
      baseDmg * dmgBonusMult * defMult * resMult * critMult * (1 + elevated);

    const statValues: Partial<Record<StatKey, number>> = {
      [this.scalingKey]: stats.get(this.scalingKey, this.tag),
      em,
      "dmg%": stats.get("dmg%", this.tag),
      "reactionDmg%": reactionDmgBonus,
      cr: stats.get("cr", this.tag) + stats.get("reactionCr", this.tag),
      cd: stats.get("cd", this.tag) + stats.get("reactionCd", this.tag),
      "defReduction%": stats.get("defReduction%", this.tag),
      "defIgnore%": stats.get("defIgnore%", this.tag),
      "resReduction%": stats.get("resReduction%", this.tag),
    };
    if (this.extraTerm)
      statValues[this.extraTerm.key] = stats.get(this.extraTerm.key, this.tag);
    if (baseDmgPct !== 0) statValues["baseDmg%"] = baseDmgPct;
    if (flatBaseDmg !== 0) statValues.baseDmg = flatBaseDmg;
    if (elevated !== 0) statValues["elevated%"] = elevated;

    return {
      template: "catalyze",
      statValues,
      params: {
        reactionCoeff,
        levelCoeff,
        emCoeff,
        charLevel,
        enemyLevel: ctx.enemyLevel,
        enemyRes: ctx.enemyRes,
      },
      scalingKeys: keys,
      scalingMulti: multi,
      damage,
      tag: this.tag,
    };
  }
}

/** Transformative reactions: LevelMult × ReactionCoeff × (1 + EMBonus + ReactionDmgBonus%) × RESMult. No DEF. Optional CRIT via reaction-specific CR/CD. */
export class TransformFormula extends DamageFormula {
  protected override validateReaction(): void {
    if (!(this.tag.reaction in TRANSFORMATIVE_COEFFICIENTS)) {
      throw new Error(
        `TransformFormula requires a transformative reaction, got "${this.tag.reaction}"`
      );
    }
  }

  buildExpr(stats: ExprStats, charLevel: number, ctx: CalcContext): Expr {
    const em = stats.get("em", this.tag);
    const emBonus = E.div(E.mul(E.const(16), em), E.add(E.const(2000), em));
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const reactionCoeff = TRANSFORMATIVE_COEFFICIENTS[this.tag.reaction] ?? 0;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const resMult = this.computeResMultExpr(stats, ctx);

    // Reaction CRIT for transformative reactions
    const reactionCr = stats.get("reactionCr", this.tag);
    const reactionCd = stats.get("reactionCd", this.tag);
    let critMult: Expr;
    if (reactionCr.tag === "const" && reactionCr.value === 0) {
      critMult = E.const(1);
    } else {
      critMult = E.add(
        E.const(1),
        E.mul(E.clamp(reactionCr, E.const(0), E.const(1)), reactionCd)
      );
    }

    const baseDmg = levelMult * reactionCoeff;
    return simplify(
      E.mul(
        E.const(baseDmg),
        E.add(E.const(1), emBonus, reactionDmgBonus),
        resMult,
        critMult
      )
    );
  }

  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): number {
    const em = stats.get("em", this.tag);
    const emBonus = (16 * em) / (2000 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const reactionCoeff = TRANSFORMATIVE_COEFFICIENTS[this.tag.reaction] ?? 0;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const resMult = this.computeResMult(stats, ctx);

    // Reaction CRIT: fixed CR/CD from specific abilities (e.g., Nahida C2, Lauma A1)
    // Separate from character cr/cd — transformative reactions don't naturally crit.
    const reactionCr = stats.get("reactionCr", this.tag);
    const reactionCd = stats.get("reactionCd", this.tag);
    const critMult =
      reactionCr > 0
        ? 1 + Math.max(0, Math.min(reactionCr, 1)) * reactionCd
        : 1;

    const baseDmg = levelMult * reactionCoeff;
    return baseDmg * (1 + emBonus + reactionDmgBonus) * resMult * critMult;
  }

  display(stats: StatSheet, charLevel: number, ctx: CalcContext): DisplayPart {
    const em = stats.get("em", this.tag);
    const emCoeff = 16;
    const emBonus = (emCoeff * em) / (2000 + em);
    const reactionCoeff = TRANSFORMATIVE_COEFFICIENTS[this.tag.reaction] ?? 0;
    const levelCoeff = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const resMult = this.computeResMult(stats, ctx);
    const reactionCr = stats.get("reactionCr", this.tag);
    const reactionCd = stats.get("reactionCd", this.tag);
    const critMult =
      reactionCr > 0
        ? 1 + Math.max(0, Math.min(reactionCr, 1)) * reactionCd
        : 1;

    const baseDmg = levelCoeff * reactionCoeff;
    const damage =
      baseDmg * (1 + emBonus + reactionDmgBonus) * resMult * critMult;

    return {
      template: "transform",
      statValues: {
        em,
        "reactionDmg%": reactionDmgBonus,
        "resReduction%": stats.get("resReduction%", this.tag),
        reactionCr,
        reactionCd,
      },
      params: {
        reactionCoeff,
        levelCoeff,
        emCoeff,
        charLevel,
        enemyLevel: ctx.enemyLevel,
        enemyRes: ctx.enemyRes,
      },
      scalingKeys: [],
      scalingMulti: [],
      damage,
      tag: this.tag,
    };
  }
}

/**
 * Lunar reactions: can crit, no DEF, uses EMBonus_Lunar = (6 × EM) / (2000 + EM).
 * Has separate multiplicative layers: BaseDmgBonus (§8.7) and Elevation (§4).
 */
export class LunarFormula extends DamageFormula {
  protected override validateReaction(): void {
    if (!(this.tag.reaction in LUNAR_REACTION_COEFFICIENTS)) {
      throw new Error(
        `LunarFormula requires a lunar reaction, got "${this.tag.reaction}"`
      );
    }
  }

  buildExpr(stats: ExprStats, charLevel: number, ctx: CalcContext): Expr {
    const em = stats.get("em", this.tag);
    const emBonus = E.div(E.mul(E.const(6), em), E.add(E.const(2000), em));
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const reactionCoeff = LUNAR_REACTION_COEFFICIENTS[this.tag.reaction] ?? 1.8;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const resMult = this.computeResMultExpr(stats, ctx);
    const critMult = this.computeCritMultExpr(stats, ctx);

    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const reactionBaseDmg = stats.get("reactionBaseDmg%", this.tag);
    const elevated = stats.get("elevated%", this.tag);

    const baseDmg = levelMult * reactionCoeff;
    return simplify(
      E.mul(
        E.const(baseDmg),
        E.add(E.const(1), baseDmgBonus),
        E.add(E.const(1), reactionBaseDmg),
        E.add(E.const(1), emBonus, reactionDmgBonus),
        E.add(E.const(1), elevated),
        resMult,
        critMult
      )
    );
  }

  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): number {
    const em = stats.get("em", this.tag);
    const emBonus = (6 * em) / (2000 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const reactionCoeff = LUNAR_REACTION_COEFFICIENTS[this.tag.reaction] ?? 1.8;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);

    // Separate multiplicative layers for Lunar reactions
    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const reactionBaseDmg = stats.get("reactionBaseDmg%", this.tag);
    const elevated = stats.get("elevated%", this.tag);

    const baseDmg = levelMult * reactionCoeff;
    return (
      baseDmg *
      (1 + baseDmgBonus) *
      (1 + reactionBaseDmg) *
      (1 + emBonus + reactionDmgBonus) *
      (1 + elevated) *
      resMult *
      critMult
    );
  }

  display(stats: StatSheet, charLevel: number, ctx: CalcContext): DisplayPart {
    const em = stats.get("em", this.tag);
    const emCoeff = 6;
    const emBonus = (emCoeff * em) / (2000 + em);
    const reactionCoeff = LUNAR_REACTION_COEFFICIENTS[this.tag.reaction] ?? 1.8;
    const levelCoeff = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);
    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const reactionBaseDmg = stats.get("reactionBaseDmg%", this.tag);
    const elevated = stats.get("elevated%", this.tag);

    const baseDmg = levelCoeff * reactionCoeff;
    const damage =
      baseDmg *
      (1 + baseDmgBonus) *
      (1 + reactionBaseDmg) *
      (1 + emBonus + reactionDmgBonus) *
      (1 + elevated) *
      resMult *
      critMult;

    return {
      template: "lunar",
      statValues: {
        em,
        "reactionDmg%": reactionDmgBonus,
        "baseDmg%": baseDmgBonus,
        "reactionBaseDmg%": reactionBaseDmg,
        "elevated%": elevated,
        cr: stats.get("cr", this.tag) + stats.get("reactionCr", this.tag),
        cd: stats.get("cd", this.tag) + stats.get("reactionCd", this.tag),
        "resReduction%": stats.get("resReduction%", this.tag),
      },
      params: {
        reactionCoeff,
        levelCoeff,
        emCoeff,
        charLevel,
        enemyLevel: ctx.enemyLevel,
        enemyRes: ctx.enemyRes,
      },
      scalingKeys: [],
      scalingMulti: [],
      damage,
      tag: this.tag,
    };
  }
}

/**
 * Lunar Direct (月曜直伤): character abilities that deal Lunar-type DMG.
 * Unlike LunarFormula (level-based reaction damage), this uses the character's
 * own talent multiplier × DirectCoeff, with no DEF multiplier.
 *
 * Formula:
 *   (Stat × TalentMult × DirectCoeff × (1+baseDmg%) × (1+reactionBaseDmg%) × (1+EMBonus+reactionDmg%) + baseDmg)
 *     × (1+elevated%) × CritMult × RESMult
 */
export class LunarDirectFormula extends DamageFormula {
  protected override validateReaction(): void {
    if (!(this.tag.reaction in LUNAR_DIRECT_COEFFICIENTS)) {
      throw new Error(
        `LunarDirectFormula requires a lunar reaction, got "${this.tag.reaction}"`
      );
    }
  }

  buildExpr(stats: ExprStats, _charLevel: number, ctx: CalcContext): Expr {
    let scalingDmg: Expr = E.mul(
      stats.get(this.scalingKey, this.tag),
      E.const(this.talentMultiplier)
    );
    if (this.extraTerm) {
      scalingDmg = E.add(
        scalingDmg,
        E.mul(
          stats.get(this.extraTerm.key, this.tag),
          E.const(this.extraTerm.multiplier)
        )
      );
    }
    const directCoeff = LUNAR_DIRECT_COEFFICIENTS[this.tag.reaction] ?? 1.0;

    const em = stats.get("em", this.tag);
    const emBonus = E.div(E.mul(E.const(6), em), E.add(E.const(2000), em));
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const reactionBaseDmg = stats.get("reactionBaseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    const elevated = stats.get("elevated%", this.tag);
    const resMult = this.computeResMultExpr(stats, ctx);
    const critMult = this.computeCritMultExpr(stats, ctx);

    // talentDmg = scalingDmg * directCoeff * (1+baseDmgBonus) * (1+reactionBaseDmg) * (1+emBonus+reactionDmgBonus)
    const talentDmg = E.mul(
      scalingDmg,
      E.const(directCoeff),
      E.add(E.const(1), baseDmgBonus),
      E.add(E.const(1), reactionBaseDmg),
      E.add(E.const(1), emBonus, reactionDmgBonus)
    );
    const baseDmg = E.add(talentDmg, flatBaseDmg);
    return simplify(
      E.mul(baseDmg, E.add(E.const(1), elevated), critMult, resMult)
    );
  }

  calc(stats: StatSheet, _charLevel: number, ctx: CalcContext): number {
    let scalingDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    if (this.extraTerm) {
      scalingDmg +=
        stats.get(this.extraTerm.key, this.tag) * this.extraTerm.multiplier;
    }
    const directCoeff = LUNAR_DIRECT_COEFFICIENTS[this.tag.reaction] ?? 1.0;

    const em = stats.get("em", this.tag);
    const emBonus = (6 * em) / (2000 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const reactionBaseDmg = stats.get("reactionBaseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    const elevated = stats.get("elevated%", this.tag);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);

    const talentDmg =
      scalingDmg *
      directCoeff *
      (1 + baseDmgBonus) *
      (1 + reactionBaseDmg) *
      (1 + emBonus + reactionDmgBonus);
    const baseDmg = talentDmg + flatBaseDmg;
    return baseDmg * (1 + elevated) * critMult * resMult;
  }

  display(stats: StatSheet, charLevel: number, ctx: CalcContext): DisplayPart {
    const { keys, multi } = this.getScalingInfo();
    const directCoeff = LUNAR_DIRECT_COEFFICIENTS[this.tag.reaction] ?? 1.0;

    const em = stats.get("em", this.tag);
    const emCoeff = 6;
    const emBonus = (emCoeff * em) / (2000 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const reactionBaseDmg = stats.get("reactionBaseDmg%", this.tag);
    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    const elevated = stats.get("elevated%", this.tag);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);

    let scalingDmg =
      stats.get(this.scalingKey, this.tag) * this.talentMultiplier;
    if (this.extraTerm) {
      scalingDmg +=
        stats.get(this.extraTerm.key, this.tag) * this.extraTerm.multiplier;
    }
    const talentDmg =
      scalingDmg *
      directCoeff *
      (1 + reactionBaseDmg) *
      (1 + baseDmgBonus) *
      (1 + emBonus + reactionDmgBonus);
    const baseDmg = talentDmg + flatBaseDmg;
    const damage = baseDmg * (1 + elevated) * critMult * resMult;

    const statValues: Partial<Record<StatKey, number>> = {
      [this.scalingKey]: stats.get(this.scalingKey, this.tag),
      em,
      "reactionDmg%": reactionDmgBonus,
      "reactionBaseDmg%": reactionBaseDmg,
      "baseDmg%": baseDmgBonus,
      "elevated%": elevated,
      cr: stats.get("cr", this.tag) + stats.get("reactionCr", this.tag),
      cd: stats.get("cd", this.tag) + stats.get("reactionCd", this.tag),
      "resReduction%": stats.get("resReduction%", this.tag),
      "defIgnore%": stats.get("defIgnore%", this.tag),
    };
    if (this.extraTerm)
      statValues[this.extraTerm.key] = stats.get(this.extraTerm.key, this.tag);
    if (flatBaseDmg !== 0) statValues.baseDmg = flatBaseDmg;

    return {
      template: "lunarDirect",
      statValues,
      params: {
        directCoeff,
        emCoeff,
        charLevel,
        enemyLevel: ctx.enemyLevel,
        enemyRes: ctx.enemyRes,
      },
      scalingKeys: keys,
      scalingMulti: multi,
      damage,
      tag: this.tag,
    };
  }
}

// ─── Reaction Variant Factory ───

/**
 * Create a reaction variant of a formula. Returns the formula itself if it
 * already has the target reaction, or creates a new variant via factory methods.
 *
 * Only works for DirectFormula (reaction: "none") → amplified/catalyzed.
 * Formulas with built-in reactions (lunar, transformative) are returned as-is
 * since converting them to a different formula type would be incorrect.
 */
export function createReactionVariant(
  formula: DamageFormula,
  targetReaction: ReactionType
): DamageFormula {
  // Already has the target reaction
  if (targetReaction === formula.tag.reaction) return formula;

  // No reaction requested → create direct variant
  if (targetReaction === "none") return formula.createDirect();

  // Only "none" reaction formulas can be converted to amplified/catalyzed.
  // Converting lunar/transform formulas to a different type is a code bug.
  if (formula.tag.reaction !== "none") {
    throw new Error(
      `Cannot convert formula with built-in reaction "${formula.tag.reaction}" to "${targetReaction}". Only "none" reaction formulas can be overridden. This likely means a reaction override is being applied to a formula part that shouldn't receive it.`
    );
  }

  // Amplifying reaction
  if (targetReaction === "vaporize" || targetReaction === "melt")
    return formula.createAmplified(targetReaction);

  // Catalyze reaction
  if (targetReaction === "spread" || targetReaction === "aggravate")
    return formula.createCatalyzed(targetReaction);

  // For other reaction types, return as-is
  return formula;
}
