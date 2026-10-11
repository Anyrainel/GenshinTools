# Shared game-site feedback

Both sites use `ggartifact-backup.feedback_submissions` through the existing
GGArtifact `/api/feedback/v1/submissions` endpoint. The `game` column is `GI`
or `HSR`. Each site's UI supplies its own value; it is an organizational label,
not a security boundary. The API validates the value. Historical rows and older
clients that omit it default to GI. The five-minute cooldown remains per user
across both sites. User identities remain normalized in the existing auth tables.

Genshin uses its existing same-origin app-session cookie. Star Rail sends its
shared-Logto ID token as a Bearer header to the GGArtifact feedback endpoint,
with cookies omitted. The same existing JWT issuer/audience validation verifies
the identity. This adds no Star Rail account backup or synchronization access.
The endpoint already permits Authorization and JSON CORS preflight.

## Publication order

GenshinTools' `npm run build` now runs a `postbuild` migration step, after the
TypeScript/Vite build succeeds and before Cloudflare runs its deploy command.
On Workers Builds' production branch (`WORKERS_CI=1`,
`WORKERS_CI_BRANCH=main`), it applies pending D1 migrations with the pinned
Wrangler CLI and the source `wrangler.jsonc` configuration:

```sh
npx wrangler d1 migrations apply BACKUP_DB --remote --config wrangler.jsonc
```

This includes `0006_feedback_game.sql`; it preserves existing feedback and marks
it GI. Applied migrations are tracked by D1 and skipped on subsequent builds.
A migration failure makes the build fail and prevents deploying the new code.
Local builds, other CI, and preview branches never run this remote step; a
Workers build with missing branch metadata fails rather than guessing.

Keep the Cloudflare build command as `npm run build` and the deploy command as
`npx wrangler deploy`. The build API token must include **Account > D1 > Edit**
for the account containing `ggartifact-backup`; default Workers Builds tokens
may not include D1. This is a one-time token permission setting in Cloudflare
My Profile > API Tokens. No new database, GitHub Action, or per-release manual
migration is needed. Do not use `--ignore-scripts` for this npm build.

For the first release, push GenshinTools and wait for its Cloudflare deployment
to succeed, then publish GGStarRail. The sites have separate deploy pipelines;
the Star Rail client does not apply migrations or hold D1 credentials.
No production migration or deployment is performed by local validation.

References: [Workers Builds environment variables and API token permissions](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
[D1 migration application and tracking](https://developers.cloudflare.com/d1/wrangler-commands/#d1-migrations-apply).

`npm run feedback:fetch` now includes game in JSON and Markdown reports. Older
local report records display as GI. Fetch only after the production migration.
