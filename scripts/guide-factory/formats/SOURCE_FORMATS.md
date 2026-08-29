# Source Formats

Source formats preserve what each source actually exposes. They are not the
published guide format.

## Shared primitives

An artifact choice is either:

```json
{ "type": "4pc", "setId": "marechaussee_hunter" }
```

or:

```json
{
  "type": "2pc+2pc",
  "halfSetIds": ["atk%-18", "atk%-18"]
}
```

`halfSetIds` are effect-group identifiers from the existing application data,
not artifact-set identifiers. A validator resolves each group to the artifact
sets that can provide that 2-piece effect.

A source locator identifies the actual source record:

```json
{
  "file": "path/to/file.json",
  "recordId": "source-native-id",
  "jsonPointer": "/records/0"
}
```

or:

```json
{
  "url": "https://example.com/guide",
  "heading": "Teams > Example teams",
  "timestamp": "12:34"
}
```

Unknown values are omitted. Each record may carry an `unknowns` array so that
missing assumptions remain visible during review.

## `genshintools-presets-v1`

The adapter reads the existing team and character-build presets and emits two
independent record arrays:

- `teams`: exact selected team members, weapons, artifacts, reactions, and any
  stored ER floors;
- `characterGuides`: character-wide weapon order and build records containing
  artifact choices, main-stat weights, substat weights, roles, styles, and
  constellation gates.

The adapter does not join character builds onto team members. That association
is not present in either source file.

The current selected team weapon is preserved as `selectedWeaponId`; it is not
relabeled as rank 1 or best-in-slot.

## `legacy-team-research-v1`

The adapter reads `scripts/team_comps_research.json` and preserves each team,
selected weapon, selected artifact, name, and reaction label.

Its rare 2-piece-plus-2-piece entries name the two concrete artifact sets. The
source snapshot therefore preserves both the authored set IDs and a derived
effect-group proposal:

```json
{
  "type": "2pc+2pc",
  "sourceSetIds": ["tenacity_of_the_millelith", "vourukashas_glow"],
  "normalizedHalfSetIds": ["hp%-20", "hp%-20"]
}
```

Consolidation uses only `normalizedHalfSetIds`. If either set cannot be resolved,
the proposal is `null`, the canonical artifact choice is omitted, and the
normalization gap remains in `unknowns`.

Every row remains a candidate with these known unknowns:

- originating page and per-row source;
- patch and investment assumptions;
- constellation and refinement assumptions;
- main stats and substat priorities;
- ER floors and formula counts;
- whether a selected item represents a ranking or merely one example.

The global domain list is retained as snapshot metadata but is never attached
to individual rows as evidence.

## `structured-external-v1`

One source-native record maps to one proposal. A proposal may contain a team, a
character build, or both only when the original record itself contains both.

Rankings use ordered groups:

```json
[["weapon_a"], ["weapon_b", "weapon_c"]]
```

This means `weapon_a` is first and `weapon_b`/`weapon_c` share the next group.
A single group means the source listed alternatives without a known order.

Raw snapshots may be retained only when the source registry permits it.

## `manual-observation-v1`

Manual or agent-assisted extraction uses one JSON record per independently
reviewable page section, table, post, or video segment. It requires:

- a stable source locator;
- capture date and source patch when known;
- extraction method and review status;
- a narrow paraphrased proposal;
- explicit unknowns.

Rank behavior is explicit. `unranked` means array order is not evidence of
priority. A grouped choice says whether its members are alternatives or share a
rank; those meanings are never inferred from layout. Reviewed extraction must
name the reviewer and date. Extraction review confirms source fidelity only,
not gameplay acceptance.

Team examples preserve whether the source calls the list non-exhaustive and
whether it makes a power-ranking claim. ER tables are separate energy-guidance
records unless the source explicitly binds them to a particular team and
rotation. Rounded guide bands, formatted supporting-sheet cells, and raw
calculation values remain separate fields.

Agent output is always unreviewed and promotion-ineligible. It cannot update
accepted knowledge or copy an entire guide field by field.

### KQM Diona pilot

The pilot stores five heading-scoped records from one linked guide: weapons,
artifact sets, artifact stats, ER guidance, and one example team. The guide's
`Luna VIII` label and the linked ER sheet's Version 6.7 label are separate
provenance facts. KQM invites linked reference use, but no broad republication
license was found, so this format is not authorization for bulk ingestion,
mirroring, translation, or image reuse.

## `simulation-evidence-v1`

Simulation evidence records the engine revision, full config or config hash,
scenario, seeds/iterations, and outputs. It asserts only that a particular run
produced particular results. It does not assert that the team or rotation is
optimal.

## `account-observation-v1`

Account observations are user-initiated snapshots. They are personal inputs,
not population-level guide evidence.
