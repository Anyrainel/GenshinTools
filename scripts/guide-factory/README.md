# Guide Factory Lab

This folder is an offline, experimental workspace for gradually building a
Genshin guide factory. Nothing here is imported by `src/`, `worker/`,
`functions/`, or `public/`, and no generated result is a production preset.

The formats and algorithms are intentionally provisional. They should change
when real source data, validation failures, or computation experiments show
that the current model is inadequate.

## Boundary

The allowed dependency direction is:

```text
scripts/guide-factory -> existing repository data and calculation modules
```

Application and Worker code must not import this folder. The boundary test
checks this invariant.

## Current checkpoint

Checkpoint 6 adds a source-backed coupled artifact assignment and checks it
against the existing artifact-choice analyzer, without
claiming a working guide factory:

1. Register potential sources and their permitted ingestion mode.
2. Capture source-shaped snapshots without silently filling missing facts.
3. Consolidate those snapshots into one provisional repository format.
4. Validate objective structure and entity references.
5. Represent editorial team archetypes without expanding them into invented
   exact teams.
6. Compute baseline roster coverage without voting, scoring, or manufacturing
   a merged order.
7. Compare calculator-default formula counts with a source-authored rotation,
   preserving mismatches and unresolved mappings instead of choosing a winner.
8. Inventory explicit evidence coverage across the whole corpus without turning
   record counts into a quality score.
9. Materialize one explicit baseline build per member of an external exact team
   as a reproducible calculator fixture, not an equipment recommendation.
10. Compare source rotations using exact counts, genuinely source-optional
    ranges, and explicit partial token coverage when one source action has no
    calculator formula.
11. Enumerate the analyzer's released artifact-choice grammar and classify
    every artifact-choice field on non-rejected guide and team records as
    initially enumerated, conditionally representable, or not representable by
    that grammar.
12. Preserve source-stated multi-character artifact assignments as coupled
    plans, validate their team membership and catalogs, and audit each choice
    without pretending the analyzer can optimize the plan jointly.

The first two active sources are already in this repository:

- the current GenshinTools team and character-build presets;
- the legacy `scripts/team_comps_research.json` aggregate.

The legacy aggregate is deliberately retained as a candidate source. It lists
several domains globally but has no per-team locator, so consolidation must not
treat any row as verified external knowledge.

The active external observations are narrow, linked snapshots of KQM's Diona,
Furina, Keqing, and Kokomi Quick Guides. Diona remains the assumption-incomplete ER
pilot. Furina adds conditional builds, constellation-bounded advice, five team
templates, three exact example teams, and their published sample rotations. Two
of those exact teams are Quickbloom examples absent from the current baseline.
Its contextual weapon record includes Favonius Sword and Serenity's Call rather
than silently omitting them. Keqing adds one Lunar-Charged template and two
exact example teams with three published rotation variants. This deliberately
tests whether a new release can surface changed team options for an old
character; it does not claim that the examples are optimal. Every record
remains unreviewed and promotion-ineligible. Kokomi adds one exact
Lunar-Charged example whose artifact advice is intrinsically coupled: under the
source's undefined "well-invested Columbina" condition, Kokomi can take Silken
Moon's Serenade so Columbina can take Aubade. The condition and assignment are
preserved without inventing a breakpoint, reverse implication, or global
ranking. This is not a reusable KQM corpus adapter.

Mobalytics is registered as permission-blocked after its current terms were
reviewed. Technically accessible content is not automatically active knowledge.
Source-specific capture contracts live beside `sources/registry.json`.
Crimson Witch has a separate permission-gated source profile: its current app
looks structurally adaptable, but no public recommendation-data contract or
reuse grant has been established.
The archived gcsimactions repository is also permission-blocked: its
community-contributed configurations have no established reuse grant and use a
legacy APL language that requires explicit migration and renewed validation.

## Commands

Run from the repository root:

```powershell
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/import-sources.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/consolidate.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/validate.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/inventory-knowledge-corpus.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/compare-diona.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/analyze-team-template-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/draft-furina-neuvillette-formula-plan.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/draft-keqing-ineffa-formula-plan.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/analyze-artifact-choice-search-coverage.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/replay-diona-er-calibration.ts
npx tsx --tsconfig scripts/guide-factory/tsconfig.json scripts/guide-factory/src/replay-eula-structural-smoke.ts
npx tsc -p scripts/guide-factory/tsconfig.json --noEmit
npx vitest run --config scripts/guide-factory/vitest.config.ts
```

The Eula replay prints stable JSON to stdout and does not write or modify
knowledge, preset, or production data. It is explicitly a structural calculator
smoke test, not a guide result.

`import-sources.ts` and `consolidate.ts` produce byte-stable JSON when their
inputs have not changed.

`validate.ts` also reruns both adapters and consolidation in memory. It reports
an error if a saved snapshot or the consolidated repository is stale, so a
structurally valid but incomplete generated file cannot pass silently.
It also rebuilds all seven durable reports in memory: corpus inventory, team
coverage, artifact-choice search coverage, two formula-count comparisons,
Diona comparison, and historical ER calibration. Stale evidence cannot pass.

## Data flow

```text
sources/registry.json
        +
repository source files
        |
        v
data/source-snapshots/manual-index.json
        +
data/source-snapshots/*.json
        |
        v
data/knowledge/repository.json
        |
        v
validation and discrepancy reports
```

Source snapshots preserve what a source actually contains. The consolidated
repository preserves provenance and review status. Neither layer is allowed to
turn a selected item into a ranking or infer constellations, refinements, ER,
formula counts, or rotations that the source did not specify.

