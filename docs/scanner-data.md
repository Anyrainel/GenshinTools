# GGScanner shared game data

HoyoData's `hoyodata genshintools` target builds website mappings, then publishes
`public/good/genshin_scanner_data.json` and an identical local copy under
`data/reference/`. The new filename distinguishes it from the older standalone
`mappings.json` and `data_cache.json` endpoints.

The formatVersion 1 document contains `sourceRevision`, `mappings` (OCR names,
GOOD keys, elements and constellation talent bonuses), and `capture` (inventory
definitions, properties, affixes and skill types). The source revision equals
the capture catalog's `git_hash`. No achievement data is included.

GGScanner's scanner, capture and manager share this file and one local cache.
`mapping_achievements.json` remains independently hosted and is downloaded only
for achievement scanning. Manager and capture operations do not need it.

The shared endpoint requires revalidation, supports CORS, and is checked against
both generated input catalogs by `npm run data:scanner:check` before a web build.
Legacy endpoints remain available for old clients and website generation helpers.
Normal publishing is a validated Git push; no manual deployment is required.
