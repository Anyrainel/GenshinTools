import { BackupApiClient } from "@/cloud/apiClient";
import { LOGTO_API_RESOURCE } from "@/cloud/authConfig";

export type CloudBackupAuth = {
  getAccessToken: (resource?: string) => Promise<string | null | undefined>;
  getIdToken: () => Promise<string | null | undefined>;
};

export function createCloudBackupApiClient(
  auth?: CloudBackupAuth
): BackupApiClient {
  return new BackupApiClient({
    getHeaders: async (): Promise<HeadersInit> => {
      const token = LOGTO_API_RESOURCE
        ? await auth?.getAccessToken(LOGTO_API_RESOURCE)
        : await auth?.getIdToken();
      if (!token) return new Headers();
      return {
        Authorization: `Bearer ${token}`,
      };
    },
  });
}
