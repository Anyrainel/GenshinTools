import type {
  AccountData,
  ArtifactData,
  Build,
  MainStat,
  SubStat,
} from "@/data/types";
import { allSlots, mainStatSlots } from "@/data/types";
import { extractDemands, getEligibleSetsForHalfSet } from "./demandExtractor";
import { buildRareEmbryoRegistry } from "./rareEmbryoRegistry";
import type {
  DemandProfile,
  EmbryoMatch,
  EmbryoResult,
  RareEmbryoEntry,
  SubstatGrade,
  TriageDecision,
  TriageLabel,
  TriageSettings,
} from "./types";

// ---------------------------------------------------------------------------
// Substat grading
// ---------------------------------------------------------------------------

function gradeSubstats(
  artifact: ArtifactData,
  demand: DemandProfile,
  _settings: TriageSettings
): SubstatGrade {
  const substats = Object.keys(artifact.substats ?? {}) as SubStat[];
  let core = 0;
  let valuable = 0;
  let minor = 0;
  let unwanted = 0;

  for (const stat of substats) {
    if (demand.coreStats.includes(stat)) core++;
    else if (demand.valuableStats.includes(stat)) valuable++;
    else {
      // Not core or valuable: flat stats (hp, atk, def) are almost always unwanted.
      // % stats not in core/valuable are "minor" (non-zero weight < valuableThreshold).
      if (["hp", "atk", "def"].includes(stat)) unwanted++;
      else minor++;
    }
  }

  return {
    coreCount: core,
    valuableCount: valuable,
    minorCount: minor,
    unwantedCount: unwanted,
    totalCount: substats.length,
    initial4Line: substats.length >= 4,
  };
}

// ---------------------------------------------------------------------------
// Embryo key generation
// ---------------------------------------------------------------------------

function makeEmbryoKey(demand: DemandProfile, mainStat: MainStat): string {
  if (demand.demandSource.type === "4pc") {
    return `4pc:${demand.demandSource.setKey}:${demand.slot}:${mainStat}`;
  }
  if (demand.demandSource.type === "2pc") {
    return `2pc:${demand.demandSource.halfSetId}:${demand.slot}:${mainStat}`;
  }
  return `flex:${demand.slot}:${mainStat}`;
}

// ---------------------------------------------------------------------------
// Step 1: Classify — find all matching embryo types for an artifact
// ---------------------------------------------------------------------------

