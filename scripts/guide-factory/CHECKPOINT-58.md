# Checkpoint 58: blocker-aware character-guide draft packets

## Outcome

Checkpoint 58 introduces a generic, closed field-state format for offline
character-guide drafts and projects checkpoint 57's six Noelle request
envelopes through it. It does not produce a character guide, build,
recommendation, rank, or publishable preset.

The durable report is:

- `reports/noelle-hexerei-guide-draft-projection.json`
- 916,583 bytes
- SHA-256
  `088f52d4396d56f56c02737ad7342e6e7c32381b6dbd308616bac0bf01b43c56`

Everything remains under `scripts/guide-factory`. No application, Worker,
production preset, or distributed bundle imports the format or report.

## Authenticated boundary

The report authenticates an exact 123-path raw-byte and generated-hash closure:

- all 119 checkpoint-57 inputs;
- the durable checkpoint-57 report;
- the generic guide-draft packet core;
- the Noelle-specific projector;
- the projector CLI.

The closure contains 16 JSON files, 80 first-party runtime paths, and the same
two possible beta gzip inputs inherited from checkpoint 57. Every supplied byte
sequence must match the workspace and every generated-from hash is recomputed.

The outer closure must project the exact checkpoint-57 input. Checkpoint 57 is
then freshly authenticated before any draft field is constructed, including
its upstream recomputation of 480 technical cells and materialization of 960
`TeamBuild` instances. Those operations are recorded as upstream authentication
work, not checkpoint-58 projection work.

The aggregate checkpoint-58 identity binds the complete generated-from set,
checkpoint-57 report and aggregate roots, both technical requests, every field
and blocker identity, all relation overlays, and the ordered packet roots.

## Closed generic field states

Every draft field uses exactly one state:

- `preserved-evidence`;
- `preserved-blocking-evidence`;
- `locally-admitted-relation`;
- `withheld-counterexample`;
- `withheld-inconclusive`;
- `guarded-unresolved-alternative`;
- `unselected`;
- `missing-not-zero`;
- `not-computed`;
- `deferred-missing-not-zero`.

Unknown states and illegal state payloads fail authentication. Every field
stores its exact upstream object and value JSON pointers and canonical hashes.
Every blocker has a deterministic packet/field/code identity, points back to
the exact field path and hash, and blocks publication. Duplicate, orphaned,
unknown, unlinked, or tampered blockers fail validation. Unselected fields must
link to real option fields in the same packet.

Packet, subject, upstream-anchor, readiness, capability, provenance, field, and
blocker object shapes are closed. A rehashed extra field such as a rank is not
accepted. Validation also requires a trusted projector-supplied field policy
covering the exact field IDs, paths, states, blocker codes, and option links;
the policy is not derived from the untrusted packet being checked. Wrapper
states must agree with upstream relation and guard discriminators and with
missing/not-computed/deferred markers. The packet serializes no unauthenticated
field or blocker prose that could be rehashed into an unsupported claim. The
packet root separately authenticates its upstream report, envelope, candidate,
and profile anchors.

## Six exact Noelle packets

Entered request facts and runtime-effective talents remain separate in every
packet. The exact request order is C0/Q9, C5/Q9, C0/Q10, C5/Q10, C6/Q9, and
C6/Q10. Each packet preserves:

- the exact Noelle/Durin/Nicole/Xilonen source team while keeping the source
  team's Noelle investment `unspecified`;
- the complete Guide Factory/source authorship boundary;
- Gest as conditional, applicable, unranked, unselected, refinement-null, and
  missing quantitative performance;
- 4pc Husk as an observation with `assignedToRuntimeBuild: false`;
- every branch-conditioned main-stat option and both high-profile guarded DEF%
  alternatives;
- the original three source substat groups, with CR and CD still unordered;
- all eighteen checkpoint-57 relation objects, evidence identities, counts,
  and local admission states;
