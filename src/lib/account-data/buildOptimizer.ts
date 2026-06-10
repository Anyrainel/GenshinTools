import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import {
  type StatWeightMap,
  scoreSlotWithMainStatWeights,
} from "../artifact/scoring/artifactScore";
import {
  computeWeightedCrDeduction,
  getMainStatValueAtLevel,
} from "../artifact/scoring/utils";
import type { CandidateArtifact } from "./candidatePool";
import type { CrBudgetResult } from "./maxCrBuff";
import { enumerateConcreteTwoPieceSetPairs } from "./setConstraints";

export interface BuildOptimizerConfig {
  weights: StatWeightMap;
  candidates: Record<Slot, CandidateArtifact[]>;
  crBudget: CrBudgetResult;
  /** Accepted main stats per slot with their effective weight percent. */
  targetMainStatWeights: Record<Slot, ReadonlyMap<string, number>>;
  /** Optional artifact shadow prices used only to rank generated builds. */
  artifactPrices?: ReadonlyMap<string, number>;
  slotCaps?: {
    set?: number;
    flex?: number;
  };
  setConstraint: {
    composition: "4pc" | "2pc+2pc";
    artifactSet?: string;
    halfSet1?: string;
    halfSet2?: string;
  };
  topN?: number;
}

export interface OptimizedBuild {
  artifacts: Record<Slot, CandidateArtifact>;
  slotScores: Record<Slot, number>;
  rawScore: number;
  crPenalty: number;
  finalScore: number;
  /** Score used for ranking during priced column generation. */
  adjustedScore?: number;
  totalArtifactCr: number;
}

export interface BuildOptimizerResult {
  builds: OptimizedBuild[];
  currentScore: number;
  combinationsEvaluated: number;
}

/**
 * Extract CR contributions from a candidate artifact, split by source
 * (decimal). Main-stat CR uses the at-level value so the cap accounting
 * matches the at-level credit from scoreSlotWithMainStatWeights.
 */
function getCandidateCrParts(art: CandidateArtifact): {
  mainCr: number;
  subCr: number;
} {
  return {
    mainCr:
      art.mainStatKey === "cr"
        ? getMainStatValueAtLevel("cr", art.rarity, art.level) / 100
        : 0,
    subCr: (art.substats.cr ?? 0) / 100,
  };
}

/**
 * Top-N min-heap for tracking best builds, unique by artifact-ID signature.
 * Set-composition patterns can re-evaluate the same 5-artifact assignment
 * (e.g. an all-on-set 4pc build matches all 5 flex patterns); without dedup
 * those duplicates evict genuinely distinct runner-up builds.
 */
class TopNTracker {
  private readonly items: OptimizedBuild[] = [];
  private readonly signatures = new Set<string>();
  private readonly n: number;
  private minScore = Number.NEGATIVE_INFINITY;

  constructor(n: number) {
    this.n = n;
  }

  insert(build: OptimizedBuild, signature: string): void {
    if (this.signatures.has(signature)) return;
    if (this.items.length < this.n) {
      this.items.push(build);
      this.signatures.add(signature);
      if (this.items.length === this.n) {
        this.items.sort((a, b) => rankScore(a) - rankScore(b));
        this.minScore = rankScore(this.items[0]);
      }
    } else if (rankScore(build) > this.minScore) {
      this.signatures.delete(buildSignature(this.items[0]));
      this.items[0] = build;
      this.signatures.add(signature);
      this.items.sort((a, b) => rankScore(a) - rankScore(b));
      this.minScore = rankScore(this.items[0]);
    }
  }

  get threshold(): number {
    return this.items.length < this.n
      ? Number.NEGATIVE_INFINITY
      : this.minScore;
  }

  getResults(): OptimizedBuild[] {
    return [...this.items].sort((a, b) => rankScore(b) - rankScore(a));
  }
}

/** Slot-order-independent identity of a build's 5 artifacts. */
function buildSignature(build: OptimizedBuild): string {
  return allSlots
    .map((slot) => build.artifacts[slot]?.id ?? "")
    .sort()
    .join("|");
}

