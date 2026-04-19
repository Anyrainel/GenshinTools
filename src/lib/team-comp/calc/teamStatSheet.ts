import type {
  CalcContext,
  ExtraBuff,
  ProvidedStaticBuff,
  TeamSlotConfig,
} from "../types";
import { type CacheKey, makeCacheKey } from "./cacheUtils";
import type { CharBuild } from "./charBuild";
import {
  type EvaluatedDynamicBuff,
  evaluateDynamicBuffsTwoPass,
} from "./dynamicBuffEval";
import { fieldReq, isFieldDependentReceiver, isOnField } from "./fieldState";
import {
  StatBuff,
  createExtraStatBuffs,
  deduplicateBuffs,
  getBuffInstanceKey,
  isBuffApplicable,
} from "./statBuff";
import { StatSheet } from "./statSheet";
import type { TeamMeta } from "./teamMeta";
import type { TeamResonance } from "./teamResonance";

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
 * Per-pipeline-run result: pre, mid, and post stats for all characters,
 * computed together in one pass.
 */
type PipelineResult = {
  preStats: Record<string, StatSheet>;
  midStats: Record<string, StatSheet>;
  postStats: Record<string, StatSheet>;
};

/**
 * Centralized stat computation for a team.
 *
 * Owns the full stat pipeline (pre → mid → post) and all static buffs.
 * Artifact stats are set/swapped via `setArtifacts()`, which invalidates
 * all cached results.
 *
 * Has NO knowledge of formulas — purely stat-focused.
 */
export class TeamStatSheet {
  private readonly charBuilds: Record<string, CharBuild>;
  private readonly teamMeta: TeamMeta;
  readonly allStaticBuffs: ProvidedStaticBuff[];
  private readonly charLevels: Record<string, number>;
  private readonly onFieldCharIds: string[];
  private artifactStats: Record<string, StatSheet>;
  private ctx: CalcContext | undefined;
  private readonly pipelineCache = new Map<CacheKey, PipelineResult>();
  /** Cache for field-dependent buff filtering (only depends on onFieldCharId). */
  private readonly fieldDepCache = new Map<
    string,
    Record<string, ProvidedStaticBuff[]>
  >();

  constructor(
    charBuilds: Record<string, CharBuild>,
    teamResonance: TeamResonance,
    extraBuffs: ExtraBuff[],
    teamMeta: TeamMeta,
    configs: TeamSlotConfig[],
    onFieldCharIds: string[]
  ) {
    this.charBuilds = charBuilds;
    this.teamMeta = teamMeta;
    this.onFieldCharIds = onFieldCharIds;
    this.artifactStats = {};

    // Store charLevels from configs
    this.charLevels = {};
    for (const c of configs) {
      this.charLevels[c.charId] = c.charLevel;
    }

    // Collect allStaticBuffs
    this.allStaticBuffs = teamResonance.buffs.map((buff) => ({
      buff,
      providerCharId: "resonance",
    }));
    for (const [charId, build] of Object.entries(charBuilds)) {
      for (const buff of build.getAllBuffs()) {
        this.allStaticBuffs.push({ buff, providerCharId: charId });
      }
    }
    if (extraBuffs.length > 0) {
      for (const buff of createExtraStatBuffs(extraBuffs)) {
        this.allStaticBuffs.push({ buff, providerCharId: "extra" });
      }
    }
  }

  /** Set or swap artifact stat sheets and optional CalcContext. Invalidates caches. */
  setArtifacts(
    artifactStats: Record<string, StatSheet>,
    ctx?: CalcContext
  ): void {
    if (this.artifactStats === artifactStats && this.ctx === ctx) return;
    this.artifactStats = artifactStats;
    this.ctx = ctx;
    this.pipelineCache.clear();
  }

  /** Get the character level for a given charId. */
  getCharLevel(charId: string): number {
    return this.charLevels[charId]!;
  }

  /**
   * Get the default onFieldCharId for off-field parts owned by charId.
   * Returns the first onFieldCharId that isn't charId, or charId itself
   * for single-character teams.
   */
  getDefaultOnFieldCharId(charId: string): string {
    const other = this.onFieldCharIds.find((id) => id !== charId);
    return other ?? charId;
  }

