# Account System

Last updated: 2026-05-09.

This document is the source of truth for the current account, auth, Worker API, and cloud-backup system shape. Data schemas and backup partition modeling live in `docs/backup-data-model.md`.

## Current Status

- Logto is the production auth provider.
- `/account` and `/account/cloud-backup` are visible in production.
- Backup/restore is manual only. There are no passive background sync triggers.
- The Worker backup API is implemented under `/api/backup/v1`.
- D1 stores account/auth metadata and backup heads. R2 stores compressed backup object bodies.
- The Worker issues a first-party backup session cookie after Logto proves identity once.

## Frontend Auth

The React app uses `@logto/react`:

- `src/main.tsx` wraps the app in `LogtoProvider`.
- `src/cloud/authConfig.ts` owns Logto endpoint, app id, scopes, and redirect helpers.
- `src/pages/account/AuthCallbackPage.tsx` handles the sign-in callback and creates the first-party app session.
- `src/pages/account/AccountPage.tsx` owns sign-in, sign-out, and account status UI.
- `src/pages/account/CloudBackupPage.tsx` reads Logto auth state before enabling manual backup and restore actions. If the backup session cookie is missing or expired, it retries once by creating a new app session from the current Logto ID token.
- `src/cloud/session.ts` creates `BackupApiClient` instances that use the first-party app session cookie via `credentials: "same-origin"`.

Default frontend values:

| Config | Default |
| --- | --- |
| `VITE_LOGTO_ENDPOINT` | `https://auth.ggartifact.com` |
| `VITE_LOGTO_APP_ID` | `tglrsenlbfrfrnevjwlan` |
| `VITE_LOGTO_SCOPES` | empty |

The Logto SPA app id is public client metadata. Do not put client secrets, management API secrets, private keys, or Worker secrets in the frontend.

## Logto Setup

Configure the Logto SPA app with exact redirect URLs for every origin used by the app.

Redirect URIs:

- `https://ggartifact.com/callback`
- `http://localhost:5173/callback`
- any other local dev origin actually used for callback testing

Post sign-out redirect URIs:

- `https://ggartifact.com/`
- `http://localhost:5173/`
- the matching root URL for any other local dev origin

No API resource is required for v1. The Worker only needs to know that the user signed into this SPA, so `/api/auth/session` validates Logto ID tokens whose audience is the SPA app id. This keeps the app compatible with Logto Free plan tenants that cannot create API resources.

Recommended Logto token posture for this app:

- Keep access tokens short-lived.
- Keep refresh-token rotation enabled.
- Do not enable "always issue refresh token" unless the SDK flow needs it.
- A 45 to 60 day refresh-token lifetime is acceptable for this low-risk game-data backup use case if rotation and sign-out/revocation remain available.

## Worker Auth

`worker/auth.ts` owns the auth boundary.

Worker config:

| Config | Meaning |
| --- | --- |
| `LOGTO_ENDPOINT` | Logto tenant endpoint. Used to derive issuer and JWKS when explicit values are absent. |
| `LOGTO_ISSUER` | Optional override. Defaults to `{LOGTO_ENDPOINT}/oidc`. |
| `LOGTO_JWKS_URI` | Optional override. Defaults to `{LOGTO_ISSUER}/jwks`. |
| `LOGTO_APP_ID` | Expected ID-token audience. Defaults to `tglrsenlbfrfrnevjwlan`. |

Browser backup requests authenticate with an HTTP-only first-party cookie:

```text
Cookie: ggartifact_session=<opaque random token>
```

`POST /api/auth/session` creates that cookie from:

```text
Authorization: Bearer <Logto ID token>
```

