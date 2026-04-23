/**
 * Unit tests for importRouting.ts
 *
 * Every routing path and multi-step user journey is covered without needing
 * a React component or a live Zustand store. Routing decisions are applied to
 * a plain `accounts` object via helper functions that mirror what the component
 * does after receiving the routing result.
 */

import { describe, expect, it } from "vitest";
import type { AccountData } from "@/data/types";
import {
  type DirectImport,
  type OpenDialog,
  type PendingImport,
  type ResolveResult,
  routeLocalImport,
  routeResolveImport,
  routeUidImport,
} from "@/lib/account-data/import/importRouting";
import type { AccountState } from "@/lib/account-data/types";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const emptyData: AccountData = {
  characters: [],
  extraArtifacts: [],
  extraWeapons: [],
};

const dataA: AccountData = {
  characters: [
    {
      key: "hu_tao",
      level: 90,
      constellation: 1,
      talent: { auto: 10, skill: 10, burst: 8 },
      artifacts: {},
    },
  ],
  extraArtifacts: [],
  extraWeapons: [],
};

const dataB: AccountData = {
  characters: [
    {
      key: "xingqiu",
      level: 80,
      constellation: 6,
      talent: { auto: 1, skill: 10, burst: 10 },
      artifacts: {},
    },
  ],
  extraArtifacts: [],
  extraWeapons: [],
};

function makeAccount(
  id: string,
  overrides: Partial<AccountState> = {}
): AccountState {
  return {
    id,
    name: id === "default" ? "Default Account" : `Account ${id}`,
    data: emptyData,
    scores: {},
    lastUpdate: 1000,
    ...overrides,
  };
}

/** Identity merge — used in tests that only care about routing, not merge content. */
const identityMerge = (_old: AccountData, incoming: AccountData) => incoming;

// ─── Apply helpers (mirror component execution) ───────────────────────────────

function applyDirect(
  accounts: Record<string, AccountState>,
  result: DirectImport
): Record<string, AccountState> {
  return {
    ...accounts,
    [result.id]: {
      id: result.id,
      name: result.name,
      data: result.data,
      scores: {},
      lastUpdate: Date.now(),
    },
  };
}

function applyResolve(
  accounts: Record<string, AccountState>,
  result: ResolveResult
): Record<string, AccountState> {
  if (result.kind !== "apply") return accounts;
  let next = {
    ...accounts,
    [result.id]: {
      ...accounts[result.id],
      id: result.id,
      data: result.data,
      ...(result.name ? { name: result.name } : {}),
      lastUpdate: Date.now(),
    } as AccountState,
  };
  if (result.promoteToId) {
    next[result.promoteToId] = { ...next[result.id], id: result.promoteToId };
    const { [result.id]: _removed, ...rest } = next;
    next = rest;
  }
  return next;
}

// ─── routeLocalImport ─────────────────────────────────────────────────────────

describe("routeLocalImport", () => {
  it("routes directly to UID profile when optional UID is provided", () => {
    const accounts = {
      "800000000": makeAccount("800000000", { name: "Main" }),
    };
    const result = routeLocalImport(accounts, dataA, "800000000", "Default");

    expect(result.kind).toBe("direct");
    const direct = result as DirectImport;
    expect(direct.id).toBe("800000000");
    expect(direct.name).toBe("Main"); // preserves existing name
    expect(direct.data).toBe(dataA);
    expect(direct.activeId).toBe("800000000");
  });

  it("uses the UID as name when no existing profile for that UID", () => {
    const accounts = {};
    const result = routeLocalImport(
      accounts,
      dataA,
      "800000000",
      "Default"
    ) as DirectImport;

    expect(result.kind).toBe("direct");
    expect(result.id).toBe("800000000");
    expect(result.name).toBe("800000000");
  });

  it("creates 'default' profile on first import with no UID", () => {
    const result = routeLocalImport(
      {},
      dataA,
      "",
      "Default Account"
    ) as DirectImport;

    expect(result.kind).toBe("direct");
    expect(result.id).toBe("default");
    expect(result.name).toBe("Default Account");
    expect(result.activeId).toBe("default");
  });

  it("opens dialog when no UID but existing profiles are present", () => {
    const accounts = { default: makeAccount("default") };
    const result = routeLocalImport(
      accounts,
      dataA,
      "",
      "Default"
    ) as OpenDialog;

    expect(result.kind).toBe("dialog");
    expect(result.pendingImport.type).toBe("json");
    expect(result.pendingImport.uid).toBe("");
    expect(result.pendingImport.data).toBe(dataA);
  });

  it("opens dialog even when multiple UID profiles exist", () => {
    const accounts = {
      "700000001": makeAccount("700000001"),
      "800000002": makeAccount("800000002"),
    };
    const result = routeLocalImport(accounts, dataA, "", "Default");

    expect(result.kind).toBe("dialog");
  });
});

