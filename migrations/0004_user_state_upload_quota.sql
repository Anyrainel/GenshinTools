-- Move upload quota counters onto the per-user backup state row.
--
-- backup_monthly_upload_quota used one row per user/month. The Worker now keeps
-- only the active quota period on backup_user_state so /head and /commits can
-- read quota from the same per-user aggregate row that stores head_set_rev.

ALTER TABLE backup_user_state ADD COLUMN upload_period_utc TEXT;
ALTER TABLE backup_user_state ADD COLUMN monthly_upload_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE backup_user_state ADD COLUMN monthly_put_object_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE backup_user_state ADD COLUMN monthly_uploaded_compressed_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE backup_user_state ADD COLUMN last_upload_at INTEGER;

UPDATE backup_user_state
SET
  upload_period_utc = (
    SELECT quota.period_utc
    FROM backup_monthly_upload_quota quota
    WHERE quota.user_id = backup_user_state.user_id
    ORDER BY quota.period_utc DESC
    LIMIT 1
  ),
  monthly_upload_count = COALESCE((
    SELECT quota.successful_upload_count
    FROM backup_monthly_upload_quota quota
    WHERE quota.user_id = backup_user_state.user_id
    ORDER BY quota.period_utc DESC
    LIMIT 1
  ), 0),
  monthly_put_object_count = COALESCE((
    SELECT quota.put_object_count
    FROM backup_monthly_upload_quota quota
    WHERE quota.user_id = backup_user_state.user_id
    ORDER BY quota.period_utc DESC
    LIMIT 1
  ), 0),
  monthly_uploaded_compressed_bytes = COALESCE((
    SELECT quota.uploaded_compressed_bytes
    FROM backup_monthly_upload_quota quota
    WHERE quota.user_id = backup_user_state.user_id
    ORDER BY quota.period_utc DESC
    LIMIT 1
  ), 0),
  last_upload_at = (
    SELECT quota.updated_at
    FROM backup_monthly_upload_quota quota
    WHERE quota.user_id = backup_user_state.user_id
    ORDER BY quota.period_utc DESC
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1
  FROM backup_monthly_upload_quota quota
  WHERE quota.user_id = backup_user_state.user_id
);

DROP INDEX IF EXISTS idx_backup_monthly_upload_quota_period;
DROP TABLE IF EXISTS backup_monthly_upload_quota;
