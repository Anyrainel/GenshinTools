import { useCallback } from "react";
import { useSessionNavStore, type ViewId } from "@/stores/useSessionNavStore";
import { useHasAccountData, useIsOwned } from "./useOwnership";

/**
 * Returns a callback that auto-disables the "owned only" filter for a view
 * when the given characters array contains any unowned character.
 *
 * This prevents teams from disappearing after the user intentionally picks
 * an unowned character in the ItemPicker.
 */
export function useAutoDisableOwnedFilter(viewId: ViewId) {
  const isOwned = useIsOwned();
  const hasAccountData = useHasAccountData();
  const ownedOnlyRaw = useSessionNavStore(
    (s) => s.viewSettings[viewId].ownedOnly
  );
  const setViewOwnedOnly = useSessionNavStore((s) => s.setViewOwnedOnly);

  const ownedOnlyActive = ownedOnlyRaw === null ? hasAccountData : ownedOnlyRaw;

  return useCallback(
    (characters: (string | null)[]) => {
      if (!ownedOnlyActive) return;
      if (characters.some((id) => id != null && !isOwned("character", id))) {
        setViewOwnedOnly(viewId, false);
      }
    },
    [ownedOnlyActive, isOwned, setViewOwnedOnly, viewId]
  );
}
