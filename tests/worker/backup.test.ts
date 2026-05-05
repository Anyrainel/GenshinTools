import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { type BackupEnv, handleBackupRequest } from "../../worker/backup";

type UserStateRecord = {
  user_id: string;
  head_set_rev: string;
  updated_at: number;
  key_count: number;
  total_compressed_bytes: number;
};

type DeviceRecord = {
  id: string;
  user_id: string;
  device_id: string;
  label: string | null;
  created_at: number;
  last_seen_at: number;
  last_backup_at: number | null;
};

type HeadRecord = {
  user_id: string;
  partition_key: string;
  object_id: string;
  rev: string;
  schema_version: number;
  content_hash: string;
  compressed_hash: string;
  compressed_bytes: number;
  updated_at: number;
  metadata_json: string;
  source_device_row_id: string | null;
  soft_deleted_at: number | null;
};

type CommitRecord = {
  id: string;
  user_id: string;
  idempotency_key: string;
  device_row_id: string | null;
  result_json: string;
  created_at: number;
  expires_at: number;
};

type JoinedHeadRecord = {
  partition_key: string;
  object_id: string;
  rev: string;
  schema_version: number;
  content_hash: string;
  compressed_hash: string;
  compressed_bytes: number;
  updated_at: number;
  metadata_json: string;
  soft_deleted_at: number | null;
  source_device_id: string | null;
  source_device_label: string | null;
};

type BackupCommitJson = {
  idempotencyKey: string;
  committedAt: number;
  headSetRev: string;
  heads: {
    partitionKey: string;
    objectId: string;
    rev: string;
    schemaVersion: number;
    contentHash: string;
    compressedHash: string;
    compressedBytes: number;
    sourceDeviceId?: string;
    sourceDeviceLabel?: string;
    metadata?: unknown;
  }[];
};

describe("Worker backup API", () => {
  it("rejects backup requests without an auth session", async () => {
    const response = await SELF.fetch("https://example.com/api/backup/v1/head");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
    });
  });

  it("commits backup heads, supports no-change head polling, and is idempotent", async () => {
    const { env } = createBackupTestEnv();
    const firstHead = await backupFetch(env, "/head");

    expect(firstHead.status).toBe(200);
    await expect(firstHead.json()).resolves.toMatchObject({
      changed: true,
      headSetRev: "empty",
      heads: [],
    });

    const body = new TextEncoder().encode("backup-body");
    const compressedHash = await sha256(body);
    const contentHash = await sha256(new TextEncoder().encode('{"a":1}'));
    const commit = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_first",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash,
            compressedHash,
            logicalBytes: 1,
            compressedBytes: body.byteLength,
            metadata: {
              schemaVersion: 1,
              records: [{ kind: "builds", count: 2, updatedAt: 123 }],
            },
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body,
      }),
    });

    expect(commit.status).toBe(200);
    const commitJson = (await commit.json()) as BackupCommitJson;
    expect(commitJson).toMatchObject({
      idempotencyKey: "commit_first",
      heads: [
        {
          partitionKey: "builds/all",
          schemaVersion: 1,
          contentHash,
          compressedHash,
          compressedBytes: body.byteLength,
          metadata: {
            schemaVersion: 1,
            records: [{ kind: "builds", count: 2, updatedAt: 123 }],
          },
          sourceDeviceId: "device-a",
          sourceDeviceLabel: "Test Browser",
        },
      ],
    });

    const unchangedHead = await backupFetch(
      env,
      `/head?headSetRev=${commitJson.headSetRev}`
    );
    expect(unchangedHead.status).toBe(200);
    await expect(unchangedHead.json()).resolves.toMatchObject({
      changed: false,
      heads: [],
      headSetRev: commitJson.headSetRev,
    });

    const retry = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_first",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash,
            compressedHash,
            logicalBytes: 1,
            compressedBytes: body.byteLength,
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body,
      }),
    });
    expect(await retry.json()).toEqual(commitJson);
  });

  it("rejects stale write modes before writing R2 objects", async () => {
    const { env, bucket } = createBackupTestEnv();
    const body = new TextEncoder().encode("backup-body");
    const compressedHash = await sha256(body);
    const contentHash = await sha256(new TextEncoder().encode('{"a":1}'));

    await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_first",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash,
            compressedHash,
            compressedBytes: body.byteLength,
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body,
      }),
    });
    const objectCountBeforeConflict = bucket.objects.size;

    const conflict = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_conflict",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash,
            compressedHash,
            compressedBytes: body.byteLength,
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body,
      }),
    });

    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: "revision_conflict",
      conflicts: [
        {
          partitionKey: "builds/all",
          writeMode: { kind: "ifAbsent" },
          currentHead: { partitionKey: "builds/all" },
        },
      ],
    });
    expect(bucket.objects.size).toBe(objectCountBeforeConflict);
  });

  it("downloads current backup objects by object id", async () => {
    const { env } = createBackupTestEnv();
    const body = new TextEncoder().encode("backup-body");
    const compressedHash = await sha256(body);
    const contentHash = await sha256(new TextEncoder().encode('{"a":1}'));

    const commit = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_first",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash,
            compressedHash,
            compressedBytes: body.byteLength,
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body,
      }),
    });
    const commitJson = (await commit.json()) as BackupCommitJson;
    const objectId = commitJson.heads[0].objectId;

    const download = await backupFetch(env, "/objects", {
      method: "POST",
      body: JSON.stringify({ objectIds: [objectId] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(download.status).toBe(200);
    const form = await download.formData();
    const manifestPart = form.get("manifest");
    const objectPart = form.get(objectId);
    expect(manifestPart).toBeInstanceOf(Blob);
    expect(objectPart).toBeInstanceOf(Blob);
    expect(JSON.parse(await (manifestPart as Blob).text())).toMatchObject({
      objects: [{ objectId, partitionKey: "builds/all" }],
    });
    expect(await (objectPart as Blob).text()).toBe("backup-body");
  });
});

