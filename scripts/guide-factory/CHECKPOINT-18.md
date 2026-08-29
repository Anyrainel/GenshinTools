# Checkpoint 18: authenticated cross-record composition contract

This checkpoint turns a very small part of the Keqing Lunar-Charged candidate
lattice into explicit technical-input contracts without presenting the joins
as source-authored builds or recommendations.

## Durable result

The contract rebuilds exactly two Guide Factory-authored compositions for the
exact Keqing, Ineffa, Furina, and Xilonen team:

- general Mistsplitter Reforged plus 4pc Marechaussee Hunter;
- general Mistsplitter Reforged plus the exactly-one-Nod-Krai branch of 4pc
  Night of the Sky's Unveiling.

Each composition carries seven matched default stat claims: ATK% Sands,
Electro DMG or ATK% Goblet, CRIT DMG Circlet, then CRIT Rate/CRIT DMG, ATK%,
and Elemental Mastery substat groups. The CRIT Rate Circlet remains withheld
because the exact team does not resolve the source's no-overcap condition. The
two-Nod-Krai artifact branch is also explicitly excluded.

The source-local `default` and `alternative` labels are preserved only on their
own claims. `crossRecordOrdering` is `none`; neither composition is ranked over
the other.

## Fail-closed boundary

The builder requires the exact source claim groups, conditions, recommendation
metadata, search-coverage state, eight stat definitions and eight target cells,
teammate guide lineage, formula fixture, and upstream no-guide/no-rank/no-
damage/no-ER boundary. Duplicate or conflicting target cells fail closed.

Every condition resolution is labeled as a Guide Factory exact-team wrapper
decision. The source authored the condition prose, not the cross-record join or
its applicability decision.

A serialized contract is never authority by itself. Authentication rebuilds
the canonical report from the current typed lattice and formula inputs plus
their exact hashes, then requires byte-stable structural equality.

## What this does not establish

This checkpoint runs no generator or calculator comparison, retains no damage,
and creates no recommendation, winner, score, stat weight, ideal-roll target,
or ER requirement. The formula translation remains unreviewed and replay-
blocked. A later technical matrix must apply a separate Guide Factory
experiment policy and derive its trusted composed targets from a fresh
contract rebuild.
