// Pulls cookies for given domains from a running Chrome with --remote-debugging-port=9222.
// Usage: node scripts/cdp-get-cookies.mjs hoyolab.com miyoushe.com
import { WebSocket } from "ws";

const domains = process.argv.slice(2);
if (domains.length === 0) {
  console.error("usage: node cdp-get-cookies.mjs <domain> [domain...]");
  process.exit(1);
}

const ver = await fetch("http://127.0.0.1:9222/json/version").then((r) =>
  r.json()
);
const wsUrl = ver.webSocketDebuggerUrl;
const ws = new WebSocket(wsUrl);

let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const thisId = ++id;
    pending.set(thisId, { resolve, reject });
    ws.send(JSON.stringify({ id: thisId, method, params }));
  });
}

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

ws.on("open", async () => {
  try {
    const { cookies } = await send("Storage.getCookies");
    const out = {};
    for (const d of domains) {
      const matched = cookies.filter(
        (c) => c.domain === d || c.domain === `.${d}` || c.domain.endsWith(`.${d}`)
      );
      out[d] = matched;
      const asHeader = matched.map((c) => `${c.name}=${c.value}`).join("; ");
      console.log(`\n=== ${d} (${matched.length} cookies) ===`);
      console.log(asHeader);
      console.log(
        "names:",
        matched.map((c) => c.name).join(", ")
      );
    }
    ws.close();
  } catch (e) {
    console.error("ERR", e);
    process.exit(2);
  }
});

ws.on("close", () => process.exit(0));
ws.on("error", (e) => {
  console.error("wserr", e);
  process.exit(3);
});
