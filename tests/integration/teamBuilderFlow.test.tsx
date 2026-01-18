/**
 * Integration Tests: Team Builder Flow
 *
 * Tests the complete pipeline:
 * 1. Team store operations (add, update, delete, copy)
 * 2. Team persistence and state management
 * 3. TeamCard rendering with team data
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "../utils/render";

import { TeamCard } from "@/components/team-builder/TeamCard";
import { type Team, useTeamStore } from "@/stores/useTeamStore";

describe("Integration: Team Builder Flow", () => {
  beforeEach(() => {
    useTeamStore.getState().clearTeams();
  });

  it("creates a new team with default values", () => {
    act(() => {
      useTeamStore.getState().addTeam();
    });

    const teams = useTeamStore.getState().teams;
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe("");
    expect(teams[0].characters).toHaveLength(4);
    expect(teams[0].characters.every((c) => c === null)).toBe(true);
  });

  it("updates team name correctly", () => {
    act(() => {
      useTeamStore.getState().addTeam();
    });

    const teamId = useTeamStore.getState().teams[0].id;

    act(() => {
      useTeamStore.getState().updateTeam(teamId, { name: "National Team" });
    });

    const updatedTeam = useTeamStore.getState().teams[0];
    expect(updatedTeam.name).toBe("National Team");
  });

  it("assigns characters to team slots", () => {
    act(() => {
      useTeamStore.getState().addTeam();
    });

    const teamId = useTeamStore.getState().teams[0].id;

    act(() => {
      useTeamStore.getState().updateTeam(teamId, {
        characters: ["hu_tao", "xingqiu", "zhongli", "bennett"],
      });
    });

    const team = useTeamStore.getState().teams[0];
    expect(team.characters).toEqual([
      "hu_tao",
      "xingqiu",
      "zhongli",
      "bennett",
    ]);
  });

  it("copies team with all data", async () => {
    act(() => {
      useTeamStore.getState().addTeam();
    });

    const teamId = useTeamStore.getState().teams[0].id;

    act(() => {
      useTeamStore.getState().updateTeam(teamId, {
        name: "Hu Tao Vape",
        characters: ["hu_tao", "xingqiu", "zhongli", "bennett"],
      });
    });

    // Add delay to ensure different timestamp for copied team
    await new Promise((r) => setTimeout(r, 5));

    act(() => {
      useTeamStore.getState().copyTeam(teamId);
    });

    const teams = useTeamStore.getState().teams;
    expect(teams).toHaveLength(2);
    expect(teams[1].name).toBe("Hu Tao Vape");
    expect(teams[1].characters).toEqual([
      "hu_tao",
      "xingqiu",
      "zhongli",
      "bennett",
    ]);
    // Should have different IDs
    expect(teams[1].id).not.toBe(teams[0].id);
  });

  it("deletes team correctly", async () => {
    act(() => {
      useTeamStore.getState().addTeam();
    });

    // Add delay to ensure different timestamp for second team
    await new Promise((r) => setTimeout(r, 5));

    act(() => {
      useTeamStore.getState().addTeam();
    });

    expect(useTeamStore.getState().teams).toHaveLength(2);

    const teamToDelete = useTeamStore.getState().teams[0].id;

    act(() => {
      useTeamStore.getState().deleteTeam(teamToDelete);
    });

    expect(useTeamStore.getState().teams).toHaveLength(1);
  });

  it("renders TeamCard with team data", () => {
    const mockTeam: Team = {
      id: "test-team-1",
      name: "Test Team",
      characters: ["hu_tao", "xingqiu", null, null],
      weapons: [null, null, null, null],
      artifacts: [null, null, null, null],
    };

    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();
    const mockCopy = vi.fn();

    render(
      <TeamCard
        team={mockTeam}
        index={0}
        onUpdate={mockUpdate}
        onDelete={mockDelete}
        onCopy={mockCopy}
        isGhost={false}
      />
    );

    // Team name should be in input
    const nameInput = screen.getByDisplayValue("Test Team");
    expect(nameInput).toBeInTheDocument();
  });

  it("clears all teams", () => {
    act(() => {
      useTeamStore.getState().addTeam();
      useTeamStore.getState().addTeam();
      useTeamStore.getState().addTeam();
    });

    expect(useTeamStore.getState().teams).toHaveLength(3);

    act(() => {
      useTeamStore.getState().clearTeams();
    });

    expect(useTeamStore.getState().teams).toHaveLength(0);
  });
});
