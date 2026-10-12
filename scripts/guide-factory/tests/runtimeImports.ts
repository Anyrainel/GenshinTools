import {
  isExportAllDeclaration,
  isExportNamedDeclaration,
  isImportDeclaration,
  isImportExpression,
  isImportSpecifier,
  isStringLiteral,
  isTemplateLiteral,
  type File,
} from "@babel/types";
import {
  parseSourceAst,
  visitSourceAst,
} from "../../../tests/helpers/sourceAst";

export function runtimeModuleSpecifiers(
  source: string,
  filename: string,
): string[] {
  return runtimeAstModuleSpecifiers(parseSourceAst(source, filename));
}

export function runtimeAstModuleSpecifiers(sourceFile: File): string[] {
  const specifiers: string[] = [];
  visitSourceAst(sourceFile, (node) => {
    if (isImportDeclaration(node)) {
      if (node.importKind === "type") return;
      if (
        node.specifiers.length > 0 &&
        node.specifiers.every(
          (specifier) =>
            isImportSpecifier(specifier) && specifier.importKind === "type",
        )
      )
        return;
      specifiers.push(node.source.value);
    } else if (
      (isExportAllDeclaration(node) || isExportNamedDeclaration(node)) &&
      node.source &&
      node.exportKind !== "type"
    ) {
      // Preserve the closure guard's declaration-level export semantics;
      // inline export specifiers remain evidence of their source module.
      specifiers.push(node.source.value);
    } else if (isImportExpression(node) && node.options == null) {
      if (isStringLiteral(node.source)) specifiers.push(node.source.value);
      else if (
        isTemplateLiteral(node.source) &&
        node.source.expressions.length === 0
      ) {
        const value = node.source.quasis[0]?.value.cooked;
        if (value != null) specifiers.push(value);
      }
    }
  });
  return specifiers;
}
