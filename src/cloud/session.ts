import { BackupApiClient } from "@/cloud/apiClient";

const DEV_USER_ID_KEY = "cloud_backup_dev_user_id";
const DEV_AUTH_SECRET_KEY = "cloud_backup_dev_auth_secret";

export type CloudBackupDevSession = {
  userId: string;
  authSecret: string;
};

export function getCloudBackupDevSession(): CloudBackupDevSession | null {
  try {
    const userId = localStorage.getItem(DEV_USER_ID_KEY)?.trim() ?? "";
    const authSecret = localStorage.getItem(DEV_AUTH_SECRET_KEY)?.trim() ?? "";
    return userId && authSecret ? { userId, authSecret } : null;
  } catch {
    return null;
  }
}

export function saveCloudBackupDevSession(
  session: CloudBackupDevSession
): void {
  localStorage.setItem(DEV_USER_ID_KEY, session.userId.trim());
  localStorage.setItem(DEV_AUTH_SECRET_KEY, session.authSecret.trim());
}

export function clearCloudBackupDevSession(): void {
  localStorage.removeItem(DEV_USER_ID_KEY);
  localStorage.removeItem(DEV_AUTH_SECRET_KEY);
}

export function createCloudBackupApiClient(): BackupApiClient {
  return new BackupApiClient({
    getHeaders: (): HeadersInit => {
      const session = getCloudBackupDevSession();
      if (!session) return new Headers();
      return {
        Authorization: `Bearer ${session.authSecret}`,
        "x-backup-dev-user-id": session.userId,
      };
    },
  });
}
