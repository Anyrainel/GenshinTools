import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ArtifactSetConfig } from "@/data/types";
// Team state shapes live in @/lib/team-comp/types so pure team logic across
// src/lib/ can depend on them without reaching into the stores layer.
import type { ExportedTeam, Team, TeamCompData } from "@/lib/team-comp/types";
import { mergeTeamStore, migrateTeamStore } from "./migration/team";
import { charSortKey, encodeTeamId } from "./teamCompCodec";
import { DEFAULT_TEAM_FIELDS } from "./teamDefaults";

interface TeamState {
  teams: Team[];
  author: string;
  description: string;

  // Selectors
  getTeamById: (id: string) => Team | undefined;

  // Actions
  addTeam: (initialData?: Partial<Team>, position?: "start" | "end") => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  copyTeam: (id: string) => void;
  moveTeam: (id: string, direction: "up" | "down") => void;
  /** Move team relative to an anchor team. Used by drag-and-drop. */
  moveTeamRelative: (
    id: string,
    anchorId: string,
    position: "before" | "after"
  ) => void;
  clearTeams: () => void;
  setMetadata: (author: string, description: string) => void;
  importTeams: (data: TeamCompData) => void;
  exportTeams: (author: string, description: string) => TeamCompData;
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set, get) => ({
      teams: [],
      author: "",
      description: "",

      getTeamById: (id) => get().teams.find((t) => t.id === id),

      addTeam: (initialData, position = "end") => {
        const id = `team-${Date.now()}`;
        const newTeam: Team = {
          id,
          name: "",
          characters: [null, null, null, null],
          weapons: [null, null, null, null],
          artifacts: [null, null, null, null],
          ...DEFAULT_TEAM_FIELDS,
          selectedFormula: null,
          optimizationResult: null,
          combo: null,
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

      moveTeamRelative: (id, anchorId, position) => {
        set((state) => {
          if (id === anchorId) return;
          const idx = state.teams.findIndex((t) => t.id === id);
          if (idx === -1) return;
          // Remove the team first
          const [team] = state.teams.splice(idx, 1);
          // Find anchor after removal (index may have shifted)
          const anchorIdx = state.teams.findIndex((t) => t.id === anchorId);
          if (anchorIdx === -1) return;
          const insertIdx = position === "after" ? anchorIdx + 1 : anchorIdx;
          state.teams.splice(insertIdx, 0, team);
        });
      },

      clearTeams: () => {
        set((state) => {
          state.teams = [];
          state.author = "";
          state.description = "";
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
                (a: any): ArtifactSetConfig | null => {
                  if (!a) return null;
                  if (a.type === "4pc" && "setId" in a)
                    return { type: "4pc", setId: a.setId };
                  if (a.type === "2pc+2pc" && a.halfSetIds)
                    return { type: "2pc+2pc", halfSetIds: a.halfSetIds };
                  // Legacy format without type discriminator
                  if ("setId" in a) return { type: "4pc", setId: a.setId };
                  // Legacy: { id1, id2 } → { halfSetIds }
                  if ("id1" in a)
                    return {
                      type: "2pc+2pc",
                      halfSetIds: [String(a.id1), String(a.id2)],
                    };
                  // Legacy: { halfSetIds } without type
                  if ("halfSetIds" in a)
                    return { type: "2pc+2pc", halfSetIds: a.halfSetIds };
                  return null;
                }
              ),
              reactions: t.reactions ?? [],
              opts: t.opts ?? {},
              selectedFormula: t.selectedFormula ?? null,
              optimizationResult: null,
              calcContext: t.calcContext,
              formulaMode: t.formulaMode ?? "combo",
              combo: t.combo ?? null,
            };
          });

        set((state) => {
          state.teams = validTeams;
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
              return { halfSetIds: a.halfSetIds };
            }),
          };
          if (t.reactions.length > 0) entry.reactions = t.reactions;
          if (t.charSettings) {
            const minEr: Record<string, number> = {};
            const minCr: Record<string, number> = {};
            for (const [cid, s] of Object.entries(t.charSettings)) {
              if (s.minEr != null) minEr[cid] = s.minEr;
              if (s.minCr != null) minCr[cid] = s.minCr;
            }
            if (Object.keys(minEr).length > 0) entry.minEr = minEr;
            if (Object.keys(minCr).length > 0) entry.minCr = minCr;
          }
          return entry;
        });
        return { teams: exportable, author, description };
      },
    })),
    {
      name: "team-builder-storage",
      version: 15,
      migrate: migrateTeamStore,
      partialize: (state) => ({
        teams: state.teams,
        author: state.author,
        description: state.description,
      }),
      merge: mergeTeamStore,
    }
  )
);
