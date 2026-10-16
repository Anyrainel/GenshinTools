import { type AppEnv, isAuthFailure, requireUser } from "./auth";
import { maskFeedbackEmail } from "./communityAuthor";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const PAGE_SIZE = 20;
const COOLDOWN_MS = 60_000;

export function communityJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

// Cursor ordering includes the id so simultaneous posts cannot skip each other.
export function parseCommunityPage(
  url: URL
): { game: "GI" | "HSR"; before: number; beforeId: string } | Response {
  const game = url.searchParams.get("game") ?? "GI";
  if (game !== "GI" && game !== "HSR") {
    return communityJson({ error: "invalid_game" }, 422);
  }
  const cursor = url.searchParams.get("cursor");
  if (!cursor) return { game, before: Number.MAX_SAFE_INTEGER, beforeId: "" };
  try {
    const value: unknown = JSON.parse(cursor);
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      !Number.isSafeInteger(value[0]) ||
      value[0] < 0 ||
      typeof value[1] !== "string" ||
      value[1].length > 100
    )
      throw new Error("Invalid cursor");
    return { game, before: value[0], beforeId: value[1] };
  } catch {
    return communityJson({ error: "invalid_cursor" }, 422);
  }
}

export function communityPage<T extends { id: string; createdAt: number }>(
  rows: T[],
  pageSize = PAGE_SIZE
) {
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > pageSize && last
        ? JSON.stringify([last.createdAt, last.id])
        : null,
  };
}

export async function handleCommunityRequest(
  request: Request,
  url: URL,
  env: AppEnv
): Promise<Response> {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: HEADERS });
  const match =
    /^\/api\/community\/v1\/characters\/([a-zA-Z0-9_-]{1,100})\/comments(?:\/([a-zA-Z0-9_-]{1,100})(\/replies)?)?$/.exec(
      url.pathname
    );
  if (!match) return communityJson({ error: "not_found" }, 404);
  if (!env.BACKUP_DB)
    return communityJson({ error: "community_not_configured" }, 503);
  const page = parseCommunityPage(url);
  if (page instanceof Response) return page;
  const characterId = match[1];
  const db = env.BACKUP_DB;
  const idParam = match[2];
  const replies = Boolean(match[3]);
  const user = await requireUser(request, env);
  if (isAuthFailure(user) && (request.method !== "GET" || user.status !== 401))
    return communityJson(user.payload, user.status);
  const userId = isAuthFailure(user) ? "" : user.userId;
  if (replies) {
    const parent = await db
      .prepare(`SELECT id FROM character_comments
      WHERE id = ? AND game = ? AND character_id = ? AND parent_id IS NULL`)
      .bind(idParam, page.game, characterId)
      .first();
    if (!parent) return communityJson({ error: "not_found" }, 404);
  }
  if (request.method === "GET") {
    if (idParam && !replies) return communityJson({ error: "not_found" }, 404);
    const pageSize = replies ? 5 : 20;
    const result = await db
      .prepare(`SELECT c.id, c.body, c.created_at AS createdAt, c.updated_at AS updatedAt,
      c.deleted_at AS deletedAt, c.user_id = ? AS isOwner,
      (SELECT email FROM auth_identities WHERE user_id = c.user_id AND email IS NOT NULL
        ORDER BY updated_at DESC, provider, provider_subject LIMIT 1) AS email,
      (SELECT COUNT(*) FROM character_comments r WHERE r.parent_id = c.id) AS replyCount
      FROM character_comments c
      WHERE c.game = ? AND c.character_id = ? AND c.parent_id IS ?
        AND (c.created_at < ? OR (c.created_at = ? AND c.id < ?))
      ORDER BY c.created_at DESC, c.id DESC LIMIT ?`)
      .bind(
        userId,
        page.game,
        characterId,
        replies ? idParam : null,
        page.before,
        page.before,
        page.beforeId,
        pageSize + 1
      )
      .all<{
        id: string;
        body: string;
        createdAt: number;
        updatedAt: number | null;
        deletedAt: number | null;
        isOwner: number;
        email: string | null;
        replyCount: number;
      }>();
    return communityJson(
      communityPage(
        result.results.map(({ email, deletedAt, ...row }) => ({
          ...row,
          body: deletedAt === null ? row.body : "",
          isDeleted: deletedAt !== null,
          isOwner: deletedAt === null && Boolean(row.isOwner),
          authorEmail: deletedAt === null ? maskFeedbackEmail(email) : null,
        })),
        pageSize
      )
    );
  }
  if (
    !["POST", "PATCH", "DELETE"].includes(request.method) ||
    (request.method === "POST"
      ? Boolean(idParam) && !replies
      : !idParam || replies)
  )
    return communityJson({ error: "method_not_allowed" }, 405);
  if (request.method === "DELETE") {
    const result = await db
      .prepare(`UPDATE character_comments SET body = '[deleted]', deleted_at = ?
      WHERE id = ? AND user_id = ? AND game = ? AND character_id = ? AND deleted_at IS NULL`)
      .bind(Date.now(), idParam, userId, page.game, characterId)
      .run();
    return communityJson(
      result.meta.changes ? { ok: true } : { error: "not_found" },
      result.meta.changes ? 200 : 404
    );
  }
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    return communityJson({ error: "invalid_content_type" }, 415);
  // Bound the actual stream, including requests with no Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) return communityJson({ error: "invalid_payload" }, 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      return communityJson({ error: "payload_too_large" }, 413);
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return communityJson({ error: "invalid_json" }, 422);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("body" in payload) ||
    typeof payload.body !== "string"
  )
    return communityJson({ error: "invalid_payload" }, 422);
  const body = payload.body.trim();
  if (!body || body.length > 1000)
    return communityJson({ error: "invalid_body" }, 422);
  const now = Date.now();
  if (request.method === "PATCH") {
    const result = await db
      .prepare(`UPDATE character_comments SET body = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND game = ? AND character_id = ? AND deleted_at IS NULL`)
      .bind(body, now, idParam, userId, page.game, characterId)
      .run();
    return communityJson(
      result.meta.changes ? { ok: true } : { error: "not_found" },
      result.meta.changes ? 200 : 404
    );
  }
  const id = `comment_${crypto.randomUUID()}`;
  const result = await db
    .prepare(`INSERT INTO character_comments (id, user_id, game, character_id, body, created_at, parent_id)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
      SELECT 1 FROM character_comments WHERE user_id = ? AND created_at > ?
    )`)
    .bind(
      id,
      userId,
      page.game,
      characterId,
      body,
      now,
      replies ? idParam : null,
      userId,
      now - COOLDOWN_MS
    )
    .run();
  if (!result.meta.changes)
    return communityJson({ error: "comment_rate_limited" }, 429);
  return communityJson({ id, body, createdAt: now }, 201);
}
