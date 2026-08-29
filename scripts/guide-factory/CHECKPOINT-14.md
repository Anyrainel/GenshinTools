# Checkpoint 14: One Source-Scoped Role Binding

## Status

This checkpoint adds the first real, source-scoped character-role observation
and tests it against one exact team from the same guide page. It does not turn
that observation into a global role catalog or release the broader team
template for roster generation.

Everything remains under `scripts/guide-factory`. No application, Worker,
production preset, or distributed-bundle path imports this work. ER remains
deferred.

## Question under test

The narrow empirical question is:

> Can one explicitly attributed, non-exhaustive role observation validate one
> named slot binding without silently becoming an exhaustive role resolver?

This is a data-shape and validation-boundary test. It is not a test of whether
the team is strong, whether Xilonen is the best healer, or whether every team
matching the template should use her.

## Source-shaped evidence

The indexed KQM Furina snapshot now contains one `character_role` record:

- role: `healer`;
- applicable template: Furina Hypercarry / Mono;
- applicable hard slot: `healer`;
- named member: Xilonen;
- exhaustiveness: non-exhaustive;
- ranking claim: none; and
- constellation bounds and natural-language member conditions: omitted.

The record is a narrow paraphrase of the Furina Quick Guide and retains its
source locator and unknowns. Consolidation namespaces its template reference
to the exact KQM template record. Validation rejects missing templates, missing
slots, absent role options, invalid member IDs or bounds, and review/provenance
drift.

The wrapper does not merely label the data unreviewed. It loads the Furina
snapshot through `manual-index.json`, locates the exact role source record, and
records its observed `agent-assisted` / `unreviewed` extraction state. A
different observed review state makes this checkpoint not comparable until the
expected boundary is deliberately updated.

## Exact named sample

The test joins three records from the same KQM Furina page:

- `kqm:character-role:furina-xilonen-healer-role-luna-ii`;
- `kqm:team-template:furina-team-template-hypercarry-mono`; and
- `kqm:team:furina-neuvillette-kazuha-xilonen-example`.

The explicit same-page inferred binding is:

| Slot | Character |
| --- | --- |
| Furina | Furina |
| Healer | Xilonen |
| Flex 1 | Neuvillette |
| Flex 2 | Kaedehara Kazuha |

The exact roster has two structural bindings because the two unrestricted flex
characters can exchange slots. The durable report preserves that multiplicity
and the one configured binding. It does not call the two permutations separate
recommendations.

## Released-catalog boundary

The wrapper obtains the same guide-eligible catalog from the existing roster-
domain fixture seam: 125 stable character IDs and 119 playable identities,
after 14 Manekin/Manekina special-avatar forms are withheld and all seven
Traveler elements share one playable identity.

The full catalog is transient. The durable report stores only counts and
hashes, plus the named Xilonen evidence and exact four-character validation
target. Its drift gate compares the freshly built catalog count, complete
catalog hash, character-ID hash, and playable-identity count with the
independently stored boundary in the checked-in checkpoint-12 roster-domain
report. Comparing the fresh catalog with another hash derived from the same
fresh array would be tautological and is not used. Same-count membership drift
therefore fails. The report contains no expanded global role membership list or
candidate team array.

## Current result

The named source-scoped sample is comparable:

- the indexed extraction is still observed as unreviewed;
- the exact role, template, and team share one source/page lineage;
- Xilonen is eligible and is the only member in this narrow role observation;
- the explicit binding satisfies every hard slot;
- the observed structural multiplicity is the expected two; and
- the fresh eligible-catalog count and fingerprints match the independently
  checked-in roster-domain boundary.

Separately, the wrapper reruns the existing roster-domain core for the Furina
Hypercarry template. Its status remains `withheld-unresolved-role`. The one
named observation is intentionally not installed as a global `healer` resolver,
so checkpoint 12's broader domain and durable report remain unchanged in
meaning.

## What this checkpoint establishes

It establishes that the repository can retain and validate one source-scoped
role member against one exact same-page target without weakening the role to an
element match, an unrestricted slot, or a global roster catalog.

It does not establish:

- a complete healer list;
- a reusable global role ontology;
- the suitability of Xilonen for arbitrary flex pairs;
- team quality, ranking, or recommendation;
- independent gameplay validation;
- rotation, buff-window, formula-count, equipment, or stat-allocation quality;
- a constellation claim; or
- an ER requirement.

## Failure boundary

The sample is withheld when configured records drift, source/page lineage is
ambiguous, the indexed extraction state changes, a member is ineligible, a
condition or constellation bound is unverified, the explicit binding is not
structural, its multiplicity changes, or the fresh catalog drifts from the
checked-in roster-domain boundary. It does not rank a surviving subset.

## Next evidence gate

The next role-data expansion should add another narrow, attributed observation
with a genuinely different condition or constellation boundary and test it as
another source-scoped validation target. Only after several such records expose
how context and overlap behave should the factory design a bounded role-based
candidate domain. A global `roleId -> characters` table remains premature.
