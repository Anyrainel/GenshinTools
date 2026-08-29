import {
  buildCurrentConditionArrayOccurrenceId,
  buildCurrentConditionArrayOccurrenceKey,
  type CurrentConditionArrayOccurrenceIdentity,
} from "./currentConditionBindingCatalog";
import { sha256Text, stableJson } from "./io";

export type ExactAuthoredEnergyDeferralCategory =
  | "team-energy-generation-or-rotation-frequency"
  | "team-energy-versus-sustain-tradeoff"
  | "post-energy-requirement-equipment-ranking"
  | "team-energy-support-priority"
  | "high-energy-requirement-equipment-context"
  | "post-energy-requirement-stat-priority"
  | "energy-requirement-main-stat-choice";

export interface ExactAuthoredEnergyDeferralEntry
  extends CurrentConditionArrayOccurrenceIdentity {
  occurrenceId: string;
  occurrenceKey: string;
  subject: string;
  orderedConditions: string[];
  category: ExactAuthoredEnergyDeferralCategory;
  reason: string;
}

export interface ExactAuthoredEnergyDeferralOccurrence {
  occurrenceId: string;
  conditionsSha256: string;
  subject: string;
  conditions: readonly string[];
  structuralEnergyDimension: "structural-er" | "not-structural-er";
}

interface AuthoredDefinition {
  sourceId: "kqm";
  recordKind: "character_guide";
  sourceRecordId: string;
  manualClaimPath: string;
  subject: "diona" | "furina";
  orderedConditions: readonly string[];
  conditionsSha256: string;
  category: ExactAuthoredEnergyDeferralCategory;
  reason: string;
}

const EXPECTED_ENTRY_COUNT = 9;

/**
 * This is an exact authored locator catalog, not a prose classifier. A source
 * edit changes the ordered-array hash and therefore cannot inherit a deferral.
 */
const DEFINITIONS: readonly AuthoredDefinition[] = [
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "diona-support-weapons-luna-viii",
    manualClaimPath: "recommendation.weaponRecommendations[1].conditions",
    subject: "diona",
    orderedConditions: [
      "The team values Cryo batterying or Diona can appear twice per rotation.",
    ],
    conditionsSha256:
      "0e9c01546ec5f030715c0e238dfbf3bba904f943d70c0b828c77f0ae25edfb29",
    category: "team-energy-generation-or-rotation-frequency",
    reason:
      "Team battery value and twice-per-rotation use require authored team and sequence inputs before this condition can be evaluated.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "diona-support-weapons-luna-viii",
    manualClaimPath: "recommendation.weaponRecommendations[4].conditions",
    subject: "diona",
    orderedConditions: [
      "Maximizing shield strength and healing is more important than team energy.",
    ],
    conditionsSha256:
      "08103e8077a944df71baaea7bac53b4e74a63fec31bfa156f87118121efc2e8a",
    category: "team-energy-versus-sustain-tradeoff",
    reason:
      "The authored recommendation depends on a team-level energy-versus-sustain preference that the current request context does not establish.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "furina-contextual-weapons-luna-ii",
    manualClaimPath: "recommendation.weaponRecommendations[0].conditions",
    subject: "furina",
    orderedConditions: [
      "Prioritize Furina's personal damage after meeting the rotation-specific energy requirement.",
    ],
    conditionsSha256:
      "83da57a99d93e84af4f2c62636d501692bb0f192f9796505959333c299e75cee",
    category: "post-energy-requirement-equipment-ranking",
    reason:
      "The equipment comparison starts only after a rotation-specific energy requirement has been supplied and met.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "furina-contextual-weapons-luna-ii",
    manualClaimPath: "recommendation.weaponRecommendations[1].conditions",
    subject: "furina",
    orderedConditions: [
      "Prioritize personal damage after meeting the rotation-specific energy requirement.",
      "Its performance improves when a teammate deals Geo damage.",
    ],
    conditionsSha256:
      "51f0ba216a3e10e91034af96a8fcba7ef5c06784bbe993755a0703fbeff13f51",
    category: "post-energy-requirement-equipment-ranking",
    reason:
      "The equipment comparison starts only after a rotation-specific energy requirement has been supplied and met.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "furina-contextual-weapons-luna-ii",
    manualClaimPath: "recommendation.weaponRecommendations[5].conditions",
    subject: "furina",
    orderedConditions: [
      "Use when meeting the team's energy needs is more valuable than Furina's personal damage.",
      "The source especially highlights teams with very high energy requirements for Furina; no numeric target is captured here.",
    ],
    conditionsSha256:
      "94b8b0030747525a173402ece293a4e505c6001b6592d04072e4d3d8094e61af",
    category: "team-energy-support-priority",
    reason:
      "The authored choice depends on team energy value and a missing numeric requirement, so it cannot be evaluated from the current request context.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "furina-contextual-weapons-luna-ii",
    manualClaimPath: "recommendation.weaponRecommendations[6].conditions",
    subject: "furina",
    orderedConditions: [
      "Furina's personal damage matters and her energy requirement is high.",
      "Without its full passive, the source compares it to Festering Desire; with Moonsign: Ascendant Gleam enabling the full passive, it can surpass that comparison.",
    ],
    conditionsSha256:
      "23063943ad6f10b916ebbce29fd412503e8ee4f9ae23b1f59e4195bc0ba6c8a3",
    category: "high-energy-requirement-equipment-context",
    reason:
      "The equipment context depends on an authored high-energy-requirement determination that is not currently computed.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "furina-post-er-substats-luna-ii",
    manualClaimPath: "recommendation.substats[0].conditions",
    subject: "furina",
    orderedConditions: ["After meeting the rotation-specific ER requirement."],
    conditionsSha256:
      "e8a6a983626561caee737eb6a1a7959cebf3f1b7a06653f5e3ccc894fe40bda8",
    category: "post-energy-requirement-stat-priority",
    reason:
      "The stat priority is explicitly downstream of a rotation-specific energy requirement that must be supplied separately.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "furina-post-er-substats-luna-ii",
    manualClaimPath: "recommendation.substats[1].conditions",
    subject: "furina",
    orderedConditions: ["After meeting the rotation-specific ER requirement."],
    conditionsSha256:
      "e8a6a983626561caee737eb6a1a7959cebf3f1b7a06653f5e3ccc894fe40bda8",
    category: "post-energy-requirement-stat-priority",
    reason:
      "The stat priority is explicitly downstream of a rotation-specific energy requirement that must be supplied separately.",
  },
  {
    sourceId: "kqm",
    recordKind: "character_guide",
    sourceRecordId: "furina-pre-c2-artifact-main-stats-luna-ii",
    manualClaimPath: "recommendation.mainStats.sands[0].conditions",
    subject: "furina",
    orderedConditions: [
      "Choose between HP% and ER according to the rotation-specific energy requirement.",
    ],
    conditionsSha256:
      "afd3f384f5642c3220f809485fc56efcc12d96000174da50b95bd180eea61a44",
    category: "energy-requirement-main-stat-choice",
    reason:
      "The main-stat choice requires a separately supplied rotation-specific energy requirement.",
  },
];

