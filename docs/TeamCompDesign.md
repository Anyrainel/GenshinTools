# Team Comp Page & Artifact Optimization Design

## 1. Goal
Redesign the `/team-comp` page to integrate with the new `team-comp` damage calculation module and implement an artifact optimization flow.

## 2. Store & State Management (`useTeamStore`)
- Replace implicit layouts with a tracked `activeTeamId` to easily focus the user's currently selected team layout.
- Use a `Record<string, number>` for `targetEr` (mapping `charId` to target ER) to allow position-independent overrides.
- Track `opts` (Combat Options) globally per team.
- Track `selectedFormula: { charId: string, formulaId: string } | null` per team.
- Track `optimizationResult: OptimizationResult | null` per team.
- Support importing and exporting of teams to JSON.

## 3. UI Redesign
- **Team List Mode**: A grid of `TeamCard` components.
- **Detailed Opt View (Full-Screen Modal)**:
  - When clicking "Optimize/Evaluate" on a `TeamCard`, transition to a full-screen view (fixed container with a "Back" button at the top). Do not use an easily-dismissed Dialog/Drawer where clicking outside loses context.
  - **Formula Selection**: Render as visually distinct tabs or a large selector, categorized by character, so it stands out from combat options.
  - **Options Section**: Render character/weapon icons next to the option title.
    - If the option has exactly 2 choices, render it as a Toggle (`[LabelA] [Toggle] [LabelB]`).
    - `useLanguageContext` will be expanded to provide a helper that resolves `I18nLabel` into strings.
  - **Results Section**:
    - Show the current damage (using currently equipped artifacts on the account for the selected formula).
    - Display optimized artifacts using existing components (`ArtifactDataHoverCard`).
    - **TODO**: Display active (and inactive) buffs evaluated during the run.
    - **DONE**: Break down the damage formula via `display()` → `DisplayPart` (template, params, statValues, scalingKeys).

## 4. Optimizer Logic (`useAsyncCompute` & Heuristics)
- Execution: Run the optimizer on the main thread via `useAsyncCompute` to prevent UI freezing without needing a complex Web Worker setup.
- Heuristic Pruning: Use `artifactScore.ts` logic to evaluate the inventory against the selected character's `ResolvedBuild` (preset). We will take the top N artifacts per slot to aggressively prune the permutation space.
- Filter valid sets based on `artifactSetId` or `artifactHalfSetIds` from the `Team` config.
- Rank the valid permutations that meet the ER requirements by evaluating the actual `TeamBuild` damage formula, yielding control back to the browser every N iterations.
