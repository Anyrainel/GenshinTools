import {
  type BuffSource,
  FINAL_STAT_KEYS,
  type ResolvedStatEntry,
  type StatEntry,
  type StatKey,
} from "../types";
import { CrossScalingBuff, ScalingBuff, TeamAggregationBuff } from "./statBuff";
import type { StatBuff } from "./statBuff";

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
