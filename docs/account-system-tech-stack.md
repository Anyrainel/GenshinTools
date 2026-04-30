# Account System Design 1: Tech Stack, Product System, and Monetization

Last updated: 2026-04-30. Cloudflare product limits last verified: 2026-04-29.

## Scope

This document covers the serverless account-system architecture for GenshinTools:

- account login across global and Mainland China audiences
- paid subscription, one-time donation, and entitlement tracking
- cloud backup and cross-device restore gates
- lightweight product analytics
- feedback submission
- optional advertising and sponsorship monetization

Detailed backup data boundaries are in `docs/account-system-data-survey.md`. Detailed tables, payloads, and APIs are in `docs/account-system-schema.md`.

## Recommended Stack

Use Cloudflare as the default platform:

- Static frontend: keep Cloudflare Pages for the current global deployment.
- Backend API: start with Pages Functions under `functions/api`.
- Transaction metadata: Cloudflare D1.
- Backup object storage: Cloudflare R2.
- Optional low-value config/cache: Cloudflare KV.
- Optional event analytics: Cloudflare Web Analytics first, then first-party batched activity, then Workers Analytics Engine if aggregate querying becomes useful.

Do not store backup blobs in D1. D1 has a 2 MB max string, blob, or row size. Account data can approach that uncompressed, and backup snapshots need room for metadata, future schema growth, and large inventories.

## Cloudflare Product Fit

| Need | Product | Decision |
| --- | --- | --- |
| Auth sessions | D1 + HTTP-only cookies | Use opaque session ids, hash server-side in D1. |
| OAuth identities | D1 | Store provider identities separately from users. |
| OAuth/OIDC secrets | Workers secrets | Never ship provider client secrets or private keys to the browser or D1. |
| Email/password credentials | V2: D1 + Workers secrets or managed auth | Not in launch. Do not start paid Workers just for password auth. |
| Entitlements | D1 | Source of truth for subscription and donation access. |
| Payment webhooks | Pages Functions + D1 + Workers secrets | Idempotently store provider events before granting access; signing secrets stay in Workers secrets. |
| Backup metadata | D1 | Current heads, object metadata, revisions, hashes, object keys. |
| Backup payloads | R2 | Private compressed objects, not public buckets. |
| Feedback | D1 | Small records plus rate limiting. |
| Analytics | Cloudflare Web Analytics plus first-party batches | Do not rely on per-action raw events. |
| Feature flags | KV or D1 | KV is fine for low-risk config. D1 for source-of-truth gates. |
| Abuse controls | Rate limits, honeypot, optional Turnstile outside Mainland China | Turnstile is not supported in Mainland China. |

Cloudflare Pages Functions are billed under Workers pricing, so moving from Pages Functions to a Worker later should be an architecture cleanup, not a pricing cliff.

## Quota-Aware Backup Patterns

Design the backup path around small metadata reads and immutable object writes:

- D1 stores only heads, object metadata, sessions, entitlements, and feedback. Do not store backup payloads in D1 because D1 rows/strings/blobs are capped at 2 MB.
- R2 stores compressed backup payloads under immutable revision keys. Do not overwrite the same R2 key for every backup; R2 limits concurrent writes to the same object key.
- Normal sync reads only D1 cloud-index/head metadata. Download full R2 objects only for restore, explicit download, or corruption investigation. R2 `HEAD` is lighter than `GET` for bytes and memory, but both are Class B read operations, so D1 metadata should be the normal comparison path.
- The client computes a canonical payload `contentHash`. If the current cloud index has the same hash, skip upload.
- Uploads include `baseRev`. The server updates D1 heads only when `baseRev` still matches the current head; otherwise return 409 and let the user choose local or cloud.
- Same-browser concurrent editing is not a primary concern. Use only a lightweight localStorage or `BroadcastChannel` signal to avoid duplicate background flushes.
- Background sync should pause on real hand-authored data conflicts instead of prompting immediately. Surface the status under the account icon menu and show choices only for explicit sync/restore or before overwriting either local or cloud data.
- Complete account imports can intentionally replace older cloud account partitions. Settings can use latest-writer-wins.
- Keep payloads partitioned by namespace so one import uploads only changed account/build/team partitions.
- Upload one partition object per request in V1. This keeps conflict handling and Worker memory simple. Add batch upload only if request overhead becomes a measured bottleneck.
- Stream or avoid buffering large bodies in Workers. Workers have 128 MB isolate memory and request body limits come from the Cloudflare account plan.
- Use KV only for low-risk config/cache. KV is eventually consistent and should not store sync heads, payment state, or entitlement state.
- V1 retention keeps only the latest visible head per namespace/partition. Mark superseded objects in D1 and garbage collect their R2 blobs after commit. Keep table timestamps so latest + N days can be added later.

