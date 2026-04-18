import type { ArtifactData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
/**
 * V1 Team Optimizer: Hill-Climbing with Greedy Allocation
 *
 * Backup algorithm for benchmark solution generation.
 * Moved from src/lib/team-comp/teamOptimizer.ts.
 */
import { detectEquippedSets } from "@/lib/team-comp/teamOptUtils";
import type {
  BuffActivationMap,
  CalcContext,
  CharOptConfig,
  ComboFormula,
  ComboResult,
  ReactionOverride,
  TeamOptPassId,
  TeamOptPassResult,
  TeamOptYield,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";
import {
  type OptFailReason,
  type OptimizationResult,
  type OptimizerOptions,
  runOptimization,
} from "../../lib/team-comp/optimizer/optimizerV1";

const warnedCalcErrors = new Set<string>();

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
  buffOverrides?: Record<number, BuffActivationMap>
): number {
  const sheets = buildSheetsFromArtifacts(baseSheets, artifactsByChar);
  if (isComboMode && combo) {
    try {
      return teamBuild.getComboDamageResult(
        combo,
        sheets,
        calcContext,
        buffOverrides
      ).totalDamage;
    } catch (e) {
      const key = `computeFinalScore:${carryCharId}`;
      if (!warnedCalcErrors.has(key)) {
        warnedCalcErrors.add(key);
        console.warn(
          `[teamOptimizer] computeFinalScore failed for ${carryCharId}:`,
          e
        );
      }
      return 0;
    }
  }
  const postStats = teamBuild.getTeamStats(sheets, carryCharId, calcContext);

  // Compute off-field stats if the formula has off-field parts
  let offFieldStats: Record<string, StatSheet> | undefined;
  if (teamBuild.hasOffFieldParts(carryCharId, formulaId)) {
    const otherCharId = Object.keys(teamBuild.charBuilds).find(
      (id) => id !== carryCharId
    );
    if (otherCharId) {
      offFieldStats = teamBuild.getTeamStats(sheets, otherCharId, calcContext);
    }
  }

  return teamBuild.getDamageResult(
    carryCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride,
    offFieldStats
  ).totalDamage;
}

// ─── Multi-Pass Generator ───

export async function* runTeamOptimization(
  opts: TeamOptimizerOptions
): AsyncGenerator<TeamOptYield> {
  const {
    teamBuild,
    carryCharId,
    inventory,
    calcContext,
    globalConfig,
    baseSheets,
    perChar,
    combo,
  } = opts;
  const buffOverrides = combo.buffOverrides;

  const carryLine = combo.lines.find((l) => l.charId === carryCharId);
  const formulaId = carryLine?.formulaId ?? "";
  const reactionOverride = carryLine?.reaction;

  const isComboMode =
    combo != null && combo.lines.filter((l) => l.count > 0).length > 0;

  // Build combo scoreFn if in combo mode
  const comboScoreFn = isComboMode
    ? (sheets: Record<string, StatSheet>, _onFieldCharId: string): number => {
        try {
          return teamBuild.getComboDamageResult(
            combo,
            sheets,
            calcContext,
            buffOverrides
          ).totalDamage;
        } catch (e) {
          const key = `comboScoreFn:${_onFieldCharId}`;
          if (!warnedCalcErrors.has(key)) {
            warnedCalcErrors.add(key);
            console.warn(
              `[teamOptimizer] comboScoreFn failed for ${_onFieldCharId}:`,
              e
            );
          }
          return 0;
        }
      }
    : undefined;

  // ── Diagnostic logging (enabled via env or globalThis) ──
  const LOG_DIAG =
    typeof globalThis !== "undefined" &&
    // biome-ignore lint/suspicious/noExplicitAny: debug flag
    (globalThis as any).__TEAM_OPT_DIAG__;

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
    return new TeamBuild(newConfigs, teamBuild.combatOpts, teamBuild.enemyAura);
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
    overrideCharConfig?: CharOptConfig,
    deadline?: number
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
            _onFieldCharId: string
          ): number => {
            try {
              return tb.getComboDamageResult(
                combo,
                sheets,
                calcContext,
                buffOverrides
              ).totalDamage;
            } catch (e) {
              const key = `passComboScoreFn:${carryCharId}`;
              if (!warnedCalcErrors.has(key)) {
                warnedCalcErrors.add(key);
                console.warn(
                  `[teamOptimizer] passComboScoreFn failed for ${carryCharId}:`,
                  e
                );
              }
              return 0;
            }
          }
        : comboScoreFn;

    const passOpts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: carryCharId,
      formulaId,
      minEr: charConfig.minEr,
      minCr: charConfig.minCr,
      inventory,
      buildMatch: charConfig.buildMatch,
      globalConfig,
      baseSheets: currentSheets,
      calcContext,
      artifactSetId: charConfig.artifactSetId ?? null,
      artifactHalfSetIds: charConfig.artifactHalfSetIds,
      swapCharId: charId,
      onFieldCharId: carryCharId,
      formulaCharId: carryCharId,
      erCheckCharId: charId,
      excludedArtifactIds: excludedIds,
      reactionOverride,
      scoreFn: passComboScoreFn,
      deadlineMs: deadline,
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
        phase: "phase1",
        passResults: [...passResults],
        done: false,
      } satisfies TeamOptimizationProgress;
    }

    return lastResult;
  }

  // Phase 1: Unlocked pass — optimize all characters without locking

  // ── Time budgeting ──
  const teamDeadlineMs = opts.teamDeadlineMs;
  const perCharDeadlineMs = opts.perCharDeadlineMs;

  /** Compute a per-character deadline from the remaining team budget. */
  function charDeadline(remainingChars: number): number | undefined {
    if (perCharDeadlineMs) return performance.now() + perCharDeadlineMs;
    if (!teamDeadlineMs) return undefined;
    const remaining = teamDeadlineMs - performance.now();
    if (remaining <= 0) return performance.now(); // already expired
    // Give each remaining character an equal share of remaining time
    return performance.now() + remaining / Math.max(1, remainingChars);
  }

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

  const _t0_phase1 = performance.now();

  for (let i = 0; i < round1Order.length; i++) {
    const charId = round1Order[i];
    const passId: TeamOptPassId = carryCharIds.includes(charId)
      ? "carry-1"
      : "support";

    const _tCharStart = performance.now();

    const gen = runCharPass(
      charId,
      passId,
      unlockedSheets,
      undefined, // no exclusions
      i,
      estimatedTotal,
      allPassResults,
      undefined,
      undefined,
      charDeadline(round1Order.length - i)
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
        effectivePerChar[charId],
        charDeadline(round1Order.length - i)
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

    if (LOG_DIAG) {
      const _tCharEnd = performance.now();
      const elapsed = ((_tCharEnd - _tCharStart) / 1000).toFixed(1);
      const evalCount = lastResult?.combinationsEvaluated ?? 0;
      console.log(
        `  [DIAG] Phase 1 char ${i + 1}/${round1Order.length}: ${charId} → ${elapsed}s (${evalCount.toLocaleString()} evals, dmg=${lastResult?.bestDamage?.toFixed(0) ?? "null"})`
      );
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

  // Phase 2: Detect conflicts — find artifacts claimed by 2+ characters

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

  const _t1_phase1done = performance.now();

  const competitorSet = findCompetitorSet(unlockedResults);

  // Phase 3: Permutation loop — try all orderings of competitors

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
    buffOverrides
  );

  if (competitorSet.size >= 2) {
    // The unlocked results may have duplicate artifacts (multiple characters
    // claiming the same piece), inflating bestR1Score. Reset to -1 so that
    // any valid (duplicate-free) permutation result replaces the initial.
    bestR1Score = -1;

    const MAX_PERMS = 6;
    const competitorArr = [...competitorSet];
    const nonCompetitors = allCharIds.filter((id) => !competitorSet.has(id));
    const allPerms = permutations(competitorArr);
    // Limit permutations: shuffle and take at most MAX_PERMS to avoid factorial blowup
    const perms =
      allPerms.length > MAX_PERMS
        ? shuffle(allPerms).slice(0, MAX_PERMS)
        : allPerms;

    if (LOG_DIAG) {
      console.log(
        `  [DIAG] Phase 2: ${competitorArr.length} competitors: [${competitorArr.join(", ")}]`
      );
      console.log(
        `  [DIAG]   → ${perms.length} permutations × ${competitorArr.length} passes = ${perms.length * competitorArr.length} optimizer runs`
      );
      console.log(
        `  [DIAG]   Non-competitors (locked): [${nonCompetitors.join(", ")}]`
      );
    }

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

      // Non-competitors keep their unlocked results; lock their artifacts
      // so competitors cannot claim them (prevents duplicate assignments).
      for (const cid of nonCompetitors) {
        const ur = unlockedResults[cid];
        if (ur) {
          permArtifactsByChar[cid] = ur.arts;
          for (const id of collectArtifactIds(ur.arts)) {
            permExcluded.add(id);
          }
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
          [...allPassResults, ...permPassResults],
          undefined,
          undefined,
          charDeadline(perm.length - ci)
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
          if (LOG_DIAG) {
            console.log(
              `  [DIAG] CASCADE: competitors expanded to ${newCompetitorArr.length}: [${newCompetitorArr.join(", ")}]`
            );
          }
          const newNonCompetitors = allCharIds.filter(
            (id) => !competitorSet.has(id)
          );
          const allNewPerms = permutations(newCompetitorArr);
          const newPerms =
            allNewPerms.length > MAX_PERMS
              ? shuffle(allNewPerms).slice(0, MAX_PERMS)
              : allNewPerms;

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
                for (const id of collectArtifactIds(ur.arts)) {
                  newPermExcluded.add(id);
                }
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
                [...allPassResults, ...newPermPassResults],
                undefined,
                undefined,
                charDeadline(newPerm.length - ci)
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

            // Check constraints before accepting this permutation
            const expPermSheets = buildSheetsFromArtifacts(
              baseSheets,
              newPermArtifacts
            );
            const expPermStats = effectiveTeamBuild.getTeamStats(
              expPermSheets,
              carryCharId,
              calcContext
            );
            let expConstraintsOk = true;
            for (const cid of allCharIds) {
              const cc = effectivePerChar[cid];
              if (!cc) continue;
              if (cc.minEr > 0) {
                const er = expPermStats[cid]?.get("er", null) ?? 0;
                if (er < cc.minEr - 1e-6) {
                  expConstraintsOk = false;
                  break;
                }
              }
              if (cc.minCr > 0) {
                const cr = expPermStats[cid]?.get("cr", null) ?? 0;
                if (cr < cc.minCr - 1e-6) {
                  expConstraintsOk = false;
                  break;
                }
              }
            }
            if (!expConstraintsOk) {
              if (teamDeadlineMs && performance.now() >= teamDeadlineMs) break;
              continue;
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
              buffOverrides
            );

            if (permScore > bestR1Score) {
              bestR1Score = permScore;
              bestR1ArtifactsByChar = newPermArtifacts;
              bestR1PassResults = newPermPassResults;
            }
            if (teamDeadlineMs && performance.now() >= teamDeadlineMs) break;
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

      // Check all characters meet ER/CR constraints before accepting this permutation
      const permSheetsFinal = buildSheetsFromArtifacts(
        baseSheets,
        permArtifactsByChar
      );
      const permStats = effectiveTeamBuild.getTeamStats(
        permSheetsFinal,
        carryCharId,
        calcContext
      );
      let permConstraintsOk = true;
      for (const cid of allCharIds) {
        const cc = effectivePerChar[cid];
        if (!cc) continue;
        if (cc.minEr > 0) {
          const er = permStats[cid]?.get("er", null) ?? 0;
          if (er < cc.minEr - 1e-6) {
            permConstraintsOk = false;
            break;
          }
        }
        if (cc.minCr > 0) {
          const cr = permStats[cid]?.get("cr", null) ?? 0;
          if (cr < cc.minCr - 1e-6) {
            permConstraintsOk = false;
            break;
          }
        }
      }
      if (!permConstraintsOk) {
        if (teamDeadlineMs && performance.now() >= teamDeadlineMs) break;
        continue;
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
        buffOverrides
      );

      if (permScore > bestR1Score) {
        bestR1Score = permScore;
        bestR1ArtifactsByChar = permArtifactsByChar;
        bestR1PassResults = permPassResults;
      }
      if (teamDeadlineMs && performance.now() >= teamDeadlineMs) break;
    }
  }

  const _t2_phase3done = performance.now();
  if (LOG_DIAG) {
    console.log(
      `  [DIAG] Phase 1 (unlocked): ${((_t1_phase1done - _t0_phase1) / 1000).toFixed(1)}s`
    );
    console.log(
      `  [DIAG] Phase 3 (permutations): ${((_t2_phase3done - _t1_phase1done) / 1000).toFixed(1)}s | competitors: ${competitorSet.size}`
    );
  }

  // Phase 4: Carry round-2 — re-optimize carries with support artifacts locked

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
      passResults,
      undefined,
      undefined,
      charDeadline(carryCharIds.length - ci)
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
      const prevCarryArts = bestR1ArtifactsByChar[charId];
      bestR1ArtifactsByChar[charId] = lastResult.bestArtifacts;

      // Check if carry-2 broke team constraints (e.g. shifted team buffs
      // causing support ER to drift below threshold). Revert if so.
      const carry2Sheets = buildSheetsFromArtifacts(
        baseSheets,
        bestR1ArtifactsByChar
      );
      const carry2Stats = effectiveTeamBuild.getTeamStats(
        carry2Sheets,
        carryCharId,
        calcContext
      );
      let carry2ConstraintsOk = true;
      for (const cid of allCharIds) {
        const cc = effectivePerChar[cid];
        if (!cc) continue;
        if (cc.minEr > 0) {
          const er = carry2Stats[cid]?.get("er", null) ?? 0;
          if (er < cc.minEr - 1e-6) {
            carry2ConstraintsOk = false;
            break;
          }
        }
        if (cc.minCr > 0) {
          const cr = carry2Stats[cid]?.get("cr", null) ?? 0;
          if (cr < cc.minCr - 1e-6) {
            carry2ConstraintsOk = false;
            break;
          }
        }
      }

      if (!carry2ConstraintsOk) {
        bestR1ArtifactsByChar[charId] = prevCarryArts;
      } else {
        passResults.push({
          passId: "carry-2",
          charId,
          bestDamage: lastResult.bestDamage,
          bestArtifacts: lastResult.bestArtifacts,
          failReason: lastResult.failReason,
        });
      }

      // Lock this carry's (possibly reverted) artifacts for subsequent carries
      for (const id of collectArtifactIds(bestR1ArtifactsByChar[charId])) {
        carry2Excluded.add(id);
      }

      const pieces = allSlots
        .map((s) => bestR1ArtifactsByChar[charId][s])
        .filter((a): a is ArtifactData => a != null);
      currentSheets = {
        ...currentSheets,
        [charId]: StatSheet.fromArtifacts(pieces),
      };
    }
  }

  const _t3_phase4done = performance.now();
  if (LOG_DIAG) {
    console.log(
      `  [DIAG] Phase 4 (carry-2): ${((_t3_phase4done - _t2_phase3done) / 1000).toFixed(1)}s`
    );
    console.log(
      `  [DIAG] Total: ${((_t3_phase4done - _t0_phase1) / 1000).toFixed(1)}s`
    );
  }

  // Phase 5: Constraint repair — re-validate minEr/minCr after carry-2
  // Carry-2 re-optimization changes carry artifacts, which can shift team
  // buffs and cause support ER/CR to drift below thresholds. Re-optimize
  // any violating character with all other characters locked.

  {
    const repairSheets = buildSheetsFromArtifacts(
      baseSheets,
      bestR1ArtifactsByChar
    );
    const repairStats = effectiveTeamBuild.getTeamStats(
      repairSheets,
      carryCharId,
      calcContext
    );

    const violatingChars: { charId: string; kind: "er" | "cr" }[] = [];
    for (const charId of allCharIds) {
      const charConfig = effectivePerChar[charId];
      if (!charConfig) continue;
      if (charConfig.minEr > 0) {
        const er = repairStats[charId]?.get("er", null) ?? 0;
        if (er < charConfig.minEr - 1e-6) {
          violatingChars.push({ charId, kind: "er" });
        }
      }
      if (charConfig.minCr > 0) {
        const cr = repairStats[charId]?.get("cr", null) ?? 0;
        if (cr < charConfig.minCr - 1e-6) {
          violatingChars.push({ charId, kind: "cr" });
        }
      }
    }

    for (const { charId } of violatingChars) {
      // Lock all other characters' artifacts
      const repairExcluded = new Set<string>();
      for (const [cid, arts] of Object.entries(bestR1ArtifactsByChar)) {
        if (cid !== charId) {
          for (const id of collectArtifactIds(arts)) {
            repairExcluded.add(id);
          }
        }
      }

      const repairBaseSheets = buildSheetsFromArtifacts(
        baseSheets,
        bestR1ArtifactsByChar
      );
      const gen = runCharPass(
        charId,
        "carry-2", // reuse pass id — this is a constraint repair sub-pass
        repairBaseSheets,
        repairExcluded.size > 0 ? repairExcluded : undefined,
        estimatedTotal, // passIdx doesn't matter for final result
        estimatedTotal + 1,
        passResults,
        undefined,
        undefined,
        charDeadline(violatingChars.length)
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

      if (lastResult && lastResult.bestDamage > 0) {
        bestR1ArtifactsByChar[charId] = lastResult.bestArtifacts;
        passResults.push({
          passId: "carry-2",
          charId,
          bestDamage: lastResult.bestDamage,
          bestArtifacts: lastResult.bestArtifacts,
          failReason: lastResult.failReason,
        });
      }
    }
  }

  // Final result — detect accidental set bonuses and rebuild if needed

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

  let comboRes: ComboResult;
  try {
    comboRes = effectiveTeamBuild.getComboDamageResult(
      combo,
      finalSheets,
      calcContext,
      buffOverrides
    );
  } catch {
    comboRes = { lineDamages: [], totalDamage: 0 };
  }
  yield {
    ...resultBase,
    bestDamage: comboRes.totalDamage,
  } satisfies TeamOptimizationResult;
}
