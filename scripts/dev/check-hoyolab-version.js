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
 *   OS: github.com/seriaati/genshin.py     (constants.py + utility/ds.py)
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
    constantsUrl:
      "https://raw.githubusercontent.com/seriaati/genshin.py/master/genshin/constants.py",
    dsUrl:
      "https://raw.githubusercontent.com/seriaati/genshin.py/master/genshin/utility/ds.py",
    parseSalt: (text) =>
      text.match(/types\.Region\.CHINESE:\s*"([^"]+)"/)?.[1],
    parseVersion: (text) =>
      text.match(
        /region == types\.Region\.CHINESE:[\s\S]*?"x-rpc-app_version":\s*"([^"]+)"/
      )?.[1],
  },
  os: {
    constantsUrl:
      "https://raw.githubusercontent.com/seriaati/genshin.py/master/genshin/constants.py",
    dsUrl:
      "https://raw.githubusercontent.com/seriaati/genshin.py/master/genshin/utility/ds.py",
    parseSalt: (text) =>
      text.match(/types\.Region\.OVERSEAS:\s*"([^"]+)"/)?.[1],
    parseVersion: (text) =>
      text.match(
        /region == types\.Region\.OVERSEAS:[\s\S]*?"x-rpc-app_version":\s*"([^"]+)"/
      )?.[1],
  },
};

// Read our local values

function readLocal(filePath) {
  const src = readFileSync(filePath, "utf-8");
  // Match the Worker app-version block: cn: "x.y.z"
  const cnVersion = src.match(/APP_VERSION\s*=\s*\{[^}]*cn:\s*"([^"]+)"/s)?.[1];
  const osVersion = src.match(/APP_VERSION\s*=\s*\{[^}]*os:\s*"([^"]+)"/s)?.[1];
  // Match the Worker salt block: cn: "..."
  const cnSalt = src.match(/SALTS\s*=\s*\{[^}]*cn:\s*"([^"]+)"/s)?.[1];
  const osSalt = src.match(/SALTS\s*=\s*\{[^}]*os:\s*"([^"]+)"/s)?.[1];
  return { cnVersion, cnSalt, osVersion, osSalt };
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

// Helper to check and fix a region
async function checkRegion(region, label, local, fix) {
  const cfg = UPSTREAM[region];
  const [constantsText, dsText] = await Promise.all([
    fetchText(cfg.constantsUrl),
    fetchText(cfg.dsUrl),
  ]);
  const upstreamVersion = cfg.parseVersion(dsText);
  const upstreamSalt = cfg.parseSalt(constantsText);

  let regionIssues = false;

  const localVersion = region === "cn" ? local.cnVersion : local.osVersion;
  const localSalt = region === "cn" ? local.cnSalt : local.osSalt;

  if (upstreamVersion && upstreamVersion !== localVersion) {
    console.log(
      `  ⚠ ${label} app_version outdated: ours=${localVersion} upstream=${upstreamVersion}`
    );
    regionIssues = true;
    if (fix) {
      applyFix(WORKER_PATH, localVersion, upstreamVersion);
      applyFix(PROBE_PATH, localVersion, upstreamVersion);
      if (region === "cn") {
        applyFix(WORKER_PATH, `miHoYoBBS/${localVersion}`, `miHoYoBBS/${upstreamVersion}`);
        applyFix(PROBE_PATH, `miHoYoBBS/${localVersion}`, `miHoYoBBS/${upstreamVersion}`);
      }
      console.log(`  ✓ Fixed ${label} app_version in worker + probe`);
    }
  } else if (upstreamVersion) {
    console.log(`  ✓ ${label} app_version up-to-date (${localVersion})`);
  } else {
    console.log(`  ? Could not parse upstream ${label} version (format changed?)`);
  }

  if (upstreamSalt && upstreamSalt !== localSalt) {
    console.log(
      `  ⚠ ${label} salt outdated: ours=${localSalt} upstream=${upstreamSalt}`
    );
    regionIssues = true;
    if (fix) {
      applyFix(WORKER_PATH, localSalt, upstreamSalt);
      applyFix(PROBE_PATH, localSalt, upstreamSalt);
      console.log(`  ✓ Fixed ${label} salt in worker + probe`);
    }
  } else if (upstreamSalt) {
    console.log(`  ✓ ${label} salt up-to-date`);
  }

  return regionIssues;
}

// Main

async function main() {
  const fix = process.argv.includes("--fix");
  const local = readLocal(WORKER_PATH);
  let hasIssues = false;

  console.log("[hoyolab-version] Checking CN upstream (genshin.py)...");
  try {
    const cnIssues = await checkRegion("cn", "CN", local, fix);
    if (cnIssues) hasIssues = true;
  } catch (err) {
    console.log(`  ⏭ Skipped CN (network error: ${err.message})`);
  }

  console.log("[hoyolab-version] Checking OS upstream (genshin.py)...");
  try {
    const osIssues = await checkRegion("os", "OS", local, fix);
    if (osIssues) hasIssues = true;
  } catch (err) {
    console.log(`  ⏭ Skipped OS (network error: ${err.message})`);
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
