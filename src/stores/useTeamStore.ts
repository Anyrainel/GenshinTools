import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  createEmptyTeamComp,
  createTeamConfigsFromPresetPayload,
  createTeamPersistenceFromImportedData,
  dedupeTeamCompDeltasAgainstPreset,
  deleteTeamCompDelta,
  deriveTeamRuntimeFromDeltas,
  getTeamDeltaDisplayIndex,
  hasTeamCompPatch,
  hasTeamConfigPatch,
  isPresetTeamComp,
  legacyTeamToComp,
  legacyTeamToConfig,
  setTeamDeltaGlobalOrder,
  type TeamCompDelta,
  teamCompToArrays,
  teamCompToExportedTeam,
  upsertCustomTeamCompDelta,
} from "@/lib/team-comp/teamDeltas";
import {
  cacheTeamPreset,
  getCachedTeamPreset,
} from "@/lib/team-comp/teamPresetRegistry";
import type {
  ExportedTeam,
  Team,
  TeamCompData,
  TeamConfig,
} from "@/lib/team-comp/types";
import { mergeTeamStore, migrateTeamStore } from "./migration/team";
import { charSortKey, encodeTeamId } from "./teamCompCodec";
import {
  pickTeamResultCachePatch,
  useTeamResultCacheStore,
} from "./useTeamResultCacheStore";

let _teamIdSeq = 0;
function nextTeamId(): string {
  return `team-${Date.now()}${_teamIdSeq++}`;
}

interface TeamState {
  teams: Team[];
  author: string;
  description: string;
  activePresetId: string | null;
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamConfig>;

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
  subscribePreset: (presetId: string, data: TeamCompData) => void;
  hydratePreset: (presetId: string, data: TeamCompData) => void;
  exportTeams: (author: string, description: string) => TeamCompData;
}

function refreshDerivedTeamState(
  state: TeamState,
  preset = getCachedTeamPreset(state.activePresetId)
): void {
  state.teams = deriveTeamRuntimeFromDeltas(
    state.compDeltas,
    state.configsByTeamId,
    preset
  );
}

function dedupeTeamCompStateAgainstPreset(
  state: TeamState,
  preset: TeamCompData
): void {
  const { deltas, idMap } = dedupeTeamCompDeltasAgainstPreset(
    state.compDeltas,
    preset
  );
  state.compDeltas = deltas;
  for (const [fromId, toId] of Object.entries(idMap)) {
    if (fromId === toId) continue;
    const config = state.configsByTeamId[fromId];
    if (!config) continue;
    state.configsByTeamId[toId] = config;
    delete state.configsByTeamId[fromId];
  }
}

function reindexTeamOrder(
  state: TeamState,
  orderedIds: string[],
  preset = getCachedTeamPreset(state.activePresetId)
): void {
  state.compDeltas = setTeamDeltaGlobalOrder(
    state.compDeltas,
    orderedIds,
    preset
  );
}

function insertIdInOrder(
  currentIds: string[],
  id: string,
  position: "start" | "end"
): string[] {
  const withoutId = currentIds.filter((existing) => existing !== id);
  return position === "start" ? [id, ...withoutId] : [...withoutId, id];
}

