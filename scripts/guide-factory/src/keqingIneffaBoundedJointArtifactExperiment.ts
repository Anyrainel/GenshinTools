import {
  runBoundedJointArtifactExperiment,
  type BoundedJointArtifactExperimentEnvironment,
  type BoundedJointArtifactExperimentInput,
  type BoundedJointArtifactExperimentReport,
} from "./boundedJointArtifactExperiment";
import {
  runCachedBestImprovementCoordinateDescent,
  selectCachedTableBestComparableReference,
  traceCachedBeamCoverage,
  type BoundedLatticeNodeTable,
  type CachedBeamCoverageTrace,
  type CachedCoordinateDescentTrace,
  type CachedTableBestReference,
} from "./boundedLatticePolicy";
import {
  buildKeqingIneffaArtifactGenerationTechnicalProbeInput,
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
} from "./keqingIneffaArtifactGenerationTechnicalProbe";
import { buildKeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import type { FormulaPlanDraftLine } from "./formulaPlanDraft";
import type { KnowledgeRepository } from "./schemas";

export const KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/artifactGenerationSensitivityProbe.ts",
    "scripts/guide-factory/src/boundedJointArtifactExperiment.ts",
    "scripts/guide-factory/src/boundedLatticePolicy.ts",
    "scripts/guide-factory/src/computationReplay.ts",
    "scripts/guide-factory/src/io.ts",
    "scripts/guide-factory/src/keqingIneffaBoundedJointArtifactExperiment.ts",
    ...KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
    "src/data/enums.ts",
    "src/data/types.ts",
  ]),
] as const;

export const KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS = [
  "01-seed-aubade-golden",
  "02-aubade-tenacity",
  "03-silken-golden",
  "04-silken-tenacity",
] as const;

export const KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS = [
  "keqing",
  "ineffa",
  "furina",
  "xilonen",
] as const;

const AUBADE_SET_ID = "aubade_of_morningstar_and_moon";
const SILKEN_SET_ID = "silken_moons_serenade";
const GOLDEN_SET_ID = "golden_troupe";
const TENACITY_SET_ID = "tenacity_of_the_millelith";
const KEQING_FIXED_SET_ID = "thundering_fury";
const XILONEN_FIXED_SET_ID = "scroll_of_the_hero_of_cinder_city";

type BoundedJointCandidateId =
  (typeof KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS)[number];

const EXPECTED_NODE_COORDINATES: Record<
  BoundedJointCandidateId,
  { ineffaArtifactSetId: string; furinaArtifactSetId: string }
> = {
  "01-seed-aubade-golden": {
    ineffaArtifactSetId: AUBADE_SET_ID,
    furinaArtifactSetId: GOLDEN_SET_ID,
  },
  "02-aubade-tenacity": {
    ineffaArtifactSetId: AUBADE_SET_ID,
    furinaArtifactSetId: TENACITY_SET_ID,
  },
  "03-silken-golden": {
    ineffaArtifactSetId: SILKEN_SET_ID,
    furinaArtifactSetId: GOLDEN_SET_ID,
  },
  "04-silken-tenacity": {
    ineffaArtifactSetId: SILKEN_SET_ID,
    furinaArtifactSetId: TENACITY_SET_ID,
  },
};

