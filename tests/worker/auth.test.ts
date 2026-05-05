import { describe, expect, it } from "vitest";
import {
  type AppEnv,
  isAuthFailure,
  requireEntitlement,
  requireUser,
} from "../../worker/auth";

describe("Worker auth boundary", () => {
  it("rejects requests without a session token", async () => {
    const result = await requireUser(request(), {} as AppEnv);

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("keeps session auth unavailable until auth storage is configured", async () => {
    const result = await requireUser(
      request({ Authorization: "Bearer session-token" }),
      {} as AppEnv
    );

    expect(result).toEqual({
      status: 503,
      payload: { error: "backup_storage_not_configured" },
    });
  });

  it("rejects unknown session tokens", async () => {
    const result = await requireUser(
      request({ Authorization: "Bearer missing-session" }),
      {
        BACKUP_DB: new FakeAuthD1Database(null, []),
      } as unknown as AppEnv
    );

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("returns the authenticated user object for valid sessions", async () => {
    const result = await requireUser(
      request({ Authorization: "Bearer session-token" }),
      {
        BACKUP_DB: new FakeAuthD1Database(
          {
            user_id: "user_test",
            display_name: "Test User",
          },
          ["cloud_sync"]
        ),
      } as unknown as AppEnv
    );

    expect(isAuthFailure(result)).toBe(false);
    if (isAuthFailure(result)) return;
    expect(result).toMatchObject({
      userId: "user_test",
      displayName: "Test User",
      authMode: "session",
    });
    expect(result.entitlements.has("cloud_sync")).toBe(true);
  });

  it("reports entitlement failures in the shared auth shape", () => {
    const missing = requireEntitlement(
      { userId: "user_test", authMode: "session", entitlements: new Set() },
      "cloud_sync"
    );

    expect(missing).toEqual({
      status: 403,
      payload: { error: "entitlement_required", code: "cloud_sync" },
    });
  });
});

function request(headers: HeadersInit = {}) {
  return new Request("https://example.com/api/backup/v1/head", { headers });
}

type FakeSessionRow = {
  user_id: string;
  display_name: string | null;
};

class FakeAuthD1Database {
  constructor(
    readonly session: FakeSessionRow | null,
    readonly entitlements: string[]
  ) {}

  prepare(sql: string): FakeAuthD1Statement {
    return new FakeAuthD1Statement(this, sql);
  }
}

class FakeAuthD1Statement {
  constructor(
    private readonly db: FakeAuthD1Database,
    private readonly sql: string
  ) {}

  bind(): FakeAuthD1Statement {
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM auth_sessions")) {
      return this.db.session as T | null;
    }
    throw new Error(`Unhandled fake first SQL: ${this.sql}`);
  }

  async all<T>(): Promise<D1Result<T>> {
    if (this.sql.includes("FROM user_entitlements")) {
      return {
        success: true,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: 0,
          changed_db: false,
          changes: 0,
        },
        results: this.db.entitlements.map((code) => ({ code })) as T[],
      };
    }
    throw new Error(`Unhandled fake all SQL: ${this.sql}`);
  }

  async run(): Promise<D1Result> {
    if (this.sql.includes("UPDATE auth_sessions")) {
      return {
        success: true,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 1,
          last_row_id: 0,
          changed_db: true,
          changes: 1,
        },
        results: [],
      };
    }
    throw new Error(`Unhandled fake run SQL: ${this.sql}`);
  }
}
