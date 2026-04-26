import type { AccountData } from "@/data/types";
import { useAccountStore } from "./useAccountStore";
import { remapFreezeStoreForImport } from "./useFreezeStore";
import { useRecommendationCacheStore } from "./useRecommendationCacheStore";

/**
 * Atomic account import: remaps frozen artifact IDs, updates account data,
 * and optionally sets the active account.
 *
 * Freeze-store validation of stale artifact IDs is handled automatically by
 * the subscriber in useFreezeStore — callers don't need to trigger it.
 */
export function applyAccountImport(opts: {
  accountId: string;
  data: AccountData;
  name?: string;
  /** Account ID to set as active, or omit to skip. */
  setAsActive?: string;
  /** Old→new artifact ID mapping for freeze-store remapping. */
  artifactIdMap?: Map<string, string>;
}): void {
  useRecommendationCacheStore.getState().clear();
  remapFreezeStoreForImport(opts.artifactIdMap);
  const store = useAccountStore.getState();
  store.addOrUpdateAccount(opts.accountId, {
    data: opts.data,
    ...(opts.name ? { name: opts.name } : {}),
  });
  if (opts.setAsActive) {
    store.setActiveAccount(opts.setAsActive);
  }
}
