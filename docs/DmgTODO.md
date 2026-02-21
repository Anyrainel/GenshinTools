# Damage Calculator TODO

## Effects Need Review

### Characters
*(None currently identified)*

### Weapons
*(None currently identified)*

## Known Limitations

### Characters
- **Tartaglia / Skirk Passives**: +1 talent level for party — requires Lv.11/Lv.14 talent data which we do not have in the data pipeline.
- **Chasca element-conversion**: Shells convert to other elements randomly based on party comp — impossible to predict which reaction will occur.
- **Traveler kit**: Separate implementation needed per element, but currently does not exist in kit data. Will defer to later.

### Weapons
- **Weak spot DMG** (Sharpshooter's Oath): "Increases DMG against weak spots" doesn't map to any existing stat key. Needs a new `weakSpot%` key or similar if we want to model it.
- **Finale of the Deep Bond of Life flat ATK**: The bond-cleared ATK bonus is 2.4%~4.8% of the total Bond of Life value cleared, capped at 150~300 flat ATK. Currently modeled as the cap value due to no ability to check Bond of Life eligibility.
> Bond of Life mechanism: 赤月之形、海渊终曲、纯水流华武器可以提供生命之契，希格雯、克洛琳德、阿雷奇诺都可以给自己增加生命之契。这三个角色同样也可以清除自己身上的生命之契，同时队伍内只要有治疗角色也可以清除。海渊终曲、纯水流华的buff需要清除，而赦罪、白雨心弦的buff需要增加。谐律异想断章的buff需要提升或降低3次。

### Artifacts
- **Ocean-Hued Clam (4pc)**: Healing creates bubble → deals 90% of accumulated healing (up to 30,000 max recorded) as fixed damage. Modeled as empty buffs array (no effect). This is a separate damage source; no formula created for now (low utility due to fixed damage).