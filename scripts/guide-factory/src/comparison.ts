import type {
  ArtifactChoice,
  KnowledgeRecord,
  KnowledgeRepository,
  ManualObservationSnapshot,
} from "./schemas";

export const DIONA_COMPARISON_INPUT_PATHS = [
  "scripts/guide-factory/src/comparison.ts",
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json",
] as const;

type SetRelation =
  | "same"
  | "overlap"
  | "disjoint"
  | "source-only"
  | "baseline-only"
  | "not-comparable";

type ScopeRelation =
  | "same"
  | "source-narrower"
  | "baseline-narrower"
  | "different"
  | "unknown";

type OrderingRelation =
  | "same"
  | "different"
  | "source-unranked"
  | "baseline-unranked"
  | "not-applicable"
  | "not-comparable";

export interface ComparisonAssertion {
  id: string;
  dimension: string;
  source: Array<{ knowledgeRecordId: string; fieldPointer: string }>;
  baseline: Array<{ knowledgeRecordId: string; fieldPointer: string }>;
  baselineLookup?: string;
  relation: SetRelation;
  scopeRelation: ScopeRelation;
  orderingRelation: OrderingRelation;
  shared: string[];
  sourceOnly: string[];
  baselineOnly: string[];
  caveats: string[];
  sourceExtractionReviewStatus: "unreviewed" | "reviewed";
  promotionEligible: boolean;
}

export interface DionaComparisonReport {
  schemaVersion: 1;
  subject: "diona";
  generatedFrom: Array<{ path: string; sha256: string }>;
  assertions: ComparisonAssertion[];
  prohibitedAggregates: [
    "winner",
    "confidence",
    "vote-count",
    "merged-order",
  ];
}

type CharacterGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type Team = Extract<KnowledgeRecord, { kind: "team" }>;
type EnergyGuidance = Extract<
  KnowledgeRecord,
  { kind: "energy_guidance" }
>;

const KQM_DIONA_WEAPONS_ID =
  "kqm:character-guide:diona-support-weapons-luna-viii";
const KQM_DIONA_ARTIFACT_SETS_ID =
  "kqm:character-guide:diona-support-artifact-sets-luna-viii";
const KQM_DIONA_ARTIFACT_STATS_ID =
  "kqm:character-guide:diona-support-artifact-stats-luna-viii";
const KQM_DIONA_ENERGY_ID =
  "kqm:energy-guidance:c6-diona-mavuika-citlali-bennett-er";
const KQM_DIONA_TEAM_ID =
  "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt";

