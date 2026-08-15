## roadmap
- Ongoing: more damage formulas and customization options
- P1: Better graduation celebration effects

## 2026-08-15

### features
- Added the new 7.0 character Cryo Traveler, with full damage formulas
- Added the new 7.0 weapons and the "Heart of the Furnace" and "Scarlet Proof" artifact sets
- Added a compact artifact set filter on the Resources page
- Archive listings now show a "BETA" tag on characters, weapons, and artifact sets not yet available in the official game, so beta content stays easy to tell apart
- Updated GGArtifact build, team, and tier list presets

### fixes
- Fixed several accuracy issues in the Energy Recharge calculator, so Energy Recharge requirements and particle counts come out correct for more team setups
- Removed the older, duplicate Energy Recharge calculator now that the main one is accurate
- Fixed Radiance: Stellar Swirl for Diona, Qiqi, and Yumemizuki Mizuki, which was missing or dealt no damage on some teams
- The Stellar coefficient controls now show up for any Stellar-enabling teammate, not just Sandrone
- Fixed roughly 30 other damage formula issues across Fontaine, Inazuma, Natlan, and other regions, including Kinich, Kirara, and Raiden Shogun
- Fixed disabled artifact builds still showing up in resource tips, evaluation, and score-up recommendations

## 2026-07-15

### features
- Added a dedicated "Redesigned ER" tab under Team Comp, featuring a fully rewritten Energy Recharge calculator and optimizer
- Implemented "Radiance: Stellar-Conduct" combat options and damage calculations for Witch's Revelation characters, including Wriothesley, Yae Miko, Cyno, Qiqi, Diona, Beidou, and Yumemizuki Mizuki
- Exposed a "Polestar hits" slider in the Team Comp analyzer to customize attach-hit counts and apply the corresponding datamined reaction damage coefficients
- Added support for the 5-star Claymore "A Teaspoon of Transcendence", including its stats and Stellar-Conduct damage refinement buffs
- Show offline troubleshooting tips as a prominent banner in the scanner and manager dialogs when disconnected

### fixes
- Fixed Sandrone's Normal and Plunging Attack elements to correctly deal Cryo damage, and adjusted her C1 coordinated attack trigger conditions
- Fixed the passive buffs for the "Disaster and Remorse" polearm to correctly target only the on-field character

## 2026-06-25

### features
- Character filters now include faction and utility options, so you can find characters by Hexerei, Moonsign, Nightsoul, healer, shielder, and similar roles
- Updated GGArtifact build and team presets
- ER calculation now includes particle data for Qiqi
- The off-piece rule dialog now has a restore defaults button for quickly resetting built-in flex rules

### fixes
- Score-up recommendations now compare current and suggested builds with the same scoring method, so gains match the stat changes and decreases are shown in red
- Lock Helper now protects high-level artifacts with concentrated useful rolls more reliably, reducing mistaken fodder decisions
- Team preset refreshes now clean up settings for removed preset teams, so hidden stale teams no longer affect your setup
- Team optimization now respects each character's excluded artifacts during heuristic setup, preventing excluded pieces from being assigned to the wrong character

## 2026-06-09

### features
- Artifact upgrade recommendations now have finer apply-to-game controls: apply one character, skip unchanged equipment slots, and protect artifacts frozen in Team Comp
- Account Data import now offers direct latest GOODCapture / GOODScanner downloads while keeping the GitHub project link
- Updated Nod-Krai data: Lohen and Disaster and Remorse moved into the official archive, with beta data for Sandrone and A Teaspoon of Transcendence
- Added Sandrone damage formulas, Stellar-Conduct reaction calculation, and A Teaspoon of Transcendence weapon buffs
- Artifact hover cards now show recorded initial substat values, making upgrade starting points easier to judge

### fixes
- Fixed 2+2 artifact set matching so upgrade recommendations keep the correct set combinations more reliably
- Fixed ER calculation for alternate bursts and action variants, so characters like Varesa and Flins use the right energy costs and refunds
- Weapon and artifact choice now pick team-appropriate combat options for candidate gear instead of always using the highest-buff state
- Hu Tao C6 is no longer counted as a stable CR budget source, preventing recommendations from over-suppressing her CR

