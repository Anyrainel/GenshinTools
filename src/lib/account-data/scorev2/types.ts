/**
 * Artifact Score V2: Types
 *
 * New types for the V2 scoring system that auto-derives weights
 * via marginal damage analysis and scores main stats alongside substats.
 */

import type { BuildRole, BuildStyle, MainStat, SubStat } from "@/data/types";

// ─── Substat Coefficients (CD-equivalent per unit of stat) ───

/** Maps each substat to its CD-equivalent coefficient: 7.77 / maxRollValue */
export const SUBSTAT_COEFFICIENTS: Record<SubStat, number> = {
  cd: 1.0,
  cr: 1.9974,
  "atk%": 1.3328,
  "hp%": 1.3328,
  "def%": 1.0658,
  em: 0.3333,
  er: 1.1991,
  atk: 0.3995,
  hp: 0.026,
  def: 0.3356,
};

/** Max roll values per substat (5-star) */
export const MAX_ROLLS_5STAR: Record<SubStat, number> = {
  cd: 7.77,
  cr: 3.89,
  "atk%": 5.83,
  "hp%": 5.83,
  "def%": 7.29,
  em: 23.31,
  er: 6.48,
  atk: 19.45,
  hp: 298.75,
  def: 23.15,
};

/** One average roll of a stat (value = maxRoll × 0.85) */
export const AVG_ROLL_VALUES: Record<SubStat, number> = Object.fromEntries(
  Object.entries(MAX_ROLLS_5STAR).map(([k, v]) => [k, v * 0.85])
) as Record<SubStat, number>;

/**
 * CD-equivalent of one average roll = 7.77 × 0.85 = 6.6045
 * (Same for all stats by design — the coefficient normalizes them.)
 */
export const AVG_ROLL_CD_EQUIV = 7.77 * 0.85;

/** CD-equivalent of a 5-star main stat at Lv.20 ≈ 62.1 */
export const MAIN_STAT_CD_EQUIV_5STAR = 62.1;

/** CD-equivalent of a 4-star main stat at Lv.16 ≈ 46.4 */
export const MAIN_STAT_CD_EQUIV_4STAR = 46.4;

/** Reference substat budget: 40 average rolls for 5 artifacts */
export const SUBSTAT_BUDGET_ROLLS = 40;

/**
 * Ideal roll distribution across top-4 weighted substats.
 * Based on: 5 artifacts, each with 4 substats, top-end (all start with 4 lines)
 * ≈ [22, 10, 5, 5] rolls across the top 4 stats.
 */
export const IDEAL_ROLL_DISTRIBUTION = [22, 10, 5, 5];

// ─── V2 Build Types ───

/** Main stat weight for a slot — includes the CD-equivalent override for non-substat mains */
export type MainStatWeight = {
  stat: MainStat;
  /** 0-100 weight, same scale as substat weights */
  weight: number;
  /**
   * Override for CD-equivalent value of this main stat.
   * Default = MAIN_STAT_CD_EQUIV_5STAR (62.1).
   * Elemental DMG% goblets may have higher values (e.g., 68-75) if auto-tuned.
   */
  cdEquiv?: number;
};

/**
 * Extended Build type for V2 scoring.
 * Adds main stat weights and auto-tuning metadata alongside the existing Build fields.
 */
export type BuildV2Weights = {
  characterId: string;
  buildName: string;
  roles: BuildRole[];
  styles: BuildStyle[];

  /** Primary scaling stat for this build */
  scalingStat: "atk" | "hp" | "def" | "em";

  /** Primary element for damage formulas */
  element: string;

  /** Recommended artifact set (for reference) */
  artifactSet?: string;

  /** Auto-derived substat weights (0-100 scale) */
  substats: Record<SubStat, number>;

  /** Main stat weights per slot. Ordered by priority (first = best). */
  sands: MainStatWeight[];
  goblet: MainStatWeight[];
  circlet: MainStatWeight[];

  /** Ideal greedy roll allocation averaged across team contexts (out of 42 total rolls) */
  idealRolls: Record<SubStat, number>;

  /** Reaction type used for weight derivation (affects EM value) */
  reaction: string;

  /** Ideal score (before normalization) — for computing normalizer */
  idealScore: number;

  /** 300 / idealScore */
  normalizer: number;

  /** Auto-tuning metadata */
  meta: {
    method: "auto" | "manual";
    /** Weapon used during weight derivation */
    weaponId: string;
    /** Team context names used for averaging */
    teamContexts: string[];
    /** Timestamp of generation */
    generatedAt: number;
  };
};

// ─── Team Context for Auto-Tuning ───

/** Per-member build info for display purposes */
export type TeamMemberBuild = {
  weapon: string;
  /** Artifact set IDs: 1 entry = 4pc, 2 entries = 2+2 */
  artifacts: string[];
};

export type TeamContext = {
  name: string;
  /** The 4 character IDs */
  characters: [string, string, string, string];
  /** Index of the on-field DPS in the characters array */
  dpsIndex: number;
  /** Primary reaction for the team */
  reaction: string;
  /** Weapon ID for the DPS character */
  dpsWeaponId: string;
  /** Per-member builds: weapons + artifact sets (parallel to characters array) */
  builds: [TeamMemberBuild, TeamMemberBuild, TeamMemberBuild, TeamMemberBuild];
};

/** Result of the auto-tuning pipeline for a single main-stat combo + team context */
export type AutoTuneResult = {
  weights: Record<SubStat, number>;
  rollAllocation: Record<SubStat, number>;
  midpointMarginals: Record<SubStat, number>;
  /** Total damage after applying full greedy allocation (sum of all formulas) */
  finalDamage: number;
};
