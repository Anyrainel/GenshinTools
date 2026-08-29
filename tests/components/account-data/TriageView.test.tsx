import { act, fireEvent, screen } from "@testing-library/react";
import { TriageView } from "@/pages/account-data/TriageView";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { render } from "../../utils/render";

const mockDecisions = vi.hoisted(() => {
  type DecisionFixture = {
    id: string;
    setKey: string;
    label: "lock" | "unlock";
    lock: boolean;
    ruleId: string;
    specialRules?: string[];
  };

  const makeDecision = ({
    id,
    setKey,
    label,
    lock,
    ruleId,
    specialRules = [],
  }: DecisionFixture) => ({
    artifact: {
      id,
      setKey,
      slotKey: "flower",
      level: 0,
      rarity: 5,
      lock,
      mainStatKey: "hp",
      substats: {},
    },
    label,
    decidingResult: {
      label,
      ruleId,
      tier: "fodder",
      embryo: null,
      reason: "",
      reasonArgs: [],
    },
    allResults: [],
    specialRules,
    supplyDemand: null,
  });

  return [
    makeDecision({
      id: "flex-action",
      setKey: "gladiators_finale",
      label: "lock",
      lock: false,
      ruleId: "offPiecePattern",
      specialRules: ["offPiecePattern"],
    }),
    makeDecision({
      id: "normal-flex-match",
      setKey: "shimenawas_reminiscence",
      label: "lock",
      lock: false,
      ruleId: "primeTierKeep",
      specialRules: ["offPiecePattern"],
    }),
    makeDecision({
      id: "unlock-action",
      setKey: "emblem_of_severed_fate",
      label: "unlock",
      lock: true,
      ruleId: "noDemand",
    }),
    makeDecision({
      id: "flex-no-change",
      setKey: "crimson_witch_of_flames",
      label: "lock",
      lock: true,
      ruleId: "offPiecePattern",
      specialRules: ["offPiecePattern"],
    }),
    makeDecision({
      id: "other-no-change",
      setKey: "noblesse_oblige",
      label: "lock",
      lock: true,
      ruleId: "primeTierKeep",
    }),
    makeDecision({
      id: "unlock-no-change",
      setKey: "pale_flame",
      label: "unlock",
      lock: false,
      ruleId: "noDemand",
    }),
    makeDecision({
      id: "protected-flex",
      setKey: "viridescent_venerer",
      label: "lock",
      lock: false,
      ruleId: "offPiecePattern",
      specialRules: ["offPiecePattern", "levelProtected"],
    }),
    makeDecision({
      id: "protected-other",
      setKey: "golden_troupe",
      label: "lock",
      lock: false,
      ruleId: "primeTierKeep",
      specialRules: ["levelProtected"],
    }),
    makeDecision({
      id: "protected-unlock",
      setKey: "maiden_beloved",
      label: "unlock",
      lock: true,
      ruleId: "noDemand",
      specialRules: ["equippedProtected"],
    }),
  ];
});

vi.mock("@/lib/account-data/triage/triageEngine", () => ({
  runTriage: () => ({ decisions: mockDecisions, flexPatterns: [] }),
}));

vi.mock("@/components/account-data/TriageTabContent", () => ({
  TriageTabContent: ({
    recommendLock,
    recommendUnlock,
    noAction,
    noChange,
  }: {
    recommendLock: typeof mockDecisions;
    recommendUnlock: typeof mockDecisions;
    noAction: typeof mockDecisions;
    noChange: typeof mockDecisions;
  }) => (
    <div data-testid="visible-artifacts">
      {[...recommendLock, ...recommendUnlock, ...noAction, ...noChange]
        .map((decision) => decision.artifact.id)
        .join(",")}
    </div>
  ),
}));

function visibleArtifactIds() {
  return new Set(
    (screen.getByTestId("visible-artifacts").textContent ?? "")
      .split(",")
      .filter(Boolean)
  );
}