export function buildDionaComparisonReport(
  repository: KnowledgeRepository,
  snapshot: ManualObservationSnapshot,
  generatedFrom: Array<{ path: string; sha256: string }>
): DionaComparisonReport {
  const baseline = requiredCharacterGuide(
    repository,
    "genshintools-presets:character-guide:diona"
  );
  const baselineBuild = baseline.builds[0];
  if (!baselineBuild) throw new Error("Diona baseline has no build record");

  const weapons = requiredScopedRecommendation(
    repository,
    KQM_DIONA_WEAPONS_ID,
    "weapons"
  );
  const artifactSets = requiredScopedRecommendation(
    repository,
    KQM_DIONA_ARTIFACT_SETS_ID,
    "artifact-sets"
  );
  const artifactStats = requiredScopedRecommendation(
    repository,
    KQM_DIONA_ARTIFACT_STATS_ID,
    "artifact-stats"
  );
  const energy = requiredEnergyGuidance(repository, KQM_DIONA_ENERGY_ID);
  const team = requiredCandidateTeam(repository, KQM_DIONA_TEAM_ID);
  const weaponsState = assertionState(snapshot, weapons.record);
  const artifactSetsState = assertionState(snapshot, artifactSets.record);
  const artifactStatsState = assertionState(snapshot, artifactStats.record);
  const energyState = assertionState(snapshot, energy);
  const teamState = assertionState(snapshot, team);

  const assertions: ComparisonAssertion[] = [];
  assertions.push(
    compareSets({
      id: "diona-weapons",
      dimension: "weapons",
      source: weapons.recommendation.weaponRecommendations?.flatMap(
        ({ weaponIds }) => weaponIds
      ) ?? [],
      baseline: baseline.weaponOrder ?? [],
      sourceRefs: [fieldRef(weapons.record, "/recommendations/0/weaponRecommendations")],
      baselineRefs: [fieldRef(baseline, "/weaponOrder")],
      scopeRelation: "unknown",
      orderingRelation: "not-comparable",
      caveats: [
        "KQM explicitly supplies an unranked list while qualifying Favonius Warbow as its default.",
        "The baseline does not disclose the team or refinement assumptions behind its weapon order.",
      ],
      ...weaponsState,
    }),
    compareSets({
      id: "diona-artifact-sets",
      dimension: "artifact sets",
      source:
        artifactSets.recommendation.artifactRecommendations?.flatMap(
          ({ artifacts }) => artifacts.map(artifactKey)
        ) ?? [],
      baseline: [artifactKey(baselineBuild.artifact)],
      sourceRefs: [
        fieldRef(artifactSets.record, "/recommendations/0/artifactRecommendations"),
      ],
      baselineRefs: [fieldRef(baseline, "/builds/0/artifact")],
      scopeRelation: "unknown",
      orderingRelation: "not-comparable",
      caveats: [
        "KQM's additional sets are conditional rather than a global ranking.",
        "The baseline build has unknown team applicability.",
      ],
      ...artifactSetsState,
    })
  );

  const sourceMainStats = artifactStats.recommendation.mainStats;
  if (!sourceMainStats) {
    throw new Error("Diona artifact-stat record has no main-stat guidance");
  }
  for (const [slot, orderingRelation] of [
    ["sands", "source-unranked"],
    ["goblet", "not-applicable"],
    ["circlet", "different"],
  ] as const) {
    assertions.push(
      compareSets({
        id: `diona-${slot}`,
        dimension: `${slot} main stats`,
        source: sourceMainStats[slot].flatMap(({ statIds }) => statIds),
        baseline: baselineBuild[slot].map(({ stat }) => stat),
        sourceRefs: [
          fieldRef(
            artifactStats.record,
            `/recommendations/0/mainStats/${slot}`
          ),
        ],
        baselineRefs: [fieldRef(baseline, `/builds/0/${slot}`)],
        scopeRelation: "unknown",
        orderingRelation,
        caveats:
          slot === "circlet"
            ? [
                "KQM places HP% above Healing Bonus and adds CRIT Rate only for Favonius Warbow; the baseline ties HP% and Healing Bonus at weight 100.",
              ]
            : slot === "sands"
              ? ["KQM presents HP% and ER as alternatives without ranking them."]
              : [],
        ...artifactStatsState,
      })
    );
  }

  assertions.push(
    compareSets({
      id: "diona-substats",
      dimension: "substats",
      source:
        artifactStats.recommendation.substats?.flatMap(({ statIds }) => statIds) ??
        [],
      baseline: baselineBuild.substats.map(({ stat }) => stat),
      sourceRefs: [fieldRef(artifactStats.record, "/recommendations/0/substats")],
      baselineRefs: [fieldRef(baseline, "/builds/0/substats")],
      scopeRelation: "unknown",
      orderingRelation: "different",
      caveats: [
        "KQM prioritizes ER only until a scenario-specific target, then HP%; the baseline weights HP% above ER without an ER target.",
      ],
      ...artifactStatsState,
    })
  );

  const erValues = energy.targets.map((target) => {
    const weapon =
      target.weapon?.type === "specific"
        ? target.weapon.weaponIds.join("+")
        : `${target.weapon?.weaponType ?? "unspecified"}:other`;
    const supporting =
      target.supportingCalculationPercent == null
        ? ""
        : `; supporting sheet ${target.supportingDisplayedPercent}% (raw ${target.supportingCalculationPercent}%)`;
    return `${weapon}:${target.minPercent}-${target.maxPercent}%${supporting}`;
  });
  assertions.push(
    sourceOnlyAssertion({
      id: "diona-er-guidance",
      dimension: "ER guidance",
      values: erValues,
      sourceRefs: [fieldRef(energy, "/targets")],
      baselineLookup:
        "genshintools-presets:character-guide:diona has no ER target, and no exact baseline team matches the source team.",
      caveats: [
        "The page bands and sheet cells are formatted displays; raw supporting calculation values are recorded separately.",
        "The guide version and calculation-sheet version remain separate provenance facts.",
      ],
      ...energyState,
    })
  );

  const signature = teamSignature(team);
  const exactBaselineTeam = repository.records.find(
    (record): record is Team =>
      record.kind === "team" &&
      record.status === "baseline" &&
      teamSignature(record) === signature
  );
  assertions.push(
    compareSets({
      id: "diona-forward-melt-team",
      dimension: "exact team composition",
      source: [signature],
      baseline: exactBaselineTeam ? [teamSignature(exactBaselineTeam)] : [],
      sourceRefs: [fieldRef(team, "/members")],
      baselineRefs: exactBaselineTeam
        ? [fieldRef(exactBaselineTeam, "/members")]
        : [],
      baselineLookup:
        "Exact unordered four-character match among GenshinTools baseline teams.",
      scopeRelation: "unknown",
      orderingRelation: "not-applicable",
      caveats: [
        "KQM labels this an example in a non-exhaustive list and makes no power-ranking claim.",
        "No nearest-neighbor team is substituted for the absent exact match.",
      ],
      ...teamState,
    }),
    sourceOnlyAssertion({
      id: "diona-forward-melt-rotation",
      dimension: "rotation",
      values: team.rotations?.map(({ notation }) => notation) ?? [],
      sourceRefs: [fieldRef(team, "/rotations")],
      baselineLookup: "The exact baseline team is absent.",
      caveats: [
        "Mavuika Q combo remains an unresolved source shorthand rather than an inferred formula sequence.",
      ],
      ...teamState,
    })
  );

  return {
    schemaVersion: 1,
    subject: "diona",
    generatedFrom: [...generatedFrom].sort((left, right) =>
      left.path.localeCompare(right.path)
    ),
    assertions,
    prohibitedAggregates: [
      "winner",
      "confidence",
      "vote-count",
      "merged-order",
    ],
  };
}

