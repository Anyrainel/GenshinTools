import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { parseSourceAst } from "../helpers/sourceAst";

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
    "generated",
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
  const walk = (folder: string) => {
    for (const entry of readdirSync(path.join(root, "src", folder), {
      withFileTypes: true,
    })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      const source = parseSourceAst(
        readFileSync(path.join(root, "src", file), "utf8"),
        file
      );
      if (
        source.program.body.some(
          (statement) =>
            statement.type === "FunctionDeclaration" ||
            statement.type === "ClassDeclaration" ||
            (statement.type === "ExportNamedDeclaration" &&
              (statement.declaration?.type === "FunctionDeclaration" ||
                statement.declaration?.type === "ClassDeclaration")) ||
            (statement.type === "ExportDefaultDeclaration" &&
              (statement.declaration.type === "FunctionDeclaration" ||
                statement.declaration.type === "ClassDeclaration"))
        )
      )
        violations.push(file);
    }
  };
  walk("generated");
  expect(violations).toEqual([]);
});
