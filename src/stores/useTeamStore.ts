import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  compactTeamSetupConfig,
  compactTeamSetupConfigs,
  createEmptyTeamComp,
  createTeamPersistenceFromImportedData,
  createTeamSetupConfigsFromPresetPayload,
  dedupeTeamCompDeltasAgainstPreset,
  deleteTeamCompDelta,
  deriveTeamCompsFromDeltas,
  getTeamDeltaDisplayIndex,
  getTeamEffectiveDisplayIndex,
  isPresetTeamComp,
  normalizeTeamSetupConfig,
  setTeamDeltaGlobalOrder,
  type TeamCompDelta,
  teamCompInputToComp,
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
  TeamAddInput,
  TeamComp,
  TeamCompData,
  TeamSetupConfig,
} from "@/lib/team-comp/types";
import { mergeTeamStore, migrateTeamStore } from "./migration/team";
import { charSortKey, encodeTeamId } from "./teamCompCodec";
import { useTeamResultCacheStore } from "./useTeamResultCacheStore";

let _teamIdSeq = 0;
function nextTeamId(): string {
  return `team-${Date.now()}${_teamIdSeq++}`;
}

export type TeamSourceState = {
  activePresetId: string | null;
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;
  author: string;
  description: string;
  updatedAt: number;
};

interface TeamState {
  teamComps: TeamComp[];
  teamCompById: Record<string, TeamComp>;
  author: string;
  description: string;
  updatedAt: number;
  activePresetId: string | null;
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;

  // Selectors
  getTeamCompById: (id: string) => TeamComp | undefined;
  getTeamSetupConfigById: (id: string) => TeamSetupConfig;

  // Actions
  addTeam: (initialData?: TeamAddInput, position?: "start" | "end") => string;
  updateTeamComp: (
    id: string,
    updater: Partial<TeamComp> | ((comp: TeamComp) => TeamComp)
  ) => void;
  updateTeamSetupConfig: (
    id: string,
    updater:
      | Partial<TeamSetupConfig>
      | ((config: TeamSetupConfig) => TeamSetupConfig)
  ) => void;
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
  replaceSourceState: (source: TeamSourceState) => void;
  subscribePreset: (presetId: string, data: TeamCompData) => void;
  hydratePreset: (presetId: string, data: TeamCompData) => void;
  exportTeams: (author: string, description: string) => TeamCompData;
}

function refreshDerivedTeamState(
  state: TeamState,
  preset = getCachedTeamPreset(state.activePresetId)
): void {
  state.teamComps = deriveTeamCompsFromDeltas(state.compDeltas, preset);
  state.teamCompById = Object.fromEntries(
    state.teamComps.map((team) => [team.id, team])
  );
}

