import type {
  MainStatPlus,
  SetConfig,
  SlotConfig,
  SubStat,
} from "../../data/types";
import {
  SLOT_KEYS,
  type SlotKey,
  areArraysEqualIgnoreOrder,
  areSlotsStructurallyEqual,
  coalesceByFingerprint,
  dedupe,
  intersection,
  mergeConfigMetadata,
  orderedUnion,
  reorderSubstats,
} from "./mergeUtils";

type SlotShape = RigidSlotShape | FlexSlotShape;

interface RigidSlotShape {
  type: "rigid";
  k: number;
  required: SubStat[];
}

interface FlexSlotShape {
  type: "flex";
  k: number;
  must: SubStat[];
  optional: SubStat[];
}

/**
 * Greedy merge pipeline.
 *
 * 1. Deduplicate configs with identical substat shapes.
 * 2. Merge configs that share the same mustPresent core (union option pools).
 * 3. Extract common mustPresent from two fully-locked (rigid) configs,
 *    introducing a flexible slot.
 * 4. Run step 2 again (step 3 may have created new same-mustPresent pairs).
 */
export function greedyMerge(configs: SetConfig[]): SetConfig[] {
  if (configs.length <= 1) {
    return configs;
  }

  let current = coalesceByFingerprint(configs);

  current = reduceWithStrategy(current, tryMergeSameMustPresent);
  current = reduceWithStrategy(current, tryExtractCommonMustPresent);
  // Step 3 produces flex patterns; run step 2 again to catch new matches.
  current = reduceWithStrategy(current, tryMergeSameMustPresent);

  return current;
}

/**
 * Repeatedly apply a pairwise merge strategy until no more pairs can merge.
 */
