# Checkpoint 24: authenticated request/account applicability

This checkpoint tests whether explicit user intent and account facts can refine
source applicability without changing source evidence, creating a ranking, or
assembling the independently captured choices into a build.

## Two-key source control

Checkpoint 23 remains the source-only control. Checkpoint 24 loads its durable
JSON, freshly rebuilds it from the repository, raw Itto snapshot, registry,
catalogs, condition map, roster runtime, and input hashes, and requires exact
authentication between the two. Context projection uses only the resulting
canonical report. A stale, altered, or non-comparable source control makes this
report non-comparable and the CLI refuses to overwrite durable evidence.

Both serialized JSON inputs are closed over their raw UTF-8 bytes, parsed
values, canonical-object hashes, exact paths, and single generated-from
entries. The diagnostic context fixture is additionally pinned to one exact
file and object revision. Duplicate paths, swapped in-memory values, invalid
raw JSON, and internally consistent but unapproved fixture revisions all fail
closed before any projection is emitted.

The dependency is one-way: checkpoint 24 depends on checkpoint 23, while no
checkpoint 24 file appears in checkpoint 23's input boundary.

## Strict context fixture

The checked-in fixture contains three independent contexts:

1. Itto is intended as an on-field DPS and personal damage is the optimization
   goal for each exact source team.
2. The account's explicitly incomplete weapon inventory contains Serpent Spine,
   and the user explicitly assumes its passive stacks can be accommodated for
   each team.
3. A free craftable acquisition option is preferred for each team.

Request facts name an exact team; role and goal facts also name Itto. Weapon
inventory is account-scoped. Omitted facts are unknown. Absence from an
incomplete inventory is also unknown; only an explicitly complete inventory can
turn a missing weapon into false. Account facts carry a snapshot identity so
their provenance is not silently detached from the inventory observation.
Fixture weapon ownership is limited to released catalog IDs; beta-only IDs do
not describe a possible current account snapshot.

The strict fixture has no source claim IDs, source-condition prose, requested
resolutions, recommendation or ranking fields, formula counts, rotations, or ER
inputs. Context-to-claim bindings live in wrapper code, where eight claims and
nine unresolved leaves are pinned by exact condition-array, full-predicate,
leaf-path, and leaf hashes. Exact-roster and deferred-energy leaves are not
replaceable.

## Durable result

Each context is projected separately over the same three teams and 15 claims.
The contexts are not combined.

| Projection | Matched | Inapplicable | Unresolved | ER deferred | Withheld |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source-only control | 3 | 6 | 27 | 9 | 36 |
| On-field + personal damage | 18 | 6 | 12 | 9 | 21 |
| Serpent owned + passive assumed | 6 | 6 | 24 | 9 | 33 |
| Free craftable preferred | 6 | 6 | 24 | 9 | 33 |

The three contextual projections contain 135 cells in total: 30 matched, 18
inapplicable, 60 unresolved, and 27 deferred. Nine matches and all 18
inapplicable outcomes are repeated source-owned results. Twenty-one cells move
from source-unresolved to applicable under supplied context. No cell moves from
source-unresolved to inapplicable in these three fixtures.

Across the unique 27 source-unresolved claim/team cells, at least one context
addresses 21. The six holdouts are the DEF% Goblet and Retracing Bolide claims
for each team:

- On-field intent resolves only the DEF-Goblet role leaf. Buff coverage, the
  Xilonen/Furina investment threshold, and DEF-vs-Geo comparative performance
  remain unknown.
- Retracing Bolide has no binding because owning a set does not establish that
  the account owns a sufficiently good set under a calibrated quality contract.

All 27 repeated offensive-substat-tail cells retain the omitted, rotation-
specific ER prerequisite. Long Night's Oath and Fruitful Hook remain
source-inapplicable because request context cannot add Xianyun to an exact team.

## Provenance and interpretation

Every projected cell retains the source resolution, condition hash, predicate
rows, row hash, and reason. Context evaluation is a separate overlay with fact
authority and scope on each row:

- intended role, optimization goal, and acquisition preference are request
  facts;
- passive accommodation is an explicit request assumption, not measured uptime;
- Serpent Spine ownership is an account fact and does not establish suitability.

`applicable-under-supplied-context` means only that supplied facts satisfy the
mapped applicability condition. Redhorn's cell does not become a computed rank,
Whiteblind preference does not prove billet/material availability, and the
three contexts do not form one user profile.

## What this does not establish

This checkpoint provides:

- no source authorization, character guide, or player-facing recommendation;
- no account advice or selected equipment;
- no weapon, artifact, stat, or team ranking;
- no combined context, cross-product, candidate build, or assembled build;
- no generator, optimizer, formula, rotation, damage, DPS, or optimality work;
- no ideal stat allocation or artifact-quality evaluator;
- no ER input, requirement, calculation, or conclusion.

## Next non-ER gate

Broaden validation before composing choices. Inventory the repository's exact
attributed condition arrays against the typed fact vocabulary, distinguishing
covered manual bindings, predicates that require a new explicit contract, and
gameplay/comparative holdouts. That inventory must not parse arbitrary prose,
treat repeated text as confidence, or infer a recommendation from grammar
coverage.
