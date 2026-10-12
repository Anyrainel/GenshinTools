# Browser and scanner coverage — 2026-10-12

Existing fast tests already cover GOOD conversion, partial section semantics,
account-identity routing, import rarity rules, equipment assignment, scanner
manager instructions and saved store migrations. Existing authenticated cloud
E2E cases cover cross-browser restoration, user isolation, conflict choices,
no-op saves and independently edited domains. Those scenarios remain in the
authenticated local Worker suite; they are not duplicated by the public suite.

The new `playwright.public.config.ts` runs two built-browser journeys at desktop
and mobile widths:

- All nine themes render through the public controls, produce screenshots,
  persist across reload and retain responsive layout. Deep links load actual
  production route chunks; language selection also survives reload.
- A representative GGScanner GOOD v3 file crosses the real file input, optional
  UID routing, first-run prompts, visible character roster, canonical equipment
  conversion and persisted hydration. Literal expected IDs and artifact v3
  fields validate the actual public/persistence boundaries without importing
  website conversion code into the browser tests. The achievement extension
  reaches the account-scoped achievement store.
  A tiny partial second scan adds an owned Character and weapon, then the same
  public journey creates a team and runs the Character replacement search with
  generated artifacts. It observes the real Worker and asserts a usable result
  with positive damage. This verifies built worker/catalog chunks without a
  large inventory benchmark or a duplicate browser test.

`tests/fixtures/goodscanner-v3.json` is a manually curated representative fixture,
not a claimed scanner-emitted byte snapshot. Its envelope and optional fields
were checked read-only against GOODScanner's
`genshin/src/scanner/common/models.rs` (`GoodExport`, `GoodArtifact`,
`GoodSubStat`) and `genshin/src/capture/player_data.rs`. Both producers use
`format: GOOD`, version 3 and `source: yas-GOODScanner`; optional absent sections
and achievements are omitted. Fast conversion/merge tests own omitted-versus-
empty semantics. No scanner repository files were changed.

The existing tour tests now use canonical route paths, wait for actual visible
steps, derive step counts from the UI and retain viewport/completion checks.
Obsolete hash navigation, hardcoded startup/transition sleeps, duplicated
selectors and console logging were removed.

Run `npm run build:app` and `npm run test:e2e:public`; install Chromium once with
`npx playwright install chromium`. The public configuration starts the built
Cloudflare preview locally. `E2E_BASE_URL` can target an existing preview or
deployed site, with imports and preferences isolated to test browser contexts.
The independent browser CI workflow runs the full check, installs Chromium with
Linux dependencies and runs the public and authenticated account suites. The Cloudflare production builder
keeps its regular non-browser checks. `npm run test:e2e:account` retains the
authenticated local Worker harness.

Every Playwright configuration uses an explicit nested output directory to
avoid Playwright's default cleanup of the whole ignored `test-results` root.
Public screenshots/traces live under `test-results/e2e-public`; legacy harness
outputs have their own directory.
