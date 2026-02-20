# Damage Calculator TODO

## Effects Need Review

### Characters
- **ATK SPD not tracked**: `StatKey` does not include ATK SPD. Characters with ATK SPD buffs (Dahlia P2/C6, Jean C2, Yun Jin C6, etc.) have those effects unmodeled. Affects DPS calculations since faster attacks = more damage per window.

### Weapons
*(None currently identified)*

## Known Limitations

### Characters
- **Tartaglia / Skirk Passives**: +1 talent level for party — requires Lv.11/Lv.14 talent data which we do not have in the data pipeline.
- **Chasca element-conversion**: Shells convert to other elements based on party comp — needs to create "expected" damage formulas based on team comp.
- **Enemy-count scaling**: Effects like "DMG increases per enemy hit" are context-dependent. Defaulting to 1 enemy.
- **Traveler kit**: Separate implementation needed per element, but currently does not exist in kit data. Will defer to later.

### Weapons
- **Weak spot DMG** (Sharpshooter's Oath): "Increases DMG against weak spots" doesn't map to any existing stat key. Needs a new `weakSpot%` key or similar if we want to model it.
- **Finale of the Deep Bond of Life flat ATK**: The bond-cleared ATK bonus is 2.4%~4.8% of the total Bond of Life value cleared, capped at 150~300 flat ATK. Currently modeled as the cap value due to no ability to check Bond of Life eligibility.
- **Mountain-Bracing Bolt teammate E trigger**: Passive gives additional Skill% when teammates use their E. Currently assumes 1 teammate trigger is always active (doubling the base value).

### Artifacts
- **Ocean-Hued Clam (4pc)**: Healing creates bubble → deals 90% of accumulated healing (up to 30,000 max recorded) as fixed damage. Modeled as empty buffs array (no effect). This is a separate damage source; no formula created for now (low utility due to fixed damage).