Background-sync UX contract:

- Backups should run in the background after explicit local actions, such as import, scanner sync, build/team edits, or tier-list edits.
- Do not block the app shell, imports, optimizer pages, or navigation while a backup is pending.
- Use the top-right account icon as the home for auth state, sync status, sync-now, restore/download, conflict resolution, and last-error details.
- Show passive failures as account-icon badges and dropdown rows, not modal dialogs or toast loops.
- Manual "Sync now" should flush immediately; normal background backup should debounce and coalesce dirty partitions.
- Do not try to send large backup bodies during unload with `sendBeacon` or `keepalive`; leave the dirty queue pending and retry on the next active session.
- The account menu should distinguish `queued`, `syncing`, `synced`, `retrying`, `paused: conflict`, `paused: entitlement`, `offline`, and `needs action`.

Security posture for backup V1:

- Use HTTPS/TLS, HTTP-only session cookies, authenticated Workers, private R2 buckets, and D1 authorization checks.
- Do not expose public R2 URLs for backup objects.
- Do not add client-side end-to-end encryption in V1. The backed-up data is game inventory/configuration data, not payment secrets or auth credentials, and E2EE would complicate recovery, multi-device restore, support, dedupe, and future migration.
- Keep client-side encrypted exports as a possible V2 feature for users who want a local archive, but do not make cloud sync depend on a user-managed recovery key.

This backup posture does not lower the bar for authentication secrets. SSO client secrets, webhook signing secrets, private keys, raw session ids, OAuth codes, and OAuth tokens are high-risk auth secrets and must follow the auth-secret sections below. Future password peppers, passwords, and reset tokens are also auth secrets if email/password is added in V2.

Cloudflare limits that shape this design as of 2026-04-29:

- Workers Free allows 100,000 requests/day, 10 ms CPU per HTTP request, 50 external subrequests per invocation, and 100 MB request bodies. Workers Paid removes the daily request cap, defaults to 30 seconds CPU with up to 5 minutes configurable, and allows 10,000 subrequests per invocation.
- D1 Free has 500 MB maximum database size; Workers Paid has 10 GB per database. D1 also has a 2 MB maximum string, blob, or row size, 100 bound parameters per query, and 50/1000 queries per Worker invocation on Free/Paid respectively.
- R2 allows large objects, but object metadata is capped at 8 KB and concurrent writes to the same key above 1 per second are rate-limited. R2's free tier includes 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations.

## Mainland China Constraints

The global Cloudflare deployment is not the same as a Mainland China deployment.

Cloudflare's China Network requires ICP and JD Cloud content vetting for onboarding. Cloudflare's China Network product list includes Workers, Workers KV, R2, and Workers Assets. Cloudflare Pages is not available in Mainland China, although a global Pages zone may potentially be extended into Mainland China. Turnstile is also not supported in Mainland China.

Practical decision:

1. Ship the account system on the current global Cloudflare Pages deployment.
2. Avoid hard dependency on Google, Turnstile, or other blocked third-party scripts for the China user path.
3. If Mainland China usage justifies it, evaluate a separate China-specific serving plan:
   - Cloudflare China Network with Worker Assets if enterprise/onboarding is acceptable.
   - A separate China hosting/CDN provider if ICP, local provider integration, and latency become the priority.

## Authentication Providers

Use a provider-agnostic identity model:

```ts
type IdentityProvider =
  | "google"
  | "github"
  | "discord"
  | "wechat"
  | "qq"
  | "gitee"
  | "bilibili"
  | string;

type LinkedIdentity = {
  provider: IdentityProvider;
  providerSubject: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  avatarUrl?: string;
};
```

Suggested launch set:

- Global first: GitHub and Google. Add Discord if there is strong community demand.
- China first: Gitee is likely easier than WeChat Open Platform. WeChat is the better long-term user expectation, but approval and account requirements are heavier. QQ/Bilibili are optional depending on registration friction.

