/**
 * Cross-store effect: switches the active tier list when the active account
 * changes, if the new account has a linked tier list.
 *
 * Side-effect module. Imported once from src/main.tsx to register the
 * subscription at app startup. No other file should import from here —
 * keeps `useAccountStore` and `useTierStore` unaware of each other and
 * avoids the circular module dependency.
 */

import type { AccountProfileId } from "@/lib/account-data/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";

/** Exported only for unit tests that exercise the effect in isolation. */
export function handleAccountSwitch(accountId: AccountProfileId | null): void {
  if (accountId === null) return;
  const tierState = useTierStore.getState();
  const linkedTierListId = tierState.findTierListByAccount(accountId);
  if (linkedTierListId !== null) {
    tierState.setActiveTierList(linkedTierListId);
  }
}

useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    handleAccountSwitch(state.activeAccountId);
  }
});
