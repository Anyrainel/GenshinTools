# Game data refresh

Run the complete released-data refresh from GenshinTools:

```powershell
npm run data:refresh
```

The existing no-flag command, `uv run --project scripts python scripts/codedump.py`,
now calls the same pipeline. Explicit codedump flags still run individual steps.

The sequence is:

1. Pull the AGD checkout and run HoyoData's reference export, including character,
   weapon, artifact, enemy, achievement, boss, and capture-cache data.
2. Refresh HoYoWiki catalogs and artwork, plus artifact half sets.
3. Regenerate character metadata, including constellation talent bonuses.
4. Regenerate Enka stat IDs from the capture cache and GOODScanner mappings from
   the exported game JSON and the new character metadata.
5. Check mapping coverage, character catalog coverage, website assets, and
   scheduled boss artwork.

The command stops on failure and exits unsuccessfully. Earlier successful steps
may have written files; inspect the diff and rerun after addressing the failure.
Coverage baseline changes require separate review and acceptance in HoyoData.
The command does not commit, push, or deploy.

HoyoData (formerly GIlore) is expected at `../HoyoData`. Override it with
`npm run data:refresh -- --hoyodata-root <path>`. Both repositories need their
Python dependencies installed, and HoYoWiki scraping requires Playwright Chromium.

Other modes:

```powershell
# Show every step without downloading or writing
npm run data:refresh -- --dry-run

# Export the existing AGD checkout without pulling it
npm run data:refresh -- --skip-pull

# Regenerate derived files from existing website JSON/catalogs without networking
npm run data:refresh -- --cached-sources
```

HoyoData's `reference` command remains a lower-level source export. Running it
alone does not refresh the website catalogs, character metadata, or scanner
mappings. This split caused the September 7.1 refresh to omit the GOOD mapping
step. The old codedump default only scraped website catalogs and generated GOOD
keys; it did not invoke HoyoData, character metadata, or Enka generation.

Unreleased beta data remains managed by `scripts/lunaris.py`. Damage implementations,
particle/energy data, and manually curated metadata are separate reviewed work;
the refresh command does not generate those implementations.
