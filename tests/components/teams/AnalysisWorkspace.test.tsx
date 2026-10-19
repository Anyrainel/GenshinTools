import "@/providers/reference/statLoaders";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { AnalysisWorkspace } from "@/components/teams/AnalysisWorkspace";
import type { DamageCard } from "@/components/teams/DamageCard";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { MainStat, MainStatSlot } from "@/domain/enums";
import type { AccountData, ArtifactData } from "@/domain/models";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type { AnalysisMode } from "@/domain/team/analysisTypes";
import { buildTeamSlotConfigs } from "@/domain/team/teamConfigUtils";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import type {
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptimizerOptions,
  TeamSetupConfig,
} from "@/domain/team/types";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { act, render, screen } from "../../utils/render";
import "@/domain/combat/damage/index";

const mounts = vi.hoisted(() => ({ roster: vi.fn(), skills: vi.fn() }));
const optimization = vi.hoisted(() => ({
  account: null as AccountData | null,
  result: null as TeamOptimizationResult | null,
  progress: null as TeamOptimizationProgress | null,
  start: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  card: vi.fn(),
}));
vi.mock("@/hooks/useActiveAccount", () => ({
  useActiveAccountData: () => optimization.account,
}));
vi.mock("@/hooks/useAsyncOptimizer", () => ({
  useAsyncOptimizer: () => ({
    ...optimization,
    isComputing: false,
    error: null,
  }),
}));
vi.mock("@/components/teams/TeamRosterCard", async () => {
  const React = await import("react");
  return {
    TeamRosterCard: () => {
      const [value, setValue] = React.useState(0);
      React.useEffect(() => {
        mounts.roster();
      }, []);
      return (
        <section aria-label="Team Roster">
          <button type="button" onClick={() => setValue(value + 1)}>
            Edit roster
          </button>
          <output aria-label="Roster edit">{value}</output>
        </section>
      );
    },
  };
});
vi.mock("@/components/teams/FormulaSelectorCard", async () => {
  const React = await import("react");
  return {
    FormulaSelectorCard: () => {
      const [expanded, setExpanded] = React.useState(false);
      React.useEffect(() => {
        mounts.skills();
      }, []);
      return (
        <section aria-label="Formula Selection">
          <button type="button" onClick={() => setExpanded(!expanded)}>
            Expand skill
          </button>
          <output aria-label="Skill expansion">{String(expanded)}</output>
        </section>
      );
    },
  };
});
vi.mock("@/components/teams/DamageCard", () => ({
  DamageCard: (props: ComponentProps<typeof DamageCard>) => {
    optimization.card(props);
    return (
      <button type="button" onClick={props.handleOptimize}>
        Run optimizer
      </button>
    );
  },
}));
vi.mock("@/components/teams/ErCalcCard", () => ({
  ErCalcCard: () => null,
}));
vi.mock("@/components/teams/BuildComparisonPanel", () => ({
  BuildComparisonPanel: () => null,
}));
vi.mock("@/components/teams/InvestmentPanel", () => ({
  InvestmentPanel: () => null,
}));
vi.mock("@/components/teams/CharacterReplacementDetail", () => ({
  CharacterReplacementDetail: () => null,
}));

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);
const team = teamCompInputToComp({
  id: "shared-panel-team",
  name: "Shared team",
  characters: ["hu_tao", null, null, null],
  weapons: ["staff_of_homa", null, null, null],
  artifacts: [null, null, null, null],
  reactions: [],
});
const configs = buildTeamSlotConfigs(team, { combatOptions: {} }, null);
const build = new TeamBuild(configs);
const setup: TeamSetupConfig = {
  combatOptions: {},
  damage: {
    formulaMode: "combo",
    combo: {
      id: "shared",
      label: { en: "Rotation", zh: "循环" },
      lines: Object.entries(build.catalog.getCombo("hu_tao")).map(
        ([formulaId, count]) => ({ charId: "hu_tao", formulaId, count })
      ),
    },
  },
};
function Workspace() {
  const [mode, setMode] = useState<AnalysisMode>("artifacts");
  return (
    <AnalysisWorkspace
      teamComp={team}
      setupConfig={setup}
      onBack={vi.fn()}
      mode={mode}
      onModeChange={setMode}
    />
  );
}

