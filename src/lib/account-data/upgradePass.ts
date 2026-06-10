/**
 * Upgrade pass: per-character recommendations for which submax artifacts to
 * level up, given a fixed allocated build from the tier-waterfall.
 *
 * Three strategies (4pc only for #2 and #3; 2+2 only runs #1):
 *
 *   1) Upgrade in place: drop an upgraded same-set artifact into a fixed-set
 *      slot, OR drop an upgraded different-set artifact into the flex slot.
 *   2) Upgrade flex with same-set, optionally swap one fixed slot:
 *      put an upgraded same-set artifact in the flex (now 5pc-equivalent),
 *      and optionally also swap a fixed-set slot for a different-set max-level
 *      artifact since we're over-saturated on the main set.
 *   3) Swap flex to same-set, then upgrade a different slot:
 *      put a max-level same-set artifact in the flex, then upgrade a
 *      different-set artifact for one of the now-redundant fixed slots.
 *
 * No artifact-uniqueness constraint across characters: the same upgrade
 * candidate can surface under multiple characters' recommendations.
 */

import type { LuckExpectation, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { getExpectedRollValue } from "./artifactProjection";
import { scoreFullBuild } from "./buildOptimizer";
import type { CandidateArtifact } from "./candidatePool";
import {
  countArtifactsBySetKey,
  findActiveConcreteTwoPieceSetPair,
} from "./setConstraints";
import type { AllocatedBuild } from "./tierWaterfall";

export type UpgradeStrategy = 1 | 2 | 3;

export interface UpgradeAction {
  strategy: UpgradeStrategy;
  characterId: string;
  /** Slot whose artifact is being upgraded (the one that requires +XP/runes). */
  upgradeSlot: Slot;
  /** Artifact ID being upgraded. */
  upgradeArtifactId: string;
  /**
   * Slot (and source artifact ID) that's also being swapped in addition to the
   * upgrade. Only present for strategies 2 and 3. The swap artifact is at max
   * level — it does not need upgrading.
   */
  swapSlot?: Slot;
  swapArtifactId?: string;
  scoreDiff: number;
  finalScore: number;
}

export interface CharacterUpgrades {
  characterId: string;
  recommendations: UpgradeAction[];
}

export interface UpgradePassOptions {
  /** Minimum scoreDiff for a recommendation to surface. */
  minScoreDiff?: number;
  /** Artifacts allocated to current-or-higher tiers; unavailable as external picks. */
  blockedArtifactIds?: ReadonlySet<string>;
}

const MAX_LEVEL: Record<number, number> = { 5: 20, 4: 16 };

/**
 * Run the upgrade pass for a single character.
 *
 * `pool` is the entire artifact pool (allocated to anyone or unclaimed); the
 * upgrade pass considers any artifact, not just unclaimed ones.
 */
export function runUpgradePassForCharacter(
  alloc: AllocatedBuild,
  pool: ArtifactData[],
  options: UpgradePassOptions = {}
): CharacterUpgrades {
  const minDiff = options.minScoreDiff ?? 1.0;
  const recs: UpgradeAction[] = [];

  if (!alloc.build || !alloc.context) {
    return { characterId: alloc.characterId, recommendations: recs };
  }

  const { config } = alloc.context;
  const luck = alloc.luckExpectation;
  const composition = config.setConstraint.composition;
  const allocBuild = alloc.build;

  const baseScore = allocBuild.finalScore;

  // Project upgrade candidates from the pool (excluding artifacts already in
  // the allocated build — upgrading an in-build artifact handled separately).
  const inBuildIds = new Set<string>();
  for (const slot of allSlots) {
    const a = allocBuild.artifacts[slot];
    if (a) inBuildIds.add(a.id);
  }
  const blockedArtifactIds = options.blockedArtifactIds ?? new Set();

  const upgradeCandidatesBySlot = bucketBySlot(
    pool
      .filter(
        (a) =>
          !inBuildIds.has(a.id) &&
          !blockedArtifactIds.has(a.id) &&
          isUpgradeable(a)
      )
      .map((a) => projectUpgrade(a, luck))
  );
  // In-build artifacts deliberately skip the blocked/protected filter:
  // upgrading an artifact in place keeps it on its owner, so frozen loadouts
  // stay intact, and in-build ids are always part of the own-tier blocked set.
  const inBuildUpgradeBySlot = bucketBySlot(
    pool
      .filter((a) => inBuildIds.has(a.id) && isUpgradeable(a))
      .map((a) => projectUpgrade(a, luck))
  );

  // Max-level artifacts that could serve as swap partners for strategies 2/3.
  const maxLevelBySlot = bucketBySlot(
    pool.filter(
      (a) =>
        !inBuildIds.has(a.id) && !blockedArtifactIds.has(a.id) && isMaxLevel(a)
    )
  );

  // ─── Strategy 1: upgrade in place ───
  for (const slot of allSlots) {
    const slotMembership = classifySlot(
      slot,
      allocBuild.artifacts,
      composition,
      config.setConstraint
    );

    // In-build upgrade: re-evaluate the currently-equipped artifact at max level.
    const inBuildUpgrade = inBuildUpgradeBySlot.get(slot) ?? [];
    for (const cand of inBuildUpgrade) {
      const next = withSlotReplaced(allocBuild.artifacts, slot, cand);
      const { finalScore } = scoreFullBuild(
        next,
        config.weights,
        config.targetMainStatWeights,
        config.crBudget
      );
      const diff = finalScore - baseScore;
      if (diff < minDiff) continue;
      recs.push({
        strategy: 1,
        characterId: alloc.characterId,
        upgradeSlot: slot,
        upgradeArtifactId: cand.id,
        scoreDiff: diff,
        finalScore,
      });
    }

    const candidates = upgradeCandidatesBySlot.get(slot) ?? [];
    for (const cand of candidates) {
      const matches = matchesSlotMembership(cand, slotMembership);
      if (!matches) continue;

      const next = withSlotReplaced(allocBuild.artifacts, slot, cand);
      const { finalScore } = scoreFullBuild(
        next,
        config.weights,
        config.targetMainStatWeights,
        config.crBudget
      );
      const diff = finalScore - baseScore;
      if (diff < minDiff) continue;
      recs.push({
        strategy: 1,
        characterId: alloc.characterId,
        upgradeSlot: slot,
        upgradeArtifactId: cand.id,
        scoreDiff: diff,
        finalScore,
      });
    }
  }

  // ─── Strategies 2 & 3: 4pc builds only, with a true flex slot ───
  if (composition === "4pc" && config.setConstraint.artifactSet) {
    const mainSet = config.setConstraint.artifactSet;
    const flexSlot = findFlexSlot4pc(allocBuild.artifacts, mainSet);

    if (flexSlot) {
      // Strategy 2 — upgrade flex with same-set, optionally swap a fixed slot.
      const flexUpgradeCandidates = (
        upgradeCandidatesBySlot.get(flexSlot) ?? []
      ).filter((c) => c.setKey === mainSet);
      for (const cand of flexUpgradeCandidates) {
        // Option 2a: just upgrade flex, no swap.
        const next = withSlotReplaced(allocBuild.artifacts, flexSlot, cand);
        const { finalScore: s2a } = scoreFullBuild(
          next,
          config.weights,
          config.targetMainStatWeights,
          config.crBudget
        );
        if (s2a - baseScore >= minDiff) {
          recs.push({
            strategy: 2,
            characterId: alloc.characterId,
            upgradeSlot: flexSlot,
            upgradeArtifactId: cand.id,
            scoreDiff: s2a - baseScore,
            finalScore: s2a,
          });
        }

        // Option 2b: also swap one fixed slot for a different-set max-level artifact.
        for (const swapSlot of allSlots) {
          if (swapSlot === flexSlot) continue;
          const fixedArtifact = allocBuild.artifacts[swapSlot];
          if (!fixedArtifact || fixedArtifact.setKey !== mainSet) continue;
          const swapCands = (maxLevelBySlot.get(swapSlot) ?? []).filter(
            (a) => a.setKey !== mainSet
          );
          for (const swapCand of swapCands) {
            let trial = withSlotReplaced(allocBuild.artifacts, flexSlot, cand);
            trial = withSlotReplaced(trial, swapSlot, asCandidate(swapCand));
            const { finalScore } = scoreFullBuild(
              trial,
              config.weights,
              config.targetMainStatWeights,
              config.crBudget
            );
            const diff = finalScore - baseScore;
            if (diff < minDiff) continue;
            recs.push({
              strategy: 2,
              characterId: alloc.characterId,
              upgradeSlot: flexSlot,
              upgradeArtifactId: cand.id,
              swapSlot,
              swapArtifactId: swapCand.id,
              scoreDiff: diff,
              finalScore,
            });
          }
        }
      }

      // Strategy 3 — swap flex to same-set max-level, then upgrade a fixed slot
      // with a different-set artifact.
      const sameSetFlexMaxes = (maxLevelBySlot.get(flexSlot) ?? []).filter(
        (a) => a.setKey === mainSet
      );
      for (const flexSwap of sameSetFlexMaxes) {
        const flexSwapped = withSlotReplaced(
          allocBuild.artifacts,
          flexSlot,
          asCandidate(flexSwap)
        );
        for (const upSlot of allSlots) {
          if (upSlot === flexSlot) continue;
          const upCands = (upgradeCandidatesBySlot.get(upSlot) ?? []).filter(
            (a) => a.setKey !== mainSet
          );
          for (const upCand of upCands) {
            const trial = withSlotReplaced(flexSwapped, upSlot, upCand);
            const { finalScore } = scoreFullBuild(
              trial,
              config.weights,
              config.targetMainStatWeights,
              config.crBudget
            );
            const diff = finalScore - baseScore;
            if (diff < minDiff) continue;
            recs.push({
              strategy: 3,
              characterId: alloc.characterId,
              upgradeSlot: upSlot,
              upgradeArtifactId: upCand.id,
              swapSlot: flexSlot,
              swapArtifactId: flexSwap.id,
              scoreDiff: diff,
              finalScore,
            });
          }
        }
      }
    }
  }

  recs.sort((a, b) => b.scoreDiff - a.scoreDiff);
  return { characterId: alloc.characterId, recommendations: recs };
}

// ─── Slot membership classification ───

type SlotMembership =
  | { kind: "fixed4pc"; mainSet: string }
  | { kind: "flex4pc"; mainSet: string }
  | { kind: "fixedConcrete2pc"; setKey: string }
  | { kind: "flex22" };

function classifySlot(
  slot: Slot,
  artifacts: Record<Slot, CandidateArtifact>,
  composition: "4pc" | "2pc+2pc",
  setConstraint: { artifactSet?: string; halfSet1?: string; halfSet2?: string }
): SlotMembership | null {
  const equipped = artifacts[slot];
  if (!equipped) return null;
  if (composition === "4pc") {
    const mainSet = setConstraint.artifactSet;
    if (!mainSet) return null;
    return equipped.setKey === mainSet
      ? { kind: "fixed4pc", mainSet }
      : { kind: "flex4pc", mainSet };
  }
  // 2+2
  const h1 = setConstraint.halfSet1;
  const h2 = setConstraint.halfSet2;
  if (!h1 || !h2) return null;
  const activePair = findActiveConcreteTwoPieceSetPair(artifacts, h1, h2);
  if (!activePair) return null;
  const activeSetKeys = new Set([
    activePair.halfSet1SetKey,
    activePair.halfSet2SetKey,
  ]);
  if (!activeSetKeys.has(equipped.setKey)) return { kind: "flex22" };

  const countsBySetKey = countArtifactsBySetKey(artifacts);
  const activeSetCount = countsBySetKey.get(equipped.setKey) ?? 0;
  return activeSetCount > 2
    ? { kind: "flex22" }
    : { kind: "fixedConcrete2pc", setKey: equipped.setKey };
}

function matchesSlotMembership(
  candidate: CandidateArtifact,
  membership: SlotMembership | null
): boolean {
  if (!membership) return false;
  switch (membership.kind) {
    case "fixed4pc":
      return candidate.setKey === membership.mainSet;
    case "flex4pc":
      return candidate.setKey !== membership.mainSet;
    case "fixedConcrete2pc":
      return candidate.setKey === membership.setKey;
    case "flex22":
      return true;
  }
}

function findFlexSlot4pc(
  artifacts: Record<Slot, CandidateArtifact>,
  mainSet: string
): Slot | null {
  for (const slot of allSlots) {
    const a = artifacts[slot];
    if (a && a.setKey !== mainSet) return slot;
  }
  return null;
}

// ─── Upgrade projection ───

function isUpgradeable(art: ArtifactData): boolean {
  const max = MAX_LEVEL[art.rarity];
  if (max == null) return false;
  if (art.level >= max) return false;
  if (art.rarity === 4) {
    const lines =
      Object.keys(art.substats || {}).length +
      Object.keys(art.unactivatedSubstats || {}).length;
    if (lines < 4) return false;
  }
  return true;
}

function isMaxLevel(art: ArtifactData): boolean {
  const max = MAX_LEVEL[art.rarity];
  return max != null && art.level >= max;
}

/**
 * Project a submax artifact to its max-level state. Upgrade rolls land at
 * fixed level thresholds (4/8/.../max), so the remaining roll count is
 * floor(max/4) − floor(level/4). Known unactivated lines are activated first
 * (one roll each, using the recorded value when the scanner revealed it);
 * the rest of the rolls are split equally across the active lines — the
 * unbiased expectation, since each roll hits one of the 4 lines uniformly.
 */
function projectUpgrade(
  art: ArtifactData,
  luck: LuckExpectation
): CandidateArtifact {
  const max = MAX_LEVEL[art.rarity];
  if (max == null) {
    return { ...art, source: "upgrade", sourceArtifactId: art.id };
  }
  const substats: Partial<Record<SubStat, number>> = { ...art.substats };
  let remainingRolls = Math.floor(max / 4) - Math.floor(art.level / 4);

  for (const [stat, recorded] of Object.entries(
    art.unactivatedSubstats ?? {}
  ) as [SubStat, number][]) {
    if (remainingRolls <= 0) break;
    if (Object.keys(substats).length >= 4) break;
    substats[stat] =
      (substats[stat] ?? 0) +
      (recorded > 0 ? recorded : getExpectedRollValue(stat, art.rarity, luck));
    remainingRolls -= 1;
  }

  const stats = Object.keys(substats) as SubStat[];
  if (stats.length > 0 && remainingRolls > 0) {
    const perStat = remainingRolls / stats.length;
    for (const s of stats) {
      const val = getExpectedRollValue(s, art.rarity, luck);
      substats[s] = (substats[s] ?? 0) + val * perStat;
    }
  }

  return {
    ...art,
    substats,
    level: max,
    source: "upgrade",
    sourceArtifactId: art.id,
    sourceArtifact: art,
  };
}

// ─── Slot bucketing ───

function bucketBySlot<T extends { slotKey: Slot }>(items: T[]): Map<Slot, T[]> {
  const m = new Map<Slot, T[]>();
  for (const slot of allSlots) m.set(slot, []);
  for (const item of items) m.get(item.slotKey)!.push(item);
  return m;
}

function asCandidate(art: ArtifactData): CandidateArtifact {
  return { ...art, source: "swap", sourceArtifactId: art.id };
}

function withSlotReplaced(
  artifacts: Record<Slot, CandidateArtifact>,
  slot: Slot,
  next: CandidateArtifact
): Record<Slot, CandidateArtifact> {
  return { ...artifacts, [slot]: next };
}
