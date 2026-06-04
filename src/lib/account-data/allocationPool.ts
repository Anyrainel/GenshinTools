/**
 * Builds per-slot candidate lists for the allocation pass.
 *
 * The allocation pass treats every artifact as-is (no projection to max level),
 * applies no main-stat hard filter (soft scoring handles wrong-main-stat),
 * and applies no tier-rank stealing gate (uniqueness is enforced by the
 * cross-tier waterfall, not per-candidate).
 *
 * The upgrade pass (separate module) is what reasons about upgrade actions.
 */
import { allSlots, type Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import type { CandidateArtifact } from "./candidatePool";

/**
 * Build per-slot candidate lists from an unclaimed artifact pool. The
 * character's currently equipped artifacts are still included when they remain
 * unclaimed, but already-claimed equipped artifacts are not reintroduced.
 *
 * @param char         Character whose pool we're building.
 * @param pool         Unclaimed artifacts (excluding ones already locked by
 *                     higher-tier characters in the waterfall).
 */
export function buildAllocationPool(
  char: { key: string; artifacts: Partial<Record<Slot, ArtifactData>> },
  pool: ArtifactData[],
  protectedArtifactIds: ReadonlySet<string> = new Set()
): Record<Slot, CandidateArtifact[]> {
  const result = {} as Record<Slot, CandidateArtifact[]>;
  const equipped = char.artifacts;
  const poolIds = new Set(pool.map((a) => a.id));
  const equippedIds = new Set<string>();
  for (const slot of allSlots) {
    const e = equipped[slot];
    if (e) equippedIds.add(e.id);
  }

  for (const slot of allSlots) {
    const candidates: CandidateArtifact[] = [];

    // The character's currently equipped artifact is available only while it
    // remains unclaimed in the waterfall pool.
    const e = equipped[slot];
    if (e && poolIds.has(e.id)) {
      candidates.push({
        ...e,
        source: "current",
        sourceArtifactId: e.id,
      });
    }

    for (const art of pool) {
      if (art.slotKey !== slot) continue;
      if (protectedArtifactIds.has(art.id)) continue;
      if (equippedIds.has(art.id)) continue; // skip duplicates from equipped
      candidates.push({
        ...art,
        source: "swap",
        sourceArtifactId: art.id,
      });
    }

    result[slot] = candidates;
  }

  return result;
}