  /** Get pre-stats for a character in a given on-field context. */
  getPreStats(
    charId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): StatSheet {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys);
    return result.preStats[charId]!;
  }

  /** Get mid-stats (pre + sheet-stat dynamic buffs) for a character. */
  getMidStats(
    charId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): StatSheet {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys);
    return result.midStats[charId]!;
  }

  /**
   * Get post-stats for a character in a given on-field context.
   * This is the final stat sheet after all static + dynamic buffs.
   * Uses the CalcContext stored via setArtifacts() for CR target deltas.
   */
  getPostStats(
    charId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): StatSheet {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys);
    return result.postStats[charId]!;
  }

  /**
   * Get post-stats for ALL characters in a given on-field context.
   * Returns the same format as TeamBuild.getTeamStats().
   * Uses the CalcContext stored via setArtifacts() for CR target deltas.
   */
  getAllPostStats(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): Record<string, StatSheet> {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys);
    return result.postStats;
  }

  /**
   * Compute idle stat sheets for all team members.
   * Idle stats simulate the game's character-panel view:
   * - Base stats + artifact stats
   * - Unconditional buffs only (no triggers, no ability/reaction filters)
   * - Dynamic buffs evaluated from idle pre-stats
   */
  getIdleStats(): Record<string, { onField: StatSheet; offField: StatSheet }> {
    const idleBuffs = this.allStaticBuffs.filter(({ buff }) => {
      if (buff.source.triggers && buff.source.triggers.length > 0) return false;
      const filter = buff.target.filter;
      if (filter?.abilities || filter?.reactions) return false;
      return true;
    });

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

      const artStats = this.artifactStats[charId] ?? new StatSheet([]);
      const dedupedOn = deduplicateBuffs(
        [...universal, ...onFieldOnly],
        (b) => b.staticBuffs
      );
      onFieldPreStats[charId] = build.baseStatSheet
        .apply(dedupedOn)
        .merge(artStats);

      const dedupedOff = deduplicateBuffs(
        [...universal, ...offFieldOnly],
        (b) => b.staticBuffs
      );
      offFieldPreStats[charId] = build.baseStatSheet
        .apply(dedupedOff)
        .merge(artStats);
    }

    const dynamicEntries = evaluateDynamicBuffsTwoPass(
      idleBuffs,
      onFieldPreStats,
      (sheetBuffs) =>
        this.applyDynamicBuffsToAll(onFieldPreStats, sheetBuffs, "", true)
    );

    const result: Record<string, { onField: StatSheet; offField: StatSheet }> =
      {};
    for (const charId of Object.keys(this.charBuilds)) {
      result[charId] = {
        onField: this.applyDynamicBuffsForChar(
          onFieldPreStats[charId]!,
          dynamicEntries,
          charId,
          true
        ),
        offField: this.applyDynamicBuffsForChar(
          offFieldPreStats[charId]!,
          dynamicEntries,
          charId,
          false
        ),
      };
    }
    return result;
  }

  // ─── Internal pipeline ────────────────────────────────────────────────

  private ensurePipeline(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): PipelineResult {
    const cacheKey = makeCacheKey(onFieldCharId, excludeKeys);
    const cached = this.pipelineCache.get(cacheKey);
    if (cached) return cached;

    const result = this.runPipeline(onFieldCharId, excludeKeys);
    this.pipelineCache.set(cacheKey, result);
    return result;
  }

  private runPipeline(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): PipelineResult {
    const fieldDependent = this.getFieldDependentBuffs(onFieldCharId);
    const preStats = this.buildPreStats(fieldDependent, excludeKeys);
    const { midStats, postStats } = this.evaluateDynamicPipeline(
      preStats,
      onFieldCharId,
      excludeKeys
    );
    applyCrTargetDeltas(postStats, this.ctx);
    return { preStats, midStats, postStats };
  }

  private getFieldDependentBuffs(
    onFieldCharId: string
  ): Record<string, ProvidedStaticBuff[]> {
    const cached = this.fieldDepCache.get(onFieldCharId);
    if (cached) return cached;
    const result: Record<string, ProvidedStaticBuff[]> = {};
    for (const charId of Object.keys(this.charBuilds)) {
      result[charId] = this.allStaticBuffs.filter((b) => {
        if (!isFieldDependentReceiver(b.buff.target.receiver)) return false;
        return isBuffApplicable(
          b.buff,
          b.providerCharId,
          charId,
          isOnField(charId, onFieldCharId),
          this.teamMeta.regions[charId],
          this.teamMeta.factions[charId]
        );
      });
    }
    this.fieldDepCache.set(onFieldCharId, result);
    return result;
  }

  private buildPreStats(
    fieldDependent: Record<string, ProvidedStaticBuff[]>,
    excludeKeys?: Set<string>
  ): Record<string, StatSheet> {
    const preStats: Record<string, StatSheet> = {};

    for (const [charId, build] of Object.entries(this.charBuilds)) {
      const artStats = this.artifactStats[charId] ?? new StatSheet([]);

      // Apply field-independent static buffs
      const fieldIndepBuffs = this.allStaticBuffs.filter((entry) => {
        if (
          excludeKeys?.has(getBuffInstanceKey(entry.buff, entry.providerCharId))
        )
          return false;
        if (isFieldDependentReceiver(entry.buff.target.receiver)) return false;
        return isBuffApplicable(
          entry.buff,
          entry.providerCharId,
          charId,
          false,
          this.teamMeta.regions[charId],
          this.teamMeta.factions[charId]
        );
      });
      const deduped = deduplicateBuffs(
        fieldIndepBuffs.map((e) => e.buff),
        (b) => b.staticBuffs
      );
      let sheet = build.baseStatSheet.apply(deduped).merge(artStats);

      // Apply field-dependent static buffs
      const td = fieldDependent[charId]!.filter(
        (entry) =>
          !excludeKeys?.has(
            getBuffInstanceKey(entry.buff, entry.providerCharId)
          )
      );
      if (td.length > 0) {
        const tdDeduped = deduplicateBuffs(
          td.map((e) => e.buff),
          (b) => b.staticBuffs
        );
        sheet = sheet.apply(tdDeduped);
      }

      preStats[charId] = sheet;
    }
    return preStats;
  }

  /**
   * Apply dynamic buffs to a single character's pre-stats.
   * Filters applicable buffs, deduplicates, and applies.
   */
  private applyDynamicBuffsForChar(
    charPreStats: StatSheet,
    dynamicBuffs: EvaluatedDynamicBuff[],
    charId: string,
    isOnFieldChar: boolean
  ): StatSheet {
    let applicable = dynamicBuffs.filter((b) =>
      isBuffApplicable(
        b.buff,
        b.providerCharId,
        charId,
        isOnFieldChar,
        this.teamMeta.regions[charId],
        this.teamMeta.factions[charId]
      )
    );
    applicable = deduplicateBuffs(applicable, (b) => b.entries);
    const mapped = applicable.map(
      (b) => new StatBuff(b.buff.source, b.buff.target, b.entries)
    );
    return charPreStats.apply(mapped);
  }

  /**
   * Apply dynamic buffs to all team members' pre-stats.
   * When `allOnField` is true, treats every character as on-field (used for idle midStats).
   */
  private applyDynamicBuffsToAll(
    baseStats: Record<string, StatSheet>,
    dynamicBuffs: EvaluatedDynamicBuff[],
    onFieldCharId: string,
    allOnField = false
  ): Record<string, StatSheet> {
    const result: Record<string, StatSheet> = {};
    for (const charId of Object.keys(this.charBuilds)) {
      result[charId] = this.applyDynamicBuffsForChar(
        baseStats[charId]!,
        dynamicBuffs,
        charId,
        allOnField || isOnField(charId, onFieldCharId)
      );
    }
    return result;
  }

  private evaluateDynamicPipeline(
    preStats: Record<string, StatSheet>,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): {
    midStats: Record<string, StatSheet>;
    postStats: Record<string, StatSheet>;
  } {
    let midStats: Record<string, StatSheet> = preStats;

    const buffSources =
      excludeKeys && excludeKeys.size > 0
        ? this.allStaticBuffs.filter(
            ({ buff, providerCharId }) =>
              !excludeKeys.has(getBuffInstanceKey(buff, providerCharId))
          )
        : this.allStaticBuffs;

    const buildMidStats = (
      sheetBuffs: EvaluatedDynamicBuff[]
    ): Record<string, StatSheet> => {
      const mid = this.applyDynamicBuffsToAll(
        preStats,
        sheetBuffs,
        onFieldCharId
      );
      midStats = mid;
      return mid;
    };

    const allDynamicBuffs = evaluateDynamicBuffsTwoPass(
      buffSources,
      preStats,
      buildMidStats
    );

    const postStats = this.applyDynamicBuffsToAll(
      preStats,
      allDynamicBuffs,
      onFieldCharId
    );

    return { midStats, postStats };
  }
}
