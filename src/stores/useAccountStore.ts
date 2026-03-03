import type { AccountData } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccountState = {
  id: string; // Account ID, usually UID or "default"
  name: string;
  uid: string;
  data: AccountData;
  scores: Record<string, ArtifactScoreResult>;
  lastUpdate: number;
};

interface AccountStore {
  accounts: Record<string, AccountState>;
  activeAccountId: string | null;
  isScoresStale: boolean;

  setActiveAccount: (id: string) => void;
  addOrUpdateAccount: (
    id: string,
    payload: Partial<AccountState> & { data: AccountData }
  ) => void;
  deleteAccount: (id: string) => void;
  /** Rename the storage key and sync id/uid fields. Used when promoting "default" to a real UID. */
  promoteToUid: (currentId: string, newUid: string) => void;
  clearAccounts: () => void;

  setScores: (scores: Record<string, ArtifactScoreResult>) => void;
  invalidateScores: () => void;
}

export const getActiveAccount = (state: AccountStore) =>
  state.activeAccountId ? state.accounts[state.activeAccountId] : null;

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accounts: {},
      activeAccountId: null,
      isScoresStale: false,

      setActiveAccount: (id) => set({ activeAccountId: id }),

      addOrUpdateAccount: (id, payload) =>
        set((state) => {
          const existing = state.accounts[id];
          const updated: AccountState = {
            id,
            name: payload.name ?? existing?.name ?? `Account ${id}`,
            uid: payload.uid ?? existing?.uid ?? id,
            data: payload.data,
            scores: payload.scores ?? existing?.scores ?? {},
            lastUpdate: payload.lastUpdate ?? Date.now(),
          };

          return {
            accounts: { ...state.accounts, [id]: updated },
            activeAccountId: state.activeAccountId || id, // auto-switch if none active
          };
        }),

      deleteAccount: (id) =>
        set((state) => {
          const newAccounts = { ...state.accounts };
          delete newAccounts[id];

          let newActive = state.activeAccountId;
          if (newActive === id) {
            const remainingKeys = Object.keys(newAccounts);
            newActive = remainingKeys.length > 0 ? remainingKeys[0] : null;
          }

          return { accounts: newAccounts, activeAccountId: newActive };
        }),

      promoteToUid: (currentId, newUid) =>
        set((state) => {
          const acc = state.accounts[currentId];
          if (!acc || !newUid || newUid === currentId) return state;

          const promoted: AccountState = { ...acc, id: newUid, uid: newUid };
          const newAccounts = { ...state.accounts, [newUid]: promoted };
          delete newAccounts[currentId];

          return {
            accounts: newAccounts,
            activeAccountId:
              state.activeAccountId === currentId
                ? newUid
                : state.activeAccountId,
          };
        }),

      clearAccounts: () => set({ accounts: {}, activeAccountId: null }),

      setScores: (scores) =>
        set((state) => {
          if (!state.activeAccountId) return state;
          const acc = state.accounts[state.activeAccountId];
          if (!acc) return state;
          return {
            accounts: {
              ...state.accounts,
              [state.activeAccountId]: { ...acc, scores },
            },
            isScoresStale: false,
          };
        }),

      invalidateScores: () => set({ isScoresStale: true }),
    }),
    {
      name: "genshin-account-storage",
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        // v0 and v1 had the same shape: { accountData, scores, lastUid, ... }
        if (version === 0 || version === 1) {
          // biome-ignore lint/suspicious/noExplicitAny: migration from legacy format
          const state = persistedState as any;
          const oldData = state.accountData;
          const oldScores = state.scores || {};
          const oldUid = state.lastUid || "";

          if (!oldData) {
            return {
              accounts: {},
              activeAccountId: null,
              isScoresStale: false,
            };
          }

          // Preserve UID as account id when available, else use "default"
          const id = oldUid || "default";
          const newAccount: AccountState = {
            id,
            name: oldUid ? oldUid : "Default Account",
            uid: oldUid,
            data: oldData,
            scores: oldScores,
            lastUpdate: Date.now(),
          };

          return {
            accounts: { [id]: newAccount },
            activeAccountId: id,
            isScoresStale: state.isScoresStale || false,
          };
        }
        return persistedState;
      },
    }
  )
);
