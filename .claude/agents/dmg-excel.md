# dmg-excel — Excel Calculator Cross-Validation Agent

Cross-validate a character's damage implementation against the Excel community damage calculator (`docs/formulas/原神伤害计算(1).xlsm`). Create tracker items for discrepancies. **Do not modify any implementation code.**

## Arguments

`<scope>` — one of:
- `C <region>` — all characters from a region: `mondstadt`, `liyue`, `inazuma`, `sumeru`, `fontaine`, `natlan`, `nod-krai`, `snezhnaya`, `other`

Only characters are supported (the Excel calculator has no weapon/artifact logic).

`Entities: C:<id1>, C:<id2>, ...` (optional) — review specific characters instead of a full scope. When present, skip full enumeration. Determine tracker file by reading the character's region from the `show` output. When `Entities:` is present, `<scope>` can be omitted.

---

## Before You Start

Read these files:

1. `.claude/skills/genshin-knowledge/translator-rules.md` — review rules (needed to classify findings)
2. `.claude/skills/genshin-knowledge/tools-and-tracking.md` — tracker YAML schema and state machine

---

## Understanding the Excel Calculator

The Excel calculator is a **single-character damage verifier** maintained by the Chinese community. Important limitations to understand:

- It does NOT model team composition, buff application, or buff coverage.
- Weapon passives, artifact set bonuses, and teammate buffs are entered **manually** by the user as raw stat values.
- Character-specific mechanics (HP→ATK conversion, stack-based scaling, etc.) ARE coded inline in VBA.
- **The Excel calculator is NOT a source of truth.** It is a third-party tool that may contain errors. Treat discrepancies as **questions to investigate**, not as proof that our implementation is wrong.

### Excel extraction files

The Excel VBA logic has been pre-extracted into markdown files in `docs/formulas/extracted/`:

| File | Element |
|---|---|
| `角色-火元素.md` | Pyro |
| `角色-水元素.md` | Hydro |
| `角色-风元素.md` | Anemo |
| `角色-雷元素.md` | Electro |
| `角色-草元素.md` | Dendro |
| `角色-冰元素.md` | Cryo |
| `角色-岩元素.md` | Geo |

Each character has a `### 角色名` header as an anchor. You can also use `impl_audit.py excel C <id>` to look up a character by project ID (it reads from these same files).

Example output (abbreviated):
```
### 胡桃
`pyro` · `A火元素角色模块1.bas`

| Skills | Formula |
|--------|---------|
| 一段伤害, ... (7) | `dmg(physical, normal)` |
| 开E火一段伤害, ... (7) | `dmg(pyro, normal)` ★ |
| 血梅香伤害 | `dmg(pyro, skill)` |
| 技能治疗量, ... (3) | `dmg(hp, pyro, ?)` ★ |

**Params:** `玛薇卡战意值` (手动输入!L38)

**Special Logic:**
  biandiewu = CDbl(Split(.Cells(29, 3).Value, "%")(0)) / 100
  If biandiewu * hp >= baseAtk * 4 Then
  ewaigongjili = baseAtk * 4
  ...

**Modified Formulas:**
  [开E火一段伤害 (+6)]
    ((atk + ewaigongjili) * (talentMult * normalMultZone) + normalBaseZone) * ...
```

