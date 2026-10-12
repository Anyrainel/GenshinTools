import { parse } from "@babel/parser";
import { type File, type Node, VISITOR_KEYS } from "@babel/types";

export function parseSourceAst(source: string, filename: string): File {
  return parse(source, {
    sourceType: "module",
    plugins: [
      ["typescript", { dts: filename.endsWith(".d.ts") }],
      ...(filename.endsWith(".tsx") ? ["jsx" as const] : []),
      "decorators-legacy",
    ],
  });
}

export function visitSourceAst(
  node: Node,
  visitor: (node: Node) => void
): void {
  visitor(node);
  for (const key of VISITOR_KEYS[node.type] ?? []) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const entry of child) {
        if (entry) visitSourceAst(entry, visitor);
      }
    } else if (child) visitSourceAst(child as Node, visitor);
  }
}
