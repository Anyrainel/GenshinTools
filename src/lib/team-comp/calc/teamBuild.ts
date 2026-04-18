import type { Element } from "@/data/types";
import { getNextLevelTier } from "@/lib/gameStatsLoader";
import {
  type BuffActivationMap,
  type CalcContext,
  type ComboFormula,
  type ComboLine,
  type ComboResult,
  type ComboTemplate,
  type DamageResult,
  type DamageTag,
  type DisplayPart,
  type DisplayResult,
  type ExtraBuff,
  type FieldState,
  type FormulaEntry,
  type FormulaOverride,
  type I18nLabel,
  type OptimizerContext,
  type OptionMap,
  type ProvidedStaticBuff,
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
  type ComboLineContext,
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
import { TeamMeta } from "./teamMeta";
import { LUNAR_RANK_WEIGHTS, TeamReactionProvider } from "./teamReaction";
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
  readonly reactionProvider: TeamReactionProvider;
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
    this.reactionProvider = new TeamReactionProvider(
      this.teamMeta,
      charBases,
      configs
    );

    // Pre-compute rank weights for multi-contributor lunar formulas
    // using baseline stats (no artifacts) so ranking is deterministic.
    this.computeBaselineLunarRanks(configs);

    // Build flat formulaIndex: character formulas + reaction formulas
    this.formulaIndex = new Map();
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      for (const [fid, entry] of Object.entries(
        build.charBase.allFormulaEntries
      )) {
        if (!entry.owner) entry.owner = charId;
        this.formulaIndex.set(fid, entry);
      }
    }
    for (const [fid, label] of Object.entries(
      this.reactionProvider.getFormulaIds()
    )) {
      const entry = this.reactionProvider.getFormulaEntry(fid);
      if (entry) this.formulaIndex.set(fid, entry);
    }
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
        this.buildTeamPostStatsRaw(preStats, sheetBuffs, onFieldCharId)
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
   * Collect field-dependent buffs grouped by field state per character.
   * Returns { onField, offField } arrays for each character ID, independent
   * of which specific character is on-field.
   */
  private getUnifiedFieldDependentBuffs(): Record<
    string,
    { onField: ProvidedStaticBuff[]; offField: ProvidedStaticBuff[] }
  > {
    const result: Record<
      string,
      { onField: ProvidedStaticBuff[]; offField: ProvidedStaticBuff[] }
    > = {};
    for (const charId of Object.keys(this.charBuilds)) {
      const onField: ProvidedStaticBuff[] = [];
      const offField: ProvidedStaticBuff[] = [];
      for (const b of this.allStaticBuffs) {
        if (!isFieldDependentReceiver(b.buff.target.receiver)) continue;
        if (
          this.isBuffApplicableForChar(b.buff, b.providerCharId, charId, true)
        )
          onField.push(b);
        if (
          this.isBuffApplicableForChar(b.buff, b.providerCharId, charId, false)
        )
          offField.push(b);
      }
      result[charId] = { onField, offField };
    }
    return result;
  }

  /**
   * Apply dynamic buffs to preStats without CR-target adjustment.
   * Used as the intermediate "midStats" step in two-pass dynamic buff evaluation,
   * so that final-stat ScalingBuffs can see sheet-stat dynamic buffs (e.g. Bennett ATK).
   */
  private buildTeamPostStatsRaw(
    preStats: Record<string, StatSheet>,
    dynamicBuffs: EvaluatedDynamicBuff[],
    onFieldCharId: string
  ): Record<string, StatSheet> {
    const result: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getPostStats(
        preStats[id]!,
        dynamicBuffs,
        id,
        isOnField(id, onFieldCharId),
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }
    return result;
  }

  /**
   * Build post-stats for all team members: apply dynamic buffs + perCharCrTarget.
   * Char-level field state: same rationale as getFieldDependentBuffs — runs
   * before formula parts exist, uses onFieldCharId for per-character on/off.
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
    if (ctx?.perCharCrTarget) {
      for (const [id, target] of Object.entries(ctx.perCharCrTarget)) {
        if (postStats[id]) {
          const crDelta = (100 - target) / 100;
          postStats[id] = postStats[id]!.withDelta("cr", crDelta);
        }
      }
    }
    return postStats;
  }

  /**
   * Build unified post-stats: apply dynamic buffs with field-state tagging.
   * No perCharCrTarget adjustment — used as midStats for two-pass evaluation.
   */
  private buildUnifiedTeamPostStatsRaw(
    preStats: Record<string, StatSheet>,
    dynamicBuffs: EvaluatedDynamicBuff[]
  ): Record<string, StatSheet> {
    const result: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getUnifiedPostStats(
        preStats[id]!,
        dynamicBuffs,
        id,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }
    return result;
  }

  /**
   * Build unified post-stats with perCharCrTarget adjustment.
   * Returns unified sheets — use `.withFieldState()` to get on/off views.
   */
  private buildUnifiedTeamPostStats(
    preStats: Record<string, StatSheet>,
    dynamicBuffs: EvaluatedDynamicBuff[],
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      postStats[id] = build.getUnifiedPostStats(
        preStats[id]!,
        dynamicBuffs,
        id,
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }
    if (ctx?.perCharCrTarget) {
      for (const [id, target] of Object.entries(ctx.perCharCrTarget)) {
        if (postStats[id]) {
          const crDelta = (100 - target) / 100;
          postStats[id] = postStats[id]!.withDelta("cr", crDelta);
        }
      }
    }
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
  computeIdleStatSheets(
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

    // Phase 1: Build unified idle pre-stats per character
    // Field-independent buffs are universal, field-dependent are tagged f:on/f:off
    const idlePreStats: Record<string, StatSheet> = {};
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      const universal: StatBuff[] = [];
      const onFieldOnly: StatBuff[] = [];
      const offFieldOnly: StatBuff[] = [];

      for (const { buff, providerCharId } of idleBuffs) {
        const fr = fieldReq(buff.target.receiver);
        if (fr === null) {
          // Field-independent: field state doesn't affect receiver rule
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
          // Check for matching field state
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

      let sheet = build.getIdlePreStats(
        artifactStats[charId] ?? new StatSheet([]),
        universal
      );
      if (onFieldOnly.length > 0) {
        const deduped = deduplicateBuffs(onFieldOnly, (b) => b.staticBuffs);
        sheet = sheet.apply(deduped, "on");
      }
      if (offFieldOnly.length > 0) {
        const deduped = deduplicateBuffs(offFieldOnly, (b) => b.staticBuffs);
        sheet = sheet.apply(deduped, "off");
      }
      idlePreStats[charId] = sheet;
    }

    // Phase 2: evaluate dynamic buffs from idle-eligible providers (two-pass)
    // Use on-field views for provider stat reads (common idle display assumption)
    const resolvedPreStats: Record<string, StatSheet> = {};
    for (const id of Object.keys(idlePreStats)) {
      resolvedPreStats[id] = idlePreStats[id]!.withFieldState("on");
    }
    const dynamicEntries = evaluateDynamicBuffsTwoPass(
      idleBuffs,
      resolvedPreStats,
      (sheetBuffs) => {
        const mid: Record<string, StatSheet> = {};
        for (const [cid, build] of Object.entries(this.charBuilds)) {
          mid[cid] = build.getPostStats(
            resolvedPreStats[cid]!,
            sheetBuffs,
            cid,
            true, // on-field for midStats provider reads
            this.teamMeta.regions[cid],
            this.teamMeta.factions[cid]
          );
        }
        return mid;
      }
    );

    // Phase 3: apply dynamic buffs → unified idle post-stats
    const unifiedPostStats: Record<string, StatSheet> = {};
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      unifiedPostStats[charId] = build.getUnifiedPostStats(
        idlePreStats[charId]!,
        dynamicEntries,
        charId,
        this.teamMeta.regions[charId],
        this.teamMeta.factions[charId]
      );
    }

    // Return on/off field views
    const result: Record<string, { onField: StatSheet; offField: StatSheet }> =
      {};
    for (const charId of Object.keys(this.charBuilds)) {
      result[charId] = {
        onField: unifiedPostStats[charId]!.withFieldState("on"),
        offField: unifiedPostStats[charId]!.withFieldState("off"),
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
   * Compute unified stat sheets for all team members.
   * Returns sheets with both on-field and off-field entries tagged with
   * `f:on`/`f:off`. Use `.withFieldState("on"/"off")` to get views.
   *
   * @param onFieldCharId Still needed to determine provider field state
   *   for dynamic buff evaluation (ScalingBuff reads from provider's actual stats).
   */
  getTeamStatsUnified(
    artifactStats: Record<string, StatSheet>,
    onFieldCharId: string,
    ctx?: CalcContext
  ): Record<string, StatSheet> {
    const fieldDep = this.getUnifiedFieldDependentBuffs();
    const preStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      preStats[id] = build.getUnifiedPreStats(
        artifactStats[id] ?? new StatSheet([]),
        fieldDep[id]!.onField,
        fieldDep[id]!.offField
      );
    }

    // For dynamic buff evaluation, providers need a resolved view of their stats
    // based on their actual field state (determined by onFieldCharId).
    // Create resolved views for the two-pass evaluator.
    const resolvedPreStats: Record<string, StatSheet> = {};
    for (const id of Object.keys(preStats)) {
      const fs: FieldState = isOnField(id, onFieldCharId) ? "on" : "off";
      resolvedPreStats[id] = preStats[id]!.withFieldState(fs);
    }

    const teamPreStatsArr = Object.values(resolvedPreStats);

    // Two-pass dynamic buff evaluation uses resolved preStats for provider reads.
    // The midStats builder also needs to produce resolved stats (not unified)
    // because ScalingBuff.dynamicBuffs() reads from the provider's actual field state.
    const allDynamicBuffs = evaluateDynamicBuffsTwoPass(
      this.allStaticBuffs,
      resolvedPreStats,
      (sheetBuffs) =>
        this.buildTeamPostStatsRaw(resolvedPreStats, sheetBuffs, onFieldCharId)
    );

    return this.buildUnifiedTeamPostStats(preStats, allDynamicBuffs, ctx);
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
      this.buildTeamPostStatsRaw(preStats, sheetBuffs, onFieldCharId)
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
   * Create a unified optimizer context where supportPreStats contain both
   * on-field and off-field entries tagged with f:on/f:off. Eliminates the
   * need for separate off-field optimizer contexts per formula.
   *
   * @param onFieldCharId Still needed for provider field-state during dynamic
   *   buff expression evaluation (ScalingBuff reads from provider's resolved stats).
   */
  createUnifiedOptimizerContext(
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

    const unifiedFieldDep = this.getUnifiedFieldDependentBuffs();

    // Flatten for legacy targetDependent compat (on-field view)
    const targetDependent: Record<string, ProvidedStaticBuff[]> = {};
    for (const [id, dep] of Object.entries(unifiedFieldDep)) {
      targetDependent[id] = [...dep.onField, ...dep.offField];
    }

    // Build unified supportPreStats for non-variable characters
    const supportPreStats: Record<string, StatSheet> = {};
    const charBuildOrder = Object.entries(this.charBuilds);
    for (const [id, build] of charBuildOrder) {
      if (!variableCharIds.has(id)) {
        supportPreStats[id] = build.getUnifiedPreStats(
          baseSheets[id] ?? new StatSheet([]),
          unifiedFieldDep[id]!.onField,
          unifiedFieldDep[id]!.offField
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
      unifiedFieldDep,
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
   * Build sans-buff stat maps for stack-limited greedy allocation.
   * For each stack-limited buff, computes team stats with that buff excluded.
   * Returns { onField, offField? } maps keyed by canonical buff key.
   */
  private buildSansBuffStats(
    stackLimited: ReturnType<typeof collectStackLimitedBuffs>,
    charId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext | undefined,
    offFieldPostStats?: StatSheet
  ): {
    sansBuffStats: Map<string, StatSheet>;
    offFieldSansBuffStats?: Map<string, StatSheet>;
  } {
    const sansBuffStats = new Map<string, StatSheet>();
    for (const buffInfo of stackLimited) {
      const bKey = buffInfo.buffKey;
      const excluded = this.getTeamStatsExcluding(
        artifactStats,
        charId,
        ctx,
        new Set([bKey])
      );
      sansBuffStats.set(bKey, excluded[charId]!);
    }
    let offFieldSansBuffStats: Map<string, StatSheet> | undefined;
    if (offFieldPostStats) {
      const offOther = defaultOnFieldCharId(charId, this.configs);
      offFieldSansBuffStats = new Map();
      for (const buffInfo of stackLimited) {
        const bKey = buffInfo.buffKey;
        const excluded = this.getTeamStatsExcluding(
          artifactStats,
          offOther,
          ctx,
          new Set([bKey])
        );
        offFieldSansBuffStats.set(bKey, excluded[charId]!);
      }
    }
    return { sansBuffStats, offFieldSansBuffStats };
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

  /**
   * Create a cached getStats function that uses unified sheets internally.
   * Returns per-character views (on/off) based on the requested onFieldCharId.
   *
   * Key optimization: off-field stats are derived from the same unified sheet
   * as the on-field stats, avoiding a second computation.
   */
  private createStatsCacheFn(
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext,
    seed?: Map<string, Record<string, StatSheet>>
  ): (onFieldCharId: string) => Record<string, StatSheet> {
    // Cache of unified sheets keyed by onFieldCharId
    const unifiedCache = new Map<string, Record<string, StatSheet>>();
    // Cache of viewed results
    const viewCache = seed ?? new Map<string, Record<string, StatSheet>>();

    const getUnified = (onFieldCharId: string): Record<string, StatSheet> => {
      if (!unifiedCache.has(onFieldCharId)) {
        unifiedCache.set(
          onFieldCharId,
          this.getTeamStatsUnified(artifactStats, onFieldCharId, ctx)
        );
      }
      return unifiedCache.get(onFieldCharId)!;
    };

    return (onFieldCharId: string) => {
      if (!viewCache.has(onFieldCharId)) {
        const unified = getUnified(onFieldCharId);
        const viewed: Record<string, StatSheet> = {};
        for (const [id, sheet] of Object.entries(unified)) {
          viewed[id] = sheet.withFieldState(
            isOnField(id, onFieldCharId) ? "on" : "off"
          );
        }
        viewCache.set(onFieldCharId, viewed);
      }
      return viewCache.get(onFieldCharId)!;
    };
  }

  /**
   * Compute off-field post-stats for a character's formula.
   * Uses unified sheets with the formula owner on-field, then extracts
   * the off-field view. This ensures provider field-state is correct
   * (matches the compiler's unified approach).
   */
  private getOffFieldPostStats(
    charId: string,
    artifactStats: Record<string, StatSheet>,
    ctx: CalcContext | undefined
  ): StatSheet | undefined {
    // Use the first other team member as on-field, matching evaluateCombo
    // and the compile path's buildOffFieldPostExprStatsForContext.
    const other = defaultOnFieldCharId(charId, this.configs);
    const offFieldStats = this.getTeamStats(artifactStats, other, ctx);
    return offFieldStats[charId];
  }

  /** All available formulas across all characters */
  getFormulaIds(): Record<string, Record<string, I18nLabel>> {
    const result: Record<string, Record<string, I18nLabel>> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getFormulaIds();
    }
    return result;
  }

  /** All formulas including constellation-locked ones, with minC/enabled info. */
  getAllFormulaIds(): Record<
    string,
    Record<string, { label: I18nLabel; minC: number; enabled: boolean }>
  > {
    const result: Record<
      string,
      Record<string, { label: I18nLabel; minC: number; enabled: boolean }>
    > = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      result[id] = build.getAllFormulaIds();
    }
    return result;
  }

  /** Team-wide reaction formula IDs with labels. */
  getReactionFormulaIds(): Record<string, I18nLabel> {
    return this.reactionProvider.getFormulaIds();
  }

  /** Default combo counts for a character (from CharacterBase.combo). */
  getCombo(charId: string): Record<string, number> {
    return this.charBuilds[charId]?.charBase.combo ?? {};
  }

  /** Raw combo descriptor for a character (for per-constellation resolution). */
  getComboDescriptor(charId: string): ComboTemplate {
    return this.charBuilds[charId]?.charBase.rawComboDescriptor ?? [];
  }

  /** Reaction combo as ComboLine[], ready to append to default combo.
   *  Each line uses a per-triggerer formula ID (e.g. rx-overloaded-amber)
   *  with charId = statsCharId from the reaction entry. */
  getReactionComboLines(): ComboLine[] {
    const resolved = this.reactionProvider.getReactionComboCounts();
    const lines: ComboLine[] = [];
    for (const [formulaId, count] of Object.entries(resolved)) {
      if (count <= 0) continue;
      const entry = this.reactionProvider.getFormulaEntry(formulaId);
      const charId = entry?.statsCharId ?? "";
      lines.push({ charId, formulaId, count });
    }
    return lines;
  }

  /**
   * Evaluate a combo formula: weighted sum of multiple formula lines,
   * potentially from different characters with different reaction overrides.
   *
   * Groups lines by on-field character and caches getTeamStats() per unique
   * onFieldCharId for efficiency (typically 1-2 unique on-field characters).
   */
  evaluateCombo(
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
            line.reaction
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
        formulaOwner
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

    // ── Collect all formula tags per character ──
    const charFormulaTags: Record<string, DamageTag[]> = {};
    for (const cid of allCharIds) {
      const tags: DamageTag[] = [];
      const seen = new Set<string>();
      const formulaIds = this.getFormulaIds()[cid];
      if (formulaIds) {
        for (const fid of Object.keys(formulaIds)) {
          const fEntry =
            this.charBuilds[cid]?.charBase.getFormulaEntry(fid) ??
            this.formulaIndex.get(fid);
          if (!fEntry) continue;
          for (const part of fEntry.parts) {
            const t = part.formula.tag;
            const key = `${t.element}|${t.ability}|${t.reaction}`;
            if (!seen.has(key)) {
              seen.add(key);
              tags.push(t);
            }
          }
        }
      }
      charFormulaTags[cid] = tags;
    }

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
    const baseResult = this.evaluateCombo(
      { ...combo, lines: activeLines },
      artifactStats,
      ctx,
      buffOverrides,
      statsCache
    );
    const baseDamage = baseResult.totalDamage;
    const fullBuffBaseDamage = buffOverrides
      ? this.evaluateCombo(
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
        this.evaluateCombo(comboConfig, sheets, ctx).totalDamage;

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
          this.evaluateCombo(comboConfig, sheets, ctx).totalDamage;
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
          line.reaction
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
    > = {};
    if (fullBuffBaseDamage > 0) {
      const computeComboGain = (charId: string, targetLevel: number) => {
        const tweakedConfigs = this.configs.map((c) =>
          c.charId === charId ? { ...c, charLevel: targetLevel } : c
        );
        const tweakedTeam = new TeamBuild(
          tweakedConfigs,
          this.combatOpts,
          this.enemyAura,
          this.extraBuffs
        );
        const newResult = tweakedTeam.evaluateCombo(
          { ...combo, lines: activeLines },
          artifactStats,
          ctx
        );
        return (
          (newResult.totalDamage - fullBuffBaseDamage) / fullBuffBaseDamage
        );
      };

      for (const config of this.configs) {
        const nextLevel = getNextLevelTier(config.charLevel);
        if (!nextLevel) continue;
        const entries: { gain: number; from: number; to: number }[] = [];
        const gain = computeComboGain(config.charId, nextLevel);
        if (gain > 0) {
          entries.push({ gain, from: config.charLevel, to: nextLevel });
        }
        if (config.charLevel === 90 && nextLevel < 100) {
          const fullGain = computeComboGain(config.charId, 100);
          if (fullGain > 0) {
            entries.push({ gain: fullGain, from: config.charLevel, to: 100 });
          }
        }
        if (entries.length > 0) {
          levelUpGains[config.charId] = entries;
        }
      }
    }

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
        entry?.parts.some((p) => isPartOffField(p, effectiveReaction)) ?? false;
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
        offFieldPostStats
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
    reactionOverride?: FormulaOverride,
    offFieldTeamStats?: Record<string, StatSheet>,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>,
    formulaOwnerCharId?: string
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
      statsCharLevel
    );
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
    reactionOverride?: FormulaOverride
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
      ? this.buildTeamPostStatsRaw(
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
      entry?.parts.some((p) => isPartOffField(p, reactionOverride)) ?? false;
    let offFieldPreStats: Record<string, StatSheet> | undefined;
    let offFieldMidStats: Record<string, StatSheet> | undefined;
    if (formulaHasOffField) {
      const offOther = defaultOnFieldCharId(charId, this.configs);
      const offFieldDep = this.getFieldDependentBuffs(offOther);
      offFieldPreStats = this.buildPreStatsFromBuilds(
        artifactStats,
        offFieldDep
      );
      const offTeamArr = Object.values(offFieldPreStats);
      const offDynamic = this.collectDynamicBuffs(
        offFieldPreStats,
        offTeamArr,
        offOther
      );
      if (hasAnyFinalBuffs) {
        offFieldMidStats = this.buildTeamPostStatsRaw(
          offFieldPreStats,
          offDynamic.filter((b) => !isDeferredFinalBuff(b.buff)),
          offOther
        );
      }
    }

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
      offFieldPostStats
    );

    const partReadKeys = parts.map((p) => p.readKeys);
    const partOffField =
      entry?.parts.map((p) => isPartOffField(p, reactionOverride)) ?? [];

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
    reactionOverride?: FormulaOverride,
    userBuffOverrides?: BuffActivationMap,
    externalPartialBuffs?: PartialBuffInfo[]
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
      ? this.buildTeamPostStatsRaw(
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
      entry?.parts.some((p) => isPartOffField(p, reactionOverride)) ?? false;
    const offFieldPostStats = formulaHasOffField
      ? this.getOffFieldPostStats(charId, artifactStats, ctx)
      : undefined;

    // Build off-field preStats/midStats for ScalingBuff range display.
    // When a ScalingBuff provider has different stats on-field vs off-field
    // (e.g., Shenhe's ATK differs with/without Bennett's teamOnField buff),
    // the buff value varies per part → show min~max in UI.
    let offFieldPreStats: Record<string, StatSheet> | undefined;
    let offFieldMidStats: Record<string, StatSheet> | undefined;
    if (formulaHasOffField) {
      const offOther = defaultOnFieldCharId(charId, this.configs);
      const offFieldDep = this.getFieldDependentBuffs(offOther);
      offFieldPreStats = this.buildPreStatsFromBuilds(
        artifactStats,
        offFieldDep
      );
      const offTeamArr = Object.values(offFieldPreStats);
      const offDynamic = this.collectDynamicBuffs(
        offFieldPreStats,
        offTeamArr,
        offOther
      );
      if (hasAnyFinalBuffs) {
        offFieldMidStats = this.buildTeamPostStatsRaw(
          offFieldPreStats,
          offDynamic.filter((b) => !isDeferredFinalBuff(b.buff)),
          offOther
        );
      }
    }

    let { parts, totalDamage } = build.getDisplayParts(
      formulaId,
      postStats[charId]!,
      ctx,
      reactionOverride,
      offFieldPostStats
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
      // 1. Pre-build sans-buff stats for greedy allocation
      let sansBuffStats: Map<string, StatSheet> | undefined;
      let offFieldSansBuffStats: Map<string, StatSheet> | undefined;
      if (stackLimited.length > 0) {
        const sans = this.buildSansBuffStats(
          stackLimited,
          charId,
          artifactStats,
          ctx,
          offFieldPostStats
        );
        sansBuffStats = sans.sansBuffStats;
        offFieldSansBuffStats = sans.offFieldSansBuffStats;
      }

      // 2. Greedy allocation for stack-limited buffs
      let mergedActivation: BuffActivationMap = {};
      if (stackLimited.length > 0) {
        const defaultActivation = computeDefaultActivation(
          entry.parts,
          stackLimited,
          postStats[charId]!,
          build.charBase.charLevel,
          ctx,
          reactionOverride,
          offFieldPostStats,
          sansBuffStats,
          offFieldSansBuffStats
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
          reactionOverride
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
      entry?.parts.map((p) => isPartOffField(p, reactionOverride)) ?? [];
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

    // ── Collect all formula tags per character ──
    const charFormulaTags: Record<string, DamageTag[]> = {};
    for (const [cid, cb] of Object.entries(this.charBuilds)) {
      const tags: DamageTag[] = [];
      const seen = new Set<string>();
      for (const fid of Object.keys(cb.getFormulaIds())) {
        const fEntry = cb.charBase.getFormulaEntry(fid);
        if (!fEntry) continue;
        for (const part of fEntry.parts) {
          const t = part.formula.tag;
          const key = `${t.element}|${t.ability}|${t.reaction}`;
          if (!seen.has(key)) {
            seen.add(key);
            tags.push(t);
          }
        }
      }
      charFormulaTags[cid] = tags;
    }

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
      formulaHasOffField
    );

    // ── Level-up gains (Lv90 → Lv100) ──
    const levelUpGains = this.computeLevelUpGains(
      charId,
      formulaId,
      artifactStats,
      ctx,
      fullBuffDamage,
      reactionOverride,
      formulaHasOffField
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
          formulaHasOffField
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
    reactionOverride?: FormulaOverride,
    hasOffField?: boolean
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
        offFieldStats
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
    reactionOverride?: FormulaOverride,
    hasOffField?: boolean
  ): Record<string, { gain: number; from: number; to: number }[]> {
    if (baseDamage === 0) return {};

    const computeGain = (charId: string, targetLevel: number) => {
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
        offFieldTeamStats = getOffFieldStats(
          tweakedTeam,
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
        offFieldTeamStats
      );
      return (tweakedResult.totalDamage - baseDamage) / baseDamage;
    };

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
      // For level 90, also show the full 90→100 gain
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
    reactionOverride?: FormulaOverride,
    userOverrides?: BuffActivationMap
  ): PartialBuffInfo[] {
    const build = this.charBuilds[carryCharId];
    if (!build) return [];
    const entry = build.charBase.getFormulaEntry(formulaId);
    if (!entry) return [];

    // Compute post stats
    const postStats = this.getTeamStats(sheets, carryCharId, ctx);

    const offFieldPostStats = entry.parts.some((p) => p.offField)
      ? this.getOffFieldPostStats(carryCharId, sheets, ctx)
      : undefined;

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
      const { sansBuffStats, offFieldSansBuffStats } = this.buildSansBuffStats(
        stackLimited,
        carryCharId,
        sheets,
        ctx,
        offFieldPostStats
      );

      const defaultActivation = computeDefaultActivation(
        entry.parts,
        stackLimited,
        postStats[carryCharId]!,
        build.charBase.charLevel,
        ctx,
        reactionOverride,
        offFieldPostStats,
        sansBuffStats,
        offFieldSansBuffStats
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
    rxnOverrides?: Record<string, FormulaOverride>,
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

    // ── Build per-line contexts with correct postStats ──
    const getStats = this.createStatsCacheFn(sheets, ctx);

    const lineContexts: ComboLineContext[] = [];
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
          parts: [],
          lineCount: line.count,
          postStats: new StatSheet([]),
          charLevel: 0,
        });
        continue;
      }

      const teamStats = getStats(line.charId);
      const linePostStats = teamStats[line.charId]!;

      const offFieldPostStats = entry.parts.some((p) => p.offField)
        ? this.getOffFieldPostStats(line.charId, sheets, ctx)
        : undefined;

      // Pre-build sans-buff stats for each stack-limited buff on this line
      let lineSansBuff: Map<string, StatSheet> | undefined;
      let lineOffFieldSansBuff: Map<string, StatSheet> | undefined;
      if (stackLimited.length > 0) {
        const sans = this.buildSansBuffStats(
          stackLimited,
          line.charId,
          sheets,
          ctx,
          offFieldPostStats
        );
        lineSansBuff = sans.sansBuffStats;
        lineOffFieldSansBuff = sans.offFieldSansBuffStats;
      }

      lineContexts.push({
        parts: entry.parts,
        lineCount: line.count,
        postStats: linePostStats,
        charLevel: cb.charBase.charLevel,
        offFieldPostStats,
        sansBuffStats: lineSansBuff,
        offFieldSansBuffStats: lineOffFieldSansBuff,
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
}
// Off-Field Helpers
/** Check if a formula has any off-field parts. */

export function hasOffFieldParts(
  teamBuild: TeamBuild,
  charId: string,
  formulaId: string
): boolean {
  const entry =
    teamBuild.charBuilds[charId]?.charBase.getFormulaEntry(formulaId) ??
    teamBuild.formulaIndex.get(formulaId);
  return entry?.parts.some((p) => p.offField) ?? false;
}
/** Check off-field status of a formula's parts. */

export function offFieldStatus(
  teamBuild: TeamBuild,
  charId: string,
  formulaId: string
): "full" | "partial" | "none" {
  const entry =
    teamBuild.charBuilds[charId]?.charBase.getFormulaEntry(formulaId) ??
    teamBuild.formulaIndex.get(formulaId);
  if (!entry || entry.parts.length === 0) return "none";
  const offCount = entry.parts.filter((p) => p.offField).length;
  if (offCount === entry.parts.length) return "full";
  if (offCount > 0) return "partial";
  return "none";
}
/**
 * Compute off-field stats for a formula character.
 * Uses the first other team member as on-field, matching the compiler path.
 */

export function getOffFieldStats(
  teamBuild: TeamBuild,
  artifactStats: Record<string, StatSheet>,
  formulaCharId: string,
  ctx: CalcContext
): Record<string, StatSheet> {
  const other = defaultOnFieldCharId(formulaCharId, teamBuild.configs);
  return teamBuild.getTeamStats(artifactStats, other, ctx);
}
