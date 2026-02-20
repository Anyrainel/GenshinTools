import type { StatSheet } from "./damageModels";
import type { CalcContext, DamagePart, DamageTag, ReactionType } from "./types";

const LEVEL_MULTIPLIERS: Record<number, number> = {
  90: 1446.85,
  100: 1674.81,
};

// ─── Reaction Coefficients (for transformative reactions) ───

const REACTION_COEFFICIENTS: Partial<Record<ReactionType, number>> = {
  burning: 0.25,
  superconduct: 0.5,
  swirl: 0.6,
  electroCharged: 1.2,
  shatter: 1.5,
  overloaded: 2.0,
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

type ScalingKey = "atk" | "hp" | "def";

/** Additional stat term for talents that scale off two stats (e.g., X% ATK + Y% EM). */
type ExtraScalingTerm = { key: ScalingKey | "em"; multiplier: number };

export abstract class DamageFormula {
  constructor(
    readonly talentMultiplier: number,
    readonly tag: DamageTag,
    readonly scalingKey: ScalingKey = "atk",
    readonly extraTerm?: ExtraScalingTerm
  ) {}

  abstract calc(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DamagePart;

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

  protected computeCritMult(stats: StatSheet, ctx: CalcContext): number {
    const cr = stats.get("cr", this.tag);
    const cd = stats.get("cd", this.tag);

    if (ctx.assumeCrit) {
      return 1 + cd;
    }
    return 1 + Math.min(cr, 1.0) * cd;
  }

  protected computeDmgBonusMult(stats: StatSheet): number {
    // Element DMG% is inherently scoped by key name (e.g., `pyro%`)
    const elementDmg = stats.get(
      `${this.tag.element === "Physical" ? "phys" : this.tag.element.toLowerCase()}%` as "pyro%"
    );
    // dmg% picks up generic, ability-scoped, and element-scoped entries via tag
    const dmgBonus = stats.get("dmg%", this.tag);
    const dmgTaken = stats.get("dmgTaken%", this.tag);
    return 1 + elementDmg + dmgBonus + dmgTaken;
  }

  /**
   * Base damage with multiplicative baseDmg% layer (§8.7, "deal X% original DMG").
   * Formula: talentDmg × (1 + baseDmg%) + flatBaseDmg
   */
  protected getBaseDmg(stats: StatSheet): number {
    let talentDmg = stats.get(this.scalingKey) * this.talentMultiplier;
    if (this.extraTerm) {
      talentDmg += stats.get(this.extraTerm.key) * this.extraTerm.multiplier;
    }
    const baseDmgPct = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    return talentDmg * (1 + baseDmgPct) + flatBaseDmg;
  }
}

/** Direct damage: BaseDmg × DmgBonus × DEFMult × RESMult × CritMult */
export class DirectFormula extends DamageFormula {
  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): DamagePart {
    const baseDmg = this.getBaseDmg(stats);
    const dmgBonusMult = this.computeDmgBonusMult(stats);
    const defMult = this.computeDefMult(stats, charLevel, ctx);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);

    const damage = baseDmg * dmgBonusMult * defMult * resMult * critMult;
    return {
      components: { baseDmg, dmgBonusMult, defMult, resMult, critMult },
      damage,
    };
  }
}

/** Amplifying reactions: Direct × ReactionBase × (1 + EMBonus + ReactionDmgBonus%) */
export class AmplifyFormula extends DirectFormula {
  override calc(
    stats: StatSheet,
    charLevel: number,
    ctx: CalcContext
  ): DamagePart {
    const direct = super.calc(stats, charLevel, ctx);
    const reactionBase =
      AMPLIFYING_BASES[this.tag.reaction]?.[this.tag.element] ?? 1.0;
    const em = stats.get("em");
    const emBonus = (2.78 * em) / (1400 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const ampMult = reactionBase * (1 + emBonus + reactionDmgBonus);

    return {
      components: { ...direct.components, ampMult },
      damage: direct.damage * ampMult,
    };
  }
}

/** Additive reactions (Spread/Aggravate): BaseDmg + FlatAdditive, then normal multipliers */
export class CatalyzeFormula extends DamageFormula {
  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): DamagePart {
    let scalingDmg = stats.get(this.scalingKey) * this.talentMultiplier;
    if (this.extraTerm) {
      scalingDmg += stats.get(this.extraTerm.key) * this.extraTerm.multiplier;
    }
    const em = stats.get("em");
    const emBonus = (2.78 * em) / (1400 + em);
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

    const damage = baseDmg * dmgBonusMult * defMult * resMult * critMult;
    return {
      components: {
        baseDmg,
        flatBonus,
        dmgBonusMult,
        defMult,
        resMult,
        critMult,
      },
      damage,
    };
  }
}

