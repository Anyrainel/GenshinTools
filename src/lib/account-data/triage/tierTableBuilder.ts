/**
 * Builds the condition lookup table for tier-based triage.
 * On-demand: computes and caches entries by structural key.
 */

import type { MainStat, Slot, SubStat } from "@/data/enums";
import {
  FOUR_INITIAL_SUBSTAT_EFFECTIVE_PROBABILITY,
  pJoint,
  SUB_WEIGHTS,
} from "./tierMath";
import type { DemandTierEntry, TierCondition } from "./types";

// Main stat weight pools (same as triage-tier-table.js MAIN_W)

const MAIN_STAT_WEIGHTS: Partial<Record<Slot, Record<string, number>>> = {
  sands: { "atk%": 26.66, "hp%": 26.66, "def%": 26.66, em: 10, er: 10 },
  goblet: {
    "atk%": 19.25,
    "hp%": 19.25,
    "def%": 19,
    em: 2.5,
    "pyro%": 5,
    "hydro%": 5,
    "anemo%": 5,
    "electro%": 5,
    "dendro%": 5,
    "cryo%": 5,
    "geo%": 5,
    "phys%": 5,
  },
  circlet: {
    "hp%": 22,
    "atk%": 22,
    "def%": 22,
    em: 4,
    cr: 10,
    cd: 10,
    "heal%": 10,
  },
};

/** Stats that can only be main stats, never substats. */
const NON_SUB = new Set([
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
]);

// Pool construction

function makePool(exclude: string[]): Record<string, number> {
  const pool: Record<string, number> = { ...SUB_WEIGHTS };
  for (const s of exclude) delete pool[s];
  return pool;
}

// Main stat probability

export function getMainProb(slot: Slot, mainStat: MainStat): number {
  if (slot === "flower" || slot === "plume") return 1.0;
  const pool = MAIN_STAT_WEIGHTS[slot];
  if (!pool) return 1.0;
  const total = Object.values(pool).reduce((a, b) => a + b, 0);
  const weight = pool[mainStat];
  if (weight == null) return 0;
  return weight / total;
}

// Structural key — scenarios with identical probability profiles share a table

export function structuralKey(
  slot: Slot,
  mainStat: MainStat,
  desired: SubStat[],
  fillers: SubStat[]
): string {
  const pool = makePool(NON_SUB.has(mainStat) ? [] : [mainStat]);
  const mainProb = getMainProb(slot, mainStat);
  const tierClass =
    slot === "flower" || slot === "plume"
      ? "fixedMainSlots"
      : "variableMainSlots";
  const mainRounded = mainProb.toFixed(2);
  const poolWeights = Object.values(pool)
    .sort((a, b) => a - b)
    .join(",");
  const remaining = desired.filter((s) => s !== mainStat && pool[s] != null);
  const remWeights = remaining
    .map((s) => pool[s])
    .sort((a, b) => a - b)
    .join(",");
  const effectiveFillers = fillers.filter(
    (s) => pool[s] != null && !remaining.includes(s)
  );
  const fillWeights = effectiveFillers
    .map((s) => pool[s])
    .sort((a, b) => a - b)
    .join(",");
  return `${tierClass}|${mainRounded}|${poolWeights}|${remWeights}|${fillWeights}`;
}

// Condition row computation (port of JS computeConditionRows)

