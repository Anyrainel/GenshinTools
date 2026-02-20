# Task: Incremental Character Kit Implementation

## Objective

This document outlines the workflow and requirements for implementing or updating character kits in the Engine. Whenever new characters are released or existing ones receive updates, follow this guide to incrementally integrate their buffs and damage formulas based on their official talent/passive/constellation data.

The goal is to calculate the max damage of a certain character skill under a certain team composition (with buffs from teammates). Rotation-based DPS or total damage is not in scope. This allows us to simplify complex combat constraints (cooldown, stacks, range, sequence, etc.).

## 1. Incremental Workflow

When a game update introduces new characters, follow this sequence:

### Step 1: Update Game Data
1. Scrape the new character JSON data into `src/data/character_en.json` and `character_zh.json`.
2. Run `uv run scripts/gen_char_info.py` to regenerate `src/data/charInfo.ts`.
   > **⚠️ Verify Heuristics**: After running this script, check `charInfo.ts` for the new characters. The script relies on heuristics that may fail with new text formatting:
   > - Verify that `energy` is correctly parsed.
   > - Verify that `c3Talent` and `c5Talent` correctly identify which talents get the +3 level boost (usually "E" or "Q", or "A" for normal attack).
   > - **Crucial**: Update the hardcoded `explicit_healers` and `explicit_shielders` dictionaries *inside* `gen_char_info.py` to map the new character's ID to their required constellation for healing/shielding (e.g. `0` for C0, `1` for C1) if they possess those capabilities. Run the script again if you updated it so `charInfo.ts` reflects the manual changes.

### Step 2: Sync Review Tracker
1. Run `uv run scripts/char_review.py init`. This initializes or updates the local `.char_review_status.json` tracker, automatically appending the new characters as `PENDING` without erasing your existing `DONE`/`REVIEW` states.

### Step 3: Implement Characters
1. Run `uv run scripts/char_review.py next`
2. Read `scripts/.char_review_output.txt` (contains EN/ZH kit + existing impl line# if any).
3. Implement or update the character in `src/lib/team-comp/impl/character*.ts`. (The files are split by rarity and region, e.g. character5Natlan.ts)
4. Run `npm run type-check:headtail` to ensure no errors were introduced.
5. Mark the character as `DONE` or `REVIEW`:
   - `uv run scripts/char_review.py mark <id> DONE`
   - `uv run scripts/char_review.py mark <id> REVIEW`
6. Repeat from step 1 until all pending characters are processed.

### When to mark DONE vs REVIEW

**`DONE`** means: the implementation is complete and correct. You verified every buff and formula against the scraped data. If you spotted a problem (wrong values, missing CombatOpts, hardcoded assumption), you fixed it before marking DONE. 

**`REVIEW`** means: you hit a blocker you cannot resolve (e.g., missing data, ambiguous game mechanics, need for a new buff abstraction). When marking REVIEW, add a concrete note to `docs/DmgTODO.md` explaining *what* is blocked and *why*.

---

## 2. Implementation Guidelines

Each character extends `CharacterBase` (from `damageModels.ts`) and registers with the system via `@RegisterCharacter`.

For the overall system architecture, type definitions, buff classes, formula classes, and stat key mapping, you **must** refer to **[DmgDesign.md](./DmgDesign.md)**.

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
However, if the effect doesn't mention the standard ability type, use the specific ability name (e.g. ability: `"special"`) to prevent unintended scaling.

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

### Character-Sourced Stat Keys

Mapping a buff to the wrong stat key places it in the wrong multiplier zone.
1. **Don't confuse `'reactionDmg%'` with `'baseDmg%'`**. `reactionDmg%` is Transformative/Amplify Reaction DMG Bonus. `baseDmg%` is usually for additive flat damage (like Shenhe) or Lunar damage reaction scaling.
2. **Reaction CRIT (`reactionCr`/`reactionCd`) is separate from character CRIT (`cr`/`cd`)**. Buffs like Nahida C2 grant CR/CD *to the reaction*. Write to `'reactionCr'` with `filter: { reactions: ['bloom'] }`.
3. **Elevation (`elevated%`) is separate from DMG Bonus**. For Nod-Krai characters elevating Lunar reactions.

### Dual-Stat Scaling

For dual-scaling (e.g. ATK + EM), use the optional `extraTerm` parameter on any formula class:
```typescript
// Nahida Tri-Karma: ATK + EM scaling
new DirectFormula(1.859, tag, "atk", { key: "em", multiplier: 3.717 })
```

### ⚠️ No selfStats at Construction Time

`formulaMap` and `buffs` are evaluated at **construction time**. You cannot read the character's resolved stats (e.g. total ATK) when defining formulas. For stat-dependent buffs or formulas, use `ScalingBuff` instead.

## 3. Which Formulas to Implement

- **On-field DPS**: Focus on main damage sources (charged ATK, infused normals, burst hits).
- **Off-field sub-DPS**: Focus on off-field damage loops (skill ticks, periodic hits).
- **Support/Buffer**: Focus on their primary damage source if any, plus buff effects.

- Compute the **total** damage of an ability tick instead of individual sub-hits if they share the exact same damage tag and formula (use `hits: 3`).
- **Skip** normal attacks for characters who never use them, and **skip** utility talents (healing, shields).
- Include both direct and typical reaction formulas (e.g. Vaporize version) for prominent damage sources to make testing seamless in the UI, conditionally gating them behind `this.teamMeta.hasReaction('...')` if needed.