function createBackupTestEnv(): {
  env: BackupEnv;
  db: FakeD1Database;
  bucket: FakeR2Bucket;
} {
  const db = new FakeD1Database();
  const bucket = new FakeR2Bucket();
  return {
    db,
    bucket,
    env: {
      ASSETS: { fetch: async () => new Response("asset") },
      BACKUP_DB: db as unknown as D1Database,
      BACKUP_BUCKET: bucket as unknown as R2Bucket,
    } as unknown as BackupEnv,
  };
}

function backupFetch(
  env: BackupEnv,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer session-token");
  return handleBackupRequest(
    new Request(`https://example.com/api/backup/v1${path}`, {
      ...init,
      headers,
    }),
    new URL(`https://example.com/api/backup/v1${path}`),
    env
  );
}

function makeCommitForm(options: {
  idempotencyKey: string;
  puts: unknown[];
  body: Uint8Array;
}): FormData {
  const form = new FormData();
  form.append(
    "manifest",
    new Blob(
      [
        JSON.stringify({
          idempotencyKey: options.idempotencyKey,
          deviceId: "device-a",
          deviceLabel: "Test Browser",
          puts: options.puts.map((put) => ({
            metadata: { schemaVersion: 1, records: [] },
            ...(put as object),
          })),
          deletes: [],
        }),
      ],
      { type: "application/json" }
    ),
    "manifest.json"
  );
  form.append("builds", new Blob([options.body]), "builds.json.gz");
  return form;
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

class FakeD1Database {
  readonly userStates = new Map<string, UserStateRecord>();
  readonly devices = new Map<string, DeviceRecord>();
  readonly heads = new Map<string, HeadRecord>();
  readonly commits = new Map<string, CommitRecord>();

  prepare(sql: string): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this, sql);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const statement of statements) {
      results.push(
        await (statement as unknown as FakeD1PreparedStatement).run()
      );
    }
    return results;
  }
}