function compareSets(input: {
  id: string;
  dimension: string;
  source: string[];
  baseline: string[];
  sourceRefs: ComparisonAssertion["source"];
  baselineRefs: ComparisonAssertion["baseline"];
  scopeRelation: ScopeRelation;
  orderingRelation: OrderingRelation;
  caveats: string[];
  reviewStatus: "unreviewed" | "reviewed";
  promotionEligible: boolean;
  baselineLookup?: string;
}): ComparisonAssertion {
  const source = new Set(input.source);
  const baseline = new Set(input.baseline);
  const shared = sorted([...source].filter((value) => baseline.has(value)));
  const sourceOnly = sorted(
    [...source].filter((value) => !baseline.has(value))
  );
  const baselineOnly = sorted(
    [...baseline].filter((value) => !source.has(value))
  );
  let relation: SetRelation;
  if (source.size === 0) relation = "baseline-only";
  else if (baseline.size === 0) relation = "source-only";
  else if (sourceOnly.length === 0 && baselineOnly.length === 0)
    relation = "same";
  else if (shared.length > 0) relation = "overlap";
  else relation = "disjoint";

  return {
    id: input.id,
    dimension: input.dimension,
    source: input.sourceRefs,
    baseline: input.baselineRefs,
    ...(input.baselineLookup
      ? { baselineLookup: input.baselineLookup }
      : {}),
    relation,
    scopeRelation: input.scopeRelation,
    orderingRelation: input.orderingRelation,
    shared,
    sourceOnly,
    baselineOnly,
    caveats: input.caveats,
    sourceExtractionReviewStatus: input.reviewStatus,
    promotionEligible: input.promotionEligible,
  };
}

