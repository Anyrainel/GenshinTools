-- Before this migration, historical feedback had is_public = 0 and no votes.
-- Publish existing submissions at the site owner's request. New submissions
-- retain their explicitly selected visibility; do not change the column default.
UPDATE feedback_submissions SET is_public = 1;

CREATE TABLE feedback_votes (
  feedback_id TEXT NOT NULL REFERENCES feedback_submissions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  PRIMARY KEY(feedback_id, user_id)
);
INSERT INTO feedback_votes (feedback_id, user_id)
SELECT id, user_id FROM feedback_submissions;
CREATE TRIGGER feedback_author_vote AFTER INSERT ON feedback_submissions
BEGIN
  INSERT INTO feedback_votes (feedback_id, user_id) VALUES (NEW.id, NEW.user_id);
END;
