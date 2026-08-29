# Checkpoint 13: Full-Team Local Stat-Marginal Diagnostic

## Status

This checkpoint adds an ER-free, offline diagnostic for asking how one average
artifact substat roll changes a fixed full-team technical objective at several
captured operating points. It does not produce stat weights, a roll allocation,
or a build recommendation.

Everything remains under `scripts/guide-factory`. No application, Worker,
production preset, or distributed-bundle path imports this work.

## Question under test

The narrow empirical question is:

> Can we evaluate local per-character stat marginals against the same full-team
> objective at all four carry-derived generator endpoints, retain operating-
> point sensitivity instead of averaging it away, and compare the resulting
> evidence with existing GenshinTools baseline priority bands without treating
> either side as truth?

This question comes before any attempt to replace AutoTune or derive player-
facing stat priorities.

## Fixed fixture boundary

The wrapper reuses the Keqing/Ineffa/Furina/Xilonen fixture and the fixed
`01-seed-aubade-golden` set node:

- Keqing: 4pc Thundering Fury;
- Ineffa: 4pc Aubade of Morningstar and Moon;
- Furina: 4pc Golden Troupe; and
- Xilonen: 4pc Scroll of the Hero of Cinder City.

Those equipment choices come from four independent GenshinTools baseline
character builds. The exact KQM team record does not bind that equipment to
the team.

The objective contains the same 11 exact-valued authored translation lines as
checkpoint 11. Their provenance remains unreviewed: 10 mappings are complete,
one Keqing mapping is partial, and all eight readiness blockers remain. The
combo contains no reaction line or reaction override, supplies no explicit
formula buff override, and cannot establish rotation order, timing, reaction
ownership, or buff coverage.

## Four fresh operating points

The wrapper makes four new sequential `runGenerator` calls, once for each team
member as the algorithmic carry. Every invocation receives a fresh team. The
exact run count, carry set, and maximum concurrency of one are comparability
gates.

The current captures contain one unique Ineffa sheet and two unique sheets for
each of Keqing, Furina, and Xilonen. This differs from complete artifact
fingerprint multiplicity: a full artifact record can differ while its computed
sheet is equal, and the diagnostic operates on the latter.

Complete sheets remain transient. The durable report keeps their recomputed
SHA-256 fingerprints. The caller-supplied complete-artifact capture hash is an
opaque correlation ID checked only for SHA-256 syntax; the core explicitly
recomputes the team-config and sheet fingerprints.

Generator-captured sheets can contain incidental or filler ER. Such values are
retained only as part of an operating point and its fingerprint. This
checkpoint passes no ER threshold, applies no ER perturbation, and draws no ER
conclusion.

## Marginal domain and replay count

For each endpoint and character, the core replays a baseline and then adds one
average five-star roll of each of these nine stats independently:

`CR`, `CD`, `ATK%`, `HP%`, `DEF%`, `EM`, flat `ATK`, flat `HP`, and flat `DEF`.

That creates:

```text
4 endpoints × (1 baseline + 4 characters × 9 stats) = 148 replay points
```

All 148 current points pass the interpreted-versus-compiled calculator
agreement check. The separately computed formula-override map is empty at all
148 points. That is an observation about this objective, not proof that
character, weapon, artifact, or team implementations contain no buffs.

The perturbation is additive. It does not remove another roll, enforce artifact
slot legality, or preserve a roll budget. It is therefore a local derivative,
not a feasible allocation.

## Retained evidence

Every endpoint keeps the baseline objective and, for every character/stat
pair, the perturbed objective, raw delta, relative delta, effective numerical
tolerance, tolerance-aware sign, and within-character normalization to that
endpoint's largest positive marginal.

The cross-endpoint layer keeps only ranges and sign/zero classifications. It
does not average the four endpoints. Normalized values are local to one
character and endpoint; they cannot be compared across characters or treated
as scalar weights.

For the stats listed by the fixed GenshinTools baseline builds, the current
technical observations are:

| Character | Baseline priority band | Stat | Tolerance-aware result across endpoints | Local normalized range |
| --- | ---: | --- | --- | ---: |
| Keqing | 100 | CR | positive at all four | 0.2170–0.9124 |
| Keqing | 100 | CD | positive at all four | 1.0000–1.0000 |
| Keqing | 75 | ATK% | positive at all four | 0.9623–0.9798 |
| Keqing | 75 | EM | zero at all four | 0.0000–0.0000 |
| Ineffa | 100 | CR | positive at all four | 0.5863–0.5863 |
| Ineffa | 100 | CD | positive at all four | 1.0000–1.0000 |
| Ineffa | 100 | ATK% | positive at all four | 0.8917–0.8917 |
| Ineffa | 50 | EM | zero at all four | 0.0000–0.0000 |
| Furina | 100 | CR | positive at three; zero at Furina-carry | 0.0000–0.6445 |
| Furina | 100 | CD | positive at all four | 1.0000–1.0000 |
| Furina | 100 | HP% | positive at all four | 0.9312–0.9465 |
| Xilonen | 100 | DEF% | positive at all four | 0.6252–0.7419 |
| Xilonen | 50 | CR | positive at all four | 0.9772–1.0000 |
| Xilonen | 50 | CD | positive at all four | 0.9970–1.0000 |

The 100, 75, and 50 values are categorical GenshinTools baseline build
priority bands. They are not external truth and are not numerically comparable
with the normalized marginal ranges in the final column.

## Review cases, not disagreements

Two GenshinTools-baseline-listed observations are all-zero: Keqing EM and
Ineffa EM. Because
the technical combo has no reaction lines or reaction overrides, those zeros
cannot test reaction-value contribution. The report classifies both as
objective-coverage review cases, not as evidence against the baseline builds.

Furina CR is positive at three endpoints and tolerance-zero at the Furina-carry
endpoint. This is a mathematically grounded operating-point sensitivity case:
the sign/zero classification changes without introducing an arbitrary band.
It may reflect local CR saturation or another operating-point/objective effect,
but it cannot support one global priority conclusion.

Keqing CR also demonstrates why one endpoint is insufficient even when every
sign remains positive: its local normalized value spans approximately 0.217 to
0.912 across the two captured Keqing sheet states. Averaging that range would
hide the dependency that this experiment was designed to expose.

## Failure boundary

A generator or capture failure is retained as a typed wrapper failure. If all
four exact carry endpoints are not captured under the declared sequential
domain, the core diagnostic is not run. A fingerprint, config, sheet, replay,
calculator-agreement, or non-finite result failure makes the core report not
comparable and removes the cross-endpoint summary. Surviving endpoints are
never averaged or presented as a complete domain.

## What this checkpoint establishes

It establishes that the current calculator and generator can support a
failure-aware, full-team local-marginal diagnostic over several real generated
operating points, with 148 dual-path replays and explicit overlap against the
existing baseline priority labels.

It does not establish:

- a scalar stat weight or strict stat order;
- a legal or ideal roll allocation;
- that the unreviewed formula-count objective represents one rotation;
- reaction value, trigger ownership, or buff-window coverage;
- that a baseline priority band is correct or incorrect;
- an artifact or build recommendation;
- local or global optimality; or
- an ER requirement.

## Next evidence gate

Before this can inform a guide, the objective needs reviewed formula/action
coverage, including reactions and buff semantics. The next computation should
also test budget-neutral roll exchanges or another legality-preserving local
move across several operating points. That would show whether the additive
derivative signal survives a feasible allocation boundary without prematurely
collapsing it into user-facing weights.
