import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "@/pages/account/AccountPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
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
    signOut: vi.fn(),
    getIdTokenClaims,
  }),
}));

describe("AccountPage", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/account");
    window.sessionStorage.clear();
    signIn.mockReset();
    getIdTokenClaims.mockReset();
    logtoState = {
      isAuthenticated: false,
      isLoading: false,
      error: undefined,
    };
  });

  it("shows the signed-out Logto fallback state", async () => {
    render(<AccountPage />);

    expect(await screen.findByText("Not signed in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Sign out" })
    ).not.toBeInTheDocument();
  });

  it("starts Logto sign-in and returns to cloud backup", async () => {
    render(<AccountPage />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIn).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/callback",
      postRedirectUri: "http://localhost:3000/account/cloud-backup",
    });
    expect(window.sessionStorage.getItem("logto:returnPath")).toBe(
      "/account/cloud-backup"
    );
  });

  it("redirects signed-in users to cloud backup", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
      error: undefined,
    };
    getIdTokenClaims.mockResolvedValue({
      sub: "user_1",
      email: "traveler@example.com",
    });

    render(
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/account/cloud-backup"
          element={<div>Cloud backup route</div>}
        />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByText("Cloud backup route")).toBeInTheDocument();
    });
  });
});
