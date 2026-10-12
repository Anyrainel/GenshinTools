import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import postcss from "postcss";
import { build } from "vite";

/** Compile the real source scan, so absent dynamic utilities fail the tests. */
export async function buildUiCss(): Promise<string> {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  );
  const result = await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [tailwindcss({ optimize: false })],
    build: {
      write: false,
      cssMinify: false,
      rolldownOptions: { input: path.join(root, "src/index.css") },
    },
  });
  if ("output" in result) {
    const css = result.output.find(
      (file) => file.type === "asset" && file.fileName.endsWith(".css")
    );
    if (css?.type === "asset") return String(css.source);
  }
  throw new Error("Vite did not emit the UI stylesheet.");
}

export function utilityDeclarations(
  css: string,
  className: string
): Record<string, string> {
  const selector = `.${className.replace(/[^\w-]/g, "\\$&")}`;
  const values: Record<string, string> = {};
  postcss.parse(css).walkRules(selector, (rule) => {
    rule.walkDecls((declaration) => {
      values[declaration.prop] = declaration.value
        .replace(/\s+/g, " ")
        .replace(/\( /g, "(")
        .replace(/ \)/g, ")");
    });
  });
  return values;
}
