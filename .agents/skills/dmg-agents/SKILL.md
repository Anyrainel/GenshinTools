---
name: dmg-agents
description: Launch damage calculator worker subagents (review, triage, implement, excel, cleanup). Use when the user asks to review, audit, triage, implement, cross-validate, or clean up damage formulas or buff implementations.
---

# Damage Agent Dispatch

Launch specialized worker subagents for the damage calculator pipeline. **Your job is to launch the right worker(s) with the right scope — not to read reference material yourself.** Each worker's instruction file tells it what to read.

> **Note:** This skill is specifically for the damage review/triage/implement pipeline. For generic coding tasks, continue using Codex's standard built-in subagents directly.

> **Tracker files** live in `docs/dmg-tracker/` — one YAML per region/scope (e.g., `mondstadt.yaml`, `artifacts.yaml`).

## Scope Formats

### Region/type scope (full sweep)
Process every entity in a region or weapon type.
- `C <region>` — all characters from a region
- `W <type>` — all weapons of a type
- `A` — all artifact sets

### Entity scope (targeted)
Process specific entities by ID. Use `Entities:` with `<type>:<id>` pairs. **Can mix types in one agent.**
- `Entities: C:linnea` — one character
- `Entities: W:golden_frostbound_oath` — one weapon
- `Entities: C:linnea, W:golden_frostbound_oath` — one character + one weapon in the same agent

**Prefer entity scope when the user names specific entities** — it avoids reviewing an entire region/type.

## Agents

Use Codex's `worker` subagent type for every launch below. Tell each worker that it is not alone in the codebase, must not revert edits made by others, and must adapt to concurrent changes. The prompt body should be the matching launch block below, with the requested scope filled in.

### dmg-review — Audit & fix implementations

Reads implementations, creates tracker items for issues needing triage. **Does not modify implementation code.**

**Launch (region scope):**
```
Read `.agents/agents/dmg-review.md` and follow its instructions. Scope: C mondstadt
```

**Launch (entity scope):**
```
Read `.agents/agents/dmg-review.md` and follow its instructions. Entities: C:linnea, W:golden_frostbound_oath
```

### dmg-triage — Process open tracker items

Researches open items, classifies as actionable or wont-do.

**Launch (region scope):**
```
Read `.agents/agents/dmg-triage.md` and follow its instructions. Scopes: mondstadt, liyue, inazuma
```

**Launch (entity scope):**
```
Read `.agents/agents/dmg-triage.md` and follow its instructions. Entities: C:linnea, W:golden_frostbound_oath
```

**Launch (retriage mode):** Re-evaluate all open + actionable items against updated rules:
```
Read `.agents/agents/dmg-triage.md` and follow its instructions. Scopes: mondstadt, liyue, inazuma. --retriage
```

Scope format: comma-separated region names, `weapons`, or `artifacts`. Combine small scopes into one agent.

### dmg-implement — Code actionable items

Implements actionable tracker items or ad-hoc tasks, runs type-check, marks completed.

**Launch (tracker mode, region scope):**
```
Read `.agents/agents/dmg-implement.md` and follow its instructions. Scope: mondstadt
```

**Launch (tracker mode, entity scope):**
```
Read `.agents/agents/dmg-implement.md` and follow its instructions. Entities: C:linnea
```

**Launch (ad-hoc mode):**
```
Read `.agents/agents/dmg-implement.md` and follow its instructions. Task: Add E Hold formula to Shenhe with param index 2, Cryo/skill/none
```

### dmg-excel — Cross-validate against Excel calculator

Compares character damage implementations against the Chinese community Excel damage calculator. Characters only.

**Launch (region scope):**
```
Read `.agents/agents/dmg-excel.md` and follow its instructions. Scope: C mondstadt
```

**Launch (entity scope):**
```
Read `.agents/agents/dmg-excel.md` and follow its instructions. Entities: C:hu_tao
```

**Note:** Different regions can run in parallel (they write to separate tracker files). Avoid running excel + review on the same region simultaneously.

### dmg-cleanup — Fix hardcoded multipliers & inline unnecessary locals

Scans implementations for code quality issues. **Modifies code directly.**

**Launch (region scope):**
```
Read `.agents/agents/dmg-cleanup.md` and follow its instructions. Scope: C mondstadt
```

**Launch (entity scope):**
```
Read `.agents/agents/dmg-cleanup.md` and follow its instructions. Entities: C:linnea, W:golden_frostbound_oath
```

**Note:** This agent modifies implementation files. Don't run it in parallel with review or implement on the same entities.

## Scopes

| Entity | Regions / types |
|---|---|
| Characters | mondstadt, liyue, inazuma, sumeru, fontaine, natlan, nod-krai, snezhnaya, other |
| Weapons | bow, catalyst, claymore, polearm, sword |
| Artifacts | (single scope, all sets) |

## Agent Count — Right-Sizing

Each agent has significant startup overhead (reading 3-4 reference docs). **Don't launch one agent per scope when items are few.** Match agent count to workload:

- **Entity-level requests**: Always use `Entities:` — one agent can handle mixed types. Never launch a full region sweep for 1-2 named entities.
- **review**: 1 per scope for full sweeps.
- **triage**: **Always 1 agent with all scopes combined** for decision consistency. For entity-level, still 1 agent.
- **implement**: Combine small scopes. 1–3 agents depending on total item count.
- **cleanup**: 1 per scope. Lightweight per entity (just code style), but touches every entity.
- **excel**: 1 per scope is fine (each does substantial per-entity work).

## Parallelization

Launch multiple agents in parallel for independent scopes:
- review mondstadt + review liyue (different regions) — OK
- review fontaine + triage natlan (different scopes) — OK
- excel mondstadt + excel liyue (different regions) — OK
- excel mondstadt + review mondstadt (both modify mondstadt.yaml) — NOT OK, run sequentially
- review mondstadt + triage mondstadt (triage depends on review output) — NOT OK, run sequentially

## Typical Pipelines

1. **Full pipeline for a region:** review → triage → implement (sequential, each depends on previous output)
2. **Targeted pipeline:** review entities → triage entities → implement entities (sequential, same entity IDs passed to each)
3. **Review sweep:** Launch review agents for all scopes in parallel (1 per scope — each is a full audit)
4. **Triage batch:** Always launch a single triage agent with all scopes combined for decision consistency.
5. **Excel validation:** Launch excel agents for multiple regions in parallel, then triage the created items
