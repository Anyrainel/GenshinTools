import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import authSchema from "../../migrations/0002_auth.sql?raw";
import sessionsSchema from "../../migrations/0003_auth_sessions.sql?raw";
import feedbackSchema from "../../migrations/0005_feedback.sql?raw";
import gameMigration from "../../migrations/0006_feedback_game.sql?raw";
import commentSchema from "../../migrations/0007_character_comments.sql?raw";
import publicMigration from "../../migrations/0008_public_feedback.sql?raw";
import { handleCommunityRequest } from "../../worker/community";
import { handleFeedbackRequest } from "../../worker/feedback";
import { sha256Hex } from "./jwtTestUtils";

beforeAll(async () => {
  for (const schema of [
    authSchema,
    sessionsSchema,
    feedbackSchema,
    gameMigration,
    commentSchema,
    publicMigration,
  ]) {
    for (const sql of schema
      .replace(/^--.*$/gm, "")
      .split(";")
      .filter((sql) => sql.trim()))
      await env.BACKUP_DB.prepare(sql).run();
  }
});

beforeEach(async () => {
  await env.BACKUP_DB.prepare("DELETE FROM character_comments").run();
  await env.BACKUP_DB.prepare("DELETE FROM feedback_submissions").run();
  await env.BACKUP_DB.prepare("DELETE FROM app_auth_sessions").run();
  await env.BACKUP_DB.prepare("DELETE FROM app_users").run();
  await env.BACKUP_DB.prepare(
    "INSERT INTO app_users (id, display_name, created_at, updated_at) VALUES ('social-user', 'Private name', 1, 1)"
  ).run();
  await env.BACKUP_DB.prepare(
    "INSERT INTO app_auth_sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, 'social-user', 1, ?, 1)"
  )
    .bind(await sha256Hex("social-token"), Date.now() + 3600000)
    .run();
});

describe("Public community API with migrated D1", () => {
  it("keeps old and old-client feedback private and omits identity/contact fields", async () => {
    const db = env.BACKUP_DB;
    await db
      .prepare(
        "INSERT INTO feedback_submissions (id, user_id, rating, suggestion, metadata_json, created_at) VALUES ('old', 'social-user', 5, 'Private historical text', '{\"contactMethod\":\"private@example.test\"}', 1)"
      )
      .run();
    const url = new URL("https://example.com/api/feedback/v1/submissions");
    const post = await handleFeedbackRequest(
      new Request(url, {
        method: "POST",
        headers: {
          Cookie: "ggartifact_session=social-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public: true,
          rating: 4,
          suggestion: "Public text",
          contactMethod: "secret@example.test",
        }),
      }),
      url,
      env
    );
    expect(post.status).toBe(201);
    const response = await handleFeedbackRequest(new Request(url), url, env);
    const payload = (await response.json()) as { items: unknown[] };
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      rating: 4,
      suggestion: "Public text",
    });
    expect(Object.keys(payload.items[0] as object).sort()).toEqual([
      "bugReport",
      "createdAt",
      "id",
      "rating",
      "suggestion",
    ]);
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(JSON.stringify(payload)).not.toContain("Private");
    const hsr = new URL(`${url}?game=HSR`);
    expect(
      await (await handleFeedbackRequest(new Request(hsr), hsr, env)).json()
    ).toEqual({ items: [], nextCursor: null });
  });
  it("paginates equal timestamps without duplicates and isolates character/game threads", async () => {
    for (let i = 0; i < 23; i++) {
      await env.BACKUP_DB.prepare(
        "INSERT INTO character_comments VALUES (?, 'social-user', 'GI', 'amber', ?, 100)"
      )
        .bind(`id_${String(i).padStart(2, "0")}`, `Post ${i}`)
        .run();
    }
    await env.BACKUP_DB.prepare(
      "INSERT INTO character_comments VALUES ('other', 'social-user', 'HSR', 'amber', 'Other game', 200)"
    ).run();
    const url = new URL(
      "https://example.com/api/community/v1/characters/amber/comments"
    );
    const first = (await (
      await handleCommunityRequest(new Request(url), url, env)
    ).json()) as { items: { id: string }[]; nextCursor: string };
    expect(first.items).toHaveLength(20);
    url.searchParams.set("cursor", first.nextCursor);
    const second = (await (
      await handleCommunityRequest(new Request(url), url, env)
    ).json()) as { items: { id: string }[]; nextCursor: null };
    expect(second.items).toHaveLength(3);
    expect(
      new Set([...first.items, ...second.items].map((post) => post.id)).size
    ).toBe(23);
    expect(second.nextCursor).toBeNull();
    url.pathname = "/api/community/v1/characters/lisa/comments";
    expect(
      await (await handleCommunityRequest(new Request(url), url, env)).json()
    ).toEqual({ items: [], nextCursor: null });
  });
  it("requires login, validates bodies, and enforces a cooldown across threads", async () => {
    const url = new URL(
      "https://example.com/api/community/v1/characters/amber/comments"
    );
    const request = (body: unknown, cookie = true) =>
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: "ggartifact_session=social-token" } : {}),
        },
        body: JSON.stringify({ body }),
      });
    expect(
      (await handleCommunityRequest(request("Hello", false), url, env)).status
    ).toBe(401);
    expect((await handleCommunityRequest(request(" "), url, env)).status).toBe(
      422
    );
    expect(
      (await handleCommunityRequest(request("x".repeat(1001)), url, env)).status
    ).toBe(422);
    const response = await handleCommunityRequest(
      request(" <script>hello</script> "),
      url,
      env
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      body: "<script>hello</script>",
    });
    url.pathname = "/api/community/v1/characters/lisa/comments";
    expect(
      (await handleCommunityRequest(request("Again"), url, env)).status
    ).toBe(429);
    url.searchParams.set("cursor", "invalid");
    expect(
      (await handleCommunityRequest(new Request(url), url, env)).status
    ).toBe(422);
  });
});