export type KeqingIneffaCachedPolicyReplay =
  | {
      status: "available";
      evaluationSource: "evaluated-four-node-cache-only";
      evaluatorCalls: 0;
      coordinateDescent: CachedCoordinateDescentTrace;
      boundedTableReference: Extract<
        CachedTableBestReference,
        { status: "selected" }
      >;
      dimensionEffectSummary: {
        classification: "cached-four-node-technical-objective-sensitivity";
        evaluationSource: "evaluated-four-node-cache-only";
        objectiveSource: "node-bounded-reference-compositions";
        supportsArtifactSuitabilityClaims: false;
        supportsCausalGamePerformanceClaims: false;
        ineffaArtifactSetEdges: [CachedObjectiveEdge, CachedObjectiveEdge];
        furinaArtifactSetEdges: [CachedObjectiveEdge, CachedObjectiveEdge];
        observations: {
          bothIneffaSetEdgesAreExactZero: true;
          bothFurinaSetEdgesShareExactPositiveDelta: true;
        };
        caution: "Zero or positive edge sensitivity under this unreviewed objective can reveal objective blindness or implementation behavior; it does not establish artifact suitability or causal game performance.";
      };
      beamCoverage: CachedBeamCoverageTrace;
      cautions: [
        "Coordinate descent replays only the cached four-node table; it does not warm-start or invoke the artifact generator.",
        "Beam output is a non-calibrated, non-exhaustive coverage trace, not a quality or optimality result.",
        "Singular node IDs in cached traces are deterministic representatives; exact-objective ties remain explicit in boundedTableReference.equivalentNodeIds.",
      ];
    }
  | {
      status: "withheld-due-to-incomparable-node";
      evaluationSource: "not-run";
      evaluatorCalls: 0;
      incomparableNodeIds: string[];
      reason: "At least one node-generation, capture, configuration, or composition-evaluation step failed, so no cross-node cached policy comparison was run.";
    };

export type KeqingIneffaBoundedJointArtifactExperimentReport =
  BoundedJointArtifactExperimentReport & {
    technicalObjectiveProvenance: {
      classification: "fixture-wrapper-objective-provenance";
      supportsGuideClaims: false;
      sourceBindingEstablishedByCore: false;
      derivation: "exact-authored-translation-comparisons";
      formulaDraftFixtureId: "keqing-ineffa-source-rotation-comparison-v1";
      sourceTeamRecordId: string;
      sourceRotationRecordId: string;
      sourceRotationId: string;
      reviewStatus: "unreviewed";
      formulaLineCount: number;
      exactClaimCount: number;
      completeTokenMappingCount: number;
      partialTokenMappingCount: number;
      readiness: {
        readyForDamageReplay: false;
        blockerCount: number;
        blockerCodes: string[];
      };
    };
    cachedPolicyReplay: KeqingIneffaCachedPolicyReplay;
  };

/**
 * Exhaust the four valid 5-star set nodes under all four team-member carries,
 * then replay cached policies only if every node is fully comparable.
 */
export async function runKeqingIneffaBoundedJointArtifactExperiment(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  environment?: BoundedJointArtifactExperimentEnvironment,
): Promise<KeqingIneffaBoundedJointArtifactExperimentReport> {
  const fixture = await buildKeqingIneffaBoundedJointFixture(
    repository,
    generatedFrom,
  );
  const report = await runBoundedJointArtifactExperiment(
    fixture.input,
    environment,
  );

  return {
    ...report,
    technicalObjectiveProvenance: fixture.technicalObjectiveProvenance,
    cachedPolicyReplay: buildKeqingIneffaCachedPolicyReplay(report),
  };
}

export async function buildKeqingIneffaBoundedJointArtifactExperimentInput(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): Promise<BoundedJointArtifactExperimentInput> {
  return (
    await buildKeqingIneffaBoundedJointFixture(repository, generatedFrom)
  ).input;
}

