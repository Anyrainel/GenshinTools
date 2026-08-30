# Checkpoint 47: authenticated Xiao FFXX replay-representation preflight

This checkpoint attempts the first real damage computation over checkpoint
46's six Xiao FFXX partial candidates. The attempt does not produce a weapon
ranking. It discovers and authenticates a representation failure in the
existing replay seam, then withholds every comparison and guide claim.

## Exact authenticated boundary

The durable report authenticates 118 exact raw-byte inputs. They include:

- checkpoint 46's complete 27-path input boundary;
- checkpoint 42's complete 36-path source-file boundary;
- the two durable upstream reports;
- 80 files in the current static first-party replay-runtime graph, including
  all damage-calculator registration files and both binary beta gzip archives;
  and
- the checkpoint-47 core and CLI.

Twelve JSON inputs require both raw-byte and parsed-object parity. The two
durable reports are also fresh-authenticated through their own complete input
boundaries before use. The run fails if beta data or the beta environment
override is enabled.

The focused test independently derives the runtime graph from TypeScript value
imports, re-exports, and literal dynamic imports. It requires every runtime
dependency to remain inside the 80-file runtime set and requires exact BFS set
equality, so neither an omitted dependency nor an unreachable extra path can
silently retain the closure claim.

## Explicit wrapper-owned fixture

The executed roster is Xiao, Xianyun, Furina, and Faruzan. The KQM and
GenshinTools records support roster provenance only. Supporter equipment is
copied from the GenshinTools calculator fixture for runnability; it is not
treated as source-authored investment or as support for Xiao's candidate
equipment.

The computation executes only the C0 `source-only-ffxx` view. The separate
wrapper-C6 view remains provenance and affects neither configuration nor
candidate identity. All characters are level 90, C0, and 10/10/10 under local
Guide Factory assumptions. Five-star candidate weapons use R1 and Deathmatch
uses R5. Combat options, enemy level/resistance, roll multiplier, and artifact
budget are pinned in the report.

Xiao's partial sheet contains level-20 five-star Flower and Plume main stats,
ATK% Sands, and Anemo DMG Bonus Goblet. It still contains no Circlet, substats,
or authored ER entry. One separate PJWS probe freshly omits Flower/Plume and
produces 360,260.12148413 interpreted damage instead of the pinned
409,726.468458432. That variant is rejected; the other five candidates are not
evaluated under it.

## Formula ownership and source-context boundary

Checkpoint 42 supplies only the calculator-default formula IDs and counts:
two Xiao Skills and eleven High Plunges. Checkpoint 47 owns the formula-line
order, `reaction: null`, and `forceOnField: true`. The grouped representation
uses two lines; the unit-expanded representation uses thirteen count-one lines.

The source fixture's translated plan contains twelve High Plunges, but its
authenticated assumptions explicitly say that no external buffs are present.
Checkpoint 47 evaluates the externally buffed FFXX team, so it does not execute
or cross-join that source plan. Count mismatch and context mismatch remain
validation targets rather than a correctness verdict.

## The discovered representation failure

All six grouped replays are rejected by `replayTeamDamage()` because the
interpreted and compiled totals disagree. Xianyun's stack-limited buff has eight
uses. With eleven plunges represented by one counted line, the two calculator
paths apply that limit differently.

The same formula counts expanded to thirteen unit lines restore interpreted/
compiled agreement for all six candidates. The unit sequence records eight
active Xianyun plunge-buff uses followed by three inactive uses. Every grouped
interpreted total also equals its unit-expanded interpreted total, while every
grouped compiled total remains different from its unit-expanded counterpart.

This is evidence about formula representation, not evidence that the authored
Skill-then-Plunge order is a playable or optimal rotation. It proves nothing
about timing, buff-duration coverage, DPS, ER, fixture quality, or universal
calculator correctness.

## Identity and capability boundary

Candidates are validated as an order-independent weapon set, then sorted by
technical candidate ID before execution and observation hashing. Source group
ranks and the excluded C6 request fact do not influence execution identity.
Fixture, observation-set, individual observation, and aggregate hashes are
separate.

The report is authenticated with `comparisonStatus: not-comparable`. It records
six grouped failures and six unit-expanded agreements, but has zero comparable
candidates, ranks, winners, recommendations, complete builds, damage claims,
damage-comparison claims, rotation claims, ideal-roll results, or ER results.
Neither the generator, optimizer, AutoTune, ideal-roll allocation, nor the ER
module runs.

## Next non-ER boundary

The next experiment should isolate representation normalization as a reusable
offline execution gate. A count-only plan may be unit-expanded only under an
explicit wrapper-authored order. Each candidate must independently preserve
interpreted totals and pass dual-path agreement. The output should remain an
unsorted technical observation table, not a weapon recommendation.

Only after that gate survives additional fixtures should the Xiao experiment
add Circlet/substat variants or compare technical observations with the
authenticated source rank groups. Any disagreement remains a validation target
until the formula objective and fixture assumptions are independently credible.

## Durable output and verification

The checked-in report is 50,180 bytes with SHA-256
`d32b45449ff4e3e2f423c13f3d693d08910b6a2aeaaf04b7a846d4b44db7e79b`.
Its fixture hash is
`be9f8f040c51062ea110624711e5e7c036924f7b078939ce60fd572986edccab`,
its observation-set hash is
`8f7bb8bcdbac2ccc1f93af599d2d5f88491fc14b2d90808571643f0170062152`,
and its aggregate preflight hash is
`309874bffb12462eaa3f3724392f9d1283aad339e2f5403ffc2b77993e1d935e`.

Focused checkpoint tests pass 10/10. The complete Guide Factory suite passes
94 files with 902 tests passed and two historical tests skipped. The global
validator finishes with zero errors and twelve pre-existing catalog warnings
when Diona comparison and ER calibration are explicitly deferred. Guide
Factory TypeScript, the application-wide type check, and dependency-boundary
validation also pass.
