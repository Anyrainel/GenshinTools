import { artifactIdToHalfSetId } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type BuildMatchResult,
  getFixedMainStatValue,
  getTargetMainStatsForSlot,
  scoreMainStat,
  scoreSlot,
} from "../account-data/artifactScore";
import type { TeamBuild } from "./damageCalc";
import { StatSheet } from "./damageModels";
import { AVG_SUBSTAT_ROLL } from "./inspection";
import type { CalcContext, DamageResult, StatKey } from "./types";

export interface OptimizerOptions {
  teamBuild: TeamBuild;
  targetCharId: string;
  formulaId: string;
  targetEr: number; // e.g. 1.2 for 120%
  inventory: ArtifactData[];
  buildMatch: BuildMatchResult;
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>; // Sheets for other 3 chars
  calcContext: CalcContext;

  topN?: number; // Per-slot prune count (default 20)
  maxBuilds?: number; // Top builds to evaluate for damage (default 1000)

  artifactSetId?: string | null;
  artifactHalfSetIds?: string[];

  // ── Multi-pass support (all default to targetCharId for backward compat) ──
  swapCharId?: string; // Whose artifacts to enumerate
  calcTargetId?: string; // Who is "on field" for buff routing
  formulaCharId?: string; // Whose formula to evaluate
  erCheckCharId?: string; // Whose ER to check (default: swapCharId)
  excludedArtifactIds?: Set<string>; // Artifacts locked by prior passes
}

export interface OptimizationResult {
  bestDamage: number;
  bestDamageResult: DamageResult | null;
  bestArtifacts: Record<Slot, ArtifactData | null>;
  phase: "pruning" | "evaluating";
  progress: number; // 0 to 1
  combinationsEvaluated: number;
  combinationsTotal: number;
  startTime: number;
  endTime: number | null;
  done: boolean;
}

function scorePiece(
  art: ArtifactData,
  buildMatch: BuildMatchResult,
  globalConfig: GlobalStatWeights,
  crDiscount = 1
): number {
  const weights =
    crDiscount < 1
      ? {
          ...buildMatch.statWeights,
          cr: (buildMatch.statWeights.cr ?? 0) * crDiscount,
        }
      : buildMatch.statWeights;
  let score = scoreSlot(art, weights, globalConfig);

  // Add main stat contribution when it matches the build recommendation.
  const recommended = getTargetMainStatsForSlot(art.slotKey, buildMatch.build);
  if (recommended.has(art.mainStatKey)) {
    let mainScore = scoreMainStat(art.mainStatKey, art.rarity, globalConfig);
    // Also discount CR main stat when CR is devalued
    if (crDiscount < 1 && art.mainStatKey === "cr") {
      mainScore *= crDiscount;
    }
    score += mainScore;
  }

  return score;
}

// ── Set matching helpers ──

export function matchesSetRequirement(
  pieces: readonly ArtifactData[],
  artifactSetId: string | null | undefined,
  artifactHalfSetIds: string[] | undefined
): boolean {
  // 4pc: need ≥4 pieces of the exact set key (1 flexible slot allowed)
  if (artifactSetId) {
    let count = 0;
    for (const p of pieces) {
      if (p.setKey === artifactSetId) count++;
    }
    if (count < 4) return false;
  }

  // 2+2: the 2pc bonus activates per individual set (need ≥2 of the SAME set
  // key), not per halfSetId pool.  Count pieces per set key, then check that
  // at least one set key mapping to each required halfSetId has ≥2 pieces.
  if (
    artifactHalfSetIds &&
    artifactHalfSetIds.length !== 0 &&
    artifactHalfSetIds.length !== 2
  ) {
    throw new Error(
      `artifactHalfSetIds must have 0 or 2 entries, got ${artifactHalfSetIds.length}`
    );
  }
  if (artifactHalfSetIds && artifactHalfSetIds.length === 2) {
    const setKeyCounts = new Map<string, number>();
    for (const p of pieces) {
      setKeyCounts.set(p.setKey, (setKeyCounts.get(p.setKey) ?? 0) + 1);
    }

    // Set keys that satisfy a halfSetId (individually have ≥2 pieces)
    const satisfying = (hId: string): string[] =>
      [...setKeyCounts.entries()]
        .filter(([k, n]) => artifactIdToHalfSetId[k] === hId && n >= 2)
        .map(([k]) => k);

    const [h1, h2] = artifactHalfSetIds;
    if (h1 === h2) {
      // Need 2 DISTINCT set keys each mapping to h1, each with ≥2 pieces
      if (satisfying(h1).length < 2) return false;
    } else {
      // Need one set for h1 with ≥2 pieces AND one set for h2 with ≥2 pieces
      if (satisfying(h1).length === 0 || satisfying(h2).length === 0)
        return false;
    }
  }

  return true;
}