async function buildKeqingIneffaBoundedJointFixture(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }>,
): Promise<{
  input: BoundedJointArtifactExperimentInput;
  technicalObjectiveProvenance: KeqingIneffaBoundedJointArtifactExperimentReport["technicalObjectiveProvenance"];
}> {
  const [baseProbeInput, formulaDraft] = await Promise.all([
    buildKeqingIneffaArtifactGenerationTechnicalProbeInput(repository, []),
    buildKeqingIneffaFormulaDraftReport(repository, []),
  ]);
  const unreviewedTechnicalFormulaLines =
    unreviewedTechnicalAuthoredTranslationLines(formulaDraft);
  const mappingSummary = formulaDraft.damageReplayReadiness.sourceMappingSummary;
  const blockers = formulaDraft.damageReplayReadiness.blockers;
  if (
    formulaDraft.damageReplayReadiness.reviewStatus !== "unreviewed" ||
    formulaDraft.damageReplayReadiness.readyForDamageReplay
  ) {
    throw new Error(
      "The Keqing/Ineffa bounded fixture must retain its unreviewed, replay-blocked readiness state.",
    );
  }

  return {
    input: {
      baseProbeInput,
      candidateIds: [...KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS],
      carryCharacterIds: [...KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS],
      unreviewedTechnicalFormulaLines,
      generatedFrom: generatedFrom.map((entry) => ({ ...entry })),
    },
    technicalObjectiveProvenance: {
      classification: "fixture-wrapper-objective-provenance",
      supportsGuideClaims: false,
      sourceBindingEstablishedByCore: false,
      derivation: "exact-authored-translation-comparisons",
      formulaDraftFixtureId: formulaDraft.fixtureId,
      sourceTeamRecordId: formulaDraft.sourceTeamRecordId,
      sourceRotationRecordId: formulaDraft.sourceRotation.recordId,
      sourceRotationId: formulaDraft.sourceRotation.rotationId,
      reviewStatus: formulaDraft.authoredTranslation.reviewStatus,
      formulaLineCount: unreviewedTechnicalFormulaLines.length,
      exactClaimCount: mappingSummary.exactClaims,
      completeTokenMappingCount: mappingSummary.completeTokenMappings,
      partialTokenMappingCount: mappingSummary.partialTokenMappings,
      readiness: {
        readyForDamageReplay: false,
        blockerCount: blockers.length,
        blockerCodes: blockers.map(({ code }) => code),
      },
    },
  };
}

export function buildKeqingIneffaCachedPolicyReplay(
  report: BoundedJointArtifactExperimentReport,
): KeqingIneffaCachedPolicyReplay {
  const incomparableNodeIds = report.nodes
    .filter(({ comparisonStatus }) => comparisonStatus !== "comparable")
    .map(({ nodeId }) => nodeId);
  if (incomparableNodeIds.length > 0) {
    if (report.boundedReferenceComposition !== null) {
      throw new Error(
        "A bounded joint experiment with an incomparable node must not expose a cross-node reference.",
      );
    }
    return {
      status: "withheld-due-to-incomparable-node",
      evaluationSource: "not-run",
      evaluatorCalls: 0,
      incomparableNodeIds,
      reason:
        "At least one node-generation, capture, configuration, or composition-evaluation step failed, so no cross-node cached policy comparison was run.",
    };
  }

  if (report.nodes.length !== 4 || !report.boundedReferenceComposition) {
    throw new Error(
      "The Keqing/Ineffa cached policy replay requires four comparable nodes and a bounded cross-node reference.",
    );
  }

  const table = buildEvaluatedFourNodeTable(report);
  const tolerance = { absolute: 0, relative: 0 } as const;
  const startNodeId = KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS[0];
  const boundedTableReference = selectCachedTableBestComparableReference(
    table,
    "maximize",
    tolerance,
  );
  if (boundedTableReference.status !== "selected") {
    throw new Error(
      "The evaluated four-node table unexpectedly withheld its cached reference.",
    );
  }
  const coreEquivalentNodeIds = [
    ...new Set(
      report.boundedReferenceComposition.equivalentReferences.map(
        ({ nodeId }) => nodeId,
      ),
    ),
  ].sort();
  if (
    boundedTableReference.equivalentNodeIds.length !==
      coreEquivalentNodeIds.length ||
    boundedTableReference.equivalentNodeIds.some(
      (nodeId, index) => nodeId !== coreEquivalentNodeIds[index],
    )
  ) {
    throw new Error(
      "Cached table reference ties do not match the core bounded-reference equivalence class.",
    );
  }

  return {
    status: "available",
    evaluationSource: "evaluated-four-node-cache-only",
    evaluatorCalls: 0,
    coordinateDescent: runCachedBestImprovementCoordinateDescent({
      table,
      startNodeId,
      direction: "maximize",
      tolerance,
    }),
    boundedTableReference,
    dimensionEffectSummary: buildDimensionEffectSummary(table),
    beamCoverage: traceCachedBeamCoverage({
      table,
      startNodeId,
      direction: "maximize",
      tolerance,
      width: 1,
      maxDepth: 2,
    }),
    cautions: [
      "Coordinate descent replays only the cached four-node table; it does not warm-start or invoke the artifact generator.",
      "Beam output is a non-calibrated, non-exhaustive coverage trace, not a quality or optimality result.",
      "Singular node IDs in cached traces are deterministic representatives; exact-objective ties remain explicit in boundedTableReference.equivalentNodeIds.",
    ],
  };
}

