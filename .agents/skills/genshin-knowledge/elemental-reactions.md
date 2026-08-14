# Elemental Reactions Reference

## Part 1: Reactions by Trigger Element

The **trigger** is the second element applied. Aura elements (Pyro, Hydro, Cryo, Electro, Dendro,
Quicken) leave persistent gauges on enemies. Geo and Anemo do not form persistent auras.

Symmetric reactions are listed under both trigger directions.

† = upgraded reaction when a Moonsign 5★ character is in the party.
‡ = upgraded reaction when the triggering character is in a Radiance state (see Part 3).

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
- **Electro** aura → Superconduct / StellarConduct‡

### Electro (trigger)
- **Pyro** aura → Overloaded
- **Hydro** aura → ElectroCharged / LunarCharged†
- **Cryo** aura → Superconduct / StellarConduct‡
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
- **Cryo** aura → Swirl (Cryo) / StellarSwirl‡
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

### StellarConduct *(Radiance upgrade of Superconduct)*
- **Requires**: the triggering character is in the `辉映·星超导` Radiance state (see Part 3)
- **Type**: Transformative, but damage is dealt as a **direct hit** rather than a separate proc — see the Stellar Reactions notes in Part 3
- **Effect**: replaces Superconduct entirely; the Physical RES shred is not carried over by the reaction itself

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

### StellarSwirl *(Radiance upgrade of Cryo Swirl)*
- **Requires**: the triggering character is in the `辉映·星扩散` Radiance state (see Part 3)
- **Upgrades Cryo Swirl only.** Pyro, Hydro and Electro swirls are unaffected and still produce ordinary Swirl
- **Type**: same direct-hit model as StellarConduct

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

### Nightsoul's Blessing (Nightsoul Faction)
- Characters with the **Nightsoul** faction can enter Nightsoul's Blessing (a combat state that enhances abilities)
- Nightsoul faction includes all Natlan characters + Traveler (Pyro) — detected via "夜魂" keyword in character kit data
- Checked via `faction === "Nightsoul"` (NOT region); some effects like Chain Breaker genuinely check "纳塔角色" (Natlan region) — those stay as `region === "Natlan"`
- Many Nightsoul character buffs and passives are conditional on Nightsoul's Blessing being active
- Trigger strings use capitalized `"Nightsoul"` and `"Nightsoul Burst"` for i18n display

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

### Radiance (辉映) — Polestar Field

Radiance is a **per-character combat state**, entered inside a 极星辉域 (Polestar Field). It is the Snezhnaya-era counterpart to Nightsoul's Blessing and Moonsign Gleam.

- Two variants: **辉映·星超导** (Radiance: Stellar-Conduct) and **辉映·星扩散** (Radiance: Stellar Swirl). Collectively they are **辉映·星烁** (Stellar Glimmer).
- **It is a state, not a reaction trigger.** "This character is in Radiance" and "this character triggered a Stellar reaction" are different conditions, and game text distinguishes them.
- **Capability is per character**, declared as a local option in that character's impl file — there is no whitelist constant, and none should be added. Roughly ten characters across Mondstadt, Liyue, Inazuma, Fontaine, Sumeru, Snezhnaya and the Traveler carry one.
- Radiance text **replaces** the base mechanic rather than adding to it. The tell is ZH 「效果变更为」/「改为」 (EN "is changed to"), as opposed to 「提升」/「获得」 which adds.

### Stellar Reactions

- Upgraded versions of existing reactions, gated on the triggering character's Radiance state rather than on party composition alone:
  - **StellarConduct**: Cryo + Electro (upgrades Superconduct)
  - **StellarSwirl**: Anemo on a Cryo aura (upgrades Cryo Swirl only)
- **Enablers.** A party member who converts the base reaction into its Stellar form is required. The authoritative list is `STELLAR_ENABLERS` in `src/lib/dmgcalc/constants.ts` — keyed per reaction, because enabling one does not imply the other (Vesna enables Stellar Swirl only).
- **Superseding behavior**: like Lunar, a Stellar reaction **replaces** the base reaction, so `hasReaction("superconduct")` is false on a Stellar-Conduct team. Swirl is only partially superseded — Cryo swirl becomes StellarSwirl, while Pyro/Hydro/Electro swirls survive. Both mappings live in `STELLAR_SUPERSEDES`.
- **Damage model**: Stellar reaction damage lands as a direct hit whose coefficient scales with recorded Polestar Field attach hits, looked up in `STELLAR_DIRECT_COEFF_BY_HITS` (hits 1–12, range 1.45–2.0, default 1.64 at `STELLAR_ATTACH_HITS_DEFAULT = 5`). The same table serves both Stellar variants.

---

## Part 4: Reaction Naming and Scoping

Game text names reactions at three granularities. Read a clause at exactly the granularity it uses — do not widen or narrow it.

### Umbrella terms

| ZH | EN | Covers |
|---|---|---|
| 星烁 | Stellar Glimmer | `stellarConduct` + `stellarSwirl` |
| 月曜 | Lunar | `lunarCharged` + `lunarBloom` + `lunarCrystallize` |

`character_5_zh.json` states it outright: 「辉映·星超导与辉映·星扩散统称为辉映·星烁」. Converted hits read 「视为对应星烁反应伤害」 — *the corresponding* Stellar reaction, i.e. whichever one the pairing produces.

A clause naming 星超导 or 星扩散 **specifically** means that one only. Scarlet Proof is 星扩散-only; Heart of the Furnace is umbrella.

### Siblings do not contain each other

A bonus naming a base reaction never covers its Stellar or Lunar sibling, and vice versa:

- 超导 ⊅ 星超导
- 扩散 ⊅ 星扩散
- 感电 ⊅ 月感电
- 绽放 ⊅ 月绽放

The game enumerates rather than containing, and two 7.0 artifact sets prove it. Disenchantment in Deep Shadow reads 「超导反应造成的伤害提升80%，星超导反应造成的伤害提升40%」 — two clauses, two different values. Thundering Fury puts 超导 in its 40% bucket and 月感电、星超导 in its 20% bucket. If a 超导 bonus implicitly covered 星超导, both texts would be redundant.

### Why gates and filters disagree — and both are right

This falls out of superseding, and it trips people who try to "fix" one side to match the other:

- A **`hasReaction()` gate** must include the sibling, because the base reaction is *replaced at runtime*. Gating only on `superconduct` silently deactivates on a Stellar-Conduct team; only on `swirl`, on a Cryo-swirl Stellar team.
- A **`reactions` damage filter** must not include a sibling the text does not name, because the bonus is *text-scoped*.

So one entity routinely needs a wide gate and a narrow filter. That is correct, not a contradiction.
