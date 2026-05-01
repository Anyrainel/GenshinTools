import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const outDir = path.resolve(".wrangler/dry-run");
const wranglerBin = path.resolve(
  "node_modules/.bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler"
);

function cleanup() {
  rmSync(outDir, { recursive: true, force: true });
}

cleanup();

const result = spawnSync(
  wranglerBin,
  ["deploy", "--dry-run", "--outdir", ".wrangler/dry-run"],
  { shell: process.platform === "win32", stdio: "inherit" }
);

cleanup();

process.exit(result.status ?? 1);
