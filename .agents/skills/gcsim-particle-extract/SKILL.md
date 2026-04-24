---
name: gcsim-particle-extract
description: Launch worker subagents that read gcsim character source code and extract v2-schema particle data. Use when the user asks to populate, update, or audit particle data from gcsim for the ER calculator.
---

# gcsim Particle Extraction Dispatch

Launch parallel worker subagents to extract per-character particle generation data from a local gcsim clone, and emit v2-schema batch JSON for later merge into `src/data/ercalc/particles.gcsim.json`.

Fandom (`particles.json`) and Lunaris (`particles.lunaris.json`) remain as-is for cross-validation. This skill produces a third, higher-fidelity reference sourced from gcsim's actual runtime logic (`done` flags, probability rolls, ICD gating, etc.).

> **Prerequisites**: gcsim cloned at `F:/Codes/genshin/gcsim`. Particle-location index built via `uv run --project scripts/pyproject.toml scripts/gcsim_particle_locations.py` → `scripts/out/particle-locations.json`.

## Coverage

The location scanner covers **99 characters** (Barbara and the Traveler base file have no particle logic — handled separately). Characters released after the last gcsim sync (Flins, Varesa, Ineffa, Jahoda, Iansan, Ifa, Illuga, Nicole, Lohen, Prune, Durin, etc.) are not in gcsim and fall back to Fandom/Lunaris.

## Agent

**`.agents/agents/gcsim-particle-extract.md`** contains the extraction rules. Each worker reads that file, processes its assigned batch of characters, and writes to its own batch output file.

## Launch

Batch size: **15 characters per agent**. For a full sweep of 99 covered chars → 7 agents in parallel.

Launch each agent with:
```
Read `.agents/agents/gcsim-particle-extract.md` and follow its instructions.
Batch: <N>
Characters: <id1>, <id2>, ..., <id15>
```

Example for a subset re-run:
```
Read `.agents/agents/gcsim-particle-extract.md` and follow its instructions.
Batch: 1
Characters: bennett, fischl, hutao, raiden, klee, diona, charlotte, emilie, nahida, albedo, alhaitham, xiangling, xingqiu, ayaka, ayato
```

All agents run concurrently. Use Codex's `worker` subagent type for each batch. Tell each worker that it is not alone in the codebase, must not revert edits made by others, and owns exactly its assigned batch output file.

## Parallelization

Standard sweep of 99 chars ÷ 15/batch = 7 agents. Send all 7 in one batched message. Wall-clock ~3-5 min.

## Output

Each agent writes to `scripts/out/particles.gcsim.batch_<N>.json`. After all agents complete:

```bash
uv run --project scripts/pyproject.toml scripts/merge_gcsim_batches.py
```

This merges batches into `src/data/ercalc/particles.gcsim.json`, validates each entry against the v2 schema, and reports:
- Total entries merged
- Entries with `_unmodeled` notes (for human review)
- Duplicate keys across batches (should be zero if batches are disjoint)
- Schema validation errors

## Right-Sizing

- **Full sweep (new data)**: 7 agents, 15 chars each.
- **Audit / correction run** (specific chars): 1 agent with a shorter list.
- **Newly added chars from gcsim** (after a gcsim pull): 1 agent with just those IDs.

## After Extraction

1. Spot-check 5-10 entries against `particles.json` (Fandom) and `particles.lunaris.json` (Lunaris). Expect matches for simple chars; gcsim should be more accurate for Klee-style (`done`-gated), Cyno-style (variant skills), and Diona-style (multi-hit) cases.
2. Review `_unmodeled` aggregation — decide which patterns warrant schema extensions, which stay curated.
3. Promote `particles.gcsim.json` to `particles.json` (as `source: "gcsim"`) only after review — don't overwrite automatically.
