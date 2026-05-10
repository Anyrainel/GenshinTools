import {
  type AppEnv,
  type AuthenticatedUser,
  isAuthFailure,
  requireEntitlement,
  requireUser,
} from "./auth";

const BACKUP_API_PREFIX = "/api/backup/v1";

const BACKUP_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_BACKUP_MONTHLY_UPLOAD_LIMIT = 10;
const MAX_COMMIT_REQUEST_OVERHEAD_BYTES = 256 * 1024;

const BACKUP_LIMITS = {
  maxObjectsPerCommit: 10,
  maxCompressedBytesPerCommit: 5 * 1024 * 1024,
  maxCommitRequestBytes: 5 * 1024 * 1024 + MAX_COMMIT_REQUEST_OVERHEAD_BYTES,
  maxCompressedBytesPerObject: 2 * 1024 * 1024,
  maxObjectDownloads: 10,
  maxCompressedBytesPerDownload: 5 * 1024 * 1024,
};

const BACKUP_CLEANUP_LIMITS = {
  maxR2ObjectsPerRun: 1000,
  orphanDeleteGraceMs: 60 * 60 * 1000,
};

const BACKUP_CAPABILITIES = {
  apiVersion: 1,
  commitContentTypes: ["multipart/form-data"],
  maxObjectsPerCommit: BACKUP_LIMITS.maxObjectsPerCommit,
  maxCompressedBytesPerCommit: BACKUP_LIMITS.maxCompressedBytesPerCommit,
  maxCompressedBytesPerObject: BACKUP_LIMITS.maxCompressedBytesPerObject,
};

export type BackupEnv = AppEnv;

type BackupHeadRow = {
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

type BackupRecordKind =
  | "characters"
  | "weapons"
  | "artifacts"
  | "frozen"
  | "settings"
  | "builds"
  | "teams"
  | "teamConfigs"
  | "tiers";

type BackupHeadMetadataRecord = {
  kind: BackupRecordKind;
  count: number;
  profileId?: string;
  updatedAt?: number;
};

type BackupHeadMetadata = {
  schemaVersion: 1;
  records: BackupHeadMetadataRecord[];
};

type BackupHead = {
  partitionKey: string;
  rev: string;
  objectId: string;
  schemaVersion: number;
  contentHash: string;
  compressedHash: string;
  compressedBytes: number;
  updatedAt: number;
  metadata: BackupHeadMetadata;
  sourceDeviceId?: string;
  sourceDeviceLabel?: string;
  deletedAt?: number;
};

type BackupUploadQuota = {
  period: string;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: number;
};

type BackupUserStateRow = {
  head_set_rev: string;
  upload_period_utc: string | null;
  monthly_upload_count: number;
};

type BackupCommitManifest = {
  idempotencyKey: string;
  deviceId: string;
  deviceLabel?: string;
  puts?: BackupCommitPut[];
  deletes?: BackupCommitDelete[];
};

type BackupCommitPut = {
  commitObjectKey: string;
  partitionKey: string;
  schemaVersion: number;
  contentHash: string;
  compressedHash: string;
  logicalBytes?: number;
  compressedBytes: number;
  metadata: BackupHeadMetadata;
  writeMode: BackupWriteMode;
};

type BackupCommitDelete = {
  partitionKey: string;
  writeMode: Exclude<BackupWriteMode, { kind: "ifAbsent" }>;
};

type BackupWriteMode =
  | { kind: "ifMatch"; expectedRev: string }
  | { kind: "ifAbsent" }
  | { kind: "overwrite" };

type BackupConflict = {
  partitionKey: string;
  writeMode: BackupWriteMode;
  currentHead?: BackupHead;
};

type BackupCommitResponse = {
  idempotencyKey: string;
  committedAt: number;
  headSetRev: string;
  heads: BackupHead[];
  quota: BackupUploadQuota;
};

type BackupObjectDownloadRequest = {
  objectIds: string[];
};

type BackupCleanupResult = {
  r2ObjectsScanned: number;
  r2ObjectsDeleted: number;
};

type BackupQuotaReservation = {
  userId: string;
  period: string;
  putObjectCount: number;
  uploadedCompressedBytes: number;
  quota: BackupUploadQuota;
};

type ParsedBackupObjectKey = {
  key: string;
  userId: string;
  objectId: string;
  uploadedAt: number;
};

type AuthenticatedBackupContext = {
  user: AuthenticatedUser;
  db: D1Database;
  bucket: R2Bucket;
  monthlyUploadLimit: number;
};

export async function handleBackupRequest(
  request: Request,
  url: URL,
  env: BackupEnv
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: BACKUP_CORS_HEADERS });
  }

  const context = await authenticateBackupRequest(request, env);
  if (context instanceof Response) {
    return context;
  }

  const path = stripBackupPrefix(url.pathname);
  if (path === "/head") {
    if (request.method !== "GET") {
      return backupJson({ error: "method_not_allowed" }, 405);
    }
    return handleBackupHead(url, context);
  }

  if (path === "/commits") {
    if (request.method !== "POST") {
      return backupJson({ error: "method_not_allowed" }, 405);
    }
    return handleBackupCommit(request, context);
  }

  if (path === "/objects") {
    if (request.method !== "POST") {
      return backupJson({ error: "method_not_allowed" }, 405);
    }
    return handleBackupObjectDownload(request, context);
  }

  return backupJson({ error: "not_found" }, 404);
}

