/**
 * Artifact scoring, stat extraction, and slot data preparation.
 *
 * Two scoring strategies:
 * - Weight-based: uses build's stat weights (general-purpose)
 * - Marginal-based: uses damage-formula-derived marginal weights (context-aware)
 */

import type { ArtifactData, GlobalStatWeights, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import { toInternal } from "@/lib/account-data/scoring/utils";
import {
  type BuildMatchResult,
  getMainStatValueAtLevel,
  getTargetMainStatsForSlot,
  scoreMainStat,
  scoreSlot,
} from "../../account-data/artifactScore";
import type { StatKey } from "../types";
import type { MarginalWeights, PreparedSlotData, SuperArtifact } from "./types";

// ─── Constants ───

/** After scoring & sorting, keep at most this many unleveled (level 0) artifacts per slot.
 *  Leveled artifacts are always retained regardless of rank. */
const UNLEVELED_TOP_N = 50;

// ─── Artifact Stat Extraction ───

export function getArtifactEr(art: ArtifactData | null): number {
  if (!art) return 0;
  let er = 0;
  if (art.mainStatKey === "er")
    er += toInternal(
      "er",
      getMainStatValueAtLevel("er", art.rarity, art.level)
    );
  if (art.substats.er) er += toInternal("er", art.substats.er);
  return er;
}

export function getArtifactCr(art: ArtifactData | null): number {
  if (!art) return 0;
  let cr = 0;
  if (art.mainStatKey === "cr")
    cr += toInternal(
      "cr",
      getMainStatValueAtLevel("cr", art.rarity, art.level)
    );
  if (art.substats.cr) cr += toInternal("cr", art.substats.cr);
  return cr;
}

function getArtifactStats(art: ArtifactData): Partial<Record<StatKey, number>> {
  const stats: Partial<Record<StatKey, number>> = {};
  const mainVal = toInternal(
    art.mainStatKey,
    getMainStatValueAtLevel(art.mainStatKey, art.rarity, art.level)
  );
  stats[art.mainStatKey as StatKey] = mainVal;
  for (const [key, val] of Object.entries(art.substats)) {
    if (!val) continue;
    const statKey = key as StatKey;
    stats[statKey] = (stats[statKey] ?? 0) + toInternal(key, val as number);
  }
  return stats;
}

// ─── Super-Artifact ───

export function buildSuperArtifact(artifacts: ArtifactData[]): SuperArtifact {
  const stats: Partial<Record<StatKey, number>> = {};
  let maxEr = 0;
  let maxCr = 0;
  for (const art of artifacts) {
    const s = getArtifactStats(art);
    for (const [key, val] of Object.entries(s)) {
      const statKey = key as StatKey;
      stats[statKey] = Math.max(stats[statKey] ?? 0, val);
    }
    maxEr = Math.max(maxEr, getArtifactEr(art));
    maxCr = Math.max(maxCr, getArtifactCr(art));
  }
  return { maxEr, maxCr, stats };
}

// ─── Scoring Functions ───

export function computeWeightScore(
  art: ArtifactData,
  buildMatch: BuildMatchResult | null | undefined,
  globalConfig: GlobalStatWeights,
  crDiscount: number
): number {
  const baseWeights = buildMatch?.statWeights ?? { cr: 100, cd: 100 };
  const weights =
    crDiscount < 1
      ? { ...baseWeights, cr: (baseWeights.cr ?? 0) * crDiscount }
      : baseWeights;
  let score = scoreSlot(art, weights, globalConfig);
  const hasMainStatBuild =
    buildMatch &&
    Array.isArray(
      (buildMatch as BuildMatchResult & { build?: { substats?: unknown } })
        .build?.substats
    );
  if (hasMainStatBuild) {
    const rec = getTargetMainStatsForSlot(art.slotKey, buildMatch.build);
    if (rec.has(art.mainStatKey)) {
      let mainScore = scoreMainStat(
        art.mainStatKey,
        art.rarity,
        globalConfig,
        art.level
      );
      if (crDiscount < 1 && art.mainStatKey === "cr") mainScore *= crDiscount;
      score += mainScore;
    }
  }
  return score;
}

/**
 * Score an artifact using marginal-gain weights.
 *
 * Main stats: scored proportionally to their marginal damage contribution.
 * Substats: uses marginal weights when hasMainStatDisagreement is true,
 * otherwise uses build's static weights.
 */
export function computeMarginalScore(
  art: ArtifactData,
  buildMatch: BuildMatchResult | null | undefined,
  globalConfig: GlobalStatWeights,
  crDiscount: number,
  marginals: MarginalWeights
): number {
  let score: number;
  if (marginals.hasMainStatDisagreement) {
    const mWeights = { ...marginals.substatWeights };
    if (crDiscount < 1) {
      mWeights.cr = (mWeights.cr ?? 0) * crDiscount;
    }
    score = scoreSlot(art, mWeights, globalConfig);
  } else {
    const baseWeights = buildMatch?.statWeights ?? { cr: 100, cd: 100 };
    const weights =
      crDiscount < 1
        ? { ...baseWeights, cr: (baseWeights.cr ?? 0) * crDiscount }
        : baseWeights;
    score = scoreSlot(art, weights, globalConfig);
  }

  const slotMarginals = marginals.mainStatMarginals[art.slotKey];
  if (slotMarginals) {
    const proportion = slotMarginals[art.mainStatKey] ?? 0;
    if (proportion > 0) {
      let mainScore = scoreMainStat(
        art.mainStatKey,
        art.rarity,
        globalConfig,
        art.level
      );
      if (crDiscount < 1 && art.mainStatKey === "cr") mainScore *= crDiscount;
      score += mainScore * proportion;
    }
  } else {
    // flower/plume: always give full main stat bonus
    score += scoreMainStat(
      art.mainStatKey,
      art.rarity,
      globalConfig,
      art.level
    );
  }

  return score;
}

// ─── Slot Data Preparation ───

export function prepareSlotData(
  inventory: ArtifactData[],
  excludedIds: Set<string> | undefined,
  buildMatch: BuildMatchResult | null | undefined,
  globalConfig: GlobalStatWeights,
  crDiscount: number,
  maxArtsPerSlot = 0,
  marginals?: MarginalWeights | null,
  filterUnleveled = false
): PreparedSlotData[] {
  const result: PreparedSlotData[] = [];
  for (let slotIndex = 0; slotIndex < 5; slotIndex++) {
    const slot = allSlots[slotIndex];
    let arts = inventory
      .filter(
        (a) => a.slotKey === slot && (!excludedIds || !excludedIds.has(a.id))
      )
      .sort((a, b) =>
        marginals
          ? computeMarginalScore(
              b,
              buildMatch,
              globalConfig,
              crDiscount,
              marginals
            ) -
            computeMarginalScore(
              a,
              buildMatch,
              globalConfig,
              crDiscount,
              marginals
            )
          : computeWeightScore(b, buildMatch, globalConfig, crDiscount) -
            computeWeightScore(a, buildMatch, globalConfig, crDiscount)
      );
    if (maxArtsPerSlot > 0 && arts.length > maxArtsPerSlot) {
      arts = arts.slice(0, maxArtsPerSlot);
    }
    // Drop unleveled artifacts beyond top N for carry characters.
    // Supports are excluded because they frequently use unleveled artifacts.
    if (filterUnleveled && arts.length > UNLEVELED_TOP_N) {
      arts = arts.filter((a, i) => i < UNLEVELED_TOP_N || a.level > 0);
    }
    const bySet = new Map<string, ArtifactData[]>();
    for (const art of arts) {
      const arr = bySet.get(art.setKey);
      if (arr) arr.push(art);
      else bySet.set(art.setKey, [art]);
    }
    const slotSA =
      arts.length > 0
        ? buildSuperArtifact(arts)
        : { maxEr: 0, maxCr: 0, stats: {} };
    const setSA = new Map<string, SuperArtifact>();
    for (const [setKey, setArts] of bySet)
      setSA.set(setKey, buildSuperArtifact(setArts));
    result.push({
      allArtifacts: arts,
      bySet,
      slotSuperArtifact: slotSA,
      setSuperArtifacts: setSA,
    });
  }
  return result;
}

// ─── Slot Data Re-sorting ───

/** Snapshot of slot ordering for save/restore. */
interface SlotOrderSnapshot {
  all: ArtifactData[];
  sets: [string, ArtifactData[]][];
}

/**
 * Re-sort slot data in-place with a new comparator, execute a callback,
 * then restore the original ordering. Task groups that hold references to
 * the slot data arrays automatically see both the re-sorted and restored orders.
 */
export function withResortedSlotData<T>(
  slotData: PreparedSlotData[],
  sortFn: (a: ArtifactData, b: ArtifactData) => number,
  body: () => T
): T {
  const saved: SlotOrderSnapshot[] = [];
  for (let si = 0; si < 5; si++) {
    saved.push({
      all: [...slotData[si].allArtifacts],
      sets: [...slotData[si].bySet.entries()].map(([k, v]) => [k, [...v]]),
    });
    slotData[si].allArtifacts.sort(sortFn);
    for (const [, arts] of slotData[si].bySet) {
      arts.sort(sortFn);
    }
  }
  try {
    return body();
  } finally {
    for (let si = 0; si < 5; si++) {
      const snap = saved[si];
      slotData[si].allArtifacts.length = 0;
      slotData[si].allArtifacts.push(...snap.all);
      for (const [key, arts] of snap.sets) {
        const current = slotData[si].bySet.get(key);
        if (current) {
          current.length = 0;
          current.push(...arts);
        }
      }
    }
  }
}
