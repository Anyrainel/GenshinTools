import fs from "node:fs";
import path from "node:path";
import { parseSourceAst, visitSourceAst } from "./sourceAst";

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
    const file = parseSourceAst(source, filename);
    visitSourceAst(file, (node) => {
      if (node.type === "StringLiteral") inspect(node.value);
      if (
        node.type === "BinaryExpression" &&
        node.operator === "+" &&
        node.left.type === "StringLiteral"
      ) {
        const match = node.left.value.match(
          /(?:^|\s)((?:[\w-]+:)*(?:text|bg|border|ring|fill|stroke)-[^\s]*)$/
        );
        if (match) violations.push(`interpolated-utility ${match[1]}`);
      }
      if (node.type === "TemplateLiteral") {
        const parts = node.quasis.map(
          (part) => part.value.cooked ?? part.value.raw
        );
        for (const part of parts) inspect(part);
        for (const part of parts.slice(0, -1)) {
          const match = part.match(
            /(?:^|\s)((?:[\w-]+:)*(?:text|bg|border|ring|fill|stroke)-[^\s]*)$/
          );
          if (match) violations.push(`interpolated-utility ${match[1]}`);
        }
      }
    });
  }
  return violations;
}

export function collectUiViolations(root: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const stock: { components: { path: string; sha256: string }[] } = JSON.parse(
    fs.readFileSync(path.join(root, "docs/audits/shadcn-stock.json"), "utf8")
  );
  const stockDigests = new Map(
    stock.components.map((component) => [component.path, component.sha256])
  );
  function walk(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) {
        const relative = path.relative(root, full).replaceAll("\\", "/");
        const source = fs.readFileSync(full, "utf8");
        const stockDigest = stockDigests.get(relative);
        if (stockDigest) {
          const digest = createHash("sha256")
            .update(source.replaceAll("\r\n", "\n"))
            .digest("hex");
          if (digest === stockDigest) continue;
          throw new Error(`Stock shadcn source drift: ${relative}`);
        }
        for (const violation of findUiViolations(source, full)) {
          const key = `${relative}: ${violation}`;
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
    }
  }
  walk(path.join(root, "src/components"));
  walk(path.join(root, "src/pages"));
  walk(path.join(root, "src/app"));
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  );
}

import { createHash } from "node:crypto";
