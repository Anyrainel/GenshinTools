import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountData } from "@/data/types";
// AccountState shape lives in @/lib/account-data/types so pure account-data
// logic across src/lib/ can depend on it without reaching into stores.
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import { migrateAccountStore } from "./migration/account";
import { PersistedAccountStoreSchema } from "./schemas";
import { useAccountScoreCacheStore } from "./useAccountScoreCacheStore";
import { useAchievementStore } from "./useAchievementStore";

interface AccountStore {
  accounts: Record<AccountProfileId, AccountState>;
  activeAccountId: AccountProfileId | null;

  setActiveAccount: (id: AccountProfileId) => void;
  addOrUpdateAccount: (
    id: AccountProfileId,
    payload: Partial<Omit<AccountState, "id">> & { data: AccountData }
  ) => void;
  /** Atomically rename a profile's storage key and id field. Used to promote profile 0 to a UID. */
  promoteToUid: (currentId: AccountProfileId, newId: AccountProfileId) => void;
  deleteAccount: (id: AccountProfileId) => void;
  clearAccounts: () => void;
}

export const getActiveAccount = (state: AccountStore) =>
  state.activeAccountId !== null ? state.accounts[state.activeAccountId] : null;

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accounts: {},
      activeAccountId: null,

      setActiveAccount: (id) => set({ activeAccountId: id }),

      addOrUpdateAccount: (id, payload) =>
        set((state) => {
          const existing = state.accounts[id];
          const updated: AccountState = {
            id,
            name: payload.name ?? existing?.name ?? `Account ${id}`,
            data: payload.data,
            lastUpdate: payload.lastUpdate ?? Date.now(),
          };

          // Mark all stale when account data changes so scores are recomputed
          const dataChanged = !existing || existing.data !== payload.data;
          if (dataChanged) {
            useAccountScoreCacheStore.getState().invalidateScores(id);
          }

          return {
            accounts: { ...state.accounts, [id]: updated },
            activeAccountId: state.activeAccountId ?? id, // auto-switch if none active
          };
        }),

      promoteToUid: (currentId, newId) =>
        set((state) => {
          const acc = state.accounts[currentId];
          if (!acc || !newId || newId === currentId) return state;

          const promoted: AccountState = { ...acc, id: newId };
          const newAccounts = { ...state.accounts, [newId]: promoted };
          delete newAccounts[currentId];
          useAccountScoreCacheStore
            .getState()
            .renameProfileCache(currentId, newId);
          useAchievementStore.getState().renameProfile(currentId, newId);

          return {
            accounts: newAccounts,
            activeAccountId:
              state.activeAccountId === currentId
                ? newId
                : state.activeAccountId,
          };
        }),

      deleteAccount: (id) =>
        set((state) => {
          const newAccounts = { ...state.accounts };
          delete newAccounts[id];
          useAccountScoreCacheStore.getState().deleteProfileCache(id);
          useAchievementStore.getState().deleteProfile(id);

          let newActive = state.activeAccountId;
          if (newActive === id) {
            const remainingKeys = Object.keys(newAccounts).map(Number);
            newActive = remainingKeys.length > 0 ? remainingKeys[0] : null;
          }

          return { accounts: newAccounts, activeAccountId: newActive };
        }),

      clearAccounts: () => {
        useAccountScoreCacheStore.getState().clearAllScores();
        useAchievementStore.getState().clearAll();
        set({ accounts: {}, activeAccountId: null });
      },
    }),
    {
      name: "genshin-account-storage",
      version: 6,
      migrate: migrateAccountStore,
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedAccountStoreSchema.safeParse(persistedState);
        const persisted = parsed.success ? parsed.data : {};
        return { ...currentState, ...persisted };
      },
    }
  )
);
