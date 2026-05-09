import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

export type AppEnv = Env & {
  BACKUP_DB?: D1Database;
  BACKUP_BUCKET?: R2Bucket;
  LOGTO_ENDPOINT?: string;
  LOGTO_ISSUER?: string;
  LOGTO_JWKS_URI?: string;
  LOGTO_APP_ID?: string;
  LOGTO_API_RESOURCE?: string;
  BACKUP_MONTHLY_UPLOAD_LIMIT?: string;
};

export type AuthenticatedUser = {
  userId: string;
  displayName?: string;
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

  if (!looksLikeJwt(bearerToken)) {
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
    return handleLogout();
  }

  return authJson({ error: "not_found" }, 404);
}

type LogtoConfig = {
  issuer: string;
  jwksUri: string;
  audience: string;
};

type LogtoIdentity = {
  subject: string;
  userId: string;
  displayName?: string;
  email?: string;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function lookupLogtoUser(
  db: D1Database,
  token: string,
  config: LogtoConfig
): Promise<AuthenticatedUser | AuthFailure> {
  const claims = await verifyLogtoToken(token, config);
  if (!claims) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  const identity = await toLogtoIdentity(claims);
  if (!identity) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  await upsertLogtoUser(db, identity);

  return {
    userId: identity.userId,
    displayName: identity.displayName,
    entitlements: new Set(["cloud_sync", ...getClaimScopes(claims)]),
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

async function handleLogout(): Promise<Response> {
  return authJson({ ok: true });
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
  const audience = (
    env.LOGTO_API_RESOURCE ||
    env.LOGTO_APP_ID ||
    DEFAULT_LOGTO_APP_ID
  ).trim();
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