const allArtifactIds = new Set(
  mockDecisions.map((decision) => decision.artifact.id)
);

describe("TriageView filters", () => {
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

    expect(visibleArtifactIds()).toEqual(allArtifactIds);

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
    expect(visibleArtifactIds()).toEqual(new Set(["flex-action"]));

    fireEvent.click(shimenawaChip);
    expect(visibleArtifactIds()).toEqual(
      new Set(["flex-action", "normal-flex-match"])
    );

    fireEvent.click(gladiatorChip);
    expect(visibleArtifactIds()).toEqual(new Set(["normal-flex-match"]));

    fireEvent.click(shimenawaChip);
    expect(visibleArtifactIds()).toEqual(allArtifactIds);
  });

  it("keeps a collapsed active filter visible and resettable after account data updates", () => {
    render(<TriageView />);

    const expandButton = screen.getByRole("button", {
      name: /filter by artifact set/i,
    });
    fireEvent.click(expandButton);

    fireEvent.click(screen.getByRole("button", { name: "Gladiator's Finale" }));
    expect(visibleArtifactIds()).toEqual(new Set(["flex-action"]));

    fireEvent.click(expandButton);
    expect(
      screen.getByRole("button", { name: "Gladiator's Finale" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Shimenawa's Reminiscence" })
    ).not.toBeInTheDocument();

    act(() => {
      useAccountStore.getState().addOrUpdateAccount(0, {
        data: { characters: [], extraArtifacts: [], extraWeapons: [] },
      });
    });

    const activeFilter = screen.getByRole("button", {
      name: "Gladiator's Finale",
    });
    expect(activeFilter).toBeInTheDocument();
    expect(visibleArtifactIds()).toEqual(new Set(["flex-action"]));

    fireEvent.click(activeFilter);
    expect(visibleArtifactIds()).toEqual(allArtifactIds);
    expect(
      screen.queryByRole("button", { name: "Gladiator's Finale" })
    ).not.toBeInTheDocument();
  });

  it("filters by the decision that caused the final lock result", () => {
    render(<TriageView />);

    fireEvent.click(
      screen.getByRole("button", { name: /filter by lock result/i })
    );

    const flexRuleLocked = screen.getByRole("button", {
      name: "Locked by flex rules",
    });
    const otherLocked = screen.getByRole("button", {
      name: "Locked for other reasons",
    });
    const unlocked = screen.getByRole("button", { name: "Unlocked" });

    fireEvent.click(flexRuleLocked);
    expect(visibleArtifactIds()).toEqual(
      new Set(["flex-action", "flex-no-change", "protected-flex"])
    );
    fireEvent.click(flexRuleLocked);
    expect(visibleArtifactIds()).toEqual(allArtifactIds);

    fireEvent.click(otherLocked);
    expect(visibleArtifactIds()).toEqual(
      new Set(["normal-flex-match", "other-no-change", "protected-other"])
    );
    fireEvent.click(otherLocked);
    expect(visibleArtifactIds()).toEqual(allArtifactIds);

    fireEvent.click(unlocked);
    expect(visibleArtifactIds()).toEqual(
      new Set(["unlock-action", "unlock-no-change", "protected-unlock"])
    );
    fireEvent.click(unlocked);
    expect(visibleArtifactIds()).toEqual(allArtifactIds);

    fireEvent.click(flexRuleLocked);
    fireEvent.click(otherLocked);
    expect(visibleArtifactIds()).toEqual(
      new Set([
        "flex-action",
        "flex-no-change",
        "protected-flex",
        "normal-flex-match",
        "other-no-change",
        "protected-other",
      ])
    );

    fireEvent.click(flexRuleLocked);
    expect(visibleArtifactIds()).toEqual(
      new Set(["normal-flex-match", "other-no-change", "protected-other"])
    );

    fireEvent.click(otherLocked);
    expect(visibleArtifactIds()).toEqual(allArtifactIds);
  });
});
