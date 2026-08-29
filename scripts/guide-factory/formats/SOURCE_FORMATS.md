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

A team may carry a coupled artifact-assignment plan when the source explicitly
ties multiple members' sets together:

```json
{
  "id": "conditional-artifact-delegation",
  "classification": "conditional",
  "conditions": ["The source-stated team condition."],
  "assignments": [
    {
      "characterId": "character_a",
      "artifact": { "type": "4pc", "setId": "support_set" }
    },
    {
      "characterId": "character_b",
      "artifact": { "type": "4pc", "setId": "offensive_set" }
    }
  ]
}
```

Plans require at least two distinct members of that exact team. Their IDs,
membership, and artifact catalogs are validated, and consolidation preserves
the coupling. A plan is not a generic loadout, a global recommendation, or
evidence that the current analyzer can optimize the assignments jointly.

Active manual files are listed in `data/source-snapshots/manual-index.json`.
The index is the reviewed corpus boundary; a filesystem glob is not. Loading
fails on unsafe or noncanonical paths, missing indexed files, unindexed manual
files, case-equivalent duplicates, source-ID mismatches, and duplicate
publisher-local record IDs across active files. Files are consolidated in
canonical path order, and multiple pages from one publisher share one grouped
source revision.

Team archetypes use four explicit slots. A slot's `options` can accept named
characters, one or more elements, source-defined role labels, or any character;
those selectors are the alternatives used for coverage matching. Optional
`highlightedOptions` preserve source-recommended named characters, elements, or
roles inside a broader hard slot without narrowing it. Highlights cannot use
`any` and do not participate in coverage matching. Role labels remain
unresolved until a separate reviewed role catalog exists; they are not silently
mapped from character impressions.

### KQM Diona pilot

The pilot stores five heading-scoped records from one linked guide: weapons,
artifact sets, artifact stats, ER guidance, and one example team. The guide's
`Luna VIII` label and the linked ER sheet's Version 6.7 label are separate
provenance facts. KQM invites linked reference use, but no broad republication
license was found, so this format is not authorization for bulk ingestion,
mirroring, translation, or image reuse.

### KQM Furina pilot

The second page stores 13 heading-scoped records: contextual weapons, artifact
sets, pre-C2 main stats, post-required-ER offensive substats without an ER
number, a C6 artifact option, five team templates, and three exact example
teams.
The source's contextual weapon sections are not turned into one global ranking.
Advice bounded to “before C2” uses `maxConstellation: 1`; the C6 artifact option
uses `minConstellation: 6`.

The contextual weapon observation includes Favonius Sword and Serenity's Call
with their source conditions but no computed ER target. The exact team retains
the source's Xilonen sample rotation. The two exact Quickbloom examples retain
their simple or advanced rotations and the stated artifact condition for the
Cyno combo. Formula counts translated from notation remain separate unreviewed
computation reports rather than source facts in this format.

The five templates are non-exhaustive and do not imply that every matching
composition is source-endorsed or optimal. Exact examples remain separate team
records. The Vaporize healer, Freeze Escoffier/Anemo, and Electro-Charged
Anemo callouts are preserved as highlights rather than hard slot constraints.
All records are unreviewed and promotion-ineligible.

### KQM Keqing pilot

The third page stores three heading-scoped team records from the visible Luna I
guide version: one Lunar-Charged template and two exact example teams. It is a
source-breadth test for detecting new-release team changes for an old character,
not a broad Keqing build extraction or an optimality claim.

The template hard-requires Keqing and Ineffa. Its other hard selectors are the
source-defined roles `off-field-hydro-applier` and `resistance-shred`; Hydro,
Anemo, and Xilonen are retained as highlights instead of being weakened into
element-only requirements. This avoids false coverage until reviewed role data
exists. Because no baseline team contains the required Keqing–Ineffa core, the
coverage result is uncovered rather than role-unresolved.

The Furina/Xilonen example retains two published rotation variants. The
Aino/Sucrose example retains one rotation and its every-other-rotation Burst
scheduling note. Neither record supplies or receives a numeric ER target,
equipment ranking, formula mapping, or inferred investment level. Both remain
examples with no power-ranking claim, unreviewed and promotion-ineligible.

### KQM Kokomi pilot

The fourth page stores two heading-scoped records from the visible Luna V
guide: one contextual Kokomi artifact observation and one exact
Kokomi/Ineffa/Columbina/Sucrose Lunar-Charged example. The team remains one
example in a source-declared non-comprehensive list and carries no power rank.

The source says Ocean-Hued Clam performs well on Kokomi in that team and gives
one conditional alternative: with a well-invested Columbina, Kokomi can hold
Silken Moon's Serenade so Columbina can use Aubade of Morningstar and Moon. The
snapshot stores both member-level observations and one coupled two-assignment
plan. It does not infer how much investment is sufficient, what Columbina uses
otherwise, the reverse condition, or which plan is globally better.

The published sample rotation is retained with Ineffa's and Sucrose's Bursts
marked optional when available. Kokomi's linked combo remains unresolved. No
ER values, formula counts, hit counts, weapon choices, refinements, duration,
or enemy assumptions are added.

Mobalytics was considered as a second publisher but is registered as
permission-blocked under its current terms. No Mobalytics observation file is
part of the active corpus.

## `simulation-evidence-v1`

Simulation evidence records the engine revision, full config or config hash,
scenario, seeds/iterations, and outputs. It asserts only that a particular run
produced particular results. It does not assert that the team or rotation is
optimal.

## `account-observation-v1`

Account observations are user-initiated snapshots. They are personal inputs,
not population-level guide evidence.
