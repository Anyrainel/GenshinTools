import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotFoundPage from "@/pages/NotFoundPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
const signOut = vi.fn();
const getIdTokenClaims = vi.fn();

vi.mock("@logto/react", () => ({
  UserScope: { Email: "email" },
  useLogto: () => ({
    isAuthenticated: false,
    isLoading: false,
    error: undefined,
    signIn,
    signOut,
    getIdTokenClaims,
  }),
}));

describe("NotFoundPage", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/unknown-page");
    signIn.mockReset();
    signOut.mockReset();
    getIdTokenClaims.mockReset();
  });

  it("renders a branded app 404 with back and home actions", () => {
    render(<NotFoundPage />);

    expect(screen.getByAltText("GGArtifact")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This page does not exist, or the link is no longer valid."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeEnabled();

    const homeLink = screen.getByRole("link", { name: "Go to home" });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
