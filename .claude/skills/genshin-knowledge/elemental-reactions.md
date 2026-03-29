# Elemental Reactions Reference

## Part 1: Reactions by Trigger Element

The **trigger** is the second element applied. Aura elements (Pyro, Hydro, Cryo, Electro, Dendro,
Quicken) leave persistent gauges on enemies. Geo and Anemo do not form persistent auras.

Symmetric reactions are listed under both trigger directions.

† = upgraded reaction when a Moonsign 5★ character is in the party.

### Pyro (trigger)
- **Hydro** aura → Vaporize (1.5×)
- **Cryo** aura → Melt (2.0×)
- **Electro** aura → Overloaded
- **Dendro** aura → Burning

### Hydro (trigger)
- **Pyro** aura → Vaporize (2.0×)
- **Cryo** aura → Frozen
- **Electro** aura → ElectroCharged / LunarCharged†
- **Dendro** aura → Bloom / LunarBloom†

### Cryo (trigger)
- **Pyro** aura → Melt (1.5×)
- **Hydro** aura → Frozen
- **Electro** aura → Superconduct

### Electro (trigger)
- **Pyro** aura → Overloaded
- **Hydro** aura → ElectroCharged / LunarCharged†
- **Cryo** aura → Superconduct
- **Dendro** aura → Quicken
- **Quicken** aura → Aggravate

### Dendro (trigger)
- **Pyro** aura → Burning
- **Hydro** aura → Bloom / LunarBloom†
- **Electro** aura → Quicken
- **Quicken** aura → Spread

### Geo (trigger)
- **Pyro** aura → Crystallize (Pyro)
- **Hydro** aura → Crystallize (Hydro) / LunarCrystallize†
- **Cryo** aura → Crystallize (Cryo)
- **Electro** aura → Crystallize (Electro)

### Anemo (trigger)
- **Pyro** aura → Swirl (Pyro)
- **Hydro** aura → Swirl (Hydro)
- **Cryo** aura → Swirl (Cryo)
- **Electro** aura → Swirl (Electro)

### No Reaction
- Cryo ↔ Dendro
- Geo, Anemo, and Dendro with each other

---

## Part 2: Reaction Effects

### Vaporize
- **Trigger**: Hydro on Pyro aura → **2.0×**; Pyro on Hydro aura → **1.5×**
- **Type**: Amplifying — multiplies the triggering hit's damage
- **EM scaling**: `(2.78 × EM) / (EM + 1400)` additive bonus to the multiplier

### Melt
- **Trigger**: Cryo on Pyro aura → **2.0×**; Pyro on Cryo aura → **1.5×**
- **Type**: Amplifying — multiplies the triggering hit's damage
- **EM scaling**: same formula as Vaporize

### Overloaded
- **Trigger**: Pyro ↔ Electro (either direction)
- **Type**: Transformative — deals AoE Pyro DMG; knocks small enemies back
- **Scaling**: character level + trigger character's EM

### Superconduct
- **Trigger**: Cryo ↔ Electro (either direction)
- **Type**: Transformative — deals small AoE Cryo DMG
- **Effect**: Reduces Physical RES of affected enemies by 40% for 12s
- **Scaling**: character level + trigger character's EM

### Frozen
- **Trigger**: Hydro ↔ Cryo (either direction)
- **Effect**: Immobilizes the enemy; no reaction damage
- **Shatter**: Heavy attacks (Claymore, Geo, plunge) on a Frozen enemy deal Physical DMG and break Freeze

### Burning
- **Trigger**: Pyro ↔ Dendro (either direction)
- **Type**: Transformative — applies Pyro aura and deals continuous Pyro DoT
- **Scaling**: character level + EM of the character maintaining Burning

### ElectroCharged
- **Trigger**: Hydro ↔ Electro (either direction)
- **Type**: Transformative — deals Electro DMG; pulses periodically while both elements coexist; spreads to nearby Hydro-affected enemies
- **Scaling**: character level + trigger character's EM

### LunarCharged *(Moonsign upgrade of ElectroCharged)*
- **Requires**: Moonsign 5★ character in party
- **Effect**: Creates a Thundercloud that deals damage based on combined team stats

### Crystallize
- **Trigger**: Geo on Pyro / Hydro / Cryo / Electro aura
- **Effect**: Drops an elemental shard; picking it up grants a shield of the crystallized element
- **No reaction damage**

### LunarCrystallize *(Moonsign upgrade of Hydro-Crystallize)*
- **Requires**: Moonsign 5★ character in party
- **Effect**: Creates a Moondrift that deals damage based on combined team stats

### Swirl
- **Trigger**: Anemo on Pyro / Hydro / Cryo / Electro aura
- **Type**: Transformative — spreads the absorbed element to nearby enemies and deals AoE DMG of that element
- **Note**: Swirled element can trigger secondary reactions on affected enemies
- **Scaling**: character level + Anemo character's EM

### Quicken
- **Trigger**: Dendro ↔ Electro (either direction)
- **Effect**: No immediate damage; leaves a Quicken aura enabling two follow-up reactions:
  - **Aggravate**: Electro trigger on Quicken → Electro DMG + **1.15** flat additive bonus; scales with Electro character's EM
  - **Spread**: Dendro trigger on Quicken → Dendro DMG + **1.25** flat additive bonus; scales with Dendro character's EM

### Bloom
- **Trigger**: Hydro ↔ Dendro (either direction)
- **Effect**: Creates a Dendro Core (max 5 on field); core explodes after ~6s or on contact, dealing AoE Dendro DMG
- **Scaling**: character level + EM of the character who created the core
- **Further reactions**:
  - **Hyperbloom**: Electro hits a Dendro Core → homing Electro DMG; scales with Electro character's EM
  - **Burgeon**: Pyro hits a Dendro Core → AoE Pyro DMG; scales with Pyro character's EM

### LunarBloom *(Moonsign upgrade of Bloom)*
- **Requires**: Moonsign 5★ character in party
- **Effect**: Creates a normal Dendro Core (same mechanics as Bloom) plus a Verdant Dew that provides a buff but deals no damage

---

## Part 3: Regional Mechanics

### Nightsoul's Blessing (Natlan)
- Any **Natlan** character can enter Nightsoul's Blessing (a combat state that enhances abilities)
- Checked via region = "Natlan"; not element-dependent
- Many Natlan character buffs and passives are conditional on Nightsoul's Blessing being active

### Moonsign Gleam
- **Nascent Gleam (初辉)**: Active when exactly **1** Moonsign faction member is in the party
- **Ascendant Gleam (满辉)**: Active when **>=2** Moonsign faction members are in the party
- Moonsign faction includes all Nod-Krai characters with the moonsign passive, plus non-Nod-Krai characters like Zibai (Liyue)

### Lunar Reactions
- Upgraded versions of existing reactions; require a **5-star Moonsign** character in the party
- All three Lunar reactions require **Hydro** as one of the participating elements:
  - **LunarCharged**: Hydro + Electro (upgrades ElectroCharged)
  - **LunarCrystallize**: Hydro + Geo (upgrades Crystallize)
  - **LunarBloom**: Hydro + Dendro (upgrades Bloom)
- A **Hydro 5-star Moonsign member** (e.g., Columbina) enables all Lunar reactions the team's elements can produce
- **Superseding behavior**: When a lunar reaction is possible, it **replaces** the base reaction — electroCharged becomes lunarCharged, bloom becomes lunarBloom. Exception: crystallize is only partially superseded — Hydro+Geo becomes lunarCrystallize, but other element+Geo combinations still produce regular crystallize.
