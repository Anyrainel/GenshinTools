import { fireEvent, screen } from "@testing-library/react";
import { TriageView } from "@/pages/account-data/TriageView";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { render } from "../../utils/render";

const mockDecisions = vi.hoisted(() => [
  {
    artifact: {
      id: "gladiator-flower",
      setKey: "gladiators_finale",
      slotKey: "flower",
      level: 0,
      rarity: 5,
      lock: false,
      mainStatKey: "hp",
      substats: {},
    },
    label: "lock",
    decidingResult: null,
    allResults: [],
    specialRules: [],
    supplyDemand: null,
  },
  {
    artifact: {
      id: "shimenawa-flower",
      setKey: "shimenawas_reminiscence",
      slotKey: "flower",
      level: 0,
      rarity: 5,
      lock: false,
      mainStatKey: "hp",
      substats: {},
    },
    label: "lock",
    decidingResult: null,
    allResults: [],
    specialRules: [],
    supplyDemand: null,
  },
]);

vi.mock("@/lib/account-data/triage/triageEngine", () => ({
  runTriage: () => ({ decisions: mockDecisions, flexPatterns: [] }),
}));

vi.mock("@/components/account-data/TriageTabContent", () => ({
  TriageTabContent: ({
    recommendLock,
  }: {
    recommendLock: typeof mockDecisions;
  }) => (
    <div data-testid="visible-artifacts">
      {recommendLock.map((decision) => decision.artifact.id).join(",")}
    </div>
  ),
}));

describe("TriageView artifact set filter", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccounts();
    useAccountStore.getState().addOrUpdateAccount(0, {
      data: { characters: [], extraArtifacts: [], extraWeapons: [] },
    });
    useBuildsStore.getState().clearAll();
    useBuildsStore.setState({
      enabledResolvedBuildGroups: [
        { characterId: "hu_tao", builds: [], weapons: [] },
      ],
    });
  });

  it("shows icon-and-name chips and filters by the exact artifact set", () => {
    render(<TriageView />);

    const visibleArtifacts = screen.getByTestId("visible-artifacts");
    expect(visibleArtifacts).toHaveTextContent(
      "gladiator-flower,shimenawa-flower"
    );

    const expandButton = screen.getByRole("button", {
      name: /filter by artifact set/i,
    });
    fireEvent.click(expandButton);

    const gladiatorChip = screen.getByRole("button", {
      name: "Gladiator's Finale",
    });
    const shimenawaChip = screen.getByRole("button", {
      name: "Shimenawa's Reminiscence",
    });
    expect(gladiatorChip.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/artifact/gladiators_finale.webp")
    );
    expect(shimenawaChip.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/artifact/shimenawas_reminiscence.webp")
    );

    const chipGroup = expandButton.parentElement;
    expect(chipGroup).toHaveClass("flex", "flex-wrap", "w-full", "min-w-0");

    fireEvent.click(gladiatorChip);
    expect(visibleArtifacts).toHaveTextContent("gladiator-flower");
    expect(visibleArtifacts).not.toHaveTextContent("shimenawa-flower");

    fireEvent.click(shimenawaChip);
    expect(visibleArtifacts).toHaveTextContent(
      "gladiator-flower,shimenawa-flower"
    );

    fireEvent.click(gladiatorChip);
    expect(visibleArtifacts).not.toHaveTextContent("gladiator-flower");
    expect(visibleArtifacts).toHaveTextContent("shimenawa-flower");

    fireEvent.click(shimenawaChip);
    expect(visibleArtifacts).toHaveTextContent(
      "gladiator-flower,shimenawa-flower"
    );
  });
});
