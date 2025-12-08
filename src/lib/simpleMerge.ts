import { CharacterMergeInfo, MainStatPlus, SetConfig, SlotConfig, SubStat } from '../data/types';

export interface SimpleMergeOptions {
  /**
   * Merge configs that share the same must-present set and have k = |mustPresent| + 1.
   * This unions the remaining optional pool (pick-one pattern).
   */
  mergeSingleFlexVariants?: boolean;

  /**
   * Promote rigid (n = k) configs into pick-one patterns when they share
   * a common subset of size k-1.
   */
  findRigidCommonSubset?: boolean;
}

export const DEFAULT_SIMPLE_MERGE_OPTIONS: Required<SimpleMergeOptions> = {
  mergeSingleFlexVariants: false,
  findRigidCommonSubset: false
};

type SlotKey = 'flowerPlume' | 'sands' | 'goblet' | 'circlet';

interface SlotMergeResult {
  mainStats: MainStatPlus[];
  substats: SubStat[];
  mustPresent: SubStat[];
  minStatCount: number;
}

type PromotionShape = RigidPromotionShape | PickPromotionShape;

interface RigidPromotionShape {
  type: 'rigid';
  k: number;
  required: SubStat[];
}

interface PickPromotionShape {
  type: 'pick';
  k: number;
  must: SubStat[];
  optional: SubStat[];
}

const SLOT_KEYS: SlotKey[] = ['flowerPlume', 'sands', 'goblet', 'circlet'];

/**
 * Simple merge pipeline with optional heuristics.
 * Step 1 is always applied, steps 2 and 3 are optional toggles.
 */
export function simpleMerge(
  configs: SetConfig[],
  options: SimpleMergeOptions = DEFAULT_SIMPLE_MERGE_OPTIONS
): SetConfig[] {
  if (configs.length <= 1) {
    return configs;
  }

  const mergedOptions = { ...DEFAULT_SIMPLE_MERGE_OPTIONS, ...options };

  let current = mergeIdenticalConfigs(configs);

  if (mergedOptions.mergeSingleFlexVariants) {
    current = iterativeMerge(current, tryMergePickOne);
  }

  if (mergedOptions.findRigidCommonSubset) {
    current = iterativeMerge(current, tryPromoteRigid);

    // Promotion produces pick-one patterns; run step 2 again if enabled.
    if (mergedOptions.mergeSingleFlexVariants) {
      current = iterativeMerge(current, tryMergePickOne);
    }
  }

  return current;
}

/**
 * Step 1: merge configs that match on all fields except main stats & served characters.
 */
function mergeIdenticalConfigs(configs: SetConfig[]): SetConfig[] {
  const seen = new Map<string, SetConfig>();
  const results: SetConfig[] = [];

  for (const config of configs) {
    const signature = buildConfigSignature(config);

    if (!seen.has(signature)) {
      const clone = cloneConfig(config);
      seen.set(signature, clone);
      results.push(clone);
    } else {
      mergeConfigMetadata(seen.get(signature)!, config);
    }
  }

  return results;
}

/**
 * Generic iterative pairwise merge runner.
 */
function iterativeMerge(
  configs: SetConfig[],
  strategy: (target: SetConfig, candidate: SetConfig) => boolean
): SetConfig[] {
  const list = [...configs];

  let didMerge = true;
  while (didMerge) {
    didMerge = false;

    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (strategy(list[i], list[j])) {
          list.splice(j, 1);
          didMerge = true;
          break outer;
        }
      }
    }
  }

  return list;
}

/**
 * Step 2 merge: same mustPresent, k = |mustPresent| + 1.
 * Union the remaining pool (pick-one pattern).
 */
