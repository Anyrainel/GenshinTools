import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LuckExpectation } from "@/data/enums";
import type { TierAssignment, TierCustomization } from "@/data/types";
import type { AccountProfileId } from "@/lib/account-data/types";
import { migrateTierStore } from "./migration/tier";
import { PersistedTierListStoreSchema } from "./schemas";

export interface TierListInstance {
  id: number;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
  linkedAccountId: AccountProfileId | null;
}

interface TierListState {
  // Multi-instance state
  tierLists: Record<number, TierListInstance>;
  activeTierListId: number;
  nextId: number;

  // View settings (store-level, not per-list)
  showWeapons: boolean;
  showTravelers: boolean;
  showManekin: boolean;

  // Derived fields from active list (backward-compatible selectors)
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;

  // Mutators that operate on active list
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
  setTierLuckExpectation: (tier: string, luck: LuckExpectation) => void;

  // View settings setters
  setShowWeapons: (show: boolean) => void;
  setShowTravelers: (show: boolean) => void;
  setShowManekin: (show: boolean) => void;

  // Multi-instance management
  createTierList: (title?: string) => number;
  deleteTierList: (id: number) => void;
  setActiveTierList: (id: number) => void;
  renameTierList: (id: number, title: string) => void;
  linkAccount: (tierListId: number, accountId: AccountProfileId | null) => void;
  renameLinkedAccount: (
    sourceAccountId: AccountProfileId,
    targetAccountId: AccountProfileId
  ) => void;
  findTierListByAccount: (accountId: AccountProfileId) => number | null;
}

// Helpers

function createEmptyInstance(id: number, title = ""): TierListInstance {
  return {
    id,
    tierAssignments: {},
    tierCustomization: {},
    customTitle: title,
    author: "",
    description: "",
    linkedAccountId: null,
  };
}

