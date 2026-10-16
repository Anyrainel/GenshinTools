import { ScoreUpCard } from "@/components/game-account/ScoreUpCard";
import { allSlots, type MainStat, type Slot } from "@/domain/enums";
import type { OptimizedBuild } from "@/domain/game-account/buildOptimizer";
import type { CandidateArtifact } from "@/domain/game-account/candidatePool";
import type { ArtifactData } from "@/domain/models";
import {
  createArtifactData,
  createArtifactScoreResult,
  createCharacterData,
} from "../../fixtures";
import { fireEvent, render, screen } from "../../utils/render";

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
    // Current raw score 70, normalized to 210 (normalizer = 3).
    const score = createArtifactScoreResult({
      normalized: { normalizedScore: 210 },
    });
    const equippedChar = createCharacterData({
      key: "hu_tao",
      level: 90,
      constellation: 0,
      artifacts: makeEquippedArtifacts("equipped"),
    });

    it("shows a negative gain matching the visible before and after scores", () => {
      const allocatedBuild = makeOptimizedBuild(60);
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
      const allocatedBuild = makeOptimizedBuild(70, idsBySlot);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          allocationStatus="allocated"
          score={score}
          artifactLookup={makeLookup(equippedChar.artifacts)}
        />
      );

      expect(screen.getAllByText("210")).toHaveLength(2);
      expect(screen.queryByText(/^\([+-]\d+\)$/)).not.toBeInTheDocument();
    });

    it("shows -3 when the visible scores are 195 and 192", () => {
      const allocatedBuild = makeOptimizedBuild(64);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          allocationStatus="allocated"
          score={createArtifactScoreResult({
            normalized: { normalizedScore: 195 },
          })}
          artifactLookup={makeLookup(
            equippedChar.artifacts,
            allocatedBuild.artifacts
          )}
        />
      );

      expect(screen.getByText("192")).toHaveClass("text-amber-400");
      expect(screen.getByText("195")).toBeInTheDocument();
      expect(screen.getByText("(-3)")).toBeInTheDocument();
    });

    it("subtracts rounded endpoints and preserves scores above 300", () => {
      const allocatedBuild = makeOptimizedBuild(100.2);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          score={createArtifactScoreResult({
            normalized: { normalizedScore: 299.4 },
          })}
          artifactLookup={makeLookup(
            equippedChar.artifacts,
            allocatedBuild.artifacts
          )}
        />
      );
      expect(screen.getByText("301")).toBeInTheDocument();
      expect(screen.getByText("299")).toBeInTheDocument();
      expect(screen.getByText("(+2)")).toBeInTheDocument();
    });

    it("shows additional upgrade gains in the same units as the build score", () => {
      const allocatedBuild = makeOptimizedBuild(70);
      render(
        <ScoreUpCard
          char={equippedChar}
          tier="S"
          allocatedBuild={allocatedBuild}
          score={score}
          artifactLookup={makeLookup(
            equippedChar.artifacts,
            allocatedBuild.artifacts
          )}
          recommendations={[
            {
              actionType: "upgrade",
              characterId: "hu_tao",
              slot: "flower",
              sourceArtifactId: "alloc-flower",
              currentArtifactId: "alloc-flower",
              setKey: "Main",
              slotScoreDiff: 5,
              buildScoreDiff: 5,
              maxPotentialScore: 75,
            },
          ]}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Upgrade suggestions" })
      );
      expect(screen.getByText("+15.0")).toBeInTheDocument();
      expect(screen.queryByText("+5.0")).not.toBeInTheDocument();
    });
  });
});