function reduceWithStrategy(
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

// ── Slot-level merge strategies ─────────────────────────────────────────

/**
 * Attempt merging target ← candidate slot-by-slot.
 * Structurally equal slots are identity-merged (union main stats + substats).
 * Non-equal slots are delegated to the provided `slotMerger`. If any slot
 * fails, the entire merge is aborted. If no slot produced a real change,
 * the merge is skipped (the configs are structurally identical and would
 * have been caught by mergeIdenticalConfigs).
 */
function tryPairwiseMerge(
  target: SetConfig,
  candidate: SetConfig,
  slotMerger: (target: SlotConfig, candidate: SlotConfig) => SlotConfig | null
): boolean {
  const slotUpdates: Partial<Record<SlotKey, SlotConfig>> = {};
  let changed = false;

  for (const key of SLOT_KEYS) {
    const targetSlot = target[key];
    const candidateSlot = candidate[key];

    if (areSlotsStructurallyEqual(targetSlot, candidateSlot)) {
      slotUpdates[key] = {
        mainStats: orderedUnion(targetSlot.mainStats, candidateSlot.mainStats),
        substats: reorderSubstats(
          orderedUnion(targetSlot.substats, candidateSlot.substats),
          targetSlot.mustPresent
        ),
        mustPresent: [...targetSlot.mustPresent],
        minStatCount: targetSlot.minStatCount,
      };
      continue;
    }

    const mergedSlot = slotMerger(targetSlot, candidateSlot);
    if (!mergedSlot) {
      return false;
    }

    slotUpdates[key] = mergedSlot;
    changed = true;
  }

  if (!changed) {
    return false;
  }

  for (const key of SLOT_KEYS) {
    if (slotUpdates[key]) target[key] = slotUpdates[key];
  }
  mergeConfigMetadata(target, candidate);
  return true;
}

/**
 * Step 2: merge two configs whose slots share the same mustPresent and
 * k = |mustPresent| + 1. Unions the option pools ("flex stat").
 */
function tryMergeSameMustPresent(
  target: SetConfig,
  candidate: SetConfig
): boolean {
  return tryPairwiseMerge(target, candidate, mergeSameMustPresentSlot);
}

/**
 * Step 3: merge two configs with fully-locked (rigid) slots that share
 * k−1 stats. Extracts the common mustPresent and creates a flex slot.
 */
function tryExtractCommonMustPresent(
  target: SetConfig,
  candidate: SetConfig
): boolean {
  return tryPairwiseMerge(target, candidate, extractCommonMustPresentSlot);
}

function mergeSameMustPresentSlot(
  target: SlotConfig,
  candidate: SlotConfig
): SlotConfig | null {
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

  const orderedMust = orderedUnion(target.mustPresent, candidate.mustPresent);
  const mergedSubstats = reorderSubstats(
    orderedUnion(target.substats, candidate.substats),
    orderedMust
  );

  return {
    mainStats: orderedUnion(target.mainStats, candidate.mainStats),
    substats: mergedSubstats,
    mustPresent: orderedMust,
    minStatCount: target.minStatCount,
  };
}

function extractCommonMustPresentSlot(
  target: SlotConfig,
  candidate: SlotConfig
): SlotConfig | null {
  if (target.minStatCount !== candidate.minStatCount) {
    return null;
  }

  const k = target.minStatCount;
  if (k <= 0) {
    return null;
  }

  const shapeTarget = classifySlotShape(target);
  const shapeCandidate = classifySlotShape(candidate);

  if (!shapeTarget || !shapeCandidate) {
    return null;
  }

  if (shapeTarget.k !== shapeCandidate.k) {
    return null;
  }

  if (shapeTarget.type === "rigid" && shapeCandidate.type === "rigid") {
    return mergeRigidWithRigid(target, candidate, shapeTarget, shapeCandidate);
  }

  if (shapeTarget.type === "flex" && shapeCandidate.type === "rigid") {
    return mergeFlexWithRigid(target, candidate, shapeTarget, shapeCandidate);
  }

  if (shapeTarget.type === "rigid" && shapeCandidate.type === "flex") {
    return mergeFlexWithRigid(candidate, target, shapeCandidate, shapeTarget);
  }

  // Both already flex — step 2 will handle them.
  return null;
}

function classifySlotShape(slot: SlotConfig): SlotShape | null {
  const k = slot.minStatCount;
  if (k <= 0) {
    return null;
  }

  const uniqueMust = dedupe(slot.mustPresent);

  if (uniqueMust.length === k) {
    return {
      type: "rigid",
      k,
      required: uniqueMust,
    };
  }

  if (uniqueMust.length === k - 1) {
    const optional = dedupe(
      slot.substats.filter((stat) => !uniqueMust.includes(stat))
    );
    return {
      type: "flex",
      k,
      must: uniqueMust,
      optional,
    };
  }

  return null;
}

function mergeRigidWithRigid(
  targetSlot: SlotConfig,
  candidateSlot: SlotConfig,
  targetShape: RigidSlotShape,
  candidateShape: RigidSlotShape
): SlotConfig | null {
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

  const requiredUnion = orderedUnion(
    targetShape.required,
    candidateShape.required
  );
  const combinedSubstats = orderedUnion(
    orderedUnion(targetSlot.substats, candidateSlot.substats),
    requiredUnion
  );

  const normalizedSubstats = reorderSubstats(combinedSubstats, newMustPresent);

  return {
    mainStats: orderedUnion(targetSlot.mainStats, candidateSlot.mainStats),
    substats: normalizedSubstats,
    mustPresent: newMustPresent,
    minStatCount: k,
  };
}

function mergeFlexWithRigid(
  flexSlot: SlotConfig,
  rigidSlot: SlotConfig,
  flexShape: FlexSlotShape,
  rigidShape: RigidSlotShape
): SlotConfig | null {
  const flexMust = flexShape.must;
  const intersectionWithRigid = intersection(rigidShape.required, flexMust);

  if (intersectionWithRigid.length < flexMust.length) {
    return null;
  }

  const rigidExtras = rigidShape.required.filter(
    (stat) => !flexMust.includes(stat)
  );
  const optionalUnion = orderedUnion(flexShape.optional, rigidExtras);

  const candidatesUnion = orderedUnion(
    orderedUnion(flexSlot.substats, rigidSlot.substats),
    orderedUnion(flexMust, optionalUnion)
  );

  const normalized = reorderSubstats(candidatesUnion, flexMust);

  return {
    mainStats: orderedUnion(flexSlot.mainStats, rigidSlot.mainStats),
    substats: normalized,
    mustPresent: flexMust,
    minStatCount: flexShape.k,
  };
}

/**
 * Select `count` items from `commonPool`, prioritizing items that appear in
 * `primarySource` first, then `secondarySource`, preserving their order.
 */
function selectOrderedSubset(
  count: number,
  primarySource: SubStat[],
  secondarySource: SubStat[],
  commonPool: SubStat[]
): SubStat[] {
  if (count <= 0) return [];
  const pool = new Set(commonPool);
  return orderedUnion(primarySource, secondarySource)
    .filter((s) => pool.has(s))
    .slice(0, count);
}
