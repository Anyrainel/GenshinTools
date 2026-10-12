import assert from "node:assert/strict";
import { test } from "node:test";
import { relatedTestArguments, runRelatedTests } from "./run-related-tests.mjs";

test("large migrations use the full suite without an oversized argument list", () => {
  assert.deepEqual(relatedTestArguments(Array.from({ length: 200 }, (_, i) => `src/feature${i}.ts`)), ["run"]);
  assert.deepEqual(relatedTestArguments([`src/${"a".repeat(16_000)}.ts`]), ["run"]);
});

test("related tests receive filenames intact and failures block the commit", () => {
  for (const status of [0, 1, 7]) {
    const calls = [];
    const result = runRelatedTests((command, args) => {
      calls.push([command, args]);
      return command === "git" ? { status: 0, stdout: "src/file with spaces.ts\0docs/design.md\0src/a.tsx\0" } : { status };
    });
    assert.equal(result, status);
    assert.equal(calls[1][0], process.execPath);
    assert.deepEqual(calls[1][1].slice(1), ["related", "--run", "src/file with spaces.ts", "src/a.tsx"]);
  }
});

test("a failed Git inspection blocks and a commit without typed source needs no related tests", () => {
  assert.equal(runRelatedTests(() => ({ status: 2 })), 2);
  let calls = 0;
  assert.equal(runRelatedTests(() => { calls++; return { status: 0, stdout: "docs/design.md\0" }; }), 0);
  assert.equal(calls, 1);
});
