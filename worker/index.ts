import { type AppEnv, handleAuthRequest } from "./auth";
import {
  type BackupEnv,
  handleBackupRequest,
  runBackupCleanup,
} from "./backup";
import { type FeedbackEnv, handleFeedbackRequest } from "./feedback";

const ENKA_BASE_URL = "https://enka.network/api";

const HOYOLAB_BASES = {
  os: "https://sg-public-api.hoyolab.com/event/game_record/genshin/api",
  cn: "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api",
} as const;

// HoYoLAB / 米游社 signing constants are compatibility values, not app-owned
// secrets. Refresh with `npm run check:hoyolab`.
//
// Sources:
// - CN x4 salt/version: Womsxd/MihoyoBBSTools `setting.py`
// - OS salt/version and DS algorithms: seriaati/genshin.py `constants.py`
//   and `utility/ds.py`
const HOYOLAB_SALTS = {
  os: "6s25p5ox5y14umn1p61aqyyvbvvl3lrt",
  cn: "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs",
} as const;

const HOYOLAB_APP_VERSION = {
  os: "1.5.0",
  cn: "2.109.0",
} as const;

const HOYOLAB_SERVER_BY_UID_PREFIX = {
  "1": "cn_gf01",
  "2": "cn_gf01",
  "3": "cn_gf01",
  "5": "cn_qd01",
  "6": "os_usa",
  "7": "os_euro",
  "8": "os_asia",
  "9": "os_cht",
} as const;

const ENKA_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const HOYOLAB_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-hoyolab-ltuid-v2, x-hoyolab-ltmid-v2, x-hoyolab-ltoken-v2",
  "Access-Control-Max-Age": "86400",
};

const STATIC_ASSET_PREFIXES = [
  "/artifact/",
  "/assets/",
  "/character/",
  "/element/",
  "/enemy/",
  "/food/",
  "/good/",
  "/weapon/",
  "/weapontype/",
] as const;

type HoyolabRegion = keyof typeof HOYOLAB_BASES;
type HoyolabEndpoint = "character/list" | "character/detail";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/backup/v1")) {
      return handleBackupRequest(request, url, env as BackupEnv);
    }
    if (url.pathname.startsWith("/api/auth")) {
      return handleAuthRequest(request, url, env as AppEnv);
    }
    if (url.pathname.startsWith("/api/feedback/v1")) {
      return handleFeedbackRequest(request, url, env as FeedbackEnv);
    }
    if (url.pathname.startsWith("/api/enka/")) {
      return handleEnkaProxy(request, url);
    }
    if (url.pathname === "/api/enka") {
      const enkaUrl = new URL(request.url);
      enkaUrl.pathname = "/api/enka/";
      return handleEnkaProxy(request, enkaUrl);
    }
    if (url.pathname.startsWith("/api/hoyolab/")) {
      return handleHoyolabProxy(request, url);
    }
    if (url.pathname === "/api/hoyolab") {
      return json(
        { error: "path_too_short", usage: "/api/hoyolab/<os|cn>/<endpoint>" },
        400,
        HOYOLAB_CORS_HEADERS
      );
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not_found" }, 404);
    }
    return handleSiteRequest(request, url, env);
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runBackupCleanup(env as BackupEnv));
  },
};

async function handleSiteRequest(
  request: Request,
  url: URL,
  env: Env
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return plainNotFound();
  }

  if (!isStaticAssetRequest(url.pathname)) {
    // Serve app routes explicitly so auth callbacks and deep links cannot be
    // rewritten by the asset binding before React Router handles them.
    return handleSpaIndexRequest(request, env);
  }

  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }
  return plainNotFound();
}

