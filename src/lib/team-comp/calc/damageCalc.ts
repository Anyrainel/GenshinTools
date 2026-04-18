import {
  type BuffSource,
  FINAL_STAT_KEYS,
  type ResolvedStatEntry,
  type StatEntry,
  type StatKey,
} from "../types";
import {
  CrossScalingBuff,
  ScalingBuff,
  TeamAggregationBuff,
  assertNoDuplicateStatKeys,
} from "./statBuff";
import type { StatBuff } from "./statBuff";
import type { StatSheet } from "./statSheet";

export type EvaluatedDynamicBuff = {
  buff: StatBuff;
  source: BuffSource;
  providerCharId: string;
  entries: StatEntry[];
};

export function isFinalStatKey(key: StatKey): boolean {
  return FINAL_STAT_KEYS.has(key);
}

/**
 * Whether a dynamic buff should be deferred to the second pass (final-stat pass).
 * A buff is deferred if it's a ScalingBuff/CrossScalingBuff whose output key
 * is a final stat AND whose input reads from sheet stats.
 * This lets it see post-dynamic sheet stats (e.g. Bennett's ATK).
 */
export function isDeferredFinalBuff(buff: StatBuff): boolean {
  if (buff instanceof ScalingBuff) {
    return isFinalStatKey(buff.outputKey);
  }
  if (buff instanceof CrossScalingBuff) {
    return isFinalStatKey(buff.outputKey);
  }
  return false;
}

/**
 * Two-pass dynamic buff evaluation.
 *
 * Pass 1: Evaluate sheet-stat dynamic buffs (ATK, EM, CR, etc.) from preStats.
 * Pass 2: Build midStats (preStats + sheet-stat buffs), then evaluate final-stat
 * dynamic buffs (baseDmg, dmg%, etc.) from midStats so they see Bennett's ATK, etc.
 *
 * @param buffSources  Iterable of (buff, providerCharId) pairs to evaluate.
 * @param preStats     Per-character pre-stat sheets.
 * @param buildMidStats  Function to apply sheet-stat buffs → midStats.
 */
export function evaluateDynamicBuffsTwoPass(
  buffSources: Iterable<{ buff: StatBuff; providerCharId: string }>,
  preStats: Record<string, StatSheet>,
  buildMidStats: (
    sheetBuffs: EvaluatedDynamicBuff[]
  ) => Record<string, StatSheet>
): EvaluatedDynamicBuff[] {
  const teamPreStatsArr = Object.values(preStats);
  const sheetBuffs: EvaluatedDynamicBuff[] = [];
  const finalBuffRefs: { buff: StatBuff; providerCharId: string }[] = [];

  for (const { buff, providerCharId } of buffSources) {
    if (providerCharId === "resonance" || providerCharId === "extra") continue;
    if (isDeferredFinalBuff(buff)) {
      finalBuffRefs.push({ buff, providerCharId });
      continue;
    }
    const ownerStats = preStats[providerCharId]!;
    const entries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
    assertNoDuplicateStatKeys(
      entries,
      `dynamicBuffs (source: ${buff.source.type}:${buff.source.id})`
    );
    if (entries.length > 0) {
      sheetBuffs.push({ buff, source: buff.source, providerCharId, entries });
    }
  }

  if (finalBuffRefs.length === 0) return sheetBuffs;

  const midStats = buildMidStats(sheetBuffs);
  const midStatsArr = Object.values(midStats);

  const finalBuffs: EvaluatedDynamicBuff[] = [];
  for (const { buff, providerCharId } of finalBuffRefs) {
    const ownerStats = midStats[providerCharId]!;
    const entries = buff.dynamicBuffs(ownerStats, midStatsArr);
    assertNoDuplicateStatKeys(
      entries,
      `dynamicBuffs/final (source: ${buff.source.type}:${buff.source.id})`
    );
    if (entries.length > 0) {
      finalBuffs.push({ buff, source: buff.source, providerCharId, entries });
    }
  }

  return [...sheetBuffs, ...finalBuffs];
}

/** Annotate a resolved entry with inputKey/cap from any scaling buff type. */
export function annotateScalingInfo(
  buff: StatBuff,
  resolved: ResolvedStatEntry
): void {
  if (buff instanceof ScalingBuff) {
    if (buff.cap !== undefined) resolved.cap = buff.cap;
    resolved.inputKey = buff.inputKey;
  } else if (buff instanceof TeamAggregationBuff) {
    if (buff.cap !== undefined) resolved.cap = buff.cap;
    resolved.inputKey = buff.inputKey;
  } else if (buff instanceof CrossScalingBuff) {
    if (buff.capA !== undefined) resolved.cap = buff.capA;
    resolved.inputKey = buff.statA;
  }
}
