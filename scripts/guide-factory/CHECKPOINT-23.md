# Checkpoint 23: authenticated Itto source-conditioned guide packets

This checkpoint tests whether separately captured team and build evidence can
be joined transparently enough to inspect, without pretending that the join is
a guide or multiplying the evidence into candidate builds.

## Durable result

The three unreviewed Itto character-guide records become exactly 15 atomic
claims:

- seven grouped stat entries;
- four artifact recommendation groups;
- four weapon recommendation groups.

CRIT Rate and CRIT DMG remain one grouped entry wherever the source grouped
them. Splitting individual stat IDs would incorrectly turn this into 17 claims.
The 15 claims are projected independently across three exact source teams,
producing 45 claim/team cells and zero assembled builds.

## Condition projection

| Outcome | Per team | Total |
| --- | ---: | ---: |
| Matched | 1 | 3 |
| Inapplicable | 2 | 6 |
| Unresolved context | 9 | 27 |
| Deferred omitted-energy prerequisite | 3 | 9 |
| Withheld aggregate | 12 | 36 |
| Total | 15 | 45 |

All three teams contain Furina, so the Marechaussee Hunter condition matches.
None contains Xianyun, so Long Night's Oath and Fruitful Hook are inapplicable.
A false exact-roster predicate dominates deferred or unresolved predicates in
the same conjunction.

The source-specific map pins 11 unique exact condition strings across 16
claim-condition occurrences. It uses typed predicates and exact condition-array
hashes rather than parsing arbitrary English. Text drift, an unmapped claim, or
an unsupported predicate withholds the entire projection.

The nine deferred cells are still withheld. They are kept separate only because
the source explicitly conditions the offensive substat tail on an omitted,
rotation-specific energy requirement. This checkpoint supplies no ER value or
energy calculation.

## Template and baseline context

The current roster-domain runtime accepts the Yelan and Xingqiu PHEC examples
with structural multiplicity two and represents Crystallize as true. The C2+
Xilonen/Gorou/Furina example is structurally rejected by that PHEC template
with multiplicity zero and no reaction result. It is a separate Triple/Mono Geo
example, not a failed claim that Gorou belongs in a PHEC slot.

Only the C2+ example overlaps a current baseline roster:
`genshintools-presets:team:8ru0gxT0jJgK50AfWD`. Itto, Gorou, and Furina are not
constellation-constrained by the source. Source C2+ Xilonen against baseline-
unspecified Xilonen is `unresolved-baseline-unspecified`, so the packet's
overall investment status is unresolved rather than satisfied or conflicting.
The source retains only `minConstellation: 2`; no maximum C6 bound is invented.
Talent levels and baseline equipment are not evaluated.

## Authentication and failure boundary

The durable JSON is trusted only after a fresh rebuild from the authenticated
repository, raw Itto snapshot, manual index, source registry, game catalogs,
condition map, roster runtime, and current input hashes. Source-record drift,
condition drift, catalog or roster drift, count drift, or serialized-report
drift makes the result not comparable. All seven participating source records
remain agent-assisted, unreviewed, promotion-ineligible evidence, so publication
remains withheld.

## What this does not establish

This checkpoint provides:

- no character guide or player-facing recommendation;
- no weapon, artifact, stat, or team ranking;
- no selected equipment or multiplied build axes;
- no generator or optimizer execution;
- no formula plan, rotation, damage, DPS, optimality, or ideal-roll result;
- no ER input, requirement, calculation, or conclusion;
- no use of baseline equipment as source-claim evidence.

## Next non-ER gate

Keep this source-facts-only packet unchanged as a control. A separate typed
request/account context can then test explicit role, optimization-goal,
inventory, acquisition-preference, and passive-execution inputs without turning
omitted facts into false or joining matched claims into a build. Human review of
the 15 atoms, pinned predicates, and 45 source-only classifications remains
required before publication, formula authoring, or build composition.
