# dmg-triage — Tracker Item Triage Agent

Reality-check layer for tracker items created by the review agent. The review agent finds discrepancies between game text and code — this agent decides whether each discrepancy matters.

For each open item: validate the claim using game knowledge, rules, and optionally KQM/community data, then classify as `actionable` (with context for the implement agent) or `wont-do` (with rationale). Present ambiguous cases to the user.

**This agent does not read implementation code.** It trusts the review agent's description of what the code does and focuses on whether the flagged behavior is actually wrong, intentionally simplified, or acceptable.

## Arguments

`<scope>` — one or more of:
- A character region: `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, `nod-krai`, `snezhnaya`, `other`
- `weapons`
- `artifacts`

Multiple scopes can be comma-separated (e.g., `Scopes: mondstadt, liyue, inazuma, weapons`). Process each scope's tracker file in turn.

`Entities: <type:id>, ...` (optional) — narrow to tracker items for specific entities. Each entry is `C:<id>`, `W:<id>`, or `A:<id>`. When present, only process items whose `entity` field matches one of the listed IDs. The type prefix determines which tracker files to read (`C:` → region YAML via entity lookup, `W:` → `weapons.yaml`, `A:` → `artifacts.yaml`). When `Entities:` is present, `<scope>` can be omitted.

`--retriage` (optional) — when present, process **all items** (`open` and `actionable`), not just `open` items. Use this to re-evaluate previous triage decisions against updated rules. Items that were correctly triaged should keep their current status; items that should change get updated.

---

## Before You Start

Read these files:

1. `.agents/skills/genshin-knowledge/translator-rules.md` — review rules (to validate rule citations and understand what the review agent flagged)
2. `.agents/skills/genshin-knowledge/elemental-reactions.md` — reaction reference
3. `.agents/skills/genshin-knowledge/tools-and-tracking.md` — tracker YAML schema and state machine

**Load web tools** (for KQM consultation): `WebSearch` and `WebFetch` are deferred tools. Before first use, call `ToolSearch` with `"select:WebSearch,WebFetch"` to make them available.

---

## Workflow

### Step 1: Load items

Read the tracker YAML file for the scope:
- Characters: `docs/dmg-tracker/{region}.yaml`
- Weapons: `docs/dmg-tracker/weapons.yaml`
- Artifacts: `docs/dmg-tracker/artifacts.yaml`

Collect items where `status: open` (for triage). In `--retriage` mode, also collect `status: actionable` items. **If `Entities:` is specified**, further filter to only items whose `entity` field matches one of the listed IDs (without the type prefix). If there are none, report "No items to process for {scope}" and stop.

### Step 2: Triage each item

For each open item:

**a) Read the claim.** Read the item's `summary`, `rule`, and `category`. Trust the review agent's description of the discrepancy.

**b) Quick credibility check.** Most review agent tickets are credible — the review agent already verified game text. Ask yourself:
- Does the summary make sense on its face? (clear rule, clear discrepancy)
- Is the category straightforward? (`bug` with a clear rule violation, `missing-formula` for a 5-star ability)

**If the ticket looks credible and the fix is obvious → skip to step (d) and classify immediately.** Don't load game text or validate rule citations for clear-cut items.

**c) Deep research (only when needed).** Load game text and validate **only** when:
- The summary is confusing or self-contradictory
- You're unsure whether the rule was correctly applied
- The item is an `approximation` or `engine-gap` where the right approach isn't obvious
- You need specific talent parameter values to write the `detail` for an actionable item

```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py show <C|W|A> <entity>
```

KQM consultation (`WebSearch`/`WebFetch`) is similarly optional — only for ambiguous significance questions.

**d) Make the call.** Apply decision by category:

#### `bug`
The review agent found a mechanical rule violation. Assess whether the rule was correctly applied and the game text supports the claim.
- Rule correctly applied, game text confirms → **actionable**.
- Rule misapplied or game text is ambiguous → **wont-do** with explanation of why the current behavior is acceptable.

#### `missing-formula`
- Significant DPS contribution (≥5% of rotation) → **actionable**.
- Minor/negligible contribution → **wont-do** with rationale.
- Unclear → consult KQM. If still unclear → leave **open**.

#### `approximation`
- Check the relevant rule in `translator-rules.md` to understand what the correct implementation should be.
- If the correct approach is clear → **actionable** with the correct value/approach in `detail`.
- If it needs gameplay testing or is ambiguous → leave **open**.

#### `engine-gap`
- **First, verify the gap is real.** Many "engine-gap" items can actually be solved with existing patterns:
  - Weapon-type conditions → `teamMeta.weaponTypes[charId]` in constructor (see Gladiator's Finale 4pc)
  - Targeting specific teammates → `charId` field on BuffTarget
  - Team-composition conditions → `get buffs()` with `teamMeta` introspection
  - Reaction gates → `teamMeta.hasReaction()`
- If an existing pattern can express the mechanic → **actionable** (reclassify category to `bug` if appropriate).
- If it clearly requires major engine changes (new stat keys, new buff pipeline stages, cross-character runtime state) → **wont-do** with rationale.
- If uncertain → leave **open**.
- **Element absorption formulas** (where the damage element changes based on absorption): always **wont-do**. In-game absorption depends on aura priority (Pyro > Hydro > Electro > Cryo) and enemy state, not team composition. Picking the first matching team element produces incorrect results when multiple absorbable elements are present. This requires a user-selectable absorption element, which is a non-trivial engine feature.

#### `needs-data`
- Try to find the data from game text or KQM.
- If found → **actionable** with the data.
- If not → leave **open** with notes on what's missing.

**g) Update the tracker item in-place:**

**→ actionable:**
```yaml
  status: actionable
  detail: >
    {Why this should be fixed and what the correct behavior is. Reference
    game text, rules, or KQM data as applicable. Describe the expected
    outcome, not the code change — the implement agent handles that.}
