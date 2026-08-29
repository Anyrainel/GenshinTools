# Checkpoint 6: Coupled Artifact Knowledge

Date: 2026-08-29

This checkpoint still is not a guide factory. It adds one source-backed case
that the previous schema could not express faithfully: an artifact choice for
one team member that is conditional on a different artifact choice for another
member. It then validates that knowledge against the existing artifact search
grammar without claiming that the analyzer performs joint optimization.

ER work remains deferred. No new energy targets, energy computations, or ER
source tables are included.

## Source slice

The active manual corpus now includes two narrow records from KQM's Kokomi
Quick Guide at its visible Luna V version:

- a contextual Kokomi observation for 4pc Silken Moon's Serenade in a Nod-Krai
  team;
- the exact Kokomi/Ineffa/Columbina/Sucrose Lunar-Charged example.

The source labels its example-team list non-comprehensive and does not use
inclusion as a power ranking. The snapshot therefore stores the team as an
unranked, non-exhaustive example.

For that exact team, the source says 4pc Ocean-Hued Clam performs well on
Kokomi and gives one conditional alternative: when Columbina is
"well-invested," Kokomi can hold 4pc Silken Moon's Serenade so Columbina can
use 4pc Aubade of Morningstar and Moon. The snapshot does not invent:

- a quantitative investment breakpoint;
- a reverse implication;
- Columbina's default set when the condition does not apply;
- a global order between Clam and the delegated assignment;
- weapons, refinements, ER targets, formula counts, duration, reaction
  ownership, or enemy assumptions.

The sample rotation is retained as source notation. Ineffa's and Sucrose's
parenthesized Bursts remain optional when available, and Kokomi's linked combo
remains unresolved rather than receiving fabricated hit counts.

## Coupled artifact-plan model

Manual and consolidated exact-team records may now contain optional
`artifactPlans`. Each plan has a stable ID, classification, conditions, and at
least two character-to-artifact assignments.

Validation requires:

- unique plan IDs within the team;
- distinct assignment owners within a plan;
- every owner to be a member of the exact team;
- every four-piece set and two-piece effect family to pass the existing
  artifact catalog checks.

Consolidation deep-clones and preserves the source plan. It does not flatten
the assignments into a rank, merge them with other character advice, or infer
an equipment combination that the source did not state.

## Corpus and coverage deltas

The consolidated repository now has 353 records:

- 191 baseline and 162 candidate records;
- 129 character guides, 217 exact teams, 6 team templates, and 1 historical
  energy record;
- 23 KQM records, including 7 exact teams and 9 explicit rotation entries.

The new exact team is not present in the baseline. Exact external-team coverage
therefore becomes 1 present and 6 uncovered. This is presence only, not a team
quality result.

The artifact search-space report now accounts for every artifact choice on a
non-rejected character-guide or exact-team record:

| Repository slice | Total | Initial 4pc | Conditional 2pc | Not representable |
| --- | ---: | ---: | ---: | ---: |
| Guide builds | 188 | 167 | 14 | 7 |
| Team-member selected artifacts | 840 | 820 | 7 | 13 |
| Guide and team-member recommendations | 22 | 20 | 0 | 2 |
| Coupled-plan assignments | 2 | 2 | 0 | 0 |
| All eligible occurrences | 1,052 | 1,009 | 21 | 22 |

The 22 pre-existing gaps are unchanged: 18 Instructor occurrences, 2 Exile
occurrences, Freminet's Cryo-DMG-plus-Skill-DMG pair, and C6 Yelan's repeated
Hydro-DMG pair.

Both assignments in the new plan are names in the analyzer's initial
four-piece grammar. This proves only individual naming coverage. The analyzer
still varies one character at a time, so the report explicitly says it cannot
establish joint enumeration, joint evaluation, suitability, or optimality of
the coupled plan.

## Blocked simulation archive

The source registry now distinguishes the archived `gcsimactions` repository
from the gcsim engine. The archive is potentially useful as a future parser
fixture or coverage canary, but it is not active knowledge:

- its files are community-contributed configurations;
- no repository license file or contributor-data reuse grant was established;
- its old APL language has no clean automatic migration to the current gcsim
  format;
- a translated configuration would require separate migration provenance and
  renewed gameplay validation.

The source is therefore permission-blocked. No TOML file or derived team/build
record was ingested or vendored.

## Validation and boundaries

The source adapter and consolidation output are regenerated from their inputs.
Durable reports hash their source modules, catalogs, source registry, and
knowledge repository as applicable. `validate.ts` reconstructs the pipeline
and reports zero errors; the 12 existing legacy weapon-type mismatches remain
warnings.

Verification at this checkpoint:

- guide-factory TypeScript check passed;
- all 18 guide-factory test files passed, with 86 tests total;
- the focused artifact-plan, Kokomi, corpus-inventory, and artifact-coverage
  set passed all 16 tests;
- dependency-cruiser found no violations across 754 application/test modules
  and 3,975 dependencies;
- an independent audit reproduced all 1,052 eligible artifact occurrences,
  unique observation IDs, report hashes, and corpus counts.

All new data, schemas, reports, tests, and documentation remain below
`scripts/guide-factory`. No application or Worker file imports this folder, so
the website bundle is unchanged.

The outputs still contain no artifact score, damage result, rank, winner, guide
recommendation, or ER result. No candidate is promoted to accepted knowledge or
written to production presets.

## Next evidence gates

1. Audit the analyzer's weapon candidate policy across all non-ER repository
   occurrences, keeping ID coverage, refinement specificity, and native weapon
   type compatibility as separate outcomes.
2. Decide whether non-five-star support sets need a dedicated artifact search
   mode and how damage-oriented two-piece families enter the grammar.
3. Run actual artifact generation only for a reviewed fixture and preserve
   candidate-specific failures rather than collapsing them into a winner.
4. Require a reviewed formula plan, combat context, and authored stat sheet
   before any damage-based equipment comparison.
5. Keep ER deferred until a user-supplied or independently reviewed sequence
   makes the assumptions testable.

None of these outputs may modify production presets without a separate review
and acceptance step.