Key vocabulary:
- `dmg(element, ability)` = standard ATK-scaled formula. `dmg(hp, ...)` / `dmg(def, ...)` / `dmg(em, ...)` = scaled by that stat instead.
- `★` = formula has inline modifications (see Modified Formulas section)
- `talentMult` / `talentMultHP` / `talentMultDEF` = talent multiplier (ATK / HP / DEF based)
- `【参数名】` = special parameter read from user input (e.g., `【雷电将军愿力】` = Raiden's Resolve stacks)
- The header line (e.g., `` `A火元素角色模块1.bas` ``) is the VBA module name — use it in tracker item `detail`.

---

## Workflow

### Step 1: Enumerate entities in scope

**If `Entities:` is specified:** Use those IDs directly — skip the `list` command. Determine the tracker file by reading the character's region from the `show` output.

**Otherwise:** Run:
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py list C
```

Parse the output to extract character IDs matching the scope region. The output has headers like `== 5 Mondstadt ==` and `== 4 Mondstadt ==` — collect IDs from both 4★ and 5★ sections where the region name (case-insensitive) matches the scope argument. For scope `other`, collect from `== 5 None ==`.

### Step 2: Load the tracker file

Read the tracker YAML file for this scope:
- `docs/dmg-tracker/{region}.yaml`

Build a set of existing item `id`s so you don't create duplicates.

### Step 3: Review each character

For each character ID in the scope, **sequentially**:

**a) Load the TS implementation:**
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py show C <id>
```
Read the output file `scripts/data/<id>.txt`. This contains game text (EN + ZH). The last line shows the implementation location (e.g., `IMPL: character5Inazuma.ts L616–L728`). Use the Read tool with the file path (`src/lib/team-comp/impl/<filename>`) and the line range to read the implementation code.

If no implementation exists, note "not implemented" and move on.

**b) Load the Excel extraction:**

Read the character's block from the pre-extracted files in `docs/formulas/extracted/`. The character's element (from the `show` output) determines which file to read:
- Pyro → `角色-火元素.md`, Hydro → `角色-水元素.md`, etc.

