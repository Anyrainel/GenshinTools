/**
 * Team Optimization: Conflict-aware DFS allocation + multi-phase refinement.
 *
 * Contains the team-level orchestration logic:
 * - Dynamic hyperparameter computation
 * - evaluateBuildDirect helper
 * - findBestTeamAllocation (conflict-aware DFS)
 * - Heuristic artifact assignment helpers
 * - runTeamOptimization async generator (main entry point)
 */

import { detectEquippedSets } from "@/components/team-comp/teamOptUtils";
import { artifactHalfSetsById } from "@/data/constants";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { scoreSlot } from "../../account-data/artifactScore";
import { TeamBuild, evaluateCombo, hasOffFieldParts } from "../damageCalc";
import { StatSheet } from "../damageModels";
import type {
  CalcContext,
  ComboResult,
  DamageResult,
  OptFailReason,
  PerCharConfig,
  ReactionOverride,
  StatKey,
  TeamOptComboResult,
  TeamOptPassId,
  TeamOptPassResult,
  TeamOptSingleResult,
  TeamOptYield,
  TeamOptimizationProgress,
  TeamOptimizerOptions,
} from "../types";
import {
  buildSuperArtifact,
  computeWeightScore,
  getArtifactEr,
} from "./artifactScoring";
import { runCharacterBnB } from "./characterBnB";
import { evaluateBuild } from "./evaluation";
import { TopKCollector } from "./topKCollector";
import type { ArtifactTuple, BnBContext, TopKEntry } from "./types";

// ─── Constants & Dynamic Hyperparameters ───

/**
 * Compute dynamic hyperparameters based on inventory size.
 *
 * With small inventories (<500 artifacts), B&B completes quickly and smaller
 * top-K is sufficient. With large inventories (>1500), we need more top-K
 * alternatives for team allocation (more conflicts) but can afford it since
 * the DFS prunes effectively with a well-seeded threshold.
 *
 * Game limit: 2400 artifacts max. Typical: 1000-2000.
 * Per-set max observed: ~300 pieces. Per-set-slot max: ~60.
 */
function computeHyperparams(inventorySize: number): {
  topK: number;
  maxTeamSearch: number;
} {
  // topK: scale linearly from 100 (at 500 arts) to 300 (at 2400 arts)
  // More artifacts → more potential conflicts → need more alternatives
  const topK = Math.max(
    100,
    Math.min(300, Math.round(100 + (inventorySize - 500) * (200 / 1900)))
  );

  // maxTeamSearch: scale with topK^2 (DFS complexity grows with K)
  // At topK=100: 200K is plenty. At topK=300: need ~1M.
  const maxTeamSearch = Math.max(
    200_000,
    Math.min(2_000_000, Math.round(topK * topK * 20))
  );

  return { topK, maxTeamSearch };
}

const warnedCalcErrors = new Set<string>();

