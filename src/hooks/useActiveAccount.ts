import type { AccountState } from "@/domain/account/types";
import type { ArtifactScoreResult } from "@/domain/build/artifact/scoring/artifactScore";
import type { AccountData } from "@/domain/models";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";

/**
 * Returns the full active AccountState (id, data, etc.) or null.
 * Use this when you need multiple fields from the active account.
 */
export function useActiveAccount(): AccountState | null {
  return useAccountStore(getActiveAccount);
}

/**
 * Returns just the active account's data, or null.
 * Most common access pattern — avoids `?.data || null` boilerplate.
 */
export function useActiveAccountData(): AccountData | null {
  return useAccountStore((s) => getActiveAccount(s)?.data ?? null);
}

/**
 * Returns just the active account's scores map.
 * Defaults to empty object when no account is active.
 */
export function useActiveAccountScores(): Record<
  string,
  ArtifactScoreResult | null
> {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  return useAccountScoreCacheStore((s) =>
    activeAccountId === null
      ? EMPTY_SCORES
      : (s.scoresByProfileId[activeAccountId] ?? EMPTY_SCORES)
  );
}

const EMPTY_SCORES: Record<string, ArtifactScoreResult | null> = {};