// ─── routeUidImport ───────────────────────────────────────────────────────────

describe("routeUidImport", () => {
  it("merges into existing UID profile directly", () => {
    const accounts = { "800000000": makeAccount("800000000", { data: dataA }) };
    let mergeCalled = false;
    const result = routeUidImport(
      accounts,
      "800000000",
      dataB,
      "Player",
      false,
      (_old, incoming) => {
        mergeCalled = true;
        return incoming;
      }
    ) as DirectImport;

    expect(result.kind).toBe("direct");
    expect(result.id).toBe("800000000");
    expect(mergeCalled).toBe(true);
  });

  it("overwrites existing UID profile without merging when clearBeforeImport", () => {
    const accounts = { "800000000": makeAccount("800000000", { data: dataA }) };
    let mergeCalled = false;
    const result = routeUidImport(
      accounts,
      "800000000",
      dataB,
      "Player",
      true,
      (_old, incoming) => {
        mergeCalled = true;
        return incoming;
      }
    ) as DirectImport;

    expect(result.kind).toBe("direct");
    expect(result.data).toBe(dataB);
    expect(mergeCalled).toBe(false);
  });

  it("uses nickname as name when provided", () => {
    const accounts = {
      "800000000": makeAccount("800000000", { name: "Old Name" }),
    };
    const result = routeUidImport(
      accounts,
      "800000000",
      dataA,
      "NewNickname",
      false,
      identityMerge
    ) as DirectImport;

    expect(result.name).toBe("NewNickname");
  });

  it("preserves existing name when nickname is empty", () => {
    const accounts = {
      "800000000": makeAccount("800000000", { name: "My Account" }),
    };
    const result = routeUidImport(
      accounts,
      "800000000",
      dataA,
      "",
      false,
      identityMerge
    ) as DirectImport;

    expect(result.name).toBe("My Account");
  });

  it("opens dialog when UID profile absent but 'default' exists", () => {
    const accounts = { default: makeAccount("default") };
    const result = routeUidImport(
      accounts,
      "800000000",
      dataA,
      "Player",
      false,
      identityMerge
    ) as OpenDialog;

    expect(result.kind).toBe("dialog");
    expect(result.pendingImport.type).toBe("uid");
    expect(result.pendingImport.uid).toBe("800000000");
    expect(result.pendingImport.nickname).toBe("Player");
    expect(result.pendingImport.clearBeforeImport).toBe(false);
  });

  it("creates UID profile directly when no matching profile and no 'default'", () => {
    const result = routeUidImport(
      {},
      "800000000",
      dataA,
      "Player",
      false,
      identityMerge
    ) as DirectImport;

    expect(result.kind).toBe("direct");
    expect(result.id).toBe("800000000");
    expect(result.name).toBe("Player");
    expect(result.activeId).toBe("800000000");
  });

  it("creates UID profile directly even when other UID profiles exist (no 'default')", () => {
    const accounts = { "700000001": makeAccount("700000001") };
    const result = routeUidImport(
      accounts,
      "800000002",
      dataA,
      "",
      false,
      identityMerge
    ) as DirectImport;

    // Must NOT open dialog — only default triggers dialog
    expect(result.kind).toBe("direct");
    expect(result.id).toBe("800000002");
  });
});

// ─── routeResolveImport ───────────────────────────────────────────────────────

