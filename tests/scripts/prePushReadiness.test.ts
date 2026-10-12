import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Execute the actual hook against a disposable repository; never push remotely.
const hook = readFileSync(path.resolve(".husky/pre-push"), "utf8").replace(
  /\r\n/g,
  "\n"
);
const zero = "0".repeat(40);
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))
);
let repo: string;
let older: string;
let head: string;

function git(...args: string[]) {
  const result = spawnSync("git", args, {
    cwd: repo,
    env: cleanEnv,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || String(result.error));
  }
  return result.stdout.trim();
}

function ref(sha: string, name = "main") {
  return `refs/heads/${name} ${sha} refs/heads/${name} ${older}\n`;
}

function runHook(input: string, readinessBody = "return 0") {
  return spawnSync(
    "sh",
    [
      "-c",
      `npm() {
        echo "CHECK:$*"
        if [ "$2" = "check" ]; then
          ${readinessBody}
        fi
        return 0
      }
      node() { return 0; }
      ${hook}`,
    ],
    { cwd: repo, env: cleanEnv, input, encoding: "utf8" }
  );
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), "genshintools-pre-push-"));
  git("init", "--quiet");
  git("config", "user.email", "hook-test@example.invalid");
  git("config", "user.name", "Hook Test");
  git("config", "core.hooksPath", "disabled-hooks");
  writeFileSync(path.join(repo, "entity.txt"), "unimplemented\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "Old incomplete entity");
  older = git("rev-parse", "HEAD");
  writeFileSync(path.join(repo, "entity.txt"), "implemented\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "Implement entity");
  head = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", older);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("pre-push full validation", () => {
  it("checks a clean pushed HEAD", () => {
    const result = runHook(ref(head));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("CHECK:run check");
  });

  it("rejects an older pushed commit despite a fully implemented checkout", () => {
    const result = runHook(ref(older, "old-branch"));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("not the checked-out HEAD");
    expect(result.stdout).not.toContain("CHECK:");
  });

  it("rejects mixed refs when only one matches HEAD", () => {
    const result = runHook(ref(head) + ref(older, "old-branch"));
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("CHECK:");
  });

  it.each(["unstaged", "staged", "untracked"])(
    "rejects %s implementation changes that could mask the committed state",
    (state) => {
      writeFileSync(
        path.join(repo, state === "untracked" ? "new-entity.txt" : "entity.txt"),
        "local implementation\n"
      );
      if (state === "staged") git("add", ".");
      const result = runHook(ref(head));
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("pending changes");
      expect(result.stdout).not.toContain("CHECK:");
    }
  );

  it("propagates validation failures", () => {
    const result = runHook(ref(head), "return 1");
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("Checking Ley Line");
  });

  it("rejects checkout edits made during validation", () => {
    const result = runHook(ref(head), "echo changed > entity.txt");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("pending changes");
  });

  it("rejects changing HEAD during validation", () => {
    const result = runHook(ref(head), `git update-ref HEAD ${older}`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Push blocked:");
  });

  it("allows deletion alongside a checked HEAD", () => {
    const result = runHook(ref(zero, "obsolete") + ref(head));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("CHECK:run check");
  });

  it("allows deletion-only pushes without checking unrelated local changes", () => {
    writeFileSync(path.join(repo, "entity.txt"), "pending\n");
    const result = runHook(ref(zero, "obsolete"));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("CHECK:");
  });

  it("allows deletion-only pushes even without a local HEAD", () => {
    git("symbolic-ref", "HEAD", "refs/heads/unborn");
    const result = runHook(ref(zero, "obsolete"));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("CHECK:");
  });
});
