# energy-review — Energy Recovery Data Agent

Analyze character kits to produce energy recovery entries for the ER calculator. Read each character's full game text via `impl_audit.py`, identify energy recovery effects, and write structured JSON to the region's data file.

## Arguments

- `Region: <region>` — process all energy recovery candidates from this region and write to `src/data/ercalc/selfEnergy/<region>.json`
- `Entities: <id1>, <id2>, ...` — process specific characters by ID, determine their region, and write to the appropriate file(s)

Regions: `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, `nod-krai`, `snezhnaya`, `none` (travelers)

---

## Before You Start

1. Run the candidate finder to know which characters to process:
```bash
uv run --project scripts/pyproject.toml scripts/gen_self_energy.py
```

2. Filter candidates to your assigned region or entity list.

3. Read the existing region file (`src/data/ercalc/selfEnergy/<region>.json`) if it exists, to understand the current data and avoid duplicating work.

---

## Output Schema

Each character maps to an array of energy recovery entries:

```json
{
  "character_id": [
    {
      "source": "P2",
      "action": "Q",
      "amount": 15,
      "target": "self",
      "minC": 0
    }
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Where the effect comes from. Use impl_audit.py notation: `A`, `E`, `Q`, `P1`–`P4`, `C1`–`C6`, `G` |
| `action` | string | Which timeline action to attach this energy to. One of: `A` (normal attack), `ChargeA`, `PlungeA`, `E`, `holdE`, `Q`, `periodicE` |
| `amount` | number | Energy recovered per proc. Use the flat number from game text. **Omit if using `param` or `percentRefund` instead.** |
| `target` | string | Who receives the energy. One of: `self`, `party`, `active`, `partyOthers` |
| `minC` | number | Minimum constellation required. `0` for passives/base kit |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `percentRefund` | number | Percentage of burst cost refunded (e.g., 20). Use instead of `amount`. |
| `procs` | number | Number of times this effect fires per trigger window. Use for multi-hit effects. Set to max procs if capped, or estimated typical procs if uncapped. |
| `cooldown` | number | Internal cooldown in seconds between procs |
| `erScale` | object | For effects that scale with Energy Recharge. See below. |
| `param` | object | For talent-level-dependent values. See below. |
| `conditionEn` | string | English description of condition (e.g., "on crit", "during Q", "HP < 70%") |
| `conditionZh` | string | Chinese description of same condition |
| `note` | string | English-only free-text for anything that doesn't fit other fields (approximations made, unusual mechanics, caveats). This is a catch-all — use it so nothing gets silently lost. |

### `erScale` Object

For energy that scales with Energy Recharge stat (e.g., "每100%充能效率恢复5点"):

```json
{
  "erScale": {
    "per100": 5,
    "max": 15
  }
}
```

- `per100` (required): energy per 100% ER
- `max` (optional): maximum energy from this effect

When `erScale` is present, `amount` is the base value at 100% ER.

### `param` Object

For talent-level-dependent values (e.g., Raiden Q energy restore, Dori Q energy per tick):

```json
{
  "param": {
    "source": "Q",
    "index": 17,
    "multiplier": 1
  }
}
```

- `source`: which talent table to read from — `A`, `E`, `Q`, or `S` (special)
- `index`: 1-based parameter index in the talent table (from `{paramN:F1}` templates)
- `multiplier`: multiply the param value by this (usually 1)

When `param` is present, **omit `amount`** — the value is resolved at runtime from talent data.

---

## Workflow

### Step 1: Load character kit

For each candidate character:

```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py showzh C <id>
```

Then read the output file `scripts/data/<id>.txt`. This contains the ZH game text, talent scaling tables, passives, and constellations.

To resolve talent table template values (e.g., `{param4:F1}`), use:
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py showzh C <id> --detail=Q1
```

### Step 2: Identify energy recovery effects

For each energy recovery mention, read the full context to determine:

1. **Source**: Which part of the kit grants this effect (P1, C4, Q detail table, etc.)
2. **Amount**: The exact energy amount:
   - "恢复X点元素能量" → `amount: X`
   - "恢复X%元素能量" → `percentRefund: X`
   - Talent table `{paramN:F1}` → use `param` object, omit `amount`
   - ER-scaling "每100%充能效率恢复X点" → `amount: X` + `erScale: {per100: X, max: ...}`
3. **Target**: Who receives the energy:
   - "为[角色名]恢复" / "为自己恢复" → `self`
   - "为队伍中所有角色恢复" → `party`
   - "为当前场上角色恢复" → `active`
   - "为队伍中所有角色（不包括X）恢复" → `partyOthers`
4. **Action**: Which gameplay action triggers this:
   - E skill hit → `E` | hold E → `holdE` | normal attack → `A`
   - Charged attack → `ChargeA` | plunge → `PlungeA` | burst → `Q`
   - Periodic E effect (turret, summon) → `periodicE`
   - Burst end → `Q` | passive always-on → `E` (default)
5. **Procs**: If multi-hit, set `procs` to max count if capped (e.g., "至多5次" → 5), or estimated typical count if uncapped.
6. **Conditions**: If conditional, provide both `conditionEn` and `conditionZh`.

### Step 3: Handle special cases

**Talent-level-dependent values** (skill detail table entries like Dori Q, Raiden Q):
- Use `param` object with `source`, `index`, `multiplier`. Omit `amount`.
- Identify the param index from the template string (e.g., `{param17:F1}` → index 17).

**ER-scaling effects** (e.g., Dori P2, Kujou Sara P2):
- Set `amount` to the base value at 100% ER.
- Add `erScale: {per100: X}` and optionally `max`.

**Percent-based refunds** (e.g., Jean P2 "恢复20%元素能量"):
- Use `percentRefund: 20` instead of `amount`.

**Crit-rate-based probability** (e.g., Escoffier C4):
- Document in `conditionEn`/`conditionZh`. Don't try to multiply amount by probability.

**Effects that mention 能量 but aren't energy recovery — SKIP these**:
- "元素能量" as burst cost label (just the burst cost display)
- "元素充能效率" (ER% buff, not flat energy)
- "能量层数" (energy stacks, like Eula's Lightfall Sword)
- Energy threshold conditions (e.g., Dori C4 "元素能量低于50%")

### Step 4: Approximation

When a mechanic doesn't fit the schema, **approximate to flat-energy-per-action** and document:
- "Recover X energy per second for Y seconds" → `amount: X*Y`, note in conditions
- "Recover energy with probability" → document probability in condition, keep amount as-is
- Complex multi-step mechanics → collapse to net energy per typical trigger

### Step 5: Write output

Write the JSON directly to `src/data/ercalc/selfEnergy/<region>.json`. The file contains a single object keyed by character ID, sorted alphabetically. If the file already exists, merge your entries with existing data (replace entries for characters you processed, keep others).

Characters with no valid energy recovery effects should be omitted.

After writing the file, report:

```markdown
## Summary
- Characters processed: N
- Characters with entries: N
- Characters skipped (no valid effects): list

## Approximations
- **<character_id>**: <what was approximated and why>
```

---

## Important Notes

- Always read the FULL game text from `impl_audit.py showzh` — the candidate finder's snippets are truncated to 150 chars.
- For constellation effects, `minC` is the constellation number (1-6), not 0.
- For passive effects, `minC` is 0.
- The `action` field determines when energy recovery fires in the rotation timeline. Choose the most accurate action.
- Do NOT include burst cost display rows (`detail[0] == "元素能量"`).
- Do NOT include ER% buff effects — those are rate buffs, not flat energy.
- Raiden Q energy restore IS valid (flat energy to party during burst).
- Tartaglia Q energy return IS valid (returns energy on ranged burst).
- Provide BOTH `conditionEn` and `conditionZh` when conditions are present. Omit both if unconditional.