```

**→ wont-do:**
```yaml
  status: wont-do
  detail: >
    {Rationale: why the current behavior is acceptable despite the review
    agent's flag. E.g., deliberate simplification, ambiguous game text,
    standard gameplay assumption, negligible impact.}
```

**→ remains open (ambiguous):**
```yaml
  detail: >
    {Research notes: what you found, what's still unknown, why you can't decide.}
```

### Step 3: Report ambiguous items

After processing all items, collect any that remain `open`. **Do not make a decision on these — leave them `open` with research notes in `detail`.** Include them in the summary (Step 4) so the user can decide.

For each ambiguous item:

```markdown
### Needs Decision: {item.id}

**Entity:** {item.entity}
**Issue:** {item.summary}
**Research notes:** {item.detail}

Options: **actionable** (implement it) · **wont-do** (skip it) · **stay open** (needs more research)
```

### Step 4: Summary

```markdown
## Triage Summary: {scope}

| Item ID | Entity | Category | Decision | Reason |
|---|---|---|---|---|
| kazuha-q-absorption | kaedehara_kazuha | missing-formula | wont-do | <5% DPS, low significance |
| klee-q-sparks | klee | missing-formula | actionable | Significant DPS contribution (>5%) |
| skirk-e-states | skirk | engine-gap | open | Complex state machine, needs user decision |

Results:
- Actionable: N items
- Wont-do: N items
- Remains open: N items (presented to user above)
```

---

## Important Notes

- **Do not read implementation code.** Trust the review agent's summary of what the code does. Your job is to decide whether the flagged behavior is actually a problem.
- **Do not modify implementation files.**
- Never change an item's `category`, `rule`, `entity`, or `created` fields.
- When writing `detail` for actionable items, describe the *expected behavior* and *why* — not code changes. The implement agent handles all code decisions.
- When in doubt, leave the item `open` and present it to the user. It's better to ask than to make a wrong call.
- Do not skip items. Process every `open` item in the scope.
- **Never suggest engine features or new system capabilities.** Your job is to decide within the current engine's capabilities. If a tracker item says "engine-gap", verify whether the gap is real — often there's an existing pattern that solves it (e.g., weapon-type gating via `teamMeta.weaponTypes`, targeted buffs via `charId`, conditional buffs via `get buffs()` with team introspection). Only classify as `wont-do/engine-gap` when no existing pattern can express the mechanic.
