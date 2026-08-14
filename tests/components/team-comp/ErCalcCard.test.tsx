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
  fischl: { weaponType: "Bow" },
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

  describe("Easy Mode state reconciliation", () => {
    const easyTimeline = {
      actions: [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "E" },
        { char: "xiangling", action: "Q" },
      ],
      periodic: [],
    } satisfies ERTimeline;

    /** Easy Mode character cards, in team order. The driver radio is the only
     *  stable per-card anchor — names also appear in the funnel dropdowns. */
    function memberCards(container: HTMLElement): HTMLElement[] {
      return Array.from(
        container.querySelectorAll('input[name="easyDriver"]')
      ).map((radio) => radio.closest("div.p-3") as HTMLElement);
    }

    function castInputs(card: HTMLElement): HTMLInputElement[] {
      return Array.from(card.querySelectorAll('input[type="number"]'));
    }

    function setupTeam(id: string, characters: (string | null)[]) {
      let teamId = "";
      act(() => {
        teamId = useTeamStore.getState().addTeam({
          id,
          name: id,
          characters,
          setupConfig: {
            combatOptions: {},
            energy: { timelines: [easyTimeline] },
          },
        });
      });
      return {
        teamId,
        getProps: () => ({
          teamComp: useTeamStore.getState().teamCompById[teamId],
          setupConfig: useTeamStore.getState().getTeamSetupConfigById(teamId),
        }),
      };
    }

    it("survives a timeline write (what compiling a rotation does)", () => {
      const { teamId, getProps } = setupTeam("er-easy-timeline", [
        "bennett",
        "xiangling",
        "xingqiu",
        null,
      ]);

      const { container, rerender } = render(<ErCalcCard {...getProps()} />);
      act(() => {
        fireEvent.click(screen.getByText("Easy Mode"));
      });

      const skills = castInputs(memberCards(container)[0])[0];
      act(() => {
        fireEvent.change(skills, { target: { value: "3" } });
      });
      expect(castInputs(memberCards(container)[0])[0].value).toBe("3");

      // Compiling writes a brand-new timelines array through the store, which
      // is exactly what used to reset the form that produced it.
      act(() => {
        useTeamStore.getState().updateTeamSetupConfig(teamId, (config) => ({
          ...config,
          energy: {
            ...config.energy,
            timelines: [
              {
                actions: [{ char: "bennett", action: "E" as const }],
                periodic: [],
              },
            ],
          },
        }));
      });
      rerender(<ErCalcCard {...getProps()} />);

      expect(castInputs(memberCards(container)[0])[0].value).toBe("3");
    });

    it("merges across a roster swap, pruning only what left", () => {
      const { teamId, getProps } = setupTeam("er-easy-roster", [
        "bennett",
        "xiangling",
        "xingqiu",
        null,
      ]);

      const { container, rerender } = render(<ErCalcCard {...getProps()} />);
      act(() => {
        fireEvent.click(screen.getByText("Easy Mode"));
      });

      // Xiangling: driver, 2 bursts. Both must survive — she stays on team.
      const xianglingCard = memberCards(container)[1];
      act(() => {
        fireEvent.click(
          xianglingCard.querySelector(
            'input[name="easyDriver"]'
          ) as HTMLInputElement
        );
      });
      act(() => {
        fireEvent.change(castInputs(xianglingCard)[1], {
          target: { value: "2" },
        });
      });

      // A funnel pointing at Xingqiu, who is about to leave.
      act(() => {
        fireEvent.change(
          document.getElementById("funnel-source") as HTMLSelectElement,
          { target: { value: "bennett" } }
        );
        fireEvent.change(
          document.getElementById("funnel-target") as HTMLSelectElement,
          { target: { value: "xingqiu" } }
        );
      });
      act(() => {
        fireEvent.click(screen.getByText("Add funnel"));
      });
      expect(screen.getAllByText("E →")).toHaveLength(1);

      act(() => {
        useTeamStore.getState().updateTeamComp(teamId, (comp) => ({
          ...comp,
          slots: comp.slots.map((slot) =>
            slot.charId === "xingqiu" ? { ...slot, charId: "fischl" } : slot
          ),
        }));
      });
      rerender(<ErCalcCard {...getProps()} />);

      const cards = memberCards(container);
      expect(cards).toHaveLength(3);
      // Xiangling keeps her burst count and stays the driver.
      expect(castInputs(cards[1])[1].value).toBe("2");
      expect(
        (cards[1].querySelector('input[name="easyDriver"]') as HTMLInputElement)
          .checked
      ).toBe(true);
      // Fischl is seeded with defaults; the departed funnel is gone.
      expect(castInputs(cards[2])[0].value).toBe("1");
      expect(screen.queryAllByText("E →")).toHaveLength(0);
    });
  });

  describe("scenario persistence", () => {
    const timeline = {
      actions: [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" },
      ],
      periodic: [],
    } satisfies ERTimeline;

    function setup() {
      let teamId = "";
      act(() => {
        teamId = useTeamStore.getState().addTeam({
          id: "er-scenario-team",
          name: "ER Scenario Team",
          characters: ["bennett", "xiangling", "xingqiu", null],
          setupConfig: {
            combatOptions: {},
            energy: { timelines: [timeline] },
          },
        });
      });
      const getProps = () => ({
        teamComp: useTeamStore.getState().teamCompById[teamId],
        setupConfig: useTeamStore.getState().getTeamSetupConfigById(teamId),
      });
      const energy = () =>
        useTeamStore.getState().configsByTeamId[teamId]?.energy;
      return { getProps, energy };
    }

    it("persists the calc mode and particle mode to the team store", () => {
      const { getProps, energy } = setup();
      const { rerender } = render(<ErCalcCard {...getProps()} />);

      expect(energy()?.mode).toBeUndefined();

      act(() => {
        fireEvent.click(screen.getByText("Empty"));
      });
      expect(energy()?.mode).toBe("zero-energy-repeat");

      rerender(<ErCalcCard {...getProps()} />);
      act(() => {
        fireEvent.click(screen.getByText("× Once"));
      });
      expect(energy()?.mode).toBe("zero-energy-start");

      rerender(<ErCalcCard {...getProps()} />);
      act(() => {
        fireEvent.click(screen.getByText("Max"));
      });
      expect(energy()?.particleMode).toBe("max");
      expect(energy()?.mode).toBe("zero-energy-start");
    });

    it("locks out the degenerate full-energy + run-once scenario", () => {
      const { getProps } = setup();
      render(<ErCalcCard {...getProps()} />);
      expect(screen.getByText("× Once")).toBeDisabled();
    });

    it("restores a persisted scenario on remount", () => {
      const { getProps, energy } = setup();
      const { unmount } = render(<ErCalcCard {...getProps()} />);
      act(() => {
        fireEvent.click(screen.getByText("Empty"));
      });
      unmount();

      render(<ErCalcCard {...getProps()} />);
      expect(energy()?.mode).toBe("zero-energy-repeat");
      expect(screen.getByText("× Once")).not.toBeDisabled();
    });
  });
});