describe("routeResolveImport", () => {
  const jsonPending: PendingImport = {
    type: "json",
    uid: "",
    data: dataA,
    nickname: "",
  };
  const uidPending: PendingImport = {
    type: "uid",
    uid: "800000000",
    data: dataA,
    nickname: "Player",
  };

  it("creates a new account for JSON import create action", () => {
    const accounts = { default: makeAccount("default") };
    const result = routeResolveImport(
      accounts,
      jsonPending,
      "create",
      "900000001",
      "900000001",
      identityMerge
    );

    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.id).toBe("900000001");
    expect(result.name).toBe("900000001");
    expect(result.activeId).toBe("900000001");
    expect(result.promoteToId).toBeUndefined();
  });

  it("creates a new UID account for UID import create action", () => {
    const accounts = { default: makeAccount("default") };
    const result = routeResolveImport(
      accounts,
      uidPending,
      "create",
      "800000000",
      "Player",
      identityMerge
    );

    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.id).toBe("800000000");
    expect(result.name).toBe("Player");
    expect(result.activeId).toBe("800000000");
    expect(result.promoteToId).toBeUndefined(); // create never promotes
  });

  it("overwrites existing profile for JSON overwrite action", () => {
    const accounts = { default: makeAccount("default", { data: dataB }) };
    const result = routeResolveImport(
      accounts,
      jsonPending,
      "overwrite",
      "default",
      undefined,
      identityMerge
    );

    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.id).toBe("default");
    expect(result.data).toBe(dataA);
    expect(result.activeId).toBe("default");
    expect(result.promoteToId).toBeUndefined();
  });

  it("merges into 'default' for UID merge action and encodes key promotion", () => {
    const accounts = { default: makeAccount("default") };
    let mergeCalled = false;
    const result = routeResolveImport(
      accounts,
      uidPending,
      "merge",
      "default",
      "Player",
      (_old, incoming) => {
        mergeCalled = true;
        return incoming;
      }
    );

    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.id).toBe("default"); // write here first
    expect(result.promoteToId).toBe("800000000"); // then rename key
    expect(result.activeId).toBe("800000000"); // active = uid
    expect(result.name).toBe("Player");
    expect(mergeCalled).toBe(true);
  });

  it("overwrites 'default' for UID overwrite action and encodes key promotion", () => {
    const accounts = { default: makeAccount("default") };
    const result = routeResolveImport(
      accounts,
      uidPending,
      "overwrite",
      "default",
      "Player",
      identityMerge
    );

    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.id).toBe("default");
    expect(result.promoteToId).toBe("800000000");
    expect(result.activeId).toBe("800000000");
  });

  it("returns account_not_found when target was deleted while dialog was open", () => {
    const result = routeResolveImport(
      {},
      jsonPending,
      "overwrite",
      "default",
      undefined,
      identityMerge
    );

    expect(result.kind).toBe("account_not_found");
  });

  it("does not promote when UID import targets an account already keyed by that UID", () => {
    const accounts = { "800000000": makeAccount("800000000") };
    const result = routeResolveImport(
      accounts,
      uidPending,
      "merge",
      "800000000",
      undefined,
      identityMerge
    );

    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.promoteToId).toBeUndefined();
    expect(result.activeId).toBe("800000000");
  });
});

// ─── Multi-step user journeys ─────────────────────────────────────────────────

