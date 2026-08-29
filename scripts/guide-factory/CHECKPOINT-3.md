# Checkpoint 3: Multi-Page Knowledge and Computable Coverage

Date: 2026-08-29

This checkpoint still is not a guide factory. It turns the one-page pilot into
a deterministic, growing knowledge corpus and performs the first useful non-ER
computations against it.

## Repository growth

The consolidated repository now contains 351 separately attributable records:

- 191 current GenshinTools baseline records;
- 139 legacy candidate teams;
- 5 KQM Diona records from the first pilot;
- 13 KQM Furina records from the second pilot;
- 3 KQM Keqing records from the old-character/new-release breadth test.

This is 191 baseline and 160 candidate records. KQM contributes 21 records in
total: 8 character guides, 1 historical energy record, 6 exact teams, and 6
team templates.

Manual snapshots are selected by an explicit active-file index. The loader
sorts files deterministically and rejects unsafe paths, real-path escapes
through symlinks or junctions, missing indexed files, unindexed manual files,
case-equivalent duplicates, source-ID mismatches, incompatible registry modes,
and publisher-local record-ID collisions across active files. Multiple files
from one source produce one source revision with a sorted file list.

The Mobalytics Furina guide was inspected as a possible second source but was
not ingested. Its current terms restrict automated collection and third-party
reuse without permission, so the source is registered as permission-blocked
instead of turning technically accessible content into an active corpus.

Crimson Witch remains planned and permission-required. A source profile records
its current JavaScript/Next.js delivery shape and the lack of a documented
recommendation-data reuse grant. No application payload was retained as guide
knowledge; written permission or a public reusable feed is the activation gate.

## Furina validation sample

The Furina snapshot deliberately exercises shapes that the Diona page did not:

- contextual personal-damage and team-support weapons without a false global
  ranking;
- default and conditional artifact-set choices;
- pre-C2 main-stat applicability using an upper constellation bound;
- a post-required-ER offensive substat order without inventing an ER target;
- a C6-only Marechaussee Hunter option that is not promoted above Golden
  Troupe;
- Favonius Sword and Serenity's Call with their contextual conditions and no
  invented numeric ER target;
- five four-slot team archetypes;
- one exact Furina, Neuvillette, Kaedehara Kazuha, Xilonen example team and its
  Xilonen sample rotation;
- two exact Quickbloom examples with their published rotations, including the
  source's 4pc Thundering Fury condition for Cyno's stated combo.

All records remain narrowly paraphrased, heading-scoped, agent-assisted,
unreviewed, and promotion-ineligible.

## Keqing old-character refresh sample

The Keqing Luna I snapshot tests a distinct source question: whether a newly
released character can reveal updated options for an old character. It stores
only three team-focused records rather than mirroring the guide:

- one Keqing–Ineffa Lunar-Charged template;
- one exact Keqing, Ineffa, Furina, Xilonen example with two published rotation
  variants;
- one exact Keqing, Ineffa, Aino, Sucrose example with its published rotation.

The template requires the named Keqing–Ineffa core. Its other slots use the
source-defined roles `off-field-hydro-applier` and `resistance-shred`, while
Hydro, Anemo, and Xilonen remain highlights. This prevents a character's
element alone from falsely satisfying the source's gameplay requirement. The
snapshot preserves examples and caveats, not a team ranking, damage claim, or
recommendation to publish either roster.

The new `team_template` record stores four slots with explicit alternatives:
known characters, elements, source-defined roles, or unrestricted flex slots.
This avoids expanding an editorial archetype into hundreds of exact teams that
the source never endorsed. `maxConstellation` was added alongside the existing
minimum so advice such as “before C2” can be represented without pretending it
applies at every investment level.

## Coverage computation

The durable team-coverage report compares external templates and exact manual
teams with exact GenshinTools baseline teams. Member order is ignored. Character,
element, and unrestricted selectors are resolved by exhaustive four-slot
assignment; role selectors stay unresolved because the repository has no
reviewed role catalog.

The combined result is intentionally more useful than a single coverage score:

- Electro-Charged, Freeze, and Vaporize templates already have baseline
  matches;
- Quickbloom has no matching baseline team; both exact Quickbloom examples from
  the same source are also absent from the baseline;
