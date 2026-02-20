# Damage Calculator — Design Document

> **Module**: `src/lib/team-comp/`  
> **Depends on**: `src/data/types.ts`, `src/data/constants.ts`
> **Formula research**: [DmgResearch.md](./DmgResearch.md)

---

## Table of Contents

1. [Core Types](#1-core-types)
2. [Buff & Effect System](#2-buff--effect-system)
3. [Translating In-Game Text](#3-translating-in-game-text)
4. [Damage Formula Catalogue](#4-damage-formula-catalogue)
5. [Extension System](#5-extension-system)
6. [Build Pipeline](#6-build-pipeline)

---

## 1. Core Types

All types live in `types.ts`. The design separates **initialization parameters** (team comp, constellation, refinement — set once per team) from **calculation parameters** (artifact stat rolls — varied during optimization) and **scenario parameters** (`CalcContext` — passed at formula evaluation time).

### 1.1 StatKey & StatEntry

See `StatKey` and `StatEntry` in [`types.ts`](../src/lib/team-comp/types.ts). Beyond `BaseStat | MainStat | SubStat`, the engine adds damage modifier keys (`dmg%`, `baseDmg`, `baseDmg%`, `elevated%`, `reactionDmg%`, `reactionCr`, `reactionCd`) and enemy modifier keys (`dmgTaken%`, `defReduction%`, `defIgnore%`, `resReduction%`). All damage modifier keys are scoped by `DamageTagFilter` on the buff target.

**Aggregation rules** (handled by `StatSheet` internally):
- **Scaled stats** (`atk`, `hp`, `def`): `base × (1 + Σ(%)) + Σ(flat)`
- **All others**: `Σ(contributions)`

**Damage formula shapes** (implementation in §4):

```
Direct (直伤, none):
  [ScalingDmg × (1+baseDmg%) + baseDmg] × (1 + element%(元素伤害) + dmg%(伤害加成) + dmgTaken%(承伤))
  where ScalingDmg = Stat × TalentMult(天赋倍率) [+ ExtraStat × ExtraMult, if dual-stat]
    × DEFMult(防御系数) × RESMult(抗性系数) × CritMult(暴击系数)

Amplify (增幅: melt/融化, vaporize/蒸发):
  Direct × AmplifyBase × (1 + EMBonus(精通加成) + reactionDmg%(反应伤害加成))

Catalyze (激化: spread/蔓激化, aggravate/超激化):
  [ATK × TalentMult × (1+baseDmg%) + FlatReactionBonus + baseDmg] × (… same as Direct …)
  where FlatReactionBonus = LevelMult × Coeff × (1 + EMBonus + reactionDmg%)

Transform (剧变: overloaded/超载, electroCharged/感电, superconduct/超导, swirl/扩散,
          shatter/碎冰, bloom/绽放, hyperbloom/超绽放, burgeon/烈绽放, burning/燃烧):
  LevelMult × Coeff × (1 + EMBonus + reactionDmg%) × RESMult × ReactionCritMult(反应暴击)
  (no DEF, no talent scaling, no dmg%)

Lunar Reaction (月曜反应伤害: lunarCharged/月感电, lunarCrystallize/月结晶):
  LevelMult × Coeff × (1+baseDmg%(基伤倍率)) × (1 + EMBonus + reactionDmg%)
    × (1+elevated%(擢升)) × (1+dmgTaken%) × RESMult × CritMult
  (no DEF, own EM formula, uses character cr/cd; multi-contributor weighted sum)

Lunar Direct (月曜直伤: character abilities dealing Lunar DMG):
  (Stat × TalentMult × DirectCoeff × (1+baseDmg%) × (1 + EMBonus + reactionDmg%)
    + baseDmg) × (1+elevated%) × CritMult × RESMult
  (no DEF; DirectCoeff varies: ×3 for lunarCharged, ×1.6 for lunarCrystallize)
```

Each stat key feeds into exactly one zone of these formulas. The table below maps keys to their zone:

| Key | Multiplicative Zone | Why Separate |
|-----|---------------------|--------------|
| `dmg%` | `1 + ${element}% + dmg% + dmgTaken%` | Generic DMG bonus zone |
| `reactionDmg%` | `ReactionBase × (1 + EM + reactionDmg%)` | **Different** multiplicative layer from `dmg%` |
| `cr` / `cd` | Character CRIT | Normal hit crits |
| `reactionCr` / `reactionCd` | Reaction CRIT | **Separate** overlay for Transformative reactions that normally can't crit |
| `baseDmg` | Flat add to base | Added **after** talent scaling, before all multipliers |
| `baseDmg%` | `(1 + baseDmg%)` | Lunar Moonsign passives, or effects like "deal X% of original damage", different zone in different formulas  |
| `elevated%` | `(1 + elevated%)` | Separate multiplicative layer (Nod-Krai constellations) |

### 1.2 DamageTag & DamageTagFilter

Every `DamageFormula` carries a `DamageTag` — the full context of a damage instance (`element`, `ability`, `reaction`). Buffs declare a `DamageTagFilter` to scope which formulas see their stat contributions — each dimension is optional (omitted = universal). See [`types.ts`](../src/lib/team-comp/types.ts) for definitions.

### 1.3 BuffSource & BuffTarget

See [`types.ts`](../src/lib/team-comp/types.ts) for full definitions. Key design points:

- **BuffSource** is display-only provenance (type, id, origin, triggers, `noStackId`). It does not affect calculation.
- **BuffTarget** combines a **receiver** with an optional **DamageTagFilter**:

| Receiver | Semantics (where calcTarget = character being optimized) | Applied When |
|---|---|---|
| `self` | Provider's own stat sheet | Construction |
| `selfOnField` | Provider ONLY when provider IS calcTarget | `getTeamStats()` |
| `selfOffField` | Provider ONLY when NOT calcTarget (≈ `self` in single-target) | Construction |
| `onField` | CalcTarget's stat sheet (support → DPS transfer) | `getTeamStats()` |
| `team` | All 4 party members | Construction |

### 1.4 Reaction Types

See `AbilityType`, `ReactionType`, and `LunarReactionType` in [`types.ts`](../src/lib/team-comp/types.ts). `AbilityType` includes `"special"` for character mechanics that don't fit standard categories (e.g., Neuvillette's Charged Attack, Clorinde's Bond of Life attacks).

### 1.5 CalcContext, DamagePart & DamageResult

See [`types.ts`](../src/lib/team-comp/types.ts) for definitions.

- **CalcContext**: Scenario-level parameters (`enemyLevel`, `enemyRes`, `assumeCrit`). Constant for the entire team, passed at `calc()` time.
- **DamagePart**: Output of a single `DamageFormula.calc()` — named component zones + final damage.
- **DamageResult**: Aggregated result for a formulaId — `Σ(part.damage × hits)`.

### 1.6 CombatOpts (Schema-Driven Options)

User-selected combat options for providers that support multiple modes (e.g., Durin DPS/Support, The Widsith random buff). See `OptionDef`, `CombatOpts`, and `InferOption` in [`types.ts`](../src/lib/team-comp/types.ts).

**Option schema** is declared per-provider alongside the class and registered via the decorator. Base classes expose `protected readonly option: string` (raw value from `CombatOpts`); subclasses narrow it via `resolveOption()`:

```typescript
// Schema: declared as const, satisfies OptionDef for constraint checking
const durinOption = {
  label: { zh: "角色定位", en: "Role" },
  choices: [
    { value: "dps",     label: { zh: "输出", en: "DPS" } },
    { value: "support", label: { zh: "辅助", en: "Support" } },
  ] as const,
  default: "dps",
} satisfies OptionDef;

// Registration: schema passed to decorator → stored in optionRegistry
@RegisterCharacter("durin", durinOption)
class Durin extends CharacterBase {
  private readonly o = resolveOption(durinOption, this.option);
  //                    ^ InferOption<typeof durinOption> = "dps" | "support"
}

// Query from UI:
getEntityOption("durin")  // → durinOption (OptionDef) or null
```

**Diff detection**: When `CombatOpts` changes in the store, compare `oldOpts[providerId] !== newOpts[providerId]` → reconstruct only affected providers.

**UI rendering**: `getEntityOption(id)` returns the `OptionDef`. Render as toggle (2 choices) or dropdown (3+). All labels are bilingual via `I18nLabel`.

### 1.7 StatSheet

Immutable stat aggregation with tagged storage. See `StatSheet` in [`damageModels.ts`](../src/lib/team-comp/damageModels.ts).

**Key behaviors**:
- `get("atk")` → `baseAtk × (1 + atk%) + flatAtk`. Always universal.
- `get("cr", tag)` → universal CR + tagged CR entries matching `tag`.
- `get("atk%")` → **throws**. Use `getRaw("atk%")` for intermediate values.
- `merge()`, `apply()`, `applyDynamic()` return **new** StatSheets (immutable semantics).
- StatSheet does NOT apply baselines (5% CR, 50% CD, 100% ER). Those are in `resolveCharacterStats()`.

---

## 2. Buff & Effect System

### 2.1 StatBuff

The core buff abstraction. Each buff has **static** entries (known at build time) and optional **dynamic** entries (computed from resolved stats). Defined in [`damageBuffs.ts`](../src/lib/team-comp/damageBuffs.ts) — constructor takes `(source, target, staticBuffs)`, with an overridable `dynamicBuffs(selfStats, teamStats)` hook.

**Static vs Dynamic**:
- **Static**: Value is deterministic from build config alone. Examples: VV 2pc (+15% Anemo DMG), Staff of Homa (+20% HP at R1), Pyro Resonance (+25% ATK).
- **Dynamic**: Value depends on resolved stats (which include artifact rolls). Examples: Hu Tao E (scales off total HP), Kazuha P2 (scales off EM), Bennett Q (scales off his base ATK).

A single `StatBuff` can have both: Staff of Homa has `staticBuffs: [{ key: "hp%", value: 0.20 }]` and `dynamicBuffs` returns `[{ key: "atk", value: selfStats.get("hp") * 0.01 }]`.

### 2.2 StatBuff Subclasses

Reusable helpers for common patterns. All live in `damageBuffs.ts`.

| Class | Pattern | Example |
|-------|---------|---------|
| `StaticSkillBuff` | Static entries that vary by constellation level | Bennett C1 vs C0 ATK% scaling |
| `ScalingBuff` | Single input → single output, with optional cap and threshold | Hu Tao E (HP → ATK), Kazuha passive (EM → DMG%) |
| `ScalingSkillBuff` | `ScalingBuff` where scale/cap vary by constellation | Hu Tao E at Lv10 vs Lv13 |
| `ErScalingBuff` | ER-over-base → ATK% | Engulfing Lightning passive |
| `ScalingMultiBuff` | Single input → multiple output keys | Peak Patrol Song (DEF → all 7 elemental DMG%) |

`ScalingBuff` constructor: `(source, target, staticBuffs, inputKey, outputKey, scale, cap?, threshold?)`. The `threshold` subtracts from input before scaling (e.g. "HP above 30,000" → `threshold = 30000`).

**Team-comp-dependent conditional buffs**: When a buff depends on the team composition at construction time (element counts, faction membership, region constraints), use an IIFE or `(() => { ... })()` spread inside the `buffs` array to conditionally include/exclude buffs:

```typescript
// Charlotte P2: non-Fontaine party members increase Cryo DMG%
readonly buffs = [
  ...(() => {
    const count = this.teamMeta.countNotFromRegion("Fontaine");
    return count > 0
      ? [new StatBuff(src, target, [{ key: "cryo%", value: 0.05 * count }])]
      : [];
  })(),
];
```

**When none of the subclasses fit**, use an anonymous `StatBuff` subclass with an inline `dynamicBuffs` override:

```typescript
// Stat-dependent cap: can't use ScalingBuff because cap depends on another stat
new (class extends StatBuff {
  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    const converted = Math.min(
      selfStats.get("hp") * 0.0715,
      selfStats.getRaw("baseAtk") * 4,  // cap = 400% of base ATK
    );
    return [{ key: "atk", value: converted }];
  }
})(source, target, []);
```

### 2.3 Helpers (`helpers.ts`)

Utility functions shared across extension implementations. See [`helpers.ts`](../src/lib/team-comp/helpers.ts) for signatures.

- `r(refinement, values)` — Pick a refinement-scaled value (R1–R5).
- `wbs(self, triggers?, noStackId?)` — Weapon buff source.
- `cbs(self, triggers?, origin?)` — Character buff source.
- `elementDmgKey(element)` — Map an Element to its DMG% stat key (`"Pyro"` → `"pyro%"`).
- `allElementalDmg(value)` — Expand "All Elemental DMG Bonus" into 7 entries.

### 2.4 Buff Scoping Examples

```typescript
// ── Ability-scoped DMG bonus ──
// "Burst DMG +20%"
target = { receiver: "self", filter: { abilities: ["burst"] } }
entries = [{ key: "dmg%", value: 0.20 }]

// ── Multi-ability scope (1 entry instead of N) ──
// "Normal and Charged ATK DMG +50%"
target = { receiver: "self", filter: { abilities: ["normal", "charge"] } }
entries = [{ key: "dmg%", value: 0.50 }]

// ── Reaction-scoped bonus ──
// "Bloom and Lunar Bloom DMG +20%"
target = { receiver: "team", filter: { reactions: ["bloom", "lunarBloom"] } }
entries = [{ key: "reactionDmg%", value: 0.20 }]

// ── Reaction CRIT ──
// "Bloom reactions can CRIT: +15% CR, +100% CD"
target = { receiver: "team", filter: { reactions: ["bloom", "hyperbloom", "burgeon"] } }
entries = [{ key: "reactionCr", value: 0.15 }, { key: "reactionCd", value: 1.0 }]

// ── Ability-scoped flat base DMG ──
// Yun Jin Q: "+300 Normal ATK DMG"
target = { receiver: "onField", filter: { abilities: ["normal"] } }
entries = [{ key: "baseDmg", value: 300 }]

// ── Unscoped team buff ──
// Pyro Resonance: "+25% ATK"
target = { receiver: "team" }
entries = [{ key: "atk%", value: 0.25 }]
```

---

## 3. Translating In-Game Text

This section is the **practical guide** for turning a character/weapon/artifact description into the correct `StatBuff` declaration. It covers receiver mapping, stat key mapping, assumption conventions, and common pitfalls.

### 3.1 Receiver Mapping (EN & ZH)

The game uses specific phrasing patterns to describe who an effect targets. The table below maps **actual in-game text patterns** to the correct `BuffTarget.receiver`.

> **Key insight**: The game almost never explicitly says "this buff only applies to yourself while on field." Instead, `selfOnField` is inferred from context — the description names the equipping/casting character as the subject, and the effect is tied to on-field actions or states. When the game wants to describe a buff that transfers to whoever is on field (regardless of who cast it), it always uses explicit phrasing like "当前场上角色" / "your active character."

| Receiver | EN Patterns | ZH Patterns | Real Examples |
|---|---|---|---|
| `self` | *(no qualifier — effect implicitly applies to the provider)* | *(implicit)* | Staff of Homa "HP +20%"; VV 2pc "+15% Anemo DMG" |
| `self` | "can still be triggered even when the character is not on the field" | 处于队伍后台时，依然能触发该效果 | Tenacity 4pc, A Thousand Floating Dreams — `self` buffs that explicitly clarify they persist off-field |
| `selfOnField` | "while the equipping character is … and is on the field" / "every 4s a character is on the field" | 装备者…在场上时 / 角色在场上时 | Fang of the Mountain King "While in Nightsoul's Blessing and is on the field, DMG +15%"; Serpent Spine "Every 4s a character is on the field, DMG +6%" |
| `selfOnField` | "will be canceled/dispelled when X leaves the field" | 退场时解除 / 退场时消失 | Raiden Q "Musou Isshin will be cleared when she leaves the field"; Lyney C2 "canceled when Lyney leaves the field"; Nascent Light "dispelled when the character leaves the field" |
| `onField` | "your active character" / "active characters within the field" | 当前场上角色 / 队伍中自己的当前场上角色 / 附近的当前场上角色 | Barbara C2 "your active character gains 15% Hydro DMG Bonus"; Gorou E "provides buffs to active characters within the field" |
| `team` | "all nearby party members" / "nearby party members" / "all party members" | 队伍中附近的所有角色 / 队伍中所有角色 / 队伍中附近的角色 | Tenacity 4pc "ATK of all nearby party members +20%"; Pyro Resonance "+25% ATK"; Noblesse 4pc "all party members' ATK +20%" |
| `selfOffField` | "not on the field" / "while in the party but not on the field" | 处于队伍后台时 / 处于队伍后台超过5秒后 | Fleuve Cendre Ferryman "not on the field for more than 5s, Max HP +32%" |

**Disambiguation guide** — when the text is ambiguous:

1. **Buff subject is the provider, condition is on-field** → `selfOnField`. Example: Hu Tao passive "+33% Pyro DMG" only applies when Hu Tao is the active character.
2. **Effect explicitly ends when the character leaves the field** → `selfOnField`. The "退场时解除" / "leaves the field" phrasing is the game's way of saying "on-field only" without stating it directly.
3. **Buff subject is "当前场上角色" / "your active character"** → `onField`. The buff transfers to whoever is on field, even if the provider is off-field.
4. **No qualifier at all** → `self`. Base passive stats, weapon substats, ascension stats — these are always-on.
5. **"处于队伍后台时也能触发" / "can be triggered even when not on the field"** → still `self`. This phrasing clarifies that a *conditional* `self` buff (e.g., "after triggering an elemental reaction") persists off-field. It does NOT mean the buff is `selfOffField`.
6. **"处于队伍后台" as an enabling condition** → `selfOffField`. Example: "When not on the field for more than 5s, Max HP +32%" — the buff only activates while off-field.

### 3.2 Stat Key Mapping

This table maps common in-game phrasing to the correct `StatKey` + `DamageTagFilter`.

| In-Game Text | StatKey | Filter | Notes |
|---|---|---|---|
| "ATK +18%" | `atk%` | none | Percentage of total ATK |
| "ATK increased by 400" | `atk` (flat) | none | Flat ATK addition |
| "Base ATK ×119%" (Bennett Q) | dynamic: `baseAtk` → `atk` | none | Uses `ScalingBuff` with `inputKey: "baseAtk"` |
| "Normal ATK DMG +35%" | `dmg%` | `{ abilities: ["normal"] }` | |
| "Elemental Burst DMG +20%" | `dmg%` | `{ abilities: ["burst"] }` | |
| "Normal and Charged ATK DMG +50%" | `dmg%` | `{ abilities: ["normal", "charge"] }` | |
| "Pyro DMG Bonus +15%" | `pyro%` | none | Inherently element-scoped — no filter needed |
| "All Elemental DMG Bonus +12%" | 7× `${element}%` entries | none | Use `allElementalDmg(0.12)` helper |
| "Elemental DMG Bonus +X%" | `${element}%` for equipping char | none | Check context — usually means the character's own element |
| "DMG +20%" (generic) | `dmg%` | none | Universal — applies to all formulas |
| "DMG dealt by Normal/Charged/Plunging ATK increases by X%" | `dmg%` | `{ abilities: ["normal", "charge", "plunge"] }` | |
| "Increases CRIT Rate by 12%" | `cr` | none | |
| "increases Elemental Skill CRIT Rate by 12%" | `cr` | `{ abilities: ["skill"] }` | |
| "opponents' Elemental RES -40%" / "decreases RES by X%" | `resReduction%` | none | |
| "reduce DEF -15%" | `defReduction%` | none | |
| "ignore 30% DEF" | `defIgnore%` | none | |
| "increases DMG taken by opponents by X%" | `dmgTaken%` | none | Mechanically an enemy debuff but same zone as DMG% |
| "Bloom reaction DMG +40%" | `reactionDmg%` | `{ reactions: ["bloom"] }` | **Not** `dmg%` — different multiplicative zone |
| "Bloom, Hyperbloom, Burgeon DMG +X%" | `reactionDmg%` | `{ reactions: ["bloom", "hyperbloom", "burgeon"] }` | |
| "Swirl CRIT Rate +30%" | `reactionCr` | `{ reactions: ["swirl"] }` | **Not** `cr` — only for reaction damage |
| "Melt/Vaporize DMG +15%" | `reactionDmg%` | `{ reactions: ["melt", "vaporize"] }` | |
| "Normal ATK DMG increased by X% of DEF" (Yun Jin) | `baseDmg` | `{ abilities: ["normal"] }` | Flat base DMG add — dynamic, scales off DEF |
| "the damage is elevated by X%" | `elevated%` | varies | §4, Nod-Krai constellations |

### 3.3 Assumption Conventions

We model **peak damage** — not average across a rotation. These assumptions ensure comparable results:

| Assumption | Rule | Rationale |
|---|---|---|
| **Conditional buffs** | Always active | "after using E" / "upon triggering reaction" → assume the condition is met |
| **Stacks** | Maxed — **if the team comp can theoretically reach max** | If max stacks require 4 unique elements but the team only has 3, cap at the theoretical max |
| **Low HP conditions** | Active | "when HP < 50%" → assume active (Hu Tao, Staff of Homa, etc.) |
| **Shield conditions** | Team has shielder | "while protected by a shield" → check `teamMeta.hasShielder()` (incorporates `charInfo` + constellations) |
| **Heal conditions** | Team has healer | "after receiving healing" → check `teamMeta.hasHealer()` (incorporates `charInfo` + constellations) |
| **Enemy element affection** | Team comp has the element | "against Pyro-affected enemies" → team must have Pyro character.|
| **Self element affection** | Active | "while under the effect of Pyro" → assume active, add code comments to note the assumption. |
| **Talent levels** | Lv10 (including C3/C5 +3 → Lv13) | Lv10 is max before cons; C3/C5 raises to Lv13 |
| **Reaction conditions** | Team comp must support it | "when Swirl is triggered" → team must have Anemo + a reactive element |
| **Constellation gates** | Check `this.constellation ≥ N` | Only include buff if constellation is met |
| **Refinement scaling** | Use `this.refinement` | Only numeric values change — types/targets stay the same |

### 3.4 Common Pitfalls

1. **`dmg%` vs `reactionDmg%`**: "Bloom DMG +40%" is `reactionDmg%` (inside the reaction bonus zone), NOT `dmg%`. `dmg%` is for ability/hit damage bonuses. Mixing these up produces incorrect numbers for all reaction formulas.

2. **`cr`/`cd` vs `reactionCr`/`reactionCd`**: Reaction CRIT is a separate overlay. Nahida C2's "+20% Bloom CR" is `reactionCr`, not `cr`. Only Transformative & Lunar reactions use this — Amplifying/Catalyze use the character's normal `cr`/`cd`.

3. **Element-specific `${element}%` vs generic `dmg%`**: A goblet's "Pyro DMG Bonus +46.6%" is `pyro%`. A weapon's "Normal ATK DMG +35%" is `dmg%` with ability filter. Don't use `dmg%` for element bonuses — they're inherently scoped by stat key name.

4. **`baseDmg` (flat) vs `baseDmg%` (multiplier)**: Shenhe's Quill adds flat damage → `baseDmg`. Moonsign passives that say "deal X% original DMG" → `baseDmg%`. These are different multiplicative zones.

5. **Receiver `onField` vs `self`**: Bennett Q gives ATK to "the active character" → `onField`. Xingqiu E gives himself DMG Reduction → `self`. If the text says "party members" → `team`. Buff to oneself's skills is usually `selfOnField`.

6. **`noStackId`**: When the description says "buffs of the same type will not stack" (e.g., Millennial Movement weapons), all buffs sharing that effect must use the same `noStackId`. The pipeline keeps only the highest value.

7. **Team-comp conditions**: Nilou passive (+60% Bloom DMG) only activates in Hydro+Dendro-only teams. Evaluate at construction time via `teamMeta.countByElement()`. If the team doesn't meet the condition, don't include the buff.

---

## 4. Damage Formula Catalogue

All formula classes live in `damageFormulas.ts`. Every formula takes a `DamageTag` and reads stats via `stats.get(key, this.tag)` for automatic scoping.

### 4.1 DamageFormula (Abstract Base)

See `DamageFormula` in [`damageFormulas.ts`](../src/lib/team-comp/damageFormulas.ts). Constructor: `(talentMultiplier, tag: DamageTag, scalingKey = "atk", extraTerm?)`. Abstract `calc(stats, charLevel, ctx)` returns `DamagePart`. Shared helpers: `getBaseDmg()`, `computeDmgBonusMult()`, `computeCritMult()`, `computeDefMult()`, `computeResMult()`.

**Dual-stat scaling**: Some talents scale off two stats (e.g., Nahida E: ATK + EM). Pass `extraTerm: { key, multiplier }` where `key` is `"atk" | "hp" | "def" | "em"`. The extra term is additive with the primary in base damage: `ScalingDmg = Stat × TalentMult + ExtraStat × ExtraMult`.

```typescript
// Nahida Tri-Karma: 185.9% ATK + 371.7% EM
new DirectFormula(1.859, tag, "atk", { key: "em", multiplier: 3.717 })
```

### 4.2 Formula Subclasses

| Class | Reaction Types | Formula |
|-------|------------------|---------|
| `DirectFormula` | `none` | `BaseDmg × DmgBonus × DEFMult × RESMult × CritMult` |
| `AmplifyFormula` | melt, vaporize | `Direct × ReactionBase(element) × (1 + EMBonus + reactionDmg%)` |
| `CatalyzeFormula` | spread, aggravate | `(BaseDmg + FlatAdditive) × DmgBonus × DEFMult × RESMult × CritMult` |
| `TransformFormula` | overloaded, electroCharged, superconduct, swirl, shatter, bloom, hyperbloom, burgeon, burning | `LevelMult × Coeff × (1 + EMBonus + reactionDmg%) × RESMult × ReactionCritMult` |
| `LunarFormula` | lunarCharged, lunarCrystallize | `LevelMult × Coeff × (1+baseDmg%) × (1+EMBonus+reactionDmg%) × (1+elevated%) × (1+dmgTaken%) × RESMult × CritMult` |
| `LunarDirectFormula` | lunarCharged, lunarCrystallize | `(Stat × TalentMult × DirectCoeff × (1+baseDmg%) × (1+EMBonus+reactionDmg%) + baseDmg) × (1+elevated%) × CritMult × RESMult` |

All formula implementations live in [`damageFormulas.ts`](../src/lib/team-comp/damageFormulas.ts). Key design notes per subclass:

- **DirectFormula**: Straightforward product of all five multiplier zones.
- **AmplifyFormula** (`extends DirectFormula`): Calls `super.calc()` then multiplies by `ReactionBase × (1 + EMBonus + reactionDmg%)`. EMBonus uses the standard EM formula `2.78×EM / (1400+EM)`.
- **CatalyzeFormula**: Adds a flat `levelMult × reactionCoeff × (1+EMBonus+reactionDmg%)` bonus to BaseDmg **before** all normal multipliers. Same standard EM formula as Amplify.
- **TransformFormula**: No DEF multiplier. Uses a different EM formula: `16×EM / (2000+EM)`. Optional reaction CRIT via separate `reactionCr`/`reactionCd` stats.
- **LunarFormula**: No DEF multiplier. Unique EM formula: `6×EM / (2000+EM)`. Has separate `baseDmg%` and `elevated%` multiplicative layers plus `dmgTaken%`. Uses character `cr`/`cd` (not reaction CRIT).
- **LunarDirectFormula**: Like LunarFormula but uses the character's talent multiplier × `DirectCoeff` instead of level-based reaction damage. No DEF multiplier.

---

## 5. Extension System

Each character, weapon, and artifact set is an extension class registered via decorators. All extensions live in `src/lib/team-comp/`.

### 5.1 Base Classes & Registration

All base classes and registration decorators live in [`damageModels.ts`](../src/lib/team-comp/damageModels.ts).

| Base Class | Constructor Args | Provides |
|---|---|---|
| `CharacterBase` | `charId, charLevel, constellation, teamMeta, combatOpts?` | `stats` (auto-resolved incl. baselines), `buffs`, `formulaMap` → `formulaIds`, `getDamageResult()` |
| `WeaponBase` | `weaponId, refinement, charId, teamMeta, combatOpts?` | `stats` (auto-resolved baseAtk + secondary), `buffs` |
| `ArtifactSetBase` | `artifactSetId, charId, teamMeta` | `stats`, `buffs` (4pc bonus) |
| `ArtifactHalfSetBase` | `artifactHalfSetId, teamMeta` | `stats`, `buffs` (2pc bonus) |

Registration: `@RegisterCharacter("hu_tao")`, `@RegisterWeapon("staff_of_homa")`, `@RegisterArtifactSet("crimson_witch_of_flames")`, `@RegisterArtifactHalfSet("1")`. Option schemas: `@RegisterCharacter("durin", durinOption)`.

**Usage**: 4pc Crimson Witch = `ArtifactSetBase` (CW 4pc-specific) + `ArtifactHalfSetBase` (CW 2pc: +15% Pyro DMG). A 2pc+2pc build = two `ArtifactHalfSetBase` instances.

### 5.2 TeamMeta

Constructed once per team configuration. Provides metadata lookups (`characters`, `elements`, `regions`, `rarities`, `weaponTypes`, `factions`, `energies`, `artifactSets`) and query helpers for conditional buff evaluation. See `TeamMeta` in [`damageModels.ts`](../src/lib/team-comp/damageModels.ts).

**Common patterns**:
- **Element count**: `teamMeta.countByElement("Geo")` for "per Geo character" buffs.
- **Moonsign levels**: Nascent Gleam = `countByRegion("Nod-Krai") === 1`, Ascendant Gleam = `countByRegion("Nod-Krai") >= 2`.
- **Reaction eligibility**: `teamMeta.hasReaction("vaporize")` checks the team has both Pyro and Hydro.
- **Lunar reactions**: `hasReaction("lunarCharged")` also requires a 5★ from Nod Krai.
- **Hexerei**: `teamMeta.countByFaction("Hexerei")` checks the number of Hexerei characters in the team.
- **Role detection**: `teamMeta.hasHealer()` and `teamMeta.hasShielder()` check if the team includes characters capable of those roles at their current constellation level.

### 5.3 Extension Examples

**Artifact 2pc** — Viridescent Venerer:
```typescript
@RegisterArtifactHalfSet("16")
class VV2pc extends ArtifactHalfSetBase {
  readonly stats: StatEntry[] = [];
  readonly buffs = [
    new StatBuff(
      { type: "artifactHalfSet", id: this.artifactHalfSetId },
      { receiver: "self" },
      [{ key: "anemo%", value: 0.15 }],
    ),
  ];
}
```

**Weapon** — Staff of Homa:
```typescript
@RegisterWeapon("staff_of_homa")
class StaffOfHoma extends WeaponBase {
  private readonly src = wbs(this);

  readonly buffs = [
    // Passive: HP%
    new StatBuff(this.src, { receiver: "self" },
      [{ key: "hp%", value: r(this.refinement, [0.20, 0.25, 0.30, 0.35, 0.40]) }]),
    // Passive (<50% HP): HP → ATK conversion
    new ScalingBuff(this.src, { receiver: "self" }, [],
      "hp", "atk", r(this.refinement, [0.008, 0.010, 0.012, 0.014, 0.016])),
  ];
}
```

**Character** — Hu Tao:
```typescript
@RegisterCharacter("hu_tao")
class HuTao extends CharacterBase {
  readonly buffs: StatBuff[] = [
    // passive: +33% Pyro DMG when HP < 50% (assume active)
    new StatBuff(
      cbs(this, ["low-hp"], "P2"),
      { receiver: "selfOnField" },
      [{ key: "pyro%", value: 0.33 }]),
    // E: Guide to Afterlife — HP → ATK conversion
    new ScalingSkillBuff(
      cbs(this, ["E"], "E"),
      { receiver: "selfOnField" }, [],
      "hp", "atk", this.constellation,
      (c) => ({ scale: c >= 3 ? 0.0626 : 0.0556 }),
    ),
  ];

  // Charged ATK Lv10: 242.57%, Lv13 (C3+): 286.38%
  protected readonly formulaMap = (() => {
    const mult = this.constellation >= 3 ? 2.8638 : 2.4257;
    return {
      "charged-atk": {
        label: { zh: "重击", en: "Charged ATK" },
        parts: [{ formula: new DirectFormula(mult,
          { element: "Pyro", ability: "charge", reaction: "none" }) }],
      },
      "charged-atk-vaporize": {
        label: { zh: "重击（蒸发）", en: "Charged ATK Vaporize" },
        parts: [{ formula: new AmplifyFormula(mult,
          { element: "Pyro", ability: "charge", reaction: "vaporize" }) }],
      },
    };
  })();
}
```

**Support with team buff** — Bennett:
```typescript
@RegisterCharacter("bennett")
class Bennett extends CharacterBase {
  readonly buffs: StatBuff[] = [
    // Q: base ATK scaling → flat ATK (to onField DPS)
    new ScalingSkillBuff(
      cbs(this, ["Q"]),
      { receiver: "onField" }, [],
      "baseAtk", "atk", this.constellation,
      (c) => ({ scale: c >= 5 ? 1.19 : 1.008 }),
    ),
    // C6: +15% Pyro DMG within Q field
    new StaticSkillBuff(
      cbs(this, ["Q"], "C6"),
      { receiver: "onField" }, this.constellation,
      (c) => (c >= 6 ? [{ key: "pyro%", value: 0.15 }] : []),
    ),
  ];

  // E tap Lv10: 252%, Lv13 (C3+): 297%
  protected readonly formulaMap = {
    "skill-tap": {
      label: { zh: "元素战技（点按）", en: "Skill (Tap)" },
      parts: [{ formula: new DirectFormula(
        this.constellation >= 3 ? 2.97 : 2.52,
        { element: "Pyro", ability: "skill", reaction: "none" }) }],
    },
  };
}
```

### 5.4 Reaction Conditions → Team Composition

Many buff texts contain "when X reaction is triggered". Since we don't simulate real-time gameplay, these are translated into **team composition requirements** via `teamMeta.hasReaction()`.

| Condition Text | Team Requirement |
|---|---|
| Trigger Vaporize | ≥1 Pyro + ≥1 Hydro |
| Trigger Melt | ≥1 Pyro + ≥1 Cryo |
| Trigger Swirl | ≥1 Anemo + ≥1 of {Pyro, Hydro, Electro, Cryo} |
| Trigger Overloaded | ≥1 Pyro + ≥1 Electro |
| Trigger Bloom | ≥1 Hydro + ≥1 Dendro |
| Trigger Hyperbloom | ≥1 Hydro + ≥1 Dendro + ≥1 Electro |
| Trigger Spread/Aggravate | ≥1 Dendro + ≥1 Electro |
| Trigger Elemental Reaction (generic) | ≥2 distinct elements + ≥1 of {Pyro, Hydro, Electro, Cryo} AND set(elements) != {Dendro, Cryo} |
| Trigger Lunar Electro-Charged | ≥1 Hydro + ≥1 Electro, and ≥1 participant is a 5★ from Nod Krai |
| Nascent Gleam (初辉) active | Exactly 1 character from Nod Krai |
| Ascendant Gleam (满辉) active | ≥2 characters from Nod Krai |

Full reaction requirement table is codified in `constants.ts` → `REACTION_ELEMENT_REQUIREMENTS`.

---

## 6. Build Pipeline

### 6.1 CharBuild (`damageCalc.ts`)

Composes a character's full build (character + weapon + artifacts) and owns the stat resolution pipeline. See `CharBuild` in [`damageCalc.ts`](../src/lib/team-comp/damageCalc.ts).

**Stat resolution phases**:

```
Construction:
  innerStatSheet = charBase.stats + weaponBase.stats + setBase.stats + halfSets.stats

Phase 1 — Static Buffs (called once via TeamBuild ctor):
  applyStaticBuffs(allTeamStaticBuffs)
  → innerStatSheet now includes all static buff contributions

Phase 2 — Pre-Stats (called per artifact roll):
  preStats = innerStatSheet.merge(artifactStats)
  → preStats includes everything except dynamic (stat-scaling) buffs

Phase 3 — Dynamic Buffs (called per artifact roll):
  dynamicBuffs = all team members' getDynamicBuffs(selfPreStats, teamPreStats)
  → evaluates stat-scaling functions with the pre-stats

Phase 4 — Post-Stats (called per artifact roll):
  postStats = getPostStats(preStats, allTeamDynamicBuffs)
  → final stat sheet used for formula evaluation
```

### 6.2 CharCompConfig

See `CharCompConfig` in [`types.ts`](../src/lib/team-comp/types.ts). Fields: `charId`, `charLevel` (90 or 100), `constellation` (0–6), `weaponId`, `refinement` (1–5), `artifactSetId` (null if 2+2), `artifactHalfSetIds` (1 entry for 4pc, 2 for 2+2).

### 6.3 TeamBuild (`damageCalc.ts`)

Orchestrates the full team pipeline. Constructed once per team configuration. See `TeamBuild` in [`damageCalc.ts`](../src/lib/team-comp/damageCalc.ts). Key method: `getTeamStats(artifactStats, calcTargetId)` is the hot path during artifact optimization.


