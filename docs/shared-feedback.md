# Shared game-site feedback

Both sites use `ggartifact-backup.feedback_submissions` through the existing
GGArtifact `/api/feedback/v1/submissions` endpoint. The `game` column is `GI`
or `HSR`. Each site's UI supplies its own value; it is an organizational label,
not a security boundary. The API validates the value. Historical rows and older
clients that omit it default to GI. The five-minute cooldown remains per user
across both sites. User identities remain normalized in the existing auth tables.

## Public feeds and character discussions

Both sites provide `/feedback`, retaining `/account/feedback` as a legacy link.
Feedback stays in the account menu, outside primary navigation. The dialog
offers "Hide from public feedback" and sends the selected `public` boolean.
Migration `0008` originally marked historical feedback private. Migration `0009`
publishes existing submissions at the site owner's explicit request; subsequent
hidden submissions remain private. Older clients without a choice remain private.
GET `/api/feedback/v1/submissions?game=GI|HSR` includes public posts and, when
authenticated, that user's own hidden posts. It returns masked author email,
visibility, ownership, vote count and the viewer's vote state alongside content.
Full email, contact metadata and account identifiers never leave the server.
Email local parts and domain labels are masked even for short addresses.
POST `/submissions/:id/visibility` accepts `{ public: boolean }` for the author
only. POST `/submissions/:id/vote` accepts `{ voted: boolean }` for signed-in
users who can see the post. Both actions are idempotent. The `feedback_votes`
table has a unique `(feedback_id, user_id)` key and an insertion trigger gives
authors their default vote, with existing authors backfilled by migration `0009`.
Authors may remove their own default vote. Private responses use `no-store` and
each site's feed resets on login, logout or account changes.

Archive character details use GET/POST
`/api/community/v1/characters/:characterId/comments?game=GI|HSR`, backed by
`0007_character_comments.sql` in the same database. Reads are anonymous; writes
use the existing cookie/Bearer authentication. Comments are plain text, limited
to 1000 characters, with an atomic one-minute per-user cooldown across threads
and games. Public posts omit author identity.

Both feeds show newest posts first, 20 per page, with an opaque `(time, ID)`
cursor to preserve ordering when timestamps coincide. Browser requests start
after rendering, have local loading/error/retry states, and abort on navigation.
Feed failures cannot hold up archive data or the feedback submission dialog.
The production build applies both migrations before deployment; publish the
Genshin API first, then the Star Rail client. Local validation does not migrate
production data.

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
