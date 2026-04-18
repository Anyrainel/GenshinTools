/**
 * Builds the condition lookup table for tier-based triage.
 * On-demand: computes and caches entries by structural key.
 */

import type { MainStat, Slot, SubStat } from "@/data/types";
import { P4L, SUB_WEIGHTS, type TriageMode, getTier, pJoint } from "./tierMath";
import type { DemandTierEntry, TierCondition } from "./types";

// Main stat weight pools (same as triage-tier-table.js MAIN_W)

const MAIN_W: Partial<Record<Slot, Record<string, number>>> = {
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
  const pool = MAIN_W[slot];
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
  const tierClass = slot === "flower" || slot === "plume" ? "ff" : "sgc";
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
  mainProb: number,
  slot: Slot,
  mode: TriageMode
): TierCondition[] {
  const subN = remaining.length;
  if (subN === 0) return [];

  const maxK = Math.min(subN, 4);
  const hasCrCd =
    subN >= 3 && remaining.includes("cr") && remaining.includes("cd");
  const crcdStats = ["cr", "cd"];

  const rows: TierCondition[] = [];

  // hit>=0: rare main stat fallback
  {
    const e2e = mainProb;
    const tier = getTier(e2e, slot, mode);
    if (tier !== "T") {
      rows.push({
        k: 0,
        crcd: false,
        is4L: false,
        fill: false,
        tier,
        rarity: e2e,
      });
    }
  }

  for (let k = 1; k <= maxK; k++) {
    const expandK = k >= 2 || subN === 1;
    const canCrcd = expandK && hasCrCd && k >= 2 && k < subN;
    const can4L = expandK;
    const canFill = expandK && fillers.length > 0 && k === subN && k + 1 <= 4;

    // Enumerate modifier combos and compute tiers
    type Combo = {
      crcd: boolean;
      fourL: boolean;
      fill: boolean;
      e2e: number;
      tier: Exclude<"T", string>;
      key: string;
    };
    const comboTier = new Map<string, string>();
    const comboData: Combo[] = [];

    for (const crcd of canCrcd ? [false, true] : [false]) {
      for (const fourL of can4L ? [false, true] : [false]) {
        for (const fill of canFill ? [false, true] : [false]) {
          if (k + (fill ? 1 : 0) > 4) continue;

          const f = fill ? 1 : 0;
          const p = crcd
            ? pJoint(pool, remaining, fillers, k, f, 4, crcdStats)
            : pJoint(pool, remaining, fillers, k, f, 4);
          if (p <= 0) continue;

          const e2e = fourL ? mainProb * P4L * p : mainProb * p;
          const tier = getTier(e2e, slot, mode);
          const key = `${+crcd},${+fourL},${+fill}`;
          comboTier.set(key, tier);
          comboData.push({
            crcd,
            fourL,
            fill,
            e2e,
            tier: tier as Exclude<"T", string>,
            key,
          });
        }
      }
    }

    // Lattice filter: show combo only if each active modifier is needed
    for (const combo of comboData) {
      const { crcd, fourL, fill } = combo;
      const isBase = !crcd && !fourL && !fill;

      if (!isBase) {
        let dominated = false;
        if (crcd) {
          const t = comboTier.get(`0,${+fourL},${+fill}`);
          if (!t || t === "P") dominated = true;
        }
        if (fourL) {
          const t = comboTier.get(`${+crcd},0,${+fill}`);
          if (!t || t === "P") dominated = true;
        }
        if (fill) {
          const t = comboTier.get(`${+crcd},${+fourL},0`);
          if (!t || t === "P") dominated = true;
        }
        if (dominated) continue;
      }

      if (combo.tier === "T") continue; // Only keep P/Q/N conditions

      rows.push({
        k,
        crcd,
        is4L: fourL,
        fill,
        tier: combo.tier as Exclude<"T", string>,
        rarity: combo.e2e,
      });
    }
  }

  // Sort by rarity ascending (rarest first = best tier first)
  rows.sort((a, b) => a.rarity - b.rarity);
  return rows;
}

// Cache and lookup

const cache = new Map<string, DemandTierEntry>();

export function lookupTierEntry(
  slot: Slot,
  mainStat: MainStat,
  desired: SubStat[],
  fillers: SubStat[],
  mode: TriageMode = "strict"
): DemandTierEntry {
  const key = `${mode}|${structuralKey(slot, mainStat, desired, fillers)}`;
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
    mainProb,
    slot,
    mode
  );

  const hasCrCd =
    remaining.length >= 3 &&
    remaining.includes("cr") &&
    remaining.includes("cd");

  const entry: DemandTierEntry = {
    subN: remaining.length,
    hasCrCd,
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
