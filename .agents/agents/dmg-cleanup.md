# dmg-cleanup — Formula Code Cleanup Agent

Find and fix two code quality issues in damage implementations:
1. **Hardcoded multipliers** — formula multipliers that should use `this.param()` instead of hardcoded numbers
2. **Unnecessary local variables** — `const foo = this.param("X", N)` variables that are only used once or twice and should be inlined

This agent **reads game data and modifies implementation code directly**.

## Arguments

`<scope>` — one of:
- `C <region>` — all characters from a region: `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, `nod-krai`, `snezhnaya`, `other`
- `W <type>` — all weapons of a type: `bow`, `catalyst`, `claymore`, `polearm`, `sword`
- `A` — all artifact sets

`Entities: <type:id>, ...` (optional) — process specific entities instead of a full scope. Each entry is `C:<id>`, `W:<id>`, or `A:<id>`. When present, skip full enumeration and only process the listed entities. When `Entities:` is present, `<scope>` can be omitted.

---

## Before You Start

Read this file for context on how `this.param()` works:
- `.agents/skills/genshin-knowledge/damage-design.md` — §9b covers the param accessor

---

## Workflow

### Step 1: Enumerate entities in scope

**If `Entities:` is specified:** Use those IDs directly — skip the `list` command. Use the type prefix (`C`/`W`/`A`) for `impl_audit.py` arguments.

**Otherwise:** Run:
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py list <C|W|A>
```

Parse the output to extract entity IDs matching the scope (same as dmg-review).

### Step 2: Review each entity

For each entity ID:

**a) Load entity data (Chinese-only to save tokens):**
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py showzh <C|W|A> <id>
```
Read the output file `scripts/data/<id>.txt`. This contains game text (ZH) and param templates. The last line shows the implementation location (e.g., `IMPL: character4Mondstadt.ts L713–L787`). Use the Read tool with the file path (`src/lib/team-comp/impl/<filename>`) and the line range to read the implementation code.

**b) Skip if no implementation.** Note it in the final summary and move on.

**c) Check for hardcoded multipliers.**

Look at every `new DirectFormula(...)`, `new AmplifyFormula(...)`, `new CatalyzeFormula(...)`, etc. The first argument is the talent multiplier. It should be `this.param("X", N)` — not a hardcoded number.

How to detect: if the first argument to a formula constructor is a numeric literal (e.g., `0.904`, `1.238`, `5.52`) or a local variable assigned to a numeric literal, it's hardcoded.

How to verify: cross-reference against the `showzh` output. The detail rows show template strings like `{param16:P}`. The number after `param` is the 1-based index. If the formula's multiplier corresponds to a talent detail row that uses `{paramN:...}`, it must use `this.param("X", N)`.

**Exception — values that SHOULD be hardcoded:**
- Passive (P1–P4) and constellation (C1–C6) values — these are fixed, not talent-level-dependent
- Hit counts, energy costs, durations
- Buff stat values from passives/constellations (e.g., `{ key: "dmg%", value: 0.3 }` from P1)

Only flag multipliers inside `formulaMap` formula constructors, and buff `scale` values in `ScalingBuff` that reference talent params.

**d) Check for unnecessary local variables.**

Look at the `formulaMap` IIFE for patterns like:
```typescript
const kickMult = this.param("Q", 1);
// ... later used once:
formula: new DirectFormula(kickMult, ...)
```

If a `this.param()` local is used **only once**, inline it directly. If used **twice** in identical formulas (e.g., same multiplier in on-field and off-field variants), a local is justified — keep it.

Also look for `DamageTag` objects stored in locals that are used only once — inline those too. Locals for tags used 2+ times are fine.

### Step 3: Apply fixes

For each entity with issues, edit the implementation file directly:

1. **Hardcoded multipliers**: Replace `new DirectFormula(0.904, ...)` with `new DirectFormula(this.param("A", 1), ...)`.

2. **Unnecessary locals**: Inline `this.param()` calls and remove the `const` declaration. Example:
   ```typescript
   // Before:
   const kickMult = this.param("Q", 1);
   ...
   formula: new DirectFormula(kickMult, { element: "Electro", ability: "burst", reaction: "none" })

   // After:
   formula: new DirectFormula(this.param("Q", 1), { element: "Electro", ability: "burst", reaction: "none" })
   ```

3. **Unnecessary tag locals**: Inline tag objects used only once. Example:
   ```typescript
   // Before:
   const electroSkill = { element: "Electro" as const, ability: "skill" as const, reaction: "none" as const };
   ...
   parts: [{ formula: new DirectFormula(this.param("E", 1), electroSkill) }],

   // After:
   parts: [{ formula: new DirectFormula(this.param("E", 1), { element: "Electro", ability: "skill", reaction: "none" }) }],
   ```

### Step 4: Verify

After editing all entities in the scope, run:
```bash
npm run type-check:filter -- "<impl-filename>"
```
for each modified file. Fix any type errors introduced.

### Step 5: Summary

Output a summary:

```markdown
## Scope Summary: {scope}

- Entities reviewed: N
- Entities with hardcoded multipliers fixed: N (list IDs)
- Entities with locals inlined: N (list IDs)
- Entities skipped (no implementation): N
```

---

## Important Notes

- **This agent modifies code.** Unlike dmg-review, it directly edits implementation files.
- Do NOT touch buff values from passives/constellations — those are intentionally hardcoded.
- When inlining, preserve all existing functionality. Do not change formula logic, only code style.
- If a local variable is used 2+ times, keep it. Only inline single-use locals.
- Clean up the `scripts/data/<id>.txt` files after you're done with each entity.
