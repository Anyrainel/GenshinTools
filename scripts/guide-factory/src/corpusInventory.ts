import type {
  KnowledgeRecord,
  KnowledgeRepository,
  SourceRegistry,
} from "./schemas";

export const KNOWLEDGE_CORPUS_INVENTORY_INPUT_PATHS = [
  "scripts/guide-factory/src/corpusInventory.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  "scripts/guide-factory/sources/registry.json",
] as const;

const RECORD_KINDS = [
  "character_guide",
  "energy_guidance",
  "team",
  "team_template",
] as const;

const RECORD_STATUSES = [
  "accepted",
  "baseline",
  "candidate",
  "contested",
  "rejected",
] as const;

type RecordKind = (typeof RECORD_KINDS)[number];
type RecordStatus = (typeof RECORD_STATUSES)[number];

export interface CorpusInventoryEvidenceCounts {
  recordsWithWeapons: number;
  weaponIdOccurrences: number;
  recordsWithArtifacts: number;
  artifactChoiceOccurrences: number;
  recordsWithMainStats: number;
  mainStatGroups: number;
  mainStatIdOccurrences: number;
  recordsWithSubstats: number;
  substatGroups: number;
  substatIdOccurrences: number;
  exactTeamRecords: number;
  teamTemplateRecords: number;
  exactTeamRecordsWithRotations: number;
  exactTeamRotationEntries: number;
}

export interface CorpusInventoryRecordCounts {
  records: number;
  byKind: Record<RecordKind, number>;
  byStatus: Record<RecordStatus, number>;
  evidence: CorpusInventoryEvidenceCounts;
}

export interface CorpusInventorySource extends CorpusInventoryRecordCounts {
  sourceId: string;
  sourceKind: SourceRegistry["sources"][number]["kind"];
  ingestionMode: SourceRegistry["sources"][number]["ingestionMode"];
}

export interface CorpusInventoryCharacterPresence {
  characterId: string;
  presence: "both" | "baseline-only" | "external-only" | "neither";
  baseline: {
    recordCount: number;
    sourceIds: string[];
  };
  externalEditorial: {
    recordCount: number;
    sourceIds: string[];
  };
  other: {
    recordCount: number;
    sourceIds: string[];
  };
}

export interface KnowledgeCorpusInventoryReport {
  schemaVersion: 2;
  generatedFrom: Array<{ path: string; sha256: string }>;
  classification: "descriptive-inventory";
  supportsGuideClaims: false;
  definitions: {
    sourceCounts: string;
    evidenceCounts: string;
    exactTeams: string;
    rotations: string;
    characterPresence: string;
    externalEditorial: string;
    erExclusion: string;
  };
  prohibitedInterpretations: [
    "quality-score",
    "recommendation",
    "source-vote",
    "source-average",
    "ranking",
  ];
  totals: CorpusInventoryRecordCounts & {
    sourceAttributedRecords: number;
  };
  sources: CorpusInventorySource[];
  characters: CorpusInventoryCharacterPresence[];
}

type CharacterAccumulator = {
  baselineRecordIds: Set<string>;
  baselineSourceIds: Set<string>;
  externalRecordIds: Set<string>;
  externalSourceIds: Set<string>;
  otherRecordIds: Set<string>;
  otherSourceIds: Set<string>;
};

type EvidenceObservation = Omit<
  CorpusInventoryEvidenceCounts,
  | "recordsWithWeapons"
  | "recordsWithArtifacts"
  | "recordsWithMainStats"
  | "recordsWithSubstats"
>;

/**
 * Describe which explicit facts exist in the consolidated repository.
 *
 * This is intentionally an inventory rather than an evaluation. It does not
 * combine sources, infer missing facts, or turn record counts into quality.
 */
