import type { TierAssignment, TierCustomization } from "@/data/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WeaponTierListState {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
  showRarity5: boolean;
  showRarity4: boolean;
  showRarity3: boolean;

  // Actions
  setTierAssignments: (
    assignments: TierAssignment | ((prev: TierAssignment) => TierAssignment)
  ) => void;
  setTierCustomization: (customization: TierCustomization) => void;
  setCustomTitle: (title: string) => void;
  setShowRarity5: (show: boolean) => void;
  setShowRarity4: (show: boolean) => void;
  setShowRarity3: (show: boolean) => void;
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

export const useWeaponTierStore = create<WeaponTierListState>()(
  persist(
    (set) => ({
      // Initial state
      tierAssignments: {},
      tierCustomization: {},
      customTitle: "",
      author: "",
      description: "",
      showRarity5: true,
      showRarity4: true,
      showRarity3: true,

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

      setShowRarity5: (show) => set({ showRarity5: show }),

      setShowRarity4: (show) => set({ showRarity4: show }),

      setShowRarity3: (show) => set({ showRarity3: show }),

      resetTierList: () =>
        set({
          tierAssignments: {},
          tierCustomization: {},
          customTitle: "",
          author: "",
          description: "",
          showRarity5: true,
          showRarity4: true,
          showRarity3: true,
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
      name: "weapon-tierlist-storage", // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        tierAssignments: state.tierAssignments,
        tierCustomization: state.tierCustomization,
        customTitle: state.customTitle,
        author: state.author,
        description: state.description,
        showRarity5: state.showRarity5,
        showRarity4: state.showRarity4,
        showRarity3: state.showRarity3,
      }),
    }
  )
);
