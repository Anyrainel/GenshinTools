# Task: Incremental Weapon & Artifact Implementation

## Objective

This document outlines the workflow and requirements for implementing or updating weapons and artifact sets in the Engine. Whenever new weapons or artifacts are released, follow this guide to incrementally integrate their passive effects and set bonuses based on the official game data.

For the overall system architecture, type definitions, buff classes, stat key mapping, and pipeline details, you **must** refer to **[DmgDesign.md](./DmgDesign.md)**.

## 1. Incremental Workflow

When a game update introduces new equipment, follow this sequence:

### Step 1: Update Game Data
1. Scrape the new weapon and artifact data into the respective data files if applicable, ensuring `src/data/constants.ts` and `src/data/resources.ts` are updated.
2. The i18n descriptions for new weapons and artifacts should be available in `src/data/i18n-game.ts` (`i18nGameData.weapons`, `i18nGameData.artifacts`, `i18nGameData.artifactHalfSets`).

### Step 2: Implement Equipment
1. **For Weapons:** Add the new classes to `src/lib/team-comp/impl/weapon*.ts` (the files are split by Rarity and WeaponType, e.g. `weapon5Claymore.ts`. However, 3* weapons are all in `weapon3.ts` not splitted.)
2. **For Artifacts:** Add the new classes to `src/lib/team-comp/impl/artifact2.ts` (2pc bonuses) and `src/lib/team-comp/impl/artifact4.ts` (4pc bonuses).
3. Run `npm run type-check:headtail` to ensure no errors were introduced.

### Step 3: Document Blockers
If you hit a blocker (e.g., an effect that doesn't fit existing buff abstractions, or is ambiguous), document it in `docs/DmgTODO.md`, explaining *what* is blocked and *why*.

---

## 2. Weapon Implementation Guidelines

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

### Weapon-Specific Stat Keys

| Buff Description | Correct Stat Key | BuffTarget filter | Example |
|------------------|-------------------|-------------------|---------|
| "increases Normal/Charged... DMG by X%" | `'dmg%'` | `filter: { abilities: ['normal'] }` | conditional DMG% |
| "all DMG dealt increased by X%" | `'dmg%'` | (none — universal) | Skyward Pride |
| "increases all Elemental DMG by X%" | Use `allElementalDmg(value)` helper | (none) | Kagura's Verity |
| "increases wielder's elemental DMG by X%" | Use `elementDmgKey(element)` helper | (none) | Jadefall's Splendor |
| "X% of EM as additive flat DMG" | `'baseDmg'` | `filter: { abilities: ['normal'] }` | Hunter's Path |
| "increases Bloom DMG by X%" | `'reactionDmg%'`| `filter: { reactions: ['bloom'] }` | Blackmarrow |

### Proc-Only Weapons

Weapons whose passive is purely proc damage, CD reset, energy restore, or HP restore still need a class so they're in the registry (the base class picks up base stats). Use empty buffs:

```typescript
@RegisterWeapon('favonius_sword')
class FavoniusSword extends WeaponBase {
  readonly buffs = [];
}
```

---

## 3. Artifact Implementation Guidelines

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
- For **enemy debuffs** (e.g., Viridescent 4pc RES reduction), model as a `resReduction%` stat buff with `receiver: 'onField'` — the DPS receives the benefit since the formula reads `resReduction%` from the active character's stat sheet.

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
| DMG +20% | `{ key: 'dmg%', value: 0.20 }` with `filter: { abilities: ['burst'] }` |

For full annotated examples, see [DmgDesign.md §5.3](./DmgDesign.md#53-extension-examples).