class FakeD1PreparedStatement {
  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
    private readonly args: unknown[] = []
  ) {}

  bind(...args: unknown[]): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this.db, this.sql, args);
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM auth_sessions")) {
      return {
        user_id: "user_test",
        display_name: "Test User",
      } as T;
    }

    if (this.sql.includes("FROM backup_user_state")) {
      const userId = String(this.args[0]);
      return (this.db.userStates.get(userId) ?? null) as T | null;
    }

    if (this.sql.includes("FROM backup_commits")) {
      const key = commitKey(String(this.args[0]), String(this.args[1]));
      return (this.db.commits.get(key) ?? null) as T | null;
    }

    if (this.sql.includes("FROM backup_devices")) {
      const userId = String(this.args[0]);
      const deviceId = String(this.args[1]);
      const device =
        [...this.db.devices.values()].find(
          (record) => record.user_id === userId && record.device_id === deviceId
        ) ?? null;
      return (device ? { id: device.id } : null) as T | null;
    }

    throw new Error(`Unhandled fake first SQL: ${this.sql}`);
  }

  async all<T>(): Promise<D1Result<T>> {
    if (this.sql.includes("FROM user_entitlements")) {
      return {
        results: [{ code: "cloud_sync" }] as T[],
        success: true,
        meta: d1Meta(),
      };
    }

    if (this.sql.includes("h.partition_key IN")) {
      const userId = String(this.args[0]);
      const partitionKeys = new Set(this.args.slice(1).map(String));
      return {
        results: [...this.db.heads.values()]
          .filter(
            (head) =>
              head.user_id === userId &&
              partitionKeys.has(head.partition_key) &&
              head.soft_deleted_at === null
          )
          .map((head) => this.joinHead(head)) as T[],
        success: true,
        meta: d1Meta(),
      };
    }

    if (this.sql.includes("h.object_id IN")) {
      const userId = String(this.args[0]);
      const objectIds = new Set(this.args.slice(1).map(String));
      return {
        results: [...this.db.heads.values()]
          .filter(
            (head) =>
              head.user_id === userId &&
              objectIds.has(head.object_id) &&
              head.soft_deleted_at === null
          )
          .map((head) => this.joinHead(head)) as T[],
        success: true,
        meta: d1Meta(),
      };
    }

    if (this.sql.includes("FROM backup_heads h")) {
      const userId = String(this.args[0]);
      return {
        results: [...this.db.heads.values()]
          .filter(
            (head) => head.user_id === userId && head.soft_deleted_at === null
          )
          .sort((a, b) => a.partition_key.localeCompare(b.partition_key))
          .map((head) => this.joinHead(head)) as T[],
        success: true,
        meta: d1Meta(),
      };
    }

    throw new Error(`Unhandled fake all SQL: ${this.sql}`);
  }

  async run(): Promise<D1Result> {
    if (this.sql.includes("UPDATE auth_sessions")) {
      return d1Ok();
    }

    if (this.sql.includes("INSERT INTO backup_devices")) {
      const [id, userId, deviceId, label, createdAt, lastSeenAt, lastBackupAt] =
        this.args;
      this.db.devices.set(String(id), {
        id: String(id),
        user_id: String(userId),
        device_id: String(deviceId),
        label: label === null ? null : String(label),
        created_at: Number(createdAt),
        last_seen_at: Number(lastSeenAt),
        last_backup_at: Number(lastBackupAt),
      });
      return d1Ok();
    }

    if (this.sql.includes("UPDATE backup_devices")) {
      const [label, lastSeenAt, lastBackupAt, id] = this.args;
      const device = this.db.devices.get(String(id));
      if (device) {
        device.label = label === null ? device.label : String(label);
        device.last_seen_at = Number(lastSeenAt);
        device.last_backup_at = Number(lastBackupAt);
      }
      return d1Ok();
    }

    if (this.sql.includes("INSERT INTO backup_heads")) {
      const [
        userId,
        partitionKey,
        objectId,
        rev,
        schemaVersion,
        contentHash,
        compressedHash,
        compressedBytes,
        updatedAt,
        metadataJson,
        sourceDeviceRowId,
      ] = this.args;
      this.db.heads.set(headKey(String(userId), String(partitionKey)), {
        user_id: String(userId),
        partition_key: String(partitionKey),
        object_id: String(objectId),
        rev: String(rev),
        schema_version: Number(schemaVersion),
        content_hash: String(contentHash),
        compressed_hash: String(compressedHash),
        compressed_bytes: Number(compressedBytes),
        updated_at: Number(updatedAt),
        metadata_json: String(metadataJson),
        source_device_row_id:
          sourceDeviceRowId === null ? null : String(sourceDeviceRowId),
        soft_deleted_at: null,
      });
      return d1Ok();
    }

    if (this.sql.includes("UPDATE backup_heads")) {
      const [
        softDeletedAt,
        updatedAt,
        sourceDeviceRowId,
        userId,
        partitionKey,
      ] = this.args;
      const head = this.db.heads.get(
        headKey(String(userId), String(partitionKey))
      );
      if (head) {
        head.soft_deleted_at = Number(softDeletedAt);
        head.updated_at = Number(updatedAt);
        head.source_device_row_id =
          sourceDeviceRowId === null ? null : String(sourceDeviceRowId);
      }
      return d1Ok();
    }

    if (this.sql.includes("INSERT INTO backup_user_state")) {
      const [userId, headSetRev, updatedAt] = this.args;
      const activeHeads = [...this.db.heads.values()].filter(
        (head) =>
          head.user_id === String(userId) && head.soft_deleted_at === null
      );
      this.db.userStates.set(String(userId), {
        user_id: String(userId),
        head_set_rev: String(headSetRev),
        updated_at: Number(updatedAt),
        key_count: activeHeads.length,
        total_compressed_bytes: activeHeads.reduce(
          (sum, head) => sum + head.compressed_bytes,
          0
        ),
      });
      return d1Ok();
    }

    if (this.sql.includes("INSERT INTO backup_commits")) {
      const [
        id,
        userId,
        idempotencyKey,
        deviceRowId,
        resultJson,
        createdAt,
        expiresAt,
      ] = this.args;
      this.db.commits.set(commitKey(String(userId), String(idempotencyKey)), {
        id: String(id),
        user_id: String(userId),
        idempotency_key: String(idempotencyKey),
        device_row_id: deviceRowId === null ? null : String(deviceRowId),
        result_json: String(resultJson),
        created_at: Number(createdAt),
        expires_at: Number(expiresAt),
      });
      return d1Ok();
    }

    throw new Error(`Unhandled fake run SQL: ${this.sql}`);
  }

  private joinHead(head: HeadRecord): JoinedHeadRecord {
    const device = head.source_device_row_id
      ? this.db.devices.get(head.source_device_row_id)
      : undefined;
    return {
      partition_key: head.partition_key,
      object_id: head.object_id,
      rev: head.rev,
      schema_version: head.schema_version,
      content_hash: head.content_hash,
      compressed_hash: head.compressed_hash,
      compressed_bytes: head.compressed_bytes,
      updated_at: head.updated_at,
      metadata_json: head.metadata_json,
      soft_deleted_at: head.soft_deleted_at,
      source_device_id: device?.device_id ?? null,
      source_device_label: device?.label ?? null,
    };
  }
}

class FakeR2Bucket {
  readonly objects = new Map<string, Blob>();

  async put(
    key: string,
    value: Blob,
    _options?: R2PutOptions
  ): Promise<R2Object> {
    this.objects.set(key, value);
    return { key } as R2Object;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const blob = this.objects.get(key);
    if (!blob) return null;
    return { blob: async () => blob } as R2ObjectBody;
  }
}

function headKey(userId: string, partitionKey: string): string {
  return `${userId}\0${partitionKey}`;
}

function commitKey(userId: string, idempotencyKey: string): string {
  return `${userId}\0${idempotencyKey}`;
}

function d1Ok(): D1Result {
  return { success: true, meta: d1Meta(), results: [] };
}

function d1Meta(): D1Meta & Record<string, unknown> {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes: 0,
  };
}
