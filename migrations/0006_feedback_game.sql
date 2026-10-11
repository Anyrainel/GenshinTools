-- Existing submissions and clients predating this field are Genshin (GI).
-- Both sites now share this table; each new submission identifies its site.
ALTER TABLE feedback_submissions
  ADD COLUMN game TEXT NOT NULL DEFAULT 'GI' CHECK(game IN ('GI', 'HSR'));
