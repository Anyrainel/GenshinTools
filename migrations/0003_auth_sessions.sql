-- First-party app sessions issued after Logto proves identity.
--
-- Only a SHA-256 hash of the opaque session token is stored. The raw token
-- lives in an HttpOnly cookie and is never persisted server-side.

CREATE TABLE IF NOT EXISTS app_auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_app_auth_sessions_user
  ON app_auth_sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_app_auth_sessions_expiry
  ON app_auth_sessions(expires_at, revoked_at);