function classifyArtifact(
  artifact: ArtifactData,
  demands: DemandProfile[],
  rareEmbryos: RareEmbryoEntry[],
  settings: TriageSettings
): EmbryoMatch[] {
  const matches: EmbryoMatch[] = [];
  const seen = new Set<string>(); // deduplicate by embryoKey + characterId

  for (const demand of demands) {
    // Slot match
    if (demand.slot !== artifact.slotKey) continue;
    // Main stat match
    if (!demand.acceptedMainStats.includes(artifact.mainStatKey)) continue;

    const src = demand.demandSource;

    if (src.type === "4pc") {
      if (src.setKey !== artifact.setKey) continue;
    } else if (src.type === "2pc") {
      const eligible = getEligibleSetsForHalfSet(src.halfSetId);
      if (!eligible.includes(artifact.setKey)) continue;
    }
    // flex demands are not generated from builds — handled below via rare embryo

    if (src.type !== "flex") {
      const key = makeEmbryoKey(demand, artifact.mainStatKey);
      const dedup = `${key}:${demand.characterId}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      matches.push({
        demand,
        grade: gradeSubstats(artifact, demand, settings),
        embryoKey: key,
        isRareEmbryo: false,
      });
    }
  }

  // Rare embryo check (flex, sands/goblet/circlet only)
  if (
    settings.rareEmbryoEnabled &&
    mainStatSlots.includes(artifact.slotKey as "sands" | "goblet" | "circlet")
  ) {
    const substats = Object.keys(artifact.substats ?? {}) as SubStat[];
    for (const entry of rareEmbryos) {
      if (entry.slot !== artifact.slotKey) continue;
      if (entry.mainStat !== artifact.mainStatKey) continue;
      if (!entry.requiredSubstats.every((s) => substats.includes(s))) continue;

      // Find the best matching demand for grade computation
      const bestDemand = demands.find(
        (d) =>
          d.slot === artifact.slotKey &&
          d.acceptedMainStats.includes(artifact.mainStatKey) &&
          entry.demandCharacters.includes(d.characterId)
      );
      if (!bestDemand) continue;

      const flexDemand: DemandProfile = {
        ...bestDemand,
        demandSource: { type: "flex" },
      };
      const key = `flex:${artifact.slotKey}:${artifact.mainStatKey}`;
      const dedup = `${key}:rare`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      matches.push({
        demand: flexDemand,
        grade: gradeSubstats(artifact, flexDemand, settings),
        embryoKey: key,
        isRareEmbryo: true,
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Step 2: Quality Gate — evaluate each embryo match
// ---------------------------------------------------------------------------

type RuleResult = { label: TriageLabel; ruleId: string; reason: string };

function evaluate4pc(g: SubstatGrade): RuleResult | null {
  // Lock rules
  if (g.coreCount >= 2)
    return {
      label: "LOCK",
      ruleId: "L4-1",
      reason: `${g.coreCount} core substats`,
    };
  if (g.coreCount >= 1 && g.valuableCount >= 2)
    return {
      label: "LOCK",
      ruleId: "L4-2",
      reason: `${g.coreCount} core + ${g.valuableCount} valuable`,
    };
  if (g.coreCount >= 1 && g.valuableCount >= 1 && g.initial4Line)
    return {
      label: "LOCK",
      ruleId: "L4-3",
      reason: "4-liner with core + valuable",
    };
  if (g.valuableCount >= 3)
    return {
      label: "LOCK",
      ruleId: "L4-4",
      reason: `${g.valuableCount} valuable substats`,
    };
  if (g.valuableCount >= 2 && g.initial4Line && g.unwantedCount === 0)
    return {
      label: "LOCK",
      ruleId: "L4-5",
      reason: "4-liner, no waste, 2+ valuable",
    };

  // Fodder rules
  if (g.unwantedCount >= 3)
    return {
      label: "FODDER",
      ruleId: "F4-1",
      reason: `${g.unwantedCount} unwanted substats`,
    };
  if (g.coreCount === 0 && g.valuableCount === 0)
    return {
      label: "FODDER",
      ruleId: "F4-2",
      reason: "no core or valuable substats",
    };
  if (
    g.coreCount === 0 &&
    g.valuableCount === 1 &&
    g.unwantedCount >= 2 &&
    !g.initial4Line
  )
    return {
      label: "FODDER",
      ruleId: "F4-3",
      reason: "3-liner, 1 valuable + 2+ unwanted",
    };

  return null; // BORDERLINE
}

function evaluate2pc(g: SubstatGrade): RuleResult | null {
  // Lock rules (stricter than 4pc)
  if (g.coreCount >= 2 && g.unwantedCount <= 1)
    return {
      label: "LOCK",
      ruleId: "L2-1",
      reason: `${g.coreCount} core + low waste`,
    };
  if (g.coreCount >= 1 && g.valuableCount >= 2 && g.unwantedCount === 0)
    return {
      label: "LOCK",
      ruleId: "L2-2",
      reason: "core + 2 valuable, no waste",
    };
  if (g.coreCount >= 2 && g.initial4Line)
    return { label: "LOCK", ruleId: "L2-3", reason: "4-liner with 2+ core" };
  if (g.valuableCount >= 3 && g.unwantedCount === 0)
    return { label: "LOCK", ruleId: "L2-4", reason: "3+ valuable, no waste" };

  // Fodder rules (more aggressive than 4pc)
  if (g.unwantedCount >= 2 && g.coreCount <= 1)
    return {
      label: "FODDER",
      ruleId: "F2-1",
      reason: "2+ unwanted, insufficient core for 2pc",
    };
  if (g.coreCount === 0 && g.valuableCount <= 1)
    return { label: "FODDER", ruleId: "F2-2", reason: "no core, ≤1 valuable" };

  return null; // BORDERLINE
}

function evaluateRareEmbryo(g: SubstatGrade): RuleResult | null {
  // Lock rules for rare embryos (more lenient)
  if (g.initial4Line)
    return { label: "LOCK", ruleId: "LR-1", reason: "4-liner rare embryo" };
  if (g.unwantedCount <= 1)
    return { label: "LOCK", ruleId: "LR-2", reason: "rare embryo, low waste" };
  if (g.coreCount >= 2 && g.unwantedCount <= 2)
    return { label: "LOCK", ruleId: "LR-3", reason: "rare embryo, 2+ core" };

  // Fodder rule
  if (g.unwantedCount >= 2 && !g.initial4Line)
    return {
      label: "FODDER",
      ruleId: "FR-1",
      reason: "3-liner rare embryo with 2+ waste",
    };

  return null; // BORDERLINE
}

function evaluateEmbryo(match: EmbryoMatch): RuleResult {
  const g = match.grade;
  let result: RuleResult | null = null;

  if (match.isRareEmbryo) {
    result = evaluateRareEmbryo(g);
  } else if (match.demand.demandSource.type === "4pc") {
    result = evaluate4pc(g);
  } else if (match.demand.demandSource.type === "2pc") {
    result = evaluate2pc(g);
  }

  return (
    result ?? {
      label: "BORDERLINE",
      ruleId: "BL",
      reason: "borderline quality",
    }
  );
}

// ---------------------------------------------------------------------------
// Step 3: Supply check (only for BORDERLINE results)
// ---------------------------------------------------------------------------

function supplyCheck(
  embryoKey: string,
  supplyMap: Map<
    string,
    { locked: number; lockedBetter: number; demand: number }
  >,
  settings: TriageSettings
): RuleResult | null {
  const supply = supplyMap.get(embryoKey);
  if (!supply) return null;

  if (supply.locked === 0)
    return { label: "LOCK", ruleId: "S1", reason: "no existing supply" };
  if (supply.lockedBetter < supply.demand)
    return {
      label: "LOCK",
      ruleId: "S2",
      reason: `supply ${supply.lockedBetter} < demand ${supply.demand}`,
    };
  if (supply.lockedBetter >= supply.demand + settings.surplusBuffer)
    return {
      label: "FODDER",
      ruleId: "S3",
      reason: `surplus: ${supply.lockedBetter} ≥ ${supply.demand} + ${settings.surplusBuffer}`,
    };

  return null; // Stay BORDERLINE
}

// ---------------------------------------------------------------------------
// Full triage pipeline
// ---------------------------------------------------------------------------

/**
 * Run triage on all artifacts in the account.
 * Returns a TriageDecision for each artifact.
 */
export function runTriage(
  accountData: AccountData,
  buildGroups: { characterId: string; builds: Build[] }[],
  settings: TriageSettings
): TriageDecision[] {
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

  // Extract demands & rare embryos
  const demands = extractDemands(buildGroups, settings);
  const rareEmbryos = buildRareEmbryoRegistry(demands);

  // Max level by rarity
  const maxLevel = (r: number) => (r === 4 ? 16 : r === 3 ? 12 : 20);

  // Phase 1: Evaluate each artifact
  const decisions: TriageDecision[] = [];

  // We need to collect embryo results first to build supply maps
  type PrelimResult = {
    artifact: ArtifactData;
    equippedOn: string | null;
    embryoResults: EmbryoResult[];
    specialRules: string[];
    bestLabel: TriageLabel;
    bestResult: EmbryoResult | null;
  };

  const prelims: PrelimResult[] = [];

  for (const { artifact, equippedOn } of allArtifacts) {
    const specialRules: string[] = [];

    // --- Pre-checks (SP1, SP5) ---
    const substats = Object.keys(artifact.substats ?? {}) as SubStat[];
    const is4Line = substats.length >= 4;

    // SP1: ER hoarding
    if (settings.erHoardingEnabled && is4Line && substats.includes("er")) {
      const anyBuildNeedsER = demands.some(
        (d) => d.coreStats.includes("er") && d.slot === artifact.slotKey
      );
      if (anyBuildNeedsER) {
        specialRules.push("SP1");
        prelims.push({
          artifact,
          equippedOn,
          embryoResults: [],
          specialRules,
          bestLabel: "LOCK",
          bestResult: {
            embryo: {
              demand: demands.find((d) => d.coreStats.includes("er"))!,
              grade: {
                coreCount: 0,
                valuableCount: 0,
                minorCount: 0,
                unwantedCount: 0,
                totalCount: substats.length,
                initial4Line: is4Line,
              },
              embryoKey: "SP1",
              isRareEmbryo: false,
            },
            label: "LOCK",
            ruleId: "SP1",
            reason: "4-liner with ER, high ER demand",
          },
        });
        continue;
      }
    }

    // SP5: Double crit lock
    if (
      settings.doubleCritLockEnabled &&
      is4Line &&
      substats.includes("cr") &&
      substats.includes("cd")
    ) {
      // Check if any build needs this artifact (set + slot + mainStat match)
      const hasMatchingDemand = demands.some(
        (d) =>
          d.slot === artifact.slotKey &&
          d.acceptedMainStats.includes(artifact.mainStatKey) &&
          (d.demandSource.type === "4pc"
            ? d.demandSource.setKey === artifact.setKey
            : d.demandSource.type === "2pc"
              ? getEligibleSetsForHalfSet(d.demandSource.halfSetId).includes(
                  artifact.setKey
                )
              : false)
      );
      if (hasMatchingDemand) {
        specialRules.push("SP5");
        prelims.push({
          artifact,
          equippedOn,
          embryoResults: [],
          specialRules,
          bestLabel: "LOCK",
          bestResult: {
            embryo: {
              demand: demands[0],
              grade: {
                coreCount: 0,
                valuableCount: 0,
                minorCount: 0,
                unwantedCount: 0,
                totalCount: substats.length,
                initial4Line: is4Line,
              },
              embryoKey: "SP5",
              isRareEmbryo: false,
            },
            label: "LOCK",
            ruleId: "SP5",
            reason: "4-liner with double crit",
          },
        });
        continue;
      }
    }

    // --- Step 1: Classify ---
    const embryoMatches = classifyArtifact(
      artifact,
      demands,
      rareEmbryos,
      settings
    );

    if (embryoMatches.length === 0) {
      prelims.push({
        artifact,
        equippedOn,
        embryoResults: [],
        specialRules,
        bestLabel: "FODDER",
        bestResult: null,
      });
      continue;
    }

    // --- Step 2: Quality Gate ---
    const embryoResults: EmbryoResult[] = embryoMatches.map((match) => {
      const result = evaluateEmbryo(match);
      return { embryo: match, ...result };
    });

    // Best result = highest label (LOCK > BORDERLINE > FODDER)
    const labelRank = { LOCK: 2, BORDERLINE: 1, FODDER: 0 };
    embryoResults.sort((a, b) => labelRank[b.label] - labelRank[a.label]);
    const bestResult = embryoResults[0];

    prelims.push({
      artifact,
      equippedOn,
      embryoResults,
      specialRules,
      bestLabel: bestResult.label,
      bestResult,
    });
  }

  // --- Step 3: Supply check for BORDERLINE ---
  // Build supply map: for each embryoKey, count locked artifacts and demand count
  const supplyMap = new Map<
    string,
    { locked: number; lockedBetter: number; demand: number }
  >();

  // Count demand per embryoKey (unique characters)
  const demandCounts = new Map<string, Set<string>>();
  for (const d of demands) {
    for (const ms of d.acceptedMainStats) {
      const key = makeEmbryoKey(d, ms);
      if (!demandCounts.has(key)) demandCounts.set(key, new Set());
      demandCounts.get(key)!.add(d.characterId);
    }
  }

  // Count locked supply
  for (const prelim of prelims) {
    if (prelim.bestLabel === "LOCK" && prelim.bestResult) {
      const key = prelim.bestResult.embryo.embryoKey;
      if (!supplyMap.has(key)) {
        const demandSet = demandCounts.get(key);
        supplyMap.set(key, {
          locked: 0,
          lockedBetter: 0,
          demand: demandSet?.size ?? 0,
        });
      }
      const s = supplyMap.get(key)!;
      s.locked++;
      s.lockedBetter++;
    }
  }
  // Also count currently-locked BORDERLINE artifacts as "locked" (not "lockedBetter")
  for (const prelim of prelims) {
    if (prelim.bestLabel === "BORDERLINE" && prelim.bestResult) {
      const key = prelim.bestResult.embryo.embryoKey;
      if (!supplyMap.has(key)) {
        const demandSet = demandCounts.get(key);
        supplyMap.set(key, {
          locked: 0,
          lockedBetter: 0,
          demand: demandSet?.size ?? 0,
        });
      }
    }
  }

  // Apply supply check to BORDERLINE artifacts
  for (const prelim of prelims) {
    if (prelim.bestLabel !== "BORDERLINE" || !prelim.bestResult) continue;

    const key = prelim.bestResult.embryo.embryoKey;
    const result = supplyCheck(key, supplyMap, settings);
    if (result) {
      prelim.bestLabel = result.label;
      prelim.bestResult = {
        ...prelim.bestResult,
        label: result.label,
        ruleId: result.ruleId,
        reason: result.reason,
      };
    }
  }

  // SP2: Minimum keep — ensure at least N artifacts per embryoKey
  if (settings.minimumKeep > 0) {
    // Group prelims by embryoKey
    const groups = new Map<string, PrelimResult[]>();
    for (const prelim of prelims) {
      if (!prelim.bestResult) continue;
      const key = prelim.bestResult.embryo.embryoKey;
      if (key === "SP1" || key === "SP5") continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(prelim);
    }

    for (const [key, group] of groups) {
      const demandSet = demandCounts.get(key);
      if (!demandSet || demandSet.size === 0) continue;

      const lockedCount = group.filter((p) => p.bestLabel === "LOCK").length;
      if (lockedCount >= settings.minimumKeep) continue;

      // Sort non-locked by quality (coreCount desc, then valuableCount desc)
      const nonLocked = group
        .filter((p) => p.bestLabel !== "LOCK")
        .sort((a, b) => {
          const ga = a.bestResult!.embryo.grade;
          const gb = b.bestResult!.embryo.grade;
          return (
            gb.coreCount - ga.coreCount ||
            gb.valuableCount - ga.valuableCount ||
            (gb.initial4Line ? 1 : 0) - (ga.initial4Line ? 1 : 0)
          );
        });

      const needed = settings.minimumKeep - lockedCount;
      for (let i = 0; i < Math.min(needed, nonLocked.length); i++) {
        const prelim = nonLocked[i];
        prelim.bestLabel = "LOCK";
        prelim.bestResult = {
          ...prelim.bestResult!,
          label: "LOCK",
          ruleId: "SP2",
          reason: `minimum keep: ${lockedCount}/${settings.minimumKeep} locked`,
        };
        prelim.specialRules.push("SP2");
      }
    }
  }

  // Post-checks: SP3 (max level protection), SP4 (equipped protection)
  for (const prelim of prelims) {
    if (prelim.bestLabel !== "FODDER") continue;

    if (
      settings.maxLevelProtection &&
      prelim.artifact.level >= maxLevel(prelim.artifact.rarity)
    ) {
      prelim.bestLabel = "BORDERLINE";
      prelim.specialRules.push("SP3");
    }

    if (settings.equippedProtection && prelim.equippedOn) {
      prelim.bestLabel = "BORDERLINE";
      prelim.specialRules.push("SP4");
    }
  }

  // Build final decisions
  return prelims.map((prelim) => ({
    artifact: prelim.artifact,
    label: prelim.bestLabel,
    decidingResult: prelim.bestResult,
    allResults: prelim.embryoResults,
    specialRules: prelim.specialRules,
  }));
}
