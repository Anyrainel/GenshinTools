# Scanner achievement mappings

`/good/mapping_achievements.json` uses `schemaVersion: 3`. Each category has
native `id`, Chinese `name.zh`, and an `achievements` list. Individual entries
have `id` and `name`; verified same-title chains instead have one shared
`name` and an ordered `stages` list with per-stage IDs. Stage order is native
progression order, independent of ID or title numbering. It implies earlier
stage prerequisites without redundant pointers.

Other dependencies use reciprocal `requires` and `requiredBy` ID arrays.
Optional `hidden: true` means the whole row is invisible until earned;
`total` provides a useful counter target. Repeated titles include localized
`desc` and `reward`, plus `unearnedDesc` when an unfinished description differs.
Empty dependency lists and false hidden flags are omitted. Match within the
category and preserve ambiguous candidates. Earned-but-unclaimed rewards count
as earned; absence from an OCR list alone proves neither completion nor failure.

Version 2's anonymous nested arrays are retired. No `replaces` fields are used.
The complete contract is in HoyoData's `docs/achievement-reference.md`.
Display logic remains separate from en/zh text; scanner data is self-contained.

Regenerate and synchronize from HoyoData:

```sh
uv run python -m anime_game_data reference --only achievement
```