async function handleSpaIndexRequest(
  request: Request,
  env: Env
): Promise<Response> {
  // Cloudflare Static Assets canonicalizes /index.html back to /. Since /
  // routes through this Worker, asking the asset binding for /index.html would
  // preserve a 307 Location: / response and create a redirect loop.
  const indexUrl = new URL("/", request.url);
  const indexRequest = new Request(indexUrl, request);
  const response = await env.ASSETS.fetch(indexRequest);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-cache, must-revalidate");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function isStaticAssetRequest(pathname: string): boolean {
  if (
    pathname.startsWith("/@") ||
    pathname.startsWith("/src/") ||
    pathname.startsWith("/node_modules/") ||
    pathname.startsWith("/__vite")
  ) {
    return true;
  }

  if (STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  const lastSegment = pathname.split("/").pop() ?? "";
  return /\.[A-Za-z0-9]{1,16}$/.test(lastSegment);
}

function plainNotFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handleEnkaProxy(request: Request, url: URL): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: ENKA_CORS_HEADERS });
  }

  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: ENKA_CORS_HEADERS,
    });
  }

  const targetPath = stripPrefix(url.pathname, "/api/enka/");
  const enkaUid = parseEnkaUidPath(targetPath);
  if (!enkaUid) {
    return json({ error: "path_not_allowed" }, 404, ENKA_CORS_HEADERS);
  }
  const targetUrl = `${ENKA_BASE_URL}/uid/${enkaUid}${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "GenshinTools/1.0 (https://ggartifact.com)",
        Accept: "application/json",
      },
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...ENKA_CORS_HEADERS,
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
        ...(response.headers.get("Cache-Control")
          ? { "Cache-Control": response.headers.get("Cache-Control") ?? "" }
          : {}),
      },
    });
  } catch (error) {
    console.error("Enka proxy error:", error);
    return json(
      { error: "Failed to fetch from Enka.Network" },
      502,
      ENKA_CORS_HEADERS
    );
  }
}

async function handleHoyolabProxy(
  request: Request,
  url: URL
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: HOYOLAB_CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, HOYOLAB_CORS_HEADERS);
  }

  const segments = stripPrefix(url.pathname, "/api/hoyolab/")
    .split("/")
    .filter(Boolean);
  if (segments.length < 2) {
    return json(
      { error: "path_too_short", usage: "/api/hoyolab/<os|cn>/<endpoint>" },
      400,
      HOYOLAB_CORS_HEADERS
    );
  }

  const region = segments[0];
  if (!isHoyolabRegion(region)) {
    return json({ error: "invalid_region", region }, 400, HOYOLAB_CORS_HEADERS);
  }

  const subPath = segments.slice(1).join("/");
  if (!isHoyolabEndpoint(subPath)) {
    return json({ error: "path_not_allowed" }, 404, HOYOLAB_CORS_HEADERS);
  }

  const cookieResult = buildHoyolabCookie(request);
  if (!cookieResult.ok) {
    return json(cookieResult.body, 400, HOYOLAB_CORS_HEADERS);
  }

  const bodyText = await request.text();
  if (!isValidHoyolabRequestBody(region, subPath, bodyText)) {
    return json({ error: "invalid_body" }, 400, HOYOLAB_CORS_HEADERS);
  }
  const targetUrl = `${HOYOLAB_BASES[region]}/${subPath}${url.search}`;
  const ds = region === "os" ? dsOs() : dsCn(bodyText, url.searchParams);

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rpc-app_version": HOYOLAB_APP_VERSION[region],
        "x-rpc-client_type": "5",
        "x-rpc-language": "en-us",
        DS: ds,
        Cookie: cookieResult.cookie,
        Referer:
          region === "cn"
            ? "https://webstatic.mihoyo.com/"
            : "https://act.hoyolab.com/",
        Origin:
          region === "cn"
            ? "https://webstatic.mihoyo.com"
            : "https://act.hoyolab.com",
        "User-Agent":
          region === "cn"
            ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.109.0"
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: bodyText,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...HOYOLAB_CORS_HEADERS,
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    return json(
      { error: "upstream_fetch_failed", detail: String(error) },
      502,
      HOYOLAB_CORS_HEADERS
    );
  }
}

const HOYOLAB_CREDENTIAL_HEADERS = [
  { header: "x-hoyolab-ltuid-v2", cookie: "ltuid_v2" },
  { header: "x-hoyolab-ltmid-v2", cookie: "ltmid_v2" },
  { header: "x-hoyolab-ltoken-v2", cookie: "ltoken_v2" },
] as const;

function buildHoyolabCookie(request: Request):
  | { ok: true; cookie: string }
  | {
      ok: false;
      body:
        | { error: "missing_credentials"; missing: string[] }
        | { error: "invalid_credentials"; fields: string[] };
    } {
  const entries = HOYOLAB_CREDENTIAL_HEADERS.map(({ header, cookie }) => ({
    cookie,
    value: request.headers.get(header)?.trim() || "",
  }));
  const missing = entries
    .filter((entry) => !entry.value)
    .map((entry) => entry.cookie);
  if (missing.length > 0) {
    return { ok: false, body: { error: "missing_credentials", missing } };
  }

  const invalid = entries
    .filter((entry) => /[\r\n;]/.test(entry.value))
    .map((entry) => entry.cookie);
  if (invalid.length > 0) {
    return {
      ok: false,
      body: { error: "invalid_credentials", fields: invalid },
    };
  }

  return {
    ok: true,
    cookie: entries.map((entry) => `${entry.cookie}=${entry.value}`).join("; "),
  };
}

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function parseEnkaUidPath(value: string): string | null {
  const segments = value.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "uid") return null;
  return /^\d{9}$/.test(segments[1]) ? segments[1] : null;
}

function isHoyolabRegion(value: string | undefined): value is HoyolabRegion {
  return value === "os" || value === "cn";
}

function isHoyolabEndpoint(value: string): value is HoyolabEndpoint {
  return value === "character/list" || value === "character/detail";
}

function isValidHoyolabRequestBody(
  region: HoyolabRegion,
  endpoint: HoyolabEndpoint,
  bodyText: string
): boolean {
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return false;
  }
  if (!isRecord(body)) return false;
  if (
    !isUid(body.role_id) ||
    typeof body.server !== "string" ||
    !isExpectedHoyolabServer(region, body.role_id, body.server)
  ) {
    return false;
  }
  if (endpoint === "character/list") {
    return !("character_ids" in body);
  }
  return (
    Array.isArray(body.character_ids) &&
    body.character_ids.length > 0 &&
    body.character_ids.length <= 30 &&
    body.character_ids.every(
      (id) => Number.isInteger(id) && id > 0 && id < 1_000_000_000
    )
  );
}

function isUid(value: unknown): value is string {
  return typeof value === "string" && /^\d{9,10}$/.test(value);
}

function isExpectedHoyolabServer(
  region: HoyolabRegion,
  uid: string,
  server: string
): boolean {
  const expectedServer =
    HOYOLAB_SERVER_BY_UID_PREFIX[
      uid[0] as keyof typeof HOYOLAB_SERVER_BY_UID_PREFIX
    ];
  if (!expectedServer || server !== expectedServer) return false;
  return region === "cn"
    ? server === "cn_gf01" || server === "cn_qd01"
    : server === "os_usa" ||
        server === "os_euro" ||
        server === "os_asia" ||
        server === "os_cht";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(
  obj: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Minimal MD5 (public domain, adapted) — Workers' crypto.subtle doesn't expose MD5.
function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const msg = new Uint8Array(bytes.length);
  msg.set(bytes);
  const bitLen = msg.length * 8;

  const padLen = (56 - ((msg.length + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(msg.length + 1 + padLen + 8);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // prettier-ignore
  const K = new Int32Array([
    -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426,
    -1473231341, -45705983, 1770035416, -1958414417, -42063, -1990404162,
    1804603682, -40341101, -1502002290, 1236535329, -165796510, -1069501632,
    643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
    568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784,
    1735328473, -1926607734, -378558, -2022574463, 1839030562, -35309556,
    -1530992060, 1272893353, -155497632, -1094730640, 681279174, -358537222,
    -722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
    -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606,
    -1051523, -2054922799, 1873313359, -30611744, -1560198380, 1309151649,
    -145523070, -1120210379, 718787259, -343485551,
  ]);
  // prettier-ignore
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ];

  const rot = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  const M = new Int32Array(16);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(offset + i * 4, true);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + rot(F, S[i])) | 0;
    }
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  const toLEHex = (n: number) =>
    [0, 8, 16, 24]
      .map((s) => ((n >>> s) & 0xff).toString(16).padStart(2, "0"))
      .join("");
  return toLEHex(a0) + toLEHex(b0) + toLEHex(c0) + toLEHex(d0);
}

function randLetters(n: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < n; i++) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive must be a positive integer");
  }

  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const value = new Uint32Array(1);

  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return value[0] % maxExclusive;
}

function dsOs(): string {
  const t = Math.floor(Date.now() / 1000);
  const r = randLetters(6);
  const h = md5Hex(`salt=${HOYOLAB_SALTS.os}&t=${t}&r=${r}`);
  return `${t},${r},${h}`;
}

function dsCn(bodyText: string, query: URLSearchParams): string {
  const t = Math.floor(Date.now() / 1000);
  const r = 100001 + randomInt(100000);
  const q = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const h = md5Hex(
    `salt=${HOYOLAB_SALTS.cn}&t=${t}&r=${r}&b=${bodyText}&q=${q}`
  );
  return `${t},${r},${h}`;
}
