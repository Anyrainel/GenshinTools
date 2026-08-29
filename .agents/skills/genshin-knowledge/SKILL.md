---
name: genshin-knowledge
description: >
  Verify concrete Genshin mechanics and support implementation or review in `src/lib/dmgcalc/`.
  Use only when the task requires exact game text, values, or activation conditions; implements or audits a specific
  character, weapon, artifact, reaction, buff, or damage formula; or investigates a concrete calculator correctness or
  coverage issue. Do not use for product strategy, guide-source collection, data/schema design, team/build recommendation
  research, optimizer or UX architecture, or work that merely mentions formulas or formula counts.
---

# Genshin Knowledge Base

Reference material for verifying concrete game mechanics and implementing, reviewing, or tracking damage calculator
extensions in `src/lib/dmgcalc/`. This is not a general team-building, guide-research, or optimization-design skill.

## Activation Boundary

Use this skill when at least one of these is required:

- verify an exact multiplier, stat value, game-text condition, reaction rule, or buff interaction;
- implement or review a specific character, weapon, artifact, reaction, buff, or formula in the damage engine;
- diagnose a concrete damage-calculator discrepancy or implementation-coverage gap.

Do not load it for high-level product planning, guide-source ingestion, recommendation-data schemas, team discovery,
optimizer design, or UX work unless that task also requires one of the concrete mechanic checks above. Formula IDs or
formula counts used only as data-model inputs are not enough to trigger this skill.

When exact entity data is needed, `impl_audit.py show C|W|A <id>` exports official game text and talent parameters; use it
as the first verification step.

## Topics

| # | Topic | File | What it covers |
|---|---|---|---|
| 1 | Elemental Reactions | `elemental-reactions.md` | All reactions by trigger element, effects, EM scaling, regional mechanics (Nightsoul, Moonsign/Lunar, Radiance/Stellar), reaction naming and scoping |
| 2 | Damage Formulas | `damage-formulas.md` | Game math: multiplicative zones, EM bonus formulas, per-reaction-type damage equations |
| 3 | Damage Design | `damage-design.md` | Engine architecture: types, stat zones, buff/formula classes, registration, TeamMeta, combo system, orchestration |
| 4 | Translator Rules | `translator-rules.md` | Review checklist: U0–U13 (all entity types), S1–S11 (character-only) |
| 5 | Tools & Tracking | `tools-and-tracking.md` | `impl_audit.py` commands, tracker YAML schema, state machine |

All topic files are in the same directory as this file: `.agents/skills/genshin-knowledge/`.

To launch damage agents (review, triage, implement), use the `dmg-agents` skill instead — it handles dispatch. This skill is reference material only.
