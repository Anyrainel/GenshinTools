import type { LuckExpectation } from "@/data/enums";
import type { AccountProfileId } from "@/lib/account-data/types";
import {
  createTierStore,
  type TierListInstanceBase,
  type TierStoreBase,
} from "./createTierStore";
import { migrateTierStore } from "./migration/tier";
import { PersistedTierListStoreSchema } from "./schemas";

export interface TierListInstance extends TierListInstanceBase {
  linkedAccountId: AccountProfileId | null;
}

interface TierListState extends TierStoreBase<TierListInstance> {
  showWeapons: boolean;
  showTravelers: boolean;
  showManekin: boolean;

  setTierLuckExpectation: (tier: string, luck: LuckExpectation) => void;
  setShowWeapons: (show: boolean) => void;
  setShowTravelers: (show: boolean) => void;
  setShowManekin: (show: boolean) => void;
  linkAccount: (tierListId: number, accountId: AccountProfileId | null) => void;
  renameLinkedAccount: (
    sourceAccountId: AccountProfileId,
    targetAccountId: AccountProfileId
  ) => void;
  findTierListByAccount: (accountId: AccountProfileId) => number | null;
}

export const useTierStore = createTierStore<TierListState, TierListInstance>({
  storageKey: "tierlist-storage",
  version: 4,
  migrate: migrateTierStore,
  persistedSchema: PersistedTierListStoreSchema,
  createInstanceExtra: () => ({ linkedAccountId: null }),
  extraState: {
    showWeapons: true,
    showTravelers: false,
    showManekin: false,
  },
  extraPartialize: (state) => ({
    showWeapons: state.showWeapons,
    showTravelers: state.showTravelers,
    showManekin: state.showManekin,
  }),
  extraActions: ({
    set,
    get,
    updateTierList,
    updateActiveTierList,
    createEmptyInstance,
  }) => ({
    setTierLuckExpectation: (tier, luck) =>
      set((state) => {
        const current =
          state.tierLists[state.activeTierListId] ??
          createEmptyInstance(state.activeTierListId);
        return updateActiveTierList(state, {
          tierCustomization: {
            ...current.tierCustomization,
            [tier]: {
              ...current.tierCustomization[tier],
              displayName: current.tierCustomization[tier]?.displayName || tier,
              hidden: current.tierCustomization[tier]?.hidden || false,
              luckExpectation: luck,
            },
          },
        });
      }),

    setShowWeapons: (show) => set({ showWeapons: show }),
    setShowTravelers: (show) => set({ showTravelers: show }),
    setShowManekin: (show) => set({ showManekin: show }),

    linkAccount: (tierListId, accountId) =>
      set((state) => {
        const inst = state.tierLists[tierListId];
        if (!inst) return state;

        let tierLists = state.tierLists;
        if (accountId !== null) {
          tierLists = Object.fromEntries(
            Object.entries(tierLists).map(([key, list]) => [
              key,
              list.linkedAccountId === accountId && Number(key) !== tierListId
                ? { ...list, linkedAccountId: null }
                : list,
            ])
          ) as Record<number, TierListInstance>;
        }

        return updateTierList(
          { tierLists, activeTierListId: state.activeTierListId },
          tierListId,
          { linkedAccountId: accountId }
        );
      }),

    renameLinkedAccount: (sourceAccountId, targetAccountId) =>
      set((state) => {
        if (sourceAccountId === targetAccountId) return state;

        let sourceListId: number | null = null;
        for (const [key, list] of Object.entries(state.tierLists)) {
          if (list.linkedAccountId === sourceAccountId) {
            sourceListId = Number(key);
            break;
          }
        }
        if (sourceListId === null) return state;

        let changed = false;
        const tierLists = Object.fromEntries(
          Object.entries(state.tierLists).map(([key, list]) => {
            const id = Number(key);
            if (
              id === sourceListId &&
              list.linkedAccountId !== targetAccountId
            ) {
              changed = true;
              return [key, { ...list, linkedAccountId: targetAccountId }];
            }
            if (
              id !== sourceListId &&
              list.linkedAccountId === targetAccountId
            ) {
              changed = true;
              return [key, { ...list, linkedAccountId: null }];
            }
            return [key, list];
          })
        ) as Record<number, TierListInstance>;

        return changed ? { tierLists, updatedAt: Date.now() } : state;
      }),

    findTierListByAccount: (accountId) => {
      for (const list of Object.values(get().tierLists)) {
        if (list.linkedAccountId === accountId) return list.id;
      }
      return null;
    },
  }),
});
