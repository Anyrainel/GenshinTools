# Dependency migration — 2026-10-12

Core versions were verified against current npm metadata before installation.
Direct dependencies are pinned to the reviewed stable releases.

| Tool | Version |
| --- | --- |
| Node requirement | 24 LTS (`>=24 <25`, `.node-version`, CI 24) |
| React / React DOM / types | 19.3.0 |
| TypeScript | 7.0.2 |
| Vite / React plugin | 8.3.4 / 6.1.2 |
| Tailwind / Vite integration | 4.3.3 |
| tw-animate-css / radix-ui | 1.4.0 / 1.8.0 |
| Vitest / coverage-v8 | 5.0.3 |
| Wrangler | 4.149.0 |
| Cloudflare Vite / Vitest plugins | 1.63.1 / 1.4.0 |
| Biome / dependency-cruiser | 2.5.15 / 18.6.0 |
| Playwright | 1.64.0 |

Other direct packages use the latest compatible stable registry versions.
Vitest remains at the requested 5.0.3 despite 5.0.4 being available. Node types
remain on 24.19.2 for the required runtime major. `npm ls typescript --all`
confirms only TypeScript 7.0.2 remains; no older compiler dependency or fallback
compiler is retained. Existing class decorators use Vite's native Oxc transform.

The old npm 11.2 resolver could not resolve the major-version transition. A fresh
lockfile was generated with npm 11.12, then installed with ordinary `npm ci`.
No `--force` or `--legacy-peer-deps` override was used.

Compiler-based architecture, convention, UI and guide-research guards now use
Babel parser/types 8. Dependency-cruiser uses its supported SWC parser, with
JSONC-derived aliases and explicit negative/safe-type-only fixtures. The JSONC
reader rejects malformed configuration. Cloudflare's virtual runtime module is
allowed for Worker tests and explicitly prohibited from browser code. See the
separate compiler audit for research baseline counts and existing script errors.

Tailwind is CSS-first with `@tailwindcss/vite`, inline runtime theme variables,
native utilities and `tw-animate-css`. Nine themes, chart/game palettes, custom
containers, sidebar/card sizing and maintained animations are preserved. Game
utilities are generated independently from the maintained Genshin palette, with
`styles:check` drift verification. The old Tailwind/PostCSS configs and animation
plugin are removed, without `@config`, `@plugin` or a compatibility adapter.
Compiled-CSS tests use the actual Vite/Tailwind pipeline and native Rolldown input.

Thirty current official shadcn Radix bases are recorded by URL and exact hash.
The stock guard rejects local drift. Approved focus-padding and scrolling fixes
remain above the bases; the hover-card portal fix is now upstream, so its wrapper
was removed. Custom components remain. React 19 ref types and Select callbacks
were adapted at callers. Sonner colors are passed by its app caller using the
existing HSL theme variables. No new modification to a stock base was retained.

The deprecated Worker pool adapter and generic Workers type dependency are
removed. Wrangler generates runtime/binding types; generation trims upstream
trailing whitespace. Type checks verify drift instead of silently regenerating
types. Existing Workers-runtime tests now use `@cloudflare/vitest-plugin` and
Cloudflare's documented MSW integration, retaining request rejection, identity,
credential and data checks. Vite uses native Rolldown groups and current paths.

Actual account browser validation found a stale backup capability descriptor:
the builds adapter exported schema v3, while restore accepted only v2. The
descriptor now matches the existing unpublished v3 migration. The existing
multi-device test now uploads a real v3 adapter snapshot, verifies compressed
download integrity and restores its custom preset, build delta and settings;
future schema v4 remains blocked. No new persisted shape/version was introduced.
The local fake-auth test middleware runs before Cloudflare's dev interception.

The required full check includes app tests, architecture/convention guards,
72 artifact regression teams, production app/Worker build verification, Worker
tests/dry-run, generated type drift and Python checks. Browser CI additionally
runs the built public suite and authenticated local backup suite with Node 24,
current checkout/setup-node actions and setup-uv. Browser output directories are
separate to preserve shared scratch. See the browser audit for scanner v3 fixture
provenance, independent Rust-wire schema checks and responsive theme coverage.

No scanner repository, game data, game formula, asset source or saved schema was
changed by this upgrade. Publication uses validated normal Git pushes and the
existing Cloudflare Git deployment, without manual Wrangler deployment.

References: [Tailwind upgrade](https://tailwindcss.com/docs/upgrade-guide),
[Cloudflare MSW integration](https://developers.cloudflare.com/workers/testing/vitest-integration/mock-outbound-requests/),
[Cloudflare build Node versions](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).
