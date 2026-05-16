import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FeedbackEnv, handleFeedbackRequest } from "../../worker/feedback";
import { sha256Hex } from "./jwtTestUtils";

describe("Worker feedback API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a signed-in app session", async () => {
    const db = new FakeFeedbackD1Database();

    const response = await handleFeedbackRequest(
      feedbackRequest({ rating: 4, suggestion: "Add more filters" }),
      new URL("https://example.com/api/feedback/v1/submissions"),
      { BACKUP_DB: db as unknown as D1Database } as FeedbackEnv
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
    });
  });

  it("stores canonical feedback fields and contact metadata without email duplication", async () => {
    const { db, cookie } = await createFeedbackEnv();

    const response = await handleFeedbackRequest(
      feedbackRequest(
        {
          rating: 5,
          suggestion: "  Add artifact set notes.  ",
          bugReport: "",
          contactMethod: "  Discord: traveler  ",
        },
        cookie
      ),
      new URL("https://example.com/api/feedback/v1/submissions"),
      { BACKUP_DB: db as unknown as D1Database } as FeedbackEnv
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      createdAt: Date.now(),
      nextAllowedAt: Date.now() + 5 * 60 * 1000,
    });
    expect(db.feedbackSubmissions).toHaveLength(1);
    expect(db.feedbackSubmissions[0]).toMatchObject({
      user_id: "usr_feedback",
      rating: 5,
      suggestion: "Add artifact set notes.",
      bug_report: null,
      created_at: Date.now(),
    });
    expect(
      JSON.parse(db.feedbackSubmissions[0]?.metadata_json ?? "{}")
    ).toEqual({
      schemaVersion: 1,
      contactMethod: "Discord: traveler",
    });
    expect(db.feedbackSubmissions[0]).not.toHaveProperty("user_email");
  });

  it("rejects empty content and over-limit fields", async () => {
    const { db, cookie } = await createFeedbackEnv();

    const emptyResponse = await handleFeedbackRequest(
      feedbackRequest({ rating: 3, suggestion: " ", bugReport: "\n" }, cookie),
      new URL("https://example.com/api/feedback/v1/submissions"),
      { BACKUP_DB: db as unknown as D1Database } as FeedbackEnv
    );
    const longResponse = await handleFeedbackRequest(
      feedbackRequest({ rating: 3, bugReport: "x".repeat(1001) }, cookie),
      new URL("https://example.com/api/feedback/v1/submissions"),
      { BACKUP_DB: db as unknown as D1Database } as FeedbackEnv
    );
    const ratingResponse = await handleFeedbackRequest(
      feedbackRequest({ rating: 6, bugReport: "Broken" }, cookie),
      new URL("https://example.com/api/feedback/v1/submissions"),
      { BACKUP_DB: db as unknown as D1Database } as FeedbackEnv
    );

    expect(emptyResponse.status).toBe(422);
    await expect(emptyResponse.json()).resolves.toEqual({
      error: "feedback_body_required",
    });
    expect(longResponse.status).toBe(413);
    await expect(longResponse.json()).resolves.toMatchObject({
      error: "payload_too_large",
      field: "bugReport",
      maxLength: 1000,
    });
    expect(ratingResponse.status).toBe(422);
    await expect(ratingResponse.json()).resolves.toEqual({
      error: "invalid_payload",
      field: "rating",
    });
    expect(db.feedbackSubmissions).toHaveLength(0);
  });

  it("limits each user to one submission every five minutes", async () => {
    const { db, cookie } = await createFeedbackEnv();
    const env = { BACKUP_DB: db as unknown as D1Database } as FeedbackEnv;
    const url = new URL("https://example.com/api/feedback/v1/submissions");

    const first = await handleFeedbackRequest(
      feedbackRequest({ rating: 4, suggestion: "First" }, cookie),
      url,
      env
    );
    const second = await handleFeedbackRequest(
      feedbackRequest({ rating: 4, suggestion: "Second" }, cookie),
      url,
      env
    );
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    const third = await handleFeedbackRequest(
      feedbackRequest({ rating: 5, suggestion: "Third" }, cookie),
      url,
      env
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toMatchObject({
      error: "feedback_rate_limited",
      retryAt: Date.parse("2026-05-16T12:05:00Z"),
    });
    expect(third.status).toBe(201);
    expect(db.feedbackSubmissions.map((row) => row.suggestion)).toEqual([
      "First",
      "Third",
    ]);
  });
});

