/**
 * Cross-character column packer: pick one build ("column") per character such
 * that artifact IDs are pairwise disjoint, maximizing total score.
 *
 * Pure DFS-with-pruning. Each character contributes a precomputed list of
 * top-K feasible builds (sorted score-descending). Per-character feasibility
 * (set composition, CR cap, main stat) is already baked into the column list;
 * the packer only enforces artifact uniqueness across characters.
 */

export interface PackerColumn {
  /** Artifact IDs used by this column. Length 5 in the normal case. */
  artifactIds: string[];
  /** Total build score for this column. */
  score: number;
  /** Optional opaque payload echoed back in the result (e.g. the OptimizedBuild). */
  payload?: unknown;
}

export interface PackerCharacter {
  /** Stable character key, only used for the result map. */
  characterId: string;
  /** Top-K columns, score-descending. May be empty (no feasible build). */
  columns: PackerColumn[];
}

export interface PackerAssignment {
  /** Per-character chosen column, or null if no column was assigned (skipped). */
  byCharacter: Record<string, PackerColumn | null>;
  /** Sum of chosen column scores. */
  totalScore: number;
  /** Diagnostics. */
  nodesExplored: number;
}

export interface BeamPackOptions {
  beamWidth?: number;
  repairSweeps?: number;
}

/**
 * Solve the disjoint column-packing problem exactly within the provided columns.
 *
 * Optimality is over the *given column lists*: if a strictly better assignment
 * exists using a build that wasn't in any character's top-K, we won't find it.
 * Increase K (in the per-character enumerator) to widen the search.
 *
 * Skipping a character is allowed (produces null in byCharacter). In practice,
 * skips are always forced — the packer wants to assign everyone because any
 * positive column score beats the skip's 0. A skip means no column in that
 * char's K-list is non-conflicting with earlier picks. The caller should
 * re-enumerate columns for skipped chars from the post-packer leftover pool
 * and run a second packer pass on them.
 */
export function packColumns(chars: PackerCharacter[]): PackerAssignment {
  // Sort characters by descending top-1 score: decide hardest-to-satisfy first
  // so the score upper bound shrinks fast and pruning bites earlier.
  const ordered = [...chars].sort((a, b) => {
    const aTop = a.columns[0]?.score ?? 0;
    const bTop = b.columns[0]?.score ?? 0;
    return bTop - aTop;
  });

  const n = ordered.length;
  const chosen: (PackerColumn | null)[] = new Array(n).fill(null);
  let bestChosen: (PackerColumn | null)[] = new Array(n).fill(null);
  let bestScore = Number.NEGATIVE_INFINITY;
  let nodesExplored = 0;
  const claimed = new Set<string>();

  /** Best non-conflicting column score for char at index i, given current claims. */
  function bestRemainingFor(i: number): number {
    const cols = ordered[i].columns;
    for (const col of cols) {
      if (!conflicts(col, claimed)) return col.score;
    }
    return 0;
  }

  function dfs(idx: number, scoreSoFar: number): void {
    nodesExplored++;

    if (idx === n) {
      if (scoreSoFar > bestScore) {
        bestScore = scoreSoFar;
        bestChosen = chosen.slice();
      }
      return;
    }

    // Upper bound: scoreSoFar + sum of best non-conflicting column for each
    // remaining char, ignoring future cross-char disjointness (admissible).
    let upperBound = scoreSoFar;
    for (let j = idx; j < n; j++) {
      upperBound += bestRemainingFor(j);
    }
    if (upperBound <= bestScore) return;

    const cols = ordered[idx].columns;

    for (const col of cols) {
      if (conflicts(col, claimed)) continue;

      // Claim this column's artifacts
      for (const id of col.artifactIds) claimed.add(id);
      chosen[idx] = col;
      dfs(idx + 1, scoreSoFar + col.score);
      chosen[idx] = null;
      for (const id of col.artifactIds) claimed.delete(id);
    }

    // Skip branch — assign nothing to this character. score += 0. The packer
    // only lands here when no non-conflicting column exists (because any
    // positive column score beats 0), so skips are effectively forced.
    chosen[idx] = null;
    dfs(idx + 1, scoreSoFar);
    chosen[idx] = null;
  }

  dfs(0, 0);

  const byCharacter: Record<string, PackerColumn | null> = {};
  for (let i = 0; i < n; i++) {
    byCharacter[ordered[i].characterId] = bestChosen[i];
  }

  return {
    byCharacter,
    totalScore: bestScore === Number.NEGATIVE_INFINITY ? 0 : bestScore,
    nodesExplored,
  };
}

function conflicts(col: PackerColumn, claimed: Set<string>): boolean {
  for (const id of col.artifactIds) {
    if (claimed.has(id)) return true;
  }
  return false;
}

/**
 * Bounded column packer for production-sized tiers. It is approximate, but its
 * cost scales with `characters × beamWidth × columns` instead of the exact
 * DFS product of every character's column list.
 */