export function buildKnowledgeCorpusInventoryReport(
  repository: KnowledgeRepository,
  sourceRegistry: SourceRegistry,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): KnowledgeCorpusInventoryReport {
  const manifests = new Map(
    sourceRegistry.sources.map((source) => [source.id, source]),
  );
  const sourceIds = new Set(
    repository.generatedFrom.map(({ sourceId }) => sourceId),
  );
  for (const record of repository.records) {
    for (const reference of record.sourceRefs) sourceIds.add(reference.sourceId);
  }

  const sourceCounts = new Map<string, CorpusInventorySource>();
  for (const sourceId of sorted(sourceIds)) {
    const manifest = manifests.get(sourceId);
    if (!manifest) {
      throw new Error(`Corpus inventory found unregistered source ${sourceId}.`);
    }
    sourceCounts.set(sourceId, {
      sourceId,
      sourceKind: manifest.kind,
      ingestionMode: manifest.ingestionMode,
      ...emptyRecordCounts(),
    });
  }

  const totals = emptyRecordCounts();
  const characters = new Map<string, CharacterAccumulator>();
  for (const record of repository.records) {
    const observation = observeEvidence(record);
    addRecord(totals, record, observation);

    const attributedSourceIds = sorted(
      new Set(record.sourceRefs.map(({ sourceId }) => sourceId)),
    );
    for (const sourceId of attributedSourceIds) {
      const counts = sourceCounts.get(sourceId);
      if (!counts) {
        throw new Error(
          `Corpus inventory record ${record.id} references unknown source ${sourceId}.`,
        );
      }
      addRecord(counts, record, observation);
    }

    addCharacterPresence(
      characters,
      record,
      attributedSourceIds,
      manifests,
    );
  }

  const sourceAttributedRecords = [...sourceCounts.values()].reduce(
    (sum, source) => sum + source.records,
    0,
  );

  return {
    schemaVersion: 2,
    generatedFrom: generatedFrom
      .map((file) => ({ ...file }))
      .sort((left, right) => compareText(left.path, right.path)),
    classification: "descriptive-inventory",
    supportsGuideClaims: false,
    definitions: {
      sourceCounts:
        "A record is counted once for every distinct sourceId in its sourceRefs. Therefore source-attributed record totals can exceed the unique repository record count.",
      evidenceCounts:
        "recordsWith fields count records containing at least one explicit value; occurrence fields count each stored ID, choice object, stat group, or rotation entry without deduplication. Artifact occurrences include every coupled-plan assignment as a separate stored choice while preserving the plan in the repository.",
      exactTeams:
        "An exact team is a record of kind team, whose schema names exactly four characters. A team template is counted separately and is never expanded into exact teams.",
      rotations:
        "Exact-team rotation counts include only explicit RotationObservation entries attached to team records; unresolved segments are still explicit stored observations and are not treated as complete or optimal rotations.",
      characterPresence:
        "Character presence is derived only from character-guide subjects, exact-team members, and explicit character selectors in team templates. Element, role, and any selectors are not expanded.",
      externalEditorial:
        "External editorial presence means an attributed source whose registry kind is editorial or structured-editorial. Baseline presence means record status baseline; other records are reported separately.",
      erExclusion:
        "Energy-guidance records remain visible in kind and status totals, but their targets, weapon conditions, rotations, and character associations do not contribute to evidence or character-presence counts.",
    },
    prohibitedInterpretations: [
      "quality-score",
      "recommendation",
      "source-vote",
      "source-average",
      "ranking",
    ],
    totals: { ...totals, sourceAttributedRecords },
    sources: [...sourceCounts.values()].sort((left, right) =>
      compareText(left.sourceId, right.sourceId),
    ),
    characters: [...characters.entries()]
      .map(([characterId, presence]) =>
        materializeCharacterPresence(characterId, presence),
      )
      .sort((left, right) => compareText(left.characterId, right.characterId)),
  };
}

function emptyRecordCounts(): CorpusInventoryRecordCounts {
  return {
    records: 0,
    byKind: {
      character_guide: 0,
      energy_guidance: 0,
      team: 0,
      team_template: 0,
    },
    byStatus: {
      accepted: 0,
      baseline: 0,
      candidate: 0,
      contested: 0,
      rejected: 0,
    },
    evidence: {
      recordsWithWeapons: 0,
      weaponIdOccurrences: 0,
      recordsWithArtifacts: 0,
      artifactChoiceOccurrences: 0,
      recordsWithMainStats: 0,
      mainStatGroups: 0,
      mainStatIdOccurrences: 0,
      recordsWithSubstats: 0,
      substatGroups: 0,
      substatIdOccurrences: 0,
      exactTeamRecords: 0,
      teamTemplateRecords: 0,
      exactTeamRecordsWithRotations: 0,
      exactTeamRotationEntries: 0,
    },
  };
}

