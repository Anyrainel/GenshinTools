# Max Damage Calculator — Design Document

> **Scope**: Phase 1 — Formula research, core engine design, and extensibility architecture.
> **Module**: `src/lib/damage/`
> **Depends on**: `src/data/types.ts`, `src/data/charStats.ts`, `src/data/resources.ts`, `src/data/i18n-game.ts`, `src/data/character_*.json`
> **Modifies**: Nothing outside `src/lib/damage/`

---

## Table of Contents

1. [Genshin Impact Damage System Research](#1-genshin-impact-damage-system-research)
2. [Stat Computation Model](#2-stat-computation-model)
3. [Buff & Effect System](#3-buff--effect-system)
4. [Damage Formula Architecture](#4-damage-formula-architecture)
5. [Team Calculation Pipeline](#5-team-calculation-pipeline)
6. [Module Structure](#6-module-structure)
7. [Type Contracts](#7-type-contracts)

---

## 1. Genshin Impact Damage System Research

### 1.1 The Universal Damage Formula

Every damage instance in Genshin follows this master formula (except Lunar reactions):

```
FinalDmg = BaseDmg
          × (1 + DmgBonus%)
          × DEFMultiplier
          × RESMultiplier
          × AmplifyingMult        (1.0 if no amplifying reaction)
          × CritMultiplier
```

Where each term is defined below.

### 1.2 Base Damage

```
BaseDmg = (ScalingStat × TalentMultiplier% × BaseDmgMultiplier) + AdditiveFlatDmg
```

- **ScalingStat**: Usually `TotalATK`, but can be `TotalDEF`, `TotalHP`, `EM`, or a combination. Determined per talent.
  - `TotalATK = (CharBaseATK + WeaponBaseATK) × (1 + ATK%) + FlatATK`
  - `TotalHP = CharBaseHP × (1 + HP%) + FlatHP`
  - `TotalDEF = CharBaseDEF × (1 + DEF%) + FlatDEF`
- **TalentMultiplier%**: The percentage found in the skill detail table (e.g., "Charged Attack DMG: 242.6%"). Varies by talent level.
- **BaseDmgMultiplier**: Rare; e.g., Yoimiya's E increases Normal Attack DMG by a percentage of the original multiplier. Defaults to 1.0.
- **AdditiveFlatDmg**: Flat damage added after scaling. Sources:
  - Spread/Aggravate reaction bonus (see §1.7)
  - Shenhe's Icy Quill (flat Cryo DMG added per hit, = Shenhe's ATK × talent%)
  - Zhongli A4 passive (1.39% of Max HP added to normal/charged/plunging/E/Q damage)
  - Yun Jin burst (flat Normal ATK DMG bonus based on her DEF)

### 1.3 Damage Bonus (DMG%)

All damage bonuses are **additive** within this multiplier zone:

```
DmgBonus% = ElementalDmg% + AbilityDmg% + GeneralDmg% + DmgTakenIncrease%
```

- **ElementalDmg%**: Pyro/Hydro/Cryo/Electro/Anemo/Geo/Dendro/Physical DMG Bonus. Sources: goblet main stat, ascension stat, weapon passive, artifact set bonus.
- **AbilityDmg%**: Normal/Charged/Plunging/Skill/Burst DMG Bonus. Sources: artifact sets (e.g., Gladiator 4pc: +35% Normal ATK for Sword/Claymore/Polearm), weapon passives.
- **GeneralDmg%**: Universal "DMG dealt increased by X%". Sources: Mona Q (Omen), Raiden E coordinated attack bonus.
- **DmgTakenIncrease%**: Debuff on enemy that increases damage taken. Rare; distinct from RES shred. Examples: Ningguang C2, Kokomi burst.

### 1.4 DEF Multiplier

```
DEFMult = (CharLevel + 100) / [(CharLevel + 100) + (EnemyLevel + 100) × (1 - DEFReduction%) × (1 - DEFIgnore%)]
```

- **CharLevel**: Attacker's character level.
- **EnemyLevel**: Target's level (default: 110 for Abyss 12+).
- **DEFReduction%**: Reduces enemy DEF. Sources: Lisa A4 (-15%), Raiden C2 (-60%), Razor C4 (-15%). These are additive with each other.
- **DEFIgnore%**: Separate multiplier. Sources: Yae Miko C6 (60% DEF ignore for E). Multiplicative with DEFReduction.

**Default scenario** (Lv100 char vs Lv110 enemy, no DEF shred):
```
DEFMult = 200 / (200 + 210) = 200 / 410 ≈ 0.4878
```

### 1.5 RES Multiplier

Enemy resistance determines the RES multiplier using a piecewise function:

```
EffectiveRES = BaseRES - RESReduction%
```

Then:
```
if EffectiveRES < 0:
    RESMult = 1 - EffectiveRES / 2
elif EffectiveRES <= 0.75:
    RESMult = 1 - EffectiveRES
else:
    RESMult = 1 / (1 + 4 × EffectiveRES)
```

- **BaseRES**: Enemy's innate resistance to the element (default: 10% = 0.10 for most enemies).
- **RESReduction%**: Sources: Viridescent Venerer 4pc (-40% Swirled element), Zhongli shield (-20% all), Superconduct (-40% Physical), Deepwood Memories 4pc (-30% Dendro).

**Default scenario** (10% base RES, no shred):
```
RESMult = 1 - 0.10 = 0.90
```

### 1.6 Critical Hit Multiplier

```
if assumeCrit:
    CritMult = 1 + CritDmg%
else:
    ExpectedCritMult = 1 + min(CritRate%, 1.0) × CritDmg%
```

- **CritRate%**: Sum of all CR sources. Cannot exceed 100% for expected damage. Base: 5%.
- **CritDmg%**: Sum of all CD sources. Base: 50%.

### 1.7 Elemental Reactions

#### 1.7.1 Amplifying Reactions (增幅反应)

**Melt** and **Vaporize** multiply the triggering hit's damage.

```
AmplifyingMult = ReactionBase × (1 + EMBonus_Amp + ReactionDmgBonus%)
```

| Reaction | Trigger Element → Aura | ReactionBase |
|----------|----------------------|--------------|
| Forward Melt | Pyro → Cryo | 2.0 |
| Reverse Melt | Cryo → Pyro | 1.5 |
| Forward Vaporize | Hydro → Pyro | 2.0 |
| Reverse Vaporize | Pyro → Hydro | 1.5 |

**EM Bonus for Amplifying**:
```
EMBonus_Amp = (2.78 × EM) / (1400 + EM)
```

**ReactionDmgBonus%**: Sources like Crimson Witch 4pc (+15% Vaporize/Melt DMG).

#### 1.7.2 Transformative Reactions (聚变反应)

These deal **independent damage instances** that do NOT benefit from ATK, DMG%, or Crit.

```
TransformativeDmg = LevelMultiplier × ReactionCoeff × (1 + EMBonus_Trans + ReactionDmgBonus%) × RESMult
```

**Note**: Transformative damage **ignores enemy DEF** (no DEF multiplier).

**EM Bonus for Transformative**:
```
EMBonus_Trans = (16 × EM) / (2000 + EM)
```

**Level Multipliers** (key values):

| Character Level | Level Multiplier |
|----------------|-----------------|
| 90 | 1446.85 |
| 100 | 1674.81 |

**Reaction Coefficients**:

| Reaction | Coefficient | Element |
|----------|------------|---------|
| Burning | 0.25 | Pyro |
| Superconduct | 0.5 | Cryo |
| Swirl | 0.6 | Swirled element |
| Electro-Charged | 1.2 | Electro |
| Shatter | 1.5 | Physical |
| Overloaded | 2.0 | Pyro |
| Bloom (Dendro Core) | 2.0 | Dendro |
| Burgeon | 3.0 | Pyro (via Dendro Core) |
| Hyperbloom | 3.0 | Dendro (via Dendro Core) |

**Special**: Transformative reactions generally **cannot crit**, except through specific talents (e.g., Nahida C2 for Bloom-related reactions).

#### 1.7.3 Additive Reactions (激化反应)

**Spread** and **Aggravate** add a flat damage bonus to BaseDmg before all other multipliers.

```
AdditiveFlatDmg = LevelMultiplier × ReactionCoeff × (1 + EMBonus_Amp + ReactionDmgBonus%)
```

| Reaction | Trigger | Coefficient |
|----------|---------|-------------|
| Aggravate | Electro on Quicken | 1.15 |
| Spread | Dendro on Quicken | 1.25 |

**Reuses the Amplifying EM formula**: `EMBonus_Amp = (2.78 × EM) / (1400 + EM)`

The flat damage is then processed through **all normal damage multipliers** (DMG%, DEF, RES, Crit), making these reactions extremely potent.

#### 1.7.4 Lunar Reactions (月曜反应)

Introduced in version 6.x, lunar reactions replace standard reactions when specific characters (Inef, Rauuma, Columbina, Zibai, Flins) are in the party.

**Key differences from standard reactions**:
- Lunar reaction damage **can crit**.
- Lunar reaction damage is a new damage type ("月曜伤害") that **ignores DEF**.
- Lunar reaction damage does **NOT** benefit from Elemental DMG Bonus (e.g., Hydro DMG%).
- Has its own unique EM bonus formula.

**Types**:
- **Lunar Electro-Charged (月感电)**: Replaces Electro-Charged. Has two sub-types:
  - *Reaction-based (反应月感电)*: `LevelMult × 1.8 × (1 + TalentBonus) × (1 + EMBonus_Lunar + LunarDmgBonus%) × CritMult × RESMult`
  - *Scaling-based (倍率月感电)*: `3 × ATK × TalentMult% × (1 + TalentBonus) × (1 + EMBonus_Lunar + LunarDmgBonus%) × CritMult × RESMult`
- **Lunar Bloom (月绽放)**: Replaces Bloom. Dendro Cores still use standard transformative formula, but the character's skill consuming "Dew" uses direct damage with EM scaling.
- **Lunar Crystallize (月结晶)**: Replaces Crystallize. Generates "Moon Cages" that deal Geo DMG.

**EM Bonus for Lunar**:
```
EMBonus_Lunar = (6 × EM) / (2000 + EM)
```

**Moonsign (月兆) Levels**:
- 初辉 (Nascent Gleam): Base level, provides buffs from certain artifact sets.
- 满辉 (Ascendant Gleam): Full level, enhanced buffs.

### 1.8 Summary of EM Bonus Formulas

| Reaction Category | EM Bonus Formula |
|---|---|
| Amplifying (Melt/Vaporize) | `(2.78 × EM) / (1400 + EM)` |
| Additive (Spread/Aggravate) | `(2.78 × EM) / (1400 + EM)` |
| Transformative (Overload, Swirl, etc.) | `(16 × EM) / (2000 + EM)` |
| Lunar (月曜) | `(6 × EM) / (2000 + EM)` |

---

## 2. Core Abstractions

This section defines the foundational types and classes. The design separates **initialization parameters** (team comp, build config, constellation, refinement — set once per team) from **calculation parameters** (artifact stat rolls — varied during optimization).

### 2.1 Stat Types

```typescript
/**
 * All stat keys the engine tracks. Reuses existing types from `src/data/types.ts`
 * where applicable (BaseStat, MainStat, SubStat) and adds damage-specific keys.
 *
 * Aggregation rules (handled internally by StatSheet):
 * - Scaled stats (ATK, HP, DEF): base × (1 + sum(%)) + sum(flat)
 * - Additive stats (everything else): baseline + sum(contributions)
 */
type StatKey =
  // From types.ts: BaseStat covers 'baseHp' | 'baseAtk' | 'baseDef' | MainStat
  // From types.ts: MainStat covers 'cr' | 'cd' | 'atk%' | 'hp%' | 'def%' | 'em' | 'er' | element% | 'phys%' | 'heal%' | 'atk' | 'hp'
  // From types.ts: SubStat covers MainStat ∪ 'def'
  | BaseStat | MainStat | SubStat
  // Ability-type DMG bonus (additive, baseline 0)
  | 'normal%' | 'charge%' | 'plunge%' | 'skill%' | 'burst%'
  // Reaction & special DMG bonus
  | 'lunar%'           // Lunar reaction DMG bonus
  | 'dmg%'             // Generic damage bonus (e.g., Mona Omen)
  // Debuff / modifier stats (applied to enemy)
  | 'defReduction'
  | 'defIgnore'
  | 'resReduction';    // Generic RES reduction (element-specific handled via elementFilter)

/** A single stat key-value pair */
type StatEntry = {
  key: StatKey;
  value: number;
};
```

### 2.2 StatSheet

`StatSheet` is the fundamental data structure for stat aggregation. It represents a collection of stats from any source — a fully equipped character, a set of 5 artifacts, or the total after applying buffs.

```typescript
class StatSheet {
  private stats: Partial<Record<StatKey, number>>;

  constructor(entries: StatEntry[]) {
    // Aggregate entries by key (sum values for duplicate keys)
  }

  /**
   * Get a computed stat value.
   * For ATK/HP/DEF, applies the base × (1 + %) + flat formula:
   *   get('atk') → baseAtk × (1 + sum(atk%)) + sum(atk_flat)
   * For additive stats, returns baseline + accumulated value:
   *   get('cr') → 0.05 + sum(cr)
   *   get('em') → sum(em)  // no fixed baseline, character base EM is in entries
   */
  get(key: StatKey): number;

  /** Get the raw accumulated value for a key (no base×%+flat formula) */
  getRaw(key: StatKey): number;

  /** Create a new StatSheet by merging this with another (additive) */
  merge(other: StatSheet): StatSheet;

  /** Create a new StatSheet by applying buffs' static entries */
  apply(buffs: StatBuff[]): StatSheet;
}
```

**Key behaviors**:
- `get('atk')` computes `baseAtk × (1 + atk%) + flatAtk` where `baseAtk` comes from `'baseAtk'` entries, `atk%` from `'atk%'` entries, and `flatAtk` from `'atk'` entries (flat artifact ATK, flat buff ATK).
- `get('cr')` returns `0.05 + sum_of_cr_entries`. The 5% baseline is hardcoded for CR, 50% for CD, 100% for ER. EM has no fixed baseline.
- `merge()` and `apply()` return **new** StatSheets (immutable semantics). `apply()` only processes `staticBuffs` from `StatBuff` — dynamic buffs are resolved externally.
- Stat keys from `types.ts` map naturally: `'atk'` and `'hp'` from `MainStat`/`SubStat` refer to flat values (flower HP, plume ATK, artifact substats). `'baseAtk'`, `'baseHp'`, `'baseDef'` from `BaseStat` refer to the character/weapon green numbers.

### 2.3 BuffSource & BuffTarget

```typescript
/** Display-only provenance. Does not affect calculation. */
type BuffSource = {
  type: 'character' | 'weapon' | 'artifact';
  /** Provider ID from resources.ts (character ID, weapon ID, or artifact set ID) */
  id: string;
  /** Requirement level: "C0", "C6", "R1", "R5", "2pc", "4pc", etc. */
  requirement?: string;
  /** Contextual tags: ["E"], ["Q"], ["A4"], ["Bloom"], etc. */
  tags?: string[];
};

type BuffReceiverType = 'self' | 'onField' | 'selfOnField' | 'team';

/**
 * Buff receiver scope + optional filters.
 *
 * Receiver semantics (where "DPS" = the character whose damage we evaluate):
 * - 'self':        Always applies to the provider's own stat sheet.
 * - 'selfOnField': Applies to the provider ONLY when they are the DPS.
 * - 'onField':     Applies to whoever is the DPS (transfers from support to DPS).
 * - 'team':        Applies to all 4 party members.
 *
 * Off-field convention: If the text says "while off-field", treat as always active.
 */
type BuffTarget = {
  receiver: BuffReceiverType;
  /** If set, buff only applies to hits of these ability types */
  abilityFilter?: AbilityType[];
  /** If set, buff only applies to hits of these element types */
  elementFilter?: Element[];
};

type AbilityType = 'normal' | 'charge' | 'plunge' | 'skill' | 'burst';
```

### 2.4 StatBuff

The core buff abstraction. Each buff has **static** entries (known at build time) and optional **dynamic** entries (computed from resolved stats at calculation time).

```typescript
class StatBuff {
  constructor(
    readonly source: BuffSource,
    readonly target: BuffTarget,
    /** Stat contributions known at build time (don't depend on artifact rolls or stat totals) */
    readonly staticBuffs: StatEntry[],
  ) {}

  /**
   * Stat contributions that depend on resolved stats.
   * Override in subclasses for stat-scaling buffs.
   *
   * @param selfStats  The provider's pre-stats (base + weapon + artifacts + static buffs)
   * @param teamStats  All team members' pre-stats, indexed by position
   * @returns Additional stat entries to apply
   *
   * Examples:
   * - Hu Tao E: return [{ key: 'atk', value: min(selfStats.get('hp') * 0.0715, selfStats.getRaw('baseAtk') * 4) }]
   * - Bennett Q: return [{ key: 'atk', value: selfStats.getRaw('baseAtk') * 1.19 }]
   * - "Highest EM in team × 25%, max 250":
   *     return [{ key: 'em', value: min(max(...teamStats.map(s => s.get('em'))) * 0.25, 250) }]
   * - "10% DEF per Geo char, 20 EM per Hydro char":
   *     const geoCount = teamComp.countByElement('Geo');
   *     const hydroCount = teamComp.countByElement('Hydro');
   *     return [{ key: 'def%', value: geoCount * 0.10 }, { key: 'em', value: hydroCount * 20 }];
   */
  dynamicBuffs(selfStats: StatSheet, teamStats: StatSheet[]): StatEntry[] {
    return [];
  }
}
```

**Static vs Dynamic**:
- **Static**: Value is deterministic from build config alone (constellation + refinement + team comp). E.g., VV 2pc (+15% Anemo DMG), Gladiator 2pc (+18% ATK%), Staff of Homa passive (+20% HP at R1).
- **Dynamic**: Value depends on the stat sheet (which includes artifact rolls). E.g., Hu Tao E (scales off total HP), Kazuha A4 (scales off EM), Bennett Q (scales off his base ATK — technically computable at build time, but naturally expressed as dynamic since it references the provider's stat sheet).

A single `StatBuff` can have both: e.g., Staff of Homa provides `staticBuffs: [{ key: 'hp%', value: 0.20 }]` and `dynamicBuffs` returns `[{ key: 'atk', value: selfStats.get('hp') * 0.01 }]` (1% of Max HP as flat ATK when <50% HP).

#### 2.4.1 StatBuff Helpers

Since `StatBuff` is concrete, static-only buffs are created via `new StatBuff(source, target, staticBuffs)` directly. The engine also provides a few subclasses for recurring patterns. **This set is expected to grow** as new patterns emerge during Phase 2.

```typescript
/**
 * Static buff whose entries vary by constellation level.
 * Handles patterns like "C0: +15% CR; C2: +20% CR" or "C6 adds +15% Pyro DMG".
 */
class StaticSkillBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    constellation: number,
    /** Resolve constellation → stat entries */
    resolve: (c: number) => StatEntry[],
  ) {
    super(source, target, resolve(constellation));
  }
}

/**
 * Buff that scales a single output stat from a single input stat (self).
 * Covers patterns like "X% of Max HP as ATK" or "EM × 0.04% as Elemental DMG".
 */
class ScalingBuff extends StatBuff {
  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    private readonly inputKey: StatKey,
    private readonly outputKey: StatKey,
    private readonly scale: number,
    private readonly cap?: number,
  ) {
    super(source, target, staticBuffs);
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const raw = selfStats.get(this.inputKey) * this.scale;
    const value = this.cap !== undefined ? Math.min(raw, this.cap) : raw;
    return [{ key: this.outputKey, value }];
  }
}

/**
 * Scaling buff whose coefficient and cap vary by constellation level.
 * Covers patterns like "E conversion: Lv10 = 6.26%, Lv13 = 7.15% of HP as ATK".
 */
class ScalingSkillBuff extends StatBuff {
  private readonly scale: number;
  private readonly cap?: number;

  constructor(
    source: BuffSource,
    target: BuffTarget,
    staticBuffs: StatEntry[],
    private readonly inputKey: StatKey,
    private readonly outputKey: StatKey,
    constellation: number,
    /** Resolve constellation → { scale, cap? } */
    resolve: (c: number) => { scale: number; cap?: number },
  ) {
    super(source, target, staticBuffs);
    const resolved = resolve(constellation);
    this.scale = resolved.scale;
    this.cap = resolved.cap;
  }

  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const raw = selfStats.get(this.inputKey) * this.scale;
    const value = this.cap !== undefined ? Math.min(raw, this.cap) : raw;
    return [{ key: this.outputKey, value }];
  }
}
```

**Authoring pattern**: Extensions declare buffs as **anonymous inline instances** directly inside their `buffs` property. The extension class constructs a shared `BuffSource` once and reuses it across all its buffs. For buffs whose dynamic logic doesn't fit these helpers (e.g., stat-dependent cap, multi-stat output), use an anonymous `StatBuff` subclass with an inline `dynamicBuffs` override. See §5.3 for full examples.

As new patterns emerge in Phase 2 (e.g., stacking buffs, team-max-stat buffs, element-count-scaling buffs), they should be promoted into named subclasses in `stat-buff.ts` to avoid boilerplate.

### 2.5 DamageFormula

```typescript
type DamageResult = {
  /** Named components for UI display (e.g., { baseDmg: 8678, dmgBonus: 2.68, ... }) */
  components: Record<string, number>;
  /** The final computed damage number */
  finalDamage: number;
};

/**
 * Reaction type identifiers for multiplier lookup.
 * AmplifyByX indicates which element triggers the reaction (determines 1.5x vs 2.0x).
 */
type ReactionType =
  | 'none'
  | 'meltByPyro' | 'meltByCryo'          // Amplifying
  | 'vaporizeByPyro' | 'vaporizeByHydro'  // Amplifying
  | 'spread' | 'aggravate'                // Additive (Catalyze)
  | 'overloaded' | 'electroCharged' | 'superconduct'
  | 'swirl' | 'shatter' | 'bloom' | 'hyperbloom' | 'burgeon' | 'burning'  // Transformative
  | 'lunarElectroCharged' | 'lunarBloom' | 'lunarCrystallize';             // Lunar

abstract class DamageFormula {
  constructor(
    /** Talent multiplier as decimal (e.g., 2.426 for 242.6%) */
    public readonly talentMultiplier: number,
    /** Reaction type for multiplier lookups */
    public readonly reactionType: ReactionType,
    /** Ability type for DMG bonus resolution */
    public readonly abilityType: AbilityType,
    /** Element of this hit */
    public readonly element: Element | 'physical',
    /** Character level (for DEF/transformative calculations) */
    public readonly characterLevel: number,
    /** Enemy level (default 100) */
    public readonly enemyLevel: number,
  ) {}

  /**
   * Compute damage from a resolved stat sheet.
   * Returns both the final number and a named component breakdown.
   */
  abstract calc(stats: StatSheet): DamageResult;
}
```

**Formula subclasses** (one per reaction category):

| Class | Reaction | Formula Pattern |
|---|---|---|
| `DirectFormula` | `none` | BaseDmg × DmgBonus × DEFMult × RESMult × CritMult |
| `AmplifyFormula` | `meltBy*`, `vaporizeBy*` | Direct × ReactionBase × (1 + EMBonus + ReactionDmg%) |
| `CatalyzeFormula` | `spread`, `aggravate` | (BaseDmg + FlatAdditive) × DmgBonus × DEFMult × RESMult × CritMult |
| `TransformFormula` | overloaded, swirl, etc. | LevelMult × ReactionCoeff × (1 + EMBonus + ReactionDmg%) × RESMult |
| `LunarFormula` | `lunarElectroCharged`, etc. | Character-specific; see §1.7. Can crit. Uses EMBonus_Lunar. |

Each subclass implements `calc(stats)` using the formulas from §1 and the stat values from `stats.get(...)`. The `components` record in `DamageResult` exposes each multiplicative zone (e.g., `baseDmg`, `dmgBonusMult`, `defMult`, `resMult`, `ampMult`, `critMult`) for UI display.

### 2.6 IStatProvider & IDamageProvider

```typescript
/** Any entity that contributes stats and buffs to a build */
interface IStatProvider {
  /** Direct stat contributions (base stats, secondary stats, set bonuses, etc.) */
  readonly stats: StatEntry[];
  /** Buffs this entity provides (to self, on-field, or team) */
  readonly buffs: StatBuff[];
}

/** An entity that can produce damage formulas */
interface IDamageProvider {
  /**
   * Available damage formulas.
   * Key: formula ID (e.g., 'charged-atk', 'skill-press', 'burst-slash-1').
   * Value: display tags (e.g., ['Charged ATK', 'Burst', 'Melt', 'Lunar-Charge']). This is a way to distinguish different formulas from the same character.
   */
  readonly formulaIds: Record<string, string[]>;

  /** Evaluate a specific formula given resolved stats */
  getDamageResult(
    formulaId: string,
    selfStats: StatSheet,
    teamStats: StatSheet[],
  ): DamageResult;
}
```

### 2.7 TeamComp

Constructed once from `resources.ts` when the team is configured. Provides the metadata that `StatBuff` subclasses and `teamCondition` logic need for conditional evaluation.

```typescript
type Faction = 'Hexerei' | 'None';  // Hexerei = 魔导

type TeamComp = {
  /** Ordered character IDs (4 members) */
  characters: string[];
  /** Character ID → Element */
  elements: Record<string, Element>;
  /** Character ID → Region */
  regions: Record<string, Region>;
  /** Character ID → Rarity (4★ or 5★) */
  rarities: Record<string, Rarity>;
  /**
   * Character ID → Faction.
   * Hexerei (魔导) is the only non-trivial faction.
   * The Hexerei character list is NOT in resources.ts — maintain it
   * as a constant set in src/lib/damage/constants.ts.
   */
  factions: Record<string, Faction>;

  // ─── Convenience helpers ───
  countByElement(element: Element): number;
  countByRegion(region: Region): number;
  countByFaction(faction: Faction): number;
  hasReaction(reaction: ReactionType): boolean;  // see §5.4 for mapping rules
};
```

**Common patterns** using `TeamComp` helpers:
- **Nod Krai checks**: `countByRegion('Nod-Krai')` — region is already in `resources.ts`.
- **Moonsign levels**: Nascent Gleam (初辉) = `countByRegion('Nod-Krai') === 1`, Ascendant Gleam (满辉) = `countByRegion('Nod-Krai') >= 2`.
- **Lunar reaction eligibility**: Standard element pair check via `hasReaction()` + at least one participating character is a 5★ from Nod Krai (cross-reference `regions` and `rarities`).
- **Hexerei checks**: `countByFaction('Hexerei')` — e.g., some buffs require ≥2 Hexerei characters.

---

## 3. Extension System

Each character, weapon, and artifact set is implemented as a subclass that provides stats, buffs, and (for characters) damage formulas. All are registered in a global registry for lookup by ID.

### 3.1 CharacterBase

```typescript
abstract class CharacterBase implements IStatProvider, IDamageProvider {
  constructor(
    readonly charId: string,
    readonly charLevel: number,     // 90 or 100
    readonly constellation: number, // 0-6
    readonly teamComp: TeamComp,
  ) {}

  /**
   * Base stats from charStats.ts at the configured level.
   * Includes baseHp, baseAtk, baseDef, em (if ascension stat), ascension stat.
   */
  abstract readonly stats: StatEntry[];

  /**
   * All buffs this character provides. Constellation-gated buffs should
   * check `this.constellation` and only be included when applicable.
   * Constellations can:
   * - Introduce entirely new buffs (e.g., Bennett C6: +15% Pyro DMG)
   * - Alter existing buff values (e.g., C2 giving +20% CR instead of +15%)
   */
  abstract readonly buffs: StatBuff[];

  /**
   * Available damage formulas. Constellation-gated formulas should
   * check `this.constellation` (e.g., a support gaining DPS formulas at C6).
   * Talent level should respect C3/C5 +3 bonus.
   */
  abstract readonly formulaIds: Record<string, string[]>;

  abstract getDamageResult(
    formulaId: string,
    selfStats: StatSheet,
    teamStats: StatSheet[],
  ): DamageResult;
}

// ─── Registry ───

const characterRegistry: Record<string, new (...args: ConstructorParameters<typeof CharacterBase>) => CharacterBase> = {};

function registerCharacter(id: string, ctor: typeof characterRegistry[string]): void {
  characterRegistry[id] = ctor;
}

function createCharacter(id: string, ...args: ConstructorParameters<typeof CharacterBase>): CharacterBase {
  const Ctor = characterRegistry[id];
  if (!Ctor) throw new Error(`No character extension registered for: ${id}`);
  return new Ctor(...args);
}
```

### 3.2 WeaponBase

```typescript
abstract class WeaponBase implements IStatProvider {
  constructor(
    readonly weaponId: string,
    readonly refinement: number,  // 1-5
    readonly teamComp: TeamComp,
  ) {}

  /**
   * Weapon base ATK and secondary stat.
   * Always Lv90 stats from resources.ts.
   */
  abstract readonly stats: StatEntry[];

  /**
   * Weapon passive buffs.
   * Refinement only changes numeric values — buff types/targets stay the same.
   * Use `this.refinement` to compute the correct values.
   */
  abstract readonly buffs: StatBuff[];
}

// Same registry pattern as CharacterBase
```

### 3.3 ArtifactSetBase & ArtifactHalfSetBase

```typescript
/** 4-piece set bonus (the extra bonus beyond the 2pc) */
abstract class ArtifactSetBase implements IStatProvider {
  constructor(
    readonly artifactSetId: string,
    readonly teamComp: TeamComp,
  ) {}

  /** Stats are typically empty (bonuses come via buffs) */
  abstract readonly stats: StatEntry[];

  /** 4pc-specific buffs (assume conditional 4pc effects are active) */
  abstract readonly buffs: StatBuff[];
}

/** 2-piece set bonus */
abstract class ArtifactHalfSetBase implements IStatProvider {
  constructor(
    readonly artifactHalfSetId: string,
    readonly teamComp: TeamComp,
  ) {}

  /** Stats are typically empty */
  abstract readonly stats: StatEntry[];

  /** 2pc buffs (e.g., +18% ATK, +15% Anemo DMG, +80 EM) */
  abstract readonly buffs: StatBuff[];
}

// Same registry pattern for both
```

**Usage**: A character with 4pc Crimson Witch gets one `ArtifactSetBase` (CW 4pc-specific buffs) + one `ArtifactHalfSetBase` (CW 2pc: +15% Pyro DMG). A character with 2pc+2pc gets two `ArtifactHalfSetBase` instances. This avoids duplicating 2pc logic inside the 4pc class.

### 3.4 TeamResonance

```typescript
/**
 * Elemental resonance buffs based on team element distribution.
 * Can be a single concrete class implementing all resonance types,
 * or abstract with per-resonance subclasses.
 */
class TeamResonance implements IStatProvider {
  constructor(readonly teamComp: TeamComp) {}

  /** Always empty — resonance contributions come via buffs */
  readonly stats: StatEntry[] = [];

  /** Active resonance buffs computed from team element distribution */
  get buffs(): StatBuff[] {
    // Fervent Flames (2+ Pyro): +25% ATK
    // Soothing Water (2+ Hydro): +25% HP
    // Impetuous Winds (2+ Anemo): -15% Stamina, +10% MS, -5% CD
    // Enduring Rock (2+ Geo): +15% DMG when shielded, -20% Geo RES for enemies
    // ... etc.
    // Also handle 4-unique-element bonus if applicable
  }
}
```

---

## 4. Build Pipeline

### 4.1 CharBuild

`CharBuild` composes a character's full build (character + weapon + artifact sets) and orchestrates the stat resolution pipeline. It is constructed once per team configuration.

```typescript
class CharBuild {
  // Resolved from registries during construction
  public readonly charBase: CharacterBase;
  public readonly weaponBase: WeaponBase;
  public readonly artifactSetBase: ArtifactSetBase | null;  // null if 2+2
  public readonly artifactHalfSetBases: ArtifactHalfSetBase[];  // 1 (for 4pc) or 2 (for 2+2)

  // Internal: base + weapon + set bonus stats, without artifacts or teammate buffs
  private innerStatSheet: StatSheet;

  constructor(
    public readonly charId: string,
    public readonly teamCharIds: string[],  // the other 3 members
    public readonly charLevel: number,
    public readonly constellation: number,
    public readonly weaponId: string,
    public readonly refinement: number,
    public readonly artifactSetId: string | null,      // null if 2+2
    public readonly artifactHalfSetIds: string[],      // 1 or 2
  ) {
    // 1. Look up registries to create charBase, weaponBase, artifactSetBase, artifactHalfSetBases
    // 2. Build TeamComp from teamCharIds + self (look up resources.ts)
    // 3. Merge all stats into innerStatSheet:
    //    charBase.stats + weaponBase.stats + artifactSetBase.stats + halfSetBases.stats
  }

  /** Collect all static buffs from this build's sources */
  getStaticBuffs(): StatBuff[] {
    return [
      ...this.charBase.buffs,
      ...this.weaponBase.buffs,
      ...(this.artifactSetBase?.buffs ?? []),
      ...this.artifactHalfSetBases.flatMap(h => h.buffs),
    ];
  }

  /**
   * Apply static buffs from ALL team members (including self).
   * Mutates innerStatSheet. Called once during TeamBuild construction.
   */
  applyStaticBuffs(teamStaticBuffs: StatBuff[]): void {
    const applicable = teamStaticBuffs.filter(b => this.isBuffApplicable(b));
    this.innerStatSheet = this.innerStatSheet.apply(applicable);
  }

  /**
   * Merge with artifact stats on the fly. Does NOT mutate innerStatSheet.
   * This is the "pre-stats" — after static buffs + artifacts, before dynamic buffs.
   * Called per optimization iteration with different artifact stat rolls.
   */
  getPreStats(artifactStats: StatSheet): StatSheet {
    return this.innerStatSheet.merge(artifactStats);
  }

  /**
   * Collect dynamic buffs from this build's sources.
   * Uses the pre-stats (self and team) to compute stat-scaling values.
   */
  getDynamicBuffs(selfPreStats: StatSheet, teamPreStats: StatSheet[]): StatBuff[] {
    // Forwards to charBase, weaponBase, artifactSetBase, artifactHalfSetBases
    // Each StatBuff.dynamicBuffs(selfPreStats, teamPreStats) is called
    // Returns only buffs that have non-empty dynamic contributions
  }

  /**
   * Apply dynamic buffs to produce final "post-stats".
   * Does NOT mutate innerStatSheet.
   */
  getPostStats(selfPreStats: StatSheet, teamDynamicBuffs: StatBuff[]): StatSheet {
    const applicable = teamDynamicBuffs.filter(b => this.isBuffApplicable(b));
    // Apply the dynamicBuffs entries (not staticBuffs, which are already applied)
    return selfPreStats.applyDynamic(applicable);
  }

  /** Forward formula IDs from charBase */
  getFormulaIds(): Record<string, string[]> {
    return this.charBase.formulaIds;
  }

  /** Forward damage calculation to charBase */
  getDamageResult(
    formulaId: string,
    selfPostStats: StatSheet,
    teamPostStats: StatSheet[],
  ): DamageResult {
    return this.charBase.getDamageResult(formulaId, selfPostStats, teamPostStats);
  }

  /**
   * Check if a buff applies to this character based on receiver type:
   * - 'self': only if buff source matches this charId
   * - 'selfOnField': only if buff source matches this charId AND this char is the DPS
   * - 'onField': only if this char is the DPS
   * - 'team': always
   */
  private isBuffApplicable(buff: StatBuff): boolean { ... }
}
```

**Stat resolution phases**:

```
Construction:
  innerStatSheet = charBase.stats + weaponBase.stats + setBase.stats + halfSets.stats

Phase 1 — Static Buffs (called once via TeamBuild constructor):
  applyStaticBuffs(allTeamStaticBuffs)
  → innerStatSheet now includes all unconditional, team-comp-dependent,
    and constellation-gated buffs whose values are known at build time

Phase 2 — Pre-Stats (called per artifact roll):
  preStats = innerStatSheet.merge(artifactStats)
  → preStats includes everything except dynamic (stat-scaling) buffs

Phase 3 — Dynamic Buffs (called per artifact roll):
  dynamicBuffs = all team members' getDynamicBuffs(selfPreStats, teamPreStats)
  → evaluates stat-scaling functions with the pre-stats

Phase 4 — Post-Stats (called per artifact roll):
  postStats = getPostStats(preStats, allTeamDynamicBuffs)
  → final stat sheet used for damage formula evaluation
```

### 4.2 TeamBuild

`TeamBuild` orchestrates the full team pipeline. Constructed once per team configuration.

```typescript
class TeamBuild {
  public readonly teamResonance: TeamResonance;

  constructor(
    public readonly charBuilds: Record<string, CharBuild>,
  ) {
    // 1. Build TeamComp from all character IDs
    // 2. Create TeamResonance
    // 3. Collect all static buffs from all CharBuilds + TeamResonance
    // 4. Apply static buffs to each CharBuild:
    //    for (const build of charBuilds) build.applyStaticBuffs(allStaticBuffs);
  }

  /**
   * Compute final stat sheets for all team members.
   * This is the hot path during artifact optimization — called once per candidate.
   *
   * @param artifactStats Per-character artifact stat sheets (from artifact main+sub stats)
   */
  getTeamStats(artifactStats: Record<string, StatSheet>): Record<string, StatSheet> {
    // Phase 2: Pre-stats
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      preStats[id] = build.getPreStats(artifactStats[id]);
    }

    // Phase 3: Collect dynamic buffs from all members
    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs: StatBuff[] = [];
    for (const [id, build] of Object.entries(this.charBuilds)) {
      allDynamicBuffs.push(...build.getDynamicBuffs(preStats[id], teamPreStatsArr));
    }

    // Phase 4: Apply dynamic buffs → post-stats
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      postStats[id] = build.getPostStats(preStats[id], allDynamicBuffs);
    }

    return postStats;
  }

  /** All available formulas across all characters */
  getFormulaIds(): Record<string, Record<string, string[]>> {
    const result: Record<string, Record<string, string[]>> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getFormulaIds();
    }
    return result;
  }

  /** Evaluate a specific character's damage formula with the given team stats */
  getDamageResult(
    charId: string,
    formulaId: string,
    teamStats: Record<string, StatSheet>,
  ): DamageResult {
    const build = this.charBuilds[charId];
    const teamStatsArr = Object.values(teamStats);
    return build.getDamageResult(formulaId, teamStats[charId], teamStatsArr);
  }
}
```

### 4.3 Pipeline Example — Hu Tao Vaporize Team

```
Initialization (once):
  TeamBuild({
    'hu-tao':  CharBuild('hu-tao', [...], 90, 1, 'staff-of-homa', 1, null, ['shimenawas', 'shimenawas']),
    'xingqiu': CharBuild('xingqiu', [...], 90, 6, 'sacrificial-sword', 5, 'emblem-of-severed-fate', ['emblem-of-severed-fate']),
    'zhongli': CharBuild('zhongli', [...], 90, 0, 'black-tassel', 5, 'tenacity-of-the-millelith', ['tenacity-of-the-millelith']),
    'kazuha':  CharBuild('kazuha', [...], 90, 0, 'iron-sting', 1, 'viridescent-venerer', ['viridescent-venerer']),
  })

  Static buffs applied during construction:
  - Hu Tao: A4 pyro% (selfOnField), Shimenawa 2pc+2pc ATK%
  - Xingqiu: Emblem 2pc ER, Emblem 4pc burst%
  - Zhongli: shield -20% RES (onField), TotM 4pc +20% ATK (team)
  - Kazuha: A4 elemental% (onField), VV 4pc -40% RES (onField)
  - Team resonance: Pyro resonance +25% ATK
  → innerStatSheet for each character now has all static contributions

Calculation (per artifact roll):
  artifactStats = { 'hu-tao': StatSheet([hp%=46.6, pyro%=46.6, cr=31.1, subs...]), ... }
  teamStats = teamBuild.getTeamStats(artifactStats)
  result = teamBuild.getDamageResult('hu-tao', 'charged-atk-vaporize', teamStats)
  → result.finalDamage ≈ 71,300
  → result.components = { baseDmg: 8678, dmgBonusMult: 2.68, defMult: 0.487, resMult: 1.05, ampMult: 2.003, critMult: 3.0 }
```

---

## 5. Buff System Details

### 5.1 Buff Source Conventions

| Source | Registration | Refinement/Constellation Behavior |
|--------|---|---|
| Character Passive (A1, A4) | Always | — |
| Constellation C1–C6 | Check `this.constellation >= N`. Can introduce **new buffs** or **alter existing** values. | New buffs at higher C levels, value changes via `this.constellation` |
| Weapon Passive | Always. | Refinement changes **only numeric values** — types/targets stay the same. Use `this.refinement` to compute values. |
| Artifact 2pc | Via `ArtifactHalfSetBase` | — |
| Artifact 4pc | Via `ArtifactSetBase`. Assume conditional effects are active. | — |
| Team Resonance | Via `TeamResonance` | — |

### 5.2 Text Parsing Conventions (Phase 2)

Genshin's in-game text uses specific vocabulary to indicate buff scope. Key EN → receiver mappings:

| Text Pattern | Receiver |
|---|---|
| "the character" / "own" / "this character" | `self` |
| "while on the field" (referring to self) | `selfOnField` |
| "the active character" / "the on-field character" | `onField` |
| "all party members" / "nearby party members" | `team` |
| "while off-field" | Always active (off-field convention) |

ZH text has analogous patterns. Both EN and ZH must be handled during Phase 2 buff extraction.

### 5.3 Concrete Extension Examples

Buffs are declared as **inline instances** directly inside their parent extension class. The extension constructs a shared `BuffSource` and reuses it. This keeps buff logic co-located with the entity that produces it.

**Artifact 2pc** — Viridescent Venerer (static-only, direct `StatBuff`):
```typescript
class VV2pc extends ArtifactHalfSetBase {
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: 'artifact', id: this.artifactHalfSetId, tags: ['2pc'] },
      { receiver: 'self' },
      [{ key: 'anemo%', value: 0.15 }],
    ),
  ];
}
```

**Weapon** — Staff of Homa (shared source, `StatBuff` for static + `ScalingBuff` for dynamic):
```typescript
class StaffOfHoma extends WeaponBase {
  private readonly src: BuffSource = {
    type: 'weapon', id: this.weaponId, requirement: `R${this.refinement}`,
  };

  readonly stats: StatEntry[] = [
    { key: 'baseAtk', value: 608 },
    { key: 'cd', value: 0.662 },
  ];

  readonly buffs = [
    // Passive: HP%
    new StatBuff(
      this.src, { receiver: 'self' },
      [{ key: 'hp%', value: 0.15 + this.refinement * 0.05 }],
    ),
    // Passive (below 50% HP): ATK conversion from Max HP
    new ScalingBuff(
      this.src, { receiver: 'self' },
      [],  // no additional static component
      'hp', 'atk',
      [0.008, 0.010, 0.012, 0.014, 0.016][this.refinement - 1],
    ),
  ];
}
```

**Character** — Hu Tao (shared source, `ScalingSkillBuff` for E, anonymous class for stat-dependent cap):
```typescript
class HuTao extends CharacterBase {
  private readonly src: BuffSource = { type: 'character', id: this.charId };

  readonly stats: StatEntry[] = [/* from charStats.ts */];

  readonly buffs: StatBuff[] = [
    // E: HP → ATK conversion.
    // Cap depends on baseAtk (stat-dependent), so ScalingSkillBuff's fixed cap
    // doesn't fit here — use an anonymous subclass.
    new (class extends StatBuff {
      constructor(private c: number) {
        super(
          { ...src, tags: ['E'] },
          { receiver: 'selfOnField' },
          [],
        );
      }
      override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
        const rate = this.c >= 5 ? 0.0715 : 0.0626;  // C5 → Lv13 talent
        const converted = Math.min(
          selfStats.get('hp') * rate,
          selfStats.getRaw('baseAtk') * 4,  // cap = 400% of base ATK
        );
        return [{ key: 'atk', value: converted }];
      }
    })(this.constellation),

    // A4: +33% Pyro DMG when HP < 50% (static, assume active)
    new StatBuff(
      { ...this.src, tags: ['A4'] },
      { receiver: 'selfOnField' },
      [{ key: 'pyro%', value: 0.33 }],
    ),

    // A1: +12% CR for 8s after E (static, assume active)
    new StatBuff(
      { ...this.src, tags: ['A1'] },
      { receiver: 'selfOnField' },
      [{ key: 'cr', value: 0.12 }],
    ),
  ];

  readonly formulaIds = {
    'charged-atk': ['Charged ATK', 'Pyro'],
    'charged-atk-vaporize': ['Charged ATK', 'Vaporize'],
    'burst-low-hp': ['Burst', 'Low HP', 'Pyro'],
  };

  getDamageResult(formulaId: string, selfStats: StatSheet, teamStats: StatSheet[]): DamageResult {
    const talentLv = this.constellation >= 3 ? 13 : 10;
    switch (formulaId) {
      case 'charged-atk':
        return new DirectFormula(CHARGED_MULT[talentLv], 'none', 'charge', 'Pyro', ...)
          .calc(selfStats);
      case 'charged-atk-vaporize':
        return new AmplifyFormula(CHARGED_MULT[talentLv], 'vaporizeByPyro', 'charge', 'Pyro', ...)
          .calc(selfStats);
      // ...
    }
  }
}
```

**Character** — hypothetical Bennett C6 (`StaticSkillBuff` for constellation-variant static):
```typescript
class Bennett extends CharacterBase {
  private readonly src: BuffSource = { type: 'character', id: this.charId };

  readonly buffs: StatBuff[] = [
    // Q: ATK buff based on own base ATK (dynamic, applies to team)
    new ScalingBuff(
      { ...this.src, tags: ['Q'] },
      { receiver: 'onField' },
      [],
      'baseAtk', 'atk',
      this.constellation >= 1 ? 1.19 : 1.12,  // C1: 119%, else 112% at Lv13
    ),

    // C6: +15% Pyro DMG to on-field character (only at C6)
    new StaticSkillBuff(
      { ...this.src, requirement: 'C6', tags: ['Q'] },
      { receiver: 'onField', elementFilter: ['Pyro'] },
      this.constellation,
      (c) => c >= 6 ? [{ key: 'pyro%', value: 0.15 }] : [],
    ),
  ];
  // ...
}
```

**Character with team conditions** — Nilou A1 (condition evaluated at construction):
```typescript
class Nilou extends CharacterBase {
  private readonly src: BuffSource = { type: 'character', id: this.charId };

  readonly buffs: StatBuff[] = (() => {
    const elements = new Set(Object.values(this.teamComp.elements));
    const hydrodendroOnly = elements.size <= 2 && elements.has('Hydro') && elements.has('Dendro');
    return [
      // A1: +60% Bloom DMG (only in Hydro+Dendro teams)
      ...(hydrodendroOnly ? [
        new StatBuff(
          { ...this.src, tags: ['A1'] },
          { receiver: 'team' },
          [{ key: 'dmg%', value: 0.60 }],  // Bloom-specific via additional filter
        ),
      ] : []),
      // ... other buffs
    ];
  })();
  // ...
}
```

**Kazuha A4** — `ScalingBuff` for EM → Elemental DMG (with team-scoped target):
```typescript
// Inside Kazuha extends CharacterBase:
new ScalingBuff(
  { ...this.src, tags: ['A4'] },
  { receiver: 'onField' },  // Transfers elemental DMG% to the on-field DPS
  [],
  'em', 'dmg%',   // EM → generic DMG% (element-specific resolution in formula)
  0.0004,          // 0.04% per point of EM
),
```

Note that new `StatBuff` subclasses (beyond `StaticSkillBuff`, `ScalingBuff`, `ScalingSkillBuff`) will emerge in Phase 2 — e.g., patterns like element-count-scaling, team-max-stat, or stacking buffs should be promoted into named helpers when they recur across ≥2 extensions.

### 5.4 Reaction Conditions → Team Composition Translation

Many buff texts contain conditions like "when X reaction is triggered" (触发X反应). Since we don't simulate real-time gameplay, these are translated into **team composition requirements** — the team must contain the right elements to plausibly trigger that reaction. These checks are performed via `TeamComp.hasReaction()`.

#### Element Reaction Rules

| Condition Text (ZH) | Condition Text (EN) | Team Requirement |
|---|---|---|
| 触发扩散反应 | Trigger Swirl | Team has ≥1 Anemo + ≥1 of {Pyro, Hydro, Electro, Cryo} |
| 触发蒸发反应 | Trigger Vaporize | Team has ≥1 Pyro + ≥1 Hydro |
| 触发融化反应 | Trigger Melt | Team has ≥1 Pyro + ≥1 Cryo |
| 触发超载反应 | Trigger Overloaded | Team has ≥1 Pyro + ≥1 Electro |
| 触发感电反应 | Trigger Electro-Charged | Team has ≥1 Hydro + ≥1 Electro |
| 触发超导反应 | Trigger Superconduct | Team has ≥1 Cryo + ≥1 Electro |
| 触发绽放反应 | Trigger Bloom | Team has ≥1 Hydro + ≥1 Dendro |
| 触发超绽放/烈绽放 | Trigger Hyperbloom/Burgeon | Team has ≥1 Hydro + ≥1 Dendro + ≥1 Electro/Pyro |
| 触发激化/蔓激化/超激化 | Trigger Quicken/Spread/Aggravate | Team has ≥1 Dendro + ≥1 Electro |
| 触发燃烧反应 | Trigger Burning | Team has ≥1 Pyro + ≥1 Dendro |
| 触发冻结反应 | Trigger Frozen | Team has ≥1 Hydro + ≥1 Cryo |
| 触发碎冰反应 | Trigger Shatter | Team has ≥1 Hydro + ≥1 Cryo + ≥1 Claymore/Geo/Plunging |
| 触发元素反应 (generic) | Trigger Elemental Reaction | Team has ≥2 distinct elements, the element set is not a subset of {Anemo, Geo, Dendro} alone (those 3 don't react among each other), and the set ≠ {Cryo, Dendro} (those 2 currently don't react). |

#### Lunar Reaction Rules

| Condition Text (ZH) | Condition Text (EN) | Team Requirement |
|---|---|---|
| 触发月感电反应 | Trigger Lunar Electro-Charged | Team has ≥1 Hydro + ≥1 Electro, and ≥1 of the Hydro/Electro characters is a 5★ from Nod Krai (诺德·克莱). |
| 触发月绽放反应 | Trigger Lunar Bloom | Team has ≥1 Hydro + ≥1 Dendro, and ≥1 of those characters is a 5★ from Nod Krai. |
| 触发月结晶反应 | Trigger Lunar Crystallize | Team has ≥1 Geo + ≥1 of {Pyro, Hydro, Electro, Cryo}, and ≥1 of those characters is a 5★ from Nod Krai. |

#### Moonsign (月兆) Level Rules

| Condition (ZH) | Condition (EN) | Team Requirement |
|---|---|---|
| 初辉 (Nascent Gleam) | Nascent Gleam active | Exactly 1 character from Nod Krai (诺德·克莱) in team. |
| 满辉 (Ascendant Gleam) | Ascendant Gleam active | 2 or more characters from Nod Krai (诺德·克莱) in team. |

---

## 6. Damage Formula Catalogue

### 6.1 DirectFormula

```typescript
class DirectFormula extends DamageFormula {
  calc(stats: StatSheet): DamageResult {
    const scalingStat = stats.get(this.scalingKey);  // 'atk', 'hp', or 'def'
    const baseDmg = scalingStat * this.talentMultiplier;
    const dmgBonusMult = 1 + stats.get(`${this.element}%`) + stats.get(`${this.abilityType}%`) + stats.get('dmg%');
    const defMult = this.computeDefMult(stats);
    const resMult = this.computeResMult(stats);
    const critMult = this.computeCritMult(stats);

    const finalDamage = baseDmg * dmgBonusMult * defMult * resMult * critMult;
    return {
      components: { baseDmg, dmgBonusMult, defMult, resMult, critMult },
      finalDamage,
    };
  }
}
```

### 6.2 AmplifyFormula

```typescript
class AmplifyFormula extends DirectFormula {
  /** reactionBase: 1.5 for reverse Vape/forward Melt, 2.0 for forward Vape/reverse Melt */
  calc(stats: StatSheet): DamageResult {
    const direct = super.calc(stats);
    const emBonus = (2.78 * stats.get('em')) / (1400 + stats.get('em'));
    const reactionDmgBonus = stats.get('dmg%');  // reaction-specific portion
    const ampMult = this.reactionBase * (1 + emBonus + reactionDmgBonus);

    return {
      components: { ...direct.components, ampMult },
      finalDamage: direct.finalDamage * ampMult,
    };
  }
}
```

### 6.3 CatalyzeFormula (Spread/Aggravate)

```typescript
class CatalyzeFormula extends DamageFormula {
  calc(stats: StatSheet): DamageResult {
    const scalingStat = stats.get(this.scalingKey);
    const emBonus = (2.78 * stats.get('em')) / (1400 + stats.get('em'));
    const flatBonus = this.levelMultiplier * this.reactionCoeff * (1 + emBonus + reactionDmgBonus);
    const baseDmg = scalingStat * this.talentMultiplier + flatBonus;
    // ... rest follows DirectFormula pattern
  }
}
```

### 6.4 TransformFormula (Overloaded, Swirl, etc.)

```typescript
class TransformFormula extends DamageFormula {
  calc(stats: StatSheet): DamageResult {
    const emBonus = (16 * stats.get('em')) / (2000 + stats.get('em'));
    const baseDmg = this.levelMultiplier * this.reactionCoeff;
    const resDmg = baseDmg * (1 + emBonus + reactionDmgBonus) * resMult;
    // No DEF multiplier, usually no crit (except Swirl VV interactions)
    return {
      components: { baseDmg, emBonus, resMult },
      finalDamage: resDmg,
    };
  }
}
```

### 6.5 LunarFormula

```typescript
class LunarFormula extends DamageFormula {
  /**
   * Lunar reactions have two variants:
   * - Reaction variant: LevelMult × ReactionCoeff × (1 + EMBonus_Lunar + ...) × RESMult × CritMult
   * - Scaling variant: Uses stat scaling like direct damage but with Lunar-specific bonuses
   * Both CAN crit. EMBonus = (6 × EM) / (2000 + EM)
   */
  calc(stats: StatSheet): DamageResult {
    const emBonus = (6 * stats.get('em')) / (2000 + stats.get('em'));
    const lunarDmgBonus = stats.get('lunar%');
    // Character-specific implementation in subclasses
  }
}
```

---

## 7. Module Structure

```
src/lib/damage/
├── index.ts              # Public API: TeamBuild, CharBuild, DamageResult re-exports
├── stat-sheet.ts         # StatSheet class
├── stat-buff.ts          # StatBuff abstract class, SimpleStatBuff utility class
├── damage-formula.ts     # DamageFormula hierarchy (Direct, Amplify, Catalyze, Transform, Lunar)
├── team-comp.ts          # TeamComp type + construction from resources.ts
├── team-build.ts         # TeamBuild orchestrator
├── char-build.ts         # CharBuild composition layer
├── team-resonance.ts     # TeamResonance implementation
├── constants.ts          # Level multipliers, reaction coefficients, Hexerei list, baselines
├── characters/           # Per-character extensions (Phase 2)
│   ├── registry.ts       # Character registry + createCharacter()
│   ├── hu-tao.ts
│   ├── bennett.ts
│   └── ...
├── weapons/              # Per-weapon extensions (Phase 2)
│   ├── registry.ts       # Weapon registry
│   ├── staff-of-homa.ts
│   └── ...
└── artifacts/            # Per-artifact-set extensions (Phase 2)
    ├── registry.ts       # ArtifactSetBase + ArtifactHalfSetBase registries
    ├── crimson-witch.ts
    └── ...
```

### 7.1 Public API

```typescript
// src/lib/damage/index.ts

export { TeamBuild } from './team-build';
export { CharBuild } from './char-build';
export { StatSheet } from './stat-sheet';
export type { StatEntry, StatKey } from './stat-sheet';
export type { DamageResult, ReactionType } from './damage-formula';
export type { BuffSource, BuffTarget, BuffReceiverType } from './stat-buff';
export type { TeamComp, Faction } from './team-comp';

// Usage:
// 1. Construct TeamBuild with 4 CharBuilds (initialization — once)
// 2. Call teamBuild.getTeamStats(artifactStats) with different artifacts (optimization — many)
// 3. Call teamBuild.getDamageResult(charId, formulaId, teamStats) to evaluate damage
```

