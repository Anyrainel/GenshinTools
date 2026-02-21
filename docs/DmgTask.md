# Task: Incremental Damage Implementation Guide

## Objective

This document outlines the workflow and requirements for implementing or updating characters, weapons, and artifact sets in the Engine. Whenever new content is released, follow this guide to incrementally integrate their buffs and damage formulas based on the official game data.

For the overall system architecture, type definitions, buff classes, formula classes, and stat key mapping, you **must** refer to **[DmgDesign.md](./DmgDesign.md)**.

## 1. Incremental Workflow

When a game update introduces new entities, follow this sequence:

### Step 1: Identify Missing Implementations

Run the unified audit script to find out exactly what needs to be implemented and check for misplaced files.
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py check
```
This will print out entities that do not yet have a matching `@Register*` implementation.

### Step 2: Review and Implement

1. For any missing entity, use the `show` command to dump its localized details and existing code snippet (if any) into the `scripts/.impl_audit_output.txt` file for easy reference alongside your editor:
   ```bash
   uv run --project scripts/pyproject.toml scripts/impl_audit.py show C <char_id>
   uv run --project scripts/pyproject.toml scripts/impl_audit.py show W <weapon_id>
   uv run --project scripts/pyproject.toml scripts/impl_audit.py show A <artifact_id>
   ```
2. **Add the new classes**:
   - **Characters**: `src/lib/team-comp/impl/character*.ts` (split by rarity and region, e.g., `character5Natlan.ts`). Extended from `CharacterBase` and decorated with `@RegisterCharacter`.
   - **Weapons**: `src/lib/team-comp/impl/weapon*.ts` (split by rarity and weapon type, e.g., `weapon5Claymore.ts`. 3* weapons are grouped in `weapon3.ts`). Extended from `WeaponBase` and decorated with `@RegisterWeapon`.
   - **Artifacts**: Add 2pc bonuses to `artifact2pc.ts` (decorated with `@RegisterArtifactHalfSet`) and 4pc bonuses to `artifact4pc.ts` (decorated with `@RegisterArtifactSet`).
3. Run `npm run type-check:headtail` to ensure no errors were introduced.
4. Repeat from Step 1 until `check` reports no missing or misplaced implementations.

### Step 3: Document Blockers

If you hit a blocker you cannot resolve (e.g., missing data, ambiguous game mechanics, need for a new buff abstraction), document it in `docs/DmgTODO.md`, explaining *what* is blocked and *why*.

---

## 2. Character Implementation Guidelines

Each character extends `CharacterBase` (from `damageModels.ts`) and registers with the system via `@RegisterCharacter`.

### Class Members

Required members for you to implement:
- `buffs`: `StatBuff[]` - Buffs provided by talents, passives and constellations. Dynamically constructed based on input constellation and combat option. Use theoretical max values achievable.
- `formulaMap`: `Record<string, FormulaEntry>` - Defines the formulas for the major damage sources of this character. Include multiple playstyles if applicable.

### Talent Level Convention

Use **Lv10** talent multipliers as the baseline. For characters whose constellation upgrades a specific talent (+3 levels via C3 or C5), use **Lv13** when `this.constellation >= threshold`. Use the generated `charInfo` to double check which talent is augmented if you aren't certain.

### Creating BuffSources

Use `cbs(this, triggers?, origin?)` from `helpers.ts` to create `BuffSource` objects:

```typescript
cbs(this)                           // { type: 'character', id: this.charId }
cbs(this, ['low-hp'])               // with triggers
cbs(this, [], 'C6')                 // with origin (constellation)
cbs(this, ['reaction'], 'E')        // origin = E, triggered on reaction
```

Remember: BuffSource is only for display purposes. It is not consumed by formula calculation. For any logic mentioned in BuffSource, the logic also needs to be implemented in BuffTarget or TeamMeta or constellation checks.

### BuffTarget / DamageFormula DamageTag Nuances

If a character's kit increases the damage of a specific named effect (e.g. "Crimson Oowajo DMG"), treat it as the broader standard AbilityType (e.g. `"skill"`) when defining `BuffTarget` and `DamageFormula` **if** the game text implies it belongs to that category (e.g. "deals Elemental Skill DMG"). This allows it to benefit from teammates' generic skill buffs.

### Handling Mutually Exclusive Scenarios (CombatOpts)

If a character has randomized or playstyle-based mechanics that are mutually exclusive (e.g., Furina Ousia/Pneuma), use `CombatOpts` instead of assumptions.

- **Do NOT** create separate character files or subclasses.
- **Do** define an `OptionDef` schema with labeled choices and pass it to `@RegisterCharacter`.
- **Do** use `resolveOption(schema, this.option)` to get a typed value inside your class.

**Example:**
```typescript
import { resolveOption, type OptionDef } from './damageModels';

const durinOption = {
  label: { zh: "角色定位", en: "Role" },
  choices: [
    { value: "dps",     label: { zh: "输出", en: "DPS" } },
    { value: "support", label: { zh: "辅助", en: "Support" } },
  ] as const,
  default: "dps",
} satisfies OptionDef;

@RegisterCharacter("durin", durinOption)
class Durin extends CharacterBase {
  private readonly o = resolveOption(durinOption, this.option);
  
