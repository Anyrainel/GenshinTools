import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TierAssignment, TierCustomization } from "@/data/types";

/** Base state shared by both character and weapon tier stores. */
export interface TierStoreBase {
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

export function createTierStore<T extends TierStoreBase>(
  options: CreateTierStoreOptions<T>
) {
  return create<T>()(
    persist(
      (set) => {
        const baseState: TierStoreBase = {
          tierAssignments: {},
          tierCustomization: {},
          customTitle: "",
          author: "",
          description: "",

          setTierAssignments: (assignments) =>
            set((state) => ({
              ...state,
              tierAssignments:
                typeof assignments === "function"
                  ? assignments(state.tierAssignments)
                  : assignments,
            })),

          setTierCustomization: (customization) =>
            set({ tierCustomization: customization } as Partial<T>),

          setCustomTitle: (title) => set({ customTitle: title } as Partial<T>),

          resetTierList: () =>
            set({
              tierAssignments: {},
              tierCustomization: {},
              customTitle: "",
              author: "",
              description: "",
            } as Partial<T>),

          loadTierListData: (data) =>
            set({
              tierAssignments: data.tierAssignments,
              tierCustomization: data.tierCustomization,
              customTitle: data.customTitle || "",
              author: data.author || "",
              description: data.description || "",
            } as Partial<T>),

          setMetadata: (author, description) =>
            set({ author, description } as Partial<T>),
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
        partialize: (state) => ({
          tierAssignments: state.tierAssignments,
          tierCustomization: state.tierCustomization,
          customTitle: state.customTitle,
          author: state.author,
          description: state.description,
          ...(options.extraPartialize?.(state) ?? {}),
        }),
        merge: (persistedState, currentState) => {
          const merged = {
            ...currentState,
            ...(persistedState as object),
          } as T;
          // Ensure base fields have correct types
          if (
            typeof merged.tierAssignments !== "object" ||
            merged.tierAssignments == null
          )
            merged.tierAssignments = {};
          if (
            typeof merged.tierCustomization !== "object" ||
            merged.tierCustomization == null
          )
            merged.tierCustomization = {};
          if (typeof merged.customTitle !== "string") merged.customTitle = "";
          if (typeof merged.author !== "string") merged.author = "";
          if (typeof merged.description !== "string") merged.description = "";
          return merged;
        },
      }
    )
  );
}
