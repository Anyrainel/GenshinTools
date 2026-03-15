# Handling Saturated Characters in the Team Optimizer

## Problem Statement

Some support characters contribute buffs that don't scale from artifact stats. For example, Bennett's Fantastic Voyage buff scales from **base ATK** (character level + weapon ATK), which is fixed regardless of artifacts. When the optimizer runs B&B for such characters, every artifact combination produces identical team damage, making the search both wasteful and unpredictable — the final build is determined by DFS visit order rather than any meaningful ranking.

Symptoms observed:
- Bennett assigned level 0, unupgraded ATK% artifacts (whatever DFS found first)
- Wasted computation: full B&B explores millions of equivalent builds
- "Freeze All" locks meaningless artifact assignments, constraining future teams unnecessarily
- The "Saturated" tooltip gives no explanation of *why* artifacts don't matter

### Two kinds of saturation

| Kind | Description | Example |
|------|-------------|---------|
| **Intrinsic** | Character's buff reads a stat that artifacts cannot change (baseAtk, charLevel). No artifact combination affects team damage. | Bennett Q (baseAtk → atk), Kujou Sara Q (baseAtk → atk) |
| **Cap-induced** | A `ScalingBuff` has a `cap` that is already reached with current artifacts. Further stat investment yields diminishing-then-zero marginal gain. | Shenhe's Icy Quill (atk × scale, capped), Nahida A4 (EM → EM share, capped at 250) |

Cap-induced saturation is **partial** — the character has non-zero marginal gains up to the cap, then zero beyond it. The optimizer handles this correctly today via the marginal-gains scoring: once a stat's marginal gain drops to zero, B&B naturally deprioritizes it. **No changes needed for cap-induced saturation.**

The focus of this design is **intrinsic saturation** — characters for whom the entire B&B is pointless.

---

## Design

### 1. Early Saturation Detection (pre-Phase 1)

Before Phase 1 B&B, test each support character for intrinsic saturation:

```
For each support charId:
  1. Evaluate team damage with empty artifact sheet for charId  →  dmgEmpty
  2. Build a "super-artifact" sheet: for each stat, take the maximum
     value achievable from any single artifact across all 5 slots
  3. Evaluate team damage with super-artifact sheet for charId   →  dmgSuper
  4. If (dmgSuper - dmgEmpty) / max(dmgEmpty, 1) < ε (e.g. 0.001 = 0.1%)
     → mark charId as "saturated"
```

**Why super-artifact upper bound?** If even the theoretical maximum stats don't meaningfully change damage, no real artifact combination can either. This is a sound, cheap check (2 damage evaluations per character). The super-artifact already exists in the B&B infrastructure (`buildSuperArtifact`).

**Relative threshold ε = 0.1%**: Use a small relative threshold rather than strict equality. This catches cases where a weapon passive adds a negligible damage contribution (e.g., Aquila Favonia proc on Bennett), preventing false negatives from floating-point differences. Characters with only a tiny personal damage contribution are effectively saturated and should not consume optimization budget. If the threshold proves too aggressive, it can be tightened or made configurable.

### 2. Skip B&B for Saturated Characters

Saturated characters are **excluded from Phase 1 B&B, Phase 1b contested resolution, Phase 2 DFS, Phase 3 carry re-opt, and Phase 3b iterative re-opt.** They don't produce `topKByChar` entries.

This means:
- No wasted B&B evaluations
- No top-K entries that compete for artifacts in the DFS
- Non-saturated characters get first pick of the artifact pool

### 3. Heuristic Fill (post-Phase 3b)

After all non-saturated characters have been assigned and re-optimized, assign artifacts to saturated characters using a heuristic scoring pass:

```
For each saturated charId:
  1. Collect remaining artifacts (not assigned to any non-saturated character)
  2. Filter by artifact set constraints (4pc / 2+2 if configured)
  3. Filter by ER/CR targets:
     - Compute baseline ER/CR from non-artifact sources
     - Prefer artifacts that help meet ER/CR targets
  4. Score remaining artifacts using buildMatch.statWeights via
     computeWeightScore() — the same heuristic used for B&B pre-sorting
  5. Pick the top-scoring artifact per slot
  6. Tiebreaker when scores are equal: prefer higher artifact level
```

**Build weights source**: The `buildMatch` from the Builds page provides per-stat weights (e.g., HP%: 100, ER: 80). These reflect what stats are generally valuable for the character's role — even if they don't affect team damage in this specific formula, they produce a sensible-looking artifact assignment. If no `buildMatch` exists, use a minimal fallback: prefer ER substats (universally useful) and higher artifact levels.

**No CR/CD fallback**: The current `{ cr: 100, cd: 100 }` fallback for missing build matches is removed for saturated characters. CR/CD substats are meaningless for a character that doesn't deal damage. The build weights from the Builds page are always preferred.

**Set constraint handling**: Saturated characters may have artifact set requirements (e.g., Noblesse 4pc on Bennett). If the set buff is assumed active (i.e., the damage formula already accounts for it), all 4pc Noblesse builds produce equal damage, and the heuristic fill just needs to pick 4 Noblesse pieces from the remaining pool. If the set buff actually changes damage (the 4pc bonus IS conditional), the saturation check would detect a damage difference and the character would NOT be flagged as saturated — they'd go through normal B&B.

