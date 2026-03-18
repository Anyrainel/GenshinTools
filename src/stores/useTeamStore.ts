import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import type { ArtifactData, Element, ReactionType } from "@/data/types";
import type { CombatOpts } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  ComboFormula,
  DamageResult,
  ReactionOverride,
} from "@/lib/team-comp/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { charSortKey, encodeTeamId } from "./teamCompCodec";

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
  minEr: Record<string, number>;
  minCr?: Record<string, number>;
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
  /** Persistent element aura on the enemy (e.g. Pyro Regisvine). Enables reactions the team can't otherwise trigger. */
  enemyElementAura?: Element;
}

/** Exported artifact — `type` discriminator omitted since field names differ. */
export type ExportedArtifact =
  | { setId: string }
  | { id1: string | number; id2: string | number };

/** Exported team shape — only composition metadata, no user/account state. */
export interface ExportedTeam {
  /** Stable base64 ID derived from the team composition. */
  id: string;
  name: string;
  characters: (string | null)[];
  weapons: (string | null)[];
  artifacts: (ExportedArtifact | null)[];
  reactions?: ReactionType[];
  minEr?: Record<string, number>;
  minCr?: Record<string, number>;
}

/** Importable/exportable team composition envelope. Backwards-compatible with raw Team[]. */
export interface TeamCompData {
  teams: ExportedTeam[];
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
          minEr: {},
          minCr: {},
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
          .filter(
            // biome-ignore lint/suspicious/noExplicitAny: imported JSON has unknown shape
            (t: any) => t.id && Array.isArray(t.characters)
          )
          // biome-ignore lint/suspicious/noExplicitAny: imported JSON has unknown shape
          .map((t: any) => {
            return {
              id: t.id,
              name: t.name ?? "",
              characters: t.characters,
              weapons: t.weapons ?? [null, null, null, null],
              artifacts: (t.artifacts ?? [null, null, null, null]).map(
                // biome-ignore lint/suspicious/noExplicitAny: imported JSON has unknown shape
                (a: any): ArtifactConfig | null => {
                  if (!a) return null;
                  if ("setId" in a) return { type: "4pc", setId: a.setId };
                  if ("id1" in a)
                    return { type: "2pc+2pc", id1: a.id1, id2: a.id2 };
                  return a; // already has type discriminator
                }
              ),
              reactions: t.reactions ?? [],
              opts: t.opts ?? {},
              // Support both new (minEr/minCr) and legacy (targetEr/targetCr) formats
              minEr: t.minEr ?? t.targetEr ?? {},
              minCr: t.minCr ?? t.targetCr ?? {},
              selectedFormula: t.selectedFormula ?? null,
              optimizationResult: null,
              calcContext: t.calcContext,
              reactionOverrides: t.reactionOverrides ?? {},
              formulaMode: t.formulaMode ?? "single",
              combos: t.combos ?? [],
              selectedCombo: t.selectedCombo ?? null,
            };
          });

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
        // First, normalize teammate order (slots 1-3) by release date desc
        const normalized = teams.map((t) => {
          const indices = [1, 2, 3].sort(
            (a, b) =>
              charSortKey(t.characters[a]) - charSortKey(t.characters[b])
          );
          return {
            ...t,
            characters: [
              t.characters[0],
              ...indices.map((i) => t.characters[i]),
            ],
            weapons: [t.weapons[0], ...indices.map((i) => t.weapons[i])],
            artifacts: [t.artifacts[0], ...indices.map((i) => t.artifacts[i])],
          };
        });
        // Sort teams by carry release date, then group by carry ID, then teammates
        const sorted = normalized.sort((a, b) => {
          // Primary: carry release date (newest first)
          const carryDiff =
            charSortKey(a.characters[0]) - charSortKey(b.characters[0]);
          if (carryDiff !== 0) return carryDiff;
          // Secondary: group same-date carries by ID so they stay together
          const idA = a.characters[0] ?? "";
          const idB = b.characters[0] ?? "";
          if (idA !== idB) return idA < idB ? -1 : 1;
          // Tertiary: teammates 1-3
          for (let i = 1; i < 4; i++) {
            const diff =
              charSortKey(a.characters[i]) - charSortKey(b.characters[i]);
            if (diff !== 0) return diff;
          }
          return 0;
        });
        // Export composition metadata with stable content-based IDs
        const exportable: ExportedTeam[] = sorted.map((t) => {
          const entry: ExportedTeam = {
            id: encodeTeamId(t.characters, t.weapons, t.artifacts),
            name: t.name,
            characters: t.characters,
            weapons: t.weapons,
            artifacts: t.artifacts.map((a) => {
              if (!a) return null;
              if (a.type === "4pc") return { setId: a.setId };
              return { id1: a.id1, id2: a.id2 };
            }),
          };
          if (t.reactions.length > 0) entry.reactions = t.reactions;
          if (t.minEr && Object.keys(t.minEr).length > 0) entry.minEr = t.minEr;
          if (t.minCr && Object.keys(t.minCr).length > 0) entry.minCr = t.minCr;
          return entry;
        });
        return { teams: exportable, author, description };
      },
    })),
    {
      name: "team-builder-storage",
      version: 4,
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
        if (version < 4) {
          // Rename targetEr/targetCr → minEr/minCr
          // biome-ignore lint/suspicious/noExplicitAny: migration from legacy field names
          state.teams = state.teams.map((t: any) => {
            const { targetEr, targetCr, ...rest } = t;
            return {
              ...rest,
              minEr: t.minEr ?? targetEr ?? {},
              minCr: t.minCr ?? targetCr ?? {},
            };
          });
        }
        return persisted as TeamState;
      },
    }
  )
);
