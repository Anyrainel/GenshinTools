import { BackupApiClient } from "@/cloud/apiClient";

export type CloudBackupAuth = {
  getIdToken: () => Promise<string | null | undefined>;
};

export type AppSessionResponse = {
  user: AppSessionUser;
  expiresAt: number;
};

export type AppSessionUser = {
  id: string;
  displayName?: string;
  authMode: "logto";
  entitlements: string[];
};

export class AppSessionError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "AppSessionError";
    this.status = status;
    this.payload = payload;
  }
}

export function createCloudBackupApiClient(): BackupApiClient {
  return new BackupApiClient({
    credentials: "same-origin",
  });
}

export async function createAppSession(
  auth: CloudBackupAuth,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<AppSessionResponse> {
  const token = await auth.getIdToken();
  if (!token) {
    throw new AppSessionError("Logto ID token is not available", 401, {
      error: "unauthenticated",
    });
  }

  const response = await fetchImpl("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = await readSessionErrorPayload(response);
    throw new AppSessionError(
      `create app session failed with HTTP ${response.status}`,
      response.status,
      payload
    );
  }
  return response.json() as Promise<AppSessionResponse>;
}

export async function getAppSessionUser(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<AppSessionUser> {
  const response = await fetchImpl("/api/auth/me", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = await readSessionErrorPayload(response);
    throw new AppSessionError(
      `get app session failed with HTTP ${response.status}`,
      response.status,
      payload
    );
  }
  return response.json() as Promise<AppSessionUser>;
}

export async function clearAppSession(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<void> {
  await fetchImpl("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
}

async function readSessionErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}
