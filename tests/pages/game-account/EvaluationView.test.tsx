import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ArchetypeRole,
  type BuildEvaluation,
  evaluateAllBuilds,
  type SetGroup,
} from "@/domain/game-account/buildEvaluation";
import { EvaluationView } from "@/pages/game-account/EvaluationView";
import { useTierStore } from "@/stores/useTierStore";
import { fireEvent, render, screen } from "../../utils/render";

vi.mock("@/hooks/useActiveAccount", () => ({
  useActiveAccount: () => ({
    data: {
      characters: [
        { key: "owned_s" },
        { key: "owned_a" },
        { key: "owned_pool" },
      ],
    },
  }),
}));

vi.mock("@/stores/useBuildsStore", () => ({
  useBuildsStore: () => [{ characterId: "owned_s", builds: [] }],
  selectEnabledBuildGroups: () => [],
}));

vi.mock("@/domain/game-account/buildEvaluation", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/domain/game-account/buildEvaluation")
  >()),
  evaluateAllBuilds: vi.fn(),
  selectActiveBuildsForAccount: () => [],
}));

vi.mock("@/components/game-account/BuildEvaluationCard", () => ({
  BuildEvaluationCard: ({ evaluation }: { evaluation: BuildEvaluation }) => (
    <div data-testid="evaluation-card">{evaluation.evalBuild.key}</div>
  ),
}));

vi.mock("@/components/game-account/EvaluationHelpDialog", () => ({
  EvaluationHelpDialog: () => null,
}));

vi.mock("@/components/shared/ItemIcon", () => ({
  ItemIcon: () => null,
}));