function tryMergePickOne(target: SetConfig, candidate: SetConfig): boolean {
  const slotUpdates: Partial<Record<SlotKey, SlotMergeResult>> = {};
  let changed = false;

  for (const key of SLOT_KEYS) {
    const targetSlot = target[key];
    const candidateSlot = candidate[key];

    if (areSlotsStructurallyEqual(targetSlot, candidateSlot)) {
      slotUpdates[key] = {
        mainStats: orderedUnion(targetSlot.mainStats, candidateSlot.mainStats),
        substats: normalizeSubstats(orderedUnion(targetSlot.substats, candidateSlot.substats), targetSlot.mustPresent),
        mustPresent: [...targetSlot.mustPresent],
        minStatCount: targetSlot.minStatCount
      };
      continue;
    }

    const mergedSlot = mergePickOneSlot(targetSlot, candidateSlot);
    if (!mergedSlot) {
      return false;
    }

    slotUpdates[key] = mergedSlot;
    changed = true;
  }

  if (!changed) {
    return false;
  }

  applySlotUpdates(target, slotUpdates);
  mergeConfigMetadata(target, candidate);
  return true;
}

/**
 * Step 3 merge: promote rigid (n=k) configs into pick-one patterns.
 */
function tryPromoteRigid(target: SetConfig, candidate: SetConfig): boolean {
  const slotUpdates: Partial<Record<SlotKey, SlotMergeResult>> = {};
  let changed = false;

  for (const key of SLOT_KEYS) {
    const targetSlot = target[key];
    const candidateSlot = candidate[key];

    if (areSlotsStructurallyEqual(targetSlot, candidateSlot)) {
      slotUpdates[key] = {
        mainStats: orderedUnion(targetSlot.mainStats, candidateSlot.mainStats),
        substats: normalizeSubstats(orderedUnion(targetSlot.substats, candidateSlot.substats), targetSlot.mustPresent),
        mustPresent: [...targetSlot.mustPresent],
        minStatCount: targetSlot.minStatCount
      };
      continue;
    }

    const mergedSlot = promoteRigidSlot(targetSlot, candidateSlot);
    if (!mergedSlot) {
      return false;
    }

    slotUpdates[key] = mergedSlot;
    changed = true;
  }

  if (!changed) {
    return false;
  }

  applySlotUpdates(target, slotUpdates);
  mergeConfigMetadata(target, candidate);
  return true;
}

function mergePickOneSlot(target: SlotConfig, candidate: SlotConfig): SlotMergeResult | null {
  if (target.minStatCount !== candidate.minStatCount) {
    return null;
  }

  if (target.mustPresent.length !== candidate.mustPresent.length) {
    return null;
  }

  if (target.minStatCount !== target.mustPresent.length + 1) {
    return null;
  }

  if (!areArraysEqualIgnoreOrder(target.mustPresent, candidate.mustPresent)) {
    return null;
  }

  const orderedMust = orderMustPresent(target.mustPresent, candidate.mustPresent);
  const mergedSubstats = normalizeSubstats(
    orderedUnion(target.substats, candidate.substats),
    orderedMust
  );

  return {
    mainStats: orderedUnion(target.mainStats, candidate.mainStats),
    substats: mergedSubstats,
    mustPresent: orderedMust,
    minStatCount: target.minStatCount
  };
}

function promoteRigidSlot(target: SlotConfig, candidate: SlotConfig): SlotMergeResult | null {
  if (target.minStatCount !== candidate.minStatCount) {
    return null;
  }

  const k = target.minStatCount;
  if (k <= 0) {
    return null;
  }

  const shapeTarget = analyzePromotionShape(target);
  const shapeCandidate = analyzePromotionShape(candidate);

  if (!shapeTarget || !shapeCandidate) {
    return null;
  }

  if (shapeTarget.k !== shapeCandidate.k) {
    return null;
  }

  if (shapeTarget.type === 'rigid' && shapeCandidate.type === 'rigid') {
    return mergeRigidPairs(target, candidate, shapeTarget, shapeCandidate);
  }

  if (shapeTarget.type === 'pick' && shapeCandidate.type === 'rigid') {
    return mergePickWithRigid(target, candidate, shapeTarget, shapeCandidate);
  }

  if (shapeTarget.type === 'rigid' && shapeCandidate.type === 'pick') {
    const merged = mergePickWithRigid(candidate, target, shapeCandidate, shapeTarget);
    if (!merged) {
      return null;
    }

    return {
      mainStats: orderedUnion(target.mainStats, candidate.mainStats),
      substats: merged.substats,
      mustPresent: merged.mustPresent,
      minStatCount: merged.minStatCount
    };
  }

  // Both already pick-one patterns – Step 2 will handle them.
  return null;
}

