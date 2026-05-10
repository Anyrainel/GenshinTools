import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AppEnv,
  handleAuthRequest,
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

  it("validates Logto ID tokens and upserts the app user", async () => {
    const issuer = "https://logto.test/oidc";
    const audience = "test-spa-app";
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
        LOGTO_APP_ID: audience,
      } as unknown as AppEnv
    );

    expect(isAuthFailure(result)).toBe(false);
    if (isAuthFailure(result)) return;
    expect(result).toMatchObject({
      userId: `usr_logto_${(await sha256Hex("logto-user-1")).slice(0, 32)}`,
      displayName: "Traveler",
      email: "traveler@example.com",
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

  it("creates and accepts first-party app sessions", async () => {
    const issuer = "https://logto-session.test/oidc";
    const audience = "test-spa-app";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience,
      subject: "logto-user-session",
      claims: {
        name: "Session Traveler",
        email: "session@example.com",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );
    const db = new FakeAuthD1Database();
    const env = {
      BACKUP_DB: db,
      LOGTO_ISSUER: issuer,
      LOGTO_JWKS_URI: `${issuer}/jwks`,
      LOGTO_APP_ID: audience,
    } as unknown as AppEnv;

    const response = await handleAuthRequest(
      request(
        { Authorization: `Bearer ${token}` },
        "/api/auth/session",
        "POST"
      ),
      new URL("https://example.com/api/auth/session"),
      env
    );
    const payload = await response.json();
    const setCookie = response.headers.get("Set-Cookie");
    const sessionCookie = setCookie?.split(";")[0] ?? "";
    const sessionResult = await requireUser(
      request({ Cookie: sessionCookie }),
      {
        BACKUP_DB: db,
      } as unknown as AppEnv
    );

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      user: {
        displayName: "Session Traveler",
        email: "session@example.com",
        authMode: "logto",
        entitlements: ["cloud_sync"],
      },
    });
    expect(setCookie).toContain("ggartifact_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(isAuthFailure(sessionResult)).toBe(false);
    if (isAuthFailure(sessionResult)) return;
    expect(sessionResult).toMatchObject({
      displayName: "Session Traveler",
      email: "session@example.com",
      authMode: "logto",
    });

    const secondResponse = await handleAuthRequest(
      request(
        {
          Authorization: `Bearer ${token}`,
          Cookie: sessionCookie,
        },
        "/api/auth/session",
        "POST"
      ),
      new URL("https://example.com/api/auth/session"),
      env
    );

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers.get("Set-Cookie")?.split(";")[0]).toBe(
      sessionCookie
    );
    expect(db.sessions.size).toBe(1);
  });

  it("renews first-party app sessions that are close to expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T00:00:00Z"));
    const issuer = "https://logto-renew-session.test/oidc";
    const audience = "test-spa-app";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience,
      subject: "logto-user-renew",
      claims: {
        email: "renew@example.com",
      },
      expiresIn: "30d",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );
    const db = new FakeAuthD1Database();
    const env = {
      BACKUP_DB: db,
      LOGTO_ISSUER: issuer,
      LOGTO_JWKS_URI: `${issuer}/jwks`,
      LOGTO_APP_ID: audience,
    } as unknown as AppEnv;

    const response = await handleAuthRequest(
      request(
        { Authorization: `Bearer ${token}` },
        "/api/auth/session",
        "POST"
      ),
      new URL("https://example.com/api/auth/session"),
      env
    );
    const sessionCookie = response.headers.get("Set-Cookie")?.split(";")[0];
    const [sessionHash, firstSession] = [...db.sessions.entries()][0];
    firstSession.expiresAt = Date.now() + 6 * 24 * 60 * 60 * 1000;

    const renewed = await handleAuthRequest(
      request(
        {
          Authorization: `Bearer ${token}`,
          Cookie: sessionCookie ?? "",
        },
        "/api/auth/session",
        "POST"
      ),
      new URL("https://example.com/api/auth/session"),
      env
    );

    expect(renewed.status).toBe(200);
    expect(renewed.headers.get("Set-Cookie")?.split(";")[0]).not.toBe(
      sessionCookie
    );
    expect(db.sessions.size).toBe(2);
    expect(db.sessions.get(sessionHash)?.expiresAt).toBe(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
    const payload = (await renewed.json()) as { expiresAt: number };
    expect(payload.expiresAt).toBe(Date.now() + 45 * 24 * 60 * 60 * 1000);
  });

  it("revokes app sessions on logout", async () => {
    const issuer = "https://logto-logout.test/oidc";
    const audience = "test-spa-app";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience,
      subject: "logto-user-logout",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );
    const db = new FakeAuthD1Database();
    const env = {
      BACKUP_DB: db,
      LOGTO_ISSUER: issuer,
      LOGTO_JWKS_URI: `${issuer}/jwks`,
      LOGTO_APP_ID: audience,
    } as unknown as AppEnv;

    const sessionResponse = await handleAuthRequest(
      request(
        { Authorization: `Bearer ${token}` },
        "/api/auth/session",
        "POST"
      ),
      new URL("https://example.com/api/auth/session"),
      env
    );
    const sessionCookie = sessionResponse.headers
      .get("Set-Cookie")
      ?.split(";")[0];

    const logoutResponse = await handleAuthRequest(
      request({ Cookie: sessionCookie ?? "" }, "/api/auth/logout", "POST"),
      new URL("https://example.com/api/auth/logout"),
      env
    );
    const sessionResult = await requireUser(
      request({ Cookie: sessionCookie ?? "" }),
      { BACKUP_DB: db } as unknown as AppEnv
    );

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(sessionResult).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("rejects Logto tokens with the wrong app audience", async () => {
    const issuer = "https://logto-audience.test/oidc";
    const { token, jwks } = await createTestJwt({
      issuer,
      audience: "wrong-spa-app",
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
        LOGTO_APP_ID: "test-spa-app",
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
      audience: "test-spa-app",
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
        LOGTO_APP_ID: "test-spa-app",
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
      audience: "test-spa-app",
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
        LOGTO_APP_ID: "test-spa-app",
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
      audience: "test-spa-app",
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
        LOGTO_APP_ID: "test-spa-app",
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

function request(
  headers: HeadersInit = {},
  path = "/api/backup/v1/head",
  method = "GET"
) {
  return new Request(`https://example.com${path}`, { headers, method });
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
  readonly sessions = new Map<
    string,
    {
      userId: string;
      expiresAt: number;
      revokedAt: number | null;
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

    if (this.sql.includes("INSERT INTO app_auth_sessions")) {
      const [tokenHash, userId, _createdAt, expiresAt] = this.args;
      this.db.sessions.set(String(tokenHash), {
        userId: String(userId),
        expiresAt: Number(expiresAt),
        revokedAt: null,
      });
      return d1Ok();
    }

    if (this.sql.includes("UPDATE app_auth_sessions")) {
      const [revokedAt, tokenHash] = this.args;
      const session = this.db.sessions.get(String(tokenHash));
      if (session && session.revokedAt === null) {
        session.revokedAt = Number(revokedAt);
      }
      return d1Ok();
    }

    throw new Error(`Unhandled fake run SQL: ${this.sql}`);
  }

  async first<T = unknown>(): Promise<T | null> {
    if (this.sql.includes("FROM app_auth_sessions")) {
      const [provider, tokenHash, now] = this.args;
      const session = this.db.sessions.get(String(tokenHash));
      if (
        !session ||
        session.revokedAt !== null ||
        session.expiresAt <= Number(now)
      ) {
        return null;
      }
      const user = this.db.appUsers.get(session.userId);
      if (!user) return null;
      const identity = [...this.db.identities.values()].find(
        (entry) => entry.userId === session.userId
      );
      return {
        user_id: session.userId,
        display_name: user.displayName,
        email: String(provider) === "logto" ? (identity?.email ?? null) : null,
        expires_at: session.expiresAt,
      } as T;
    }

    throw new Error(`Unhandled fake first SQL: ${this.sql}`);
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
