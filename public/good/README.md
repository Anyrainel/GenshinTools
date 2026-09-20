# Scanner mappings

- `/good/mappings.json`: character, weapon, and artifact GOOD keys with Chinese names.
- `/good/mapping_achievements.json`: numeric achievement and category IDs with Chinese names,
  using the same localized-name shape:

```json
{"categories":[{"id":0,"n":{"zh":"天地万象"}}],"achievements":[{"id":80127,"categoryId":0,"n":{"zh":"动物园大亨"}},{"id":80128,"categoryId":0,"n":{"zh":"动物园大亨"}}]}
```

Both lists are sorted by numeric ID. Group achievements by `categoryId` and look
up the matching `categories[].id` for the category name. Category ID `0` is valid
(天地万象). The flat achievement list is retained for existing consumers.

Titles are not unique: multiple tiers or other
achievements can share a title. Consumers must preserve all matching IDs rather
than overwrite duplicate titles in a title-to-single-ID dictionary.

Regenerate the achievement mapping from the sibling HoyoData repository:

```sh
uv run python -m anime_game_data reference --only achievement
```

The full `reference` command also generates it. Both commands write the released
achievement reference data and mapping to HoyoData's `data/reference/`, and mirror
the mapping here for static serving by the site. The existing `mappings.json`
generator remains `scripts/codedump.py --good-keys` in GenshinTools.
