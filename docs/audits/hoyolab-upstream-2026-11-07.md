# HoYoLAB / 米游社 import upstream audit — 2026-11-07

## Sources and scope

The following default-branch commits were fetched during this audit. File reads
were pinned to these commits; the current default-branch versions of the signing
files were also identical to those pinned reads.

| Reference | Commit | Files to review again |
| --- | --- | --- |
| [seriaati/genshin.py](https://github.com/seriaati/genshin.py/tree/4cf0cdd42af1a70013bc873fdcf4f51ecd5366ff) | `4cf0cdd42af1a70013bc873fdcf4f51ecd5366ff` | `genshin/constants.py`, `genshin/utility/ds.py`, `genshin/utility/uid.py`, `genshin/client/routes.py`, `genshin/client/components/base.py`, `genshin/client/components/chronicle/genshin.py`, `genshin/models/genshin/chronicle/characters.py`, `genshin/errors.py` |
| [Womsxd/MihoyoBBSTools](https://github.com/Womsxd/MihoyoBBSTools/tree/01be3bab9c5f99983c61ce0d494d25d9cbea8511) | `01be3bab9c5f99983c61ce0d494d25d9cbea8511` | `setting.py` (CN x4 salt, version, web-client headers) |

Local consumers are `src/providers/hoyolab/hoyolabFetcher.ts`, `worker/index.ts`,
and `scripts/hoyolab-probe.ts`. This audit covers the Genshin Battle Chronicle
import. GGStarRail's first-party web client is a separate reference contract;
do not copy its DS1 salt, nonce alphabet, or endpoint into this implementation.

## Findings and resulting behavior

- CN x4 salt and app version `2.117.0`, and OS salt and version `1.5.0`, already
  matched the selected references.
- Both regions use POST `character/list`, followed by POST `character/detail`
  with `character_ids`, `role_id`, and `server`, matching genshin.py.
- CN base is `https://api-takumi-record.mihoyo.com/game_record/app/genshin/api`;
  OS base is `https://sg-public-api.hoyolab.com/event/game_record/genshin/api`.
- CN DS2 uses a seconds timestamp, inclusive nonce range 100001–200000, and MD5
  over salt/timestamp/nonce plus the transmitted JSON body and sorted query.
  OS DS1 uses six ASCII letters and MD5 over salt/timestamp/nonce.
- Fixed UID routing to inspect the complete prefix before the final eight digits,
  as upstream does. Ten-digit `18xxxxxxxx` UIDs now reach OS Asia; they previously
  reached CN because only the first digit was inspected. Unsupported ten-digit
  prefixes are rejected.
- Added OS `x-rpc-lang` alongside `x-rpc-language`, matching upstream DS headers.
- All upstream Geetest return codes (`10035`, `5003`, `10041`, `1034`) now explain
  the required security verification to the importing player.
- The constants checker now checks Worker **and** probe values, including the CN
  user-agent version. Network errors and missing local/upstream values fail the
  check. The old implementation could report success after skipping a failed
  fetch or parser and could overlook probe-only drift.

## Deliberate local differences

- The browser sends the three v2 cookie fields (`ltuid_v2`, `ltmid_v2`,
  `ltoken_v2`) to an allowlisted Worker proxy. The Worker assembles the cookie;
  this product does not offer the upstream library's other login/cookie modes.
- Detail requests are processed sequentially in batches of at most 30, rather
  than placing every owned ID in one upstream-library request. All returned IDs
  are traversed; list elements supplement missing detail elements.
- JavaScript emits compact JSON; Python's default serializer includes spaces.
  CN signs the exact body it transmits. The body and signature must always use
  the same serialization; reproducing Python whitespace is unnecessary.
- CN web headers/version follow MihoyoBBSTools, while the x4 DS2 algorithm follows
  genshin.py. The older CN app version string in genshin.py is not our selected
  version source. Browser-like origin/referer/user-agent headers are retained.
- GOOD conversion and name resolution are product-specific. Consumed response
  fields (base, weapon, relic properties, skills) match the upstream detail model.
  Character ascension remains inferred from level because this response does not
  expose it; artifact/weapon lock state is not supplied. These are existing import
  limitations, not differences in stored data semantics introduced by this audit.

## Repeating the check

1. Resolve each repository's current default branch and HEAD, then fetch all files
   above at that SHA. Compare meaningful upstream changes since this audit (or
   the last successful review), including endpoints, methods, UID routing,
   credential requirements, DS nonce/serialization/hash rules, headers, response
   models, and error codes. A changed HEAD alone does not establish incompatibility.
2. Run `npm run check:hoyolab`. This is a **constants-only** helper, fetching raw
   `master` files. It does not pin all network reads to one SHA and cannot prove
   endpoint or algorithm equivalence; the pinned file review remains required.
   Treat network/parser failure as an incomplete check, never as current.
3. Run `npm run test:tooling`,
   `npx vitest run tests/domain/game-account/hoyolabFetcher.test.ts`, and
   `npx vitest run -c vitest.worker.config.ts tests/worker/worker.test.ts`.
   Production proxy tests verify actual outbound DS digests, CN raw-body/query
   canonicalization, region routes, headers, credentials, and invalid-body guards.
4. `npm run check:hoyolab:fix` updates only the CN/OS entries in `SALTS` and
   `APP_VERSION` plus the CN `miHoYoBBS/` version in both consumers. It prepares
   temporary files before replacing sources, and makes no changes when upstream
   verification is incomplete. Review the diff and rerun checks; it does not
   update algorithms or endpoints.

No authenticated account was used in this audit. Source comparison, live upstream
constant retrieval, and mocked production-proxy regression tests do not prove a
real account can currently pass HoYoLAB/米游社 risk controls. The opt-in probe can
exercise that boundary with operator-provided credentials; keep cookies and
response contents out of audit reports.
