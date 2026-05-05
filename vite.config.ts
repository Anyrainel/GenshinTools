import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { presetWatcher } from "./scripts/dev/vite-plugin-preset-watcher";

// Chunk assignment shared between the main app graph and each worker graph.
// Workers have their own Rollup build rooted at the worker entry, so this
// function runs independently per graph — the output filenames will differ,
// but each graph receives the same splitting rules.
//
// Goal is cache-lifespan: group modules by change frequency so one patch or
// impl edit invalidates as small a chunk as possible.
const chunkAssignments: Array<[(id: string) => boolean, string]> = [
  // Vendor — changes only on lockfile bumps
  [
    (id) =>
      id.includes("node_modules") &&
      /[\\/]react(-dom|-router-dom)?[\\/]/.test(id),
    "vendor-react",
  ],
  [
    (id) => id.includes("node_modules") && id.includes("@radix-ui"),
    "vendor-radix",
  ],
  [
    (id) => id.includes("node_modules") && id.includes("recharts"),
    "vendor-recharts",
  ],

  // App source — more specific patterns first
  [
    (id) => /[\\/]src[\\/]lib[\\/]team-comp[\\/]impl[\\/]/.test(id),
    "team-comp-impl",
  ],
  [(id) => /[\\/]src[\\/]lib[\\/]team-comp[\\/]/.test(id), "team-comp-engine"],
  [(id) => /[\\/]src[\\/]data[\\/]i18n-/.test(id), "i18n-data"],
  // Skip raw JSON assets here so Vite's json-plugin handles them via its own
  // rules (glob-lazy imports stay as standalone chunks; static imports stay
  // with their importer). Only intercept ``*.ts`` source files under data/.
  [(id) => /[\\/]src[\\/]data[\\/][^\\/]+\.ts$/.test(id), "game-data"],
];

function manualChunks(id: string): string | undefined {
  for (const [predicate, chunk] of chunkAssignments) {
    if (predicate(id)) return chunk;
  }
  return undefined;
}

const localBackupBindings = {
  d1_databases: [
    {
      binding: "BACKUP_DB",
      database_name: "ggartifact-backup",
      database_id: "bf430d1d-3063-4ce6-bf57-4558110bf55f",
    },
  ],
  r2_buckets: [
    {
      bucket_name: "ggartifact-backup",
      binding: "BACKUP_BUCKET",
    },
  ],
};

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const staticOnlyBuild = mode === "github" || mode === "tauri";

  return {
    base: mode === "github" ? "/GenshinTools/" : "/",
    plugins: [
      react({ tsDecorators: true }),
      !staticOnlyBuild &&
        cloudflare({
          config: command === "serve" ? () => localBackupBindings : undefined,
        }),
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
      rollupOptions: {
        output: { manualChunks },
      },
    },
    build: {
      // Beta game-data files (``*.json.gz``) must ship as standalone gzipped
      // assets — never inlined as base64 data URIs in JS chunks. Inlining would
      // force the runtime to decode a data: URL via fetch (which works) but it
      // would also bloat the main JS bundle with opaque blobs on every build.
      assetsInlineLimit: (filePath) =>
        filePath.endsWith(".json.gz") ? false : undefined,
      rollupOptions: {
        output: { manualChunks },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true,
    },
  };
});
