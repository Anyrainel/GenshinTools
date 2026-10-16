import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import authSchema from "../../migrations/0002_auth.sql?raw";
import oldSchema from "../../migrations/0007_character_comments.sql?raw";
import threadMigration from "../../migrations/0010_comment_threads.sql?raw";
import { handleCommunityRequest } from "../../worker/community";

it("reads historical comments through the public API after migrating them to root posts", async () => {
  const db = env.BACKUP_DB;
  for (const schema of [authSchema, oldSchema]) {
    for (const sql of schema.split(";").filter((sql) => sql.trim()))
      await db.prepare(sql).run();
  }
  await db
    .prepare(
      "INSERT INTO app_users (id, created_at, updated_at) VALUES ('old-user', 1, 1)"
    )
    .run();
  await db
    .prepare(
      "INSERT INTO character_comments VALUES ('old-comment', 'old-user', 'GI', 'amber', 'Historical comment', 123)"
    )
    .run();
  for (const sql of threadMigration.split(";").filter((sql) => sql.trim()))
    await db.prepare(sql).run();
  const url = new URL(
    "https://example.com/api/community/v1/characters/amber/comments"
  );
  const response = await handleCommunityRequest(new Request(url), url, env);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    items: [
      {
        id: "old-comment",
        body: "Historical comment",
        createdAt: 123,
        updatedAt: null,
        authorEmail: null,
        isOwner: false,
        isDeleted: false,
        replyCount: 0,
      },
    ],
    nextCursor: null,
  });
});