export function buildExactAuthoredEnergyDeferralCatalog(): ExactAuthoredEnergyDeferralEntry[] {
  if (DEFINITIONS.length !== EXPECTED_ENTRY_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ENTRY_COUNT} exact authored energy deferrals; found ${DEFINITIONS.length}.`,
    );
  }
  const entries = DEFINITIONS.map((definition) => {
    const orderedConditions = [...definition.orderedConditions];
    const computedHash = sha256Text(stableJson(orderedConditions));
    if (computedHash !== definition.conditionsSha256) {
      throw new Error(
        `Exact authored energy deferral hash drifted for ${definition.sourceRecordId}:${definition.manualClaimPath}.`,
      );
    }
    const identity: CurrentConditionArrayOccurrenceIdentity = {
      sourceId: definition.sourceId,
      recordKind: definition.recordKind,
      sourceRecordId: definition.sourceRecordId,
      manualClaimPath: definition.manualClaimPath,
      conditionsSha256: definition.conditionsSha256,
    };
    return {
      ...identity,
      occurrenceId: buildCurrentConditionArrayOccurrenceId(identity),
      occurrenceKey: buildCurrentConditionArrayOccurrenceKey(identity),
      subject: definition.subject,
      orderedConditions,
      category: definition.category,
      reason: definition.reason,
    } satisfies ExactAuthoredEnergyDeferralEntry;
  }).sort((left, right) => compareText(left.occurrenceKey, right.occurrenceKey));

  if (
    new Set(entries.map(({ occurrenceId }) => occurrenceId)).size !==
      entries.length ||
    new Set(entries.map(({ occurrenceKey }) => occurrenceKey)).size !==
      entries.length
  ) {
    throw new Error("Exact authored energy deferral catalog has duplicate identities.");
  }
  return entries;
}

export function requireExactAuthoredEnergyDeferralMatches(
  occurrences: readonly ExactAuthoredEnergyDeferralOccurrence[],
  entries: readonly ExactAuthoredEnergyDeferralEntry[],
): ReadonlyMap<string, ExactAuthoredEnergyDeferralEntry> {
  if (entries.length !== EXPECTED_ENTRY_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ENTRY_COUNT} exact authored energy deferrals; found ${entries.length}.`,
    );
  }
  const occurrencesByKey = new Map<
    string,
    ExactAuthoredEnergyDeferralOccurrence
  >(
    occurrences.map(
      (occurrence) => [
        `${occurrence.occurrenceId}:${occurrence.conditionsSha256}`,
        occurrence,
      ] as const,
    ),
  );
  if (occurrencesByKey.size !== occurrences.length) {
    throw new Error("Manual condition occurrences contain duplicate exact keys.");
  }

  const entriesByKey = new Map<string, ExactAuthoredEnergyDeferralEntry>();
  const entryIds = new Set<string>();
  for (const entry of entries) {
    if (entriesByKey.has(entry.occurrenceKey) || entryIds.has(entry.occurrenceId)) {
      throw new Error(
        `Duplicate or conflicting authored energy deferral ${entry.occurrenceId}.`,
      );
    }
    entriesByKey.set(entry.occurrenceKey, entry);
    entryIds.add(entry.occurrenceId);
    const occurrence = occurrencesByKey.get(entry.occurrenceKey);
    if (occurrence == null) {
      const sameLocator = occurrences.find(
        ({ occurrenceId }) => occurrenceId === entry.occurrenceId,
      );
      throw new Error(
        sameLocator == null
          ? `Orphan authored energy deferral ${entry.occurrenceId}.`
          : `Authored energy deferral ordered-condition hash mismatch for ${entry.occurrenceId}.`,
      );
    }
    if (
      occurrence.subject !== entry.subject ||
      occurrence.structuralEnergyDimension === "structural-er" ||
      stableJson(occurrence.conditions) !== stableJson(entry.orderedConditions)
    ) {
      throw new Error(
        `Authored energy deferral payload mismatch for ${entry.occurrenceId}.`,
      );
    }
  }
  return entriesByKey;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
