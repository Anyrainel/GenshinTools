import type { AccountData } from "@/data/types";
import type { AccountState } from "@/lib/account-data/types";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";

/**
 * Returns the full active AccountState (id, data, scores, etc.) or null.
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
  return useAccountStore((s) => getActiveAccount(s)?.scores ?? EMPTY_SCORES);
}

const EMPTY_SCORES: Record<string, ArtifactScoreResult | null> = {};
