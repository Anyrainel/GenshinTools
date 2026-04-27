import { TRIAGE_SUPPORT_ARTIFACT_SETS } from "@/data/constants";
import type { MainStat, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { AccountData, ArtifactData, Build } from "@/data/types";
import { getAllSubstats } from "@/lib/account-data/artifactProjection";
import { getSubstatAvgRoll } from "@/lib/artifact/scoring/utils";
import { runConcentrationValueRules } from "./concentrationValue";
import { getEligibleSetsForHalfSet } from "./demandExtractor";
import { buildCustomFlexPattern, buildFlexPatterns } from "./flexRegistry";
import { startedWithFourSubstats } from "./initialSubstats";
import { extractRules } from "./ruleBuilder";
import { evaluateTier, type TierResult } from "./tierEvaluator";
import type {
  DemandSource,
  EmbryoMatch,
  EmbryoResult,
  FlexPattern,
  QualityTier,
  SupplyDemandInfo,
  TriageDecision,
  TriageLabel,
  TriageRule,
  TriageRuleId,
  TriageSettings,
  TriageSpecialRule,
} from "./types";
import { QUALITY_TIER_RANK, QUALITY_TIERS } from "./types";

// Embryo key

function makeEmbryoKey(
  source: DemandSource,
  slot: string,
  mainStat: MainStat,
  desired: SubStat[]
): string {
  const subs = desired.join(",");
  if (source.type === "4pc")
    return `4pc:${source.setKey}:${slot}:${mainStat}:${subs}`;
  if (source.type === "2pc")
    return `2pc:${source.halfSetId}:${slot}:${mainStat}:${subs}`;
  return `flex:${slot}:${mainStat}:${subs}`;
}

// Set matching

function matchesSet(rule: TriageRule, setKey: string): boolean {
  const src = rule.demandSource;
  if (src.type === "4pc") return src.setKey === setKey;
  if (src.type === "2pc")
    return getEligibleSetsForHalfSet(src.halfSetId).includes(setKey);
  return true; // flex matches any set
}

// Triage Pipeline

export function runTriage(
  accountData: AccountData,
  buildGroups: { characterId: string; builds: Build[] }[],
  settings: TriageSettings
): { decisions: TriageDecision[]; flexPatterns: FlexPattern[] } {
  // 1. Extract rules
  const rules = extractRules(buildGroups, accountData, settings);

  // 2. Build flex patterns (official + custom)
  const officialFlex = buildFlexPatterns(rules);
  const customFlex = (settings.customFlexInputs ?? [])
    .map(buildCustomFlexPattern)
    .filter(
      (flexPattern): flexPattern is FlexPattern =>
        flexPattern !== null &&
        !officialFlex.some(
          (officialPattern) => officialPattern.key === flexPattern.key
        )
    );
  const allFlex = [...officialFlex, ...customFlex];
  const enabledFlex = allFlex.filter((flexPattern) =>
    flexPattern.defaultOff
      ? settings.enabledFlexPatterns.includes(flexPattern.key)
      : !settings.disabledFlexPatterns.includes(flexPattern.key)
  );

  // 3. Count demand per embryoKey (unique characters)
  const demandCounts = new Map<string, Set<string>>();
  for (const rule of rules) {
    const key = makeEmbryoKey(
      rule.demandSource,
      rule.slot,
      rule.mainStat,
      rule.desired
    );
    if (!demandCounts.has(key)) demandCounts.set(key, new Set());
    demandCounts.get(key)!.add(rule.characterId);
  }

  // Collect all artifacts
  const allArtifacts: { artifact: ArtifactData; equippedOn: string | null }[] =
    [];
  for (const char of accountData.characters) {
    for (const slot of allSlots) {
      const art = char.artifacts[slot];
      if (art) allArtifacts.push({ artifact: art, equippedOn: char.key });
    }
  }
  for (const art of accountData.extraArtifacts) {
    allArtifacts.push({ artifact: art, equippedOn: null });
  }

  // TODO: support 4-star artifacts (different thresholds needed)
  const fiveStarArtifacts = allArtifacts.filter(
    (artifactEntry) => artifactEntry.artifact.rarity === 5
  );

  // Phase 1: Evaluate each artifact
  type PrelimResult = {
    artifact: ArtifactData;
    equippedOn: string | null;
    embryoResults: EmbryoResult[];
    evaluations: CandidateEvaluation[];
    specialRules: TriageSpecialRule[];
    bestLabel: TriageLabel;
    bestResult: EmbryoResult | null;
    bestTier: QualityTier;
    bestTierResult: TierResult | null;
    embryoKey: string | null;
    supplyDemand: SupplyDemandInfo | null;
  };

  type CandidateEvaluation = {
    result: EmbryoResult;
    tierResult: TierResult;
    embryoKey: string;
    tier: QualityTier;
    rarity: number;
  };

  type RankedEdge = CandidateEvaluation & {
    prelim: PrelimResult;
  };

  const prelims: PrelimResult[] = [];

  for (const { artifact, equippedOn } of fiveStarArtifacts) {
    const specialRules: TriageSpecialRule[] = [];
    const substats = getAllSubstats(artifact);
    const hasFourInitialSubstats = startedWithFourSubstats(artifact);

    // --- Pre-checks ---
    // ER hoarding (support sets only)
    if (
      settings.erHoardingEnabled &&
      hasFourInitialSubstats &&
      substats.includes("er") &&
      TRIAGE_SUPPORT_ARTIFACT_SETS.has(artifact.setKey)
    ) {
      const anyRuleNeedsER = rules.some(
        (rule) => rule.desired.includes("er") && rule.slot === artifact.slotKey
      );
      if (anyRuleNeedsER) {
        specialRules.push("supportSetErHoard");
      }
    }

    // ER hoarding (all sets, not just support — off by default)
    if (
      settings.erHoardingAllEnabled &&
      !specialRules.includes("supportSetErHoard") &&
      hasFourInitialSubstats &&
      substats.includes("er")
    ) {
      const anyRuleNeedsER = rules.some(
        (rule) => rule.desired.includes("er") && rule.slot === artifact.slotKey
      );
      if (anyRuleNeedsER) {
        specialRules.push("allSetErHoard");
      }
    }

    // Double crit lock — tag only, normal evaluation continues
    if (
      settings.doubleCritLockEnabled &&
      hasFourInitialSubstats &&
      substats.includes("cr") &&
      substats.includes("cd")
    ) {
      const hasMatch = rules.some(
        (rule) =>
          rule.slot === artifact.slotKey &&
          rule.mainStat === artifact.mainStatKey &&
          matchesSet(rule, artifact.setKey)
      );
      if (hasMatch) {
        specialRules.push("doubleCrit");
      }
    }

    // --- Classify & evaluate against rules ---
    // Sort matched rules deterministically by embryo key so an artifact's
    // assigned group is stable across runs regardless of build/rule ordering.
    const matchedRules = rules
      .filter(
        (rule) =>
          rule.slot === artifact.slotKey &&
          rule.mainStat === artifact.mainStatKey &&
          matchesSet(rule, artifact.setKey)
      )
      .sort((a, b) => {
        const ka = makeEmbryoKey(a.demandSource, a.slot, a.mainStat, a.desired);
        const kb = makeEmbryoKey(b.demandSource, b.slot, b.mainStat, b.desired);
        return ka.localeCompare(kb);
      });

    let bestTier: QualityTier = "fodder";
    let bestTierResult: TierResult | null = null;
    const embryoResults: EmbryoResult[] = [];
    const evaluations: CandidateEvaluation[] = [];

    for (const rule of matchedRules) {
      const tierResult = evaluateTier(substats, hasFourInitialSubstats, rule);
      const embryoKey = makeEmbryoKey(
        rule.demandSource,
        rule.slot,
        rule.mainStat,
        rule.desired
      );

      const embryoMatch: EmbryoMatch = {
        demand: {
          buildId: rule.buildId,
          characterId: rule.characterId,
          demandSource: rule.demandSource,
          slot: rule.slot,
          acceptedMainStats: [rule.mainStat],
          coreStats: rule.desired,
          valuableStats: rule.optional,
        },
        grade: {
          coreCount: tierResult.hitCount,
          valuableCount: tierResult.hitOptional,
          minorCount: 0,
          unwantedCount:
            substats.length -
            tierResult.hitCount -
            tierResult.hitOptional -
            (tierResult.hasFill ? 1 : 0),
          totalCount: substats.length,
          initial4Line: hasFourInitialSubstats,
        },
        embryoKey,
      };

      const ruleId = tierToRuleId(tierResult.tier);
      const embryoResult: EmbryoResult = {
        embryo: embryoMatch,
        label: tierToLabel(tierResult.tier),
        ruleId,
        reason: "",
        reasonArgs: tierReasonArgs(tierResult),
        tier: tierResult.tier,
      };
      embryoResults.push(embryoResult);
      evaluations.push({
        result: embryoResult,
        tierResult,
        embryoKey,
        tier: tierResult.tier,
        rarity: tierResult.matchedCondition?.rarity ?? Number.POSITIVE_INFINITY,
      });

      if (tierRank(tierResult.tier) < tierRank(bestTier)) {
        bestTier = tierResult.tier;
        bestTierResult = tierResult;
      }
    }

    // Flex check: tag only, does not change tier
    for (const flexPattern of enabledFlex) {
      if (flexPattern.slot !== artifact.slotKey) continue;
      if (flexPattern.mainStat !== artifact.mainStatKey) continue;
      if (!flexPattern.requiredSubs.every((stat) => substats.includes(stat)))
        continue;

      specialRules.push("offPiecePattern");
      break;
    }

    // Sort embryo results best-first; tiebreak by embryoKey so the
    // chosen group is deterministic.
    embryoResults.sort(
      (a, b) =>
        tierRank(a.tier ?? "fodder") - tierRank(b.tier ?? "fodder") ||
        (a.embryo.embryoKey ?? "").localeCompare(b.embryo.embryoKey ?? "")
    );

    const bestEmbryoResult = embryoResults[0] ?? null;
    const bestEmbryoKey = bestEmbryoResult?.embryo.embryoKey ?? null;

    if (embryoResults.length === 0) {
      prelims.push({
        artifact,
        equippedOn,
        embryoResults,
        evaluations,
        specialRules,
        bestLabel: "unlock",
        bestResult: {
          embryo: null as never,
          label: "unlock",
          ruleId: "noDemand",
          reason: "",
          reasonArgs: [],
          tier: "fodder",
        },
        bestTier: "fodder",
        bestTierResult: null,
        embryoKey: null,
        supplyDemand: null, // filled below in no-demand supply pass
      });
    } else {
      prelims.push({
        artifact,
        equippedOn,
        embryoResults,
        evaluations,
        specialRules,
        bestLabel: tierToLabel(bestTier),
        bestResult: bestEmbryoResult
          ? {
              ...bestEmbryoResult,
              label: tierToLabel(bestTier),
              tier: bestTier,
            }
          : null,
        bestTier,
        bestTierResult,
        embryoKey: bestEmbryoKey,
        supplyDemand: null,
      });
    }
  }

  // --- Supply/demand resolution ---
  //
  // Keep a stable artifact→embryo edge ordering independent of the current
  // strict/loose thresholds. Thresholds only decide which edges are eligible;
  // they do not change the rank key. This makes looser thresholds append
  // lower-ranked candidates instead of reshuffling already-kept artifacts.
  const allEdges: RankedEdge[] = [];
  for (const prelim of prelims) {
    for (const evaluation of prelim.evaluations) {
      if ((demandCounts.get(evaluation.embryoKey)?.size ?? 0) === 0) continue;
      allEdges.push({ ...evaluation, prelim });
    }
  }
  allEdges.sort(compareRankedEdges);

  const supplyDemandByEdge = buildSupplyDemandByEdge(allEdges, demandCounts);
  const bestEdgeByPrelim = new Map<PrelimResult, RankedEdge>();
  for (const edge of allEdges) {
    if (!bestEdgeByPrelim.has(edge.prelim)) {
      bestEdgeByPrelim.set(edge.prelim, edge);
    }
  }
  const allocated = new Set<PrelimResult>();
  const usedCapacity = new Map<string, number>();
  const usedFillerCapacity = new Map<string, number>();

  const allocate = (edge: RankedEdge, ruleId: TriageRuleId) => {
    allocated.add(edge.prelim);
    edge.prelim.bestLabel = "lock";
    edge.prelim.bestResult = {
      ...edge.result,
      label: "lock",
      ruleId,
      tier: edge.tier,
    };
    edge.prelim.bestTier = edge.tier;
    edge.prelim.bestTierResult = edge.tierResult;
    edge.prelim.embryoKey = edge.embryoKey;
    edge.prelim.supplyDemand = supplyDemandByEdge.get(edge) ?? null;
  };

  // Prime, and optionally solid, are hard keeps. They do not consume the
  // demand+margin backup capacity, so loosening thresholds can only add locks.
  for (const edge of allEdges) {
    if (allocated.has(edge.prelim)) continue;
    if (edge.tier === "prime") {
      allocate(edge, "primeTierKeep");
    } else if (settings.alwaysLockSolidArtifacts && edge.tier === "solid") {
      allocate(edge, "solidTierKeep");
    }
  }

  // Capacity-limited keeps for remaining solid/filler edges. Capacity is fixed
  // per embryo key, independent of threshold-dependent tier counts.
  for (const edge of allEdges) {
    if (allocated.has(edge.prelim)) continue;
    if (edge.tier !== "solid" && edge.tier !== "filler") continue;

    const demand = demandCounts.get(edge.embryoKey)?.size ?? 0;
    const capacity = demand + settings.qualityMargin;
    const used = usedCapacity.get(edge.embryoKey) ?? 0;
    if (used >= capacity) continue;

    if (edge.tier === "filler") {
      const usedFiller = usedFillerCapacity.get(edge.embryoKey) ?? 0;
      if (usedFiller >= settings.fillerKeep) continue;
      usedFillerCapacity.set(edge.embryoKey, usedFiller + 1);
    }

    usedCapacity.set(edge.embryoKey, used + 1);
    allocate(
      edge,
      edge.tier === "solid" ? "solidTierKeep" : "fillerShortfallKeep"
    );
  }

  for (const prelim of prelims) {
    if (allocated.has(prelim)) continue;
    const bestEdge = bestEdgeByPrelim.get(prelim);
    if (bestEdge) {
      const ruleId =
        bestEdge.tier === "solid"
          ? "solidOversupplyUnlock"
          : bestEdge.tier === "filler"
            ? "fillerDefaultUnlock"
            : "fodderSubstatMismatch";
      prelim.bestLabel = "unlock";
      prelim.bestResult = {
        ...bestEdge.result,
        label: "unlock",
        ruleId,
        tier: bestEdge.tier,
      };
      prelim.bestTier = bestEdge.tier;
      prelim.bestTierResult = bestEdge.tierResult;
      prelim.embryoKey = bestEdge.embryoKey;
      prelim.supplyDemand = supplyDemandByEdge.get(bestEdge) ?? null;
    }
  }

  // --- No-demand supply count ---
  // Group no-demand artifacts by set+slot+mainStat so the UI can show fodder total.
  const noDemandGroups = new Map<string, PrelimResult[]>();
  for (const prelim of prelims) {
    if (prelim.embryoKey !== null) continue; // has demand, already resolved
    const key = `${prelim.artifact.setKey}:${prelim.artifact.slotKey}:${prelim.artifact.mainStatKey}`;
    if (!noDemandGroups.has(key)) noDemandGroups.set(key, []);
    noDemandGroups.get(key)!.push(prelim);
  }
  for (const group of noDemandGroups.values()) {
    for (const prelim of group) {
      prelim.supplyDemand = {
        demand: 0,
        supplyByTier: { prime: 0, solid: 0, filler: 0, fodder: group.length },
        rankInTier: 0,
        tierTotal: group.length,
      };
    }
  }

  // --- Special-rule lock promotion ---
  // These force lock without changing the tier determined by 4pc/2pc evaluation.
  for (const prelim of prelims) {
    if (prelim.bestLabel === "lock") continue;
    const specialRuleIds = prelim.specialRules;
    if (
      specialRuleIds.includes("supportSetErHoard") ||
      specialRuleIds.includes("allSetErHoard") ||
      specialRuleIds.includes("doubleCrit") ||
      specialRuleIds.includes("offPiecePattern")
    ) {
      const ruleId = specialRuleIds.includes("supportSetErHoard")
        ? "supportSetErHoard"
        : specialRuleIds.includes("allSetErHoard")
          ? "allSetErHoard"
          : specialRuleIds.includes("doubleCrit")
            ? "doubleCrit"
            : "offPiecePattern";
      setLabel(prelim, "lock", ruleId);
    }
  }

  // --- Set+slot minimum keep ---
  // Runs after special-rule promotions so off-piece/special locked artifacts are counted.
  //
  // Stability: when we need to fill the floor, prefer artifacts that are
  // already externally locked. Otherwise, rerunning triage right after
  // applying a previous "lock these" recommendation would leave those
  // externally-locked items with bestLabel="unlock" (because tier
  // classification doesn't know about artifact.lock), producing a spurious
  // "unlock these" recommendation AND a fresh "lock these" pick for the
  // same floor.
  if (settings.setSlotKeep > 0) {
    const setSlotGroups = new Map<string, PrelimResult[]>();
    for (const p of prelims) {
      const key = `${p.artifact.setKey}:${p.artifact.slotKey}`;
      if (!setSlotGroups.has(key)) setSlotGroups.set(key, []);
      setSlotGroups.get(key)!.push(p);
    }
    for (const group of setSlotGroups.values()) {
      const targetKeepCount = Math.min(settings.setSlotKeep, group.length);
      const algorithmLockedCount = group.filter(
        (prelim) => prelim.bestLabel === "lock"
      ).length;
      const neededKeepCount = targetKeepCount - algorithmLockedCount;
      if (neededKeepCount <= 0) continue;

      // Candidates: anything not already locked by the algorithm. Sort
      // externally-locked first (for stability), then by tier/intrinsics.
      const candidates = group
        .filter((prelim) => prelim.bestLabel !== "lock")
        .sort(
          (a, b) =>
            (b.artifact.lock ? 1 : 0) - (a.artifact.lock ? 1 : 0) ||
            tierRank(a.bestTier) - tierRank(b.bestTier) ||
            setSlotFloorTiebreaker(a) - setSlotFloorTiebreaker(b) ||
            rollCount(b.artifact) - rollCount(a.artifact) ||
            b.artifact.level - a.artifact.level
        );

      for (let i = 0; i < Math.min(neededKeepCount, candidates.length); i++) {
        setLabel(candidates[i], "lock", "setSlotFloorKeep");
        candidates[i].specialRules.push("setSlotFloor");
      }
    }
  }

  // Post-checks: level/equipped protection — tag only, no label change.
  // These are "protected" artifacts handled by the UI (shown in protected zone).
  //
  // High-level handling: when highLevelProtection is enabled, high-level
  // artifacts are auto-protected. When disabled, they flow through the normal
  // recommendation buckets, and any still marked "unlock" are run through the
  // concentration-value rules.
  for (const prelim of prelims) {
    const isHighLevel =
      settings.levelProtection > 0 &&
      prelim.artifact.level >= settings.levelProtection;

    if (isHighLevel) {
      if (settings.highLevelProtection) {
        prelim.specialRules.push("levelProtected");
      } else if (prelim.bestLabel === "unlock") {
        const result = runConcentrationValueRules(prelim.artifact);
        if (result.kept) {
          setLabel(prelim, "lock", "concentrationValue");
          if (tierRank(prelim.bestTier) > tierRank("solid")) {
            prelim.bestTier = "solid";
            if (prelim.bestResult) {
              prelim.bestResult = { ...prelim.bestResult, tier: "solid" };
            }
          }
          prelim.specialRules.push(`concentrationValue:${result.reason}`);
        }
      }
    }

    if (settings.equippedProtection && prelim.equippedOn) {
      prelim.specialRules.push("equippedProtected");
    }
  }

  // Build final decisions
  return {
    decisions: prelims.map((p) => ({
      artifact: p.artifact,
      label: p.bestLabel,
      decidingResult: p.bestResult,
      allResults: p.embryoResults,
      specialRules: p.specialRules,
      supplyDemand: p.supplyDemand,
    })),
    flexPatterns: allFlex,
  };
}

// Helpers

function tierRank(t: QualityTier): number {
  return QUALITY_TIER_RANK[t];
}

const ELEMENTAL_MAINS = new Set<string>([
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
]);

/**
 * Intrinsic roll-count tiebreaker: sum of each substat's value normalized
 * by its average roll. Higher = more "roll mass" on the artifact. Used as
 * a deterministic fine-grained tiebreaker between otherwise tied artifacts.
 */
function rollCount(a: ArtifactData): number {
  const rarity = a.rarity === 4 ? 4 : 5;
  let total = 0;
  for (const [stat, val] of Object.entries(a.substats ?? {})) {
    if (typeof val !== "number") continue;
    const avg = getSubstatAvgRoll(stat as SubStat, rarity);
    if (avg > 0) total += val / avg;
  }
  return total;
}

/**
 * Roll-count restricted to the given substats. Used to tie-break artifacts
 * whose matched tier condition has the same rarity: the one with more "roll
 * mass" on the demanded substats (core + optional) is preferred.
 */
function rollCountOn(a: ArtifactData, stats: SubStat[]): number {
  const rarity = a.rarity === 4 ? 4 : 5;
  let total = 0;
  for (const stat of stats) {
    const val = a.substats?.[stat];
    if (typeof val !== "number") continue;
    const avg = getSubstatAvgRoll(stat, rarity);
    if (avg > 0) total += val / avg;
  }
  return total;
}

type RankedTriageEdge = {
  prelim: { artifact: ArtifactData };
  result: EmbryoResult;
  embryoKey: string;
  tier: QualityTier;
  rarity: number;
};

/**
 * Stable cross-threshold edge rank. Rarity is raw end-to-end probability, not
 * the current threshold bucket, so changing strict/loose thresholds only
 * admits later edges and does not reorder already-eligible candidates.
 */
function compareRankedEdges(a: RankedTriageEdge, b: RankedTriageEdge): number {
  if (a.rarity !== b.rarity) return a.rarity - b.rarity;

  const demA = a.result.embryo?.demand;
  const demB = b.result.embryo?.demand;
  const subsA = demA ? [...demA.coreStats, ...demA.valuableStats] : [];
  const subsB = demB ? [...demB.coreStats, ...demB.valuableStats] : [];
  const relA = rollCountOn(a.prelim.artifact, subsA);
  const relB = rollCountOn(b.prelim.artifact, subsB);
  if (relA !== relB) return relB - relA;

  return (
    rollCount(b.prelim.artifact) - rollCount(a.prelim.artifact) ||
    b.prelim.artifact.level - a.prelim.artifact.level ||
    a.prelim.artifact.id.localeCompare(b.prelim.artifact.id) ||
    a.embryoKey.localeCompare(b.embryoKey)
  );
}

function buildSupplyDemandByEdge<T extends RankedTriageEdge>(
  edges: T[],
  demandCounts: Map<string, Set<string>>
): Map<T, SupplyDemandInfo> {
  const result = new Map<T, SupplyDemandInfo>();
  const edgesByKey = new Map<string, T[]>();
  for (const edge of edges) {
    if (!edgesByKey.has(edge.embryoKey)) edgesByKey.set(edge.embryoKey, []);
    edgesByKey.get(edge.embryoKey)!.push(edge);
  }

  for (const [embryoKey, keyEdges] of edgesByKey) {
    const demand = demandCounts.get(embryoKey)?.size ?? 0;
    const supplyByTier: Record<QualityTier, number> = {
      prime: 0,
      solid: 0,
      filler: 0,
      fodder: 0,
    };
    for (const edge of keyEdges) {
      supplyByTier[edge.tier]++;
    }

    for (const tier of QUALITY_TIERS) {
      const tierEdges = keyEdges
        .filter((edge) => edge.tier === tier)
        .sort(compareRankedEdges);
      for (let i = 0; i < tierEdges.length; i++) {
        result.set(tierEdges[i], {
          demand,
          supplyByTier,
          rankInTier: i + 1,
          tierTotal: tierEdges.length,
        });
      }
    }
  }

  return result;
}

/** Lower = better. Used when set-slot floor promotes same-tier artifacts. */
function setSlotFloorTiebreaker(prelim: { artifact: ArtifactData }): number {
  const artifact = prelim.artifact;
  const subs = Object.keys(artifact.substats ?? {});
  let score = 0;
  // 4-line is best
  if (!startedWithFourSubstats(artifact)) score += 100;
  // elemental main stat
  if (!ELEMENTAL_MAINS.has(artifact.mainStatKey)) score += 50;
  // desirable stats in main or subs
  const hasStatInMainOrSubs = (stat: string) =>
    artifact.mainStatKey === stat || subs.includes(stat);
  if (!hasStatInMainOrSubs("er")) score += 25;
  if (!hasStatInMainOrSubs("cr")) score += 12;
  if (!hasStatInMainOrSubs("cd")) score += 6;
  if (!hasStatInMainOrSubs("em")) score += 3;
  return score;
}

function tierToLabel(t: QualityTier): TriageLabel {
  return t === "prime" || t === "solid" ? "lock" : "unlock";
}

function tierToRuleId(t: QualityTier): TriageRuleId {
  return t === "prime"
    ? "primeTierKeep"
    : t === "solid"
      ? "solidTierKeep"
      : t === "filler"
        ? "fillerDefaultUnlock"
        : "fodderTier";
}

function tierReasonArgs(tr: TierResult): (string | number)[] {
  return [tr.hitCount, tr.hitOptional, tr.hitTotal];
}

function setLabel(
  p: { bestLabel: TriageLabel; bestResult: EmbryoResult | null },
  label: TriageLabel,
  ruleId: TriageRuleId
) {
  p.bestLabel = label;
  if (p.bestResult) {
    p.bestResult = { ...p.bestResult, label, ruleId };
  }
}
