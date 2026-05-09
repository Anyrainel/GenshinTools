import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CloudBackupPage from "@/pages/account/CloudBackupPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
const getAccessToken = vi.fn();
const getIdToken = vi.fn();
const getIdTokenClaims = vi.fn();
let logtoState = {
  isAuthenticated: false,
  isLoading: false,
};

vi.mock("@logto/react", () => ({
  UserScope: { Email: "email" },
  useLogto: () => ({
    ...logtoState,
    getAccessToken,
    getIdToken,
    getIdTokenClaims,
    signIn,
  }),
}));

describe("CloudBackupPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    signIn.mockReset();
    getAccessToken.mockReset();
    getIdToken.mockReset();
    getIdToken.mockResolvedValue("id-token");
    getIdTokenClaims.mockReset();
    getIdTokenClaims.mockResolvedValue({ sub: "backup-user-1" });
    logtoState = {
      isAuthenticated: false,
      isLoading: false,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires sign-in before manual backup actions", async () => {
    render(<CloudBackupPage />);

    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  });

  it("starts Logto sign-in from the signed-out cloud backup CTA", async () => {
    render(<CloudBackupPage />);

    const signInButtons = await screen.findAllByRole("button", {
      name: "Sign in",
    });
    await userEvent.click(signInButtons.at(-1)!);

    expect(signIn).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/callback",
      postRedirectUri: "http://localhost:3000/account/cloud-backup",
    });
    expect(window.sessionStorage.getItem("logto:returnPath")).toBe(
      "/account/cloud-backup"
    );
  });

  it("shows monthly upload quota and disables upload when it is exhausted", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
    };
    const fetchImpl = vi.fn(async () =>
      Response.json({
        serverTime: 1,
        changed: true,
        headSetRev: "hset_1",
        capabilities: {
          apiVersion: 1,
          commitContentTypes: ["multipart/form-data"],
          maxObjectsPerCommit: 10,
          maxCompressedBytesPerCommit: 100,
          maxCompressedBytesPerObject: 50,
        },
        quota: {
          period: "2026-05",
          limit: 10,
          used: 10,
          remaining: 0,
          resetsAt: Date.UTC(2026, 5, 1),
        },
        heads: [],
      })
    );
    vi.stubGlobal("fetch", fetchImpl);

    render(<CloudBackupPage />);

    expect(
      await screen.findByText("Uploads this month: 10/10")
    ).toBeInTheDocument();
    const uploadButton = screen.getByRole("button", { name: "Upload" });
    expect(uploadButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await userEvent.click(uploadButton);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("turns backup 401 metadata failures into a sign-in prompt", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
    };
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: "unauthenticated" }, { status: 401 })
    );
    vi.stubGlobal("fetch", fetchImpl);

    render(<CloudBackupPage />);

    expect(
      await screen.findByText(
        "Your cloud backup sign-in expired. Sign in again before using cloud backup."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/get backup head failed with HTTP 401/)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
