# Checkpoint 2: External Pilot and Assumption-Incomplete Calibration Target

Date: 2026-08-29

This checkpoint still does not produce guides. It establishes the first
external, assertion-level validation target and demonstrates that numerical
proximity must remain separate from source-assumption compatibility.

## Source decision

The pilot uses a narrow, linked observation of KQM's Diona Quick Guide. KQM
requests a link when its guide is used as a content reference, but no broad
content-republication license was found. The snapshot therefore contains only
heading-scoped, paraphrased assertions and source locators. It is not a scraper
or corpus mirror.

Crimson Witch was inspected but not ingested. Its character pages expose a
large undocumented structured payload, while its public legal material grants
no reuse permission and the records contain no per-record upstream citations.
It remains a manual cross-check or link-out unless written permission is
obtained.

## Records added

One page becomes five independently reviewable source records:

1. support weapons;
2. support artifact sets;
3. support artifact main stats and substats;
4. C6 Diona ER guidance for the Mavuika, Citlali, Bennett sheet row;
5. one C6 Diona, Mavuika, Citlali, Bennett Forward Melt example team.

The team is explicitly an example from a non-exhaustive list with no ranking
claim. The page's `Luna VIII` label and the linked ER sheet's Version 6.7 label
remain separate. All five records are agent-assisted, unreviewed candidates and
are promotion-ineligible.

Consolidation now produces 335 records:

- 191 GenshinTools baseline records;
- 139 legacy candidates;
- 5 KQM pilot candidates.

## Schema changes forced by the source

- Unranked lists no longer become implicit rankings.
- Alternatives and tied ranks are different group types.
- External weapon, artifact, and stat assertions can be partial and heading-
  scoped rather than stretched into one giant build object.
- Editorial teams preserve example/prescriptive intent, exhaustiveness, and
  ranking claims.
- ER guidance is first-class and can be separate from a team card.
- Rounded public ER bands, formatted sheet cells, and raw supporting
  calculations are stored separately.
- Source-fidelity review is distinct from gameplay acceptance and promotion.
- Source rotations retain unresolved shorthand instead of inventing formula
  counts.

## Baseline comparison

The durable comparison report contains nine assertion-level comparisons and no
score, winner, confidence, vote count, or merged recommendation order.

For Diona it finds:

- Sacrificial Bow overlaps, while KQM adds four options and marks Favonius as
  its default without claiming a ranked list.
- Noblesse Oblige overlaps; five other KQM sets are conditional additions.
- Sands overlap on ER and add HP%; Goblet matches on HP%.
- Circlets overlap on HP% and Healing Bonus, but KQM orders them while the
  baseline ties them and conditionally adds CRIT Rate for Favonius.
- Substats overlap on ER and HP%, but their authored priority directions differ
  under incomplete scope assumptions.
- ER guidance, the exact four-character team, and the rotation are absent from
  the baseline.

These are review facts, not votes for either source.

## First external computation target

The linked ER sheet supplies a raw Favonius calculation of
`192.1826030394418%` in cell N38, formatted as 192%, for a 20-second Mavuika
rotation; the guide displays a 190-200% band. The offline probe uses the
authored action sequence, one explicit Favonius proc on Diona's Hold Skill, C6
Diona, C0 probe assumptions for unspecified teammates, no periodic procs, and
no invented enemy drops.

Current calculator output:

- expected-particle mode: `207.33652312599747%`;
- max-particle mode: `186.78160919540272%`.

Neither falls inside the page band or matches the raw sheet calculation. That
is not yet a calculator verdict: the engine probe does not implement the
source's safe-RNG or default-enemy-particle assumptions, and its expanded
ordinal timeline accounts for only 11.5 of the source's 20 seconds. The fixture
therefore has status `assumption-incomplete`. Tests lock the raw and formatted
source values, normalization decisions, full engine scenario, engine results,
and incomplete status. They do not require agreement.

## Domain decisions now needed

- mathematical meaning of the source's safe-particle assumption;
- event-model meaning and timing of default enemy particles;
- whether one Favonius proc is guaranteed, probabilistic, or user-supplied;
- treatment of unspecified teammate constellations;
- raw sheet calculation versus formatted cell versus rounded page band as a
  future acceptance target;
- whether leaving Mavuika's damage combo unexpanded is valid for this energy-
  only replay;
- how to validate Favonius cooldown feasibility across the source's 20-second
  rotation when the expanded engine timeline is shorter.

These are the first questions that genuinely benefit from the domain owner's
game and engineering judgment. Until resolved, the incomplete probe is a useful
boundary, not a factory defect to patch around.
