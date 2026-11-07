#!/usr/bin/env node
/**
 * Compare Worker/probe signing constants with the current upstream references.
 * This checks constants only; endpoint and signing-logic reviews are documented
 * in docs/audits/hoyolab-upstream-2026-11-07.md.
 *
 * npm run check:hoyolab        # read-only; incomplete checks fail
 * npm run check:hoyolab:fix    # update constants in both consumers
 */

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LOCAL_PATHS = [
  resolve(ROOT, "worker/index.ts"),
  resolve(ROOT, "scripts/hoyolab-probe.ts"),
];

const UPSTREAM = {
  cn: {
    constantsUrl:
      "https://raw.githubusercontent.com/Womsxd/MihoyoBBSTools/master/setting.py",
    parseSalt: (text) =>
      text.match(/mihoyobbs_salt_x4\s*=\s*"([^"]+)"/)?.[1],
    parseVersion: (text) =>
      text.match(/mihoyobbs_version\s*=\s*"([^"]+)"/)?.[1],
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

function readSetting(source, block, region) {
  return source.match(
    new RegExp(`${block}\\s*=\\s*\\{[^}]*${region}:\\s*"([^"]+)"`, "s")
  )?.[1];
}

function replaceSetting(source, block, region, value) {
  return source.replace(
    new RegExp(`(${block}\\s*=\\s*\\{[^}]*${region}:\\s*)"[^"]+"`, "s"),
    (_match, prefix) => `${prefix}"${value}"`
  );
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.text();
}

export async function checkHoyolabVersions({
  paths = LOCAL_PATHS,
  fetchSource = fetchText,
  fix = false,
  log = console.log,
} = {}) {
  const sources = new Map(paths.map((path) => [path, readFileSync(path, "utf8")]));
  const updates = new Map(sources);
  let hasDrift = false;
  let incomplete = false;

  for (const [region, config] of Object.entries(UPSTREAM)) {
    log(`[hoyolab-version] Checking ${region.toUpperCase()} upstream...`);
    try {
      const constants = await fetchSource(config.constantsUrl);
      const ds = config.dsUrl ? await fetchSource(config.dsUrl) : constants;
      const salt = config.parseSalt(constants);
      const version = config.parseVersion(ds);
      if (!salt || !version) {
        throw new Error("Could not parse upstream salt/version; review the upstream format");
      }

      for (const [path, source] of sources) {
        const localSalt = readSetting(source, "SALTS", region);
        const localVersion = readSetting(source, "APP_VERSION", region);
        const localUaVersion = source.match(/miHoYoBBS\/([\d.]+)/)?.[1];
        if (!localSalt || !localVersion || (region === "cn" && !localUaVersion)) {
          throw new Error(`Could not parse local signing constants: ${path}`);
        }
        if (
          localSalt !== salt ||
          localVersion !== version ||
          (region === "cn" && localUaVersion !== version)
        ) {
          hasDrift = true;
          log(`  Signing constants differ: ${path}`);
          if (fix) {
            let updated = replaceSetting(updates.get(path), "SALTS", region, salt);
            updated = replaceSetting(updated, "APP_VERSION", region, version);
            if (region === "cn") {
              updated = updated.replace(/miHoYoBBS\/[\d.]+/g, `miHoYoBBS/${version}`);
            }
            updates.set(path, updated);
          }
        } else {
          log(`  Constants match: ${path}`);
        }
      }
    } catch (error) {
      incomplete = true;
      log(`  CHECK INCOMPLETE: ${error.message}`);
    }
  }

  // Do not partially update consumers when one upstream cannot be verified.
  if (fix && !incomplete) {
    for (const [path, updated] of updates) {
      if (updated === sources.get(path)) continue;
      const temporaryPath = `${path}.tmp`;
      writeFileSync(temporaryPath, updated);
      renameSync(temporaryPath, path);
      log(`  Updated: ${path}`);
    }
  }

  if (hasDrift && !fix) log("Run npm run check:hoyolab:fix to update signing constants.");
  if (!incomplete && !hasDrift) {
    log("Signing constants match; endpoint and signing-logic review is still required.");
  }
  return !incomplete && (!hasDrift || fix);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkHoyolabVersions({ fix: process.argv.includes("--fix") })
    .then((success) => {
      process.exitCode = success ? 0 : 1;
    })
    .catch((error) => {
      console.error("[hoyolab-version] Fatal:", error.message);
      process.exitCode = 1;
    });
}
