import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import type { ArtifactData, ReactionType } from "@/data/types";
import type {
  CalcContext,
  CombatOpts,
  ComboFormula,
  DamageResult,
  ReactionOverride,
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
  reactions: ReactionType[];
  opts: CombatOpts;
  targetEr: Record<string, number>;
  targetCr?: Record<string, number>;
  selectedFormula: { charId: string; formulaId: string } | null;
  optimizationResult: OptimizationResult | null;
  calcContext?: Partial<CalcContext>;
  /** Per-formula reaction overrides. Key format: "{charId}.{formulaId}" */
  reactionOverrides: Record<string, ReactionOverride>;
  /** Formula mode: single formula or combo rotation */
  formulaMode: "single" | "combo";
  /** Combo formulas for rotation modeling */
  combos: ComboFormula[];
  /** Active combo ID, null = single formula mode */
  selectedCombo: string | null;
}

/** Importable/exportable team composition envelope. Backwards-compatible with raw Team[]. */
export interface TeamCompData {
  teams: Team[];
  author?: string;
  description?: string;
}

interface TeamState {
  teams: Team[];
  activeTeamId: string | null;
  author: string;
  description: string;

  // Actions
  addTeam: (initialData?: Partial<Team>, position?: "start" | "end") => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  copyTeam: (id: string) => void;
  moveTeam: (id: string, direction: "up" | "down") => void;
  clearTeams: () => void;
  setActiveTeam: (id: string | null) => void;
  setMetadata: (author: string, description: string) => void;
  importTeams: (data: TeamCompData) => void;
  exportTeams: (author: string, description: string) => TeamCompData;
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set, get) => ({
      teams: [],
      activeTeamId: null,
      author: "",
      description: "",

      addTeam: (initialData, position = "end") => {
        const id = `team-${Date.now()}`;
        const newTeam: Team = {
          id,
          name: "",
          characters: [null, null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          reactions: [],
          opts: {},
          targetEr: {},
          targetCr: {},
          selectedFormula: null,
          optimizationResult: null,
          reactionOverrides: {},
          formulaMode: "single",
          combos: [],
          selectedCombo: null,
          ...initialData,
        };
        set((state) => {
          if (position === "start") {
            state.teams.unshift(newTeam);
          } else {
            state.teams.push(newTeam);
          }
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

      moveTeam: (id, direction) => {
        set((state) => {
          const index = state.teams.findIndex((t) => t.id === id);
          if (index === -1) return;
          const targetIndex = direction === "up" ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= state.teams.length) return;
          const temp = state.teams[index];
          state.teams[index] = state.teams[targetIndex];
          state.teams[targetIndex] = temp;
        });
      },

      clearTeams: () => {
        set((state) => {
          state.teams = [];
          state.activeTeamId = null;
          state.author = "";
          state.description = "";
        });
      },

      setActiveTeam: (id) => {
        set((state) => {
          state.activeTeamId = id;
        });
      },

      setMetadata: (author, description) => set({ author, description }),

      importTeams: (data) => {
        // Accept both envelope { teams, author?, description? } and legacy raw Team[]
        const teamsArr = Array.isArray(data) ? data : data.teams;
        const validTeams: Team[] = teamsArr
          .filter((t: Partial<Team>) => t.id && Array.isArray(t.characters))
          .map((t: Partial<Team>) => ({
            id: t.id!,
            name: t.name ?? "",
            characters: t.characters!,
            weapons: t.weapons ?? [null, null, null, null],
            artifacts: t.artifacts ?? [null, null, null, null],
            reactions: t.reactions ?? [],
            opts: t.opts ?? {},
            targetEr: t.targetEr ?? {},
            targetCr: (t as Team).targetCr ?? {},
            selectedFormula: t.selectedFormula ?? null,
            optimizationResult: null,
            calcContext: t.calcContext,
            reactionOverrides: t.reactionOverrides ?? {},
            formulaMode: (t as Team).formulaMode ?? "single",
            combos: t.combos ?? [],
            selectedCombo: t.selectedCombo ?? null,
          }));

        set((state) => {
          state.teams = validTeams;
          state.activeTeamId = null;
          if (!Array.isArray(data)) {
            state.author = data.author ?? "";
            state.description = data.description ?? "";
          }
        });
      },

      exportTeams: (author, description) => {
        const { teams } = get();
        // Drop optimization results to save space
        const exportable = teams.map((t) => ({
          ...t,
          optimizationResult: null,
        }));
        return { teams: exportable, author, description };
      },
    })),
    {
      name: "team-builder-storage",
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as TeamState;
        if (version < 1) {
          state.teams = state.teams.map((t) => ({
            ...t,
            reactions: (t as Team).reactions || [],
          }));
        }
        if (version < 2) {
          state.teams = state.teams.map((t) => ({
            ...t,
            reactionOverrides: (t as Team).reactionOverrides ?? {},
            combos: (t as Team).combos ?? [],
            selectedCombo: (t as Team).selectedCombo ?? null,
          }));
        }
        if (version < 3) {
          state.teams = state.teams.map((t) => ({
            ...t,
            formulaMode: (t as Team).formulaMode ?? "single",
          }));
        }
        return persisted as TeamState;
      },
    }
  )
);
