/**
 * TeamBuffLedger: centralized buff applicability and key management.
 *
 * Pre-computes formula-agnostic buff applicability at construction time.
 * Consumers query pre-filtered buff lists instead of re-deriving applicability.
 *
 * Owned by TeamBuild. Passed to TeamStatSheet and TeamExprStatSheet so they
 * never touch TeamMeta, isBuffApplicable, or getBuffInstanceKey directly.
 */

import type { ProvidedStaticBuff } from "../types";
import { isDeferredFinalBuff } from "./dynamicBuffEval";
import { isOnField } from "./fieldState";
import {
  StatBuff,
  deduplicateBuffs,
  getBuffInstanceKey,
  isBuffApplicable,
} from "./statBuff";
import type { TeamMeta } from "./teamMeta";

/**
 * A ProvidedStaticBuff with its pre-computed buff instance key.
 * Avoids repeated getBuffInstanceKey() calls across consumers.
 */
export interface IndexedBuff {
  readonly buff: StatBuff;
  readonly providerCharId: string;
  readonly buffKey: string;
}

/**
 * Pre-computed applicability for a (targetCharId, onFieldCharId) pair.
 * Separated into static-only and dynamic categories for two-pass evaluation.
 */
interface ApplicableBuffSet {
  /** All applicable buffs (field-independent + field-dependent). */
  readonly all: IndexedBuff[];
  /** Set of all applicable buff keys for O(1) membership checks. */
  readonly allKeys: ReadonlySet<string>;
  /** Applicable buffs that have dynamic behavior (ScalingBuff, etc.) — non-deferred. */
  readonly dynamicMid: IndexedBuff[];
  /** Applicable buffs that have dynamic behavior deferred to final-stat pass. */
  readonly dynamicPost: IndexedBuff[];
}

export class TeamBuffLedger {
  /** All static buffs in insertion order (resonance → per-character → extra). */
  readonly allBuffs: IndexedBuff[];
  /** Fast lookup: buffKey → IndexedBuff. */
  private readonly byKey: Map<string, IndexedBuff>;
  /** Pre-computed applicability per "targetCharId\0onFieldCharId". */
  private readonly applicabilityCache: Map<string, ApplicableBuffSet>;
  /** Stack-limited buffs (maxStacks != null), pre-filtered. */
  private readonly stackLimited: IndexedBuff[];
  /** TeamMeta reference for region/faction lookups. */
  readonly teamMeta: TeamMeta;
  /** Ordered char IDs (same order as charBuilds). */
  readonly charIds: string[];

  constructor(
    allStaticBuffs: ProvidedStaticBuff[],
    teamMeta: TeamMeta,
    charIds: string[]
  ) {
    this.teamMeta = teamMeta;
    this.charIds = charIds;

    // Index all buffs with pre-computed keys
    this.allBuffs = allStaticBuffs.map((b) => ({
      buff: b.buff,
      providerCharId: b.providerCharId,
      buffKey: getBuffInstanceKey(b.buff, b.providerCharId),
    }));

    this.byKey = new Map();
    for (const ib of this.allBuffs) {
      this.byKey.set(ib.buffKey, ib);
    }

    this.stackLimited = this.allBuffs.filter(
      (ib) => ib.buff.source.maxStacks != null
    );

    // Pre-compute applicability for all (target, onField) pairs
    this.applicabilityCache = new Map();
    for (const targetId of charIds) {
      for (const onFieldId of charIds) {
        const key = `${targetId}\0${onFieldId}`;
        this.applicabilityCache.set(
          key,
          this.computeApplicability(targetId, onFieldId)
        );
      }
    }
  }

  /** Look up a buff by its instance key. */
  getBuffByKey(buffKey: string): IndexedBuff | undefined {
    return this.byKey.get(buffKey);
  }

  /** Get all stack-limited buffs. */
  getStackLimitedBuffs(): IndexedBuff[] {
    return this.stackLimited;
  }

  /**
   * Get applicable buffs for a (target, onField) pair.
   * Optionally exclude specific buff keys.
   */
  getApplicable(
    targetCharId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): IndexedBuff[] {
    const set = this.applicabilityCache.get(
      `${targetCharId}\0${onFieldCharId}`
    );
    if (!set) return [];
    if (!excludeKeys || excludeKeys.size === 0) return set.all;
    return set.all.filter((ib) => !excludeKeys.has(ib.buffKey));
  }

