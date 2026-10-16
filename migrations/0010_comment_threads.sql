-- Existing comments remain root posts with their original body and timestamp.
ALTER TABLE character_comments ADD COLUMN parent_id TEXT REFERENCES character_comments(id) ON DELETE CASCADE;
ALTER TABLE character_comments ADD COLUMN updated_at INTEGER;
ALTER TABLE character_comments ADD COLUMN deleted_at INTEGER;
CREATE INDEX idx_comment_replies ON character_comments(parent_id, game, character_id, created_at DESC, id DESC);
