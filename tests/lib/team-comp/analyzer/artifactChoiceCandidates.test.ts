import { describe, expect, it } from "vitest";
import { TIER_LIST_OTHER_ARTIFACT_SETS } from "@/data/constants";
import { artifactHalfSetsById, artifactsById } from "@/data/gameResources";
import {
  buildArtifactSetChoiceCandidates,
  buildTwoPieceArtifactChoiceCandidates,
} from "@/lib/team-comp/analyzer/weaponChoice";

describe("buildArtifactSetChoiceCandidates", () => {
  it("enumerates 5-star 4pc sets and excludes tier-list Other Set entries", () => {
    const candidates = buildArtifactSetChoiceCandidates();
    const setIds = candidates.flatMap((candidate) =>
      candidate.artifactSet.type === "4pc" ? [candidate.artifactSet.setId] : []
    );

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.type).toBe("artifact");
      // 2+2 candidates will be added later; current enumeration is 4pc-only.
      expect(candidate.artifactSet.type).toBe("4pc");
      if (candidate.artifactSet.type !== "4pc") continue;
      expect(artifactsById[candidate.artifactSet.setId]?.rarity).toBe(5);
      expect(
        TIER_LIST_OTHER_ARTIFACT_SETS.has(candidate.artifactSet.setId)
      ).toBe(false);
    }

    for (const setId of TIER_LIST_OTHER_ARTIFACT_SETS) {
      expect(setIds).not.toContain(setId);
    }
  });

  it("derives unordered 2+2 candidates from wanted stats with 5-star availability", () => {
    const candidates = buildTwoPieceArtifactChoiceCandidates([
      "atk%",
      "hp%",
      "cr",
    ]);
    const halfSetPairs = candidates.map((candidate) => {
      expect(candidate.artifactSet.type).toBe("2pc+2pc");
      if (candidate.artifactSet.type !== "2pc+2pc") return "";
      return candidate.artifactSet.halfSetIds.join("+");
    });

    expect(halfSetPairs).toContain("atk%-18+atk%-18");
    expect(halfSetPairs).toContain("atk%-18+hp%-20");
    expect(halfSetPairs).toContain("hp%-20+hp%-20");
    expect(halfSetPairs).not.toContain("hp%-20+atk%-18");
    expect(halfSetPairs.some((pair) => pair.includes("cr-12"))).toBe(false);

    for (const candidate of candidates) {
      if (candidate.artifactSet.type !== "2pc+2pc") continue;
      const counts = new Map<string, number>();
      for (const halfSetId of candidate.artifactSet.halfSetIds) {
        counts.set(halfSetId, (counts.get(halfSetId) ?? 0) + 1);
      }
      for (const [halfSetId, usedCount] of counts) {
        const fiveStarCount = (
          artifactHalfSetsById[halfSetId]?.setIds ?? []
        ).filter((setId) => artifactsById[setId]?.rarity === 5).length;
        expect(usedCount).toBeLessThanOrEqual(fiveStarCount);
      }
    }
  });
});
