import { useAccountStore } from "@/stores/useAccountStore";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { useCallback } from "react";

/**
 * Returns a reactive `isOwned(type, id)` callback bound to the active profile.
 * Re-renders when the active profile or its ownership data changes.
 */
export function useIsOwned() {
  const profileId = useAccountStore((s) => s.activeAccountId) ?? "default";
  const isOwnedFn = useOwnershipStore((s) => s.isOwned);

  return useCallback(
    (type: "character" | "weapon", id: string) =>
      isOwnedFn(profileId, type, id),
    [profileId, isOwnedFn]
  );
}

/**
 * Returns ownership mutation actions bound to the active profile.
 */
export function useOwnershipActions() {
  const profileId = useAccountStore((s) => s.activeAccountId) ?? "default";
  const setOwnedFn = useOwnershipStore((s) => s.setOwned);
  const toggleOwnedFn = useOwnershipStore((s) => s.toggleOwned);

  const setOwned = useCallback(
    (type: "character" | "weapon", id: string, owned: boolean) =>
      setOwnedFn(profileId, type, id, owned),
    [profileId, setOwnedFn]
  );

  const toggleOwned = useCallback(
    (type: "character" | "weapon", id: string) =>
      toggleOwnedFn(profileId, type, id),
    [profileId, toggleOwnedFn]
  );

  return { setOwned, toggleOwned };
}

/**
 * Static (non-reactive) ownership check for filter callbacks (e.g. ItemPicker).
 * Reads current state at call time — do NOT use in render paths that need reactivity.
 */
export function getIsOwned(type: "character" | "weapon", id: string): boolean {
  const profileId = useAccountStore.getState().activeAccountId ?? "default";
  return useOwnershipStore.getState().isOwned(profileId, type, id);
}