function sourceOnlyAssertion(input: {
  id: string;
  dimension: string;
  values: string[];
  sourceRefs: ComparisonAssertion["source"];
  baselineLookup: string;
  caveats: string[];
  reviewStatus: "unreviewed" | "reviewed";
  promotionEligible: boolean;
}): ComparisonAssertion {
  return {
    id: input.id,
    dimension: input.dimension,
    source: input.sourceRefs,
    baseline: [],
    baselineLookup: input.baselineLookup,
    relation: "source-only",
    scopeRelation: "unknown",
    orderingRelation: "not-applicable",
    shared: [],
    sourceOnly: sorted(input.values),
    baselineOnly: [],
    caveats: input.caveats,
    sourceExtractionReviewStatus: input.reviewStatus,
    promotionEligible: input.promotionEligible,
  };
}

function requiredCharacterGuide(
  repository: KnowledgeRepository,
  id: string
): CharacterGuide {
  const record = repository.records.find((candidate) => candidate.id === id);
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Missing character guide ${id}`);
  }
  return record;
}

function requiredScopedRecommendation(
  repository: KnowledgeRepository,
  recordId: string,
  scope: "weapons" | "artifact-sets" | "artifact-stats"
): { record: CharacterGuide; recommendation: NonNullable<CharacterGuide["recommendations"]>[number] } {
  const record = requiredCharacterGuide(repository, recordId);
  const recommendation = record.recommendations?.find(
    (candidate) => candidate.scope === scope
  );
  if (!recommendation) {
    throw new Error(`Missing ${scope} recommendation on ${recordId}`);
  }
  return { record, recommendation };
}

function requiredEnergyGuidance(
  repository: KnowledgeRepository,
  recordId: string
): EnergyGuidance {
  const record = repository.records.find((candidate) => candidate.id === recordId);
  if (!record || record.kind !== "energy_guidance") {
    throw new Error(`Missing energy guidance ${recordId}`);
  }
  return record;
}

function requiredCandidateTeam(
  repository: KnowledgeRepository,
  recordId: string
): Team {
  const expected = "bennett+citlali+diona+mavuika";
  const record = repository.records.find((candidate) => candidate.id === recordId);
  if (!record || record.kind !== "team") {
    throw new Error(`Missing team ${recordId}`);
  }
  if (teamSignature(record) !== expected) {
    throw new Error(`${recordId} no longer has the expected team composition`);
  }
  return record;
}

function assertionState(
  snapshot: ManualObservationSnapshot,
  record: KnowledgeRecord
): {
  reviewStatus: "unreviewed" | "reviewed";
  promotionEligible: boolean;
} {
  const sourceRecordIds = new Set(
    record.sourceRefs
      .filter(({ sourceId }) => sourceId === snapshot.sourceId)
      .map(({ sourceRecordId }) => sourceRecordId)
  );
  if (sourceRecordIds.size === 0) {
    throw new Error(`${record.id} has no ${snapshot.sourceId} source record`);
  }
  const sourceRecords = snapshot.records.filter(({ sourceRecordId }) =>
    sourceRecordIds.has(sourceRecordId)
  );
  if (sourceRecords.length !== sourceRecordIds.size) {
    throw new Error(`${record.id} has an unresolved manual source record`);
  }
  return {
    reviewStatus: sourceRecords.every(
      ({ extraction }) => extraction.reviewStatus === "reviewed"
    )
      ? "reviewed"
      : "unreviewed",
    promotionEligible: record.promotionEligible === true,
  };
}

function fieldRef(
  record: KnowledgeRecord,
  fieldPointer: string
): { knowledgeRecordId: string; fieldPointer: string } {
  return { knowledgeRecordId: record.id, fieldPointer };
}

function artifactKey(artifact: ArtifactChoice): string {
  return artifact.type === "4pc"
    ? `4pc:${artifact.setId}`
    : `2pc+2pc:${artifact.halfSetIds.join("+")}`;
}

function teamSignature(team: Team): string {
  return sorted(team.members.map(({ characterId }) => characterId)).join("+");
}

function sorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
