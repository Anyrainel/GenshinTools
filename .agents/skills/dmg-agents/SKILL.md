---
name: dmg-agents
description: Launch damage calculator agents (review, triage, implement, excel). Use when the user asks to review, audit, triage, implement, or cross-validate damage formulas or buff implementations.
---

# Damage Agent Dispatch

Launch specialized agents for the damage calculator pipeline. **Your job is to launch the right agent(s) with the right scope — not to read reference material yourself.** Each agent's instruction file tells it what to read.

> **Note:** This skill is specifically for the damage review/triage/implement pipeline. For generic coding tasks, continue using standard subagents (general-purpose, Explore, etc.) directly.

## Agents

### dmg-review — Audit & fix implementations

Reads implementations, fixes bugs inline, creates tracker items for issues needing triage.

**Launch:** Task tool, `subagent_type: "general-purpose"`, prompt:
```
Read `.Codex/agents/dmg-review.md` and follow its instructions. Scope: C mondstadt
```

Scope format: `C <region>`, `W <type>`, or `A`

### dmg-triage — Process open tracker items

Researches open items, classifies as actionable or wont-do. Validates review agent's rule citations against `translator-rules.md`. Optionally consults KQM guides for ambiguous items (has web access).

**Launch:** Agent tool, `subagent_type: "general-purpose"`, prompt:
```
Read `.Codex/agents/dmg-triage.md` and follow its instructions. Scopes: mondstadt, liyue, inazuma
```

**Launch (retriage mode):** Re-evaluate all open + actionable items against updated rules:
```
Read `.Codex/agents/dmg-triage.md` and follow its instructions. Scopes: mondstadt, liyue, inazuma. --retriage
```

Scope format: comma-separated region names, `weapons`, or `artifacts`. Combine small scopes into one agent.

### dmg-implement — Code actionable items

Implements actionable tracker items or ad-hoc tasks, runs type-check, marks completed.

**Launch (tracker mode):** Agent tool, `subagent_type: "general-purpose"`, prompt:
```
Read `.Codex/agents/dmg-implement.md` and follow its instructions. Scope: mondstadt
```

**Launch (ad-hoc mode):** Agent tool, `subagent_type: "general-purpose"`, prompt:
```
Read `.Codex/agents/dmg-implement.md` and follow its instructions. Task: Add E Hold formula to Shenhe with param index 2, Cryo/skill/none
```

Scope format: region name, `weapons`, or `artifacts`. Ad-hoc tasks skip tracker loading.

### dmg-excel — Cross-validate against Excel calculator

Compares character damage implementations against the Chinese community Excel damage calculator (`docs/formulas/原神伤害計算(1).xlsm`). Creates tracker items for discrepancies. **Does not modify code.**

**Launch:** Agent tool, `subagent_type: "general-purpose"`, prompt:
```
Read `.Codex/agents/dmg-excel.md` and follow its instructions. Scope: C mondstadt
```

Scope format: `C <region>` (characters only — the Excel calculator has no weapon/artifact logic).

**Note:** Different regions can run in parallel (they write to separate tracker files). Excel cross-validation appends to the same tracker files as review/kqm — avoid running excel + review on the same region simultaneously.

## Scopes

| Entity | Regions / types |
|---|---|
| Characters | mondstadt, liyue, inazuma, sumeru, fontaine, natlan, nod-krai, snezhnaya, other |
| Weapons | bow, catalyst, claymore, polearm, sword |
| Artifacts | (single scope, all sets) |

## Agent Count — Right-Sizing

Each agent has significant startup overhead (reading 3-4 reference docs). **Don't launch one agent per scope when items are few.** Match agent count to workload:

- **review**: 1 per scope (each is a full audit of every entity — inherently large).
- **triage**: **Always 1 agent with all scopes combined.** Triage decisions benefit from cross-scope consistency (e.g., applying the same wont-do threshold everywhere). Pass all scopes in a single comma-separated list (e.g., `Scopes: mondstadt, liyue, inazuma, sumeru, fontaine, natlan, nod-krai, snezhnaya, other, weapons, artifacts`).
- **implement**: Combine small scopes. 1–3 agents depending on total item count.
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
2. **Review sweep:** Launch review agents for all scopes in parallel (1 per scope — each is a full audit)
3. **Triage batch:** Always launch a single triage agent with all scopes combined for decision consistency.
4. **Excel validation:** Launch excel agents for multiple regions in parallel, then triage the created items
