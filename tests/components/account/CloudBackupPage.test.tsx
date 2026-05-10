import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSessionProvider } from "@/contexts/AppSessionContext";
import CloudBackupPage from "@/pages/account/CloudBackupPage";
import { render } from "../../utils/render";

const signIn = vi.fn();
const getIdToken = vi.fn();
let logtoState = {
  isAuthenticated: false,
  isLoading: false,
};

vi.mock("@logto/react", () => ({
  UserScope: { Email: "email" },
  useLogto: () => ({
    ...logtoState,
    getIdToken,
    signIn,
  }),
}));

describe("CloudBackupPage", () => {
  beforeEach(() => {
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
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires sign-in before manual backup actions", async () => {
    renderCloudBackupPage();

    expect(await screen.findByText("Sign in required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  });

  it("starts Logto sign-in from the signed-out cloud backup CTA", async () => {
    renderCloudBackupPage();

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

  it("uses an existing app session even when Logto is not currently authenticated", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Response.json({
          id: "usr_1",
          email: "traveler@example.com",
          authMode: "logto",
          entitlements: ["cloud_sync"],
        });
      }
      return Response.json({
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
          used: 2,
          remaining: 8,
          resetsAt: Date.UTC(2026, 5, 1),
        },
        heads: [],
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    renderCloudBackupPage();

    expect(
      await screen.findByText("Uploads this month: 2/10")
    ).toBeInTheDocument();
    expect(screen.queryByText("Sign in required")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
    });
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it("shows monthly upload quota and disables upload when it is exhausted", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return Response.json({
          id: "usr_1",
          email: "traveler@example.com",
          authMode: "logto",
          entitlements: ["cloud_sync"],
        });
      }
      return Response.json({
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
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    renderCloudBackupPage();

    expect(
      await screen.findByText("Uploads this month: 10/10")
    ).toBeInTheDocument();
    const uploadButton = screen.getByRole("button", { name: "Upload" });
    expect(uploadButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/backup/v1/head", {
      method: "GET",
      headers: {},
      credentials: "same-origin",
    });

    await userEvent.click(uploadButton);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("creates an app session and retries when backup metadata is unauthenticated", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        const authMeCalls = fetchImpl.mock.calls.filter(
          ([calledUrl]) => String(calledUrl) === "/api/auth/me"
        ).length;
        if (authMeCalls > 1) {
          return Response.json({ error: "unauthenticated" }, { status: 401 });
        }
        return Response.json({
          id: "usr_1",
          email: "traveler@example.com",
          authMode: "logto",
          entitlements: ["cloud_sync"],
        });
      }
      if (url === "/api/auth/session") {
        return Response.json({
          user: {
            id: "usr_1",
            email: "traveler@example.com",
            authMode: "logto",
            entitlements: ["cloud_sync"],
          },
          expiresAt: Date.UTC(2026, 5, 1),
        });
      }
      const headCalls = fetchImpl.mock.calls.filter(
        ([calledUrl]) => String(calledUrl) === "/api/backup/v1/head"
      ).length;
      if (url === "/api/backup/v1/head" && headCalls === 1) {
        return Response.json({ error: "unauthenticated" }, { status: 401 });
      }
      return Response.json({
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
          used: 3,
          remaining: 7,
          resetsAt: Date.UTC(2026, 5, 1),
        },
        heads: [],
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    renderCloudBackupPage();

    expect(
      await screen.findByText("Uploads this month: 3/10")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Your cloud backup sign-in expired. Sign in again before using cloud backup."
      )
    ).not.toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(fetchImpl).toHaveBeenNthCalledWith(4, "/api/auth/session", {
      method: "POST",
      headers: { Authorization: "Bearer id-token" },
      credentials: "same-origin",
    });
  });

  it("turns backup 401 metadata failures into a sign-in prompt", async () => {
    logtoState = {
      isAuthenticated: true,
      isLoading: false,
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        const authMeCalls = fetchImpl.mock.calls.filter(
          ([calledUrl]) => String(calledUrl) === "/api/auth/me"
        ).length;
        if (authMeCalls > 1) {
          return Response.json({ error: "unauthenticated" }, { status: 401 });
        }
        return Response.json({
          id: "usr_1",
          email: "traveler@example.com",
          authMode: "logto",
          entitlements: ["cloud_sync"],
        });
      }
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchImpl);

    renderCloudBackupPage();

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
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl).toHaveBeenNthCalledWith(4, "/api/auth/session", {
      method: "POST",
      headers: { Authorization: "Bearer id-token" },
      credentials: "same-origin",
    });
  });
});

function renderCloudBackupPage() {
  return render(
    <AppSessionProvider>
      <CloudBackupPage />
    </AppSessionProvider>
  );
}