The descriptive corpus inventory currently counts 353 unique records: 129
character guides, 217 exact teams, 6 team templates, and 1 historical energy
record. Of those, 191 are baseline records and 162 are candidates. KQM
contributes 23 records, including 7 exact teams with 9 explicit rotation
entries. The inventory also reports explicit weapon, artifact, main-stat,
substat, and rotation presence by generated source. These are coverage facts,
not votes or recommendation confidence.

## What validation does not claim

Passing validation currently means that IDs, shapes, rankings, stat slots,
references, and formula-count syntax are internally consistent. It does not
mean that:

- a team is good or even playable;
- an equipment recommendation is correct;
- an ER value is sufficient;
- formula counts describe an executable rotation;
- a source is authoritative;
- two apparently conflicting sources share the same assumptions.

Those questions belong to later experiments and human review.

The team coverage report currently finds three templates with baseline matches,
one healer-dependent template that cannot be resolved without role data, and
two uncovered templates. The uncovered templates are Furina Quickbloom and
Keqing Lunar-Charged. The Keqing template keeps `off-field-hydro-applier` and
`resistance-shred` as unresolved role constraints; it is still uncovered, not
role-unresolved, because no baseline team contains the required Keqing–Ineffa
core. The exact KQM Furina/Neuvillette/Kazuha/Xilonen roster matches one current
preset. The other six exact KQM teams, including both Keqing examples and the
Kokomi/Ineffa/Columbina/Sucrose example, are uncovered. Source presence does
not automatically promote any of them into the
baseline.

That matched roster produces a calculator-default draft with 12 positive and 6
zero-count available formulas under explicit level 90, C0, R1, 10/10/10
assumptions. Translating KQM's Xilonen sample rotation exposes five
token-supported count mismatches: two on Neuvillette and three on Xilonen.
Furina's C0 Normal Attack and baked 32-hit Salon aggregate, Neuvillette's
Spiritbreath proc count, and Kazuha's absorbed plunge, absorbed Burst, and Swirl
counts remain six explicit unmapped cases. The translation is unreviewed and
supports no guide claim, but it is now a useful falsification target rather
than an unexamined default.

The uncovered Keqing/Ineffa/Furina/Xilonen source team now provides a second
falsification target. A source-backed scenario materializer pairs that exact
external roster with one explicit baseline build per member: Mistsplitter
Reforged plus 4pc Thundering Fury for Keqing, Fractured Halo plus 4pc Aubade of
Morningstar and Moon for Ineffa, Splendor of Tranquil Waters plus 4pc Golden
Troupe for Furina, and Peak Patrol Song plus 4pc Scroll of the Hero of Cinder
City for Xilonen. This is only fixture provenance. It does not establish that
the equipment suits the source team, and it copies no stat sheet, refinement,
or ER target.

Under explicit level 90, C0, R1, 10/10/10 and calculator-default combat
options, the resulting report exposes 13 positive and 5 zero-count available
defaults. Its source translation makes 11 exact count claims: 10 complete
mappings and one partial mapping. Furina's Skill count is exactly one because
the source footnote relocates that cast beside her Burst on subsequent
rotations; it does not make the cast optional. Six direct counts disagree with
defaults, five available formulas remain unresolved, and one source token has
no formula. Keqing's eight N1 hits have no C0 formula, so the Charged Attack
mapping covers only part of `8[N1C]`.

The readiness ledger classifies all 18 available formulas as 11 mapped, 5
unresolved, 2 source-absent, and 0 unclassified. Of 13 positive defaults, 10
are mapped and 3 unresolved. Eight blockers—unreviewed status, one partial
mapping, five unresolved formulas, and one unresolved source token—leave the
report not considered ready for a damage replay. This advisory flag is not
enforced by `replayTeamDamage`; the checkpoint does not produce or authorize a
replay. An enforced wrapper can be added later if useful. The experiment
demonstrated that scalar formula counts alone were inadequate; it did not
compute full rotation damage or validate the selected equipment.

The artifact-choice coverage report then calls the production analyzer's own
candidate builders against all eligible artifact occurrences in the knowledge
repository. The released search grammar contains 43 initial four-piece set
keys and a maximum of 14 stat-derived two-piece pair keys. The latter is an
upper bound: the runtime discovers a potentially smaller set only after
successful four-piece evaluations.

The report covers 1,052 non-rejected artifact-choice occurrences. Of 188 guide
builds, 167 are initially enumerated, 14 are only conditionally representable,
and 7 are not representable by the current grammar. Of 840 selected artifacts
on team members, 820 are initially enumerated, 7 are conditional, and 13 are
not representable. Of 22 character-guide and team-member recommendation
occurrences, 20 are initially enumerated and 2 are not representable. Both
assignments in the Kokomi/Columbina coupled plan are initially enumerated as
individual choices. That does not establish that the analyzer can search the
coupled assignment jointly. The 22
failures comprise 18 Instructor occurrences, 2 Exile occurrences, Freminet's
Cryo DMG plus Skill DMG pair, and C6 Yelan's repeated Hydro DMG pair. This is a
search-domain audit only: it does not run artifact generation, compute damage,
rank sets, or imply that any representable choice is suitable.

ER work is deferred. The Diona ER report remains an
`assumption-incomplete` historical fixture and is decoupled from unrelated
knowledge-repository growth.

Candidate catalog defects are warnings and promotion blockers. The same defect
is an error on a baseline or accepted record.
