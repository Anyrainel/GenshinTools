import type { AccountData } from "@/data/types";
import {
  DEFAULT_ACCOUNT_PROFILE_ID,
  legacyAccountProfileIdToNumber,
  legacyAccountProfileIdToNumberOrDefault,
} from "@/lib/account-data/accountProfile";
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";

type PersistedAccountStore = {
  accounts: Record<AccountProfileId, AccountState>;
  activeAccountId: AccountProfileId | null;
  staleScoreCharIds: string[] | true;
};

/** Shape of the old v0/v1 single-account store (before multi-account). */
interface LegacyAccountStoreV0 {
  accountData?: AccountData;
  scores?: Record<string, unknown>;
  lastUid?: string;
  isScoresStale?: boolean;
  accounts?: Record<string, { uid?: string; [k: string]: unknown }>;
  activeAccountId?: string | number | null;
  staleScoreCharIds?: string[] | true;
}

type LegacyAccountState = Omit<AccountState, "id"> & {
  id?: string | number;
  uid?: string;
  [k: string]: unknown;
};

function normalizeAccountStoreIds(
  state: LegacyAccountStoreV0
): PersistedAccountStore {
  const accounts: Record<AccountProfileId, AccountState> = {};
  for (const [key, account] of Object.entries(state.accounts ?? {})) {
    const legacy = account as LegacyAccountState;
    const id = legacyAccountProfileIdToNumberOrDefault(
      legacy.id ?? legacy.uid ?? key
    );
    const { uid: _dropped, ...rest } = legacy;
    accounts[id] = {
      ...rest,
      id,
      name:
        legacy.name ??
        (id === DEFAULT_ACCOUNT_PROFILE_ID
          ? "Default Account"
          : `Account ${id}`),
    } as AccountState;
  }

  const activeAccountId = legacyAccountProfileIdToNumber(state.activeAccountId);

  return {
    accounts,
    activeAccountId:
      activeAccountId !== null && accounts[activeAccountId]
        ? activeAccountId
        : null,
    staleScoreCharIds: state.staleScoreCharIds ?? [],
  };
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

    const id = oldUid ? legacyAccountProfileIdToNumberOrDefault(oldUid) : 0;
    return normalizeAccountStoreIds({
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
    });
  }

  // v2: multi-account WITH a separate `uid` field on AccountState.
  // Promote any "default" accounts that had uid set, then strip the uid field.
  if (version === 2) {
    const oldAccounts = state.accounts || {};
    const newAccounts: Record<string, LegacyAccountState> = {};
    let activeId: string | number | null = state.activeAccountId ?? null;

    for (const [key, acc] of Object.entries(oldAccounts)) {
      const uidVal: string = acc.uid || "";
      // If uid differs from the storage key, the account was manually linked
      // but never promoted; use the uid as the correct key.
      const correctKey = uidVal && uidVal !== key ? uidVal : key;

      const { uid: _dropped, ...rest } = acc;
      newAccounts[correctKey] = {
        ...rest,
        id: correctKey,
      } as LegacyAccountState;
      if (activeId === key) activeId = correctKey;
    }

    return normalizeAccountStoreIds({
      accounts: newAccounts,
      activeAccountId: activeId,
      staleScoreCharIds: state.isScoresStale ? true : [],
    });
  }

  // v3: had boolean isScoresStale -> convert to staleScoreCharIds.
  if (version === 3) {
    return normalizeAccountStoreIds({
      accounts: state.accounts ?? {},
      activeAccountId: state.activeAccountId ?? null,
      staleScoreCharIds: state.isScoresStale ? true : [],
    });
  }

  // v4 -> v5: account profile ids move from strings ("default" or UID text)
  // to numbers (0 for default, numeric UID for UID profiles).
  if (version < 5) {
    return normalizeAccountStoreIds(state);
  }

  return persistedState as PersistedAccountStore;
}