Do not merge accounts automatically by email. Let users explicitly link another provider from an active session.

## SSO Secret and Token Handling

SSO provider secrets are infrastructure secrets, not user data:

- Store OAuth/OIDC client secrets, private-key JWT signing keys, webhook signing secrets, and token-encryption keys only in Cloudflare Workers secrets or Secrets Store.
- Do not store provider secrets in D1, KV, R2, Wrangler `vars`, source code, build-time client env vars, analytics, logs, or error reports.
- Keep public provider metadata separate from secrets. In V1, client id, issuer URL, authorization URL, token URL, JWKS URL, scopes, and redirect paths should be static Worker/server config. Use D1 provider config only later if runtime admin changes are needed.
- Use separate provider applications and secrets for production, preview, and local development.
- Rotate secrets with a documented runbook: add new secret, deploy code/config that can use it, rotate at provider, verify login/webhooks, then remove the old secret. Prefer providers that support overlapping secrets or key ids.
- Treat local `.dev.vars` and `.env` files as secrets. They must stay gitignored and must never contain production credentials.

OAuth/OIDC flow rules:

- Use Authorization Code flow. Do not use implicit flow or resource owner password credentials grant.
- Use PKCE with `S256` for providers that support it, even for web clients.
- Use transaction-specific `state`; for OIDC, also use transaction-specific `nonce`.
- Store OAuth transaction state in short-lived, HTTP-only, Secure, SameSite=Lax cookies or in D1 with only hashes/sealed transient secrets. Do not expose `state`, `nonce`, or `code_verifier` to app JavaScript.
- Require exact redirect URI allowlists. Do not implement open redirect parameters on auth callbacks.
- Validate OIDC ID tokens: issuer, audience/client id, authorized party when present, signature/JWKS or provider-specific token validation, expiry, and nonce.
- Verify that UserInfo `sub` matches the ID token `sub` before using UserInfo claims.
- Store only the stable provider subject and minimal profile claims needed for account linking. Do not store provider access tokens or refresh tokens unless a later feature truly needs provider API access.
- If provider tokens must be stored later, encrypt them with a key from Workers secrets, store token metadata separately, minimize scopes, and expire/delete them aggressively.
- Never log authorization codes, access tokens, refresh tokens, ID tokens, client secrets, private keys, raw `state`, raw `nonce`, or raw `code_verifier`.

## Email and Password Auth V2

Email/password login is not part of V1. The launch account system should use SSO/OAuth providers and stay compatible with Workers Free as much as possible.

V2 entry criteria:

- We accept Workers Paid or a vetted managed auth provider.
- We accept the security work for password storage, resets, email verification, abuse controls, and support.
- We do not weaken password hashing to stay within the Workers Free 10 ms CPU envelope. A deliberately slow verifier is the point.

Reserve provider code `email_password` for that future flow.

Password rules:

- Require at least 15 characters while password is the only factor. If MFA/passkey second factor is later required for password accounts, 8 characters can be accepted, but 15 remains better UX guidance.
- Allow at least 64 characters.
- Allow spaces and Unicode. Normalize Unicode with NFC before hashing.
- Do not impose composition rules such as uppercase, lowercase, digit, or symbol requirements.
- Do not silently truncate passwords.
- Do not require periodic password rotation. Force reset only after compromise, credential import, or a hash/pepper incident.
- Do not use password hints or security questions.
- Check new passwords against a blocklist of common, expected, service-specific, and known-compromised passwords. For China reliability, V2 should include a local common-password blocklist; a remote breached-password API can be optional where reachable.

Password storage:

- Never store plaintext or reversibly encrypted passwords.
- Store a verifier produced by Argon2id with a per-password salt and stored parameters. Use OWASP's Argon2id baseline as the starting point, then tune in the actual Worker runtime so normal verification stays under the paid Worker CPU/memory budget.
- If Argon2id is not practical in the Worker runtime, use a vetted managed auth provider or a separate auth service. Do not downgrade to a fast hash.
- Use a server-side pepper as defense in depth. Store the pepper only in Cloudflare Workers secrets, never in D1 or client code.
- Version hash parameters so future logins can rehash to stronger settings.
- Use constant-time verification APIs from the password-hashing library.

Abuse controls:

