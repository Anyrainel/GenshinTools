# dmg-review — Damage Implementation Review Agent

Audit all damage implementations within a scope. Create tracker items for issues found. **This agent does not modify implementation code.**

## Arguments

`<scope>` — one of:
- `C <region>` — all characters from a region: `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, `nod-krai`, `snezhnaya`, `other`
- `W <type>` — all weapons of a type: `bow`, `catalyst`, `claymore`, `polearm`, `sword`
- `A` — all artifact sets

`Entities: <type:id>, ...` (optional) — review specific entities instead of a full scope. Each entry is `C:<id>`, `W:<id>`, or `A:<id>`. Examples:
- `Entities: C:linnea` — one character
- `Entities: C:linnea, W:golden_frostbound_oath` — mixed types in one agent
- `Entities: W:staff_of_homa, W:primordial_jade_winged_spear` — multiple weapons

When `Entities:` is specified, skip the `list` enumeration (Step 1) and use these IDs directly. The type prefix determines the `impl_audit.py` type argument (`C`/`W`/`A`) and the tracker file:
- `C:id` → tracker file from `impl_audit.py show C <id>` output (region in stats JSON)
- `W:id` → `docs/dmg-tracker/weapons.yaml`
- `A:id` → `docs/dmg-tracker/artifacts.yaml`

For characters, determine the tracker file by running `impl_audit.py show C <id>` and reading the region from the output, then use `docs/dmg-tracker/{region}.yaml`.

When `Entities:` is present, `<scope>` can be omitted.

---

## Before You Start

Read these files (you need all of them throughout the review):

1. `.claude/skills/genshin-knowledge/translator-rules.md` — the review checklist (U-series universal, S-series character-only)
2. `.claude/skills/genshin-knowledge/elemental-reactions.md` — reaction reference
3. `.claude/skills/genshin-knowledge/tools-and-tracking.md` — tracker YAML schema and state machine


---

## Workflow

### Step 1: Enumerate entities in scope

**If `Entities:` is specified:** Use those IDs directly — skip the `list` command. For each entity, use the type prefix to determine `impl_audit.py` arguments and tracker file (see Arguments section).

**Otherwise:** Run:
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py list <C|W|A>
```

Parse the output to extract entity IDs matching the scope:
- **Characters**: Collect all IDs from `== {rarity} {Region} ==` header lines where the region matches the scope argument. Collect from **both** 4★ and 5★ sections. For scope `other`, collect from `== 5★ None ==`.
- **Weapons**: Collect all IDs from `== {rarity} {Type} ==` header lines where the weapon type matches. Collect from **all** rarity sections (3★, 4★, 5★).
- **Artifacts**: Collect all IDs from **both** `== Half Sets ==` and `== Full Sets ==`.

### Step 2: Load the tracker file

Read the tracker YAML file for this scope to know what's already tracked:
- Characters: `docs/dmg-tracker/{region}.yaml`
- Weapons: `docs/dmg-tracker/weapons.yaml`
- Artifacts: `docs/dmg-tracker/artifacts.yaml`

Build a set of existing item `id`s so you don't create duplicates.

### Step 3: Review each entity

For each entity ID in the scope:

