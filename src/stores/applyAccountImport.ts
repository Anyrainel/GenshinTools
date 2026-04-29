import type { AccountData } from "@/data/types";
import type { AccountProfileId } from "@/lib/account-data/types";
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
  accountId: AccountProfileId;
  data: AccountData;
  name?: string;
  /** Timestamp for when this import updated the local account data. */
  lastUpdate?: number;
  /** Account ID to set as active, or omit to skip. */
  setAsActive?: AccountProfileId;
  /** Old→new artifact ID mapping for freeze-store remapping. */
  artifactIdMap?: Map<string, string>;
}): void {
  const lastUpdate = opts.lastUpdate ?? Date.now();
  useRecommendationCacheStore.getState().clear();
  remapFreezeStoreForImport(opts.artifactIdMap);
  const store = useAccountStore.getState();
  store.addOrUpdateAccount(opts.accountId, {
    data: opts.data,
    lastUpdate,
    ...(opts.name ? { name: opts.name } : {}),
  });
  if (opts.setAsActive !== undefined) {
    store.setActiveAccount(opts.setAsActive);
  }
}
