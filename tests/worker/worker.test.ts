import { exports } from "cloudflare:workers";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import worker, { isStaticAssetRequest } from "../../worker/index";
import { network } from "./network";

type UpstreamRequest = {
  url: string;
  method: string;
  headers: { get(name: string): string | null };
};

async function expectedMd5(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "MD5",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const hoyolabCredentialHeaders = {
  "x-hoyolab-ltuid-v2": "uid",
  "x-hoyolab-ltmid-v2": "mid",
  "x-hoyolab-ltoken-v2": "token",
};

describe("Worker API routing", () => {
  it("handles Enka CORS preflight in the Workers runtime", async () => {
    const response = await exports.default.fetch(
      "https://example.com/api/enka/uid/1",
      {
        method: "OPTIONS",
      }
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "GET"
    );
  });

  it("rejects HoYoLAB requests without a region and endpoint", async () => {
    const response = await exports.default.fetch(
      "https://example.com/api/hoyolab",
      {
        method: "POST",
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "path_too_short",
    });
  });

  it("proxies only the Enka UID endpoint", async () => {
    const upstreamRequests: UpstreamRequest[] = [];
    network.use(
      http.get("https://enka.network/api/uid/123456789", ({ request }) => {
        upstreamRequests.push(request);
        return HttpResponse.json({ playerInfo: {} });
      })
    );

    const response = await exports.default.fetch(
      "https://example.com/api/enka/uid/123456789"
    );

    expect(response.status).toBe(200);
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].url).toBe(
      "https://enka.network/api/uid/123456789"
    );
    expect(upstreamRequests[0].method).toBe("GET");
  });

  it("rejects unsupported Enka proxy paths before upstream fetch", async () => {
    const fetchMock = captureOutboundRequests();

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
    const upstreamRequests: UpstreamRequest[] = [];
    network.use(
      http.post(
        "https://sg-public-api.hoyolab.com/event/game_record/genshin/api/character/list",
        ({ request }) => {
          upstreamRequests.push(request);
          return HttpResponse.json({ retcode: 0, message: "OK", data: {} });
        }
      )
    );

    const response = await exports.default.fetch(
      new Request("https://example.com/api/hoyolab/os/character/list", {
        method: "POST",
        headers: hoyolabCredentialHeaders,
        body: JSON.stringify({ role_id: "800000000", server: "os_asia" }),
      })
    );

    expect(response.status).toBe(200);
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].method).toBe("POST");
    expect(upstreamRequests[0].headers.get("Cookie")).toBe(
      "ltuid_v2=uid; ltmid_v2=mid; ltoken_v2=token"
    );
    expect(upstreamRequests[0].headers.get("x-rpc-language")).toBe("en-us");
    expect(upstreamRequests[0].headers.get("x-rpc-lang")).toBe("en-us");
    const [time, nonce, digest] =
      upstreamRequests[0].headers.get("DS")?.split(",") ?? [];
    expect(nonce).toMatch(/^[a-zA-Z]{6}$/);
    expect(digest).toBe(
      await expectedMd5(
        `salt=6s25p5ox5y14umn1p61aqyyvbvvl3lrt&t=${time}&r=${nonce}`
      )
    );
  });

  it("uses the current upstream 米游社 web-client headers for CN requests", async () => {
    const upstreamRequests: UpstreamRequest[] = [];
    network.use(
      http.post(
        "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/character/list",
        ({ request }) => {
          upstreamRequests.push(request);
          return HttpResponse.json({ retcode: 0, message: "OK", data: {} });
        }
      )
    );

    await exports.default.fetch(
      new Request("https://example.com/api/hoyolab/cn/character/list", {
        method: "POST",
        headers: hoyolabCredentialHeaders,
        body: JSON.stringify({ role_id: "123456789", server: "cn_gf01" }),
      })
    );

    expect(upstreamRequests).toHaveLength(1);
    const headers = upstreamRequests[0].headers;
    expect(headers.get("x-rpc-app_version")).toBe("2.117.0");
    expect(headers.get("x-rpc-channel")).toBe("miyousheluodi");
    expect(headers.get("X-Requested-With")).toBe("com.mihoyo.hyperion");
    expect(headers.get("User-Agent")).toContain("miHoYoBBS/2.117.0");
  });

  it("signs the exact CN JSON body and sorted query parameters", async () => {
    let capturedDs: string | null = null;
    let capturedBody = "";
    network.use(
      http.post(
        "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/character/detail",
        async ({ request }) => {
          capturedDs = request.headers.get("DS");
          capturedBody = await request.text();
          return HttpResponse.json({ retcode: 0, data: { list: [] } });
        }
      )
    );
    const body =
      '{ "character_ids": [10000002], "role_id": "123456789", "server": "cn_gf01" }';
    const response = await exports.default.fetch(
      new Request(
        "https://example.com/api/hoyolab/cn/character/detail?z=last&a=first",
        {
          method: "POST",
          headers: hoyolabCredentialHeaders,
          body,
        }
      )
    );
    expect(response.status).toBe(200);
    expect(capturedBody).toBe(body);
    const [time, nonce, digest] = String(capturedDs).split(",");
    expect(Number(nonce)).toBeGreaterThanOrEqual(100001);
    expect(Number(nonce)).toBeLessThanOrEqual(200000);
    expect(digest).toBe(
      await expectedMd5(
        `salt=xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs&t=${time}&r=${nonce}&b=${body}&q=a=first&z=last`
      )
    );
  });

  it("routes ten-digit Asia UIDs to the overseas record endpoint", async () => {
    const upstreamRequests: UpstreamRequest[] = [];
    network.use(
      http.post(
        "https://sg-public-api.hoyolab.com/event/game_record/genshin/api/character/list",
        ({ request }) => {
          upstreamRequests.push(request);
          return HttpResponse.json({ retcode: 0, data: { list: [] } });
        }
      )
    );
    const response = await exports.default.fetch(
      new Request("https://example.com/api/hoyolab/os/character/list", {
        method: "POST",
        headers: hoyolabCredentialHeaders,
        body: JSON.stringify({ role_id: "1800000000", server: "os_asia" }),
      })
    );
    expect(response.status).toBe(200);
    expect(upstreamRequests).toHaveLength(1);
  });

  it("rejects incomplete HoYoLAB credentials before upstream fetch", async () => {
    const fetchMock = captureOutboundRequests();

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
    const fetchMock = captureOutboundRequests();

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
    const fetchMock = captureOutboundRequests();

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
    const fetchMock = captureOutboundRequests();

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
    const response = await exports.default.fetch(
      "https://example.com/api/missing"
    );

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
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, must-revalidate"
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  it("does not propagate the static asset /index.html redirect for the root route", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/"),
      fakeAssetEnv()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, must-revalidate"
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
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
    expect(isStaticAssetRequest("/good/genshin_scanner_data.json")).toBe(true);
    expect(isStaticAssetRequest("/favicon.svg")).toBe(true);
    expect(isStaticAssetRequest("/account/cloud-backup")).toBe(false);
    expect(isStaticAssetRequest("/team-comp/damage")).toBe(false);
  });
});

function captureOutboundRequests() {
  const requests = vi.fn<(request: UpstreamRequest) => void>();
  network.use(
    http.all("*", ({ request }) => {
      requests(request);
      return HttpResponse.json({});
    })
  );
  return requests;
}

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
