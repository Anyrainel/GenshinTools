import type { CalcContext } from "../types";

export function makeCacheKey(
  onFieldCharId: string,
  excludeKeys?: Set<string>
): string {
  if (!excludeKeys || excludeKeys.size === 0) return onFieldCharId;
  const sorted = [...excludeKeys].sort();
  return `${onFieldCharId}\0${sorted.join("\0")}`;
}

import type { CharBuild } from "./charBuild";
import {
  type EvaluatedDynamicBuff,
  isDeferredFinalBuff,
} from "./dynamicBuffEval";
import { fieldReq } from "./fieldState";
import {
  assertNoDuplicateStatKeys,
  deduplicateBuffs,
  StatBuff,
} from "./statBuff";
import { StatSheet } from "./statSheet";
import type { TeamBuffLedger } from "./teamBuffLedger";

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
 * Owns the full stat pipeline (pre → mid → post). Uses TeamBuffLedger for
 * all buff applicability queries — never touches TeamMeta or isBuffApplicable.
 * Artifact stats are set/swapped via `setArtifacts()`, which invalidates
 * all cached results.
 *
 * Has NO knowledge of formulas — purely stat-focused.
 */
export class TeamStatSheet {
  readonly charBuilds: Record<string, CharBuild>;
  readonly ledger: TeamBuffLedger;
  private readonly onFieldCharIds: string[];
  private artifactStats: Record<string, StatSheet>;
  private ctx: CalcContext | undefined;
  private readonly pipelineCache = new Map<string, PipelineResult>();

