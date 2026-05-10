import { SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BackupEnv,
  handleBackupRequest,
  runBackupCleanup,
} from "../../worker/backup";
import { createTestJwt } from "./jwtTestUtils";

type UserStateRecord = {
  user_id: string;
  head_set_rev: string;
  updated_at: number;
  key_count: number;
  total_compressed_bytes: number;
  upload_period_utc: string | null;
  monthly_upload_count: number;
  monthly_put_object_count: number;
  monthly_uploaded_compressed_bytes: number;
  last_upload_at: number | null;
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
  quota: {
    period: string;
    limit: number;
    used: number;
    remaining: number;
    resetsAt: number;
  };
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

const LOGTO_AUDIENCE = "test-spa-app";
let logtoIssuer = "";
let accessToken = "";

describe("Worker backup API", () => {
  beforeEach(async () => {
    logtoIssuer = `https://backup-auth-${crypto.randomUUID()}.test/oidc`;
    const { token, jwks } = await createTestJwt({
      issuer: logtoIssuer,
      audience: LOGTO_AUDIENCE,
      subject: "backup-user-1",
      claims: { name: "Backup User" },
      expiresIn: "5y",
    });
    accessToken = token;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(jwks))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects backup requests without a bearer token", async () => {
    const response = await SELF.fetch("https://example.com/api/backup/v1/head");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
    });
  });

  it("rejects oversized commit requests before parsing multipart bodies", async () => {
    const { env } = createBackupTestEnv();
    const response = await backupFetch(env, "/commits", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=oversized",
        "Content-Length": String(6 * 1024 * 1024),
      },
      body: "--oversized--",
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "payload_too_large",
    });
  });

  it("commits backup heads, supports no-change head polling, and is idempotent", async () => {
    const { env, db } = createBackupTestEnv();
    const firstHead = await backupFetch(env, "/head");

    expect(firstHead.status).toBe(200);
    await expect(firstHead.json()).resolves.toMatchObject({
      changed: true,
      headSetRev: "empty",
      quota: {
        limit: 10,
        used: 0,
        remaining: 10,
      },
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
      quota: {
        limit: 10,
        used: 1,
        remaining: 9,
      },
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
      quota: {
        limit: 10,
        used: 1,
        remaining: 9,
      },
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
    expect([...db.userStates.values()][0]?.monthly_upload_count).toBe(1);
  });

  it("allows ten monthly uploads, rejects the eleventh, and resets at the UTC month boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
    const { env } = createBackupTestEnv();
    let currentRev: string | undefined;

    async function commitVersion(
      version: number,
      idempotencyKey = `commit_limit_${version}`
    ): Promise<Response> {
      const body = new TextEncoder().encode(`backup-body-${version}`);
      return backupFetch(env, "/commits", {
        method: "POST",
        body: makeCommitForm({
          idempotencyKey,
          puts: [
            {
              commitObjectKey: "builds",
              partitionKey: "builds/all",
              schemaVersion: 1,
              contentHash: await sha256(
                new TextEncoder().encode(JSON.stringify({ version }))
              ),
              compressedHash: await sha256(body),
              compressedBytes: body.byteLength,
              writeMode: currentRev
                ? { kind: "ifMatch", expectedRev: currentRev }
                : { kind: "ifAbsent" },
            },
          ],
          body,
        }),
      });
    }

    for (let index = 1; index <= 10; index += 1) {
      const response = await commitVersion(index);
      expect(response.status).toBe(200);
      const json = (await response.json()) as BackupCommitJson;
      expect(json.quota).toMatchObject({
        period: "2026-05",
        limit: 10,
        used: index,
        remaining: 10 - index,
        resetsAt: Date.UTC(2026, 5, 1),
      });
      currentRev = json.heads[0].rev;
    }

    const rejected = await commitVersion(11);
    expect(rejected.status).toBe(429);
    await expect(rejected.json()).resolves.toMatchObject({
      error: "monthly_upload_limit_exceeded",
      quota: {
        period: "2026-05",
        limit: 10,
        used: 10,
        remaining: 0,
      },
    });

    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    const afterReset = await commitVersion(12, "commit_limit_reset");
    expect(afterReset.status).toBe(200);
    await expect(afterReset.json()).resolves.toMatchObject({
      quota: {
        period: "2026-06",
        limit: 10,
        used: 1,
        remaining: 9,
      },
    });
  });

  it("does not increment quota for validation failures or revision conflicts", async () => {
    const { env, db } = createBackupTestEnv({ monthlyUploadLimit: "1" });
    const body = new TextEncoder().encode("backup-body");
    const compressedHash = await sha256(body);
    const contentHash = await sha256(new TextEncoder().encode('{"a":1}'));

    const invalid = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_invalid",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash: "not-a-sha256",
            compressedHash,
            compressedBytes: body.byteLength,
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body,
      }),
    });
    expect(invalid.status).toBe(422);
    expect(db.userStates.size).toBe(0);

    const committed = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_valid",
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
    expect(committed.status).toBe(200);
    expect([...db.userStates.values()][0]?.monthly_upload_count).toBe(1);

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
    expect([...db.userStates.values()][0]?.monthly_upload_count).toBe(1);
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

  it("keeps only current R2 objects and D1 backup rows after commits", async () => {
    const { env, bucket, db } = createBackupTestEnv();
    const firstBody = new TextEncoder().encode("backup-body-1");
    const firstCommit = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_cleanup_1",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash: await sha256(new TextEncoder().encode('{"a":1}')),
            compressedHash: await sha256(firstBody),
            compressedBytes: firstBody.byteLength,
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body: firstBody,
      }),
    });
    const firstJson = (await firstCommit.json()) as BackupCommitJson;
    const firstObjectKey = [...bucket.objects.keys()][0];
    expect(firstObjectKey).toContain(firstJson.heads[0].objectId);
    expect(db.commits.size).toBe(1);
    expect([...db.commits.values()][0]?.idempotency_key).toBe(
      "commit_cleanup_1"
    );

    const secondBody = new TextEncoder().encode("backup-body-2");
    const overwrite = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_cleanup_2",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash: await sha256(new TextEncoder().encode('{"a":2}')),
            compressedHash: await sha256(secondBody),
            compressedBytes: secondBody.byteLength,
            writeMode: {
              kind: "ifMatch",
              expectedRev: firstJson.heads[0].rev,
            },
          },
        ],
        body: secondBody,
      }),
    });
    const overwriteJson = (await overwrite.json()) as BackupCommitJson;
    expect(bucket.objects.has(firstObjectKey)).toBe(false);
    const secondObjectKey = [...bucket.objects.keys()][0];
    expect(secondObjectKey).toContain(overwriteJson.heads[0].objectId);
    expect(db.commits.size).toBe(1);
    expect([...db.commits.values()][0]?.idempotency_key).toBe(
      "commit_cleanup_2"
    );

    const deleted = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_cleanup_delete",
        deletes: [
          {
            partitionKey: "builds/all",
            writeMode: {
              kind: "ifMatch",
              expectedRev: overwriteJson.heads[0].rev,
            },
          },
        ],
      }),
    });

    expect(deleted.status).toBe(200);
    expect(bucket.objects.has(secondObjectKey)).toBe(false);
    expect(bucket.objects.size).toBe(0);
    expect(db.heads.size).toBe(0);
    expect(db.commits.size).toBe(1);
    expect([...db.commits.values()][0]?.idempotency_key).toBe(
      "commit_cleanup_delete"
    );
  });

  it("cleanup removes orphaned R2 objects and legacy non-current D1 rows", async () => {
    const { env, bucket, db } = createBackupTestEnv();
    const body = new TextEncoder().encode("backup-body");
    const commit = await backupFetch(env, "/commits", {
      method: "POST",
      body: makeCommitForm({
        idempotencyKey: "commit_current",
        puts: [
          {
            commitObjectKey: "builds",
            partitionKey: "builds/all",
            schemaVersion: 1,
            contentHash: await sha256(new TextEncoder().encode('{"a":1}')),
            compressedHash: await sha256(body),
            compressedBytes: body.byteLength,
            writeMode: { kind: "ifAbsent" },
          },
        ],
        body,
      }),
    });
    expect(commit.status).toBe(200);
    const userId = [...db.userStates.keys()][0];
    const currentObjectKey = [...bucket.objects.keys()][0];
    const staleObjectId = `obj_${"a".repeat(32)}`;
    const staleObjectKey = `users/${encodeURIComponent(
      userId
    )}/backup/objects/${staleObjectId}.json.gz`;
    bucket.objects.set(staleObjectKey, new Blob(["stale"]));
    db.heads.set(headKey(userId, "profile.app/0"), {
      user_id: userId,
      partition_key: "profile.app/0",
      object_id: staleObjectId,
      rev: `rev_${"b".repeat(32)}`,
      schema_version: 1,
      content_hash: `sha256:${"c".repeat(64)}`,
      compressed_hash: `sha256:${"d".repeat(64)}`,
      compressed_bytes: 5,
      updated_at: 1,
      metadata_json: JSON.stringify({ schemaVersion: 1, records: [] }),
      source_device_row_id: null,
      soft_deleted_at: 1,
    });
    db.commits.set(commitKey(userId, "commit_old"), {
      id: "commit_old",
      user_id: userId,
      idempotency_key: "commit_old",
      device_row_id: null,
      result_json: "{}",
      created_at: 1,
      expires_at: 1,
    });

    const cleanup = await runBackupCleanup(env);

    expect(cleanup).toMatchObject({
      r2ObjectsScanned: 2,
      r2ObjectsDeleted: 1,
    });
    expect(bucket.objects.has(currentObjectKey)).toBe(true);
    expect(bucket.objects.has(staleObjectKey)).toBe(false);
    expect(
      [...db.heads.values()].every((head) => head.soft_deleted_at === null)
    ).toBe(true);
    expect(
      [...db.commits.values()].map((record) => record.idempotency_key)
    ).toEqual(["commit_current"]);
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

function createBackupTestEnv(options: { monthlyUploadLimit?: string } = {}): {
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
      LOGTO_ISSUER: logtoIssuer,
      LOGTO_JWKS_URI: `${logtoIssuer}/jwks`,
      LOGTO_APP_ID: LOGTO_AUDIENCE,
      BACKUP_MONTHLY_UPLOAD_LIMIT: options.monthlyUploadLimit,
    } as unknown as BackupEnv,
  };
}

