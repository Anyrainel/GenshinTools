import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

test("superseded source namespaces stay removed", () => {
  for (const folder of [
    "data", "presets", "domain/account", "services/account",
    "providers/scanner-manager", "services/scanner-manager",
    "components/account", "components/account-data", "components/team-analysis",
    "pages/account", "pages/account-data", "pages/team-analysis",
    "generated/hsr-reference", "generated/hsr-assets",
  ]) {
    assert.equal(existsSync(new URL(`../src/${folder}`, import.meta.url)), false,
      `${folder} has been superseded; use docs/architecture.md`);
  }
});
