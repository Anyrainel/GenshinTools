import type { AccountData } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccountState = {
  /** Storage key. Either a Genshin UID string (e.g. "800000000") or the sentinel "default". */
  id: string;
  name: string;
  data: AccountData;
  scores: Record<string, ArtifactScoreResult | null>;
  lastUpdate: number;
};

interface AccountStore {
  accounts: Record<string, AccountState>;
  activeAccountId: string | null;
  isScoresStale: boolean;

  setActiveAccount: (id: string) => void;
  addOrUpdateAccount: (
    id: string,
    payload: Partial<Omit<AccountState, "id">> & { data: AccountData }
  ) => void;
  /** Atomically rename a profile's storage key and id field. Used to promote "default" → UID. */
  promoteToUid: (currentId: string, newId: string) => void;
  deleteAccount: (id: string) => void;
  clearAccounts: () => void;

  setScores: (scores: Record<string, ArtifactScoreResult | null>) => void;
  invalidateScores: () => void;
}

export const getActiveAccount = (state: AccountStore) =>
  state.activeAccountId ? state.accounts[state.activeAccountId] : null;

type PersistedAccountStore = Pick<
  AccountStore,
  "accounts" | "activeAccountId" | "isScoresStale"
>;

/**
 * Zustand persist migration function.
 * Exported for unit testing — do not call directly in application code.
 */
export function migrateAccountStore(
  persistedState: unknown,
  version: number
): PersistedAccountStore {
  // biome-ignore lint/suspicious/noExplicitAny: migration across legacy formats
  const state = persistedState as any;

  // v0 / v1: old single-account shape { accountData, scores, lastUid }
  if (version === 0 || version === 1) {
    const oldData = state.accountData;
    const oldScores = state.scores || {};
    const oldUid = state.lastUid || "";

    if (!oldData) {
      return { accounts: {}, activeAccountId: null, isScoresStale: false };
    }

    const id = oldUid || "default";
    return {
      accounts: {
        [id]: {
          id,
          name: oldUid || "Default Account",
          data: oldData,
          scores: oldScores,
          lastUpdate: Date.now(),
        },
      },
      activeAccountId: id,
      isScoresStale: state.isScoresStale || false,
    };
  }

  // v2: multi-account WITH a separate `uid` field on AccountState
  // Promote any "default" accounts that had uid set, then strip the uid field.
  if (version === 2) {
    // biome-ignore lint/suspicious/noExplicitAny: migration across legacy formats
    const oldAccounts: Record<string, any> = state.accounts || {};
    const newAccounts: Record<string, AccountState> = {};
    let activeId: string | null = state.activeAccountId ?? null;

    for (const [key, acc] of Object.entries(oldAccounts)) {
      const uidVal: string = acc.uid || "";
      // If uid differs from the storage key, the account was manually linked
      // but never promoted — use the uid as the correct key.
      const correctKey = uidVal && uidVal !== key ? uidVal : key;

      const { uid: _dropped, ...rest } = acc;
      newAccounts[correctKey] = { ...rest, id: correctKey };
      if (activeId === key) activeId = correctKey;
    }

    return {
      accounts: newAccounts,
      activeAccountId: activeId,
      isScoresStale: state.isScoresStale || false,
    };
  }

  return persistedState as PersistedAccountStore;
}

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
            data: payload.data,
            scores: payload.scores ?? existing?.scores ?? {},
            lastUpdate: payload.lastUpdate ?? Date.now(),
          };

          return {
            accounts: { ...state.accounts, [id]: updated },
            activeAccountId: state.activeAccountId || id, // auto-switch if none active
          };
        }),

      promoteToUid: (currentId, newId) =>
        set((state) => {
          const acc = state.accounts[currentId];
          if (!acc || !newId || newId === currentId) return state;

          const promoted: AccountState = { ...acc, id: newId };
          const newAccounts = { ...state.accounts, [newId]: promoted };
          delete newAccounts[currentId];

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

          let newActive = state.activeAccountId;
          if (newActive === id) {
            const remainingKeys = Object.keys(newAccounts);
            newActive = remainingKeys.length > 0 ? remainingKeys[0] : null;
          }

          return { accounts: newAccounts, activeAccountId: newActive };
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
      version: 3,
      migrate: migrateAccountStore,
    }
  )
);
