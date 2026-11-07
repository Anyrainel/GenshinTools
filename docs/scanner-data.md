# GGScanner shared game data

HoyoData's `hoyodata genshintools` target builds website mappings, then publishes
`public/good/genshin_scanner_data.json` and an identical local copy under
`data/reference/`. No separate OCR/capture JSON endpoints are generated.

The formatVersion 1 document contains `sourceRevision`, `mappings` (OCR names,
GOOD keys, elements and constellation talent bonuses), and `capture` (inventory
definitions, properties, affixes and skill types). The source revision equals
the capture catalog's `git_hash`. No achievement data is included.

GGScanner's scanner, capture and manager share this file and one local cache.
`mapping_achievements.json` remains independently hosted and is downloaded only
for achievement scanning. Manager and capture operations do not need it.

The shared endpoint requires revalidation, supports CORS, and is checked against
the shared document's schema, provenance and collections by
`npm run data:scanner:check` before a web build. Enka reads its capture section;
OCR generation updates its mappings section. The old endpoints are removed.
Normal publishing is a validated Git push; no manual deployment is required.

## Continuous inventory sync

The account import menu offers an explicit background inventory sync toggle. An
app-scoped, memory-only session keeps polling after the import dialog closes and
while navigating between site pages. A compact global status bar exposes review,
details and an immediate turn-off action without opening a blocking dialog. It polls
the same loopback manager address and configurable port using `GET /continuous`
every three seconds after the previous request finishes. Disabling the feature,
changing the port/profile, or closing/reloading the tab cancels the request and
discards late responses. The setting is deliberately not persisted across tab sessions.

The scanner's `{ sessionId, revision, updatedAt, data }` wrapper contains a normal
GOOD v3 export; `updatedAt` is Unix milliseconds. Identical content is not imported
again, and lower revisions in an approved session are ignored. Supplied inventory
sections replace their previous section through GOOD conversion and
`applyAccountImport`, preserving omitted sections, character talents and optional
metadata for matching artifacts. Identical physical items retain their multiplicity;
this is not an append-only inventory merge. Optional achievements use the existing
profile-scoped achievement import and never gate inventory readiness.

Snapshots do not include an account UID. The user must select/import a profile and
explicitly confirm the target before the first update. Changing profiles, scanner
sessions, replacing data in the same profile through another import, connection
loss, or `continuous_capture_no_data` requires confirmation
again. A login transition occurring entirely between polls cannot be identified
reliably without a UID or account-generation token from the scanner; users must
disable sync before switching game accounts. No automatic profile creation or
cross-profile merge occurs.

The scanner currently publishes the latest successfully decoded baseline and full
item-record updates. Deletion-only and some scalar-only lock/equipment notification
shapes are not decoded yet. Re-login refreshes the baseline; the UI must not promise
immediate synchronization of every game edit. Disabled capture, waiting for a
baseline, capture failures with diagnostics, older unsupported scanners, invalid
exports, and lost/blocked connections have separate localized recovery states.
