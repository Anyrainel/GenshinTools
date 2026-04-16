# Damage Design

Engine for computing Genshin Impact character damage with team buffs, reactions, and rotation modeling. All code lives in `src/lib/team-comp/`.

## File Layout

| File | Purpose |
|---|---|
| `types.ts` | All shared types (StatKey, BuffTarget, DamageTag, ComboDescriptor, CalcContext, etc.) |
| `damageModels.ts` | Base classes (CharacterBase, WeaponBase, ArtifactSetBase, ArtifactHalfSetBase), TeamMeta, StatSheet, registration decorators |
| `damageFormulas.ts` | Formula classes (Direct, Amplify, Catalyze, Transform, Lunar, LunarDirect), factory methods |
| `damageBuffs.ts` | Buff classes (StatBuff, ScalingBuff, CrossScalingBuff), dedup logic |
| `damageCalc.ts` | Orchestration (TeamBuild, CharBuild, TeamResonance, evaluateCombo) |
| `constants.ts` | Reaction tables, element sets, lunar superseding map |
| `helpers.ts` | Convenience constructors (r, wbs, cbs, allElementalDmg, getReactionAuraElements) |
| `stackAllocation.ts` | Greedy allocator for maxStacks-limited buffs |
| `formulaCompiler.ts` | Expression compiler for optimizer (AST-based) |
| `extraBuffTypes.ts` | User-added team buffs from UI |
| `impl/` | All character, weapon, artifact implementations |

---

## 1. Stat Zones

Each stat key maps to a distinct multiplicative zone in the damage formula. Using the wrong key collapses two zones into one, breaking buff interaction.

| Key | Zone | Notes |
|---|---|---|
| `dmg%` | `1 + element% + dmg%` | Generic DMG bonus. Per-element keys (`pyro%`, `hydro%`, etc.) are equivalent to `dmg%` with element filter. |
| `reactionDmg%` | `1 + EM + reactionDmg%` | Separate layer from `dmg%`. Requires `filter: { reactions: [...] }`. |
| `cr` / `cd` | Crit | Normal hit crits. |
| `reactionCr` / `reactionCd` | Reaction crit | Separate overlay for transformative reactions. Requires `filter: { reactions: [...] }`. |
| `baseDmg` | Flat add to base | After talent scaling, before all multipliers. |
| `baseDmg%` | `1 + baseDmg%` | 倍率乘区. |
| `reactionBaseDmg%` | `1 + reactionBaseDmg%` | Nod-Krai P3 passives. Separate from `baseDmg%`. |
| `elevated%` | `1 + elevated%` | Moonsign constellations. |
| `resReduction%` | Enemy RES | Enemy debuff — must use `receiver: "team"`. |
| `defReduction%` | Enemy DEF | Enemy debuff — must use `receiver: "team"`. |

Full `StatKey` union is in `types.ts`. The engine also tracks `atkSpd%`, `heal%`, `em`, `er%`, and base stats.

**Dynamic elemental DMG:** Use `dmg%` with `filter: { elements: [...] }` for dynamically determined elements. Per-element keys (`pyro%`) are fine for static single-element buffs.

---

## 2. DamageTag & Filtering

Every formula carries a `DamageTag { element, ability, reaction }`. Buffs declare an optional `DamageTagFilter { elements?, abilities?, reactions? }` — omitted dimensions are universal. A buff's stat contributions are only visible to formulas whose tag matches the filter.

**AbilityType:** `normal | charge | plunge | skill | burst | sprint | special`

---

## 3. BuffTarget

```
BuffTarget {
  receiver: BuffReceiverType    // who gets the buff
  filter?: DamageTagFilter      // which formulas see it
  regions?: Region[]            // restrict to characters from these regions
  factions?: Faction[]          // restrict to characters from these factions
  charId?: string               // restrict to one specific character
}
```

### Receiver Types

