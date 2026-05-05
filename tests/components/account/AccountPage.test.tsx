import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "@/pages/account/AccountPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
const signOut = vi.fn();
const getIdTokenClaims = vi.fn();
let logtoState = {
  isAuthenticated: false,
  isLoading: false,
  error: undefined as Error | undefined,
};

vi.mock("@logto/react", () => ({
  UserScope: { Email: "email" },
  useLogto: () => ({
    ...logtoState,
    signIn,
    signOut,
    getIdTokenClaims,
  }),
}));

describe("AccountPage", () => {
  beforeEach(() => {
    signIn.mockReset();
    signOut.mockReset();
    getIdTokenClaims.mockReset();
    logtoState = {
      isAuthenticated: false,
      isLoading: false,
      error: undefined,
    };
  });

  it("shows the signed-out Logto login state", async () => {
    render(<AccountPage />);

    expect(await screen.findByText("Not signed in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
  });

  it("starts Logto sign-in with the app callback URL", async () => {
    render(<AccountPage />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIn).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/callback",
      postRedirectUri: "http://localhost:3000/account",
    });
  });

  it("shows the signed-in account identity", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
      error: undefined,
    };
    getIdTokenClaims.mockResolvedValue({
      sub: "user_1",
      name: "Traveler",
      email: "traveler@example.com",
    });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Traveler")).toBeInTheDocument();
    });
    expect(screen.getByText("traveler@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
