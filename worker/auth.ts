export type AppEnv = Env & {
  BACKUP_DB?: D1Database;
  BACKUP_BUCKET?: R2Bucket;
  BACKUP_DEV_AUTH_SECRET?: string;
};

export type AuthenticatedUser = {
  userId: string;
  entitlements: Set<string>;
  authMode: "dev";
};

export type AuthFailure = {
  status: 401 | 403 | 422 | 503;
  payload:
    | { error: "backup_auth_not_configured" }
    | { error: "unauthenticated" }
    | { error: "invalid_user" }
    | { error: "entitlement_required"; code: string };
};

export async function requireUser(
  request: Request,
  env: AppEnv
): Promise<AuthenticatedUser | AuthFailure> {
  const secret = env.BACKUP_DEV_AUTH_SECRET;
  if (!secret) {
    return {
      status: 503,
      payload: { error: "backup_auth_not_configured" },
    };
  }

  if (request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return { status: 401, payload: { error: "unauthenticated" } };
  }

  const userId = request.headers.get("x-backup-dev-user-id");
  if (!userId || !isSafeUserId(userId)) {
    return { status: 422, payload: { error: "invalid_user" } };
  }

  return {
    userId,
    entitlements: new Set(["cloud_sync"]),
    authMode: "dev",
  };
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

function isSafeUserId(value: string): boolean {
  return /^[A-Za-z0-9_:-]{1,96}$/.test(value);
}
