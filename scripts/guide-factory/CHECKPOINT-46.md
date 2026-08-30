# Checkpoint 46: authenticated Xiao FFXX condition-free branch candidates

This checkpoint performs the first genuine branch enumeration over the
authenticated Xiao repository. It combines checkpoint 44's one FFXX partial
artifact candidate with checkpoint 45's six source-condition-free weapon leaves
and one source-condition-free ATK% Sands singleton.

The exact bounded product is `1 x 6 x 1 = 6`. It creates six Guide Factory-
authored partial technical candidates, not six complete builds and not a weapon
ranking produced by the factory.

## Three source groups, six technical candidates

The admitted weapon domain remains grouped exactly as the source represents it:

- five-star source rank group 1 contains three tied candidates: Primordial Jade
  Winged-Spear, Staff of Homa, and Lumidouce Elegy;
- five-star source rank group 2 contains two tied candidates: Vortex Vanquisher
  and Calamity Queller; and
- the four-star domain contains one unranked Deathmatch candidate.

Five-star ranks belong to source groups, not individual tied members.
Deathmatch remains unranked, and no cross-rarity order is defined. The report's
deterministic serialization order is explicitly not a rank. Every candidate has
`factoryRank: null` and `crossRarityRank: null`.

Each candidate contains four present axes:

1. one weapon with unspecified Refinement;
2. 4pc Marechaussee Hunter;
3. ATK% Sands; and
4. Anemo DMG Bonus Goblet.

Only the newly admitted weapon and Sands rows have empty source condition
arrays. Marechaussee Hunter and the Anemo Goblet are inherited from checkpoint
44 with their team-conditioned applicability views intact; the report
explicitly marks that not all present axes are source-condition-free.

CRIT Rate versus CRIT DMG Circlet remains a guarded, unselected choice. The two
offensive-tail substat rows remain guarded and incomplete after the source's
omitted ER term. Those two missing axes keep every candidate partial and
ineligible for the runtime artifact generator.

## Provenance without multiplication

Checkpoint 44's source-only and explicit-C6 views remain two evidence bindings
for each of the six candidates, producing twelve provenance bindings. They do
not produce twelve technical candidates. The wrapper-owned C6 fact remains
outside candidate identity, and the same ATK% Sands evidence repeated across
six candidates supplies no vote, corroboration, confidence, or rank.

Technical-combination and candidate-identity hashes contain the exact FFXX
team, Xiao, weapon, artifact set, Sands, Goblet, missing-axis policy, and ER-
excluded policy. Source ranks, tied membership, classifications, occurrence
IDs, and request-view provenance are kept in separate candidate-provenance and
branch-group hashes. Reordering a source group therefore changes provenance,
not the technical identity of an otherwise identical equipment combination.

## Withheld guarded domain

All nine guarded checkpoint-45 observations remain outside enumeration:

- six guarded weapon groups containing eight weapon leaves;
- one guarded Circlet group containing two stat leaves; and
- two guarded substat-priority rows containing three stat leaves.

No condition truth is evaluated. An empty source condition array is used only
as the bounded admission rule; it is not treated as universal applicability,
best-in-slot evidence, passive uptime, compatibility, or a winner.

## Authentication and capability boundary

The report byte-authenticates the exact deduplicated union of checkpoints 44
and 45, both durable upstream reports, and the checkpoint-46 core and CLI. It
requires parsed-object parity for eight JSON inputs: repository, Xiao snapshot,
manual index, source registry, checkpoint 42, checkpoint 43, checkpoint 44,
and checkpoint 45. Both direct upstreams are fresh-authenticated through their
own complete closures before their canonical outputs are consumed.

Bounded Cartesian enumeration, cross-axis composition, and partial-candidate
construction execute. Choice selection, compatibility evaluation,
recommendation composition, generator, optimizer, formula, damage, rotation,
ideal-roll, and Energy Recharge work do not. The output contains zero complete
candidates, assembled builds, Guide Factory recommendations, derived ranks, or
winners.

## Next non-ER boundary

The six-candidate domain is now large enough to exercise existing computation
without pretending the result is already a guide. The next experiment should
first determine the minimum explicit Circlet/substat assumptions needed to
materialize calculator inputs, expose those assumptions as candidate-local
variants, and run a bounded technical evaluation that reports every failure
and intermediate objective. It must not select a player-facing winner until
formula-count coverage and the objective are independently credible.

## Durable output and verification

The checked-in report authenticates 27 exact byte/hash inputs and requires
parsed-object parity for eight JSON inputs. Its 64,466 bytes have SHA-256
`d692c52bb1abcc1dc9628b40536aac0c70ca72f525c0f246c16a1d1a48d1610e`.
Its aggregate composition hash is
`fcfed128ffbff4ddc72088c6ce1517bf3138ed90b0d837cce7c606c6b882eea4`.

Focused checkpoint tests pass 13/13. The complete Guide Factory suite passes
93 files with 892 tests passed and two historical tests skipped. The global
validator finishes with zero errors and twelve pre-existing catalog warnings
when Diona comparison and ER calibration are explicitly deferred. Guide
Factory TypeScript, the application-wide type check, and dependency-boundary
validation also pass.
