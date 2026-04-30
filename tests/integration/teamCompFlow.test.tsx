/**
 * Integration Tests: Team Builder Flow
 *
 * Tests the current split model:
 * 1. Team comp operations in the Zustand store
 * 2. Separate setup config state
 * 3. TeamCard rendering from TeamComp data
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamCard } from "@/components/team-comp/TeamCard";
import { useTeamStore } from "@/stores/useTeamStore";
import { render, screen } from "../utils/render";

describe("Integration: Team Builder Flow", () => {
  beforeEach(() => {
    useTeamStore.getState().clearTeams();
  });

  it("creates a new team comp with default values", () => {
    act(() => {
      useTeamStore.getState().addTeam();
    });

    const teamComps = useTeamStore.getState().teamComps;
    expect(teamComps).toHaveLength(1);
    expect(teamComps[0].name).toBe("");
    expect(teamComps[0].slots).toEqual([]);
  });

  it("updates comp and setup config independently", () => {
    let teamId = "";
    act(() => {
      teamId = useTeamStore.getState().addTeam();
    });

    act(() => {
      useTeamStore.getState().updateTeamComp(teamId, {
        name: "National Team",
        slots: [
          { charId: "hu_tao", weaponId: null, artifactSet: null },
          { charId: "xingqiu", weaponId: null, artifactSet: null },
          { charId: "zhongli", weaponId: null, artifactSet: null },
          { charId: "bennett", weaponId: null, artifactSet: null },
        ],
      });
      useTeamStore.getState().updateTeamSetupConfig(teamId, {
        combatOptions: {},
        charConfigs: { hu_tao: { minEr: 1.3 } },
      });
    });

    const state = useTeamStore.getState();
    expect(state.teamComps[0].name).toBe("National Team");
    expect(state.teamComps[0].slots.map((slot) => slot.charId)).toEqual([
      "hu_tao",
      "xingqiu",
      "zhongli",
      "bennett",
    ]);
    expect(state.configsByTeamId[teamId].charConfigs?.hu_tao).toEqual({
      minEr: 1.3,
    });
  });

  it("copies and deletes team comps", async () => {
    let teamId = "";
    act(() => {
      teamId = useTeamStore.getState().addTeam({
        name: "Hu Tao Vape",
        characters: ["hu_tao", "xingqiu", null, null],
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    act(() => {
      useTeamStore.getState().copyTeam(teamId);
    });

    let teamComps = useTeamStore.getState().teamComps;
    expect(teamComps).toHaveLength(2);
    expect(teamComps[1].name).toBe("Hu Tao Vape");
    expect(teamComps[1].slots.map((slot) => slot.charId)).toEqual([
      "hu_tao",
      "xingqiu",
    ]);
    expect(teamComps[1].id).not.toBe(teamComps[0].id);

    act(() => {
      useTeamStore.getState().deleteTeam(teamId);
    });

    teamComps = useTeamStore.getState().teamComps;
    expect(teamComps).toHaveLength(1);
    expect(teamComps[0].id).not.toBe(teamId);
  });

  it("renders TeamCard with team comp data", () => {
    const teamComp = {
      id: "test-team-1",
      name: "Test Team",
      slots: [
        { charId: "hu_tao", weaponId: null, artifactSet: null },
        { charId: "xingqiu", weaponId: null, artifactSet: null },
      ],
      reactions: [],
    };

    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();
    const mockCopy = vi.fn();

    render(
      <TeamCard
        teamComp={teamComp}
        index={0}
        onUpdateComp={mockUpdate}
        onDelete={mockDelete}
        onCopy={mockCopy}
      />
    );

    expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
  });

  it("clears all team state", () => {
    act(() => {
      useTeamStore.getState().addTeam();
      useTeamStore.getState().addTeam();
      useTeamStore.getState().addTeam();
    });

    expect(useTeamStore.getState().teamComps).toHaveLength(3);

    act(() => {
      useTeamStore.getState().clearTeams();
    });

    expect(useTeamStore.getState().teamComps).toHaveLength(0);
    expect(useTeamStore.getState().configsByTeamId).toEqual({});
  });
});