// ── Helpers ──

/** Extract artifact ER contribution (decimal, e.g. 0.518 for 51.8% ER sands). */
function getArtifactEr(art: ArtifactData): number {
  let er = 0;
  if (art.mainStatKey === "er") {
    er += getFixedMainStatValue("er", art.rarity) / 100;
  }
  if (art.substats.er) {
    er += art.substats.er / 100;
  }
  return er;
}

type ScoredArt = { art: ArtifactData; score: number; er: number };

type ArtifactTuple = [
  ArtifactData,
  ArtifactData,
  ArtifactData,
  ArtifactData,
  ArtifactData,
];

// ── Marginal-gain scoring ──

const isPct = (k: string) =>
  k.endsWith("%") || k === "cr" || k === "cd" || k === "er";

/** Score an artifact by its actual stat contributions weighted by marginal gains. */
function scorePieceMarginal(
  art: ArtifactData,
  marginalGains: Partial<Record<StatKey, number>>
): number {
  let score = 0;

  // Main stat contribution
  if (art.mainStatKey) {
    let mainVal = getFixedMainStatValue(art.mainStatKey, art.rarity);
    if (isPct(art.mainStatKey)) mainVal /= 100;
    const gain = marginalGains[art.mainStatKey as StatKey];
    if (gain) {
      // Normalize: how many avg substat rolls is this main stat worth?
      const avgRoll = AVG_SUBSTAT_ROLL[art.mainStatKey as StatKey];
      if (avgRoll) score += (mainVal / avgRoll) * gain;
    }
  }

  // Substat contributions
  for (const [subKey, subVal] of Object.entries(art.substats)) {
    if (!subVal) continue;
    let v = subVal;
    if (isPct(subKey)) v /= 100;
    const gain = marginalGains[subKey as StatKey];
    if (gain) {
      const avgRoll = AVG_SUBSTAT_ROLL[subKey as StatKey];
      if (avgRoll) score += (v / avgRoll) * gain;
    }
  }

  return score;
}

/** Compute marginal gain per stat for the swap character. */
function computeMarginalGainsForOptimizer(
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  currentArtifacts: ArtifactTuple,
  calcTargetId: string,
  calcContext: CalcContext
): Partial<Record<StatKey, number>> {
  const currentSheet = StatSheet.fromArtifacts(currentArtifacts);
  const sheets = { ...baseSheets, [swapCharId]: currentSheet };
  const stats = teamBuild.getTeamStats(sheets, calcTargetId, calcContext);
  const baseResult = teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    stats,
    calcContext
  );
  const baseDamage = baseResult.totalDamage;
  if (baseDamage === 0) return {};

  const gains: Partial<Record<StatKey, number>> = {};
  const rollableKeys = Object.keys(AVG_SUBSTAT_ROLL) as StatKey[];

  for (const key of rollableKeys) {
    const delta = AVG_SUBSTAT_ROLL[key];
    if (!delta) continue;
    const tweakedSheet = currentSheet.withDelta(key, delta);
    const tweakedSheets = { ...baseSheets, [swapCharId]: tweakedSheet };
    const newStats = teamBuild.getTeamStats(
      tweakedSheets,
      calcTargetId,
      calcContext
    );
    const newResult = teamBuild.getDamageResult(
      formulaCharId,
      formulaId,
      newStats,
      calcContext
    );
    const gain = newResult.totalDamage - baseDamage;
    if (gain !== 0) gains[key] = gain;
  }

  return gains;
}