/** Helper to evaluate a build without a pre-existing BnBContext. */
export function evaluateBuildDirect(
  pieces: ArtifactTuple,
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  erCheckCharId: string,
  minEr: number,
  minCr: number,
  reactionOverride?: ReactionOverride,
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number
): { damage: number; result: DamageResult | null } {
  // Compute erFloor/crFloor so the scoreFn constraint check works correctly
  let erFloor = 0;
  let crFloor = 0;
  if (minEr > 0 || minCr > 0) {
    const blSheets = { ...baseSheets, [swapCharId]: new StatSheet([]) };
    const blStats = teamBuild.getTeamStats(blSheets, calcTargetId, calcContext);
    if (minEr > 0) erFloor = blStats[erCheckCharId]?.get("er", null) ?? 0;
    if (minCr > 0) crFloor = blStats[erCheckCharId]?.get("cr", null) ?? 0;
  }
  const tempCtx: BnBContext = {
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    calcTargetId,
    calcContext,
    erCheckCharId,
    minEr,
    minCr,
    erFloor,
    crFloor,
    reactionOverride,
    scoreFn,
    collector: new TopKCollector(1),
    evaluations: 0,
    sinceLastYield: 0,
  };
  return evaluateBuild(pieces, tempCtx);
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: Team Allocation via Conflict-Aware DFS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Given top-K results per character, find the best team assignment where
 * no artifact is shared between characters.
 *
 * Uses DFS with:
 * - Characters ordered by "flexibility" (least flexible first)
 * - Upper-bound pruning (remaining chars use rank-1 damage)
 * - Artifact intersection skipping
 */
/** Number of top candidate allocations to keep (ranked by actual team damage). */
const ALLOC_TOP_N = 50;

/** Max entries explored per character in the allocation DFS. */
const ALLOC_WIDTH = 30;

/** Max team evaluations per DFS ordering before stopping. */
const MAX_TEAM_EVALS_PER_ORDERING = 10_000;

/**
 * Evaluate actual team damage for a complete artifact allocation.
 * This is the ONLY scoring function used in team allocation — no proxies.
 */
type TeamEvalFn = (assignment: Record<string, TopKEntry>) => number;

function findBestTeamAllocation(
  charIds: string[],
  topKByChar: Record<string, TopKEntry[]>,
  maxIterations: number,
  teamEvalFn: TeamEvalFn
): {
  /** Top-N candidate assignments sorted by actual team damage (descending). */
  candidates: { assignment: Record<string, TopKEntry>; score: number }[];
  iterations: number;
} {
  if (charIds.length === 0) return { candidates: [], iterations: 0 };

  // Collect top-N candidates across ALL orderings (sorted descending by team damage)
  const topCandidates: {
    assignment: Record<string, TopKEntry>;
    score: number;
  }[] = [];
  let worstTopScore = Number.NEGATIVE_INFINITY;
  let totalIterations = 0;

  function insertCandidate(
    assignment: Record<string, TopKEntry>,
    score: number
  ): void {
    if (topCandidates.length >= ALLOC_TOP_N && score <= worstTopScore) return;
    let lo = 0;
    let hi = topCandidates.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (topCandidates[mid].score > score) lo = mid + 1;
      else hi = mid;
    }
    topCandidates.splice(lo, 0, { assignment: { ...assignment }, score });
    if (topCandidates.length > ALLOC_TOP_N) topCandidates.length = ALLOC_TOP_N;
    if (topCandidates.length >= ALLOC_TOP_N) {
      worstTopScore = topCandidates[topCandidates.length - 1].score;
    }
  }

  // Run DFS with a given character ordering.
  // Each character gets first pick in turn, exploring ALLOC_WIDTH entries.
  // Team damage is evaluated at every complete allocation (leaf node).
  function runDfsWithOrdering(ordered: string[]): void {
    let iterations = 0;
    let teamEvals = 0;

    function dfs(
      level: number,
      usedArtifacts: Set<string>,
      assignment: Record<string, TopKEntry>
    ): void {
      if (
        iterations >= maxIterations ||
        teamEvals >= MAX_TEAM_EVALS_PER_ORDERING
      )
        return;

      if (level === ordered.length) {
        const teamDamage = teamEvalFn(assignment);
        teamEvals++;
        insertCandidate(assignment, teamDamage);
        return;
      }

      const charId = ordered[level];
      const entries = topKByChar[charId] ?? [];
      const limit = Math.min(entries.length, ALLOC_WIDTH);
      let explored = 0;

      for (let i = 0; i < entries.length && explored < limit; i++) {
        iterations++;
        if (
          iterations >= maxIterations ||
          teamEvals >= MAX_TEAM_EVALS_PER_ORDERING
        )
          return;

        const entry = entries[i];

        let conflict = false;
        for (const artId of entry.artifactIds) {
          if (usedArtifacts.has(artId)) {
            conflict = true;
            break;
          }
        }
        if (conflict) continue;

        explored++;
        for (const artId of entry.artifactIds) usedArtifacts.add(artId);
        assignment[charId] = entry;

        dfs(level + 1, usedArtifacts, assignment);

        for (const artId of entry.artifactIds) usedArtifacts.delete(artId);
        delete assignment[charId];
      }
    }

    dfs(0, new Set(), {});
    totalIterations += iterations;
  }

  // Build orderings: try each character as "first" (gets artifact priority),
  // with remaining characters sorted by flexibility (least flexible first).
  // This ensures every character gets a fair shot at contested artifacts.
  const flexOrder = [...charIds].sort((a, b) => {
    const aEntries = topKByChar[a] ?? [];
    const bEntries = topKByChar[b] ?? [];
    if (aEntries.length !== bEntries.length)
      return aEntries.length - bEntries.length;
    const aFlex =
      aEntries.length >= 2
        ? aEntries[0].damage - aEntries[aEntries.length - 1].damage
        : 0;
    const bFlex =
      bEntries.length >= 2
        ? bEntries[0].damage - bEntries[bEntries.length - 1].damage
        : 0;
    return aFlex - bFlex;
  });

  // First: default flexibility ordering
  runDfsWithOrdering(flexOrder);

  // Then: each character rotated to front, rest in flex order
  for (const frontChar of charIds) {
    if (frontChar === flexOrder[0]) continue; // already tried
    const rest = flexOrder.filter((id) => id !== frontChar);
    runDfsWithOrdering([frontChar, ...rest]);
  }

  // Greedy fallback with multiple orderings
  if (topCandidates.length === 0) {
    const orderings: string[][] = [
      flexOrder,
      [...flexOrder].reverse(),
      ...charIds.map((front) => [
        front,
        ...charIds.filter((id) => id !== front),
      ]),
    ];

    for (const ordering of orderings) {
      const greedyUsed = new Set<string>();
      const greedyAssignment: Record<string, TopKEntry> = {};

      for (const cid of ordering) {
        const entries = topKByChar[cid] ?? [];
        for (const entry of entries) {
          let conflict = false;
          for (const artId of entry.artifactIds) {
            if (greedyUsed.has(artId)) {
              conflict = true;
              break;
            }
          }
          if (!conflict) {
            greedyAssignment[cid] = entry;
            for (const artId of entry.artifactIds) greedyUsed.add(artId);
            break;
          }
        }
      }

      if (Object.keys(greedyAssignment).length === ordering.length) {
        const teamDamage = teamEvalFn(greedyAssignment);
        insertCandidate(greedyAssignment, teamDamage);
      }
    }
  }

  return { candidates: topCandidates, iterations: totalIterations };
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: Team Optimization Entry Point
// ═══════════════════════════════════════════════════════════════════════

const emptyArtifacts: Record<Slot, ArtifactData | null> = {
  flower: null,
  plume: null,
  sands: null,
  goblet: null,
  circlet: null,
};

function artsTupleToRecord(
  tuple: ArtifactTuple
): Record<Slot, ArtifactData | null> {
  return {
    flower: tuple[0],
    plume: tuple[1],
    sands: tuple[2],
    goblet: tuple[3],
    circlet: tuple[4],
  };
}

function buildSheetsFromArtifacts(
  baseSheets: Record<string, StatSheet>,
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
): Record<string, StatSheet> {
  const sheets = { ...baseSheets };
  for (const [charId, arts] of Object.entries(artifactsByChar)) {
    const pieces = allSlots
      .map((s) => arts[s])
      .filter((a): a is ArtifactData => a != null);
    sheets[charId] = StatSheet.fromArtifacts(pieces);
  }
  return sheets;
}

// ─── Heuristic Initial baseSheets Builder ───

/**
 * Build a heuristic artifact assignment for one character using weight-scored
 * artifacts that respect set constraints. Returns the picked artifacts record.
 * Used to seed baseSheets before Phase 1 so all characters see a realistic
 * team context without sequential dependency.
 */
function buildHeuristicAssignment(
  charConfig: PerCharConfig,
  inventory: ArtifactData[],
  globalConfig: GlobalStatWeights,
  assignedIds: Set<string>
): Record<Slot, ArtifactData | null> {
  const empty: Record<Slot, ArtifactData | null> = {
    flower: null,
    plume: null,
    sands: null,
    goblet: null,
    circlet: null,
  };

  const is4pc = !!charConfig.artifactSetId;
  const is2pc =
    !charConfig.artifactSetId &&
    !!charConfig.artifactHalfSetIds &&
    charConfig.artifactHalfSetIds.length === 2;

  const buildMatch = charConfig.buildMatch;

  // Determine per-slot set constraints
  const slotSetAssignment: (string | null)[] = [null, null, null, null, null];

  if (is4pc) {
    const setId = charConfig.artifactSetId!;
    const onSetCounts = allSlots.map(
      (slot) =>
        inventory.filter(
          (a) =>
            a.slotKey === slot && a.setKey === setId && !assignedIds.has(a.id)
        ).length
    );
    let flexSlotIdx = 0;
    for (let i = 1; i < 5; i++) {
      if (onSetCounts[i] < onSetCounts[flexSlotIdx]) flexSlotIdx = i;
    }
    for (let i = 0; i < 5; i++) {
      slotSetAssignment[i] = i === flexSlotIdx ? null : setId;
    }
  } else if (is2pc) {
    const [h1, h2] = charConfig.artifactHalfSetIds!;
    const h1Sets = new Set(artifactHalfSetsById[h1]?.setIds ?? []);
    const h2Sets = new Set(artifactHalfSetsById[h2]?.setIds ?? []);
    let h1Count = 0;
    let h2Count = 0;
    for (let i = 0; i < 5; i++) {
      if (h1Count < 2) {
        const hasH1 = inventory.some(
          (a) =>
            a.slotKey === allSlots[i] &&
            h1Sets.has(a.setKey) &&
            !assignedIds.has(a.id)
        );
        if (hasH1) {
          slotSetAssignment[i] = h1;
          h1Count++;
          continue;
        }
      }
      if (h2Count < 2) {
        const hasH2 = inventory.some(
          (a) =>
            a.slotKey === allSlots[i] &&
            h2Sets.has(a.setKey) &&
            !assignedIds.has(a.id)
        );
        if (hasH2) {
          slotSetAssignment[i] = h2;
          h2Count++;
        }
      }
    }
  }

  const picked = { ...empty };
  const pickedIds = new Set<string>();

  for (let si = 0; si < 5; si++) {
    const slot = allSlots[si];
    const requiredSetOrHalf = slotSetAssignment[si];

    let candidates = inventory.filter(
      (a) =>
        a.slotKey === slot && !assignedIds.has(a.id) && !pickedIds.has(a.id)
    );

    if (requiredSetOrHalf) {
      const halfSet = artifactHalfSetsById[requiredSetOrHalf];
      if (halfSet) {
        const validSets = new Set(halfSet.setIds);
        const filtered = candidates.filter((a) => validSets.has(a.setKey));
        if (filtered.length > 0) candidates = filtered;
      } else {
        const filtered = candidates.filter(
          (a) => a.setKey === requiredSetOrHalf
        );
        if (filtered.length > 0) candidates = filtered;
      }
    }

    if (candidates.length === 0) continue;

    const fallbackWeights = buildMatch
      ? undefined
      : ({ er: 100 } as Record<string, number>);
    candidates.sort((a, b) => {
      const sa = buildMatch
        ? computeWeightScore(a, buildMatch, globalConfig, 1)
        : scoreSlot(a, fallbackWeights!, globalConfig);
      const sb = buildMatch
        ? computeWeightScore(b, buildMatch, globalConfig, 1)
        : scoreSlot(b, fallbackWeights!, globalConfig);
      return sb - sa || b.level - a.level;
    });

    picked[slot] = candidates[0];
    pickedIds.add(candidates[0].id);
  }

  // Mark picked IDs as assigned for subsequent characters
  for (const id of pickedIds) assignedIds.add(id);
  return picked;
}

/**
 * Build heuristic baseSheets for all characters. Carries get first pick.
 * Returns baseSheets where each character's entry uses set-valid artifacts.
 */
function buildHeuristicBaseSheets(
  allCharIds: string[],
  carryCharIds: string[],
  perChar: Record<string, PerCharConfig>,
  inventory: ArtifactData[],
  globalConfig: GlobalStatWeights,
  baseSheets: Record<string, StatSheet>
): Record<string, StatSheet> {
  const result = { ...baseSheets };
  const assignedIds = new Set<string>();

  // Process carries first, then supports
  const ordered = [
    ...allCharIds.filter((id) => carryCharIds.includes(id)),
    ...allCharIds.filter((id) => !carryCharIds.includes(id)),
  ];

  for (const charId of ordered) {
    const charConfig = perChar[charId];
    if (!charConfig) continue;
    const picked = buildHeuristicAssignment(
      charConfig,
      inventory,
      globalConfig,
      assignedIds
    );
    const pieces = allSlots
      .map((s) => picked[s])
      .filter((a): a is ArtifactData => a != null);
    if (pieces.length > 0) {
      result[charId] = StatSheet.fromArtifacts(pieces);
    }
  }
  return result;
}

/**
 * V2 Team Optimizer: B&B per character → top-K → conflict-aware DFS.
 * Same interface as V1's `runTeamOptimization`.
 */
export async function* runTeamOptimization(
  opts: TeamOptimizerOptions
): AsyncGenerator<TeamOptYield> {
  const {
    teamBuild,
    carryCharId,
    formulaId,
    inventory,
    calcContext,
    globalConfig,
    baseSheets,
    perChar,
    reactionOverride,
    combo,
    reactionOverrides,
    perCharDeadlineMs: rawPerCharDeadlineMs,
    teamDeadlineMs,
    maxArtsPerSlot,
    partialBuffs,
    comboLinePartialBuffs,
  } = opts;

  // ── Dynamic hyperparameters based on inventory size ──
  const { topK: TOP_K, maxTeamSearch: MAX_TEAM_SEARCH } = computeHyperparams(
    inventory.length
  );

  // ── Time budget management ──
  // If teamDeadlineMs is set, compute per-char budgets dynamically.
  // Budget split: Phase 1 gets 60%, Phase 3+3b gets 30%, Phase 2+overhead gets 10%.
  const numChars = Object.keys(perChar).length || 4;
  const phase1Fraction = 0.6;
  const perCharDeadlineMs = teamDeadlineMs
    ? Math.max(
        500,
        ((teamDeadlineMs - performance.now()) * phase1Fraction) / numChars
      )
    : rawPerCharDeadlineMs;

  const isComboMode =
    combo != null && combo.lines.filter((l) => l.count > 0).length > 0;

  // Combo scoring function
  const comboScoreFn = isComboMode
    ? (sheets: Record<string, StatSheet>, _calcTargetId: string): number => {
        try {
          return evaluateCombo(
            teamBuild,
            combo,
            sheets,
            calcContext,
            reactionOverrides,
            comboLinePartialBuffs
          ).totalDamage;
        } catch (e) {
          const key = `comboScoreFn:${_calcTargetId}`;
          if (!warnedCalcErrors.has(key)) {
            warnedCalcErrors.add(key);
            console.warn("[optimizerV2] comboScoreFn failed:", e);
          }
          return 0;
        }
      }
    : undefined;

  // Helper: compute off-field stats for a given team build and sheets
  const getOffFieldStatsFor = (
    tb: TeamBuild,
    sheets: Record<string, StatSheet>
  ): Record<string, StatSheet> | undefined => {
    if (!hasOffFieldParts(tb, carryCharId, formulaId)) return undefined;
    const otherCharId = Object.keys(tb.charBuilds).find(
      (id) => id !== carryCharId
    );
    if (!otherCharId) return undefined;
    return tb.getTeamStats(sheets, otherCharId, calcContext);
  };

  const allCharIds = Object.keys(perChar);
  const carryCharIds = isComboMode
    ? allCharIds.filter((id) =>
        combo.lines.some((l) => l.count > 0 && l.charId === id)
      )
    : [carryCharId];

  // ── Saturation detection ──
  // For each support, test if any artifact stats affect team damage.
  // If super-artifact (max possible stats) vs empty sheet produces < ε
  // relative damage difference, the character is "intrinsically saturated"
  // and B&B is skipped entirely.
  const saturatedCharIds = new Set<string>();
  {
    const supportCharIds = allCharIds.filter(
      (id) => !carryCharIds.includes(id)
    );
    for (const cid of supportCharIds) {
      try {
        // Evaluate with empty artifact sheet
        const emptySheets = { ...baseSheets, [cid]: new StatSheet([]) };
        let dmgEmpty: number;
        if (comboScoreFn) {
          dmgEmpty = comboScoreFn(emptySheets, carryCharId);
        } else {
          const ps = teamBuild.getTeamStats(
            emptySheets,
            carryCharId,
            calcContext
          );
          dmgEmpty = teamBuild.getDamageResult(
            carryCharId,
            formulaId,
            ps,
            calcContext,
            reactionOverride,
            getOffFieldStatsFor(teamBuild, emptySheets)
          ).totalDamage;
        }

        // Build super-artifact sheet: max stat per slot, then sum across slots
        const superStats: Partial<Record<StatKey, number>> = {};
        for (let si = 0; si < 5; si++) {
          const slot = allSlots[si];
          const slotArts = inventory.filter((a) => a.slotKey === slot);
          if (slotArts.length === 0) continue;
          const sa = buildSuperArtifact(slotArts);
          for (const [key, val] of Object.entries(sa.stats)) {
            const sk = key as StatKey;
            superStats[sk] = (superStats[sk] ?? 0) + val;
          }
        }
        const superSheet = StatSheet.fromRaw(superStats);
        const superSheets = { ...baseSheets, [cid]: superSheet };
        let dmgSuper: number;
        if (comboScoreFn) {
          dmgSuper = comboScoreFn(superSheets, carryCharId);
        } else {
          const ps = teamBuild.getTeamStats(
            superSheets,
            carryCharId,
            calcContext
          );
          dmgSuper = teamBuild.getDamageResult(
            carryCharId,
            formulaId,
            ps,
            calcContext,
            reactionOverride,
            getOffFieldStatsFor(teamBuild, superSheets)
          ).totalDamage;
        }

        const base = Math.max(dmgEmpty, 1);
        if (Math.abs(dmgSuper - dmgEmpty) / base < 0.001) {
          saturatedCharIds.add(cid);
        }
      } catch {
        // If evaluation fails, don't mark as saturated — let B&B handle it
      }
    }
  }

  // Mutable effective state
  let effectiveTeamBuild = teamBuild;
  const effectivePerChar = { ...perChar };

  function rebuildTeamBuild(): TeamBuild {
    const newConfigs = teamBuild.configs.map((c) => {
      const epc = effectivePerChar[c.charId];
      if (epc) {
        return {
          ...c,
          artifactSetId: epc.artifactSetId ?? null,
          artifactHalfSetIds: epc.artifactHalfSetIds ?? [],
        };
      }
      return c;
    });
    return new TeamBuild(
      newConfigs,
      teamBuild.combatOpts,
      teamBuild.enemyElementAura
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 1: Parallel Per-character B&B → top-K results (via Web Workers)
  //
  // Build heuristic baseSheets so all characters see a realistic team
  // context without sequential dependency, then run each character's
  // B&B in a separate Web Worker.
  // ════════════════════════════════════════════════════════════════════

  const topKByChar: Record<string, TopKEntry[]> = {};
  const failReasons: Record<string, OptFailReason> = {};
  const passResults: TeamOptPassResult[] = [];

  // ── Weighted phase boundaries for smooth progress bar ──
  // Phase 1 (parallel B&B):  0% → 30%
  // Phase 2 (team alloc):   30% → 45%
  // Init (setup + heuristics):       0% → 10%
  // Phase 1 (per-char B&B):         10% → 40%
  // Phase 2 (team alloc):           40% → 60%
  // Phase 3 (ranked team refine):   60% → 100%
  const INIT_WEIGHT = 0.1;
  const PHASE1_WEIGHT = 0.3;
  const PHASE2_WEIGHT = 0.2;
  const PHASE3_WEIGHT = 0.4;
  const totalPhases = allCharIds.length + 1; // kept for passIndex display

  // Build heuristic baseSheets with set-valid artifacts for realistic team context
  const heuristicSheets = buildHeuristicBaseSheets(
    allCharIds,
    carryCharIds,
    effectivePerChar,
    inventory,
    globalConfig,
    baseSheets
  );

  // Yield: Phase 1 starting
  yield {
    currentPass: "carry-1",
    currentPassCharId: carryCharIds[0] ?? allCharIds[0],
    passIndex: 0,
    totalPasses: totalPhases,
    passPhase: "pruning",
    passProgress: 0,
    overallProgress: 0,
    phase: "init",
    passResults: [],
    done: false,
  } satisfies TeamOptimizationProgress;
  await new Promise((r) => setTimeout(r, 0));

  // Identify characters to optimize (skip saturated)
  const charsToOptimize = allCharIds.filter(
    (id) => !saturatedCharIds.has(id) && effectivePerChar[id]
  );
  for (const charId of allCharIds) {
    if (saturatedCharIds.has(charId)) {
      passResults.push({
        passId: "support",
        charId,
        bestDamage: -1,
        bestArtifacts: { ...emptyArtifacts },
      });
    }
  }

  // Serialize baseSheets for workers
  const baseSheetsDump: Record<
    string,
    { key: StatKey; filterKey: string; value: number }[]
  > = {};
  for (const [cid, sheet] of Object.entries(heuristicSheets)) {
    baseSheetsDump[cid] = sheet.toSerializable();
  }

  // Phase 1 budget: each worker gets the full per-char budget (they run in parallel)
  const phase1BudgetMs = perCharDeadlineMs
    ? perCharDeadlineMs * numChars // total Phase 1 budget = per-char × numChars
    : undefined;

  // Try parallel execution via Web Workers; fall back to sequential if unavailable
  const useWorkers =
    typeof Worker !== "undefined" && charsToOptimize.length > 1;

  if (useWorkers) {
    // Spawn one worker per character, poll for progress
    type WorkerResult = {
      charId: string;
      entries: TopKEntry[];
      evaluations: number;
      failReason?: OptFailReason;
      substatWeights?: Record<string, number>;
    };

    // Initialize all chars with 0 so in-progress badges show immediately
    const workerBestByChar: Record<string, number> = {};
    for (const cid of charsToOptimize) workerBestByChar[cid] = 0;
    const workerResults: Record<string, WorkerResult> = {};
    let completedWorkers = 0;
    const totalWorkers = charsToOptimize.length;

    const workerDonePromises: Promise<void>[] = charsToOptimize.map(
      (charId) => {
        const charConfig = effectivePerChar[charId];
        return new Promise<void>((resolve) => {
          const worker = new Worker(
            new URL("../optimizerV2.worker.ts", import.meta.url),
            { type: "module" }
          );

          const addPassResult = (wr: WorkerResult) => {
            const pid: TeamOptPassId = carryCharIds.includes(charId)
              ? "carry-1"
              : "support";
            const best = wr.entries[0];
            passResults.push({
              passId: pid,
              charId,
              bestDamage: best?.damage ?? -1,
              bestArtifacts: best
                ? artsTupleToRecord(best.artifacts)
                : { ...emptyArtifacts },
              failReason: wr.failReason,
              substatWeights: wr.substatWeights,
            });
          };

          const onTimeout = () => {
            worker.terminate();
            console.warn(
              `[optimizerV2] Worker timed out for ${charId} (ready=${workerReady})`
            );
            const wr: WorkerResult = {
              charId,
              entries: [],
              evaluations: 0,
              failReason: { kind: "timeout" },
            };
            workerResults[charId] = wr;
            addPassResult(wr);
            completedWorkers++;
            resolve();
          };
          let workerReady = false;
          // Short setup timeout (10s) — if the worker can't even start, fail fast
          let timeoutId = setTimeout(onTimeout, 10_000);

          worker.onmessage = (
            e: MessageEvent<import("../optimizerV2.worker").BnBWorkerResponse>
          ) => {
            const resp = e.data;
            if (resp.type === "ready") {
              // Worker setup done — switch to the full search budget
              workerReady = true;
              clearTimeout(timeoutId);
              timeoutId = setTimeout(
                onTimeout,
                (phase1BudgetMs ?? 30_000) * 1.5
              );
              return;
            }
            if (resp.type === "progress") {
              // Update mutable map — read during polling yield
              workerBestByChar[resp.charId] = resp.bestDamage;
              return;
            }
            clearTimeout(timeoutId);
            worker.terminate();
            if (resp.type === "error") {
              console.warn(
                `[optimizerV2] Worker error for ${charId}:`,
                resp.error
              );
              const wr: WorkerResult = {
                charId,
                entries: [],
                evaluations: 0,
                failReason: { kind: "worker-error", message: resp.error },
              };
              workerResults[charId] = wr;
              addPassResult(wr);
              completedWorkers++;
              resolve();
              return;
            }
            // type === "done"
            const entries: TopKEntry[] = resp.entries.map((entry) => ({
              damage: entry.damage,
              result: entry.result,
              artifacts: entry.artifacts as ArtifactTuple,
              artifactIds: new Set(entry.artifactIds),
            }));
            const wr: WorkerResult = {
              charId,
              entries,
              evaluations: resp.evaluations,
              failReason: resp.failReason,
              substatWeights: resp.substatWeights,
            };
            workerResults[charId] = wr;
            addPassResult(wr);
            if (import.meta.env?.DEV) {
              console.log(
                `[teamOpt] Worker done: ${charId}, weights:`,
                resp.substatWeights
                  ? Object.keys(resp.substatWeights).join(",")
                  : "none"
              );
            }
            completedWorkers++;
            resolve();
          };

          worker.onerror = (e) => {
            clearTimeout(timeoutId);
            worker.terminate();
            console.warn(`[optimizerV2] Worker crashed for ${charId}:`, e);
            const wr: WorkerResult = {
              charId,
              entries: [],
              evaluations: 0,
              failReason: {
                kind: "worker-error",
                message: e.message || "Worker crashed",
              },
            };
            workerResults[charId] = wr;
            addPassResult(wr);
            completedWorkers++;
            resolve();
          };

          const request: import("../optimizerV2.worker").BnBWorkerRequest = {
            id: 0,
            charId,
            charConfig,
            configs: teamBuild.configs,
            combatOpts: teamBuild.combatOpts,
            enemyElementAura: teamBuild.enemyElementAura,
            carryCharId,
            formulaId,
            inventory,
            globalConfig,
            baseSheetsDump,
            calcContext,
            reactionOverride,
            topK: TOP_K,
            deadlineMs: phase1BudgetMs,
            maxArtsPerSlot: maxArtsPerSlot ?? 0,
            isComboMode,
            combo: isComboMode ? combo : undefined,
            reactionOverrides: isComboMode ? reactionOverrides : undefined,
            partialBuffs,
            comboLinePartialBuffs: isComboMode
              ? comboLinePartialBuffs
              : undefined,
          };

          worker.postMessage(request);
        });
      }
    );

    // Polling loop: yield progress with live best damage
    const allDonePromise = Promise.all(workerDonePromises);
    let allDone = false;
    allDonePromise.then(() => {
      allDone = true;
    });

    // Yield immediately so the UI shows in-progress badges right away
    yield {
      currentPass: "carry-1",
      currentPassCharId: carryCharIds[0] ?? allCharIds[0],
      passIndex: 0,
      totalPasses: totalPhases,
      passPhase: "evaluating" as const,
      passProgress: 0,
      overallProgress: INIT_WEIGHT,
      phase: "phase1",
      passResults: [...passResults],
      workerBestDamage: { ...workerBestByChar },
      done: false,
    } satisfies TeamOptimizationProgress;

    while (!allDone) {
      await new Promise((r) => setTimeout(r, 100));
      // Remove completed chars from workerBestDamage (they'll appear in passResults)
      const liveWorkerBest: Record<string, number> = {};
      for (const [cid, dmg] of Object.entries(workerBestByChar)) {
        if (!workerResults[cid]) liveWorkerBest[cid] = dmg;
      }
      yield {
        currentPass: "carry-1",
        currentPassCharId: carryCharIds[0] ?? allCharIds[0],
        passIndex: 0,
        totalPasses: totalPhases,
        passPhase: "evaluating" as const,
        passProgress: completedWorkers / totalWorkers,
        overallProgress:
          INIT_WEIGHT + PHASE1_WEIGHT * (completedWorkers / totalWorkers),
        phase: "phase1",
        passResults: [...passResults],
        workerBestDamage: liveWorkerBest,
        done: false,
      } satisfies TeamOptimizationProgress;
    }

    // Collect final results (passResults already populated in onmessage)
    for (const charId of charsToOptimize) {
      const wr = workerResults[charId];
      if (!wr) continue;
      topKByChar[wr.charId] = wr.entries;
      if (wr.failReason) failReasons[wr.charId] = wr.failReason;
    }
  } else {
    // Fallback: sequential execution on main thread (no Worker support or single char)
    for (const charId of charsToOptimize) {
      const charConfig = effectivePerChar[charId];
      if (!charConfig) continue;

      const charDeadline = perCharDeadlineMs
        ? performance.now() + perCharDeadlineMs
        : undefined;
      const result = runCharacterBnB(
        charId,
        charConfig,
        effectiveTeamBuild,
        carryCharId,
        formulaId,
        inventory,
        globalConfig,
        heuristicSheets,
        calcContext,
        undefined,
        reactionOverride,
        comboScoreFn,
        TOP_K,
        charDeadline,
        undefined,
        maxArtsPerSlot ?? 0,
        false,
        undefined,
        partialBuffs
      );

      topKByChar[charId] = result.collector.results;
      if (result.failReason) failReasons[charId] = result.failReason;

      const passId: TeamOptPassId = carryCharIds.includes(charId)
        ? "carry-1"
        : "support";
      const best = result.collector.best;
      passResults.push({
        passId,
        charId,
        bestDamage: best?.damage ?? -1,
        bestArtifacts: best
          ? artsTupleToRecord(best.artifacts)
          : { ...emptyArtifacts },
        failReason: result.failReason,
        substatWeights: result.marginalWeights?.substatWeights,
      });
    }
  }

  // ignoreArtifactSets fallback: re-run failed characters without set constraints
  for (const charId of charsToOptimize) {
    const charConfig = effectivePerChar[charId];
    if (
      failReasons[charId] &&
      opts.ignoreArtifactSets?.[charId] &&
      charConfig &&
      (charConfig.artifactSetId ||
        (charConfig.artifactHalfSetIds?.length ?? 0) > 0)
    ) {
      effectivePerChar[charId] = {
        ...charConfig,
        artifactSetId: null,
        artifactHalfSetIds: [],
      };
      effectiveTeamBuild = rebuildTeamBuild();
      const charDeadline = perCharDeadlineMs
        ? performance.now() + perCharDeadlineMs
        : undefined;
      const result = runCharacterBnB(
        charId,
        effectivePerChar[charId],
        effectiveTeamBuild,
        carryCharId,
        formulaId,
        inventory,
        globalConfig,
        heuristicSheets,
        calcContext,
        undefined,
        reactionOverride,
        comboScoreFn,
        TOP_K,
        charDeadline,
        undefined,
        maxArtsPerSlot ?? 0,
        false,
        undefined,
        partialBuffs
      );
      topKByChar[charId] = result.collector.results;
      if (result.failReason) {
        failReasons[charId] = result.failReason;
      } else {
        delete failReasons[charId];
      }
      // Update pass result
      const prIdx = passResults.findIndex((pr) => pr.charId === charId);
      if (prIdx >= 0) {
        const best = result.collector.best;
        passResults[prIdx] = {
          passId: passResults[prIdx].passId,
          charId,
          bestDamage: best?.damage ?? -1,
          bestArtifacts: best
            ? artsTupleToRecord(best.artifacts)
            : { ...emptyArtifacts },
          failReason: result.failReason,
        };
      }
    }
  }

  // Yield: Phase 1 complete
  yield {
    currentPass: "support",
    currentPassCharId: allCharIds[allCharIds.length - 1],
    passIndex: allCharIds.length - 1,
    totalPasses: totalPhases,
    passPhase: "evaluating",
    passProgress: 1,
    overallProgress: INIT_WEIGHT + PHASE1_WEIGHT,
    phase: "phase1",
    passResults: [...passResults],
    done: false,
  } satisfies TeamOptimizationProgress;
  await new Promise((r) => setTimeout(r, 0));

  // ════════════════════════════════════════════════════════════════════
  // Phase 1b: Contested Artifact Resolution
  //
  // When a "dominant" artifact appears in most top-K entries for multiple
  // characters, the DFS can never find a conflict-free allocation.
  // Fix: identify contested artifacts, then re-run B&B for ALL contesting
  // characters with those artifacts excluded — no winner/loser distinction.
  // Phase 2 will decide the best allocation using actual team damage.
  // ════════════════════════════════════════════════════════════════════

  {
    // Count per-artifact usage across characters
    const artUsage: Map<string, { charId: string; count: number }[]> =
      new Map();
    for (const charId of allCharIds) {
      const entries = topKByChar[charId] ?? [];
      if (entries.length === 0) continue;
      const artCounts = new Map<string, number>();
      for (const entry of entries) {
        for (const artId of entry.artifactIds) {
          artCounts.set(artId, (artCounts.get(artId) ?? 0) + 1);
        }
      }
      for (const [artId, count] of artCounts) {
        if (count / entries.length >= 0.8) {
          if (!artUsage.has(artId)) artUsage.set(artId, []);
          artUsage.get(artId)!.push({ charId, count });
        }
      }
    }

    // Find contested artifacts: used dominantly by 2+ characters
    const contested: {
      artId: string;
      chars: { charId: string; count: number }[];
    }[] = [];
    for (const [artId, chars] of artUsage) {
      if (chars.length >= 2) {
        contested.push({ artId, chars });
      }
    }

    if (contested.length > 0) {
      // For each contested artifact, the character most dependent on it
      // (highest usage fraction in their top-K) keeps it. Others get
      // re-run with it excluded. This is role-agnostic — no carry/support
      // assumption. Phase 2 evaluates actual team damage to decide allocation.
      const excludeByChar = new Map<string, Set<string>>();

      for (const { artId, chars } of contested) {
        // Winner = highest usage fraction (most dependent on this artifact)
        const sorted = [...chars].sort((a, b) => {
          const aTotal = topKByChar[a.charId]?.length ?? 1;
          const bTotal = topKByChar[b.charId]?.length ?? 1;
          const aFrac = a.count / aTotal;
          const bFrac = b.count / bTotal;
          return bFrac - aFrac; // highest fraction wins
        });

        // Winner keeps the artifact; others must yield it
        for (let i = 1; i < sorted.length; i++) {
          const loserId = sorted[i].charId;
          if (!excludeByChar.has(loserId))
            excludeByChar.set(loserId, new Set());
          excludeByChar.get(loserId)!.add(artId);
        }
      }

      // Re-run B&B for each yielding character with contested artifacts excluded
      for (const [yielderId, excludeSet] of excludeByChar) {
        if (teamDeadlineMs && performance.now() > teamDeadlineMs) break;
        const charConfig = effectivePerChar[yielderId];
        if (!charConfig) continue;

        const altDeadline = perCharDeadlineMs
          ? performance.now() + perCharDeadlineMs
          : undefined;

        const altResult = runCharacterBnB(
          yielderId,
          charConfig,
          effectiveTeamBuild,
          carryCharId,
          formulaId,
          inventory,
          globalConfig,
          heuristicSheets,
          calcContext,
          excludeSet,
          reactionOverride,
          comboScoreFn,
          TOP_K,
          altDeadline,
          undefined,
          maxArtsPerSlot ?? 0,
          false,
          undefined,
          partialBuffs
        );

        // Merge alternative results into the existing top-K
        const existing = topKByChar[yielderId] ?? [];
        const alternatives = altResult.collector.results;
        const merged = [...existing];
        for (const alt of alternatives) {
          let usesExcluded = false;
          for (const artId of excludeSet) {
            if (alt.artifactIds.has(artId)) {
              usesExcluded = true;
              break;
            }
          }
          if (!usesExcluded) merged.push(alt);
        }
        // Sort by damage descending and keep top-K * 2 (extra room for diversity)
        merged.sort((a, b) => b.damage - a.damage);
        topKByChar[yielderId] = merged.slice(0, TOP_K * 2);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 2: Team allocation via conflict-aware DFS
  // ════════════════════════════════════════════════════════════════════

  // Only allocate characters that have valid results
  const allocatableChars = allCharIds.filter(
    (id) => (topKByChar[id]?.length ?? 0) > 0
  );

  yield {
    currentPass: "carry-2",
    currentPassCharId: carryCharId,
    passIndex: allCharIds.length,
    totalPasses: totalPhases,
    passPhase: "evaluating",
    passProgress: 0,
    overallProgress: INIT_WEIGHT + PHASE1_WEIGHT,
    phase: "phase2",
    passResults: [...passResults],
    done: false,
  } satisfies TeamOptimizationProgress;
  await new Promise((r) => setTimeout(r, 0));

  // Build the team evaluation function that uses the actual optimization goal.
  // This is the ONLY scoring used in allocation — no per-character proxies.
  const teamEvalFn: TeamEvalFn = (assignment) => {
    const candidateArts: Record<string, Record<Slot, ArtifactData | null>> = {};
    for (const charId of allCharIds) {
      if (assignment[charId]) {
        candidateArts[charId] = artsTupleToRecord(assignment[charId].artifacts);
      } else {
        const best = topKByChar[charId]?.[0];
        candidateArts[charId] = best
          ? artsTupleToRecord(best.artifacts)
          : { ...emptyArtifacts };
      }
    }
    const sheets = buildSheetsFromArtifacts(baseSheets, candidateArts);
    if (comboScoreFn) {
      return comboScoreFn(sheets, carryCharId);
    }
    try {
      const postStats = effectiveTeamBuild.getTeamStats(
        sheets,
        carryCharId,
        calcContext
      );
      return effectiveTeamBuild.getDamageResult(
        carryCharId,
        formulaId,
        postStats,
        calcContext,
        reactionOverride,
        getOffFieldStatsFor(effectiveTeamBuild, sheets)
      ).totalDamage;
    } catch {
      return 0;
    }
  };

  let { candidates, iterations: allocIterations } = findBestTeamAllocation(
    allocatableChars,
    topKByChar,
    MAX_TEAM_SEARCH,
    teamEvalFn
  );

  // If DFS + greedy both failed, do sequential B&B assignment:
  // Process characters sequentially, running B&B for each with previously
  // assigned artifacts excluded. Guaranteed to produce a conflict-free assignment.
  if (candidates.length === 0 && allocatableChars.length > 1) {
    const seqUsed = new Set<string>();
    const seqAssignment: Record<string, TopKEntry> = {};

    for (const cid of allocatableChars) {
      // First try existing top-K entries
      const entries = topKByChar[cid] ?? [];
      let found = false;
      for (const entry of entries) {
        let conflict = false;
        for (const artId of entry.artifactIds) {
          if (seqUsed.has(artId)) {
            conflict = true;
            break;
          }
        }
        if (!conflict) {
          seqAssignment[cid] = entry;
          for (const artId of entry.artifactIds) seqUsed.add(artId);
          found = true;
          break;
        }
      }

      if (!found) {
        if (teamDeadlineMs && performance.now() > teamDeadlineMs) break;
        // Run a fresh B&B excluding all taken artifacts
        const charConfig = effectivePerChar[cid];
        if (!charConfig) continue;
        const altDeadline = perCharDeadlineMs
          ? performance.now() + perCharDeadlineMs
          : undefined;
        const altResult = runCharacterBnB(
          cid,
          charConfig,
          effectiveTeamBuild,
          carryCharId,
          formulaId,
          inventory,
          globalConfig,
          heuristicSheets,
          calcContext,
          seqUsed,
          reactionOverride,
          comboScoreFn,
          1, // only need the best result
          altDeadline,
          undefined,
          maxArtsPerSlot ?? 0,
          false,
          undefined,
          partialBuffs
        );
        const best = altResult.collector.best;
        if (best) {
          seqAssignment[cid] = best;
          for (const artId of best.artifactIds) seqUsed.add(artId);
        }
      }
    }

    if (Object.keys(seqAssignment).length === allocatableChars.length) {
      const seqScore = teamEvalFn(seqAssignment);
      candidates = [{ assignment: { ...seqAssignment }, score: seqScore }];
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 2b: Same-Set Sequential Partitioning
  //
  // When two characters share the same 4pc artifact set, their Phase 1
  // top-K lists overlap heavily. Phase 2 DFS explores ALLOC_WIDTH entries
  // per character, but the optimal allocation may require deeper exploration.
  //
  // Fix: for each same-set pair, try both orderings — run B&B for A with
  // A's best entries, then B&B for B with A's artifacts excluded. This
  // explores the partition space directly instead of relying on Phase 2 DFS.
  // ════════════════════════════════════════════════════════════════════

  {
    // Detect same-4pc-set pairs
    const setToChars = new Map<string, string[]>();
    for (const cid of allocatableChars) {
      const setId = effectivePerChar[cid]?.artifactSetId;
      if (!setId) continue;
      if (!setToChars.has(setId)) setToChars.set(setId, []);
      setToChars.get(setId)!.push(cid);
    }

    const PARTITION_TOP_M = 8; // try top-M entries for the first character

    for (const [, chars] of setToChars) {
      if (chars.length < 2) continue;
      if (teamDeadlineMs && performance.now() > teamDeadlineMs) break;

      // For each pair ordering, run sequential partitioning
      for (const [firstId, secondId] of [
        [chars[0], chars[1]],
        [chars[1], chars[0]],
      ] as [string, string][]) {
        if (teamDeadlineMs && performance.now() > teamDeadlineMs) break;

        const firstEntries = topKByChar[firstId] ?? [];
        const secondConfig = effectivePerChar[secondId];
        if (!secondConfig || firstEntries.length === 0) continue;

        // Collect other characters' best assignments for team evaluation
        const otherChars = allocatableChars.filter(
          (id) => id !== firstId && id !== secondId
        );

        for (
          let m = 0;
          m < Math.min(firstEntries.length, PARTITION_TOP_M);
          m++
        ) {
          if (teamDeadlineMs && performance.now() > teamDeadlineMs) break;

          const firstEntry = firstEntries[m];
          const excludeSet = new Set(firstEntry.artifactIds);

          // Run B&B for second character with first's artifacts excluded
          const altDeadline = perCharDeadlineMs
            ? performance.now() + perCharDeadlineMs
            : undefined;

          const altResult = runCharacterBnB(
            secondId,
            secondConfig,
            effectiveTeamBuild,
            carryCharId,
            formulaId,
            inventory,
            globalConfig,
            heuristicSheets,
            calcContext,
            excludeSet,
            reactionOverride,
            comboScoreFn,
            1, // only need best result
            altDeadline,
            undefined,
            maxArtsPerSlot ?? 0,
            false,
            undefined,
            partialBuffs
          );

          const secondBest = altResult.collector.best;
          if (!secondBest) continue;

          // Build a full team assignment: first + second + others' best conflict-free
          const assignment: Record<string, TopKEntry> = {
            [firstId]: firstEntry,
            [secondId]: secondBest,
          };
          const usedArts = new Set([
            ...firstEntry.artifactIds,
            ...secondBest.artifactIds,
          ]);

          // Assign other characters greedily from their top-K
          let allAssigned = true;
          for (const otherId of otherChars) {
            const otherEntries = topKByChar[otherId] ?? [];
            let found = false;
            for (const entry of otherEntries) {
              let conflict = false;
              for (const artId of entry.artifactIds) {
                if (usedArts.has(artId)) {
                  conflict = true;
                  break;
                }
              }
              if (!conflict) {
                assignment[otherId] = entry;
                for (const artId of entry.artifactIds) usedArts.add(artId);
                found = true;
                break;
              }
            }
            if (!found) {
              allAssigned = false;
              break;
            }
          }

          if (!allAssigned) continue;

          // Evaluate full team damage
          const teamDamage = teamEvalFn(assignment);
          if (candidates.length === 0 || teamDamage > candidates[0].score) {
            candidates = [{ assignment: { ...assignment }, score: teamDamage }];
          }
        }
      }
    }
  }

  // Candidates are already scored by actual team damage — take the best.
  const bestAllocation: Record<string, TopKEntry> | null =
    candidates.length > 0 ? candidates[0].assignment : null;

  // Build final artifact assignment from best full-team-evaluated allocation
  const bestArtifactsByChar: Record<
    string,
    Record<Slot, ArtifactData | null>
  > = {};
  for (const charId of allCharIds) {
    if (bestAllocation?.[charId]) {
      bestArtifactsByChar[charId] = artsTupleToRecord(
        bestAllocation[charId].artifacts
      );
    } else {
      const best = topKByChar[charId]?.[0];
      bestArtifactsByChar[charId] = best
        ? artsTupleToRecord(best.artifacts)
        : { ...emptyArtifacts };
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 3: Parallel Best-First Team Refinement
  //
  // Run ALL non-saturated characters' B&B in parallel via web workers.
  // Each round: all characters get B&B with current teammates' artifacts
  // excluded. Only the single best improvement is committed per round.
  // Repeat until no character improves (or team deadline hit).
  // Budget scales by rank: 1×, 0.75×, 0.5×, 0.25×.
  // ════════════════════════════════════════════════════════════════════

  const MAX_PHASE3_ROUNDS = 6;
  const BUDGET_MULTIPLIERS = [1, 0.75, 0.5, 0.25];

  // Rank characters: carries first, then supports, sorted by Phase 1 best damage
  const phase3Chars = allCharIds
    .filter((id) => effectivePerChar[id] && !saturatedCharIds.has(id))
    .sort((a, b) => {
      const aIsCarry = carryCharIds.includes(a);
      const bIsCarry = carryCharIds.includes(b);
      if (aIsCarry !== bIsCarry) return aIsCarry ? -1 : 1;
      const aDmg = passResults.find((r) => r.charId === a)?.bestDamage ?? 0;
      const bDmg = passResults.find((r) => r.charId === b)?.bestDamage ?? 0;
      return bDmg - aDmg;
    });

  const usePhase3Workers =
    typeof Worker !== "undefined" && phase3Chars.length > 1;

  for (let round = 0; round < MAX_PHASE3_ROUNDS; round++) {
    if (teamDeadlineMs && teamDeadlineMs - performance.now() < 1000) break;

    // Yield Phase 3 progress
    yield {
      currentPass: "carry-2",
      currentPassCharId: carryCharId,
      passIndex: allCharIds.length + 1,
      totalPasses: totalPhases + 1,
      passPhase: "evaluating",
      passProgress: round / MAX_PHASE3_ROUNDS,
      overallProgress:
        INIT_WEIGHT +
        PHASE1_WEIGHT +
        PHASE2_WEIGHT +
        PHASE3_WEIGHT * (round / MAX_PHASE3_ROUNDS),
      phase: "phase3",
      passResults: [...passResults],
      done: false,
    } satisfies TeamOptimizationProgress;
    await new Promise((r) => setTimeout(r, 0));

    // Compute current team damage baseline
    const currentTeamDamage = (() => {
      const sheets = buildSheetsFromArtifacts(baseSheets, bestArtifactsByChar);
      if (comboScoreFn) return comboScoreFn(sheets, carryCharId);
      try {
        const ps = effectiveTeamBuild.getTeamStats(
          sheets,
          carryCharId,
          calcContext
        );
        return effectiveTeamBuild.getDamageResult(
          carryCharId,
          formulaId,
          ps,
          calcContext,
          reactionOverride,
          getOffFieldStatsFor(effectiveTeamBuild, sheets)
        ).totalDamage;
      } catch {
        return 0;
      }
    })();

    // Build per-character inputs (base sheets + exclusions)
    type Phase3CharInput = {
      charId: string;
      charConfig: PerCharConfig;
      rankIdx: number;
      refinedBaseSheets: Record<string, StatSheet>;
      refinedSheetsDump: Record<
        string,
        { key: StatKey; filterKey: string; value: number }[]
      >;
      excludedIds: string[];
      currentDamage: number;
    };

    const charInputs: Phase3CharInput[] = [];

    for (let rankIdx = 0; rankIdx < phase3Chars.length; rankIdx++) {
      const charId = phase3Chars[rankIdx];
      const charConfig = effectivePerChar[charId]!;

      const refinedBaseSheets: Record<string, StatSheet> = { ...baseSheets };
      const excludedIdSet = new Set<string>();

      for (const otherId of allCharIds) {
        if (otherId === charId) continue;
        const otherArts = bestArtifactsByChar[otherId];
        if (!otherArts) continue;
        const pieces = allSlots
          .map((s) => otherArts[s])
          .filter((a): a is ArtifactData => a != null);
        if (pieces.length > 0) {
          refinedBaseSheets[otherId] = StatSheet.fromArtifacts(pieces);
        }
        for (const art of pieces) excludedIdSet.add(art.id);
      }

      // Evaluate current assignment
      const currentPieces = allSlots.map(
        (s) => bestArtifactsByChar[charId]?.[s] ?? null
      ) as ArtifactTuple;
      const currentEval = evaluateBuildDirect(
        currentPieces,
        effectiveTeamBuild,
        charId,
        carryCharId,
        formulaId,
        refinedBaseSheets,
        carryCharId,
        calcContext,
        charId,
        charConfig.minEr,
        charConfig.minCr,
        reactionOverride,
        comboScoreFn
      );

      // Serialize sheets for worker
      const sheetsDump: Record<
        string,
        { key: StatKey; filterKey: string; value: number }[]
      > = {};
      for (const [cid, sheet] of Object.entries(refinedBaseSheets)) {
        sheetsDump[cid] = sheet.toSerializable();
      }

      charInputs.push({
        charId,
        charConfig,
        rankIdx,
        refinedBaseSheets,
        refinedSheetsDump: sheetsDump,
        excludedIds: [...excludedIdSet],
        currentDamage: currentEval.damage,
      });
    }

    // Run all characters' B&B in parallel (or sequential fallback)
    type Phase3Result = {
      charId: string;
      bestArtifacts: ArtifactTuple | null;
      bestDamage: number;
      currentDamage: number;
    };

    let phase3Results: Phase3Result[];

    if (usePhase3Workers) {
      // Parallel via web workers
      const workerPromises = charInputs.map(
        (input) =>
          new Promise<Phase3Result>((resolve) => {
            const worker = new Worker(
              new URL("../optimizerV2.worker.ts", import.meta.url),
              { type: "module" }
            );

            const budgetMultiplier =
              BUDGET_MULTIPLIERS[
                Math.min(input.rankIdx, BUDGET_MULTIPLIERS.length - 1)
              ];
            const budgetMs = perCharDeadlineMs
              ? perCharDeadlineMs * budgetMultiplier
              : undefined;
            const timeoutMs = (budgetMs ?? 15_000) * 1.5;
            const timeoutId = setTimeout(() => {
              worker.terminate();
              resolve({
                charId: input.charId,
                bestArtifacts: null,
                bestDamage: input.currentDamage,
                currentDamage: input.currentDamage,
              });
            }, timeoutMs);

            worker.onmessage = (
              e: MessageEvent<import("../optimizerV2.worker").BnBWorkerResponse>
            ) => {
              const resp = e.data;
              if (resp.type === "progress" || resp.type === "ready") return; // ignore progress/ready in Phase 3
              clearTimeout(timeoutId);
              worker.terminate();
              if (resp.type === "error") {
                resolve({
                  charId: input.charId,
                  bestArtifacts: null,
                  bestDamage: input.currentDamage,
                  currentDamage: input.currentDamage,
                });
                return;
              }
              const best = resp.entries[0];
              if (best && best.damage > input.currentDamage) {
                resolve({
                  charId: input.charId,
                  bestArtifacts: best.artifacts as ArtifactTuple,
                  bestDamage: best.damage,
                  currentDamage: input.currentDamage,
                });
              } else {
                resolve({
                  charId: input.charId,
                  bestArtifacts: null,
                  bestDamage: input.currentDamage,
                  currentDamage: input.currentDamage,
                });
              }
            };

            worker.onerror = () => {
              clearTimeout(timeoutId);
              worker.terminate();
              resolve({
                charId: input.charId,
                bestArtifacts: null,
                bestDamage: input.currentDamage,
                currentDamage: input.currentDamage,
              });
            };

            const request: import("../optimizerV2.worker").BnBWorkerRequest = {
              id: 0,
              charId: input.charId,
              charConfig: input.charConfig,
              configs: teamBuild.configs,
              combatOpts: teamBuild.combatOpts,
              enemyElementAura: teamBuild.enemyElementAura,
              carryCharId,
              formulaId,
              inventory,
              globalConfig,
              baseSheetsDump: input.refinedSheetsDump,
              calcContext,
              reactionOverride,
              topK: TOP_K,
              deadlineMs: budgetMs,
              warmStartThreshold:
                input.currentDamage > 0 ? input.currentDamage : undefined,
              maxArtsPerSlot: maxArtsPerSlot ?? 0,
              excludedIds: input.excludedIds,
              isComboMode,
              combo: isComboMode ? combo : undefined,
              reactionOverrides: isComboMode ? reactionOverrides : undefined,
              partialBuffs,
              comboLinePartialBuffs: isComboMode
                ? comboLinePartialBuffs
                : undefined,
            };

            worker.postMessage(request);
          })
      );

      phase3Results = await Promise.all(workerPromises);
    } else {
      // Sequential fallback (single char or no Worker support)
      phase3Results = charInputs.map((input) => {
        const budgetMultiplier =
          BUDGET_MULTIPLIERS[
            Math.min(input.rankIdx, BUDGET_MULTIPLIERS.length - 1)
          ];
        const reoptDeadline = perCharDeadlineMs
          ? performance.now() + perCharDeadlineMs * budgetMultiplier
          : undefined;

        const reoptResult = runCharacterBnB(
          input.charId,
          input.charConfig,
          effectiveTeamBuild,
          carryCharId,
          formulaId,
          inventory,
          globalConfig,
          input.refinedBaseSheets,
          calcContext,
          new Set(input.excludedIds),
          reactionOverride,
          comboScoreFn,
          TOP_K,
          reoptDeadline,
          input.currentDamage > 0 ? input.currentDamage : undefined,
          maxArtsPerSlot ?? 0,
          false,
          undefined,
          partialBuffs
        );

        if (
          reoptResult.collector.best &&
          reoptResult.collector.best.damage > input.currentDamage
        ) {
          return {
            charId: input.charId,
            bestArtifacts: reoptResult.collector.best
              .artifacts as ArtifactTuple,
            bestDamage: reoptResult.collector.best.damage,
            currentDamage: input.currentDamage,
          };
        }
        return {
          charId: input.charId,
          bestArtifacts: null,
          bestDamage: input.currentDamage,
          currentDamage: input.currentDamage,
        };
      });
    }

    // Pick best improvement: tentatively apply each candidate and measure team damage
    let bestImprovement = 0;
    let bestCharId: string | null = null;
    let bestNewArtifacts: ArtifactTuple | null = null;

    for (const result of phase3Results) {
      if (!result.bestArtifacts) continue;
      const tentativeArts = { ...bestArtifactsByChar };
      tentativeArts[result.charId] = artsTupleToRecord(result.bestArtifacts);
      const tentativeSheets = buildSheetsFromArtifacts(
        baseSheets,
        tentativeArts
      );
      let tentativeDamage: number;
      if (comboScoreFn) {
        tentativeDamage = comboScoreFn(tentativeSheets, carryCharId);
      } else {
        try {
          const ps = effectiveTeamBuild.getTeamStats(
            tentativeSheets,
            carryCharId,
            calcContext
          );
          tentativeDamage = effectiveTeamBuild.getDamageResult(
            carryCharId,
            formulaId,
            ps,
            calcContext,
            reactionOverride,
            getOffFieldStatsFor(effectiveTeamBuild, tentativeSheets)
          ).totalDamage;
        } catch {
          tentativeDamage = 0;
        }
      }

      const improvement = tentativeDamage - currentTeamDamage;
      if (improvement > bestImprovement) {
        bestImprovement = improvement;
        bestCharId = result.charId;
        bestNewArtifacts = result.bestArtifacts;
      }
    }

    // No improvement → stop
    if (!bestCharId || !bestNewArtifacts) break;

    // Commit the best character's new artifacts
    bestArtifactsByChar[bestCharId] = artsTupleToRecord(bestNewArtifacts);
  }

  // ════════════════════════════════════════════════════════════════════
  // Heuristic Fill for Saturated Characters
  //
  // Saturated characters' artifacts don't affect team damage, so B&B
  // was skipped. Fill them from the remaining pool using build-page
  // heuristic weights, respecting set constraints and ER/CR targets.
  // ════════════════════════════════════════════════════════════════════

  if (saturatedCharIds.size > 0) {
    // Collect all artifact IDs already assigned to non-saturated characters
    const assignedIds = new Set<string>();
    for (const [cid, arts] of Object.entries(bestArtifactsByChar)) {
      if (saturatedCharIds.has(cid)) continue;
      for (const slot of allSlots) {
        const a = arts[slot];
        if (a) assignedIds.add(a.id);
      }
    }

    for (const charId of allCharIds) {
      if (!saturatedCharIds.has(charId)) continue;
      const charConfig = effectivePerChar[charId];
      if (!charConfig) continue;

      const is4pc = !!charConfig.artifactSetId;
      const is2pc =
        !charConfig.artifactSetId &&
        !!charConfig.artifactHalfSetIds &&
        charConfig.artifactHalfSetIds.length === 2;

      // Score and pick artifacts per slot using build weights
      const buildMatch = charConfig.buildMatch;
      const picked: Record<Slot, ArtifactData | null> = { ...emptyArtifacts };
      const pickedIds = new Set<string>();

      // For set constraints, track which slots are assigned to which set
      // We'll do a simple greedy: for 4pc, try to fill 4 slots on-set first
      // For 2+2, fill 2 slots per half-set first
      const slotSetAssignment: (string | null)[] = [
        null,
        null,
        null,
        null,
        null,
      ];

      if (is4pc) {
        // Need 4 slots on-set. Pick the slot with fewest on-set candidates as flex.
        const setId = charConfig.artifactSetId!;
        const onSetCounts = allSlots.map(
          (slot) =>
            inventory.filter(
              (a) =>
                a.slotKey === slot &&
                a.setKey === setId &&
                !assignedIds.has(a.id)
            ).length
        );
        // Flex slot = slot with fewest on-set candidates
        let flexSlotIdx = 0;
        for (let i = 1; i < 5; i++) {
          if (onSetCounts[i] < onSetCounts[flexSlotIdx]) flexSlotIdx = i;
        }
        for (let i = 0; i < 5; i++) {
          slotSetAssignment[i] = i === flexSlotIdx ? null : setId;
        }
      } else if (is2pc) {
        const [h1, h2] = charConfig.artifactHalfSetIds!;
        const h1Sets = new Set(artifactHalfSetsById[h1]?.setIds ?? []);
        const h2Sets = new Set(artifactHalfSetsById[h2]?.setIds ?? []);
        // Greedy: assign first 2 available slots to h1, next 2 to h2
        let h1Count = 0;
        let h2Count = 0;
        for (let i = 0; i < 5; i++) {
          if (h1Count < 2) {
            const hasH1 = inventory.some(
              (a) =>
                a.slotKey === allSlots[i] &&
                h1Sets.has(a.setKey) &&
                !assignedIds.has(a.id)
            );
            if (hasH1) {
              slotSetAssignment[i] = h1;
              h1Count++;
              continue;
            }
          }
          if (h2Count < 2) {
            const hasH2 = inventory.some(
              (a) =>
                a.slotKey === allSlots[i] &&
                h2Sets.has(a.setKey) &&
                !assignedIds.has(a.id)
            );
            if (hasH2) {
              slotSetAssignment[i] = h2;
              h2Count++;
            }
          }
        }
      }

      for (let si = 0; si < 5; si++) {
        const slot = allSlots[si];
        const requiredSetOrHalf = slotSetAssignment[si];

        let candidates = inventory.filter(
          (a) =>
            a.slotKey === slot && !assignedIds.has(a.id) && !pickedIds.has(a.id)
        );

        // Filter by set constraint for this slot
        if (requiredSetOrHalf) {
          const halfSet = artifactHalfSetsById[requiredSetOrHalf];
          if (halfSet) {
            // It's a half-set ID — filter to any set in that half-set group
            const validSets = new Set(halfSet.setIds);
            const filtered = candidates.filter((a) => validSets.has(a.setKey));
            if (filtered.length > 0) candidates = filtered;
          } else {
            // It's a full set ID
            const filtered = candidates.filter(
              (a) => a.setKey === requiredSetOrHalf
            );
            if (filtered.length > 0) candidates = filtered;
          }
        }

        if (candidates.length === 0) continue;

        // Score by build weights (no CR/CD fallback for saturated chars)
        // Use ER as fallback weight if no build match exists
        const fallbackWeights = buildMatch
          ? undefined
          : ({ er: 100 } as Record<string, number>);
        candidates.sort((a, b) => {
          const sa = buildMatch
            ? computeWeightScore(a, buildMatch, globalConfig, 1)
            : scoreSlot(a, fallbackWeights!, globalConfig);
          const sb = buildMatch
            ? computeWeightScore(b, buildMatch, globalConfig, 1)
            : scoreSlot(b, fallbackWeights!, globalConfig);
          if (sb !== sa) return sb - sa;
          // Tiebreak: prefer higher level
          return b.level - a.level;
        });

        picked[slot] = candidates[0];
        pickedIds.add(candidates[0].id);
      }

      // ── ER/CR constraint enforcement for saturated chars ──
      // The greedy pick above optimizes for build weights but ignores ER/CR.
      // Check if the assignment meets minEr/minCr; if not, re-pick slots
      // prioritizing ER (force ER% sands, then re-sort by ER substats).
      const { minEr, minCr } = charConfig;
      if (minEr > 0 || minCr > 0) {
        // Compute baseline ER/CR (with empty sheet for this char)
        const blSheets = {
          ...baseSheets,
          [charId]: new StatSheet([]),
        };
        const blStats = effectiveTeamBuild.getTeamStats(
          blSheets,
          carryCharId,
          calcContext
        );
        const erFloor = minEr > 0 ? (blStats[charId]?.get("er", null) ?? 0) : 0;

        // Sum ER from picked artifacts
        let pickedEr = 0;
        for (const slot of allSlots) {
          pickedEr += getArtifactEr(picked[slot]);
        }

        if (erFloor + pickedEr < minEr - 1e-6) {
          // ER is insufficient. Re-pick: try ER% sands first, then re-sort
          // remaining slots by ER substat contribution.
          const erNeeded = minEr - erFloor;

          // Clear current picks
          for (const slot of allSlots) {
            const art = picked[slot];
            if (art) pickedIds.delete(art.id);
            picked[slot] = null;
          }

          // Pass 1: Pick sands with ER% main stat if available
          const sandsSlot = allSlots[2]; // sands
          const sandsCandidates = inventory.filter(
            (a) =>
              a.slotKey === sandsSlot &&
              !assignedIds.has(a.id) &&
              a.mainStatKey === "er"
          );
          // Apply set constraint for sands slot
          const sandsSetReq = slotSetAssignment[2];
          let filteredSands = sandsCandidates;
          if (sandsSetReq) {
            const halfSet = artifactHalfSetsById[sandsSetReq];
            if (halfSet) {
              const validSets = new Set(halfSet.setIds);
              const f = sandsCandidates.filter((a) => validSets.has(a.setKey));
              if (f.length > 0) filteredSands = f;
            } else {
              const f = sandsCandidates.filter((a) => a.setKey === sandsSetReq);
              if (f.length > 0) filteredSands = f;
            }
          }
          // Sort by total ER contribution (mainstat + substats)
          filteredSands.sort((a, b) => getArtifactEr(b) - getArtifactEr(a));
          if (filteredSands.length > 0) {
            picked[sandsSlot] = filteredSands[0];
            pickedIds.add(filteredSands[0].id);
          }

          // Pass 2: Fill remaining slots, sorting by ER substat first
          for (let si = 0; si < 5; si++) {
            const slot = allSlots[si];
            if (picked[slot]) continue; // already picked (e.g. ER sands)

            const requiredSetOrHalf = slotSetAssignment[si];
            let candidates = inventory.filter(
              (a) =>
                a.slotKey === slot &&
                !assignedIds.has(a.id) &&
                !pickedIds.has(a.id)
            );
            if (requiredSetOrHalf) {
              const halfSet = artifactHalfSetsById[requiredSetOrHalf];
              if (halfSet) {
                const validSets = new Set(halfSet.setIds);
                const f = candidates.filter((a) => validSets.has(a.setKey));
                if (f.length > 0) candidates = f;
              } else {
                const f = candidates.filter(
                  (a) => a.setKey === requiredSetOrHalf
                );
                if (f.length > 0) candidates = f;
              }
            }
            if (candidates.length === 0) continue;

            // Sort by ER contribution (descending), then by build score
            candidates.sort((a, b) => {
              const erDiff = getArtifactEr(b) - getArtifactEr(a);
              if (Math.abs(erDiff) > 0.001) return erDiff;
              const sa = buildMatch
                ? computeWeightScore(a, buildMatch, globalConfig, 1)
                : scoreSlot(
                    a,
                    { er: 100 } as Record<string, number>,
                    globalConfig
                  );
              const sb = buildMatch
                ? computeWeightScore(b, buildMatch, globalConfig, 1)
                : scoreSlot(
                    b,
                    { er: 100 } as Record<string, number>,
                    globalConfig
                  );
              return sb - sa;
            });

            picked[slot] = candidates[0];
            pickedIds.add(candidates[0].id);
          }
        }
      }

      bestArtifactsByChar[charId] = picked;
      // Mark assigned IDs so subsequent saturated chars don't reuse them
      for (const id of pickedIds) assignedIds.add(id);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Final: detect accidental sets and rebuild if needed
  // ════════════════════════════════════════════════════════════════════

  let setsChanged = effectiveTeamBuild !== teamBuild;
  for (const charId of allCharIds) {
    const arts = bestArtifactsByChar[charId];
    if (!arts) continue;
    const pieces = allSlots
      .map((s) => arts[s])
      .filter(Boolean) as ArtifactData[];
    const detected = detectEquippedSets(pieces);
    const epc = effectivePerChar[charId];
    if (!epc) continue;

    const currentSetId = epc.artifactSetId ?? null;
    const currentHalfIds = epc.artifactHalfSetIds ?? [];
    const detectedSetId = detected.artifactSetId;
    const detectedHalfIds = detected.artifactHalfSetIds;

    const setIdChanged = detectedSetId !== currentSetId;
    const halfIdsChanged =
      detectedHalfIds.length !== currentHalfIds.length ||
      [...detectedHalfIds].sort().join(",") !==
        [...currentHalfIds].sort().join(",");

    if (setIdChanged || halfIdsChanged) {
      effectivePerChar[charId] = {
        ...epc,
        artifactSetId: detectedSetId,
        artifactHalfSetIds: detectedHalfIds,
      };
      setsChanged = true;
    }
  }

  if (setsChanged) effectiveTeamBuild = rebuildTeamBuild();

  const finalSheets = buildSheetsFromArtifacts(baseSheets, bestArtifactsByChar);

  const resultBase = {
    bestArtifactsByChar,
    passResults,
    failReasons,
    saturatedCharIds: [...saturatedCharIds],
    ...(setsChanged ? { teamBuild: effectiveTeamBuild } : {}),
    done: true as const,
  };

  if (isComboMode) {
    let comboRes: ComboResult;
    try {
      comboRes = evaluateCombo(
        effectiveTeamBuild,
        combo,
        finalSheets,
        calcContext,
        reactionOverrides,
        comboLinePartialBuffs
      );
    } catch {
      comboRes = { lineDamages: [], totalDamage: 0 };
    }
    yield {
      ...resultBase,
      mode: "combo",
      bestDamage: comboRes.totalDamage,
      bestComboResult: comboRes,
    } satisfies TeamOptComboResult;
  } else {
    const finalPostStats = effectiveTeamBuild.getTeamStats(
      finalSheets,
      carryCharId,
      calcContext
    );
    const finalDmg = effectiveTeamBuild.getDamageResult(
      carryCharId,
      formulaId,
      finalPostStats,
      calcContext,
      reactionOverride,
      getOffFieldStatsFor(effectiveTeamBuild, finalSheets)
    );
    yield {
      ...resultBase,
      mode: "single",
      bestDamage: finalDmg.totalDamage,
      bestDamageResult: finalDmg,
    } satisfies TeamOptSingleResult;
  }
}
