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
import { weaponEnergyById } from "./weaponEnergy";

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
function moveAction(ert: ERTimeline, from: number, to: number): ERTimeline {
  const action = ert.actions[from];
  const nextERT = removeAction(ert, from);
  const adjustedTo = to > from ? to - 1 : to;
  return insertAction(nextERT, adjustedTo, action);
}

export function alignFavoniusCDsForTeam(
  team: TeamMember[],
  timeline: ERTimeline
): ERTimeline {
  const actions = timeline.actions.map((a) => ({ ...a }));
  const times: number[] = [];
  let currentT = 0;
  for (const act of actions) {
    times.push(currentT);
    let duration = 0.5;
    if (act.action === "Q" || act.action === "specialQ") duration = 1.5;
    else if (
      act.action === "E" ||
      act.action === "holdE" ||
      act.action === "specialE"
    )
      duration = 1.0;
    else if (act.action === "wait") duration = 1.0;
    currentT += duration;
  }
  const totalTime = currentT;

  for (const member of team) {
    if (!member.weaponId) continue;
    const we = weaponEnergyById[member.weaponId];
    if (!we || we.energy.effect !== "particles") continue;
    const cd = we.energy.cooldown[member.refinement ?? 4];

    const eligibleIndices: number[] = [];
    for (let idx = 0; idx < actions.length; idx++) {
      const act = actions[idx];
      if (
        act.char === member.id &&
        (act.action === "E" ||
          act.action === "holdE" ||
          act.action === "specialE" ||
          act.action === "Q")
      ) {
        eligibleIndices.push(idx);
      }
    }

    if (eligibleIndices.length === 0) continue;

    let bestSelection: number[] = [];
    for (let start = 0; start < eligibleIndices.length; start++) {
      const selection: number[] = [eligibleIndices[start]];
      let lastTime = times[eligibleIndices[start]];

      for (let j = start + 1; j < eligibleIndices.length + start; j++) {
        const idx = eligibleIndices[j % eligibleIndices.length];
        const tVal = times[idx];
        let diff = tVal - lastTime;
        if (diff < 0) {
          diff += totalTime;
        }

        if (diff >= cd) {
          selection.push(idx);
          lastTime = tVal;
        }
      }

      if (selection.length > bestSelection.length) {
        bestSelection = selection;
      }
    }

    for (const idx of eligibleIndices) {
      actions[idx].favoniusProc = bestSelection.includes(idx);
    }
  }

  return { ...timeline, actions };
}

export function optimizeWaitBlocks(
  team: TeamMember[],
  timeline: ERTimeline,
  options?: EROptions
): { timeline: ERTimeline; results: ERResult[]; insertedWaits: number } {
  // First, align Favonius CDs for the starting timeline
  let current = alignFavoniusCDsForTeam(team, timeline);
  let currentResults = calculateTeamER(team, current, options);
  let insertedWaits = 0;

  const maxIterations = 30;

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentScore = scoreOf(currentResults);
    const currentMax = currentScore[0] ?? 0;
    if (currentMax <= 100 || currentMax === Number.POSITIVE_INFINITY) break;

    let bestTimeline: ERTimeline | null = null;
    let bestScore = currentScore;
    let bestResults: ERResult[] | null = null;

    const tryCandidate = (candidate: ERTimeline) => {
      // Re-align Favonius CDs for any candidate timeline edit
      const alignedCandidate = alignFavoniusCDsForTeam(team, candidate);
      const candidateResults = calculateTeamER(team, alignedCandidate, options);
      const candidateScore = scoreOf(candidateResults);
      if (scoreLess(candidateScore, bestScore)) {
        bestScore = candidateScore;
        bestTimeline = alignedCandidate;
        bestResults = candidateResults;
      }
    };

    // 1. Try wait insertions at particle-producing edges
    for (let i = 0; i < current.actions.length; i++) {
      const act = current.actions[i];
      if (!producesParticles(act)) continue;
      const next = current.actions[i + 1];
      if (!next) continue;
      if (next.action === "wait") continue;

      if (next.char !== act.char) {
        tryCandidate(
          insertAction(current, i + 1, { char: act.char, action: "wait" })
        );
      }

      if (BURST_ACTIONS.has(next.action) && next.char !== act.char) {
        tryCandidate(
          insertAction(current, i + 1, { char: next.char, action: "wait" })
        );
      }
    }

    // 2. Try wait pruning (removing existing wait blocks)
    for (let i = 0; i < current.actions.length; i++) {
      if (current.actions[i].action !== "wait") continue;
      tryCandidate(removeAction(current, i));
    }

    // 3. Try E <-> Q swaps for the same character
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

    // 4. Try reordering: Move E skill casts to another index (preserving Q order)
    for (let i = 0; i < current.actions.length; i++) {
      const act = current.actions[i];
      const isSkill =
        act.action === "E" ||
        act.action === "holdE" ||
        act.action === "specialE";
      if (!isSkill) continue;

      for (let j = 0; j <= current.actions.length; j++) {
        if (i === j || i + 1 === j) continue;
        tryCandidate(moveAction(current, i, j));
      }
    }

    if (!bestTimeline || !bestResults) break;
    current = bestTimeline;
    currentResults = bestResults;
    insertedWaits++;
  }

  return { timeline: current, results: currentResults, insertedWaits };
}
