/**
 * TopKCollector: maintains a sorted collection of the K best artifact builds.
 *
 * Uses binary-search insertion to keep entries sorted by damage (descending).
 * Provides a threshold (K-th best damage) for pruning in the B&B DFS.
 */

import type { DamageResult } from "../types";
import type { ArtifactTuple, TopKCollectorLike, TopKEntry } from "./types";

export class TopKCollector implements TopKCollectorLike {
  private entries: TopKEntry[] = [];
  threshold = Number.NEGATIVE_INFINITY;

  constructor(
    private k: number,
    initialThreshold?: number
  ) {
    if (initialThreshold !== undefined && initialThreshold > this.threshold) {
      this.threshold = initialThreshold;
    }
  }

  get best(): TopKEntry | undefined {
    return this.entries[0];
  }
  get size(): number {
    return this.entries.length;
  }
  get results(): TopKEntry[] {
    return this.entries;
  }

  add(
    damage: number,
    result: DamageResult | null,
    artifacts: ArtifactTuple
  ): boolean {
    if (damage <= 0) return false;
    if (this.entries.length >= this.k && damage <= this.threshold) return false;

    const artifactIds = new Set<string>();
    for (const a of artifacts) {
      if (a) artifactIds.add(a.id);
    }

    const entry: TopKEntry = {
      damage,
      result,
      artifacts: [...artifacts] as ArtifactTuple,
      artifactIds,
    };

    // Binary search for insert position (descending order)
    let lo = 0;
    let hi = this.entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.entries[mid].damage > damage) lo = mid + 1;
      else hi = mid;
    }
    this.entries.splice(lo, 0, entry);

    if (this.entries.length > this.k) this.entries.length = this.k;
    if (this.entries.length >= this.k) {
      this.threshold = this.entries[this.entries.length - 1].damage;
    }
    return true;
  }
}