function addRecord(
  counts: CorpusInventoryRecordCounts,
  record: KnowledgeRecord,
  observation: EvidenceObservation,
): void {
  counts.records += 1;
  counts.byKind[record.kind] += 1;
  counts.byStatus[record.status] += 1;

  counts.evidence.weaponIdOccurrences += observation.weaponIdOccurrences;
  counts.evidence.artifactChoiceOccurrences +=
    observation.artifactChoiceOccurrences;
  counts.evidence.mainStatGroups += observation.mainStatGroups;
  counts.evidence.mainStatIdOccurrences += observation.mainStatIdOccurrences;
  counts.evidence.substatGroups += observation.substatGroups;
  counts.evidence.substatIdOccurrences += observation.substatIdOccurrences;
  counts.evidence.exactTeamRecords += observation.exactTeamRecords;
  counts.evidence.teamTemplateRecords += observation.teamTemplateRecords;
  counts.evidence.exactTeamRecordsWithRotations +=
    observation.exactTeamRecordsWithRotations;
  counts.evidence.exactTeamRotationEntries +=
    observation.exactTeamRotationEntries;

  if (observation.weaponIdOccurrences > 0) {
    counts.evidence.recordsWithWeapons += 1;
  }
  if (observation.artifactChoiceOccurrences > 0) {
    counts.evidence.recordsWithArtifacts += 1;
  }
  if (observation.mainStatGroups > 0) {
    counts.evidence.recordsWithMainStats += 1;
  }
  if (observation.substatGroups > 0) {
    counts.evidence.recordsWithSubstats += 1;
  }
}

function observeEvidence(record: KnowledgeRecord): EvidenceObservation {
  if (record.kind === "energy_guidance") return emptyEvidenceObservation();
  if (record.kind === "team_template") {
    return {
      ...emptyEvidenceObservation(),
      teamTemplateRecords: 1,
    };
  }

  if (record.kind === "team") {
    const rotations = record.rotations?.length ?? 0;
    const observation = {
      ...emptyEvidenceObservation(),
      exactTeamRecords: 1,
      exactTeamRecordsWithRotations: rotations > 0 ? 1 : 0,
      exactTeamRotationEntries: rotations,
    };
    for (const member of record.members) {
      observation.weaponIdOccurrences += member.selectedWeapon ? 1 : 0;
      observation.weaponIdOccurrences +=
        member.weaponRecommendations?.reduce(
          (sum, recommendation) => sum + recommendation.weaponIds.length,
          0,
        ) ?? 0;
      observation.artifactChoiceOccurrences += member.selectedArtifact ? 1 : 0;
      observation.artifactChoiceOccurrences +=
        member.artifactRecommendations?.reduce(
          (sum, recommendation) => sum + recommendation.artifacts.length,
          0,
        ) ?? 0;
      addMainStats(observation, member.mainStats);
      addSubstats(observation, member.substats);
    }
    observation.artifactChoiceOccurrences +=
      record.artifactPlans?.reduce(
        (sum, plan) => sum + plan.assignments.length,
        0,
      ) ?? 0;
    return observation;
  }

  const observation = emptyEvidenceObservation();
  observation.weaponIdOccurrences += record.weaponOrder?.length ?? 0;
  for (const build of record.builds) {
    observation.artifactChoiceOccurrences += 1;
    addWeightedMainStats(observation, build);
    observation.substatGroups += build.substats.length;
    observation.substatIdOccurrences += build.substats.length;
  }
  for (const recommendation of record.recommendations ?? []) {
    observation.weaponIdOccurrences +=
      recommendation.weaponRecommendations?.reduce(
        (sum, group) => sum + group.weaponIds.length,
        0,
      ) ?? 0;
    observation.artifactChoiceOccurrences +=
      recommendation.artifactRecommendations?.reduce(
        (sum, group) => sum + group.artifacts.length,
        0,
      ) ?? 0;
    addMainStats(observation, recommendation.mainStats);
    addSubstats(observation, recommendation.substats);
  }
  return observation;
}

function emptyEvidenceObservation(): EvidenceObservation {
  return {
    weaponIdOccurrences: 0,
    artifactChoiceOccurrences: 0,
    mainStatGroups: 0,
    mainStatIdOccurrences: 0,
    substatGroups: 0,
    substatIdOccurrences: 0,
    exactTeamRecords: 0,
    teamTemplateRecords: 0,
    exactTeamRecordsWithRotations: 0,
    exactTeamRotationEntries: 0,
  };
}

