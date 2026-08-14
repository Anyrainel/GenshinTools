---
name: genshin-knowledge
description: >
  Reference and verification tools for the Genshin Impact damage calculator.
  TRIGGER when: verifying or looking up character/weapon/artifact game data (talent values, buff percentages, multipliers, conditions),
  reviewing or writing buff/formula implementations, or needing damage calc code patterns.
  Key tool: `impl_audit.py show C|W|A <id>` exports official game text and talent parameters — use this as the first step
  to verify in-game values.
---

# Genshin Knowledge Base

Reference material for implementing, reviewing, and tracking damage calculator extensions in `src/lib/dmgcalc/`.

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