| Receiver | Who gets it | Field-dependent? |
|---|---|---|
| `self` | Provider (on-field + off-field) | No |
| `selfOnField` | Provider, only when on-field | Yes |
| `selfOffField` | Provider, only when off-field | No |
| `other` | 3 teammates (on-field + off-field) | No |
| `otherOnField` | Teammates, only on-field (excludes provider) | Yes |
| `otherOffField` | Teammates, only off-field (excludes provider) | No |
| `teamOnField` | On-field character (including provider) | Yes |
| `teamOffField` | All 4, only when off-field | No |
| `team` | All 4 (on-field + off-field) | No |

Key distinctions: `other` = on+off-field damage buffed; `otherOnField` = only active character's damage buffed (excludes provider); `teamOnField` = same but includes provider.

---

## 4. BuffSource

```
BuffSource {
  type: "character" | "weapon" | "artifactSet" | "artifactHalfSet" | "teamResonance" | "extra"
  id: string
  origin?: string        // C0–C6, A, E, Q, P1–P4, R1–R5 (display-only)
  triggers?: string[]    // Activation conditions (display-only)
  noStackId?: string     // Dedup key — same noStackId across buffs → only highest value applies per stat key
  maxStacks?: number     // Limited activation count — greedy allocator distributes across formula parts
  element?: Element      // Display hint
}
```

Helpers: `cbs(self, origin, triggers?)` for characters, `wbs(self, triggers?, noStackId?)` for weapons.

---

## 5. Buff Classes

All in `damageBuffs.ts`.

| Class | Constructor extras (beyond source, target, staticBuffs) | Pattern |
|---|---|---|
| `StatBuff` | — | Static entries + optional `dynamicBuffs(selfStats, teamStats[])` override |
| `ScalingBuff` | `inputKey, outputKey, scale, cap?, threshold?` | `min(inputKey × scale, cap)` → outputKey. `threshold` subtracts before scaling. |
| `CrossScalingBuff` | `statA, scaleA, capA, statB, outputKey` | `min(statA × scaleA, capA) × statB` → outputKey |

**Anonymous subclass pattern** — for one-off dynamic buffs, extend `StatBuff` inline and override `dynamicBuffs()`.

**maxStacks:** When present, the greedy allocator (`stackAllocation.ts`) distributes limited activations across formula parts to maximize damage. Valid on any buff — team/other buffs, self buffs in the regular `buffs` array, or `bespokeBuffs` (per-FormulaPart). For "first cast only" self effects, prefer `bespokeBuffs` with `maxStacks` equal to the part's hit count, attached to every part of the affected formula — this scopes the budget to that specific cast. A regular self buff with `maxStacks` allocates the budget across the whole combo instead; use it when that matches the game text. Per-character independent stacks: emit one buff per teammate with `charId`.

**noStackId:** When multiple buffs share the same `noStackId`, only the highest value applies per stat key. Used for weapon/artifact series that shouldn't stack (e.g., Millennial Movement).

---

## 6. Formula Classes

All in `damageFormulas.ts`. Base class: `DamageFormula(talentMultiplier, tag, scalingKey?, extraTerm?)`.

| Class | Reaction types | Extends |
|---|---|---|
| `DirectFormula` | `none` | DamageFormula |
| `AmplifyFormula` | melt, vaporize | DirectFormula |
| `CatalyzeFormula` | spread, aggravate | DamageFormula |
| `TransformFormula` | overloaded, electroCharged, superconduct, swirl, shatter, bloom, hyperbloom, burgeon, burning | DamageFormula |
| `LunarFormula` | lunarCharged, lunarCrystallize | DamageFormula |
| `LunarDirectFormula` | lunarCharged, lunarCrystallize | DamageFormula |

**Unified reaction selection:** Characters register only `DirectFormula` entries. Amplifying/catalyze variants are created at evaluation time via `formula.createAmplified()`, `formula.createCatalyzed()`, or the dispatcher `createReactionVariant()`. Custom formula subclasses override these factory methods.

**LunarDirectFormula:** Pass the raw game% as `talentMult`. `DirectCoeff` (×3 lunarCharged, ×1.6 lunarCrystallize) is applied internally.

**Dual-stat scaling:** `extraTerm: { key, multiplier }` for "X% ATK + Y% EM" type talents.

