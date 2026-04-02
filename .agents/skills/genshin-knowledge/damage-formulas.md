# Damage Formulas

Game-level damage math for the Genshin Impact calculation engine.

> **Sources**: [Genshin Impact Wiki — Damage](https://genshin-impact.fandom.com/wiki/Damage), in-game testing, community theorycrafting.

---

## 1. Stat Definitions

### 1.1 Scaling Stats
- `atk`, `def`, `hp`: Computed as `Base × (1 + sum(%)) + sum(flat)`.
- `em`: Elemental Mastery. Sum of all flat `em` sources (no `%` or base values).

### 1.2 Damage Modifier Stats

Many can be scoped via `DamageTagFilter` (e.g., only Normal Attacks, only Burning reactions).

| Key | Description | Zone |
|---|---|---|
| `dmg%` | General / Elemental / Ability damage bonus | Damage Bonus |
| `baseDmg` | Flat additive base DMG (*Additive Base DMG Bonus*) | Base Damage |
| `baseDmg%` | 倍率乘区: "造成原本X%的伤害" multiplier (Yoimiya E, Neuvillette A1, Veil of Falsehood) | Base DMG Mult |
| `reactionBaseDmg%` | 反応基礎提升: Nod-Krai P3 passives ("提升X%月曜反応基础伤害"), **separate zone** from `baseDmg%` | Reaction Base |
| `reactionDmg%` | Additive reaction damage bonus | Reaction Bonus |
| `elevated%` | Elevation bonus (Moonsign/Lunar) | Elevate |
| `defReduction%` | Enemy defense reduction | Def |
| `defIgnore%` | Enemy defense ignore | Def |
| `resReduction%` | Enemy resistance reduction | Res |
| `cr` / `cd` | Critical rate / damage | Crit |
| `reactionCr` / `reactionCd` | Reaction-specific CRIT overlay | Reaction Crit |

*Note: `dmgTaken%` (e.g., Mona's Omen) is mapped as generic `dmg%` team buff. Enemy `dmgReduction%` is omitted.*

---

## 2. Formula Zones

Seven multiplicative zones. Not all apply to every damage type.

### 2.1 Reaction Constants Zone
- `ReactionCoeff`: Fixed per reaction (e.g., Forward Melt 2.0, Reverse Melt 1.5, Aggravate 1.15, Superconduct 0.5, Lunar Charged 1.8).

### 2.2 Base Damage Zone
- Standard abilities: `(ScalingStat × TalentMult × ... + baseDmg)`
- Transformative/additive reactions: `(LevelMult + baseDmg)` where `LevelMult` ≈ 1446.85 at Lv90.

### 2.3 Damage Bonus Zone
- Standard: `(1 + dmg%)`
- Reactions: `(1 + EmBonus% + reactionDmg%)`

**EM Bonus Scaling:**

| Type | Formula |
|---|---|
| Amplifying (Melt/Vaporize) | `(2.78 × EM) / (1400 + EM)` |
| Additive (Catalyze) | `(5 × EM) / (1200 + EM)` |
| Transformative / Bloom | `(16 × EM) / (2000 + EM)` |
| Lunar | `(6 × EM) / (2000 + EM)` |

### 2.4 Crit Zone
```
CritMult = 1 + cd%                            (guaranteed crit)
         = 1 + clamp(cr%, 0, 1) × cd%         (expected value)
```
Transformative reactions can't crit natively. If granted (e.g., Nahida C2), use `reactionCr`/`reactionCd`.

### 2.5 Res Zone
```
EffectiveRES = BaseRES% - resReduction%

ResMult = 1 - EffectiveRES/2       if EffectiveRES < 0
          1 - EffectiveRES         if 0 ≤ EffectiveRES ≤ 0.75
          1 / (1 + 4×EffectiveRES) if EffectiveRES > 0.75
```
Default assumption: 10% base RES, no shred → `ResMult = 0.90`.

### 2.6 Def Zone
```
DefMult = (CharLv + 100) / [(CharLv + 100) + (EnemyLv + 100) × (1 - defReduction%) × (1 - defIgnore%)]
```
Ignored by Transformative and Lunar reactions.

### 2.7 Elevate Zone
```
ElevateMult = 1 + elevated%
```
Exclusive to Moonsign/Lunar mechanics.

---

## 3. Major Damage Formulas

### 3.1 Direct Damage (Non-Reaction)
```
FinalDmg = (TalentScaledDmg × (1 + baseDmg%) + CatalyzeDamage + baseDmg)
         × (1 + dmg%)
         × CritMult × ResMult × DefMult × ElevateMult
```
Where `TalentScaledDmg = Σ(ScalingStat × TalentMult%)`.

### 3.2 Amplifying (Melt, Vaporize)
```
FinalDmg = ReactionCoeff × DirectDamage × (1 + AmplifyEmBonus% + reactionDmg%)
```
ReactionCoeff: 2.0 (strong→weak), 1.5 (weak→strong).

### 3.3 Additive (Aggravate, Spread)
Injects `CatalyzeDamage` into the Base Damage Zone of the triggering hit:
```
CatalyzeDamage = LevelMult × ReactionCoeff × (1 + CatalyzeEmBonus% + reactionDmg%)
```
ReactionCoeff: Aggravate 1.15, Spread 1.25.

### 3.4 Transformative
Independent damage instances. **No Def Zone.**
```
FinalDmg = ReactionCoeff × LevelMult × (1 + TransformEmBonus% + reactionDmg%) × CritMult × ResMult
```
Coefficients: Burning 0.25, Swirl 0.6, Superconduct 1.5, ElectroCharged 2.0, Bloom 2.0, Overloaded 2.75, Burgeon/Hyperbloom 3.0, Shatter 3.0.

### 3.5 Lunar Reaction (Multi-Contributor)
Applies to `lunarCharged` (1.8) and `lunarCrystallize` (0.96). **No Def Zone.**

**Per-contributor:**
```
IndividualDmg = ReactionCoeff × LevelMult × (1 + baseDmg%) × (1 + reactionBaseDmg%)
              × (1 + LunarEmBonus% + reactionDmg%) × CritMult × ResMult × ElevateMult
```

**Combined:** `(Rank1) + (½ × Rank2) + (1/12 × Rank3) + (1/12 × Rank4)`

### 3.6 Lunar Direct (Single Ability)
Character abilities that deal Lunar DMG without a reaction trigger. **No Def Zone.**
```
FinalDmg = [(DirectCoeff × TalentScaledDmg × (1 + baseDmg%) × (1 + reactionBaseDmg%)) × (1 + LunarEmBonus% + reactionDmg%) + baseDmg]
         × CritMult × ResMult × ElevateMult
```
DirectCoeff: `lunarCharged` ×3, `lunarCrystallize` ×1.6, `lunarBloom` ×1.