  constructor(
    charBuilds: Record<string, CharBuild>,
    ledger: TeamBuffLedger,
    onFieldCharIds: string[]
  ) {
    this.charBuilds = charBuilds;
    this.ledger = ledger;
    this.onFieldCharIds = onFieldCharIds;
    this.artifactStats = {};
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
    return this.ledger.teamMeta.charLevels[charId] ?? 90;
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

  /**
   * Get pre-stats WITHOUT artifact contributions for a character.
   * Used by the compiler for variable characters whose artifact stats
   * come from Float64Array variables instead of baked-in StatSheets.
   */
  getPreStatsNoArtifacts(
    charId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): StatSheet {
    const build = this.charBuilds[charId];
    if (!build) return new StatSheet([]);
    const deduped = this.ledger.getApplicableStatic(
      charId,
      onFieldCharId,
      excludeKeys
    );
    return build.baseStatSheet.apply(deduped);
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

  /** Get pre-stats for ALL characters in a given on-field context. */
  getAllPreStats(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): Record<string, StatSheet> {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys);
    return result.preStats;
  }

  /** Get mid-stats for ALL characters in a given on-field context. */
  getAllMidStats(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): Record<string, StatSheet> {
    const result = this.ensurePipeline(onFieldCharId, excludeKeys);
    return result.midStats;
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
    // Idle-specific filtering: only unconditional buffs (no triggers, no damage-tag filters).
    // This is content filtering, not applicability — the ledger handles the latter.
    const idleBuffs = this.ledger.allBuffs.filter(({ buff }) => {
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
          if (this.ledger.couldBuffApplyToChar(buff, providerCharId, charId))
            universal.push(buff);
        } else {
          // Field-dependent idle buffs: check applicability in the matching field state
          if (
            this.ledger.isApplicableTo(
              this.ledger
                .getApplicable(charId, charId)
                .find(
                  (ib) =>
                    ib.buff === buff && ib.providerCharId === providerCharId
                )?.buffKey ?? "",
              charId,
              fr === "on" ? charId : "__off__"
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

    const dynamicEntries = this.evaluateDynamicBuffs(
      idleBuffs,
      onFieldPreStats
    );

    const result: Record<string, { onField: StatSheet; offField: StatSheet }> =
      {};
    for (const charId of this.ledger.teamMeta.characters) {
      const offFieldCharId = this.getDefaultOnFieldCharId(charId);

      // On-field: apply dynamic buffs applicable when charId is on-field
      const onApplicable = deduplicateBuffs(
        dynamicEntries.filter((b) =>
          this.ledger.isApplicableTo(
            `${b.providerCharId}\u0003${b.buff.identityShapeKey}`,
            charId,
            charId
          )
        ),
        (b) => b.entries
      );
      const onMapped = onApplicable.map(
        (b) => new StatBuff(b.buff.source, b.buff.target, b.entries)
      );

      // Off-field: apply dynamic buffs applicable when charId is off-field
      const offApplicable = deduplicateBuffs(
        dynamicEntries.filter((b) =>
          this.ledger.isApplicableTo(
            `${b.providerCharId}\u0003${b.buff.identityShapeKey}`,
            charId,
            offFieldCharId
          )
        ),
        (b) => b.entries
      );
      const offMapped = offApplicable.map(
        (b) => new StatBuff(b.buff.source, b.buff.target, b.entries)
      );

      result[charId] = {
        onField: onFieldPreStats[charId]!.apply(onMapped),
        offField: offFieldPreStats[charId]!.apply(offMapped),
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
    const preStats = this.buildPreStats(onFieldCharId, excludeKeys);
    const { midStats, postStats } = this.computeDynamicStats(
      preStats,
      onFieldCharId,
      excludeKeys
    );
    applyCrTargetDeltas(postStats, this.ctx);
    return { preStats, midStats, postStats };
  }

  private buildPreStats(
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): Record<string, StatSheet> {
    const preStats: Record<string, StatSheet> = {};
    for (const [charId, build] of Object.entries(this.charBuilds)) {
      const artStats = this.artifactStats[charId] ?? new StatSheet([]);
      const deduped = this.ledger.getApplicableStatic(
        charId,
        onFieldCharId,
        excludeKeys
      );
      preStats[charId] = build.baseStatSheet.apply(deduped).merge(artStats);
    }
    return preStats;
  }

  /**
   * Two-pass dynamic buff evaluation → mid and post stats.
   *
   * Pass 1: Evaluate non-deferred dynamic buffs from preStats → midStats.
   * Pass 2: Evaluate deferred (final-stat) dynamic buffs from midStats → postStats.
   *
   * No resonance/extra skip — all buffs are treated uniformly.
   */
  private computeDynamicStats(
    preStats: Record<string, StatSheet>,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): {
    midStats: Record<string, StatSheet>;
    postStats: Record<string, StatSheet>;
  } {
    // Get all buff sources, filtered by exclusion
    const buffSources =
      excludeKeys && excludeKeys.size > 0
        ? this.ledger.allBuffs.filter((ib) => !excludeKeys.has(ib.buffKey))
        : this.ledger.allBuffs;

    const teamPreStatsArr = Object.values(preStats);

    // Pass 1: non-deferred dynamic buffs
    const sheetBuffs: EvaluatedDynamicBuff[] = [];
    const finalBuffRefs: { buff: StatBuff; providerCharId: string }[] = [];

    for (const { buff, providerCharId } of buffSources) {
      if (isDeferredFinalBuff(buff)) {
        finalBuffRefs.push({ buff, providerCharId });
        continue;
      }
      const ownerStats = preStats[providerCharId];
      if (!ownerStats) continue;
      const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
      assertNoDuplicateStatKeys(
        entries,
        `dynamicBuffs (source: ${buff.source.type}:${buff.source.id})`
      );
      if (entries.length > 0) {
        sheetBuffs.push({ buff, source: buff.source, providerCharId, entries });
      }
    }

    // Build midStats by applying sheet-stat dynamic buffs
    const midStats = this.applyDynamicBuffsToAll(
      preStats,
      sheetBuffs,
      onFieldCharId
    );

    if (finalBuffRefs.length === 0) {
      // No deferred buffs — midStats and postStats are the same
      return { midStats, postStats: midStats };
    }

    // Pass 2: deferred (final-stat) dynamic buffs using midStats
    const midStatsArr = Object.values(midStats);
    const finalBuffs: EvaluatedDynamicBuff[] = [];
    for (const { buff, providerCharId } of finalBuffRefs) {
      const ownerStats = midStats[providerCharId];
      if (!ownerStats) continue;
      const entries = buff.dynamicBuffs(ownerStats, midStatsArr);
      assertNoDuplicateStatKeys(
        entries,
        `dynamicBuffs/final (source: ${buff.source.type}:${buff.source.id})`
      );
      if (entries.length > 0) {
        finalBuffs.push({ buff, source: buff.source, providerCharId, entries });
      }
    }

    const allDynamic = [...sheetBuffs, ...finalBuffs];
    const postStats = this.applyDynamicBuffsToAll(
      preStats,
      allDynamic,
      onFieldCharId
    );

    return { midStats, postStats };
  }

  /**
   * Evaluate dynamic buffs from a custom buff subset (used by getIdleStats).
   * No resonance/extra skip — all buffs treated uniformly.
   */
  private evaluateDynamicBuffs(
    buffSources: Iterable<{ buff: StatBuff; providerCharId: string }>,
    preStats: Record<string, StatSheet>
  ): EvaluatedDynamicBuff[] {
    const teamPreStatsArr = Object.values(preStats);
    const sheetBuffs: EvaluatedDynamicBuff[] = [];
    const finalBuffRefs: { buff: StatBuff; providerCharId: string }[] = [];

    for (const { buff, providerCharId } of buffSources) {
      if (isDeferredFinalBuff(buff)) {
        finalBuffRefs.push({ buff, providerCharId });
        continue;
      }
      const ownerStats = preStats[providerCharId];
      if (!ownerStats) continue;
      const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
      if (entries.length > 0) {
        sheetBuffs.push({ buff, source: buff.source, providerCharId, entries });
      }
    }

    if (finalBuffRefs.length === 0) return sheetBuffs;

    // Build midStats for idle context
    const midStats = this.applyDynamicBuffsToAll(
      preStats,
      sheetBuffs,
      "",
      true
    );
    const midStatsArr = Object.values(midStats);

    const finalBuffs: EvaluatedDynamicBuff[] = [];
    for (const { buff, providerCharId } of finalBuffRefs) {
      const ownerStats = midStats[providerCharId];
      if (!ownerStats) continue;
      const entries = buff.dynamicBuffs(ownerStats, midStatsArr);
      if (entries.length > 0) {
        finalBuffs.push({ buff, source: buff.source, providerCharId, entries });
      }
    }

    return [...sheetBuffs, ...finalBuffs];
  }

  /**
   * Apply dynamic buffs to all team members' pre-stats.
   * Uses ledger's pre-computed applicability per (target, onFieldCharId).
   * When `allOnField` is true, treats every character as on-field (for idle midStats).
   */
  private applyDynamicBuffsToAll(
    baseStats: Record<string, StatSheet>,
    dynamicBuffs: EvaluatedDynamicBuff[],
    onFieldCharId: string,
    allOnField = false
  ): Record<string, StatSheet> {
    const result: Record<string, StatSheet> = {};
    for (const charId of this.ledger.teamMeta.characters) {
      const effectiveOnField = allOnField ? charId : onFieldCharId;
      let applicable = dynamicBuffs.filter((b) =>
        this.ledger.isApplicableTo(
          `${b.providerCharId}\u0003${b.buff.identityShapeKey}`,
          charId,
          effectiveOnField
        )
      );
      applicable = deduplicateBuffs(applicable, (b) => b.entries);
      const mapped = applicable.map(
        (b) => new StatBuff(b.buff.source, b.buff.target, b.entries)
      );
      result[charId] = baseStats[charId]!.apply(mapped);
    }
    return result;
  }
}
