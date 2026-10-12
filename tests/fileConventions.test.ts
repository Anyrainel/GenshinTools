import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { File, Statement } from "@babel/types";
import { describe, expect, it } from "vitest";
import { parseSourceAst, visitSourceAst } from "./helpers/sourceAst";

// File-naming conventions enforced for src/:
//   - types.ts     → only `type` / `interface` / `enum`
//   - constants.ts → only `const`
//   - utils.ts     → only `function`
//   - enums.ts     → only `const` and `type` (for co-located value/type pairs
//                    like `as const` arrays with `typeof[number]` derived
//                    unions). enums.ts must have zero imports — it's a
//                    self-contained leaf that nothing else depends upward on.
// None of these may re-export symbols from other modules
// (`export { X } from "..."` or `export { X }` after an import).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "../src");

type Kind =
  | "type"
  | "interface"
  | "enum"
  | "const"
  | "function"
  | "class"
  | "namespace"
  | "default"
  | "re-export"
  | "re-export-from"
  | "unknown";

interface ExportInfo {
  kind: Kind;
  name: string;
  line: number;
}

const RULES: Record<string, { allowed: Set<Kind>; description: string }> = {
  "types.ts": {
    allowed: new Set(["type", "interface", "enum"]),
    description: "only type / interface / enum",
  },
  "constants.ts": {
    allowed: new Set(["const"]),
    description: "only const",
  },
  "utils.ts": {
    allowed: new Set(["function"]),
    description: "only function",
  },
  "enums.ts": {
    allowed: new Set(["const", "type"]),
    description: "only const and type",
  },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const parsedFiles = new Map<string, { text: string; ast: File }>();
function sourceFor(file: string) {
  let result = parsedFiles.get(file);
  if (!result) {
    const text = fs.readFileSync(file, "utf8");
    result = { text, ast: parseSourceAst(text, file) };
    parsedFiles.set(file, result);
  }
  return result;
}

function collectImportedNames(ast: File): Set<string> {
  return new Set(
    ast.program.body.flatMap((statement) =>
      statement.type === "ImportDeclaration"
        ? statement.specifiers.map((specifier) => specifier.local.name)
        : []
    )
  );
}

function classify(
  statement: Statement,
  importedNames: Set<string>
): Kind | null {
  if (statement.type === "ExportAllDeclaration") return "re-export-from";
  if (
    statement.type === "ExportDefaultDeclaration" ||
    statement.type === "TSExportAssignment"
  )
    return "default";
  if (statement.type !== "ExportNamedDeclaration") return null;
  if (statement.source) return "re-export-from";
  if (!statement.declaration) {
    return statement.specifiers.some(
      (specifier) =>
        specifier.type === "ExportSpecifier" &&
        importedNames.has(
          specifier.local.type === "Identifier"
            ? specifier.local.name
            : specifier.local.value
        )
    )
      ? "re-export"
      : null;
  }
  const declaration = statement.declaration;
  switch (declaration.type) {
    case "TSTypeAliasDeclaration":
      return "type";
    case "TSInterfaceDeclaration":
      return "interface";
    case "TSEnumDeclaration":
      return "enum";
    case "FunctionDeclaration":
      return "function";
    case "ClassDeclaration":
      return "class";
    case "VariableDeclaration":
      return declaration.kind === "const" ? "const" : "unknown";
    case "TSModuleDeclaration":
      return "namespace";
    default:
      return "unknown";
  }
}

function describeExport(statement: Statement, source: string): string {
  if (
    statement.type === "ExportDefaultDeclaration" ||
    statement.type === "TSExportAssignment"
  )
    return "default";
  if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
    const declaration = statement.declaration;
    if (declaration.type === "VariableDeclaration")
      return declaration.declarations
        .map(({ id }) => source.slice(id.start ?? 0, id.end ?? 0))
        .join(", ");
    if ("id" in declaration && declaration.id?.type === "Identifier")
      return declaration.id.name;
  }
  return source.slice(statement.start ?? 0, statement.end ?? 0);
}

function collectExports(file: string): ExportInfo[] {
  const { text, ast } = sourceFor(file);
  const imported = collectImportedNames(ast);
  return ast.program.body.flatMap((statement) => {
    const kind = classify(statement, imported);
    return kind
      ? [
          {
            kind,
            name: describeExport(statement, text),
            line: statement.loc?.start.line ?? 1,
          },
        ]
      : [];
  });
}

function collectImports(
  file: string
): { line: number; moduleSpecifier: string }[] {
  return sourceFor(file).ast.program.body.flatMap((statement) =>
    statement.type === "ImportDeclaration"
      ? [
          {
            line: statement.loc?.start.line ?? 1,
            moduleSpecifier: statement.source.value,
          },
        ]
      : []
  );
}

const allFiles = walk(SRC_ROOT);
const TESTS_ROOT = path.resolve(__dirname);
const allTestFiles = walk(TESTS_ROOT);

/**
 * Find all `import("...").Foo` type-position imports in a file. The proper
 * form is a top-level `import type { Foo } from "..."` — inline import-types
 * inflate every reference site and obscure where a type comes from.
 *
 * `typeof import("...")` (without `.Foo`) is allowed — it captures the whole
 * module type, which is the standard idiom for `vi.mock`'s `importOriginal<T>`.
 */
