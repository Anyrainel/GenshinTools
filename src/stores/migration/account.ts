import type { AccountData } from "@/data/types";
import type { AccountState } from "@/lib/account-data/types";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";

type PersistedAccountStore = {
  accounts: Record<string, AccountState>;
  activeAccountId: string | null;
  staleScoreCharIds: string[] | true;
};

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
 * Exported for unit testing; do not call directly in application code.
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

  // v2: multi-account WITH a separate `uid` field on AccountState.
  // Promote any "default" accounts that had uid set, then strip the uid field.
  if (version === 2) {
    const oldAccounts = state.accounts || {};
    const newAccounts: Record<string, AccountState> = {};
    let activeId: string | null = state.activeAccountId ?? null;

    for (const [key, acc] of Object.entries(oldAccounts)) {
      const uidVal: string = acc.uid || "";
      // If uid differs from the storage key, the account was manually linked
      // but never promoted; use the uid as the correct key.
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

  // v3: had boolean isScoresStale -> convert to staleScoreCharIds.
  if (version === 3) {
    return {
      accounts: (state.accounts as Record<string, AccountState>) ?? {},
      activeAccountId: state.activeAccountId ?? null,
      staleScoreCharIds: state.isScoresStale ? true : [],
    };
  }

  return persistedState as PersistedAccountStore;
}