- Rate-limit login, signup, verification, password-reset request, and password-reset completion by normalized email and by IP or coarse network bucket.
- Keep rate limiting mostly first-party. Cloudflare Rate Limiting can be the fast first layer, but it is permissive and per-location, so D1-backed account/email lock counters are still needed for password guessing controls.
- Use Turnstile only where supported. Do not depend on Turnstile for the Mainland China path.
- Use generic auth errors for login and password reset requests so attackers cannot enumerate accounts.
- Store password-reset and email-verification tokens only as hashes, with short expirations and single-use consumption.
- Do not log passwords, reset tokens, verification tokens, or raw session ids.

## Session Model

Use first-party cookies:

- `sid`: opaque random session id, HTTP-only, Secure, SameSite=Lax.
- Store only a hash of the session id in D1.
- Rotate on login and provider-link changes.
- Support session revocation and "log out all devices".
- Keep access checks server-side for all backup, entitlement, feedback, and account endpoints.

JWTs are not necessary for this app. Opaque sessions are simpler to revoke and easier to reason about with D1.

## Backup Product Gate

The entitlement to gate is `cloud_sync`.

Recommended policy:

- Anonymous users can keep local-only behavior.
- Authenticated free users can see cloud-sync UI and restore/download/delete existing cloud data if present, but cannot upload new cloud backups.
- Entitled users can upload cloud backups and restore across devices.
- Expired users cannot create new cloud backups, but can still download or delete existing cloud data.
- Local file export/import remains available regardless of entitlement because it does not use server storage.

Entitlement sources:

- subscription
- lifetime one-time payment
- donation grant
- manual admin grant
- trial

Entitlements should never be inferred from a client-side payment success redirect. Only webhook or admin-side reconciliation should grant durable access.

## Payment and Donation Providers

Global:

- Stripe Checkout or Payment Links for subscriptions and one-time payments.
- GitHub Sponsors or Ko-fi can be donation surfaces, but entitlement automation is weaker unless webhook/API support is reliable enough.

China:

- Afdian is a practical donation bridge for Chinese users if manual or semi-automated reconciliation is acceptable.
- WeChat Pay and Alipay are better native payment experiences but require entity, compliance, and account setup. Treat them as a later phase.

Use provider-neutral tables:

- `payment_events`: immutable, idempotent webhook ledger.
- `entitlements`: current access state.
- `entitlement_grants`: optional audit trail if we want detailed history.

## Analytics

Analytics are secondary and lossy by design. We need product direction, not perfect attribution.

Recommended layers:

1. Cloudflare Web Analytics for free, privacy-first page/RUM visibility.
2. First-party batched product events for feature usage.
3. Workers Analytics Engine only if D1 rollups become too limited.
4. Optional region-specific third-party analytics if we accept their script and privacy tradeoffs.

Google Analytics is free and useful globally, but it should not be the only analytics path. Google documents product traffic disruptions and government-mandated blocks in the Transparency Report. In practice, Google-hosted analytics scripts are not reliable for Mainland China users, and can hurt page loading if loaded synchronously or as a blocking dependency.

Baidu Tongji is the natural China-side analytics option, but it is a third-party script with its own privacy/compliance implications. If used, load it only for the China deployment or only after a region/config decision from the server.

First-party event collection:

- Client aggregates small counters in memory or IndexedDB/localStorage.
- Flush using `navigator.sendBeacon` on `visibilitychange`, and normal `fetch` on idle/interval.
- Batch every 1-5 minutes or after meaningful feature actions, whichever comes first.
- Sample at the event-family level, for example 10-20 percent for high-volume UI events.
- Store daily rollups in D1, not raw event history.
- Events must avoid account inventory, artifact stats, team names, free-text feedback, and UID unless explicitly needed.
- Do not tie telemetry upload to cloud backup. Backup-gated telemetry would overrepresent signed-in/sync users and delay visibility. If offline, keep a small TTL-limited queue and drop old counters.

Good event families:

- page view by route
- import source used
- cloud sync action outcome
- feature entry, such as recommendation, optimizer, triage, ER calculator
- long-running job started/completed/aborted
- feedback submitted
- ad slot viewed/clicked for first-party sponsorships

## Ads and Sponsorships

Ads are a V2-compatible product area, not part of backup V1. Backup schema and account sync should not depend on ads.

There is no single easy ad network that works well for both global users and Mainland China users.