type CachedObjectiveEdge = {
  fromNodeId: string;
  toNodeId: string;
  unreviewedTechnicalObjectiveDelta: number;
  relation: "exact-zero" | "positive";
};

function buildDimensionEffectSummary(
  table: BoundedLatticeNodeTable,
): Extract<
  KeqingIneffaCachedPolicyReplay,
  { status: "available" }
>["dimensionEffectSummary"] {
  const ineffaArtifactSetEdges: [CachedObjectiveEdge, CachedObjectiveEdge] = [
    cachedObjectiveEdge(
      table,
      requireNodeIdAtCoordinates(table, AUBADE_SET_ID, GOLDEN_SET_ID),
      requireNodeIdAtCoordinates(table, SILKEN_SET_ID, GOLDEN_SET_ID),
    ),
    cachedObjectiveEdge(
      table,
      requireNodeIdAtCoordinates(table, AUBADE_SET_ID, TENACITY_SET_ID),
      requireNodeIdAtCoordinates(table, SILKEN_SET_ID, TENACITY_SET_ID),
    ),
  ];
  const furinaArtifactSetEdges: [CachedObjectiveEdge, CachedObjectiveEdge] = [
    cachedObjectiveEdge(
      table,
      requireNodeIdAtCoordinates(table, AUBADE_SET_ID, GOLDEN_SET_ID),
      requireNodeIdAtCoordinates(table, AUBADE_SET_ID, TENACITY_SET_ID),
    ),
    cachedObjectiveEdge(
      table,
      requireNodeIdAtCoordinates(table, SILKEN_SET_ID, GOLDEN_SET_ID),
      requireNodeIdAtCoordinates(table, SILKEN_SET_ID, TENACITY_SET_ID),
    ),
  ];
  if (
    ineffaArtifactSetEdges.some(
      ({ unreviewedTechnicalObjectiveDelta }) =>
        unreviewedTechnicalObjectiveDelta !== 0,
    ) ||
    furinaArtifactSetEdges.some(
      ({ unreviewedTechnicalObjectiveDelta }) =>
        unreviewedTechnicalObjectiveDelta <= 0,
    ) ||
    furinaArtifactSetEdges[0].unreviewedTechnicalObjectiveDelta !==
      furinaArtifactSetEdges[1].unreviewedTechnicalObjectiveDelta
  ) {
    throw new Error(
      "The current four-node dimension-effect invariants changed; review the bounded objective before regenerating this fixture report.",
    );
  }

  return {
    classification: "cached-four-node-technical-objective-sensitivity",
    evaluationSource: "evaluated-four-node-cache-only",
    objectiveSource: "node-bounded-reference-compositions",
    supportsArtifactSuitabilityClaims: false,
    supportsCausalGamePerformanceClaims: false,
    ineffaArtifactSetEdges,
    furinaArtifactSetEdges,
    observations: {
      bothIneffaSetEdgesAreExactZero: true,
      bothFurinaSetEdgesShareExactPositiveDelta: true,
    },
    caution:
      "Zero or positive edge sensitivity under this unreviewed objective can reveal objective blindness or implementation behavior; it does not establish artifact suitability or causal game performance.",
  };
}

function cachedObjectiveEdge(
  table: BoundedLatticeNodeTable,
  fromNodeId: string,
  toNodeId: string,
): CachedObjectiveEdge {
  const from = requireCachedObjective(table, fromNodeId);
  const to = requireCachedObjective(table, toNodeId);
  const delta = Number((to - from).toPrecision(15));
  return {
    fromNodeId,
    toNodeId,
    unreviewedTechnicalObjectiveDelta: delta,
    relation: delta === 0 ? "exact-zero" : "positive",
  };
}