vi.mock("@/components/layout/ScrollLayout", () => ({
  ScrollLayout: ({
    header,
    children,
  }: {
    header: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <header>{header}</header>
      <main>{children}</main>
    </div>
  ),
}));

function evaluation(
  key: string,
  completeness: number,
  archetypeRole: ArchetypeRole,
  characterIds: string[]
): BuildEvaluation {
  const emptySlot = {
    artifact: null,
    score: 0,
    maxScore: 1,
    isFlexSlot: false,
  };
  return {
    evalBuild: {
      key,
      artifactSet: key.split("_")[0],
      composition: "4pc",
      flexCount: 1,
      builds: [],
      characterIds,
      weights: {},
      mainStats: { sands: [], goblet: [], circlet: [] },
      sortedSubstats: [],
      scalingStat: "atk",
      archetypeRole,
    },
    slots: {
      flower: emptySlot,
      plume: emptySlot,
      sands: emptySlot,
      goblet: emptySlot,
      circlet: emptySlot,
    },
    totalScore: completeness,
    totalMaxScore: 1,
    completeness,
  };
}

function fixtureGroups(): SetGroup[] {
  return [
    {
      artifactSet: "crimson_witch_of_flames",
      worstCompleteness: 0.1,
      evaluations: [
        evaluation("alpha_unowned", 0.1, "dps", ["unowned_s"]),
        evaluation("alpha_support", 0.92, "support", ["owned_s"]),
        evaluation("alpha_dps", 0.95, "dps", ["owned_s"]),
      ],
    },
    {
      artifactSet: "__2+2__",
      worstCompleteness: 0.55,
      evaluations: [
        evaluation("delta_unranked", 0.55, "support", ["owned_pool"]),
      ],
    },
    {
      artifactSet: "emblem_of_severed_fate",
      worstCompleteness: 0.65,
      evaluations: [
        evaluation("gamma_merged", 0.65, "dps", ["owned_a", "unowned_s"]),
      ],
    },
    {
      artifactSet: "noblesse_oblige",
      worstCompleteness: 0.75,
      evaluations: [
        evaluation("beta_dps", 0.75, "dps", ["owned_s"]),
        evaluation("beta_support", 0.85, "support", ["owned_a"]),
      ],
    },
  ];
}

function visibleBuilds(): (string | null)[] {
  return screen
    .getAllByTestId("evaluation-card")
    .map((card) => card.textContent);
}

function clickChip(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("EvaluationView filters", () => {
  beforeEach(() => {
    localStorage.setItem("app_language", "en");
    useTierStore.getState().loadTierListData({
      tierAssignments: {
        owned_s: { tier: "S", position: 0 },
        unowned_s: { tier: "S", position: 1 },
        owned_a: { tier: "A", position: 0 },
      },
      tierCustomization: {
        S: { displayName: "Top priority", hidden: false },
      },
    });
    vi.mocked(evaluateAllBuilds).mockImplementation(fixtureGroups);
  });

  it("defaults to owned characters, all set categories and all score buckets", () => {
    render(<EvaluationView />);

    expect(
      screen.getByRole("checkbox", { name: "Owned characters" })
    ).toBeChecked();
    expect(
      screen.queryByRole("button", { name: "All" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("6 builds · Avg 78%")).toBeInTheDocument();
    expect(visibleBuilds()).toEqual([
      "alpha_dps",
      "alpha_support",
      "beta_support",
      "beta_dps",
      "gamma_merged",
      "delta_unranked",
    ]);
    for (const score of [
      /^90%\+\s*2$/,
      /^80%\+\s*1$/,
      /^70%\+\s*1$/,
      /^60%\+\s*1$/,
      /^<60%\s*1$/,
    ]) {
      expect(screen.getByRole("button", { name: score })).toBeInTheDocument();
    }
  });

  it("combines set category chips independently of build roles and keeps empty buckets visible", () => {
    render(<EvaluationView />);

    clickChip("DPS Set");
    expect(visibleBuilds()).toEqual([
      "alpha_dps",
      "alpha_support",
      "gamma_merged",
    ]);
    expect(
      screen.getByRole("button", { name: /^80%\+\s*0$/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^<60%\s*0$/ })
    ).toBeInTheDocument();

    clickChip("Support Set");
    expect(visibleBuilds()).toHaveLength(5);
    clickChip("DPS Set");
    expect(visibleBuilds()).toEqual(["beta_support", "beta_dps"]);
    clickChip("Support Set");
    expect(visibleBuilds()).toHaveLength(6);
    clickChip("Other Set");
    expect(visibleBuilds()).toEqual(["delta_unranked"]);
  });

  it("requires the same character to match ownership and any selected tier", () => {
    render(<EvaluationView />);

    clickChip("Top priority");
    expect(visibleBuilds()).toEqual(["alpha_dps", "alpha_support", "beta_dps"]);

    clickChip("A");
    expect(visibleBuilds()).toEqual([
      "alpha_dps",
      "alpha_support",
      "beta_support",
      "beta_dps",
      "gamma_merged",
    ]);
    clickChip("A");
    fireEvent.click(screen.getByRole("checkbox", { name: "Owned characters" }));
    expect(visibleBuilds()).toEqual([
      "beta_dps",
      "gamma_merged",
      "alpha_dps",
      "alpha_support",
      "alpha_unowned",
    ]);
  });

  it("filters multiple score buckets and sorts by remaining group and card scores", () => {
    render(<EvaluationView />);

    clickChip(/^90%\+\s*2$/);
    clickChip(/^80%\+\s*1$/);
    expect(visibleBuilds()).toEqual([
      "alpha_dps",
      "alpha_support",
      "beta_support",
    ]);
    expect(
      screen.getByRole("heading", {
        name: /^Crimson Witch of Flames\s*\(92%\+\)$/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Noblesse Oblige\s*\(85%\+\)$/ })
    ).toBeInTheDocument();
    expect(screen.getByText("6 builds · Avg 78%")).toBeInTheDocument();

    clickChip("Strongest first");
    expect(visibleBuilds()).toEqual([
      "beta_support",
      "alpha_support",
      "alpha_dps",
    ]);
    clickChip(/^90%\+\s*2$/);
    expect(visibleBuilds()).toEqual(["beta_support"]);
    clickChip(/^80%\+\s*1$/);
    expect(visibleBuilds()).toEqual([
      "delta_unranked",
      "gamma_merged",
      "beta_dps",
      "beta_support",
      "alpha_support",
      "alpha_dps",
    ]);
  });

  it("disables tier filtering when the active tier list has no assignments", () => {
    useTierStore.getState().loadTierListData({
      tierAssignments: {},
      tierCustomization: {},
    });
    render(<EvaluationView />);

    for (const tier of ["S", "A", "B", "C", "D", "Pool"]) {
      expect(screen.getByRole("button", { name: tier })).toBeDisabled();
    }
    expect(visibleBuilds()).toHaveLength(6);
  });
});