function exportTeamWithStableId(team: Team): ExportedTeam {
  const comp = legacyTeamToComp(team);
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  return {
    ...teamCompToExportedTeam(comp),
    id: encodeTeamId(characters, weapons, artifacts),
  };
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set, get) => ({
      teams: [],
      author: "",
      description: "",
      activePresetId: null,
      compDeltas: [],
      configsByTeamId: {},

      getTeamById: (id) => get().teams.find((t) => t.id === id),

      addTeam: (initialData, position = "end") => {
        const id = initialData?.id ?? nextTeamId();
        const cachePatch = pickTeamResultCachePatch(initialData ?? {});
        set((state) => {
          const baseComp = createEmptyTeamComp(id);
          const draftTeam = {
            ...deriveTeamRuntimeFromDeltas(
              [{ kind: "custom", id, value: baseComp }],
              {},
              null
            )[0],
            ...initialData,
            id,
          };
          const comp = legacyTeamToComp(draftTeam);
          state.compDeltas = upsertCustomTeamCompDelta(state.compDeltas, comp);
          state.configsByTeamId[id] = legacyTeamToConfig(initialData ?? {});
          reindexTeamOrder(
            state,
            insertIdInOrder(
              state.teams.map((team) => team.id),
              id,
              position
            )
          );
          refreshDerivedTeamState(state);
        });
        if (cachePatch) {
          useTeamResultCacheStore.getState().patchForTeam(id, cachePatch);
        }
        return id;
      },

      updateTeam: (id, patch) => {
        set((state) => {
          const team = state.teams.find((t) => t.id === id);
          if (!team) return;

          const compChanged = hasTeamCompPatch(patch);
          const configChanged = hasTeamConfigPatch(patch);
          const cachePatch = pickTeamResultCachePatch(patch);

          if (!compChanged && !configChanged) {
            if (cachePatch) {
              useTeamResultCacheStore.getState().patchForTeam(id, cachePatch);
            }
            return;
          }

          const mergedTeam = { ...team, ...patch, id };
          const displayIndex =
            getTeamDeltaDisplayIndex(state.compDeltas, id) ??
            state.teams.findIndex((t) => t.id === id);

          if (compChanged) {
            state.compDeltas = upsertCustomTeamCompDelta(
              state.compDeltas,
              legacyTeamToComp(mergedTeam),
              displayIndex
            );
          }

          if (configChanged) {
            state.configsByTeamId[id] = legacyTeamToConfig(mergedTeam);
          }

          refreshDerivedTeamState(state);
          if (cachePatch) {
            useTeamResultCacheStore.getState().patchForTeam(id, cachePatch);
          }
        });
      },

      deleteTeam: (id) => {
        set((state) => {
          const preset = getCachedTeamPreset(state.activePresetId);
          const displayIndex =
            getTeamDeltaDisplayIndex(state.compDeltas, id) ??
            state.teams.findIndex((t) => t.id === id);
          if (isPresetTeamComp(state.compDeltas, preset, id)) {
            state.compDeltas = deleteTeamCompDelta(
              state.compDeltas,
              id,
              displayIndex
            );
          } else {
            state.compDeltas = state.compDeltas.filter(
              (delta) => !(delta.kind === "custom" && delta.id === id)
            );
          }
          delete state.configsByTeamId[id];
          refreshDerivedTeamState(state, preset);
          useTeamResultCacheStore.getState().clearForTeam(id);
        });
      },

      copyTeam: (id) => {
        set((state) => {
          const index = state.teams.findIndex((t) => t.id === id);
          if (index === -1) return;
          const source = state.teams[index];
          const newId = nextTeamId();
          const copiedTeam: Team = {
            ...source,
            id: newId,
            comp: { ...legacyTeamToComp(source), id: newId },
            optimizationResult: null,
            weaponChoiceResult: null,
          };
          state.compDeltas = upsertCustomTeamCompDelta(
            state.compDeltas,
            legacyTeamToComp(copiedTeam),
            index + 1
          );
          state.configsByTeamId[newId] = legacyTeamToConfig(copiedTeam);
          const nextOrder = state.teams.map((team) => team.id);
          nextOrder.splice(index + 1, 0, newId);
          reindexTeamOrder(state, nextOrder);
          refreshDerivedTeamState(state);
        });
      },

      moveTeam: (id, direction) => {
        set((state) => {
          const ids = state.teams.map((team) => team.id);
          const index = ids.indexOf(id);
          if (index === -1) return;
          const targetIndex = direction === "up" ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= ids.length) return;
          [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
          reindexTeamOrder(state, ids);
          refreshDerivedTeamState(state);
        });
      },

      moveTeamRelative: (id, anchorId, position) => {
        set((state) => {
          if (id === anchorId) return;
          const ids = state.teams.map((team) => team.id);
          const idx = ids.indexOf(id);
          if (idx === -1) return;
          ids.splice(idx, 1);
          const anchorIdx = ids.indexOf(anchorId);
          if (anchorIdx === -1) return;
          const insertIdx = position === "after" ? anchorIdx + 1 : anchorIdx;
          ids.splice(insertIdx, 0, id);
          reindexTeamOrder(state, ids);
          refreshDerivedTeamState(state);
        });
      },

      clearTeams: () => {
        set((state) => {
          state.teams = [];
          state.author = "";
          state.description = "";
          state.activePresetId = null;
          state.compDeltas = [];
          state.configsByTeamId = {};
          useTeamResultCacheStore.getState().clearAll();
        });
      },

      setMetadata: (author, description) => set({ author, description }),

      importTeams: (data) => {
        const imported = createTeamPersistenceFromImportedData(data);
        set((state) => {
          state.activePresetId = null;
          state.compDeltas = imported.compDeltas;
          state.configsByTeamId = imported.configsByTeamId;
          state.author = imported.author;
          state.description = imported.description;
          refreshDerivedTeamState(state, null);
          useTeamResultCacheStore.getState().clearAll();
        });
      },

      subscribePreset: (presetId, data) => {
        cacheTeamPreset(presetId, data);
        set((state) => {
          state.activePresetId = presetId;
          state.compDeltas = [];
          state.configsByTeamId = createTeamConfigsFromPresetPayload(data);
          state.author = data.author ?? "";
          state.description = data.description ?? "";
          dedupeTeamCompStateAgainstPreset(state, data);
          refreshDerivedTeamState(state, data);
          useTeamResultCacheStore.getState().clearAll();
        });
      },

      hydratePreset: (presetId, data) => {
        cacheTeamPreset(presetId, data);
        set((state) => {
          if (state.activePresetId !== presetId) return;
          dedupeTeamCompStateAgainstPreset(state, data);
          refreshDerivedTeamState(state, data);
        });
      },

      exportTeams: (author, description) => {
        const { teams } = get();
        const normalized = teams.map((team) => {
          const indices = [1, 2, 3].sort(
            (a, b) =>
              charSortKey(team.characters[a]) - charSortKey(team.characters[b])
          );
          return {
            ...team,
            characters: [
              team.characters[0],
              ...indices.map((i) => team.characters[i]),
            ],
            weapons: [team.weapons[0], ...indices.map((i) => team.weapons[i])],
            artifacts: [
              team.artifacts[0],
              ...indices.map((i) => team.artifacts[i]),
            ],
          };
        });
        const sorted = normalized.sort((a, b) => {
          const carryDiff =
            charSortKey(a.characters[0]) - charSortKey(b.characters[0]);
          if (carryDiff !== 0) return carryDiff;
          const idA = a.characters[0] ?? "";
          const idB = b.characters[0] ?? "";
          if (idA !== idB) return idA < idB ? -1 : 1;
          for (let i = 1; i < 4; i++) {
            const diff =
              charSortKey(a.characters[i]) - charSortKey(b.characters[i]);
            if (diff !== 0) return diff;
          }
          return 0;
        });
        return {
          teams: sorted.map(exportTeamWithStableId),
          author,
          description,
        };
      },
    })),
    {
      name: "team-builder-storage",
      version: 17,
      migrate: migrateTeamStore,
      partialize: (state) =>
        ({
          activePresetId: state.activePresetId,
          compDeltas: state.compDeltas,
          configsByTeamId: state.configsByTeamId,
          author: state.author,
          description: state.description,
        }) as unknown as ReturnType<typeof migrateTeamStore>,
      merge: mergeTeamStore,
    }
  )
);
