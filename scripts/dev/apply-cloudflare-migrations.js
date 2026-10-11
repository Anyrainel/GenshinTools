import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// npm runs postbuild only after a successful build. Workers Builds then runs
// its deploy command, so a migration failure here prevents publishing.
export function applyCloudflareMigrations({
  env = process.env,
  run = spawnSync,
  log = console,
} = {}) {
  if (env.WORKERS_CI !== "1") {
    log.info("D1 migrations skipped: not a Cloudflare Workers build.");
    return 0;
  }
  if (!env.WORKERS_CI_BRANCH) {
    log.error("D1 migrations stopped: Workers build branch is missing.");
    return 1;
  }
  if (env.WORKERS_CI_BRANCH !== "main") {
    log.info("D1 migrations skipped: not the production main branch.");
    return 0;
  }

  log.info("Applying pending production D1 migrations before deployment...");
  const result = run(
    process.execPath,
    [
      fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
      "d1",
      "migrations",
      "apply",
      "BACKUP_DB",
      "--remote",
      "--config",
      fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url)),
    ],
    { stdio: "inherit", env: { ...env, CI: "true" } }
  );
  if (result.error || result.status !== 0) {
    log.error(
      "D1 migration failed; deployment stopped. Check the migration output and the build API token's Account > D1 > Edit permission."
    );
    return result.status || 1;
  }
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = applyCloudflareMigrations();
}