function rankScore(build: OptimizedBuild): number {
  return build.adjustedScore ?? build.finalScore;
}

// ─── Set Composition Patterns ───

type SlotPattern = {
  slotIdx: number;
  setRequirement: "set1" | "set2" | "flex";
  concreteSetKey?: string;
}[];

function generate4pcPatterns(): SlotPattern[] {
  // 5 patterns: each pattern has 4 on-set slots + 1 flex slot
  const patterns: SlotPattern[] = [];
  for (let flexIdx = 0; flexIdx < 5; flexIdx++) {
    const pattern: SlotPattern = [];
    for (let i = 0; i < 5; i++) {
      pattern.push({
        slotIdx: i,
        setRequirement: i === flexIdx ? "flex" : "set1",
      });
    }
    patterns.push(pattern);
  }
  return patterns;
}

function generate2pc2pcRolePatterns(): SlotPattern[] {
  // C(5,2) ways to pick slots for set1, C(3,2) for set2, rest is flex
  const patterns: SlotPattern[] = [];
  const indices = [0, 1, 2, 3, 4];

  for (let a = 0; a < 5; a++) {
    for (let b = a + 1; b < 5; b++) {
      // a, b are set1 slots
      const remaining = indices.filter((i) => i !== a && i !== b);
      for (let c = 0; c < remaining.length; c++) {
        for (let d = c + 1; d < remaining.length; d++) {
          // remaining[c], remaining[d] are set2 slots
          const pattern: SlotPattern = [];
          for (let i = 0; i < 5; i++) {
            if (i === a || i === b) {
              pattern.push({ slotIdx: i, setRequirement: "set1" });
            } else if (i === remaining[c] || i === remaining[d]) {
              pattern.push({ slotIdx: i, setRequirement: "set2" });
            } else {
              pattern.push({ slotIdx: i, setRequirement: "flex" });
            }
          }
          patterns.push(pattern);
        }
      }
    }
  }
  return patterns;
}

function generate2pc2pcPatterns(
  setConstraint: BuildOptimizerConfig["setConstraint"],
  availableSetKeys: ReadonlySet<string>
): SlotPattern[] {
  const concretePairs = enumerateConcreteTwoPieceSetPairs(
    setConstraint.halfSet1,
    setConstraint.halfSet2,
    availableSetKeys
  );
  const rolePatterns = generate2pc2pcRolePatterns();
  const patterns: SlotPattern[] = [];

  for (const pair of concretePairs) {
    for (const rolePattern of rolePatterns) {
      patterns.push(
        rolePattern.map((entry) => {
          if (entry.setRequirement === "set1") {
            return { ...entry, concreteSetKey: pair.halfSet1SetKey };
          }
          if (entry.setRequirement === "set2") {
            return { ...entry, concreteSetKey: pair.halfSet2SetKey };
          }
          return entry;
        })
      );
    }
  }

  return patterns;
}

// ─── Core Optimizer ───

/**
 * Top-K limits per slot role:
 * - Set-constrained slots are already filtered by set, so candidates are naturally few.
 *   A higher cap avoids truncating good candidates when a user has many same-set artifacts.
 * - Flex slots are unfiltered and dominate combinatorial cost, so we cap them tighter.
 *
 * Typical combo counts (pre-pruning):
 *   4pc:     5 patterns × S⁴ × F  (S=set candidates, F=flex cap)
 *   2pc+2pc: 30 patterns × S1² × S2² × F
 * With S≈10, F=15: ~150K/pattern → well within budget after branch-and-bound.
 */
const TOP_K_SET = 30;
const TOP_K_FLEX = 15;

