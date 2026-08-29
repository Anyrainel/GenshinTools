# Checkpoint 7: Weapon Candidate-Policy Coverage

Date: 2026-08-29

This checkpoint still is not a guide factory and does not rank weapons. It
tests whether weapon observations already stored in the knowledge repository
fit the analyzer's current candidate domain, while keeping three questions
separate:

1. Is the weapon ID in the released candidate domain?
2. Did the source specify a refinement that the policy actually enumerates?
3. Does the weapon type match the character's native type?

Treating those as one optimistic “supported” flag would hide the most important
result of this audit: the repository has complete ID membership but no explicit
refinement evidence.

## Mirrored runtime policy

The runtime `getWeaponCandidates()` helper is private. Calling the public
weapon-choice generator just to discover candidates would also run artifact
generation and damage evaluation, so the offline lab mirrors only its small
policy:

- iterate weapon stats;
- use resource rarity with stats rarity as the fallback;
- exclude 1- and 2-star weapons;
- enumerate 3- and 4-star weapons at R5;
- enumerate 5-star weapons at R1 and R5.

The report hashes the mirror, runtime source, weapon/character stats, released
and beta resources, schemas, and repository. Locked tests expose count changes.
Because it cannot independently execute the private helper, the normal report
does not claim that a clean self-comparison proves semantic equivalence with
runtime. A supplied candidate-domain seam exists only for falsifiable audit
tests.

The released global domain is:

| Rarity | Weapon IDs | Candidate refinements | Pairs |
| --- | ---: | --- | ---: |
| 3-star | 24 | R5 | 24 |
| 4-star | 139 | R5 | 139 |
| 5-star | 73 | R1 and R5 | 146 |
| Total | 236 | — | 309 |

By weapon type, the domain contains 43 Claymores / 54 pairs, 51 Catalysts / 70
pairs, 54 Swords / 72 pairs, 47 Bows / 59 pairs, and 41 Polearms / 54 pairs.

## Repository coverage result

The report accounts for every non-ER weapon occurrence on non-rejected
character-guide and exact-team records:

| Repository slice | Occurrences |
| --- | ---: |
| Character-guide weapon-order entries | 127 |
| Exact-team selected weapons | 840 |
| Character-guide recommendation entries | 15 |
| Team-member recommendation entries | 0 |
| Total | 982 |

All 982 weapon IDs are members of the released global domain. None of the 982
observations supplies a refinement, so the refinement axis is 0 exact, 982
unspecified, and 0 policy-excluded. The report does not silently turn a missing
refinement into R1, R5, or exact coverage.

Native weapon-type comparison produces:

- 970 compatible observations;
- 12 mismatches;
- 0 unknowns.

All 12 mismatches are selected weapons from the legacy candidate source:

- Escoffier is paired with the Bow Silvershower Heartstrings five times;
- Ineffa is paired with the Catalyst Kagura's Verity three times;
- Zibai and Illuga are paired with the Claymore Redhorn Stonethresher;
- Iansan is paired with the Sword Peak Patrol Song;
- Flins is paired with the Catalyst Cashflow Supervision.

Baseline and KQM observations have no weapon-type mismatch. The report does not
repair or reject the legacy source rows; the existing validator continues to
emit the same 12 warnings.

## Runtime seed hazard

Runtime does not independently look up the character's native type when
building candidates. It derives the type from the currently equipped seed
weapon and skips a character entirely if that seed has no weapon stats.

Consequently, a wrong-type seed can select an entire wrong weapon class rather
than merely create one invalid comparison. This report exposes that hazard by
keeping global ID membership and native-type compatibility separate. It does
not run or modify the analyzer.

## ER boundary

ER work remains deferred. Weapon conditions attached to ER targets are excluded
from the 982 analyzed observations. A separate `analyzed: false` inventory
proves that exclusion without copying or evaluating the targets:

- 3 weapon-condition objects;
- 4 explicit weapon-ID occurrences;
- 1 category condition.

No ER percentage, adequacy result, rotation assumption, or energy computation
is emitted by this report.

## Fail-closed behavior

Synthetic tests distinguish beta-only IDs, missing weapon stats, resource
rarity overrides, low-rarity filtering, unsupported refinements, native-type
mismatch, unknown type metadata, and a deliberately omitted candidate pair.
Candidate IDs, pairs, observations, and deferred references are deterministic
and unique.

The output contains no score, rank, winner, damage result, energy result, or
guide recommendation. Its `supportsGuideClaims` flag is false.

## Validation and boundaries

`validate.ts` rebuilds the report in memory and rejects stale checked-in output.
The durable-report test requires byte-stable output from current input hashes.
All code and the generated report remain under `scripts/guide-factory`; no
application or Worker module imports the audit, so the website bundle is
unchanged.

No source record is promoted, no production preset is changed, and no weapon
ranking or optimizer result is produced.

Verification for this checkpoint:

- guide-factory TypeScript check: passed;
- guide-factory tests: 19 files and 93 tests passed;
- pipeline validation: 0 errors and the 12 known legacy weapon-type warnings;
- dependency-boundary check: 754 modules and 3,975 dependencies checked with
  no violations;
- repository diff check: clean.

## Next evidence gates

1. Make comparison refinements explicit in an experiment fixture. Source
   omission and experiment policy must remain distinguishable.
2. Refuse wrong-type or stat-missing seed weapons before invoking a real
   weapon search; decide separately whether to repair the legacy source data.
3. Audit actual artifact generation for one reviewed fixture and preserve
   candidate-specific failures.
4. Require a reviewed formula plan, combat context, and authored stat sheet
   before weapon or artifact damage comparisons.
5. Keep ER deferred until a user-supplied or independently reviewed sequence
   makes its assumptions testable.

None of these outputs may modify production presets without a separate review
and acceptance step.
