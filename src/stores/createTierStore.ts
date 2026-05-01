import type { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TierAssignment, TierCustomization } from "@/data/types";
import { migrateGenericTierStore } from "./migration/tier";
import { PersistedGenericTierListStoreSchema } from "./schemas";

export interface TierListInstanceBase {
  id: number;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
}

/** Base state shared by character, weapon, and artifact tier-list stores. */
export interface TierStoreBase<
  TInstance extends TierListInstanceBase = TierListInstanceBase,
> {
  tierLists: Record<number, TInstance>;
  activeTierListId: number;
  nextId: number;

  setTierAssignments: (
    assignments: TierAssignment | ((prev: TierAssignment) => TierAssignment)
  ) => void;
  setTierCustomization: (customization: TierCustomization) => void;
  setCustomTitle: (title: string) => void;
  resetTierList: () => void;
  loadTierListData: (data: {
    tierAssignments: TierAssignment;
    tierCustomization: TierCustomization;
    customTitle?: string;
    author?: string;
    description?: string;
  }) => void;
  setMetadata: (author: string, description: string) => void;

  createTierList: (title?: string) => number;
  deleteTierList: (id: number) => void;
  setActiveTierList: (id: number) => void;
  renameTierList: (id: number, title: string) => void;
}

type StoreSet<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
type StoreGet<T> = () => T;

interface CreateTierStoreOptions<
  TState extends TierStoreBase<TInstance>,
  TInstance extends TierListInstanceBase,
  TPersisted,
> {
  /** localStorage key for persistence */
  storageKey: string;
  version?: number;
  migrate?: (persistedState: unknown, version: number) => unknown;
  persistedSchema?: z.ZodType<TPersisted>;
  /** Extra fields for newly created tier-list instances. */
  createInstanceExtra?: (
    id: number,
    title: string
  ) => Omit<Partial<TInstance>, keyof TierListInstanceBase>;
  /** Extra initial state fields beyond the base */
  extraState?: Partial<TState>;
  /** Extra actions beyond the base */
  extraActions?: (ctx: {
    set: StoreSet<TState>;
    get: StoreGet<TState>;
    updateTierList: (
      state: Pick<TState, "tierLists" | "activeTierListId">,
      id: number,
      patch: Partial<TInstance>
    ) => Partial<TState>;
    updateActiveTierList: (
      state: Pick<TState, "tierLists" | "activeTierListId">,
      patch: Partial<TInstance>
    ) => Partial<TState>;
    createEmptyInstance: (id: number, title?: string) => TInstance;
  }) => Partial<TState>;
  /** Extra fields to include in partialize (all base fields are always included) */
  extraPartialize?: (state: TState) => Partial<TState>;
}

function createBaseInstance(id: number, title = ""): TierListInstanceBase {
  return {
    id,
    tierAssignments: {},
    tierCustomization: {},
    customTitle: title,
    author: "",
    description: "",
  };
}

export function selectActiveTierList<
  TInstance extends TierListInstanceBase,
  TState extends Pick<
    TierStoreBase<TInstance>,
    "tierLists" | "activeTierListId"
  >,
>(state: TState): TInstance {
  return (
    state.tierLists[state.activeTierListId] ??
    (createBaseInstance(0) as TInstance)
  );
}

export function selectActiveTierAssignments<
  TInstance extends TierListInstanceBase,
  TState extends Pick<
    TierStoreBase<TInstance>,
    "tierLists" | "activeTierListId"
  >,
>(state: TState): TierAssignment {
  return selectActiveTierList(state).tierAssignments;
}

export function selectActiveTierCustomization<
  TInstance extends TierListInstanceBase,
  TState extends Pick<
    TierStoreBase<TInstance>,
    "tierLists" | "activeTierListId"
  >,
>(state: TState): TierCustomization {
  return selectActiveTierList(state).tierCustomization;
}

export function selectActiveTierTitle<
  TInstance extends TierListInstanceBase,
  TState extends Pick<
    TierStoreBase<TInstance>,
    "tierLists" | "activeTierListId"
  >,
>(state: TState): string {
  return selectActiveTierList(state).customTitle;
}

export function selectActiveTierAuthor<
  TInstance extends TierListInstanceBase,
  TState extends Pick<
    TierStoreBase<TInstance>,
    "tierLists" | "activeTierListId"
  >,
>(state: TState): string {
  return selectActiveTierList(state).author;
}

export function selectActiveTierDescription<
  TInstance extends TierListInstanceBase,
  TState extends Pick<
    TierStoreBase<TInstance>,
    "tierLists" | "activeTierListId"
  >,
>(state: TState): string {
  return selectActiveTierList(state).description;
}

export function createTierStore<
  TState extends TierStoreBase<TInstance>,
  TInstance extends TierListInstanceBase = TierListInstanceBase,
  TPersisted = z.infer<typeof PersistedGenericTierListStoreSchema>,
