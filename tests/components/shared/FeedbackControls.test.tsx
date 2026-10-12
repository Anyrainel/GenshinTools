import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedbackControls } from "@/components/shared/FeedbackControls";
import type { PublicFeedback } from "@/providers/community/community";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { ui: (key: string) => key } }),
}));
vi.mock("@/contexts/AppSessionContext", () => ({
  useAppSession: () => ({ isAuthenticated: true }),
}));
const post: PublicFeedback = {
  id: "mine",
  createdAt: 1,
  rating: 5,
  suggestion: "Feedback",
  bugReport: null,
  authorEmail: "t***r@e***e.com",
  isPublic: true,
  isOwner: true,
  upvotes: 1,
  hasUpvoted: true,
};
describe("Feedback controls", () => {
  it("updates visibility and vote state after the server confirms, and reports failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ...post, isPublic: false }))
      .mockResolvedValueOnce(
        Response.json({
          ...post,
          isPublic: false,
          upvotes: 0,
          hasUpvoted: false,
        })
      )
      .mockResolvedValueOnce(Response.json({}, { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    render(<FeedbackControls post={post} />);
    expect(screen.getByText("t***r@e***e.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "feedback.hide" }));
    expect(
      await screen.findByRole("button", { name: "feedback.publish" })
    ).toBeEnabled();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/feedback/v1/submissions/mine/visibility",
      expect.objectContaining({
        credentials: "same-origin",
        body: '{"public":false}',
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "feedback.upvote" }));
    expect(await screen.findByText("0")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "feedback.upvote" })
    ).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "feedback.publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "feedback.updateFailed"
    );
    expect(
      screen.getByRole("button", { name: "feedback.publish" })
    ).toBeEnabled();
  });
  it("does not offer visibility changes for other people's feedback", () => {
    render(<FeedbackControls post={{ ...post, isOwner: false }} />);
    expect(screen.queryByRole("button", { name: "feedback.hide" })).toBeNull();
  });
});
