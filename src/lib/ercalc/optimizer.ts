import {
  BURST_ACTIONS,
  DIRECT_PARTICLE_ACTIONS,
  PATTERN_ACTIONS,
} from "./constants";
import { actionDuration, calculateTeamER } from "./erCalculator";
import type {
  EROptions,
  ERResult,
  ERTimeline,
  TeamMember,
  TimelineAction,
} from "./types";
import { weaponEnergyById } from "./weaponEnergy";

/** Objective for the optimizer's lexicographic score.
 *
 *  Without one the optimizer minimizes the anonymous descending ER vector,
 *  which discards character identity and will happily trade the carry's
 *  requirement away to shave a support. Supply this to protect a specific
 *  character and to declare what each character can realistically reach.
 */
export interface EROptimizerObjective {
  /** The carry / driver whose requirement is protected before any support's. */
  priorityCharId?: string;
  /** Per-character achievable ER% ceiling, keyed by charId. Overshoot past a
   *  cap is penalised before any individual requirement is compared. */
  caps?: Record<string, number>;
}

/** Scores a candidate timeline. Supplied by the caller so the optimizer ranks
 *  candidates with the exact function the results panel displays. */
export type ERScoreFn = (timeline: ERTimeline) => ERResult[];

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

/**
 * Remove an action, remapping — never dropping — the periodic procs pinned to
 * it. Procs are user-authored data that the caller persists to the team store
 * with no undo, so a removed node hands its procs to a surviving neighbour:
 * the following action when there is one (the proc still lands after the
 * mechanic that deployed it), otherwise the preceding action.
 *
 * Exported for testing — the greedy search reroutes around a data-losing edit,
 * so this invariant is not reliably observable through `optimizeWaitBlocks`.
 */
