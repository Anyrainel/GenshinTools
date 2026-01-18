import type { TierAssignment, TierCustomization } from "@/data/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TierListState {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  showWeapons: boolean;
  showTravelers: boolean;
  author: string;
  description: string;

  // Actions
  setTierAssignments: (
    assignments: TierAssignment | ((prev: TierAssignment) => TierAssignment)
  ) => void;
  setTierCustomization: (customization: TierCustomization) => void;
  setCustomTitle: (title: string) => void;
  setShowWeapons: (show: boolean) => void;
  setShowTravelers: (show: boolean) => void;
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

export const useTierStore = create<TierListState>()(
  persist(
    (set) => ({
      // Initial state
      tierAssignments: {},
      tierCustomization: {},
      customTitle: "",
      showWeapons: true, // Default to true
      showTravelers: false, // Default to false
      author: "",
      description: "",

      // Actions
      setTierAssignments: (assignments) =>
        set((state) => ({
          tierAssignments:
            typeof assignments === "function"
              ? assignments(state.tierAssignments)
              : assignments,
        })),

      setTierCustomization: (customization) =>
        set({ tierCustomization: customization }),

      setCustomTitle: (title) => set({ customTitle: title }),

      setShowWeapons: (show) => set({ showWeapons: show }),

      setShowTravelers: (show) => set({ showTravelers: show }),

      resetTierList: () =>
        set({
          tierAssignments: {},
          tierCustomization: {},
          customTitle: "",
          author: "",
          description: "",
          // Optionally reset visibility settings or keep them? Keeping them seems friendlier.
        }),

      loadTierListData: (data) =>
        set({
          tierAssignments: data.tierAssignments,
          tierCustomization: data.tierCustomization,
          customTitle: data.customTitle || "",
          author: data.author || "",
          description: data.description || "",
        }),

      setMetadata: (author, description) => set({ author, description }),
    }),
    {
      name: "tierlist-storage", // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        tierAssignments: state.tierAssignments,
        tierCustomization: state.tierCustomization,
        customTitle: state.customTitle,
        showWeapons: state.showWeapons,
        showTravelers: state.showTravelers,
        author: state.author,
        description: state.description,
      }),
    }
  )
);
