import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import type { ArtifactData } from "@/data/types";
import type {
  CalcContext,
  CombatOpts,
  DamageResult,
} from "@/lib/team-comp/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface OptimizationResult {
  artifacts: Record<string, ArtifactData>;
  damage: DamageResult;
  erTargets: Record<string, number>;
}

export interface Team {
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ArtifactConfig | null)[];
  opts: CombatOpts;
  targetEr: Record<string, number>;
  selectedFormula: { charId: string; formulaId: string } | null;
  optimizationResult: OptimizationResult | null;
  calcContext?: Partial<CalcContext>;
}

interface TeamState {
  teams: Team[];
  activeTeamId: string | null;

  // Actions
  addTeam: (initialData?: Partial<Team>) => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  copyTeam: (id: string) => void;
  clearTeams: () => void;
  setActiveTeam: (id: string | null) => void;
  importTeams: (json: string) => boolean;
  exportTeams: () => string;
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set, get) => ({
      teams: [],
      activeTeamId: null,

      addTeam: (initialData) => {
        const id = `team-${Date.now()}`;
        const newTeam: Team = {
          id,
          name: "",
          characters: [null, null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          opts: {},
          targetEr: {},
          selectedFormula: null,
          optimizationResult: null,
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
          if (state.activeTeamId === id) {
            state.activeTeamId = null;
          }
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
              optimizationResult: null, // Don't copy the optimization result as it might be stale
            };
            state.teams.splice(index + 1, 0, newTeam);
          }
        });
      },

      clearTeams: () => {
        set((state) => {
          state.teams = [];
          state.activeTeamId = null;
        });
      },

      setActiveTeam: (id) => {
        set((state) => {
          state.activeTeamId = id;
        });
      },

      importTeams: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed)) {
            // Very basic validation
            const validTeams: Team[] = parsed
              .filter((t) => t.id && Array.isArray(t.characters))
              .map((t) => ({
                ...t,
                opts: t.opts || {},
                targetEr: t.targetEr || {},
                selectedFormula: t.selectedFormula || null,
                optimizationResult: t.optimizationResult || null,
                calcContext: t.calcContext || undefined,
              }));

            if (validTeams.length > 0) {
              set((state) => {
                state.teams = validTeams;
                state.activeTeamId = null;
              });
              return true;
            }
          }
          return false;
        } catch (e) {
          console.error("Failed to import teams", e);
          return false;
        }
      },

      exportTeams: () => {
        const { teams } = get();
        // Export keeping only essential metadata, drop optimization results to save space
        const exportable = teams.map((t) => ({
          ...t,
          optimizationResult: null,
        }));
        return JSON.stringify(exportable, null, 2);
      },
    })),
    {
      name: "team-builder-storage",
    }
  )
);
