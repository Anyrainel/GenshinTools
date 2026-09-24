# Scanner achievement mappings

`/good/mapping_achievements.json` uses schemaVersion 2, with native category
IDs, Chinese `name.zh` values and nested achievement groups. Each category's
`achievements` is an array of arrays, including singleton groups.

Entries contain `id`, `name`, optional `hidden: true` (whole row hidden until
completed), and optional `requires` (all-of completed achievement IDs).
False hidden and empty requirements are omitted. Description-only concealment
does not set hidden. Grouping alone does not imply completion or exclusive
visibility. Titles can repeat; preserve every matching ID.

The full shared display/scanner contract is in HoyoData's
`docs/achievement-reference.md`. Display logic is separate from the en/zh
files; scanner data is self-contained and contains released achievements only.

Regenerate and synchronize from HoyoData:

```sh
uv run python -m anime_game_data reference --only achievement
```
