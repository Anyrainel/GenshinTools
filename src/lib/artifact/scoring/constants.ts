import {
  avgSubstatRolls,
  MAIN_STAT_VALUES_4STAR,
  MAIN_STAT_VALUES_5STAR,
} from "@/data/constants";
import type { SubStat } from "@/data/enums";
import { isFlatStat } from "@/data/utils";

// ─── Scoring constants ───
/** CD-equivalent of one average roll = avg(cd tiers) in display form */

export const AVG_ROLL_CD_EQUIV = avgSubstatRolls[5].cd;
/** CD-equivalent of a 5-star main stat at Lv.20 (= CD main stat value) */

export const MAIN_STAT_CD_EQUIV_5STAR = MAIN_STAT_VALUES_5STAR.cd;
/** CD-equivalent of a 4-star main stat at Lv.16 (= CD main stat value) */

export const MAIN_STAT_CD_EQUIV_4STAR = MAIN_STAT_VALUES_4STAR.cd;
/** Reference substat budget: 40 average rolls for 5 artifacts */

export const SUBSTAT_BUDGET_ROLLS = 40;
/**
 * Ideal roll distribution across top-4 weighted substats.
 * Based on: 5 artifacts, each with 4 substats, top-end (all start with 4 lines)
 * ≈ [22, 10, 5, 5] rolls across the top 4 stats.
 */

export const IDEAL_ROLL_DISTRIBUTION = [22, 10, 5, 5]; // ─── Substat roll accessors ───
/**
 * Average 5★ substat roll values in StatSheet-internal format (pct stats ÷ 100).
 * Used for marginal-gain analysis where one roll ≈ this delta on a StatSheet.
 */

export const AVG_SUBSTAT_ROLL: Record<SubStat, number> = Object.fromEntries(
  Object.entries(avgSubstatRolls[5]).map(([stat, avg]) => [
    stat,
    isFlatStat(stat) ? avg : avg / 100,
  ])
) as Record<SubStat, number>;
