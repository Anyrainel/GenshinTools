import type { AccountData } from "@/data/types";
import type { AccountProfileId } from "@/lib/account-data/types";
import { useAccountStore } from "./useAccountStore";
import {
  collectAllArtifactIds,
  remapFreezeStoreForImport,
  useFreezeStore,
} from "./useFreezeStore";
import { useRecommendationCacheStore } from "./useRecommendationCacheStore";
import { useRecommendationSettingsStore } from "./useRecommendationSettingsStore";
import { useResourceRecStore } from "./useResourceRecStore";
import { useTierStore } from "./useTierStore";
import { useTriageStore } from "./useTriageStore";

export type ApplyAccountImportResult = Record<string, never>;

function promoteProfileScopedStores(
  sourceProfileId: AccountProfileId,
  targetProfileId: AccountProfileId
): void {
  useTriageStore
    .getState()
    .renameProfileSettings(sourceProfileId, targetProfileId);
  useResourceRecStore
    .getState()
    .renameProfileSettings(sourceProfileId, targetProfileId);
  useRecommendationSettingsStore
    .getState()
    .renameProfileSettings(sourceProfileId, targetProfileId);
  useFreezeStore.getState().renameProfile(sourceProfileId, targetProfileId);
  useTierStore.getState().renameLinkedAccount(sourceProfileId, targetProfileId);
}

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
  /** Promote the imported profile key after saving, e.g. profile 0 -> UID. */
  promoteToId?: AccountProfileId;
  /** Old→new artifact ID mapping for freeze-store remapping. */
  artifactIdMap?: Map<string, string>;
}): ApplyAccountImportResult {
  const lastUpdate = opts.lastUpdate ?? Date.now();
  useRecommendationCacheStore.getState().clear();
  remapFreezeStoreForImport(opts.artifactIdMap, opts.accountId);
  const store = useAccountStore.getState();

  store.addOrUpdateAccount(opts.accountId, {
    data: opts.data,
    lastUpdate,
    ...(opts.name ? { name: opts.name } : {}),
  });
  if (opts.promoteToId !== undefined) {
    promoteProfileScopedStores(opts.accountId, opts.promoteToId);
    store.promoteToUid(opts.accountId, opts.promoteToId);
  }
  if (opts.setAsActive !== undefined) {
    store.setActiveAccount(opts.setAsActive);
  }
  useFreezeStore
    .getState()
    .validateFrozenArtifacts(
      collectAllArtifactIds(opts.data),
      opts.promoteToId ?? opts.accountId
    );
  return {};
}
