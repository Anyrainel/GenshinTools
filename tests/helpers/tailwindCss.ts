import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "../../tailwind.config";

/** Compile the real source scan, so absent dynamic utilities fail the tests. */
export async function buildUiCss(): Promise<string> {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  );
  const result = await postcss([
    tailwindcss({
      ...config,
      content: [path.join(root, "src/**/*.{ts,tsx}").replaceAll("\\", "/")],
    }),
  ]).process("@tailwind utilities;", { from: undefined });
  return result.css;
}

export function utilityDeclarations(
  css: string,
  className: string
): Record<string, string> {
  const selector = `.${className.replace(/[^\w-]/g, "\\$&")}`;
  const values: Record<string, string> = {};
  postcss.parse(css).walkRules(selector, (rule) => {
    rule.walkDecls((declaration) => {
      values[declaration.prop] = declaration.value;
    });
  });
  return values;
}
