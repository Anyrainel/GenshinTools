import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSessionProvider } from "@/contexts/AppSessionContext";
import AccountPage from "@/pages/account/AccountPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
const getIdToken = vi.fn();
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
    getIdToken,
  }),
}));

describe("AccountPage", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/account");
    window.sessionStorage.clear();
    signIn.mockReset();
    getIdToken.mockReset();
    getIdToken.mockResolvedValue("id-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "unauthenticated" }, { status: 401 })
      )
    );
    logtoState = {
      isAuthenticated: false,
      isLoading: false,
      error: undefined,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the signed-out Logto fallback state", async () => {
    renderAccountPage();

    expect(
      (await screen.findAllByText("Not signed in")).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Sign in" }).at(-1)
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Sign out" })
    ).not.toBeInTheDocument();
  });

  it("starts Logto sign-in and returns to cloud backup", async () => {
    renderAccountPage();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Sign in" }).at(-1)!
    );

    expect(signIn).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/callback",
      postRedirectUri: "http://localhost:3000/account/cloud-backup",
    });
    expect(window.sessionStorage.getItem("logto:returnPath")).toBe(
      "/account/cloud-backup"
    );
  });

  it("redirects signed-in users to cloud backup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "usr_1",
          email: "traveler@example.com",
          authMode: "logto",
          entitlements: ["cloud_sync"],
        })
      )
    );

    render(
      <AppSessionProvider>
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/account/cloud-backup"
            element={<div>Cloud backup route</div>}
          />
        </Routes>
      </AppSessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Cloud backup route")).toBeInTheDocument();
    });
  });
});

function renderAccountPage() {
  return render(
    <AppSessionProvider>
      <AccountPage />
    </AppSessionProvider>
  );
}
