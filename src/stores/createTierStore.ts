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

/** Base state shared by weapon and artifact tier-list stores. */
export interface TierStoreBase {
  tierLists: Record<number, TierListInstanceBase>;
  activeTierListId: number;
  nextId: number;

  // Derived fields from active list for existing page selectors.
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;

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

interface CreateTierStoreOptions<T extends TierStoreBase> {
  /** localStorage key for persistence */
  storageKey: string;
  /** Extra initial state fields beyond the base */
  extraState?: Partial<T>;
  /** Extra actions beyond the base */
  extraActions?: (
    set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void
  ) => Partial<T>;
  /** Extra fields to include in partialize (all base fields are always included) */
  extraPartialize?: (state: T) => Partial<T>;
}

function createEmptyInstance(id: number, title = ""): TierListInstanceBase {
  return {
    id,
    tierAssignments: {},
    tierCustomization: {},
    customTitle: title,
    author: "",
    description: "",
  };
}

function deriveActiveFields(state: {
  tierLists: Record<number, TierListInstanceBase>;
  activeTierListId: number;
}) {
  const inst =
    state.tierLists[state.activeTierListId] ?? createEmptyInstance(0);
  return {
    tierAssignments: inst.tierAssignments,
    tierCustomization: inst.tierCustomization,
    customTitle: inst.customTitle,
    author: inst.author,
    description: inst.description,
  };
}

function updateActiveInstance<T extends TierStoreBase>(
  state: Pick<T, "tierLists" | "activeTierListId">,
  patch: Partial<TierListInstanceBase>
): Partial<T> {
  const id = state.activeTierListId;
  const current = state.tierLists[id] ?? createEmptyInstance(id);
  const tierLists = {
    ...state.tierLists,
    [id]: { ...current, ...patch },
  };
  const base = { tierLists, activeTierListId: id };
  return { ...base, ...deriveActiveFields(base) } as Partial<T>;
}

const defaultInstance = createEmptyInstance(1);
const defaultTierLists: Record<number, TierListInstanceBase> = {
  1: defaultInstance,
};

export function createTierStore<T extends TierStoreBase>(
  options: CreateTierStoreOptions<T>
) {
  return create<T>()(
    persist(
      (set, get) => {
        const baseState: TierStoreBase = {
          tierLists: defaultTierLists,
          activeTierListId: 1,
          nextId: 2,

          tierAssignments: defaultInstance.tierAssignments,
          tierCustomization: defaultInstance.tierCustomization,
          customTitle: defaultInstance.customTitle,
          author: defaultInstance.author,
          description: defaultInstance.description,

          setTierAssignments: (assignments) =>
            set((state) => {
              const id = state.activeTierListId;
              const current = state.tierLists[id] ?? createEmptyInstance(id);
              const tierAssignments =
                typeof assignments === "function"
                  ? assignments(current.tierAssignments)
                  : assignments;
              return updateActiveInstance(state, { tierAssignments });
            }),

          setTierCustomization: (tierCustomization) =>
            set((state) => updateActiveInstance(state, { tierCustomization })),

          setCustomTitle: (customTitle) =>
            set((state) => updateActiveInstance(state, { customTitle })),

          resetTierList: () =>
            set((state) =>
              updateActiveInstance(state, {
                tierAssignments: {},
                tierCustomization: {},
                customTitle: "",
                author: "",
                description: "",
              })
            ),

          loadTierListData: (data) =>
            set((state) =>
              updateActiveInstance(state, {
                tierAssignments: data.tierAssignments,
                tierCustomization: data.tierCustomization,
                customTitle: data.customTitle || "",
                author: data.author || "",
                description: data.description || "",
              })
            ),

          setMetadata: (author, description) =>
            set((state) =>
              updateActiveInstance(state, { author, description })
            ),

          createTierList: (title?: string) => {
            const id = get().nextId;
            set((state) => {
              const tierLists = {
                ...state.tierLists,
                [id]: createEmptyInstance(id, title ?? ""),
              };
              const base = {
                tierLists,
                activeTierListId: id,
                nextId: id + 1,
              };
              return { ...base, ...deriveActiveFields(base) } as Partial<T>;
            });
            return id;
          },

          deleteTierList: (id) =>
            set((state) => {
              const ids = Object.keys(state.tierLists).map(Number);
              if (ids.length <= 1) return state;

              const { [id]: _, ...tierLists } = state.tierLists;
              const remainingIds = Object.keys(tierLists).map(Number);
              const activeTierListId =
                state.activeTierListId === id
                  ? Math.min(...remainingIds)
                  : state.activeTierListId;
              const base = { tierLists, activeTierListId };
              return { ...base, ...deriveActiveFields(base) } as Partial<T>;
            }),

          setActiveTierList: (id) =>
            set((state) => {
              if (!(id in state.tierLists)) return state;
              const base = {
                tierLists: state.tierLists,
                activeTierListId: id,
              };
              return { ...base, ...deriveActiveFields(base) } as Partial<T>;
            }),

          renameTierList: (id, title) =>
            set((state) => {
              const inst = state.tierLists[id];
              if (!inst) return state;
              const tierLists = {
                ...state.tierLists,
                [id]: { ...inst, customTitle: title },
              };
              const base = {
                tierLists,
                activeTierListId: state.activeTierListId,
              };
              return { ...base, ...deriveActiveFields(base) } as Partial<T>;
            }),
        };

        const extra = options.extraActions?.(set) ?? {};

        return {
          ...baseState,
          ...(options.extraState ?? {}),
          ...extra,
        } as T;
      },
      {
        name: options.storageKey,
        version: 1,
        migrate: migrateGenericTierStore,
        partialize: (state) => ({
          tierLists: state.tierLists,
          activeTierListId: state.activeTierListId,
          nextId: state.nextId,
          ...(options.extraPartialize?.(state) ?? {}),
        }),
        merge: (persistedState, currentState) => {
          const parsed =
            PersistedGenericTierListStoreSchema.safeParse(persistedState);
          const persisted = parsed.success ? parsed.data : {};
          const merged = {
            ...currentState,
            ...persisted,
          } as T;

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

          return {
            ...merged,
            ...deriveActiveFields(merged),
          };
        },
      }
    )
  );
}
