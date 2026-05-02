# Explanatory Copy And Visuals

Use this when a UI surface needs to explain behavior, rules, scoring,
eligibility, setup, errors, statuses, or algorithmic choices. The goal is not
to make the explanation look busier; it is to make the user model more accurate.

## Content Rules

- Explain domain behavior, not UI containers. Avoid treating cards, panels,
  badges, rows, or chips as concepts unless the user must understand that UI
  object to act correctly.
- Start from the expectation gap: what might a reasonable user assume, and what
  does the system actually do?
- Ground every claim in the current implementation or product behavior. If the
  behavior depends on a default, cap, ordering rule, merge rule, or exclusion,
  say that rule directly.
- Use player-facing nouns and verbs. Avoid internal type names, short codes,
  implementation stages, and developer shorthand unless the UI already defines
  them for users.
- Define unavoidable terms once, then reuse the same wording. Do not rename the
  same concept across bullets.
- Remove obvious statements. Do not explain that sorting, filtering, opening a
  dialog, or reading a card changes nothing unless users could reasonably expect
  it to affect the result.
- Keep bilingual copy meaning-aligned, not word-for-word. Chinese should be
  natural product text with community-appropriate game wording.

## Visual Rules

- Add a visual only when it clarifies structure: inclusion/exclusion, order,
  branching, transformation, reuse/ownership, state mapping, range bucketing,
  before/after comparison, or priority.
- If removing a visual does not remove meaning, remove the visual.
- Keep each visual attached to the rule it explains. Do not illustrate one
  bullet with symbols that belong to another bullet.
- Prefer the same control or state vocabulary the user already sees in the app:
  toggles for on/off behavior, check/cross for included/excluded states, chips
  for values, arrows for transformations, and grouped values for ordering or
  comparison.
- Use semantic theme tokens and existing component states. Reserve destructive
  colors for destructive or urgent meaning; use lower-intensity exclusion colors
  for non-dangerous "not participating" states.
- Fit visual units to their content unless equal width communicates a real
  comparison. Avoid stretched chips, title-plus-subtitle clutter, and repeated
  labels inside compact diagrams.
- Text and visuals should share the explanation. Do not make the text repeat
  everything the visual already says, and do not make the visual require a
  separate legend when direct labels would be clearer.

## Authoring Workflow

1. List the few non-obvious behaviors users need to understand. For compact
   help surfaces, prefer 1-4 focused points; if more rules are necessary, group
   them by workflow stage or split the explanation.
2. For each behavior, write the likely expectation gap in plain language.
3. Check the implementation or data source for the exact rule, default, cap,
   ordering, and edge case.
4. Draft the copy around consequences for the user, not around code flow.
5. Add a visual only for relationships that text alone makes hard to parse.
6. Remove decorative structure, redundant labels, and UI-container nouns.
7. Verify the final wording against i18n, responsive fit, and at least one
   non-default theme when color carries meaning.

## Publish Checklist

- Each sentence teaches a non-obvious behavior, condition, or consequence.
- Every visual has a named job: order, inclusion, transformation, state,
  comparison, reuse, or priority.
- No visual is merely an icon-led restatement of the bullet text.
- No UI-container noun appears as a first-class concept unless it is necessary
  for the task.
- Algorithm assumptions and thresholds match the source code or data.
- Terms remain stable across bullets and across languages.
