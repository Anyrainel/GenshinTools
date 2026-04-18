import type { Element } from "@/data/types";
import { getNextLevelTier } from "@/lib/gameStatsLoader";
import {
  type BuffActivationMap,
  type CalcContext,
  type ComboFormula,
  type ComboLine,
  type ComboResult,
  type DamageResult,
  type DamageTag,
  type DisplayPart,
  type DisplayResult,
  type ExtraBuff,
  type FormulaEntry,
  type OptimizerContext,
  type OptionMap,
  type ProvidedStaticBuff,
  type ReactionOverride,
  type ResolvedBuff,
  type ResolvedStatEntry,
  type StatEntry,
  type StatKey,
  type TeamSlotConfig,
  filterMatchesTag,
} from "../types";
import { CharBuild } from "./charBuild";
import {
  type EvaluatedDynamicBuff,
  annotateScalingInfo,
  evaluateDynamicBuffsTwoPass,
  isDeferredFinalBuff,
} from "./damageCalc";
import { fieldReq, isFieldDependentReceiver, isOnField } from "./fieldState";
import {
  defaultOnFieldCharId,
  isPartOffField,
  resolvePartOnFieldCharIds,
} from "./fieldState";
import type { CharacterBase } from "./implModel";
import { computeSubstatMarginals } from "./marginalGain";
import { exclusionKey } from "./stackAllocation";
import {
  type ComboLineEval,
  type FormulaEval,
  type PartialBuffInfo,
  type StackLimitedBuffInfo,
  buildPartialBuffInfos,
  buildStatVariants,
  buildUserOverrideInfos,
  collectStackLimitedBuffs,
  computeBlendedDamage,
  computeComboDefaultActivation,
  computeDefaultActivation,
} from "./stackAllocation";
import {
  CrossScalingBuff,
  ScalingBuff,
  type StatBuff,
  TeamAggregationBuff,
  createExtraStatBuffs,
  deduplicateBuffs,
  getBuffInstanceKey,
  isBuffApplicable,
} from "./statBuff";
import { bespokeMaxStacks, buildBespokeOverlay } from "./statSheet";
import { StatSheet } from "./statSheet";
import { TeamFormulaCatalog } from "./teamFormulaCatalog";
import { TeamMeta } from "./teamMeta";
import { LUNAR_RANK_WEIGHTS, TeamReaction } from "./teamReaction";
export { TeamFormulaCatalog } from "./teamFormulaCatalog";
import { TeamResonance } from "./teamResonance";

/** Widen min/max range on resolved dynamic entries using alternate values. */
function widenDynamicRange(
  entries: ResolvedStatEntry[],
  altValues: readonly StatEntry[]
): void {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const alt = altValues[i];
    if (!alt || e.key !== alt.key) continue;
    const curMin = e.minValue ?? e.value;
    const curMax = e.maxValue ?? e.value;
    const newMin = Math.min(curMin, alt.value);
    const newMax = Math.max(curMax, alt.value);
    if (newMin !== newMax) {
      e.minValue = newMin;
      e.maxValue = newMax;
    }
  }
}

/** Widen min/max range on a ResolvedBuff's dynamic entries from another context. */
function mergeBuffDynamicRange(
  existing: ResolvedBuff,
  incoming: ResolvedBuff
): void {
  widenDynamicRange(existing.dynamicEntries, incoming.dynamicEntries);
}

/** Mutate postStats in-place: apply per-character CR-target deltas when present. */
function applyCrTargetDeltas(
  postStats: Record<string, StatSheet>,
  ctx?: CalcContext
): void {
  if (!ctx?.perCharCrTarget) return;
  for (const [id, target] of Object.entries(ctx.perCharCrTarget)) {
    if (postStats[id]) {
      const crDelta = (100 - target) / 100;
      postStats[id] = postStats[id]!.withDelta("cr", crDelta);
    }
  }
}

/**
 * Orchestrates the full team's damage calculation.
 * Owns the stat resolution pipeline across all 4 team members.
 *
 * Construction is immutable (team composition + OptionMap).
 * `getTeamStats(artifactStats, onFieldCharId)` is the hot path.
 */
export class TeamBuild {
  readonly charBuilds: Record<string, CharBuild>;
  readonly teamMeta: TeamMeta;
  readonly teamResonance: TeamResonance;
  readonly allStaticBuffs: ProvidedStaticBuff[];
  /** Team-wide reaction formula provider (transformative + lunar). */
  readonly reactionProvider: TeamReaction;
  /** Original configs used to construct this TeamBuild (for reconstruction). */
  readonly configs: TeamSlotConfig[];
  /** Original combat opts used to construct this TeamBuild (for reconstruction). */
  readonly combatOpts: OptionMap;
  /** Enemy persistent element aura (for reconstruction). */
  readonly enemyAura?: Element;
  /** Extra buffs (food/env/status/custom) applied to stat sheets. */
  readonly extraBuffs: ExtraBuff[];
  /** Enemy context used for baseline lunar rank computation. */
  readonly baselineCtx: CalcContext;
  /** Formula catalog: flat index, formula queries, and reaction provider. */
  readonly catalog: TeamFormulaCatalog;
  /** Flat index of all formula entries (character + reaction), keyed by formula ID. */
  readonly formulaIndex: Map<string, FormulaEntry>;

  constructor(
    configs: TeamSlotConfig[],
    combatOpts: OptionMap = {},
    enemyAura?: Element,
    extraBuffs: ExtraBuff[] = [],
    /**
     * Optional pre-built CharBuilds keyed by charId. When provided, their stat
     * sheets are reset and reused instead of constructing new CharacterBase /
     * WeaponBase / ArtifactSetBase instances. The caller must guarantee that
     * each cached build was created with a TeamMeta whose self-constellation,
     * weapon, artifact set, and combat options match the corresponding config.
     * (Other characters' constellations in the original TeamMeta are irrelevant
     * because no implementation checks cross-character constellation/refinement.)
     */
    cachedCharBuilds?: Record<string, CharBuild>,
    /**
     * Enemy context used for baseline lunar rank computation. Only the
     * relative damage between contributors matters for ranking, but using
     * the caller's actual ctx keeps results consistent across paths.
     */
    baselineCtx?: Partial<CalcContext>
  ) {
    this.configs = configs;
    this.combatOpts = combatOpts;
    this.enemyAura = enemyAura;
    this.extraBuffs = extraBuffs;
    this.baselineCtx = {
      enemyLevel: baselineCtx?.enemyLevel ?? 110,
      enemyRes: baselineCtx?.enemyRes ?? 0.1,
      rollMultiplier: baselineCtx?.rollMultiplier ?? 0.85,
      substatBudget: baselineCtx?.substatBudget ?? "8_6",
    };
    const charIds = configs.map((c) => c.charId);
    const constellations: Record<string, number> = {};
    const artifactSets: Record<string, string> = {};
    for (const c of configs) {
      if (c.artifactSetId) artifactSets[c.charId] = c.artifactSetId;
      constellations[c.charId] = c.constellation;
    }
    this.teamMeta = new TeamMeta(
      charIds,
      constellations,
      artifactSets,
      enemyAura
    );
    this.teamResonance = new TeamResonance(this.teamMeta);

    // Create or reuse CharBuilds
    this.charBuilds = {};
    if (cachedCharBuilds) {
      for (const config of configs) {
        const cached = cachedCharBuilds[config.charId];
        if (cached) {
          cached.resetStatSheet();
          this.charBuilds[config.charId] = cached;
        } else {
          this.charBuilds[config.charId] = new CharBuild(
            config,
            this.teamMeta,
            combatOpts
          );
        }
      }
    } else {
      for (const config of configs) {
        this.charBuilds[config.charId] = new CharBuild(
          config,
          this.teamMeta,
          combatOpts
        );
      }
    }

    // Collect all static buffs across the team
    this.allStaticBuffs = this.teamResonance.buffs.map((buff) => ({
      buff,
      providerCharId: "resonance",
    }));
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      for (const buff of build.getAllBuffs()) {
        this.allStaticBuffs.push({ buff, providerCharId: charId });
      }
    }

    // Add extra buffs (food/env/status/custom) as first-class StatBuffs
    if (extraBuffs.length > 0) {
      for (const buff of createExtraStatBuffs(extraBuffs)) {
        this.allStaticBuffs.push({ buff, providerCharId: "extra" });
      }
    }

