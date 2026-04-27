import type { MainStat, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { AccountData, Build } from "@/data/types";
import { getAcceptedMainStats } from "./demandExtractor";
import { lookupTierEntry } from "./tierTableBuilder";
import type { TriageRule, TriageSettings } from "./types";

// Build selection: one build per artifact set, best constellation match

/** Key that identifies a build's artifact set configuration. */
function buildSetKey(build: Build): string {
  if (build.composition === "4pc") return `4pc:${build.artifactSet ?? ""}`;
  const firstHalfSetId = build.halfSet1 != null ? String(build.halfSet1) : "";
  const secondHalfSetId = build.halfSet2 != null ? String(build.halfSet2) : "";
  // Normalize order so 2pc A+B and 2pc B+A share the same key
  return `2pc:${[firstHalfSetId, secondHalfSetId].sort().join("+")}`;
}

/**
 * Pick the best-matching visible build per artifact set for a given constellation.
 * For each set, choose the build with the highest minCons ≤ constellation.
 * Falls back to the build with the lowest minCons if none qualify.
 */
function selectBuildPerSet(builds: Build[], constellation: number): Build[] {
  const groups = new Map<string, Build[]>();
  for (const b of builds) {
    if (!b.visible) continue;
    const key = buildSetKey(b);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  const result: Build[] = [];
  for (const group of groups.values()) {
    let best: Build | null = null;
    for (const b of group) {
      const minConstellation = b.minCons ?? 0;
      if (minConstellation > constellation) continue;
      if (!best || minConstellation > (best.minCons ?? 0)) best = b;
    }
    // Fallback: build with lowest minCons
    if (!best) {
      best = group.reduce((a, b) =>
        (a.minCons ?? 0) <= (b.minCons ?? 0) ? a : b
      );
    }
    result.push(best);
  }
  return result;
}

// Filler derivation

const FILLER_MAP: Partial<Record<SubStat, SubStat>> = {
  "hp%": "hp",
  "atk%": "atk",
  "def%": "def",
};

/** Fixed main stat for flower/plume slots. */
const SLOT_FIXED_FLAT: Partial<Record<Slot, SubStat>> = {
  flower: "hp",
  plume: "atk",
};

function deriveFillers(
  desired: SubStat[],
  slot: Slot,
  mainStat: MainStat
): SubStat[] {
  const fillers: SubStat[] = [];
  const fixedFlat = SLOT_FIXED_FLAT[slot];
  for (const d of desired) {
    const f = FILLER_MAP[d];
    if (!f) continue;
    if (f === fixedFlat) continue; // hp is always a substat on flower, not useful as filler signal
    if (desired.includes(f)) continue; // already in desired
    if (f === mainStat) continue;
    if (!fillers.includes(f)) fillers.push(f);
  }
  return fillers;
}

// Build → TriageRule[]

function buildToRules(
  build: Build,
  characterId: string,
  settings: TriageSettings
): TriageRule[] {
  const rules: TriageRule[] = [];

  const desired: SubStat[] = [];
  const optional: SubStat[] = [];
  for (const { stat, weight } of build.substats) {
    if (weight >= settings.optionalSubThreshold) desired.push(stat);
    else if (weight > 0) optional.push(stat);
  }
  desired.sort();
  optional.sort();

  // Determine demand source
  const demandSources: Array<{
    source: TriageRule["demandSource"];
  }> = [];

  if (build.composition === "4pc" && build.artifactSet) {
    demandSources.push({
      source: { type: "4pc", setKey: build.artifactSet },
    });
  } else if (build.composition === "2pc+2pc") {
    const firstHalfSetId =
      build.halfSet1 != null ? String(build.halfSet1) : null;
    const secondHalfSetId =
      build.halfSet2 != null ? String(build.halfSet2) : null;
    if (firstHalfSetId)
      demandSources.push({
        source: { type: "2pc", halfSetId: firstHalfSetId },
      });
    if (secondHalfSetId && secondHalfSetId !== firstHalfSetId)
      demandSources.push({
        source: { type: "2pc", halfSetId: secondHalfSetId },
      });
  }

  for (const { source } of demandSources) {
    for (const slot of allSlots) {
      const acceptedMain = getAcceptedMainStats(
        build,
        slot,
        settings.mainStatThreshold
      );
      for (const mainStat of acceptedMain) {
        const fillers = deriveFillers(desired, slot, mainStat);
        const tierEntry = lookupTierEntry(
          slot,
          mainStat,
          desired,
          fillers,
          settings.triageMode
        );

        rules.push({
          characterId,
          buildId: build.id,
          demandSource: source,
          slot,
          mainStat,
          desired,
          optional,
          fillers,
          tierEntry,
        });
      }
    }
  }

  return rules;
}

// Public: extract all rules from build groups

export function extractRules(
  buildGroups: { characterId: string; builds: Build[] }[],
  accountData: AccountData,
  settings: TriageSettings
): TriageRule[] {
  const rules: TriageRule[] = [];

  // Build character constellation map
  const consMap = new Map<string, number>();
  for (const c of accountData.characters) {
    consMap.set(c.key, c.constellation);
  }

  for (const { characterId, builds } of buildGroups) {
    // Skip unowned characters when ownedOnly is enabled
    if (settings.ownedOnly && !consMap.has(characterId)) continue;

    const constellation = consMap.get(characterId) ?? 0;
    const selected = selectBuildPerSet(builds, constellation);
    for (const build of selected) {
      rules.push(...buildToRules(build, characterId, settings));
    }
  }

  return rules;
}
