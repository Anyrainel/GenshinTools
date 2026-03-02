import { artifactHalfSetsById, artifactsById } from "@/data/constants";
import type {
  AccountData,
  ArtifactData,
  Build,
  BuildGroup,
  GlobalStatWeights,
  MainStat,
  Slot,
  SubStat,
} from "@/data/types";
import { allSlots } from "@/data/types";
import {
  type StatWeightMap,
  buildToWeightMap,
  calculateMaxSlotSubScore,
  scoreMainStat,
  scoreSlot,
} from "./artifactScore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScalingStat = "atk" | "hp" | "def" | "em";
export type ArchetypeRole = "dps" | "support";

export type EvalBuild = {
  /** Dedup key */
  key: string;
  /** Artifact set ID this entry evaluates against (for 4pc); "__2+2__" for 2+2 */
  artifactSet: string;
  /** Build composition */
  composition: "4pc" | "2+2";
  /** Number of flex (off-set) slots allowed: 1 for 4pc, 1 for 2+2 */
  flexCount: number;
  /** All builds that collapsed into this evaluation */
  builds: Build[];
  /** Characters that use any of these builds */
  characterIds: string[];
  /** Representative stat weights (max per stat across all merged builds) */
  weights: StatWeightMap;
  /** Union of recommended main stats from all merged builds */
  mainStats: {
    sands: MainStat[];
    goblet: MainStat[];
    circlet: MainStat[];
  };
  /** Substats sorted by weight desc (for display) */
  sortedSubstats: { stat: SubStat; weight: number }[];
  /** Primary scaling stat for this archetype */
  scalingStat: ScalingStat;
  /** Archetype role */
  archetypeRole: ArchetypeRole;
  /** For 2+2: half-set group ID (e.g. "atk%-18") for half 1 */
  halfSet1Id?: string;
  /** For 2+2: half-set group ID (e.g. "hp%-20") for half 2 */
  halfSet2Id?: string;
  /** For 2+2: rarity-5 set IDs belonging to half-set 1 */
  halfSet1SetIds?: string[];
  /** For 2+2: rarity-5 set IDs belonging to half-set 2 */
  halfSet2SetIds?: string[];
};

export type SlotEvaluation = {
  artifact: ArtifactData | null;
  score: number;
  maxScore: number;
  isFlexSlot: boolean;
};

export type BuildEvaluation = {
  evalBuild: EvalBuild;
  slots: Record<Slot, SlotEvaluation>;
  totalScore: number;
  totalMaxScore: number;
  /** 0-1, actual / theoretical */
  completeness: number;
};

export type SetGroup = {
  artifactSet: string;
  evaluations: BuildEvaluation[];
  /** Worst completeness in the group (for sorting groups) */
  worstCompleteness: number;
};

// ---------------------------------------------------------------------------
// 1. Dedup builds into EvalBuilds (archetype-based)
// ---------------------------------------------------------------------------

/**
 * Bucket a raw weight into an archetype tier.
 * 90-100 → 100, 70-89 → 75, 50-69 → 50, <50 → dropped (0).
 */
function bucketWeight(w: number): number {
  if (w >= 90) return 100;
  if (w >= 70) return 75;
  if (w >= 50) return 50;
  return 0; // ignored for archetype identity
}

// ---------------------------------------------------------------------------
// Archetype classification
// ---------------------------------------------------------------------------

const scalingMainStats: Record<string, ScalingStat> = {
  "atk%": "atk",
  "hp%": "hp",
  "def%": "def",
  em: "em",
};