export function optimizeBuild(
  config: BuildOptimizerConfig
): BuildOptimizerResult {
  const {
    weights,
    candidates,
    crBudget,
    targetMainStatWeights,
    artifactPrices,
    slotCaps,
    setConstraint,
    topN = 3,
  } = config;

  const slots = allSlots;
  const tracker = new TopNTracker(topN);
  let combinationsEvaluated = 0;

  // Compute current score (sum of all "current" source candidates)
  let currentScore = 0;
  for (const slot of slots) {
    const current = candidates[slot].find((c) => c.source === "current");
    if (current) {
      currentScore += scoreSlotWithMainStatWeights(
        current,
        weights,
        targetMainStatWeights[slot]
      );
    }
  }

  // CR weight for penalty calculation
  const crWeight = weights.cr ?? 0;

  // Generate patterns based on composition
  const patterns =
    setConstraint.composition === "4pc"
      ? generate4pcPatterns()
      : generate2pc2pcPatterns(setConstraint, getAvailableSetKeys(candidates));

  for (const pattern of patterns) {
    // Filter candidates per slot by set requirement
    const slotCandidates: CandidateArtifact[][] = [];
    const slotScoresCache: number[][] = [];
    const adjustedSlotScoresCache: number[][] = [];
    const slotCrPartsCache: { mainCr: number; subCr: number }[][] = [];
    const slotCrMainWeights: number[] = [];
    let anyEmpty = false;

    for (const { slotIdx, setRequirement, concreteSetKey } of pattern) {
      const slot = slots[slotIdx];
      let filtered = candidates[slot];

      if (concreteSetKey != null) {
        filtered = filtered.filter((c) => c.setKey === concreteSetKey);
      } else if (setRequirement === "set1") {
        if (setConstraint.composition === "4pc" && setConstraint.artifactSet) {
          filtered = filtered.filter(
            (c) => c.setKey === setConstraint.artifactSet
          );
        }
      }
      // "flex" → no set filter

      if (filtered.length === 0) {
        anyEmpty = true;
        break;
      }

      // Score and sort (including weighted main stat contribution)
      const slotTargetMains = targetMainStatWeights[slot];
      const scored = filtered.map((c) => {
        const score = scoreSlotWithMainStatWeights(c, weights, slotTargetMains);
        return {
          candidate: c,
          score,
          adjustedScore: score - (artifactPrices?.get(c.id) ?? 0),
        };
      });
      scored.sort((a, b) => b.adjustedScore - a.adjustedScore);

      // Take top-K: set-constrained slots get a higher cap since they're already filtered
      const k =
        setRequirement === "flex"
          ? (slotCaps?.flex ?? TOP_K_FLEX)
          : (slotCaps?.set ?? TOP_K_SET);
      const topK = scored.slice(0, k);
      slotCandidates.push(topK.map((s) => s.candidate));
      slotScoresCache.push(topK.map((s) => s.score));
      adjustedSlotScoresCache.push(topK.map((s) => s.adjustedScore));
      slotCrPartsCache.push(topK.map((s) => getCandidateCrParts(s.candidate)));
      slotCrMainWeights.push(slotTargetMains.get("cr") ?? 0);
    }

    if (anyEmpty) continue;

    // Compute upper bounds per slot for pruning
    const bestPerSlot = adjustedSlotScoresCache.map((scores) => scores[0]);

    // Enumerate combinations with branch-and-bound pruning
    const depths = slotCandidates.length;
    const indices = new Array(depths).fill(0);
    const partialScores = new Array(depths + 1).fill(0);
    const partialAdjustedScores = new Array(depths + 1).fill(0);
    // CR tracked by source: substat CR is credited at the build's cr substat
    // weight, main-stat CR at its slot's main-stat weight. At most one slot
    // (circlet) can carry a CR main, so a single weight accumulator suffices.
    const partialSubCr = new Array(depths + 1).fill(0);
    const partialMainCr = new Array(depths + 1).fill(0);
    const partialMainCrWeight = new Array(depths + 1).fill(0);

    let depth = 0;
    while (depth >= 0) {
      if (depth === depths) {
        // Complete combination
        combinationsEvaluated++;
        const rawScore = partialScores[depth];
        const adjustedRawScore = partialAdjustedScores[depth];
        // Excess CR contributes 0 to the score: deduct over-cap CR at the
        // rate it was credited, keeping the highest-weighted CR within
        // budget. The build is still feasible — going to e.g. 101% CR is
        // allowed if the rest of the substats make it worthwhile.
        const crPenalty = computeWeightedCrDeduction(
          [
            { amount: partialSubCr[depth], weightPct: crWeight },
            {
              amount: partialMainCr[depth],
              weightPct: partialMainCrWeight[depth],
            },
          ],
          crBudget.totalNonArtifactCr
        );
        const finalScore = rawScore - crPenalty;
        const adjustedScore = adjustedRawScore - crPenalty;

        if (adjustedScore > tracker.threshold) {
          const artifacts = {} as Record<Slot, CandidateArtifact>;
          const slotScoresRecord = {} as Record<Slot, number>;
          for (let i = 0; i < depths; i++) {
            const slotIdx = pattern[i].slotIdx;
            const slot = slots[slotIdx];
            artifacts[slot] = slotCandidates[i][indices[i]];
            slotScoresRecord[slot] = slotScoresCache[i][indices[i]];
          }

          const build: OptimizedBuild = {
            artifacts,
            slotScores: slotScoresRecord,
            rawScore,
            crPenalty,
            finalScore,
            adjustedScore,
            totalArtifactCr: partialSubCr[depth] + partialMainCr[depth],
          };
          tracker.insert(build, buildSignature(build));
        }

        // Backtrack
        depth--;
        if (depth >= 0) indices[depth]++;
        continue;
      }

      if (indices[depth] >= slotCandidates[depth].length) {
        // Exhausted candidates at this depth, backtrack
        indices[depth] = 0;
        depth--;
        if (depth >= 0) indices[depth]++;
        continue;
      }

      // Pruning: can we beat the current threshold?
      const candidateScore = slotScoresCache[depth][indices[depth]];
      const candidateAdjustedScore =
        adjustedSlotScoresCache[depth][indices[depth]];
      const newPartial = partialScores[depth] + candidateScore;
      const newAdjustedPartial =
        partialAdjustedScores[depth] + candidateAdjustedScore;

      // Upper bound: partial + best possible for remaining slots
      let upperBound = newAdjustedPartial;
      for (let j = depth + 1; j < depths; j++) {
        upperBound += bestPerSlot[j];
      }

      if (upperBound <= tracker.threshold) {
        // Even best case can't beat current best — skip rest of this slot
        indices[depth] = 0;
        depth--;
        if (depth >= 0) indices[depth]++;
        continue;
      }

      // Extend
      const crParts = slotCrPartsCache[depth][indices[depth]];
      partialScores[depth + 1] = newPartial;
      partialAdjustedScores[depth + 1] = newAdjustedPartial;
      partialSubCr[depth + 1] = partialSubCr[depth] + crParts.subCr;
      partialMainCr[depth + 1] = partialMainCr[depth] + crParts.mainCr;
      partialMainCrWeight[depth + 1] =
        crParts.mainCr > 0
          ? slotCrMainWeights[depth]
          : partialMainCrWeight[depth];

      depth++;
    }
  }

  return {
    builds: tracker.getResults(),
    currentScore,
    combinationsEvaluated,
  };
}

