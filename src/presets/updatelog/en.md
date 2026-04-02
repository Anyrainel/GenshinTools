## roadmap
- Ongoing: more damage formulas and customization options
- P0: More useful all character equipment and artifact upgrade suggestions
- P2: Better graduation celebration effects

## 2025-04-02

### features
- Force On-Field toggle: override which character is treated as on-field in single and combo damage calculations
- Welcome Guide: redesigned with interactive tab previews and polished copy for new users
- Equip to Game: swap guide and freeze bar equip buttons now available to all users

### fixes
- Fixed Yelan Q DMG bonus values — now uses actual DMG% instead of incorrectly multiplied param

## 2025-03-31

### features
- Weapon Choice: new tab ranking all compatible weapons by optimized rotation damage
- Artifact Manager: send lock/unlock and equip instructions to the game via local agent
- Precise substat import: Enka exact roll decoding and GOOD roll solver
- Team Comp reorganized into Damage / Frozen / Investment tabs
- Frozen Artifacts: dedicated tab with per-team sections and standalone freezing
- Investment Analysis: full-page view replacing the old analyzer dialog
- Evaluation page: sort characters by tier ranking
- Improved empty states with preset-aware onboarding guidance

### fixes
- Fixed triage sending lock/unlock for protected artifacts
- Fixed optimizer tiebreaker when multiple weapons compete for the same slot

## 2025-03-29

### features
- Full talent level simulation: no longer forced to use Lv.10/13 data
- Per-constellation combos: rotation formulas auto-adjust when constellation changes, showing which skills unlock at each constellation
- All formulas now visible in the selector with constellation badges (e.g. C1, C2)
- Analyzer combo tab: customize rotation composition and min-ER overrides per constellation
- Skirk/Childe passive auto-activation: talent level buffs now apply correctly
- Partial GOOD import: importing data only overrides sections present in the file, preserving existing inventory
- 20+ new character formulas

### fixes
- Fixed archive talent display for Ayaka and Mona showing wrong values (sprint/burst param mismatch)
- Fixed fusion reaction, lunar electro-charged, and lunar crystallize damage calculation and display
- Fixed buff deduplication merging buffs incorrectly when they affect different stats

## 2025-03-26

### features
- Team comp: search, sort, and filter controls for managing large team lists
- Reuse modes: allow same-character reuse, or force same-character same-set reuse of frozen artifacts
- Stat panel redesign: idle vs combat stat views with compact responsive layout
- Per-buff activation dialog: fine-tune buff active state and hit counts per damage part
- Custom flex rules: user-defined artifact off-piece patterns with add/remove UI
- Freeze currently equipped artifacts
- Image export: themed backgrounds and responsive sizing
- Reaction overrides for multi-element characters (Chasca, Varka)
- Faster page switching with lazy routes and cached presets
- Home page assets converted to WebP, reducing load size by 75%

### fixes
- Fixed critMode not adjusting combo total and per-line damages
- Fixed duplicate artifact bug; redesigned saturation detection
- Fixed inflated marginal gains; unified computation across display and optimizer
- Fixed recommendation threshold filtering producing wrong results

## 2025-03-23

### features
- Extra buffs: add food, environment (Imaginarium Theater, Spiral Abyss, Stygian Onslaught), and custom stat buffs to damage calculations
- Extra buffs now appear as full entries in the Buffs & Effects Ledger with icons and names
- Analyzer reworked: more accurate artifact snapshots per constellation, faster evaluation, and per-phase progress display
- Analyzer graph view uses improved path-finding for more complete upgrade paths
- Half-set filter chips in triage and inventory views
- Calculation limitations info sheet in team detail page
- More character and weapon formulas: Skirk, Xiangling, Baizhu, Chongyun C6, and others
- Formula options now show explicit "None" / "0" choices instead of implicit defaults

### fixes
- Fixed buff stack allocation not updating correctly when constellation changes
- Fixed artifact generation not accounting for buff overrides, producing less optimal artifacts
- Optimizer and generator now use compiled formulas for combo evaluation, significantly faster

## 2025-03-21

### features
- Formulas now account for off-field damage with tag-aware stat resolution
- Investment analysis: graph view showing optimal upgrade order, with customizable start and end points
- Buff fine-tuning: manually adjust buff active state and hit counts per damage part
- AutoTune batch mode: tune sub-stat weights for multiple characters at once using rotation data
- More character, weapon, and artifact formulas and data updates, with more options
- New formula compiler: significantly speeds up damage evaluation

### fixes
- Fixed numerous character and weapon buff implementations
- Improved team comp page layout on narrow and mid-width screens
- Fixed build migration issues and improved store robustness

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
