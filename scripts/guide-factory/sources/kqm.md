# KQM manual observation profile

Registry ID: `kqm`

Status: active for narrow manual observations only.

## Capture unit

One JSON snapshot represents one guide page at one visible source version. The
active narrow samples currently cover Diona, Furina, and Keqing. A record
represents one independently reviewable heading-scoped claim group, not the
whole guide.

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
- `team_template` for four-slot archetypes that are broader than exact teams;
- `team` for an explicitly listed four-character example;
- `energy_guidance` only when the source supplies a concrete target and its
  relevant context. New ER capture is deferred.

Recommendation ordering, tied groups, conditions, constellation bounds,
example intent, exhaustiveness, and ranking claims must be stated explicitly.
Page order is never treated as a ranking by default.

The Keqing Luna I sample is intentionally team-only. It tests whether a new
release can expose changed team options for an old character. Its
off-field-Hydro and resistance-shred requirements remain source-defined role
selectors; element and named-character callouts are highlights, not substitutes
for those hard constraints.

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
