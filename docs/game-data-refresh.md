# Game data refresh

HoyoData owns the complete released-data export. From GenshinTools, this command
delegates to its `genshintools` target:

```powershell
npm run data:refresh
```

Explicit `scripts/codedump.py` flags run individual generation steps. Use the
command above for a full refresh.

The sequence is:

1. Pull the AGD checkout and export all GenshinTools source data, including character,
   weapon, artifact, enemy, achievement, boss, and capture-cache data.
2. Refresh HoYoWiki catalogs and artwork, plus artifact half sets.
3. Regenerate character metadata, including constellation talent bonuses.
4. Regenerate Enka stat IDs from the capture cache and GOODScanner mappings from
   the exported game JSON and the new character metadata.
5. Check mapping coverage, character catalog coverage, website assets,
   scheduled boss artwork, and positive finite character/weapon/artifact stats.

All wiki generation modes fail on scraping, parsing, and asset-download exceptions;
there is no permissive mode or optional strict flag. Expected exclusions such as
unreleased placeholder entries remain exclusions. Detailed wiki/Fandom extraction
is retained behind `codedump.py --details` for explicit maintenance; routine refreshes
use HoYoWiki catalogs/names/artwork and HoyoData for detailed game data.

The command stops on failure and exits unsuccessfully. Earlier successful steps
may have written files; inspect the diff and rerun after addressing the failure.
Coverage baseline changes require separate review and acceptance in HoyoData.
The command does not commit, push, or deploy.

Achievement coverage follows eligible definitions in the released source, not
the historical release-version map. HoyoData annotates new IDs from cached
production history when available; missing optional version labels cannot
silently exclude new achievements. Logic, both languages, and scanner mappings
are generated together.

HoyoData recovers renamed numeric property/curve fields from content anchors
before generating stats. Final validation rejects zero or non-finite base stats
and artifact main stats, even when the exported collections are non-empty.

HoyoData (formerly GIlore) is expected at `../HoyoData`. Override it with
`npm run data:refresh -- --hoyodata-root <path>`. Both repositories need their
Python dependencies installed, and HoYoWiki scraping requires Playwright Chromium.

Other modes:

```powershell
# Show every step without downloading or writing
npm run data:refresh -- --dry-run

# Export the existing AGD checkout without pulling it
npm run data:refresh -- --skip-pull

# Export cached raw data and rebuild using existing website catalogs/artwork
npm run data:refresh -- --cached-sources
```

From HoyoData, run `uv run hoyodata genshintools --pull` for the same full pipeline.
The old `reference` target has been removed. `scripts/generate_website_data.py`
is the internal website-generation stage called by HoyoData; it cannot refresh
source data by itself. GenshinTools coverage excludes unrelated lore and engine
constants and still rejects missing required data, mappings, catalogs, or assets.

Unreleased beta data remains managed by `scripts/lunaris.py`. Damage implementations,
particle/energy data, and manually curated metadata are separate reviewed work;
the refresh command does not generate those implementations.