/** Evaluate a build: returns damage if ER passes, -1 otherwise. */
function evaluateBuild(
  pieces: ArtifactTuple,
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  erCheckCharId: string,
  targetEr: number
): { damage: number; result: DamageResult | null } {
  const charSheet = StatSheet.fromArtifacts(pieces);
  const updatedSheets = { ...baseSheets, [swapCharId]: charSheet };
  const postStats = teamBuild.getTeamStats(
    updatedSheets,
    calcTargetId,
    calcContext
  );

  if (targetEr > 0) {
    const er = postStats[erCheckCharId]?.get("er") ?? 0;
    if (er < targetEr) return { damage: -1, result: null };
  }

  const dmgRes = teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext
  );
  return { damage: dmgRes.totalDamage, result: dmgRes };
}

// ── Seed build generators ──

/** Generate 5 seed builds for 4pc (or no-set). One per flex slot. */
function buildSeedBuilds4pc(
  scoredPools: Record<Slot, ScoredArt[]>,
  artifactSetId: string | null | undefined
): ArtifactTuple[] {
  const seeds: ArtifactTuple[] = [];

  for (let flexIdx = 0; flexIdx < 5; flexIdx++) {
    const pieces: ArtifactData[] = [];
    for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
      const slot = allSlots[slotIdx];
      const pool = scoredPools[slot];

      if (slotIdx === flexIdx || !artifactSetId) {
        // Flex slot (or no-set): pick best overall piece
        pieces.push(pool[0].art);
      } else {
        // Set-constrained slot: pick best set piece
        const setPiece = pool.find((s) => s.art.setKey === artifactSetId);
        pieces.push(setPiece?.art ?? pool[0].art);
      }
    }
    seeds.push(pieces as ArtifactTuple);
  }

  return seeds;
}