export async function runBackupCleanup(
  env: BackupEnv
): Promise<BackupCleanupResult> {
  const result: BackupCleanupResult = {
    r2ObjectsScanned: 0,
    r2ObjectsDeleted: 0,
  };
  if (!env.BACKUP_DB || !env.BACKUP_BUCKET) {
    return result;
  }
  const now = Date.now();

  await env.BACKUP_DB.batch([
    env.BACKUP_DB.prepare(
      "DELETE FROM backup_heads WHERE soft_deleted_at IS NOT NULL"
    ),
    env.BACKUP_DB.prepare(
      `DELETE FROM backup_commits
      WHERE expires_at <= ?
        OR id NOT IN (
          SELECT latest.id
          FROM backup_commits latest
          WHERE latest.user_id = backup_commits.user_id
          ORDER BY latest.created_at DESC, latest.id DESC
          LIMIT 1
        )`
    ).bind(now),
  ]);

  const listed = await env.BACKUP_BUCKET.list({
    prefix: "users/",
    limit: BACKUP_CLEANUP_LIMITS.maxR2ObjectsPerRun,
  });
  result.r2ObjectsScanned = listed.objects.length;

  const objectsByUser = new Map<string, ParsedBackupObjectKey[]>();
  for (const object of listed.objects) {
    const parsed = parseBackupObjectKey(object.key, object.uploaded);
    if (!parsed) continue;
    const entries = objectsByUser.get(parsed.userId) ?? [];
    entries.push(parsed);
    objectsByUser.set(parsed.userId, entries);
  }

  for (const [userId, objects] of objectsByUser) {
    const activeRows = await selectHeadsByObjectIds(
      env.BACKUP_DB,
      userId,
      objects.map((object) => object.objectId)
    );
    const activeObjectIds = new Set(activeRows.map((row) => row.object_id));
    const staleCutoff = now - BACKUP_CLEANUP_LIMITS.orphanDeleteGraceMs;
    const staleKeys = objects
      .filter(
        (object) =>
          !activeObjectIds.has(object.objectId) &&
          object.uploadedAt <= staleCutoff
      )
      .map((object) => object.key);
    await deleteBackupObjectKeys(env.BACKUP_BUCKET, staleKeys);
    result.r2ObjectsDeleted += staleKeys.length;
  }

  return result;
}

async function authenticateBackupRequest(
  request: Request,
  env: BackupEnv
): Promise<AuthenticatedBackupContext | Response> {
  if (!env.BACKUP_DB || !env.BACKUP_BUCKET) {
    return backupJson({ error: "backup_not_configured" }, 503);
  }

  const user = await requireUser(request, env);
  if (isAuthFailure(user)) {
    return backupJson(user.payload, user.status);
  }

  const missingEntitlement = requireEntitlement(user, "cloud_sync");
  if (missingEntitlement) {
    return backupJson(missingEntitlement.payload, missingEntitlement.status);
  }

  return {
    user,
    db: env.BACKUP_DB,
    bucket: env.BACKUP_BUCKET,
    monthlyUploadLimit: getMonthlyUploadLimit(env),
  };
}

async function handleBackupHead(
  url: URL,
  context: AuthenticatedBackupContext
): Promise<Response> {
  const now = Date.now();
  const knownHeadSetRev = url.searchParams.get("headSetRev");
  const state = await context.db
    .prepare(
      `SELECT head_set_rev, upload_period_utc, monthly_upload_count
      FROM backup_user_state
      WHERE user_id = ?
      LIMIT 1`
    )
    .bind(context.user.userId)
    .first<BackupUserStateRow>();
  const quota = createBackupUploadQuotaFromState(
    state,
    now,
    context.monthlyUploadLimit
  );

  const headSetRev = state?.head_set_rev ?? "empty";
  if (knownHeadSetRev && knownHeadSetRev === headSetRev) {
    return backupJson({
      serverTime: now,
      changed: false,
      headSetRev,
      capabilities: BACKUP_CAPABILITIES,
      quota,
      heads: [],
    });
  }

  const rows = await selectActiveHeads(context.db, context.user.userId);
  return backupJson({
    serverTime: now,
    changed: true,
    headSetRev,
    capabilities: BACKUP_CAPABILITIES,
    quota,
    heads: rows.map(toBackupHead),
  });
}

