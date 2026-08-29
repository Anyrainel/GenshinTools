# Checkpoint 22: bounded team investment and Itto source slice

This checkpoint adds the first source-stated constellation range to an exact
team. It also captures a narrow Itto guide slice that can exercise that range
without introducing ER, rotation, formula-count, damage, or ranking claims.

## Investment model

A manual exact-team member and its consolidated knowledge investment can now
carry one of these distinct shapes:

- an exact constellation;
- a minimum constellation;
- a maximum constellation;
- both minimum and maximum constellation bounds;
- no constellation information.

An exact value cannot be combined with a range, an inverted range is invalid,
and a missing side remains missing. In particular, `C2+` consolidates as
`minConstellation: 2`; it is not rewritten as exact C2 or expanded into five
separate C2-C6 source observations.

The shared investment helper preserves every optional field when reports clone
team evidence. Formula-plan construction and artifact-generation preflight
accept a concrete local assumption only when its constellation falls inside
the source range and any captured Talent levels also match. Unspecified source
investment remains non-conflicting, but this permissive technical check is not
evidence that the source explicitly applies at every constellation.

## Itto source slice

The indexed KQM Itto manual snapshot contains seven agent-assisted, unreviewed
records from the page labeled `Version 5.6`:

- one artifact-stat observation that deliberately omits the source's ER term
  and keeps only the offensive priority tail;
- one contextual, unranked artifact-set observation covering Husk,
  Marechaussee Hunter, Retracing Bolide, and Long Night's Oath;
- one contextual, unranked weapon observation covering Redhorn, Serpent Spine,
  Whiteblind, and Fruitful Hook;
- one Itto/Xilonen/PHEC/PHEC team template with the source-stated Crystallize
  reaction;
- separate Yelan and Xingqiu exact examples;
- one Itto/C2+ Xilonen/Gorou/Furina exact example.

The snapshot does not copy a source rotation, infer a formula count, attach
character-wide equipment to a team member, or turn page order and
classification labels into one global weapon or artifact ranking.

## Repository and coverage result

Consolidation now produces 394 records: 191 baseline and 203 candidate records.
KQM contributes 64 narrow records, including 15 exact teams, 7 templates, and
38 character-guide observations.

The exact-team inventory contains 900 member-investment observations:

- 898 constellation-unspecified members;
- one exact C6 Diona member;
- one lower-bounded C2+ Xilonen member.

The all-character report retains the C2+ member as one atomic exact-team
observation whose Xilonen applicability is C2-C6 with only the source minimum
flag set. It does not manufacture a source claim for each constellation.

Team-template coverage now labels every external exact-team outcome as
`character-roster-only`, preserves the four member investment scopes, and
states `investmentEvaluated: false`. The C2+ Itto roster overlaps the current
GenshinTools Itto/Xilonen/Gorou/Furina preset by character IDs, but that result
does not prove the preset has, requires, or satisfies C2 Xilonen.

The two other Itto exact examples and the broader Itto/Xilonen/PHEC/PHEC
template are currently uncovered by baseline rosters. This is a coverage fact,
not evidence that they are better than the existing teams.

The new equipment claims increase the non-ER search audits to 1,072 artifact
occurrences and 1,012 weapon occurrences. All four new weapon IDs are in the
released weapon domain. Three of the four Itto artifact sets are initially
enumerated by the current artifact grammar; Retracing Bolide remains outside
the tier-list candidate filter. Search coverage is not suitability or a
computed recommendation.

## ER and guide boundary

No structured ER target, ER floor, rotation, formula plan, damage replay,
optimizer result, rank, winner, or ideal-roll requirement is added here. The
source's omitted ER need is retained only as an explicit unknown and as context
for why the captured substat order starts after ER.

All Itto records remain promotion-ineligible until human review. This
checkpoint establishes a safer validation target for later composition; it
does not establish a working guide factory or a publishable Itto guide.

## Next non-ER gate

Project the captured Itto equipment and stat claims onto each exact Itto team
through an explicit condition ledger. Roster-decidable conditions such as
Furina or Xianyun presence must be evaluated separately from inventory,
investment, buff-coverage, and gameplay conditions. The result should expose
applicable, inapplicable, and unresolved claim groups without choosing a build
or inferring an order.