function deriveActiveFields(state: {
  tierLists: Record<number, TierListInstance>;
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

/** Update a field on the active instance and return the new tierLists + derived fields. */
function updateActiveInstance(
  state: Pick<TierListState, "tierLists" | "activeTierListId">,
  patch: Partial<TierListInstance>
) {
  const id = state.activeTierListId;
  const current = state.tierLists[id] ?? createEmptyInstance(id);
  const newTierLists = {
    ...state.tierLists,
    [id]: { ...current, ...patch },
  };
  const base = { tierLists: newTierLists, activeTierListId: id };
  return { ...base, ...deriveActiveFields(base) };
}

// Store

const defaultInstance = createEmptyInstance(1);
const defaultTierLists: Record<number, TierListInstance> = {
  1: defaultInstance,
};

export const useTierStore = create<TierListState>()(
  persist(
    (set, get) => ({
      // Multi-instance state
      tierLists: defaultTierLists,
      activeTierListId: 1,
      nextId: 2,

      // View settings
      showWeapons: true,
      showTravelers: false,
      showManekin: false,

      // Derived fields (from default instance)
      tierAssignments: defaultInstance.tierAssignments,
      tierCustomization: defaultInstance.tierCustomization,
      customTitle: defaultInstance.customTitle,
      author: defaultInstance.author,
      description: defaultInstance.description,

      // --- Mutators on active list ---

      setTierAssignments: (assignments) =>
        set((state) => {
          const id = state.activeTierListId;
          const current = state.tierLists[id] ?? createEmptyInstance(id);
          const newAssignments =
            typeof assignments === "function"
              ? assignments(current.tierAssignments)
              : assignments;
          return updateActiveInstance(state, {
            tierAssignments: newAssignments,
          });
        }),

      setTierCustomization: (customization) =>
        set((state) =>
          updateActiveInstance(state, { tierCustomization: customization })
        ),

      setCustomTitle: (title) =>
        set((state) => updateActiveInstance(state, { customTitle: title })),

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
        set((state) => updateActiveInstance(state, { author, description })),

      setTierLuckExpectation: (tier, luck) =>
        set((state) => {
          const id = state.activeTierListId;
          const current = state.tierLists[id] ?? createEmptyInstance(id);
          return updateActiveInstance(state, {
            tierCustomization: {
              ...current.tierCustomization,
              [tier]: {
                ...current.tierCustomization[tier],
                displayName:
                  current.tierCustomization[tier]?.displayName || tier,
                hidden: current.tierCustomization[tier]?.hidden || false,
                luckExpectation: luck,
              },
            },
          });
        }),

      // --- View settings setters ---

      setShowWeapons: (show) => set({ showWeapons: show }),
      setShowTravelers: (show) => set({ showTravelers: show }),
      setShowManekin: (show) => set({ showManekin: show }),

      // --- Multi-instance management ---

      createTierList: (title?: string) => {
        const id = get().nextId;
        set((state) => {
          const newInstance = createEmptyInstance(id, title ?? "");
          const newTierLists = { ...state.tierLists, [id]: newInstance };
          const base = {
            tierLists: newTierLists,
            activeTierListId: id,
            nextId: id + 1,
          };
          return { ...base, ...deriveActiveFields(base) };
        });
        return id;
      },

      deleteTierList: (id) =>
        set((state) => {
          const ids = Object.keys(state.tierLists).map(Number);
          if (ids.length <= 1) return state; // refuse to delete last list

          const { [id]: _, ...remaining } = state.tierLists;
          const remainingIds = Object.keys(remaining).map(Number);

          let newActiveId = state.activeTierListId;
          if (newActiveId === id) {
            // Switch to first remaining list
            newActiveId = Math.min(...remainingIds);
          }

          const base = {
            tierLists: remaining,
            activeTierListId: newActiveId,
          };
          return { ...base, ...deriveActiveFields(base) };
        }),

      setActiveTierList: (id) =>
        set((state) => {
          if (!(id in state.tierLists)) return state;
          const base = {
            tierLists: state.tierLists,
            activeTierListId: id,
          };
          return { ...base, ...deriveActiveFields(base) };
        }),

      renameTierList: (id, title) =>
        set((state) => {
          const inst = state.tierLists[id];
          if (!inst) return state;
          const newTierLists = {
            ...state.tierLists,
            [id]: { ...inst, customTitle: title },
          };
          const base = {
            tierLists: newTierLists,
            activeTierListId: state.activeTierListId,
          };
          return { ...base, ...deriveActiveFields(base) };
        }),

      linkAccount: (tierListId, accountId) =>
        set((state) => {
          const inst = state.tierLists[tierListId];
          if (!inst) return state;

          const newTierLists = { ...state.tierLists };

          // Unlink from any other list first
          if (accountId !== null) {
            for (const [key, list] of Object.entries(newTierLists)) {
              if (
                list.linkedAccountId === accountId &&
                Number(key) !== tierListId
              ) {
                newTierLists[Number(key)] = {
                  ...list,
                  linkedAccountId: null,
                };
              }
            }
          }

          newTierLists[tierListId] = { ...inst, linkedAccountId: accountId };

          const base = {
            tierLists: newTierLists,
            activeTierListId: state.activeTierListId,
          };
          return { ...base, ...deriveActiveFields(base) };
        }),

      renameLinkedAccount: (sourceAccountId, targetAccountId) =>
        set((state) => {
          if (sourceAccountId === targetAccountId) return state;
          let changed = false;
          let sourceListId: number | null = null;
          const newTierLists = { ...state.tierLists };

          for (const [key, list] of Object.entries(state.tierLists)) {
            const id = Number(key);
            if (list.linkedAccountId === sourceAccountId) {
              sourceListId = id;
            }
          }
          if (sourceListId === null) return state;

          for (const [key, list] of Object.entries(state.tierLists)) {
            const id = Number(key);
            if (id === sourceListId) {
              if (list.linkedAccountId !== targetAccountId) {
                newTierLists[id] = {
                  ...list,
                  linkedAccountId: targetAccountId,
                };
                changed = true;
              }
            } else if (list.linkedAccountId === targetAccountId) {
              newTierLists[id] = { ...list, linkedAccountId: null };
              changed = true;
            }
          }

          if (!changed) return state;
          const base = {
            tierLists: newTierLists,
            activeTierListId: state.activeTierListId,
          };
          return { ...base, ...deriveActiveFields(base) };
        }),

      findTierListByAccount: (accountId) => {
        const state = get();
        for (const list of Object.values(state.tierLists)) {
          if (list.linkedAccountId === accountId) return list.id;
        }
        return null;
      },
    }),
    {
      name: "tierlist-storage",
      version: 3,
      migrate: migrateTierStore,
      partialize: (state) => ({
        tierLists: state.tierLists,
        activeTierListId: state.activeTierListId,
        nextId: state.nextId,
        showWeapons: state.showWeapons,
        showTravelers: state.showTravelers,
        showManekin: state.showManekin,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedTierListStoreSchema.safeParse(persistedState);
        const persisted = parsed.success ? parsed.data : {};
        const merged = { ...currentState, ...persisted } as TierListState;

        // Ensure tierLists is a valid object
        if (typeof merged.tierLists !== "object" || merged.tierLists == null) {
          merged.tierLists = { ...defaultTierLists };
        }

        // Ensure activeTierListId points to a valid list
        if (!(merged.activeTierListId in merged.tierLists)) {
          const ids = Object.keys(merged.tierLists).map(Number);
          merged.activeTierListId = ids.length > 0 ? Math.min(...ids) : 1;
          if (ids.length === 0) {
            merged.tierLists = { 1: createEmptyInstance(1) };
          }
        }

        // Recompute derived fields
        const derived = deriveActiveFields(merged);
        merged.tierAssignments = derived.tierAssignments;
        merged.tierCustomization = derived.tierCustomization;
        merged.customTitle = derived.customTitle;
        merged.author = derived.author;
        merged.description = derived.description;

        return merged;
      },
    }
  )
);
