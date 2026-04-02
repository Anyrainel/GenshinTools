# Tools & Tracking

## 1. impl_audit.py

Data loader and validation script. All commands use:
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py <command> [args]
```

### Commands

**`list <C|W|A>`** — List all registered entity IDs, grouped by category.
- `C`: grouped by `{rarity} {region}` (e.g., "5★ Fontaine")
- `W`: grouped by `{rarity} {type}` (e.g., "4★ Bow")
- `A`: grouped by "Half Sets (2pc)" and "Full Sets (4pc)"

**`show <C|W|A> <id>`** — Export game text (EN + ZH) and current TypeScript implementation to `scripts/data/<id>.txt`. Skill detail rows display raw template strings (e.g., `{param2:P} DEF`) — use the param number to find the correct index for `this.param()` calls.

**`show C <id> --detail=<XN>`** — Render a single talent's parameters at a specific level. `X` = A/E/Q, `N` = 1–15. Example: `--detail=E10` shows Elemental Skill at level 10 with rendered values.

**`check [C|W|A]`** — Find missing implementations and misplaced files. Omit mode to check all three.

---

## 2. Tracker Files

Location: `docs/dmg-tracker/`

| File | Content |
|---|---|
| `mondstadt.yaml` | 4★ + 5★ Mondstadt characters |
| `liyue.yaml` | 4★ + 5★ Liyue characters |
| `inazuma.yaml` | 4★ + 5★ Inazuma characters |
| `sumeru.yaml` | 4★ + 5★ Sumeru characters |
| `fontaine.yaml` | 4★ + 5★ Fontaine characters |
| `natlan.yaml` | 4★ + 5★ Natlan characters |
| `nod-krai.yaml` | 4★ + 5★ Nod-Krai characters |
| `snezhnaya.yaml` | 5★ Snezhnaya characters |
| `other.yaml` | Aloy, Skirk, Traveler variants, Varka |
| `weapons.yaml` | All weapons |
| `artifacts.yaml` | All artifact sets |

---

## 3. Item Schema

Each tracker file is a YAML list. Every item has these fields:

```yaml
- id: kazuha-q-absorption        # Unique within file. Format: {entity}-{brief-desc}, kebab-case
  entity: kaedehara_kazuha        # Entity ID from impl_audit.py
  rule: S8                        # Review rule that flagged this (U1–U9, S1–S10)
  status: open                    # open | actionable | wont-do | completed
  category: missing-formula       # See §4
  summary: >                      # What the issue is (1-2 self-contained sentences)
    Q absorbed-element slash/DoT damage not modeled.
    Low significance relative to swirl/team buff value.
  detail: ""                      # Context-dependent — see §6
  created: "2026-02-24"           # YYYY-MM-DD when item was created
  resolved: null                  # YYYY-MM-DD when completed/wont-do, null otherwise
```

**Field constraints:**
- `id` must be unique within its file. Use `{entity}-{2-3-word-desc}`.
- `summary` must be self-contained: readable without looking at the code.
- `resolved` must be set when status is `completed` or `wont-do`, null otherwise.

---

## 4. Categories

| Category | Meaning | Examples |
|---|---|---|
| `missing-formula` | A formula that should exist is absent | Missing approved formula, significant proc |
| `approximation` | Current implementation approximates; could be more accurate | Hit count estimate, ramp average |
| `engine-gap` | Requires an engine feature that doesn't exist yet | New stat key, per-hit tracking |
| `needs-data` | Missing game data needed for implementation | Hit counts, frame data, tick timing |

---

## 5. State Machine

```
         ┌──────────┐
         │   open   │ ← Review agent creates
         └────┬─────┘
              │ Triage agent
       ┌──────┴──────┐
       │             │
       ▼             ▼
┌────────────┐ ┌──────────┐
│ actionable │ │  wont-do  │ ──→ [delete] ← Review agent
└─────┬──────┘ └──────────┘      (if issue no longer exists)
      │ Implement agent
      ▼
┌───────────┐
│ completed │ ──→ [delete] ← Review agent
└───────────┘      (if issue no longer exists)

Re-open: any status → open (manual, when circumstances change)
```

### Transitions

| From | To | Who | Required updates |
|---|---|---|---|
| *(new)* | `open` | Review agent | Set `id`, `entity`, `rule`, `category`, `summary`, `created` |
| `open` | `actionable` | Triage agent | Fill `detail` with implementation guidance |
| `open` | `wont-do` | Triage agent | Fill `detail` with rationale, set `resolved` |
| `actionable` | `completed` | Implement agent | Update `detail` with change summary, set `resolved` |
| `wont-do`/`completed` | *(deleted)* | Review agent | Remove item from YAML (issue no longer exists in implementation) |
| any | `open` | Manual | Clear `resolved`, update `detail` |

---

## 6. The `detail` Field

The `detail` field carries different information depending on the item's status:

| Status | `detail` contains | Example |
|---|---|---|
| `open` | Research notes so far (may be empty) | `"Wiki says 6 ticks but needs in-game verification"` |
| `actionable` | Implementation guidance for the implement agent | `"Add DirectFormula(1.234, Pyro/skill/none) to formulaMap. File: character5Natlan.ts"` |
| `wont-do` | Rationale for declining | `"Periodic proc, <2% DPS contribution. Not worth the complexity."` |
| `completed` | What was changed | `"Added 3-hit E formula to formulaMap. Verified type-check passes."` |

**For `actionable` items**: `detail` must contain enough information for the implement agent to work without re-researching. Include: what to add/change, which file, talent multipliers if known, formula class to use, relevant stat keys.

---

## 7. Writing Conventions

- Append new items at the end of the file. Don't reorder existing items.
- After triaging or implementing, update the item in-place (don't create a duplicate).
- One entity can have multiple items (e.g., separate items for missing E formula and missing Q formula).
- Don't create items for things the review agent already fixed as [BUG] — those are handled inline.
- Keep `summary` concise. Put implementation details in `detail`, not `summary`.