/** Transformative reactions: LevelMult × ReactionCoeff × (1 + EMBonus + ReactionDmgBonus%) × RESMult. No DEF. Optional CRIT via reaction-specific CR/CD. */
export class TransformFormula extends DamageFormula {
  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): DamagePart {
    const em = stats.get("em");
    const emBonus = (16 * em) / (2000 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const reactionCoeff = REACTION_COEFFICIENTS[this.tag.reaction] ?? 0;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const resMult = this.computeResMult(stats, ctx);

    // Reaction CRIT: fixed CR/CD from specific abilities (e.g., Nahida C2, Lauma A1)
    // Separate from character cr/cd — transformative reactions don't naturally crit.
    const reactionCr = stats.get("reactionCr", this.tag);
    const reactionCd = stats.get("reactionCd", this.tag);
    const critMult =
      reactionCr > 0
        ? ctx.assumeCrit
          ? 1 + reactionCd
          : 1 + Math.min(reactionCr, 1) * reactionCd
        : 1;

    const baseDmg = levelMult * reactionCoeff;
    const damage =
      baseDmg * (1 + emBonus + reactionDmgBonus) * resMult * critMult;
    return {
      components: { baseDmg, emBonus, reactionDmgBonus, resMult, critMult },
      damage,
    };
  }
}

/**
 * Lunar reactions: can crit, no DEF, uses EMBonus_Lunar = (6 × EM) / (2000 + EM).
 * Has separate multiplicative layers: BaseDmgBonus (§8.7) and Elevation (§4).
 */
export class LunarFormula extends DamageFormula {
  calc(stats: StatSheet, charLevel: number, ctx: CalcContext): DamagePart {
    const em = stats.get("em");
    const emBonus = (6 * em) / (2000 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const reactionCoeff = LUNAR_REACTION_COEFFICIENTS[this.tag.reaction] ?? 1.8;
    const levelMult = LEVEL_MULTIPLIERS[charLevel] ?? LEVEL_MULTIPLIERS[100]!;
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);
    const dmgTaken = stats.get("dmgTaken%", this.tag);

    // Separate multiplicative layers for Lunar reactions
    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const elevated = stats.get("elevated%", this.tag);

    const baseDmg = levelMult * reactionCoeff;
    const damage =
      baseDmg *
      (1 + baseDmgBonus) *
      (1 + emBonus + reactionDmgBonus) *
      (1 + elevated) *
      (1 + dmgTaken) *
      resMult *
      critMult;
    return {
      components: {
        baseDmg,
        baseDmgBonus,
        emBonus,
        reactionDmgBonus,
        elevated,
        dmgTaken,
        resMult,
        critMult,
      },
      damage,
    };
  }
}

/**
 * Lunar Direct (月曜直伤): character abilities that deal Lunar-type DMG.
 * Unlike LunarFormula (level-based reaction damage), this uses the character's
 * own talent multiplier × DirectCoeff, with no DEF multiplier.
 *
 * Formula:
 *   (Stat × TalentMult × DirectCoeff × (1+baseDmg%) × (1+EMBonus+reactionDmg%) + baseDmg)
 *     × (1+elevated%) × CritMult × RESMult
 */
export class LunarDirectFormula extends DamageFormula {
  calc(stats: StatSheet, _charLevel: number, ctx: CalcContext): DamagePart {
    let scalingDmg = stats.get(this.scalingKey) * this.talentMultiplier;
    if (this.extraTerm) {
      scalingDmg += stats.get(this.extraTerm.key) * this.extraTerm.multiplier;
    }
    const directCoeff = LUNAR_DIRECT_COEFFICIENTS[this.tag.reaction] ?? 1.0;

    const em = stats.get("em");
    const emBonus = (6 * em) / (2000 + em);
    const reactionDmgBonus = stats.get("reactionDmg%", this.tag);
    const baseDmgBonus = stats.get("baseDmg%", this.tag);
    const flatBaseDmg = stats.get("baseDmg", this.tag);
    const elevated = stats.get("elevated%", this.tag);
    const resMult = this.computeResMult(stats, ctx);
    const critMult = this.computeCritMult(stats, ctx);

    const talentDmg =
      scalingDmg *
      directCoeff *
      (1 + baseDmgBonus) *
      (1 + emBonus + reactionDmgBonus);
    const baseDmg = talentDmg + flatBaseDmg;
    const damage = baseDmg * (1 + elevated) * critMult * resMult;

    return {
      components: {
        scalingDmg,
        talentDmg,
        directCoeff,
        baseDmgBonus,
        emBonus,
        reactionDmgBonus,
        flatBaseDmg,
        elevated,
        critMult,
        resMult,
      },
      damage,
    };
  }
}
