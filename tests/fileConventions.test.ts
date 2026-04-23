import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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

function hasExportModifier(stmt: ts.Statement): boolean {
  if (!ts.canHaveModifiers(stmt)) return false;
  const mods = ts.getModifiers(stmt);
  return mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function classify(stmt: ts.Statement, importedNames: Set<string>): Kind | null {
  if (ts.isExportDeclaration(stmt)) {
    if (stmt.moduleSpecifier) return "re-export-from";
    // `export { X }` without `from`: a true re-export only if any of the
    // named items is an imported symbol. `export { LocalFoo }` where LocalFoo
    // is declared in this file is just a late export — legitimate pattern
    // (shadcn primitives, tests, etc.) and not flagged.
    const clause = stmt.exportClause;
    if (clause && ts.isNamedExports(clause)) {
      for (const spec of clause.elements) {
        const localName = (spec.propertyName ?? spec.name).text;
        if (importedNames.has(localName)) return "re-export";
      }
    }
    return null;
  }
  if (ts.isExportAssignment(stmt)) return "default";
  if (!hasExportModifier(stmt)) return null;
  if (ts.isTypeAliasDeclaration(stmt)) return "type";
  if (ts.isInterfaceDeclaration(stmt)) return "interface";
  if (ts.isEnumDeclaration(stmt)) return "enum";
  if (ts.isFunctionDeclaration(stmt)) return "function";
  if (ts.isClassDeclaration(stmt)) return "class";
  if (ts.isVariableStatement(stmt)) return "const";
  if (ts.isModuleDeclaration(stmt)) return "namespace";
  return "unknown";
}

/** Collect local binding names introduced by `import` statements in a file. */
function collectImportedNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const clause = stmt.importClause;
    if (!clause) continue;
    if (clause.name) names.add(clause.name.text); // default import
    const bindings = clause.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      names.add(bindings.name.text); // `import * as NS`
    } else if (ts.isNamedImports(bindings)) {
      for (const spec of bindings.elements) names.add(spec.name.text);
    }
  }
  return names;
}

function describeExport(stmt: ts.Statement): string {
  if (
    ts.isTypeAliasDeclaration(stmt) ||
    ts.isInterfaceDeclaration(stmt) ||
    ts.isEnumDeclaration(stmt) ||
    ts.isFunctionDeclaration(stmt) ||
    ts.isClassDeclaration(stmt)
  ) {
    return stmt.name?.text ?? "<anonymous>";
  }
  if (ts.isVariableStatement(stmt)) {
    return stmt.declarationList.declarations
      .map((d) => d.name.getText())
      .join(", ");
  }
  if (ts.isExportDeclaration(stmt)) {
    const clause = stmt.exportClause?.getText() ?? "*";
    const from = stmt.moduleSpecifier
      ? ` from ${stmt.moduleSpecifier.getText()}`
      : "";
    return `${clause}${from}`;
  }
  if (ts.isExportAssignment(stmt)) return "default";
  return "<?>";
}

function collectExports(file: string): ExportInfo[] {
  const source = fs.readFileSync(file, "utf-8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imported = collectImportedNames(sf);
  const out: ExportInfo[] = [];
  for (const stmt of sf.statements) {
    const kind = classify(stmt, imported);
    if (!kind) continue;
    const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
    out.push({ kind, name: describeExport(stmt), line: line + 1 });
  }
  return out;
}

/**
 * Collect all import statements in a file. Used to enforce enums.ts'
 * zero-imports invariant — the file must be a self-contained leaf.
 */
function collectImports(
  file: string
): { line: number; moduleSpecifier: string }[] {
  const source = fs.readFileSync(file, "utf-8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out: { line: number; moduleSpecifier: string }[] = [];
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
      out.push({
        line: line + 1,
        moduleSpecifier: stmt.moduleSpecifier.getText(sf),
      });
    }
  }
  return out;
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
  const source = fs.readFileSync(file, "utf-8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportTypeNode(node) && node.qualifier !== undefined) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      out.push({ line: line + 1, text: node.getText(sf) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
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
