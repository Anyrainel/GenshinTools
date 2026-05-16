import { describe, expect, it, vi } from "vitest";
import {
  type FeedbackApiError,
  isFeedbackRateLimitedError,
  submitFeedback,
} from "@/cloud/feedback";

describe("feedback client", () => {
  it("submits trimmed feedback fields to the feedback API", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          id: "feedback_1",
          createdAt: 1,
          nextAllowedAt: 2,
        },
        { status: 201 }
      )
    ) as typeof fetch;

    const response = await submitFeedback(
      {
        rating: 5,
        suggestion: "  Add notes.  ",
        bugReport: "",
        contactMethod: " QQ 1093957900 ",
      },
      fetchImpl
    );

    expect(response).toMatchObject({ id: "feedback_1", nextAllowedAt: 2 });
    expect(fetchImpl).toHaveBeenCalledWith("/api/feedback/v1/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        rating: 5,
        suggestion: "Add notes.",
        bugReport: undefined,
        contactMethod: "QQ 1093957900",
      }),
    });
  });

  it("throws typed API errors for rate limits", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          error: "feedback_rate_limited",
          retryAt: 123,
        },
        { status: 429 }
      )
    ) as typeof fetch;

    await expect(
      submitFeedback({ rating: 1, bugReport: "Broken" }, fetchImpl)
    ).rejects.toMatchObject({
      name: "FeedbackApiError",
      status: 429,
      payload: {
        error: "feedback_rate_limited",
        retryAt: 123,
      },
    } satisfies Partial<FeedbackApiError>);

    try {
      await submitFeedback({ rating: 1, bugReport: "Broken" }, fetchImpl);
    } catch (error) {
      expect(isFeedbackRateLimitedError(error)).toBe(true);
    }
  });
});
