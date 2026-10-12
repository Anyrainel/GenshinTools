# Team UI consistency and Star Rail parity

## Accepted scope

Audit the complete Team surface against proximity, alignment, contrast and
repetition. Keep the shared roster and calculation configuration above the five
analysis modes. Site navigation remains outside this change. The local mode rail
must be slightly taller and use theme color, with an appearance distinct from
the site tabs. Preserve keyboard navigation and readable inactive boundaries.

- Proximity: related calculation fields share a wrapping row; character-specific
  additions stay in their character column. No duplicated roster or empty panels.
- Alignment: titles, controls and results follow the existing card grid. Roster
  shortcuts align right. Settings precede Run; Run is never a header action.
- Contrast: selected controls have complete boundaries and legible text in every
  theme. Ownership dims individual item icons, never whole team cards.
- Repetition: reuse sibling mode selectors, ItemPicker, Select and responsive
  popovers. Label edits do not authorize replacing their interaction pattern.

Do not add explanatory subtitles, ownership warnings or instructions around
ordinary hypothetical builds. Keep all previously agreed calculation scopes:
owned weapons may use theoretical artifacts; next investments reuse path results;
future constellation settings display absolute counts, not internal deltas.

## GGStarRail

Implement one analysis workspace with shared team and battle configuration,
followed by Relics / Builds / Investment / Characters / Rotation
(遗器 / 配装 / 补金 / 角色 / 循环). Switching modes or teams preserves user work.
Use the Star Rail repository's controls, terminology, assets and engines.

Relics retains inventory optimization. Builds retains light-cone/set comparison;
owned-light-cone filtering belongs beside related calculation fields and does not
require owned relics. Investment uses compact additional character settings and
one calculation for its result views. Characters has replacement and unowned
replacement submodes. Rotation uses the native battle timeline's energy and skill
points. Unsupported searches expose their settings but disable the primary action;
never manufacture rankings or import Genshin's energy calculator.

Adopt a coherent analysis URL and update internal links. Any changed persistence
shape or meaning needs a versioned migration at every carrying boundary and a
realistic public hydration/import test. Do not copy cross-product state.

## Completion

Inspect actual rendering at 320px and desktop, with a narrow sidebar, both
languages and a non-default theme. Check container overflow, grouping, selected
borders and popovers. Passing tests alone do not establish visual quality.
Run each repository's required checks, preserve unrelated pending work, commit
the finished changes, then push both repositories as explicitly requested.
