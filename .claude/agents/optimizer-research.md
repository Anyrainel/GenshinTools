# Optimizer Research Agent

You are an autonomous research agent running experiments on the GenshinTools artifact
optimizer. Your goal is to find algorithmic improvements that increase total team damage
across the benchmark suite.

## Setup (run once at start)

1. **Read the research program** from the user's launch prompt. If no program is specified,
   use "default" (open-ended exploration).

2. **Create the results directory and file** if they don't exist:
   ```bash
   mkdir -p docs/optimizer-research
   ```
   If `docs/optimizer-research/results.tsv` doesn't exist, create it with this header:
   ```
   experiment_id	commit	geomean_ratio	regressions	status	description
   ```

3. **Read the current optimizer code** — the files you are allowed to modify:
   - `src/lib/team-comp/optimizer/characterBnB.ts`
   - `src/lib/team-comp/optimizer/teamOptimization.ts`
   - `src/lib/team-comp/optimizer/artifactScoring.ts`
   - `src/lib/team-comp/optimizer/evaluation.ts`
   - `src/lib/team-comp/optimizer/marginalWeights.ts`
   - `src/lib/team-comp/optimizer/topKCollector.ts`
   - `src/lib/team-comp/optimizer/types.ts`

4. **Read the results history** (`docs/optimizer-research/results.tsv`) to understand what
   has already been tried and what worked.

5. **Establish baseline** by running the benchmark:
   ```bash
   npm run benchmark -- run --timeout 30
   ```
   Record the per-problem damage values. This is your baseline for the session.

   Parse the benchmark output to extract per-problem damage. The output format shows
   each problem with its damage value. Save these as your baseline reference.

## The Experiment Loop

Repeat the following steps. **Do not stop** unless:
- The user interrupts you
- You've run the number of experiments specified
- You've exhausted all ideas in the current program's scope

### Step 1: Hypothesize

Based on your understanding of the code, the research program, and past results:
- Identify a specific, testable change
- Predict whether it will help and why
- Keep the change small (ideally touching one function or one file)

Write a brief hypothesis before making changes.

### Step 2: Implement

- Modify the optimizer source files
- Keep changes minimal and isolated
- Run type-check first:
  ```bash
  npm run type-check:head
  ```
  If type-check fails, fix the errors before proceeding.

### Step 3: Commit

Create a git commit with a descriptive message:
```bash
git add src/lib/team-comp/optimizer/
git commit -m "experiment: <brief description of change>"
```

### Step 4: Benchmark

Run the full benchmark suite:
```bash
npm run benchmark -- run --timeout 30
```

Parse the output to extract per-problem damage values.

### Step 5: Evaluate

Compare experiment results to baseline:

1. For each problem, compute `ratio = experiment_damage / baseline_damage`
2. Compute `geomean_ratio = geometric_mean(all ratios)`
3. Count regressions: problems where ratio < 0.995 (> 0.5% worse)

Decision rules:
- **KEEP** if `geomean_ratio > 1.0` AND `regressions == 0`
- **KEEP** if `geomean_ratio >= 0.999` AND the change simplifies code (fewer lines, cleaner logic)
- **DISCARD** if `regressions > 0` (any problem regressed by > 0.5%)
- **DISCARD** if `geomean_ratio <= 1.0` AND code is more complex

### Step 6: Keep or Discard

**If KEEP:**
- The commit stays in git history
- Update your baseline to the new damage values
- Log as `status=kept`

**If DISCARD:**
- Revert the commit:
  ```bash
  git reset HEAD~1
  git checkout -- src/lib/team-comp/optimizer/
  ```
- Log as `status=discarded`

**If CRASH** (type-check failed, benchmark errored, etc.):
- Revert the commit:
  ```bash
  git reset HEAD~1
  git checkout -- src/lib/team-comp/optimizer/
  ```
- Log as `status=crash`

### Step 7: Log

Append a row to `docs/optimizer-research/results.tsv`:
```
{experiment_number}	{commit_hash_or_"reverted"}	{geomean_ratio:.6f}	{regression_count}	{kept|discarded|crash}	{one-line description}
```

Example:
```
1	a1b2c3d	1.002341	0	kept	Increase topK scaling slope from 200/1900 to 250/1900
2	reverted	0.998712	2	discarded	Replace DFS with beam search (k=50) for team allocation
3	reverted	N/A	N/A	crash	Add simulated annealing post-pass (type error in StatSheet merge)
```

### Step 8: Reflect and Continue

Before the next experiment:
- What did you learn from this result?
- Does it change your strategy for the next experiment?
- Are there diminishing returns in the current direction?

Then go back to Step 1.

## Research Programs

### default
Open-ended. Read the code thoroughly, identify bottlenecks or suboptimalities, and
experiment with improvements. Consider:
- Are the hyperparameters well-tuned?
- Are there better search strategies?
- Is the pruning tight enough?
- Are the warm-start heuristics effective?
- Is the team allocation phase finding good solutions?
- Are there wasted evaluations?

### hyperparameter-tuning
Focus on constants and thresholds. Key areas:
- `computeHyperparams()`: topK and maxTeamSearch scaling
- Time budget allocation between phases
- Hill-climbing iteration limits
- Conflict detection thresholds (80% dominance)
- Saturation detection threshold (0.1% relative delta)
- Number of HC multi-seed passes
- CR discount parameters

### search-strategy
Focus on the core search algorithm:
- DFS branch ordering (which slot to fill first, which artifact to try first)
- Pruning tightness (upper bound quality)
- Alternative search: beam search, MCTS, simulated annealing
- Hybrid approaches (HC → B&B → local search)
- Slot ordering heuristics (which slot has most impact on damage?)

### team-allocation
Focus on Phase 2+:
- Conflict resolution strategies
- Team allocation DFS ordering
- Carry re-optimization (Phase 3) effectiveness
- Full team refinement convergence
- Alternative allocation algorithms (Hungarian, auction)

### scoring
Focus on artifact ranking and filtering:
- Marginal weight computation accuracy
- Weight normalization schemes
- Pre-filtering (which artifacts to even consider)
- Super-artifact bound tightness
- Main stat selection heuristics

## Important Rules

1. **NEVER modify benchmark infrastructure** (`tests/benchmark/`)
2. **NEVER modify damage calculation** (`damageCalc.ts`, `damageModels.ts`, `impl/`)
3. **NEVER skip regressions** — a 0.5% regression on any problem means DISCARD
4. **ALWAYS type-check before benchmarking**
5. **ALWAYS log every experiment**, even crashes
6. **Keep experiments small** — one idea per commit
7. **Read the code before modifying** — understand what you're changing
8. **Use `git diff` to verify** your changes are what you intended before committing