export function packColumnsBeam(
  chars: PackerCharacter[],
  options: BeamPackOptions = {}
): PackerAssignment {
  if (chars.length === 0) {
    return { byCharacter: {}, totalScore: 0, nodesExplored: 0 };
  }

  const beamWidth = options.beamWidth ?? 1024;
  const repairSweeps = options.repairSweeps ?? 2;
  const ordered = [...chars].sort(compareCharacterDifficulty);
  const n = ordered.length;
  const bestSuffix = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    bestSuffix[i] = bestSuffix[i + 1] + (ordered[i].columns[0]?.score ?? 0);
  }

  type BeamState = {
    chosen: (PackerColumn | null)[];
    claimed: Set<string>;
    score: number;
  };

  let nodesExplored = 0;
  let beam: BeamState[] = [
    { chosen: new Array(n).fill(null), claimed: new Set(), score: 0 },
  ];

  for (let idx = 0; idx < n; idx++) {
    const next: BeamState[] = [];
    const cols = ordered[idx].columns;

    for (const state of beam) {
      let assignedAny = false;
      for (const col of cols) {
        nodesExplored++;
        if (conflicts(col, state.claimed)) continue;
        assignedAny = true;
        const claimed = new Set(state.claimed);
        for (const id of col.artifactIds) claimed.add(id);
        const chosen = state.chosen.slice();
        chosen[idx] = col;
        next.push({ chosen, claimed, score: state.score + col.score });
      }

      if (!assignedAny || cols.length === 0) {
        const chosen = state.chosen.slice();
        chosen[idx] = null;
        next.push({
          chosen,
          claimed: new Set(state.claimed),
          score: state.score,
        });
      }
    }

    next.sort(
      (a, b) =>
        b.score + bestSuffix[idx + 1] - (a.score + bestSuffix[idx + 1]) ||
        assignedCount(b.chosen) - assignedCount(a.chosen)
    );
    beam = next.slice(0, beamWidth);
  }

  let best = beam[0] ?? {
    chosen: new Array(n).fill(null),
    claimed: new Set<string>(),
    score: 0,
  };
  for (const state of beam) {
    if (
      state.score > best.score ||
      (state.score === best.score &&
        assignedCount(state.chosen) > assignedCount(best.chosen))
    ) {
      best = state;
    }
  }

  let chosen = best.chosen.slice();
  for (let sweep = 0; sweep < repairSweeps; sweep++) {
    const before = scoreChosen(chosen);
    chosen = repairSingles(ordered, chosen);
    chosen = repairPairs(ordered, chosen);
    if (scoreChosen(chosen) <= before) break;
  }

  const byCharacter: Record<string, PackerColumn | null> = {};
  for (let i = 0; i < n; i++) {
    byCharacter[ordered[i].characterId] = chosen[i];
  }

  return {
    byCharacter,
    totalScore: scoreChosen(chosen),
    nodesExplored,
  };
}

function compareCharacterDifficulty(a: PackerCharacter, b: PackerCharacter) {
  const aTop = a.columns[0]?.score ?? 0;
  const bTop = b.columns[0]?.score ?? 0;
  const aSpread =
    aTop - (a.columns[Math.min(4, a.columns.length - 1)]?.score ?? 0);
  const bSpread =
    bTop - (b.columns[Math.min(4, b.columns.length - 1)]?.score ?? 0);
  return bSpread - aSpread || bTop - aTop;
}

function assignedCount(chosen: (PackerColumn | null)[]): number {
  return chosen.reduce((n, col) => n + (col ? 1 : 0), 0);
}

function scoreChosen(chosen: (PackerColumn | null)[]): number {
  return chosen.reduce((sum, col) => sum + (col?.score ?? 0), 0);
}

function claimedExcept(
  chosen: (PackerColumn | null)[],
  except: Set<number>
): Set<string> {
  const claimed = new Set<string>();
  for (let i = 0; i < chosen.length; i++) {
    if (except.has(i)) continue;
    const col = chosen[i];
    if (!col) continue;
    for (const id of col.artifactIds) claimed.add(id);
  }
  return claimed;
}

function repairSingles(
  chars: PackerCharacter[],
  chosen: (PackerColumn | null)[]
): (PackerColumn | null)[] {
  const next = chosen.slice();
  for (let i = 0; i < chars.length; i++) {
    const claimed = claimedExcept(next, new Set([i]));
    const currentScore = next[i]?.score ?? 0;
    let best = next[i];
    for (const col of chars[i].columns) {
      if (conflicts(col, claimed)) continue;
      if (col.score > currentScore && (!best || col.score > best.score)) {
        best = col;
      }
    }
    next[i] = best;
  }
  return next;
}

function repairPairs(
  chars: PackerCharacter[],
  chosen: (PackerColumn | null)[]
): (PackerColumn | null)[] {
  const next = chosen.slice();
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const claimed = claimedExcept(next, new Set([i, j]));
      const currentScore = (next[i]?.score ?? 0) + (next[j]?.score ?? 0);
      let bestA = next[i];
      let bestB = next[j];
      let bestScore = currentScore;

      for (const a of chars[i].columns) {
        if (conflicts(a, claimed)) continue;
        const claimedWithA = new Set(claimed);
        for (const id of a.artifactIds) claimedWithA.add(id);
        for (const b of chars[j].columns) {
          if (conflicts(b, claimedWithA)) continue;
          const score = a.score + b.score;
          if (score > bestScore) {
            bestScore = score;
            bestA = a;
            bestB = b;
          }
        }
      }

      if (bestScore > currentScore) {
        next[i] = bestA;
        next[j] = bestB;
      }
    }
  }
  return next;
}
