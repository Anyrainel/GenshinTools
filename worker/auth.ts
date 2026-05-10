import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

export type AppEnv = Env & {
  BACKUP_DB?: D1Database;
  BACKUP_BUCKET?: R2Bucket;
  LOGTO_ENDPOINT?: string;
  LOGTO_ISSUER?: string;
  LOGTO_JWKS_URI?: string;
  LOGTO_APP_ID?: string;
  BACKUP_MONTHLY_UPLOAD_LIMIT?: string;
};

export type AuthenticatedUser = {
  userId: string;
  displayName?: string;
  email?: string;
  entitlements: Set<string>;
  authMode: "logto";
};

export type AuthFailure = {
  status: 401 | 403 | 503;
  payload:
    | { error: "backup_storage_not_configured" }
    | { error: "unauthenticated" }
    | { error: "entitlement_required"; code: string };
};

const AUTH_API_PREFIX = "/api/auth";
const LOGTO_PROVIDER = "logto";
const DEFAULT_LOGTO_ENDPOINT = "https://auth.ggartifact.com";
const DEFAULT_LOGTO_APP_ID = "tglrsenlbfrfrnevjwlan";
const APP_SESSION_COOKIE = "ggartifact_session";
const APP_SESSION_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const APP_SESSION_RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;
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
  const appSessionToken = getCookieValue(request, APP_SESSION_COOKIE);
  if (!bearerToken && !appSessionToken) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  if (!env.BACKUP_DB) {
    return {
      status: 503,
      payload: { error: "backup_storage_not_configured" },
    };
  }

  if (appSessionToken) {
    const appSessionUser = await lookupAppSessionUser(
      env.BACKUP_DB,
      appSessionToken
    );
    if (appSessionUser) return appSessionUser;
    if (!bearerToken) {
      return { status: 401, payload: { error: "unauthenticated" } };
    }
  }

  if (!bearerToken || !looksLikeJwt(bearerToken)) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  const logtoConfig = getLogtoConfig(env);
  if (logtoConfig) {
    return lookupLogtoUser(env.BACKUP_DB, bearerToken, logtoConfig);
  }

  return { status: 401, payload: { error: "unauthenticated" } };
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
  if (path === "/session") {
    if (request.method !== "POST") {
      return authJson({ error: "method_not_allowed" }, 405);
    }
    return handleCreateSession(request, env);
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

type LogtoConfig = {
  issuer: string;
  jwksUri: string;
  audience: string;
};

type AppSessionRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  expires_at: number;
};

type LogtoIdentity = {
  subject: string;
  userId: string;
  displayName?: string;
  email?: string;
};

type AppSession = {
  token: string;
  expiresAt: number;
};

type StoredAppSession = {
  user: AuthenticatedUser;
  expiresAt: number;
};

type VerifiedLogtoIdentity = {
  claims: JWTPayload;
  identity: LogtoIdentity;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function lookupLogtoUser(
  db: D1Database,
  token: string,
  config: LogtoConfig
): Promise<AuthenticatedUser | AuthFailure> {
  const verified = await verifyLogtoIdentity(token, config);
  if (!verified) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  await upsertLogtoUser(db, verified.identity);
  return toAuthenticatedLogtoUser(verified);
}

async function verifyLogtoIdentity(
  token: string,
  config: LogtoConfig
): Promise<VerifiedLogtoIdentity | null> {
  const claims = await verifyLogtoToken(token, config);
  if (!claims) return null;

  const identity = await toLogtoIdentity(claims);
  if (!identity) return null;
  return { claims, identity };
}

function toAuthenticatedLogtoUser(
  verified: VerifiedLogtoIdentity
): AuthenticatedUser {
  return {
    userId: verified.identity.userId,
    displayName: verified.identity.displayName,
    email: verified.identity.email,
    entitlements: new Set(["cloud_sync", ...getClaimScopes(verified.claims)]),
    authMode: "logto",
  };
}

async function verifyLogtoToken(
  token: string,
  config: LogtoConfig
): Promise<JWTPayload | null> {
  try {
    const jwks = getJwks(config.jwksUri);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
    });
    return payload;
  } catch {
    return null;
  }
}