## 2026-05-30

### features
- Added Nicole's attack damage formulas
- Updated 6.6 game data, adding new enemies and Stygian Onslaught bosses to the archives

### fixes
- Various character damage formula fixes across Mondstadt, Liyue, and Sumeru, plus a fix to Angelos' Heptades' shield-based buff
- Updated the HoYoLAB / 米游社 import logic so it keeps fetching your account data reliably
- Fixed character card display on mobile and made cards in the account data grid share an even height

## 2026-05-16

### features
- Added support for new characters: Nicole and Prune; weapon: Angelos' Heptades; artifacts: Celestial Gift and Disenchantment in Deep Shadow
- Added feedback submission for suggestions and bug reports

### fixes

## 2026-05-11

### features
- Cloud Backup is now available. You can back up your data to prevent loss or keep it in sync across multiple devices
- GOODScanner now supports scanning recently obtained artifacts from Lock Helper, for updating only the latest N artifacts
- GOODScanner Manager now supports lock/unlock actions starting from the most recently obtained artifacts

### fixes
- Fixed the Resource Planning page not working

## 2026-04-27

### features
- GOODScanner's basic scanning workflow now supports HDR

### fixes
- Fixed several recommendation page issues, such as current scores not updating automatically and upgrade recommendations being too strict
- Fixed several Lock Helper issues, such as disabling lenient mode making some artifacts require locking; the algorithm is now more stable
- GOODScanner fixed cases where lock and astral mark state scanning could be unstable

## 2026-04-26

### features
- Reworked the artifact upgrade recommendation page — now distributes all inventory artifacts across characters based on their build scores, and computes upgrade suggestions from that global assignment
- The recommendation page now supports one-click equip-to-game syncing (requires GOODScanner); the feature is still under testing and may be unstable
- Added an Energy Recharge calculator, accessible from the Team Damage page (collapsed by default); the feature is still under development and current data may not be accurate

### fixes
- Fixed buff issues for several characters, such as Xilonen pre-C2 Geo RES shred and Linnea's EM-to-DMG% condition
- Refactored large portions of code to improve load performance and data compatibility

## 2026-04-16

### features
- Auto-populate lunar electro-charged and lunar crystallize trigger counts in formulas, for more accurate Investment Analysis
- Once damage gains saturate, the optimizer now starts pursuing support sub-stats needed by shielders and healers
- Lock Helper is now more stable — no longer swaps the set-fallback lock between different transitional builds across runs
- Artifact filter merge algorithm now consolidates filters into up to 3 entries (6.5 raised the in-game cap)

### fixes
- Fixed frozen artifacts occasionally still being used by the optimizer
- Fixed buffs that convert one stat into damage (e.g. Mavuika's burst Fighting Spirit, Citlali C1, Shenhe's Icy Quill) — now scaled off combat panel stats instead of base stats
- Fixed passives/constellations of the form "X deals an additional Y% of the original damage" — now multiplicative instead of additive
- Reworked several Varesa and Linnea formulas to better match practical rotations
- Fixed Force On-Field calculation errors
- Min ER / CR constraint: now uses on-field stats as the constraint target, and fixed cases where the constraint produced unqualified artifacts
- Fixed off-field buff display issues, and fixed buff overrides not applying across different combo IDs
- Fixed builds subscription not updating
- Various character fixes and added a few less-common formulas

## 2026-04-08

### features
- 6.5 update: added Linnea and her signature weapon
- HoYoLAB / 米游社 cookie import: fetch your full character roster (all owned characters with equipped gear) using your account cookie
- Sanctifying Elixir / Sanctifying Unction usage recommendations (in the set evaluation page)
- Multi-instance tier lists, with auto-switch to the paired account
- Side-by-side comparison of optimized vs. currently-equipped damage
- Team Grid: drag-and-drop reordering
- Lock Helper: new option to evaluate high-level artifacts (logic under testing)
- Several characters' constellation effects that add a one-time damage bonus are now implemented as buffs instead of standalone formulas

### fixes
- Improved page cache settings
- Fixed Kokomi P2 heal% conversion multiplier, Pyro Traveler plunge formula, and other issues
- Update Lunar Reactions coefficients

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
