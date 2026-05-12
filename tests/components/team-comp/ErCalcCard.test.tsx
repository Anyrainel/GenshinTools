import { act } from "@testing-library/react";
import { ErCalcCard } from "@/components/team-comp/ErCalcCard";
import type { ERTimeline } from "@/lib/ercalc/types";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { fireEvent, render, screen } from "../../utils/render";

const mockCharStats = {
  bennett: { weaponType: "Sword" },
  xiangling: { weaponType: "Polearm" },
  xingqiu: { weaponType: "Sword" },
};

vi.mock("@/data/gameStatsLoader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/gameStatsLoader")>();
  return {
    ...actual,
    characterStatsResource: {
      preload: () => Promise.resolve(mockCharStats),
      use: () => mockCharStats,
      peek: () => mockCharStats,
    },
  };
});

vi.mock("@/hooks/useActiveAccount", () => ({
  useActiveAccountData: () => null,
}));

describe("ErCalcCard", () => {
  beforeEach(() => {
    act(() => {
      useTeamStore.getState().clearTeams();
      useSessionNavStore.getState().setErCalcExpanded("damage", true);
    });
  });

  it("persists reordered action positions after dragging", () => {
    const initialTimeline = {
      actions: [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" },
        { char: "xingqiu", action: "E" },
      ],
      periodic: [],
    } satisfies ERTimeline;

    let teamId = "";
    act(() => {
      teamId = useTeamStore.getState().addTeam({
        id: "er-drag-team",
        name: "ER Drag Team",
        characters: ["bennett", "xiangling", "xingqiu", null],
        setupConfig: {
          combatOptions: {},
          energy: { timelines: [initialTimeline] },
        },
      });
    });

    const teamComp = useTeamStore.getState().teamCompById[teamId];
    const setupConfig = useTeamStore.getState().getTeamSetupConfigById(teamId);
    const { container } = render(
      <ErCalcCard teamComp={teamComp} setupConfig={setupConfig} />
    );
    const actionChips = Array.from(
      container.querySelectorAll('[draggable="true"]')
    );

    expect(actionChips).toHaveLength(3);

    const dataTransfer = { effectAllowed: "move" };
    act(() => {
      fireEvent.dragStart(actionChips[0], { dataTransfer });
    });
    act(() => {
      fireEvent.dragOver(actionChips[1], { dataTransfer });
    });
    act(() => {
      fireEvent.dragEnd(actionChips[0], { dataTransfer });
    });

    const persistedTimeline =
      useTeamStore.getState().configsByTeamId[teamId]?.energy?.timelines?.[0];
    expect(
      persistedTimeline?.actions.map(
        (action) => `${action.char}:${action.action}`
      )
    ).toEqual(["xiangling:Q", "bennett:E", "xingqiu:E"]);
  });

  it("only shows Favonius reset when flags differ from defaults", () => {
    const initialTimeline = {
      actions: [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" },
      ],
      periodic: [],
    } satisfies ERTimeline;

    let teamId = "";
    act(() => {
      teamId = useTeamStore.getState().addTeam({
        id: "er-fav-reset-team",
        name: "ER Fav Reset Team",
        characters: ["bennett", "xiangling", null, null],
        weapons: ["favonius_sword", null, null, null],
        setupConfig: {
          combatOptions: {},
          energy: { timelines: [initialTimeline] },
        },
      });
    });

    const getProps = () => ({
      teamComp: useTeamStore.getState().teamCompById[teamId],
      setupConfig: useTeamStore.getState().getTeamSetupConfigById(teamId),
    });
    const { rerender } = render(<ErCalcCard {...getProps()} />);

    const resetButton = screen.getByRole("button", { name: "Reset Fav" });
    act(() => {
      fireEvent.click(resetButton);
    });

    const persistedTimeline =
      useTeamStore.getState().configsByTeamId[teamId]?.energy?.timelines?.[0];
    expect(persistedTimeline?.actions[0]?.favoniusProc).toBe(true);

    rerender(<ErCalcCard {...getProps()} />);
    expect(
      screen.queryByRole("button", { name: "Reset Fav" })
    ).not.toBeInTheDocument();
  });
});
