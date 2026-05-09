import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallbackPage from "@/pages/account/AuthCallbackPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
const signOut = vi.fn();
const getIdToken = vi.fn();
const getIdTokenClaims = vi.fn();
let callbackState = {
  isLoading: false,
  isAuthenticated: false,
  error: undefined as Error | undefined,
};

vi.mock("@logto/react", () => ({
  UserScope: { Email: "email" },
  useHandleSignInCallback: () => callbackState,
  useLogto: () => ({
    isAuthenticated: false,
    isLoading: false,
    error: undefined,
    signIn,
    signOut,
    getIdToken,
    getIdTokenClaims,
  }),
}));

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/callback");
    window.sessionStorage.clear();
    signIn.mockReset();
    signOut.mockReset();
    getIdToken.mockReset();
    getIdToken.mockResolvedValue("id-token");
    getIdTokenClaims.mockReset();
    callbackState = {
      isLoading: false,
      isAuthenticated: false,
      error: undefined,
    };
  });

  it("shows a user-facing error when the callback has no active sign-in session", async () => {
    window.history.pushState(null, "", "/callback?code=abc&state=stale");

    render(<AuthCallbackPage />);

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This sign-in link is incomplete or expired. Use the Sign in button again."
      )
    ).toBeInTheDocument();
  });

  it("maps Logto callback errors to user-facing copy", async () => {
    callbackState = {
      isLoading: false,
      isAuthenticated: false,
      error: Object.assign(new Error("invalid_target"), {
        code: "callback_uri_verification.error_found",
        data: { error: "invalid_target" },
      }),
    };

    render(<AuthCallbackPage />);

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cloud backup sign-in is not available right now. Your browser data is unchanged. Try again later."
      )
    ).toBeInTheDocument();
  });
});