function getAvailableSetKeys(
  candidates: Record<Slot, CandidateArtifact[]>
): Set<string> {
  const setKeys = new Set<string>();
  for (const slot of allSlots) {
    for (const candidate of candidates[slot]) {
      setKeys.add(candidate.setKey);
    }
  }
  return setKeys;
}

// ─── CR/CD Circlet Exploration ───

/**
 * Run optimizer twice when the top build uses a CR or CD circlet:
 * once normally, once forcing the alternative main stat.
 *
 * Why: per-slot scoring is additive, so the optimizer can't see that
 * swapping a CR circlet for CD changes the *relative value* of CR substats
 * on other slots. A CR head with strong CD subs can score higher than a
 * CD head per-slot, even when the CD-head build is globally better once
 * other slots shift their CR/CD substat balance.
 *
 * Cost: one extra optimizeBuild call (~same time), only when circlet is CR/CD.
 */
export function optimizeBuildWithCrCdExploration(
  config: BuildOptimizerConfig
): BuildOptimizerResult {
  const primary = optimizeBuild(config);

  if (primary.builds.length === 0) return primary;

  const circletMain = primary.builds[0].artifacts.circlet?.mainStatKey;
  if (circletMain !== "cr" && circletMain !== "cd") return primary;

  // Force the alternative: exclude the chosen main stat from circlet candidates
  const altCirclet = config.candidates.circlet.filter(
    (c) => c.mainStatKey !== circletMain
  );
  if (altCirclet.length === 0) return primary;

  const altResult = optimizeBuild({
    ...config,
    candidates: { ...config.candidates, circlet: altCirclet },
  });

  // Merge top builds from both runs, deduplicate by artifact signature
  // (the alt run can rediscover primary builds whose circlet main differs
  // from the primary top build's), keep topN.
  const topN = config.topN ?? 3;
  const seen = new Set<string>();
  const merged: OptimizedBuild[] = [];
  for (const build of [...primary.builds, ...altResult.builds].sort(
    (a, b) => rankScore(b) - rankScore(a)
  )) {
    const signature = buildSignature(build);
    if (seen.has(signature)) continue;
    seen.add(signature);
    merged.push(build);
    if (merged.length >= topN) break;
  }

  return {
    builds: merged,
    currentScore: primary.currentScore,
    combinationsEvaluated:
      primary.combinationsEvaluated + altResult.combinationsEvaluated,
  };
}