async function toLogtoIdentity(
  claims: JWTPayload
): Promise<LogtoIdentity | null> {
  if (!claims.sub) return null;
  const subject = claims.sub;
  return {
    subject,
    userId: `usr_logto_${(await sha256Hex(subject)).slice(0, 32)}`,
    displayName: getOptionalStringClaim(claims, "name") ?? undefined,
    email: getOptionalStringClaim(claims, "email") ?? undefined,
  };
}

async function upsertLogtoUser(
  db: D1Database,
  identity: LogtoIdentity
): Promise<void> {
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO app_users (id, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, app_users.display_name),
         updated_at = excluded.updated_at`
      )
      .bind(identity.userId, identity.displayName ?? null, now, now),
    db
      .prepare(
        `INSERT INTO auth_identities (
         provider, provider_subject, user_id, email, display_name, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_subject) DO UPDATE SET
         user_id = excluded.user_id,
         email = excluded.email,
         display_name = excluded.display_name,
         updated_at = excluded.updated_at`
      )
      .bind(
        LOGTO_PROVIDER,
        identity.subject,
        identity.userId,
        identity.email ?? null,
        identity.displayName ?? null,
        now,
        now
      ),
  ]);
}

async function handleCreateSession(
  request: Request,
  env: AppEnv
): Promise<Response> {
  const bearerToken = getBearerToken(request);
  if (!bearerToken || !looksLikeJwt(bearerToken)) {
    return authJson({ error: "unauthenticated" }, 401);
  }

  if (!env.BACKUP_DB) {
    return authJson({ error: "backup_storage_not_configured" }, 503);
  }

  const logtoConfig = getLogtoConfig(env);
  if (!logtoConfig) return authJson({ error: "unauthenticated" }, 401);

  const verified = await verifyLogtoIdentity(bearerToken, logtoConfig);
  if (!verified) return authJson({ error: "unauthenticated" }, 401);

  const appSessionToken = getCookieValue(request, APP_SESSION_COOKIE);
  if (appSessionToken) {
    const existingSession = await lookupAppSession(
      env.BACKUP_DB,
      appSessionToken
    );
    if (
      existingSession?.user.userId === verified.identity.userId &&
      existingSession.expiresAt - Date.now() > APP_SESSION_RENEW_WITHIN_MS
    ) {
      return authJson(
        {
          user: toUserPayload(existingSession.user),
          expiresAt: existingSession.expiresAt,
        },
        200,
        {
          "Set-Cookie": serializeAppSessionCookie(
            request,
            appSessionToken,
            existingSession.expiresAt
          ),
        }
      );
    }
  }

  await upsertLogtoUser(env.BACKUP_DB, verified.identity);
  const user = toAuthenticatedLogtoUser(verified);
  const session = await createAppSession(env.BACKUP_DB, user.userId);
  return authJson(
    {
      user: toUserPayload(user),
      expiresAt: session.expiresAt,
    },
    200,
    {
      "Set-Cookie": serializeAppSessionCookie(
        request,
        session.token,
        session.expiresAt
      ),
    }
  );
}

async function handleLogout(request: Request, env: AppEnv): Promise<Response> {
  if (env.BACKUP_DB) {
    const appSessionToken = getCookieValue(request, APP_SESSION_COOKIE);
    if (appSessionToken) {
      await revokeAppSession(env.BACKUP_DB, appSessionToken);
    }
  }
  return authJson({ ok: true }, 200, {
    "Set-Cookie": serializeExpiredAppSessionCookie(request),
  });
}

async function lookupAppSessionUser(
  db: D1Database,
  token: string
): Promise<AuthenticatedUser | null> {
  return (await lookupAppSession(db, token))?.user ?? null;
}

async function lookupAppSession(
  db: D1Database,
  token: string
): Promise<StoredAppSession | null> {
  const now = Date.now();
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.display_name, i.email
       FROM app_auth_sessions s
       JOIN app_users u ON u.id = s.user_id
       LEFT JOIN auth_identities i
         ON i.user_id = s.user_id
        AND i.provider = ?
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?
       LIMIT 1`
    )
    .bind(LOGTO_PROVIDER, tokenHash, now)
    .first<AppSessionRow>();
  if (!row) return null;
  return {
    user: {
      userId: row.user_id,
      displayName: row.display_name ?? undefined,
      email: row.email ?? undefined,
      entitlements: new Set(["cloud_sync"]),
      authMode: "logto",
    },
    expiresAt: row.expires_at,
  };
}

