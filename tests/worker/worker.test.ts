import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { isStaticAssetRequest } from "../../worker/index";

const hoyolabCredentialHeaders = {
  "x-hoyolab-ltuid-v2": "uid",
  "x-hoyolab-ltmid-v2": "mid",
  "x-hoyolab-ltoken-v2": "token",
};

describe("Worker API routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles Enka CORS preflight in the Workers runtime", async () => {
    const response = await SELF.fetch("https://example.com/api/enka/uid/1", {
      method: "OPTIONS",
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "GET"
    );
  });

  it("rejects HoYoLAB requests without a region and endpoint", async () => {
    const response = await SELF.fetch("https://example.com/api/hoyolab", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "path_too_short",
    });
  });

  it("proxies only the Enka UID endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ playerInfo: {} }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await worker.fetch(
      new Request("https://example.com/api/enka/uid/123456789"),
      fakeAssetEnv()
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://enka.network/api/uid/123456789",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("rejects unsupported Enka proxy paths before upstream fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await worker.fetch(
      new Request("https://example.com/api/enka/avatar/123456789"),
      fakeAssetEnv()
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "path_not_allowed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies only supported HoYoLAB endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ retcode: 0, message: "OK", data: {} }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await worker.fetch(
      new Request("https://example.com/api/hoyolab/os/character/list", {
        method: "POST",
        headers: hoyolabCredentialHeaders,
        body: JSON.stringify({ role_id: "800000000", server: "os_asia" }),
      }),
      fakeAssetEnv()
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sg-public-api.hoyolab.com/event/game_record/genshin/api/character/list",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Cookie: "ltuid_v2=uid; ltmid_v2=mid; ltoken_v2=token",
        }),
      })
    );
  });

  it("rejects incomplete HoYoLAB credentials before upstream fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await worker.fetch(
      new Request("https://example.com/api/hoyolab/os/character/list", {
        method: "POST",
        headers: {
          "x-hoyolab-ltuid-v2": "uid",
          "x-hoyolab-ltoken-v2": "token",
        },
        body: JSON.stringify({ role_id: "800000000", server: "os_asia" }),
      }),
      fakeAssetEnv()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "missing_credentials",
      missing: ["ltmid_v2"],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported HoYoLAB proxy paths before upstream fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await worker.fetch(
      new Request("https://example.com/api/hoyolab/os/account/info", {
        method: "POST",
        headers: hoyolabCredentialHeaders,
        body: JSON.stringify({ role_id: "800000000", server: "os_asia" }),
      }),
      fakeAssetEnv()
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "path_not_allowed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed HoYoLAB detail bodies before upstream fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await worker.fetch(
      new Request("https://example.com/api/hoyolab/os/character/detail", {
        method: "POST",
        headers: hoyolabCredentialHeaders,
        body: JSON.stringify({ role_id: "800000000", server: "os_asia" }),
      }),
      fakeAssetEnv()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_body" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects HoYoLAB UID and server mismatches before upstream fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await worker.fetch(
      new Request("https://example.com/api/hoyolab/os/character/list", {
        method: "POST",
        headers: hoyolabCredentialHeaders,
        body: JSON.stringify({ role_id: "800000000", server: "os_usa" }),
      }),
      fakeAssetEnv()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_body" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const response = await SELF.fetch("https://example.com/api/missing");

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("serves app routes with query strings as the SPA shell", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/callback?code=abc&state=xyz"),
      fakeAssetEnv()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  it("does not propagate the static asset /index.html redirect for the root route", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/"),
      fakeAssetEnv()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  it("keeps missing static asset requests as real 404s", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/assets/missing-test.js"),
      fakeAssetEnv()
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });

  it("classifies file-like and public asset paths as static assets", () => {
    expect(isStaticAssetRequest("/assets/CloudBackupPage-old.js")).toBe(true);
    expect(isStaticAssetRequest("/@vite/client")).toBe(true);
    expect(isStaticAssetRequest("/@react-refresh")).toBe(true);
    expect(isStaticAssetRequest("/character/avatar.webp")).toBe(true);
    expect(isStaticAssetRequest("/good/mappings.json")).toBe(true);
    expect(isStaticAssetRequest("/favicon.svg")).toBe(true);
    expect(isStaticAssetRequest("/account/cloud-backup")).toBe(false);
    expect(isStaticAssetRequest("/team-comp/damage")).toBe(false);
  });
});

function fakeAssetEnv(): Env {
  return {
    ASSETS: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname === "/index.html") {
          return new Response(null, {
            status: 307,
            headers: { Location: "/" },
          });
        }
        if (url.pathname !== "/") {
          return new Response("asset missing", { status: 404 });
        }
        return new Response(
          '<!doctype html><html><body><div id="root"></div></body></html>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      },
    },
  } as Env;
}
