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

A `rotation_fixture` observation is allowed only when the source itself states
a standalone rotation and positive exact action counts. Its `formulaCounts`
retain source-local tokens, labels, and counts; they do not name calculator
formula IDs. Mapping a token to a calculator formula remains a separate,
reviewable derived step. Source-authored fixtures stay candidates with
`promotionEligible: false` and cannot turn a calculator default or a translated
notation guess into source evidence.

An exact-team member may preserve an exact constellation, a minimum, a maximum,
or both bounds. Exact and ranged shapes are mutually exclusive, and an absent
side is never invented. Thus a source-stated `C2+` member uses only
`minConstellation: 2`; it is not stored as exact C2 or copied into five records.
No investment fields means the source left that member's investment
unspecified, not that the team applies universally at C0-C6.

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
The index is the reviewed corpus boundary; a filesystem glob is not. An indexed
publisher must have active registry status, must not require permission, and
must use the manual-observation format and ingestion mode. Loading fails on
unsafe or noncanonical paths, missing indexed files, unindexed manual files,
case-equivalent duplicates, source-ID mismatches, duplicate publisher-local
record IDs across active files, or a registry policy that does not permit active
ingestion. Files are consolidated in canonical path order, and multiple pages
from one publisher share one grouped source revision.

Team archetypes use four explicit slots. A slot's `options` can accept named
characters, one or more elements, source-defined role labels, or any character;
those selectors are the alternatives used for coverage matching. Optional
`highlightedOptions` preserve source-recommended named characters, elements, or
roles inside a broader hard slot without narrowing it. Highlights cannot use
`any` and do not participate in coverage matching. Role labels remain
unresolved until a separate reviewed role catalog exists; they are not silently
mapped from character impressions.

A `character_role` observation may name positive character members for one
hard role option in one team-template slot from the same manual snapshot. Each
member may preserve source-stated conditions and optional minimum or maximum
constellation bounds. Exhaustiveness and ranking claims remain explicit source
claims; omission from a non-exhaustive or unspecified record is never negative
evidence, and array order is not a rank when `rankingClaim` is `none` or
`unordered`. A highlighted role is not a valid scope. These records remain
candidate, promotion-ineligible evidence and do not form or resolve a global
role catalog. A paired validation sample retains both fully captured source-
positive member lists, reports which members its explicit exact-team targets
exercise, and leaves the rest as unexercised evidence. It may validate only
named same-page target pairs; it must not fill, reject, or recommend the
remaining Cartesian product.

### KQM Diona pilot

The pilot stores five heading-scoped records from one linked guide: weapons,
artifact sets, artifact stats, ER guidance, and one example team. The guide's
`Luna VIII` label and the linked ER sheet's Version 6.7 label are separate
provenance facts. KQM invites linked reference use, but no broad republication
license was found, so this format is not authorization for bulk ingestion,
mirroring, translation, or image reuse.

### KQM Furina pilot

The second page stores 14 heading-scoped records: contextual weapons, artifact
sets, pre-C2 main stats, post-required-ER offensive substats without an ER
number, a C6 artifact option, five team templates, one narrow Xilonen healer
role observation, and three exact example teams.
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
The Xilonen observation is scoped only to the Hypercarry & Mono Element
template's hard healer slot. It is neither a complete nor ranked healer list,
adds no C0 applicability claim, and does not make that template globally
role-resolvable.
All records are unreviewed and promotion-ineligible.

### KQM Xiao pilot

The Xiao capture is split across two indexed snapshots from the visible
`Version 5.5` guide. The guide-input snapshot stores seven narrow records:
offensive artifact stats with ER deliberately deferred, separate Vermillion
Hereafter, Marechaussee Hunter, and Long Night's Oath context branches, grouped
five-star weapon tiers, an explicitly unranked four-star weapon list, and one
exact Xiao/Xianyun/Furina/Faruzan team. A fixture-only snapshot stores the one
source-authored no-buff `EEQ12HP` comparison fixture. This separation prevents
formula-fixture byte changes from invalidating guide-input or condition-array
reports that deliberately exclude rotation fixtures.

Long Night's Oath is bounded to `maxConstellation: 5`; the source's explicit
C6 exception is not generalized to the other artifact branches. The FFXX team
retains separate setup strings for C6 and non-C6 Faruzan, but Faruzan receives
no team-membership constellation floor. No ER target is captured. The
standalone fixture preserves two `E` and twelve `HP` source tokens without
claiming calculator formula IDs, damage values, equipment, or gameplay
optimality. All eight records remain agent-assisted, unreviewed, and
promotion-ineligible.