/** Infer primary scaling stat from a build's sands preferences + substats. */
export function getScalingStat(build: Build): ScalingStat {
  // Check sands for a scaling-indicative main stat (priority: hp > def > em > atk)
  for (const ms of build.sands) {
    if (ms in scalingMainStats) return scalingMainStats[ms];
  }
  // ER-only or empty sands: infer from substat weights
  const weights = buildToWeightMap(build);
  const candidates: [ScalingStat, number][] = [
    ["hp", weights["hp%"] ?? 0],
    ["def", weights["def%"] ?? 0],
    ["em", weights.em ?? 0],
    ["atk", weights["atk%"] ?? 0],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 0 ? candidates[0][0] : "atk";
}

/** Classify a build as DPS or support from its roles field (or substats). */
export function getArchetypeRole(build: Build): ArchetypeRole {
  const roles = build.roles;
  if (roles && roles.length > 0) {
    if (roles.includes("dps")) return "dps";
    return "support";
  }
  // Fallback: infer from substats
  const weights = buildToWeightMap(build);
  return (weights.cd ?? 0) >= 50 ? "dps" : "support";
}

/**
 * Build a weight fingerprint from the 100 and 75 bucketed stats.
 * Builds that share the same 100+75 profile merge; only 50-weight stats get merged.
 */
function weightFingerprint(build: Build): string {
  const weights = buildToWeightMap(build);
  const tier100: string[] = [];
  const tier75: string[] = [];
  for (const [stat, w] of Object.entries(weights)) {
    const b = bucketWeight(w);
    if (b === 100) tier100.push(stat);
    else if (b === 75) tier75.push(stat);
  }
  tier100.sort();
  tier75.sort();
  return `${tier100.join(",")}|${tier75.join(",")}`;
}

/**
 * Dedup key: set + composition + weight fingerprint (100+75 stats) + role.
 * Builds with the same high-weight stats merge; only 50-weight stats differ.
 */
function makeDedupKey(
  artifactSet: string,
  composition: "4pc" | "2+2",
  build: Build,
  role: ArchetypeRole
): string {
  return `${artifactSet}__${composition}__${weightFingerprint(build)}__${role}`;
}

function mergeInto(existing: EvalBuild, build: Build, characterId: string) {
  if (!existing.characterIds.includes(characterId)) {
    existing.characterIds.push(characterId);
  }
  existing.builds.push(build);

  // Merge weights: keep max per stat
  const incoming = buildToWeightMap(build);
  for (const [stat, w] of Object.entries(incoming)) {
    const cur = existing.weights[stat as SubStat] ?? 0;
    if (w > cur) existing.weights[stat as SubStat] = w;
  }

  // Merge main stats: union
  for (const ms of build.sands) {
    if (!existing.mainStats.sands.includes(ms))
      existing.mainStats.sands.push(ms);
  }
  for (const ms of build.goblet) {
    if (!existing.mainStats.goblet.includes(ms))
      existing.mainStats.goblet.push(ms);
  }
  for (const ms of build.circlet) {
    if (!existing.mainStats.circlet.includes(ms))
      existing.mainStats.circlet.push(ms);
  }
}

function newEvalBuild(
  key: string,
  artifactSet: string,
  composition: "4pc" | "2+2",
  build: Build,
  characterId: string,
  scaling: ScalingStat,
  role: ArchetypeRole,
  halfSet1Id?: string,
  halfSet2Id?: string,
  halfSet1SetIds?: string[],
  halfSet2SetIds?: string[]
): EvalBuild {
  return {
    key,
    artifactSet,
    composition,
    flexCount: 1,
    builds: [build],
    characterIds: [characterId],
    weights: buildToWeightMap(build),
    mainStats: {
      sands: [...build.sands],
      goblet: [...build.goblet],
      circlet: [...build.circlet],
    },
    sortedSubstats: [], // filled after collection
    scalingStat: scaling,
    archetypeRole: role,
    halfSet1Id,
    halfSet2Id,
    halfSet1SetIds,
    halfSet2SetIds,
  };
}

export function collectEvalBuilds(
  buildGroups: BuildGroup[],
  include2pc: boolean
): EvalBuild[] {
  const map = new Map<string, EvalBuild>();

  for (const group of buildGroups) {
    for (const build of group.builds) {
      const scaling = getScalingStat(build);
      const role = getArchetypeRole(build);

      // --- 4pc builds ---
      if (build.composition === "4pc" && build.artifactSet) {
        const key = makeDedupKey(build.artifactSet, "4pc", build, role);
        const existing = map.get(key);
        if (existing) {
          mergeInto(existing, build, group.characterId);
        } else {
          map.set(
            key,
            newEvalBuild(
              key,
              build.artifactSet,
              "4pc",
              build,
              group.characterId,
              scaling,
              role
            )
          );
        }
      }

      // --- 2pc+2pc builds (when toggled on) ---
      if (
        include2pc &&
        build.composition === "2pc+2pc" &&
        build.halfSet1 != null &&
        build.halfSet2 != null
      ) {
        const hs1 = artifactHalfSetsById[String(build.halfSet1)];
        const hs2 = artifactHalfSetsById[String(build.halfSet2)];
        if (!hs1 || !hs2) continue;

        // Filter to rarity 5 sets only
        const set1Ids = hs1.setIds.filter(
          (id) => artifactsById[id]?.rarity === 5
        );
        const set2Ids = hs2.setIds.filter(
          (id) => artifactsById[id]?.rarity === 5
        );
        if (set1Ids.length === 0 || set2Ids.length === 0) continue;

        // Canonical pair key: sorted half-set IDs so (A,B) == (B,A)
        const pairKey = [String(build.halfSet1), String(build.halfSet2)]
          .sort()
          .join("+");
        const key = makeDedupKey(pairKey, "2+2", build, role);
        const existing = map.get(key);
        if (existing) {
          mergeInto(existing, build, group.characterId);
        } else {
          map.set(
            key,
            newEvalBuild(
              key,
              "__2+2__",
              "2+2",
              build,
              group.characterId,
              scaling,
              role,
              String(build.halfSet1),
              String(build.halfSet2),
              set1Ids,
              set2Ids
            )
          );
        }
      }
    }
  }

  // Expand flat stat weights from their % counterparts.
  // e.g. if hp% = 100, flat hp should also be 100 (the punishment factor is
  // applied later by calculateStatScore via globalConfig.flatHp).
  const flatPairs: [string, string][] = [
    ["atk%", "atk"],
    ["hp%", "hp"],
    ["def%", "def"],
  ];
  for (const eb of map.values()) {
    for (const [pctStat, flatStat] of flatPairs) {
      const pctW = eb.weights[pctStat as SubStat] ?? 0;
      const flatW = eb.weights[flatStat as SubStat] ?? 0;
      if (pctW > 0 && flatW < pctW) {
        eb.weights[flatStat as SubStat] = pctW;
      }
    }
  }

  // Set of flat stat keys that can be derived from % counterparts
  const flatStatKeys = new Set(flatPairs.map(([, flat]) => flat));

  // Build sortedSubstats for each entry (bucketed for display, ≥50 only).
  // Exclude flat stats whose weight was derived from their % counterpart
  // (they still participate in scoring but don't need a separate display pill).
  for (const eb of map.values()) {
    eb.sortedSubstats = Object.entries(eb.weights)
      .filter(([stat]) => {
        if (!flatStatKeys.has(stat)) return true;
        // Hide flat stat if its % counterpart has equal or higher weight
        const pctW = eb.weights[`${stat}%` as SubStat] ?? 0;
        return pctW < (eb.weights[stat as SubStat] ?? 0);
      })
      .map(([stat, w]) => ({
        stat: stat as SubStat,
        weight: bucketWeight(w),
      }))
      .filter((s) => s.weight > 0)
      .sort((a, b) => b.weight - a.weight || a.stat.localeCompare(b.stat));
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// 2. Gather all artifacts from account
// ---------------------------------------------------------------------------

function getAllArtifacts(accountData: AccountData): ArtifactData[] {
  const artifacts: ArtifactData[] = [];

  for (const char of accountData.characters) {
    for (const slot of allSlots) {
      const art = char.artifacts[slot];
      if (art) artifacts.push(art);
    }
  }

  for (const art of accountData.extraArtifacts) {
    artifacts.push(art);
  }

  return artifacts;
}

// ---------------------------------------------------------------------------
// 3. Find best artifact for a slot
// ---------------------------------------------------------------------------

function matchesMainStat(
  artifact: ArtifactData,
  slot: Slot,
  evalBuild: EvalBuild
): boolean {
  if (slot === "flower") return artifact.mainStatKey === "hp";
  if (slot === "plume") return artifact.mainStatKey === "atk";

  const recommended =
    evalBuild.mainStats[slot as "sands" | "goblet" | "circlet"];
  if (!recommended || recommended.length === 0) return true;
  return recommended.includes(artifact.mainStatKey);
}

function findBestArtifact(
  candidates: ArtifactData[],
  slot: Slot,
  evalBuild: EvalBuild,
  globalConfig: GlobalStatWeights,
  requireSets?: string | string[]
): { artifact: ArtifactData; score: number } | null {
  let best: { artifact: ArtifactData; score: number } | null = null;

  const setFilter = requireSets
    ? typeof requireSets === "string"
      ? new Set([requireSets])
      : new Set(requireSets)
    : null;

  for (const art of candidates) {
    if (art.slotKey !== slot) continue;
    if (art.rarity < 4) continue;
    if (setFilter && !setFilter.has(art.setKey)) continue;
    if (!matchesMainStat(art, slot, evalBuild)) continue;

    const score = scoreSlot(art, evalBuild.weights, globalConfig);
    if (!best || score > best.score) {
      best = { artifact: art, score };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// 4. Evaluate a single build (generalized for variable flex count)
// ---------------------------------------------------------------------------

/** Generate all combinations of choosing k items from arr (indices). */
function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];

  function recurse(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      recurse(i + 1);
      combo.pop();
    }
  }

  recurse(0);
  return result;
}

function evaluateBuild(
  evalBuild: EvalBuild,
  allArtifacts: ArtifactData[],
  globalConfig: GlobalStatWeights
): BuildEvaluation {
  // Pre-compute best on-set and best any-set artifact per slot
  const onSet: Record<Slot, { artifact: ArtifactData; score: number } | null> =
    {} as Record<Slot, { artifact: ArtifactData; score: number } | null>;
  const anySet: Record<Slot, { artifact: ArtifactData; score: number } | null> =
    {} as Record<Slot, { artifact: ArtifactData; score: number } | null>;

  for (const slot of allSlots) {
    onSet[slot] = findBestArtifact(
      allArtifacts,
      slot,
      evalBuild,
      globalConfig,
      evalBuild.artifactSet
    );
    anySet[slot] = findBestArtifact(
      allArtifacts,
      slot,
      evalBuild,
      globalConfig
    );
  }

  // Try all combinations of flex slots
  const flexCombos = combinations(5, evalBuild.flexCount);

  let bestTotalScore = -1;
  let bestSlots: Record<Slot, SlotEvaluation> = {} as Record<
    Slot,
    SlotEvaluation
  >;

  for (const flexIndices of flexCombos) {
    const flexSet = new Set(flexIndices);
    let totalScore = 0;
    const arrangement: Record<Slot, SlotEvaluation> = {} as Record<
      Slot,
      SlotEvaluation
    >;

    for (let i = 0; i < allSlots.length; i++) {
      const slot = allSlots[i];
      const isFlex = flexSet.has(i);

      // Flex slots: use best from any set; on-set slots: use best on-set
      // For flex: prefer any-set (which includes on-set), fall back to on-set
      const candidate = isFlex
        ? (anySet[slot] ?? onSet[slot])
        : (onSet[slot] ?? null);

      const rarity = candidate?.artifact.rarity ?? 5;
      const mainStat = candidate?.artifact.mainStatKey ?? "hp";
      const subMax = calculateMaxSlotSubScore(
        mainStat,
        evalBuild.weights,
        rarity
      );

      // For sands/goblet/circlet, main stat participates in scoring via scoreMainStat.
      // This ensures builds with few weighted substats still show meaningful progress
      // when they have the correct main stat equipped.
      const isVariableMainStat =
        slot === "sands" || slot === "goblet" || slot === "circlet";
      const idealMainStat = getIdealMainStat(slot, evalBuild);
      const mainStatMax = isVariableMainStat
        ? scoreMainStat(idealMainStat, rarity, globalConfig)
        : 0;
      const mainStatActual =
        isVariableMainStat && candidate
          ? scoreMainStat(mainStat, rarity, globalConfig)
          : 0;

      arrangement[slot] = {
        artifact: candidate?.artifact ?? null,
        score: (candidate?.score ?? 0) + mainStatActual,
        maxScore: subMax + mainStatMax,
        isFlexSlot: isFlex,
      };
      totalScore += (candidate?.score ?? 0) + mainStatActual;
    }

    if (totalScore > bestTotalScore) {
      bestTotalScore = totalScore;
      bestSlots = arrangement;
    }
  }

  // Theoretical max: sum each slot's maxScore (already includes main stat bonus for variable slots)
  let adjustedMaxScore = 0;
  for (const slot of allSlots) {
    if (bestSlots[slot].artifact) {
      adjustedMaxScore += bestSlots[slot].maxScore;
    } else {
      const idealMainStat = getIdealMainStat(slot, evalBuild);
      const isVariableMainStat =
        slot === "sands" || slot === "goblet" || slot === "circlet";
      adjustedMaxScore +=
        calculateMaxSlotSubScore(idealMainStat, evalBuild.weights, 5) +
        (isVariableMainStat
          ? scoreMainStat(idealMainStat, 5, globalConfig)
          : 0);
    }
  }

  const completeness =
    adjustedMaxScore > 0 ? bestTotalScore / adjustedMaxScore : 0;

  return {
    evalBuild,
    slots: bestSlots,
    totalScore: bestTotalScore,
    totalMaxScore: adjustedMaxScore,
    completeness,
  };
}

/**
 * Evaluate a 2+2 build: 2 slots from half-set 1 + 2 from half-set 2 + 1 flex.
 *
 * Both pieces assigned to a half must come from the **same** specific set
 * (e.g. both Gladiator, not one Gladiator + one Shimenawa) for the 2pc bonus.
 *
 * Search space: C(5,2) × C(3,2) × |hs1Sets| × |hs2Sets| slot/set combos.
 */
function evaluateBuild2p2(
  evalBuild: EvalBuild,
  allArtifacts: ArtifactData[],
  globalConfig: GlobalStatWeights
): BuildEvaluation {
  const hs1Sets = evalBuild.halfSet1SetIds!;
  const hs2Sets = evalBuild.halfSet2SetIds!;

  // Pre-compute best artifact per slot for each specific set ID
  type BestEntry = { artifact: ArtifactData; score: number } | null;
  type BestMap = Record<Slot, BestEntry>;

  const uniqueSetIds = new Set([...hs1Sets, ...hs2Sets]);
  const bestBySet = new Map<string, BestMap>();
  for (const setId of uniqueSetIds) {
    const map = {} as BestMap;
    for (const slot of allSlots) {
      map[slot] = findBestArtifact(
        allArtifacts,
        slot,
        evalBuild,
        globalConfig,
        setId
      );
    }
    bestBySet.set(setId, map);
  }

  const bestAny: BestMap = {} as BestMap;
  for (const slot of allSlots) {
    bestAny[slot] = findBestArtifact(
      allArtifacts,
      slot,
      evalBuild,
      globalConfig
    );
  }

  // Check if both halves share the same half-set group — if so, the two
  // concrete sets must differ (can't use the same set for both halves).
  const sameHalfGroup =
    hs1Sets.length > 0 &&
    hs2Sets.length > 0 &&
    hs1Sets.some((id) => hs2Sets.includes(id));

  const hs1Combos = combinations(5, 2); // C(5,2) = 10

  let bestTotalScore = -1;
  let bestSlots: Record<Slot, SlotEvaluation> = {} as Record<
    Slot,
    SlotEvaluation
  >;

  for (const hs1Indices of hs1Combos) {
    const hs1IdxSet = new Set(hs1Indices);
    const remaining = [0, 1, 2, 3, 4].filter((i) => !hs1IdxSet.has(i));

    const hs2Combos = combinations(remaining.length, 2); // C(3,2) = 3
    for (const hs2OfRemaining of hs2Combos) {
      const hs2IdxSet = new Set(hs2OfRemaining.map((i) => remaining[i]));

      // Try each concrete set for each half
      for (const set1 of hs1Sets) {
        const bestSet1 = bestBySet.get(set1)!;
        for (const set2 of hs2Sets) {
          // When both halves are from the same half-set group, the two
          // concrete sets must be different to form a valid 2+2.
          if (sameHalfGroup && set1 === set2) continue;

          const bestSet2 = bestBySet.get(set2)!;

          let totalScore = 0;
          const arrangement = {} as Record<Slot, SlotEvaluation>;

          for (let i = 0; i < allSlots.length; i++) {
            const slot = allSlots[i];
            let candidate: BestEntry;
            let isFlex: boolean;

            if (hs1IdxSet.has(i)) {
              candidate = bestSet1[slot];
              isFlex = false;
            } else if (hs2IdxSet.has(i)) {
              candidate = bestSet2[slot];
              isFlex = false;
            } else {
              candidate = bestAny[slot];
              isFlex = true;
            }

            const rarity = candidate?.artifact.rarity ?? 5;
            const mainStat = candidate?.artifact.mainStatKey ?? "hp";
            const subMax = calculateMaxSlotSubScore(
              mainStat,
              evalBuild.weights,
              rarity
            );

            const isVariableMainStat =
              slot === "sands" || slot === "goblet" || slot === "circlet";
            const idealMainStat = getIdealMainStat(slot, evalBuild);
            const mainStatMax = isVariableMainStat
              ? scoreMainStat(idealMainStat, rarity, globalConfig)
              : 0;
            const mainStatActual =
              isVariableMainStat && candidate
                ? scoreMainStat(mainStat, rarity, globalConfig)
                : 0;

            arrangement[slot] = {
              artifact: candidate?.artifact ?? null,
              score: (candidate?.score ?? 0) + mainStatActual,
              maxScore: subMax + mainStatMax,
              isFlexSlot: isFlex,
            };
            totalScore += (candidate?.score ?? 0) + mainStatActual;
          }

          if (totalScore > bestTotalScore) {
            bestTotalScore = totalScore;
            bestSlots = arrangement;
          }
        }
      }
    }
  }

  // Theoretical max
  let adjustedMaxScore = 0;
  for (const slot of allSlots) {
    if (bestSlots[slot].artifact) {
      adjustedMaxScore += bestSlots[slot].maxScore;
    } else {
      const idealMainStat = getIdealMainStat(slot, evalBuild);
      const isVariableMainStat =
        slot === "sands" || slot === "goblet" || slot === "circlet";
      adjustedMaxScore +=
        calculateMaxSlotSubScore(idealMainStat, evalBuild.weights, 5) +
        (isVariableMainStat
          ? scoreMainStat(idealMainStat, 5, globalConfig)
          : 0);
    }
  }

  const completeness =
    adjustedMaxScore > 0 ? bestTotalScore / adjustedMaxScore : 0;

  return {
    evalBuild,
    slots: bestSlots,
    totalScore: bestTotalScore,
    totalMaxScore: adjustedMaxScore,
    completeness,
  };
}

function getIdealMainStat(slot: Slot, evalBuild: EvalBuild): MainStat {
  if (slot === "flower") return "hp";
  if (slot === "plume") return "atk";

  const recommended =
    evalBuild.mainStats[slot as "sands" | "goblet" | "circlet"];
  if (recommended && recommended.length > 0) return recommended[0];
  return slot === "circlet" ? "cr" : "atk%";
}

// ---------------------------------------------------------------------------
// 5. Evaluate all builds, grouped by artifact set
// ---------------------------------------------------------------------------

export function evaluateAllBuilds(
  buildGroups: BuildGroup[],
  accountData: AccountData,
  globalConfig: GlobalStatWeights,
  include2pc: boolean
): SetGroup[] {
  const evalBuilds = collectEvalBuilds(buildGroups, include2pc);
  const allArtifacts = getAllArtifacts(accountData);

  const evaluations = evalBuilds.map((eb) =>
    eb.composition === "2+2"
      ? evaluateBuild2p2(eb, allArtifacts, globalConfig)
      : evaluateBuild(eb, allArtifacts, globalConfig)
  );

  // Group by artifact set
  const groupMap = new Map<string, BuildEvaluation[]>();
  for (const ev of evaluations) {
    const setId = ev.evalBuild.artifactSet;
    const arr = groupMap.get(setId);
    if (arr) {
      arr.push(ev);
    } else {
      groupMap.set(setId, [ev]);
    }
  }

  // Build SetGroups, sort variants within each group by completeness asc
  const groups: SetGroup[] = [];
  for (const [artifactSet, evals] of groupMap) {
    evals.sort((a, b) => a.completeness - b.completeness);
    const worstCompleteness = evals.length > 0 ? evals[0].completeness : 0;
    groups.push({ artifactSet, evaluations: evals, worstCompleteness });
  }

  // Sort groups by worst completeness ascending (most needy sets first)
  groups.sort((a, b) => a.worstCompleteness - b.worstCompleteness);

  return groups;
}

// ---------------------------------------------------------------------------
// 6. Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Unified completion tier system
// ---------------------------------------------------------------------------

export type CompletionTier = (typeof COMPLETION_TIERS)[number];

export const COMPLETION_TIERS = [
  {
    id: "90",
    min: 0.9,
    label: "90%+",
    text: "text-emerald-500",
    bg: "bg-emerald-500",
    pillBg: "bg-emerald-500/15 text-emerald-500",
  },
  {
    id: "80",
    min: 0.8,
    label: "80%+",
    text: "text-lime-400",
    bg: "bg-lime-400",
    pillBg: "bg-lime-400/15 text-lime-400",
  },
  {
    id: "70",
    min: 0.7,
    label: "70%+",
    text: "text-yellow-400",
    bg: "bg-yellow-400",
    pillBg: "bg-yellow-400/15 text-yellow-400",
  },
  {
    id: "60",
    min: 0.6,
    label: "60%+",
    text: "text-orange-400",
    bg: "bg-orange-400",
    pillBg: "bg-orange-400/15 text-orange-400",
  },
  {
    id: "0",
    min: 0,
    label: "<60%",
    text: "text-red-400",
    bg: "bg-red-400",
    pillBg: "bg-red-400/15 text-red-400",
  },
] as const;

/** Get the tier for a completeness value (0–1). */
export function getTier(completeness: number): CompletionTier {
  for (const tier of COMPLETION_TIERS) {
    if (completeness >= tier.min) return tier;
  }
  return COMPLETION_TIERS[COMPLETION_TIERS.length - 1];
}

/** Get the progress-bar bg class for a completeness value. */
export function getBarColor(completeness: number): string {
  return getTier(completeness).bg;
}

// Keep legacy exports for any remaining references
export function getGrade(completeness: number): string {
  return getTier(completeness).label;
}
export function getGradeColor(_grade: string): string {
  // Not used anymore — kept for compatibility
  return "text-muted-foreground";
}

/** Map ScalingStat to the stat key used by t.statShort(). */
const scalingStatDisplayKey: Record<ScalingStat, string> = {
  atk: "atk",
  hp: "hp",
  def: "def",
  em: "em",
};

/**
 * Build a translated archetype label.
 * - 4pc:  "HP · Support" / "生命 · 辅助"
 * - 2+2:  "HP+ATK · Support" / "生命+攻击 · 辅助"
 */
export function getArchetypeLabel(
  evalBuild: EvalBuild,
  t: {
    statShort: (key: string) => string;
    role: (key: string) => string;
    halfSetShort: (key: string) => string;
  }
): string {
  const roleLabel = t.role(evalBuild.archetypeRole);

  if (
    evalBuild.composition === "2+2" &&
    evalBuild.halfSet1Id &&
    evalBuild.halfSet2Id
  ) {
    const hs1Label = t.halfSetShort(evalBuild.halfSet1Id);
    const hs2Label = t.halfSetShort(evalBuild.halfSet2Id);
    return `${hs1Label}+${hs2Label} · ${roleLabel}`;
  }

  const statLabel = t.statShort(scalingStatDisplayKey[evalBuild.scalingStat]);
  return `${statLabel} · ${roleLabel}`;
}
