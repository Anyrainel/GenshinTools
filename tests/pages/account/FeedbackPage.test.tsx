import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import FeedbackPage from "@/pages/account/FeedbackPage";

const signIn = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/components/layout/AppBar", () => ({ AppBar: () => null }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { ui: (key: string) => key } }),
}));
vi.mock("@/contexts/AppSessionContext", () => ({
  useAppSession: () => ({
    isAuthenticated: false,
    isLoading: false,
    account: null,
    signIn,
  }),
}));
vi.mock("@/components/layout/AccountFeedbackDialog", () => ({
  AccountFeedbackDialog: ({
    open,
    onOpenChange,
    onSignIn,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSignIn: () => Promise<void>;
  }) =>
    open && (
      <>
        <button type="button" onClick={() => void onSignIn()}>
          Sign in
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close feedback
        </button>
      </>
    ),
}));

describe("Public feedback route", () => {
  it("opens the dialog on request and returns to feedback after login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ items: [], nextCursor: null }))
    );
    render(
      <MemoryRouter>
        <FeedbackPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "feedback.title" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("/feedback"));
  });

  it("renders while feedback is loading and stays when the dialog closes", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    );
    render(
      <MemoryRouter>
        <FeedbackPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("status")).toHaveTextContent("community.loading");
    fireEvent.click(screen.getByRole("button", { name: "feedback.title" }));
    fireEvent.click(screen.getByRole("button", { name: "Close feedback" }));
    expect(
      screen.getByRole("heading", { name: "accountSystem.feedback" })
    ).toBeInTheDocument();
  });
});
