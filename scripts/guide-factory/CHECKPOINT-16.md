# Checkpoint 16: Source-Conditioned Keqing Equipment Evidence

## Status

This checkpoint adds seventeen KQM Keqing Lunar-Charged equipment/stat records
and a durable structural validation report over the four exact teams captured
in checkpoint 15. It does not create a build, select equipment, validate a
source rank, or run damage. Everything remains under `scripts/guide-factory`;
ER remains deferred.

## Question under test

Can contextual artifact, weapon, main-stat, and substat claims survive source
capture and consolidation, then become useful validation targets without being
silently promoted into generator inputs or global recommendations?

## Source evidence boundary

The current KQM Luna I page contributes seventeen participating
`character_guide` records:

- two artifact-stat branches;
- four artifact-set branches; and
- eleven weapon branches.

Each complete manual payload is pinned by a stable hash, exact heading and page
URL, `agent-assisted` / `unreviewed` extraction state, candidate status, and
`promotionEligible: false`. Additional unrelated records on the same snapshot
may be added later without changing this participating boundary.

Whimsy plus Finale of the Deep is not captured. V1 places weapon and artifact
arrays beside each other but cannot guarantee that consumers preserve them as
one atomic pair.

V1 recommendation ordering is also record-local. The source's statement that
the other 5-star CRIT options do not compete with Mistsplitter cannot be
encoded faithfully across the two records, so it remains a pinned schema gap
rather than an invented tie or merged ranking.

## Four exact team contexts

Only the four published Keqing / Ineffa teams are inspected. The released
character catalog supplies these roster facts:

| Exact team | Furina | Aino | Nod-Krai members |
| --- | ---: | ---: | --- |
| Keqing / Ineffa / Aino / Sucrose | no | yes | Ineffa, Aino |
| Keqing / Ineffa / Furina / Jean | yes | no | Ineffa |
| Keqing / Ineffa / Furina / Xilonen | yes | no | Ineffa |
| Keqing / Ineffa / Yelan / Kazuha | no | no | Ineffa |

The report splits the seventeen records into 42 claim units. Sixteen distinct
source condition strings are acknowledged through an exact wrapper-owned map.
The vocabulary is deliberately narrow:

- `matched-by-exact-team-facts`;
- `not-matched-by-exact-team-facts`; and
- `withheld-unresolved-source-condition`.

A match is only a roster fact. It is not computed equipment applicability.
High Base ATK, large DMG Bonus, exceptional EM, top Lunar-Charged contribution,
traditional-set scope, refinement, CRIT overcap, shield/passive coverage,
Bond-of-Life clearance, and account availability all remain unresolved.

## Search coverage

Thirty equipment claim units are cross-referenced against the existing
artifact and weapon search-coverage builders. This is read-only coverage; no
candidate source record is materialized or passed to a generator.

- All 21 weapon claims name released, native-type-compatible Swords.
- Their source refinements remain unspecified even where prose mentions R5 or
  equal Refinement.
- Five of nine artifact claims are representable by the current search path.
- 4pc Thundersoother and all three recorded traditional 2pc combinations are
  not representable.

That last result is a concrete computation gap, not evidence against the
source choices.

## Baseline comparison

The exact GenshinTools Keqing guide and build `1WswsAu` are an independent
comparison boundary:

- ATK Sands, Electro Goblet, and CRIT Circlet choices are all present in the
  default source observation; CRIT Rate retains its no-overcap condition.
- The conditional ATK Goblet branch is not established by the baseline.
- The baseline bands express `CRIT > ATK = EM`; KQM expresses
  `CRIT > ATK > EM`. The report preserves this partial-order disagreement and
  does not call either side wrong.
- Mistsplitter Reforged matches the general source weapon observation.
- 4pc Thundering Fury appears in source evidence only behind the unresolved
  top-Lunar-Charged-contributor condition. No authored mapping installs it in
  the source's traditional-set category, and no direct contradiction is
  claimed.

## What this checkpoint does not establish

- source or baseline correctness;
- equipment applicability, ranking, recommendation, or optimality;
- a generated build or legal stat allocation;
- artifact quality, damage, reaction ownership, or gameplay execution;
- a cross-source merge; or
- an ER requirement.

## Next evidence gate

The next broader-factory step can construct a bounded, source-conditioned
candidate lattice and run a technical comparison only where the existing
Keqing/Ineffa/Furina/Xilonen formula fixture and search path support the choice.
It must retain unrepresentable options and unresolved conditions as explicit
holdouts, and it must not convert technical objective output into a guide rank.
