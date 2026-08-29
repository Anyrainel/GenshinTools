# Checkpoint 9: Direct artifact probe and Klee source breadth

Date: 2026-08-29

This checkpoint is still not a working guide factory. It adds the first bounded
direct execution of the existing ideal-artifact generator, preserves the
counterintuitive output as validation evidence, and expands the external
knowledge repository with one more old-character refresh. It does not rank
artifact assignments, calculate a credible rotation, or publish a guide.

## Klee Luna IV source slice

The KQM Klee Quick Guide snapshot adds seven narrow, unreviewed records:

- general on-field artifact main stats and offensive substat priorities, with
  the source's ER term deliberately omitted;
- a default on-field 4pc set plus four separately conditioned set choices;
- Reliquary of Truth as a best-generalist 5-star claim;
- The Widsith as a separate best-generalist 4-star claim, without inventing a
  cross-rarity ordering;
- a C2+ off-field support branch with Thrilling Tales of Dragon Slayers and
  Wandering Evenstar as alternatives plus 4pc Instructor;
- an exact Klee/Chevreuse/Durin/Fischl example and source rotation; and
- an exact Klee/Furina/Albedo/Xilonen example and source rotation.

Both exact teams remain non-exhaustive and unordered. Their member equipment,
investment, and ER targets are empty. `Klee Combo` remains unresolved in both
rotations, and the Fischl Skill/Burst branch remains unresolved in the Overload
example. The source's C4+ quickswap discussion is retained as a schema gap
rather than being forced into a standalone playstyle record with invented
equipment.

The Klee/Furina/Albedo/Xilonen roster has an exact baseline match. The
Klee/Chevreuse/Durin/Fischl roster is uncovered. Neither result is a quality or
ranking judgment.

## The direct generator boundary

The passing preflight authorizes only a technical exercise. The formula plan is
still unreviewed and has eight gameplay-review blockers, so the new runner calls
`runGenerator()` directly and never calls the one-character comparison wrapper.
It uses the explicit level-90, C0, R1, 10/10/10 fixture, enemy level 110, enemy
resistance 0.1, roll multiplier 0.85, and the `8_6` substat budget.

Every candidate receives a fresh `TeamBuild`, and candidates run sequentially.
This isolates the generator's internal mutations. The runner passes neither
buff overrides nor a `perChar` constraint map; in particular, it does not
invent or enforce ER thresholds. It retains candidate-local failures and the
final generated artifact structure, but no numerical damage, score, candidate
rank, winner, or recommendation.

The probe also exposed a dangerous API mismatch. A guide-factory formula-draft
line uses `characterId`, while the runtime combo line requires `charId`. Passing
the draft object through unchanged can be silently filtered by the compiled
calculator instead of failing, leaving a zero objective that still produces
plausible-looking artifacts. The new boundary checks each formula against the
rebuilt candidate catalog and explicitly translates `characterId` to `charId`
before generation.

## The bounded artifact matrix

The 2x2 matrix is assembled from independently recorded character-guide builds.
No source record binds these four build targets to the exact team or to one
another. It keeps Keqing on 4pc Thundering Fury and Xilonen on 4pc Scroll of the
Hero of Cinder City, then crosses:

| Candidate | Ineffa | Furina | Outcome |
| --- | --- | --- | --- |
| Seed | 4pc Aubade of Morningstar and Moon | 4pc Golden Troupe | Completed structurally |
| Furina variation | 4pc Aubade of Morningstar and Moon | 4pc Tenacity of the Millelith | Completed structurally |
| Ineffa variation | 4pc Silken Moon's Serenade | 4pc Golden Troupe | Completed structurally |
| Two-character variation | 4pc Silken Moon's Serenade | 4pc Tenacity of the Millelith | Completed structurally |

All four candidates satisfy the requested assignments and complete the same
eight monotonic progress phases. Generated pieces are checked for exact team
and slot shape, requested set, 5-star rarity, level 20, legal main stats, at
most four finite positive substats, and no main-stat/substat conflict.

A fifth repository-recorded Xilonen/Instructor build target is kept as a
negative control. It is rejected before execution as `non-five-star-set`, with
`generatorInvoked: false`. This is the probe's deterministic search policy,
not a claim that `runGenerator()` itself cannot accept Instructor. The first
probe admits only all-5-star assignments because the lower-rarity flex/display
path can choose a random 5-star set key and make the artifact identity
non-deterministic.

## Observed discrepancies

Successful plumbing did not produce source-convincing stat choices:

- every matrix cell generates an ATK% Goblet for Keqing where the exact source
  build lists Electro DMG;
- every matrix cell generates a Geo DMG Goblet for Xilonen where the exact
  source build lists DEF%; and
- both Tenacity cells generate an HP% Sands for Furina where that exact source
  build lists ER.

The Furina discrepancy remains unresolved while ER constraints and other
gameplay assumptions are absent. The probe cannot assign causality or support
an ER recommendation. Generated filler flat-stat keys can also be absent from a
source priority list; the comparison preserves that observation without
declaring a contradiction because the source list is not exhaustive.

These results validate the user's concern that a computation completing is not
evidence that it is credible. The generator is ordered and greedy, its formula
objective is still unreviewed, and the output supports no artifact, stat, or
guide claim.

## Current repository and report coverage

After the Klee snapshot is consolidated, the repository contains 365 records:

- 191 baseline and 174 candidate records;
- 138 character guides, 220 exact teams, 6 team templates, and 1 historical
  energy record; and
- 35 KQM records, including 10 exact teams and 12 explicit rotation entries.

Exact external-team coverage is now 2 present and 8 uncovered. Artifact search
coverage accounts for 1,059 observations: 1,015 initially enumerated, 21
conditionally representable, and 23 not representable. Weapon coverage
accounts for 987 non-ER observations: all 987 IDs are in the global released
domain, all 987 refinements remain unspecified, 975 choices match the
character's native weapon type, and 12 legacy choices do not.

`validate.ts` now rebuilds ten durable reports in memory, including the
artifact-generation preflight and this technical probe, and rejects stale
checked-in output. Focused Klee snapshot and technical-probe tests pass, the
guide-factory TypeScript check passes, and pipeline validation reports 0 errors
plus the same 12 known legacy weapon-type warnings.

All new data, computation, and reports remain under `scripts/guide-factory`.
No application or Worker module imports them, no production preset is changed,
and no candidate knowledge record is promoted or accepted.

## Next evidence gate

The next bounded experiment should hold the repository-build-seeded candidate
and objective fixed while changing the generator's algorithmic `carryCharId`
through all four members. That term describes which character receives the
generator's extra refinement phases; it is not a claim about an in-game carry
role. Candidate order and team configuration order should then be tested as a
separate sensitivity axis.

Only after those effects are measured should the lab design a coordinate-
descent or broader joint-search wrapper. Formula-plan review remains a hard
gate before comparative damage, candidate ranking, or guide validation. ER
calculation and ER recommendation work remain deferred until the broader
knowledge, validation, and non-ER computation path is substantially further
along.