function analyzePromotionShape(slot: SlotConfig): PromotionShape | null {
  const k = slot.minStatCount;
  if (k <= 0) {
    return null;
  }

  const uniqueMust = dedupe(slot.mustPresent);

  if (uniqueMust.length === k) {
    return {
      type: 'rigid',
      k,
      required: uniqueMust
    };
  }

  if (uniqueMust.length === k - 1) {
    const optional = dedupe(slot.substats.filter(stat => !uniqueMust.includes(stat)));
    return {
      type: 'pick',
      k,
      must: uniqueMust,
      optional
    };
  }

  return null;
}

function mergeRigidPairs(
  targetSlot: SlotConfig,
  candidateSlot: SlotConfig,
  targetShape: RigidPromotionShape,
  candidateShape: RigidPromotionShape
): SlotMergeResult | null {
  const k = targetShape.k;
  const common = intersection(targetShape.required, candidateShape.required);

  if (common.length < Math.max(0, k - 1)) {
    return null;
  }

  const newMustPresent = selectOrderedSubset(
    k - 1,
    targetShape.required,
    candidateShape.required,
    common
  );

  const requiredUnion = orderedUnion(targetShape.required, candidateShape.required);
  const combinedSubstats = orderedUnion(
    orderedUnion(targetSlot.substats, candidateSlot.substats),
    requiredUnion
  );

  const normalizedSubstats = normalizeSubstats(combinedSubstats, newMustPresent);

  return {
    mainStats: orderedUnion(targetSlot.mainStats, candidateSlot.mainStats),
    substats: normalizedSubstats,
    mustPresent: newMustPresent,
    minStatCount: k
  };
}

function mergePickWithRigid(
  pickSlot: SlotConfig,
  rigidSlot: SlotConfig,
  pickShape: PickPromotionShape,
  rigidShape: RigidPromotionShape
): SlotMergeResult | null {
  const pickMust = pickShape.must;
  const intersectionWithRigid = intersection(rigidShape.required, pickMust);

  if (intersectionWithRigid.length < pickMust.length) {
    return null;
  }

  const rigidExtras = rigidShape.required.filter(stat => !pickMust.includes(stat));
  const optionalUnion = orderedUnion(pickShape.optional, rigidExtras);

  const candidatesUnion = orderedUnion(
    orderedUnion(pickSlot.substats, rigidSlot.substats),
    orderedUnion(pickMust, optionalUnion)
  );

  const normalized = normalizeSubstats(candidatesUnion, pickMust);

  return {
    mainStats: orderedUnion(pickSlot.mainStats, rigidSlot.mainStats),
    substats: normalized,
    mustPresent: pickMust,
    minStatCount: pickShape.k
  };
}

function applySlotUpdates(
  target: SetConfig,
  updates: Partial<Record<SlotKey, SlotMergeResult>>
): void {
  for (const key of SLOT_KEYS) {
    const update = updates[key];
    if (!update) continue;

    target[key] = {
      mainStats: update.mainStats,
      substats: update.substats,
      mustPresent: update.mustPresent,
      minStatCount: update.minStatCount
    };
  }
}

function mergeConfigMetadata(target: SetConfig, source: SetConfig): void {
  // Merge main stats
  for (const key of SLOT_KEYS) {
    target[key].mainStats = orderedUnion(target[key].mainStats, source[key].mainStats);
  }

  // Merge served characters
  const existing = new Map<string, CharacterMergeInfo>();
  for (const info of target.servedCharacters) {
    existing.set(info.characterId, info);
  }

  for (const info of source.servedCharacters) {
    const current = existing.get(info.characterId);
    if (current) {
      current.hasPerfectMerge = current.hasPerfectMerge && info.hasPerfectMerge;
      current.has4pcBuild = current.has4pcBuild || info.has4pcBuild;
    } else {
      target.servedCharacters.push({ ...info });
    }
  }
}