The session cookie is stored in D1 as a SHA-256 token hash with a 30-day expiry. It is scoped to the app origin with `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS.

`requireUser(request, env)` validates app sessions by:

- hashing the cookie token
- looking up an unrevoked, unexpired row in `app_auth_sessions`
- resolving the linked `app_users` row

For smoke tests and bootstrap paths, `requireUser` can still accept a direct Logto bearer token. In that fallback path it validates:

- bearer token is present and JWT-shaped
- JWT signature against Logto JWKS
- issuer
- audience, the SPA app id
- expiration
- `sub`

On first valid request, the Worker maps Logto identity to app identity:

```text
provider = "logto"
provider_subject = <Logto sub>
app user id = usr_logto_<first 32 hex chars of sha256(sub)>
```

The raw Logto subject is never used in R2 paths. Backup rows and R2 object keys use the opaque internal app user id.

`/api/auth/me` returns the resolved app user. `/api/auth/logout` revokes the app session cookie when present and clears the browser cookie; the frontend also signs out through Logto. There is no `/api/auth/dev-login`.

## Backup API

The API prefix is:

```text
/api/backup/v1
```

Implemented endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /head?headSetRev=<rev>` | Read current backup heads, or return no-change when the client's `headSetRev` is current. |
| `POST /commits` | Publish changed objects and/or deletes atomically with optimistic concurrency. |
| `POST /objects` | Download current backup objects by object id. |

All endpoints:

- require a valid first-party app session cookie, or a direct Logto ID token for smoke/bootstrap paths
- resolve one internal app user
- require `cloud_sync`
- scope D1 rows and R2 object keys by internal user id
- return JSON errors for auth, entitlement, validation, and conflict failures

Core error statuses:

| Status | Meaning |
| --- | --- |
| `401` | Missing or invalid auth token. |
| `403` | Entitlement missing. |
| `404` | Requested object is not a current object for this user. |
| `409` | Revision conflict. |
| `413` | Payload too large. |
| `422` | Invalid request payload, schema, size, or hash. |
| `503` | D1/R2 binding missing. |

The Worker is domain-agnostic. It stores partition keys, revisions, hashes, sizes, metadata, and object pointers, but it does not parse backup payload bodies.

## Manual Backup Flow

The manual UI calls `src/cloud/manualBackupController.ts` and `src/cloud/syncClient.ts`.

Upload flow:

1. Fetch cloud heads.
2. Build local cloud partitions from Zustand stores.
3. Hash/canonicalize payloads.
4. Plan no-op, upload, download, unsupported, and conflict decisions.
5. Upload safe changes automatically within the explicit manual action.
6. Ask before overwriting cloud or deleting cloud data.
7. Mark local sync metadata only after commit succeeds.

Restore flow:

1. Fetch cloud heads.
2. Ask the user which cloud partitions to restore when needed.
3. Download selected objects.
4. Verify envelope identity, schema, and content hash.
5. Build a restore plan.
6. Apply through store-owned APIs/import paths.
7. Mark local sync metadata only after local apply succeeds.

Cloud head metadata for the manual page may be cached in `sessionStorage` under `cloud_backup_metadata:<user>`. The cache is display-only and must not become an auth or conflict source of truth.

## Local Verification

Manual local verification should use real Logto with local D1/R2 bindings:

1. Register the local callback and sign-out URLs in Logto.
2. Run `npm run dev:worker` or the normal local dev flow.
3. Sign in through `/account`.
4. Open `/account/cloud-backup`.
5. Upload data.
6. Use a second browser profile, different browser, or separate container to sign in as another Logto user.
7. Confirm each user sees only their own backup heads and restored objects.

`npm run smoke:backup-worker` starts local Wrangler and exercises local D1/R2. Because there is no dev-login route, it requires a Logto ID token for the test user:

```text
BACKUP_SMOKE_ACCESS_TOKEN=<Logto ID token>
```

The automated Worker tests do not call Logto. They use a local JWT/JWKS fixture so auth tests are deterministic, offline, and close to production token syntax.

## Verification Commands

Use these before deploying account/backup changes:

```text
npm run type-check
npm run lint
npm run test
npm run check:worker
```

Focused auth/backup coverage:

```text
npx vitest run -c vitest.worker.config.ts tests/worker/auth.test.ts tests/worker/backup.test.ts
npx vitest run tests/cloud/session.test.ts tests/components/account/AccountPage.test.tsx tests/components/account/CloudBackupPage.test.tsx tests/i18n.test.ts
```

## Future Work

- Replace the V1 all-authenticated-users `cloud_sync` grant with a real entitlement policy.
- Add paid/limited access rules if cloud backup becomes gated.
- Add background dirty queue, retry state, and sync/conflict account-menu badges.
- Add cloud payload migrations when a partition schema changes.
- Add browser E2E coverage if the manual flow becomes business critical.
- If a dev JWT issuer is needed later, keep it JWT-shaped and route it through the same identity mapping instead of adding dev-only persistence tables.
