import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const root = process.cwd();
it("keeps executable source under an explicit architecture owner", () => {
  const allowed = new Set([
    "app",
    "config",
    "domain",
    "providers",
    "services",
    "lib",
    "stores",
    "contexts",
    "hooks",
    "i18n",
    "components",
    "pages",
    "content",
    "data",
    "generated",
    "presets",
  ]);
  const unowned = readdirSync(path.join(root, "src"), { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory()
        ? !allowed.has(entry.name) &&
          readdirSync(path.join(root, "src", entry.name)).length > 0
        : !["main.tsx", "index.css", "vite-env.d.ts"].includes(entry.name)
    )
    .map((entry) => entry.name);
  expect(unowned).toEqual([]);
});

it("keeps executable loaders and transforms out of generated data", () => {
  const violations: string[] = [];
  for (const folder of ["data", "generated"]) {
    for (const file of readdirSync(path.join(root, "src", folder)).filter(
      (file) => file.endsWith(".ts")
    )) {
      const source = ts.createSourceFile(
        file,
        readFileSync(path.join(root, "src", folder, file), "utf8"),
        ts.ScriptTarget.Latest,
        true
      );
      if (
        source.statements.some(
          (statement) =>
            ts.isFunctionDeclaration(statement) ||
            ts.isClassDeclaration(statement)
        )
      )
        violations.push(`${folder}/${file}`);
    }
  }
  expect(violations).toEqual([]);
});
