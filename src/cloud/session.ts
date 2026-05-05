import { BackupApiClient } from "@/cloud/apiClient";

const DEV_USER_ID_KEY = "cloud_backup_dev_user_id";
const SESSION_TOKEN_KEY = "cloud_backup_session_token";
const SESSION_EXPIRES_AT_KEY = "cloud_backup_session_expires_at";
const LEGACY_DEV_AUTH_SECRET_KEY = "cloud_backup_dev_auth_secret";

export const DEFAULT_CLOUD_BACKUP_DEV_USER_ID = "dev-user";

export type CloudBackupDevSession = {
  userId: string;
  sessionToken: string;
  expiresAt: number;
};

type DevLoginResponse = {
  sessionToken: string;
  expiresAt: number;
  user: {
    id: string;
    displayName?: string;
    provider: string;
    providerSubject: string;
    entitlements: string[];
  };
};

export function getCloudBackupDevSession(): CloudBackupDevSession | null {
  try {
    const userId = localStorage.getItem(DEV_USER_ID_KEY)?.trim() ?? "";
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY)?.trim() ?? "";
    const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_AT_KEY));
    if (!userId || !sessionToken || !Number.isFinite(expiresAt)) return null;
    if (expiresAt <= Date.now()) {
      clearCloudBackupDevSession();
      return null;
    }
    return { userId, sessionToken, expiresAt };
  } catch {
    return null;
  }
}

export async function loginCloudBackupDevAccount(
  userId: string
): Promise<CloudBackupDevSession> {
  const trimmedUserId = userId.trim();
  const response = await fetch("/api/auth/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: trimmedUserId }),
  });
  const body = (await response.json().catch(() => null)) as
    | DevLoginResponse
    | { error?: string }
    | null;

  if (!response.ok || !body || !("sessionToken" in body)) {
    const errorCode =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : null;
    if (errorCode === "backup_storage_not_configured") {
      throw new Error(
        "The local Worker is missing BACKUP_DB. Restart with npm run dev:worker and check wrangler.jsonc D1 bindings."
      );
    }
    if (errorCode === "invalid_user") {
      throw new Error("Use letters, numbers, underscore, colon, or dash.");
    }
    const detail = errorCode ? `: ${errorCode}` : "";
    throw new Error(`Dev login failed with HTTP ${response.status}${detail}`);
  }

  const session = {
    userId: body.user.providerSubject,
    sessionToken: body.sessionToken,
    expiresAt: body.expiresAt,
  };
  saveCloudBackupDevSession(session);
  return session;
}

export function saveCloudBackupDevSession(
  session: CloudBackupDevSession
): void {
  localStorage.setItem(DEV_USER_ID_KEY, session.userId.trim());
  localStorage.setItem(SESSION_TOKEN_KEY, session.sessionToken);
  localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(session.expiresAt));
  localStorage.removeItem(LEGACY_DEV_AUTH_SECRET_KEY);
}

export function clearCloudBackupDevSession(): void {
  localStorage.removeItem(DEV_USER_ID_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
  localStorage.removeItem(LEGACY_DEV_AUTH_SECRET_KEY);
}

export function createCloudBackupApiClient(): BackupApiClient {
  return new BackupApiClient({
    getHeaders: (): HeadersInit => {
      const session = getCloudBackupDevSession();
      if (!session) return new Headers();
      return {
        Authorization: `Bearer ${session.sessionToken}`,
      };
    },
  });
}
