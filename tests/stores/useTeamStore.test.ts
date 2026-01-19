import { useTeamStore } from "@/stores/useTeamStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test
beforeEach(() => {
  useTeamStore.getState().clearTeams();
});

describe("useTeamStore", () => {
  describe("initial state", () => {
    it("starts with empty teams array", () => {
      const state = useTeamStore.getState();
      expect(state.teams).toEqual([]);
    });
  });

  describe("addTeam", () => {
    it("creates a new team with default structure", () => {
      const id = useTeamStore.getState().addTeam();

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(1);
      expect(state.teams[0].id).toBe(id);
      expect(state.teams[0].name).toBe("");
      expect(state.teams[0].characters).toEqual([null, null, null, null]);
      expect(state.teams[0].weapons).toEqual([null, null, null, null]);
      expect(state.teams[0].artifacts).toEqual([null, null, null, null]);
    });

    it("returns the generated team ID", () => {
      const id = useTeamStore.getState().addTeam();

      expect(id).toMatch(/^team-\d+$/);
    });

    it("accepts initial data override", () => {
      const id = useTeamStore.getState().addTeam({
        name: "My Team",
        characters: ["hu_tao", null, null, null],
      });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.name).toBe("My Team");
      expect(team?.characters).toEqual(["hu_tao", null, null, null]);
      // Default slots should remain
      expect(team?.weapons).toEqual([null, null, null, null]);
    });

    it("generates unique IDs for rapid creates", async () => {
      const id1 = useTeamStore.getState().addTeam();
      // Small delay to ensure unique timestamp-based IDs
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam();

      expect(id1).not.toBe(id2);
      expect(useTeamStore.getState().teams.length).toBe(2);
    });
  });

  describe("updateTeam", () => {
    it("updates team name", () => {
      const id = useTeamStore.getState().addTeam();

      useTeamStore.getState().updateTeam(id, { name: "Updated Name" });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.name).toBe("Updated Name");
    });

    it("updates team characters", () => {
      const id = useTeamStore.getState().addTeam();

      useTeamStore.getState().updateTeam(id, {
        characters: ["hu_tao", "xingqiu", "zhongli", "yelan"],
      });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.characters).toEqual([
        "hu_tao",
        "xingqiu",
        "zhongli",
        "yelan",
      ]);
    });

    it("preserves other properties when partially updating", () => {
      const id = useTeamStore.getState().addTeam({
        name: "Original Name",
        characters: ["hu_tao", null, null, null],
      });

      useTeamStore.getState().updateTeam(id, { name: "New Name" });

      const team = useTeamStore.getState().teams.find((t) => t.id === id);
      expect(team?.characters).toEqual(["hu_tao", null, null, null]);
    });

    it("does nothing if team ID not found", () => {
      useTeamStore.getState().addTeam({ name: "Existing" });

      useTeamStore.getState().updateTeam("nonexistent-id", {
        name: "Should Not Appear",
      });

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(1);
      expect(state.teams[0].name).toBe("Existing");
    });
  });

  describe("deleteTeam", () => {
    it("removes team from store", () => {
      const id = useTeamStore.getState().addTeam();

      useTeamStore.getState().deleteTeam(id);

      expect(useTeamStore.getState().teams.length).toBe(0);
    });

    it("only removes the specified team", async () => {
      const id1 = useTeamStore.getState().addTeam({ name: "Team 1" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam({ name: "Team 2" });

      useTeamStore.getState().deleteTeam(id1);

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(1);
      expect(state.teams[0].id).toBe(id2);
      expect(state.teams[0].name).toBe("Team 2");
    });

    it("does nothing if team ID not found", () => {
      useTeamStore.getState().addTeam();

      useTeamStore.getState().deleteTeam("nonexistent-id");

      expect(useTeamStore.getState().teams.length).toBe(1);
    });
  });

  describe("copyTeam", () => {
    it("creates a copy with new ID", async () => {
      const originalId = useTeamStore.getState().addTeam({
        name: "Original",
        characters: ["hu_tao", "xingqiu", null, null],
      });

      // Delay to ensure unique timestamp-based ID
      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().copyTeam(originalId);

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(2);

      const copy = state.teams.find((t) => t.id !== originalId);
      expect(copy).toBeDefined();
      expect(copy?.id).not.toBe(originalId);
      expect(copy?.name).toBe("Original");
      expect(copy?.characters).toEqual(["hu_tao", "xingqiu", null, null]);
    });

    it("inserts copy immediately after original", async () => {
      const id1 = useTeamStore.getState().addTeam({ name: "Team 1" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = useTeamStore.getState().addTeam({ name: "Team 2" });
      await new Promise((resolve) => setTimeout(resolve, 5));

      useTeamStore.getState().copyTeam(id1);

      const state = useTeamStore.getState();
      expect(state.teams.length).toBe(3);
      expect(state.teams[0].id).toBe(id1);
      expect(state.teams[1].name).toBe("Team 1"); // Copy
      expect(state.teams[2].id).toBe(id2);
    });

    it("does nothing if team ID not found", () => {
      useTeamStore.getState().addTeam();

      useTeamStore.getState().copyTeam("nonexistent-id");

      expect(useTeamStore.getState().teams.length).toBe(1);
    });
  });

  describe("clearTeams", () => {
    it("removes all teams", async () => {
      useTeamStore.getState().addTeam();
      await new Promise((resolve) => setTimeout(resolve, 5));
      useTeamStore.getState().addTeam();

      useTeamStore.getState().clearTeams();

      expect(useTeamStore.getState().teams).toEqual([]);
    });
  });
});
