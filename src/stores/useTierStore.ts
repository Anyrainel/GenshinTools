import type { InvestmentThresholds, LuckExpectation } from "@/data/types";
import { DEFAULT_INVESTMENT_THRESHOLDS } from "@/data/types";
import { type TierStoreBase, createTierStore } from "./createTierStore";

interface TierListState extends TierStoreBase {
  investmentThresholds: InvestmentThresholds;
  showWeapons: boolean;
  showTravelers: boolean;
  showManekin: boolean;

  setTierLuckExpectation: (tier: string, luck: LuckExpectation) => void;
  setInvestmentThreshold: (
    key: keyof InvestmentThresholds,
    value: number
  ) => void;
  setShowWeapons: (show: boolean) => void;
  setShowTravelers: (show: boolean) => void;
  setShowManekin: (show: boolean) => void;
}

export const useTierStore = createTierStore<TierListState>({
  storageKey: "tierlist-storage",
  extraState: {
    investmentThresholds: { ...DEFAULT_INVESTMENT_THRESHOLDS },
    showWeapons: true,
    showTravelers: false,
    showManekin: false,
  },
  extraActions: (set) => ({
    setTierLuckExpectation: (tier, luck) =>
      set((state) => ({
        ...state,
        tierCustomization: {
          ...state.tierCustomization,
          [tier]: {
            ...state.tierCustomization[tier],
            displayName: state.tierCustomization[tier]?.displayName || tier,
            hidden: state.tierCustomization[tier]?.hidden || false,
            luckExpectation: luck,
          },
        },
      })),

    setInvestmentThreshold: (key, value) =>
      set((state) => ({
        ...state,
        investmentThresholds: {
          ...state.investmentThresholds,
          [key]: value,
        },
      })),

    setShowWeapons: (show) =>
      set({ showWeapons: show } as Partial<TierListState>),
    setShowTravelers: (show) =>
      set({ showTravelers: show } as Partial<TierListState>),
    setShowManekin: (show) =>
      set({ showManekin: show } as Partial<TierListState>),
  }),
  extraPartialize: (state) => ({
    investmentThresholds: state.investmentThresholds,
    showWeapons: state.showWeapons,
    showTravelers: state.showTravelers,
    showManekin: state.showManekin,
  }),
});
