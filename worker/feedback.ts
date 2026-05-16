import { type AppEnv, isAuthFailure, requireUser } from "./auth";

const FEEDBACK_API_PREFIX = "/api/feedback/v1";
const FEEDBACK_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_FEEDBACK_FIELD_LENGTH = 1000;
const MAX_CONTACT_METHOD_LENGTH = 200;
const MAX_FEEDBACK_REQUEST_BYTES = 4096;

const FEEDBACK_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export type FeedbackEnv = AppEnv;

type FeedbackSubmissionRequest = {
  rating?: unknown;
  suggestion?: unknown;
  bugReport?: unknown;
  contactMethod?: unknown;
};

type NormalizedFeedbackSubmission = {
  rating: number;
  suggestion: string | null;
  bugReport: string | null;
  contactMethod: string | null;
};

type FeedbackLatestRow = {
  created_at: number;
};

export async function handleFeedbackRequest(
  request: Request,
  url: URL,
  env: FeedbackEnv
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: FEEDBACK_CORS_HEADERS });
  }

  if (!env.BACKUP_DB) {
    return feedbackJson({ error: "feedback_not_configured" }, 503);
  }

  const user = await requireUser(request, env);
  if (isAuthFailure(user)) {
    return feedbackJson(user.payload, user.status);
  }

  const path = stripFeedbackPrefix(url.pathname);
  if (path === "/submissions") {
    if (request.method !== "POST") {
      return feedbackJson({ error: "method_not_allowed" }, 405);
    }
    return handleFeedbackSubmission(request, env.BACKUP_DB, user.userId);
  }

  return feedbackJson({ error: "not_found" }, 404);
}

async function handleFeedbackSubmission(
  request: Request,
  db: D1Database,
  userId: string
): Promise<Response> {
  const sizeError = validateRequestSize(request);
  if (sizeError) return sizeError;

  const body = await readJson<FeedbackSubmissionRequest>(request);
  if (body instanceof Response) return body;

  const normalized = normalizeFeedbackSubmission(body);
  if (normalized instanceof Response) return normalized;

  const now = Date.now();
  const id = makeFeedbackId();
  const metadata = {
    schemaVersion: 1,
    ...(normalized.contactMethod
      ? { contactMethod: normalized.contactMethod }
      : {}),
  };
  const result = await db
    .prepare(
      `INSERT INTO feedback_submissions (
        id, user_id, rating, suggestion, bug_report, metadata_json, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM feedback_submissions
        WHERE user_id = ?
          AND created_at > ?
      )`
    )
    .bind(
      id,
      userId,
      normalized.rating,
      normalized.suggestion,
      normalized.bugReport,
      JSON.stringify(metadata),
      now,
      userId,
      now - FEEDBACK_COOLDOWN_MS
    )
    .run();

  if (Number((result.meta as { changes?: number }).changes ?? 0) === 0) {
    const latest = await selectLatestFeedbackSubmission(db, userId);
    return feedbackJson(
      {
        error: "feedback_rate_limited",
        retryAt: (latest?.created_at ?? now) + FEEDBACK_COOLDOWN_MS,
      },
      429
    );
  }

  return feedbackJson(
    {
      id,
      createdAt: now,
      nextAllowedAt: now + FEEDBACK_COOLDOWN_MS,
    },
    201
  );
}

function validateRequestSize(request: Request): Response | null {
  const contentLength = request.headers.get("Content-Length");
  if (!contentLength) return null;
  const requestBytes = Number(contentLength);
  if (!Number.isFinite(requestBytes) || requestBytes < 0) {
    return feedbackJson({ error: "invalid_content_length" }, 400);
  }
  if (requestBytes > MAX_FEEDBACK_REQUEST_BYTES) {
    return feedbackJson(
      {
        error: "payload_too_large",
        maxBytes: MAX_FEEDBACK_REQUEST_BYTES,
      },
      413
    );
  }
  return null;
}

async function readJson<T>(request: Request): Promise<T | Response> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return feedbackJson({ error: "invalid_content_type" }, 415);
  }

  try {
    return (await request.json()) as T;
  } catch {
    return feedbackJson({ error: "invalid_json" }, 422);
  }
}

function normalizeFeedbackSubmission(
  body: FeedbackSubmissionRequest
): NormalizedFeedbackSubmission | Response {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return feedbackJson({ error: "invalid_payload", field: "body" }, 422);
  }

  const rating = normalizeRating(body.rating);
  if (rating instanceof Response) return rating;
  const suggestion = normalizeOptionalString(body.suggestion, "suggestion");
  if (suggestion instanceof Response) return suggestion;
  const bugReport = normalizeOptionalString(body.bugReport, "bugReport");
  if (bugReport instanceof Response) return bugReport;
  const contactMethod = normalizeOptionalString(
    body.contactMethod,
    "contactMethod"
  );
  if (contactMethod instanceof Response) return contactMethod;

  if (!suggestion && !bugReport) {
    return feedbackJson({ error: "feedback_body_required" }, 422);
  }
  if (suggestion && suggestion.length > MAX_FEEDBACK_FIELD_LENGTH) {
    return feedbackJson(
      {
        error: "payload_too_large",
        field: "suggestion",
        maxLength: MAX_FEEDBACK_FIELD_LENGTH,
      },
      413
    );
  }
  if (bugReport && bugReport.length > MAX_FEEDBACK_FIELD_LENGTH) {
    return feedbackJson(
      {
        error: "payload_too_large",
        field: "bugReport",
        maxLength: MAX_FEEDBACK_FIELD_LENGTH,
      },
      413
    );
  }
  if (contactMethod && contactMethod.length > MAX_CONTACT_METHOD_LENGTH) {
    return feedbackJson(
      {
        error: "payload_too_large",
        field: "contactMethod",
        maxLength: MAX_CONTACT_METHOD_LENGTH,
      },
      413
    );
  }

  return {
    rating,
    suggestion,
    bugReport,
    contactMethod,
  };
}

function normalizeRating(value: unknown): number | Response {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5
  ) {
    return feedbackJson({ error: "invalid_payload", field: "rating" }, 422);
  }
  return value;
}

function normalizeOptionalString(
  value: unknown,
  field: string
): string | null | Response {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return feedbackJson({ error: "invalid_payload", field }, 422);
  }
  return value.trim() || null;
}

async function selectLatestFeedbackSubmission(
  db: D1Database,
  userId: string
): Promise<FeedbackLatestRow | null> {
  return db
    .prepare(
      `SELECT created_at
      FROM feedback_submissions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1`
    )
    .bind(userId)
    .first<FeedbackLatestRow>();
}

function makeFeedbackId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `feedback_${[...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function stripFeedbackPrefix(pathname: string): string {
  const path = pathname.slice(FEEDBACK_API_PREFIX.length);
  return path === "" ? "/" : path;
}

function feedbackJson(
  obj: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...FEEDBACK_CORS_HEADERS,
      ...headers,
      "Content-Type": "application/json",
    },
  });
}