/** Generate top seed builds for 2+2 by brute-forcing slot assignments. */
function buildSeedBuilds2pc(
  scoredPools: Record<Slot, ScoredArt[]>,
  artifactHalfSetIds: string[],
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  erCheckCharId: string,
  targetEr: number
): ArtifactTuple[] {
  const [h1, h2] = artifactHalfSetIds;
  const isH1 = (art: ArtifactData) => artifactIdToHalfSetId[art.setKey] === h1;
  const isH2 = (art: ArtifactData) => artifactIdToHalfSetId[art.setKey] === h2;

  type SeedCandidate = { pieces: ArtifactTuple; damage: number };
  const candidates: SeedCandidate[] = [];

  // C(5,2) ways to pick 2 slots for h1, then C(3,2) ways to pick 2 slots for h2
  // from remaining 3 slots (1 flex slot left over)
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      // Slots i,j carry h1
      const remaining = [0, 1, 2, 3, 4].filter((x) => x !== i && x !== j);
      for (let ri = 0; ri < remaining.length; ri++) {
        for (let rj = ri + 1; rj < remaining.length; rj++) {
          // Slots remaining[ri], remaining[rj] carry h2
          const flexSlot = remaining.filter(
            (x) => x !== remaining[ri] && x !== remaining[rj]
          )[0];

          const pieces: ArtifactData[] = new Array(5);
          let valid = true;

          // Fill h1 slots
          for (const slotIdx of [i, j]) {
            const slot = allSlots[slotIdx];
            const pool = scoredPools[slot];
            const match = pool.find((s) => isH1(s.art));
            if (!match) {
              valid = false;
              break;
            }
            pieces[slotIdx] = match.art;
          }
          if (!valid) continue;

          // Fill h2 slots
          for (const slotIdx of [remaining[ri], remaining[rj]]) {
            const slot = allSlots[slotIdx];
            const pool = scoredPools[slot];
            const match = pool.find((s) => isH2(s.art));
            if (!match) {
              valid = false;
              break;
            }
            pieces[slotIdx] = match.art;
          }
          if (!valid) continue;

          // Fill flex slot with best overall piece
          const flexSlotKey = allSlots[flexSlot];
          pieces[flexSlot] = scoredPools[flexSlotKey][0].art;

          const tuple = pieces as ArtifactTuple;
          if (!matchesSetRequirement(tuple, null, artifactHalfSetIds)) continue;

          const { damage } = evaluateBuild(
            tuple,
            teamBuild,
            swapCharId,
            formulaCharId,
            formulaId,
            baseSheets,
            calcTargetId,
            calcContext,
            erCheckCharId,
            targetEr
          );
          candidates.push({ pieces: tuple, damage });
        }
      }
    }
  }

  // Also try h2 in (i,j) and h1 in remaining if h1 !== h2
  if (h1 !== h2) {
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        const remaining = [0, 1, 2, 3, 4].filter((x) => x !== i && x !== j);
        for (let ri = 0; ri < remaining.length; ri++) {
          for (let rj = ri + 1; rj < remaining.length; rj++) {
            const flexSlot = remaining.filter(
              (x) => x !== remaining[ri] && x !== remaining[rj]
            )[0];

            const pieces: ArtifactData[] = new Array(5);
            let valid = true;

            for (const slotIdx of [i, j]) {
              const slot = allSlots[slotIdx];
              const pool = scoredPools[slot];
              const match = pool.find((s) => isH2(s.art));
              if (!match) {
                valid = false;
                break;
              }
              pieces[slotIdx] = match.art;
            }
            if (!valid) continue;

            for (const slotIdx of [remaining[ri], remaining[rj]]) {
              const slot = allSlots[slotIdx];
              const pool = scoredPools[slot];
              const match = pool.find((s) => isH1(s.art));
              if (!match) {
                valid = false;
                break;
              }
              pieces[slotIdx] = match.art;
            }
            if (!valid) continue;

            const flexSlotKey = allSlots[flexSlot];
            pieces[flexSlot] = scoredPools[flexSlotKey][0].art;

            const tuple = pieces as ArtifactTuple;
            if (!matchesSetRequirement(tuple, null, artifactHalfSetIds))
              continue;

            const { damage } = evaluateBuild(
              tuple,
              teamBuild,
              swapCharId,
              formulaCharId,
              formulaId,
              baseSheets,
              calcTargetId,
              calcContext,
              erCheckCharId,
              targetEr
            );
            candidates.push({ pieces: tuple, damage });
          }
        }
      }
    }
  }

  // Sort by damage descending, keep top 20
  candidates.sort((a, b) => b.damage - a.damage);
  return candidates.slice(0, 20).map((c) => c.pieces);
}

/** Enumerate all combinations from per-slot alternative lists, filtering for set + ER. */
function enumerateCombinations(
  alternatives: ArtifactData[][], // alternatives[slotIdx] = list of candidates for that slot
  artifactSetId: string | null | undefined,
  artifactHalfSetIds: string[] | undefined,
  effectiveMinArtifactEr: number
): ArtifactTuple[] {
  const result: ArtifactTuple[] = [];

  for (const a0 of alternatives[0]) {
    for (const a1 of alternatives[1]) {
      for (const a2 of alternatives[2]) {
        for (const a3 of alternatives[3]) {
          for (const a4 of alternatives[4]) {
            const pieces: ArtifactTuple = [a0, a1, a2, a3, a4];

            if (
              !matchesSetRequirement(pieces, artifactSetId, artifactHalfSetIds)
            )
              continue;

            // Cheap ER pre-filter
            if (effectiveMinArtifactEr > 0) {
              const artifactEr =
                getArtifactEr(a0) +
                getArtifactEr(a1) +
                getArtifactEr(a2) +
                getArtifactEr(a3) +
                getArtifactEr(a4);
              if (artifactEr < effectiveMinArtifactEr) continue;
            }

            result.push(pieces);
          }
        }
      }
    }
  }

  return result;
}