async function createAppSession(
  db: D1Database,
  userId: string
): Promise<AppSession> {
  const now = Date.now();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = now + APP_SESSION_TTL_MS;
  await db
    .prepare(
      `INSERT INTO app_auth_sessions (
         token_hash, user_id, created_at, expires_at, last_seen_at, revoked_at
       )
       VALUES (?, ?, ?, ?, ?, NULL)`
    )
    .bind(tokenHash, userId, now, expiresAt, now)
    .run();
  return { token, expiresAt };
}

async function revokeAppSession(db: D1Database, token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await db
    .prepare(
      `UPDATE app_auth_sessions
       SET revoked_at = COALESCE(revoked_at, ?)
       WHERE token_hash = ?`
    )
    .bind(Date.now(), tokenHash)
    .run();
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
    email: user.email,
    authMode: user.authMode,
    entitlements: [...user.entitlements].sort(),
  };
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function getCookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name) continue;
    return rawValue.join("=") || null;
  }
  return null;
}

function serializeAppSessionCookie(
  request: Request,
  token: string,
  expiresAt: number
): string {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return [
    `${APP_SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
    ...(new URL(request.url).protocol === "https:" ? ["Secure"] : []),
  ].join("; ");
}

function serializeExpiredAppSessionCookie(request: Request): string {
  return [
    `${APP_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...(new URL(request.url).protocol === "https:" ? ["Secure"] : []),
  ].join("; ");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function looksLikeJwt(value: string): boolean {
  return value.split(".").length === 3;
}

function getLogtoConfig(env: AppEnv): LogtoConfig | null {
  const endpoint = normalizeUrl(env.LOGTO_ENDPOINT ?? DEFAULT_LOGTO_ENDPOINT);
  const issuer = normalizeUrl(
    env.LOGTO_ISSUER ?? (endpoint ? `${endpoint}/oidc` : undefined)
  );
  const jwksUri = normalizeUrl(
    env.LOGTO_JWKS_URI ?? (issuer ? `${issuer}/jwks` : undefined)
  );
  const audience = (env.LOGTO_APP_ID || DEFAULT_LOGTO_APP_ID).trim();
  if (!issuer || !jwksUri || !audience) return null;
  return { issuer, jwksUri, audience };
}

function getJwks(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache.get(jwksUri);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(jwksUri));
  jwksCache.set(jwksUri, jwks);
  return jwks;
}

function normalizeUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function getOptionalStringClaim(
  claims: JWTPayload,
  key: string
): string | null {
  const value = claims[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getClaimScopes(claims: JWTPayload): string[] {
  const scope = claims.scope;
  if (typeof scope === "string") {
    return scope
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function stripAuthPrefix(pathname: string): string {
  return pathname.startsWith(AUTH_API_PREFIX)
    ? pathname.slice(AUTH_API_PREFIX.length) || "/"
    : pathname;
}

function authJson(
  payload: unknown,
  status = 200,
  headers: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...AUTH_CORS_HEADERS,
      ...Object.fromEntries(new Headers(headers).entries()),
      "Content-Type": "application/json",
    },
  });
}
