import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
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

const localDevPort = Number(process.env.VITE_DEV_PORT ?? 5173);
const localDevOrigin = `http://127.0.0.1:${localDevPort}`;

function manualChunks(id: string): string | undefined {
  for (const [predicate, chunk] of chunkAssignments) {
    if (predicate(id)) return chunk;
  }
  return undefined;
}

const localBackupBindings = {
  vars: {
    LOGTO_ENDPOINT: "https://synz8r.logto.app",
    LOGTO_APP_ID: "tglrsenlbfrfrnevjwlan",
    ...(process.env.VITE_E2E_FAKE_LOGTO === "1"
      ? {
          LOGTO_ISSUER: `${localDevOrigin}/__e2e__/issuer`,
          LOGTO_JWKS_URI: `${localDevOrigin}/__e2e__/jwks`,
        }
      : {}),
  },
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
  const fakeLogtoForE2e = process.env.VITE_E2E_FAKE_LOGTO === "1";

  return {
    base: mode === "github" ? "/GenshinTools/" : "/",
    plugins: [
      react({ tsDecorators: true }),
      !staticOnlyBuild &&
        cloudflare({
          config: command === "serve" ? () => localBackupBindings : undefined,
          persistState: fakeLogtoForE2e
            ? { path: ".wrangler/e2e-state" }
            : undefined,
        }),
      presetWatcher(),
      {
        name: "e2e-fake-logto",
        apply: "serve",
        configureServer(server) {
          if (!fakeLogtoForE2e) return;
          const fixture = createE2eLogtoFixture();
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith("/__e2e__/")) {
              next();
              return;
            }

            const url = new URL(req.url, localDevOrigin);
            if (url.pathname === "/__e2e__/jwks") {
              const jwks = await fixture.jwks();
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(jwks));
              return;
            }

            if (url.pathname === "/__e2e__/token") {
              const token = await fixture.token({
                sub: url.searchParams.get("sub") ?? "e2e-default-user",
                name: url.searchParams.get("name") ?? undefined,
                email: url.searchParams.get("email") ?? undefined,
              });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ accessToken: token }));
              return;
            }

            next();
          });
        },
      },
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
        ...(fakeLogtoForE2e
          ? {
              "@logto/react": path.resolve(
                __dirname,
                "./src/testing/e2e/fakeLogto.tsx"
              ),
            }
          : {}),
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
      port: localDevPort,
      strictPort: true,
      host: true,
    },
  };
});

function createE2eLogtoFixture() {
  const kid = "e2e-logto-key";
  const issuer = `${localDevOrigin}/__e2e__/issuer`;
  const audience = "tglrsenlbfrfrnevjwlan";
  const keyPair = generateKeyPair("ES256", { extractable: true });

  return {
    async jwks() {
      const { publicKey } = await keyPair;
      const jwk = await exportJWK(publicKey);
      return {
        keys: [{ ...jwk, kid, alg: "ES256", use: "sig" }],
      };
    },
    async token(user: { sub: string; name?: string; email?: string }) {
      const { privateKey } = await keyPair;
      return new SignJWT({
        scope: "cloud_sync",
        ...(user.name ? { name: user.name } : {}),
        ...(user.email ? { email: user.email } : {}),
      })
        .setProtectedHeader({ alg: "ES256", kid })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(user.sub)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);
    },
  };
}