- every null selection and upstream missing/computation boundary.

The exact field census is:

| State | Fields |
| --- | ---: |
| preserved evidence | 60 |
| preserved blocking evidence | 30 |
| locally admitted relation | 12 |
| withheld counterexample | 6 |
| withheld inconclusive | 0 |
| guarded unresolved alternative | 8 |
| unselected | 36 |
| missing, not zero | 36 |
| not computed | 6 |
| deferred missing, not zero | 6 |
| **total** | **200** |

The fields contain 206 exact provenance references. The six extra references
pair each null weapon refinement with its explicit upstream missing-status
marker.

## Blocker decomposition

Every packet has 19 common blockers:

- unreviewed source, absent source-authored request coverage, and unspecified
  source-team investment;
- weapon selection, refinement, and quantitative performance;
- artifact set, Sands, Goblet, Circlet, and substat-allocation selections;
- incomplete artifact assignment, missing scalar weights, and incomplete
  build;
- enemy scenario, formula counts, rotation/buff coverage, team total, and
  deferred Energy Recharge.

Each high-profile packet adds two guarded-alternative blockers. Each withheld
relation adds one counterexample blocker.

| Request | Local relations | Guards | Withheld | Blockers |
| --- | --- | ---: | ---: | ---: |
| C0/Q9 | all 3 admitted | 0 | 0 | 19 |
| C5/Q9 | partial | 0 | 1 | 20 |
| C0/Q10 | partial | 2 | 1 | 22 |
| C5/Q10 | all 3 admitted | 2 | 0 | 21 |
| C6/Q9 | partial | 2 | 2 | 23 |
| C6/Q10 | partial | 2 | 2 | 23 |

This yields 128 blockers: 114 common occurrences, eight guard occurrences, and
six withheld-relation occurrences. The blocker list is exactly reconstructable
from field states and contains no duplicate or orphan.

## Interpretation boundary

Projection completeness, local-relation status, guide readiness, and
publication status are independent. C0/Q9 and C5/Q10 have all three local
relations admitted, but they still carry 19 and 21 blockers respectively and
remain incomplete, publication-withheld drafts.

Checkpoint 58 never:

- selects a team, weapon, refinement, artifact set, main stat, or substat
  allocation;
- treats a sole option as a default selection;
- ranks candidates or produces a winner;
- synthesizes CR-versus-CD order, scalar weights, a total order, or a legal
  artifact-roll allocation;
- runs the optimizer, AutoTune, damage calculator, or rotation replay;
- computes team total, DPS, buff coverage, or Energy Recharge;
- moves any field into a production preset.

ER remains explicitly deferred until sequence input exists.

## Verification

- focused checkpoint-58 tests: 13/13 passed;
- complete Guide Factory suite: 105 files passed, 1,053 tests passed, and 2
  intentional skips;
- `validate.ts --defer-er`: 0 errors and the same 12 known legacy weapon-type
  warnings;
- Guide Factory TypeScript: passed;
- application and test TypeScript: passed;
- dependency boundary: 758 modules and 3,994 dependencies, no violations;
- production build: passed with the existing large-chunk advisory and no Guide
  Factory code in the web bundle;
- independent adversarial architecture audit: no residual actionable defects;
- repository lint remains blocked only by the unchanged pre-existing formatter
  issue in `.dependency-cruiser.cjs` line 280.

The final report is 916,583 bytes with SHA-256
`088f52d4396d56f56c02737ad7342e6e7c32381b6dbd308616bac0bf01b43c56`.

## Next non-ER checkpoint

Checkpoint 59 should test whether the generic format is genuinely portable.
Inventory the existing authenticated Itto, Xiao, Klee, Kokomi, Diona, and
Keqing slices against the packet contract, classify every unavailable field as
a source-data, format, or computation gap, and choose one second character that
can be projected without inventing facts. It should remain offline and blocked
where evidence is incomplete.