function buildConfigSignature(config: SetConfig): string {
  return SLOT_KEYS
    .map((key) => buildSlotSignature(config[key]))
    .join('|');
}

function buildSlotSignature(slot: SlotConfig): string {
  const must = [...slot.mustPresent].sort().join(',');
  const sub = [...slot.substats].sort().join(',');
  return `${slot.minStatCount}:${must}:${sub}`;
}

function cloneConfig(config: SetConfig): SetConfig {
  return {
    flowerPlume: cloneSlot(config.flowerPlume),
    sands: cloneSlot(config.sands),
    goblet: cloneSlot(config.goblet),
    circlet: cloneSlot(config.circlet),
    servedCharacters: config.servedCharacters.map(info => ({ ...info }))
  };
}

function cloneSlot(slot: SlotConfig): SlotConfig {
  return {
    mainStats: [...slot.mainStats],
    substats: [...slot.substats],
    mustPresent: [...slot.mustPresent],
    minStatCount: slot.minStatCount
  };
}

function areSlotsStructurallyEqual(slotA: SlotConfig, slotB: SlotConfig): boolean {
  return (
    slotA.minStatCount === slotB.minStatCount &&
    areArraysEqualIgnoreOrder(slotA.mustPresent, slotB.mustPresent) &&
    areArraysEqualIgnoreOrder(slotA.substats, slotB.substats)
  );
}

function orderedUnion<T>(first: T[], second: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of first) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  for (const value of second) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

function normalizeSubstats(allSubstats: SubStat[], mustPresent: SubStat[]): SubStat[] {
  const mustSet = new Set(mustPresent);
  const orderedMust = mustPresent.filter((stat, index) => mustPresent.indexOf(stat) === index);
  const remainder = allSubstats.filter(stat => !mustSet.has(stat));
  return [...orderedMust, ...remainder];
}

function areArraysEqualIgnoreOrder<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  const counted = new Map<T, number>();
  for (const item of a) {
    counted.set(item, (counted.get(item) ?? 0) + 1);
  }

  for (const item of b) {
    const existing = counted.get(item);
    if (!existing) {
      return false;
    }
    if (existing === 1) {
      counted.delete(item);
    } else {
      counted.set(item, existing - 1);
    }
  }

  return counted.size === 0;
}

function orderMustPresent(primary: SubStat[], secondary: SubStat[]): SubStat[] {
  const seen = new Set<SubStat>();
  const ordered: SubStat[] = [];

  for (const stat of primary) {
    if (!seen.has(stat)) {
      seen.add(stat);
      ordered.push(stat);
    }
  }

  for (const stat of secondary) {
    if (!seen.has(stat)) {
      seen.add(stat);
      ordered.push(stat);
    }
  }

  return ordered;
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function intersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  const result: T[] = [];
  for (const item of a) {
    if (setB.has(item) && !result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

function selectOrderedSubset(
  count: number,
  primarySource: SubStat[],
  secondarySource: SubStat[],
  commonPool: SubStat[]
): SubStat[] {
  if (count <= 0) {
    return [];
  }

  const commonSet = new Set(commonPool);
  const seen = new Set<SubStat>();
  const result: SubStat[] = [];

  for (const stat of primarySource) {
    if (commonSet.has(stat) && !seen.has(stat)) {
      seen.add(stat);
      result.push(stat);
      if (result.length === count) {
        return result;
      }
    }
  }

  for (const stat of secondarySource) {
    if (commonSet.has(stat) && !seen.has(stat)) {
      seen.add(stat);
      result.push(stat);
      if (result.length === count) {
        return result;
      }
    }
  }

  for (const stat of commonPool) {
    if (!seen.has(stat)) {
      seen.add(stat);
      result.push(stat);
      if (result.length === count) {
        return result;
      }
    }
  }

  return result;
}
