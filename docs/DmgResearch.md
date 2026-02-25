# Genshin Impact Damage System Research

> **Sources**: [Genshin Impact Wiki — Damage](https://genshin-impact.fandom.com/wiki/Damage), in-game testing, community theorycrafting.

---

## 1. Stat Definitions

The calculation engine tracks specific stats that are aggregated and consumed across all formulas.

### 1.1 Scaling Stats
- `atk`, `def`, `hp`: Computed as `Base × (1 + sum(%)) + sum(flat)`.
- `em`: Elemental Mastery. Computed as the sum of all flat `em` sources (has no `%` or base values).

### 1.2 Multiplier & Modifier Stats

Many of the following stats can be scoped globally or situationally via a `DamageTagFilter` (e.g., only applying to Normal Attacks, or only to Burning reactions).

**Damage Modifiers**
- `dmg%`: General, Elemental, or Ability damage bonus. Additive within its zone.
- `baseDmg`: Flat damage addition, corresponding to *Additive Base DMG Bonus* in wiki. Evaluated directly as a numerical flat additive. *(Examples: Gorou A4, Cyno A4, Arataki Itto A4, Yun Jin A4/Q, Traveler (Hydro) A4, Xianyun A4/C2, Clorinde A1/C2, Zhongli A4, Kinich A4, Thoma A4, Skirk Q, Kuki Shinobu A4, Arlecchino NA, Citlali A4/C1, Faruzan A4, Mualani A4/C1, Sangonomiya Kokomi Q/A4, Lyney A1, Sigewinne A1, Lan Yan A4, Shenhe E, Layla A4/C4, Varesa A1/C1/C4, Sethos A4, Kachina A4, Albedo C2, Hu Tao C2, Sayu C6, Wanderer C1, Baizhu C6, Dehya C1, Xilonen C4/C6, Chiori C6, Mavuika C2, Escoffier C2, Durin C1, Nefer C1, Everlasting Moonglow, Hunter's Path, Light of Foliar Incision, Redhorn Stonethresher, Cinnabar Spindle, Echoes of an Offering, Song of Days Past. For reactions: Lauma Q, Yumemizuki Mizuki C1).*
- `baseDmg%`: Multiplicative base damage modifier, corresponding to *Base DMG Multiplier* in wiki. Multiplies the base stat-scaling before flat additions. *(Examples: Navia E, Durin A4, Wanderer E, Neuvillette A1, Wriothesley E, Yoimiya E, Skirk A4, Furina E, Xingqiu C4, Traveler (Electro) C6, Nefer C2. For Lunar reactions: Columbina Moonsign, Lauma Moonsign, Nefer Moonsign, Flins Moonsign, Ineffa Moonsign, Zibai Moonsign).*
- `reactionDmg%`: Additive Reaction damage bonus. *(Examples: Aino C6, Baizhu A4, Flins A1, Ifa A1/C2, Ineffa C1, Kaveh Q/C4, Lauma C2, Mona C1, Nilou A4, Yumemizuki Mizuki E, Crimson Witch of Flames 4pc, Flower of Paradise Lost 4pc, Night of the Sky's Unveiling 4pc, Silken Moon's Serenade 4pc, Thundering Fury 4pc, Viridescent Venerer 4pc, Blackmarrow Lantern, Bloodsoaked Ruins, Fractured Halo, Nightweaver's Looking Glass, Prospector's Shovel).*
- `elevated%`: General elevation bonus. *(Examples: Columbina C1/C2/C3/C4/C5/C6, Lauma C6, Flins C6, Nefer C6).*

**Enemy Modifiers**
- `defReduction%`, `defIgnore%`: Enemy defense modifiers.
- `resReduction%`: Enemy resistance modifiers.

**Critical Stats**
- `cr`, `cd`: Character critical hit rate and critical damage.
- `reactionCr`, `reactionCd`: Static CR/CD overlay specifically for reactions. *(Examples: Nahida C2, Lauma A1, Yumemizuki Mizuki C6).*

*Note: In-game, the DMG bonus multiplier includes `dmgTaken%` and `- dmgReduction%` on the target. Our engine abstracts these: enemy debuffs like Mona's Omen (`dmgTaken%`) are simply mapped as generic `dmg%` team buffs, and enemy `dmgReduction%` is intentionally omitted.*

---

## 2. Shared Formula Zones

Across all major damage interactions, the game resolves a stack of up to seven standard zones. Not all zones apply to every damage type.

### 2.1 Reaction Constants Zone
Fixed multipliers determined by game mechanics and element type.
- `ReactionCoeff`: Reaction-specific constants (e.g., Forward Melt 2.0, Reverse Melt 1.5, Aggravate 1.15, Superconduct 0.5, Lunar Charged 1.8).

### 2.2 Base Damage Zone
The raw output of an ability or reaction before bonus multiplication. 
- For standard abilities, it scales off character stats: `(Scaling Stat × TalentMult × ... + baseDmg)`.
- For transformative and additive reactions, it scales off character level: `(LevelMult + baseDmg)`. *(Where `LevelMult` is e.g., 1446.85 at Level 90).*

### 2.3 Damage Bonus Zone
Multiplier compiling all relevant percentage bonus sources.
- For standard damage: `(1 + dmg%)`
- For reactions: `(1 + EmBonus% + reactionDmg%)`

**EM Bonus Scaling Formulas (`EmBonus%`):**
- **Amplifying** (Melt/Vaporize): `(2.78 × em) / (1400 + em)`
- **Additive** (Catalyze): `(5 × em) / (1200 + em)`
- **Transformative / Bloom**: `(16 × em) / (2000 + em)`
- **Lunar**: `(6 × em) / (2000 + em)`

### 2.4 Crit Zone
Resolves the Critical Hit Multiplier.
```text
CritMult = 1 + cd%                            (If simulating a guaranteed crit)
         = 1 + clamp(cr%, 0.0, 1.0) × cd%     (Expected value mode)
```
*Note: Transformative reactions natively cannot crit. If granted by abilities (e.g., Nahida C2, Lauma A1), use `reactionCr` / `reactionCd` instead of standard `cr` / `cd`.*

### 2.5 Res Zone
Calculates the Resistance Multiplier based on enemy base RES and reductions.
```text
EffectiveRES = BaseRES% - resReduction%

ResMult = 1 - EffectiveRES/2       if EffectiveRES < 0
          1 - EffectiveRES         if 0 ≤ EffectiveRES ≤ 0.75
          1 / (1 + 4×EffectiveRES) if EffectiveRES > 0.75
```
*(Default assumption for most enemies is 10% base RES, no shred: `1 - 0.10 = 0.90`)*

### 2.6 Def Zone
Calculates the Defense Multiplier. (Ignored entirely by Transformative and Lunar reactions).
```text
DefMult = (CharLv + 100) / [(CharLv + 100) + (EnemyLv + 100) × (1 - defReduction%) × (1 - defIgnore%)]
```

### 2.7 Elevate Zone
Calculates the Elevation Multiplier. Exclusive to Nod-Krai mechanics.
```text
ElevateMult = 1 + elevated%
```

---

## 3. Major Damage Formulas

### 3.1 Normal Damage (Non-Reaction)
The baseline formula for standard character abilities.

```text
FinalDmg = (TalentScaledDmg × (1 + baseDmg%) + CatalyzeDamage + baseDmg)
         × (1 + dmg%)
         × CritMult
         × ResMult
         × DefMult
         × ElevateMult
```

**Zone Breakdown:**
- **Base Damage Zone**: `(TalentScaledDmg × (1 + baseDmg%) + CatalyzeDamage + baseDmg)`. *(Where `TalentScaledDmg = Σ(ScalingStat × TalentMult%)`. `baseDmg%` applies to specific scaling components before flat additions. `CatalyzeDamage` is added dynamically if triggering an Additive reaction. `baseDmg` is the sum of all flat `baseDmg` buffs).*
- **Damage Bonus Zone**: `(1 + dmg%)`
- **Elevate Zone**: Defaults to 1.0 unless explicitly elevated (very rare for non-lunar).
- **Other Zones**: Standard application of `CritMult`, `ResMult`, and `DefMult`.

### 3.2 Amplifying Reactions (Melt, Vaporize)
Multiplies the entire Normal Damage hit.

```text
FinalDmg = NormalDamage 
         × ReactionCoeff 
         × (1 + AmplifyingEmBonus% + reactionDmg%)
```

**Zone Breakdown:**
- **Reaction Constants Zone**: `ReactionCoeff` (2.0 for Strong→Weak, 1.5 for Weak→Strong).
- **Damage Bonus Zone**: `(1 + AmplifyingEmBonus% + reactionDmg%)`.

### 3.3 Additive Reactions (Catalyze: Aggravate, Spread)
Generates `CatalyzeDamage`, which acts as an additive injection into the **Base Damage Zone** of the Normal Damage hit.

```text
CatalyzeDamage = LevelMult
               × ReactionCoeff
               × (1 + CatalyzeEmBonus% + reactionDmg%)
```

**Zone Breakdown:**
- **Base Damage Zone**: `LevelMult`.
- **Reaction Constants Zone**: `ReactionCoeff` (Aggravate 1.15, Spread 1.25).
- **Damage Bonus Zone**: `(1 + CatalyzeEmBonus% + reactionDmg%)`.
- *Usage*: The resulting `CatalyzeDamage` is added to the Base Damage Zone inside the triggering hit's Normal Damage equation.

### 3.4 Transformative Reactions
Independent damage instances (e.g., Overloaded, Bloom, Hyperbloom, Superconduct, Swirl). Ignores the **Def Zone**.

```text
FinalDmg = LevelMult
         × ReactionCoeff
         × (1 + TransformativeEmBonus% + reactionDmg%)
         × CritMult
         × ResMult
```

**Zone Breakdown:**
- **Base Damage Zone**: `LevelMult`.
- **Reaction Constants Zone**: `ReactionCoeff`. (Burning 0.25, Swirl 0.6, Superconduct 1.5, Electro-Charged 2.0, Bloom 2.0, Overloaded 2.75, Burgeon/Hyperbloom 3.0, Shatter 3.0).
- **Damage Bonus Zone**: `(1 + TransformativeEmBonus% + reactionDmg%)`.
- **Crit Zone**: `CritMult` (Natively 1.0. If `reactionCr` / `reactionCd` exist, evaluates based on the expected value curve).

### 3.5 Lunar Reactions — Reaction-Based (Multi-Contributor)
Applies to `lunarCharged` (ReactionCoeff 1.8) and `lunarCrystallize` (ReactionCoeff 0.96). Ignores the **Def Zone**. Evaluated in two steps.

**Step 1: Individual Contributor Damage**
```text
IndividualDmg = [LevelMult × (1 + baseDmg%)]
              × ReactionCoeff
              × (1 + LunarEmBonus% + reactionDmg%)
              × CritMult
              × ResMult
              × ElevateMult
```

**Zone Breakdown (Per-Contributor):**
- **Base Damage Zone**: `LevelMult × (1 + baseDmg%)`.
- **Reaction Constants Zone**: `ReactionCoeff`.
- **Damage Bonus Zone**: `(1 + LunarEmBonus% + reactionDmg%)`.
- **Crit Zone**: `CritMult` (Evaluates using the individual contributor's CRIT stats).
- **Other Zones**: Standard application.

**Step 2: Combine Ranked Outputs**
Combines the top individual damage packets:
`FinalDmg = (Rank 1 Dmg) + (1/2 × Rank 2 Dmg) + (1/12 × Rank 3 Dmg) + (1/12 × Rank 4 Dmg)`

### 3.6 Lunar Reactions — Direct (Single Ability)
Character abilities that scale and deal Lunar DMG without needing an elemental reaction trigger (mostly `lunarBloom`, but also trailing `lunarCrystallize` or inline `lunarCharged`). Ignores the **Def Zone**.

```text
FinalDmg = [ (TalentScaledDmg × DirectCoeff × (1 + baseDmg%)) × (1 + LunarEmBonus% + reactionDmg%) + baseDmg ]
         × CritMult
         × ResMult
         × ElevateMult
```

**Zone Breakdown:**
- **Base Damage Zone**: `(TalentScaledDmg × DirectCoeff × (1 + baseDmg%))`. 
  *(Constants: `lunarCharged` DirectCoeff is 3, `lunarCrystallize` is 1.6, `lunarBloom` is 1).*
- **Damage Bonus Zone**: `(1 + LunarEmBonus% + reactionDmg%)`.
- **Flat Additions**: `baseDmg` (Evaluated sum of `baseDmg` stats, e.g., Lauma Q. Note that for Lunar Direct, it is added natively post-bonus multiplication).
- **Other Zones**: Standard application.