Checkpoint 42 keeps those raw-source semantics unchanged. Its source-local
condition adapter selects only three authenticated guide occurrences over the
exact FFXX roster: two Xianyun-presence predicates and one Xiao-C6 predicate
resolved by an independent request fact. Fourteen nonempty conditions and four
empty arrays remain unconsumed. A separate derived formula-count witness owns
an unreviewed `E -> xiao-skill` and `HP -> xiao-plunge-high` alias table. It
records calculator-default counts 2 and 11 beside source counts 2 and 12, but
the aliases and comparison are Guide Factory evidence, not fields added to the
source snapshot. Count parity does not establish identical formula semantics,
and the mismatch does not establish which side is correct. The witness pins
the fixture's source-document metadata and declared-file hashes without
claiming transitive runtime-code closure; its aggregate consumer independently
rebuilds the raw fixture/preset semantic scope.

Checkpoint 43 does not change either Xiao source snapshot. Its downstream
projection fresh-authenticates the exact raw guide snapshot and checkpoint-42
slice before exposing a source-only FFXX view and a separate wrapper-C6 request
view. The wrapper-owned constellation fact remains outside the source record,
and equal Anemo Goblet payloads retain their distinct source-condition reasons.

Checkpoint 44 likewise adds no source record. It joins only the two
checkpoint-43 singleton payload identities into a Guide Factory-authored
partial technical candidate. The source-only and wrapper-C6 views remain
separate evidence bindings, and weapon, Sands, Circlet, and substats remain
unadmitted rather than being copied from nearby Xiao records.

Checkpoint 45 also leaves the raw and consolidated source formats unchanged.
It projects thirteen exact existing observations from the five-star weapon,
four-star weapon, and offensive-stat records. Ranked five-star groups retain
their tied membership; four-star positions remain unranked provenance and do
not create a cross-rarity order. Exact conditions, classifications, stat
priorities, and targets are preserved. The adapter's labels for condition-free
versus guarded/deferred handling are Guide Factory-authored interpretation
boundaries, not new KQM fields or evidence that a guard is satisfied.

Checkpoint 46 adds no source record or source-format field. It combines only
checkpoint 45's four empty-condition observations with checkpoint 44's partial
candidate under a Guide Factory-authored `1 x 6 x 1` enumeration boundary. Its
candidate IDs, technical/provenance hashes, missing-axis policies, and inherited
view bindings are derived report fields. They must never be written back as KQM
authorship, source ranking, source compatibility, or a complete source build.

Checkpoint 47 also leaves every source snapshot and consolidated record
unchanged. It consumes checkpoint 42's formula IDs/counts and checkpoint 46's
partial candidates, then adds only Guide Factory-authored execution order,
reaction/on-field flags, investment/refinement values, combat options, artifact
sheet materialization, and representation observations. The KQM team record
supports roster provenance only in this computation, and the GenshinTools team
record authenticates roster equality only; supporter equipment copied for
calculator runnability is wrapper configuration rather than source-authored
investment or a Xiao build.

The source rotation's exact no-external-buffs assumption is authenticated only
to explain why its twelve-plunge plan is withheld from the externally buffed
FFXX fixture. The six grouped failures, six unit-expanded agreements, numeric
totals, Xianyun activation traces, fixture hashes, and non-comparable status are
derived computation evidence. None may be written back as KQM formula order,
source damage, source ranking, a recommended weapon, or a reusable source
rotation.

Checkpoint 48 adds no source record, source field, or computed correction. Its
count expansion operates on checkpoint 42's calculator-default formula IDs and
counts in checkpoint 47's wrapper-authored order. The resulting normalized
plan, eligibility flags, numeric observations, and execution hashes are Guide
Factory-derived fields only.

The two ranked five-star groups and unranked Deathmatch group may be copied into
the checkpoint-48 report solely as a separate provenance projection. Their
rank, rarity, tied membership, source classifications, occurrence locators, and
candidate edges must not enter technical identity or be rewritten based on the
computed totals. Checkpoint 48 performs no source-group comparison; future
overlap or discrepancy output must remain a derived validation target and must
not mutate the KQM snapshot or consolidated recommendation rows.

### KQM Itto pilot

The Itto page stores seven narrow records from the visible `Version 5.6` guide:
artifact stats, contextual sets, contextual weapons, one
Itto/Xilonen/PHEC/PHEC template, two variants from the shared
Yelan-or-Xingqiu example card, and one C2+ Xilonen/Gorou/Furina example.

The template retains the source's explicit Crystallize reaction. The two
PHEC variants share the same source-card locator rather than pretending the
page publishes two headings. The C2+ Xilonen member carries only a lower
constellation bound; the other eleven exact-team member observations remain
constellation-unspecified.

Husk, Furina/Marechaussee Hunter, owned-set Retracing Bolide, and
Xianyun/Long Night's Oath remain separate contextual groups. Redhorn, Serpent
Spine, Whiteblind, and Fruitful Hook also remain unranked contextual groups.
The conditional DEF% Goblet does not receive a persistent lower ordinal rank,
because the source says it can outperform Geo DMG Bonus under its condition.

