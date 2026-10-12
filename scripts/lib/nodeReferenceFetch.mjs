import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

// Tool/test transport for Vite asset URLs. Browser providers never import Node.
export function installNodeReferenceFetch(root = process.cwd()) {
  const previous = globalThis.fetch;
  const dataRoot = path.resolve(root, "src/data/game");
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url ?? String(input);
    if (!url.startsWith("http") && /\.json\.gz(?:\?|$)/.test(url)) {
      const plain = url.split("?")[0].split("#")[0];
      const target = plain.startsWith("/@fs/")
        ? path.resolve(plain.slice(5))
        : path.resolve(root, plain.replace(/^\//, ""));
      const relative = path.relative(dataRoot, target);
      if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        const bytes = readFileSync(target);
        return new Response(gunzipSync(bytes).toString("utf8"), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return previous(input, init);
  };
}
