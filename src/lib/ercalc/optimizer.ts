import {
  type ActionType,
  type EROptions,
  type ERResult,
  type TeamMember,
  type Timeline,
  calculateTeamER,
} from "./erCalculator";

const PARTICLE_ACTIONS = new Set<ActionType>(["E", "holdE", "periodicE"]);
const BURST_ACTIONS = new Set<ActionType>(["Q", "specialQ"]);

/**
 * Find optimal wait block insertions to minimize the maximum team ER requirement.
 *
 * A wait block after a particle-producing action causes the producing character
 * to self-absorb their particles (on-field, same-element bonus). Without a wait,
 * particles go to the next action's character.
 *
 * Uses greedy search: iteratively insert the wait that reduces max team ER the most.
 * Stops when no insertion improves the result.
 *
 * @returns The optimized timeline with wait blocks inserted, plus the ER results.
 */
export function optimizeWaitBlocks(
  team: TeamMember[],
  timeline: Timeline,
  options?: EROptions
): { timeline: Timeline; results: ERResult[]; insertedWaits: number } {
  let currentTimeline = [...timeline];
  let currentResults = calculateTeamER(team, currentTimeline, options);
  let insertedWaits = 0;

  const maxIterations = 20; // Safety limit

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentMaxER = Math.max(...currentResults.map((r) => r.erNeeded));
    if (currentMaxER <= 100 || currentMaxER === Number.POSITIVE_INFINITY) break;

    let bestTimeline: Timeline | null = null;
    let bestMaxER = currentMaxER;
    let bestResults: ERResult[] | null = null;

    // Try inserting a wait after each particle-producing action
    for (let i = 0; i < currentTimeline.length; i++) {
      const act = currentTimeline[i];
      if (!PARTICLE_ACTIONS.has(act.action)) continue;

      // Skip if already followed by a wait from the same character
      if (
        i + 1 < currentTimeline.length &&
        currentTimeline[i + 1].action === "wait" &&
        currentTimeline[i + 1].char === act.char
      ) {
        continue;
      }

      // Try inserting wait
      const candidate: Timeline = [
        ...currentTimeline.slice(0, i + 1),
        { char: act.char, action: "wait" as ActionType },
        ...currentTimeline.slice(i + 1),
      ];

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

    // Also try REMOVING existing wait blocks
    for (let i = 0; i < currentTimeline.length; i++) {
      if (currentTimeline[i].action !== "wait") continue;

      const candidate = [
        ...currentTimeline.slice(0, i),
        ...currentTimeline.slice(i + 1),
      ];

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

    // Also try swapping adjacent E→Q to Q→E for same character
    // This models "burst first if energy is full" — particles go to next window
    for (let i = 0; i < currentTimeline.length - 1; i++) {
      const act = currentTimeline[i];
      const next = currentTimeline[i + 1];

      if (
        PARTICLE_ACTIONS.has(act.action) &&
        BURST_ACTIONS.has(next.action) &&
        act.char === next.char
      ) {
        // Try swapping: Q first, then E
        const candidate = [...currentTimeline];
        candidate[i] = next;
        candidate[i + 1] = act;

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

    // No improvement found — stop
    if (!bestTimeline || !bestResults) break;

    currentTimeline = bestTimeline;
    currentResults = bestResults;
    insertedWaits++;
  }

  return {
    timeline: currentTimeline,
    results: currentResults,
    insertedWaits,
  };
}
