-- Authenticated user feedback.
--
-- User identity stays normalized through app_users/auth_identities. This table
-- stores only the stable app user id plus the submitted feedback payload.

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  suggestion TEXT,
  bug_report TEXT,
  metadata_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user_created_at
  ON feedback_submissions(user_id, created_at DESC);
