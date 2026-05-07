# Account System

Last updated: 2026-05-05.

This document is the source of truth for the current account, auth, Worker API, and cloud-backup system shape. Data schemas and backup partition modeling live in `docs/backup-data-model.md`.

## Current Status

- Logto is the production auth provider.
- `/account` and `/account/cloud-backup` are visible in production.
- Backup/restore is manual only. There are no passive background sync triggers.
- The Worker backup API is implemented under `/api/backup/v1`.
- D1 stores account/auth metadata and backup heads. R2 stores compressed backup object bodies.
- There is no separate dev-login, session-token, or first-party auth-session path.

## Frontend Auth

The React app uses `@logto/react`:

- `src/main.tsx` wraps the app in `LogtoProvider`.
- `src/cloud/authConfig.ts` owns Logto endpoint, app id, optional API resource, scopes, and redirect helpers.
- `src/pages/account/AuthCallbackPage.tsx` handles the sign-in callback.
- `src/pages/account/AccountPage.tsx` owns sign-in, sign-out, and account status UI.
- `src/pages/account/CloudBackupPage.tsx` reads Logto auth state before enabling manual backup and restore actions.
- `src/cloud/session.ts` creates `BackupApiClient` instances that send `Authorization: Bearer <token>`. By default this is the Logto ID token so the Free plan does not need API resources. If `VITE_LOGTO_API_RESOURCE` is set later, it uses a resource access token instead.

Default frontend values:

| Config | Default |
| --- | --- |
| `VITE_LOGTO_ENDPOINT` | `https://synz8r.logto.app` |
| `VITE_LOGTO_APP_ID` | `tglrsenlbfrfrnevjwlan` |
| `VITE_LOGTO_API_RESOURCE` | empty |
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

No API resource is required for v1. The Worker only needs to know that the user signed into this SPA, so it validates Logto ID tokens whose audience is the SPA app id. This keeps the app compatible with Logto Free plan tenants that cannot create API resources.

Optional future API-resource mode:

- Create a Logto API resource only when you need Logto-side API scopes/RBAC.
- Set both `VITE_LOGTO_API_RESOURCE` and `LOGTO_API_RESOURCE` to the exact resource identifier.
- The frontend will request a resource access token and the Worker will validate that resource audience instead of the app id.

If local sign-in fails with `invalid_target`, the frontend is still requesting a Logto API resource. Clear `VITE_LOGTO_API_RESOURCE`, restart Vite, and start sign-in again from `/account`.

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
| `LOGTO_API_RESOURCE` | Optional resource-token audience for future API-resource mode. When set, it overrides `LOGTO_APP_ID`. |

Every authenticated request must send:

```text
Authorization: Bearer <Logto token>
```

`requireUser(request, env)` validates:

- bearer token is present and JWT-shaped
- JWT signature against Logto JWKS
- issuer
- audience, either the SPA app id by default or the configured API resource
- expiration
- `sub`

On first valid request, the Worker maps Logto identity to app identity:

```text
provider = "logto"
provider_subject = <Logto sub>
app user id = usr_logto_<first 32 hex chars of sha256(sub)>
```

The raw Logto subject is never used in R2 paths. Backup rows and R2 object keys use the opaque internal app user id.

`/api/auth/me` returns the resolved app user. `/api/auth/logout` is a stateless no-op that returns `{ ok: true }`; the frontend signs out through Logto. There is no `/api/auth/dev-login`.

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

- require a valid Logto access token
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

`npm run smoke:backup-worker` starts local Wrangler and exercises local D1/R2. Because there is no dev-login route, it requires:

```text
BACKUP_SMOKE_ACCESS_TOKEN=<Logto API access token>
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
