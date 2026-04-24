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
