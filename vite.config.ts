import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { presetWatcher } from "./scripts/dev/vite-plugin-preset-watcher";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "github" ? "/GenshinTools/" : "/",
  plugins: [
    react({ tsDecorators: true }),
    presetWatcher(),
    {
      name: "cache-static-assets",
      apply: "serve",
      configureServer(server) {
        // In dev, Vite serves public/ assets with no-cache, forcing a
        // round-trip per image on every page switch.  With 200+ weapon
        // icons this makes navigation feel seconds-long.  Cache image
        // and font files for 10 min so the browser reuses them.
        server.middlewares.use((req, res, next) => {
          if (
            req.url &&
            /\.(png|jpe?g|webp|svg|gif|ico|woff2?)(\?|$)/i.test(req.url)
          ) {
            res.setHeader("Cache-Control", "max-age=600");
          }
          next();
        });
      },
    },
    {
      name: "kill-on-parent-close",
      configureServer(server) {
        process.stdin.on("close", () => {
          server.close();
          process.exit(0);
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es",
  },
  build: {
    // Beta game-data files (``*.json.gz``) must ship as standalone gzipped
    // assets — never inlined as base64 data URIs in JS chunks. Inlining would
    // force the runtime to decode a data: URL via fetch (which works) but it
    // would also bloat the main JS bundle with opaque blobs on every build.
    assetsInlineLimit: (filePath) =>
      filePath.endsWith(".json.gz") ? false : undefined,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
}));
