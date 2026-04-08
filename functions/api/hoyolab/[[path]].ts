/**
 * Cloudflare Pages Function: HoYoLAB / 米游社 Battle Chronicle proxy.
 *
 * Routes:
 *   POST /api/hoyolab/os/<path>  -> https://sg-public-api.hoyolab.com/event/game_record/genshin/api/<path>
 *   POST /api/hoyolab/cn/<path>  -> https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/<path>
 *
 * Client contract:
 *   - Method: POST
 *   - Header `x-hoyolab-cookie`: full cookie string the user pasted
 *     (e.g. "ltuid_v2=...; ltoken_v2=...")
 *   - Body: JSON payload forwarded as-is to mihoyo
 *
 * The worker signs each request with the appropriate DS header and forwards.
 * Cookies never leave the worker in logs and are not stored.
 */

const BASES = {
  os: "https://sg-public-api.hoyolab.com/event/game_record/genshin/api",
  cn: "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api",
} as const;

const SALTS = {
  os: "6s25p5ox5y14umn1p61aqyyvbvvl3lrt",
  cn: "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs",
} as const;

const APP_VERSION = {
  os: "1.5.0",
  cn: "2.11.1",
} as const;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-hoyolab-cookie",
  "Access-Control-Max-Age": "86400",
};

type Region = "os" | "cn";

// Minimal MD5 (public domain, adapted) — Workers' crypto.subtle doesn't expose MD5.
function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const msg = new Uint8Array(bytes.length);
  msg.set(bytes);
  const bitLen = msg.length * 8;

  // Pre-processing: padding
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
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** DS v1 — OS web client. */
function dsOs(): string {
  const t = Math.floor(Date.now() / 1000);
  const r = randLetters(6);
  const h = md5Hex(`salt=${SALTS.os}&t=${t}&r=${r}`);
  return `${t},${r},${h}`;
}

/** DS v2 — CN web client. Incorporates JSON body and sorted query. */
function dsCn(bodyText: string, query: URLSearchParams): string {
  const t = Math.floor(Date.now() / 1000);
  const r = 100001 + Math.floor(Math.random() * 100000);
  const q = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const h = md5Hex(`salt=${SALTS.cn}&t=${t}&r=${r}&b=${bodyText}&q=${q}`);
  return `${t},${r},${h}`;
}

type Env = Record<string, never>;

export const onRequest: PagesFunction<Env, "path"> = async (context) => {
  const { request, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const segments = Array.isArray(params.path)
    ? params.path
    : params.path
      ? [params.path]
      : [];
  if (segments.length < 2) {
    return json(
      { error: "path_too_short", usage: "/api/hoyolab/<os|cn>/<endpoint>" },
      400
    );
  }

  const region = segments[0] as Region;
  if (region !== "os" && region !== "cn") {
    return json({ error: "invalid_region", region }, 400);
  }
  const subPath = segments.slice(1).join("/");

  const cookie = request.headers.get("x-hoyolab-cookie");
  if (!cookie) {
    return json({ error: "missing_cookie" }, 400);
  }

  const bodyText = await request.text();
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BASES[region]}/${subPath}${incomingUrl.search}`;

  const ds =
    region === "os" ? dsOs() : dsCn(bodyText, incomingUrl.searchParams);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-rpc-app_version": APP_VERSION[region],
    "x-rpc-client_type": "5",
    "x-rpc-language": "en-us",
    DS: ds,
    Cookie: cookie,
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
        ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.11.1"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: bodyText,
    });
  } catch (e) {
    return json({ error: "upstream_fetch_failed", detail: String(e) }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type":
        upstream.headers.get("Content-Type") || "application/json",
    },
  });
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
