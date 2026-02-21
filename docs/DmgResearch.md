# Genshin Impact Damage System Research

> **Sources**: [Genshin Impact Wiki — Damage](https://genshin-impact.fandom.com/wiki/Damage), in-game testing, community theorycrafting.

---

## 1. The Universal Damage Formula

Every non-reaction damage instance follows this formula:

```
FinalDmg = BaseDmg × DmgBonusMult × ElevationMult × DEFMult × RESMult × AmplifyingMult × CritMult
```

## 2. Base Damage

```
BaseDmg = Σ(ScalingStat × TalentMult% × BaseDmgMult) + AdditiveFlatDmg
```

| Component | Description |
|-----------|-------------|
| **ScalingStat** | Usually `TotalATK`, but can be `TotalDEF`, `TotalHP`, or `EM`. Formula: `Base × (1 + %Bonus) + Flat` |
| **TalentMult%** | Per-talent-level percentage from skill tables |
| **BaseDmgMult** | Rare modifier (e.g., Yoimiya E). Defaults to 1.0. Modeled by adjusting TalentMult per-character |
| **Σ** | Some talents sum multiple scaling terms (e.g., ATK + HP) before AdditiveFlatDmg |
| **AdditiveFlatDmg** | Flat damage added post-scaling: Spread/Aggravate, Shenhe Quill, Zhongli A4, Yun Jin Q, Song of Days Past 4pc. Tracked via `baseDmg` (scoped by `DamageTagFilter`) |

## 3. Damage Bonus (DMG%)

```
DmgBonusMult = 1 + ElementalDmg% + AbilityDmg% + GeneralDmg%
```

All sources within this multiplier zone are **additive** with each other.

| Component | Examples | Stat Key |
|-----------|----------|----------|
| ElementalDmg% | Goblet main stat, ascension stat | `${element}%` (e.g. `pyro%`) |
| AbilityDmg% | Gladiator 4pc (+35% Normal ATK) | `dmg%` with `DamageTagFilter: { abilities: ["normal"] }` |
| GeneralDmg% | Mona Q (Omen), Raiden E | `dmg%` (unfiltered) |

> Research note: increase enemy damage taken is very rare and applied by Mona Q (not Klee C2 or Kokomi Q). Since it shares the same multiplier and we don't model enemies, we can just treat it as a team-wide dmg% buff.

## 4. Elevation Multiplier

A separate multiplicative layer (`(1 + Σ(elevated%))` additive among sources) introduced in version 6.x. Provided exclusively by Nod-Krai 5★ character constellations that state "certain damage is elevated by X%".

Scoped per Lunar type via `DamageTagFilter: { reactions: ["lunarCharged"] }` etc. Columbina provides a generic elevation bonus — implemented as one `elevated%` buff per Lunar type.

> **Impl note**: `LunarFormula` reads `stats.get("elevated%", this.tag)`. In the universal formula, this is always 1.0 (no sources provide elevation for non-Lunar damage).

## 5. DEF Multiplier

```
DEFMult = (CharLv + 100) / [(CharLv + 100) + (EnemyLv + 100) × (1 - defReduction%) × (1 - defIgnore%)]
```

- **defReduction%** sources are **additive** with each other: Lisa A4 (-15%), Raiden C2 (-60%), Klee C2 (-23%).
- **defIgnore%** is a **separate** multiplier: Yae C6 (60%).
- Default (Lv100 vs Lv110): `200/410 ≈ 0.4878`

## 6. RES Multiplier

```
EffectiveRES = BaseRES% - RESReduction%

RESMult = { 1 - EffectiveRES/2       if EffectiveRES < 0
          { 1 - EffectiveRES          if 0 ≤ EffectiveRES ≤ 0.75
          { 1 / (1 + 4×EffectiveRES)  if EffectiveRES > 0.75
```

Default: `1 - 0.10 = 0.90` (most enemies 10% base RES, no shred).

## 7. Critical Hit Multiplier

```
CritMult = 1 + CritDmg%                            (assume crit)
         = 1 + min(CritRate%, 1.0) × CritDmg%       (expected)
```

Base: 5% CR / 50% CD.

## 8. Elemental Reactions

### 8.1 Amplifying Reactions (增幅反应) — Melt, Vaporize

Multiplies the triggering hit's damage.

```
AmplifyingMult = ReactionBase × (1 + EMBonus_Amp + ReactionDmgBonus%)
```

| Reaction | Trigger → Aura | ReactionBase |
|----------|---------------|--------------|
| Forward Melt/Vaporize | Strong → Weak | 2.0 |
| Reverse Melt/Vaporize | Weak → Strong | 1.5 |

### 8.2 Transformative Reactions (聚变反应)

Independent damage instances. **Ignore DEF**. Cannot crit by default (see §8.7).

```
TransformDmg = LevelMult × ReactionCoeff × ReactionDmgBonusMult × RESMult
```

| Reaction | Coeff | Element |
|----------|-------|---------|
| Burning | 0.25 | Pyro |
| Superconduct | 0.5 | Cryo |
| Swirl | 0.6 | Swirled element |
| Electro-Charged | 1.2 | Electro |
| Shatter | 1.5 | Physical |
| Overloaded | 2.0 | Pyro |
| Bloom (Dendro Core) | 2.0 | Dendro |
| Burgeon | 3.0 | Pyro |
| Hyperbloom | 3.0 | Dendro |

**Note**: Bloom itself doesn't deal damage directly — it spawns Dendro Cores that explode for Bloom DMG.

### 8.3 Additive Reactions — Catalyze (激化反应)

Flat bonus added to BaseDmg, then processed through **all** normal multipliers (DMG%, DEF, RES, Crit).

```
AdditiveFlatDmg = LevelMult × ReactionCoeff × ReactionDmgBonusMult
```

| Reaction | Trigger | Coeff |
|----------|---------|-------|
| Aggravate | Electro on Quicken | 1.15 |
| Spread | Dendro on Quicken | 1.25 |

### 8.4 Reaction DMG Bonus Multiplier

Shared across Amplifying, Transformative, Catalyze, and Lunar reactions. EMBonus and ReactionBonus are **additive** within the same `(1 + Σ)` term:

```
ReactionDmgBonusMult = 1 + EMBonus + ReactionDmgBonus%
```

| Category | EM Bonus Formula |
|----------|---------|
| Amplifying + Catalyze | `(2.78 × EM) / (1400 + EM)` |
| Transformative | `(16 × EM) / (2000 + EM)` |
| Lunar | `(6 × EM) / (2000 + EM)` |

EM Bonus is always computed on-the-fly from the character's EM stat. `ReactionDmgBonus%` is stored as stat key `reactionDmg%`, scoped via `DamageTagFilter: { reactions: [...] }`.

### 8.5 Lunar Reactions (月曜反应)

Replace standard reactions when Nod-Krai Moon Wheel characters are in the party.

**Key differences**: Can crit (per-contributor CRIT stats) · Ignores DEF · Does NOT benefit from Elemental DMG Bonus (e.g., Hydro DMG%) · Has own EM formula · Has separate Base DMG Bonus and Elevation multiplicative layers.

#### Reaction-Based Lunar (multi-contributor)

Used by Lunar-Charged and Lunar-Crystallize. Two-step calculation:

**Step 1 — Per-contributor individual DMG**:
```
IndividualDmg = ReactionCoeff × LevelMult_Contributor
              × ReactionBaseDmgBonusMult
              × ReactionDmgBonusMult
              × ElevationMult
              × CritMult_Contributor × RESMult
```

**Step 2 — Combine** (rank highest → lowest):
```
FinalDmg = 1st + (1/2)×2nd + (1/12)×3rd + (1/12)×4th
```

CRIT of the final DMG is determined by whether the **highest** individual DMG crit.

| Type | Reaction Coeff | Trigger | Tick Rate |
|------|---------------|---------|-----------|
| Lunar-Charged (月感电) | 1.8 | Hydro + Electro | Every 2s |
| Lunar-Crystallize (月结晶) | 0.96 | Geo + element | — |

**Lunar-Bloom** (月绽放): The reaction itself does **NOT** deal Lunar damage. Like regular Bloom, it creates Dendro Cores / Bountiful Cores that deal standard Bloom DMG. Lunar-Bloom DMG only exists via Direct (character abilities).

#### Direct Lunar (single character ability)

Character abilities that deal Lunar DMG without triggering a reaction:

```
DirectLunarDmg = (Stat × TalentMult × DirectCoeff
                × ReactionBaseDmgBonusMult
                × ReactionDmgBonusMult
                + AdditiveFlatDmg)
                × ElevationMult × CritMult × RESMult
```

| Type | DirectCoeff | Notes |
|------|-------------|-------|
| Lunar-Charged | ×3 (inline) | Fixed coefficient |
| Lunar-Bloom | — (none) | TalentMult varies per ability |
| Lunar-Crystallize | ×1.6 (trailing) | Applied as trailing multiplier |

### 8.6 Swirl/Burning-Induced Secondary Reactions

Swirl and Burning apply elements, which can trigger further reactions on the target:

- **+ Amplifying**: `AmplifiedSwirlDmg = SwirlDmg × AmplifyingMult`
- **+ Aggravate**: `AggravatedSwirlDmg = (SwirlFactor + FlatDmg_Aggravate) × RESMult`
  - `SwirlFactor = ReactionMult × LevelMult × ReactionDmgBonusMult`
- **+ Transformative**: Standard Transformative damage calculations apply.

### 8.7 Reaction Base DMG Bonus

A **separate multiplicative** layer `(1 + Σ(%BaseDmgBonus))` that currently only applies to Lunar Reactions. Provided by Moonsign Benediction Passives.

| Character | Amount | Target |
|-----------|--------|--------|
| Columbina | Up to +7% | All Lunar types |
| Lauma, Nefer | Up to +14% | Lunar-Bloom |
| Flins, Ineffa | Up to +14% | Lunar-Charged |
| Zibai | Up to +14% | Lunar-Crystallize |

All use stat key `baseDmg%`, scoped via `DamageTagFilter: { reactions: ["lunarCharged"] }` etc. Cross-type sources (Columbina) push one buff per Lunar reaction type.

> **Impl note**: `LunarFormula` reads `stats.get("baseDmg%", this.tag)`.

### 8.8 Reaction CRIT

Fixed CRIT Rate/DMG granted to normally non-critting **Transformative** reactions. Stackable across sources.

| Source | Amount | Target |
|--------|--------|--------|
| Lauma A1 | 15% CR / 100% CD | Bloom, Burgeon, Hyperbloom |
| Nahida C2 | 20% CR / 100% CD | Burning, Bloom, Burgeon, Hyperbloom |
| Mizuki C6 | 30% CR / 100% CD | Swirl |

Uses stat keys `reactionCr` / `reactionCd`, scoped via `DamageTagFilter: { reactions: ["bloom", "hyperbloom", "burgeon"] }` etc.

> **Impl note**: `TransformFormula` reads `stats.get("reactionCr", this.tag)` / `stats.get("reactionCd", this.tag)`. If CR > 0, applies CRIT multiplier. Separate from the character's own `cr`/`cd`.

### 8.9 Reaction Additive Base DMG Bonus

Flat DMG added to the reaction's base DMG (analogous to AdditiveFlatDmg in §2, but for reactions):

| Source | Amount | Target |
|--------|--------|--------|
| Lauma Q | +278%–590% of EM (up to 36 instances) | Bloom, Burgeon, Hyperbloom |
| Lauma Q | +222%–472% of EM (up to 36 instances) | Lunar-Bloom |
| Mizuki C1 | +1100% of EM (up to 3 instances/skill) | Swirl |

## 9. True DMG

Ignores DEF, RES, and Damage Reduction. Does not ignore shields. Can be amplified by Melt/Vaporize but not Spread/Aggravate. Sources: Ley Line Disorders, Electrogranum, Thunderstones, Kamuijima Cannons, etc. Not relevant to character damage modeling.

## 10. Additive Groups & Stat Key Mapping

Bonuses sharing the same `(1 + Σ)` multiplier can share a single stat key pool:

| Multiplier Zone | Components | Stat Key | Scoped Via |
|----------------|------------|----------|------------|
| **DMG Bonus** (§3) | ElementalDmg%, AbilityDmg%, GeneralDmg% | `${element}%`, `dmg%` | `DamageTagFilter.abilities` |
| **Reaction DMG Bonus** (§8.4) | EMBonus (computed) + ReactionDmgBonus% | `reactionDmg%` | `DamageTagFilter.reactions` |
| **DEF Reduction** (§5) | Multiple DEF shred sources | `defReduction%` | — |
| **Base DMG Bonus** (§8.7) | Moonsign Benediction sources or specific constellations that "deals X% of original damage" | `baseDmg%` | `DamageTagFilter.reactions` |
| **Elevation** (§4) | Nod-Krai constellation sources | `elevated%` | `DamageTagFilter.reactions` |
| **Reaction CRIT** (§8.8) | Fixed CR/CD overlay for Transformative | `reactionCr`, `reactionCd` | `DamageTagFilter.reactions` |

