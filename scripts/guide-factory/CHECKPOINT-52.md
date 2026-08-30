# Checkpoint 52: Noelle Hexerei weapon/team source binding

This checkpoint tests the first narrow same-source cross-record composition for
Noelle. It asks whether one conditional Gest of the Mighty Wolf source
observation can be treated as applicable to one exact team because that team is
listed by the same source under its Hexerei Teams section. It produces one
validation target, not a weapon assignment, equipment candidate, selection, or
recommendation from the Guide Factory.

## Exact authenticated boundary

The durable report authenticates the exact same sorted 16-path text boundary in
both `sourceFiles` and `generatedFrom`. Every declared lowercase SHA-256 must
match the corresponding text. The boundary contains:

- the consolidated knowledge repository, KQM Noelle manual snapshot, manual
  snapshot index, and source registry;
- the durable Noelle high-investment source-local slice report;
- that slice's core and CLI;
- its shared request-context, source-local condition, source-conditioned
  packet, manual-condition coverage, schema, I/O, and path modules; and
- the checkpoint-52 core and CLI.

Five JSON inputs require authenticated-text and separately supplied parsed-
object parity: the repository, Noelle manual snapshot, manual index, source
registry, and durable high-investment report. Missing or duplicate paths,
invalid hashes, malformed JSON, and parsed-object/text split-brain inputs fail
closed.

The checkpoint reconstructs the complete 13-path input for the existing Noelle
high-investment source-local slice from the outer authenticated text and hashes,
then fresh-authenticates its durable report. This is the high-investment source
slice also used by checkpoint 51; checkpoint 52 does not depend on or
authenticate checkpoint 51's artifact-profile report.

The focused AST test independently checks that every local value import from
the checkpoint-52 core and CLI remains inside the declared 16-path boundary.

## Held-out Gest source condition

The fresh-authenticated high-investment slice contains exactly one relevant
holdout occurrence:

- occurrence:
  `kqm:character_guide:noelle-hexerei-gest-luna-viii:recommendation.weaponRecommendations[0].conditions`;
- condition: `Noelle is played in a Hexerei team.`; and
- condition SHA-256:
  `f27375a8ce8833cc0326a17c94f52c71ed4f44a72868e15d087390b864e490cf`.

The upstream occurrence remains a `holdout`, is not consumed, has no binding
authored by that slice, and has no energy classification authored by that
slice. Its structural dimension is only `not-structural-er`; this does not
provide an ER requirement or prove ER adequacy.

Checkpoint 52 does not retroactively modify that upstream row. It records the
upstream provenance and authors a separate local cross-record binding.

## Exact same-page source parity

Two manual observations and their consolidated repository records are pinned:

- the Noelle Gest weapon observation; and
- the Noelle — Durin — Nicole — Xilonen example team.

Both records come from the KQM Noelle Quick Guide, Luna VIII, at the exact same
page URL. Each manual and consolidated record hash is pinned. The Gest
recommendation payload matches exactly, including its single grouping,
conditional classification, unranked ordering, exact weapon ID, and exact
condition. The team payload matches the repository's defined normalization of
the manual observation, including its ordered roster, example intent,
non-exhaustive scope, no ranking claim, rotation payload, empty damage plan,
source references, and unreviewed-extraction warning.

The exact team locator is:

`Teams > Hexerei Teams > Example Teams > Noelle — Durin — Nicole — Xilonen`

The source team member row for Noelle contains an empty
`weaponRecommendations` array, and the consolidated member has
`selectedWeapon: null`. The source also leaves refinement assumptions,
team-member weapons and refinements, quantitative weapon performance, and
comparison against other weapons missing. Those fields are missing, not zero
and not inferred.

The repository records retain `candidate` as their ingestion status and
`promotionEligible: false`. That repository status is not a Guide Factory
equipment candidate and does not authorize publication.

## Guide Factory-authored exact-team binding

The source authored both the Gest condition and the team's placement under the
Hexerei Teams section. It did not author a cross-record join assigning Gest to
Noelle in this exact team.

Checkpoint 52 uses one exact condition-and-heading allowlist to author a local
binding classified as:

`applicable-under-source-section-classification`

The binding is scoped only to
`kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii`. It sets
`arbitraryEnglishParsingAllowed: false`; it is not a reusable parser for team
headings or arbitrary guide prose. Its authorship ledger records that the
source condition and section classification are source-authored, while the
cross-record join is Guide Factory-authored.

The output is one hashed validation target associating Noelle, Gest of the
Mighty Wolf, and that exact team. It creates no team weapon assignment, no
selection, no rank, and no derived equipment recommendation.

## Capability and operation boundary

Checkpoint 52 performs no recommendation composition, candidate generation,
team or build composition, weapon, artifact, or equipment assignment,
selection, ranking, generator, AutoTune, optimizer, damage computation,
rotation replay, ideal-stat allocation, or Energy Recharge computation. Every
corresponding operation count is zero.

It supports no source-authorization, guide, team, build, equipment, stat,
ideal-allocation, rank, damage, rotation, or ER claim. In particular:

- do not publish the binding as a Noelle guide, team recommendation, equipment
  recommendation, or build;
- do not claim the source assigned Gest to Noelle in the exact team;
- do not infer a refinement, quantitative comparison, weapon rank, selection,
  or winner;
- do not generalize the binding to another Hexerei team or arbitrary team; and
- do not infer damage, rotation feasibility, DPS, ideal stats, or an ER target.

## Verification

The focused checkpoint-52 suite passes 12/12 tests. It independently checks
the 16-path and five-JSON boundary, deterministic rebuild and self-
authentication, exact source and normalized repository parity, upstream
holdout provenance, binding authorship, missing refinement and assignment
fields, every zero-capability flag, static import closure, and fail-closed
behavior for raw, hash, JSON, source, repository, upstream-report, and
serialized-report tampering.

Guide Factory TypeScript passes, and the no-write workspace builder produces
the same freshly authenticated report without writing a file.

The durable report is
`scripts/guide-factory/reports/noelle-hexerei-weapon-team-source-binding.json`.
It is 10,810 bytes with SHA-256
`e0528e977ebf574b42e12f260880ec226c9591025a76e6ec78a2cdd02ced97b8`.

## Next step toward composition

A later checkpoint may fresh-authenticate both checkpoint 51's partial
high-investment artifact profile and this exact-team Gest applicability target,
then compose them into an explicitly incomplete exact-team scenario. That step
must retain the separate source and Guide Factory authorship ledgers and must
not create a weapon selection merely because one applicability condition is
validated.

Before any computed equipment comparison or candidate admission, the factory
still needs authenticated refinement assumptions, a comparison domain,
quantitative weapon behavior, complete build and enemy inputs, and an exact
formula representation for the source rotation's `N3D` and `N2` prefixes. ER
remains deferred.
