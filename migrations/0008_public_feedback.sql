-- Existing feedback was collected without a publication notice. Older clients
-- also remain private until they explicitly send public: true.
ALTER TABLE feedback_submissions ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0, 1));
CREATE INDEX idx_feedback_public_created ON feedback_submissions(game, is_public, created_at DESC, id DESC);
