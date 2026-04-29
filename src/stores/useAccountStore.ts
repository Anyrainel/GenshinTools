import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountData } from "@/data/types";
// AccountState shape lives in @/lib/account-data/types so pure account-data
// logic across src/lib/ can depend on it without reaching into stores.
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { migrateAccountStore } from "./migration/account";
import { PersistedAccountStoreSchema } from "./schemas";

interface AccountStore {
  accounts: Record<AccountProfileId, AccountState>;
  activeAccountId: AccountProfileId | null;
  /**
   * Per-character score staleness.
   * - `[]` → nothing stale
   * - `string[]` → those character IDs need rescoring
   * - `true` → all characters need rescoring (global config change, preset swap, etc.)
   */
  staleScoreCharIds: string[] | true;

  setActiveAccount: (id: AccountProfileId) => void;
  addOrUpdateAccount: (
    id: AccountProfileId,
    payload: Partial<Omit<AccountState, "id">> & { data: AccountData }
  ) => void;
  /** Atomically rename a profile's storage key and id field. Used to promote profile 0 to a UID. */
  promoteToUid: (currentId: AccountProfileId, newId: AccountProfileId) => void;
  deleteAccount: (id: AccountProfileId) => void;
  clearAccounts: () => void;

  /** Replace all scores for the active account. Clears all staleness. */
  setScores: (scores: Record<string, ArtifactScoreResult | null>) => void;
  /** Merge partial scores into the active account. Clears staleness only for the scored characters. */
  mergeScores: (scores: Record<string, ArtifactScoreResult | null>) => void;
  /** Mark specific characters (or all if no args) as needing rescoring. */
  invalidateScores: (charIds?: string[]) => void;
}

export const getActiveAccount = (state: AccountStore) =>
  state.activeAccountId !== null ? state.accounts[state.activeAccountId] : null;

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accounts: {},
      activeAccountId: null,
      staleScoreCharIds: [] as string[] | true,

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

          // Mark all stale when account data changes so scores are recomputed
          const dataChanged = !existing || existing.data !== payload.data;

          return {
            accounts: { ...state.accounts, [id]: updated },
            activeAccountId: state.activeAccountId ?? id, // auto-switch if none active
            ...(dataChanged && { staleScoreCharIds: true as const }),
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
            const remainingKeys = Object.keys(newAccounts).map(Number);
            newActive = remainingKeys.length > 0 ? remainingKeys[0] : null;
          }

          return { accounts: newAccounts, activeAccountId: newActive };
        }),

      clearAccounts: () => set({ accounts: {}, activeAccountId: null }),

      setScores: (scores) =>
        set((state) => {
          if (state.activeAccountId === null) return state;
          const acc = state.accounts[state.activeAccountId];
          if (!acc) return state;
          return {
            accounts: {
              ...state.accounts,
              [state.activeAccountId]: { ...acc, scores },
            },
            staleScoreCharIds: [],
          };
        }),

      mergeScores: (scores) =>
        set((state) => {
          if (state.activeAccountId === null) return state;
          const acc = state.accounts[state.activeAccountId];
          if (!acc) return state;

          const merged = { ...acc.scores, ...scores };

          // Remove the scored character IDs from staleness
          let newStale = state.staleScoreCharIds;
          if (newStale === true) {
            // Was fully stale — now clear since we've rescored what was needed
            newStale = [];
          } else if (newStale.length > 0) {
            const scored = new Set(Object.keys(scores));
            newStale = newStale.filter((id) => !scored.has(id));
          }

          return {
            accounts: {
              ...state.accounts,
              [state.activeAccountId]: { ...acc, scores: merged },
            },
            staleScoreCharIds: newStale,
          };
        }),

      invalidateScores: (charIds?: string[]) =>
        set((state) => {
          if (!charIds) {
            // Global invalidation (score config change, preset swap, etc.)
            return { staleScoreCharIds: true as const };
          }
          if (state.staleScoreCharIds === true) {
            // Already fully stale, adding specific chars is a no-op
            return state;
          }
          // Merge with existing stale IDs (deduplicate)
          const existing = new Set(state.staleScoreCharIds);
          let changed = false;
          for (const id of charIds) {
            if (!existing.has(id)) {
              existing.add(id);
              changed = true;
            }
          }
          return changed ? { staleScoreCharIds: [...existing] } : state;
        }),
    }),
    {
      name: "genshin-account-storage",
      version: 5,
      migrate: migrateAccountStore,
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        staleScoreCharIds: state.staleScoreCharIds,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedAccountStoreSchema.safeParse(persistedState);
        const persisted = parsed.success ? parsed.data : {};
        return { ...currentState, ...persisted };
      },
    }
  )
);

/** Convenience helper for cross-store score invalidation. */
export function invalidateScores(charIds?: string[]): void {
  useAccountStore.getState().invalidateScores(charIds);
}
