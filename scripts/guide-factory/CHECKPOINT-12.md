# Checkpoint 12: Bounded Team-Roster Candidate Domain

## Status

This checkpoint adds the first offline roster-domain expansion seam. It turns
six selected repository team-template records into compact counts and hashes,
not serialized candidate teams. Four templates are currently resolvable and
two are deliberately withheld because their actual slot selectors require
roles that the released catalog does not provide.

Everything remains under `scripts/guide-factory`. No application, Worker,
production preset, or distributed-bundle path imports this work. ER remains
deferred.

## Question under test

The narrow empirical question is:

> Can repository team templates be expanded over a deliberately bounded
> released-character catalog with deterministic duplicate handling, runtime
> reaction gates, and repository validation targets, while failing closed on
> unresolved selectors or runtime errors?

This checkpoint does not ask which roster is best, rank any character or team,
or establish that a structurally admitted roster follows the template's
intended play.

## Catalog boundary

The wrapper starts with the 139 stable character IDs exported by the current
resource catalog. It withholds all 14 `manekin_*` and `manekina_*` variants as
special-avatar forms, leaving 125 guide-domain-eligible IDs. This is a selected
stable catalog boundary, not a claim that it contains every released playable
candidate under every product interpretation.

The seven `traveler_*` element forms remain available selectors, but all share
one `traveler` playable identity. A roster can therefore contain at most one
Traveler form. The 125 IDs represent 119 playable identities.

The report retains counts and SHA-256 fingerprints for the full stable,
excluded, and eligible catalog boundaries. It does not serialize the expanded
candidate rosters.

## Template boundary

The selected repository records are Furina Electro-Charged, Freeze,
Hypercarry/Mono, Quickbloom, and Vaporize plus Keqing Lunar-Charged.

Actual slot `options` are interpreted as OR within one slot and AND across the
four slots. `highlightedOptions` remain annotations only. They never narrow an
otherwise `any` slot.

The current status is:

- Electro-Charged, Freeze, Quickbloom, and Vaporize are structurally resolved;
- Furina Hypercarry/Mono is withheld because an actual slot requires the
  unresolved `healer` role; and
- Keqing Lunar-Charged is withheld because actual slots require
  `off-field-hydro-applier` and `resistance-shred` roles.

If any actual option in a slot is an unresolved role, the conservative current
policy withholds the whole template rather than treating the other options as a
complete interpretation. Role selectors are not weakened into element
selectors or unrestricted flex slots. The wrapper verifies that the actual
withheld IDs exactly match this expected set; drift makes the overall
experiment not comparable.

## Enumeration observations

For each resolved template, the core resolves compact slot pools, rejects exact
member duplicates and same-playable-identity assignments, canonicalizes the
remaining four-character rosters, and retains multiplicity histograms and
domain hashes.

| Template | Valid ordered assignments | Runtime rejected | Runtime accepted | Accepted canonical rosters |
| --- | ---: | ---: | ---: | ---: |
| Electro-Charged | 84,846 | 16,811 | 68,035 | 41,866 |
| Freeze | 98,718 | 0 | 98,718 | 57,607 |
| Quickbloom | 31,412 | 0 | 31,412 | 27,413 |
| Vaporize | 124,292 | 0 | 124,292 | 77,477 |

Quickbloom contains 3,999 canonical rosters with two valid slot bindings; this
is why canonical-roster and ordered-assignment counts must remain separate.
Multiplicity is structural ambiguity, not a score.

## Runtime reaction gate

The default offline gate preloads current character stats and calls
`TeamMeta.hasReaction` at C0 with no pre-existing enemy aura. A roster is
accepted only when every reaction declared by its template is available under
that fixed calculator check.

This is a runtime compatibility gate, not rotation validation. It does not
establish application order, aura timing, trigger ownership, buff coverage,
survivability, or damage. Electro-Charged is the only current resolved domain
with runtime rejections; the other three happen to admit every structurally
valid roster under this gate.

Preparation, evaluation, or invalid-result failures are preserved as typed
failures. They make the affected template and the wrapper report not
comparable. The wrapper never compares surviving domains after such a failure.

## Repository validation targets

The report evaluates 20 template/team target associations covering 19 unique
exact repository team records without treating them as independent gameplay
truth:

- two KQM Furina Quickbloom examples from the same page verify extraction,
  same-page inferred slot fits, structural multiplicity, and accepted-domain
  membership;
- 17 GenshinTools baseline/template associations over 16 unique baseline team
  records verify cross-source structural and runtime membership across
  Electro-Charged, Freeze, and Vaporize; and
- two explicit runtime-gate negatives verify structural membership followed by
  Electro-Charged rejection. One is also part of the 17 baseline overlaps, so
  these evidence classes intentionally overlap.

The negative teams are the baseline
Raiden/Columbina/Xilonen/Furina team, whose repository label records
Lunar-Charged, and the KQM Keqing/Ineffa/Furina/Xilonen Lunar-Charged example
checked against the Furina Electro-Charged template. Both are structurally in
the Electro-Charged domain and both are rejected by the current runtime gate.
The KQM target also retains a cross-page audit fit and proves that this inferred
binding is present, not unique. The source did not publish a machine-readable
binding to the Furina template.

All 20 current associations match their expected membership, multiplicity,
binding, and runtime outcomes. Their source categories and recorded
reaction-label relationships are retained separately. Same-page checks are not
independent, and baseline overlap does not establish template intent or
gameplay quality. No independent gameplay-validation target has been supplied.

The wrapper independently rebuilds the existing structural template-coverage
comparison and requires its complete matched-baseline pair set for the four
resolved templates to equal these 17 declared overlap associations. Repository
growth therefore fails the fixture instead of silently leaving a new baseline
overlap untested.

## Compact report and claim boundary

The durable report contains slot-pool sizes and hashes, assignment and
canonical-roster counts, multiplicity histograms, accepted/rejected counts and
hashes, typed failures, and exact validation-target outcomes. It contains no
expanded candidate-roster array, score, ranking, winner, recommendation,
damage comparison, or ER input.

The outer comparison status is `comparable` only when:

- no core failure is present;
- no resolved template is `not-comparable`;
- the expected and actual role-withheld template sets match exactly; and
- every validation target matches its declared outcome and multiplicity.

Expected role withholding alone does not make the four resolved domains
incomparable.

## What this checkpoint establishes

It establishes that the current selected templates and catalog can produce a
deterministic, compact, failure-aware domain summary and can be checked against
same-source extraction examples, internal baseline overlap, and reaction-gate
negative controls.

It does not establish:

- intended play, rotation feasibility, or reaction ownership;
- team quality, ranking, recommendation, or optimality;
- constellation-sensitive or investment-sensitive domains;
- role resolution for healer, application, resistance-shred, or other semantic
  selectors;
- an independently validated gameplay corpus; or
- ER requirements.

## Verification

- the guide-factory TypeScript check passes;
- focused core and wrapper tests cover deterministic real output, exact domain
  counts and hashes, Traveler identity, role withholding, all 20 validation
  associations, compact-output boundaries, and fail-closed preparation/evaluation
  errors;
- stale-report validation regenerates the report from hashed repository,
  catalog, and runtime-gate inputs; and
- the report remains confined to the offline guide-factory workspace.

## Next evidence gate

Role selectors need a reviewed, versioned role catalog before the two withheld
templates can enter this domain. Gameplay credibility also needs genuinely
independent validation targets and investment-aware checks. Until those exist,
the roster-domain output should remain an inspectable factory intermediate,
not a source of player-facing team recommendations.
