import { type AppEnv, isAuthFailure, requireUser } from "./auth";
import { communityJson, communityPage, parseCommunityPage } from "./community";
import { maskFeedbackEmail } from "./communityAuthor";

type FeedbackRow = {
  id: string;
  rating: number;
  suggestion: string | null;
  bugReport: string | null;
  createdAt: number;
  email: string | null;
  isPublic: number;
  isOwner: number;
  upvotes: number;
  hasUpvoted: number;
};

const SELECT_FEEDBACK = `SELECT f.id, f.rating, f.suggestion,
  f.bug_report AS bugReport, f.created_at AS createdAt, f.is_public AS isPublic,
  (SELECT email FROM auth_identities WHERE user_id = f.user_id AND email IS NOT NULL
    ORDER BY updated_at DESC, provider, provider_subject LIMIT 1) AS email,
  f.user_id = ? AS isOwner,
  (SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id) AS upvotes,
  EXISTS(SELECT 1 FROM feedback_votes WHERE feedback_id = f.id AND user_id = ?) AS hasUpvoted
  FROM feedback_submissions f`;

function toFeedback(row: FeedbackRow) {
  const { email, ...post } = row;
  return {
    ...post,
    authorEmail: maskFeedbackEmail(email),
    isPublic: Boolean(row.isPublic),
    isOwner: Boolean(row.isOwner),
    hasUpvoted: Boolean(row.hasUpvoted),
  };
}

export async function listFeedback(request: Request, url: URL, env: AppEnv) {
  const page = parseCommunityPage(url);
  if (page instanceof Response) return page;
  const user = await requireUser(request, env);
  if (isAuthFailure(user) && user.status !== 401)
    return communityJson(user.payload, user.status);
  const userId = isAuthFailure(user) ? "" : user.userId;
  const result = await env
    .BACKUP_DB!.prepare(`${SELECT_FEEDBACK}
    WHERE f.game = ? AND (f.is_public = 1 OR f.user_id = ?)
    AND (f.created_at < ? OR (f.created_at = ? AND f.id < ?))
    ORDER BY f.created_at DESC, f.id DESC LIMIT 21`)
    .bind(
      userId,
      userId,
      page.game,
      userId,
      page.before,
      page.before,
      page.beforeId
    )
    .all<FeedbackRow>();
  return communityJson(communityPage(result.results.map(toFeedback)));
}

export async function updateFeedback(
  request: Request,
  env: AppEnv,
  userId: string,
  id: string,
  action: "visibility" | "vote"
) {
  if (request.method !== "POST")
    return communityJson({ error: "method_not_allowed" }, 405);
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    return communityJson({ error: "invalid_content_type" }, 415);
  // Small action bodies need no text fields. Bound size before parsing.
  const reader = request.body?.getReader();
  if (!reader) return communityJson({ error: "invalid_json" }, 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 256) {
      await reader.cancel();
      return communityJson({ error: "payload_too_large" }, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return communityJson({ error: "invalid_json" }, 422);
  }
  const key = action === "visibility" ? "public" : "voted";
  if (
    !body ||
    typeof body !== "object" ||
    !(key in body) ||
    typeof (body as Record<string, unknown>)[key] !== "boolean"
  )
    return communityJson({ error: "invalid_payload", field: key }, 422);
  const enabled = (body as Record<string, boolean>)[key];
  const db = env.BACKUP_DB!;
  const access =
    action === "visibility"
      ? "f.user_id = ?"
      : "(f.is_public = 1 OR f.user_id = ?)";
  const found = await db
    .prepare(
      `SELECT id FROM feedback_submissions f WHERE f.id = ? AND ${access}`
    )
    .bind(id, userId)
    .first();
  if (!found) return communityJson({ error: "not_found" }, 404);
  if (action === "visibility") {
    await db
      .prepare(
        "UPDATE feedback_submissions SET is_public = ? WHERE id = ? AND user_id = ?"
      )
      .bind(enabled ? 1 : 0, id, userId)
      .run();
  } else if (enabled) {
    await db
      .prepare(`INSERT OR IGNORE INTO feedback_votes (feedback_id, user_id)
      SELECT id, ? FROM feedback_submissions WHERE id = ? AND (is_public = 1 OR user_id = ?)`)
      .bind(userId, id, userId)
      .run();
  } else {
    await db
      .prepare(`DELETE FROM feedback_votes WHERE feedback_id = ? AND user_id = ?
      AND EXISTS(SELECT 1 FROM feedback_submissions WHERE id = ? AND (is_public = 1 OR user_id = ?))`)
      .bind(id, userId, id, userId)
      .run();
  }
  const row = await db
    .prepare(
      `${SELECT_FEEDBACK} WHERE f.id = ? AND (f.is_public = 1 OR f.user_id = ?)`
    )
    .bind(userId, userId, id, userId)
    .first<FeedbackRow>();
  return row
    ? communityJson(toFeedback(row))
    : communityJson({ error: "not_found" }, 404);
}
