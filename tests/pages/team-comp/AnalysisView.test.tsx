import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { AnalysisWorkspaceProps } from "@/components/team-analysis/AnalysisWorkspace";
import type { TeamGridProps } from "@/components/team-analysis/TeamGrid";
import { AnalysisView } from "@/pages/team-analysis/AnalysisView";
import { DEFAULT_VIEW_SETTINGS } from "@/stores/schemas";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { render, screen, waitFor, within } from "../../utils/render";

vi.mock("@/components/team-analysis/TeamGrid", () => ({
  TeamGrid: ({ setActiveTeamId, selectionCue }: TeamGridProps) => (
    <div>
      <h2>{selectionCue}</h2>
      <button type="button" onClick={() => setActiveTeamId("alpha")}>
        Select Alpha
      </button>
      <button type="button" onClick={() => setActiveTeamId("beta")}>
        Select Beta
      </button>
    </div>
  ),
}));
vi.mock("@/components/team-analysis/AnalysisWorkspace", () => ({
  AnalysisWorkspace: ({
    teamComp,
    mode,
    onModeChange,
    onBack,
  }: AnalysisWorkspaceProps) => {
    const [edits, setEdits] = useState(0);
    return (
      <section aria-label={teamComp.name}>
        <button type="button" onClick={onBack}>
          Switch team
        </button>
        <button type="button" onClick={() => onModeChange("investment")}>
          Investment
        </button>
        <button type="button" onClick={() => onModeChange("energy")}>
          Energy
        </button>
        <button type="button" onClick={() => setEdits((value) => value + 1)}>
          Edit shared panel
        </button>
        <output aria-label="Current calculation">{mode}</output>
        <output aria-label="Shared edits">{edits}</output>
      </section>
    );
  },
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/team-comp/analysis");
  useSessionNavStore.setState({
    viewSettings: { analysis: { ...DEFAULT_VIEW_SETTINGS } },
    analysisModes: {},
  });
  useTeamStore.getState().clearTeams();
  for (const [id, name] of [
    ["alpha", "Alpha"],
    ["beta", "Beta"],
  ])
    useTeamStore.getState().addTeam({
      id,
      name,
      characters: ["hu_tao", null, null, null],
      weapons: ["staff_of_homa", null, null, null],
    });
});
const importRef = { current: null };
function SiteViews() {
  const location = useLocation();
  const active = location.pathname.endsWith("/analysis");
  return (
    <>
      <Link to="/team-comp/loadouts">Saved Loadouts</Link>
      <Link to="/team-comp/analysis">Return to analysis</Link>
      <div hidden={!active}>
        <AnalysisView importRef={importRef} active={active} />
      </div>
    </>
  );
}

it("reflects team and calculation in the canonical URL and restores each team's mode and shared interactions", async () => {
  const user = userEvent.setup();
  render(<AnalysisView importRef={importRef} />);
  expect(
    screen.getByRole("heading", { name: "Select a team" })
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Select Alpha" }));
  await user.click(screen.getByRole("button", { name: "Investment" }));
  await user.click(screen.getByRole("button", { name: "Edit shared panel" }));
  expect(new URLSearchParams(window.location.search).get("team")).toBe("alpha");
  expect(new URLSearchParams(window.location.search).get("mode")).toBe(
    "investment"
  );
  await user.click(screen.getByRole("button", { name: "Switch team" }));
  await user.click(screen.getByRole("button", { name: "Select Beta" }));
  await user.click(screen.getByRole("button", { name: "Energy" }));
  expect(
    within(screen.getByRole("region", { name: "Beta" })).getByLabelText(
      "Current calculation"
    )
  ).toHaveTextContent("energy");
  await user.click(screen.getByRole("button", { name: "Switch team" }));
  await user.click(screen.getByRole("button", { name: "Select Alpha" }));
  expect(
    within(screen.getByRole("region", { name: "Alpha" })).getByLabelText(
      "Current calculation"
    )
  ).toHaveTextContent("investment");
  expect(
    within(screen.getByRole("region", { name: "Alpha" })).getByLabelText(
      "Shared edits"
    )
  ).toHaveTextContent("1");
});

it("heals invalid team and mode query parameters into the team grid", async () => {
  window.history.replaceState(
    {},
    "",
    "/team-comp/analysis?team=deleted-team&mode=unknown-mode"
  );
  render(<AnalysisView importRef={importRef} />);
  await waitFor(() => expect(window.location.search).toBe(""));
  expect(
    screen.getByRole("heading", { name: "Select a team" })
  ).toBeInTheDocument();
  expect(
    useSessionNavStore.getState().viewSettings.analysis.activeTeamId
  ).toBeNull();
});

it("retains selected context and shared panel work while visiting independent saved loadouts", async () => {
  const user = userEvent.setup();
  render(<SiteViews />);
  await user.click(screen.getByRole("button", { name: "Select Alpha" }));
  await user.click(screen.getByRole("button", { name: "Investment" }));
  await user.click(screen.getByRole("button", { name: "Edit shared panel" }));
  await user.click(screen.getByRole("link", { name: "Saved Loadouts" }));
  expect(window.location.pathname).toBe("/team-comp/loadouts");
  expect(useSessionNavStore.getState().viewSettings.analysis.activeTeamId).toBe(
    "alpha"
  );
  await user.click(screen.getByRole("link", { name: "Return to analysis" }));
  const selected = within(screen.getByRole("region", { name: "Alpha" }));
  expect(selected.getByLabelText("Shared edits")).toHaveTextContent("1");
  expect(selected.getByLabelText("Current calculation")).toHaveTextContent(
    "investment"
  );
  expect(new URLSearchParams(window.location.search).get("team")).toBe("alpha");
  await user.click(screen.getByRole("button", { name: "Switch team" }));
  expect(
    screen.getByRole("heading", { name: "Select a team" })
  ).toBeInTheDocument();
});
