import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import authSchema from "../../migrations/0002_auth.sql?raw";
import sessionsSchema from "../../migrations/0003_auth_sessions.sql?raw";
import feedbackSchema from "../../migrations/0005_feedback.sql?raw";
import gameMigration from "../../migrations/0006_feedback_game.sql?raw";
import commentSchema from "../../migrations/0007_character_comments.sql?raw";
import publicMigration from "../../migrations/0008_public_feedback.sql?raw";
import controlsMigration from "../../migrations/0009_feedback_controls.sql?raw";
import threadMigration from "../../migrations/0010_comment_threads.sql?raw";
import { handleCommunityRequest } from "../../worker/community";
import { maskFeedbackEmail } from "../../worker/communityAuthor";
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
    threadMigration,
  ]) {
    for (const sql of schema
      .replace(/^--.*$/gm, "")
      .split(";")
      .filter((sql) => sql.trim()))
      await env.BACKUP_DB.prepare(sql).run();
  }
  const triggerStart = controlsMigration.indexOf("CREATE TRIGGER");
  for (const sql of controlsMigration
    .slice(0, triggerStart)
    .replace(/^--.*$/gm, "")
    .split(";")
    .filter((sql) => sql.trim()))
    await env.BACKUP_DB.prepare(sql).run();
  await env.BACKUP_DB.prepare(controlsMigration.slice(triggerStart)).run();
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
  it.each(["ab@example.com", "a@example.com", "alice.smith@personal.example"])(
    "masks even short email addresses: %s",
    (email) => {
      expect(maskFeedbackEmail(email)).toContain("***");
      expect(maskFeedbackEmail(email)).not.toContain(email);
      expect(maskFeedbackEmail(email)?.split("@")[0]).not.toBe(
        email.split("@")[0]
      );
    }
  );

  it("shows private feedback only to its author, permits owner visibility changes and deduplicates votes", async () => {
    const db = env.BACKUP_DB;
    await db
      .prepare(
        "INSERT INTO auth_identities VALUES ('logto', 'social-subject', 'social-user', 'traveler@example.com', 'Private identity', 1, 1)"
      )
      .run();
    await db
      .prepare(
        "INSERT INTO app_users (id, created_at, updated_at) VALUES ('other-user', 1, 1)"
      )
      .run();
    await db
      .prepare(
        "INSERT INTO app_auth_sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, 'other-user', 1, ?, 1)"
      )
      .bind(await sha256Hex("other-token"), Date.now() + 3600000)
      .run();
    await db
      .prepare(
        "INSERT INTO feedback_submissions (id, user_id, rating, suggestion, metadata_json, created_at, is_public) VALUES ('hidden', 'social-user', 5, 'Hidden feedback', '{\"contactMethod\":\"secret@example.com\"}', 100, 0)"
      )
      .run();
    const url = new URL("https://example.com/api/feedback/v1/submissions");
    const read = async (token?: string) =>
      (
        await handleFeedbackRequest(
          new Request(url, {
            headers: token ? { Cookie: `ggartifact_session=${token}` } : {},
          }),
          url,
          env
        )
      ).json() as Promise<{ items: Array<Record<string, unknown>> }>;
    const mutate = async (
      action: string,
      value: unknown,
      token = "social-token"
    ) => {
      const target = new URL(`${url}/hidden/${action}`);
      return handleFeedbackRequest(
        new Request(target, {
          method: "POST",
          headers: {
            Cookie: `ggartifact_session=${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(value),
        }),
        target,
        env
      );
    };
    expect((await read()).items).toEqual([]);
    expect((await read("other-token")).items).toEqual([]);
    const own = await read("social-token");
    expect(own.items[0]).toMatchObject({
      id: "hidden",
      isOwner: true,
      isPublic: false,
      upvotes: 1,
      hasUpvoted: true,
      authorEmail: "t***r@e***e.com",
    });
    expect(JSON.stringify(own)).not.toContain("traveler@example.com");
    expect(JSON.stringify(own)).not.toContain("secret@example.com");
    expect(JSON.stringify(own)).not.toContain("social-user");
    expect(
      (await mutate("visibility", { public: true }, "other-token")).status
    ).toBe(404);
    expect((await mutate("vote", { voted: true }, "other-token")).status).toBe(
      404
    );
    expect((await mutate("visibility", { public: "true" })).status).toBe(422);
    expect((await mutate("visibility", { public: true })).status).toBe(200);
    expect((await read()).items).toHaveLength(1);
    expect((await read()).items[0].isOwner).toBe(false);
    await mutate("vote", { voted: true }, "other-token");
    await mutate("vote", { voted: true }, "other-token");
    expect((await read()).items[0].upvotes).toBe(2);
    await mutate("vote", { voted: false }, "other-token");
    expect((await read()).items[0].upvotes).toBe(1);
    await mutate("visibility", { public: false });
    expect((await read()).items).toEqual([]);
    expect((await read("social-token")).items).toHaveLength(1);
  });
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
      "authorEmail",
      "bugReport",
      "createdAt",
      "hasUpvoted",
      "id",
      "isOwner",
      "isPublic",
      "rating",
      "suggestion",
      "upvotes",
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
        "INSERT INTO character_comments (id, user_id, game, character_id, body, created_at) VALUES (?, 'social-user', 'GI', 'amber', ?, 100)"
      )
        .bind(`id_${String(i).padStart(2, "0")}`, `Post ${i}`)
        .run();
    }
    await env.BACKUP_DB.prepare(
      "INSERT INTO character_comments (id, user_id, game, character_id, body, created_at) VALUES ('other', 'social-user', 'HSR', 'amber', 'Other game', 200)"
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
  it("masks authors, enforces ownership and one reply level, paginates five replies and preserves them on deletion", async () => {
    const db = env.BACKUP_DB;
    await db
      .prepare(
        "INSERT INTO auth_identities VALUES ('logto', 'social-subject', 'social-user', 'traveler@example.com', 'Private identity', 1, 1)"
      )
      .run();
    await db
      .prepare(
        "INSERT INTO app_users (id, created_at, updated_at) VALUES ('other-user', 1, 1)"
      )
      .run();
    await db
      .prepare(
        "INSERT INTO character_comments (id, user_id, game, character_id, body, created_at) VALUES ('root', 'social-user', 'GI', 'amber', 'Original', 1), ('foreign', 'other-user', 'GI', 'amber', 'Foreign', 1)"
      )
      .run();
    const base =
      "https://example.com/api/community/v1/characters/amber/comments";
    const call = async (
      suffix = "",
      method = "GET",
      body?: string,
      authenticated = true
    ) => {
      const url = new URL(base + suffix);
      return handleCommunityRequest(
        new Request(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(authenticated
              ? { Cookie: "ggartifact_session=social-token" }
              : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify({ body }) }),
        }),
        url,
        env
      );
    };
    const own = (await (await call()).json()) as {
      items: Array<Record<string, unknown>>;
    };
    expect(own.items.find((item) => item.id === "root")).toMatchObject({
      authorEmail: "t***r@e***e.com",
      isOwner: true,
    });
    expect(JSON.stringify(own)).not.toContain("traveler@example.com");
    expect(JSON.stringify(own)).not.toContain("social-user");
    const anonymous = (await (
      await call("", "GET", undefined, false)
    ).json()) as typeof own;
    expect(anonymous.items.every((item) => item.isOwner === false)).toBe(true);
    expect((await call("/foreign", "PATCH", "Stolen")).status).toBe(404);
    expect((await call("/foreign", "DELETE")).status).toBe(404);
    expect((await call("/root", "PATCH", "Edited", false)).status).toBe(401);
    expect((await call("/root", "PATCH", "  ")).status).toBe(422);
    expect((await call("/root", "PATCH", "Edited")).status).toBe(200);
    expect((await call("/root/replies", "POST", "Reply")).status).toBe(201);
    const child = await db
      .prepare("SELECT id FROM character_comments WHERE parent_id = 'root'")
      .first<{ id: string }>();
    expect((await call(`/${child!.id}/replies`, "POST", "Nested")).status).toBe(
      404
    );
    expect((await call("/missing/replies", "POST", "Orphan")).status).toBe(404);
    const foreignUrl = new URL(
      `${base.replace("/amber/", "/lisa/")}/root/replies`
    );
    expect(
      (await handleCommunityRequest(new Request(foreignUrl), foreignUrl, env))
        .status
    ).toBe(404);
    for (let i = 0; i < 6; i++) {
      await db
        .prepare(
          "INSERT INTO character_comments (id, user_id, game, character_id, body, created_at, parent_id) VALUES (?, 'social-user', 'GI', 'amber', 'More replies', 2, 'root')"
        )
        .bind(`reply_${i}`)
        .run();
    }
    const first = (await (await call("/root/replies")).json()) as {
      items: { id: string }[];
      nextCursor: string;
    };
    expect(first.items).toHaveLength(5);
    const second = (await (
      await call(`/root/replies?cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json()) as typeof first;
    expect(second.items).toHaveLength(2);
    expect(
      new Set([...first.items, ...second.items].map((item) => item.id)).size
    ).toBe(7);
    expect(second.nextCursor).toBeNull();
    expect((await call(`/${child!.id}`, "PATCH", "Edited reply")).status).toBe(
      200
    );
    expect((await call(`/${child!.id}`, "DELETE")).status).toBe(200);
    expect((await call("/root", "DELETE")).status).toBe(200);
    expect((await call("/root", "PATCH", "Resurrect")).status).toBe(404);
    const deleted = (await (await call()).json()) as typeof own;
    expect(deleted.items.find((item) => item.id === "root")).toMatchObject({
      body: "",
      isDeleted: true,
      authorEmail: null,
      isOwner: false,
      replyCount: 7,
    });
    expect(
      ((await (await call("/root/replies")).json()) as typeof first).items
    ).toHaveLength(5);
    expect(
      await db
        .prepare("SELECT body FROM character_comments WHERE id = 'root'")
        .first()
    ).toEqual({ body: "[deleted]" });
  });
});