it("keeps keyboard navigation and accessible panel links across the analysis modes", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  const tabs = screen.getByRole("tablist", { name: "Analysis" });
  const artifacts = screen.getByRole("tab", { name: "Artifacts" });
  artifacts.focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Builds" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "Builds" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Energy" })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(artifacts).toHaveFocus();
  expect(artifacts).toHaveAttribute("aria-selected", "true");
  for (const tab of tabs.querySelectorAll('[role="tab"]')) {
    const panel = document.getElementById(tab.getAttribute("aria-controls")!);
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  }
});

it("keeps exactly the same roster and skill panel mounted through all five calculations", async () => {
  const user = userEvent.setup();
  render(<Workspace />);
  await user.click(screen.getByRole("button", { name: "Edit roster" }));
  await user.click(screen.getByRole("button", { name: "Expand skill" }));
  for (const name of [
    "Builds",
    "Investment",
    "Characters",
    "Energy",
    "Artifacts",
  ]) {
    await user.click(screen.getByRole("tab", { name }));
    expect(screen.getAllByRole("region", { name: "Team Roster" })).toHaveLength(
      1
    );
    expect(
      screen.getAllByRole("region", { name: "Formula Selection" })
    ).toHaveLength(1);
    expect(screen.getByLabelText("Roster edit")).toHaveTextContent("1");
    expect(screen.getByLabelText("Skill expansion")).toHaveTextContent("true");
  }
  expect(mounts.roster).toHaveBeenCalledTimes(1);
  expect(mounts.skills).toHaveBeenCalledTimes(1);
});

it("keeps one frozen character fixed while optimizing the other three, then releases it on unfreeze", async () => {
  const user = userEvent.setup();
  const frozen: ArtifactData = {
    id: "frozen-flower",
    setKey: "crimson_witch_of_flames",
    slotKey: "flower",
    mainStatKey: "hp",
    rarity: 5,
    level: 20,
    lock: false,
    substats: { cr: 7 },
  };
  const free: ArtifactData = { ...frozen, id: "free-flower" };
  optimization.account = {
    characters: [],
    extraArtifacts: [frozen, free],
    extraWeapons: [],
  };
  const four = teamCompInputToComp({
    id: "freeze-regression",
    name: "Freeze regression",
    characters: ["hu_tao", "xingqiu", "zhongli", "kaedehara_kazuha"],
    weapons: ["staff_of_homa", null, null, null],
    artifacts: [null, null, null, null],
    reactions: [],
  });
  const oldFreeze = useFreezeStore.getState().frozenTeams;
  useFreezeStore.setState({
    frozenTeams: {
      [four.id]: {
        frozenCharIds: ["hu_tao"],
        artifactsByChar: {
          hu_tao: {
            flower: frozen,
            plume: null,
            sands: null,
            goblet: null,
            circlet: null,
          },
        },
      },
    },
  });
  const view = render(
    <AnalysisWorkspace
      teamComp={four}
      setupConfig={setup}
      onBack={vi.fn()}
      mode="artifacts"
      onModeChange={vi.fn()}
    />
  );
  try {
    await user.click(screen.getByRole("button", { name: "Run optimizer" }));
    const options = optimization.start.mock
      .lastCall![0] as TeamOptimizerOptions;
    expect(Object.keys(options.perChar)).toEqual([
      "xingqiu",
      "zhongli",
      "kaedehara_kazuha",
    ]);
    expect(options.inventory.map((art) => art.id)).toEqual([free.id]);
    expect(options.baseSheets.hu_tao).toEqual(
      StatSheet.fromArtifacts([frozen])
    );

    // Stale results and in-flight progress must never overwrite frozen equipment.
    optimization.result = {
      done: true,
      bestDamage: 0,
      bestArtifactsByChar: { hu_tao: { flower: free } },
    } as unknown as TeamOptimizationResult;
    view.rerender(
      <AnalysisWorkspace
        teamComp={four}
        setupConfig={setup}
        onBack={vi.fn()}
        mode="artifacts"
        onModeChange={vi.fn()}
      />
    );
    expect(
      optimization.card.mock.lastCall![0].optimizedArtifactsByChar.hu_tao.flower
        .id
    ).toBe(frozen.id);
    optimization.result = null;
    optimization.progress = {
      passResults: [
        { charId: "hu_tao", bestDamage: 1, bestArtifacts: { flower: free } },
      ],
    } as unknown as typeof optimization.progress;
    view.rerender(
      <AnalysisWorkspace
        teamComp={four}
        setupConfig={setup}
        onBack={vi.fn()}
        mode="artifacts"
        onModeChange={vi.fn()}
      />
    );
    expect(
      optimization.card.mock.lastCall![0].optimizedArtifactsByChar.hu_tao.flower
        .id
    ).toBe(frozen.id);

    act(() => useFreezeStore.setState({ frozenTeams: {} }));
    await user.click(screen.getByRole("button", { name: "Run optimizer" }));
    const released = optimization.start.mock
      .lastCall![0] as TeamOptimizerOptions;
    expect(Object.keys(released.perChar)).toHaveLength(4);
    expect(released.inventory.map((art) => art.id)).toContain(frozen.id);
  } finally {
    view.unmount();
    optimization.account = null;
    optimization.result = null;
    optimization.progress = null;
    useFreezeStore.setState({ frozenTeams: oldFreeze });
  }
});