function computeConditionRows(
  pool: Record<string, number>,
  remaining: string[],
  fillers: string[],
  mainProb: number
): TierCondition[] {
  const desiredSubstatCount = remaining.length;
  if (desiredSubstatCount === 0 || mainProb <= 0) return [];

  const maxRequiredDesiredHits = Math.min(desiredSubstatCount, 4);
  const hasCritPair =
    desiredSubstatCount >= 3 &&
    remaining.includes("cr") &&
    remaining.includes("cd");
  const critPairStats = ["cr", "cd"];

  const rows: TierCondition[] = [];

  // hit>=0: rare main stat fallback
  {
    const endToEndProbability = mainProb;
    rows.push({
      requiredDesiredHits: 0,
      requiresCritPair: false,
      requiresFourInitialSubstats: false,
      requiresFillerHit: false,
      rarity: endToEndProbability,
    });
  }

  for (
    let requiredDesiredHits = 1;
    requiredDesiredHits <= maxRequiredDesiredHits;
    requiredDesiredHits++
  ) {
    const canUseModifiers =
      requiredDesiredHits >= 2 || desiredSubstatCount === 1;
    const canRequireCritPair =
      canUseModifiers &&
      hasCritPair &&
      requiredDesiredHits >= 2 &&
      requiredDesiredHits < desiredSubstatCount;
    const canRequireFourInitialSubstats = canUseModifiers;
    const canRequireFillerHit =
      canUseModifiers &&
      fillers.length > 0 &&
      requiredDesiredHits === desiredSubstatCount &&
      requiredDesiredHits + 1 <= 4;

    // Enumerate modifier combos and compute tiers
    type Combo = {
      requiresCritPair: boolean;
      requiresFourInitialSubstats: boolean;
      requiresFillerHit: boolean;
      endToEndProbability: number;
    };
    const comboData: Combo[] = [];

    for (const requiresCritPair of canRequireCritPair
      ? [false, true]
      : [false]) {
      for (const requiresFourInitialSubstats of canRequireFourInitialSubstats
        ? [false, true]
        : [false]) {
        for (const requiresFillerHit of canRequireFillerHit
          ? [false, true]
          : [false]) {
          if (requiredDesiredHits + (requiresFillerHit ? 1 : 0) > 4) continue;

          const fillerHitCount = requiresFillerHit ? 1 : 0;
          const substatProbability = requiresCritPair
            ? pJoint(
                pool,
                remaining,
                fillers,
                requiredDesiredHits,
                fillerHitCount,
                4,
                critPairStats
              )
            : pJoint(
                pool,
                remaining,
                fillers,
                requiredDesiredHits,
                fillerHitCount,
                4
              );
          if (substatProbability <= 0) continue;

          const endToEndProbability = requiresFourInitialSubstats
            ? mainProb *
              FOUR_INITIAL_SUBSTAT_EFFECTIVE_PROBABILITY *
              substatProbability
            : mainProb * substatProbability;
          comboData.push({
            requiresCritPair,
            requiresFourInitialSubstats,
            requiresFillerHit,
            endToEndProbability,
          });
        }
      }
    }

    for (const combo of comboData) {
      const {
        requiresCritPair,
        requiresFourInitialSubstats,
        requiresFillerHit,
      } = combo;

      rows.push({
        requiredDesiredHits,
        requiresCritPair,
        requiresFourInitialSubstats,
        requiresFillerHit,
        rarity: combo.endToEndProbability,
      });
    }
  }

  // Sort by rarity ascending (rarest first).
  rows.sort((a, b) => a.rarity - b.rarity);
  return rows;
}

// Cache and lookup

const cache = new Map<string, DemandTierEntry>();

export function lookupTierEntry(
  slot: Slot,
  mainStat: MainStat,
  desired: SubStat[],
  fillers: SubStat[]
): DemandTierEntry {
  const key = structuralKey(slot, mainStat, desired, fillers);
  const cached = cache.get(key);
  if (cached) return cached;

  const pool = makePool(NON_SUB.has(mainStat) ? [] : [mainStat]);
  const remaining = desired.filter(
    (s) => s !== mainStat && pool[s] != null
  ) as string[];
  const effectiveFillers = fillers.filter(
    (s) => pool[s] != null && !remaining.includes(s)
  ) as string[];
  const mainProb = getMainProb(slot, mainStat);

  const conditions = computeConditionRows(
    pool,
    remaining,
    effectiveFillers,
    mainProb
  );

  const hasCritPair =
    remaining.length >= 3 &&
    remaining.includes("cr") &&
    remaining.includes("cd");

  const entry: DemandTierEntry = {
    desiredSubstatCount: remaining.length,
    hasCritPair,
    hasFillers: effectiveFillers.length > 0,
    conditions,
  };

  cache.set(key, entry);
  return entry;
}

/** Clear cache (for testing). */
export function clearTierTableCache(): void {
  cache.clear();
}
