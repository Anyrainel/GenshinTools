import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkHoyolabVersions } from "./check-hoyolab-version.js";

const fixture = `const HOYOLAB_SALTS = { cn: "cn-salt", os: "os-salt" };
const HOYOLAB_APP_VERSION = { cn: "1.5.0", os: "1.5.0" };
const ua = "miHoYoBBS/1.5.0";
const unrelated = "1.5.0";
`;

function files(t, probe = fixture) {
  const directory = mkdtempSync(join(tmpdir(), "gg-hoyolab-check-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const paths = [join(directory, "worker.ts"), join(directory, "probe.ts")];
  writeFileSync(paths[0], fixture);
  writeFileSync(paths[1], probe);
  return paths;
}

function upstream(url, version = "1.5.0") {
  if (url.includes("setting.py")) {
    return `mihoyobbs_salt_x4 = "cn-salt"\nmihoyobbs_version = "${version}"`;
  }
  if (url.includes("constants.py")) return 'types.Region.OVERSEAS: "os-salt"';
  return 'if region == types.Region.OVERSEAS:\n "x-rpc-app_version": "1.5.0"';
}

test("checks both consumers and reports probe-only drift without modifying files", async (t) => {
  const paths = files(t, fixture.replace("cn-salt", "outdated"));
  const options = { paths, fetchSource: upstream, log: () => {} };
  assert.equal(await checkHoyolabVersions(options), false);
  assert.ok(readFileSync(paths[1], "utf8").includes("outdated"));
  writeFileSync(paths[1], fixture);
  assert.equal(await checkHoyolabVersions(options), true);
});

test("network and parser failures leave the check incomplete even in fix mode", async (t) => {
  const paths = files(t);
  for (const fetchSource of [
    () => { throw new Error("network unavailable"); },
    () => "upstream layout changed",
    (url) => url.includes("constants.py") ? "salt is now elsewhere" : upstream(url, "2.0.0"),
  ]) {
    assert.equal(
      await checkHoyolabVersions({ paths, fetchSource, fix: true, log: () => {} }),
      false
    );
    for (const path of paths) assert.equal(readFileSync(path, "utf8"), fixture);
  }
});

test("missing local values cannot produce a successful check", async (t) => {
  const paths = files(t, fixture.replace("HOYOLAB_SALTS", "REMOVED_SETTINGS"));
  assert.equal(
    await checkHoyolabVersions({ paths, fetchSource: upstream, log: () => {} }),
    false
  );
});

test("fix updates only the correct region and its CN user agent", async (t) => {
  const paths = files(t);
  assert.equal(
    await checkHoyolabVersions({
      paths,
      fetchSource: (url) => upstream(url, "2.0.0"),
      fix: true,
      log: () => {},
    }),
    true
  );
  for (const path of paths) {
    const updated = readFileSync(path, "utf8");
    assert.match(updated, /cn: "2.0.0", os: "1.5.0"/);
    assert.match(updated, /miHoYoBBS\/2\.0\.0/);
    assert.match(updated, /unrelated = "1.5.0"/);
  }
});