  get buffs(): StatBuff[] {
    return this.o === "support" ? this.supportBuffs : this.dpsBuffs;
  }
}
```

### Stat Keys & Translation Rules

For comprehensive guidelines on picking the correct stat keys (like `reactionDmg%` vs `dmg%`, `baseDmg` vs `baseDmg%`), defining `BuffTarget.receiver`, and handling Mutually Exclusive Scenarios, you **must** refer to the **[DmgRunbook.md](./DmgRunbook.md)**.

### Dual-Stat Scaling

For dual-scaling (e.g. ATK + EM), use the optional `extraTerm` parameter on any formula class:
```typescript
// Nahida Tri-Karma: ATK + EM scaling
new DirectFormula(1.859, tag, "atk", { key: "em", multiplier: 3.717 })
```

### ⚠️ No selfStats at Construction Time

`formulaMap` and `buffs` are evaluated at **construction time**. You cannot read the character's resolved stats (e.g. total ATK) when defining formulas. For stat-dependent buffs or formulas, use `ScalingBuff` instead.

---

## 3. Weapon Implementation Guidelines

Each weapon extends `WeaponBase` (from `damageModels.ts`) and registers via the `@RegisterWeapon` decorator.

### Required Members

| Member | Type | Description |
|---|---|---|
| `buffs` | `StatBuff[]` | Passive effect(s), parameterized by `this.refinement` |

Auto-resolved stats: `WeaponBase` resolves `baseAtk` and the secondary stat from `resources.ts`. **You do NOT need to define a `stats` field.**

### `buffs` as `readonly` vs `get`

Most weapons use `readonly buffs = [...]`. When the buff list depends on team composition (via `this.teamMeta` or `this.charId`), use a **getter** instead:

```typescript
// Static (most weapons):
readonly buffs = [ new StatBuff(...) ];

// Dynamic (team-dependent weapons):
get buffs() {
  const liyueCount = this.teamMeta.countByRegion("Liyue");
  return [ new StatBuff(wbs(this), { receiver: "self" }, [
    { key: "atk%", value: liyueCount * r(this.refinement, [0.07, 0.08, 0.09, 0.1, 0.11]) },
  ]) ];
}
```

### Refinement Scaling

Use the shared helper `r(refinement, values)` from `helpers.ts`. It picks the value at the given 1-indexed refinement level:

```typescript
r(this.refinement, [0.20, 0.25, 0.30, 0.35, 0.40])  // R1=0.20, R5=0.40
```

### BuffSource Helper

Use `wbs(self, triggers?, noStackId?)` from `helpers.ts` to create `BuffSource` objects:

```typescript
wbs(this)                       // { type: 'weapon', id: 'staff_of_homa' }
wbs(this, ['low-hp'])           // with triggers
```

Remember: BuffSource is only for display purposes. Logic regarding conditional activation must be modeled inside `TeamMeta` checks or `BuffTarget` filters.

### Proc-Only Weapons

Weapons whose passive is purely proc damage, CD reset, energy restore, or HP restore still need a class so they're in the registry (the base class picks up base stats). Use empty buffs:

```typescript
@RegisterWeapon('favonius_sword')
class FavoniusSword extends WeaponBase {
  readonly buffs = [];
}
```

---

## 4. Artifact Implementation Guidelines

### Architecture

Each artifact set has **two** classes:
- One extending `ArtifactHalfSetBase` (2pc bonus), keyed by **halfSetId** (numeric string)
- One extending `ArtifactSetBase` (4pc bonus only), keyed by **setId**

The 4pc class provides **only the 4pc-specific bonus**. The 2pc bonus is already provided by the `ArtifactHalfSetBase` class.

Register via `@RegisterArtifactHalfSet` and `@RegisterArtifactSet` decorators.

### Required Members

| Member | Type | Description |
|---|---|---|
| `stats` | `StatEntry[]` | Usually empty `[]` — bonuses come from buffs |
| `buffs` | `StatBuff[]` | Set bonus effects |

### Modeling Conditional 4pc Effects

- For **self-buffs with stacks** (e.g., Crimson Witch E stacks), assume max stacks.
- For **team-wide buffs** (e.g., Noblesse 4pc ATK%), use `receiver: 'team'` or `'onField'`.
- For **enemy debuffs** (e.g., Viridescent 4pc RES reduction), model as a `resReduction%` stat buff with `receiver: 'team'` — anyone can benefit since the formula reads `resReduction%`. Same for `defReduction%`.

### BuffSource.type

Use `type: 'artifactHalfSet'` for 2pc buffs and `type: 'artifactSet'` for 4pc buffs. Available fields:
- `id` — `this.artifactHalfSetId` or `this.artifactSetId`
- `triggers` — trigger conditions: `['E']`, `['after-burst']`, etc. Do NOT use triggers to express 2pc/4pc — the `type` field handles that distinction.

### 2pc Bonus Taxonomy

| Category | Value |
|---|---|
| ATK/HP/DEF +X% | `{ key: 'atk%', value: 0.18 }` |
| EM +80 | `{ key: 'em', value: 80 }` |
| ER +20% | `{ key: 'er', value: 0.20 }` |
| Elemental% +15% | `{ key: '<element>%', value: 0.15 }` |
| Physical% +25% | `{ key: 'phys%', value: 0.25 }` |
| Burst DMG +20% | `{ key: 'dmg%', value: 0.20 }` with `filter: { abilities: ['burst'] }` |

For full annotated examples, see [DmgDesign.md §5.3](./DmgDesign.md#53-extension-examples).
