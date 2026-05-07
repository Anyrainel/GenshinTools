import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CloudBackupPage from "@/pages/account/CloudBackupPage";
import { render } from "../../utils/render";

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
  }),
}));

describe("CloudBackupPage", () => {
  beforeEach(() => {
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
});
