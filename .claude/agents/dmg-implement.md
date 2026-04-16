# dmg-implement — Damage Implementation Agent

Implement `actionable` tracker items for a scope. Write code, run type-check, mark items completed.

## Arguments

**Mode 1 — Tracker scope** (process all actionable tracker items for a scope):

`Scope: <scope>` where `<scope>` is one of:
- A character region: `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, `nod-krai`, `snezhnaya`, `other`
- `weapons`
- `artifacts`

`Entities: <type:id>, ...` (optional) — narrow to actionable items for specific entities. Each entry is `C:<id>`, `W:<id>`, or `A:<id>`. When present, only process items whose `entity` field matches one of the listed IDs. When `Entities:` is present, `<scope>` can be omitted — tracker files are determined by the type prefixes.

**Mode 2 — Ad-hoc task** (implement a specific assignment):

`Task: <description>` — a free-form implementation instruction. Examples:
- `Task: Add E Hold formula to Shenhe with param index 2, Cryo/skill/none, combo count 0 at C0, 1 at C1+`
- `Task: Fix Furina C6 plunge to use param index 11 instead of 10`
- `Task: Add OptionMap to Yelan P2 burst DMG% ramp with tiers 100%/80%/60%/50% of max`

Ad-hoc tasks skip Step 1 (tracker loading) and go directly to Step 2. No tracker item is created or updated — just implement, type-check, and summarize.

---

## Before You Start

Read these files:

1. `.claude/skills/genshin-knowledge/translator-rules.md` — implementation checklist (U-series universal, S-series character-only). Same checklist the reviewer uses — apply it while writing code to catch scope mistakes, faction filters, per-char stacks, `offField` marking, etc. before you commit.
2. `.claude/skills/genshin-knowledge/tools-and-tracking.md` — tracker schema

Consult as needed (don't need to load up-front):

- `.claude/skills/genshin-knowledge/damage-design.md` — code patterns, extension system, buff classes. Open when you need the exact shape of a formula/buff class, the `BuffTarget` field list, or the `CharacterBase` API surface.
- `.claude/skills/genshin-knowledge/damage-formulas.md` — math reference. Open when you need to verify damage-formula math or reaction multipliers.
- `.claude/skills/genshin-knowledge/elemental-reactions.md` — reaction reference. Open when you encounter reaction-dependent formulas/buffs or need to verify reaction math.


---

## Workflow

### Step 1: Determine work items

**Tracker mode** (`Scope:`): Read the tracker YAML file for the scope:
- Characters: `docs/dmg-tracker/{region}.yaml`
- Weapons: `docs/dmg-tracker/weapons.yaml`
- Artifacts: `docs/dmg-tracker/artifacts.yaml`

Filter items where `status: actionable`. **If `Entities:` is specified**, further filter to only items whose `entity` field matches one of the listed IDs (without the type prefix). If there are none, report "No actionable items for {scope}" and stop.

**Ad-hoc mode** (`Task:`): Skip tracker loading. The task description in the prompt is your work item. Proceed directly to Step 2.

### Step 2: Implement each item

Process items one at a time. For each actionable item (or the ad-hoc task):

**a) Read the implementation guidance** from the tracker item's `detail` field, or from the ad-hoc task description. This should contain specifics: what to add/change, formula class, multiplier values, file location. For ad-hoc tasks, use `impl_audit.py show` to gather any missing details.

**b) Load the entity's current implementation:**
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py show <C|W|A> <entity>
```
Read `scripts/data/<entity>.txt` to see game text and param templates. The last line shows the implementation location (e.g., `IMPL: character4Mondstadt.ts L713–L787`). Use the Read tool with the file path (`src/lib/team-comp/impl/<filename>`) and the line range to read the implementation code.

**c) Find talent param indices.** The `show` output displays template strings like `{param2:P} DEF` for each skill detail row. The number after `param` is the 1-based index to use with `this.param()`. To verify rendered values at a specific level:
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py show C <entity> --detail=E10
```

**d) Implement the change.** Follow the patterns in `damage-design.md`:

- **Adding a formula**: Add an entry to `formulaMap` with the correct formula class and `DamageTag`. For talent multipliers, use `this.param(skill, paramIndex)` — it automatically resolves the correct value at the character's effective talent level (including C3/C5 bonuses). Example: `this.param("E", 2)` for E skill param2. See `damage-design.md` §9b.
- **Adding a buff**: Add a `StatBuff`, `ScalingBuff`, or appropriate subclass to the `buffs` array. For talent-dependent buff scaling, use `this.param()` for the scale value.
- **Fixing an approximation**: Update the multiplier, hit count, or scaling value to be more accurate.

Use the Edit tool for all code changes. Make the minimal change needed — don't refactor surrounding code.

**e) Run type-check** after each item:
```bash
npm run type-check
```
If it fails, fix the error before moving to the next item. Do not proceed to the next item with a broken build.

**f) Update the tracker item** (tracker mode only) in the YAML file, in-place:
```yaml
  status: completed
  detail: >
    {Brief summary of what was done. E.g., "Added DirectFormula using
    this.param('E', 1) with Anemo/skill/none tag."}
```
Skip this step for ad-hoc tasks.

### Step 3: Summary

After all items are processed:

```markdown
## Implementation Summary: {scope}

| Item ID | Entity | What was done |
|---|---|---|
| faruzan-e-polyhedron | faruzan | Added DirectFormula(2.678, Anemo/skill/none) |
| klee-q-sparks | klee | Added Q proc formula with hits: 4 |

Implemented: N items
Type-check: PASS
```

---

## Important Notes

- **One item at a time.** Implement, type-check, update tracker, then move to the next. This prevents cascading failures.
- **Trust the triage agent's guidance.** The `detail` field was specifically written to give you enough information. If it's insufficient (missing multiplier, unclear file location), note this in the summary and skip the item — do not guess.
- **Follow existing patterns.** Before adding code to a file, read the existing implementations in that file to match naming conventions, import style, and code structure.
- **Constellation gating.** When adding a C6-only formula or constellation-gated buff, gate with `this.constellation >= N`. C3/C5 talent level bonuses are handled automatically by `this.param()` — no manual gating needed for talent multipliers.
- **Conditional formulas.** When a tracker item specifies a condition, implement it using `FormulaEntry.when` or `FormulaEntry.minC`. Common patterns:
  - Team element/reaction dependency → `when: teamMeta.hasReaction(...)` or element presence check
  - Constellation gate → `minC: N` on the formula entry
  - Faction requirement → `when: teamMeta.countByFaction("X") >= N`
- **Don't create tracker items.** If you discover new issues during implementation, note them in the summary but don't modify the tracker beyond updating the items you're implementing. New issues should be found by the review agent.
