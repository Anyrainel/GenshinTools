import "@/providers/reference/statLoaders";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuildComparisonPanel } from "@/components/team-analysis/BuildComparisonPanel";
import type { WeaponChoiceResultCard } from "@/components/team-analysis/WeaponChoiceResultCard";
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
vi.mock(
  "@/components/team-analysis/WeaponChoiceResultCard",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/components/team-analysis/WeaponChoiceResultCard")
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
  }
);

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
    done: true,
    progress: { phase: "done", overallProgress: 1 },
  };
}

describe("owned comparison scope", () => {
  beforeEach(() => {
    state.account = account;
    state.result = null;
    vi.clearAllMocks();
    useTeamResultCacheStore.setState({ resultsByTeamId: {} });
  });

  it("clears account-scoped rankings after inventory changes and can leave owned mode after account removal", async () => {
    const view = render(<TestPanel />);
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
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
    expect(screen.getByRole("tab", { name: "All weapons" })).not.toBeDisabled();
    await userEvent.click(screen.getByRole("tab", { name: "All weapons" }));
    expect(
      screen.getByRole("button", { name: "Run Analysis" })
    ).not.toBeDisabled();
  });

  it("keeps an artifact comparison running when unrelated owned inventory changes", async () => {
    const view = render(<TestPanel />);
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
    await userEvent.click(screen.getByRole("tab", { name: "Artifact sets" }));
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
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
    expect(screen.getByTestId("result")).toHaveTextContent("empty");
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    state.result = result("weapon", 22);
    view.rerender(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("22");
    await userEvent.click(screen.getByRole("tab", { name: "All weapons" }));
    expect(screen.getByTestId("result")).toHaveTextContent("11");
    await userEvent.click(screen.getByRole("tab", { name: "Owned weapons" }));
    expect(screen.getByTestId("result")).toHaveTextContent("22");
  });
  it("ignores persisted catalog results without a matching calculation signature", () => {
    useTeamResultCacheStore
      .getState()
      .setChoiceResult(teamComp.id, "weapon", result("weapon", 11));
    render(<TestPanel />);
    expect(screen.getByTestId("result")).toHaveTextContent("empty");
  });
});
