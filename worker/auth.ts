export type AppEnv = Env & {
  BACKUP_DB?: D1Database;
  BACKUP_BUCKET?: R2Bucket;
};

export type AuthenticatedUser = {
  userId: string;
  displayName?: string;
  entitlements: Set<string>;
  authMode: "session";
};

export type AuthFailure = {
  status: 401 | 403 | 422 | 503;
  payload:
    | { error: "backup_storage_not_configured" }
    | { error: "unauthenticated" }
    | { error: "invalid_user" }
    | { error: "entitlement_required"; code: string };
};

type DevLoginRequest = {
  accountId?: unknown;
};

type SessionRow = {
  user_id: string;
  display_name: string | null;
};

type EntitlementRow = {
  code: string;
};

const AUTH_API_PREFIX = "/api/auth";
const DEV_PROVIDER = "dev";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function requireUser(
  request: Request,
  env: AppEnv
): Promise<AuthenticatedUser | AuthFailure> {
  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  if (!env.BACKUP_DB) {
    return {
      status: 503,
      payload: { error: "backup_storage_not_configured" },
    };
  }

  return lookupSessionUser(env.BACKUP_DB, bearerToken);
}

export async function handleAuthRequest(
  request: Request,
  url: URL,
  env: AppEnv
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: AUTH_CORS_HEADERS });
  }

  const path = stripAuthPrefix(url.pathname);
  if (path === "/dev-login") {
    if (request.method !== "POST") {
      return authJson({ error: "method_not_allowed" }, 405);
    }
    return handleDevLogin(request, env);
  }

  if (path === "/me") {
    if (request.method !== "GET") {
      return authJson({ error: "method_not_allowed" }, 405);
    }
    const user = await requireUser(request, env);
    if (isAuthFailure(user)) return authJson(user.payload, user.status);
    return authJson(toUserPayload(user));
  }

  if (path === "/logout") {
    if (request.method !== "POST") {
      return authJson({ error: "method_not_allowed" }, 405);
    }
    return handleLogout(request, env);
  }

  return authJson({ error: "not_found" }, 404);
}

async function lookupSessionUser(
  db: D1Database,
  sessionToken: string
): Promise<AuthenticatedUser | AuthFailure> {
  const now = Date.now();
  const tokenHash = await sha256Hex(sessionToken);
  const session = await db
    .prepare(
      `SELECT u.id AS user_id, u.display_name AS display_name
       FROM auth_sessions s
       JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?
         AND u.disabled_at IS NULL
       LIMIT 1`
    )
    .bind(tokenHash, now)
    .first<SessionRow>();

  if (!session) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  await db
    .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?")
    .bind(now, tokenHash)
    .run();

  const entitlements = await selectEntitlements(db, session.user_id, now);
  return {
    userId: session.user_id,
    displayName: session.display_name ?? undefined,
    entitlements,
    authMode: "session",
  };
}

async function handleDevLogin(
  request: Request,
  env: AppEnv
): Promise<Response> {
  if (!env.BACKUP_DB) {
    return authJson({ error: "backup_storage_not_configured" }, 503);
  }

  const body = await readJsonObject<DevLoginRequest>(request);
  const providerSubject =
    typeof body.accountId === "string" ? body.accountId.trim() : "";
  if (!providerSubject || !isSafeUserId(providerSubject)) {
    return authJson({ error: "invalid_user" }, 422);
  }

  const now = Date.now();
  const userId = makeDevUserId(providerSubject);
  const displayName = providerSubject;
  const sessionToken = makeSessionToken();
  const sessionId = makeId("ses");
  const expiresAt = now + SESSION_TTL_MS;
  const tokenHash = await sha256Hex(sessionToken);

  await env.BACKUP_DB.batch([
    env.BACKUP_DB.prepare(
      `INSERT INTO app_users (id, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         display_name = excluded.display_name,
         updated_at = excluded.updated_at`
    ).bind(userId, displayName, now, now),
    env.BACKUP_DB.prepare(
      `INSERT INTO auth_identities (
         provider, provider_subject, user_id, display_name, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_subject) DO UPDATE SET
         user_id = excluded.user_id,
         display_name = excluded.display_name,
         updated_at = excluded.updated_at`
    ).bind(DEV_PROVIDER, providerSubject, userId, displayName, now, now),
    env.BACKUP_DB.prepare(
      `INSERT INTO user_entitlements (user_id, code, source, granted_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, code) DO UPDATE SET
         source = excluded.source`
    ).bind(userId, "cloud_sync", "dev", now),
    env.BACKUP_DB.prepare(
      `INSERT INTO auth_sessions (
         id, user_id, token_hash, created_at, expires_at, last_seen_at
       )
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, userId, tokenHash, now, expiresAt, now),
  ]);

  return authJson({
    sessionToken,
    expiresAt,
    user: {
      id: userId,
      displayName,
      provider: DEV_PROVIDER,
      providerSubject,
      entitlements: ["cloud_sync"],
    },
  });
}

async function handleLogout(request: Request, env: AppEnv): Promise<Response> {
  if (!env.BACKUP_DB) {
    return authJson({ error: "backup_storage_not_configured" }, 503);
  }

  const bearerToken = getBearerToken(request);
  if (bearerToken) {
    const tokenHash = await sha256Hex(bearerToken);
    await env.BACKUP_DB.prepare(
      "UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?"
    )
      .bind(Date.now(), tokenHash)
      .run();
  }

  return authJson({ ok: true });
}

async function selectEntitlements(
  db: D1Database,
  userId: string,
  now: number
): Promise<Set<string>> {
  const result = await db
    .prepare(
      `SELECT code FROM user_entitlements
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)`
    )
    .bind(userId, now)
    .all<EntitlementRow>();
  return new Set((result.results ?? []).map((row) => row.code));
}

export function requireEntitlement(
  user: AuthenticatedUser,
  code: string
): AuthFailure | null {
  if (user.entitlements.has(code)) return null;
  return {
    status: 403,
    payload: { error: "entitlement_required", code },
  };
}

export function isAuthFailure(
  result: AuthenticatedUser | AuthFailure
): result is AuthFailure {
  return "status" in result;
}

function toUserPayload(user: AuthenticatedUser) {
  return {
    id: user.userId,
    displayName: user.displayName,
    authMode: user.authMode,
    entitlements: [...user.entitlements].sort(),
  };
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function isSafeUserId(value: string): boolean {
  return /^[A-Za-z0-9_:-]{1,96}$/.test(value);
}

function makeDevUserId(providerSubject: string): string {
  return `usr_dev_${providerSubject}`;
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function makeSessionToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `sess_${crypto.randomUUID()}_${bytesToHex(bytes)}`;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readJsonObject<T extends object>(request: Request): Promise<T> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch {
    return {} as T;
  }
}

function stripAuthPrefix(pathname: string): string {
  return pathname.startsWith(AUTH_API_PREFIX)
    ? pathname.slice(AUTH_API_PREFIX.length) || "/"
    : pathname;
}

function authJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...AUTH_CORS_HEADERS, "Content-Type": "application/json" },
  });
}
