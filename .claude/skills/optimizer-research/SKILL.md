---
name: optimizer-research
description: >
  Autonomous optimizer research loop (autoresearch-style). Use when the user asks to
  research, experiment with, or improve the artifact optimizer algorithm. Runs an
  iterative cycle: hypothesize → modify code → benchmark → keep/discard → log → repeat.
---

# Optimizer Research — Autonomous Experiment Loop

Run autonomous experiments on the artifact optimizer to find better algorithms for
searching the highest-damage artifact assignment for a given team.

## Quick Start

Launch via the Agent tool with `subagent_type: "general-purpose"`:
```
Read `.claude/agents/optimizer-research.md` and follow its instructions.
Program: default
```

Or with a focused research program:
```
Read `.claude/agents/optimizer-research.md` and follow its instructions.
Program: hyperparameter-tuning
```

## Concepts

This is modeled after [Karpathy's autoresearch](https://github.com/karpathy/autoresearch):
an LLM agent iteratively modifies code, runs benchmarks, evaluates results, keeps
improvements, discards regressions, and logs everything.

### The Loop

```
Read program instructions
    │
    ▼
Analyze optimizer code + results history
    │
    ▼
Generate experimental hypothesis
    │
    ▼
Modify optimizer source files
    │
    ▼
git commit -m "experiment: <description>"
    │
    ▼
npm run benchmark -- run --timeout 30
    │
    ▼
Compare results to baseline
    │
    ├── Improved → keep commit, update baseline
    ├── Regressed → git reset HEAD~1, log as "discarded"
    └── Crashed → git reset HEAD~1, log as "crash"
    │
    ▼
Append row to docs/optimizer-research/results.tsv
    │
    ▼
Loop (until stopped or N experiments reached)
```

### Key Rules

1. **Single optimization target**: total damage across all benchmark problems (geometric mean of per-problem ratios vs baseline)
2. **Ratchet**: git history only advances on improvements. Discarded experiments are reset but still logged in results.tsv
3. **One file diff per experiment**: keep changes small and isolated so you can attribute gains
4. **Never break type-check**: run `npm run type-check:head` before benchmarking
5. **Always log**: every experiment (kept, discarded, crash) gets a row in results.tsv

### Metric

The primary metric is **geomean damage ratio** — the geometric mean of `(experiment_damage / baseline_damage)` across all benchmark problems. A value > 1.0 means improvement.

Secondary metrics tracked but not optimized:
- Per-problem damage values
- Time to solve (seconds)
- Any regressions (problems where damage decreased)

### Decision Heuristics

- **Keep** if geomean ratio > 1.0 AND no individual problem regresses by more than 0.5%
- **Keep** if the change simplifies code while geomean ratio >= 0.999 (within noise)
- **Discard** if any problem regresses by more than 0.5% even if geomean improves
- **Discard** if the improvement is < 0.01% but adds significant complexity

## Editable Files

The agent MAY modify:
- `src/lib/team-comp/optimizer/characterBnB.ts` — per-character B&B search
- `src/lib/team-comp/optimizer/teamOptimization.ts` — team-level allocation & refinement
- `src/lib/team-comp/optimizer/artifactScoring.ts` — artifact scoring & pre-filtering
- `src/lib/team-comp/optimizer/evaluation.ts` — build evaluation functions
- `src/lib/team-comp/optimizer/marginalWeights.ts` — marginal weight computation
- `src/lib/team-comp/optimizer/topKCollector.ts` — top-K data structure
- `src/lib/team-comp/optimizer/types.ts` — shared types

The agent MUST NOT modify:
- `tests/benchmark/` — benchmark infrastructure is frozen
- `src/lib/team-comp/damageCalc.ts` — damage calculation engine
- `src/lib/team-comp/damageModels.ts` — stat/damage model definitions
- `src/lib/team-comp/impl/` — character implementations
- Any UI code

## Research Programs

Programs focus the agent's exploration. Pass a program name when launching.

### `default`
Open-ended exploration. The agent reads the current code, identifies potential
improvements, and experiments freely within the editable files.

### `hyperparameter-tuning`
Focus on tuning constants: topK scaling, time budgets, phase allocations, HC
iteration counts, conflict thresholds, saturation thresholds.

### `search-strategy`
Focus on the search algorithm itself: DFS ordering heuristics, pruning strategies,
warm-start methods, alternative search algorithms (beam search, simulated annealing,
genetic algorithms, etc.).

### `team-allocation`
Focus on Phase 2+ (team allocation, carry re-optimization, full team refinement).
How to best resolve artifact conflicts and refine the team assignment.

### `scoring`
Focus on artifact pre-filtering and scoring: marginal weights, weight normalization,
super-artifact bounds, slot ordering heuristics.

### Custom
You can also write a custom program inline:
```
Read `.claude/agents/optimizer-research.md` and follow its instructions.
Program: custom
Focus: Only modify the hill-climbing warm-start in characterBnB.ts (the runHillClimb function).
Goal: Find better initial solutions to seed the B&B DFS.
Constraint: Do not increase per-character time by more than 20%.
```

## Analyzing Results

After experiments complete, results are in `docs/optimizer-research/results.tsv`.
Use the benchmark CLI for deeper analysis:
```bash
npm run benchmark -- run --problem "team-123::varka-normal" --diag
npm run benchmark -- compare --problem varka-normal --algo v2
```

## Parallelization

Do NOT run multiple optimizer-research agents in parallel — they modify the same files
and share the same benchmark baseline.