**ER/CR enforcement**: Even though artifacts don't affect damage, the user may need ER for burst uptime or CR for Favonius procs. The heuristic fill respects the existing `targetEr` and `targetCr` from `PerCharConfig`. Implementation approach:
- For sands/goblet/circlet: strongly prefer main stats that help meet ER/CR targets
- For substats: score ER/CR contributions additively when below target
- If targets cannot be met from remaining pool, assign best-effort and report a fail reason

### 4. Freeze-All Skips Saturated Characters

In `TeamOptDetail.tsx`'s `onFreezeAll` handler:

```
For each charId in optimizedArtifactsByChar:
  if charId has no marginal gains in optimizedDisplayResult → skip
  else → include in freeze
```

Rationale: saturated characters' artifacts are assigned by heuristic filling from the leftover pool. Freezing them would lock arbitrary artifacts, unnecessarily constraining future optimizations of other teams. Users can still freeze individual saturated characters manually if desired.

### 5. Improved Saturated Tooltip

Update the tooltip to explain *why* and guide the user:

**English:**
> This character has no artifact stats that affect team damage (e.g. buff scales from base ATK only). Artifacts are filled from leftover pool using general stat preferences. Set an ER or Favonius CR requirement if needed.

**Chinese:**
> 该角色没有影响队伍伤害的圣遗物属性（如增益仅基于基础攻击力）。圣遗物从剩余池中按通用偏好分配。如有需要请设置充能或西风暴击要求。

The existing short label "Saturated" / "已饱和" remains unchanged.

### 6. Marginal Gains View for Saturated Characters

When the user opens the "Marginal Gains" tab for a saturated character, instead of the current generic message, show a more informative panel:

> **No marginal gains**: This character's contributions to team damage are independent of artifact stats.
> If you need ER for burst uptime or CR for Favonius, set the requirement in the character config — the optimizer will fill artifacts from the remaining pool to meet it.

---

## Implementation Outline

### optimizerV2.ts

1. **New helper**: `detectSaturatedChars(supportCharIds, teamBuild, inventory, baseSheets, calcContext, ...)` → `Set<string>`
   - For each support, build empty sheet + super-artifact sheet, evaluate damage, compare
   - Return set of saturated charIds

2. **Phase 1 loop**: Skip charIds in the saturated set. Don't produce `topKByChar` entries.

3. **New Phase 4: Heuristic Fill** (after Phase 3b, before final set detection):
   - Collect all assigned artifact IDs from `bestArtifactsByChar` (non-saturated characters)
   - For each saturated charId:
     - Filter remaining inventory by slot, set constraints, and exclusion set
     - Score using `computeWeightScore` with `charConfig.buildMatch`
     - Apply ER/CR target enforcement (prefer ER/CR main stats and substats)
     - Tiebreak by artifact level (descending)
     - Assign top pick per slot to `bestArtifactsByChar[charId]`

4. **`TopKCollector`**: No changes needed — saturated characters don't use it.

### TeamOptDetail.tsx

5. **`onFreezeAll` handler**: Before freezing a character, check if their marginal gains (from `optimizedDisplayResult` or `optimizedComboDisplayResult`) are empty. Skip characters with no marginal gains.

### StatSheetPanel.tsx

6. **Saturated tooltip**: Update i18n strings for `saturatedTooltip` with the improved text.

### i18n-ui.ts

7. **Updated strings**: `saturatedTooltip` (en + zh), new `saturatedMarginalHint` for the marginal gains tab.

---

## What This Does NOT Change

- **Cap-induced partial saturation**: Characters whose buff has a `cap` still go through normal B&B. The existing marginal-gains scoring correctly deprioritizes capped stats. No changes.
- **Carry characters**: Only supports are candidates for saturation detection. Carries always run B&B.
- **Manual freeze**: Users can still manually freeze a saturated character. Only "Freeze All" auto-skips them.
- **Artifact set detection**: The final set detection phase still runs for saturated characters (their heuristic-filled artifacts may form a set bonus).

---

## Edge Cases

| Case | Handling |
|------|----------|
| Saturated character with ER/CR target | Heuristic fill enforces targets. If unmet from remaining pool, report fail reason. |
| Saturated character with artifact set requirement | Heuristic fill filters by set. If not enough set pieces remain, relax to rainbow and report fail reason. |
| All characters are saturated (e.g., no formula selected) | All get heuristic fill. Phase 1–3b are no-ops. |
| Character is saturated but has a build match with weights | Build weights are used for heuristic scoring — produces a sensible assignment matching the build's preferred stats. |
| Character is saturated with no build match | Fallback: prefer ER substats + higher artifact level. No CR/CD fallback. |
| Weapon passive adds tiny personal damage (e.g., Aquila proc on Bennett) | Caught by ε threshold (< 0.1% relative damage). Treated as saturated. |
| Character has both saturated and non-saturated buffs | Saturation check uses total team damage, so any non-saturated buff contribution keeps them out of the saturated set. |