    // Apply field-independent static buffs (self, other, team) at construction.
    // Field-dependent buffs (*OnField, *OffField) are deferred to getTeamStats.
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      build.applyStaticBuffs(
        this.allStaticBuffs,
        charId,
        this.teamMeta.regions[charId],
        this.teamMeta.factions[charId]
      );
    }

    // Build team-wide reaction formulas after CharBuilds are constructed
    const charBases: Record<string, CharacterBase> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      charBases[id] = build.charBase;
    }
    this.reactionProvider = new TeamReaction(this.teamMeta, charBases, configs);

    // Pre-compute rank weights for multi-contributor lunar formulas
    // using baseline stats (no artifacts) so ranking is deterministic.
    this.computeBaselineLunarRanks(configs);

    // Build catalog (owns formulaIndex + formula-metadata queries)
    this.catalog = new TeamFormulaCatalog(
      this.charBuilds,
      this.reactionProvider
    );
    this.formulaIndex = this.catalog.formulaIndex;
  }

  /**
   * Compute rank weights for multi-contributor lunar reactions from baseline
   * stats (base + weapon + static buffs, no artifacts). This determines
   * a fixed ranking that both the compiled and interpreted paths use consistently.
   */
  private computeBaselineLunarRanks(configs: TeamSlotConfig[]): void {
    const emptySheet = new StatSheet([]);
    const emptySheets: Record<string, StatSheet> = {};
    for (const c of configs) emptySheets[c.charId] = emptySheet;

    // Get baseline team stats (no artifacts; use first char as on-field — only
    // relative ranking matters here, so the choice is arbitrary).
    const baselineStats = this.getTeamStats(emptySheets, configs[0].charId);

    // Iterate base reaction IDs (not per-triggerer) to avoid duplicate computation
    for (const baseId of this.reactionProvider.getBaseReactionIds()) {
      // Pick any per-triggerer entry to get the formula
      const eligible = this.reactionProvider.getEligibleCharacters(baseId);
      if (eligible.length === 0) continue;
      const sampleEntry = this.reactionProvider.getFormulaEntry(
        `${baseId}-${eligible[0]}`
      );
      if (!sampleEntry) continue;
      if (!this.reactionProvider.isMultiContributor(`${baseId}-${eligible[0]}`))
        continue;

      const formula = sampleEntry.parts[0].formula;
      const contributions: { charId: string; damage: number }[] = [];
      for (const config of configs) {
        if (!eligible.includes(config.charId)) continue;
        const stats = baselineStats[config.charId];
        if (!stats) continue;
        const damage = formula.calc(stats, config.charLevel, this.baselineCtx);
        contributions.push({ charId: config.charId, damage });
      }

      contributions.sort((a, b) => b.damage - a.damage);
      const weights = new Map<string, number>();
      for (let i = 0; i < contributions.length; i++) {
        weights.set(contributions[i].charId, LUNAR_RANK_WEIGHTS[i] ?? 0);
      }
      this.reactionProvider.setRankWeights(baseId, weights);
    }
  }

  /**
   * Collect dynamic buffs from allStaticBuffs, evaluated against pre-stats.
   * Uses construction-time buff references for consistency with resolveBuffs.
   */
  /**
   * Collect dynamic buffs using two-pass evaluation.
   * See evaluateDynamicBuffsTwoPass for the algorithm.
   */
  private collectDynamicBuffs(
    preStats: Record<string, StatSheet>,
    _teamPreStatsArr: StatSheet[],
    onFieldCharId: string
  ): EvaluatedDynamicBuff[] {
    return evaluateDynamicBuffsTwoPass(
      this.allStaticBuffs,
      preStats,
      (sheetBuffs) =>
        this.buildTeamPostStats(preStats, sheetBuffs, onFieldCharId)
    );
  }

  // ─── Centralized buff applicability helpers ──────────────────────────────
  /** isBuffApplicable with automatic teamMeta region/faction lookup. */
  private isBuffApplicableForChar(
    buff: StatBuff,
    providerCharId: string,
    selfCharId: string,
    selfIsOnField: boolean
  ): boolean {
    return isBuffApplicable(
      buff,
      providerCharId,
      selfCharId,
      selfIsOnField,
      this.teamMeta.regions[selfCharId],
      this.teamMeta.factions[selfCharId]
    );
  }

  /**
   * Does this buff apply to ANY team member in either field state?
   *
   * Used as a display pre-filter in resolveBuffs, which shows buffs for a
   * formula that may contain both on-field and off-field parts. Intentionally
   * permissive — Layer 2.5 (fieldReq vs partOffField) narrows per-part.
   */
  private isBuffApplicableForTeam(
    buff: StatBuff,
    providerCharId: string
  ): boolean {
    for (const cid of Object.keys(this.charBuilds)) {
      if (this.couldBuffApplyToChar(buff, providerCharId, cid)) return true;
    }
    return false;
  }

  /**
   * Does this buff apply to a specific character in EITHER field state?
   *
   * Use this (not `isBuffApplicableForChar(..., true)`) whenever the caller
   * only knows the carry/line char and does NOT know the field state of each
   * formula part. Hardcoding `selfIsOnField=true` silently drops buffs whose
   * receiver is selfOffField/otherOffField/teamOffField, even when the formula
   * contains off-field parts that should receive them. Layer 2.5
   * (fieldReq vs partOffField) narrows correctly per-part later.
   */
  private couldBuffApplyToChar(
    buff: StatBuff,
    providerCharId: string,
    selfCharId: string
  ): boolean {
    return (
      this.isBuffApplicableForChar(
        buff,
        providerCharId,
        selfCharId,
        true /* on-field */
      ) ||
      this.isBuffApplicableForChar(
        buff,
        providerCharId,
        selfCharId,
        false /* off-field */
      )
    );
  }

  /**
   * Collect field-dependent static buffs for each character.
   *
   * Char-level field state: each character is classified on/off via
   * isOnField(charId, onFieldCharId). This runs before formula parts exist,
   * so part-level field status is unavailable. The two-sheet pattern
   * (on-field sheet + off-field sheet) is built by calling this twice
   * (once with onFieldCharId=charId, once with defaultOnFieldCharId), and formula evaluation
   * selects the correct sheet per part via isPartOffField.
   */
  private getFieldDependentBuffs(
    onFieldCharId: string
  ): Record<string, ProvidedStaticBuff[]> {
    const result: Record<string, ProvidedStaticBuff[]> = {};
    for (const charId of Object.keys(this.charBuilds)) {
      result[charId] = this.allStaticBuffs.filter((b) => {
        if (!isFieldDependentReceiver(b.buff.target.receiver)) return false;
        return this.isBuffApplicableForChar(
          b.buff,
          b.providerCharId,
          charId,
          isOnField(charId, onFieldCharId)
        );
      });
    }
    return result;
  }

  /**
   * Apply dynamic buffs to preStats for all team members.
   * When `ctx.perCharCrTarget` is provided, applies CR-target delta adjustment.
   * Without ctx, used as the intermediate "midStats" step in two-pass dynamic
   * buff evaluation so that final-stat ScalingBuffs can see sheet-stat dynamic
   * buffs (e.g. Bennett ATK).
   */
  private buildTeamPostStats(
    preStats: Record<string, StatSheet>,
    dynamicBuffs: EvaluatedDynamicBuff[],
    onFieldCharId: string,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      postStats[id] = build.getPostStats(
        preStats[id]!,
        dynamicBuffs,
        id,
        isOnField(id, onFieldCharId),
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }
    applyCrTargetDeltas(postStats, ctx);
    return postStats;
  }

  // ─── Idle stat computation (cold path) ─────────────────────────────────
  /**
   * Compute idle stat sheets for all team members (cold path, display only).
   *
   * Idle stats simulate the game's character-panel view:
   * - Base stats (character + weapon + artifact-set 2pc bonuses)
   * - Artifact main/sub stats
   * - Unconditional buffs only (no triggers, no ability/reaction filters)
   * - Dynamic (scaling) buffs evaluated from idle pre-stats
   *
   * The caller should use `StatSheet.getIdleRecord()` on each result to
   * denormalize dmg% back to per-element keys for display.
   */
  private computeIdleStatSheets(
    artifactStats: Record<string, StatSheet>
  ): Record<string, { onField: StatSheet; offField: StatSheet }> {
    // Filter to idle-eligible buffs: no triggers, no ability/reaction filters.
    // Element-only filters are allowed through — getIdleRecord() handles them:
    // dmg% with element filter → denormalized to per-element keys (pyro%, etc.),
    // all other stats with element filter → invisible (read via unfiltered get).
    const idleBuffs = this.allStaticBuffs.filter(({ buff }) => {
      if (buff.source.triggers && buff.source.triggers.length > 0) return false;
      const filter = buff.target.filter;
      if (filter?.abilities || filter?.reactions) return false;
      return true;
    });

    // Phase 1: Build separate on-field and off-field idle pre-stats per character
    const onFieldPreStats: Record<string, StatSheet> = {};
    const offFieldPreStats: Record<string, StatSheet> = {};
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      const universal: StatBuff[] = [];
      const onFieldOnly: StatBuff[] = [];
      const offFieldOnly: StatBuff[] = [];

      for (const { buff, providerCharId } of idleBuffs) {
        const fr = fieldReq(buff.target.receiver);
        if (fr === null) {
          if (
            isBuffApplicable(
              buff,
              providerCharId,
              charId,
              false,
              this.teamMeta.regions[charId],
              this.teamMeta.factions[charId]
            )
          )
            universal.push(buff);
        } else {
          const effectiveFS = fr === "on";
          if (
            isBuffApplicable(
              buff,
              providerCharId,
              charId,
              effectiveFS,
              this.teamMeta.regions[charId],
              this.teamMeta.factions[charId]
            )
          ) {
            if (fr === "on") onFieldOnly.push(buff);
            else offFieldOnly.push(buff);
          }
        }
      }

      onFieldPreStats[charId] = build.getIdlePreStats(
        artifactStats[charId] ?? new StatSheet([]),
        [...universal, ...onFieldOnly]
      );
      offFieldPreStats[charId] = build.getIdlePreStats(
        artifactStats[charId] ?? new StatSheet([]),
        [...universal, ...offFieldOnly]
      );
    }

    // Phase 2: evaluate dynamic buffs from idle-eligible providers (two-pass)
    // Use on-field pre-stats for provider stat reads (common idle display assumption)
    const dynamicEntries = evaluateDynamicBuffsTwoPass(
      idleBuffs,
      onFieldPreStats,
      (sheetBuffs) => {
        const mid: Record<string, StatSheet> = {};
        for (const [cid, build] of Object.entries(this.charBuilds)) {
          mid[cid] = build.getPostStats(
            onFieldPreStats[cid]!,
            sheetBuffs,
            cid,
            true,
            this.teamMeta.regions[cid],
            this.teamMeta.factions[cid]
          );
        }
        return mid;
      }
    );

    // Phase 3: apply dynamic buffs → separate on/off field post-stats
    const result: Record<string, { onField: StatSheet; offField: StatSheet }> =
      {};
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      result[charId] = {
        onField: build.getPostStats(
          onFieldPreStats[charId]!,
          dynamicEntries,
          charId,
          true,
          this.teamMeta.regions[charId],
          this.teamMeta.factions[charId]
        ),
        offField: build.getPostStats(
          offFieldPreStats[charId]!,
          dynamicEntries,
          charId,
          false,
          this.teamMeta.regions[charId],
          this.teamMeta.factions[charId]
        ),
      };
    }
    return result;
  }

  // ─── Team stat computation ──────────────────────────────────────────────
  /**
   * Compute final stat sheets for all team members.
   * This is the hot path during artifact optimization.
   *
   * @param artifactStats  Per-character artifact stat sheets
   * @param onFieldCharId   Who is on-field (determines onField buff routing).
   */
  getTeamStats(
    artifactStats: Record<string, StatSheet>,
    onFieldCharId: string,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    const fieldDependent = this.getFieldDependentBuffs(onFieldCharId);
    const preStats = this.buildPreStatsFromBuilds(
      artifactStats,
      fieldDependent
    );

    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(
      preStats,
      teamPreStatsArr,
      onFieldCharId
    );

    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      onFieldCharId,
      ctx
    );
  }

  /**
   * Compute final stat sheets excluding the specified buffs.
   * Rebuilds from Phase 1 baseline for each character, skipping excluded buffs
   * in both the static and dynamic buff application phases.
   */
  getTeamStatsExcluding(
    artifactStats: Record<string, StatSheet>,
    onFieldCharId: string,
    ctx: CalcContext | undefined,
    excludeKeys: Set<string>
  ): Record<string, StatSheet> {
    const fieldDependent = this.getFieldDependentBuffs(onFieldCharId);

    // Phase 2: Pre-stats (rebuilt from baseStatSheet excluding specified buffs)
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      preStats[id] = build.getPreStatsExcluding(
        artifactStats[id] ?? new StatSheet([]),
        fieldDependent[id]!,
        this.allStaticBuffs,
        excludeKeys,
        id,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }

    // Phase 3: Collect dynamic buffs, excluding specified buff keys
    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffsExcluding(
      preStats,
      teamPreStatsArr,
      excludeKeys,
      onFieldCharId
    );

    // Phase 4+5: Apply dynamic buffs → post-stats + perCharCrTarget
    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      onFieldCharId,
      ctx
    );
  }

  /** Like collectDynamicBuffs but skips buffs with matching canonical buff keys. */
  private collectDynamicBuffsExcluding(
    preStats: Record<string, StatSheet>,
    _teamPreStatsArr: StatSheet[],
    excludeKeys: Set<string>,
    onFieldCharId: string
  ): EvaluatedDynamicBuff[] {
    // Filter out excluded buffs before passing to two-pass evaluator
    const filteredBuffs = this.allStaticBuffs.filter(
      ({ buff, providerCharId }) =>
        !excludeKeys.has(getBuffInstanceKey(buff, providerCharId))
    );
    return evaluateDynamicBuffsTwoPass(filteredBuffs, preStats, (sheetBuffs) =>
      this.buildTeamPostStats(preStats, sheetBuffs, onFieldCharId)
    );
  }

  /**
   * Create a reusable context for repeated getTeamStats calls where only one
   * character's artifact sheet changes.  Caches target-dependent buff filtering
   * and support characters' preStats so the hot loop only recomputes the
   * swapped character's preStats.
   */
  createOptimizerContext(
    baseSheets: Record<string, StatSheet>,
    swapCharId: string | string[],
    onFieldCharId: string,
    ctx?: CalcContext
  ): OptimizerContext {
    const variableCharIds = Array.isArray(swapCharId)
      ? new Set(swapCharId)
      : new Set([swapCharId]);
    const primarySwapCharId = Array.isArray(swapCharId)
      ? swapCharId[0]
      : swapCharId;

    // Field-dependent buff filtering (constant for a given onFieldCharId)
    const targetDependent = this.getFieldDependentBuffs(onFieldCharId);

    // Support preStats: only for non-variable characters (their artifact sheets are baked in)
    const supportPreStats: Record<string, StatSheet> = {};
    // charBuildOrder preserves Object.entries iteration order for FP parity
    const charBuildOrder = Object.entries(this.charBuilds);
    for (const [id, build] of charBuildOrder) {
      if (!variableCharIds.has(id)) {
        supportPreStats[id] = build.getPreStats(
          baseSheets[id] ?? new StatSheet([]),
          targetDependent[id]!
        );
      }
    }

    return {
      swapCharId: primarySwapCharId,
      variableCharIds,
      onFieldCharId,
      ctx,
      targetDependent,
      supportPreStats,
      charBuildOrder,
      baseSheets,
    };
  }

  /**
   * Fast getTeamStats using a precomputed OptimizerContext.
   * Only recomputes preStats for swapCharId; reuses cached support preStats.
   * Produces identical FP results to getTeamStats.
   */
  getTeamStatsFast(
    swapCharSheet: StatSheet,
    optCtx: OptimizerContext
  ): Record<string, StatSheet> {
    const {
      swapCharId,
      onFieldCharId,
      ctx,
      targetDependent,
      supportPreStats,
      charBuildOrder,
    } = optCtx;

    // Build preStats with same key insertion order as getTeamStats
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of charBuildOrder) {
      if (id === swapCharId) {
        preStats[id] = build.getPreStats(swapCharSheet, targetDependent[id]!);
      } else {
        preStats[id] = supportPreStats[id]!;
      }
    }

    // Dynamic buffs (must recompute — may depend on swapCharId's preStats)
    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(
      preStats,
      teamPreStatsArr,
      onFieldCharId
    );

    // Post-stats + critRateTarget
    return this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      onFieldCharId,
      ctx
    );
  }

  /**
   * Pick any other team member's charId. Used to derive off-field stats
  /**
   * Build preStats for all team members from artifact sheets + field-dependent buffs.
   * Extracts the Phase 2 loop that appears in getTeamStats, getDisplayResult, etc.
   */
  private buildPreStatsFromBuilds(
    artifactStats: Record<string, StatSheet>,
    fieldDependent: Record<string, ProvidedStaticBuff[]>
  ): Record<string, StatSheet> {
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      preStats[id] = build.getPreStats(
        artifactStats[id] ?? new StatSheet([]),
        fieldDependent[id]!
      );
    }
    return preStats;
  }

  /**
   * Build pre-resolved FormulaEval[] and per-buff sans-buff stats for a formula's parts.
   * Uses resolvePartOnFieldCharIds to determine the correct stats per part.
   */
  private buildPartEvals(
    charId: string,
    entry: FormulaEntry,
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    forceOnField?: boolean,
    stackLimited?: StackLimitedBuffInfo[]
  ): {
    partEvals: FormulaEval[];
    partHits: number[];
    sansBuffPartStats?: Map<string, StatSheet[]>;
  } {
    const charLevel = this.charBuilds[charId]!.charBase.charLevel;
    const onFieldCharIds = resolvePartOnFieldCharIds(
      entry.parts,
      charId,
      this.configs,
      forceOnField
    );

    const statsCache = new Map<string, Record<string, StatSheet>>();
    const getStatsFor = (onFieldId: string) => {
      let s = statsCache.get(onFieldId);
      if (!s) {
        s = this.getTeamStats(sheets, onFieldId, ctx);
        statsCache.set(onFieldId, s);
      }
      return s;
    };

    const partEvals: FormulaEval[] = entry.parts.map((part, i) => ({
      formula: part.formula,
      stats: getStatsFor(onFieldCharIds[i])[charId]!,
      charLevel,
    }));

    const partHits: number[] = entry.parts.map((p) => p.hits ?? 1);

    let sansBuffPartStats: Map<string, StatSheet[]> | undefined;
    if (stackLimited && stackLimited.length > 0) {
      sansBuffPartStats = new Map();
      const exclCache = new Map<string, Record<string, StatSheet>>();
      for (const buffInfo of stackLimited) {
        const bKey = buffInfo.buffKey;
        const perPart: StatSheet[] = entry.parts.map((_, i) => {
          const onFieldId = onFieldCharIds[i];
          const cacheKey = `${onFieldId}|${bKey}`;
          let excl = exclCache.get(cacheKey);
          if (!excl) {
            excl = this.getTeamStatsExcluding(
              sheets,
              onFieldId,
              ctx,
              new Set([bKey])
            );
            exclCache.set(cacheKey, excl);
          }
          return excl[charId]!;
        });
        sansBuffPartStats.set(bKey, perPart);
      }
    }

    return { partEvals, partHits, sansBuffPartStats };
  }

  /**
   * Merge user buff overrides on top of a base activation map (mutates target).
   */
  private static mergeActivationOverrides(
    target: BuffActivationMap,
    overrides: BuffActivationMap
  ): void {
    for (const [bKey, partMap] of Object.entries(overrides)) {
      if (!target[bKey]) target[bKey] = {};
      for (const [pidx, hits] of Object.entries(partMap)) {
        target[bKey][Number(pidx)] = hits;
      }
    }
  }

  private createStatsCacheFn(
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    seed?: Map<string, Record<string, StatSheet>>
  ): (onFieldCharId: string) => Record<string, StatSheet> {
    const cache = seed ?? new Map<string, Record<string, StatSheet>>();
    return (onFieldCharId: string) => {
      if (!cache.has(onFieldCharId)) {
        cache.set(
          onFieldCharId,
          this.getTeamStats(artifactStats, onFieldCharId, ctx)
        );
      }
      return cache.get(onFieldCharId)!;
    };
  }

  /**
   * Compute off-field post-stats for a character's formula.
   * Uses the first other team member as on-field, matching the compiler path.
   */
  private getOffFieldPostStats(
    charId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext | undefined
  ): StatSheet | undefined {
    if (!ctx) return undefined;
    return this.getOffFieldStats(artifactStats, charId, ctx)[charId];
  }

  // ─── Delegation methods to catalog (backward compat) ────────────────────
  getFormulaIds() {
    return this.catalog.getFormulaIds();
  }
  getAllFormulaIds() {
    return this.catalog.getAllFormulaIds();
  }
  getReactionFormulaIds() {
    return this.catalog.getReactionFormulaIds();
  }
  getCombo(charId: string) {
    return this.catalog.getCombo(charId);
  }
  getComboDescriptor(charId: string) {
    return this.catalog.getComboDescriptor(charId);
  }
  getReactionComboLines() {
    return this.catalog.getReactionComboLines();
  }
  offFieldStatus(charId: string, formulaId: string) {
    return this.catalog.offFieldStatus(charId, formulaId);
  }
  hasOffFieldParts(charId: string, formulaId: string) {
    return this.catalog.hasOffFieldParts(charId, formulaId);
  }

  /**
   * Evaluate a combo formula: weighted sum of multiple formula lines,
   * potentially from different characters with different reaction overrides.
   *
   * Groups lines by on-field character and caches getTeamStats() per unique
   * onFieldCharId for efficiency (typically 1-2 unique on-field characters).
   */
  getComboDamageResult(
    combo: ComboFormula,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    /** Per-line PartialBuffInfo[], keyed by line index in validLines. */
    buffOverrides?: Record<number, PartialBuffInfo[]>,
    /** Pre-seeded stats cache to avoid redundant getTeamStats calls. */
    externalStatsCache?: Map<string, Record<string, StatSheet>>
  ): ComboResult {
    // Skip lines with zero count or whose formula no longer exists
    const validLines = combo.lines.filter((line) => {
      if (line.count <= 0) return false;
      return this.formulaIndex.has(line.formulaId);
    });

    // Cache resolved stat sheets per on-field character.
    const statsCache =
      externalStatsCache ?? new Map<string, Record<string, StatSheet>>();
    const getStats = (onFieldCharId: string) => {
      if (!statsCache.has(onFieldCharId)) {
        statsCache.set(
          onFieldCharId,
          this.getTeamStats(artifactStats, onFieldCharId, ctx)
        );
      }
      return statsCache.get(onFieldCharId)!;
    };

    const lineDamages = validLines.map((line, lineIdx) => {
      const cb = this.charBuilds[line.charId];
      const entry =
        cb?.charBase.getFormulaEntry(line.formulaId) ??
        this.formulaIndex.get(line.formulaId);
      const statsCharId = entry?.statsCharId ?? line.charId;
      const ownerCharId = entry?.owner ?? line.charId;

      const teamStats = getStats(statsCharId);

      // Team reaction path
      if (line.formulaId.startsWith("rx-")) {
        const rp = this.reactionProvider;
        let result: DamageResult;
        if (rp.isMultiContributor(line.formulaId)) {
          result = rp.getMultiContributorResult(
            line.formulaId,
            statsCharId,
            teamStats,
            ctx
          );
        } else {
          result = rp.getDamageResult(
            line.formulaId,
            statsCharId,
            teamStats[statsCharId]!,
            ctx
          );
        }
        return {
          perHit: result.totalDamage,
          total: result.totalDamage * line.count,
        };
      }

      // Character formula path
      const lineEntry = entry;
      const partOnFieldCharIds = lineEntry
        ? resolvePartOnFieldCharIds(
            lineEntry.parts,
            statsCharId,
            this.configs,
            line.forceOnField
          )
        : [];

      const offFieldOnFieldCharId = partOnFieldCharIds.find(
        (id) => id !== statsCharId
      );
      let offFieldTeamStats: Record<string, StatSheet> | undefined;
      if (offFieldOnFieldCharId) {
        offFieldTeamStats = getStats(offFieldOnFieldCharId);
      }

      const effectiveReaction = line.reaction;

      // Build stat variants if this line has partial buffs
      const lineInfos = buffOverrides?.[lineIdx];
      let lineVariants: Map<string, StatSheet> | undefined;
      let lineOffFieldVariants: Map<string, StatSheet> | undefined;
      if (lineInfos && lineInfos.length > 0 && lineEntry) {
        lineVariants = buildStatVariants(
          lineInfos,
          lineEntry.parts,
          (excl) =>
            this.getTeamStatsExcluding(artifactStats, statsCharId, ctx, excl)[
              statsCharId
            ]!
        );
        if (offFieldTeamStats && offFieldOnFieldCharId) {
          lineOffFieldVariants = buildStatVariants(
            lineInfos,
            lineEntry.parts,
            (excl) =>
              this.getTeamStatsExcluding(
                artifactStats,
                offFieldOnFieldCharId,
                ctx,
                excl
              )[statsCharId]!
          );
        }
      }

      const formulaOwner =
        ownerCharId !== statsCharId ? ownerCharId : undefined;
      const result = this.getDamageResult(
        statsCharId,
        line.formulaId,
        teamStats,
        ctx,
        effectiveReaction,
        offFieldTeamStats,
        lineInfos,
        lineVariants,
        lineOffFieldVariants,
        formulaOwner,
        line.forceOnField
      );

      // Adjust for bespokeBuff maxStacks across combo repetitions
      let total = result.totalDamage * line.count;
      for (const part of result.parts) {
        if (part.bespokeInfo) {
          const totalHits = part.hits * line.count;
          const buffedHits = Math.min(part.bespokeInfo.maxStacks, totalHits);
          const unbuffedHits = totalHits - buffedHits;
          total -= part.damage * part.hits * line.count;
          total +=
            part.damage * buffedHits +
            part.bespokeInfo.unbuffedDamage * unbuffedHits;
        }
      }

      return {
        perHit: result.totalDamage,
        total,
      };
    });

    return {
      lineDamages,
      totalDamage: lineDamages.reduce((sum, l) => sum + l.total, 0),
    };
  }

  /**
   * Produce a DisplayResult for combo mode — stats, marginal gains, and buffs
   * aggregated across all on-field characters in the combo.
   *
   * This is THE primary display interface. Single-formula display is just a
   * 1-line combo internally.
   */
  getComboDisplayResult(
    combo: ComboFormula,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    buffOverrides?: Record<number, PartialBuffInfo[]>
  ): DisplayResult {
    // Skip lines whose formula no longer exists
    const allFormulas = this.getFormulaIds();
    const reactionFormulas = this.reactionProvider.getFormulaIds();
    const activeLines = combo.lines.filter((l) => {
      if (l.count <= 0) return false;
      if (l.formulaId.startsWith("rx-")) {
        return reactionFormulas[l.formulaId] !== undefined;
      }
      const charFormulas = allFormulas[l.charId];
      return charFormulas?.[l.formulaId];
    });

    const allCharIds = Object.keys(this.charBuilds);

    // ── Stats: compute per unique on-field context ──
    const statsCache = new Map<string, Record<string, StatSheet>>();
    const getStats = (onFieldCharId: string) => {
      if (!statsCache.has(onFieldCharId)) {
        statsCache.set(
          onFieldCharId,
          this.getTeamStats(artifactStats, onFieldCharId, ctx)
        );
      }
      return statsCache.get(onFieldCharId)!;
    };

    const charFormulaTags = this.catalog.collectCharFormulaTags();

    // ── Raw StatSheets with on/off field contexts ──
    const statSheets: Record<
      string,
      { onField: StatSheet; offField: StatSheet }
    > = {};
    for (const cid of allCharIds) {
      const onField = getStats(cid)[cid]!;
      const offOther = defaultOnFieldCharId(cid, this.configs);
      const offField = getStats(offOther)[cid]!;
      statSheets[cid] = { onField, offField };
    }

    // ── Base combo damage ──
    const baseResult = this.getComboDamageResult(
      { ...combo, lines: activeLines },
      artifactStats,
      ctx,
      buffOverrides,
      statsCache
    );
    const baseDamage = baseResult.totalDamage;
    const fullBuffBaseDamage = buffOverrides
      ? this.getComboDamageResult(
          { ...combo, lines: activeLines },
          artifactStats,
          ctx,
          undefined,
          statsCache
        ).totalDamage
      : baseDamage;

    // ── Marginal gains ──
    const marginalGains: Record<string, Partial<Record<StatKey, number>>> = {};

    if (fullBuffBaseDamage > 0) {
      const comboConfig = { ...combo, lines: activeLines };
      const evalFn = (sheets: Record<string, StatSheet>): number =>
        this.getComboDamageResult(comboConfig, sheets, ctx).totalDamage;

      const deltas = computeSubstatMarginals(
        evalFn,
        artifactStats,
        fullBuffBaseDamage,
        allCharIds
      );

      for (const [cid, charDeltas] of Object.entries(deltas)) {
        const charGains: Partial<Record<StatKey, number>> = {};
        for (const [key, delta] of Object.entries(charDeltas)) {
          charGains[key as StatKey] = delta / fullBuffBaseDamage;
        }
        marginalGains[cid] = charGains;
      }
    }

    // ── Intrinsic saturation detection ──
    const intrinsicSaturatedCharIds: string[] = [];
    {
      const zeroGainCharIds = allCharIds.filter(
        (cid) =>
          !marginalGains[cid] || Object.keys(marginalGains[cid]).length === 0
      );
      if (zeroGainCharIds.length > 0 && fullBuffBaseDamage > 0) {
        const comboConfig = { ...combo, lines: activeLines };
        const evalFn = (sheets: Record<string, StatSheet>): number =>
          this.getComboDamageResult(comboConfig, sheets, ctx).totalDamage;
        const emptySheets = { ...artifactStats };
        for (const cid of zeroGainCharIds) {
          emptySheets[cid] = new StatSheet([]);
        }
        const emptyBaseDmg = evalFn(emptySheets);
        if (emptyBaseDmg > 0) {
          const emptyDeltas = computeSubstatMarginals(
            evalFn,
            emptySheets,
            emptyBaseDmg,
            zeroGainCharIds
          );
          for (const cid of zeroGainCharIds) {
            const gains = emptyDeltas[cid];
            if (!gains || Object.keys(gains).length === 0) {
              intrinsicSaturatedCharIds.push(cid);
            }
          }
        }
      }
    }

    // ── Buffs: union across all on-field contexts ──
    // Use resolveFormulaBuffs (lightweight) instead of getDisplayResult.
    const buffMap = new Map<string, ResolvedBuff>();

    const seenFormulas = new Set<string>();
    for (const line of activeLines) {
      if (line.formulaId.startsWith("rx-")) continue;
      const fKey = `${line.charId}.${line.formulaId}`;
      if (seenFormulas.has(fKey)) continue;
      seenFormulas.add(fKey);

      try {
        const buffs = this.resolveFormulaBuffs(
          line.charId,
          line.formulaId,
          artifactStats,
          ctx,
          line.reaction,
          line.forceOnField
        );

        for (const buff of buffs) {
          const existing = buffMap.get(buff.buffKey);
          if (!existing) {
            buffMap.set(buff.buffKey, buff);
          } else if (buff.active && !existing.active) {
            buffMap.set(buff.buffKey, buff);
          } else if (
            buff.active &&
            existing.active &&
            buff.dynamicEntries.length > 0
          ) {
            mergeBuffDynamicRange(existing, buff);
          }
        }
      } catch (e) {
        console.warn(
          `[TeamBuild] buff collection failed for ${line.charId}/${line.formulaId}:`,
          e
        );
      }
    }

    const buffs = Array.from(buffMap.values());

    // ── Level-up gains ──
    const levelUpGains: Record<
      string,
      { gain: number; from: number; to: number }[]
    > =
      fullBuffBaseDamage > 0
        ? this.iterateLevelUpGains((charId, targetLevel) => {
            const tweakedConfigs = this.configs.map((c) =>
              c.charId === charId ? { ...c, charLevel: targetLevel } : c
            );
            const tweakedTeam = new TeamBuild(
              tweakedConfigs,
              this.combatOpts,
              this.enemyAura,
              this.extraBuffs
            );
            const newResult = tweakedTeam.getComboDamageResult(
              { ...combo, lines: activeLines },
              artifactStats,
              ctx
            );
            return (
              (newResult.totalDamage - fullBuffBaseDamage) / fullBuffBaseDamage
            );
          })
        : {};

    // ── Per-formula display parts ──
    const partsByFormula: Record<string, DisplayPart[]> = {};

    const linesByFormula = new Map<
      string,
      { lineIdx: number; line: (typeof activeLines)[0] }[]
    >();
    for (let i = 0; i < activeLines.length; i++) {
      const line = activeLines[i];
      const key = `${line.charId}.${line.formulaId}`;
      let arr = linesByFormula.get(key);
      if (!arr) {
        arr = [];
        linesByFormula.set(key, arr);
      }
      arr.push({ lineIdx: i, line });
    }

    for (const [formulaKey, formulaLines] of linesByFormula) {
      const { charId, formulaId } = formulaLines[0].line;
      const build = this.charBuilds[charId];
      if (!build) continue;

      const postStats = getStats(charId);

      // ── Team reaction formulas ──
      if (formulaId.startsWith("rx-")) {
        const rxEntry = this.formulaIndex.get(formulaId);
        if (!rxEntry) continue;
        const formula = rxEntry.parts[0].formula;
        const charLevel =
          this.configs.find((c) => c.charId === charId)?.charLevel ?? 90;

        let parts: DisplayPart[];
        if (this.reactionProvider.isMultiContributor(formulaId)) {
          const rankWeights = this.reactionProvider.getRankWeights(formulaId);
          const contributions: { charId: string; weight: number }[] = [];
          for (const cfg of this.configs) {
            const w = rankWeights?.get(cfg.charId) ?? 0;
            contributions.push({ charId: cfg.charId, weight: w });
          }
          contributions.sort((a, b) => b.weight - a.weight);

          parts = contributions.map((c) => {
            const onField =
              c.charId === charId
                ? charId
                : defaultOnFieldCharId(charId, this.configs);
            const stats = getStats(onField);
            const cLevel =
              this.configs.find((cfg) => cfg.charId === c.charId)?.charLevel ??
              90;
            const dp = formula.displayFull(stats[c.charId]!, cLevel, ctx);
            dp.damage = dp.damage * c.weight;
            dp.hits = 1;
            dp.params = { ...dp.params, rankWeight: c.weight };
            dp.contributorCharId = c.charId;
            return dp;
          });
        } else {
          const dp = formula.displayFull(postStats[charId]!, charLevel, ctx);
          dp.hits = 1;
          parts = [dp];
        }

        const totalComboCount = formulaLines.reduce(
          (sum, fl) => sum + fl.line.count,
          0
        );
        partsByFormula[formulaKey] = parts.map((dp) => ({
          ...dp,
          damage: dp.damage * totalComboCount,
        }));
        continue;
      }

      const firstLine = formulaLines[0].line;
      const effectiveReaction = firstLine.reaction;

      const entry =
        build.charBase.getFormulaEntry(formulaId) ??
        this.formulaIndex.get(formulaId);
      const formulaHasOffField =
        entry?.parts.some((p) => isPartOffField(p, firstLine.forceOnField)) ??
        false;
      let offFieldPostStats: StatSheet | undefined;
      if (formulaHasOffField) {
        const offOther = defaultOnFieldCharId(charId, this.configs);
        offFieldPostStats = getStats(offOther)[charId];
      }

      const { parts } = build.getDisplayParts(
        formulaId,
        postStats[charId]!,
        ctx,
        effectiveReaction,
        offFieldPostStats,
        firstLine.forceOnField
      );

      const totalComboCount = formulaLines.reduce(
        (sum, fl) => sum + fl.line.count,
        0
      );
      const hasLinePartialBuffs = formulaLines.some(
        (fl) => buffOverrides?.[fl.lineIdx]?.length
      );

      if (hasLinePartialBuffs && entry) {
        const buffAgg = new Map<string, Record<number, number>>();
        for (const fl of formulaLines) {
          const lineInfos = buffOverrides?.[fl.lineIdx];
          if (!lineInfos) continue;
          for (const info of lineInfos) {
            let agg = buffAgg.get(info.buffKey);
            if (!agg) {
              agg = {};
              buffAgg.set(info.buffKey, agg);
            }
            for (const [pidxStr, activated] of Object.entries(
              info.partActivation
            )) {
              const pidx = Number(pidxStr);
              agg[pidx] = (agg[pidx] ?? 0) + activated * fl.line.count;
            }
          }
        }

        const aggregatedInfos: PartialBuffInfo[] = [];
        for (const [buffKey, partAgg] of buffAgg) {
          const perCastActivation: Record<number, number> = {};
          for (const [pidxStr, totalActivated] of Object.entries(partAgg)) {
            perCastActivation[Number(pidxStr)] =
              totalActivated / totalComboCount;
          }
          aggregatedInfos.push({
            buffKey,
            partActivation: perCastActivation,
          });
        }

        if (aggregatedInfos.length > 0) {
          const statsVariants = buildStatVariants(
            aggregatedInfos,
            entry.parts,
            (excl) =>
              this.getTeamStatsExcluding(artifactStats, charId, ctx, excl)[
                charId
              ]!
          );
          let offFieldVariants: Map<string, StatSheet> | undefined;
          if (offFieldPostStats) {
            const offOther = defaultOnFieldCharId(charId, this.configs);
            offFieldVariants = buildStatVariants(
              aggregatedInfos,
              entry.parts,
              (excl) =>
                this.getTeamStatsExcluding(artifactStats, offOther, ctx, excl)[
                  charId
                ]!
            );
          }

          const blended = computeBlendedDamage(
            entry.parts,
            aggregatedInfos,
            postStats[charId]!,
            statsVariants,
            build.charBase.charLevel,
            ctx,
            offFieldPostStats,
            offFieldVariants
          );

          for (let i = 0; i < parts.length; i++) {
            const eidx = parts[i].sourcePartIndex ?? i;
            if (!blended.partDamages[eidx]) continue;

            const zeroBuffKeys = new Set<string>();
            if (eidx < entry.parts.length) {
              const h = entry.parts[eidx].hits ?? 1;
              for (const info of aggregatedInfos) {
                if ((info.partActivation[eidx] ?? h) === 0) {
                  zeroBuffKeys.add(info.buffKey);
                }
              }
            }

            if (zeroBuffKeys.size > 0 && eidx < entry.parts.length) {
              const {
                formula,
                offField,
                bespokeBuffs: bBuffs,
              } = entry.parts[eidx];
              const eKey = exclusionKey(zeroBuffKeys);
              const baseVariant =
                offField && offFieldVariants
                  ? (offFieldVariants.get(eKey) ?? offFieldPostStats!)
                  : (statsVariants.get(eKey) ?? postStats[charId]!);
              const displayStats = bBuffs?.length
                ? baseVariant.merge(
                    buildBespokeOverlay(bBuffs, baseVariant, [])
                  )
                : baseVariant;
              const rebuilt = formula.displayFull(
                displayStats,
                build.charBase.charLevel,
                ctx
              );
              parts[i] = {
                ...rebuilt,
                hits: parts[i].hits,
                offField: parts[i].offField,
                damage: blended.partDamages[eidx].damage,
                sourcePartIndex: eidx,
              };
            } else {
              parts[i] = {
                ...parts[i],
                damage: blended.partDamages[eidx].damage,
                sourcePartIndex: eidx,
              };
            }
          }
        }

        // Annotate parts with combo-wide partial buff info
        for (const [buffKey, partAgg] of buffAgg) {
          for (const [pidxStr, totalActivated] of Object.entries(partAgg)) {
            const pidx = Number(pidxStr);
            if (pidx >= parts.length) continue;
            const partHits = entry.parts[pidx]?.hits ?? 1;
            const totalHits = partHits * totalComboCount;
            if (totalActivated < totalHits) {
              if (!parts[pidx].partialBuffs) {
                parts[pidx] = { ...parts[pidx], partialBuffs: [] };
              }
              parts[pidx].partialBuffs!.push({
                buffKey,
                activatedHits: totalActivated,
                totalHits,
              });
              if (parts[pidx].sourcePartIndex === undefined) {
                parts[pidx] = { ...parts[pidx], sourcePartIndex: pidx };
              }
            }
          }
        }
      }

      // Combo-scoped bespoke maxStack split
      if (entry) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const dp = parts[i];
          const eidx = dp.sourcePartIndex;
          if (eidx == null || eidx >= entry.parts.length) continue;
          const { bespokeBuffs: bBuffs } = entry.parts[eidx];
          const bMax = bespokeMaxStacks(bBuffs);
          const partHits = entry.parts[eidx].hits ?? 1;
          const comboTotalHits = partHits * totalComboCount;
          if (bMax == null || bMax >= comboTotalHits) continue;
          const buffedFrac = bMax / comboTotalHits;
          const dpHits = dp.hits ?? 1;
          const buffedHits = Math.round(dpHits * buffedFrac * 1000) / 1000;
          const unbuffedHits = dpHits - buffedHits;
          if (buffedHits > 0 && unbuffedHits > 0) {
            const { formula, offField } = entry.parts[eidx];
            const baseSelfStats =
              offField && offFieldPostStats
                ? offFieldPostStats
                : postStats[charId]!;
            const dpUnbuffed = formula.displayFull(
              baseSelfStats,
              build.charBase.charLevel,
              ctx
            );
            dpUnbuffed.hits = unbuffedHits;
            dpUnbuffed.sourcePartIndex = eidx;
            if (dp.offField) dpUnbuffed.offField = true;
            parts.splice(i, 1, { ...dp, hits: buffedHits }, dpUnbuffed);
          }
        }
      }

      partsByFormula[formulaKey] = parts;
    }

    // ── Idle stat records (cold path) ──
    const idleSheets = this.computeIdleStatSheets(artifactStats);
    const idleStatRecords: DisplayResult["idleStatRecords"] = {};
    for (const [cid, { onField, offField }] of Object.entries(idleSheets)) {
      idleStatRecords[cid] = {
        onField: onField.getIdleRecord(),
        offField: offField.getIdleRecord(),
      };
    }

    return {
      partsByFormula,
      totalDamage: baseDamage,
      lineDamages: baseResult.lineDamages,
      buffs,
      statSheets,
      charFormulaTags,
      marginalGains,
      levelUpGains,
      idleStatRecords,
      intrinsicSaturatedCharIds,
    };
  }

  /** Evaluate a specific character's damage formula with the given team stats.
   *  For cross-scaled formulas (statsCharId override), pass the stats character
   *  as charId and the formula owner as formulaOwnerCharId. */
  getDamageResult(
    charId: string,
    formulaId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldTeamStats?: Record<string, StatSheet>,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>,
    formulaOwnerCharId?: string,
    forceOnField?: boolean
  ): DamageResult {
    const ownerCharId = formulaOwnerCharId ?? charId;
    const build = this.charBuilds[ownerCharId];
    if (!build) throw new Error(`No CharBuild for character: ${ownerCharId}`);
    const teamStatsArr = Object.values(teamStats);
    // Use stats from charId (the evaluating character) but formula from ownerCharId
    const statsCharLevel =
      ownerCharId !== charId
        ? this.charBuilds[charId]?.charBase.charLevel
        : undefined;
    return build.getDamageResult(
      formulaId,
      teamStats[charId]!,
      teamStatsArr,
      ctx,
      reactionOverride,
      offFieldTeamStats?.[charId],
      partialBuffs,
      statsVariants,
      offFieldVariants,
      statsCharLevel,
      forceOnField
    );
  }

  /**
   * Build off-field preStats (and optionally midStats) for ScalingBuff range display.
   * Both resolveFormulaBuffs and getDisplayResult need these to show min~max values
   * when a ScalingBuff provider has different stats on-field vs off-field.
   */
  private buildOffFieldContext(
    charId: string,
    artifactStats: Record<string, StatSheet>,
    hasAnyFinalBuffs: boolean
  ): {
    offFieldPreStats: Record<string, StatSheet>;
    offFieldMidStats: Record<string, StatSheet> | undefined;
  } {
    const offOther = defaultOnFieldCharId(charId, this.configs);
    const offFieldDep = this.getFieldDependentBuffs(offOther);
    const offFieldPreStats = this.buildPreStatsFromBuilds(
      artifactStats,
      offFieldDep
    );
    const offTeamArr = Object.values(offFieldPreStats);
    const offDynamic = this.collectDynamicBuffs(
      offFieldPreStats,
      offTeamArr,
      offOther
    );
    const offFieldMidStats = hasAnyFinalBuffs
      ? this.buildTeamPostStats(
          offFieldPreStats,
          offDynamic.filter((b) => !isDeferredFinalBuff(b.buff)),
          offOther
        )
      : undefined;
    return { offFieldPreStats, offFieldMidStats };
  }

  /**
   * Lightweight buff resolution for a character's formula.
   * Returns ResolvedBuff[] without computing stack allocation, marginal gains,
   * level-up gains, or idle stats. Used by combo display and DamageCard buff
   * applicability where only buff metadata is needed.
   */
  resolveFormulaBuffs(
    charId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    forceOnField?: boolean
  ): ResolvedBuff[] {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);

    // Stat resolution (mirrors getTeamStats but captures intermediate phases)
    const fieldDependent = this.getFieldDependentBuffs(charId);
    const preStats = this.buildPreStatsFromBuilds(
      artifactStats,
      fieldDependent
    );

    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(
      preStats,
      teamPreStatsArr,
      charId
    );

    // Build midStats for final-stat ScalingBuff display
    const hasAnyFinalBuffs = allDynamicBuffs.some((b) =>
      isDeferredFinalBuff(b.buff)
    );
    const midStats = hasAnyFinalBuffs
      ? this.buildTeamPostStats(
          preStats,
          allDynamicBuffs.filter((b) => !isDeferredFinalBuff(b.buff)),
          charId
        )
      : undefined;

    // Formula entry for part tags and off-field info
    const entry = build.charBase.getFormulaEntry(formulaId);
    const partTags = entry?.parts.map((p) => p.formula.tag) ?? [];

    // Off-field context for ScalingBuff range display
    const formulaHasOffField =
      entry?.parts.some((p) => isPartOffField(p, forceOnField)) ?? false;
    const offFieldCtx = formulaHasOffField
      ? this.buildOffFieldContext(charId, artifactStats, hasAnyFinalBuffs)
      : undefined;
    const offFieldPreStats = offFieldCtx?.offFieldPreStats;
    const offFieldMidStats = offFieldCtx?.offFieldMidStats;

    // Compute display parts purely for readKeys (needed by resolveBuffs)
    const postStats = this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      charId,
      ctx
    );
    const offFieldPostStats = formulaHasOffField
      ? this.getOffFieldPostStats(charId, artifactStats, ctx)
      : undefined;
    const { parts } = build.getDisplayParts(
      formulaId,
      postStats[charId]!,
      ctx,
      reactionOverride,
      offFieldPostStats,
      forceOnField
    );

    const partReadKeys = parts.map((p) => p.readKeys);
    const partOffField =
      entry?.parts.map((p) => isPartOffField(p, forceOnField)) ?? [];

    return this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      partTags,
      partReadKeys,
      partOffField,
      formulaId,
      midStats,
      offFieldPreStats,
      offFieldMidStats
    );
  }

  /**
   * Single-formula display entry point — produces full breakdown, buffs, stats, marginal gains.
   * @internal Prefer `getComboDisplayResult` for public use. This remains public for tests
   * that exercise single-formula display behavior.
   */
  getDisplayResult(
    charId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    userBuffOverrides?: BuffActivationMap,
    externalPartialBuffs?: PartialBuffInfo[],
    forceOnField?: boolean
  ): DisplayResult {
    const build = this.charBuilds[charId];
    if (!build) throw new Error(`No CharBuild for character: ${charId}`);

    // ── Stat resolution (mirrors getTeamStats but captures intermediate phases) ──
    const fieldDependent = this.getFieldDependentBuffs(charId);
    const preStats = this.buildPreStatsFromBuilds(
      artifactStats,
      fieldDependent
    );

    const teamPreStatsArr = Object.values(preStats);
    const allDynamicBuffs = this.collectDynamicBuffs(
      preStats,
      teamPreStatsArr,
      charId
    );

    // Build midStats for display: preStats + sheet-stat dynamic buffs only.
    // Used by resolveBuffs to show correct values for final-stat ScalingBuffs
    // (e.g., Shenhe ATK→baseDmg should see Bennett's ATK buff).
    const hasAnyFinalBuffs = allDynamicBuffs.some((b) =>
      isDeferredFinalBuff(b.buff)
    );
    const midStats = hasAnyFinalBuffs
      ? this.buildTeamPostStats(
          preStats,
          allDynamicBuffs.filter((b) => !isDeferredFinalBuff(b.buff)),
          charId
        )
      : undefined;

    const postStats = this.buildTeamPostStats(
      preStats,
      allDynamicBuffs,
      charId,
      ctx
    );

    // ── Formula display ──
    // Use build.charBase for the lookup — formulaIndex may have collisions
    // when multiple characters share the same formula IDs (e.g. manekin dummies).
    const entry = build.charBase.getFormulaEntry(formulaId);
    const partTags: (DamageTag | undefined)[] =
      entry?.parts.map((p) => p.formula.tag) ?? [];
    const formulaTags: DamageTag[] = partTags.filter(
      (t): t is DamageTag => t !== undefined
    );

    // Compute off-field stats for display if the formula has off-field parts
    const formulaHasOffField =
      entry?.parts.some((p) => isPartOffField(p, forceOnField)) ?? false;
    const offFieldPostStats = formulaHasOffField
      ? this.getOffFieldPostStats(charId, artifactStats, ctx)
      : undefined;

    // Build off-field preStats/midStats for ScalingBuff range display.
    // When a ScalingBuff provider has different stats on-field vs off-field
    // (e.g., Shenhe's ATK differs with/without Bennett's teamOnField buff),
    // the buff value varies per part → show min~max in UI.
    const offFieldCtx = formulaHasOffField
      ? this.buildOffFieldContext(charId, artifactStats, hasAnyFinalBuffs)
      : undefined;
    const offFieldPreStats = offFieldCtx?.offFieldPreStats;
    const offFieldMidStats = offFieldCtx?.offFieldMidStats;

    let { parts, totalDamage } = build.getDisplayParts(
      formulaId,
      postStats[charId]!,
      ctx,
      reactionOverride,
      offFieldPostStats,
      forceOnField
    );
    // Pre-blending damage: consistent baseline for marginal/level-up gain
    // comparisons (getDamageResult without partial buffs returns this value).
    const fullBuffDamage = totalDamage;

    // ── Stack allocation + buff activation ──
    // When `externalPartialBuffs` is provided, the caller is supplying the
    // distribution directly (used by tests to compare all 3 paths under the
    // same stack allocation). Skip internal compute in that case.
    const useExternal = externalPartialBuffs !== undefined;
    const stackLimited = useExternal
      ? []
      : collectStackLimitedBuffs(
          this.allStaticBuffs,
          preStats,
          teamPreStatsArr
        );
    let buffActivation: BuffActivationMap | undefined;

    if (entry) {
      // Greedy allocation for stack-limited buffs
      let mergedActivation: BuffActivationMap = {};
      if (stackLimited.length > 0) {
        const { partEvals, partHits, sansBuffPartStats } = this.buildPartEvals(
          charId,
          entry,
          artifactStats,
          ctx,
          forceOnField,
          stackLimited
        );
        const defaultActivation = computeDefaultActivation(
          partEvals,
          partHits,
          stackLimited,
          ctx,
          sansBuffPartStats
        );
        mergedActivation = { ...defaultActivation };
      }

      // 3. Merge user overrides on top
      if (!useExternal && userBuffOverrides) {
        TeamBuild.mergeActivationOverrides(mergedActivation, userBuffOverrides);
      }

      // 4. Build PartialBuffInfo[] from both stack-limited and user-overridden buffs
      const stackInfos =
        stackLimited.length > 0
          ? buildPartialBuffInfos(mergedActivation, stackLimited, entry.parts)
          : [];
      const userInfos =
        !useExternal && userBuffOverrides
          ? buildUserOverrideInfos(
              userBuffOverrides,
              this.allStaticBuffs,
              entry.parts,
              (buff, providerId) =>
                this.couldBuffApplyToChar(buff, providerId, charId)
            )
          : [];
      const allInfos = useExternal
        ? externalPartialBuffs!
        : [...stackInfos, ...userInfos];

      if (allInfos.length > 0) {
        buffActivation = mergedActivation;

        // 5. Pre-build stat variants for all exclusion combinations
        const statsVariants = buildStatVariants(
          allInfos,
          entry.parts,
          (excludeSet) =>
            this.getTeamStatsExcluding(artifactStats, charId, ctx, excludeSet)[
              charId
            ]!
        );
        let offFieldVariantsMap: Map<string, StatSheet> | undefined;
        if (offFieldPostStats) {
          const offOther = defaultOnFieldCharId(charId, this.configs);
          offFieldVariantsMap = buildStatVariants(
            allInfos,
            entry.parts,
            (excludeSet) =>
              this.getTeamStatsExcluding(
                artifactStats,
                offOther,
                ctx,
                excludeSet
              )[charId]!
          );
        }

        const blended = computeBlendedDamage(
          entry.parts,
          allInfos,
          postStats[charId]!,
          statsVariants,
          build.charBase.charLevel,
          ctx,
          offFieldPostStats,
          offFieldVariantsMap,
          reactionOverride,
          forceOnField
        );
        totalDamage = blended.totalDamage;
        // Rebuild display parts with 1st-hit stats: exclude only buffs
        // with 0 activation (never applied), keep blended average damage.
        for (let i = 0; i < parts.length; i++) {
          const eidx = parts[i].sourcePartIndex ?? i;
          if (!blended.partDamages[eidx]) continue;

          // Collect buffs with 0 activation on this part (never applied)
          const zeroBuffKeys = new Set<string>();
          if (eidx < entry.parts.length) {
            const h = entry.parts[eidx].hits ?? 1;
            for (const info of allInfos) {
              if ((info.partActivation[eidx] ?? h) === 0) {
                zeroBuffKeys.add(info.buffKey);
              }
            }
          }

          if (zeroBuffKeys.size > 0 && eidx < entry.parts.length) {
            const { formula, offField, bespokeBuffs } = entry.parts[eidx];
            const eKey = exclusionKey(zeroBuffKeys);
            const baseVariant =
              offField && offFieldVariantsMap
                ? (offFieldVariantsMap.get(eKey) ?? offFieldPostStats!)
                : (statsVariants.get(eKey) ?? postStats[charId]!);
            const displayStats = bespokeBuffs?.length
              ? baseVariant.merge(
                  buildBespokeOverlay(bespokeBuffs, baseVariant, [])
                )
              : baseVariant;
            const rebuilt = formula.displayFull(
              displayStats,
              build.charBase.charLevel,
              ctx
            );
            parts[i] = {
              ...rebuilt,
              hits: parts[i].hits,
              offField: parts[i].offField,
              damage: blended.partDamages[eidx].damage,
              sourcePartIndex: eidx,
            };
          } else {
            parts[i] = {
              ...parts[i],
              damage: blended.partDamages[eidx].damage,
              sourcePartIndex: eidx,
            };
          }
        }
        // Add partialBuffs annotations from merged activation
        for (const [bKey, partMap] of Object.entries(mergedActivation)) {
          for (const [pidxStr, activated] of Object.entries(partMap)) {
            const pidx = Number(pidxStr);
            if (pidx >= parts.length) continue;
            const h = entry.parts[pidx]?.hits ?? 1;
            if (activated < h) {
              if (!parts[pidx].partialBuffs) parts[pidx].partialBuffs = [];
              parts[pidx].partialBuffs!.push({
                buffKey: bKey,
                activatedHits: activated,
                totalHits: h,
              });
              if (parts[pidx].sourcePartIndex === undefined)
                parts[pidx].sourcePartIndex = pidx;
            }
          }
        }
      } else if (Object.keys(mergedActivation).length > 0) {
        buffActivation = mergedActivation;
      }
    }

    // ── Buff resolution ──
    const partReadKeys = parts.map((p) => p.readKeys);
    const partOffField =
      entry?.parts.map((p) => isPartOffField(p, forceOnField)) ?? [];
    const buffs = this.resolveBuffs(
      charId,
      preStats,
      teamPreStatsArr,
      partTags,
      partReadKeys,
      partOffField,
      formulaId,
      midStats,
      offFieldPreStats,
      offFieldMidStats
    );

    const charFormulaTags = this.catalog.collectCharFormulaTags();

    // ── Raw StatSheets with on/off field contexts ──
    const seedCache = new Map<string, Record<string, StatSheet>>();
    seedCache.set(charId, postStats); // reuse existing computation
    const getStats = this.createStatsCacheFn(artifactStats, ctx, seedCache);

    const statSheets: Record<
      string,
      { onField: StatSheet; offField: StatSheet }
    > = {};
    for (const cid of Object.keys(this.charBuilds)) {
      const onField = getStats(cid)[cid]!;
      const offOther = defaultOnFieldCharId(cid, this.configs);
      const offField = getStats(offOther)[cid]!;
      statSheets[cid] = { onField, offField };
    }

    // ── Marginal gains ──
    const marginalGains = this.computeMarginalGainsUnified(
      charId,
      formulaId,
      artifactStats,
      ctx,
      fullBuffDamage,
      reactionOverride,
      formulaHasOffField,
      forceOnField
    );

    // ── Level-up gains (Lv90 → Lv100) ──
    const levelUpGains = this.computeLevelUpGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      fullBuffDamage,
      reactionOverride,
      formulaHasOffField,
      forceOnField
    );

    // ── Intrinsic saturation detection ──
    const intrinsicSaturatedCharIds: string[] = [];
    {
      const allCharIds = Object.keys(this.charBuilds);
      const zeroGainCharIds = allCharIds.filter(
        (cid) =>
          !marginalGains[cid] || Object.keys(marginalGains[cid]).length === 0
      );
      if (zeroGainCharIds.length > 0 && fullBuffDamage > 0) {
        const emptySheets = { ...artifactStats };
        for (const cid of zeroGainCharIds) {
          emptySheets[cid] = new StatSheet([]);
        }
        const emptyGains = this.computeMarginalGainsUnified(
          charId,
          formulaId,
          emptySheets,
          ctx,
          fullBuffDamage,
          reactionOverride,
          formulaHasOffField,
          forceOnField
        );
        for (const cid of zeroGainCharIds) {
          if (!emptyGains[cid] || Object.keys(emptyGains[cid]).length === 0) {
            intrinsicSaturatedCharIds.push(cid);
          }
        }
      }
    }

    // ── Idle stat records (cold path) ──
    const idleSheets = this.computeIdleStatSheets(artifactStats);
    const idleStatRecords: DisplayResult["idleStatRecords"] = {};
    for (const [cid, { onField, offField }] of Object.entries(idleSheets)) {
      idleStatRecords[cid] = {
        onField: onField.getIdleRecord(),
        offField: offField.getIdleRecord(),
      };
    }

    return {
      partsByFormula: { [`${charId}.${formulaId}`]: parts },
      totalDamage,
      buffs,
      buffActivation,
      statSheets,
      charFormulaTags,
      marginalGains,
      levelUpGains,
      idleStatRecords,
      intrinsicSaturatedCharIds,
    };
  }

  /** Resolve all buffs into active/inactive ResolvedBuff[] for display. */
  private resolveBuffs(
    onFieldCharId: string,
    preStats: Record<string, StatSheet>,
    teamPreStatsArr: StatSheet[],
    partTags: (DamageTag | undefined)[],
    partReadKeys: (ReadonlySet<StatKey> | undefined)[],
    partOffField: boolean[],
    formulaId?: string,
    midStats?: Record<string, StatSheet>,
    offFieldPreStats?: Record<string, StatSheet>,
    offFieldMidStats?: Record<string, StatSheet>
  ): ResolvedBuff[] {
    const result: ResolvedBuff[] = [];

    // Use allStaticBuffs (populated once at construction) as the single source
    // of buff objects. This avoids reference-identity mismatches caused by
    // weapon/artifact getters that create new StatBuff instances each call.
    // Exclude resonance and extra entries — they are handled separately below.
    const charBuffEntries = this.allStaticBuffs.filter(
      (b) => b.providerCharId !== "resonance" && b.providerCharId !== "extra"
    );

    // ── Active static set ──
    let applicableStatic = charBuffEntries
      .filter((b) => this.isBuffApplicableForTeam(b.buff, b.providerCharId))
      .map((b) => b.buff);
    applicableStatic = deduplicateBuffs(applicableStatic, (b) => b.staticBuffs);
    const activeStaticSet = new Set<StatBuff>(applicableStatic);

    // ── Active dynamic set ──
    // Evaluate dynamic buffs from the same allStaticBuffs objects.
    // Final-stat ScalingBuffs (e.g., ATK→baseDmg) use midStats so they see
    // sheet-stat dynamic buffs like Bennett's ATK share.
    const midStatsArr = midStats ? Object.values(midStats) : undefined;
    const allDynamic: EvaluatedDynamicBuff[] = [];
    for (const { buff, providerCharId } of charBuffEntries) {
      const useMid = midStats && isDeferredFinalBuff(buff);
      const ownerStats = useMid
        ? midStats[providerCharId]!
        : preStats[providerCharId]!;
      const statsArr = useMid ? midStatsArr! : teamPreStatsArr;
      const entries = buff.dynamicBuffs(ownerStats, statsArr);
      if (entries.length > 0) {
        allDynamic.push({ buff, source: buff.source, providerCharId, entries });
      }
    }

    let applicableDynamic = allDynamic.filter((b) =>
      this.isBuffApplicableForTeam(b.buff, b.providerCharId)
    );
    applicableDynamic = deduplicateBuffs(applicableDynamic, (b) => b.entries);
    const activeDynamicSet = new Set<StatBuff>(
      applicableDynamic.map((e) => e.buff)
    );

    // ── Scaling bridge: inputKey → outputKeys reaching calcTarget ──
    // Enables indirect relevance: a buff giving +ER% is relevant if a scaling
    // buff reads ER and outputs something the formula reads (e.g. ER → DMG%).
    // Keyed by (providerCharId, inputKey) — where providerCharId is the scaling
    // buff's owner who reads inputKey from their own stats.
    // Scaled stat implicit deps: atk% and baseAtk both feed into atk
    const SCALED_DEPS: Record<string, string[]> = {
      atk: ["atk%", "baseAtk"],
      hp: ["hp%", "baseHp"],
      def: ["def%", "baseDef"],
    };

    const scalingBridge = new Map<string, Set<StatKey>>();
    for (const { buff, providerCharId } of charBuffEntries) {
      // Extract scaling info: input keys → output key for any scaling buff type
      let bridgeInputKeys: StatKey[] | undefined;
      let bridgeOutputKey: StatKey | undefined;
      if (buff instanceof ScalingBuff) {
        bridgeInputKeys = [buff.inputKey];
        bridgeOutputKey = buff.outputKey;
      } else if (buff instanceof TeamAggregationBuff) {
        bridgeInputKeys = [buff.inputKey];
        bridgeOutputKey = buff.outputKey;
      } else if (buff instanceof CrossScalingBuff) {
        bridgeInputKeys = [buff.statA, buff.statB];
        bridgeOutputKey = buff.outputKey;
      }
      if (!bridgeInputKeys || !bridgeOutputKey) continue;

      // Only care about scaling buffs whose output reaches the calc target.
      // Check both field states (true = on-field, false = off-field) because
      // the formula may mix on-field and off-field parts. Layer 2.5 narrows
      // per-part later.
      if (
        !(
          this.isBuffApplicableForChar(
            buff,
            providerCharId,
            onFieldCharId,
            true /* on-field */
          ) ||
          this.isBuffApplicableForChar(
            buff,
            providerCharId,
            onFieldCharId,
            false /* off-field */
          )
        )
      )
        continue;
      if (!activeDynamicSet.has(buff)) continue;

      // Register the bridge for each input key and its implicit dependencies
      for (const baseKey of bridgeInputKeys) {
        const inputKeys = [baseKey, ...(SCALED_DEPS[baseKey] ?? [])];
        for (const iKey of inputKeys) {
          const bridgeKey = `${providerCharId}\0${iKey}`;
          let outputs = scalingBridge.get(bridgeKey);
          if (!outputs) {
            outputs = new Set();
            scalingBridge.set(bridgeKey, outputs);
          }
          outputs.add(bridgeOutputKey);
        }
      }
    }

    // ── Display loop ──
    // Pre-compute field-state flags (invariant across buffs).
    const hasOnFieldParts = partOffField.some((f) => !f);
    const hasOffFieldParts =
      offFieldPreStats != null && partOffField.some((f) => f);

    // Iterate charBuffEntries (not cb.getAllBuffs()) so Set.has() matches.
    for (const { buff, providerCharId: ownerId } of charBuffEntries) {
      const applicable = this.isBuffApplicableForTeam(buff, ownerId);

      // Resolve dynamic entries with per-entry caps.
      // Evaluate using stats matching the formula's actual field states:
      // - on-field parts use preStats/midStats (built with formula char on-field)
      // - off-field parts use offFieldPreStats/offFieldMidStats (different on-field char)
      let dynamicEntries: ResolvedStatEntry[] = [];
      let active = false;
      let activePartIndices: number[] | undefined;

      const useMid = midStats && isDeferredFinalBuff(buff);

      // Evaluate in contexts that the formula actually uses
      const onRaw = hasOnFieldParts
        ? buff.dynamicBuffs(
            useMid ? midStats[ownerId]! : preStats[ownerId]!,
            useMid ? midStatsArr! : teamPreStatsArr
          )
        : undefined;
      const offRaw = hasOffFieldParts
        ? buff.dynamicBuffs(
            useMid && offFieldMidStats
              ? offFieldMidStats[ownerId]!
              : offFieldPreStats![ownerId]!,
            useMid && offFieldMidStats
              ? Object.values(offFieldMidStats)
              : Object.values(offFieldPreStats!)
          )
        : undefined;
      // Use whichever context produced entries (keys are identical in both).
      const raw = onRaw ?? offRaw ?? [];

      if (applicable) {
        if (raw.length > 0) {
          active = activeDynamicSet.has(buff);
        } else {
          active = activeStaticSet.has(buff);
        }
        if (active && partTags.length > 0) {
          // Collect the buff's output stat keys
          const rawOutputKeys = new Set<StatKey>();
          for (const e of buff.staticBuffs) rawOutputKeys.add(e.key);
          for (const e of raw) rawOutputKeys.add(e.key);

          // Determine the effective output keys that reach the damage formula.
          // A buff can reach the formula in two ways:
          // 1. Direct: outputs land on the calc target's stat sheet
          // 2. Indirect: outputs land on a teammate's sheet and feed a scaling
          //    buff whose output reaches the calc target
          const effectiveKeys = new Set<StatKey>();

          // Check if this buff directly affects the calc target's stat sheet.
          // Check both field states (true = on-field, false = off-field)
          // because the formula may mix on-field and off-field parts.
          // Layer 2.5 narrows per-part later.
          const reachesCalcTarget =
            this.isBuffApplicableForChar(
              buff,
              ownerId,
              onFieldCharId,
              true /* on-field */
            ) ||
            this.isBuffApplicableForChar(
              buff,
              ownerId,
              onFieldCharId,
              false /* off-field */
            );
          if (reachesCalcTarget) {
            for (const k of rawOutputKeys) effectiveKeys.add(k);
          }

          // Check indirect path via scaling bridge for all characters
          // the buff applies to (including calc target — their stats may
          // also feed their own scaling buffs).
          // Check both field states per character (same rationale as above).
          for (const cid of Object.keys(this.charBuilds)) {
            const buffApplies =
              this.isBuffApplicableForChar(
                buff,
                ownerId,
                cid,
                true /* on-field */
              ) ||
              this.isBuffApplicableForChar(
                buff,
                ownerId,
                cid,
                false /* off-field */
              );
            if (!buffApplies) continue;
            for (const outKey of rawOutputKeys) {
              const bridged = scalingBridge.get(`${cid}\0${outKey}`);
              if (bridged) for (const k of bridged) effectiveKeys.add(k);
            }
          }

          activePartIndices = [];
          // If no effective keys reach the formula at all, buff is irrelevant
          if (effectiveKeys.size > 0) {
            const fr = fieldReq(buff.target.receiver);
            for (let pi = 0; pi < partTags.length; pi++) {
              // Layer 2.5: Field-context filter — onField buffs don't apply to
              // off-field parts, offField buffs don't apply to on-field parts
              if (fr === "on" && partOffField[pi]) continue;
              if (fr === "off" && !partOffField[pi]) continue;
              const tag = partTags[pi];
              // Layer 3: DamageTagFilter
              if (tag && buff.target.filter) {
                if (!filterMatchesTag(buff.target.filter!, tag)) continue;
              }
              // Layer 4: Stat relevance
              const rk = partReadKeys[pi];
              if (rk) {
                let relevant = false;
                for (const k of effectiveKeys) {
                  if (rk.has(k)) {
                    relevant = true;
                    break;
                  }
                }
                if (!relevant) continue;
              }
              activePartIndices.push(pi);
            }
          }
          active = activePartIndices.length > 0;
          // If active for all parts, omit the array (= universal)
          if (activePartIndices.length === partTags.length) {
            activePartIndices = undefined;
          }
        }
      }

      // Always populate dynamic entries for display, even when inactive.
      // When both on-field and off-field contexts exist, compute range.
      if (raw.length > 0) {
        dynamicEntries = raw.map((entry, i) => {
          const resolved: ResolvedStatEntry = { ...entry };
          annotateScalingInfo(buff, resolved);
          // If both contexts were evaluated, compare values and set range.
          if (onRaw && offRaw) {
            const onVal = onRaw[i]?.value ?? entry.value;
            const offVal = offRaw[i]?.value ?? entry.value;
            if (onVal !== offVal) {
              resolved.minValue = Math.min(onVal, offVal);
              resolved.maxValue = Math.max(onVal, offVal);
            }
          }
          return resolved;
        });
      }

      result.push({
        buffKey: getBuffInstanceKey(buff, ownerId),
        source: buff.source,
        providerCharId: ownerId,
        target: buff.target,
        active,
        activePartIndices,
        staticEntries: buff.staticBuffs,
        dynamicEntries,
      });
    }

    // Also include resonance buffs
    for (const buff of this.teamResonance.buffs) {
      let active = true;
      let activePartIndicesRes: number[] | undefined;
      if (partTags.length > 0) {
        const outputKeys = new Set<StatKey>(buff.staticBuffs.map((e) => e.key));
        // Resonance buffs apply to all team members — expand via bridge
        for (const charId of Object.keys(this.charBuilds)) {
          for (const outKey of [...outputKeys]) {
            const bridged = scalingBridge.get(`${charId}\0${outKey}`);
            if (bridged) for (const k of bridged) outputKeys.add(k);
          }
        }

        activePartIndicesRes = [];
        for (let pi = 0; pi < partTags.length; pi++) {
          const tag = partTags[pi];
          if (tag && buff.target.filter) {
            if (!filterMatchesTag(buff.target.filter!, tag)) continue;
          }
          const rk = partReadKeys[pi];
          if (rk && outputKeys.size > 0) {
            let relevant = false;
            for (const k of outputKeys) {
              if (rk.has(k)) {
                relevant = true;
                break;
              }
            }
            if (!relevant) continue;
          }
          activePartIndicesRes.push(pi);
        }
        active = activePartIndicesRes.length > 0;
        if (activePartIndicesRes.length === partTags.length) {
          activePartIndicesRes = undefined;
        }
      }
      result.push({
        buffKey: getBuffInstanceKey(buff),
        source: buff.source,
        target: buff.target,
        active,
        activePartIndices: activePartIndicesRes,
        staticEntries: buff.staticBuffs,
        dynamicEntries: [],
      });
    }

    // ── Extra buffs (food/env/status/custom) ──
    const extraBuffEntries = this.allStaticBuffs.filter(
      (b) => b.providerCharId === "extra"
    );
    for (const { buff } of extraBuffEntries) {
      // charId filter gates applicability
      if (buff.target.charId && buff.target.charId !== onFieldCharId) {
        result.push({
          buffKey: getBuffInstanceKey(buff, "extra"),
          source: buff.source,
          target: buff.target,
          active: false,
          staticEntries: buff.staticBuffs,
          dynamicEntries: [],
        });
        continue;
      }

      let active = true;
      let activePartIndicesExtra: number[] | undefined;
      if (partTags.length > 0) {
        const outputKeys = new Set<StatKey>(buff.staticBuffs.map((e) => e.key));
        // Extra buffs apply to team members — expand via bridge
        for (const charId of Object.keys(this.charBuilds)) {
          for (const outKey of [...outputKeys]) {
            const bridged = scalingBridge.get(`${charId}\0${outKey}`);
            if (bridged) for (const k of bridged) outputKeys.add(k);
          }
        }

        activePartIndicesExtra = [];
        for (let pi = 0; pi < partTags.length; pi++) {
          const tag = partTags[pi];
          if (tag && buff.target.filter) {
            if (!filterMatchesTag(buff.target.filter!, tag)) continue;
          }
          const rk = partReadKeys[pi];
          if (rk && outputKeys.size > 0) {
            let relevant = false;
            for (const k of outputKeys) {
              if (rk.has(k)) {
                relevant = true;
                break;
              }
            }
            if (!relevant) continue;
          }
          activePartIndicesExtra.push(pi);
        }
        active = activePartIndicesExtra.length > 0;
        if (activePartIndicesExtra.length === partTags.length) {
          activePartIndicesExtra = undefined;
        }
      }
      result.push({
        buffKey: getBuffInstanceKey(buff, "extra"),
        source: buff.source,
        target: buff.target,
        active,
        activePartIndices: activePartIndicesExtra,
        staticEntries: buff.staticBuffs,
        dynamicEntries: [],
      });
    }

    // ── Bespoke buffs (per-formula-part) ──
    {
      const calcBuild = this.charBuilds[onFieldCharId];
      const bespokeRaw = calcBuild.charBase.getBespokeBuffs();
      // Deduplicate by buff identity (same buff object on multiple parts)
      const seenBespokeBuffs = new Set<StatBuff>();
      for (const { formulaId: fId, label, buff } of bespokeRaw) {
        if (seenBespokeBuffs.has(buff)) continue;
        seenBespokeBuffs.add(buff);

        const ownerStats = preStats[onFieldCharId]!;
        const raw = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
        const active = formulaId === fId;

        let dynamicEntries: ResolvedStatEntry[] = [];
        if (raw.length > 0) {
          dynamicEntries = raw.map((entry: StatEntry) => {
            const resolved: ResolvedStatEntry = { ...entry };
            annotateScalingInfo(buff, resolved);
            return resolved;
          });
        }

        result.push({
          buffKey: getBuffInstanceKey(buff, onFieldCharId),
          source: buff.source,
          providerCharId: onFieldCharId,
          target: buff.target,
          active,
          staticEntries: buff.staticBuffs,
          dynamicEntries,
          bespokeLabel: label,
        });
      }
    }

    return result;
  }

  /**
   * Compute marginal damage gains for +1 avg substat roll.
   * onFieldCharId is the formula owner — they are on-field when executing.
   */
  private computeMarginalGainsUnified(
    onFieldCharId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    baseDamage: number,
    reactionOverride?: ReactionOverride,
    hasOffField?: boolean,
    forceOnField?: boolean
  ): Record<string, Partial<Record<StatKey, number>>> {
    if (baseDamage === 0) return {};

    const evalFn = (sheets: Record<string, StatSheet>): number => {
      const stats = this.getTeamStats(sheets, onFieldCharId, ctx);
      const offFieldStats = hasOffField
        ? this.getOffFieldPostStats(onFieldCharId, sheets, ctx)
        : undefined;
      const build = this.charBuilds[onFieldCharId]!;
      return build.getDamageResult(
        formulaId,
        stats[onFieldCharId]!,
        Object.values(stats),
        ctx,
        reactionOverride,
        offFieldStats,
        undefined, // partialBuffs
        undefined, // statsVariants
        undefined, // offFieldVariants
        undefined, // charLevelOverride
        forceOnField
      ).totalDamage;
    };

    const charIds = Object.keys(this.charBuilds);
    const deltas = computeSubstatMarginals(
      evalFn,
      artifactStats,
      baseDamage,
      charIds
    );

    // Convert absolute deltas → relative gains
    const gains: Record<string, Partial<Record<StatKey, number>>> = {};
    for (const [cid, charDeltas] of Object.entries(deltas)) {
      const charGains: Partial<Record<StatKey, number>> = {};
      for (const [key, delta] of Object.entries(charDeltas)) {
        charGains[key as StatKey] = delta / baseDamage;
      }
      gains[cid] = charGains;
    }
    return gains;
  }

  /**
   * Compute the relative damage gain from leveling each Lv90 character to Lv100.
   * Rebuilds the team with the character at Lv100 and compares damage.
   */
  private computeLevelUpGains(
    onFieldCharId: string,
    formulaId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    baseDamage: number,
    reactionOverride?: ReactionOverride,
    hasOffField?: boolean,
    forceOnField?: boolean
  ): Record<string, { gain: number; from: number; to: number }[]> {
    if (baseDamage === 0) return {};

    return this.iterateLevelUpGains((charId, targetLevel) => {
      const tweakedConfigs = this.configs.map((c) =>
        c.charId === charId ? { ...c, charLevel: targetLevel } : c
      );
      const tweakedTeam = new TeamBuild(
        tweakedConfigs,
        this.combatOpts,
        this.enemyAura,
        this.extraBuffs
      );
      const tweakedStats = tweakedTeam.getTeamStats(
        artifactStats,
        onFieldCharId,
        ctx
      );
      let offFieldTeamStats: Record<string, StatSheet> | undefined;
      if (hasOffField) {
        offFieldTeamStats = tweakedTeam.getOffFieldStats(
          artifactStats,
          onFieldCharId,
          ctx
        );
      }
      const tweakedResult = tweakedTeam.getDamageResult(
        onFieldCharId,
        formulaId,
        tweakedStats,
        ctx,
        reactionOverride,
        offFieldTeamStats,
        undefined, // partialBuffs
        undefined, // statsVariants
        undefined, // offFieldVariants
        undefined, // formulaOwnerCharId
        forceOnField
      );
      return (tweakedResult.totalDamage - baseDamage) / baseDamage;
    });
  }

  /**
   * Shared iteration for level-up gain computation. For each team member,
   * checks the next level tier and optionally the 90→100 jump, calling
   * the provided gain function and collecting positive-gain entries.
   */
  private iterateLevelUpGains(
    computeGain: (charId: string, targetLevel: number) => number
  ): Record<string, { gain: number; from: number; to: number }[]> {
    const gains: Record<string, { gain: number; from: number; to: number }[]> =
      {};
    for (const config of this.configs) {
      const nextLevel = getNextLevelTier(config.charLevel);
      if (!nextLevel) continue;

      const entries: { gain: number; from: number; to: number }[] = [];
      const gain = computeGain(config.charId, nextLevel);
      if (gain > 0) {
        entries.push({ gain, from: config.charLevel, to: nextLevel });
      }
      if (config.charLevel === 90 && nextLevel < 100) {
        const fullGain = computeGain(config.charId, 100);
        if (fullGain > 0) {
          entries.push({ gain: fullGain, from: config.charLevel, to: 100 });
        }
      }
      if (entries.length > 0) {
        gains[config.charId] = entries;
      }
    }
    return gains;
  }

  /**
   * Convert a BuffActivationMap (from the override store) into PartialBuffInfo[]
   * suitable for the optimizer's AST compiler. Handles both stack-limited buffs
   * (greedy allocation + user overrides) and non-stack-limited user overrides.
   */
  computePartialBuffSpecs(
    carryCharId: string,
    formulaId: string,
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    userOverrides?: BuffActivationMap,
    forceOnField?: boolean
  ): PartialBuffInfo[] {
    const build = this.charBuilds[carryCharId];
    if (!build) return [];
    const entry = build.charBase.getFormulaEntry(formulaId);
    if (!entry) return [];

    // Compute pre-stats for collectStackLimitedBuffs
    const fieldDependent = this.getFieldDependentBuffs(carryCharId);
    const preStats = this.buildPreStatsFromBuilds(sheets, fieldDependent);
    const teamPreStatsArr = Object.values(preStats);

    // Stack-limited buffs
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      teamPreStatsArr
    );

    const infos: PartialBuffInfo[] = [];

    if (stackLimited.length > 0) {
      const { partEvals, partHits, sansBuffPartStats } = this.buildPartEvals(
        carryCharId,
        entry,
        sheets,
        ctx,
        forceOnField,
        stackLimited
      );

      const defaultActivation = computeDefaultActivation(
        partEvals,
        partHits,
        stackLimited,
        ctx,
        sansBuffPartStats
      );
      // Merge user overrides on top of greedy defaults
      const merged: BuffActivationMap = { ...defaultActivation };
      if (userOverrides) {
        TeamBuild.mergeActivationOverrides(merged, userOverrides);
      }
      infos.push(...buildPartialBuffInfos(merged, stackLimited, entry.parts));
    }

    // Non-stack-limited user overrides
    if (userOverrides && Object.keys(userOverrides).length > 0) {
      infos.push(
        ...buildUserOverrideInfos(
          userOverrides,
          this.allStaticBuffs,
          entry.parts,
          (buff, providerId) =>
            this.couldBuffApplyToChar(buff, providerId, carryCharId)
        )
      );
    }

    return infos;
  }

  /**
   * Compute per-line PartialBuffInfo[] for a combo rotation.
   *
   * Shares the maxStack budget across ALL combo lines (unlike the per-formula
   * computePartialBuffSpecs which gives each formula the full budget).
   * Also merges per-line user overrides on top of the combo-wide defaults.
   */
  computeComboPartialBuffSpecs(
    activeLines: ComboLine[],
    sheets: Record<string, StatSheet>,
    ctx: CalcContext,
    rxnOverrides?: Record<string, ReactionOverride>,
    perLineUserOverrides?: Map<number, BuffActivationMap>
  ): Record<number, PartialBuffInfo[]> | undefined {
    if (activeLines.length === 0) return undefined;

    const { defaultActivations, stackLimited, lineEntries } =
      this.buildComboDefaults(activeLines, sheets, ctx);

    // ── Merge defaults + user overrides → PartialBuffInfo[] per line ──
    const result: Record<number, PartialBuffInfo[]> = {};

    for (let lineIdx = 0; lineIdx < activeLines.length; lineIdx++) {
      const entry = lineEntries[lineIdx];
      if (!entry) continue;

      const merged: BuffActivationMap = { ...defaultActivations[lineIdx] };
      const userOv = perLineUserOverrides?.get(lineIdx);
      if (userOv) {
        TeamBuild.mergeActivationOverrides(merged, userOv);
      }

      const infos: PartialBuffInfo[] = [];

      if (stackLimited.length > 0) {
        infos.push(...buildPartialBuffInfos(merged, stackLimited, entry.parts));
      }

      if (userOv && Object.keys(userOv).length > 0) {
        const lineCharId = activeLines[lineIdx].charId;
        infos.push(
          ...buildUserOverrideInfos(
            userOv,
            this.allStaticBuffs,
            entry.parts,
            (buff, providerId) =>
              this.couldBuffApplyToChar(buff, providerId, lineCharId)
          )
        );
      }

      if (infos.length > 0) {
        result[lineIdx] = infos;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Compute combo-wide default activations and stack-limited buff info.
   *
   * Used by both the damage calc hot path (computeComboPartialBuffSpecs) and
   * the display/dialog path (getComboFormulaDefaults) so that both share the
   * same maxStack budget across ALL combo lines.
   */
  getComboFormulaDefaults(
    activeLines: ComboLine[],
    sheets: Record<string, StatSheet>,
    ctx: CalcContext
  ): {
    perLine: BuffActivationMap[];
    stackLimited: StackLimitedBuffInfo[];
  } {
    if (activeLines.length === 0) return { perLine: [], stackLimited: [] };
    const { defaultActivations, stackLimited } = this.buildComboDefaults(
      activeLines,
      sheets,
      ctx
    );
    return { perLine: defaultActivations, stackLimited };
  }

  /**
   * Build combo-wide default activation by resolving stats and running
   * computeComboDefaultActivation. Shared between computeComboPartialBuffSpecs
   * and getComboFormulaDefaults.
   */
  private buildComboDefaults(
    activeLines: ComboLine[],
    sheets: Record<string, StatSheet>,
    ctx: CalcContext
  ): {
    defaultActivations: BuffActivationMap[];
    stackLimited: StackLimitedBuffInfo[];
    lineEntries: (FormulaEntry | null)[];
  } {
    // ── Collect stack-limited buffs ──
    // Field context doesn't matter here: collectStackLimitedBuffs only checks
    // whether dynamicBuffs() returns entries (always true for non-no-op buffs),
    // not their values. Any on-field character produces the same result.
    const fieldDependent = this.getFieldDependentBuffs(activeLines[0].charId);
    const preStats = this.buildPreStatsFromBuilds(sheets, fieldDependent);
    const stackLimited = collectStackLimitedBuffs(
      this.allStaticBuffs,
      preStats,
      Object.values(preStats)
    );

    // ── Build per-line evaluation data ──
    const lineContexts: ComboLineEval[] = [];
    const lineEntries: (FormulaEntry | null)[] = [];

    for (const line of activeLines) {
      const cb = this.charBuilds[line.charId];
      // Prefer charBase lookup to avoid formulaIndex collisions (e.g. manekin);
      // fall back to formulaIndex for reaction/cross-scaled formulas.
      const entry =
        cb?.charBase.getFormulaEntry(line.formulaId) ??
        this.formulaIndex.get(line.formulaId) ??
        null;
      lineEntries.push(entry);
      if (!entry || !cb) {
        lineContexts.push({
          partEvals: [],
          partHits: [],
          lineCount: line.count,
        });
        continue;
      }

      const { partEvals, partHits, sansBuffPartStats } = this.buildPartEvals(
        line.charId,
        entry,
        sheets,
        ctx,
        line.forceOnField,
        stackLimited.length > 0 ? stackLimited : undefined
      );

      lineContexts.push({
        partEvals,
        partHits,
        lineCount: line.count,
        sansBuffPartStats,
      });
    }

    // ── Combo-wide default activation (shared maxStack budget) ──
    const defaultActivations = computeComboDefaultActivation(
      lineContexts,
      stackLimited,
      ctx
    );

    return { defaultActivations, stackLimited, lineEntries };
  }

  /**
   * Compute off-field stats for a formula character.
   * Uses the first other team member as on-field, matching the compiler path.
   */
  private getOffFieldStats(
    artifactStats: Record<string, StatSheet>,
    formulaCharId: string,
    ctx: CalcContext
  ): Record<string, StatSheet> {
    // We teach users to put carry on 1st slot, so this is the best approximiation
    // to off field stats (where carry is on field)
    const other = defaultOnFieldCharId(formulaCharId, this.configs);
    return this.getTeamStats(artifactStats, other, ctx);
  }
}
