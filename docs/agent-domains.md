# Domain Systems & Data Flow

## Data Flow

1. **Static game data** (`src/data/*.json`) is the immutable source of truth.
2. **User data** enters via GOOD Format (JSON), Mona/yas Format (artifact-only JSON), Enka.Network (UID), or preset subscription → persists in `localStorage`.
3. **Preset system**: presets in `src/presets/artifact-builds/` serve as the **Immutable Base**. They DO NOT exist in `useBuildsStore` directly.
4. **Build Store (`useBuildsStore`)**: Contains **ONLY** User Overrides, Custom Builds, and Ordering. It is a Delta Store. **DO NOT** read `builds` directly for scoring.
5. **Build Resolution**: `useResolvedBuilds` (single char) / `useAllResolvedBuilds` (all chars) are the **Single Source of Truth**. They merge Preset Base + Store Deltas.
   - **Rule**: Always use these hooks to get builds. Never traverse `useBuildsStore.builds` or `presetRegistry` manually.
6. **Merge → Filter pipeline**: `greedyMerge` / `smartMerge` → `computeFilters` → lock/trash scripts.
7. **Zero `any`**: all external data must be typed and validated.

Also read `docs/data-mutation-map.md` before modifying any store, data import path, or artifact operation.

## Build Evaluation & Insight Engine (Account Data)

`src/lib/account-data/`:
- **Build Evaluation** (`buildEvaluation.ts`): Per-character archetype classification (DPS/Support), slot completion, efficiency tiers (S/A/B/C/F).
- **Insight Engine** (`insightEngine.ts`): Generates actionable recommendations (EQUIP, SWAP, UPGRADE, REROLL, FARM, FIX_MAIN) with score differentials.
- **Triage** (`triage/`): Probability-based artifact evaluation with P/Q/N/T tiers and special rules.
- **AutoTune** (`scoring/autoTune.ts`): Generates stat weights via marginal damage analysis using real TeamBuild calculator.

## Damage Calculation (Team Comp)

`src/lib/team-comp/`:
- **Character implementations** (`impl/`): 70+ characters with per-character formulas, buffs, and `defaultRotation` data.
- **Damage formulas** (`damageFormulas.ts`): 6 formula types (Direct, Amplify, Catalyze, Transform, Lunar, LunarDirect).
- **Buff system** (`damageBuffs.ts`): StatBuff, ScalingBuff, CrossScalingBuff with source tracking and buff validation.
- **Stat resolution** (`damageModels.ts`): StatSheet (immutable two-level map), zone-based damage with DamageTagFilter scoping.
- **Optimizer V2** (`optimizer/`): Branch-and-bound per-character → conflict-aware team DFS. Web Worker parallelization.
- **Combo/Rotation** (`types.ts`): Multi-character rotation evaluation with per-line reaction overrides.

## Cloudflare Functions (CORS Proxy)

`functions/api/enka/[[path]].ts` — proxies `/api/enka/*` → `https://enka.network/api/*` for CORS. Frontend caller: `src/lib/account-data/enkaFetcher.ts`.
