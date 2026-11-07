import "@/providers/reference/statLoaders";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuildComparisonPanel } from "@/components/teams/BuildComparisonPanel";
import type { WeaponChoiceResultCard } from "@/components/teams/WeaponChoiceResultCard";
import type { WeaponChoiceResult as ComputeResult } from "@/domain/combat/analyzer/weaponChoice";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { AccountData } from "@/domain/models";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import { buildTeamSlotConfigs } from "@/domain/team/teamConfigUtils";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";
import { fireEvent, render, screen } from "../../utils/render";
import "@/domain/combat/damage/index";

const state = vi.hoisted(() => ({
  account: null as AccountData | null,
  result: null as ComputeResult | null,
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/hooks/useAsyncWeaponChoice", () => ({
  useAsyncWeaponChoice: () => ({
    result: state.result,
    isComputing: false,
    error: null,
    start: state.start,
    stop: state.stop,
  }),
}));
vi.mock("@/components/teams/WeaponChoiceResultCard", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/teams/WeaponChoiceResultCard")
    >();
  return {
    WeaponChoiceResultCard: (
      props: ComponentProps<typeof WeaponChoiceResultCard>
    ) => (
      <>
        <actual.WeaponChoiceResultCard {...props} />
        <output data-testid="result">
          {props.result?.timestamp ?? "empty"}
        </output>
      </>
    ),
  };
});

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);
const teamComp = teamCompInputToComp({
  id: "owned-comparison",
  name: "Team",
  characters: ["hu_tao", null, null, null],
  weapons: ["staff_of_homa", null, null, null],
  artifacts: [null, null, null, null],
  reactions: [],
});
const setupConfig = { combatOptions: {} };
function TestPanel() {
  const configs = buildTeamSlotConfigs(teamComp, setupConfig, state.account);
  return (
    <BuildComparisonPanel
      teamComp={teamComp}
      setupConfig={setupConfig}
      accountData={state.account}
      configs={configs}
      teamBuild={new TeamBuild(configs)}
      objectiveCombo={{
        id: "shared",
        label: { en: "Shared", zh: "共享" },
        lines: [],
      }}
    />
  );
}
const account: AccountData = {
  characters: [],
  extraArtifacts: [],
  extraWeapons: [
    { id: "homa", key: "staff_of_homa", refinement: 3, level: 90, lock: false },
  ],
};
function result(mode: "weapon" | "artifact", timestamp: number): ComputeResult {
  return {
    mode,
    timestamp,
    perCharacter: {},
    excludedChoices: {},
    done: true,
    progress: { phase: "done", overallProgress: 1 },
  };
}