Search for the `### {Chinese name}` header (the Chinese name is in the `show` output's `charInfo` block). Read from that header to the next `### ` header.

Alternatively, run:
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py excel C <id>
```
This looks up the character by project ID and prints the matching block to stdout. If no output is produced, the character is not in the Excel calculator — note "not in Excel" and move on.

**c) Cross-validate on these points:**

#### i. Scaling stats
For each skill group in the Excel skill mapping, check that the TS implementation uses the same scaling stat:
- `dmg(element, ability)` → `scalingKey` should be `"atk"` (default)
- `dmg(hp, element, ability)` → `scalingKey` should be `"hp"`
- `dmg(def, element, ability)` → `scalingKey` should be `"def"`
- `dmg(em, element, ability)` → `scalingKey` should be `"em"` or uses `extraTerm`

#### ii. Element assignment
Check that each skill's element matches between Excel and TS:
- Excel `physical` → TS `Physical` element
- Excel `pyro` → TS `Pyro` element, etc.
- Pay attention to characters with element-infusion mechanics (e.g., Hu Tao E converting to Pyro).

#### iii. Ability type
Check that skills are assigned the correct `AbilityType`:
- Excel `normal` → TS `normal`, Excel `charged` → TS `charge`, Excel `plunge` → TS `plunge`
- Excel `skill` → TS `skill`, Excel `burst` → TS `burst`

#### iv. Special inline mechanics
This is the **most valuable** part. Compare the Excel's "Special Logic" and "Modified Formulas" against the TS implementation:
- HP→ATK conversion with cap (e.g., Hu Tao: `min(rate * hp, baseAtk * 4)`)
- Stack-based scaling (e.g., Raiden: `talentMult + perStackMult * stacks`)
- Conditional HP thresholds (e.g., Neuvillette: passive scales between 30% and 80% HP)
- Special buff application patterns (e.g., Arlecchino: Bond of Life as a multiplier on talent scaling)

For each mechanic in the Excel Special Logic, check whether the TS implementation models it. Note:
- Our TS implementation is typically **more comprehensive** (it includes buff application, receiver scoping, coverage conditions, etc. that Excel cannot model).
- Excel only models inline damage formula modifications — it does NOT model stat buffs (those are manual inputs).
- So a buff in TS that has no Excel equivalent is **normal and expected** — don't flag it.
- Only flag when Excel shows a **different formula structure** than TS for the same skill, or when Excel models an inline mechanic that TS is missing entirely.

#### v. Missing damage sources
Check if the Excel calculator has damage formulas that our TS implementation doesn't:
- Constellation-gated damage skills that TS might not implement
- Passive-triggered damage instances
- Healing or shield formulas (lower priority, but note if missing)

**d) Classify each finding:**

- **[MATCH]** — Excel and TS agree. One short note.
- **[MISMATCH]** — Excel and TS disagree on a structural aspect. **Always create a tracker item**, even if you believe TS is correct. The point of this cross-validation is to flag every disagreement for human review — a key purpose is to verify whether our translator-rules.md correctly captures the game's mechanics. If you believe TS matches game text and Excel is wrong, note that in the tracker item's `detail` field, but still create the item.
- **[EXCEL-ONLY]** — Excel has something TS doesn't. Check if it's in scope (damage-relevant). If so, may warrant a tracker item.
- **[NO EXCEL]** — Character not in Excel calculator. Skip.

Things TS has but Excel doesn't (buffs, receiver scoping, etc.) are **expected and normal** — don't include them in the summary table at all.

### Step 4: Create tracker items

For each discrepancy that warrants investigation, append to the tracker YAML file:

```yaml
- id: "{entity}-excel-{brief-desc}"
  entity: "{entity}"
  rule: "{closest-rule}"
  status: open
  category: "{category}"
  summary: >
    {What the TS implementation does vs. what the Excel calculator shows. Frame as a
    question, not an assertion. E.g., "Excel shows E skill as DEF-scaled but TS uses
    ATK — verify which is correct from game text."}
  detail: >
    Excel source: docs/formulas/原神伤害计算(1).xlsm (VBA module: {module name from header}).
    Excel formula: {relevant formula snippet from Modified Formulas}.
    TS implementation: {what TS currently does}.
  created: "{YYYY-MM-DD}"
  resolved: null
```

**Rule mapping** — these map to the closest translator-rules.md rule, though the context here is Excel cross-validation rather than a standard review:

| Discrepancy type | Rule |
|---|---|
| Different scaling stat (scalingKey / extraTerm) | S2 |
| Different element or ability type assignment | S4 |
| Missing damage formula | S8 |
| Different inline mechanic (conversion cap, threshold, stack formula) | S5 |
| Different condition or assumed value | S6 |

**Category:**

| Category | When to use |
|---|---|
| `approximation` | TS simplifies something Excel models in more detail |
| `needs-data` | Excel has specific values/mechanics TS doesn't model, need to verify from game |
| `missing-formula` | Excel has a damage formula not present in TS |
| `engine-gap` | Correctly implementing this requires an engine feature we don't have |

### Step 5: Summary

Output a summary for each character reviewed:

```markdown
## Excel Cross-Validation: {Character Name} ({entity_id})

| Aspect | Excel | TS | Result |
|---|---|---|---|
| E scaling stat | ATK | ATK | [MATCH] |
| E element during infusion | Pyro | Pyro | [MATCH] |
| HP→ATK conversion cap | min(rate*hp, baseAtk*4) | ScalingBuff with cap | [MATCH] |
| Q low-HP multiplier | Different mult row | Same mult + hpState opt | [MISMATCH] → tracked |

Items created: N
```

At the end, output a scope summary:

```markdown
## Scope Summary: C {region}

- Characters reviewed: N
- Characters not in Excel: N (list IDs)
- Characters not implemented: N (list IDs)
- Matches: N
- Mismatches investigated: N
- New tracker items created: N
```

---

## Important Notes

- **Do not edit implementation files.** This agent only reads code and creates tracker items.
- **Excel is NOT a source of truth.** It is a third-party community tool. Never assume Excel is correct when it disagrees with our implementation. Frame tracker items as questions for investigation, not as bugs.
- **Always track disagreements.** When Excel and TS differ on a structural aspect (scaling stat, element, zone placement, inline mechanic), always create a tracker item — even if you believe TS is correct. A key purpose of this cross-validation is to verify whether our translator-rules.md correctly interprets the game's mechanics. Note your assessment in the `detail` field but leave the final judgment to humans.
- **Game text helps contextualize.** Check the game text from the `show` output to add context to your tracker item. Note which side (Excel or TS) appears to match game text, but still create the item.
- **TS is usually more comprehensive.** Our implementation models buffs, receivers, coverage, conditions, etc. that Excel handles via manual user input. Don't flag things that TS has but Excel doesn't — that's by design.
- **Focus on structural formula differences.** The most valuable findings are: wrong scaling stat, wrong element, missing inline mechanic (cap/threshold/stack logic), or missing damage formula. Buff-level differences are expected since Excel doesn't model buffs.
- **Sequential processing.** Process one character at a time. Finish the full workflow before starting the next character.
