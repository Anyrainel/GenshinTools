import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export function findUiViolations(source: string, filename: string): string[] {
  const violations: string[] = [];
  function inspect(text: string) {
    for (const match of text.matchAll(
      /\b(?:text-muted-foreground|border-border)\/(?:\[[^\]]+\]|[\d.]+)/g
    )) {
      violations.push(`muted-opacity ${match[0]}`);
    }
    for (const match of text.matchAll(
      /#[\da-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(\s*[\d.][^)]*\)/g
    )) {
      violations.push(`literal-color ${match[0]}`);
    }
  }
  if (filename.endsWith(".css")) {
    inspect(source.replace(/\/\*[\s\S]*?\*\//g, ""));
  } else {
    const file = ts.createSourceFile(
      filename,
      source,
      ts.ScriptTarget.Latest,
      true
    );
    function visit(node: ts.Node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        inspect(node.text);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        ts.isStringLiteral(node.left)
      ) {
        const match = node.left.text.match(
          /(?:^|\s)((?:[\w-]+:)*(?:text|bg|border|ring|fill|stroke)-[^\s]*)$/
        );
        if (match) violations.push(`interpolated-utility ${match[1]}`);
      }
      if (ts.isTemplateExpression(node)) {
        for (const part of [
          node.head,
          ...node.templateSpans.map((span) => span.literal),
        ])
          inspect(part.text);
        const parts = [
          node.head.text,
          ...node.templateSpans.slice(0, -1).map((span) => span.literal.text),
        ];
        for (const part of parts) {
          const match = part.match(
            /(?:^|\s)((?:[\w-]+:)*(?:text|bg|border|ring|fill|stroke)-[^\s]*)$/
          );
          if (match) violations.push(`interpolated-utility ${match[1]}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  return violations;
}

export function collectUiViolations(root: string): Record<string, number> {
  const counts: Record<string, number> = {};
  function walk(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) {
        const relative = path.relative(root, full).replaceAll("\\", "/");
        for (const violation of findUiViolations(
          fs.readFileSync(full, "utf8"),
          full
        )) {
          const key = `${relative}: ${violation}`;
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
    }
  }
  walk(path.join(root, "src/components"));
  walk(path.join(root, "src/pages"));
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  );
}
