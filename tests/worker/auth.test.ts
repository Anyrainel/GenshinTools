import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AppEnv,
  isAuthFailure,
  requireEntitlement,
  requireUser,
} from "../../worker/auth";
import { createTestJwt, sha256Hex } from "./jwtTestUtils";

describe("Worker auth boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects requests without a bearer token", async () => {
    const result = await requireUser(request(), {} as AppEnv);

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("keeps auth unavailable until auth storage is configured", async () => {
    const result = await requireUser(
      request({ Authorization: "Bearer not-a-jwt" }),
      {} as AppEnv
    );

    expect(result).toEqual({
      status: 503,
      payload: { error: "backup_storage_not_configured" },
    });
  });

  it("rejects non-JWT bearer tokens", async () => {
    const result = await requireUser(
      request({ Authorization: "Bearer not-a-jwt" }),
      {
        BACKUP_DB: new FakeAuthD1Database(),
      } as unknown as AppEnv
    );

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("validates Logto access tokens and upserts the app user", async () => {
    const issuer = "https://logto.test/oidc";
    const audience = "https://ggartifact.test/api";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience,
      subject: "logto-user-1",
      claims: {
        name: "Traveler",
        email: "traveler@example.com",
        scope: "profile",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );
    const db = new FakeAuthD1Database();

    const result = await requireUser(
      request({ Authorization: `Bearer ${token}` }),
      {
        BACKUP_DB: db,
        LOGTO_ISSUER: issuer,
        LOGTO_JWKS_URI: `${issuer}/jwks`,
        LOGTO_API_RESOURCE: audience,
      } as unknown as AppEnv
    );

    expect(isAuthFailure(result)).toBe(false);
    if (isAuthFailure(result)) return;
    expect(result).toMatchObject({
      userId: `usr_logto_${(await sha256Hex("logto-user-1")).slice(0, 32)}`,
      displayName: "Traveler",
      authMode: "logto",
    });
    expect(result.entitlements.has("cloud_sync")).toBe(true);
    expect(db.appUsers.get(result.userId)).toMatchObject({
      displayName: "Traveler",
    });
    expect(db.identities.get("logto\0logto-user-1")).toMatchObject({
      userId: result.userId,
      email: "traveler@example.com",
      displayName: "Traveler",
    });
  });

  it("rejects Logto tokens with the wrong audience", async () => {
    const issuer = "https://logto-audience.test/oidc";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience: "https://wrong.example/api",
      subject: "logto-user-1",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );

    const result = await requireUser(
      request({ Authorization: `Bearer ${token}` }),
      {
        BACKUP_DB: new FakeAuthD1Database(),
        LOGTO_ISSUER: issuer,
        LOGTO_JWKS_URI: `${issuer}/jwks`,
        LOGTO_API_RESOURCE: "https://ggartifact.test/api",
      } as unknown as AppEnv
    );

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("rejects Logto tokens with the wrong issuer", async () => {
    const issuer = "https://logto-issuer.test/oidc";
    const { token, jwks } = await createTestJwt({
      issuer: "https://other-issuer.test/oidc",
      audience: "https://ggartifact.test/api",
      subject: "logto-user-1",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );

    const result = await requireUser(
      request({ Authorization: `Bearer ${token}` }),
      {
        BACKUP_DB: new FakeAuthD1Database(),
        LOGTO_ISSUER: issuer,
        LOGTO_JWKS_URI: `${issuer}/jwks`,
        LOGTO_API_RESOURCE: "https://ggartifact.test/api",
      } as unknown as AppEnv
    );

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("rejects expired Logto tokens", async () => {
    const issuer = "https://logto-expired.test/oidc";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience: "https://ggartifact.test/api",
      subject: "logto-user-1",
      expiresIn: Math.floor(Date.now() / 1000) - 60,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );

    const result = await requireUser(
      request({ Authorization: `Bearer ${token}` }),
      {
        BACKUP_DB: new FakeAuthD1Database(),
        LOGTO_ISSUER: issuer,
        LOGTO_JWKS_URI: `${issuer}/jwks`,
        LOGTO_API_RESOURCE: "https://ggartifact.test/api",
      } as unknown as AppEnv
    );

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("rejects Logto tokens without a subject", async () => {
    const issuer = "https://logto-sub.test/oidc";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience: "https://ggartifact.test/api",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );

    const result = await requireUser(
      request({ Authorization: `Bearer ${token}` }),
      {
        BACKUP_DB: new FakeAuthD1Database(),
        LOGTO_ISSUER: issuer,
        LOGTO_JWKS_URI: `${issuer}/jwks`,
        LOGTO_API_RESOURCE: "https://ggartifact.test/api",
      } as unknown as AppEnv
    );

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("reports entitlement failures in the shared auth shape", () => {
    const missing = requireEntitlement(
      { userId: "user_test", authMode: "logto", entitlements: new Set() },
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

class FakeAuthD1Database {
  readonly appUsers = new Map<string, { displayName: string | null }>();
  readonly identities = new Map<
    string,
    {
      userId: string;
      email: string | null;
      displayName: string | null;
    }
  >();

  prepare(sql: string): FakeAuthD1Statement {
    return new FakeAuthD1Statement(this, sql);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const statement of statements) {
      results.push(await (statement as unknown as FakeAuthD1Statement).run());
    }
    return results;
  }
}

class FakeAuthD1Statement {
  constructor(
    private readonly db: FakeAuthD1Database,
    private readonly sql: string,
    private readonly args: unknown[] = []
  ) {}

  bind(...args: unknown[]): FakeAuthD1Statement {
    return new FakeAuthD1Statement(this.db, this.sql, args);
  }

  async run(): Promise<D1Result> {
    if (this.sql.includes("INSERT INTO app_users")) {
      const [userId, displayName] = this.args;
      this.db.appUsers.set(String(userId), {
        displayName: displayName === null ? null : String(displayName),
      });
      return d1Ok();
    }

    if (this.sql.includes("INSERT INTO auth_identities")) {
      const [provider, providerSubject, userId, email, displayName] = this.args;
      this.db.identities.set(
        `${String(provider)}\0${String(providerSubject)}`,
        {
          userId: String(userId),
          email: email === null ? null : String(email),
          displayName: displayName === null ? null : String(displayName),
        }
      );
      return d1Ok();
    }

    throw new Error(`Unhandled fake run SQL: ${this.sql}`);
  }
}

function d1Ok(): D1Result {
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