// ─── Stand-alone build scoring (for upgrade pass, etc.) ───

/**
 * Score a fixed 5-artifact build using the same scoring + CR penalty logic
 * the optimizer applies internally. Used by the upgrade pass to evaluate
 * "what if I swap this artifact for an upgraded variant".
 */
export function scoreFullBuild(
  artifacts: Record<Slot, CandidateArtifact>,
  weights: StatWeightMap,
  targetMainStatWeights: Record<Slot, ReadonlyMap<string, number>>,
  crBudget: CrBudgetResult
): { rawScore: number; finalScore: number; totalArtifactCr: number } {
  const crWeight = weights.cr ?? 0;
  let rawScore = 0;
  let subCr = 0;
  let mainCr = 0;
  let mainCrWeight = 0;
  for (const slot of allSlots) {
    const a = artifacts[slot];
    if (!a) continue;
    rawScore += scoreSlotWithMainStatWeights(
      a,
      weights,
      targetMainStatWeights[slot]
    );
    const crParts = getCandidateCrParts(a);
    subCr += crParts.subCr;
    if (crParts.mainCr > 0) {
      mainCr += crParts.mainCr;
      mainCrWeight = targetMainStatWeights[slot].get("cr") ?? 0;
    }
  }
  const crPenalty = computeWeightedCrDeduction(
    [
      { amount: subCr, weightPct: crWeight },
      { amount: mainCr, weightPct: mainCrWeight },
    ],
    crBudget.totalNonArtifactCr
  );
  return {
    rawScore,
    finalScore: rawScore - crPenalty,
    totalArtifactCr: subCr + mainCr,
  };
}

// ─── Top-K Enumeration (for cross-character allocation) ───

/**
 * Enumerate the top-K *unique* feasible builds for a single character, in
 * score-descending order. Two builds are considered equal when they use the
 * same set of artifact IDs (regardless of which slot is the "flex" slot);
 * the TopNTracker and the CR/CD-exploration merge both enforce uniqueness.
 *
 * Used by the allocation pass: each character contributes K "columns" (full builds)
 * to the cross-character packer, which then picks one column per character such
 * that artifact IDs are pairwise disjoint.
 *
 * K = 1 is equivalent to the current optimizer behavior. Larger K trades enumeration
 * cost for more flexibility in resolving cross-character conflicts.
 */
export function enumerateBuilds(
  config: BuildOptimizerConfig,
  k: number
): BuildOptimizerResult {
  return optimizeBuildWithCrCdExploration({ ...config, topN: k });
}
