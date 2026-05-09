import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`Worker build output check failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const clientDir = path.resolve("dist/client");
const workerDir = path.resolve("dist/ggartifact");
const workerConfigPath = path.join(workerDir, "wrangler.json");
const workerBundlePath = path.join(workerDir, "index.js");
const clientIndexPath = path.join(clientDir, "index.html");

assert(existsSync(clientDir), "dist/client is missing");
assert(existsSync(clientIndexPath), "dist/client/index.html is missing");
assert(existsSync(workerDir), "dist/ggartifact is missing");
assert(existsSync(workerConfigPath), "dist/ggartifact/wrangler.json is missing");
assert(existsSync(workerBundlePath), "dist/ggartifact/index.js is missing");

const workerConfig = JSON.parse(readFileSync(workerConfigPath, "utf8"));

assert(
  workerConfig.main === "index.js",
  "generated Wrangler config must point at bundled index.js"
);
assert(
  workerConfig.assets?.directory === "../client",
  "generated Wrangler config must serve dist/client assets"
);
assert(
  workerConfig.assets?.not_found_handling === "none",
  "generated Wrangler config must let the Worker route SPA fallbacks and static 404s"
);
assert(
  Array.isArray(workerConfig.assets?.run_worker_first) &&
    workerConfig.assets.run_worker_first.includes("/*") &&
    workerConfig.assets.run_worker_first.includes("!/assets/*"),
  "generated Wrangler config must route SPA/API paths through the Worker while excluding static asset paths"
);

console.log("Worker build output check passed.");