function addMainStats(
  observation: EvidenceObservation,
  mainStats:
    | {
        sands: Array<{ statIds: string[] }>;
        goblet: Array<{ statIds: string[] }>;
        circlet: Array<{ statIds: string[] }>;
      }
    | undefined,
): void {
  if (!mainStats) return;
  for (const slot of ["sands", "goblet", "circlet"] as const) {
    observation.mainStatGroups += mainStats[slot].length;
    observation.mainStatIdOccurrences += mainStats[slot].reduce(
      (sum, group) => sum + group.statIds.length,
      0,
    );
  }
}

function addWeightedMainStats(
  observation: EvidenceObservation,
  build: {
    sands: readonly unknown[];
    goblet: readonly unknown[];
    circlet: readonly unknown[];
  },
): void {
  for (const slot of ["sands", "goblet", "circlet"] as const) {
    observation.mainStatGroups += build[slot].length;
    observation.mainStatIdOccurrences += build[slot].length;
  }
}

function addSubstats(
  observation: EvidenceObservation,
  substats: Array<{ statIds: string[] }> | undefined,
): void {
  if (!substats) return;
  observation.substatGroups += substats.length;
  observation.substatIdOccurrences += substats.reduce(
    (sum, group) => sum + group.statIds.length,
    0,
  );
}

function addCharacterPresence(
  characters: Map<string, CharacterAccumulator>,
  record: KnowledgeRecord,
  attributedSourceIds: string[],
  manifests: ReadonlyMap<string, SourceRegistry["sources"][number]>,
): void {
  if (record.kind === "energy_guidance") return;
  const characterIds = explicitCharacterIds(record);
  if (characterIds.length === 0) return;

  const externalSourceIds = attributedSourceIds.filter((sourceId) => {
    const kind = manifests.get(sourceId)?.kind;
    return kind === "editorial" || kind === "structured-editorial";
  });
  const isBaseline = record.status === "baseline";

  for (const characterId of characterIds) {
    const presence = characters.get(characterId) ?? emptyCharacterAccumulator();
    characters.set(characterId, presence);
    if (isBaseline) {
      presence.baselineRecordIds.add(record.id);
      for (const sourceId of attributedSourceIds) {
        presence.baselineSourceIds.add(sourceId);
      }
    }
    if (externalSourceIds.length > 0) {
      presence.externalRecordIds.add(record.id);
      for (const sourceId of externalSourceIds) {
        presence.externalSourceIds.add(sourceId);
      }
    }
    if (!isBaseline && externalSourceIds.length === 0) {
      presence.otherRecordIds.add(record.id);
      for (const sourceId of attributedSourceIds) {
        presence.otherSourceIds.add(sourceId);
      }
    }
  }
}

function explicitCharacterIds(record: KnowledgeRecord): string[] {
  if (record.kind === "character_guide") return [record.characterId];
  if (record.kind === "team") {
    return sorted(new Set(record.members.map(({ characterId }) => characterId)));
  }
  if (record.kind === "team_template") {
    return sorted(
      new Set(
        record.slots.flatMap((slot) =>
          slot.options.flatMap((option) =>
            option.type === "characters" ? option.characterIds : [],
          ),
        ),
      ),
    );
  }
  return [];
}

function emptyCharacterAccumulator(): CharacterAccumulator {
  return {
    baselineRecordIds: new Set(),
    baselineSourceIds: new Set(),
    externalRecordIds: new Set(),
    externalSourceIds: new Set(),
    otherRecordIds: new Set(),
    otherSourceIds: new Set(),
  };
}

function materializeCharacterPresence(
  characterId: string,
  presence: CharacterAccumulator,
): CorpusInventoryCharacterPresence {
  const hasBaseline = presence.baselineRecordIds.size > 0;
  const hasExternal = presence.externalRecordIds.size > 0;
  return {
    characterId,
    presence:
      hasBaseline && hasExternal
        ? "both"
        : hasBaseline
          ? "baseline-only"
          : hasExternal
            ? "external-only"
            : "neither",
    baseline: {
      recordCount: presence.baselineRecordIds.size,
      sourceIds: sorted(presence.baselineSourceIds),
    },
    externalEditorial: {
      recordCount: presence.externalRecordIds.size,
      sourceIds: sorted(presence.externalSourceIds),
    },
    other: {
      recordCount: presence.otherRecordIds.size,
      sourceIds: sorted(presence.otherSourceIds),
    },
  };
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
