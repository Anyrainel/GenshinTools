import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("dependency-cruiser rejects representative forbidden imports", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const config = structuredClone(
    createRequire(import.meta.url)("../.dependency-cruiser.cjs")
  );
  config.options.tsConfig.fileName = path.join(root, "tsconfig.app.json");
  const cwd = mkdtempSync(path.join(tmpdir(), "genshintools-deps-"));
  const write = (name, source) => {
    const target = path.join(cwd, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  };
  try {
    write(
      ".dependency-cruiser.cjs",
      `module.exports = ${JSON.stringify(config)};`
    );
    write("src/domain/kit.ts", 'import "react/jsx-runtime";');
    write(
      "node_modules/react/package.json",
      '{"name":"react","exports":{"./jsx-runtime":"./jsx-runtime.js"}}'
    );
    write("node_modules/react/jsx-runtime.js", "export const jsx = () => {};");
    write("node_modules/vitest/package.json", '{"name":"vitest","exports":"./dist/index.js"}');
    write("node_modules/vitest/dist/index.js", "export const it = () => {};");
    write(
      "src/ui.ts",
      'import "node:child_process"; import "../tests/helper.js"; import "./missing.js";'
    );
    write("tests/helper.js", "export const fixture = true;");
    write("src/components/ui/primitive.ts", 'import "../shared/control.ts";');
    write(
      "src/components/shared/control.ts",
      'import "../account/Feature.ts";'
    );
    write("src/components/layout/shell.ts", 'import "../account/Feature.ts";');
    write("src/components/account/Feature.ts", 'import "../builds/Other.ts";');
    write("src/components/builds/Other.ts", "export const value = true;");
    write(
      "src/lib/bad.ts",
      'import "../services/workflow.ts"; import "react/jsx-runtime";'
    );
    write("src/lib/runtime.ts", 'import "../domain/model.ts";');
    write("src/domain/model.ts", "export const value = true;");
    write(
      "src/services/workflow.ts",
      'import "../components/shared/control.ts"; import "../stores/live.ts";'
    );
    write(
      "src/stores/live.ts",
      'import "../services/workflow.ts"; import "../providers/hoyolab/secret.ts";'
    );
    write("src/providers/hoyolab/secret.ts", "export const value = true;");
    write("src/providers/bad.ts", 'import "../components/shared/control.ts"; import "cloudflare:test"; import "vitest";');
    write("src/config/bad.ts", 'import "../services/workflow.ts";');
    write("src/hooks/bad.ts", 'import "../app/entry.ts";');
    write("src/app/entry.ts", "export const value = true;");
    write("src/providers/browserWorker.ts", 'import "../../worker/index.ts";');
    write("worker/index.ts", 'import "../src/ui.ts";');
    const result = spawnSync(
      process.execPath,
      [
        path.join(
          root,
          "node_modules/dependency-cruiser/bin/dependency-cruise.mjs"
        ),
        "src",
        "worker",
        "--config",
        ".dependency-cruiser.cjs",
        "--output-type",
        "err",
      ],
      { cwd, encoding: "utf8" }
    );
    assert.ok(result.status > 0, result.stderr + result.stdout);
    const violations = result.stdout;
    assert.match(violations, /production-has-no-test-dependencies: src\/providers\/bad\.ts.*node_modules\/vitest\/dist\/index\.js/);
    for (const rule of [
      "domain-is-framework-free",
      "browser-has-no-node-builtins",
      "production-has-no-test-dependencies",
      "no-unresolved-imports",
      "worker-is-standalone",
      "ui-primitives-are-independent",
      "shared-ui-has-no-feature-or-layout-dependencies",
      "layouts-have-no-feature-dependencies",
      "feature-components-are-isolated",
      "libraries-are-leaf-utilities",
      "libraries-use-domain-contracts-only",
      "leaf-code-is-framework-free",
      "services-do-not-own-react-or-live-state",
      "stores-do-not-own-ui",
      "providers-do-not-own-ui-or-state",
      "foundations-do-not-import-application-layers",
      "composition-is-at-the-top",
      "persisted-state-cannot-see-hoyolab-auth",
      "browser-cannot-import-worker-or-tooling",
      "no-circular",
    ])
      assert.ok(violations.includes(rule), `Missing violation: ${rule}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
