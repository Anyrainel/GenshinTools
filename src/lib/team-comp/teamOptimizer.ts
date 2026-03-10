import { detectEquippedSets } from "@/components/team-comp/teamOptUtils";
import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import type { BuildMatchResult } from "../account-data/artifactScore";
import { TeamBuild, evaluateCombo } from "./damageCalc";
import { StatSheet } from "./damageModels";
import {
  type OptFailReason,
  type OptimizationResult,
  type OptimizerOptions,
  runOptimization,
} from "./optimizer";
import type {
  CalcContext,
  CharCompConfig,
  ComboFormula,
  ComboResult,
  DamageResult,
  ReactionOverride,
} from "./types";

// ─── Types ───

export type TeamOptPassId = "carry-1" | "support" | "carry-2";

export interface TeamOptPassResult {
  passId: TeamOptPassId;
  charId: string;
  bestDamage: number;
  bestArtifacts: Record<Slot, ArtifactData | null>;
  failReason?: OptFailReason;
}

export interface TeamOptimizationProgress {
  currentPass: TeamOptPassId;
  currentPassCharId: string;
  passIndex: number;
  totalPasses: number;
  passPhase: "pruning" | "evaluating";
  passProgress: number; // 0–1 within current pass
  overallProgress: number; // 0–1 across all passes
  passResults: TeamOptPassResult[];
  done: false;
}

interface TeamOptResultBase {
  bestDamage: number;
  bestArtifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  passResults: TeamOptPassResult[];
  /** Per-character failure reasons (only for characters that failed to find a build). */
  failReasons: Record<string, OptFailReason>;
  /** Rebuilt TeamBuild if artifact sets were adjusted (ignoreArtifactSets fallback or detected accidental sets). */
  teamBuild?: TeamBuild;
  done: true;
}

export interface TeamOptSingleResult extends TeamOptResultBase {
  mode: "single";
  bestDamageResult: DamageResult;
}

export interface TeamOptComboResult extends TeamOptResultBase {
  mode: "combo";
  bestComboResult: ComboResult;
}

export type TeamOptimizationResult = TeamOptSingleResult | TeamOptComboResult;

export type TeamOptYield = TeamOptimizationProgress | TeamOptimizationResult;

export interface PerCharConfig {
  targetEr: number;
  targetCr: number;
  buildMatch?: BuildMatchResult | null;
  artifactSetId?: string | null;
  artifactHalfSetIds?: string[];
}

export interface TeamOptimizerOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  formulaId: string;
  inventory: ArtifactData[];
  calcContext: CalcContext;
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>;
  /** Per-character optimizer config (keyed by charId) */
  perChar: Record<string, PerCharConfig>;
  reactionOverride?: ReactionOverride;
  altCount?: number; // Alternatives per slot in hill-climbing (default 7, use 5 on mobile)
  /** Combo mode: optimize for total combo damage instead of single formula. */
  combo?: ComboFormula;
  /** Per-formula reaction overrides (keyed by "charId.formulaId"), used by combo evaluation. */
  reactionOverrides?: Record<string, ReactionOverride>;
  /** Per-character flag: retry failed passes without artifact set constraints (keyed by charId). */
  ignoreArtifactSets?: Record<string, boolean>;
}

// ─── Helpers ───

function collectArtifactIds(arts: Record<Slot, ArtifactData | null>): string[] {
  const ids: string[] = [];
  for (const slot of allSlots) {
    const a = arts[slot];
    if (a) ids.push(a.id);
  }
  return ids;
}

function collectArtifactIdSet(
  arts: Record<Slot, ArtifactData | null>
): Set<string> {
  return new Set(collectArtifactIds(arts));
}

const emptyArtifacts: Record<Slot, ArtifactData | null> = {
  flower: null,
  plume: null,
  sands: null,
  goblet: null,
  circlet: null,
};

/** Fisher-Yates in-place shuffle. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Generate all permutations of an array. */
function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

/** Build StatSheet map from artifact assignments. */
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