describe("user journeys", () => {
  it("J1: JSON (no UID) → default → Enka UID → dialog → merge → promotes → Enka again → direct", () => {
    let accounts: Record<string, AccountState> = {};

    // Step 1: First JSON import, no UID — creates "default"
    const s1 = routeLocalImport(accounts, dataA, "", "Default Account");
    expect(s1.kind).toBe("direct");
    expect((s1 as DirectImport).id).toBe("default");
    accounts = applyDirect(accounts, s1 as DirectImport);
    expect(accounts.default).toBeDefined();

    // Step 2: Enka UID "800000000" — no UID profile, "default" exists → dialog
    const s2 = routeUidImport(
      accounts,
      "800000000",
      dataB,
      "Player",
      false,
      identityMerge
    );
    expect(s2.kind).toBe("dialog");
    const pending = (s2 as OpenDialog).pendingImport;
    expect(pending.uid).toBe("800000000");

    // Step 3: User resolves dialog — merge into "default"
    const s3 = routeResolveImport(
      accounts,
      pending,
      "merge",
      "default",
      "Player",
      identityMerge
    );
    expect(s3.kind).toBe("apply");
    if (s3.kind !== "apply") return;
    expect(s3.promoteToId).toBe("800000000");
    expect(s3.activeId).toBe("800000000");
    accounts = applyResolve(accounts, s3);
    expect(accounts["800000000"]).toBeDefined();
    expect(accounts.default).toBeUndefined(); // promoted away

    // Step 4: Same Enka UID import again — routes directly, no dialog
    const s4 = routeUidImport(
      accounts,
      "800000000",
      dataA,
      "Player",
      false,
      identityMerge
    );
    expect(s4.kind).toBe("direct");
    expect((s4 as DirectImport).id).toBe("800000000");
  });

  it("J2: JSON with UID → direct → second JSON without UID → opens dialog", () => {
    let accounts: Record<string, AccountState> = {};

    // Step 1: JSON with UID "800000001" — direct
    const s1 = routeLocalImport(
      accounts,
      dataA,
      "800000001",
      "Default Account"
    ) as DirectImport;
    expect(s1.kind).toBe("direct");
    accounts = applyDirect(accounts, s1);

    // Step 2: JSON without UID — existing profiles present → dialog
    const s2 = routeLocalImport(accounts, dataB, "", "Default Account");
    expect(s2.kind).toBe("dialog");
    expect((s2 as OpenDialog).pendingImport.type).toBe("json");
  });

  it("J3: Enka UID-A then Enka UID-B, no 'default' — both create directly, no dialog", () => {
    let accounts: Record<string, AccountState> = {};

    const s1 = routeUidImport(
      accounts,
      "700000001",
      dataA,
      "Alice",
      false,
      identityMerge
    ) as DirectImport;
    expect(s1.kind).toBe("direct");
    accounts = applyDirect(accounts, s1);

    // UID-B: no profile for B, but also no "default" — create directly
    const s2 = routeUidImport(
      accounts,
      "800000002",
      dataB,
      "Bob",
      false,
      identityMerge
    ) as DirectImport;
    expect(s2.kind).toBe("direct");
    expect(s2.id).toBe("800000002");
    accounts = applyDirect(accounts, s2);

    expect(Object.keys(accounts)).toHaveLength(2);
    expect(accounts["700000001"]).toBeDefined();
    expect(accounts["800000002"]).toBeDefined();
  });

  it("J4: JSON (no UID) → default → promote default to UID → Enka same UID → direct (no dialog)", () => {
    let accounts: Record<string, AccountState> = {};

    // Step 1: Create default
    const s1 = routeLocalImport(
      accounts,
      dataA,
      "",
      "Default Account"
    ) as DirectImport;
    accounts = applyDirect(accounts, s1);

    // Step 2: User edits UID in dialog (simulate promoteToUid("default", "800000003"))
    accounts["800000003"] = { ...accounts.default, id: "800000003" };
    const { default: _removed, ...rest } = accounts;
    accounts = rest;
    expect(accounts["800000003"]).toBeDefined();
    expect(accounts.default).toBeUndefined();

    // Step 3: Enka import for "800000003" — profile exists → direct, no dialog
    const s3 = routeUidImport(
      accounts,
      "800000003",
      dataB,
      "Player",
      false,
      identityMerge
    );
    expect(s3.kind).toBe("direct");
    expect((s3 as DirectImport).id).toBe("800000003");
  });

  it("J5: Enka UID → dialog → create new → Enka same UID again → direct", () => {
    let accounts: Record<string, AccountState> = {
      default: makeAccount("default"),
    };

    // Step 1: Enka "800000004" — no profile, default exists → dialog
    const s1 = routeUidImport(
      accounts,
      "800000004",
      dataA,
      "Player",
      false,
      identityMerge
    ) as OpenDialog;
    expect(s1.kind).toBe("dialog");

    // Step 2: User picks "create new" — targetId === uid
    const s2 = routeResolveImport(
      accounts,
      s1.pendingImport,
      "create",
      "800000004",
      "Player",
      identityMerge
    );
    expect(s2.kind).toBe("apply");
    if (s2.kind !== "apply") return;
    expect(s2.id).toBe("800000004");
    expect(s2.promoteToId).toBeUndefined();
    accounts = applyResolve(accounts, s2);
    expect(accounts["800000004"]).toBeDefined();
    expect(accounts.default).toBeDefined(); // default still exists

    // Step 3: Enka "800000004" again — profile now exists → direct
    const s3 = routeUidImport(
      accounts,
      "800000004",
      dataB,
      "Player",
      false,
      identityMerge
    );
    expect(s3.kind).toBe("direct");
    expect((s3 as DirectImport).id).toBe("800000004");
  });

  it("J6: JSON (no UID) → default → overwrite via dialog → stays as default, no promotion", () => {
    let accounts: Record<string, AccountState> = {
      default: makeAccount("default", { data: dataA }),
    };
    const pending: PendingImport = {
      type: "json",
      uid: "",
      data: dataB,
      nickname: "",
    };

    // User picks overwrite of "default"
    const result = routeResolveImport(
      accounts,
      pending,
      "overwrite",
      "default",
      undefined,
      identityMerge
    );
    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.id).toBe("default");
    expect(result.data).toBe(dataB);
    expect(result.promoteToId).toBeUndefined();
    expect(result.activeId).toBe("default");
    accounts = applyResolve(accounts, result);
    expect(accounts.default).toBeDefined();
  });

  it("J7: account deleted between dialog open and confirm → account_not_found", () => {
    const accounts: Record<string, AccountState> = {}; // account was deleted
    const pending: PendingImport = {
      type: "json",
      uid: "",
      data: dataA,
      nickname: "",
    };

    const result = routeResolveImport(
      accounts,
      pending,
      "overwrite",
      "default",
      undefined,
      identityMerge
    );
    expect(result.kind).toBe("account_not_found");
  });
});
