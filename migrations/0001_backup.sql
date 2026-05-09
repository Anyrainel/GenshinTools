-- Cloud backup V1 metadata.
--
-- Naming rule:
-- - "head" is the current object for one partition key.
-- - "commit" is an idempotent write request, not staging.
-- - "object" bytes live in R2 and are addressed by backup_heads.object_id.

CREATE TABLE IF NOT EXISTS backup_user_state (
  user_id TEXT PRIMARY KEY,
  head_set_rev TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  key_count INTEGER NOT NULL DEFAULT 0,
  total_compressed_bytes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS backup_monthly_upload_quota (
  user_id TEXT NOT NULL,
  period_utc TEXT NOT NULL,
  successful_upload_count INTEGER NOT NULL DEFAULT 0,
  put_object_count INTEGER NOT NULL DEFAULT 0,
  uploaded_compressed_bytes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, period_utc)
);

CREATE INDEX IF NOT EXISTS idx_backup_monthly_upload_quota_period
  ON backup_monthly_upload_quota(period_utc, updated_at);

CREATE TABLE IF NOT EXISTS backup_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_backup_at INTEGER,
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_backup_devices_user
  ON backup_devices(user_id, last_seen_at);

CREATE TABLE IF NOT EXISTS backup_heads (
  user_id TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  object_id TEXT NOT NULL,
  rev TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  compressed_hash TEXT NOT NULL,
  compressed_bytes INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  source_device_row_id TEXT REFERENCES backup_devices(id) ON DELETE SET NULL,
  soft_deleted_at INTEGER,
  PRIMARY KEY(user_id, partition_key)
);

CREATE INDEX IF NOT EXISTS idx_backup_heads_user_object
  ON backup_heads(user_id, object_id);

CREATE TABLE IF NOT EXISTS backup_commits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_row_id TEXT REFERENCES backup_devices(id) ON DELETE SET NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_backup_commits_expiry
  ON backup_commits(expires_at);