function findInlineImportTypes(file: string): { line: number; text: string }[] {
  const { text, ast } = sourceFor(file);
  const out: { line: number; text: string }[] = [];
  visitSourceAst(ast, (node) => {
    if (node.type === "TSImportType" && node.qualifier)
      out.push({
        line: node.loc?.start.line ?? 1,
        text: text.slice(node.start ?? 0, node.end ?? 0),
      });
  });
  return out;
}

/**
 * Format a set of export violations for a single file. Compact format:
 *
 *   <path>  ⇒  <rule>
 *     :<line>  <kind>  <name>
 */
function formatViolations(
  rel: string,
  rule: string,
  violations: ExportInfo[]
): string {
  const maxKind = Math.max(...violations.map((v) => v.kind.length));
  const rows = violations
    .map(
      (v) =>
        `  :${String(v.line).padEnd(4)} ${v.kind.padEnd(maxKind)}  ${v.name}`
    )
    .join("\n");
  return `\n${rel}  ⇒  ${rule}\n${rows}`;
}

function findFiles(basename: string): string[] {
  return allFiles
    .filter((f) => path.basename(f) === basename)
    .sort()
    .map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, "/"));
}

describe("file conventions", () => {
  it("keeps re-exports, local exports and declaration kinds distinct with the native compiler", () => {
    const ast = parseSourceAst(
      'import { value as imported } from "./other"; const local = 1; export { imported as alias }; export { local }; export type { Contract } from "./other"; export const count = 1; export let mutable = 2; export interface Shape { id: string };',
      "fixture.ts"
    );
    const imported = collectImportedNames(ast);
    expect(
      ast.program.body
        .map((statement) => classify(statement, imported))
        .filter(Boolean)
    ).toEqual(["re-export", "re-export-from", "const", "unknown", "interface"]);
  });

  it("parses TypeScript assertions, decorators and inline import types without confusing text with code", () => {
    const ast = parseSourceAst(
      'const value = <number>1; @register class Kit {} type Inline = import("./other").Contract; type Module = typeof import("./other"); const text = "import(\\"./other\\").Contract";',
      "fixture.ts"
    );
    const qualified: string[] = [];
    visitSourceAst(ast, (node) => {
      if (node.type === "TSImportType" && node.qualifier)
        qualified.push(node.qualifier.type);
    });
    expect(qualified).toEqual(["Identifier"]);
  });

  for (const [basename, rule] of Object.entries(RULES)) {
    describe(`${basename} — ${rule.description}, no re-exports from other modules`, () => {
      const files = findFiles(basename);

      if (files.length === 0) {
        it("has at least one file (sanity check)", () => {
          expect(files.length).toBeGreaterThan(0);
        });
        return;
      }

      for (const rel of files) {
        it(rel, () => {
          const exports = collectExports(path.join(SRC_ROOT, rel));
          const violations = exports.filter(
            (e) =>
              e.kind === "re-export-from" ||
              e.kind === "re-export" ||
              !rule.allowed.has(e.kind)
          );
          if (violations.length > 0) {
            throw new Error(
              formatViolations(
                rel,
                `${basename} (${rule.description})`,
                violations
              )
            );
          }
          // enums.ts must also have zero imports.
          if (basename === "enums.ts") {
            const imports = collectImports(path.join(SRC_ROOT, rel));
            if (imports.length > 0) {
              const rows = imports
                .map(
                  (i) =>
                    `  :${String(i.line).padEnd(4)} import  ${i.moduleSpecifier}`
                )
                .join("\n");
              throw new Error(`\n${rel}  ⇒  enums.ts (zero imports)\n${rows}`);
            }
          }
        });
      }
    });
  }

  // Global rule: no inline `import("...").Foo` type-position imports.
  //
  //   type X = import("./mod").Foo;          // ← forbidden
  //   const x = y as import("./mod").Foo;    // ← forbidden
  //
  // Use a top-level `import type { Foo } from "./mod"` instead. Inline
  // import-types inflate every reference site, hide the dependency from the
  // imports list at the top of the file, and tend to accumulate when copying
  // code around. Applies to both src/ and tests/.
  describe("no inline import-type expressions", () => {
    const rels = [...allFiles, ...allTestFiles]
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => f !== __filename)
      .sort();

    for (const abs of rels) {
      const rel = path
        .relative(path.resolve(__dirname, ".."), abs)
        .replace(/\\/g, "/");
      it(rel, () => {
        const violations = findInlineImportTypes(abs);
        if (violations.length > 0) {
          const rows = violations
            .map((v) => `  :${String(v.line).padEnd(4)} ${v.text}`)
            .join("\n");
          throw new Error(
            `\n${rel}  ⇒  use top-level \`import type { … } from "..."\` instead of inline \`import("...").X\`\n${rows}`
          );
        }
      });
    }
  });

  // Global rule: no re-export statements anywhere in src/.
  //
  //   export { X } from "./other";         // ← forbidden
  //   export type { X } from "./other";    // ← forbidden
  //   export * from "./other";             // ← forbidden
  //
  // A type belongs at the deepest layer that uses it; re-exports almost
  // always indicate the type is defined at the wrong layer. When a consumer
  // needs X, they should import X directly from its canonical home.
  describe("no re-exports in src/", () => {
    const rels = allFiles
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, "/"))
      .sort();

    for (const rel of rels) {
      it(rel, () => {
        const exports = collectExports(path.join(SRC_ROOT, rel));
        const reExports = exports.filter(
          (e) => e.kind === "re-export-from" || e.kind === "re-export"
        );
        if (reExports.length > 0) {
          throw new Error(formatViolations(rel, "no re-exports", reExports));
        }
      });
    }
  });
});
