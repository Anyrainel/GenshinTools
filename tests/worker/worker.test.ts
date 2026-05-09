import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { isStaticAssetRequest } from "../../worker/index";

describe("Worker API routing", () => {
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
        if (url.pathname !== "/index.html") {
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