it("keeps the result while editing all three main-stat preferences and applies them together on the next run", async () => {
  const user = userEvent.setup();
  const variants: [MainStatSlot, MainStat, MainStat][] = [
    ["sands", "atk%", "hp%"],
    ["goblet", "atk%", "pyro%"],
    ["circlet", "cd", "cr"],
  ];
  const inventory = variants.flatMap(([slotKey, wanted, other]) =>
    [wanted, other].map(
      (mainStatKey): ArtifactData => ({
        id: `${slotKey}-${mainStatKey}`,
        setKey: "crimson_witch_of_flames",
        slotKey,
        mainStatKey,
        rarity: 5,
        level: 20,
        lock: false,
        substats: {},
      })
    )
  );
  optimization.account = {
    characters: [],
    extraArtifacts: inventory,
    extraWeapons: [],
  };
  const result = {
    done: true,
    bestDamage: 1,
    bestArtifactsByChar: { hu_tao: {} },
  } as unknown as TeamOptimizationResult;
  optimization.result = result;
  const view = render(
    <AnalysisWorkspace
      teamComp={team}
      setupConfig={setup}
      onBack={vi.fn()}
      mode="artifacts"
      onModeChange={vi.fn()}
    />
  );
  optimization.reset.mockClear();
  optimization.start.mockClear();
  try {
    for (const [slot, stat] of variants) {
      act(() =>
        optimization.card.mock.lastCall![0].onPreferredMainStatsChange(
          "hu_tao",
          slot,
          stat
        )
      );
      expect(optimization.reset).not.toHaveBeenCalled();
      expect(optimization.start).not.toHaveBeenCalled();
      expect(optimization.card.mock.lastCall![0].teamResult).toBe(result);
      expect(optimization.card.mock.lastCall![0].hasOptResult).toBe(true);
    }
    expect(
      optimization.card.mock.lastCall![0].preferredMainStats.hu_tao
    ).toEqual({ sands: "atk%", goblet: "atk%", circlet: "cd" });
    expect(optimization.card.mock.lastCall![0].minArtifactLevel).toBe(0);
    act(() => optimization.card.mock.lastCall![0].onMinArtifactLevelChange(12));
    expect(optimization.reset).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Run optimizer" }));
    expect(optimization.start).toHaveBeenCalledTimes(1);
    const options = optimization.start.mock
      .lastCall![0] as TeamOptimizerOptions;
    expect(options.minArtifactLevel).toBe(12);
    expect(options.perCharExcludedArtifactIds?.hu_tao).toEqual([
      "sands-hp%",
      "goblet-pyro%",
      "circlet-cr",
    ]);

    // Actual combat input changes must still clear incompatible results.
    view.rerender(
      <AnalysisWorkspace
        teamComp={team}
        setupConfig={{
          ...setup,
          damage: { ...setup.damage, calcContext: { enemyLevel: 120 } },
        }}
        onBack={vi.fn()}
        mode="artifacts"
        onModeChange={vi.fn()}
      />
    );
    expect(optimization.reset).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    optimization.account = null;
    optimization.result = null;
  }
});
