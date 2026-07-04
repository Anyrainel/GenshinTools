/**
 * HoYoLAB / 米游社 Battle Chronicle probe.
 *
 * Run locally to verify the request/signing logic works against a real
 * account before updating the Cloudflare Worker proxy.
 *
 *   # CN (国服 / Bilibili)
 *   CN_UID=12345678 \
 *   CN_COOKIE="ltuid_v2=...; ltmid_v2=...; ltoken_v2=..." \
 *   npx tsx scripts/hoyolab-probe.ts cn
 *
 *   # Overseas (America / Europe / Asia / TW-HK-MO)
 *   OS_UID=800000000 \
 *   OS_COOKIE="ltuid_v2=...; ltmid_v2=...; ltoken_v2=..." \
 *   npx tsx scripts/hoyolab-probe.ts os
 *
 * The script will call /character/list and, if that succeeds, /character/detail
 * for the first 8 returned characters. Responses are written to
 * tmp_ysh/hoyolab-<region>-<endpoint>.json for inspection.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

// Signing constants mirror worker/index.ts. Refresh with
// `npm run check:hoyolab`.
const SALTS = {
  cn: "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs",
  os: "6s25p5ox5y14umn1p61aqyyvbvvl3lrt",
} as const;

const BASES = {
  cn: "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api",
  os: "https://sg-public-api.hoyolab.com/event/game_record/genshin/api",
} as const;

const APP_VERSION = {
  cn: "2.11.1",
  os: "1.5.0",
} as const;

type Region = "cn" | "os";

function uidToServer(uid: string): string {
  const prefix = uid[0];
  switch (prefix) {
    case "1":
    case "2":
    case "3":
      return "cn_gf01";
    case "5":
      return "cn_qd01";
    case "6":
      return "os_usa";
    case "7":
      return "os_euro";
    case "8":
      return "os_asia";
    case "9":
      return "os_cht";
    default:
      throw new Error(`Unknown UID prefix: ${prefix}`);
  }
}

function md5(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

function randStr(len: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** DS v1 — used by OS web client. */
function dsOs(): string {
  const salt = SALTS.os;
  const t = Math.floor(Date.now() / 1000);
  const r = randStr(6);
  const h = md5(`salt=${salt}&t=${t}&r=${r}`);
  return `${t},${r},${h}`;
}

/** DS v2 — used by CN web client. Incorporates body and query. */
function dsCn(body: unknown, query: Record<string, string> | null): string {
  const salt = SALTS.cn;
  const t = Math.floor(Date.now() / 1000);
  const r = 100001 + Math.floor(Math.random() * 100000);
  const b = body ? JSON.stringify(body) : "";
  const q = query
    ? Object.keys(query)
        .sort()
        .map((k) => `${k}=${query[k]}`)
        .join("&")
    : "";
  const h = md5(`salt=${salt}&t=${t}&r=${r}&b=${b}&q=${q}`);
  return `${t},${r},${h}`;
}

async function call(
  region: Region,
  path: string,
  body: unknown,
  cookie: string
): Promise<{ status: number; json: any }> {
  const url = `${BASES[region]}/${path}`;
  const headers: Record<string, string> = {
    "x-rpc-app_version": APP_VERSION[region],
    "x-rpc-client_type": "5",
    "x-rpc-language": "en-us",
    "Content-Type": "application/json",
    Cookie: cookie,
    "User-Agent":
      region === "cn"
        ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) miHoYoBBS/2.11.1"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer:
      region === "cn"
        ? "https://webstatic.mihoyo.com/"
        : "https://act.hoyolab.com/",
    Origin:
      region === "cn"
        ? "https://webstatic.mihoyo.com"
        : "https://act.hoyolab.com",
    DS: region === "cn" ? dsCn(body, null) : dsOs(),
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _rawText: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

async function main() {
  const region = (process.argv[2] as Region) || "cn";
  if (region !== "cn" && region !== "os") {
    console.error("Usage: tsx scripts/hoyolab-probe.ts <cn|os>");
    process.exit(1);
  }

  const uid = process.env[`${region.toUpperCase()}_UID`];
  const cookie = process.env[`${region.toUpperCase()}_COOKIE`];
  if (!uid || !cookie) {
    console.error(
      `Set ${region.toUpperCase()}_UID and ${region.toUpperCase()}_COOKIE env vars.`
    );
    process.exit(1);
  }

  const server = uidToServer(uid);
  console.log(`[probe] region=${region} uid=${uid} server=${server}`);

  mkdirSync("tmp_ysh", { recursive: true });

  // Step 1: character/list
  console.log("[probe] POST character/list");
  const listBody = { role_id: uid, server };
  const list = await call(region, "character/list", listBody, cookie);
  console.log(
    `  status=${list.status} retcode=${list.json?.retcode} message=${list.json?.message}`
  );
  writeFileSync(
    `tmp_ysh/hoyolab-${region}-list.json`,
    JSON.stringify(list.json, null, 2)
  );

  const avatars = list.json?.data?.list;
  if (!Array.isArray(avatars) || avatars.length === 0) {
    console.log("[probe] no characters returned, stopping");
    return;
  }
  console.log(`  got ${avatars.length} characters`);

  // Step 2: character/detail for first 8
  const ids = avatars.slice(0, 8).map((a: any) => a.id);
  console.log(`[probe] POST character/detail ids=${ids.join(",")}`);
  const detailBody = { character_ids: ids, role_id: uid, server };
  const detail = await call(region, "character/detail", detailBody, cookie);
  console.log(
    `  status=${detail.status} retcode=${detail.json?.retcode} message=${detail.json?.message}`
  );
  writeFileSync(
    `tmp_ysh/hoyolab-${region}-detail.json`,
    JSON.stringify(detail.json, null, 2)
  );

  console.log("[probe] done. See tmp_ysh/hoyolab-*.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
