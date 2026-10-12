import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function relatedTestArguments(files) {
  if (!files.length) return null;
  const length = files.reduce((total, file) => total + file.length + 3, 0);
  // Large commits validate everything, avoiding Windows' native command limit.
  return files.length > 128 || length > 16_000
    ? ["run"]
    : ["related", "--run", ...files];
}

export function runRelatedTests(run = spawnSync) {
  const staged = run("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"], { encoding: "utf8" });
  if (staged.status !== 0) return staged.status || 1;
  const files = staged.stdout.split("\0").filter(file => /\.tsx?$/.test(file));
  const args = relatedTestArguments(files);
  if (!args) return 0;
  const result = run(process.execPath, [path.resolve("node_modules/vitest/vitest.mjs"), ...args], { stdio: "inherit" });
  return result.status ?? 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = runRelatedTests();
}
