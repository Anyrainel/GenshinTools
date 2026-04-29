import { ScoreUpCard } from "@/components/account-data/ScoreUpCard";
import { createCharacterData } from "../../fixtures";
import { render, screen } from "../../utils/render";

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
});
