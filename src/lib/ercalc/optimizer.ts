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

/**
 * Find optimal wait block insertions to minimize the maximum team ER requirement.
 *
 * A wait block after a particle-producing action causes the producing character
 * to self-absorb their particles (on-field, same-element bonus).
 *
 * Uses greedy search: iteratively pick the edit (insert wait / remove wait /
 * swap E↔Q) that reduces max team ER the most. Stops when no edit improves.
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
    const currentMaxER = Math.max(...currentResults.map((r) => r.erNeeded));
    if (currentMaxER <= 100 || currentMaxER === Number.POSITIVE_INFINITY) break;

    let bestTimeline: ERTimeline | null = null;
    let bestMaxER = currentMaxER;
    let bestResults: ERResult[] | null = null;

    // Try inserting a wait after each particle-producing action
    for (let i = 0; i < current.actions.length; i++) {
      const act = current.actions[i];
      if (!producesParticles(act)) continue;

      if (
        i + 1 < current.actions.length &&
        current.actions[i + 1].action === "wait" &&
        current.actions[i + 1].char === act.char
      )
        continue;

      const candidate = insertAction(current, i + 1, {
        char: act.char,
        action: "wait",
      });
      const candidateResults = calculateTeamER(team, candidate, options);
      const candidateMaxER = Math.max(
        ...candidateResults.map((r) => r.erNeeded)
      );

      if (candidateMaxER < bestMaxER) {
        bestMaxER = candidateMaxER;
        bestTimeline = candidate;
        bestResults = candidateResults;
      }
    }

    // Try removing existing wait blocks
    for (let i = 0; i < current.actions.length; i++) {
      if (current.actions[i].action !== "wait") continue;
      const candidate = removeAction(current, i);
      const candidateResults = calculateTeamER(team, candidate, options);
      const candidateMaxER = Math.max(
        ...candidateResults.map((r) => r.erNeeded)
      );
      if (candidateMaxER < bestMaxER) {
        bestMaxER = candidateMaxER;
        bestTimeline = candidate;
        bestResults = candidateResults;
      }
    }

    // Try swapping adjacent E↔Q for same char
    for (let i = 0; i < current.actions.length - 1; i++) {
      const a = current.actions[i];
      const b = current.actions[i + 1];
      if (
        producesParticles(a) &&
        BURST_ACTIONS.has(b.action) &&
        a.char === b.char
      ) {
        const candidate = swapAdjacent(current, i);
        const candidateResults = calculateTeamER(team, candidate, options);
        const candidateMaxER = Math.max(
          ...candidateResults.map((r) => r.erNeeded)
        );
        if (candidateMaxER < bestMaxER) {
          bestMaxER = candidateMaxER;
          bestTimeline = candidate;
          bestResults = candidateResults;
        }
      }
    }

    if (!bestTimeline || !bestResults) break;
    current = bestTimeline;
    currentResults = bestResults;
    insertedWaits++;
  }

  return { timeline: current, results: currentResults, insertedWaits };
}