describe("owned comparison scope", () => {
  it("keeps rejected choices out of rankings and preserves their failure details in the cache", () => {
    const view = render(<TestPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    const excludedChoices: ComputeResult["excludedChoices"] = {
      hu_tao: [
        {
          type: "weapon",
          weaponId: "favonius_lance",
          refinement: 5,
          failReasons: {
            hu_tao: { kind: "er-unmet", minEr: 2.3, bestEr: 1 },
          },
        },
      ],
    };
    state.result = {
      ...result("weapon", 101),
      perCharacter: {
        hu_tao: [
          {
            type: "weapon",
            weaponId: "staff_of_homa",
            refinement: 3,
            damage: 1000,
            percentOfBest: 100,
          },
        ],
      },
      excludedChoices,
    };
    view.rerender(<TestPanel />);
    expect(
      screen.getByRole("button", { name: "Staff of Homa R3" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("100.0%")).toHaveLength(1);
    fireEvent.click(screen.getByText("Excluded choices (1)"));
    expect(screen.getByText("Favonius Lance R5")).toBeVisible();
    expect(
      screen.getByText("Hu Tao: ER below the required 230%")
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Favonius Lance R5" })
    ).not.toBeInTheDocument();
    expect(
      useTeamResultCacheStore.getState().resultsByTeamId[teamComp.id]
        .weaponChoiceResult?.excludedChoices
    ).toEqual(excludedChoices);
  });

  it("explains when all compatible weapons fail the requirements", () => {
    const view = render(<TestPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.result = {
      ...result("weapon", 102),
      perCharacter: { hu_tao: [] },
      excludedChoices: {
        hu_tao: [
          {
            type: "weapon",
            weaponId: "staff_of_homa",
            refinement: 3,
            failReasons: { hu_tao: { kind: "er-unmet", minEr: 6, bestEr: 1 } },
          },
        ],
      },
    };
    view.rerender(<TestPanel />);
    expect(
      screen.getByText(
        "No choices found that meet the minimum ER / CR requirements"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("No compatible weapons")).not.toBeInTheDocument();
    expect(screen.queryByText("100.0%")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Excluded choices (1)"));
    expect(
      screen.getByText("Hu Tao: ER below the required 600%")
    ).toBeVisible();
  });

  it("shows rejected artifact sets and their CRIT Rate requirements", () => {
    const view = render(<TestPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Artifact sets" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.result = {
      ...result("artifact", 103),
      perCharacter: { hu_tao: [] },
      excludedChoices: {
        hu_tao: [
          {
            type: "artifact",
            artifactSet: { type: "4pc", setId: "archaic_petra" },
            failReasons: {
              hu_tao: { kind: "cr-unmet", minCr: 0.6, bestCr: 0.05 },
            },
          },
        ],
      },
    };
    view.rerender(<TestPanel />);
    expect(
      screen.queryByText("No compatible artifact sets")
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Excluded choices (1)"));
    expect(screen.getByText("Archaic Petra")).toBeVisible();
    expect(
      screen.getByText("Hu Tao: CRIT Rate below the required 60%")
    ).toBeVisible();
  });

  it("keeps pre-run settings compact and renders completed empty rankings", () => {
    const view = render(<TestPanel />);
    expect(
      screen.queryByText("Click Run to analyze weapons")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("(others unchanged)")).not.toBeInTheDocument();
    expect(screen.queryByText("No compatible weapons")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.result = result("weapon", 99);
    view.rerender(<TestPanel />);
    expect(screen.getByText("No compatible weapons")).toBeInTheDocument();
  });
  beforeEach(() => {
    state.account = account;
    state.result = null;
    vi.clearAllMocks();
    useTeamResultCacheStore.setState({ resultsByTeamId: {} });
  });

  it("clears account-scoped rankings after inventory changes and can leave owned mode after account removal", async () => {
    const view = render(<TestPanel />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    expect(state.start.mock.calls[0][0].ownedWeaponChoices).toEqual([
      { weaponId: "staff_of_homa", refinement: 3 },
    ]);
    state.result = result("weapon", 22);
    view.rerender(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("22");
    state.account = { ...account, extraWeapons: [] };
    view.rerender(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("empty");
    state.account = null;
    view.rerender(<TestPanel />);
    expect(screen.getByRole("button", { name: "Run Analysis" })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    ).not.toBeDisabled();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    );
    expect(
      screen.getByRole("button", { name: "Run Analysis" })
    ).not.toBeDisabled();
  });

  it("keeps an artifact comparison running when unrelated owned inventory changes", async () => {
    const view = render(<TestPanel />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Artifact sets" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.stop.mockClear();
    state.account = {
      ...account,
      extraWeapons: [
        ...account.extraWeapons,
        {
          id: "extra-tassel",
          key: "black_tassel",
          refinement: 5,
          level: 90,
          lock: false,
        },
      ],
    };
    view.rerender(<TestPanel />);
    expect(state.stop).not.toHaveBeenCalled();
    state.result = result("artifact", 33);
    view.rerender(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("33");
  });

  it("restores a computed catalog result when leaving owned mode", async () => {
    const view = render(<TestPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.result = result("weapon", 11);
    view.rerender(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("11");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    );
    expect(screen.getByTestId("result")).toHaveTextContent("empty");
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.result = result("weapon", 22);
    view.rerender(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("22");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    );
    expect(screen.getByTestId("result")).toHaveTextContent("11");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    );
    expect(screen.getByTestId("result")).toHaveTextContent("22");
  });
  it("keeps owned weapons independent from theoretical artifact comparison and exposes settings before Run", async () => {
    render(<TestPanel />);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weapons" })).toBeInTheDocument();
    const owned = screen.getByRole("checkbox", { name: "Owned weapons" });
    const run = screen.getByRole("button", { name: "Run Analysis" });
    expect(
      owned.compareDocumentPosition(run) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(owned.closest("details")).toBeNull();
    await userEvent.click(owned);
    await userEvent.click(
      screen.getByRole("button", { name: "Artifact sets" })
    );
    expect(
      screen.queryByRole("checkbox", { name: "Owned weapons" })
    ).not.toBeInTheDocument();
    await userEvent.click(run);
    expect(state.start.mock.calls[0][0]).toMatchObject({ mode: "artifact" });
    expect(state.start.mock.calls[0][0].ownedWeaponChoices).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Weapons" }));
    expect(
      screen.getByRole("checkbox", { name: "Owned weapons" })
    ).toBeChecked();
    await userEvent.click(run);
    expect(state.start.mock.calls[1][0].ownedWeaponChoices).toEqual([
      { weaponId: "staff_of_homa", refinement: 3 },
    ]);
  });

  it("ignores persisted catalog results without a matching calculation signature", () => {
    useTeamResultCacheStore
      .getState()
      .setChoiceResult(teamComp.id, "weapon", result("weapon", 11));
    render(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("empty");
  });
});