**a) Load entity data:**
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py show <C|W|A> <id>
```
Read the output file `scripts/data/<id>.txt`. This contains game text (i18n) and param templates. The last line shows the implementation location (e.g., `IMPL: character4Mondstadt.ts L713–L787`). Use the Read tool with the file path (`src/lib/team-comp/impl/<filename>`) and the line range to read the implementation code.

**b) Skip if no implementation.** Note the entity in the final summary as "not implemented" and move on.

**c) Determine rule scope:**
- Characters (`C`): apply all rules — Universal (U-series) and Character-only (S-series).
- Weapons (`W`) and Artifacts (`A`): apply Universal rules only (U-series).

**d) Review each buff and formula against applicable rules.** Classify each item but **only record issues** — do not write down items that pass:

- **[BUG]** — violates a rule and the fix is **mechanically determined**: a rule's table or definition maps the game text to exactly one correct value, with no interpretive judgment required. Create a tracker item with category `bug` so it can be fixed later.

- **Already tracked** — the issue matches an existing tracker item (by entity + summary). Skip it.

- **[ISSUE]** — the issue falls under the "When to Create a Tracker Item" appendix in `translator-rules.md`, or a rule is violated but the correct fix requires judgment (multiple plausible interpretations, unclear game text, or the fix depends on context not available in the `show` output). Create a tracker item.

- **Correct** — no action needed. Do NOT write [OK] rows — move on silently. Only count the item for the per-entity tally.

**e) Validate resolved tracker items.** For each `wont-do` or `completed` item belonging to this entity, check the current implementation against the item's `summary`:

- **Fix confirmed** — the issue described in `summary` no longer exists in the implementation (formula added, bug fixed, approximation corrected). **Delete the item from the YAML.** Record as `[CLEANED]` in the entity summary.
- **Fix incorrect or incomplete** — the item is marked `completed` but the implementation still has the problem described in `summary`, or the fix introduced a new issue. **Change status back to `open`**, clear the `resolved` date, and update `detail` explaining what's still wrong. Record as `[REOPENED]` in the entity summary.
- **Wont-do still valid** — the `wont-do` rationale still holds and the issue hasn't changed. Leave as-is (don't include in the entity summary).

Every `completed` item MUST be either cleaned or reopened — never left as `completed`.

**f) Skip silently** any utility/defense-only buff per U9 (shield strength, damage reduction, energy). Don't include these in the summary table.

**g) Coverage check.** Compare the entity's full game text (from the `show` output) against the implementation. For each passive, constellation, and weapon/artifact effect described in the game text:

- **Missing buff**: If a combat-relevant stat buff or debuff described in the game text has no corresponding buff in the implementation, flag it. Missing buffs cause incorrect damage calculations for any formula they would apply to — they are almost never intentionally omitted (except U9 utility effects).
- **Missing formula**: A missing damage formula is acceptable when the ability isn't part of the character's intended playstyle. However, if the character's own kit contains buffs that specifically target an ability type (e.g., "Plunge Attack DMG +30%", "Normal Attack DMG increased by X% of DEF"), a formula for that ability should exist — the kit is signaling that this damage source is intended to be meaningful. Flag missing formulas only when the kit's buffs indicate the ability matters.

### Step 4: Create tracker items

For each new issue found, append to the tracker YAML file:

```yaml
- id: "{entity}-{brief-desc}"
  entity: "{entity}"
  rule: "{rule-id}"
  status: open
  category: "{category}"
  summary: "{1-2 sentence description of the issue}"
  detail: ""
  created: "{YYYY-MM-DD}"
  resolved: null
```

Choose `category` from: `bug`, `missing-formula`, `approximation`, `engine-gap`, `needs-data`.

The `id` must be unique within the file. Check the existing items before choosing.

### Step 5: Summary

**Issues-only format** — do not list items that passed review. This keeps the summary compact and focused on actionable findings.

For entities with **zero issues and zero cleaned/reopened items**, output a single line:

```markdown
**{entity_id}** — clean ({N} buffs, {M} formulas checked)
```

For entities with issues or tracker changes, output:

```markdown
## {entity_id}

- [BUG] E passive buff (U1): receiver should be "selfOnField". Tracker: {entity}-e-receiver
- [ISSUE] C2 proc (S8): unclear hit count for coordinated attack. Tracker: {entity}-c2-proc
- [CLEANED] C6 coordinated: wont-do item removed — formula was since implemented
- [REOPENED] Q formula: marked completed but multiplier still hardcoded

Checked: {N} buffs, {M} formulas. Issues: {K}
```

At the end, output a scope summary:

```markdown
## Scope Summary: {scope}

- Entities reviewed: N
- Entities clean: N
- Entities with issues: N (list IDs)
- Entities skipped (no implementation): N (list IDs)
- New tracker items created: N
- Stale tracker items cleaned: N
```

---

## Important Notes

- **Do not modify implementation files.** All issues become tracker items.
- Do not create new tracker items for issues that already have an `open` or `actionable` item in the tracker. For `completed` and `wont-do` items, follow step 3e (validate and clean/reopen as needed).
- For characters, check S8 (Formula Coverage) for when to flag missing formulas. Missing significant formulas should become tracker items with category `missing-formula`.
- For S5 (talent-level-dependent values): all talent-level-dependent values must use `this.param(skill, paramIndex)` — both formula multipliers AND buff stat values. The `show` output displays template strings like `{param2:P}` — the number is the 1-based param index. Use `--detail=<XN>` to verify rendered values at a specific level. When reviewing each buff, cross-reference its hardcoded values against the game text description — if the description uses a `{paramN}` template for that value, it must use `this.param()` instead of a hardcoded number. Values from passives (P1–P4) and constellations (C1–C6) are fixed and should remain hardcoded.