export function removeAction(ert: ERTimeline, index: number): ERTimeline {
  const actions = [
    ...ert.actions.slice(0, index),
    ...ert.actions.slice(index + 1),
  ];
  // Post-removal index of the neighbour that inherits the orphaned procs.
  const heir =
    actions.length === 0
      ? -1
      : index < actions.length
        ? index // the action that followed the removed one
        : actions.length - 1; // removed the tail — fall back to its predecessor
  const periodic = ert.periodic.flatMap((p) => {
    if (p.targetIndex === index) {
      return heir < 0 ? [] : [{ ...p, targetIndex: heir }];
    }
    return [
      p.targetIndex > index ? { ...p, targetIndex: p.targetIndex - 1 } : p,
    ];
  });
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

/** Relocate an action. The procs pinned to it travel with it and are re-pinned
 *  at the insertion index, so a relocation never changes the proc count.
 *  Exported for testing (see `removeAction`). */
export function moveAction(
  ert: ERTimeline,
  from: number,
  to: number
): ERTimeline {
  const action = ert.actions[from];
  const carried = ert.periodic.filter((p) => p.targetIndex === from);
  const withoutCarried: ERTimeline = {
    actions: ert.actions,
    periodic: ert.periodic.filter((p) => p.targetIndex !== from),
  };
  // Post-removal insertion point, clamped to the shortened action list so the
  // carried procs are re-pinned at the index the action actually lands on.
  const adjustedTo = Math.max(
    0,
    Math.min(to > from ? to - 1 : to, ert.actions.length - 1)
  );
  const moved = insertAction(
    removeAction(withoutCarried, from),
    adjustedTo,
    action
  );
  return {
    actions: moved.actions,
    periodic: [
      ...moved.periodic,
      ...carried.map((p) => ({ ...p, targetIndex: adjustedTo })),
    ],
  };
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

/**
 * Identity-aware score, compared lexicographically:
 *
 *   [ number of characters that cannot burst at all,
 *     total overshoot past each character's achievable cap,
 *     the priority character's requirement,
 *     the worst requirement among the others,
 *     the summed requirement of the others ]
 *
 * Infeasibility and overshoot lead so the search can escape unsolvable states
 * before it starts trading requirements. Non-finite requirements are counted
 * once in the first entry and excluded from the sums, so an unsolvable
 * character cannot flood the later entries into meaninglessness.
 */
export function scoreOfObjective(
  results: ERResult[],
  objective: EROptimizerObjective
): number[] {
  const caps = objective.caps ?? {};
  let infeasible = 0;
  let overshoot = 0;
  let priorityER = 0;
  let othersMax = 0;
  let othersSum = 0;

  for (const r of results) {
    const er = r.erNeeded;
    const finite = Number.isFinite(er);
    if (!finite) infeasible++;

    const cap = caps[r.characterId];
    if (finite && cap !== undefined && er > cap) overshoot += er - cap;

    if (
      objective.priorityCharId &&
      r.characterId === objective.priorityCharId
    ) {
      priorityER = er;
      continue;
    }
    if (finite) {
      othersMax = Math.max(othersMax, er);
      othersSum += er;
    }
  }

  return [infeasible, overshoot, priorityER, othersMax, othersSum];
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

/** Stable string identity of a timeline, used only to break ties between
 *  candidates that score identically. Keeps the chosen edit independent of
 *  enumeration order. */
function canonicalTimelineKey(ert: ERTimeline): string {
  const actions = ert.actions
    .map(
      (a) =>
        `${a.char}:${a.action}:${a.favoniusProc ? 1 : 0}:${
          a.reactionProc ? 1 : 0
        }:${a.orbCount ?? 0}:${a.orbElement ?? ""}:${
          a.energyGrants ? JSON.stringify(a.energyGrants) : ""
        }`
    )
    .join("|");
  const periodic = ert.periodic
    .map((p) => `${p.sourceChar}:${p.trigger}:${p.targetIndex}`)
    .sort()
    .join("|");
  return `${actions}#${periodic}`;
}

/**
 * Project a timeline onto the Favonius procs its cooldown actually permits.
 *
 * This is a *scoring* projection, not an edit: `favoniusProc` is a user-owned
 * flag (design doc §2.3) and the optimizer must never write it back. Candidate
 * timelines reorder actions, which changes which procs are legal in time, so
 * candidates are ranked on this projection while the returned timeline keeps
 * the flags the user authored.
 *
 * The selection is capped at `defaultProcsByRefinement` so a candidate cannot
 * be rewarded for procs the weapon data does not claim (padding waits would
 * otherwise stretch the synthetic clock into a free proc).
 */
export function alignFavoniusCDsForTeam(
  team: TeamMember[],
  timeline: ERTimeline
): ERTimeline {
  const actions = timeline.actions.map((a) => ({ ...a }));
  const times: number[] = [];
  let currentT = 0;
  for (const act of actions) {
    times.push(currentT);
    currentT += actionDuration(act.action);
  }
  const totalTime = currentT;

  for (const member of team) {
    if (!member.weaponId) continue;
    const we = weaponEnergyById[member.weaponId];
    if (we?.energy.effect !== "particles") continue;
    const refinement = member.refinement ?? 4;
    const cd = we.energy.cooldown[refinement];
    const maxProcs = we.energy.defaultProcsByRefinement[refinement] ?? 0;

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
    if (maxProcs > 0) {
      for (let start = 0; start < eligibleIndices.length; start++) {
        const selection: number[] = [eligibleIndices[start]];
        let lastTime = times[eligibleIndices[start]];

        for (
          let j = start + 1;
          j < eligibleIndices.length + start && selection.length < maxProcs;
          j++
        ) {
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
    }

    for (const idx of eligibleIndices) {
      actions[idx].favoniusProc = bestSelection.includes(idx);
    }
  }

  return { ...timeline, actions };
}

/**
 * Find optimal wait block insertions to minimize the team ER requirement.
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
 * Each iteration also tries removing existing waits, swapping E↔Q for the same
 * char, and relocating skill casts. Greedy: pick the edit that improves the
 * score the most; stop when no edit improves.
 *
 * @param scoreFn   Evaluates a timeline. Defaults to `calculateTeamER` with
 *                  `options`; pass the panel's own evaluator so the optimizer
 *                  ranks candidates by the number the user is shown.
 * @param objective Switches the score from anonymous team minimax to the
 *                  identity-aware vector in `scoreOfObjective`. Omit to keep
 *                  the historical behaviour.
 */
export function optimizeWaitBlocks(
  team: TeamMember[],
  timeline: ERTimeline,
  options?: EROptions,
  scoreFn?: ERScoreFn,
  objective?: EROptimizerObjective
): { timeline: ERTimeline; results: ERResult[]; insertedWaits: number } {
  const evaluate: ERScoreFn = scoreFn
    ? scoreFn
    : (t) => calculateTeamER(team, t, options);
  const scoreVector = (results: ERResult[]): number[] =>
    objective ? scoreOfObjective(results, objective) : scoreOf(results);

  // Favonius alignment is a legality projection applied to candidates only —
  // never to the timeline we hand back. Skip it entirely when nobody in the
  // team wields a particle-generating weapon.
  const needsFavoniusAlignment = team.some((m) => {
    const we = m.weaponId ? weaponEnergyById[m.weaponId] : undefined;
    return we?.energy.effect === "particles";
  });
  const rank = (
    t: ERTimeline
  ): { results: ERResult[]; score: number[]; maxER: number } => {
    const results = evaluate(
      needsFavoniusAlignment ? alignFavoniusCDsForTeam(team, t) : t
    );
    const maxER = results.reduce((m, r) => Math.max(m, r.erNeeded), 0);
    return { results, score: scoreVector(results), maxER };
  };

  let current = timeline;
  let ranked = rank(current);
  let insertedWaits = 0;

  const maxIterations = 30;

  for (let iter = 0; iter < maxIterations; iter++) {
    // An unsolvable character (Infinity) is exactly when the user needs help,
    // and `scoreLess` already discriminates lexicographically on the remaining
    // entries when both maxima are Infinity — so keep optimizing.
    if (ranked.maxER <= 100) break;

    let bestTimeline: ERTimeline | null = null;
    let bestScore = ranked.score;
    let bestRanked = ranked;
    let bestKey = "";

    const tryCandidate = (candidate: ERTimeline) => {
      const candidateRanked = rank(candidate);
      if (scoreLess(candidateRanked.score, bestScore)) {
        bestScore = candidateRanked.score;
        bestTimeline = candidate;
        bestRanked = candidateRanked;
        bestKey = objective ? canonicalTimelineKey(candidate) : "";
        return;
      }
      // Deterministic tie-break between equally-good improving candidates.
      // Only on the objective path, so the legacy path keeps its
      // first-improvement choice unchanged.
      if (!objective || bestTimeline === null) return;
      if (scoreLess(bestScore, candidateRanked.score)) return;
      const key = canonicalTimelineKey(candidate);
      if (key < bestKey) {
        bestTimeline = candidate;
        bestRanked = candidateRanked;
        bestKey = key;
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

    if (!bestTimeline) break;
    current = bestTimeline;
    ranked = bestRanked;
    insertedWaits++;
  }

  // With no Favonius wielder the ranking projection *is* the timeline, so the
  // ranked results already describe exactly what we hand back.
  if (!needsFavoniusAlignment) {
    return { timeline: current, results: ranked.results, insertedWaits };
  }
  if (current === timeline) {
    return { timeline, results: evaluate(timeline), insertedWaits: 0 };
  }

  // Report the requirement of the timeline we actually hand back — the user's
  // own Favonius flags, not the projection the search ranked on. If the two
  // disagree badly enough that the edits are a regression, keep the user's
  // rotation: "Auto Optimize" must never make the displayed numbers worse.
  const finalResults = evaluate(current);
  const baselineResults = evaluate(timeline);
  if (scoreLess(scoreVector(baselineResults), scoreVector(finalResults))) {
    return { timeline, results: baselineResults, insertedWaits: 0 };
  }
  return { timeline: current, results: finalResults, insertedWaits };
}
