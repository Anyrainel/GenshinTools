import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AnalysisWorkspace } from "@/components/team-comp/AnalysisWorkspace";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { AnalysisMode } from "@/lib/team-comp/analysisTypes";
import { buildTeamSlotConfigs } from "@/lib/team-comp/teamConfigUtils";
import { teamCompInputToComp } from "@/lib/team-comp/teamDeltas";
import type { TeamSetupConfig } from "@/lib/team-comp/types";
import { render, screen } from "../../utils/render";
import "@/lib/dmgcalc";

const mounts = vi.hoisted(() => ({ roster: vi.fn(), skills: vi.fn() }));
vi.mock("@/hooks/useActiveAccount", () => ({
  useActiveAccountData: () => null,
}));
vi.mock("@/components/team-comp/TeamRosterCard", async () => {
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
vi.mock("@/components/team-comp/FormulaSelectorCard", async () => {
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
vi.mock("@/components/team-comp/DamageCard", () => ({
  DamageCard: () => null,
}));
vi.mock("@/components/team-comp/ErCalcCard", () => ({
  ErCalcCard: () => null,
}));
vi.mock("@/components/team-comp/BuildComparisonPanel", () => ({
  BuildComparisonPanel: () => null,
}));
vi.mock("@/components/team-comp/InvestmentPanel", () => ({
  InvestmentPanel: () => null,
}));
vi.mock("@/components/team-comp/CharacterReplacementDetail", () => ({
  CharacterReplacementDetail: () => null,
}));
vi.mock("@/components/team-comp/AccountEquipmentCard", () => ({
  AccountEquipmentCard: () => null,
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
