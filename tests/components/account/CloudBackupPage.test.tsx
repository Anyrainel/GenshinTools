import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CloudBackupPage from "@/pages/account/CloudBackupPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
let logtoState = {
  isAuthenticated: false,
  isLoading: false,
};

vi.mock("@logto/react", () => ({
  UserScope: { Email: "email" },
  useLogto: () => ({
    ...logtoState,
    getAccessToken: vi.fn(),
    getIdToken: vi.fn(),
    getIdTokenClaims: vi.fn(),
    signIn,
  }),
}));

describe("CloudBackupPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    signIn.mockReset();
    logtoState = {
      isAuthenticated: false,
      isLoading: false,
    };
  });

  it("requires sign-in before manual backup actions", async () => {
    render(<CloudBackupPage />);

    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back Up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });

  it("starts Logto sign-in from the signed-out cloud backup CTA", async () => {
    render(<CloudBackupPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign in" })
    );

    expect(signIn).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/callback",
      postRedirectUri: "http://localhost:3000/account/cloud-backup",
    });
    expect(window.sessionStorage.getItem("logto:returnPath")).toBe(
      "/account/cloud-backup"
    );
  });
});
