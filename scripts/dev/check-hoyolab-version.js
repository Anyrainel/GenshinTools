#!/usr/bin/env node
/**
 * Check whether the miHoYo API version/salt values in our proxy are still
 * up-to-date by comparing against well-maintained upstream references.
 *
 * Usage:
 *   node scripts/dev/check-hoyolab-version.js          # check only
 *   node scripts/dev/check-hoyolab-version.js --fix     # auto-update files
 *
 * Called automatically from the pre-push hook.
 *
 * Upstream sources:
 *   CN: github.com/Womsxd/MihoyoBBSTools  (setting.py)
 *   OS: github.com/seriaati/genshin.py     (genshin/utility/ds.py)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

const WORKER_PATH = resolve(ROOT, "worker/index.ts");
const PROBE_PATH = resolve(ROOT, "scripts/hoyolab-probe.ts");

// Upstream reference URLs (raw GitHub)

const UPSTREAM = {
  cn: {
    url: "https://raw.githubusercontent.com/Womsxd/MihoyoBBSTools/master/setting.py",
    parseVersion: (text) => text.match(/mihoyobbs_version\s*=\s*"([^"]+)"/)?.[1],
    parseSaltX4: (text) =>
      text.match(/mihoyobbs_salt_x4\s*=\s*"([^"]+)"/)?.[1],
  },
};

// Read our local values

function readLocal(filePath) {
  const src = readFileSync(filePath, "utf-8");
  // Match the Worker app-version block: cn: "x.y.z"
  const cnVersion = src.match(/APP_VERSION\s*=\s*\{[^}]*cn:\s*"([^"]+)"/s)?.[1];
  // Match the Worker salt block: cn: "..."
  const cnSalt = src.match(/SALTS\s*=\s*\{[^}]*cn:\s*"([^"]+)"/s)?.[1];
  return { cnVersion, cnSalt };
}

// Fetch with timeout

async function fetchText(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Main

async function main() {
  const fix = process.argv.includes("--fix");
  const local = readLocal(WORKER_PATH);
  let hasIssues = false;

  console.log("[hoyolab-version] Checking CN upstream (MihoyoBBSTools)...");
  try {
    const text = await fetchText(UPSTREAM.cn.url);
    const upstreamVersion = UPSTREAM.cn.parseVersion(text);
    const upstreamSalt = UPSTREAM.cn.parseSaltX4(text);

    if (upstreamVersion && upstreamVersion !== local.cnVersion) {
      console.log(
        `  ⚠ CN app_version outdated: ours=${local.cnVersion} upstream=${upstreamVersion}`
      );
      hasIssues = true;
      if (fix) {
        applyFix(WORKER_PATH, local.cnVersion, upstreamVersion);
        applyFix(PROBE_PATH, local.cnVersion, upstreamVersion);
        // Also update User-Agent strings that embed the version
        applyFix(WORKER_PATH, `miHoYoBBS/${local.cnVersion}`, `miHoYoBBS/${upstreamVersion}`);
        applyFix(PROBE_PATH, `miHoYoBBS/${local.cnVersion}`, `miHoYoBBS/${upstreamVersion}`);
        console.log("  ✓ Fixed CN app_version in worker + probe");
      }
    } else if (upstreamVersion) {
      console.log(`  ✓ CN app_version up-to-date (${local.cnVersion})`);
    } else {
      console.log("  ? Could not parse upstream CN version (format changed?)");
    }

    if (upstreamSalt && upstreamSalt !== local.cnSalt) {
      console.log(
        `  ⚠ CN salt (x4) outdated: ours=${local.cnSalt} upstream=${upstreamSalt}`
      );
      hasIssues = true;
      if (fix) {
        applyFix(WORKER_PATH, local.cnSalt, upstreamSalt);
        applyFix(PROBE_PATH, local.cnSalt, upstreamSalt);
        console.log("  ✓ Fixed CN salt in worker + probe");
      }
    } else if (upstreamSalt) {
      console.log(`  ✓ CN salt (x4) up-to-date`);
    }
  } catch (err) {
    // Network errors during pre-push should not block the push.
    console.log(`  ⏭ Skipped (network error: ${err.message})`);
    return;
  }

  if (hasIssues && !fix) {
    console.log(
      "\nRun with --fix to auto-update:\n  node scripts/dev/check-hoyolab-version.js --fix"
    );
    process.exit(1);
  }
}

function applyFix(filePath, oldValue, newValue) {
  let content = readFileSync(filePath, "utf-8");
  content = content.replaceAll(oldValue, newValue);
  writeFileSync(filePath, content);
}

main().catch((err) => {
  console.error("[hoyolab-version] Fatal:", err);
  // Don't block push on unexpected script errors
  process.exit(0);
});
