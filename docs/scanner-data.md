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

Account management contains the website's single continuous-sync toggle, one short
mode description, and a visible port input (8765 by default). There is no separate
start button or per-snapshot confirmation. An app-scoped session keeps polling after
account management closes and while navigating between site pages. A compact global
status bar shows the connection, latest receipt time and destination account. It polls
the same loopback manager address and configurable port using `GET /continuous`
every three seconds after the previous request finishes. Disabling the feature,
changing the port, or closing/reloading the tab cancels the request and discards late
responses. Global enablement and the port are persisted only on this device, outside
account exports and cloud backups, and resume automatically after a page reload.

The scanner's `{ sessionId, revision, updatedAt, data }` wrapper contains a normal
GOOD v3 export; `updatedAt` is Unix milliseconds. Identical content is not imported
again, and lower revisions in the same scanner session are ignored. Supplied inventory
sections replace their previous section through GOOD conversion and
`applyAccountImport`, preserving omitted sections, character talents and optional
metadata for matching artifacts. Identical physical items retain their multiplicity;
this is not an append-only inventory merge. Optional achievements use the existing
profile-scoped achievement import and never gate inventory readiness.

Successful packet captures include verified account identity in GOOD `metadata.uid`.
Identified snapshots always update the matching UID profile, creating it if necessary.
Anonymous data always updates the unbound Default profile (ID 0), creating Default
if necessary. The currently viewed profile never chooses the import destination.
Identified captures do not promote or merge an anonymous Default automatically.
Malformed supplied identity is rejected rather than treated as absent. New scanner
sessions, login gaps and lost connections recover automatically without approval.
The scanner clears identity and inventory together on login changes; both its
one-time and continuous packet exports require verified identity.

The scanner publishes the latest successfully decoded baseline, full item-record
updates and confirmed inventory removals. Some scalar-only lock/equipment notification
shapes are not decoded yet. Re-login refreshes the baseline; the UI must not promise
immediate synchronization of every game edit. Disabled capture, waiting for a
baseline, capture failures with diagnostics, older unsupported scanners, invalid
exports, and lost/blocked connections have separate localized recovery states.