function feedbackRequest(body: unknown, cookie?: string): Request {
  return new Request("https://example.com/api/feedback/v1/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function createFeedbackEnv(): Promise<{
  db: FakeFeedbackD1Database;
  cookie: string;
}> {
  const db = new FakeFeedbackD1Database();
  const token = "feedback-session-token";
  const tokenHash = await sha256Hex(token);
  db.appUsers.set("usr_feedback", { displayName: "Traveler" });
  db.identities.set("logto\0feedback-user", {
    userId: "usr_feedback",
    email: "traveler@example.com",
    displayName: "Traveler",
  });
  db.sessions.set(tokenHash, {
    userId: "usr_feedback",
    expiresAt: Date.now() + 60 * 60 * 1000,
    revokedAt: null,
  });
  return {
    db,
    cookie: `ggartifact_session=${token}`,
  };
}

type FeedbackRow = {
  id: string;
  user_id: string;
  rating: number;
  suggestion: string | null;
  bug_report: string | null;
  metadata_json: string;
  created_at: number;
};

class FakeFeedbackD1Database {
  readonly appUsers = new Map<string, { displayName: string | null }>();
  readonly identities = new Map<
    string,
    {
      userId: string;
      email: string | null;
      displayName: string | null;
    }
  >();
  readonly sessions = new Map<
    string,
    {
      userId: string;
      expiresAt: number;
      revokedAt: number | null;
    }
  >();
  readonly feedbackSubmissions: FeedbackRow[] = [];

  prepare(sql: string): FakeFeedbackD1Statement {
    return new FakeFeedbackD1Statement(this, sql);
  }
}

class FakeFeedbackD1Statement {
  constructor(
    private readonly db: FakeFeedbackD1Database,
    private readonly sql: string,
    private readonly args: unknown[] = []
  ) {}

  bind(...args: unknown[]): FakeFeedbackD1Statement {
    return new FakeFeedbackD1Statement(this.db, this.sql, args);
  }

  async run(): Promise<D1Result> {
    if (this.sql.includes("INSERT INTO feedback_submissions")) {
      const [
        id,
        userId,
        rating,
        suggestion,
        bugReport,
        metadataJson,
        createdAt,
        rateUserId,
        cutoff,
      ] = this.args;
      const isRateLimited = this.db.feedbackSubmissions.some(
        (row) =>
          row.user_id === String(rateUserId) && row.created_at > Number(cutoff)
      );
      if (isRateLimited) return d1Ok(0);
      this.db.feedbackSubmissions.push({
        id: String(id),
        user_id: String(userId),
        rating: Number(rating),
        suggestion: suggestion === null ? null : String(suggestion),
        bug_report: bugReport === null ? null : String(bugReport),
        metadata_json: String(metadataJson),
        created_at: Number(createdAt),
      });
      return d1Ok(1);
    }

    throw new Error(`Unhandled fake run SQL: ${this.sql}`);
  }

  async first<T = unknown>(): Promise<T | null> {
    if (this.sql.includes("FROM app_auth_sessions")) {
      const [provider, tokenHash, now] = this.args;
      const session = this.db.sessions.get(String(tokenHash));
      if (
        !session ||
        session.revokedAt !== null ||
        session.expiresAt <= Number(now)
      ) {
        return null;
      }
      const user = this.db.appUsers.get(session.userId);
      if (!user) return null;
      const identity = [...this.db.identities.values()].find(
        (entry) => entry.userId === session.userId
      );
      return {
        user_id: session.userId,
        display_name: user.displayName,
        email: String(provider) === "logto" ? (identity?.email ?? null) : null,
        expires_at: session.expiresAt,
      } as T;
    }

    if (this.sql.includes("FROM feedback_submissions")) {
      const [userId] = this.args;
      const latest = this.db.feedbackSubmissions
        .filter((row) => row.user_id === String(userId))
        .sort((a, b) => b.created_at - a.created_at)[0];
      return latest ? ({ created_at: latest.created_at } as T) : null;
    }

    throw new Error(`Unhandled fake first SQL: ${this.sql}`);
  }
}

function d1Ok(changes: number): D1Result {
  return {
    success: true,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: changes,
      last_row_id: 0,
      changed_db: changes > 0,
      changes,
    },
    results: [],
  };
}
