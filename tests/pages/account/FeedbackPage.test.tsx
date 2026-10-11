import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

describe("Feedback deep link", () => {
  it("opens feedback immediately and keeps the feedback route after login", async () => {
    render(
      <MemoryRouter>
        <FeedbackPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("/account/feedback")
    );
  });

  it("returns home when feedback is closed", () => {
    render(
      <MemoryRouter initialEntries={["/account/feedback"]}>
        <Routes>
          <Route path="/account/feedback" element={<FeedbackPage />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Close feedback" }));
    expect(screen.getByText("Home")).toBeInTheDocument();
  });
});
