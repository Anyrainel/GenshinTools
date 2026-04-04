import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";

/**
 * Switches the active tier list when the active account changes,
 * if the new account has a linked tier list.
 */
export function handleAccountSwitch(accountId: string | null): void {
  if (accountId === null) return;

  const tierState = useTierStore.getState();
  const linkedTierListId = tierState.findTierListByAccount(accountId);

  if (linkedTierListId !== null) {
    tierState.setActiveTierList(linkedTierListId);
  }
}

// Subscribe to account store changes at module level.
// This module should be imported once at app startup.
useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    handleAccountSwitch(state.activeAccountId);
  }
});
