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

Before publishing either client/server change, apply the additive D1 migration:

```sh
npx wrangler d1 migrations apply ggartifact-backup --remote
```

This includes `0006_feedback_game.sql`; it preserves existing feedback and marks
it GI. Then publish GenshinTools (the shared API) and GGStarRail. No production
migration or deployment is performed by the local validation workflow.

`npm run feedback:fetch` now includes game in JSON and Markdown reports. Older
local report records display as GI. Fetch only after the production migration.
