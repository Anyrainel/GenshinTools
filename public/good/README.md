# Scanner mappings

- `/good/mappings.json`: character, weapon, and artifact GOOD keys with Chinese names.
- `/good/mapping_achievements.json`: numeric achievement IDs with Chinese titles,
  using the same localized-name shape:

```json
{"achievements":[{"id":80127,"n":{"zh":"动物园大亨"}},{"id":80128,"n":{"zh":"动物园大亨"}}]}
```

Entries are sorted by numeric ID. Titles are not unique: multiple tiers or other
achievements can share a title. Consumers must preserve all matching IDs rather
than overwrite duplicate titles in a title-to-single-ID dictionary.

Regenerate the achievement mapping from the sibling GIlore repository:

```sh
uv run python -m anime_game_data reference --only achievement
```

The full `reference` command also generates it. Both commands write the released
achievement reference data and mapping to GIlore's `data/reference/`, and mirror
the mapping here for static serving by the site. The existing `mappings.json`
generator remains `scripts/codedump.py --good-keys` in GenshinTools.
