import type {
  AccountData,
  ArtifactData,
  Build,
  MainStat,
  SubStat,
} from "@/data/types";
import { allSlots } from "@/data/types";
import { getAllSubstats } from "@/lib/account-data/artifactProjection";
import { getEligibleSetsForHalfSet } from "./demandExtractor";
import { buildCustomFlexPattern, buildFlexPatterns } from "./flexRegistry";
import { isInitial4Line } from "./is4L";
import { extractRules } from "./ruleBuilder";
import { type TierResult, evaluateTier } from "./tierEvaluator";
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

// ---------------------------------------------------------------------------
// Embryo key
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Support sets (ER hoarding only applies to these)
// ---------------------------------------------------------------------------

const SUPPORT_SETS = new Set([
  "silken_moons_serenade",
  "scroll_of_the_hero_of_cinder_city",
  "song_of_days_past",
  "deepwood_memories",
  "maiden_beloved",
  "viridescent_venerer",
  "oceanhued_clam",
  "noblesse_oblige",
  "archaic_petra",
  "tenacity_of_the_millelith",
]);

// ---------------------------------------------------------------------------
// Set matching
// ---------------------------------------------------------------------------

function matchesSet(rule: TriageRule, setKey: string): boolean {
  const src = rule.demandSource;
  if (src.type === "4pc") return src.setKey === setKey;
  if (src.type === "2pc")
    return getEligibleSetsForHalfSet(src.halfSetId).includes(setKey);
  return true; // flex matches any set
}

// ---------------------------------------------------------------------------
// Triage Pipeline
// ---------------------------------------------------------------------------

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
      SUPPORT_SETS.has(artifact.setKey)
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
    const matchedRules = rules.filter(
      (r) =>
        r.slot === artifact.slotKey &&
        r.mainStat === artifact.mainStatKey &&
        matchesSet(r, artifact.setKey)
    );

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

    // Sort embryo results best-first
    embryoResults.sort(
      (a, b) => tierRank(a.tier ?? "T") - tierRank(b.tier ?? "T")
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

    if (premiumCount + qualityCount < demand) {
      // Under-supply: lock P, Q, and best N
      for (const p of premium) setLabel(p, "lock", "TP");
      for (const p of quality) setLabel(p, "lock", "TQ");

      // Sort neutral by quality for best-N selection
      neutral.sort((a, b) => {
        const ta = a.bestTierResult;
        const tb = b.bestTierResult;
        if (!ta || !tb) return 0;
        return (
          tb.hitCount - ta.hitCount ||
          tb.hitTotal - ta.hitTotal ||
          (isInitial4Line(b.artifact) ? 1 : 0) -
            (isInitial4Line(a.artifact) ? 1 : 0) ||
          b.artifact.level - a.artifact.level
        );
      });

      for (let i = 0; i < neutral.length; i++) {
        if (i < settings.neutralKeep) {
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
      // Sort quality by tier result quality
      quality.sort((a, b) => {
        const ta = a.bestTierResult;
        const tb = b.bestTierResult;
        if (!ta || !tb) return 0;
        return tb.hitCount - ta.hitCount || tb.hitTotal - ta.hitTotal;
      });
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

  // --- Set+slot minimum keep ---
  if (settings.setSlotKeep > 0) {
    const setSlotGroups = new Map<string, PrelimResult[]>();
    for (const p of prelims) {
      const key = `${p.artifact.setKey}:${p.artifact.slotKey}`;
      if (!setSlotGroups.has(key)) setSlotGroups.set(key, []);
      setSlotGroups.get(key)!.push(p);
    }
    for (const group of setSlotGroups.values()) {
      const locked = group.filter(
        (p) => p.bestLabel === "lock" || p.artifact.lock
      ).length;
      if (locked >= settings.setSlotKeep) continue;

      // Need to keep more — promote best unlocked ones
      const unlocked = group
        .filter((p) => p.bestLabel === "unlock" && !p.artifact.lock)
        .sort(
          (a, b) =>
            tierRank(a.bestTier) - tierRank(b.bestTier) ||
            b.artifact.level - a.artifact.level
        );

      const need = settings.setSlotKeep - locked;
      for (let i = 0; i < Math.min(need, unlocked.length); i++) {
        setLabel(unlocked[i], "lock", "SK");
        unlocked[i].specialRules.push("SP6");
      }
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

  // Post-checks: SP3 (level protection), SP4 (equipped) — tag only, no label change.
  // These are "protected" artifacts handled by the UI (shown in protected zone).
  for (const prelim of prelims) {
    if (
      settings.levelProtection > 0 &&
      prelim.artifact.level >= settings.levelProtection
    ) {
      prelim.specialRules.push("SP3");
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tierRank(t: QualityTier): number {
  return t === "P" ? 0 : t === "Q" ? 1 : t === "N" ? 2 : 3;
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