async function handleBackupCommit(
  request: Request,
  context: AuthenticatedBackupContext
): Promise<Response> {
  const requestSizeError = validateCommitRequestSize(request);
  if (requestSizeError) {
    return requestSizeError;
  }

  const form = await readMultipartForm(request);
  if (form instanceof Response) {
    return form;
  }

  const manifest = await readCommitManifest(form);
  if (manifest instanceof Response) {
    return manifest;
  }

  const validation = validateCommitManifest(manifest);
  if (validation instanceof Response) {
    return validation;
  }

  const existingCommit = await context.db
    .prepare(
      "SELECT result_json FROM backup_commits WHERE user_id = ? AND idempotency_key = ? LIMIT 1"
    )
    .bind(context.user.userId, manifest.idempotencyKey)
    .first<{ result_json: string }>();

  if (existingCommit) {
    return backupJson(JSON.parse(existingCommit.result_json));
  }

  const puts = manifest.puts ?? [];
  const deletes = manifest.deletes ?? [];
  const currentRows = await selectHeadsByPartitionKeys(
    context.db,
    context.user.userId,
    [
      ...puts.map((put) => put.partitionKey),
      ...deletes.map((del) => del.partitionKey),
    ]
  );
  const currentHeads = new Map(
    currentRows.map((row) => [row.partition_key, toBackupHead(row)])
  );

  const conflicts = findWriteConflicts(puts, deletes, currentHeads);
  if (conflicts.length > 0) {
    return backupJson({ error: "revision_conflict", conflicts }, 409);
  }

  const checkedAt = Date.now();
  const putObjectCount = puts.length;
  const uploadedCompressedBytes = puts.reduce(
    (sum, put) => sum + put.compressedBytes,
    0
  );
  const reservation = await reserveBackupUploadQuota(context.db, {
    userId: context.user.userId,
    now: checkedAt,
    limit: context.monthlyUploadLimit,
    putObjectCount,
    uploadedCompressedBytes,
  });
  if (reservation instanceof Response) {
    return reservation;
  }

  try {
    return await writeBackupCommit({
      context,
      form,
      manifest,
      puts,
      deletes,
      currentHeads,
      checkedAt,
      quota: reservation.quota,
    });
  } catch (error) {
    await releaseReservedUploadQuota(context.db, reservation);
    throw error;
  }
}

