## roadmap
- Ongoing: more damage formulas and customization options
- P0: More useful upgrade and sub-stat reroll suggestions
- P1: Better graduation celebration effects
- P2: (Future) One-click full-roster artifact assignment + export + auto-lock script

## 2025-03-16

### features
- Optimizer algorithm reworked: prioritizes optimal results more aggressively, but takes longer
- DPS builds now support auto-tuning: automatically calculates sub-stat weights based on constellation and refinement
- Artifact lock / unlock recommendations
- More character formulas

### fixes
- Fixed other-element Travelers being marked as unowned during import
- Fixed incorrect artifact generation for 2+2 set combinations
- Fixed optimizer producing level 0 artifacts when no buffs are active

## 2025-03-12

### features
- GOODScanner release: comprehensive OCR scanning
- Redesigned recommendation page: new UI, new algorithm, accounts for crit overflow (continuous improvements coming)
- Support optimizing teams with fewer than 4 characters
- Allow deleting existing items from inventory

## 2025-03-11

### features
- Manual account data editing
- Stygian Onslaught Archive
- Enable swap after optimize, swapped result can be frozen
- Optional off-set piece mode for builds with high crit or ER requirements
- Redesigned character stat panel: now shows sub-stat details under various conditions, plus the max value of each stat used by the formula
- Select enemy innate element aura to adjust available formulas and reaction-triggered buffs

### fixes
- Fixed artifact score not appearing for certain slots
- Fixed implementation issues for some characters and weapons
- Fixed issues where optimize would sometimes reuse the same artifact

## 2025-03-08

### features
- Damage formulas now support reaction variants based on team elements: Vaporize, Melt, Aggravate, Spread
- Multi-hit formulas let you choose which hits trigger reactions and which stay raw
- Combine multiple characters' formulas to simulate full rotation damage
- Smarter artifact optimizer — fewer odd main stats and wasted crit rolls
- Set a target crit ratio to trade expected damage for higher actual crit damage
- New minimum crit rate constraint when using Favonius weapons
- Lock optimized artifact assignments — must unlock before changing teams
- Generate ideal artifacts to preview a team's theoretical damage ceiling
- GOOD import now auto-syncs character and weapon ownership
- Redesigned inventory page with equipped items view and richer filters

### fixes
- Evaluation page now shows artifact details correctly
- Raised some recommendation thresholds on the suggestions page
- Fixed page freezing during the onboarding tour
- Fixed implementation bugs for several characters
