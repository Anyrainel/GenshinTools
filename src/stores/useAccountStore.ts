import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountData } from "@/data/types";
// AccountState shape lives in @/lib/account-data/types so pure account-data
// logic across src/lib/ can depend on it without reaching into stores.
import type { AccountState } from "@/lib/account-data/types";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { PersistedAccountStoreSchema } from "./schemas";

interface AccountStore {
  accounts: Record<string, AccountState>;
  activeAccountId: string | null;
  /**
   * Per-character score staleness.
   * - `[]` → nothing stale
   * - `string[]` → those character IDs need rescoring
   * - `true` → all characters need rescoring (global config change, preset swap, etc.)
   */
  staleScoreCharIds: string[] | true;

  setActiveAccount: (id: string) => void;
  addOrUpdateAccount: (
    id: string,
    payload: Partial<Omit<AccountState, "id">> & { data: AccountData }
  ) => void;
  /** Atomically rename a profile's storage key and id field. Used to promote "default" → UID. */
  promoteToUid: (currentId: string, newId: string) => void;
  deleteAccount: (id: string) => void;
  clearAccounts: () => void;

  /** Replace all scores for the active account. Clears all staleness. */
  setScores: (scores: Record<string, ArtifactScoreResult | null>) => void;
  /** Merge partial scores into the active account. Clears staleness only for the scored characters. */
  mergeScores: (scores: Record<string, ArtifactScoreResult | null>) => void;
  /** Mark specific characters (or all if no args) as needing rescoring. */
  invalidateScores: (charIds?: string[]) => void;
}

export const getActiveAccount = (state: AccountStore) =>
  state.activeAccountId ? state.accounts[state.activeAccountId] : null;

type PersistedAccountStore = Pick<
  AccountStore,
  "accounts" | "activeAccountId" | "staleScoreCharIds"
>;

/** Shape of the old v0/v1 single-account store (before multi-account). */
interface LegacyAccountStoreV0 {
  accountData?: AccountData;
  scores?: Record<string, unknown>;
  lastUid?: string;
  isScoresStale?: boolean;
  accounts?: Record<string, { uid?: string; [k: string]: unknown }>;
  activeAccountId?: string | null;
  staleScoreCharIds?: string[] | true;
}

/**
 * Zustand persist migration function.
 * Exported for unit testing — do not call directly in application code.
 */
export function migrateAccountStore(
  persistedState: unknown,
  version: number
): PersistedAccountStore {
  const state = persistedState as LegacyAccountStoreV0;

  // v0 / v1: old single-account shape { accountData, scores, lastUid }
  if (version === 0 || version === 1) {
    const oldData = state.accountData;
    const oldScores = state.scores || {};
    const oldUid = state.lastUid || "";

    if (!oldData) {
      return { accounts: {}, activeAccountId: null, staleScoreCharIds: [] };
    }

    const id = oldUid || "default";
    return {
      accounts: {
        [id]: {
          id,
          name: oldUid || "Default Account",
          data: oldData,
          scores: oldScores as Record<string, ArtifactScoreResult | null>,
          lastUpdate: Date.now(),
        },
      },
      activeAccountId: id,
      staleScoreCharIds: state.isScoresStale ? true : [],
    };
  }

  // v2: multi-account WITH a separate `uid` field on AccountState
  // Promote any "default" accounts that had uid set, then strip the uid field.
  if (version === 2) {
    const oldAccounts = state.accounts || {};
    const newAccounts: Record<string, AccountState> = {};
    let activeId: string | null = state.activeAccountId ?? null;

    for (const [key, acc] of Object.entries(oldAccounts)) {
      const uidVal: string = acc.uid || "";
      // If uid differs from the storage key, the account was manually linked
      // but never promoted — use the uid as the correct key.
      const correctKey = uidVal && uidVal !== key ? uidVal : key;

      const { uid: _dropped, ...rest } = acc;
      newAccounts[correctKey] = { ...rest, id: correctKey } as AccountState;
      if (activeId === key) activeId = correctKey;
    }

    return {
      accounts: newAccounts,
      activeAccountId: activeId,
      staleScoreCharIds: state.isScoresStale ? true : [],
    };
  }

  // v3: had boolean isScoresStale → convert to staleScoreCharIds
  if (version === 3) {
    return {
      accounts: (state.accounts as Record<string, AccountState>) ?? {},
      activeAccountId: state.activeAccountId ?? null,
      staleScoreCharIds: state.isScoresStale ? true : [],
    };
  }

  return persistedState as PersistedAccountStore;
}

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
            activeAccountId: state.activeAccountId || id, // auto-switch if none active
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
            staleScoreCharIds: [],
          };
        }),

      mergeScores: (scores) =>
        set((state) => {
          if (!state.activeAccountId) return state;
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
      version: 4,
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
