# Damage Calculator TODO

---

## Assumptions & Design Patterns

- **One formula at a time**: When buffs exist for multiple mutually exclusive scenarios (e.g. Venti P4 absorbed elements, Skirk P2 normal vs. burst baseDmg%), all buffs can be included because we calculate one formula at a time — any formula only picks up its matching buff entries via element/ability/reaction filters.
- **S10 element absorption**: For abilities that absorb one element (Q vortexes, etc.), we iterate present team elements and create one buff/formula per possible absorbed element. Each formula only matches its corresponding element filter.

---

## Characters

### Known Limitations
- **sigewinne P1**: off-field party members only (excluding Sigewinne) — approximated as `otherOnField`
- **aloy E**: Coil stack NA bonus + Rushing Ice NA bonus requires mid-combat stack counting (CombatOpts candidate, but low priority)
- **skirk P3 & tartaglia P3**: +1 E level to all party members requires all-Hydro/Cryo team with ≥1 of each — team buff not implemented (skirk's own talent level is handled).
- **nefer C6**: formula restructure needed — complex interaction between elevated% buff and multi-formula self/shade split
- **varesa C4**: mutual exclusivity between Fiery Passion (+100% burst dmg%) and Diligent Refinement (+5×ATK plunge baseDmg) — one-time buff for a single formula, cannot cleanly model both branches

### Missing formula entries
- **citlali C4**: Obsidian Skull 1800% EM Cryo formula not added
- **shenhe Q**: field DoT ticks (59.6% / 70.4%) not modeled
- **qiqi Q**: talisman DMG not modeled (pure healer)
- **gorou P2**: DEF-based E/Q DMG scaling not modeled (pure support)
- **faruzan E**: polyhedron hit (267.8%) not modeled (only Collapse Vortex in runbook)
- **baizhu Q**: Spiritvein hit count depends on incoming damage; approximated as ×6
- **sethos Q**: Dusk Bolt (353.1% EM) not modeled
- **kaveh C6**: Pairidaeza's Light (61.8% ATK Dendro) not modeled
- **collei / kaveh P1**: Sprout effect (40% ATK × 3s) not modeled
- **xinyan E**: DoT (60.5%) and Q Pyro DoT (72%) not modeled
- **candace C6**: The Overflow wave (15% HP Hydro, every 2.3s) not modeled
- **nilou E**: Dance of Haftkarsvar multi-step hits not modeled (only Q + Bountiful Core)
- **cyno C6**: Raiment extra Duststalker Bolt per Normal not modeled
- **aloy E**: Freeze Bomb / Chillwater Bomblet hits not modeled
- **dehya E**: Molten Inferno coordinated attack not modeled (only Q)
- **traveler_hydro E**: Hold mode Dewdrop hits (59% per hit, up to 6s) not modeled
- **kaedehara_kazuha Q**: Absorbed-element slash/DoT damage not modeled (low significance relative to swirl/team buff value)
- **sayu E**: Hold mode absorption damage not modeled (no E hold formula exists as base)
- **lauma C6**: Sanctuary extra Lunar-Bloom hit per tick not modeled (periodic, requires Ascendant Gleam)

### Important Approximations (documented in comments)
- **xiangling Q**: Pyronado tick count approximated as ~10 (C0–C3) or ~14 (C4+)
- **shenhe E**: Icy Quill trigger quota (5 press / 7 hold) not enforced — modeled as unlimited
- **xiao P1**: ramp approximated as 15% average; true max 25% at 15s
- **yelan P2**: ramp approximated as 25% average; true max 50% at 15s
- **mavuika P2**: decaying DMG% (without C4) not captured; peak 40% used
- **chasca**: Shining Shell reactions modeled as `reaction: "none"` — real DPS higher with Vaporize/Melt team
- **mualani**: Shark Missile multi-target falloff (72% at 3 targets) not modeled
- **baizhu C2**: Gossamer Sprite: Splice (250% ATK, fires every 5s) not modeled
- **sigewinne P1**: off-field-only scope approximated as `team`

### Ignored Mechanics
- **fischl C6**: Oz coordinated attack (30% ATK Electro per active hit)
- **raiden_shogun E**: Eye of Stormy Judgment coordinated attack fires every 0.9s based on ally actions
- **kamisato_ayato C6**: 2 extra Shunsuiken strikes on first post-E hit
- **sangonomiya_kokomi C1**: extra fish on last Normal combo hit (doesn't count as Normal ATK)
- **kuki_shinobu C4**: Thundergrass Mark on-field NA/CA/Plunge hit (every 5s, 9.7% HP)
- **chasca P2**: Burning Shadowhunt Shot triggered per-Nightsoul-Burst
- **chasca C2/C4**: AoE burst on Shining Shell / Radiant Soulseeker Shell hit
- **columbina P2**: conditional 33% proc effects on Lunar reactions
- **columbina C4**: per-cast HP% baseDmg on Gravity Interference hit (once/15s)
- **nefer P1/C1/C2**: Veil of Falsehood seed-absorption stack tracking
- **ineffa C6**: thundercloud-triggered Lunar-Charged hit (once/3.5s)
- **illuga C2**: Aedon summon every 7 Nightingale's Song stacks consumed
- **skirk C6**: Havoc: Sever combo-state coordinated attacks
- **skirk**: All Shall Wither E-mode complex combat state interactions
- **chiori C2**: Kinu periodic coordinated attacks (hard to combine with per-hit triggered damage)
- **columbina E**: Gravity Ripple continuous damage (periodic, not significant for per-hit optimization)
- **mavuika C6**: Scorching Ring periodic damage (low priority periodic damage)
- **kirara C4**: Shield-triggered coordinated attack (periodic, every ~5s)
- **traveler_anemo/geo/electro/dendro/hydro/pyro P3**: special Charged Attack: Whirlwind/Rockfell/Detonate/Verdessence/Tidebound/Inferno (require stack build-up from teammates)
- **traveler_electro C6**: World-Shaker every 3rd Falling Thunder
- **traveler_pyro C6**: Nightsoul's Blessing NA/CA/Plunge conversion + CD

---

### Weapons
- **Weak spot DMG** (Sharpshooter's Oath): "Increases DMG against weak spots" doesn't map to any existing stat key. Needs a new `weakSpot%` key or similar if we want to model it.
- **Bond of Life support**: The Finale of the Deep bond-cleared ATK bonus is 2.4%–4.8% of the total Bond of Life value cleared, capped at 150–300 flat ATK. Currently modeled as the cap value due to no ability to check Bond of Life eligibility.
> Bond of Life mechanism: 赤月之形、海渊终曲、纯水流华武器可以提供生命之契，希格雯、克洛琳德、阿雷奇诺都可以给自己增加生命之契。这三个角色同样也可以清除自己身上的生命之契，同时队伍内只要有治疗角色也可以清除。海渊终曲、纯水流华的buff需要清除，而赦罪、白雨心弦的buff需要增加。谐律异想断章的buff需要提升或降低3次。

---

### Artifacts
- **Ocean-Hued Clam (4pc)**: Healing creates bubble → deals 90% of accumulated healing (up to 30,000 max recorded) as fixed damage. Modeled as empty buffs array (no effect). This is a separate damage source; no formula created for now (low utility due to fixed damage).
