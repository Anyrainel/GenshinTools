import { describe, expect, it, vi } from "vitest";
import {
  createAppSession,
  createCloudBackupApiClient,
  getAppSessionUser,
} from "@/cloud/session";

describe("cloud backup auth headers", () => {
  it("uses the first-party app session cookie for backup requests", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        serverTime: 1,
        changed: false,
        headSetRev: "hset_1",
        capabilities: {
          apiVersion: 1,
          commitContentTypes: ["multipart/form-data"],
          maxObjectsPerCommit: 10,
          maxCompressedBytesPerCommit: 100,
          maxCompressedBytesPerObject: 50,
        },
        quota: {
          period: "2026-05",
          limit: 10,
          used: 0,
          remaining: 10,
          resetsAt: Date.UTC(2026, 5, 1),
        },
        heads: [],
      })
    ) as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    const client = createCloudBackupApiClient();

    await client.getHead();

    expect(fetchImpl).toHaveBeenCalledWith("/api/backup/v1/head", {
      method: "GET",
      headers: {},
      credentials: "same-origin",
    });
    vi.unstubAllGlobals();
  });

  it("creates an app session from a Logto ID token", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        user: {
          id: "usr_1",
          authMode: "logto",
          entitlements: ["cloud_sync"],
        },
        expiresAt: 1,
      })
    ) as typeof fetch;

    await createAppSession(
      { getIdToken: async () => "logto-id-token" },
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/session", {
      method: "POST",
      headers: { Authorization: "Bearer logto-id-token" },
      credentials: "same-origin",
    });
  });

  it("reads the current app session user through cookies", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "usr_1",
        authMode: "logto",
        entitlements: ["cloud_sync"],
      })
    ) as typeof fetch;

    const user = await getAppSessionUser(fetchImpl);

    expect(user.id).toBe("usr_1");
    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
    });
  });
});