---

## 7. FormulaPart & FormulaEntry

```
FormulaPart {
  formula: DamageFormula
  hits?: number          // Repeated hits with same multiplier (preserves per-hit baseDmg)
  bespokeBuffs?: StatBuff[] // Per-part buffs, selfOnField scope only
  offField?: boolean     // Damage dealt while off-field (on-field buffs excluded)
}

FormulaEntry {
  label: I18nLabel
  parts: FormulaPart[]
  minC?: number          // Minimum constellation required (formula hidden below this)
  when?: boolean         // Additional availability gate
}
```

**bespokeBuffs:** Only when a buff can't be scoped via normal `BuffTarget` filtering (e.g., one specific formula among several sharing the same ability type). Array — pass each per-part buff as an element. Accepts any StatBuff subclass.

**Per-part reaction eligibility:** Resolved at calc time via `ELEMENT_ELIGIBLE_REACTIONS` (constants.ts) and `resolvePartReaction()` (types.ts). Not a field on FormulaPart — the UI's ReactionSelector manages per-part overrides via `ReactionOverride.partReactions`.

---

## 8. Extension Registration

### Base Classes

| Class | Constructor args | Provides |
|---|---|---|
| `CharacterBase` | charId, charLevel, constellation, teamMeta, combatOpts?, talentLevels? | stats, buffs, formulaMap, combo, param() |
| `WeaponBase` | weaponId, refinement, charId, teamMeta, combatOpts? | stats, buffs |
| `ArtifactSetBase` | artifactSetId, charId, teamMeta, combatOpts? | stats, buffs (4pc) |
| `ArtifactHalfSetBase` | artifactHalfSetId, charId, teamMeta | stats, buffs (2pc) |

4pc = ArtifactSetBase + ArtifactHalfSetBase. 2pc+2pc = two ArtifactHalfSetBase.

Decorators: `@RegisterCharacter("id")`, `@RegisterWeapon("id")`, `@RegisterArtifactSet("id")`, `@RegisterArtifactHalfSet("id")`. All accept an optional `OptionDef` for user-configurable modes.

### OptionMap

Declarative option schema with ordered choices. First choice = preferred default. `when?: (teamMeta) => boolean` gates choices behind team conditions. `resolveOption()` falls back to next enabled choice. See `damageModels.ts` for full types.

### this.param()

`CharacterBase.param(skill: "A"|"E"|"Q", paramIndex: number)` — returns talent multiplier at effective level (base + C3/C5 + teammate passives). 1-based paramIndex matching `{paramN}` templates in game text (visible via `impl_audit.py show C <id>`).

Effective talent levels account for:
- C3/C5 bonuses (from charInfo)
- Tartaglia P3: +1 A for all party members
- Skirk P3: +1 E for all party members (mono Hydro+Cryo teams)

All handled automatically — implementations never check these manually.

---

## 9. TeamMeta

Constructed from character IDs, constellations, artifact sets, and optional enemy aura. Exposes:

| Method | Returns |
|---|---|
| `countByElement(el)` | Character count with that element |
| `countByRegion(region)` | Character count from that region |
| `countByFaction(faction)` | Character count in that faction |
| `hasReaction(reaction, charId?)` | Whether team elements enable this reaction |
| `hasHealer()` / `hasShielder()` | Role detection at current constellation |
| `talentPassiveBonuses()` | `{ A, E, Q }` bonus levels (internal use by CharacterBase) |

Properties: `elements`, `regions`, `rarities`, `factions`, `weaponTypes`, `constellations`, `energies`, `isHealer`, `isShielder`, `artifactSets`, `enemyAura`.

**Lunar superseding:** `LUNAR_SUPERSEDES` in constants.ts defines that when a lunar reaction is possible (requires 5★ Moonsign teammate), `hasReaction()` for the base reaction returns false. E.g., `hasReaction("electroCharged")` → false when `hasReaction("lunarCharged")` → true. Partial exception: crystallize is only superseded for Hydro+Geo.

---

## 10. Combo & Rotation System

### ComboDescriptor (declarative)

