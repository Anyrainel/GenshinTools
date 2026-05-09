import { describe, expect, it, vi } from "vitest";
import { createCloudBackupApiClient } from "@/cloud/session";

describe("cloud backup auth headers", () => {
  it("injects the Logto ID token into backup requests by default", async () => {
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

    const client = createCloudBackupApiClient({
      getAccessToken: async () => undefined,
      getIdToken: async () => "logto-id-token",
    });

    await client.getHead();

    expect(fetchImpl).toHaveBeenCalledWith("/api/backup/v1/head", {
      method: "GET",
      headers: { Authorization: "Bearer logto-id-token" },
    });
    vi.unstubAllGlobals();
  });
});
