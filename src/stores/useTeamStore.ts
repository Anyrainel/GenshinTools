import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface Team {
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactConfig | null)[];
}

interface TeamState {
  teams: Team[];

  // Actions
  addTeam: (initialData?: Partial<Team>) => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  copyTeam: (id: string) => void;
  clearTeams: () => void;
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set) => ({
      teams: [],

      addTeam: (initialData) => {
        const id = `team-${Date.now()}`;
        const newTeam: Team = {
          id,
          name: "",
          characters: [null, null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          ...initialData,
        };
        set((state) => {
          state.teams.push(newTeam);
        });
        return id;
      },

      updateTeam: (id, patch) => {
        set((state) => {
          const team = state.teams.find((t) => t.id === id);
          if (team) {
            Object.assign(team, patch);
          }
        });
      },

      deleteTeam: (id) => {
        set((state) => {
          state.teams = state.teams.filter((t) => t.id !== id);
        });
      },

      copyTeam: (id) => {
        set((state) => {
          const index = state.teams.findIndex((t) => t.id === id);
          if (index !== -1) {
            const team = state.teams[index];
            const newTeam = {
              ...team,
              id: `team-${Date.now()}`,
              name: team.name ? `${team.name}` : "",
            };
            state.teams.splice(index + 1, 0, newTeam);
          }
        });
      },

      clearTeams: () => {
        set((state) => {
          state.teams = [];
        });
      },
    })),
    {
      name: "team-builder-storage",
    }
  )
);
