-- Auth/account V1 metadata.
--
-- app_users.id is the internal stable user id used by backup tables.
-- auth_identities maps Logto provider subjects to app users.
-- user_entitlements gates paid or limited features such as cloud backup.

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  disabled_at INTEGER
);

CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user
  ON auth_identities(user_id, provider);

CREATE TABLE IF NOT EXISTS user_entitlements (
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  source TEXT,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,
  PRIMARY KEY(user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_expiry
  ON user_entitlements(code, expires_at);