Recommended approach:

1. Prefer direct sponsorship slots first.
2. Serve sponsorship metadata from our own backend.
3. Use region-aware optional third-party ad networks later.
4. Never make ad script loading block the app shell or core tools.

Third-party ad networks usually do not need our own ad endpoint; they use embedded scripts/tags configured with publisher ids. Our own endpoints are only needed for first-party sponsorship inventory, custom direct-sold placements, or a server-side region/locale policy that chooses whether to load a network.

Direct sponsorship is the safest cross-region model:

- D1 stores campaigns, creatives, targeting, and active windows.
- R2 stores creative images.
- If we build first-party sponsorships, the app requests `/api/ads/slots?route=...&locale=...`.
- The server chooses a campaign by route, locale, region, and frequency caps.
- Impression and click events are first-party, batched, and aggregated.

Global third-party options:

- Google AdSense is broad and easy globally, but Google scripts are not reliable in Mainland China. Google AdSense country restrictions do not list China as embargoed, but network availability is a separate practical issue.
- Carbon Ads or BuySellAds may fit a developer/tool audience, but acceptance and fill are not guaranteed.
- EthicalAds and similar privacy-focused networks are possible if the audience profile fits.

China third-party options:

- Baidu Union/Baidu marketing ecosystem.
- Tencent Ads/Youlianghui.
- Alibaba Alimama/Taobao Alliance if affiliate/product ads make sense.
- Ocean Engine if ByteDance ecosystem reach matters.

For GenshinTools, direct sponsorship or affiliate-style static placements are probably better than programmatic display at first. The audience is niche, game-oriented, and tool-focused. First-party sponsorship avoids loading heavy ad SDKs into a calculator-heavy app and avoids fighting two incompatible ad ecosystems on day one.

## Recommended Rollout

Completed local prerequisite

- Local account profile ids use numeric default profile `0` and UID profile ids.
- Triage/resource settings and freeze intent are account-scoped locally.
- Profile `0` promotion remaps account-scoped local stores before activating the UID.
- Build and team presets use hydrated active presets plus persisted `PresetDelta` overlays.
- Team source data is split into `team.comp`, `team.config`, and local-only result caches.
- Character, weapon, and artifact tier-list stores are multi-instance.
- Migration code lives under `src/stores/migration/<domain>.ts`; current store files define latest runtime schemas only.

Phase 1: Foundation

- Session auth with one global provider and one China-friendly provider if feasible.
- `/api/me`, logout, provider-linking skeleton.
- Entitlement table and manual admin grants.

Phase 2: Cloud codecs and UI

- Introduce cloud codecs for account, builds, teams, account freeze, account settings, and tier lists.
- Normalize account data at the cloud boundary.
- Add account-menu sync/conflict status and resolver.

Phase 3: Cloud backup API

- D1 migrations and R2 bucket.
- Cloud sync index endpoint.
- Upload/download compressed backup payloads to R2.
- Gate upload/restore by `cloud_sync`.
- Allow delete/download even after entitlement expiry.

Phase 4: Payments and feedback

- Stripe checkout/webhook.
- Afdian/manual donation grant path.
- Text-only feedback form with rate limiting and China-safe anti-spam fallback.

Phase 5: Analytics and monetization

- Cloudflare Web Analytics.
- First-party batched event rollups.
- Direct sponsorship slots.
- Optional region-specific third-party analytics or ads.

## References

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Pages Functions bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Web Analytics: https://developers.cloudflare.com/web-analytics/about/
- Workers Analytics Engine pricing: https://developers.cloudflare.com/analytics/analytics-engine/pricing/
- Cloudflare China Network FAQ: https://developers.cloudflare.com/china-network/faq/
- Cloudflare China Network product availability: https://developers.cloudflare.com/china-network/reference/available-products/
- Google product traffic disruptions FAQ: https://support.google.com/transparencyreport/answer/7381506
- Google AdSense country restrictions: https://support.google.com/adsense/answer/6167308
- Umami docs: https://docs.umami.is/docs
- Baidu Tongji: https://tongji.baidu.com/
- Alimama: https://www.alimama.com/brand.htm
- Ocean Engine: https://www.oceanengine.com/
- Tencent Youlianghui product PDF: https://file.tencentads.com/files/pdf/2024/4/c7f2400b94424d7ca7da53115f58a777.pdf