function requireCachedObjective(
  table: BoundedLatticeNodeTable,
  nodeId: string,
): number {
  const result = table.nodes.find((node) => node.nodeId === nodeId)?.cachedResult;
  if (!result || result.status !== "comparable") {
    throw new Error(`Missing comparable cached objective for node ${nodeId}.`);
  }
  return result.technicalObjective;
}

function requireNodeIdAtCoordinates(
  table: BoundedLatticeNodeTable,
  ineffaArtifactSetId: string,
  furinaArtifactSetId: string,
): string {
  const matching = table.nodes.filter(
    ({ coordinates }) =>
      coordinates.ineffaArtifactSetId === ineffaArtifactSetId &&
      coordinates.furinaArtifactSetId === furinaArtifactSetId,
  );
  if (matching.length !== 1) {
    throw new Error(
      `Expected one bounded node at Ineffa=${ineffaArtifactSetId}, Furina=${furinaArtifactSetId}; found ${matching.length}.`,
    );
  }
  return matching[0].nodeId;
}

function unreviewedTechnicalAuthoredTranslationLines(
  formulaDraft: Awaited<ReturnType<typeof buildKeqingIneffaFormulaDraftReport>>,
): FormulaPlanDraftLine[] {
  if (formulaDraft.authoredTranslation.reviewStatus !== "unreviewed") {
    throw new Error(
      "The bounded experiment must retain the authored translation's unreviewed status.",
    );
  }

  return formulaDraft.authoredTranslation.formulaComparisons.map(
    ({ characterId, formulaId, sourceCountClaim }) => {
      if (sourceCountClaim.type !== "exact") {
        throw new Error(
          `Bounded experiment requires an exact source count for ${characterId}.${formulaId}.`,
        );
      }
      return {
        characterId,
        formulaId,
        count: sourceCountClaim.value,
      };
    },
  );
}

function buildEvaluatedFourNodeTable(
  report: BoundedJointArtifactExperimentReport,
): BoundedLatticeNodeTable {
  validateKeqingIneffaFourNodeGeometry(report);
  return {
    dimensions: ["ineffaArtifactSetId", "furinaArtifactSetId"],
    nodes: report.nodes.map((node) => {
      if (
        node.comparisonStatus !== "comparable" ||
        !node.boundedReferenceComposition
      ) {
        throw new Error(
          `Cached policy table cannot include incomparable node ${node.nodeId}.`,
        );
      }
      const ineffaArtifactSetId =
        node.requestedArtifactSetIdsByCharacter.ineffa;
      const furinaArtifactSetId =
        node.requestedArtifactSetIdsByCharacter.furina;
      if (!ineffaArtifactSetId || !furinaArtifactSetId) {
        throw new Error(
          `Cached policy node ${node.nodeId} is missing an Ineffa or Furina set coordinate.`,
        );
      }
      return {
        nodeId: node.nodeId,
        coordinates: { ineffaArtifactSetId, furinaArtifactSetId },
        cachedResult: {
          status: "comparable" as const,
          technicalObjective:
            node.boundedReferenceComposition.unreviewedTechnicalObjective,
        },
      };
    }),
  };
}

