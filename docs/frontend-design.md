# Frontend design checks

For new surfaces and substantial UI redesigns, read this before choosing structure.
For explicit edits, follow the user's instructions and the nearest existing pattern.

- Inspect 2–3 sibling surfaces first. Reuse their layout, mode selectors and shared
  controls. A new calculation does not justify a new interaction pattern.
  Team calculator submodes use `OptionButtonRow`, `OptionButtonCell` and `OptionButton`.
- Keep shared inputs shared. Add only missing settings; do not copy an entire
  roster panel. Keep character-specific settings in compact per-character columns.
- Put mode selection, visible calculation settings, Run, then results in that
  order. Do not put Run in the title or collapse primary settings by default.
- Do not add unsolicited subtitles or explanatory paragraphs around mode selectors.
  Remove obvious explanations, repeated labels and pre-run empty result boxes.
  Add clarification only when it changes a user's decision; use concise labels or
  existing tooltips/popovers. Do not label ordinary hypothetical builds as problems.
- Use static field labels and player-facing absolute values. Reuse existing
  constellation/refinement Select controls; avoid raw HTML selects and internal
  delta values. Use portraits only where identity scanning needs them.
- Multiple views of one calculation reuse its results. Ownership filters constrain
  their named dimension: owned weapons do not imply owned artifacts.

Before finishing, inspect the actual changed page at phone and desktop widths,
including a narrow sidebar, both languages and a non-default theme. Check text
and controls stay inside their own containers; hidden overflow is not a layout
fix. Verify inactive boundaries, every selected border and popover placement.

Type checks and passing tests do not establish visual quality. Compare the rendered
result with the sibling pattern and remove anything that adds space without meaning.

Condensed from the former `frontend-guide`, with lessons from the team-analysis
refactor. Current user instructions and implementation take precedence.
