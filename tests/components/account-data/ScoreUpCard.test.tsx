import { ScoreUpCard } from "@/components/account-data/ScoreUpCard";
import { allSlots, type MainStat, type Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import type { OptimizedBuild } from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import {
  createArtifactData,
  createArtifactScoreResult,
  createCharacterData,
} from "../../fixtures";
import { render, screen } from "../../utils/render";

const SLOT_MAINS: Record<Slot, MainStat> = {
  flower: "hp",
  plume: "atk",
  sands: "atk%",
  goblet: "pyro%",
  circlet: "cr",
};

function candidateArtifact(slot: Slot, id: string): CandidateArtifact {
  return {
    ...createArtifactData({ id, slotKey: slot, mainStatKey: SLOT_MAINS[slot] }),
    source: "swap",
  };
}

function makeOptimizedBuild(
  finalScore: number,
  idsBySlot?: Partial<Record<Slot, string>>
): OptimizedBuild {
  const artifacts = {} as Record<Slot, CandidateArtifact>;
  const slotScores = {} as Record<Slot, number>;
  for (const slot of allSlots) {
    artifacts[slot] = candidateArtifact(
      slot,
      idsBySlot?.[slot] ?? `alloc-${slot}`
    );
    slotScores[slot] = 0;
  }
  return {
    artifacts,
    slotScores,
    rawScore: finalScore,
    crPenalty: 0,
    finalScore,
    totalArtifactCr: 0,
  };
}

function makeEquippedArtifacts(
  idPrefix: string
): Partial<Record<Slot, ArtifactData>> {
  const result: Partial<Record<Slot, ArtifactData>> = {};
  for (const slot of allSlots) {
    result[slot] = createArtifactData({
      id: `${idPrefix}-${slot}`,
      slotKey: slot,
      mainStatKey: SLOT_MAINS[slot],
    });
  }
  return result;
}

function makeLookup(
  ...sources: Partial<Record<Slot, ArtifactData>>[]
): Map<string, ArtifactData> {
  const lookup = new Map<string, ArtifactData>();
  for (const source of sources) {
    for (const art of Object.values(source)) {
      if (art) lookup.set(art.id, art);
    }
  }
  return lookup;
}

describe("ScoreUpCard", () => {
  const character = createCharacterData({
    key: "hu_tao",
    level: 90,
    constellation: 0,
  });

  it("shows an explicit no-allocation state", () => {
    render(
      <ScoreUpCard
        char={character}
        tier="S"
        allocatedBuild={null}
        allocationStatus="unallocated"
        artifactLookup={new Map()}
      />
    );

    expect(screen.getByText("No feasible allocation")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The optimizer could not form a complete build from the available artifacts and this build target."
      )
    ).toBeInTheDocument();
  });

  it("distinguishes pending tiers from failed allocations", () => {
    render(
      <ScoreUpCard
        char={character}
        tier="A"
        allocatedBuild={null}
        allocationStatus="pending"
        artifactLookup={new Map()}
      />
    );

    expect(screen.getByText("Waiting for this tier")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Recommendations are calculated from higher tiers downward."
      )
    ).toBeInTheDocument();
  });

  describe("score gain badge", () => {
    // Fixture score: normalizedScore = 150, normalizer = 3.
    const score = createArtifactScoreResult();
    const equippedChar = createCharacterData({
      key: "hu_tao",
      level: 90,
      constellation: 0,
      artifacts: makeEquippedArtifacts("equipped"),
    });

    it("shows a negative rose gain from (finalScore - currentScore) * normalizer, not vs normalizedScore", () => {
      // finalScore 60 * normalizer 3 = display 180 > normalizedScore 150, so a
      // comparison against the normalized display score would show a phantom
      // +30; the engine-formula gain is (60 - 70) * 3 = -30.
      const allocatedBuild = makeOptimizedBuild(60);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          allocationStatus="allocated"
          currentScore={70}
          score={score}
          artifactLookup={makeLookup(
            equippedChar.artifacts,
            allocatedBuild.artifacts
          )}
        />
      );

      expect(screen.getByText("180")).toHaveClass("text-amber-400");
      const badge = screen.getByText("(-30)");
      expect(badge).toHaveClass("text-rose-400");
      expect(badge).not.toHaveClass("text-emerald-400");
      expect(screen.queryByText("(+30)")).not.toBeInTheDocument();
    });

    it("shows a positive emerald gain when finalScore exceeds currentScore", () => {
      const allocatedBuild = makeOptimizedBuild(80);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          allocationStatus="allocated"
          currentScore={70}
          score={score}
          artifactLookup={makeLookup(
            equippedChar.artifacts,
            allocatedBuild.artifacts
          )}
        />
      );

      expect(screen.getByText("240")).toHaveClass("text-amber-400");
      const badge = screen.getByText("(+30)");
      expect(badge).toHaveClass("text-emerald-400");
      expect(badge).not.toHaveClass("text-rose-400");
    });

    it("hides the gain badge when the allocation matches the equipped artifacts", () => {
      const idsBySlot = Object.fromEntries(
        allSlots.map((slot) => [slot, `equipped-${slot}`])
      ) as Record<Slot, string>;
      // Score mismatch (60 vs 70) must be ignored when every slot keeps the
      // currently equipped artifact.
      const allocatedBuild = makeOptimizedBuild(60, idsBySlot);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          allocationStatus="allocated"
          currentScore={70}
          score={score}
          artifactLookup={makeLookup(equippedChar.artifacts)}
        />
      );

      // Allocation score falls back to the current normalized score (150).
      expect(screen.getAllByText("150").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/^\([+-]\d+\)$/)).not.toBeInTheDocument();
    });

    it("hides the gain badge when currentScore is absent but still shows the allocation score", () => {
      const allocatedBuild = makeOptimizedBuild(80);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          allocationStatus="allocated"
          score={score}
          artifactLookup={makeLookup(
            equippedChar.artifacts,
            allocatedBuild.artifacts
          )}
        />
      );

      expect(screen.getByText("240")).toHaveClass("text-amber-400");
      expect(screen.queryByText(/^\([+-]\d+\)$/)).not.toBeInTheDocument();
    });
  });
});