// ── Marginal-Gain Hill-Climbing Optimizer ──

export async function* runOptimization(
  opts: OptimizerOptions
): AsyncGenerator<OptimizationResult> {
  const {
    teamBuild,
    targetCharId,
    formulaId,
    targetEr,
    inventory,
    buildMatch,
    globalConfig,
    baseSheets,
    calcContext,
    artifactSetId,
    artifactHalfSetIds,
    excludedArtifactIds,
  } = opts;

  // Resolve effective IDs (default to targetCharId for backward compat)
  const swapCharId = opts.swapCharId ?? targetCharId;
  const calcTargetId = opts.calcTargetId ?? targetCharId;
  const formulaCharId = opts.formulaCharId ?? targetCharId;
  const erCheckCharId = opts.erCheckCharId ?? swapCharId;

  const topN = opts.topN || 20;
  const startTime = Date.now();

  // ── CR discount for heuristic scoring ──
  let crDiscount = 1;
  if (swapCharId === formulaCharId) {
    if (calcContext.assumeCrit) {
      crDiscount = 0;
    } else if (calcContext.critRateTarget != null) {
      const baselineSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
      const baselineStats = teamBuild.getTeamStats(
        baselineSheets,
        calcTargetId,
        calcContext
      );
      // CR already includes the critRateTarget bonus from getTeamStats
      const effectiveCr = baselineStats[formulaCharId]?.get("cr") ?? 0;
      crDiscount = effectiveCr >= 1.0 ? 0 : Math.max(0, 1 - effectiveCr);
    }
  }

  // ── Per-slot pruning: keep top N artifacts per slot by heuristic score ──

  const scoredPools: Record<Slot, ScoredArt[]> = {
    flower: [],
    plume: [],
    sands: [],
    goblet: [],
    circlet: [],
  };

  const DUMMY_ART: ArtifactData = {
    id: "dummy",
    setKey: "empty",
    slotKey: "flower",
    rarity: 1,
    mainStatKey: "hp%",
    level: 0,
    lock: false,
    substats: {},
  };

  for (const slot of allSlots) {
    const slotArts = inventory.filter(
      (a) =>
        a.slotKey === slot &&
        (!excludedArtifactIds || !excludedArtifactIds.has(a.id))
    );

    const withScore = slotArts.map((art) => ({
      art,
      score: scorePiece(art, buildMatch, globalConfig, crDiscount),
      er: getArtifactEr(art),
    }));

    withScore.sort((a, b) => b.score - a.score);

    if (artifactSetId || artifactHalfSetIds?.length) {
      const isSetPiece = (art: ArtifactData) =>
        (!!artifactSetId && art.setKey === artifactSetId) ||
        (!!artifactHalfSetIds &&
          artifactHalfSetIds.includes(artifactIdToHalfSetId[art.setKey]));
      const setPieces = withScore
        .filter((x) => isSetPiece(x.art))
        .slice(0, topN);
      const offSetPieces = withScore
        .filter((x) => !isSetPiece(x.art))
        .slice(0, topN);
      scoredPools[slot] = [...setPieces, ...offSetPieces];
      scoredPools[slot].sort((a, b) => b.score - a.score);
    } else {
      scoredPools[slot] = withScore.slice(0, Math.max(topN, 1));
    }

    if (scoredPools[slot].length === 0) {
      scoredPools[slot] = [
        { art: { ...DUMMY_ART, slotKey: slot }, score: 0, er: 0 },
      ];
    }
  }

  // ── Pre-compute baseline ER for cheap ER pre-filter ──
  let erFloor = 0;
  if (targetEr > 0) {
    const baselineSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const baselineStats = teamBuild.getTeamStats(baselineSheets, calcTargetId);
    erFloor = baselineStats[erCheckCharId]?.get("er") ?? 0;
  }
  const minArtifactEr = Math.max(0, targetEr - erFloor);

  let maxSetErBonus = 0;
  if (minArtifactEr > 0) {
    const erHalfSetSlots = new Map<string, number>();
    for (const slot of allSlots) {
      const seen = new Set<string>();
      for (const { art } of scoredPools[slot]) {
        if (art.id === "dummy") continue;
        const hsId = artifactIdToHalfSetId[art.setKey];
        if (!hsId || !hsId.startsWith("er-") || seen.has(hsId)) continue;
        seen.add(hsId);
        erHalfSetSlots.set(hsId, (erHalfSetSlots.get(hsId) ?? 0) + 1);
      }
    }
    for (const [hsId, slotCount] of erHalfSetSlots) {
      if (slotCount >= 2) {
        const bonus = Number.parseFloat(hsId.slice(3)) / 100;
        if (Number.isFinite(bonus) && bonus > maxSetErBonus)
          maxSetErBonus = bonus;
      }
    }
  }
  const effectiveMinArtifactEr = Math.max(0, minArtifactEr - maxSetErBonus);

  // ── Yield initial progress ──
  let bestDamage = -1;
  let bestDamageResult: DamageResult | null = null;
  let bestArtifacts: Record<Slot, ArtifactData | null> = {
    flower: null,
    plume: null,
    sands: null,
    goblet: null,
    circlet: null,
  };
  let combinationsEvaluated = 0;
  let combinationsTotal = 0;

  const getResult = (
    phase: "pruning" | "evaluating",
    done = false
  ): OptimizationResult => ({
    bestDamage,
    bestDamageResult,
    bestArtifacts: { ...bestArtifacts },
    phase,
    progress:
      combinationsTotal > 0 ? combinationsEvaluated / combinationsTotal : 0,
    combinationsEvaluated,
    combinationsTotal,
    startTime,
    endTime: done ? Date.now() : null,
    done,
  });

  yield getResult("pruning");
  await new Promise((resolve) => setTimeout(resolve, 0));

  // ── Determine mode and build seeds ──
  const is4pc = !!artifactSetId;
  const is2pc =
    !artifactSetId && !!artifactHalfSetIds && artifactHalfSetIds.length === 2;
  // no-set = neither 4pc nor 2+2

  let seedBuilds: ArtifactTuple[];

  if (is2pc) {
    seedBuilds = buildSeedBuilds2pc(
      scoredPools,
      artifactHalfSetIds!,
      teamBuild,
      swapCharId,
      formulaCharId,
      formulaId,
      baseSheets,
      calcTargetId,
      calcContext,
      erCheckCharId,
      targetEr
    );
  } else {
    // 4pc or no-set: 5 seed builds
    seedBuilds = buildSeedBuilds4pc(scoredPools, artifactSetId);
  }

  // Deduplicate seeds by artifact ID tuple
  {
    const seen = new Set<string>();
    seedBuilds = seedBuilds.filter((s) => {
      const key = s.map((a) => a.id).join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (seedBuilds.length === 0) {
    yield getResult("evaluating", true);
    return;
  }

  // Number of alternatives per slot depends on mode
  const altCount = is2pc ? 1 : 3;

  // Estimate total evaluations for progress reporting
  const combosPerSeed = (1 + altCount) ** 5;
  // 2 rounds
  combinationsTotal = seedBuilds.length * combosPerSeed * 2;

  yield getResult("pruning");
  await new Promise((resolve) => setTimeout(resolve, 0));

  // ── Helper: update best if improved ──
  function updateBest(
    pieces: ArtifactTuple,
    damage: number,
    result: DamageResult | null
  ) {
    if (damage > bestDamage) {
      bestDamage = damage;
      bestDamageResult = result;
      bestArtifacts = {
        flower: pieces[0],
        plume: pieces[1],
        sands: pieces[2],
        goblet: pieces[3],
        circlet: pieces[4],
      };
    }
  }

  // ── Round loop (2 rounds) ──
  let bestBuildTuple: ArtifactTuple = seedBuilds[0];
  const CHUNK_SIZE = 200;
  let chunkCount = 0;

  for (let round = 0; round < 2; round++) {
    const roundStartDamage = bestDamage;

    // In round 2, start from the single best build found so far
    const roundSeeds = round === 0 ? seedBuilds : [bestBuildTuple];

    for (const seed of roundSeeds) {
      // Evaluate seed itself
      const seedEval = evaluateBuild(
        seed,
        teamBuild,
        swapCharId,
        formulaCharId,
        formulaId,
        baseSheets,
        calcTargetId,
        calcContext,
        erCheckCharId,
        targetEr
      );
      if (seedEval.damage > 0) {
        updateBest(seed, seedEval.damage, seedEval.result);
      }
      combinationsEvaluated++;
      chunkCount++;

      // Compute marginal gains from this seed
      const marginalGains = computeMarginalGainsForOptimizer(
        teamBuild,
        swapCharId,
        formulaCharId,
        formulaId,
        baseSheets,
        seed,
        calcTargetId,
        calcContext
      );

      // For each slot, score all pool artifacts by marginal gains, pick top K alternatives
      const perSlotAlternatives: ArtifactData[][] = [];

      for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
        const slot = allSlots[slotIdx];
        const pool = scoredPools[slot];
        const currentArtId = seed[slotIdx].id;

        // Score all pool artifacts by marginal gain
        const scored = pool
          .filter((s) => s.art.id !== currentArtId)
          .map((s) => ({
            art: s.art,
            mgScore: scorePieceMarginal(s.art, marginalGains),
          }))
          .sort((a, b) => b.mgScore - a.mgScore);

        const topAlts = scored.slice(0, altCount).map((s) => s.art);
        // Include current piece + alternatives
        perSlotAlternatives.push([seed[slotIdx], ...topAlts]);
      }

      // Enumerate all combinations
      const combos = enumerateCombinations(
        perSlotAlternatives,
        artifactSetId,
        artifactHalfSetIds,
        effectiveMinArtifactEr
      );

      // Evaluate each combo
      for (const combo of combos) {
        // Skip if identical to seed (already evaluated)
        if (
          combo[0].id === seed[0].id &&
          combo[1].id === seed[1].id &&
          combo[2].id === seed[2].id &&
          combo[3].id === seed[3].id &&
          combo[4].id === seed[4].id
        ) {
          combinationsEvaluated++;
          chunkCount++;
          continue;
        }

        const { damage, result } = evaluateBuild(
          combo,
          teamBuild,
          swapCharId,
          formulaCharId,
          formulaId,
          baseSheets,
          calcTargetId,
          calcContext,
          erCheckCharId,
          targetEr
        );
        if (damage > 0) {
          updateBest(combo, damage, result);
          if (damage > bestDamage - 0.001) {
            // Track best build tuple for next round
            bestBuildTuple = combo;
          }
        }
        combinationsEvaluated++;
        chunkCount++;

        if (chunkCount >= CHUNK_SIZE) {
          chunkCount = 0;
          yield getResult("evaluating");
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    // Update bestBuildTuple to the actual best
    if (bestDamage > 0) {
      bestBuildTuple = [
        bestArtifacts.flower!,
        bestArtifacts.plume!,
        bestArtifacts.sands!,
        bestArtifacts.goblet!,
        bestArtifacts.circlet!,
      ];
    }

    if (round === 1) {
      const improved = bestDamage > roundStartDamage;
      console.log(
        `[Optimizer] Round 2 ${improved ? "improved" : "did not improve"} damage${improved ? ` (${roundStartDamage.toFixed(0)} → ${bestDamage.toFixed(0)})` : ` (${bestDamage.toFixed(0)})`}`
      );
    }

    yield getResult("evaluating");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Update total to match actual evaluations for final progress = 1
  combinationsTotal = combinationsEvaluated;
  yield getResult("evaluating", true);
}