  /**
   * Get applicable dynamic mid-pass buffs (non-deferred) for a (target, onField) pair.
   */
  getDynamicMid(
    targetCharId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): IndexedBuff[] {
    const set = this.applicabilityCache.get(
      `${targetCharId}\0${onFieldCharId}`
    );
    if (!set) return [];
    if (!excludeKeys || excludeKeys.size === 0) return set.dynamicMid;
    return set.dynamicMid.filter((ib) => !excludeKeys.has(ib.buffKey));
  }

  /**
   * Get applicable dynamic post-pass buffs (deferred final-stat) for a (target, onField) pair.
   */
  getDynamicPost(
    targetCharId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): IndexedBuff[] {
    const set = this.applicabilityCache.get(
      `${targetCharId}\0${onFieldCharId}`
    );
    if (!set) return [];
    if (!excludeKeys || excludeKeys.size === 0) return set.dynamicPost;
    return set.dynamicPost.filter((ib) => !excludeKeys.has(ib.buffKey));
  }

  /**
   * Check if a buff could apply to a character in EITHER field state.
   * Used by display path to determine team-wide applicability.
   */
  couldBuffApplyToChar(
    buff: StatBuff,
    providerCharId: string,
    targetCharId: string
  ): boolean {
    const r = this.teamMeta.regions[targetCharId];
    const f = this.teamMeta.factions[targetCharId];
    return (
      isBuffApplicable(buff, providerCharId, targetCharId, true, r, f) ||
      isBuffApplicable(buff, providerCharId, targetCharId, false, r, f)
    );
  }

  /**
   * Check if a buff is applicable to any team member (either field state).
   */
  isTeamApplicable(buff: StatBuff, providerCharId: string): boolean {
    for (const cid of this.charIds) {
      if (this.couldBuffApplyToChar(buff, providerCharId, cid)) return true;
    }
    return false;
  }

  /**
   * O(1) check: is this buff applicable to the target in the given on-field context?
   */
  isApplicableTo(
    buffKey: string,
    targetCharId: string,
    onFieldCharId: string
  ): boolean {
    const set = this.applicabilityCache.get(
      `${targetCharId}\0${onFieldCharId}`
    );
    return set?.allKeys.has(buffKey) ?? false;
  }

  /**
   * Get the deduplication-ready static buffs applicable to a target in a given context.
   * Returns the StatBuff[] (unwrapped) for direct use with StatSheet.apply().
   */
  getApplicableStatic(
    targetCharId: string,
    onFieldCharId: string,
    excludeKeys?: Set<string>
  ): StatBuff[] {
    const applicable = this.getApplicable(
      targetCharId,
      onFieldCharId,
      excludeKeys
    );
    return deduplicateBuffs(
      applicable.map((ib) => ib.buff),
      (b) => b.staticBuffs
    );
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private computeApplicability(
    targetCharId: string,
    onFieldCharId: string
  ): ApplicableBuffSet {
    const selfIsOnField = isOnField(targetCharId, onFieldCharId);
    const region = this.teamMeta.regions[targetCharId];
    const faction = this.teamMeta.factions[targetCharId];

    const all: IndexedBuff[] = [];
    const dynamicMid: IndexedBuff[] = [];
    const dynamicPost: IndexedBuff[] = [];

    for (const ib of this.allBuffs) {
      if (
        !isBuffApplicable(
          ib.buff,
          ib.providerCharId,
          targetCharId,
          selfIsOnField,
          region,
          faction
        )
      ) {
        continue;
      }

      all.push(ib);

      // Classify dynamic behavior
      if (hasDynamicBehavior(ib.buff)) {
        if (isDeferredFinalBuff(ib.buff)) {
          dynamicPost.push(ib);
        } else {
          dynamicMid.push(ib);
        }
      }
    }

    const allKeys = new Set(all.map((ib) => ib.buffKey));
    return { all, allKeys, dynamicMid, dynamicPost };
  }
}

/**
 * Check if a buff has any dynamic behavior (dynamicBuffs override, ScalingBuff, etc.)
 * that requires evaluation against stats, beyond its static entries.
 */
function hasDynamicBehavior(buff: StatBuff): boolean {
  return buff.dynamicBuffs !== StatBuff.prototype.dynamicBuffs;
}
