# Browser validation

Pull requests and pushes to `main` run the core browser checks. Changes limited
to `docs/**` and Markdown documentation skip this workflow. Markdown under `src/`
is bundled application content and still triggers validation.

The automatic checks cover production route loading, scanner imports and reload
persistence, character replacement calculation, lazy reference catalogs, and
account cloud backup. Public flows run on desktop Chromium and a Pixel 7 viewport;
stateful cloud backup runs once on desktop against the local E2E server.

Theme, language, tour placement, and layout sweeps have the `@visual` tag and run
only when **Browser validation → Run workflow** is selected in GitHub Actions.
Manual runs also execute the core checks.

Local commands (install Chromium with `npx playwright install chromium` first):

- `npm run build:app`, then `npm run test:e2e:public`: core production-browser checks.
- `npm run test:e2e:account`: cloud backup checks; starts its own local E2E server.
- `npm run build:app`, then `npm run test:e2e:visual`: theme and layout sweeps.

On CI failure, download `browser-failure-evidence` from the run's artifacts.
It retains screenshots, error context, traces, and any account HTML report for
14 days. Open a trace with `npx playwright show-trace <path-to-trace.zip>`.
Account checks still run if public checks fail, so one broken public flow does
not hide backup failures.