async function writeBackupCommit(input: {
  context: AuthenticatedBackupContext;
  form: FormData;
  manifest: BackupCommitManifest;
  puts: BackupCommitPut[];
  deletes: BackupCommitDelete[];
  currentHeads: Map<string, BackupHead>;
  checkedAt: number;
  quota: BackupUploadQuota;
}): Promise<Response> {
  const {
    context,
    form,
    manifest,
    puts,
    deletes,
    currentHeads,
    checkedAt,
    quota,
  } = input;

  const deviceRowId = await resolveDeviceRow(context.db, context.user.userId, {
    deviceId: manifest.deviceId,
    deviceLabel: manifest.deviceLabel,
  });
  const committedAt = checkedAt;
  const headSetRev = makeRev("hset");
  const changedHeads: BackupHead[] = [];
  const statements: D1PreparedStatement[] = [];
  const staleObjectIds = new Set<string>();

  for (const put of puts) {
    const part = form.get(put.commitObjectKey);
    if (!(part instanceof Blob)) {
      return backupJson(
        { error: "invalid_payload", field: put.commitObjectKey },
        422
      );
    }
    if (part.size !== put.compressedBytes) {
      return backupJson(
        { error: "size_mismatch", field: "compressedBytes" },
        422
      );
    }

    const compressedHash = await sha256Blob(part);
    if (compressedHash !== put.compressedHash) {
      return backupJson(
        { error: "hash_mismatch", field: "compressedHash" },
        422
      );
    }

    const objectId = makeRev("obj");
    const rev = makeRev("rev");
    const r2Key = makeObjectKey(context.user.userId, objectId);
    const replacedHead = currentHeads.get(put.partitionKey);
    await context.bucket.put(r2Key, part, {
      httpMetadata: {
        contentType: "application/json",
        contentEncoding: "gzip",
      },
      customMetadata: {
        partitionKey: put.partitionKey,
        rev,
        schemaVersion: String(put.schemaVersion),
        contentHash: put.contentHash,
        compressedHash: put.compressedHash,
      },
    });

    changedHeads.push({
      partitionKey: put.partitionKey,
      objectId,
      rev,
      schemaVersion: put.schemaVersion,
      contentHash: put.contentHash,
      compressedHash: put.compressedHash,
      compressedBytes: put.compressedBytes,
      updatedAt: committedAt,
      metadata: put.metadata,
      sourceDeviceId: manifest.deviceId,
      sourceDeviceLabel: manifest.deviceLabel,
    });

    if (replacedHead && replacedHead.objectId !== objectId) {
      staleObjectIds.add(replacedHead.objectId);
    }

    statements.push(
      context.db
        .prepare(
          `INSERT INTO backup_heads (
            user_id, partition_key, object_id, rev, schema_version, content_hash,
            compressed_hash, compressed_bytes, updated_at, metadata_json,
            source_device_row_id, soft_deleted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(user_id, partition_key) DO UPDATE SET
            object_id = excluded.object_id,
            rev = excluded.rev,
            schema_version = excluded.schema_version,
            content_hash = excluded.content_hash,
            compressed_hash = excluded.compressed_hash,
            compressed_bytes = excluded.compressed_bytes,
            updated_at = excluded.updated_at,
            metadata_json = excluded.metadata_json,
            source_device_row_id = excluded.source_device_row_id,
            soft_deleted_at = NULL`
        )
        .bind(
          context.user.userId,
          put.partitionKey,
          objectId,
          rev,
          put.schemaVersion,
          put.contentHash,
          put.compressedHash,
          put.compressedBytes,
          committedAt,
          JSON.stringify(put.metadata),
          deviceRowId
        )
    );
  }

  for (const del of deletes) {
    const currentHead = currentHeads.get(del.partitionKey);
    if (!currentHead) continue;
    changedHeads.push({ ...currentHead, deletedAt: committedAt });
    staleObjectIds.add(currentHead.objectId);
    statements.push(
      context.db
        .prepare(
          `DELETE FROM backup_heads
          WHERE user_id = ? AND partition_key = ?`
        )
        .bind(context.user.userId, del.partitionKey)
    );
  }

  const result: BackupCommitResponse = {
    idempotencyKey: manifest.idempotencyKey,
    committedAt,
    headSetRev,
    heads: changedHeads,
    quota,
  };

  statements.push(
    context.db
      .prepare(
        `UPDATE backup_user_state
        SET
          head_set_rev = ?,
          updated_at = ?,
          key_count = (
            SELECT COUNT(*)
            FROM backup_heads
            WHERE user_id = ? AND soft_deleted_at IS NULL
          ),
          total_compressed_bytes = (
            SELECT COALESCE(SUM(compressed_bytes), 0)
            FROM backup_heads
            WHERE user_id = ? AND soft_deleted_at IS NULL
          )
        WHERE user_id = ?`
      )
      .bind(
        headSetRev,
        committedAt,
        context.user.userId,
        context.user.userId,
        context.user.userId
      )
  );
  statements.push(
    context.db
      .prepare("DELETE FROM backup_commits WHERE user_id = ?")
      .bind(context.user.userId)
  );
  statements.push(
    context.db
      .prepare(
        `INSERT INTO backup_commits (
          id, user_id, idempotency_key, device_row_id, result_json, created_at,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        makeRev("commit"),
        context.user.userId,
        manifest.idempotencyKey,
        deviceRowId,
        JSON.stringify(result),
        committedAt,
        committedAt + 7 * 24 * 60 * 60 * 1000
      )
  );

  if (statements.length > 0) {
    await context.db.batch(statements);
  }
  await deleteBackupObjects(
    context.bucket,
    context.user.userId,
    staleObjectIds
  );

  return backupJson(result);
}

function validateCommitRequestSize(request: Request): Response | null {
  const contentLength = request.headers.get("Content-Length");
  if (!contentLength) return null;
  const requestBytes = Number(contentLength);
  if (!Number.isFinite(requestBytes) || requestBytes < 0) {
    return backupJson({ error: "invalid_content_length" }, 400);
  }
  if (requestBytes > BACKUP_LIMITS.maxCommitRequestBytes) {
    return backupJson(
      {
        error: "payload_too_large",
        maxBytes: BACKUP_LIMITS.maxCommitRequestBytes,
      },
      413
    );
  }
  return null;
}

async function handleBackupObjectDownload(
  request: Request,
  context: AuthenticatedBackupContext
): Promise<Response> {
  const body = await readJson<BackupObjectDownloadRequest>(request);
  if (body instanceof Response) {
    return body;
  }

  if (
    !Array.isArray(body.objectIds) ||
    body.objectIds.length === 0 ||
    body.objectIds.length > BACKUP_LIMITS.maxObjectDownloads ||
    body.objectIds.some((objectId) => !isSafeObjectId(objectId))
  ) {
    return backupJson({ error: "invalid_payload", field: "objectIds" }, 422);
  }

  const rows = await selectHeadsByObjectIds(
    context.db,
    context.user.userId,
    body.objectIds
  );
  const rowsByObjectId = new Map(rows.map((row) => [row.object_id, row]));

  const form = new FormData();
  const manifest = { objects: [] as BackupHead[] };
  let totalCompressedBytes = 0;

  for (const objectId of body.objectIds) {
    const row = rowsByObjectId.get(objectId);
    if (!row) {
      return backupJson({ error: "object_not_found", objectId }, 404);
    }
    totalCompressedBytes += row.compressed_bytes;
    if (totalCompressedBytes > BACKUP_LIMITS.maxCompressedBytesPerDownload) {
      return backupJson(
        {
          error: "payload_too_large",
          maxCompressedBytes: BACKUP_LIMITS.maxCompressedBytesPerDownload,
        },
        413
      );
    }

    const object = await context.bucket.get(
      makeObjectKey(context.user.userId, objectId)
    );
    if (!object) {
      return backupJson({ error: "object_not_found", objectId }, 404);
    }

    manifest.objects.push(toBackupHead(row));
    form.append(objectId, await object.blob(), `${objectId}.json.gz`);
  }

  form.append(
    "manifest",
    new Blob([JSON.stringify(manifest)], { type: "application/json" }),
    "manifest.json"
  );
  return new Response(form, { headers: BACKUP_CORS_HEADERS });
}

async function readBackupUploadQuota(
  db: D1Database,
  userId: string,
  now: number,
  limit: number
): Promise<BackupUploadQuota> {
  const state = await db
    .prepare(
      `SELECT head_set_rev, upload_period_utc, monthly_upload_count
      FROM backup_user_state
      WHERE user_id = ?
      LIMIT 1`
    )
    .bind(userId)
    .first<BackupUserStateRow>();
  return createBackupUploadQuotaFromState(state, now, limit);
}

async function reserveBackupUploadQuota(
  db: D1Database,
  input: {
    userId: string;
    now: number;
    limit: number;
    putObjectCount: number;
    uploadedCompressedBytes: number;
  }
): Promise<BackupQuotaReservation | Response> {
  const period = getUtcMonthPeriod(input.now);
  if (input.limit <= 0) {
    const quota = await readBackupUploadQuota(
      db,
      input.userId,
      input.now,
      input.limit
    );
    return backupJson({ error: "monthly_upload_limit_exceeded", quota }, 429);
  }

  const result = await db
    .prepare(
      `INSERT INTO backup_user_state (
        user_id, head_set_rev, updated_at, key_count, total_compressed_bytes,
        upload_period_utc, monthly_upload_count, monthly_put_object_count,
        monthly_uploaded_compressed_bytes, last_upload_at
      )
      VALUES (?, 'empty', ?, 0, 0, ?, 1, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        upload_period_utc = excluded.upload_period_utc,
        monthly_upload_count =
          CASE
            WHEN backup_user_state.upload_period_utc = excluded.upload_period_utc
            THEN backup_user_state.monthly_upload_count + 1
            ELSE excluded.monthly_upload_count
          END,
        monthly_put_object_count =
          CASE
            WHEN backup_user_state.upload_period_utc = excluded.upload_period_utc
            THEN backup_user_state.monthly_put_object_count + excluded.monthly_put_object_count
            ELSE excluded.monthly_put_object_count
          END,
        monthly_uploaded_compressed_bytes =
          CASE
            WHEN backup_user_state.upload_period_utc = excluded.upload_period_utc
            THEN backup_user_state.monthly_uploaded_compressed_bytes + excluded.monthly_uploaded_compressed_bytes
            ELSE excluded.monthly_uploaded_compressed_bytes
          END,
        last_upload_at = excluded.last_upload_at
      WHERE backup_user_state.upload_period_utc IS NULL
        OR backup_user_state.upload_period_utc <> excluded.upload_period_utc
        OR backup_user_state.monthly_upload_count < ?`
    )
    .bind(
      input.userId,
      input.now,
      period,
      input.putObjectCount,
      input.uploadedCompressedBytes,
      input.now,
      input.limit
    )
    .run();

  const quota = await readBackupUploadQuota(
    db,
    input.userId,
    input.now,
    input.limit
  );
  if ((result.meta as { changes?: number }).changes === 0) {
    return backupJson({ error: "monthly_upload_limit_exceeded", quota }, 429);
  }

  return {
    userId: input.userId,
    period,
    putObjectCount: input.putObjectCount,
    uploadedCompressedBytes: input.uploadedCompressedBytes,
    quota,
  };
}

async function releaseReservedUploadQuota(
  db: D1Database,
  reservation: BackupQuotaReservation
): Promise<void> {
  await db
    .prepare(
      `UPDATE backup_user_state
      SET
        monthly_upload_count = MAX(0, monthly_upload_count - 1),
        monthly_put_object_count = MAX(0, monthly_put_object_count - ?),
        monthly_uploaded_compressed_bytes =
          MAX(0, monthly_uploaded_compressed_bytes - ?)
      WHERE user_id = ? AND upload_period_utc = ?`
    )
    .bind(
      reservation.putObjectCount,
      reservation.uploadedCompressedBytes,
      reservation.userId,
      reservation.period
    )
    .run();
}

function createBackupUploadQuotaFromState(
  state: BackupUserStateRow | null,
  now: number,
  limit: number
): BackupUploadQuota {
  const period = getUtcMonthPeriod(now);
  const used =
    state?.upload_period_utc === period
      ? Number(state.monthly_upload_count)
      : 0;
  return createBackupUploadQuota({
    period,
    limit,
    used,
    resetsAt: getNextUtcMonthStart(now),
  });
}

async function deleteBackupObjects(
  bucket: R2Bucket,
  userId: string,
  objectIds: Set<string>
): Promise<void> {
  if (objectIds.size === 0) return;
  return deleteBackupObjectKeys(
    bucket,
    [...objectIds].map((objectId) => makeObjectKey(userId, objectId))
  );
}

async function deleteBackupObjectKeys(
  bucket: R2Bucket,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  const results = await Promise.allSettled(
    keys.map((key) => bucket.delete(key))
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Backup stale object cleanup failed:", result.reason);
    }
  }
}

async function resolveDeviceRow(
  db: D1Database,
  userId: string,
  device: { deviceId: string; deviceLabel?: string }
): Promise<string> {
  const now = Date.now();
  const existing = await db
    .prepare(
      "SELECT id FROM backup_devices WHERE user_id = ? AND device_id = ? LIMIT 1"
    )
    .bind(userId, device.deviceId)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE backup_devices
        SET label = COALESCE(?, label), last_seen_at = ?, last_backup_at = ?
        WHERE id = ?`
      )
      .bind(device.deviceLabel ?? null, now, now, existing.id)
      .run();
    return existing.id;
  }

  const id = makeRev("devrow");
  await db
    .prepare(
      `INSERT INTO backup_devices (
        id, user_id, device_id, label, created_at, last_seen_at, last_backup_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      device.deviceId,
      device.deviceLabel ?? null,
      now,
      now,
      now
    )
    .run();
  return id;
}

function getMonthlyUploadLimit(env: BackupEnv): number {
  const parsed = Number(env.BACKUP_MONTHLY_UPLOAD_LIMIT);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_BACKUP_MONTHLY_UPLOAD_LIMIT;
  }
  return Math.floor(parsed);
}

function createBackupUploadQuota(input: {
  period: string;
  limit: number;
  used: number;
  resetsAt: number;
}): BackupUploadQuota {
  const used = Math.max(0, Math.floor(input.used));
  const limit = Math.max(0, Math.floor(input.limit));
  return {
    period: input.period,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt: input.resetsAt,
  };
}

function getUtcMonthPeriod(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function getNextUtcMonthStart(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

function validateCommitManifest(
  manifest: BackupCommitManifest
): true | Response {
  if (!isSafeIdempotencyKey(manifest.idempotencyKey)) {
    return backupJson(
      { error: "invalid_payload", field: "idempotencyKey" },
      422
    );
  }
  if (!isSafeDeviceId(manifest.deviceId)) {
    return backupJson({ error: "invalid_payload", field: "deviceId" }, 422);
  }
  if (
    manifest.deviceLabel !== undefined &&
    (typeof manifest.deviceLabel !== "string" ||
      manifest.deviceLabel.length > 80)
  ) {
    return backupJson({ error: "invalid_payload", field: "deviceLabel" }, 422);
  }

  const puts = manifest.puts ?? [];
  const deletes = manifest.deletes ?? [];
  if (puts.length + deletes.length === 0) {
    return backupJson({ error: "invalid_payload", field: "changes" }, 422);
  }
  if (puts.length > BACKUP_LIMITS.maxObjectsPerCommit) {
    return backupJson(
      {
        error: "payload_too_large",
        maxObjectsPerCommit: BACKUP_LIMITS.maxObjectsPerCommit,
      },
      413
    );
  }

  let totalCompressedBytes = 0;
  const partitionKeys = new Set<string>();
  const objectKeys = new Set<string>();
  for (const put of puts) {
    const invalid = validatePut(put, partitionKeys, objectKeys);
    if (invalid) return invalid;
    totalCompressedBytes += put.compressedBytes;
  }
  for (const del of deletes) {
    const invalid = validateDelete(del, partitionKeys);
    if (invalid) return invalid;
  }

  if (totalCompressedBytes > BACKUP_LIMITS.maxCompressedBytesPerCommit) {
    return backupJson(
      {
        error: "payload_too_large",
        maxCompressedBytes: BACKUP_LIMITS.maxCompressedBytesPerCommit,
      },
      413
    );
  }

  return true;
}

function validatePut(
  put: BackupCommitPut,
  partitionKeys: Set<string>,
  objectKeys: Set<string>
): Response | null {
  if (!isKnownPartitionKey(put.partitionKey)) {
    return backupJson({ error: "invalid_payload", field: "partitionKey" }, 422);
  }
  if (partitionKeys.has(put.partitionKey)) {
    return backupJson(
      { error: "duplicate_partition", partitionKey: put.partitionKey },
      422
    );
  }
  partitionKeys.add(put.partitionKey);

  if (!isSafeCommitObjectKey(put.commitObjectKey)) {
    return backupJson(
      { error: "invalid_payload", field: "commitObjectKey" },
      422
    );
  }
  if (objectKeys.has(put.commitObjectKey)) {
    return backupJson(
      { error: "duplicate_object", field: put.commitObjectKey },
      422
    );
  }
  objectKeys.add(put.commitObjectKey);

  if (!Number.isInteger(put.schemaVersion) || put.schemaVersion < 1) {
    return backupJson(
      { error: "invalid_payload", field: "schemaVersion" },
      422
    );
  }
  if (!isSha256(put.contentHash)) {
    return backupJson({ error: "invalid_payload", field: "contentHash" }, 422);
  }
  if (!isSha256(put.compressedHash)) {
    return backupJson(
      { error: "invalid_payload", field: "compressedHash" },
      422
    );
  }
  if (
    !Number.isInteger(put.compressedBytes) ||
    put.compressedBytes < 1 ||
    put.compressedBytes > BACKUP_LIMITS.maxCompressedBytesPerObject
  ) {
    return backupJson(
      {
        error: "payload_too_large",
        maxCompressedBytes: BACKUP_LIMITS.maxCompressedBytesPerObject,
      },
      413
    );
  }
  if (
    put.logicalBytes !== undefined &&
    (!Number.isInteger(put.logicalBytes) || put.logicalBytes < 1)
  ) {
    return backupJson({ error: "invalid_payload", field: "logicalBytes" }, 422);
  }
  const metadataError = validateHeadMetadata(put.metadata);
  if (metadataError) return metadataError;
  return validateWriteMode(put.writeMode, "writeMode");
}

function validateDelete(
  del: BackupCommitDelete,
  partitionKeys: Set<string>
): Response | null {
  if (!isKnownPartitionKey(del.partitionKey)) {
    return backupJson({ error: "invalid_payload", field: "partitionKey" }, 422);
  }
  if (partitionKeys.has(del.partitionKey)) {
    return backupJson(
      { error: "duplicate_partition", partitionKey: del.partitionKey },
      422
    );
  }
  partitionKeys.add(del.partitionKey);
  return validateWriteMode(del.writeMode, "writeMode");
}

function validateHeadMetadata(
  metadata: BackupHeadMetadata | undefined
): Response | null {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    metadata.schemaVersion !== 1 ||
    !Array.isArray(metadata.records) ||
    metadata.records.length > 20
  ) {
    return backupJson({ error: "invalid_payload", field: "metadata" }, 422);
  }
  const encodedLength = JSON.stringify(metadata).length;
  if (encodedLength > 4096) {
    return backupJson({ error: "payload_too_large", field: "metadata" }, 413);
  }
  for (const record of metadata.records) {
    if (!isKnownRecordKind(record.kind)) {
      return backupJson(
        { error: "invalid_payload", field: "metadata.kind" },
        422
      );
    }
    if (!Number.isInteger(record.count) || record.count < 0) {
      return backupJson(
        { error: "invalid_payload", field: "metadata.count" },
        422
      );
    }
    if (
      record.profileId !== undefined &&
      !/^[A-Za-z0-9_:-]{1,64}$/.test(record.profileId)
    ) {
      return backupJson(
        { error: "invalid_payload", field: "metadata.profileId" },
        422
      );
    }
    if (
      record.updatedAt !== undefined &&
      (!Number.isFinite(record.updatedAt) || record.updatedAt < 0)
    ) {
      return backupJson(
        { error: "invalid_payload", field: "metadata.updatedAt" },
        422
      );
    }
  }
  return null;
}

function validateWriteMode(
  writeMode: BackupWriteMode,
  field: string
): Response | null {
  if (writeMode.kind === "overwrite" || writeMode.kind === "ifAbsent") {
    return null;
  }
  if (writeMode.kind === "ifMatch" && isSafeRev(writeMode.expectedRev)) {
    return null;
  }
  return backupJson({ error: "invalid_payload", field }, 422);
}

function findWriteConflicts(
  puts: BackupCommitPut[],
  deletes: BackupCommitDelete[],
  currentHeads: Map<string, BackupHead>
): BackupConflict[] {
  const conflicts: BackupConflict[] = [];
  for (const put of puts) {
    const currentHead = currentHeads.get(put.partitionKey);
    if (isWriteConflict(put.writeMode, currentHead)) {
      conflicts.push({
        partitionKey: put.partitionKey,
        writeMode: put.writeMode,
        currentHead,
      });
    }
  }
  for (const del of deletes) {
    const currentHead = currentHeads.get(del.partitionKey);
    if (isWriteConflict(del.writeMode, currentHead)) {
      conflicts.push({
        partitionKey: del.partitionKey,
        writeMode: del.writeMode,
        currentHead,
      });
    }
  }
  return conflicts;
}

function isWriteConflict(
  writeMode: BackupWriteMode,
  currentHead: BackupHead | undefined
): boolean {
  if (writeMode.kind === "overwrite") return false;
  if (writeMode.kind === "ifAbsent") return currentHead !== undefined;
  return !currentHead || currentHead.rev !== writeMode.expectedRev;
}

async function selectActiveHeads(
  db: D1Database,
  userId: string
): Promise<BackupHeadRow[]> {
  const result = await db
    .prepare(
      `SELECT
        h.partition_key,
        h.object_id,
        h.rev,
        h.schema_version,
        h.content_hash,
        h.compressed_hash,
        h.compressed_bytes,
        h.updated_at,
        h.metadata_json,
        h.soft_deleted_at,
        d.device_id AS source_device_id,
        d.label AS source_device_label
      FROM backup_heads h
      LEFT JOIN backup_devices d ON d.id = h.source_device_row_id
      WHERE h.user_id = ? AND h.soft_deleted_at IS NULL
      ORDER BY h.partition_key`
    )
    .bind(userId)
    .all<BackupHeadRow>();
  return result.results;
}

async function selectHeadsByPartitionKeys(
  db: D1Database,
  userId: string,
  partitionKeys: string[]
): Promise<BackupHeadRow[]> {
  if (partitionKeys.length === 0) return [];
  const placeholders = partitionKeys.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT
        h.partition_key,
        h.object_id,
        h.rev,
        h.schema_version,
        h.content_hash,
        h.compressed_hash,
        h.compressed_bytes,
        h.updated_at,
        h.metadata_json,
        h.soft_deleted_at,
        d.device_id AS source_device_id,
        d.label AS source_device_label
      FROM backup_heads h
      LEFT JOIN backup_devices d ON d.id = h.source_device_row_id
      WHERE h.user_id = ? AND h.partition_key IN (${placeholders})
        AND h.soft_deleted_at IS NULL`
    )
    .bind(userId, ...partitionKeys)
    .all<BackupHeadRow>();
  return result.results;
}

async function selectHeadsByObjectIds(
  db: D1Database,
  userId: string,
  objectIds: string[]
): Promise<BackupHeadRow[]> {
  const placeholders = objectIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT
        h.partition_key,
        h.object_id,
        h.rev,
        h.schema_version,
        h.content_hash,
        h.compressed_hash,
        h.compressed_bytes,
        h.updated_at,
        h.metadata_json,
        h.soft_deleted_at,
        d.device_id AS source_device_id,
        d.label AS source_device_label
      FROM backup_heads h
      LEFT JOIN backup_devices d ON d.id = h.source_device_row_id
      WHERE h.user_id = ? AND h.object_id IN (${placeholders})
        AND h.soft_deleted_at IS NULL`
    )
    .bind(userId, ...objectIds)
    .all<BackupHeadRow>();
  return result.results;
}

async function readMultipartForm(
  request: Request
): Promise<FormData | Response> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return backupJson({ error: "invalid_content_type" }, 415);
  }

  try {
    return await request.formData();
  } catch {
    return backupJson({ error: "invalid_multipart" }, 422);
  }
}

async function readCommitManifest(
  form: FormData
): Promise<BackupCommitManifest | Response> {
  const part = form.get("manifest");
  if (part === null) {
    return backupJson({ error: "invalid_payload", field: "manifest" }, 422);
  }

  const text = typeof part === "string" ? part : await part.text();
  try {
    const parsed = JSON.parse(text) as BackupCommitManifest;
    if (!parsed || typeof parsed !== "object") {
      return backupJson({ error: "invalid_payload", field: "manifest" }, 422);
    }
    return parsed;
  } catch {
    return backupJson({ error: "invalid_json", field: "manifest" }, 422);
  }
}

async function readJson<T>(request: Request): Promise<T | Response> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return backupJson({ error: "invalid_content_type" }, 415);
  }

  try {
    return (await request.json()) as T;
  } catch {
    return backupJson({ error: "invalid_json" }, 422);
  }
}

function toBackupHead(row: BackupHeadRow): BackupHead {
  return {
    partitionKey: row.partition_key,
    objectId: row.object_id,
    rev: row.rev,
    schemaVersion: row.schema_version,
    contentHash: row.content_hash,
    compressedHash: row.compressed_hash,
    compressedBytes: row.compressed_bytes,
    updatedAt: row.updated_at,
    metadata: JSON.parse(row.metadata_json) as BackupHeadMetadata,
    ...(row.source_device_id ? { sourceDeviceId: row.source_device_id } : {}),
    ...(row.source_device_label
      ? { sourceDeviceLabel: row.source_device_label }
      : {}),
    ...(row.soft_deleted_at ? { deletedAt: row.soft_deleted_at } : {}),
  };
}

function stripBackupPrefix(pathname: string): string {
  const path = pathname.slice(BACKUP_API_PREFIX.length);
  return path === "" ? "/" : path;
}

function makeObjectKey(userId: string, objectId: string): string {
  return `users/${encodeURIComponent(userId)}/backup/objects/${objectId}.json.gz`;
}

function parseBackupObjectKey(
  key: string,
  uploaded: Date | undefined
): ParsedBackupObjectKey | null {
  const match =
    /^users\/([^/]+)\/backup\/objects\/(obj_[a-f0-9]{32})\.json\.gz$/.exec(key);
  if (!match) return null;
  const uploadedAt = uploaded?.getTime() ?? 0;
  try {
    return {
      key,
      userId: decodeURIComponent(match[1]),
      objectId: match[2],
      uploadedAt: Number.isFinite(uploadedAt) ? uploadedAt : 0,
    };
  } catch {
    return null;
  }
}

function makeRev(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer()
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function isKnownPartitionKey(value: string): boolean {
  return (
    /^profile\.(app|game|artifacts)\/(0|[1-9]\d{0,11})$/.test(value) ||
    value === "builds/all" ||
    value === "teams/all" ||
    value === "tiers/all"
  );
}

function isKnownRecordKind(value: string): value is BackupRecordKind {
  return (
    value === "characters" ||
    value === "weapons" ||
    value === "artifacts" ||
    value === "frozen" ||
    value === "settings" ||
    value === "builds" ||
    value === "teams" ||
    value === "teamConfigs" ||
    value === "tiers"
  );
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function isSafeDeviceId(value: string): boolean {
  return /^[A-Za-z0-9_:-]{1,96}$/.test(value);
}

function isSafeIdempotencyKey(value: string): boolean {
  return /^[A-Za-z0-9_:-]{8,128}$/.test(value);
}

function isSafeCommitObjectKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function isSafeObjectId(value: string): boolean {
  return /^obj_[a-f0-9]{32}$/.test(value);
}

function isSafeRev(value: string): boolean {
  return /^[A-Za-z]+_[a-f0-9]{32}$/.test(value);
}

function backupJson(
  obj: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...BACKUP_CORS_HEADERS,
      ...headers,
      "Content-Type": "application/json",
    },
  });
}
