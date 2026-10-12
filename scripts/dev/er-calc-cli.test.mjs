import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

test("ER CLI accepts current timelines and rejects unsupported modes", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "er-cli-"));
  const input = path.join(directory, "input.json");
  writeFileSync(
    input,
    JSON.stringify({
      team: [{ id: "kaeya", element: "Cryo", burstCost: 30 }],
      timeline: {
        actions: [
          {
            char: "kaeya",
            action: "grantEnergy",
            energyGrants: { kaeya: { flat: 30 } },
          },
          { char: "kaeya", action: "Q" },
        ],
        periodic: [],
      },
      options: { calcMode: "zero-energy-start" },
    })
  );
  const run = (...args) =>
    spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/er_calc_cli.ts", ...args],
      { encoding: "utf8" }
    );
  try {
    const valid = run("run-json", input);
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout)[0].erNeeded, 100);
    const invalid = run("run-json", input, "--particle-mode", "min");
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /expected or max/);
    const retired = run("presets");
    assert.equal(retired.status, 1);
    assert.match(retired.stderr, /retired/);
  } finally {
    rmSync(input);
    rmdirSync(directory);
  }
});