- Hypercarry/Mono remains unresolved because “healer” cannot yet be checked;
- Keqing Lunar-Charged is uncovered. It is not classified as unresolved even
  though two slots use roles, because no baseline team first satisfies the
  required Keqing–Ineffa core;
- the exact Furina/Neuvillette/Kazuha/Xilonen source team matches baseline team
  `JQC4wxT0jJgK50gc0O`;
- the exact Diona Forward Melt, two Furina Quickbloom, and two Keqing
  Lunar-Charged teams remain uncovered.

In totals, 3 of 6 templates are present, 1 is role-unresolved, and 2 are
uncovered. Of 6 external exact teams, 1 is present and 5 are uncovered.

The report emits no score, rank, winner, confidence, or quality claim. Coverage
means only that a roster shape is present.

## Corpus inventory

A separate durable inventory makes repository growth measurable without using
record counts as a proxy for correctness. Across 351 records it reports 128
character guides, 216 exact teams, 6 team templates, and 1 historical energy
record. It also counts explicit weapon, artifact, main-stat, substat, and
rotation evidence by source. KQM's 6 exact teams all carry rotations, totaling
8 explicit rotation entries. The inventory lists 120 characters that can be derived from
named guide subjects, exact-team members, or explicit character selectors.

The report does not expand element, role, or unrestricted template selectors.
It prohibits quality scores, recommendations, source votes, averages, and
rankings. While ER is deferred, the historical energy record remains visible in
kind/status totals but its detailed targets and associations are excluded from
evidence and character-presence counts.

## Formula-count draft

The matched Furina/Neuvillette team provides the first bridge from repository
knowledge to the existing damage calculator. A new offline seam reads the
calculator's `comboDescriptor` defaults for an exact team and partitions every
available formula into positive-count and zero-count rows. It rejects missing
equipment, implicit investment, invalid counts, and descriptor IDs absent from
the calculator catalog.

The first draft uses explicit level 90, C0, R1, 10/10/10 assumptions with the
baseline's selected weapons and artifact sets. It produces 12 positive-count
rows and 6 available zero-count rows. The external KQM record now supports the
roster and its written action sequence, not the baseline equipment or fixture
investment. A traceable manual translation compares each unambiguous action to
a calculator formula and finds five token-supported mismatches: Neuvillette's
Judgment and Skill counts, and Xilonen's Skill rush, N2 sequence, and Burst.

Six mappings remain explicit review cases instead of receiving guessed counts:
Furina's C0 Normal Attack is absent from the calculator catalog, the Salon
formula bakes in 32 hits without a source duration, Neuvillette's Spiritbreath
proc frequency is timing-dependent, and the source does not establish Kazuha's
absorbed plunge, absorbed Burst, or Swirl occurrences. The report therefore remains
`needs-domain-review`, does not support guide claims, and is not an optimization
input.

This is a deliberate review boundary. A domain owner can now inspect a concrete
formula-count proposal instead of approving an abstract optimizer plan. Only
after the counts and default combat options are credible should the factory
add artifact sheets and compare loadout choices.

## ER deferral

No new ER target, solver behavior, or rotation-sequence inference was added in
this checkpoint. The existing Diona calibration remains an
`assumption-incomplete` historical fixture. Its provenance now depends only on
the Diona source and ER implementation inputs, so unrelated repository growth
does not create ER work.

## Next evidence gates

1. Review the source action-to-formula translation and the five reported count
   mismatches for the matched Furina team.
2. Decide whether a small reviewed role catalog is worthwhile, beginning with
   healer, or leave role-dependent template coverage unresolved.
3. Compare the two now-captured exact Quickbloom examples with current preset
   assumptions before deciding whether either should become a baseline team.
4. Review the Keqing–Ineffa role constraints and exact examples before treating
   the new-release refresh as more than source coverage.
5. Resolve or parameterize the Salon and Swirl hit-count gaps, then add explicit
   artifact main stats and roll budgets to one reviewed formula plan.
6. Reproduce the selected loadout, then compare one equipment dimension at a
   time before attempting joint four-character search.

None of these outputs may modify production presets without a separate review
and acceptance step.
