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
7. [Reaction Override System](#7-reaction-override-system)
8. [Combo Formulas (Rotation Modeling)](#8-combo-formulas-rotation-modeling)

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
  [ScalingDmg × (1+baseDmg%) + baseDmg] × (1 + element%(元素伤害) + dmg%(伤害加成))
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
    × (1+elevated%(擢升)) × RESMult × CritMult
  (no DEF, own EM formula, uses character cr/cd; multi-contributor weighted sum)

Lunar Direct (月曜直伤: character abilities dealing Lunar DMG):
  (Stat × TalentMult × DirectCoeff × (1+baseDmg%) × (1 + EMBonus + reactionDmg%)
    + baseDmg) × (1+elevated%) × CritMult × RESMult
  (no DEF; DirectCoeff varies: ×3 for lunarCharged, ×1.6 for lunarCrystallize)
```

Each stat key feeds into exactly one zone of these formulas. The table below maps keys to their zone:

| Key | Multiplicative Zone | Why Separate |
|-----|---------------------|--------------|
| `dmg%` | `1 + ${element}% + dmg%` | Generic DMG bonus zone |
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
| `otherOnField` | Other characters' stat sheet (support → DPS transfer) | `getTeamStats()` |
| `onField` | CalcTarget's stat sheet (support → DPS transfer) | `getTeamStats()` |
| `team` | All 4 party members | Construction |

### 1.4 Reaction Types

See `AbilityType`, `ReactionType`, and `LunarReactionType` in [`types.ts`](../src/lib/team-comp/types.ts). `AbilityType` includes `"special"` for character mechanics that don't fit standard categories. For example when a skill effect says "this DMG is not considered X Skill DMG" but didn't specify what it is considered as, we will use `"special"` as the `ability` type.

### 1.5 CalcContext & DamageResult

See [`types.ts`](../src/lib/team-comp/types.ts) for definitions.

- **CalcContext**: Scenario-level parameters (`enemyLevel`, `enemyRes`, `assumeCrit`). Constant for the entire team, passed at `calc()` time.
- **DamageResult**: Aggregated result for a formulaId — `parts: { damage: number; hits: number }[]` and `Σ(damage × hits)`. Each `damage` is the raw `number` returned by a single `DamageFormula.calc()` invocation. Intermediate component breakdowns are only available via the cold-path `display()` method.

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

**Ordering rule**: Choices must be ordered by preference — **the first choice is the most preferred default**. The `default` field must match the first choice's value. When a higher-preference choice is disabled by `when`, `resolveOption` naturally falls back to the next enabled choice.

**Conditional availability (`when`)**: Each `OptionChoice` may have an optional `when?: (teamMeta: ITeamMeta) => boolean` predicate. When provided, the choice is disabled in the UI if the predicate returns false. `resolveOption()` skips disabled choices when falling back. Common patterns:

```typescript
// Constellation-gated choice:
{ value: "c6", label: ..., when: (tm) => (tm.constellations["hu_tao"] ?? 0) >= 6 }

// Reaction-gated choice:
{ value: "frozen", label: ..., when: (tm) => tm.hasReaction("freeze") }

// Element-gated choice:
{ value: "electro", label: ..., when: (tm) => tm.countByElement("Electro") >= 1 }
```

The UI renders **all** choices but disables those where `when` returns false. If **all** choices are disabled, the dropdown is replaced with `--`. `isChoiceEnabled(choice, teamMeta?)` is the helper for checking availability.

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
| `ScalingBuff` | Single input → single output, with optional cap and threshold | Hu Tao E (HP → ATK), Kazuha passive (EM → DMG%) |
| `ErScalingBuff` | ER-over-base → ATK% | Engulfing Lightning passive |

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

For the comprehensive guide on translating an in-game text into the correct `StatBuff` parameter, picking the correct `StatKey` (such as `dmg%` vs `reactionDmg%`), determining the `BuffTarget.receiver`, and the general **Assumption Conventions** (Peak Damage modeling), please refer to the **[DmgRunbook.md](./DmgRunbook.md)**. The runbook captures all standard text mapping conventions, specific edge cases, and common pitfalls when bridging descriptions and math.

---

## 4. Damage Formula Catalogue

All formula classes live in `damageFormulas.ts`. Every formula takes a `DamageTag` and reads stats via `stats.get(key, this.tag)` for automatic scoping.

### 4.1 DamageFormula (Abstract Base)

See `DamageFormula` in [`damageFormulas.ts`](../src/lib/team-comp/damageFormulas.ts). Constructor: `(talentMultiplier, tag: DamageTag, scalingKey = "atk", extraTerm?)`. Abstract `calc(stats, charLevel, ctx)` returns `number` (the final damage). Intermediate breakdowns are provided by the separate `display()` method which returns a `DisplayPart`. Shared helpers: `getBaseDmg()`, `computeDmgBonusMult()`, `computeCritMult()`, `computeDefMult()`, `computeResMult()`.

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
| `LunarFormula` | lunarCharged, lunarCrystallize | `LevelMult × Coeff × (1+baseDmg%) × (1+EMBonus+reactionDmg%) × (1+elevated%) × RESMult × CritMult` |
| `LunarDirectFormula` | lunarCharged, lunarCrystallize | `(Stat × TalentMult × DirectCoeff × (1+baseDmg%) × (1+EMBonus+reactionDmg%) + baseDmg) × (1+elevated%) × CritMult × RESMult` |

All formula implementations live in [`damageFormulas.ts`](../src/lib/team-comp/damageFormulas.ts). Key design notes per subclass:

- **DirectFormula**: Straightforward product of all five multiplier zones.
- **AmplifyFormula** (`extends DirectFormula`): Calls `super.calc()` then multiplies the result by `ReactionBase × (1 + EMBonus + reactionDmg%)`. EMBonus uses the standard EM formula `2.78×EM / (1400+EM)`.
- **CatalyzeFormula**: Adds a flat `levelMult × reactionCoeff × (1+EMBonus+reactionDmg%)` bonus to BaseDmg **before** all normal multipliers. Same standard EM formula as Amplify.
- **TransformFormula**: No DEF multiplier. Uses a different EM formula: `16×EM / (2000+EM)`. Optional reaction CRIT via separate `reactionCr`/`reactionCd` stats.
- **LunarFormula**: No DEF multiplier. Unique EM formula: `6×EM / (2000+EM)`. Has separate `baseDmg%` and `elevated%` multiplicative layers. Uses character `cr`/`cd` (not reaction CRIT).
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
- **Moonsign levels**: Nascent Gleam = `countByFaction("Moonsign") === 1`, Ascendant Gleam = `countByFaction("Moonsign") >= 2`. Moonsign faction includes Nod-Krai characters with the moonsign passive plus non-Nod-Krai characters like Zibai.
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

### 5.3.1 Off-Field Damage (`offField`)

Many characters deal damage while off-field (deployable skills, persistent bursts, coordinated attacks). These hits should NOT benefit from on-field buffs (`onField`, `selfOnField` receivers).

Mark formula parts with `offField: true` to exclude on-field buffs from stat resolution:

```typescript
"pyronado": {
  label: { zh: "旋火轮", en: "Pyronado" },
  parts: [{ formula: new DirectFormula(2.24,
    { element: "Pyro", ability: "burst", reaction: "none" }), offField: true }],
},
```

**How it works**: When `offField: true`, the damage calc uses a stat sheet computed with `calcTargetId` set to a different team member, so `onField`/`selfOnField` buffs are excluded. Only `self`, `selfOffField`, and `team`-scoped buffs apply.

**Default behavior** (no `offField` flag or `offField: false`) is unchanged — all buffs including on-field buffs apply.

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

---

## 7. Reaction Override System

Allows users to dynamically select reactions for any formula without duplicating formula entries. A single `DirectFormula` entry can be evaluated as Direct, Amplified, or Catalyzed at runtime.

### 7.1 Factory Methods on DamageFormula

The `DamageFormula` base class provides three factory methods that create reaction variants while preserving the original formula's parameters (talentMultiplier, scalingKey, extraTerm):

```typescript
formula.createAmplified("vaporize" | "melt")    → AmplifyFormula
formula.createCatalyzed("spread" | "aggravate")  → CatalyzeFormula
formula.createDirect()                            → DirectFormula (reaction: "none")
```

Custom subclasses (e.g., `ArlecchinoNormalFormula` with overridden `getBaseDmg()`) override these factories to return their paired variant class, preserving custom logic.

### 7.2 `createReactionVariant()` Utility

A standalone factory function in `damageFormulas.ts` that dispatches to the correct factory method:

```typescript
createReactionVariant(formula, targetReaction) → DamageFormula
```

- If `targetReaction === formula.tag.reaction` → returns the formula itself (no-op).
- If `targetReaction === "none"` → `formula.createDirect()`.
- Only formulas with `reaction: "none"` can be converted. Attempting to convert a formula with a built-in reaction (lunar, transformative) **throws** — these formula types are fundamentally different damage models.

### 7.3 ReactionOverride Type

```typescript
type ReactionOverride = {
  reaction?: ReactionType;                    // gate reaction
  partReactions?: Record<number, ReactionType>; // per-part overrides (sparse)
  partHits?: Record<number, number>;          // per-part reacting hit count
};
```

The override uses a **gate + per-part** resolution model:

1. **Gate** (`reaction`): The top-level reaction selection (e.g., "Vaporize"). When "none" or absent, all parts compute as direct damage.
2. **Per-part overrides** (`partReactions`): Sparse map to explicitly set or disable reactions on individual parts (e.g., ICD-locked hits set to "none").
3. **Per-part hit counts** (`partHits`): For multi-hit parts, controls how many hits react vs. how many compute as direct. Default = all hits.

### 7.4 `resolvePartReaction()` Resolution Logic

Defined in `types.ts`. Resolves the effective reaction for each formula part:

```typescript
resolvePartReaction(override, partIndex, eligibleReactions) → ReactionType
```

Priority:
1. No override or gate is "none" → `"none"`
2. Explicit `partReactions[idx]` → use that value
3. Gate reaction, if the element is eligible → inherit gate
4. Element can't use this reaction → `"none"`

Eligible reactions per element are defined in `constants.ts` → `ELEMENT_ELIGIBLE_REACTIONS`:

| Element  | Eligible reactions        |
|----------|---------------------------|
| Pyro     | none, vaporize, melt      |
| Hydro    | none, vaporize            |
| Cryo     | none, melt                |
| Electro  | none, aggravate           |
| Dendro   | none, spread              |
| Anemo/Geo/Physical | none only        |

### 7.5 Pipeline Integration

The `ReactionOverride` is threaded through the evaluation pipeline:

`CharacterBase.getDamageResult(formulaId, selfStats, teamStats, ctx, reactionOverride?)` iterates over the formula entry's parts. For each part:

1. **Skip override** if the formula already has a built-in reaction (`tag.reaction !== "none"`) — lunar and transformative formulas are never overridden.
2. **Resolve** the effective reaction via `resolvePartReaction()`.
3. **Split hits**: If `partHits[idx]` is set and less than total hits, the part is split into reacting hits (using the variant formula) and non-reacting hits (using the original formula).
4. **Create variant** via `createReactionVariant()` only when the target reaction differs from the formula's tag.

This ensures both `calc()` and `display()` use the correct variant, and the existing 5-phase stat resolution pipeline is fully preserved.

### 7.6 Formula Entry Design

With reaction overrides, character extensions only need one formula entry per damage instance. Duplicate entries (e.g., `charged-atk` and `charged-atk-vape`) are no longer needed — the reaction selector handles this at runtime.

---

## 8. Combo Formulas (Rotation Modeling)

A combo is a named list of formula lines representing a rotation's total damage as a weighted sum. Each line references a character's formula with a hit count and optional reaction override.

### 8.1 Data Model

```typescript
type ComboLine = {
  charId: string;              // whose formula (also the on-field character)
  formulaId: string;           // which formula from that character
  count: number;               // repetitions (e.g., 9)
  reaction?: ReactionOverride; // per-line reaction override
};

type ComboFormula = {
  id: string;
  label: I18nLabel;
  lines: ComboLine[];
};

type ComboResult = {
  lineDamages: { perHit: number; total: number }[];
  totalDamage: number;
};
```

Combo lines can reference formulas from **any team member**, enabling full rotation modeling (e.g., 9× Hu Tao CA + 1× Xingqiu Q). The same `formulaId` can appear multiple times with different reactions (partial-vaporize rotations).

### 8.2 `evaluateCombo()` Implementation

Defined in `damageCalc.ts`. Key design:

**Stat caching**: Uses a `Map<string, Record<string, StatSheet>>` keyed by on-field character ID. `getTeamStats()` output depends only on the calc target (on-field character), not the formula, so stats are computed once per unique on-field character (typically 1–2 in a rotation).

**Reaction override merging**: Each line's reaction override is merged with single-mode per-formula overrides (`singleModeOverrides`). Single-mode `partReactions`/`partHits` serve as defaults; the combo line's own values take priority on top.

**Evaluation**: Each line calls `teamBuild.getDamageResult()` with the merged reaction override. The combo result is `Σ(perHitDamage × count)` across all lines.

### 8.3 Combo Display (`getComboDisplayResult`)

The display path in `damageCalc.ts` provides:

- Per-character stat sheets (on-field and off-field contexts)
- Base combo damage (total rotation)
- **Marginal gains**: Per-stat damage sensitivity, computed by bumping each stat by one average substat roll and re-evaluating the full combo. Both the calc target's own stats and support characters' buff-contributing stats are tested.
- **Level-up gains**: Damage improvement from leveling characters to the next tier.

### 8.4 Optimizer Integration

The optimizer uses `evaluateCombo()` when a combo is active, replacing the single-formula damage as the optimization objective. The multi-pass structure (carry-1 → supports → carry-2) is unchanged. Combo eval is ~2–5× a single formula (proportional to line count), acceptable for the optimizer hot path.


