import { TRIAGE_SUPPORT_ARTIFACT_SETS } from "@/data/constants";
import type { MainStat, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { AccountData, ArtifactData, Build } from "@/data/types";
import { getAllSubstats } from "@/lib/account-data/artifactProjection";
import { getSubstatAvgRoll } from "@/lib/artifact/scoring/utils";
import { getEligibleSetsForHalfSet } from "./demandExtractor";
import { buildCustomFlexPattern, buildFlexPatterns } from "./flexRegistry";
import { isInitial4Line } from "./is4L";
import { extractRules } from "./ruleBuilder";
import { runStrategicRules } from "./strategicValue";
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
  TriageSettings,
} from "./types";

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
      (fp): fp is FlexPattern =>
        fp !== null && !officialFlex.some((o) => o.key === fp.key)
    );
  const allFlex = [...officialFlex, ...customFlex];
  const enabledFlex = allFlex.filter((fp) =>
    fp.defaultOff
      ? settings.enabledFlexPatterns.includes(fp.key)
      : !settings.disabledFlexPatterns.includes(fp.key)
  );

  // 3. Count demand per embryoKey (unique characters)
  const demandCounts = new Map<string, Set<string>>();
  for (const r of rules) {
    const key = makeEmbryoKey(r.demandSource, r.slot, r.mainStat, r.desired);
    if (!demandCounts.has(key)) demandCounts.set(key, new Set());
    demandCounts.get(key)!.add(r.characterId);
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
  const fiveStarArtifacts = allArtifacts.filter((a) => a.artifact.rarity === 5);

  // Phase 1: Evaluate each artifact
  type PrelimResult = {
    artifact: ArtifactData;
    equippedOn: string | null;
    embryoResults: EmbryoResult[];
    specialRules: string[];
    bestLabel: TriageLabel;
    bestResult: EmbryoResult | null;
    bestTier: QualityTier;
    bestTierResult: TierResult | null;
    embryoKey: string | null;
    supplyDemand: SupplyDemandInfo | null;
  };

  const prelims: PrelimResult[] = [];

  for (const { artifact, equippedOn } of fiveStarArtifacts) {
    const specialRules: string[] = [];
    const substats = getAllSubstats(artifact);
    const is4L = isInitial4Line(artifact);

    // --- Pre-checks (SP1, SP5) ---
    // SP1: ER hoarding (support sets only, exclude sands which can roll ER main)
    if (
      settings.erHoardingEnabled &&
      is4L &&
      artifact.slotKey !== "sands" &&
      substats.includes("er") &&
      TRIAGE_SUPPORT_ARTIFACT_SETS.has(artifact.setKey)
    ) {
      const anyRuleNeedsER = rules.some(
        (r) => r.desired.includes("er") && r.slot === artifact.slotKey
      );
      if (anyRuleNeedsER) {
        specialRules.push("SP1");
      }
    }

    // SP7: ER hoarding (all sets, not just support — off by default)
    if (
      settings.erHoardingAllEnabled &&
      !specialRules.includes("SP1") &&
      is4L &&
      artifact.slotKey !== "sands" &&
      substats.includes("er")
    ) {
      const anyRuleNeedsER = rules.some(
        (r) => r.desired.includes("er") && r.slot === artifact.slotKey
      );
      if (anyRuleNeedsER) {
        specialRules.push("SP7");
      }
    }

    // SP5: Double crit lock — tag only, normal evaluation continues
    if (
      settings.doubleCritLockEnabled &&
      is4L &&
      substats.includes("cr") &&
      substats.includes("cd")
    ) {
      const hasMatch = rules.some(
        (r) =>
          r.slot === artifact.slotKey &&
          r.mainStat === artifact.mainStatKey &&
          matchesSet(r, artifact.setKey)
      );
      if (hasMatch) {
        specialRules.push("SP5");
      }
    }

    // --- Classify & evaluate against rules ---
    // Sort matched rules deterministically by embryo key so an artifact's
    // assigned group is stable across runs regardless of build/rule ordering.
    const matchedRules = rules
      .filter(
        (r) =>
          r.slot === artifact.slotKey &&
          r.mainStat === artifact.mainStatKey &&
          matchesSet(r, artifact.setKey)
      )
      .sort((a, b) => {
        const ka = makeEmbryoKey(a.demandSource, a.slot, a.mainStat, a.desired);
        const kb = makeEmbryoKey(b.demandSource, b.slot, b.mainStat, b.desired);
        return ka.localeCompare(kb);
      });

    let bestTier: QualityTier = "T";
    let bestTierResult: TierResult | null = null;
    const embryoResults: EmbryoResult[] = [];

    for (const rule of matchedRules) {
      const tr = evaluateTier(substats, is4L, rule);
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
          coreCount: tr.hitCount,
          valuableCount: tr.hitOptional,
          minorCount: 0,
          unwantedCount:
            substats.length -
            tr.hitCount -
            tr.hitOptional -
            (tr.hasFill ? 1 : 0),
          totalCount: substats.length,
          initial4Line: is4L,
        },
        embryoKey,
      };

      const ruleId = tierToRuleId(tr.tier);
      embryoResults.push({
        embryo: embryoMatch,
        label: tierToLabel(tr.tier),
        ruleId,
        reason: "",
        reasonArgs: tierReasonArgs(tr),
        tier: tr.tier,
      });

      if (tierRank(tr.tier) < tierRank(bestTier)) {
        bestTier = tr.tier;
        bestTierResult = tr;
      }
    }

    // Flex check: tag only, does not change tier
    for (const fp of enabledFlex) {
      if (fp.slot !== artifact.slotKey) continue;
      if (fp.mainStat !== artifact.mainStatKey) continue;
      if (!fp.requiredSubs.every((s) => substats.includes(s))) continue;

      specialRules.push("FLEX");
      break;
    }

    // Sort embryo results best-first; tiebreak by embryoKey so the
    // chosen group is deterministic.
    embryoResults.sort(
      (a, b) =>
        tierRank(a.tier ?? "T") - tierRank(b.tier ?? "T") ||
        (a.embryo.embryoKey ?? "").localeCompare(b.embryo.embryoKey ?? "")
    );

    const bestEmbryoResult = embryoResults[0] ?? null;
    const bestEmbryoKey = bestEmbryoResult?.embryo.embryoKey ?? null;

    if (embryoResults.length === 0) {
      prelims.push({
        artifact,
        equippedOn,
        embryoResults,
        specialRules,
        bestLabel: "unlock",
        bestResult: {
          embryo: null as never,
          label: "unlock",
          ruleId: "TD",
          reason: "",
          reasonArgs: [],
          tier: "T",
        },
        bestTier: "T",
        bestTierResult: null,
        embryoKey: null,
        supplyDemand: null, // filled below in TD supply pass
      });
    } else {
      prelims.push({
        artifact,
        equippedOn,
        embryoResults,
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
  // Group by embryoKey
  const groups = new Map<string, PrelimResult[]>();
  for (const p of prelims) {
    if (!p.embryoKey) continue;
    if (!groups.has(p.embryoKey)) groups.set(p.embryoKey, []);
    groups.get(p.embryoKey)!.push(p);
  }

  for (const [key, group] of groups) {
    const demand = demandCounts.get(key)?.size ?? 0;
    if (demand === 0) continue;

    const premium = group.filter((p) => p.bestTier === "P");
    const quality = group.filter((p) => p.bestTier === "Q");
    const neutral = group.filter((p) => p.bestTier === "N");
    const trash = group.filter((p) => p.bestTier === "T");

    const premiumCount = premium.length;
    const qualityCount = quality.length;

    if (premiumCount + qualityCount < demand + settings.qualityMargin) {
      // Under-supply (including the margin buffer): lock P, Q, and best N
      for (const p of premium) setLabel(p, "lock", "TP");
      for (const p of quality) setLabel(p, "lock", "TQ");

      // Sort neutral by computed tier rarity (which already encodes is4L,
      // crcd, hit count, fill), then tie-break by actual stat values.
      neutral.sort(compareWithinTier);

      // Cap neutral locks so total locked (P+Q+N) never exceeds demand+margin.
      const shortfall =
        demand + settings.qualityMargin - premiumCount - qualityCount;
      const neutralCap = Math.min(shortfall, settings.neutralKeep);

      for (let i = 0; i < neutral.length; i++) {
        if (i < neutralCap) {
          setLabel(neutral[i], "lock", "NK");
        } else {
          setLabel(neutral[i], "unlock", "TN");
        }
      }

      // T tier → unlock
      for (const p of trash) setLabel(p, "unlock", "TF");
    } else {
      // Adequate/over-supply
      for (const p of premium) setLabel(p, "lock", "TP");

      const qualityCap = Math.max(
        demand + settings.qualityMargin - premiumCount,
        0
      );
      // Sort quality by computed tier rarity (encodes is4L, crcd, hit
      // count, fill), then tie-break by actual stat values.
      quality.sort(compareWithinTier);
      for (let i = 0; i < quality.length; i++) {
        if (i < qualityCap) {
          setLabel(quality[i], "lock", "TQ");
        } else {
          setLabel(quality[i], "unlock", "QB");
        }
      }

      for (const p of neutral) setLabel(p, "unlock", "TN");
      for (const p of trash) setLabel(p, "unlock", "TF");
    }

    // Record supply/demand info for all artifacts in this group
    const supplyByTier: Record<QualityTier, number> = {
      P: premiumCount,
      Q: qualityCount,
      N: neutral.length,
      T: trash.length,
    };
    const tierArrays: Record<QualityTier, PrelimResult[]> = {
      P: premium,
      Q: quality,
      N: neutral,
      T: trash,
    };
    for (const tier of ["P", "Q", "N", "T"] as QualityTier[]) {
      const arr = tierArrays[tier];
      for (let i = 0; i < arr.length; i++) {
        arr[i].supplyDemand = {
          demand,
          supplyByTier,
          rankInTier: i + 1,
          tierTotal: arr.length,
        };
      }
    }
  }

  // --- TD (no demand) supply count ---
  // Group TD artifacts by set+slot+mainStat so the UI can show fodder total
  const tdGroups = new Map<string, PrelimResult[]>();
  for (const p of prelims) {
    if (p.embryoKey !== null) continue; // has demand, already resolved
    const key = `${p.artifact.setKey}:${p.artifact.slotKey}:${p.artifact.mainStatKey}`;
    if (!tdGroups.has(key)) tdGroups.set(key, []);
    tdGroups.get(key)!.push(p);
  }
  for (const group of tdGroups.values()) {
    for (const p of group) {
      p.supplyDemand = {
        demand: 0,
        supplyByTier: { P: 0, Q: 0, N: 0, T: group.length },
        rankInTier: 0,
        tierTotal: group.length,
      };
    }
  }

  // --- Special-rule lock promotion (SP1, SP7, SP5, FLEX) ---
  // These force lock without changing the tier determined by 4pc/2pc evaluation.
  for (const prelim of prelims) {
    if (prelim.bestLabel === "lock") continue;
    const sp = prelim.specialRules;
    if (
      sp.includes("SP1") ||
      sp.includes("SP7") ||
      sp.includes("SP5") ||
      sp.includes("FLEX")
    ) {
      const ruleId = sp.includes("SP1")
        ? "SP1"
        : sp.includes("SP7")
          ? "SP7"
          : sp.includes("SP5")
            ? "SP5"
            : "FLEX";
      setLabel(prelim, "lock", ruleId);
    }
  }

  // --- Set+slot minimum keep ---
  // Runs AFTER special-rule promotions so FLEX/SP-locked artifacts are counted.
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
      const want = Math.min(settings.setSlotKeep, group.length);
      const algoLocked = group.filter((p) => p.bestLabel === "lock").length;
      const need = want - algoLocked;
      if (need <= 0) continue;

      // Candidates: anything not already locked by the algorithm. Sort
      // externally-locked first (for stability), then by tier/intrinsics.
      const candidates = group
        .filter((p) => p.bestLabel !== "lock")
        .sort(
          (a, b) =>
            (b.artifact.lock ? 1 : 0) - (a.artifact.lock ? 1 : 0) ||
            tierRank(a.bestTier) - tierRank(b.bestTier) ||
            skTiebreaker(a) - skTiebreaker(b) ||
            rollCount(b.artifact) - rollCount(a.artifact) ||
            b.artifact.level - a.artifact.level
        );

      for (let i = 0; i < Math.min(need, candidates.length); i++) {
        setLabel(candidates[i], "lock", "SK");
        candidates[i].specialRules.push("SP6");
      }
    }
  }

  // Post-checks: SP3 (level protection), SP4 (equipped) — tag only, no label change.
  // These are "protected" artifacts handled by the UI (shown in protected zone).
  //
  // High-level handling: when highLevelProtection is enabled, high-level
  // artifacts get SP3 (auto-protected). When disabled, they flow through the
  // normal recommendation buckets, and any still marked "unlock" are run
  // through the strategic value rules. If a rule fires, promote to lock with
  // a "SV" (strategic value) ruleId + reason code on specialRules.
  for (const prelim of prelims) {
    const isHighLevel =
      settings.levelProtection > 0 &&
      prelim.artifact.level >= settings.levelProtection;

    if (isHighLevel) {
      if (settings.highLevelProtection) {
        prelim.specialRules.push("SP3");
      } else if (prelim.bestLabel === "unlock") {
        const result = runStrategicRules(prelim.artifact);
        if (result.kept) {
          setLabel(prelim, "lock", "SV");
          prelim.specialRules.push(`SV:${result.reason}`);
        }
      }
    }

    if (settings.equippedProtection && prelim.equippedOn) {
      prelim.specialRules.push("SP4");
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
  return t === "P" ? 0 : t === "Q" ? 1 : t === "N" ? 2 : 3;
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

/**
 * Primary within-tier rank for Q/N tiers. Sorts by the matched condition's
 * computed rarity (ascending, rarer first) — this already accounts for k
 * (hits), crcd, is4L, and fill — then tie-breaks by actual substat values:
 * first on the demanded substats (core + optional), then total roll mass,
 * then level.
 *
 * Returns negative if `a` is a "better keeper" than `b`.
 */
function compareWithinTier(
  a: {
    artifact: ArtifactData;
    bestTierResult: TierResult | null;
    bestResult: EmbryoResult | null;
  },
  b: {
    artifact: ArtifactData;
    bestTierResult: TierResult | null;
    bestResult: EmbryoResult | null;
  }
): number {
  const ra = a.bestTierResult?.matchedCondition?.rarity ?? 1;
  const rb = b.bestTierResult?.matchedCondition?.rarity ?? 1;
  if (ra !== rb) return ra - rb;

  const demA = a.bestResult?.embryo?.demand;
  const demB = b.bestResult?.embryo?.demand;
  const subsA = demA ? [...demA.coreStats, ...demA.valuableStats] : [];
  const subsB = demB ? [...demB.coreStats, ...demB.valuableStats] : [];
  const relA = rollCountOn(a.artifact, subsA);
  const relB = rollCountOn(b.artifact, subsB);
  if (relA !== relB) return relB - relA;

  return (
    rollCount(b.artifact) - rollCount(a.artifact) ||
    b.artifact.level - a.artifact.level
  );
}

/** Lower = better. Used as tiebreaker when SK-promoting same-tier artifacts. */
function skTiebreaker(p: { artifact: ArtifactData }): number {
  const a = p.artifact;
  const subs = Object.keys(a.substats ?? {});
  let score = 0;
  // 4-line is best
  if (!isInitial4Line(a)) score += 100;
  // elemental main stat
  if (!ELEMENTAL_MAINS.has(a.mainStatKey)) score += 50;
  // desirable stats in main or subs
  const hasStatInMainOrSubs = (stat: string) =>
    a.mainStatKey === stat || subs.includes(stat);
  if (!hasStatInMainOrSubs("er")) score += 25;
  if (!hasStatInMainOrSubs("cr")) score += 12;
  if (!hasStatInMainOrSubs("cd")) score += 6;
  if (!hasStatInMainOrSubs("em")) score += 3;
  return score;
}

function tierToLabel(t: QualityTier): TriageLabel {
  return t === "P" || t === "Q" ? "lock" : "unlock";
}

function tierToRuleId(t: QualityTier): string {
  return t === "P" ? "TP" : t === "Q" ? "TQ" : t === "N" ? "TN" : "TT";
}

function tierReasonArgs(tr: TierResult): (string | number)[] {
  return [tr.hitCount, tr.hitOptional, tr.hitTotal];
}

function setLabel(
  p: { bestLabel: TriageLabel; bestResult: EmbryoResult | null },
  label: TriageLabel,
  ruleId: string
) {
  p.bestLabel = label;
  if (p.bestResult) {
    p.bestResult = { ...p.bestResult, label, ruleId };
  }
}
