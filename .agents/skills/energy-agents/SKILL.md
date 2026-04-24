---
name: energy-agents
description: Launch energy recovery worker subagents to populate selfEnergy data files. Use when the user asks to generate, update, or review self-energy recovery data for the ER calculator.
---

# Energy Recovery Agent Dispatch

Launch specialized worker subagents to populate `src/data/ercalc/selfEnergy/<region>.json` with per-character energy recovery effects. Each worker reads character kits via `impl_audit.py` and writes to its own region file.

> **Note:** This skill is specifically for the energy recovery data pipeline. For other ER calculator work, use standard subagents.

## Data Files

Each region has its own file under `src/data/ercalc/selfEnergy/`:

| File | Region |
|------|--------|
| `mondstadt.json` | Mondstadt |
| `liyue.json` | Liyue |
| `inazuma.json` | Inazuma |
| `sumeru.json` | Sumeru |
| `fontaine.json` | Fontaine |
| `natlan.json` | Natlan |
| `nod-krai.json` | Nod-Krai |
| `snezhnaya.json` | Snezhnaya |
| `none.json` | Travelers |

## Candidate Discovery

Before launching agents, run the candidate finder:

```bash
uv run --project scripts/pyproject.toml scripts/gen_self_energy.py
```

## Agents

Use Codex's `worker` subagent type for every launch below. Tell each worker that it is not alone in the codebase, must not revert edits made by others, and must adapt to concurrent changes. The prompt body should be the matching launch block below, with the requested scope filled in.

### energy-review — Generate/update selfEnergy entries

Reads each candidate's full kit, determines energy recovery mechanics, and writes correct JSON entries to the region file.

**Launch (region scope):**
```
Read `.agents/agents/energy-review.md` and follow its instructions. Region: mondstadt
```

**Launch (entity scope):**
```
Read `.agents/agents/energy-review.md` and follow its instructions. Entities: raiden_shogun, dori
```

## Right-Sizing

- **Small regions** (snezhnaya=2, none=5): Combine into one agent.
- **All others**: One agent each.

Typical full sweep: 7-8 agents in parallel.

## Parallelization

All region agents are fully independent — each writes to its own file. Launch all in parallel.

## Typical Pipeline

1. Run `gen_self_energy.py` to get candidates
2. Launch region agents in parallel
3. Review approximation reports from each agent
4. Commit
