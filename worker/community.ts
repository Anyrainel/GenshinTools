import { type AppEnv, isAuthFailure, requireUser } from "./auth";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  rows: T[]
) {
  const items = rows.slice(0, PAGE_SIZE);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > PAGE_SIZE && last
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
    /^\/api\/community\/v1\/characters\/([a-zA-Z0-9_-]{1,100})\/comments$/.exec(
      url.pathname
    );
  if (!match) return communityJson({ error: "not_found" }, 404);
  if (!env.BACKUP_DB)
    return communityJson({ error: "community_not_configured" }, 503);
  const page = parseCommunityPage(url);
  if (page instanceof Response) return page;
  const characterId = match[1];
  const db = env.BACKUP_DB;
  if (request.method === "GET") {
    const result = await db
      .prepare(`SELECT id, body, created_at AS createdAt
      FROM character_comments
      WHERE game = ? AND character_id = ?
        AND (created_at < ? OR (created_at = ? AND id < ?))
      ORDER BY created_at DESC, id DESC LIMIT 21`)
      .bind(page.game, characterId, page.before, page.before, page.beforeId)
      .all<{ id: string; body: string; createdAt: number }>();
    return communityJson(communityPage(result.results));
  }
  if (request.method !== "POST")
    return communityJson({ error: "method_not_allowed" }, 405);
  const user = await requireUser(request, env);
  if (isAuthFailure(user)) return communityJson(user.payload, user.status);
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
  const id = `comment_${crypto.randomUUID()}`;
  const result = await db
    .prepare(`INSERT INTO character_comments (id, user_id, game, character_id, body, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
      SELECT 1 FROM character_comments WHERE user_id = ? AND created_at > ?
    )`)
    .bind(
      id,
      user.userId,
      page.game,
      characterId,
      body,
      now,
      user.userId,
      now - COOLDOWN_MS
    )
    .run();
  if (!result.meta.changes)
    return communityJson({ error: "comment_rate_limited" }, 429);
  return communityJson({ id, body, createdAt: now }, 201);
}