function touchTeamState(state: Pick<TeamState, "updatedAt">): void {
  state.updatedAt = Date.now();
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
    const config = compactTeamSetupConfig(state.configsByTeamId[fromId]);
    if (config) {
      state.configsByTeamId[toId] = config;
    } else {
      delete state.configsByTeamId[toId];
    }
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

function getSetupConfig(
  configsByTeamId: Record<string, TeamSetupConfig>,
  teamId: string
): TeamSetupConfig {
  return normalizeTeamSetupConfig(configsByTeamId[teamId] ?? {});
}

function exportTeamWithStableId(comp: TeamComp): ExportedTeam {
  const { characters, weapons, artifacts } = teamCompToArrays(comp);
  return {
    ...teamCompToExportedTeam(comp),
    id: encodeTeamId(characters, weapons, artifacts),
  };
}

export const useTeamStore = create<TeamState>()(
  persist(
    immer((set, get) => ({
      teamComps: [],
      teamCompById: {},
      author: "",
      description: "",
      updatedAt: Date.now(),
      activePresetId: null,
      compDeltas: [],
      configsByTeamId: {},

      getTeamCompById: (id) => get().teamCompById[id],
      getTeamSetupConfigById: (id) => getSetupConfig(get().configsByTeamId, id),

      addTeam: (initialData, position = "end") => {
        const id = initialData?.id ?? nextTeamId();
        set((state) => {
          const comp =
            initialData != null
              ? teamCompInputToComp({ ...initialData, id })
              : createEmptyTeamComp(id);
          state.compDeltas = upsertCustomTeamCompDelta(state.compDeltas, comp);
          const setupConfig = compactTeamSetupConfig(
            initialData?.setupConfig ?? {}
          );
          if (setupConfig) {
            state.configsByTeamId[id] = setupConfig;
          } else {
            delete state.configsByTeamId[id];
          }
          reindexTeamOrder(
            state,
            insertIdInOrder(
              state.teamComps.map((team) => team.id),
              id,
              position
            )
          );
          refreshDerivedTeamState(state);
          touchTeamState(state);
        });
        return id;
      },

      updateTeamComp: (id, updater) => {
        set((state) => {
          const comp = state.teamCompById[id];
          if (!comp) return;
          const preset = getCachedTeamPreset(state.activePresetId);
          const displayIndex =
            getTeamEffectiveDisplayIndex(state.compDeltas, preset, id) ??
            state.teamComps.findIndex((team) => team.id === id);
          const nextComp =
            typeof updater === "function"
              ? updater(comp)
              : { ...comp, ...updater, id };
          state.compDeltas = upsertCustomTeamCompDelta(
            state.compDeltas,
            nextComp,
            displayIndex
          );
          refreshDerivedTeamState(state);
          touchTeamState(state);
        });
      },

      updateTeamSetupConfig: (id, updater) => {
        set((state) => {
          const comp = state.teamCompById[id];
          if (!comp) return;
          const current = getSetupConfig(state.configsByTeamId, id);
          const nextConfig = compactTeamSetupConfig(
            typeof updater === "function"
              ? updater(current)
              : { ...current, ...updater }
          );
          if (nextConfig) {
            state.configsByTeamId[id] = nextConfig;
          } else {
            delete state.configsByTeamId[id];
          }
          refreshDerivedTeamState(state);
          touchTeamState(state);
        });
      },

      deleteTeam: (id) => {
        set((state) => {
          const preset = getCachedTeamPreset(state.activePresetId);
          const displayIndex =
            getTeamDeltaDisplayIndex(state.compDeltas, id) ??
            state.teamComps.findIndex((team) => team.id === id);
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
          touchTeamState(state);
          useTeamResultCacheStore.getState().clearForTeam(id);
        });
      },

      copyTeam: (id) => {
        set((state) => {
          const index = state.teamComps.findIndex((t) => t.id === id);
          if (index === -1) return;
          const source = state.teamComps[index];
          const newId = nextTeamId();
          const copiedComp = { ...source, id: newId };
          state.compDeltas = upsertCustomTeamCompDelta(
            state.compDeltas,
            copiedComp,
            index + 1
          );
          const setupConfig = compactTeamSetupConfig(
            getSetupConfig(state.configsByTeamId, id)
          );
          if (setupConfig) {
            state.configsByTeamId[newId] = setupConfig;
          } else {
            delete state.configsByTeamId[newId];
          }
          const nextOrder = state.teamComps.map((team) => team.id);
          nextOrder.splice(index + 1, 0, newId);
          reindexTeamOrder(state, nextOrder);
          refreshDerivedTeamState(state);
          touchTeamState(state);
        });
      },

      moveTeam: (id, direction) => {
        set((state) => {
          const ids = state.teamComps.map((team) => team.id);
          const index = ids.indexOf(id);
          if (index === -1) return;
          const targetIndex = direction === "up" ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= ids.length) return;
          [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
          reindexTeamOrder(state, ids);
          refreshDerivedTeamState(state);
          touchTeamState(state);
        });
      },

      moveTeamRelative: (id, anchorId, position) => {
        set((state) => {
          if (id === anchorId) return;
          const ids = state.teamComps.map((team) => team.id);
          const idx = ids.indexOf(id);
          if (idx === -1) return;
          ids.splice(idx, 1);
          const anchorIdx = ids.indexOf(anchorId);
          if (anchorIdx === -1) return;
          const insertIdx = position === "after" ? anchorIdx + 1 : anchorIdx;
          ids.splice(insertIdx, 0, id);
          reindexTeamOrder(state, ids);
          refreshDerivedTeamState(state);
          touchTeamState(state);
        });
      },

      clearTeams: () => {
        set((state) => {
          state.teamComps = [];
          state.teamCompById = {};
          state.author = "";
          state.description = "";
          state.activePresetId = null;
          state.compDeltas = [];
          state.configsByTeamId = {};
          touchTeamState(state);
          useTeamResultCacheStore.getState().clearAll();
        });
      },

      setMetadata: (author, description) =>
        set({ author, description, updatedAt: Date.now() }),

      importTeams: (data) => {
        const imported = createTeamPersistenceFromImportedData(data);
        set((state) => {
          state.activePresetId = null;
          state.compDeltas = imported.compDeltas;
          state.configsByTeamId = compactTeamSetupConfigs(
            imported.configsByTeamId
          );
          state.author = imported.author;
          state.description = imported.description;
          refreshDerivedTeamState(state, null);
          touchTeamState(state);
          useTeamResultCacheStore.getState().clearAll();
        });
      },

      replaceSourceState: (source) => {
        set((state) => {
          state.activePresetId = source.activePresetId;
          state.compDeltas = source.compDeltas;
          state.configsByTeamId = compactTeamSetupConfigs(
            source.configsByTeamId
          );
          state.author = source.author;
          state.description = source.description;
          state.updatedAt = source.updatedAt;
          refreshDerivedTeamState(state);
          useTeamResultCacheStore.getState().clearAll();
        });
      },

      subscribePreset: (presetId, data) => {
        cacheTeamPreset(presetId, data);
        set((state) => {
          state.activePresetId = presetId;
          state.compDeltas = [];
          state.configsByTeamId = createTeamSetupConfigsFromPresetPayload(data);
          state.author = data.author ?? "";
          state.description = data.description ?? "";
          dedupeTeamCompStateAgainstPreset(state, data);
          refreshDerivedTeamState(state, data);
          touchTeamState(state);
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
        const { teamComps } = get();
        const normalized = teamComps.map((team) => {
          const { characters, weapons, artifacts } = teamCompToArrays(team);
          const indices = [1, 2, 3].sort(
            (a, b) => charSortKey(characters[a]) - charSortKey(characters[b])
          );
          return teamCompInputToComp({
            ...team,
            characters: [characters[0], ...indices.map((i) => characters[i])],
            weapons: [weapons[0], ...indices.map((i) => weapons[i])],
            artifacts: [artifacts[0], ...indices.map((i) => artifacts[i])],
          });
        });
        const sorted = normalized.sort((a, b) => {
          const aArrays = teamCompToArrays(a);
          const bArrays = teamCompToArrays(b);
          const carryDiff =
            charSortKey(aArrays.characters[0]) -
            charSortKey(bArrays.characters[0]);
          if (carryDiff !== 0) return carryDiff;
          const idA = aArrays.characters[0] ?? "";
          const idB = bArrays.characters[0] ?? "";
          if (idA !== idB) return idA < idB ? -1 : 1;
          for (let i = 1; i < 4; i++) {
            const diff =
              charSortKey(aArrays.characters[i]) -
              charSortKey(bArrays.characters[i]);
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
      version: 18,
      migrate: migrateTeamStore,
      partialize: (state) =>
        ({
          activePresetId: state.activePresetId,
          compDeltas: state.compDeltas,
          configsByTeamId: state.configsByTeamId,
          author: state.author,
          description: state.description,
          updatedAt: state.updatedAt,
        }) as unknown as ReturnType<typeof migrateTeamStore>,
      merge: mergeTeamStore,
    }
  )
);