>(options: CreateTierStoreOptions<TState, TInstance, TPersisted>) {
  const createEmptyInstance = (id: number, title = ""): TInstance =>
    ({
      ...createBaseInstance(id, title),
      ...(options.createInstanceExtra?.(id, title) ?? {}),
    }) as TInstance;

  const updateTierList = (
    state: Pick<TState, "tierLists" | "activeTierListId">,
    id: number,
    patch: Partial<TInstance>
  ): Partial<TState> => {
    const current = state.tierLists[id] ?? createEmptyInstance(id);
    return {
      tierLists: {
        ...state.tierLists,
        [id]: { ...current, ...patch },
      },
    } as Partial<TState>;
  };

  const updateActiveTierList = (
    state: Pick<TState, "tierLists" | "activeTierListId">,
    patch: Partial<TInstance>
  ): Partial<TState> => updateTierList(state, state.activeTierListId, patch);

  const defaultInstance = createEmptyInstance(1);
  const defaultTierLists: Record<number, TInstance> = {
    1: defaultInstance,
  };

  const persistedSchema =
    options.persistedSchema ?? PersistedGenericTierListStoreSchema;

  return create<TState>()(
    persist(
      (set, get) => {
        const baseState: TierStoreBase<TInstance> = {
          tierLists: defaultTierLists,
          activeTierListId: 1,
          nextId: 2,

          setTierAssignments: (assignments) =>
            set((state) => {
              const current = selectActiveTierList(state);
              const tierAssignments =
                typeof assignments === "function"
                  ? assignments(current.tierAssignments)
                  : assignments;
              return updateActiveTierList(state, {
                tierAssignments,
              } as Partial<TInstance>);
            }),

          setTierCustomization: (tierCustomization) =>
            set((state) =>
              updateActiveTierList(state, {
                tierCustomization,
              } as Partial<TInstance>)
            ),

          setCustomTitle: (customTitle) =>
            set((state) =>
              updateActiveTierList(state, { customTitle } as Partial<TInstance>)
            ),

          resetTierList: () =>
            set((state) =>
              updateActiveTierList(state, {
                tierAssignments: {},
                tierCustomization: {},
                customTitle: "",
                author: "",
                description: "",
              } as Partial<TInstance>)
            ),

          loadTierListData: (data) =>
            set((state) =>
              updateActiveTierList(state, {
                tierAssignments: data.tierAssignments,
                tierCustomization: data.tierCustomization,
                customTitle: data.customTitle || "",
                author: data.author || "",
                description: data.description || "",
              } as Partial<TInstance>)
            ),

          setMetadata: (author, description) =>
            set((state) =>
              updateActiveTierList(state, {
                author,
                description,
              } as Partial<TInstance>)
            ),

          createTierList: (title?: string) => {
            const id = get().nextId;
            set(
              (state) =>
                ({
                  tierLists: {
                    ...state.tierLists,
                    [id]: createEmptyInstance(id, title ?? ""),
                  },
                  activeTierListId: id,
                  nextId: id + 1,
                }) as Partial<TState>
            );
            return id;
          },

          deleteTierList: (id) =>
            set((state) => {
              const ids = Object.keys(state.tierLists).map(Number);
              if (ids.length <= 1) return state;

              const { [id]: _, ...tierLists } = state.tierLists;
              const remainingIds = Object.keys(tierLists).map(Number);
              return {
                tierLists,
                activeTierListId:
                  state.activeTierListId === id
                    ? Math.min(...remainingIds)
                    : state.activeTierListId,
              } as Partial<TState>;
            }),

          setActiveTierList: (id) =>
            set((state) =>
              id in state.tierLists
                ? ({ activeTierListId: id } as Partial<TState>)
                : state
            ),

          renameTierList: (id, customTitle) =>
            set((state) => {
              if (!state.tierLists[id]) return state;
              return updateTierList(state, id, {
                customTitle,
              } as Partial<TInstance>);
            }),
        };

        const extra =
          options.extraActions?.({
            set,
            get,
            updateTierList,
            updateActiveTierList,
            createEmptyInstance,
          }) ?? {};

        return {
          ...baseState,
          ...(options.extraState ?? {}),
          ...extra,
        } as TState;
      },
      {
        name: options.storageKey,
        version: options.version ?? 1,
        migrate: options.migrate ?? migrateGenericTierStore,
        partialize: (state) => ({
          tierLists: state.tierLists,
          activeTierListId: state.activeTierListId,
          nextId: state.nextId,
          ...(options.extraPartialize?.(state) ?? {}),
        }),
        merge: (persistedState, currentState) => {
          const parsed = persistedSchema.safeParse(persistedState);
          const persisted = parsed.success ? parsed.data : {};
          const merged = {
            ...currentState,
            ...persisted,
          } as TState;

          if (
            typeof merged.tierLists !== "object" ||
            merged.tierLists == null
          ) {
            merged.tierLists = { ...defaultTierLists };
          }

          if (!(merged.activeTierListId in merged.tierLists)) {
            const ids = Object.keys(merged.tierLists).map(Number);
            merged.activeTierListId = ids.length > 0 ? Math.min(...ids) : 1;
            if (ids.length === 0) {
              merged.tierLists = { 1: createEmptyInstance(1) };
            }
          }

          return merged;
        },
      }
    )
  );
}
