import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TierAssignment, TierCustomization } from '@/data/types';

interface WeaponTierListState {
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;

  // Actions
  setTierAssignments: (assignments: TierAssignment | ((prev: TierAssignment) => TierAssignment)) => void;
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

export const useWeaponTierStore = create<WeaponTierListState>()(
  persist(
    (set) => ({
      // Initial state
      tierAssignments: {},
      tierCustomization: {},
      customTitle: '',
      author: '',
      description: '',

      // Actions
      setTierAssignments: (assignments) =>
        set((state) => ({
          tierAssignments: typeof assignments === 'function'
            ? assignments(state.tierAssignments)
            : assignments
        })),

      setTierCustomization: (customization) =>
        set({ tierCustomization: customization }),

      setCustomTitle: (title) =>
        set({ customTitle: title }),

      resetTierList: () =>
        set({
          tierAssignments: {},
          tierCustomization: {},
          customTitle: '',
          author: '',
          description: '',
        }),

      loadTierListData: (data) =>
        set({
          tierAssignments: data.tierAssignments,
          tierCustomization: data.tierCustomization,
          customTitle: data.customTitle || '',
          author: data.author || '',
          description: data.description || '',
        }),
      
      setMetadata: (author, description) =>
        set({ author, description }),
    }),
    {
      name: 'weapon-tierlist-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        tierAssignments: state.tierAssignments,
        tierCustomization: state.tierCustomization,
        customTitle: state.customTitle,
        author: state.author,
        description: state.description,
      }),
    }
  )
);
