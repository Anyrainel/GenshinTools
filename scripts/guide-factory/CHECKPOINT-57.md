# Checkpoint 57: Noelle request-conditioned candidate admission

## Outcome

Checkpoint 57 adds a fail-closed control-flow layer between authenticated
partial candidates and local computation evidence. It does not produce a build,
stat priority, rank, or guide.

The durable report is:

- `reports/noelle-hexerei-request-conditioned-candidate-admission.json`
- 663,723 bytes
- SHA-256
  `a0fa6a720da5ee14b6723db28d538b9588d78ef2d3b552d3db0641a14d6bbdb6`

It is offline-only under `scripts/guide-factory`. No application, Worker,
production preset, or distributed bundle imports it.

## Authenticated boundary

The report authenticates an exact 119-path raw-byte and hash closure:

- checkpoint 56's complete 116-path input closure;
- the durable checkpoint-56 local-stat report;
- the checkpoint-57 core;
- the checkpoint-57 CLI.

The closure contains 15 JSON files and the same two possible beta gzip inputs
inside the inherited 80-path first-party runtime graph. Every supplied byte
sequence must match the current workspace file, and every generated-from hash
is recomputed from those bytes.

The outer boundary reconstructs the exact checkpoint-53 and checkpoint-56 input
projections. Both durable reports must then fresh-authenticate before any
request is resolved. Checkpoint-56 authentication recomputes its 480 technical
cells and materializes 960 `TeamBuild` instances; those are explicitly recorded
as excluded upstream-authentication work rather than checkpoint-57 local work.

## Exact entered-request domain

The Guide Factory technical request contains exactly six entered investment
points:

| Request | Entered constellation | Entered A/E/Q | Runtime-effective A/E/Q | Matched profile |
| --- | ---: | --- | --- | --- |
| C0/Q9 | 0 | 10/1/9 | 10/1/9 | lower |
| C5/Q9 | 5 | 10/1/9 | 10/4/12 | lower |
| C0/Q10 | 0 | 10/1/10 | 10/1/10 | high |
| C5/Q10 | 5 | 10/1/10 | 10/4/13 | high |
| C6/Q9 | 6 | 10/1/9 | 10/4/12 | high |
| C6/Q10 | 6 | 10/1/10 | 10/4/13 | high |

Candidate matching evaluates the two exact authenticated source-predicate ASTs
against entered facts only:

- lower: constellation at most 5 **and** entered Burst level exactly 9;
- high: constellation at least 6 **or** entered Burst level at least 10.

Runtime-effective talents never participate in that decision. C5/Q9 therefore
remains lower-profile even though C5 makes its runtime Burst level 12. C6/Q9 is
high-profile because its entered constellation satisfies the high predicate.

Requests outside the exact six-point domain fail closed. The two source
predicates are not declared exhaustive over every possible Noelle investment.

## Candidate preservation

Every request resolves to exactly one of checkpoint 53's two candidates. The
complete matched candidate is copied unchanged into the request envelope and
its `candidateSha256` is recomputed before use.

The request does not rewrite checkpoint 53's intentionally unspecified team
investment. It also preserves:

- the exact Noelle/Durin/Nicole/Xilonen team and lineage;
- 4pc Husk as a source observation rather than a selected assignment;
- the branch-local Sands and unordered CR/CD Circlet source options;
- guarded high-investment DEF% Goblet/Circlet alternatives as unresolved;
- the complete original three-group source substat order;
- Gest as applicable but unranked, with refinement and performance missing;
- every null selection and incomplete-build flag;
- the unreviewed source status.

The request envelope is a separate Guide Factory-authored validation wrapper.
It is not a mutation of the source or checkpoint-53 candidate.

## Fail-closed local relation gate

Each request has exactly three adjacent source-group relations. CR and CD share
one source group and are never compared against each other. For every relation,
checkpoint 57 requires:

- all 16 raw checkpoint-56 diagnostics from
  2 Circlets x 2 Gest refinements x 2 Nicole modes x 2 Husk states;
- all four matching Circlet/refinement robustness rows;
- exact equality between the four robustness rows' diagnostic-ID union and the
  16 raw IDs;
- recomputed raw, robustness, reference, relation, envelope, and aggregate
  hashes.

A relation is locally admitted only at 16 aligned, 0 counterexample, and 0
inconclusive outcomes. A 15/16 result is withheld. Coverage loss, duplicate
evidence, axis drift, or raw/robustness disagreement is an authentication error,
not an inconclusive result.

The observed request-level result is:

| Request | Admitted | Withheld local relations |
| --- | ---: | --- |
| C0/Q9 | 3 | none |
| C5/Q9 | 2 | ATK% > DEF% (0 aligned, 16 counterexamples) |
| C0/Q10 | 2 | DEF% > ATK% (0 aligned, 16 counterexamples) |
| C5/Q10 | 3 | none |
| C6/Q9 | 1 | CR > DEF% (15/1), CD > DEF% (11/5) |
| C6/Q10 | 1 | CR > DEF% (15/1), CD > DEF% (9/7) |

Across all requests:

- 18 relation decisions;
- 12 unanimous local admissions;
- 6 relations withheld with counterexamples;
- 242 aligned raw outcomes;
- 46 counterexample raw outcomes;
- 0 tolerance-inconclusive raw outcomes;
- all 288 raw diagnostics consumed exactly once;
- all 72 robustness rows consumed exactly once.

The six withheld rows retain every aligned and counterexample diagnostic. The
gate never cherry-picks only the blocking rows or only the majority outcome.

## Interpretation boundary

Local admission means only that one source relation has no counterexample in
the exact tested request and 16-context technical grid. It does not validate the
source universally. A withheld relation means that unanimity failed; it does
not prove that the source is wrong.

Checkpoint 57 never:

- compares the two partial candidates competitively;
- changes the original source priority groups;
- synthesizes CR-versus-CD order, a total stat order, or scalar weights;
- selects a weapon, refinement, artifact set, Sands, Goblet, Circlet, substat
  allocation, support mode, or Husk state;
- runs the generator, optimizer, or AutoTune;
- computes an ideal or legal artifact allocation;
- computes player damage, team total, DPS, rotation feasibility, or buff timing;
- computes or recommends Energy Recharge.

The two requests with all three locally admitted relations still remain
unreviewed partial validation candidates with missing equipment and gameplay
boundaries. They are not promotion-ready guides.

## Verification

- focused checkpoint-57 tests: 14/14 passed;
- complete Guide Factory suite: 104 files passed, 1,040 tests passed, 2
  intentional skips;
- `validate.ts --defer-er`: 0 errors and the same 12 known legacy weapon-type
  warnings;
- Guide Factory TypeScript: passed;
- application and test TypeScript: passed;
- dependency boundary: 758 modules and 3,994 dependencies, no violations;
- production build: passed with the existing large-chunk advisory;
- repository lint remains blocked only by the unchanged pre-existing formatter
  issue in `.dependency-cruiser.cjs` line 280.

The final report is 663,723 bytes with SHA-256
`a0fa6a720da5ee14b6723db28d538b9588d78ef2d3b552d3db0641a14d6bbdb6`.

## Next non-ER checkpoint

The next step should test a generic draft-guide projection over the six
request-conditioned envelopes. That projection should serialize only fields
with authenticated provenance, retain field-level blockers, and make the two
all-relations-admitted requests visibly different from the four partially
withheld requests.

It must remain an offline validation artifact. It must not fill missing choices,
promote local relations into universal priorities, or move any data into
`src/presets`.

ER work remains deferred.