function validateKeqingIneffaFourNodeGeometry(
  report: BoundedJointArtifactExperimentReport,
): void {
  const expectedNodeIds = [...KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS].sort();
  const actualNodeIds = report.nodes.map(({ nodeId }) => nodeId).sort();
  if (
    actualNodeIds.length !== expectedNodeIds.length ||
    new Set(actualNodeIds).size !== expectedNodeIds.length ||
    actualNodeIds.some((nodeId, index) => nodeId !== expectedNodeIds[index])
  ) {
    throw new Error(
      `Keqing/Ineffa bounded geometry requires exact unique node IDs ${expectedNodeIds.join(", ")}.`,
    );
  }

  const coordinateOwners = new Map<string, string>();
  const ineffaValues = new Set<string>();
  const furinaValues = new Set<string>();
  const keqingValues = new Set<string>();
  const xilonenValues = new Set<string>();
  const coordinatesByNodeId = new Map<
    string,
    { ineffaArtifactSetId: string; furinaArtifactSetId: string }
  >();
  for (const node of report.nodes) {
    const assignments = node.requestedArtifactSetIdsByCharacter;
    const ineffaArtifactSetId = assignments.ineffa;
    const furinaArtifactSetId = assignments.furina;
    const keqingArtifactSetId = assignments.keqing;
    const xilonenArtifactSetId = assignments.xilonen;
    if (
      !ineffaArtifactSetId ||
      !furinaArtifactSetId ||
      !keqingArtifactSetId ||
      !xilonenArtifactSetId
    ) {
      throw new Error(
        `Bounded node ${node.nodeId} is missing an Ineffa, Furina, Keqing, or Xilonen artifact assignment.`,
      );
    }

    ineffaValues.add(ineffaArtifactSetId);
    furinaValues.add(furinaArtifactSetId);
    keqingValues.add(keqingArtifactSetId);
    xilonenValues.add(xilonenArtifactSetId);
    const coordinateKey = artifactCoordinateKey(
      ineffaArtifactSetId,
      furinaArtifactSetId,
    );
    const existingOwner = coordinateOwners.get(coordinateKey);
    if (existingOwner) {
      throw new Error(
        `Bounded nodes ${existingOwner} and ${node.nodeId} duplicate the same Ineffa/Furina coordinate.`,
      );
    }
    coordinateOwners.set(coordinateKey, node.nodeId);
    coordinatesByNodeId.set(node.nodeId, {
      ineffaArtifactSetId,
      furinaArtifactSetId,
    });
  }

  requireExactArtifactValues(
    ineffaValues,
    [AUBADE_SET_ID, SILKEN_SET_ID],
    "Ineffa varied dimension",
  );
  requireExactArtifactValues(
    furinaValues,
    [GOLDEN_SET_ID, TENACITY_SET_ID],
    "Furina varied dimension",
  );
  requireExactArtifactValues(
    keqingValues,
    [KEQING_FIXED_SET_ID],
    "Keqing fixed assignment",
  );
  requireExactArtifactValues(
    xilonenValues,
    [XILONEN_FIXED_SET_ID],
    "Xilonen fixed assignment",
  );

  for (const nodeId of KEQING_INEFFA_BOUNDED_JOINT_CANDIDATE_IDS) {
    const actualCoordinates = coordinatesByNodeId.get(nodeId);
    const expectedCoordinates = EXPECTED_NODE_COORDINATES[nodeId];
    if (
      !actualCoordinates ||
      actualCoordinates.ineffaArtifactSetId !==
        expectedCoordinates.ineffaArtifactSetId ||
      actualCoordinates.furinaArtifactSetId !==
        expectedCoordinates.furinaArtifactSetId
    ) {
      throw new Error(
        `Bounded node ${nodeId} does not match its expected Ineffa/Furina artifact-set coordinates.`,
      );
    }
  }

  for (const ineffaArtifactSetId of [AUBADE_SET_ID, SILKEN_SET_ID]) {
    for (const furinaArtifactSetId of [GOLDEN_SET_ID, TENACITY_SET_ID]) {
      if (
        !coordinateOwners.has(
          artifactCoordinateKey(ineffaArtifactSetId, furinaArtifactSetId),
        )
      ) {
        throw new Error(
          `Keqing/Ineffa bounded geometry is missing Cartesian coordinate Ineffa=${ineffaArtifactSetId}, Furina=${furinaArtifactSetId}.`,
        );
      }
    }
  }
}

function requireExactArtifactValues(
  actual: ReadonlySet<string>,
  expected: readonly string[],
  label: string,
): void {
  const actualValues = [...actual].sort();
  const expectedValues = [...expected].sort();
  if (
    actualValues.length !== expectedValues.length ||
    actualValues.some((value, index) => value !== expectedValues[index])
  ) {
    throw new Error(
      `${label} must contain exactly ${expectedValues.join(", ")}; found ${actualValues.join(", ") || "none"}.`,
    );
  }
}

function artifactCoordinateKey(
  ineffaArtifactSetId: string,
  furinaArtifactSetId: string,
): string {
  return `${ineffaArtifactSetId}\u0000${furinaArtifactSetId}`;
}