/** Compute final score for an artifact assignment. */
function computeFinalScore(
  teamBuild: TeamBuild,
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>,
  baseSheets: Record<string, StatSheet>,
  carryCharId: string,
  formulaId: string,
  calcContext: CalcContext,
  reactionOverride: ReactionOverride | undefined,
  isComboMode: boolean,
  combo: ComboFormula | undefined,
  reactionOverrides: Record<string, ReactionOverride> | undefined
): number {
  const sheets = buildSheetsFromArtifacts(baseSheets, artifactsByChar);
  if (isComboMode && combo) {
    try {
      return evaluateCombo(
        teamBuild,
        combo,
        sheets,
        calcContext,
        reactionOverrides
      ).totalDamage;
    } catch {
      return 0;
    }
  }
  const postStats = teamBuild.getTeamStats(sheets, carryCharId, calcContext);
  return teamBuild.getDamageResult(
    carryCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride
  ).totalDamage;
}

// ─── Multi-Pass Generator ───

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
  } = opts;

  const isComboMode =
    combo != null && combo.lines.filter((l) => l.count > 0).length > 0;

  // Build combo scoreFn if in combo mode
  const comboScoreFn = isComboMode
    ? (sheets: Record<string, StatSheet>, _calcTargetId: string): number => {
        try {
          return evaluateCombo(
            teamBuild,
            combo,
            sheets,
            calcContext,
            reactionOverrides
          ).totalDamage;
        } catch {
          return 0;
        }
      }
    : undefined;

  // Classify characters into carries and supports (randomized within groups)
  const allCharIds = Object.keys(perChar);
  let carryCharIds: string[];
  let supportCharIds: string[];

  if (isComboMode) {
    const comboCharIds = new Set(
      combo.lines.filter((l) => l.count > 0).map((l) => l.charId)
    );
    carryCharIds = shuffle(allCharIds.filter((id) => comboCharIds.has(id)));
    supportCharIds = shuffle(allCharIds.filter((id) => !comboCharIds.has(id)));
  } else {
    carryCharIds = [carryCharId];
    supportCharIds = shuffle(allCharIds.filter((id) => id !== carryCharId));
  }

  // The round-1 order: carries first, then supports
  const round1Order = [...carryCharIds, ...supportCharIds];

  // Mutable effective state: tracks the current TeamBuild and perChar configs
  // (modified when ignoreArtifactSets triggers set removal or accidental set detection)
  let effectiveTeamBuild = teamBuild;
  const effectivePerChar = { ...perChar };

  // Helper: rebuild TeamBuild from the original configs with modified set fields
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

  // Helper: run a single character's optimizer pass and yield progress
  async function* runCharPass(
    charId: string,
    passId: TeamOptPassId,
    currentSheets: Record<string, StatSheet>,
    excludedIds: Set<string> | undefined,
    passIdx: number,
    totalPasses: number,
    passResults: TeamOptPassResult[],
    overrideTeamBuild?: TeamBuild,
    overrideCharConfig?: PerCharConfig
  ): AsyncGenerator<
    TeamOptimizationProgress,
    OptimizationResult | null,
    undefined
  > {
    const charConfig = overrideCharConfig ?? effectivePerChar[charId];
    if (!charConfig) return null;
    const tb = overrideTeamBuild ?? effectiveTeamBuild;

    // Rebuild combo scoreFn with current teamBuild if it was overridden
    const passComboScoreFn =
      tb !== teamBuild && isComboMode
        ? (
            sheets: Record<string, StatSheet>,
            _calcTargetId: string
          ): number => {
            try {
              return evaluateCombo(
                tb,
                combo,
                sheets,
                calcContext,
                reactionOverrides
              ).totalDamage;
            } catch {
              return 0;
            }
          }
        : comboScoreFn;

    const passOpts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: carryCharId,
      formulaId,
      targetEr: charConfig.targetEr,
      targetCr: charConfig.targetCr,
      inventory,
      buildMatch: charConfig.buildMatch,
      globalConfig,
      baseSheets: currentSheets,
      calcContext,
      artifactSetId: charConfig.artifactSetId ?? null,
      artifactHalfSetIds: charConfig.artifactHalfSetIds,
      swapCharId: charId,
      calcTargetId: carryCharId,
      formulaCharId: carryCharId,
      erCheckCharId: charId,
      excludedArtifactIds: excludedIds,
      reactionOverride,
      altCount: opts.altCount,
      scoreFn: passComboScoreFn,
    };

    const gen = runOptimization(passOpts);
    let lastResult: OptimizationResult | null = null;

    for await (const res of gen) {
      lastResult = res;
      const passWeight = 1 / totalPasses;
      const overallProgress = passIdx * passWeight + res.progress * passWeight;
      yield {
        currentPass: passId,
        currentPassCharId: charId,
        passIndex: passIdx,
        totalPasses,
        passPhase: res.phase,
        passProgress: res.progress,
        overallProgress,
        passResults: [...passResults],
        done: false,
      } satisfies TeamOptimizationProgress;
    }

    return lastResult;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Phase 1: Unlocked pass — optimize all characters without locking
  // ════════════════════════════════════════════════════════════════════════

  // Estimate total passes for progress: round1 + worst-case permutations + carry-2
  // We'll update totalPasses as we learn more about conflicts
  const carry2Count = carryCharIds.length;
  let estimatedTotal = round1Order.length + carry2Count; // will grow if conflicts found
  const allPassResults: TeamOptPassResult[] = [];

  const unlockedResults: Record<
    string,
    {
      arts: Record<Slot, ArtifactData | null>;
      damage: number;
      failReason?: OptFailReason;
    }
  > = {};
  const unlockedPassResults: TeamOptPassResult[] = [];
  let unlockedSheets = { ...baseSheets };

  for (let i = 0; i < round1Order.length; i++) {
    const charId = round1Order[i];
    const passId: TeamOptPassId = carryCharIds.includes(charId)
      ? "carry-1"
      : "support";

    const gen = runCharPass(
      charId,
      passId,
      unlockedSheets,
      undefined, // no exclusions
      i,
      estimatedTotal,
      allPassResults
    );

    let lastResult: OptimizationResult | null = null;
    for (;;) {
      const { value, done } = await gen.next();
      if (done) {
        lastResult = value;
        break;
      }
      yield value;
    }

    // ignoreArtifactSets fallback: if pass failed and flag is set for this character, retry without sets
    if (
      lastResult?.failReason &&
      opts.ignoreArtifactSets?.[charId] &&
      (effectivePerChar[charId]?.artifactSetId ||
        (effectivePerChar[charId]?.artifactHalfSetIds?.length ?? 0) > 0)
    ) {
      // Strip set constraints for this character
      effectivePerChar[charId] = {
        ...effectivePerChar[charId],
        artifactSetId: null,
        artifactHalfSetIds: [],
      };
      effectiveTeamBuild = rebuildTeamBuild();

      // Retry without set constraints
      const retryGen = runCharPass(
        charId,
        passId,
        unlockedSheets,
        undefined,
        i,
        estimatedTotal,
        allPassResults,
        effectiveTeamBuild,
        effectivePerChar[charId]
      );
      for (;;) {
        const { value, done } = await retryGen.next();
        if (done) {
          lastResult = value;
          break;
        }
        yield value;
      }
    }

    if (lastResult) {
      unlockedResults[charId] = {
        arts: lastResult.bestArtifacts,
        damage: lastResult.bestDamage,
        failReason: lastResult.failReason,
      };
      unlockedPassResults.push({
        passId,
        charId,
        bestDamage: lastResult.bestDamage,
        bestArtifacts: lastResult.bestArtifacts,
        failReason: lastResult.failReason,
      });
      // Update sheets so subsequent characters see this character's artifacts
      const pieces = allSlots
        .map((s) => lastResult!.bestArtifacts[s])
        .filter((a): a is ArtifactData => a != null);
      unlockedSheets = {
        ...unlockedSheets,
        [charId]: StatSheet.fromArtifacts(pieces),
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Phase 2: Detect conflicts — find artifacts claimed by 2+ characters
  // ════════════════════════════════════════════════════════════════════════

  function findCompetitorSet(
    results: Record<
      string,
      { arts: Record<Slot, ArtifactData | null>; damage: number }
    >
  ): Set<string> {
    const artifactOwners = new Map<string, Set<string>>();
    for (const [charId, { arts }] of Object.entries(results)) {
      for (const artId of collectArtifactIds(arts)) {
        if (!artifactOwners.has(artId)) artifactOwners.set(artId, new Set());
        artifactOwners.get(artId)!.add(charId);
      }
    }
    const competitors = new Set<string>();
    for (const owners of artifactOwners.values()) {
      if (owners.size >= 2) {
        for (const cid of owners) competitors.add(cid);
      }
    }
    return competitors;
  }

  const competitorSet = findCompetitorSet(unlockedResults);

  // ════════════════════════════════════════════════════════════════════════
  // Phase 3: Permutation loop — try all orderings of competitors
  // ════════════════════════════════════════════════════════════════════════

  // Best round-1 result (artifacts + score) across all permutations
  let bestR1ArtifactsByChar: Record<
    string,
    Record<Slot, ArtifactData | null>
  > = {};
  for (const charId of allCharIds) {
    bestR1ArtifactsByChar[charId] = unlockedResults[charId]?.arts ?? {
      ...emptyArtifacts,
    };
  }
  let bestR1PassResults: TeamOptPassResult[] = [...unlockedPassResults];
  let bestR1Score = computeFinalScore(
    effectiveTeamBuild,
    bestR1ArtifactsByChar,
    baseSheets,
    carryCharId,
    formulaId,
    calcContext,
    reactionOverride,
    isComboMode,
    combo,
    reactionOverrides
  );

  if (competitorSet.size >= 2) {
    const competitorArr = [...competitorSet];
    const nonCompetitors = allCharIds.filter((id) => !competitorSet.has(id));
    const perms = permutations(competitorArr);

    // Update estimated total for progress reporting
    estimatedTotal =
      round1Order.length + perms.length * competitorArr.length + carry2Count;

    let globalPassIdx = round1Order.length;
    let cascadeExpanded = false;

    for (let permIdx = 0; permIdx < perms.length; permIdx++) {
      const perm = perms[permIdx];
      const permExcluded = new Set<string>();
      let permSheets = { ...baseSheets };
      const permArtifactsByChar: Record<
        string,
        Record<Slot, ArtifactData | null>
      > = {};
      const permPassResults: TeamOptPassResult[] = [];

      // Non-competitors keep their unlocked results (artifacts NOT locked)
      for (const cid of nonCompetitors) {
        const ur = unlockedResults[cid];
        if (ur) {
          permArtifactsByChar[cid] = ur.arts;
          const pieces = allSlots
            .map((s) => ur.arts[s])
            .filter((a): a is ArtifactData => a != null);
          permSheets = {
            ...permSheets,
            [cid]: StatSheet.fromArtifacts(pieces),
          };
        }
      }

      // Run competitors in permutation order, WITH locking among themselves
      for (let ci = 0; ci < perm.length; ci++) {
        const charId = perm[ci];
        const passId: TeamOptPassId = carryCharIds.includes(charId)
          ? "carry-1"
          : "support";

        const gen = runCharPass(
          charId,
          passId,
          permSheets,
          permExcluded.size > 0 ? new Set(permExcluded) : undefined,
          globalPassIdx,
          estimatedTotal,
          [...allPassResults, ...permPassResults]
        );

        let lastResult: OptimizationResult | null = null;
        for (;;) {
          const { value, done } = await gen.next();
          if (done) {
            lastResult = value;
            break;
          }
          yield value;
        }

        if (lastResult) {
          permArtifactsByChar[charId] = lastResult.bestArtifacts;
          permPassResults.push({
            passId,
            charId,
            bestDamage: lastResult.bestDamage,
            bestArtifacts: lastResult.bestArtifacts,
            failReason: lastResult.failReason,
          });

          // Lock this character's artifacts for subsequent competitors
          for (const id of collectArtifactIds(lastResult.bestArtifacts)) {
            permExcluded.add(id);
          }

          const pieces = allSlots
            .map((s) => lastResult!.bestArtifacts[s])
            .filter((a): a is ArtifactData => a != null);
          permSheets = {
            ...permSheets,
            [charId]: StatSheet.fromArtifacts(pieces),
          };
        }

        globalPassIdx++;
      }

      // Cascade check on first permutation: did any competitor take a
      // non-competitor's artifact?
      if (permIdx === 0 && !cascadeExpanded) {
        const competitorArtIds = new Set<string>();
        for (const cid of perm) {
          const arts = permArtifactsByChar[cid];
          if (arts) {
            for (const id of collectArtifactIds(arts)) {
              competitorArtIds.add(id);
            }
          }
        }

        let expanded = false;
        for (const cid of nonCompetitors) {
          const ur = unlockedResults[cid];
          if (!ur) continue;
          for (const artId of collectArtifactIds(ur.arts)) {
            if (competitorArtIds.has(artId)) {
              competitorSet.add(cid);
              expanded = true;
              break;
            }
          }
        }

        if (expanded) {
          // Restart phase 3 with expanded competitor set
          cascadeExpanded = true;
          const newCompetitorArr = [...competitorSet];
          const newNonCompetitors = allCharIds.filter(
            (id) => !competitorSet.has(id)
          );
          const newPerms = permutations(newCompetitorArr);

          estimatedTotal =
            round1Order.length +
            newPerms.length * newCompetitorArr.length +
            carry2Count;

          globalPassIdx = round1Order.length;

          // Re-run with expanded set — restart the outer for loop
          // by replacing perms and nonCompetitors
          // We use a recursive-style restart via a labeled restart
          // Instead, we'll just run the expanded permutations inline

          bestR1Score = -1; // reset so any permutation can win

          for (let newPermIdx = 0; newPermIdx < newPerms.length; newPermIdx++) {
            const newPerm = newPerms[newPermIdx];
            const newPermExcluded = new Set<string>();
            let newPermSheets = { ...baseSheets };
            const newPermArtifacts: Record<
              string,
              Record<Slot, ArtifactData | null>
            > = {};
            const newPermPassResults: TeamOptPassResult[] = [];

            for (const ncid of newNonCompetitors) {
              const ur = unlockedResults[ncid];
              if (ur) {
                newPermArtifacts[ncid] = ur.arts;
                const pieces = allSlots
                  .map((s) => ur.arts[s])
                  .filter((a): a is ArtifactData => a != null);
                newPermSheets = {
                  ...newPermSheets,
                  [ncid]: StatSheet.fromArtifacts(pieces),
                };
              }
            }

            for (let ci = 0; ci < newPerm.length; ci++) {
              const charId = newPerm[ci];
              const passId: TeamOptPassId = carryCharIds.includes(charId)
                ? "carry-1"
                : "support";

              const gen = runCharPass(
                charId,
                passId,
                newPermSheets,
                newPermExcluded.size > 0 ? new Set(newPermExcluded) : undefined,
                globalPassIdx,
                estimatedTotal,
                [...allPassResults, ...newPermPassResults]
              );

              let lastResult: OptimizationResult | null = null;
              for (;;) {
                const { value, done } = await gen.next();
                if (done) {
                  lastResult = value;
                  break;
                }
                yield value;
              }

              if (lastResult) {
                newPermArtifacts[charId] = lastResult.bestArtifacts;
                newPermPassResults.push({
                  passId,
                  charId,
                  bestDamage: lastResult.bestDamage,
                  bestArtifacts: lastResult.bestArtifacts,
                  failReason: lastResult.failReason,
                });

                for (const id of collectArtifactIds(lastResult.bestArtifacts)) {
                  newPermExcluded.add(id);
                }

                const pieces = allSlots
                  .map((s) => lastResult!.bestArtifacts[s])
                  .filter((a): a is ArtifactData => a != null);
                newPermSheets = {
                  ...newPermSheets,
                  [charId]: StatSheet.fromArtifacts(pieces),
                };
              }

              globalPassIdx++;
            }

            // Fill in non-competitors
            for (const cid of allCharIds) {
              if (!newPermArtifacts[cid]) {
                newPermArtifacts[cid] = unlockedResults[cid]?.arts ?? {
                  ...emptyArtifacts,
                };
              }
            }

            const permScore = computeFinalScore(
              effectiveTeamBuild,
              newPermArtifacts,
              baseSheets,
              carryCharId,
              formulaId,
              calcContext,
              reactionOverride,
              isComboMode,
              combo,
              reactionOverrides
            );

            if (permScore > bestR1Score) {
              bestR1Score = permScore;
              bestR1ArtifactsByChar = newPermArtifacts;
              bestR1PassResults = newPermPassResults;
            }
          }

          // Skip remaining original permutations since we did expanded set
          break;
        }
      }

      if (cascadeExpanded) break; // already handled above

      // Fill in non-competitors
      for (const cid of allCharIds) {
        if (!permArtifactsByChar[cid]) {
          permArtifactsByChar[cid] = unlockedResults[cid]?.arts ?? {
            ...emptyArtifacts,
          };
        }
      }

      const permScore = computeFinalScore(
        effectiveTeamBuild,
        permArtifactsByChar,
        baseSheets,
        carryCharId,
        formulaId,
        calcContext,
        reactionOverride,
        isComboMode,
        combo,
        reactionOverrides
      );

      if (permScore > bestR1Score) {
        bestR1Score = permScore;
        bestR1ArtifactsByChar = permArtifactsByChar;
        bestR1PassResults = permPassResults;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Phase 4: Carry round-2 — re-optimize carries with support artifacts locked
  // ════════════════════════════════════════════════════════════════════════

  // Start from the best round-1 result
  let currentSheets = buildSheetsFromArtifacts(
    baseSheets,
    bestR1ArtifactsByChar
  );
  const passResults = [...bestR1PassResults];

  // Lock all non-carry artifacts
  const carry2Excluded = new Set<string>();
  for (const [charId, arts] of Object.entries(bestR1ArtifactsByChar)) {
    if (!carryCharIds.includes(charId)) {
      for (const id of collectArtifactIds(arts)) {
        carry2Excluded.add(id);
      }
    }
  }

  const carry2StartIdx = estimatedTotal - carry2Count;

  for (let ci = 0; ci < carryCharIds.length; ci++) {
    const charId = carryCharIds[ci];

    // Unlock this carry's round-1 artifacts before re-optimizing
    const prevArts = bestR1ArtifactsByChar[charId];
    if (prevArts) {
      for (const id of collectArtifactIds(prevArts)) {
        carry2Excluded.delete(id);
      }
    }

    const gen = runCharPass(
      charId,
      "carry-2",
      currentSheets,
      carry2Excluded.size > 0 ? new Set(carry2Excluded) : undefined,
      carry2StartIdx + ci,
      estimatedTotal,
      passResults
    );

    let lastResult: OptimizationResult | null = null;
    for (;;) {
      const { value, done } = await gen.next();
      if (done) {
        lastResult = value;
        break;
      }
      yield value;
    }

    if (lastResult) {
      bestR1ArtifactsByChar[charId] = lastResult.bestArtifacts;
      passResults.push({
        passId: "carry-2",
        charId,
        bestDamage: lastResult.bestDamage,
        bestArtifacts: lastResult.bestArtifacts,
        failReason: lastResult.failReason,
      });

      // Lock this carry's new artifacts for subsequent carries
      for (const id of collectArtifactIds(lastResult.bestArtifacts)) {
        carry2Excluded.add(id);
      }

      const pieces = allSlots
        .map((s) => lastResult!.bestArtifacts[s])
        .filter((a): a is ArtifactData => a != null);
      currentSheets = {
        ...currentSheets,
        [charId]: StatSheet.fromArtifacts(pieces),
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Final result — detect accidental set bonuses and rebuild if needed
  // ════════════════════════════════════════════════════════════════════════

  const bestArtifactsByChar = bestR1ArtifactsByChar;

  // Post-optimization: detect actual artifact sets formed by optimized pieces
  // and rebuild TeamBuild if they differ from what was used during optimization
  let setsChanged = effectiveTeamBuild !== teamBuild; // already changed if fallback fired
  for (const charId of allCharIds) {
    const arts = bestArtifactsByChar[charId];
    if (!arts) continue;
    const pieces = allSlots
      .map((s) => arts[s])
      .filter(Boolean) as ArtifactData[];
    const detected = detectEquippedSets(pieces);
    const epc = effectivePerChar[charId];
    if (!epc) continue;

    // Compare detected sets with what the effective config has
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

  if (setsChanged) {
    effectiveTeamBuild = rebuildTeamBuild();
  }

  const finalSheets = buildSheetsFromArtifacts(baseSheets, bestArtifactsByChar);

  // Collect per-character failure reasons from the last pass result per char
  const failReasons: Record<string, OptFailReason> = {};
  const lastPassByChar = new Map<string, TeamOptPassResult>();
  for (const pr of passResults) {
    lastPassByChar.set(pr.charId, pr);
  }
  for (const [charId, pr] of lastPassByChar) {
    if (pr.failReason) {
      failReasons[charId] = pr.failReason;
    }
  }

  const resultBase = {
    bestArtifactsByChar,
    passResults,
    failReasons,
    // Include rebuilt TeamBuild if sets were adjusted
    ...(setsChanged ? { teamBuild: effectiveTeamBuild } : {}),
    done: true as const,
  };

  if (isComboMode) {
    const comboRes = evaluateCombo(
      effectiveTeamBuild,
      combo,
      finalSheets,
      calcContext,
      reactionOverrides
    );
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
      reactionOverride
    );
    yield {
      ...resultBase,
      mode: "single",
      bestDamage: finalDmg.totalDamage,
      bestDamageResult: finalDmg,
    } satisfies TeamOptSingleResult;
  }
}