Characters declare `protected get comboDescriptor(): ComboDescriptor` — an ordered list of formula IDs with counts and constellation-dependent adjustments:

```
ComboEntry { id: string, count: number, bonus?: ConstellationDelta[] }
ConstellationDelta { minC: number, delta: number }
```

`resolveComboDescriptor(descriptor, constellation)` flattens to `Record<string, number>`. CharacterBase exposes `combo` (filtered to enabled formulas), `comboInfo`, and `rawComboDescriptor`.

### ComboLine (user-facing)

```
ComboLine { charId, formulaId, count, reaction?: ReactionOverride }
ReactionOverride { reaction?, partReactions?: Record<number, ReactionType>, partHits?: Record<number, number> }
```

`evaluateCombo()` in damageCalc.ts evaluates a full rotation, caching team stats per on-field character.

---

## 11. Orchestration

### CalcContext

Scenario-level parameters: `{ enemyLevel, enemyRes, critRateTarget?, rollMultiplier?, substatBudget? }`. Passed through all damage calculations.

### TeamBuild

Constructed from `TeamSlotConfig[]` + options. Orchestrates stat resolution, buff application, and damage calculation:
- `getTeamStats(artifactStats, onFieldCharId)` — resolves all stats with field-dependent buffs
- `getDamageResult(charId, formulaId, teamStats, ...)` — single formula evaluation
- `getDisplayResult(...)` — full display payload with buff breakdown
- `getComboDescriptor(charId)` / `getCombo(charId)` — rotation data
- `createOptimizerContext(...)` / `getTeamStatsFast(...)` — hot path for optimizer

### ExtraBuff

User-added team buffs from UI: `{ id, presetId?, target: "team" | charId, stats, maxStacks? }`. Converted to StatBuff[] and merged into team buffs. Types in `extraBuffTypes.ts`.

---

## 12. Key Constants

| Constant | In | Purpose |
|---|---|---|
| `ELEMENT_ELIGIBLE_REACTIONS` | constants.ts | Which reactions each element can use (for per-part reaction resolution) |
| `LUNAR_SUPERSEDES` | constants.ts | Base → lunar reaction superseding map |
| `REACTION_ELEMENT_REQUIREMENTS` | constants.ts | Element requirements per reaction (used by hasReaction) |
| `MULTI_ELEMENT_CHARS` | constants.ts | Characters with multi-element formulas (Chasca, Varka) |
| `ZERO_ENERGY_CHARS` | constants.ts | Characters with 0 energy during damage (Skirk, Mavuika) |

---

## 13. Helpers

| Function | Signature | Purpose |
|---|---|---|
| `r` | `(refinement, [R1..R5])` | Refinement-scaled value |
| `wbs` | `(self, triggers?, noStackId?)` | Weapon buff source |
| `cbs` | `(self, origin, triggers?)` | Character buff source |
| `allElementalDmg` | `(value)` → `StatEntry[]` | All 7 element DMG% entries |
| `getReactionAuraElements` | `(triggerElement)` → `Element[]` | Aura elements for a trigger |

---

## 14. Code Patterns

**IIFE for team-conditional buffs:**
```typescript
readonly buffs = [
  ...(() => {
    const count = this.teamMeta.countByElement("Geo");
    return count >= 2 ? [new StatBuff(src, tgt, entries)] : [];
  })(),
];
```

**Anonymous subclass for one-off dynamic buffs:**
```typescript
new (class extends StatBuff {
  override dynamicBuffs(selfStats: StatSheet): StatEntry[] {
    return [{ key: "atk", value: Math.min(selfStats.get("hp") * 0.05, 2000) }];
  }
})(source, target, []);
```

**Per-teammate buff loop (charId targeting):**
```typescript
for (const cid of Object.keys(this.teamMeta.elements)) {
  if (cid === this.charId) continue;
  buffs.push(new ScalingBuff({ ...cbs(this, "E", ["E"]), maxStacks: 5 },
    { receiver: "team", charId: cid, filter: { elements: ["Cryo"] } },
    [], "atk", "baseDmg", scale));
}
```
