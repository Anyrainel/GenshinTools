import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as feedbackApi from "@/cloud/feedback";
import { AccountFeedbackDialog } from "@/components/layout/AccountFeedbackDialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ui: (key: string) => key,
    },
  }),
}));

vi.mock("@/cloud/feedback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/cloud/feedback")>();
  return {
    ...actual,
    submitFeedback: vi.fn(),
  };
});

describe("AccountFeedbackDialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockMatchMedia(true);
    vi.mocked(feedbackApi.submitFeedback).mockReset();
  });

  it("shows a sign-in prompt for anonymous users", async () => {
    const onOpenChange = vi.fn();
    const onSignIn = vi.fn(async () => undefined);

    render(
      <AccountFeedbackDialog
        open
        onOpenChange={onOpenChange}
        isAuthenticated={false}
        isAccountLoading={false}
        accountId={null}
        onSignIn={onSignIn}
      />
    );

    expect(
      screen.getByText("feedback.signInRequiredTitle")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "accountSystem.signIn" })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSignIn).toHaveBeenCalled();
  });

  it("submits feedback and stores the client cooldown", async () => {
    const onOpenChange = vi.fn();
    vi.mocked(feedbackApi.submitFeedback).mockResolvedValue({
      id: "feedback_1",
      createdAt: 1,
      nextAllowedAt: 123456,
    });

    render(
      <AccountFeedbackDialog
        open
        onOpenChange={onOpenChange}
        isAuthenticated
        isAccountLoading={false}
        accountId="usr_feedback"
        onSignIn={async () => undefined}
      />
    );

    expect(
      screen.getByRole("button", { name: "feedback.submit" })
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "5 feedback.ratingStarLabel" })
    );
    fireEvent.change(screen.getByLabelText("feedback.suggestionLabel"), {
      target: { value: "Add artifact notes" },
    });
    fireEvent.change(screen.getByLabelText("feedback.bugReportLabel"), {
      target: { value: "Import preview is blank" },
    });
    fireEvent.change(screen.getByLabelText("feedback.contactLabel"), {
      target: { value: "Discord traveler" },
    });
    fireEvent.click(screen.getByRole("button", { name: "feedback.submit" }));

    await waitFor(() => {
      expect(feedbackApi.submitFeedback).toHaveBeenCalledWith({
        rating: 5,
        suggestion: "Add artifact notes",
        bugReport: "Import preview is blank",
        contactMethod: "Discord traveler",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(window.sessionStorage.getItem(FEEDBACK_DRAFT_KEY)).toBeNull();
    expect(
      window.localStorage.getItem(
        "ggartifact:feedback:usr_feedback:nextAllowedAt"
      )
    ).toBe("123456");
  });

  it("restores all feedback draft fields from session storage", () => {
    window.sessionStorage.setItem(
      FEEDBACK_DRAFT_KEY,
      JSON.stringify({
        rating: 4,
        suggestion: "Add a scanner hint",
        bugReport: "The result panel flickers",
        contactMethod: "QQ 1093957900",
      })
    );

    render(
      <AccountFeedbackDialog
        open
        onOpenChange={vi.fn()}
        isAuthenticated
        isAccountLoading={false}
        accountId="usr_feedback"
        onSignIn={async () => undefined}
      />
    );

    expect(screen.getByLabelText("feedback.suggestionLabel")).toHaveValue(
      "Add a scanner hint"
    );
    expect(
      screen.getByRole("button", { name: "feedback.submit" })
    ).toBeEnabled();
    expect(screen.getByLabelText("feedback.bugReportLabel")).toHaveValue(
      "The result panel flickers"
    );
    expect(screen.getByLabelText("feedback.contactLabel")).toHaveValue(
      "QQ 1093957900"
    );
  });

  it("keeps the draft when submit finds an expired sign-in", async () => {
    const onOpenChange = vi.fn();
    const onSignIn = vi.fn(async () => undefined);
    vi.mocked(feedbackApi.submitFeedback).mockRejectedValue(
      new feedbackApi.FeedbackApiError("expired", 401, {
        error: "unauthenticated",
      })
    );

    render(
      <AccountFeedbackDialog
        open
        onOpenChange={onOpenChange}
        isAuthenticated
        isAccountLoading={false}
        accountId="usr_feedback"
        onSignIn={onSignIn}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "3 feedback.ratingStarLabel" })
    );
    fireEvent.change(screen.getByLabelText("feedback.suggestionLabel"), {
      target: { value: "Add filters" },
    });
    fireEvent.change(screen.getByLabelText("feedback.bugReportLabel"), {
      target: { value: "Login expired during submit" },
    });
    fireEvent.change(screen.getByLabelText("feedback.contactLabel"), {
      target: { value: "Discord traveler" },
    });
    fireEvent.click(screen.getByRole("button", { name: "feedback.submit" }));

    await waitFor(() => {
      expect(
        screen.getByText("feedback.signInRequiredError")
      ).toBeInTheDocument();
    });
    expect(readFeedbackDraft()).toEqual({
      rating: 3,
      suggestion: "Add filters",
      bugReport: "Login expired during submit",
      contactMethod: "Discord traveler",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "accountSystem.signIn" })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSignIn).toHaveBeenCalled();
  });

  it("blocks another client-side submission during the cooldown window", () => {
    window.localStorage.setItem(
      "ggartifact:feedback:usr_feedback:nextAllowedAt",
      String(Date.now() + 60_000)
    );

    render(
      <AccountFeedbackDialog
        open
        onOpenChange={vi.fn()}
        isAuthenticated
        isAccountLoading={false}
        accountId="usr_feedback"
        onSignIn={async () => undefined}
      />
    );

    expect(screen.getByText("feedback.rateLimited")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "feedback.submit" })
    ).toBeDisabled();
  });
});

const FEEDBACK_DRAFT_KEY = "ggartifact:feedback:draft";

function readFeedbackDraft() {
  const raw = window.sessionStorage.getItem(FEEDBACK_DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
