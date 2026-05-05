import { describe, expect, it, vi } from "vitest";
import { createCloudBackupApiClient } from "@/cloud/session";

describe("cloud backup auth headers", () => {
  it("injects the Logto API access token into backup requests", async () => {
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
        heads: [],
      })
    ) as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    const client = createCloudBackupApiClient({
      getAccessToken: async (resource) =>
        resource === "https://ggartifact.com/api" ? "logto-token" : undefined,
    });

    await client.getHead();

    expect(fetchImpl).toHaveBeenCalledWith("/api/backup/v1/head", {
      method: "GET",
      headers: { Authorization: "Bearer logto-token" },
    });
    vi.unstubAllGlobals();
  });
});
