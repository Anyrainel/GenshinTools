import { env } from "cloudflare:test";
import { afterEach, expect, it, vi } from "vitest";
import authSchema from "../../migrations/0002_auth.sql?raw";
import oldSchema from "../../migrations/0005_feedback.sql?raw";
import gameMigration from "../../migrations/0006_feedback_game.sql?raw";
import publicMigration from "../../migrations/0008_public_feedback.sql?raw";
import { type FeedbackEnv, handleFeedbackRequest } from "../../worker/feedback";
import { createTestJwt } from "./jwtTestUtils";

afterEach(() => vi.unstubAllGlobals());

it("preserves pre-game feedback as GI and accepts only supported game sites", async () => {
  const db = env.BACKUP_DB;
  for (const schema of [authSchema, oldSchema]) {
    for (const statement of schema.split(";").filter((sql) => sql.trim())) {
      await db.prepare(statement).run();
    }
  }
  await db
    .prepare(
      "INSERT INTO app_users (id, created_at, updated_at) VALUES ('old-user', 1, 1)"
    )
    .run();
  await db
    .prepare(
      "INSERT INTO feedback_submissions (id, user_id, rating, suggestion, metadata_json, created_at) VALUES ('old-feedback', 'old-user', 4, 'Original feedback', '{\"schemaVersion\":1}', 1)"
    )
    .run();
  await db.prepare(gameMigration).run();
  for (const sql of publicMigration.split(";").filter((sql) => sql.trim())) {
    await db.prepare(sql).run();
  }
  expect(
    await db
      .prepare(
        "SELECT game, suggestion, metadata_json FROM feedback_submissions WHERE id = 'old-feedback'"
      )
      .first()
  ).toEqual({
    game: "GI",
    suggestion: "Original feedback",
    metadata_json: '{"schemaVersion":1}',
  });
  await db
    .prepare(
      "INSERT INTO feedback_submissions (id, user_id, rating, suggestion, metadata_json, created_at, game) VALUES ('hsr-feedback', 'old-user', 5, 'Star Rail feedback', '{}', 2, 'HSR')"
    )
    .run();
  expect(
    await db
      .prepare(
        "SELECT game FROM feedback_submissions WHERE id = 'hsr-feedback'"
      )
      .first()
  ).toEqual({ game: "HSR" });
  await expect(
    db
      .prepare(
        "INSERT INTO feedback_submissions (id, user_id, rating, metadata_json, created_at, game) VALUES ('invalid', 'old-user', 5, '{}', 3, 'ZZZ')"
      )
      .run()
  ).rejects.toThrow();

  // Exercise the real migrated table and shared auth boundary as an HSR browser:
  // signed ID token, cross-origin request, no Genshin session cookie.
  const issuer = "https://shared-feedback.test/oidc";
  const audience = "tglrsenlbfrfrnevjwlan";
  const { token, jwks } = await createTestJwt({
    issuer,
    audience,
    subject: "hsr-feedback-user",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(jwks))
  );
  const url = new URL("https://ggartifact.com/api/feedback/v1/submissions");
  const feedbackEnv = {
    ...env,
    LOGTO_ISSUER: issuer,
    LOGTO_JWKS_URI: `${issuer}/jwks`,
    LOGTO_APP_ID: audience,
  } as FeedbackEnv;
  const response = await handleFeedbackRequest(
    new Request(url, {
      method: "POST",
      headers: {
        Origin: "https://hsr.ggartifact.com",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        game: "HSR",
        rating: 5,
        bugReport: "HSR browser feedback",
      }),
    }),
    url,
    feedbackEnv
  );
  expect(response.status).toBe(201);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(
    await db
      .prepare(
        "SELECT game, bug_report FROM feedback_submissions WHERE bug_report = 'HSR browser feedback'"
      )
      .first()
  ).toEqual({ game: "HSR", bug_report: "HSR browser feedback" });
});
