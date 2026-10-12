import "@/providers/reference/statLoaders";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AnalysisWorkspace } from "@/components/teams/AnalysisWorkspace";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type { AnalysisMode } from "@/domain/team/analysisTypes";
import { buildTeamSlotConfigs } from "@/domain/team/teamConfigUtils";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import type { TeamSetupConfig } from "@/domain/team/types";
import { render, screen } from "../../utils/render";
import "@/domain/combat/damage/index";

const mounts = vi.hoisted(() => ({ roster: vi.fn(), skills: vi.fn() }));
vi.mock("@/hooks/useActiveAccount", () => ({
  useActiveAccountData: () => null,
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
  DamageCard: () => null,
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
