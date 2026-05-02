import { describe, expect, it } from "vitest";
import {
  type AppEnv,
  isAuthFailure,
  requireEntitlement,
  requireUser,
} from "../../worker/auth";

describe("Worker auth boundary", () => {
  it("keeps backup auth unavailable until dev auth is configured", async () => {
    const result = await requireUser(request(), {} as AppEnv);

    expect(result).toEqual({
      status: 503,
      payload: { error: "backup_auth_not_configured" },
    });
  });

  it("rejects missing or wrong bearer credentials", async () => {
    const result = await requireUser(request(), {
      BACKUP_DEV_AUTH_SECRET: "secret",
    } as AppEnv);

    expect(result).toEqual({
      status: 401,
      payload: { error: "unauthenticated" },
    });
  });

  it("rejects unsafe dev user ids before they reach backup storage", async () => {
    const result = await requireUser(
      request({
        Authorization: "Bearer secret",
        "x-backup-dev-user-id": "../bad",
      }),
      { BACKUP_DEV_AUTH_SECRET: "secret" } as AppEnv
    );

    expect(result).toEqual({
      status: 422,
      payload: { error: "invalid_user" },
    });
  });

  it("returns the production-shaped authenticated user object for dev auth", async () => {
    const result = await requireUser(
      request({
        Authorization: "Bearer secret",
        "x-backup-dev-user-id": "user_test",
      }),
      { BACKUP_DEV_AUTH_SECRET: "secret" } as AppEnv
    );

    expect(isAuthFailure(result)).toBe(false);
    if (isAuthFailure(result)) return;
    expect(result).toMatchObject({
      userId: "user_test",
      authMode: "dev",
    });
    expect(result.entitlements.has("cloud_sync")).toBe(true);
  });

  it("reports entitlement failures in the shared auth shape", () => {
    const missing = requireEntitlement(
      { userId: "user_test", authMode: "dev", entitlements: new Set() },
      "cloud_sync"
    );

    expect(missing).toEqual({
      status: 403,
      payload: { error: "entitlement_required", code: "cloud_sync" },
    });
  });
});

function request(headers: HeadersInit = {}) {
  return new Request("https://example.com/api/backup/v1/head", { headers });
}