The source's ER term and sample rotations are deliberately outside this narrow
capture. The offensive substat tail retains text saying it begins only after
the omitted ER need. All seven records are agent-assisted, unreviewed,
promotion-ineligible, and contain no formula counts or damage claims.

A derived Itto packet experiment may pin these exact condition arrays to a
source-specific typed predicate map. That map is Guide Factory interpretation,
not a mutation of the seven source records or a reusable natural-language
condition parser; any condition-text drift must fail closed.

### KQM Keqing pilot

The Keqing page stores 24 participating heading-scoped records from the visible
Luna I guide version: one Lunar-Charged template, two positive character-role
inventories, four exact example teams, and seventeen equipment/stat
observations. It is a source-breadth test for detecting new-release team and
build changes for an old character, not an optimality claim.

The template hard-requires Keqing and Ineffa. Its other hard selectors are the
source-defined roles `off-field-hydro-applier` and `resistance-shred`; Hydro,
Anemo, and Xilonen are retained as highlights instead of being weakened into
element-only requirements. This avoids false coverage until reviewed role data
exists. Because no baseline team contains the required Keqing–Ineffa core, the
coverage result is uncovered rather than role-unresolved.

The off-field-Hydro record names Furina, Aino, Yelan, and Xingqiu. The
resistance-shred record names Kazuha, Sucrose, Jean, Xianyun, Sayu, and Xilonen;
the five Anemo members retain the source-stated Viridescent Venerer condition.
Both inventories have unspecified exhaustiveness and no rank. Four published
pairs are exercised by exact teams: Furina/Xilonen, Aino/Sucrose, Furina/Jean,
and Yelan/Kazuha. Xingqiu, Xianyun, and Sayu remain positive but unexercised;
their absence from an example is not negative evidence, and no other pair is
inferred.

The four exact teams retain seven published rotation variants and their nearby
assumptions. None supplies or receives a numeric ER target, equipment ranking,
formula mapping, or inferred investment level. All remain examples with no
power-ranking claim, unreviewed and promotion-ineligible.

The seventeen guide records keep the Lunar-Charged stat order and contextual
artifact/weapon branches separate. Furina/Marechaussee Hunter, Aino/two-Nod-
Krai Night of the Sky's Unveiling, traditional-set Jade Cutter, exceptional-EM
Foliar, shield uptime, equal refinement, and Bond-of-Life clearance remain
distinct source conditions. Undefined thresholds are not filled from roster
presence. Whimsy plus Finale is deliberately omitted because V1 cannot bind
the two choices atomically. All records are agent-assisted, unreviewed,
promotion-ineligible, and contain no ER target.

### KQM Kokomi pilot

The Kokomi page stores two heading-scoped records from the visible Luna V
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

## Isolated `artifact-rating-model-v1` pilot

This format preserves one ArtifactRatingDB entry with its raw `main`, `max`,
and `weight` objects plus an exact normalized stat-key projection. The upstream
`weight` field is retained as source-native heuristic coefficients, not renamed
to a ranking, priority order, marginal sensitivity, or recommendation. Team,
role, weapon, constellation, and scenario remain explicitly unknown.

Checkpoint 35 uses the Keqing entry only through a five-file standalone
validation wrapper. The wrapper authenticates the snapshot, repository, local-
marginal report, raw KQM snapshot, and KQM equipment-evidence report. It
requires raw-KQM/repository parity and reauthenticates the equipment report's
exact-team, default-main-stat, and eight-claim projections, including seven
exact-team matches and one unresolved secondary condition. Ten output rows
retain only sign/zero classifications: four source-nonzero/local-positive,
four source-zero/local-zero, one Elemental Mastery objective-coverage gap, and
one Electro DMG Bonus source-main-only row.

Coefficient and marginal magnitudes are never compared. KQM priority values
are not sorted. Cross-source context comparability is not established. Two
`SPRatioBase` occurrences remain present with `ignored-deferred-energy`
handling, while the local objective retains eight readiness blockers. The
wrapper produces no guide, rank, scalar stat weight, promotion, or ER result.

The format remains outside the shared source registry and consolidation
pipeline because permission is mixed and consolidation is blocked pending
review. The checkpoint 35 report is durable isolated evidence, but it is not a
shared source adapter, consolidated knowledge record, catalog input, global-
validator input, or application asset.

## `simulation-evidence-v1`

Simulation evidence records the engine revision, full config or config hash,
scenario, seeds/iterations, and outputs. It asserts only that a particular run
produced particular results. It does not assert that the team or rotation is
optimal.

## `account-observation-v1`

Account observations are user-initiated snapshots. They are personal inputs,
not population-level guide evidence.
