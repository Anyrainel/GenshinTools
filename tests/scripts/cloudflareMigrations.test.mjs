import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCloudflareMigrations } from "../../scripts/dev/apply-cloudflare-migrations.js";

const log = { info() {}, error() {} };

test("local builds, other CI, and preview branches never invoke remote migrations", () => {
  for (const env of [
    {},
    { CI: "true" },
    { WORKERS_CI_BRANCH: "main" },
    { WORKERS_CI: "1", WORKERS_CI_BRANCH: "feature/feedback" },
  ]) {
    assert.equal(applyCloudflareMigrations({
      env,
      log,
      run() { throw new Error("Must not contact D1"); },
    }), 0);
  }
});

test("Cloudflare builds with an unknown branch fail without contacting D1", () => {
  assert.equal(applyCloudflareMigrations({
    env: { WORKERS_CI: "1" },
    log,
    run() { throw new Error("Must not contact D1"); },
  }), 1);
});

test("main uses the pinned Wrangler, production binding, source config and CI confirmation", () => {
  let calls = 0;
  const env = { WORKERS_CI: "1", WORKERS_CI_BRANCH: "main", CI: "false" };
  assert.equal(applyCloudflareMigrations({
    env,
    log,
    run(command, args, options) {
      calls++;
      assert.equal(command, process.execPath);
      assert.match(args[0], /node_modules[\\/]wrangler[\\/]bin[\\/]wrangler\.js$/);
      assert.deepEqual(args.slice(1, 7), ["d1", "migrations", "apply", "BACKUP_DB", "--remote", "--config"]);
      assert.match(args[7], /[\\/]wrangler\.jsonc$/);
      assert.equal(options.env.CI, "true");
      assert.equal(options.env.WORKERS_CI_BRANCH, "main");
      assert.equal(options.stdio, "inherit");
      return { status: 0 };
    },
  }), 0);
  assert.equal(calls, 1);
  assert.equal(env.CI, "false");
});

test("migration errors, denied permissions, or process launch errors stop publishing", () => {
  for (const result of [{ status: 1 }, { status: 2 }, { status: null }, { error: new Error("spawn failed") }]) {
    assert.notEqual(applyCloudflareMigrations({
      env: { WORKERS_CI: "1", WORKERS_CI_BRANCH: "main" },
      log,
      run: () => result,
    }), 0);
  }
});
