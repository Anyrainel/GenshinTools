export const FEEDBACK_BODY_MAX_LENGTH = 1000;
export const FEEDBACK_CONTACT_METHOD_MAX_LENGTH = 200;
export const FEEDBACK_SUBMISSION_COOLDOWN_MS = 5 * 60 * 1000;

export type SubmitFeedbackInput = {
  rating: number;
  suggestion?: string;
  bugReport?: string;
  contactMethod?: string;
};

export type SubmitFeedbackResponse = {
  id: string;
  createdAt: number;
  nextAllowedAt: number;
};

export type FeedbackRateLimitedPayload = {
  error: "feedback_rate_limited";
  retryAt: number;
};

export class FeedbackApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "FeedbackApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<SubmitFeedbackResponse> {
  const response = await fetchImpl("/api/feedback/v1/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      rating: input.rating,
      suggestion: input.suggestion?.trim() || undefined,
      bugReport: input.bugReport?.trim() || undefined,
      contactMethod: input.contactMethod?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    const payload = await readFeedbackErrorPayload(response);
    throw new FeedbackApiError(
      `submit feedback failed with HTTP ${response.status}`,
      response.status,
      payload
    );
  }

  return response.json() as Promise<SubmitFeedbackResponse>;
}

export function isFeedbackRateLimitedError(
  error: unknown
): error is FeedbackApiError & { payload: FeedbackRateLimitedPayload } {
  return (
    error instanceof FeedbackApiError &&
    error.status === 429 &&
    !!error.payload &&
    typeof error.payload === "object" &&
    "error" in error.payload &&
    error.payload.error === "feedback_rate_limited" &&
    "retryAt" in error.payload &&
    typeof error.payload.retryAt === "number"
  );
}

async function readFeedbackErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}
