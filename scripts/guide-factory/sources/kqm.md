# KQM manual observation profile

Registry ID: `kqm`

Status: active for narrow manual observations only.

## Capture unit

One JSON snapshot represents one guide page at one visible source version. The
active narrow samples currently cover Diona, Furina, Keqing, Klee, Kokomi, and
Noelle. A record represents one independently reviewable heading-scoped claim
group, not the whole guide.

Required page metadata:

- exact canonical page URL;
- visible title and publisher;
- capture date;
- visible guide version when present;
- attribution note linking the original guide.

Each primary record locator must use the page URL and a heading. Supporting
locators may point to another heading or a separately versioned source, but
their facts must remain distinguishable.

## Supported record shapes

- `character_guide` for contextual weapons, artifacts, main stats, and substat
  priorities;
- `character_role` for a narrow positive member observation scoped to one hard
  role option in one same-page team-template slot;
- `team_template` for four-slot archetypes that are broader than exact teams;
- `team` for an explicitly listed four-character example;
- `energy_guidance` only when the source supplies a concrete target and its
  relevant context. New ER capture is deferred.

Recommendation ordering, tied groups, conditions, constellation bounds,
example intent, exhaustiveness, and ranking claims must be stated explicitly.
Page order is never treated as a ranking by default.

A KQM `character_role` record is not a publisher-wide role catalog. It must
bind to a role that appears in the target slot's hard `options`, never only in
`highlightedOptions`. Named members, conditions, optional constellation bounds,
exhaustiveness, and any ranking claim must come from the located source slice.
Omitted characters are not negative evidence unless the source explicitly
claims exhaustiveness, and consolidation must not merge the record into a
global resolver.

The Furina Luna II sample captures only Xilonen as positive evidence for the
Hypercarry & Mono Element template's healer slot. It intentionally omits other
healers, supplies no numeric constellation bound, makes no ranking claim, and
leaves the template's role selector unresolved for coverage.

When a source binds two or more artifact assignments together, the team may
store an `artifactPlans` entry. Its assignments remain one coupled conditional
claim. They must not be flattened into independent global character
recommendations or interpreted as a jointly optimized result.

The Keqing Luna I sample tests whether a new release can expose changed team
options for an old character. It preserves fully captured source-positive lists for the
off-field-Hydro and resistance-shred role selectors with unspecified
exhaustiveness and no rank, plus four exact teams from the same page. The
paired sample validates only the four Hydro/shred pairs actually published as
exact teams; unexercised positive members remain in their source records, and
the remaining cross-product is neither emitted nor judged. Viridescent
Venerer text is retained as a condition acknowledgement boundary, not proof of
aura setup or gameplay execution. Element and named-character callouts remain
highlights, not substitutes for the hard role constraints, and the template
stays unresolved for broad coverage.

The Kokomi Luna V sample tests coupled artifact delegation. It preserves the
source's one-way condition that a well-invested Columbina can use Aubade when
Kokomi takes Silken Moon's Serenade. It does not invent an investment
breakpoint, a reverse implication, or a ranking between that plan and
Ocean-Hued Clam.

The Noelle Luna VIII sample tests an old-character build refresh. Its general
Hexerei weapon, artifact set, investment-scoped stat branches, and exact team
remain separate records. The general recommendations must not be attached to
the exact team without a source claim that binds them together, and the
offensive priority capture omits the source's ER term while ER work is deferred.

The Klee Luna IV sample tests a broader old-character refresh without mirroring
the page. It keeps default and team-conditional artifact sets distinct,
preserves separate best-generalist claims within the 5-star and 4-star weapon
classes, and records C2+ support equipment without inventing a cross-playstyle
ranking. Its two exact teams retain `Klee Combo` as an unresolved segment rather
than selecting an attack string from a different section. The C4+ quickswap
playstyle remains an explicit schema gap because the source does not bind it to
unique equipment and the current repository has no standalone playstyle record.

## Naming and review

`sourceRecordId` is unique across every active KQM snapshot. Include a stable
subject and source-version discriminator when a page may later be recaptured.

Agent-assisted capture is always `unreviewed`. Source-fidelity review must name
the reviewer and date, but even a reviewed extraction remains
promotion-ineligible until separate gameplay acceptance.

## Exclusions

- no full-page text, images, translations, or field-by-field mirror;
- no global weapon rank assembled from context-specific sections;
- no exact teams expanded from a slot template;
- no inferred constellation, refinement, ER, rotation, formula count, or
  optimality claim;
- no linked sheet treated as sharing the guide page's version automatically.

KQM asks users to link guides used as references; no broad republication
license has been established. The active profile is therefore narrow,
attributed paraphrase rather than systematic content ingestion.
