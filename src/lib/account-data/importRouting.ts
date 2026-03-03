/**
 * Pure routing functions for account import decisions.
 *
 * All functions are side-effect free: they take current store state + import
 * parameters and return a discriminated action descriptor. The component executes
 * the action (store writes, toasts, dialog open). This separation makes every
 * routing path unit-testable without a React component or store.
 */

import type { AccountData } from "@/data/types";
import type { AccountState } from "@/stores/useAccountStore";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type PendingImport = {
  type: "json" | "uid";
  uid: string;
  data: AccountData;
  nickname: string;
  clearBeforeImport?: boolean;
};

/** Write data directly to the store, then set it active. */
export type DirectImport = {
  kind: "direct";
  id: string;
  data: AccountData;
  name: string;
  activeId: string;
};

/** Open the account-manager dialog so the user can choose a target. */
export type OpenDialog = {
  kind: "dialog";
  pendingImport: PendingImport;
};

export type ResolveResult =
  | {
      kind: "apply";
      /** Write data here first. */
      id: string;
      data: AccountData;
      name?: string;
      /**
       * If set, call promoteToUid(id, promoteToId) after writing.
       * The profile key moves from `id` to `promoteToId`.
       */
      promoteToId?: string;
      /** Set as the active account after all writes (equals promoteToId when set). */
      activeId: string;
    }
  | {
      /**
       * Target account disappeared between dialog open and confirmation
       * (e.g. deleted in another tab). The component should close the dialog
       * and show an error — do NOT silently no-op.
       */
      kind: "account_not_found";
    };

// ─── Routing functions ────────────────────────────────────────────────────────

/**
 * Route a local (GOOD JSON) import.
 *
 * Paths:
 * 1. UID provided → direct overwrite/create for that UID profile
 * 2. No UID + empty store → create "default"
 * 3. No UID + existing profiles → open dialog
 */
export function routeLocalImport(
  accounts: Record<string, AccountState>,
  data: AccountData,
  optionalUid: string,
  defaultAccountName: string
): DirectImport | OpenDialog {
  if (optionalUid) {
    return {
      kind: "direct",
      id: optionalUid,
      data,
      name: accounts[optionalUid]?.name || optionalUid,
      activeId: optionalUid,
    };
  }

  if (Object.keys(accounts).length === 0) {
    return {
      kind: "direct",
      id: "default",
      data,
      name: defaultAccountName,
      activeId: "default",
    };
  }

  return {
    kind: "dialog",
    pendingImport: { type: "json", uid: "", data, nickname: "" },
  };
}

/**
 * Route an Enka (UID-based) import.
 *
 * Paths:
 * 1. UID profile already exists → direct merge or overwrite
 * 2. No UID profile, "default" exists → open dialog (update default or create new)
 * 3. No UID profile, no "default" → create UID profile directly
 */
export function routeUidImport(
  accounts: Record<string, AccountState>,
  uid: string,
  data: AccountData,
  nickname: string,
  clearBeforeImport: boolean,
  mergeData: (old: AccountData, incoming: AccountData) => AccountData
): DirectImport | OpenDialog {
  const existingAccount = accounts[uid] ?? null;

  if (existingAccount) {
    const profileData = clearBeforeImport
      ? data
      : mergeData({ ...existingAccount.data }, data);
    return {
      kind: "direct",
      id: uid,
      data: profileData,
      name: nickname || existingAccount.name || uid,
      activeId: uid,
    };
  }

  if (accounts.default) {
    return {
      kind: "dialog",
      pendingImport: { type: "uid", uid, data, nickname, clearBeforeImport },
    };
  }

  // No matching profile and no default → create the UID profile directly
  return {
    kind: "direct",
    id: uid,
    data,
    name: nickname || uid,
    activeId: uid,
  };
}

/**
 * Route a dialog resolution (user chose what to do with a pending import).
 *
 * For UID imports targeting a non-UID-keyed profile (i.e. "default"), the
 * result encodes a key promotion so the profile can be routed directly on the
 * next import.
 */
export function routeResolveImport(
  accounts: Record<string, AccountState>,
  pendingImport: PendingImport,
  action: "overwrite" | "merge" | "create",
  targetId: string,
  renamedName: string | undefined,
  mergeData: (old: AccountData, incoming: AccountData) => AccountData
): ResolveResult {
  const { data: newData, uid, nickname } = pendingImport;

  if (action === "create") {
    return {
      kind: "apply",
      id: targetId,
      data: newData,
      name: renamedName || nickname || targetId,
      activeId: targetId,
    };
  }

  const existingAccount = accounts[targetId];
  if (!existingAccount) {
    return { kind: "account_not_found" };
  }

  const finalData =
    action === "merge"
      ? mergeData({ ...existingAccount.data }, newData)
      : newData;

  // UID imports targeting a non-UID-keyed profile need key promotion so that
  // subsequent imports for the same UID route directly without a dialog.
  const needsPromotion =
    pendingImport.type === "uid" && !!uid && targetId !== uid;

  return {
    kind: "apply",
    id: targetId,
    data: finalData,
    ...(renamedName ? { name: renamedName } : {}),
    ...(needsPromotion ? { promoteToId: uid } : {}),
    activeId: needsPromotion ? uid : targetId,
  };
}
