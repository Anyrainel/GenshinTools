import type { CalcContext, ProvidedStaticBuff } from "../types";
import type { CharBuild } from "./charBuild";
import {
  type EvaluatedDynamicBuff,
  evaluateDynamicBuffsTwoPass,
} from "./damageCalc";
import { fieldReq, isFieldDependentReceiver, isOnField } from "./fieldState";
import {
  type StatBuff,
  getBuffInstanceKey,
  isBuffApplicable,
} from "./statBuff";
import { StatSheet } from "./statSheet";
import type { TeamMeta } from "./teamMeta";

type CacheKey = string;

function makeCacheKey(
  onFieldCharId: string,
  excludeKeys?: Set<string>
): CacheKey {
  if (!excludeKeys || excludeKeys.size === 0) return onFieldCharId;
  const sorted = [...excludeKeys].sort();
  return `${onFieldCharId}\0${sorted.join("\0")}`;
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
  private artifactStats: Record<string, StatSheet>;
  private readonly pipelineCache = new Map<CacheKey, PipelineResult>();

  constructor(
    charBuilds: Record<string, CharBuild>,
    teamMeta: TeamMeta,
    allStaticBuffs: ProvidedStaticBuff[]
  ) {
    this.charBuilds = charBuilds;
    this.teamMeta = teamMeta;
    this.allStaticBuffs = allStaticBuffs;
    this.artifactStats = {};
  }

  /** Set or swap artifact stat sheets. Invalidates all caches. */
  setArtifacts(artifactStats: Record<string, StatSheet>): void {
    this.artifactStats = artifactStats;
    this.pipelineCache.clear();
  }

  /** Get the character level for a given charId. */
  getCharLevel(charId: string): number {
    return this.charBuilds[charId]!.charBase.charLevel;
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
   */
  getPostStats(
    charId: string,
    onFieldCharId: string,
    ctx?: CalcContext,
    excludeKeys?: Set<string>
  ): StatSheet {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys, ctx);
    return result.postStats[charId]!;
  }

  /**
   * Get post-stats for ALL characters in a given on-field context.
   * Returns the same format as TeamBuild.getTeamStats().
   */
  getAllPostStats(
    onFieldCharId: string,
    ctx?: CalcContext,
    excludeKeys?: Set<string>
  ): Record<string, StatSheet> {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys, ctx);
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

      onFieldPreStats[charId] = build.getIdlePreStats(
        this.artifactStats[charId] ?? new StatSheet([]),
        [...universal, ...onFieldOnly]
      );
      offFieldPreStats[charId] = build.getIdlePreStats(
        this.artifactStats[charId] ?? new StatSheet([]),
        [...universal, ...offFieldOnly]
      );
    }

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

  // ─── Internal pipeline ────────────────────────────────────────────────

  private ensurePipeline(
    onFieldCharId: string,
    excludeKeys?: Set<string>,
    ctx?: CalcContext
  ): PipelineResult {
    const cacheKey = makeCacheKey(onFieldCharId, excludeKeys);
    let cached = this.pipelineCache.get(cacheKey);
    if (cached) {
      // CR target deltas are applied on top of cached post-stats.
      // If ctx has perCharCrTarget, we need to re-apply (since cache doesn't
      // store ctx). For simplicity, apply each time — withDelta is cheap.
      if (ctx?.perCharCrTarget) {
        const postWithCr = { ...cached.postStats };
        applyCrTargetDeltas(postWithCr, ctx);
        return { ...cached, postStats: postWithCr };
      }
      return cached;
    }

    cached = this.runPipeline(onFieldCharId, excludeKeys);
    this.pipelineCache.set(cacheKey, cached);

    if (ctx?.perCharCrTarget) {
      const postWithCr = { ...cached.postStats };
      applyCrTargetDeltas(postWithCr, ctx);
      return { ...cached, postStats: postWithCr };
    }
    return cached;
  }

  private runPipeline(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): PipelineResult {
    // Step 1: Filter field-dependent static buffs per onFieldCharId
    const fieldDependent = this.getFieldDependentBuffs(onFieldCharId);

    // Step 2: Build preStats
    const preStats = this.buildPreStats(fieldDependent, excludeKeys);

    // Step 3+4: Two-pass dynamic buff evaluation → midStats, postStats
    const { midStats, postStats } = this.evaluateDynamicPipeline(
      preStats,
      onFieldCharId,
      excludeKeys
    );

    return { preStats, midStats, postStats };
  }

  private getFieldDependentBuffs(
    onFieldCharId: string
  ): Record<string, ProvidedStaticBuff[]> {
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
    return result;
  }

  private buildPreStats(
    fieldDependent: Record<string, ProvidedStaticBuff[]>,
    excludeKeys?: Set<string>
  ): Record<string, StatSheet> {
    const preStats: Record<string, StatSheet> = {};

    if (!excludeKeys || excludeKeys.size === 0) {
      for (const [id, build] of Object.entries(this.charBuilds)) {
        preStats[id] = build.getPreStats(
          this.artifactStats[id] ?? new StatSheet([]),
          fieldDependent[id]!
        );
      }
    } else {
      for (const [id, build] of Object.entries(this.charBuilds)) {
        preStats[id] = build.getPreStatsExcluding(
          this.artifactStats[id] ?? new StatSheet([]),
          fieldDependent[id]!,
          this.allStaticBuffs,
          excludeKeys,
          id,
          this.teamMeta.regions[id],
          this.teamMeta.factions[id]
        );
      }
    }

    return preStats;
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
      const mid: Record<string, StatSheet> = {};
      for (const [id, build] of Object.entries(this.charBuilds)) {
        mid[id] = build.getPostStats(
          preStats[id]!,
          sheetBuffs,
          id,
          isOnField(id, onFieldCharId),
          this.teamMeta.regions[id],
          this.teamMeta.factions[id]
        );
      }
      midStats = mid;
      return mid;
    };

    const allDynamicBuffs = evaluateDynamicBuffsTwoPass(
      buffSources,
      preStats,
      buildMidStats
    );

    // Build final postStats from preStats + all dynamic buffs
    const postStats: Record<string, StatSheet> = {};
    for (const [id, build] of Object.entries(this.charBuilds)) {
      postStats[id] = build.getPostStats(
        preStats[id]!,
        allDynamicBuffs,
        id,
        isOnField(id, onFieldCharId),
        this.teamMeta.regions[id],
        this.teamMeta.factions[id]
      );
    }

    return { midStats, postStats };
  }
}
