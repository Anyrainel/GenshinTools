# Checkpoint 10: Carry and execution-order sensitivity

Date: 2026-08-29

This checkpoint is still not a working guide factory. It measures two concrete
behaviors of the existing ordered, greedy artifact generator: whether its
algorithmic carry choice changes the result, and whether running two candidates
in reverse order leaks state across otherwise independent calls. It computes no
ER target and supports no build, damage, ranking, or guide claim.

## Provenance and fixed boundary

The two artifact assignments are assembled from independently recorded
character-guide builds. No source record binds either four-character equipment
assignment to the exact Keqing/Ineffa/Furina/Xilonen team or to the other
character builds. The formula-count objective remains unreviewed with eight
gameplay-review blockers.

The probe reuses the same technical controls as checkpoint 9:

- level 90, C0, R1, and 10/10/10 for all four characters;
- enemy level 110 and enemy resistance 0.1;
- roll multiplier 0.85 and the `8_6` substat budget;
- only released 5-star artifact sets;
- no `perChar` map, ER threshold, buff override, set-key override, or
  ignored-set fallback; and
- a fresh `TeamBuild` for every sequential invocation.

The complete generated artifact records are canonicalized only long enough to
derive a SHA-256 fingerprint. The durable report retains those hashes plus
main stats and positive substat keys for explanation. It retains no artifact
record, substat value, StatSheet, damage value, score, rank, or winner.

## Seven-run schedule

Assignment A is the seed composition: Keqing Thundering Fury, Ineffa Aubade,
Furina Golden Troupe, and Xilonen Scroll. Assignment B is the opposite 2x2
endpoint: Keqing Thundering Fury, Ineffa Silken Moon, Furina Tenacity, and
Xilonen Scroll.

| Schedule | Carry input | Candidate order |
| --- | --- | --- |
| Forward | Keqing | A, then B |
| Reverse | Keqing | B, then A |
| Carry cell | Ineffa | A |
| Carry cell | Furina | A |
| Carry cell | Xilonen | A |

Forward A/Keqing is reused as the fourth carry cell, so this plan performs
exactly seven accepted generator invocations. Tests observe seven distinct
`TeamBuild` object identities and inspect every runtime option to keep the
constraint and override omissions enforceable.

## Carry sensitivity observed

Assignment A produces three complete-artifact fingerprint classes:

- Keqing carry and Ineffa carry are byte-equivalent;
- Furina carry is distinct; and
- Xilonen carry is distinct.

The explainable differences are broader than the selected carry alone:

- Furina carry changes Furina's Circlet from CRIT Rate to CRIT DMG and changes
  Keqing's positive Flower substat keys from ATK%, CRIT DMG, CRIT Rate, and EM
  to flat ATK, ATK%, CRIT DMG, and CRIT Rate.
- Xilonen carry makes the same Keqing Flower key change and changes Xilonen's
  Circlet from DEF% to CRIT DMG.
- Ineffa carry has no main-stat or positive-substat-key difference from the
  Keqing-carry reference.

These are algorithm-behavior observations. They do not establish an in-game
carry role, a better Circlet, a correct substat priority, or a performance
difference. They do establish that choosing one `carryCharId` silently would
not be a neutral implementation detail for this fixture.

## Execution-order sensitivity not observed

Assignment A has the same complete fingerprint in the forward and reverse
schedules. Assignment B does too. Therefore this seven-run fixture observes no
cross-run execution-order effect when each call receives a fresh team.

This is deliberately narrow. It does not prove that generator internals,
future caches, configuration order, lower-rarity random-flex paths, concurrent
calls, or a broader candidate lattice are generally order-independent.

## Failure behavior

The runner preserves candidate-local failures. An injected failure in the
first call does not stop the remaining six calls. The failed cell and every
carry/order comparison depending on it become `not-comparable`; unaffected
candidate comparisons remain available. The report never turns missing output
into `false`, equality, or a winner.

## Verification and boundary

- guide-factory TypeScript check passes;
- 25 guide-factory test files and 115 tests pass;
- stale-report validation finishes with 0 errors and the same 12 known legacy
  weapon-type warnings;
- the sensitivity report is byte-stable across repeated real runs; and
- all changes remain under `scripts/guide-factory`, with no application,
  Worker, production-preset, or distributed-bundle import.

## Next evidence gate

The next bounded computation should expand only the existing 2x2 artifact-set
lattice across all four carry seeds. Within each assignment node, it can
deduplicate the generated per-character sheets, cross-compose only compatible
node-local outputs, and exhaustively replay that tiny table under the same
fixed objective. Coordinate-descent and beam policies can then be replayed over
the cached table and checked against the exhaustive result instead of being
trusted because they terminate. The four-node outer lattice is too small for
meaningful beam-width calibration; exhaustive enumeration is the baseline, and
beam replay is only a coverage trace here.

That would measure search behavior, not guide quality. Formula-plan review,
explicit combat assumptions, and independent replay remain hard gates before
any comparative performance or recommendation claim. ER computation and ER
recommendations remain deferred.
