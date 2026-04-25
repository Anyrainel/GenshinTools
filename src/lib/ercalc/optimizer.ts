import {
  BURST_ACTIONS,
  DIRECT_PARTICLE_ACTIONS,
  PATTERN_ACTIONS,
} from "./constants";
import { calculateTeamER } from "./erCalculator";
import type {
  EROptions,
  ERResult,
  ERTimeline,
  TeamMember,
  TimelineAction,
} from "./types";

// ─── ERTimeline edit helpers (keep periodic targetIndex consistent) ───

function insertAction(
  ert: ERTimeline,
  index: number,
  action: TimelineAction
): ERTimeline {
  const actions = [
    ...ert.actions.slice(0, index),
    action,
    ...ert.actions.slice(index),
  ];
  const periodic = ert.periodic.map((p) =>
    p.targetIndex >= index ? { ...p, targetIndex: p.targetIndex + 1 } : p
  );
  return { actions, periodic };
}

function removeAction(ert: ERTimeline, index: number): ERTimeline {
  const actions = [
    ...ert.actions.slice(0, index),
    ...ert.actions.slice(index + 1),
  ];
  const periodic = ert.periodic
    .filter((p) => p.targetIndex !== index)
    .map((p) =>
      p.targetIndex > index ? { ...p, targetIndex: p.targetIndex - 1 } : p
    );
  return { actions, periodic };
}

function swapAdjacent(ert: ERTimeline, i: number): ERTimeline {
  const actions = [...ert.actions];
  [actions[i], actions[i + 1]] = [actions[i + 1], actions[i]];
  const periodic = ert.periodic.map((p) => {
    if (p.targetIndex === i) return { ...p, targetIndex: i + 1 };
    if (p.targetIndex === i + 1) return { ...p, targetIndex: i };
    return p;
  });
  return { actions, periodic };
}

/** Does this action produce particles (for optimizer targeting)? */
function producesParticles(act: TimelineAction): boolean {
  return (
    DIRECT_PARTICLE_ACTIONS.has(act.action) ||
    PATTERN_ACTIONS.has(act.action) ||
    !!act.favoniusProc
  );
}

/** Score = ER values sorted descending. Compared lexicographically so the
 *  optimizer minimizes max ER first, then second-highest, then third, etc.
 *  Exported for testing the ordering behavior in isolation. */
export function scoreOf(results: ERResult[]): number[] {
  return results.map((r) => r.erNeeded).sort((a, b) => b - a);
}

/** Returns true if `a` is strictly better (lexicographically smaller) than `b`.
 *  Exported for testing. */
export function scoreLess(a: number[], b: number[]): boolean {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

/**
 * Find optimal wait block insertions to minimize the team ER requirement vector,
 * lexicographically: minimize max ER first, then second-highest, then third, ...
 *
 * For each particle-producing edge (a particle-producing action immediately
 * followed by another action), exactly two wait insertions are enumerated:
 *
 *   (a) wait owned by the producer char — "don't switch yet, absorb then switch".
 *       Skipped when next.char === producer.char (no field switch ⇒ no point).
 *   (b) wait owned by the next char — "don't cast Q yet, absorb then cast".
 *       Skipped when next.action is not Q/specialQ (otherwise no point in
 *       coming on early).
 *
 * Each iteration also tries removing existing waits and swapping E↔Q for the
 * same char. Greedy: pick the edit that improves the score the most; stop
 * when no edit improves.
 */
export function optimizeWaitBlocks(
  team: TeamMember[],
  timeline: ERTimeline,
  options?: EROptions
): { timeline: ERTimeline; results: ERResult[]; insertedWaits: number } {
  let current = timeline;
  let currentResults = calculateTeamER(team, current, options);
  let insertedWaits = 0;

  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentScore = scoreOf(currentResults);
    const currentMax = currentScore[0] ?? 0;
    // 100 is the floor (non-bursters report 100); ∞ means unsolvable.
    if (currentMax <= 100 || currentMax === Number.POSITIVE_INFINITY) break;

    let bestTimeline: ERTimeline | null = null;
    let bestScore = currentScore;
    let bestResults: ERResult[] | null = null;

    const tryCandidate = (candidate: ERTimeline) => {
      const candidateResults = calculateTeamER(team, candidate, options);
      const candidateScore = scoreOf(candidateResults);
      if (scoreLess(candidateScore, bestScore)) {
        bestScore = candidateScore;
        bestTimeline = candidate;
        bestResults = candidateResults;
      }
    };

    // Per particle-producing edge, enumerate wait-by-producer and wait-by-next.
    for (let i = 0; i < current.actions.length; i++) {
      const act = current.actions[i];
      if (!producesParticles(act)) continue;
      const next = current.actions[i + 1];
      if (!next) continue;
      // Already padded with a wait at this edge — leave it to the remove pass.
      if (next.action === "wait") continue;

      // (a) Wait owned by producer — invalid when next is the same char.
      if (next.char !== act.char) {
        tryCandidate(
          insertAction(current, i + 1, { char: act.char, action: "wait" })
        );
      }

      // (b) Wait owned by next char — only when next is energy-consuming (Q/specialQ).
      if (BURST_ACTIONS.has(next.action) && next.char !== act.char) {
        tryCandidate(
          insertAction(current, i + 1, { char: next.char, action: "wait" })
        );
      }
    }

    // Try removing existing wait blocks (pruning unhelpful waits).
    for (let i = 0; i < current.actions.length; i++) {
      if (current.actions[i].action !== "wait") continue;
      tryCandidate(removeAction(current, i));
    }

    // Try swapping adjacent E↔Q for the same char.
    for (let i = 0; i < current.actions.length - 1; i++) {
      const a = current.actions[i];
      const b = current.actions[i + 1];
      if (
        producesParticles(a) &&
        BURST_ACTIONS.has(b.action) &&
        a.char === b.char
      ) {
        tryCandidate(swapAdjacent(current, i));
      }
    }

    if (!bestTimeline || !bestResults) break;
    current = bestTimeline;
    currentResults = bestResults;
    insertedWaits++;
  }

  return { timeline: current, results: currentResults, insertedWaits };
}