function backupFetch(
  env: BackupEnv,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
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
  puts?: unknown[];
  deletes?: unknown[];
  body?: Uint8Array;
}): FormData {
  const puts = options.puts ?? [];
  const form = new FormData();
  form.append(
    "manifest",
    new Blob(
      [
        JSON.stringify({
          idempotencyKey: options.idempotencyKey,
          deviceId: "device-a",
          deviceLabel: "Test Browser",
          puts: puts.map((put) => ({
            metadata: { schemaVersion: 1, records: [] },
            ...(put as object),
          })),
          deletes: options.deletes ?? [],
        }),
      ],
      { type: "application/json" }
    ),
    "manifest.json"
  );
  if (options.body) {
    form.append("builds", new Blob([options.body]), "builds.json.gz");
  }
  return form;
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

class FakeD1Database {
  readonly appUsers = new Map<string, { displayName: string | null }>();
  readonly identities = new Map<string, { userId: string }>();
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
    if (this.sql.includes("INSERT INTO app_users")) {
      const [userId, displayName] = this.args;
      this.db.appUsers.set(String(userId), {
        displayName: displayName === null ? null : String(displayName),
      });
      return d1Ok();
    }

    if (this.sql.includes("INSERT INTO auth_identities")) {
      const [provider, providerSubject, userId] = this.args;
      this.db.identities.set(
        `${String(provider)}\0${String(providerSubject)}`,
        { userId: String(userId) }
      );
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

    if (
      this.sql.includes("DELETE FROM backup_heads") &&
      this.sql.includes("partition_key")
    ) {
      const [userId, partitionKey] = this.args;
      this.db.heads.delete(headKey(String(userId), String(partitionKey)));
      return d1Ok();
    }

    if (this.sql.includes("DELETE FROM backup_heads")) {
      for (const [key, head] of this.db.heads) {
        if (head.soft_deleted_at !== null) {
          this.db.heads.delete(key);
        }
      }
      return d1Ok();
    }

    if (this.sql.includes("INSERT INTO backup_user_state")) {
      const [
        userId,
        updatedAt,
        uploadPeriodUtc,
        putObjectCount,
        uploadedCompressedBytes,
        lastUploadAt,
        limit,
      ] = this.args;
      const key = String(userId);
      const existing = this.db.userStates.get(key);
      if (!existing) {
        this.db.userStates.set(key, {
          user_id: key,
          head_set_rev: "empty",
          updated_at: Number(updatedAt),
          key_count: 0,
          total_compressed_bytes: 0,
          upload_period_utc: String(uploadPeriodUtc),
          monthly_upload_count: 1,
          monthly_put_object_count: Number(putObjectCount),
          monthly_uploaded_compressed_bytes: Number(uploadedCompressedBytes),
          last_upload_at: Number(lastUploadAt),
        });
        return d1Ok(1);
      }
      if (
        existing.upload_period_utc !== String(uploadPeriodUtc) ||
        existing.monthly_upload_count < Number(limit)
      ) {
        const samePeriod =
          existing.upload_period_utc === String(uploadPeriodUtc);
        existing.upload_period_utc = String(uploadPeriodUtc);
        existing.monthly_upload_count = samePeriod
          ? existing.monthly_upload_count + 1
          : 1;
        existing.monthly_put_object_count = samePeriod
          ? existing.monthly_put_object_count + Number(putObjectCount)
          : Number(putObjectCount);
        existing.monthly_uploaded_compressed_bytes = samePeriod
          ? existing.monthly_uploaded_compressed_bytes +
            Number(uploadedCompressedBytes)
          : Number(uploadedCompressedBytes);
        existing.last_upload_at = Number(lastUploadAt);
        return d1Ok(1);
      }
      return d1Ok(0);
    }

    if (this.sql.includes("UPDATE backup_user_state")) {
      if (this.sql.includes("monthly_upload_count = MAX")) {
        const [putObjectCount, uploadedCompressedBytes, userId, uploadPeriod] =
          this.args;
        const state = this.db.userStates.get(String(userId));
        if (state && state.upload_period_utc === String(uploadPeriod)) {
          state.monthly_upload_count = Math.max(
            0,
            state.monthly_upload_count - 1
          );
          state.monthly_put_object_count = Math.max(
            0,
            state.monthly_put_object_count - Number(putObjectCount)
          );
          state.monthly_uploaded_compressed_bytes = Math.max(
            0,
            state.monthly_uploaded_compressed_bytes -
              Number(uploadedCompressedBytes)
          );
        }
        return d1Ok(1);
      }

      const [headSetRev, updatedAt, countUserId, sumUserId, userId] = this.args;
      const activeHeads = [...this.db.heads.values()].filter(
        (head) =>
          head.user_id === String(countUserId) && head.soft_deleted_at === null
      );
      const state = this.db.userStates.get(String(userId));
      if (state) {
        state.head_set_rev = String(headSetRev);
        state.updated_at = Number(updatedAt);
        state.key_count = activeHeads.length;
        state.total_compressed_bytes = [...this.db.heads.values()]
          .filter(
            (head) =>
              head.user_id === String(sumUserId) &&
              head.soft_deleted_at === null
          )
          .reduce((sum, head) => sum + head.compressed_bytes, 0);
      }
      return d1Ok(state ? 1 : 0);
    }

    if (this.sql.includes("DELETE FROM backup_commits WHERE user_id")) {
      const userId = String(this.args[0]);
      for (const [key, commit] of this.db.commits) {
        if (commit.user_id === userId) {
          this.db.commits.delete(key);
        }
      }
      return d1Ok();
    }

    if (this.sql.includes("DELETE FROM backup_commits")) {
      const now = Number(this.args[0]);
      const latestByUser = new Map<string, CommitRecord>();
      for (const commit of this.db.commits.values()) {
        const latest = latestByUser.get(commit.user_id);
        if (
          !latest ||
          commit.created_at > latest.created_at ||
          (commit.created_at === latest.created_at && commit.id > latest.id)
        ) {
          latestByUser.set(commit.user_id, commit);
        }
      }
      for (const [key, commit] of this.db.commits) {
        const latest = latestByUser.get(commit.user_id);
        if (commit.expires_at <= now || commit.id !== latest?.id) {
          this.db.commits.delete(key);
        }
      }
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

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.objects.delete(key);
    }
  }

  async list(options: R2ListOptions = {}): Promise<R2Objects> {
    const prefix = options.prefix ?? "";
    const limit = options.limit ?? 1000;
    const keys = [...this.objects.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort()
      .slice(0, limit);
    return {
      objects: keys.map((key) => ({ key, uploaded: new Date(0) }) as R2Object),
      truncated: false,
      delimitedPrefixes: [],
    } as R2Objects;
  }
}

function headKey(userId: string, partitionKey: string): string {
  return `${userId}\0${partitionKey}`;
}

function commitKey(userId: string, idempotencyKey: string): string {
  return `${userId}\0${idempotencyKey}`;
}

function d1Ok(changes = 1): D1Result {
  return { success: true, meta: d1Meta(changes), results: [] };
}

function d1Meta(changes = 0): D1Meta & Record<string, unknown> {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes,
  };
}
