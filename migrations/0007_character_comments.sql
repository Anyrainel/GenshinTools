CREATE TABLE character_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK(game IN ('GI', 'HSR')),
  character_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_character_comments_thread
  ON character_comments(game, character_id, created_at DESC, id DESC);
CREATE INDEX idx_character_comments_user_created
  ON character_comments(user_id, created_at DESC);
