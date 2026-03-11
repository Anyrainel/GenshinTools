# Artifact Score V2: Implementation Notes

## Overview

This document tracks concerns, decisions, and implementation status for the V2 scoring system described in `docs/ArtifactScoreV2.md`.

**Implementation location:** `src/lib/account-data/scorev2/`

---

## File Structure

```
src/lib/account-data/scorev2/
├── index.ts              # Public API re-exports
├── types.ts              # V2-specific types (BuildV2Weights, TeamContext, etc.)
├── autoTune.ts           # Greedy allocation + midpoint marginal weight derivation (uses real TeamBuild)
├── teamDatabase.ts       # Team compositions derived from Flagship Teams + AllCharacterBuilds presets
├── pipeline.ts           # Orchestrates full weight generation using TeamBuild damage calculator
├── scorer.ts             # V2 scoring function (main stat + substat → /300)
├── generateWeights.ts    # Offline CLI runner for batch generation
├── damageProxy.ts        # DEPRECATED stub (replaced by TeamBuild)
└── baselineBuilder.ts    # DEPRECATED stub (replaced by TeamBuild)
```

---

## Critical Decisions

### 1. Real TeamBuild Calculator (NOT Simplified Proxy)

**Decision:** Use the full `TeamBuild` damage calculator from `src/lib/team-comp/` for marginal analysis.

**Rationale:**
- The simplified proxy approach missed critical interactions: artifact set bonuses (e.g., Blizzard Strayer +40% CR), weapon passives, cross-character scaling buffs, and conditional abilities.
- These omissions led to incorrect weight derivations — e.g., overvaluing CR for characters whose set already provides it.
- The `TeamBuild` class handles the full 5-phase stat resolution pipeline: base stats → static buffs → artifact stats → target-dependent buffs → dynamic buffs → post-stats.
- Performance: ~420 damage evaluations per team context (42 greedy steps × 10 stats). With ~30 team contexts total, that's ~13,000 evaluations — well under 1 second.

**Key APIs used:**
- `new TeamBuild(configs: CharCompConfig[], combatOpts)` — Full team construction
- `TeamBuild.getTeamStats(artifactStats, calcTargetId, ctx)` — Hot-path stat resolution
- `TeamBuild.getDamageResult(charId, formulaId, teamStats, ctx, reactionOverride)` — Damage evaluation
- `StatSheet.withDelta(key, delta)` — Immutable stat perturbation for marginal analysis

### 2. Data Sources: Curated Presets (NOT Manual Database)

**Decision:** Derive team compositions from Flagship Teams preset and build recommendations from AllCharacterBuilds preset.

**Rationale:**
- The previous approach manually curated ~70 character profiles with guessed team compositions, weapons, and artifact sets.
- The Flagship Teams preset contains ~30 curated meta teams with exact weapons and artifact sets for all 4 members.
- The AllCharacterBuilds preset provides main stat recommendations for ~112 characters.
- Using real curated data ensures the damage calculations reflect actual viable team builds.

**Sources:**
- `src/presets/team-comp/[GGArtifact] Flagship Teams.json` — Team compositions
- `src/presets/artifact-builds/[GGArtifact] AllCharacterBuilds.json` — Main stat recommendations

### 3. ER and EM Modeling

ER and EM are now properly valued through the real calculator:
- ER affects Emblem of Severed Fate burst DMG% bonus, Raiden's Engulfing Lightning passive, etc.
- EM affects reaction multipliers via the real formula implementations (AmplifyFormula, CatalyzeFormula, TransformFormula)
- Artifact set bonuses that depend on EM (e.g., Wanderer's Troupe) are fully resolved

### 4. Main Stat Weight Derivation

**Decision:** First recommended main stat gets weight 100; subsequent options use the substat weight ratio.

**Future improvement:** Run the real damage calculator with each candidate main stat and compute `mainStatWeight = 100 × damage(thisStat) / damage(bestStat)`.

### 5. Ideal Roll Distribution

**Decision:** Use fixed [22, 10, 5, 5] distribution across top 4 weighted stats.

Per ArtifactScoreV2.md, this represents an idealized distribution accounting for the 4-substats-per-artifact constraint.

---

## Character Coverage

Characters are covered automatically if they appear as the DPS in a Flagship Team AND have a registered damage formula implementation.

Current coverage depends on which characters appear in Flagship Teams (~30 teams, ~25-30 DPS characters).

**Not covered (needs manual weights):**
- Support characters (Bennett, Kazuha, Zhongli, Furina, etc.) — their value isn't captured by DPS damage
- Characters without damage formula implementations
- Characters not appearing in any Flagship Team

---

## Concerns & Open Questions

### High Priority

1. **Support/Sustain builds**: Auto-tuning only works for DPS builds. Support characters need manual weight curation.

2. **Constellation variants**: All 5-star characters assumed C0. Some builds at C1/C2/C6 have significantly different profiles.

### Medium Priority

3. **Multi-weapon support**: The pipeline uses the weapon from each Flagship Team. Characters with very different weapons have different optimal profiles.

4. **Characters outside Flagship Teams**: DPS characters not in any Flagship Team need alternative team context sources.

5. **ER threshold modeling**: ER has diminishing returns beyond the rotation threshold. The damage calculator doesn't model rotation energy requirements.

### Low Priority

6. **Normalizer calibration**: The [22, 10, 5, 5] roll distribution could be calibrated against real player data.

7. **Formula selection**: Currently picks the first registered formula. Some characters have multiple formula profiles (e.g., Raiden burst vs skill).

---

## How to Extend

### Adding a New Character

Characters are automatically included if they:
1. Appear in a Flagship Team as the DPS (or via `selectedFormula`)
2. Have a registered `@RegisterCharacter` implementation in `src/lib/team-comp/impl/`
3. Have at least one damage formula defined

To add a new team context:
1. Add a team entry to the Flagship Teams preset JSON
2. The pipeline will automatically pick it up on next run

### Adjusting Main Stats

Main stat recommendations come from the AllCharacterBuilds preset. Update the build entry for the character in that preset to change sands/goblet/circlet options.

---

## Future Work

- [ ] Integrate V2 scorer into the UI alongside V1
- [ ] Add toggle in artifact score settings for V1/V2 mode
- [ ] Add constellation-specific weight variants
- [ ] Support characters not in Flagship Teams via auto-generated team contexts
- [ ] Calibrate normalizers against real player data
- [ ] Improve formula selection (use combo formulas when available)
