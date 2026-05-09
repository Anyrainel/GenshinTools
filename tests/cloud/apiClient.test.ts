import { describe, expect, it, vi } from "vitest";
import { BackupApiClient, type BackupApiError } from "@/cloud/apiClient";

describe("BackupApiClient", () => {
  it("fetches backup heads with optional no-change token", async () => {
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
        quota: backupQuota(),
        heads: [],
      })
    ) as typeof fetch;
    const client = new BackupApiClient({
      baseUrl: "/api/backup/v1",
      fetchImpl,
      getHeaders: () => ({ Authorization: "Bearer test" }),
    });

    const response = await client.getHead({ headSetRev: "hset_old" });

    expect(response.changed).toBe(false);
    expect(response.quota).toMatchObject({ limit: 10, used: 0, remaining: 10 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/backup/v1/head?headSetRev=hset_old",
      {
        method: "GET",
        headers: { Authorization: "Bearer test" },
        credentials: "same-origin",
      }
    );
  });

  it("commits compressed object blobs with JSON manifest metadata", async () => {
    let capturedForm: FormData | undefined;
    const fetchImpl = vi.fn(async (_url, init) => {
      capturedForm = init?.body as FormData;
      return Response.json({
        idempotencyKey: "commit_1",
        committedAt: 1,
        headSetRev: "hset_1",
        quota: backupQuota(1),
        heads: [],
      });
    }) as typeof fetch;
    const client = new BackupApiClient({ fetchImpl });
    const blob = new Blob(["payload"], { type: "application/gzip" });

    await client.commit({
      idempotencyKey: "commit_1",
      deviceId: "device_1",
      deviceLabel: "Test Device",
      puts: [
        {
          commitObjectKey: "builds",
          partitionKey: "builds/all",
          schemaVersion: 1,
          contentHash:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          compressedHash:
            "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          logicalBytes: 2,
          metadata: { schemaVersion: 1, records: [] },
          writeMode: { kind: "ifAbsent" },
          bytes: blob,
        },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/backup/v1/commits", {
      method: "POST",
      headers: {},
      body: capturedForm,
      credentials: "same-origin",
    });
    expect(capturedForm).toBeDefined();
    const manifestPart = capturedForm?.get("manifest");
    expect(typeof manifestPart).toBe("string");
    const manifest = JSON.parse(manifestPart as string);
    expect(manifest).toMatchObject({
      idempotencyKey: "commit_1",
      deviceId: "device_1",
      deviceLabel: "Test Device",
      puts: [
        {
          commitObjectKey: "builds",
          partitionKey: "builds/all",
          compressedBytes: blob.size,
        },
      ],
      deletes: [],
    });
    const objectPart = capturedForm?.get("builds");
    expect(objectPart).toBeInstanceOf(Blob);
    expect((objectPart as Blob).size).toBe(blob.size);
  });

  it("downloads multipart backup objects", async () => {
    const form = new FormData();
    form.append(
      "manifest",
      new Blob([
        JSON.stringify({
          objects: [
            {
              partitionKey: "builds/all",
              objectId: "obj_1",
              rev: "rev_1",
              schemaVersion: 1,
              contentHash: "sha256:a",
              compressedHash: "sha256:b",
              compressedBytes: 7,
              updatedAt: 1,
            },
          ],
        }),
      ])
    );
    const blob = new Blob(["payload"], { type: "application/gzip" });
    form.append("obj_1", blob);
    const multipartResponse = new Response();
    vi.spyOn(multipartResponse, "formData").mockResolvedValue(form);
    const fetchImpl = vi.fn(async () => multipartResponse) as typeof fetch;
    const client = new BackupApiClient({ fetchImpl });

    const response = await client.downloadObjects(["obj_1"]);

    expect(response.manifest.objects[0]?.objectId).toBe("obj_1");
    expect(response.objects.get("obj_1")?.size).toBe(blob.size);
    expect(fetchImpl).toHaveBeenCalledWith("/api/backup/v1/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectIds: ["obj_1"] }),
      credentials: "same-origin",
    });
  });

  it("throws typed API errors for non-2xx responses", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          error: "monthly_upload_limit_exceeded",
          quota: backupQuota(10),
        },
        { status: 429 }
      )
    ) as typeof fetch;
    const client = new BackupApiClient({ fetchImpl });

    await expect(client.getHead()).rejects.toMatchObject({
      name: "BackupApiError",
      status: 429,
      payload: {
        error: "monthly_upload_limit_exceeded",
        quota: { limit: 10, used: 10, remaining: 0 },
      },
    } satisfies Partial<BackupApiError>);
  });
});

function backupQuota(used = 0) {
  return {
    period: "2026-05",
    limit: 10,
    used,
    remaining: Math.max(0, 10 - used),
    resetsAt: Date.UTC(2026, 5, 1),
  };
}
