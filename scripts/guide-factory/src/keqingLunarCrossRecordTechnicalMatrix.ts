import type { MainStat, SubStat } from "@/data/enums";
import { runGenerator as runArtifactGenerator } from "@/lib/team-comp/generator/generator";
import {
  ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
  buildArtifactGenerationPreflight,
  type ArtifactGenerationPreflightReport,
} from "./artifactGenerationPreflight";
import {
  prevalidateArtifactGenerationTechnicalProbeCandidates,
  runArtifactGenerationTechnicalProbe,
  type ArtifactGenerationComposedSourceClaimsValidationTarget,
  type ArtifactGenerationRepositoryBuildValidationTarget,
  type ArtifactGenerationTechnicalCandidate,
  type ArtifactGenerationTechnicalProbeEnvironment,
  type ArtifactGenerationTechnicalProbeInput,
  type ArtifactGenerationTechnicalProbeReport,
  type ArtifactGenerationValidationTarget,
  type ArtifactGenerationValidationTargetProvenance,
} from "./artifactGenerationTechnicalProbe";
import { sha256Text, stableJson } from "./io";
import {
  buildKeqingIneffaSourceBackedEquipmentScenario,
  KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
  type KeqingIneffaFormulaDraftReport,
} from "./keqingIneffaFormulaDraft";
import {
  authenticateKeqingIneffaFormulaSemanticScope,
  KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION,
} from "./keqingIneffaFormulaSemanticScope";
import {
  authenticateKeqingLunarCrossRecordTechnicalMatrixScope,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION,
  requireKeqingLunarCrossRecordTechnicalMatrixScope,
  type KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection,
} from "./keqingLunarCrossRecordTechnicalMatrixScope";
import {
  authenticateKeqingLunarCrossRecordCompositionContract,
  buildKeqingLunarCrossRecordCompositionContractReport,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
  type KeqingLunarCrossRecordComposition,
  type KeqingLunarCrossRecordCompositionContractReport,
} from "./keqingLunarCrossRecordCompositionContract";
import type {
  KeqingLunarCandidateEquipmentGroup,
  KeqingLunarCandidateStatClaim,
  KeqingLunarSourceConditionedCandidateLatticeReport,
} from "./keqingLunarSourceConditionedCandidateLattice";
import { KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS } from "./keqingLunarSourceConditionedCandidateLattice";
import { KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS } from "./keqingLunarEquipmentEvidenceValidation";
import {
  type KnowledgeRecord,
  type KnowledgeRepository,
  KnowledgeRepositorySchema,
} from "./schemas";

/**
 * Declared direct evidence, wrapper, and runtime inputs. This is deliberately
 * not a transitive module-graph claim; the durable validator re-executes the
 * current runtime and compares the complete report to catch effective drift.
 */
export const KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS = [
  "scripts/guide-factory/src/keqingLunarCrossRecordTechnicalMatrix.ts",
  "scripts/guide-factory/src/keqingLunarCrossRecordTechnicalMatrixScope.ts",
  "scripts/guide-factory/src/run-keqing-lunar-cross-record-technical-matrix.ts",
  "scripts/guide-factory/src/artifactGenerationTechnicalProbe.ts",
  ...new Set([
    ...ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
    ...KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
    ...KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
    ...KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS,
    ...KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
    "scripts/guide-factory/reports/keqing-lunar-cross-record-composition-contract.json",
    "scripts/guide-factory/src/io.ts",
    "scripts/guide-factory/src/paths.ts",
    "src/data/constants.ts",
    "src/data/enums.ts",
    "src/lib/artifact/scoring/sheetBuilder.ts",
    "src/lib/artifact/scoring/utils.ts",
    "src/lib/dmgcalc/core/formulaCompiler.ts",
    "src/lib/dmgcalc/core/statSheet.ts",
    "src/lib/team-comp/generator/constrainedGreedy.ts",
    "src/lib/team-comp/generator/generator.ts",
    "src/lib/team-comp/generator/substatBudget.ts",
    "src/lib/team-comp/optimizer/erCrConstraints.ts",
    "src/lib/team-comp/teamConfigUtils.ts",
  ]),
] as const;

const TARGET_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example" as const;
const CARRY_CHARACTER_IDS = ["keqing", "ineffa", "furina", "xilonen"] as const;
const EXPECTED_COMPOSITION_IDS = [
  "guide-factory:keqing-lunar:marechaussee-hunter",
  "guide-factory:keqing-lunar:night-of-the-skys-unveiling-one-nod-krai",
] as const;
const CR_CIRCLET_CLAIM_ID =
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:circlet:1" as const;
const TWO_NOD_NOTSU_CLAIM_ID =
  "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:artifact:1:0" as const;
const EXPECTED_KEQING_STAT_TARGET = {
  sands: ["atk%"],
  goblet: ["electro%", "atk%"],
  circlet: ["cd"],
  substats: ["cr", "cd", "atk%", "em"],
  sourcePriorityGroups: [["cr", "cd"], ["atk%"], ["em"]],
} as const;

type CarryCharacterId = (typeof CARRY_CHARACTER_IDS)[number];
type CompositionId = (typeof EXPECTED_COMPOSITION_IDS)[number];
type CompletedCandidateObservation = Extract<
  ArtifactGenerationTechnicalProbeReport["candidates"][number],
  { outcome: "completed-structurally" }
>;
type ValidationTargetComparison =
  CompletedCandidateObservation["validationTargetComparisons"][number];
export type KeqingLunarCrossRecordTechnicalMatrixIssue = {
  code: string;
  path: string;
  message: string;
};

export type KeqingLunarCrossRecordTechnicalMatrixInput = {
  repository: KnowledgeRepository;
  candidateLattice: KeqingLunarSourceConditionedCandidateLatticeReport;
  formulaDraft: KeqingIneffaFormulaDraftReport;
  serializedContract: KeqingLunarCrossRecordCompositionContractReport;
  formulaDraftGeneratedFrom: Array<{ path: string; sha256: string }>;
  contractGeneratedFrom: Array<{ path: string; sha256: string }>;
  generatedFrom: Array<{ path: string; sha256: string }>;
};

export type KeqingLunarCrossRecordTechnicalMatrixNode = {
  sequence: number;
  nodeId: string;
  carryCharacterId: CarryCharacterId;
  compositionId: CompositionId;
  artifactSetId:
    | "marechaussee_hunter"
    | "night_of_the_skys_unveiling";
  recordLocalSourceClassification: "default" | "alternative";
  sourceAuthored: false;
  crossRecordOrdering: "none";
  generatorInvocationOrdinal: number;
  generatedArtifactsSha256: string;
  composedTargetSha256: string;
  validationTargetObservations: Array<{
    characterId: string;
    artifactSetId: string;
    validationTargetProvenance: ArtifactGenerationValidationTargetProvenance;
    observationSha256: string;
  }>;
};

export type KeqingLunarCrossRecordTechnicalMatrixReport = {
  schemaVersion: 1;
  classification: "keqing-lunar-cross-record-technical-matrix";
  matrixStatus: "comparable" | "not-comparable";
  supportsGuideClaims: false;
  supportsSourceAuthoredBuildClaims: false;
  supportsArtifactRecommendations: false;
  supportsStatRecommendations: false;
  supportsArtifactSetComparison: false;
  supportsRankClaims: false;
  supportsWinnerClaims: false;
  supportsEnergyRecoveryClaims: false;
  crossRecordOrdering: "none";
  crossNodeObjectiveComparisonExecuted: false;
  artifactSetComparisonExecuted: false;
  evaluatedObjectiveValueRetained: false;
  numericalDamageRetained: false;
  scoreRetained: false;
  winnerSelected: false;
  energyRecoveryThresholdsUsed: false;
  energyRecoverySequenceUsed: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: {
    candidateLatticeSha256: string;
    formulaDraftSha256: string;
    repositorySemanticScopes: {
      formulaFixture: {
        expectedScopeId: string;
        expectedManifestSha256: string;
        authenticatedScopeProjectionSha256: string | null;
        authenticatedAgainstFormulaDraft: boolean;
      };
      teammateValidationTargets: {
        expectedScopeId: string;
        expectedManifestSha256: string;
        authenticatedScopeProjectionSha256: string | null;
        authenticated: boolean;
      };
    };
    canonicalContractSha256: string;
    serializedContractSha256: string;
    canonicalContractStatus: "comparable" | "not-comparable";
    canonicalContractRebuiltFromTypedInputs: true;
    serializedContractAuthenticatedAgainstRebuild: boolean;
    serializedContractUsedAsAuthority: false;
    formulaDraftGeneratedFromMatchesSuppliedCurrentBytes: boolean;
    contractGeneratedFromPolicy: "supplied-wrapper-current-canonical-input-bytes";
    matrixGeneratedFromPolicy: "supplied-wrapper-declared-direct-authority-and-runtime-bytes";
  };
  executionAuthorization: {
    authorizedOnlyBy: "bounded-guide-factory-structural-experiment-policy";
    guideFactoryExperimentPolicyDeclared: true;
    thisCanonicalInputAuthorizedAfterPrevalidation: boolean;
    executionStarted: boolean;
    sourceAuthorized: false;
    compositionContractAuthorized: false;
    formulaFixtureAuthorized: false;
    scope: "eight-fresh-sequential-structural-generator-invocations";
  };
  prevalidation: {
    status: "passed" | "failed" | "not-run";
    canonicalComposedTargetCount: number;
    candidateEnvelopeCount: number;
    validationTargetCountPerCandidate: number;
    noRunRuntimeReadyCandidateCount: number;
    temporaryTeamBuildCount: number;
    generatorInvoked: false;
  };
  executionAudit: {
    scheduling: "sequential";
    plannedGeneratorInvocationCount: 8;
    observedGeneratorInvocationCount: number;
    uniqueTeamBuildInstanceCount: number;
    maximumConcurrentGeneratorInvocationCount: number;
    trustedValidatorRuntimeCallCount: number;
    structurallyCompletedNodeCount: number;
    partialStructuralOutputsDiscardedOnFailure: true;
  };
  matrix:
    | null
    | {
        status: "complete-structurally";
        nodeCount: 8;
        carryCharacterIds: ["keqing", "ineffa", "furina", "xilonen"];
        compositionIds: [CompositionId, CompositionId];
        nodes: KeqingLunarCrossRecordTechnicalMatrixNode[];
      };
  originLedger: null | {
    canonicalCompositionContract: {
      origin: "rebuilt-checkpoint-18-contract";
      sha256: string;
      sourceAuthoredCompositionCount: 0;
      guideFactoryAuthoredCompositionCount: 2;
      contractTechnicalExecutionAuthorized: false;
      crossRecordOrdering: "none";
    };
    sourceClaimTargets: {
      origin: "authenticated-canonical-composition-claims";
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper";
      sourceAuthored: false;
      targets: Array<{
        compositionId: CompositionId;
        artifactSetId: string;
        recordLocalSourceClassification: "default" | "alternative";
        targetSha256: string;
      }>;
      keqingStatTarget: {
        sands: ["atk%"];
        goblet: ["electro%", "atk%"];
        circlet: ["cd"];
        substats: ["cr", "cd", "atk%", "em"];
        sourcePriorityGroups: [["cr", "cd"], ["atk%"], ["em"]];
        withheldClaimIds: [typeof CR_CIRCLET_CLAIM_ID];
        energyRecoveryFree: true;
        usedAsGeneratorConstraint: false;
        usedAsScoringWeight: false;
        usedOnlyForPostGenerationObservation: true;
      };
      excludedClaimIds: [typeof TWO_NOD_NOTSU_CLAIM_ID];
    };
    fixtureAssumptions: {
      origin: "guide-factory-formula-fixture-assumptions";
      sourceAuthored: false;
      fixtureId: string;
      assumptions: NonNullable<
        KeqingLunarCrossRecordCompositionContractReport["originLedger"]
      >["fixtureAssumptions"]["assumptions"];
      nonArtifactFieldsAppliedForInternalGeneratorExecution: true;
      selectedArtifactFieldsApplied: false;
      selectedArtifactFieldsRetainedAsSeedProvenanceOnly: true;
      artifactAssignmentsOverriddenByMatrixNodes: true;
    };
    r1ExperimentPolicy: {
      origin: "guide-factory-experiment-policy";
      sourceAuthored: false;
      characterRefinements: Array<{
        characterId: string;
        experimentRefinement: 1;
      }>;
      appliedForInternalGeneratorExecution: true;
    };
    teammateEquipment: {
      origin: "guide-factory-experiment-policy-from-validated-fixture";
      sourceAuthoredForExactTeam: false;
      members: NonNullable<
        KeqingLunarCrossRecordCompositionContractReport["originLedger"]
      >["teammateEquipment"]["members"];
      weaponAndArtifactAssignmentsAppliedForInternalGeneratorExecution: true;
      repositoryStatTargetsUsedAsGeneratorConstraint: false;
      repositoryStatTargetsUsedAsScoringWeight: false;
      repositoryStatTargetsUsedOnlyForPostGenerationObservation: true;
    };
    unreviewedFormulaLines: {
      origin: "guide-factory-authored-source-translation";
      reviewStatus: "unreviewed";
      sourceBindingEstablished: false;
      lines: NonNullable<
        KeqingLunarCrossRecordCompositionContractReport["originLedger"]
      >["unreviewedFormulaLines"]["lines"];
      appliedForInternalGeneratorObjective: true;
      evaluatedObjectiveValueRetained: false;
    };
    calcContext: {
      origin: "guide-factory-experiment-policy";
      value: NonNullable<
        KeqingLunarCrossRecordCompositionContractReport["originLedger"]
      >["calcContext"]["value"];
      appliedForInternalGeneratorExecution: true;
    };
    carryRoster: {
      origin: "guide-factory-experiment-policy";
      characterIds: ["keqing", "ineffa", "furina", "xilonen"];
      impliesCharacterOrdering: false;
    };
    energyRecovery: {
      computationExecuted: false;
      thresholdsUsed: false;
      sequenceUsed: false;
      floorOrAdequacyClaim: false;
      repositoryTargetsMayContainSourceRecordedKeys: true;
    };
  };
  issues: KeqingLunarCrossRecordTechnicalMatrixIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
};

export function isCompleteKeqingLunarCrossRecordTechnicalMatrixReport(
  report: KeqingLunarCrossRecordTechnicalMatrixReport,
): boolean {
  const matrix = report.matrix;
  const formulaScope = report.inputBoundary.repositorySemanticScopes.formulaFixture;
  const teammateScope =
    report.inputBoundary.repositorySemanticScopes.teammateValidationTargets;
  return (
    report.matrixStatus === "comparable" &&
    matrix?.status === "complete-structurally" &&
    matrix.nodeCount === 8 &&
    matrix.nodes.length === 8 &&
    report.originLedger !== null &&
    report.prevalidation.status === "passed" &&
    report.prevalidation.canonicalComposedTargetCount === 2 &&
    report.prevalidation.candidateEnvelopeCount === 2 &&
    report.prevalidation.validationTargetCountPerCandidate === 4 &&
    report.prevalidation.noRunRuntimeReadyCandidateCount === 2 &&
    report.prevalidation.temporaryTeamBuildCount === 2 &&
    report.prevalidation.generatorInvoked === false &&
    report.executionAuthorization.thisCanonicalInputAuthorizedAfterPrevalidation ===
      true &&
    report.executionAuthorization.executionStarted === true &&
    report.executionAudit.plannedGeneratorInvocationCount === 8 &&
    report.executionAudit.observedGeneratorInvocationCount === 8 &&
    report.executionAudit.uniqueTeamBuildInstanceCount === 8 &&
    report.executionAudit.maximumConcurrentGeneratorInvocationCount === 1 &&
    report.executionAudit.trustedValidatorRuntimeCallCount === 8 &&
    report.executionAudit.structurallyCompletedNodeCount === 8 &&
    formulaScope.expectedScopeId ===
      KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.scopeId &&
    formulaScope.expectedManifestSha256 ===
      KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.manifestSha256 &&
    formulaScope.authenticatedScopeProjectionSha256 ===
      KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.scopeProjectionSha256 &&
    formulaScope.authenticatedAgainstFormulaDraft === true &&
    teammateScope.expectedScopeId ===
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.scopeId &&
    teammateScope.expectedManifestSha256 ===
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.manifestSha256 &&
    teammateScope.authenticatedScopeProjectionSha256 ===
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.scopeProjectionSha256 &&
    teammateScope.authenticated === true &&
    report.issues.length === 0
  );
}

type MatrixNodePlan = {
  sequence: number;
  nodeId: string;
  carryCharacterId: CarryCharacterId;
  compositionId: CompositionId;
  artifactSetId:
    | "marechaussee_hunter"
    | "night_of_the_skys_unveiling";
  recordLocalSourceClassification: "default" | "alternative";
  candidate: ArtifactGenerationTechnicalCandidate;
};

export type KeqingLunarCrossRecordTechnicalMatrixTrustedCapability = {
  authorityPayloadSha256: string;
  validateComposedTarget: (
    target: ArtifactGenerationComposedSourceClaimsValidationTarget,
  ) => { valid: true } | { valid: false; message: string };
  composedTargetSha256: (compositionId: string) => string | null;
};

export type KeqingLunarCrossRecordTechnicalMatrixPrepared = {
  repository: KnowledgeRepository;
  formulaDraft: KeqingIneffaFormulaDraftReport;
  preflight: ArtifactGenerationPreflightReport;
  canonicalContract: KeqingLunarCrossRecordCompositionContractReport;
  composedTargets: ArtifactGenerationComposedSourceClaimsValidationTarget[];
  candidates: ArtifactGenerationTechnicalCandidate[];
  nodes: MatrixNodePlan[];
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: KeqingLunarCrossRecordTechnicalMatrixReport["inputBoundary"];
  trustedCapability: KeqingLunarCrossRecordTechnicalMatrixTrustedCapability;
};

export type KeqingLunarCrossRecordTechnicalMatrixPreparation =
  | {
      ready: true;
      prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared;
    }
  | {
      ready: false;
      report: KeqingLunarCrossRecordTechnicalMatrixReport;
    };

const TRUSTED_CAPABILITY_STATES = new WeakMap<
  object,
  {
    authorityPayloadSha256: string;
    targetHashes: ReadonlyMap<string, string>;
  }
>();
const TRUSTED_PREPARED_STATES = new WeakMap<
  object,
  {
    capability: KeqingLunarCrossRecordTechnicalMatrixTrustedCapability;
    authorityPayloadSha256: string;
  }
>();
const DEFAULT_ENVIRONMENT: ArtifactGenerationTechnicalProbeEnvironment = {
  runGenerator: runArtifactGenerator,
};

export function prepareKeqingLunarCrossRecordTechnicalMatrix(
  input: KeqingLunarCrossRecordTechnicalMatrixInput,
): KeqingLunarCrossRecordTechnicalMatrixPreparation {
  const issues: KeqingLunarCrossRecordTechnicalMatrixIssue[] = [];
  const normalizedContractGeneratedFrom = normalizeGeneratedFrom(
    input.contractGeneratedFrom,
  );
  const normalizedGeneratedFrom = normalizeGeneratedFrom(input.generatedFrom);
  const formulaDraftGeneratedFromMatchesSuppliedCurrentBytes =
    stableJson(normalizeGeneratedFrom(input.formulaDraft.generatedFrom)) ===
    stableJson(normalizeGeneratedFrom(input.formulaDraftGeneratedFrom));
  if (!formulaDraftGeneratedFromMatchesSuppliedCurrentBytes) {
    issues.push({
      code: "input.formula_generated_from_stale",
      path: "inputBoundary.formulaDraftGeneratedFrom",
      message:
        "The supplied formula draft generatedFrom hashes do not match current canonical input bytes.",
    });
  }
  issues.push(...validateInputHashBindings(input));

  const repositoryResult = KnowledgeRepositorySchema.safeParse(input.repository);
  if (!repositoryResult.success) {
    issues.push({
      code: "input.repository_invalid",
      path: "input.repository",
      message: "The consolidated knowledge repository is invalid.",
    });
  }
  const repositorySemanticScope = repositoryResult.success
    ? authenticateKeqingIneffaFormulaSemanticScope(repositoryResult.data)
    : null;
  const repositorySemanticScopeAuthenticatedAgainstFormulaDraft =
    repositorySemanticScope?.status === "accepted" &&
    input.formulaDraft.semanticScope.expectedManifestSha256 ===
      KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.manifestSha256 &&
    input.formulaDraft.semanticScope.expectedScopeProjectionSha256 ===
      KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.scopeProjectionSha256 &&
    stableJson(input.formulaDraft.semanticScope.acceptedAudit) ===
      stableJson(repositorySemanticScope.audit);
  if (!repositorySemanticScopeAuthenticatedAgainstFormulaDraft) {
    issues.push({
      code: "input.repository_semantic_scope_binding_failed",
      path: "inputBoundary.repositorySemanticScopes.formulaFixture",
      message:
        "The current repository's authenticated Keqing-Ineffa semantic projection does not match the formula draft's accepted semantic-scope audit.",
    });
  }
  const teammateRepositorySemanticScope = repositoryResult.success
    ? authenticateKeqingLunarCrossRecordTechnicalMatrixScope(
        repositoryResult.data,
      )
    : null;
  const teammateRepositorySemanticScopeAuthenticated =
    teammateRepositorySemanticScope?.status === "accepted";
  if (!teammateRepositorySemanticScopeAuthenticated) {
    issues.push({
      code: "input.teammate_repository_semantic_scope_authentication_failed",
      path: "inputBoundary.repositorySemanticScopes.teammateValidationTargets",
      message:
        "The current repository does not authenticate the exact three teammate build projections consumed by this matrix.",
    });
  }

  const canonicalContract =
    buildKeqingLunarCrossRecordCompositionContractReport(
      input.candidateLattice,
      input.formulaDraft,
      normalizedContractGeneratedFrom,
    );
  const inputBoundary = buildInputBoundary(
    input,
    canonicalContract,
    formulaDraftGeneratedFromMatchesSuppliedCurrentBytes,
    false,
    repositorySemanticScope?.status === "accepted"
      ? repositorySemanticScope.audit.scopeProjectionSha256
      : null,
    repositorySemanticScopeAuthenticatedAgainstFormulaDraft,
    teammateRepositorySemanticScope?.status === "accepted"
      ? teammateRepositorySemanticScope.audit.scopeProjectionSha256
      : null,
    teammateRepositorySemanticScopeAuthenticated,
  );
  if (canonicalContract.contractStatus !== "comparable") {
    issues.push(
      ...canonicalContract.issues.map(({ code, path, message }) => ({
        code: `contract.${code}`,
        path: `canonicalContract.${path}`,
        message,
      })),
    );
    if (canonicalContract.issues.length === 0) {
      issues.push({
        code: "contract.not_comparable",
        path: "canonicalContract",
        message: "The rebuilt checkpoint-18 contract is not comparable.",
      });
    }
  }
  const authentication =
    authenticateKeqingLunarCrossRecordCompositionContract(
      input.serializedContract,
      input.candidateLattice,
      input.formulaDraft,
      normalizedContractGeneratedFrom,
    );
  if (!authentication.authenticated) {
    issues.push({
      code: "contract.rebuild_authentication_failed",
      path: "canonicalContract",
      message:
        "The durable checkpoint-18 contract did not authenticate against its fresh typed-input rebuild and current hashes.",
    });
  }

  if (issues.length > 0 || !authentication.authenticated || !repositoryResult.success) {
    return {
      ready: false,
      report: buildNotComparableReport({
        generatedFrom: normalizedGeneratedFrom,
        inputBoundary,
        issues,
      }),
    };
  }

  const authenticatedContract = authentication.canonicalReport;
  const authenticatedInputBoundary = buildInputBoundary(
    input,
    authenticatedContract,
    formulaDraftGeneratedFromMatchesSuppliedCurrentBytes,
    true,
    repositorySemanticScope?.status === "accepted"
      ? repositorySemanticScope.audit.scopeProjectionSha256
      : null,
    repositorySemanticScopeAuthenticatedAgainstFormulaDraft,
    teammateRepositorySemanticScope?.status === "accepted"
      ? teammateRepositorySemanticScope.audit.scopeProjectionSha256
      : null,
    teammateRepositorySemanticScopeAuthenticated,
  );
  if (
    authenticatedContract.compositions.length !== 2 ||
    authenticatedContract.compositions.some(
      ({ formulaFixtureReference }) =>
        formulaFixtureReference.technicalExecutionAuthorized,
    )
  ) {
    return {
      ready: false,
      report: buildNotComparableReport({
        generatedFrom: normalizedGeneratedFrom,
        inputBoundary: authenticatedInputBoundary,
        issues: [
          {
            code: "contract.execution_boundary_changed",
            path: "canonicalContract.compositions",
            message:
              "The canonical contract must contain exactly two compositions and must authorize no technical execution.",
          },
        ],
      }),
    };
  }

  let preflight: ArtifactGenerationPreflightReport;
  let composedTargets: ArtifactGenerationComposedSourceClaimsValidationTarget[];
  let teammateTargets: ArtifactGenerationRepositoryBuildValidationTarget[];
  try {
    const fixture = buildKeqingIneffaSourceBackedEquipmentScenario(
      repositoryResult.data,
    );
    preflight = buildArtifactGenerationPreflight({
      fixture,
      formulaDraft: input.formulaDraft,
      formulaReadiness: input.formulaDraft.damageReplayReadiness,
    });
    if (!preflight.equipmentReadyForTechnicalProbe) {
      throw new Error(
        "The exact source-backed equipment fixture did not pass technical equipment preflight.",
      );
    }
    composedTargets = authenticatedContract.compositions.map((composition) =>
      deriveComposedTarget(
        composition,
        authenticatedContract,
        input.candidateLattice,
      ),
    );
    teammateTargets = buildTeammateRepositoryTargets(
      requireKeqingLunarCrossRecordTechnicalMatrixScope(repositoryResult.data)
        .repositoryTargets,
      authenticatedContract,
    );
  } catch (error) {
    return {
      ready: false,
      report: buildNotComparableReport({
        generatedFrom: normalizedGeneratedFrom,
        inputBoundary: authenticatedInputBoundary,
        issues: [
          {
            code: "preparation.canonical_target_derivation_failed",
            path: "preparation",
            message: serializeError(error),
          },
        ],
      }),
    };
  }

  const candidates = composedTargets.map((target) =>
    buildCandidate(target, teammateTargets, target.compositionId),
  );
  const nodes: MatrixNodePlan[] = [];
  for (const carryCharacterId of CARRY_CHARACTER_IDS) {
    for (const [compositionIndex, composition] of
      authenticatedContract.compositions.entries()) {
      const candidate = candidates[compositionIndex];
      nodes.push({
        sequence: nodes.length,
        nodeId: `node-${String(nodes.length + 1).padStart(2, "0")}:${carryCharacterId}:${composition.compositionId}`,
        carryCharacterId,
        compositionId: composition.compositionId,
        artifactSetId: requireCompositionArtifactSetId(composition),
        recordLocalSourceClassification:
          composition.artifact.sourceClassification,
        candidate: cloneCandidate({
          ...candidate,
          candidateId: `node-${String(nodes.length + 1).padStart(2, "0")}:${carryCharacterId}:${composition.compositionId}`,
        }),
      });
    }
  }

  const preparedBase = {
    repository: repositoryResult.data,
    formulaDraft: structuredClone(input.formulaDraft),
    preflight,
    canonicalContract: authenticatedContract,
    composedTargets: composedTargets.map(cloneComposedTarget),
    candidates: candidates.map(cloneCandidate),
    nodes: nodes.map(cloneNodePlan),
    generatedFrom: normalizedGeneratedFrom,
    inputBoundary: authenticatedInputBoundary,
  };
  const authorityPayloadSha256 = sha256Text(
    stableJson(preparedAuthorityPayload(preparedBase)),
  );
  const targetHashes = new Map(
    composedTargets.map((target) => [
      target.compositionId,
      sha256Text(stableJson(target)),
    ]),
  );
  let trustedCapability: KeqingLunarCrossRecordTechnicalMatrixTrustedCapability;
  trustedCapability = {
    authorityPayloadSha256,
    validateComposedTarget: (target) =>
      validateWithTrustedCapability(trustedCapability, target),
    composedTargetSha256: (compositionId) =>
      trustedCapabilityTargetHash(trustedCapability, compositionId),
  };
  TRUSTED_CAPABILITY_STATES.set(trustedCapability, {
    authorityPayloadSha256,
    targetHashes,
  });
  Object.freeze(trustedCapability);

  const prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared = {
    ...preparedBase,
    trustedCapability,
  };
  TRUSTED_PREPARED_STATES.set(prepared, {
    capability: trustedCapability,
    authorityPayloadSha256,
  });

  return {
    ready: true,
    prepared,
  };
}

export async function runKeqingLunarCrossRecordTechnicalMatrix(
  input: KeqingLunarCrossRecordTechnicalMatrixInput,
  environment: ArtifactGenerationTechnicalProbeEnvironment = DEFAULT_ENVIRONMENT,
): Promise<KeqingLunarCrossRecordTechnicalMatrixReport> {
  const preparation = prepareKeqingLunarCrossRecordTechnicalMatrix(input);
  return preparation.ready
    ? executePreparedKeqingLunarCrossRecordTechnicalMatrix(
        preparation.prepared,
        environment,
      )
    : preparation.report;
}

export async function executePreparedKeqingLunarCrossRecordTechnicalMatrix(
  prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared,
  environment: ArtifactGenerationTechnicalProbeEnvironment = DEFAULT_ENVIRONMENT,
): Promise<KeqingLunarCrossRecordTechnicalMatrixReport> {
  let envelopeIssue: KeqingLunarCrossRecordTechnicalMatrixIssue | null;
  try {
    envelopeIssue = validatePreparedEnvelope(prepared);
  } catch (error) {
    envelopeIssue = {
      code: "prevalidation.prepared_envelope_check_failed",
      path: "prepared",
      message: serializeError(error),
    };
  }
  if (envelopeIssue) {
    return buildNotComparableReport({
      generatedFrom: prepared.generatedFrom,
      inputBoundary: prepared.inputBoundary,
      issues: [envelopeIssue],
    });
  }

  let executionSnapshot: KeqingLunarCrossRecordTechnicalMatrixPrepared;
  try {
    executionSnapshot = clonePreparedExecutionSnapshot(prepared);
  } catch (error) {
    return buildNotComparableReport({
      generatedFrom: prepared.generatedFrom,
      inputBoundary: prepared.inputBoundary,
      issues: [
        {
          code: "prevalidation.prepared_snapshot_failed",
          path: "prepared",
          message: serializeError(error),
        },
      ],
    });
  }
  const generatorRunner = environment.runGenerator;
  let originLedger: NonNullable<
    KeqingLunarCrossRecordTechnicalMatrixReport["originLedger"]
  >;
  try {
    originLedger = buildOriginLedger(executionSnapshot);
  } catch (error) {
    return buildNotComparableReport({
      generatedFrom: executionSnapshot.generatedFrom,
      inputBoundary: executionSnapshot.inputBoundary,
      issues: [
        {
          code: "prevalidation.origin_ledger_derivation_failed",
          path: "originLedger",
          message: serializeError(error),
        },
      ],
    });
  }

  const prevalidationInput = buildProbeInput(
    executionSnapshot,
    "keqing",
    executionSnapshot.candidates,
  );
  let noRunPrevalidation: Awaited<
    ReturnType<typeof prevalidateArtifactGenerationTechnicalProbeCandidates>
  >;
  try {
    noRunPrevalidation =
      await prevalidateArtifactGenerationTechnicalProbeCandidates(
        prevalidationInput,
        {
          validateComposedSourceClaimsTarget:
            (target) =>
              validateWithTrustedCapability(
                executionSnapshot.trustedCapability,
                target,
              ),
        },
      );
  } catch (error) {
    return buildNotComparableReport({
      generatedFrom: executionSnapshot.generatedFrom,
      inputBoundary: executionSnapshot.inputBoundary,
      issues: [
        {
          code: "prevalidation.generic_invariant_failed",
          path: "prevalidation",
          message: serializeError(error),
        },
      ],
    });
  }
  if (!noRunPrevalidation.valid) {
    return buildNotComparableReport({
      generatedFrom: executionSnapshot.generatedFrom,
      inputBoundary: executionSnapshot.inputBoundary,
      prevalidation: {
        status: "failed",
        canonicalComposedTargetCount: executionSnapshot.composedTargets.length,
        candidateEnvelopeCount: noRunPrevalidation.candidateCount,
        validationTargetCountPerCandidate: 4,
        noRunRuntimeReadyCandidateCount:
          noRunPrevalidation.runtimeReadyCandidateCount,
        temporaryTeamBuildCount: noRunPrevalidation.temporaryTeamBuildCount,
        generatorInvoked: false,
      },
      issues: noRunPrevalidation.failures.map(({ candidateId, failure }) => ({
        code: `prevalidation.${failure.code}`,
        path: `prevalidation.candidates.${candidateId}`,
        message: failure.message,
      })),
    });
  }

  const audit = {
    observedGeneratorInvocationCount: 0,
    uniqueTeamBuilds: new Set<object>(),
    activeGeneratorInvocations: 0,
    maximumConcurrentGeneratorInvocationCount: 0,
    trustedValidatorRuntimeCallCount: 0,
    structurallyCompletedNodeCount: 0,
  };
  const completedNodes: KeqingLunarCrossRecordTechnicalMatrixNode[] = [];
  const executionIssues: KeqingLunarCrossRecordTechnicalMatrixIssue[] = [];

  for (const node of executionSnapshot.nodes) {
    let capturedArtifactsSha256: string | null = null;
    let invocationOrdinal: number | null = null;
    const wrappedEnvironment: ArtifactGenerationTechnicalProbeEnvironment = {
      runGenerator: (options) => {
        audit.observedGeneratorInvocationCount++;
        invocationOrdinal = audit.observedGeneratorInvocationCount;
        audit.uniqueTeamBuilds.add(options.teamBuild);
        let iterable: ReturnType<
          ArtifactGenerationTechnicalProbeEnvironment["runGenerator"]
        >;
        try {
          iterable = generatorRunner(options);
        } catch (error) {
          throw error;
        }
        return {
          async *[Symbol.asyncIterator]() {
            audit.activeGeneratorInvocations++;
            audit.maximumConcurrentGeneratorInvocationCount = Math.max(
              audit.maximumConcurrentGeneratorInvocationCount,
              audit.activeGeneratorInvocations,
            );
            try {
              for await (const result of iterable) {
                if (result.done) {
                  capturedArtifactsSha256 = sha256Text(
                    stableJson(result.artifactsByChar),
                  );
                }
                yield result;
              }
            } finally {
              audit.activeGeneratorInvocations--;
            }
          },
        };
      },
      validateComposedSourceClaimsTarget: (target) => {
        audit.trustedValidatorRuntimeCallCount++;
        return validateWithTrustedCapability(
          executionSnapshot.trustedCapability,
          target,
        );
      },
    };
    let genericReport: ArtifactGenerationTechnicalProbeReport;
    try {
      genericReport = await runArtifactGenerationTechnicalProbe(
        buildProbeInput(executionSnapshot, node.carryCharacterId, [node.candidate]),
        wrappedEnvironment,
      );
    } catch (error) {
      executionIssues.push({
        code: "execution.generic_probe_threw",
        path: `matrix.nodes.${node.nodeId}`,
        message: serializeError(error),
      });
      break;
    }
    const completed = completedObservation(genericReport, node);
    if (
      completed == null ||
      capturedArtifactsSha256 == null ||
      invocationOrdinal == null
    ) {
      const observation = genericReport.candidates[0];
      executionIssues.push({
        code: "execution.node_not_structurally_complete",
        path: `matrix.nodes.${node.nodeId}`,
        message:
          observation && "failure" in observation
            ? `${observation.failure.code}: ${observation.failure.message}`
            : "The singleton generic probe did not produce one complete structural observation and artifact hash.",
      });
      break;
    }
    audit.structurallyCompletedNodeCount++;
    completedNodes.push({
      sequence: node.sequence,
      nodeId: node.nodeId,
      carryCharacterId: node.carryCharacterId,
      compositionId: node.compositionId,
      artifactSetId: node.artifactSetId,
      recordLocalSourceClassification:
        node.recordLocalSourceClassification,
      sourceAuthored: false,
      crossRecordOrdering: "none",
      generatorInvocationOrdinal: invocationOrdinal,
      generatedArtifactsSha256: capturedArtifactsSha256,
      composedTargetSha256:
        trustedCapabilityTargetHash(
          executionSnapshot.trustedCapability,
          node.compositionId,
        ) ??
        "",
      validationTargetObservations:
        completed.validationTargetComparisons.map(
          summarizeValidationTargetObservation,
        ),
    });
  }

  const executionBoundaryPassed =
    executionIssues.length === 0 &&
    executionSnapshot.nodes.length === 8 &&
    completedNodes.length === 8 &&
    audit.observedGeneratorInvocationCount === 8 &&
    audit.uniqueTeamBuilds.size === 8 &&
    audit.maximumConcurrentGeneratorInvocationCount === 1 &&
    audit.trustedValidatorRuntimeCallCount === 8 &&
    completedNodes.every(
      ({ generatorInvocationOrdinal }, index) =>
        generatorInvocationOrdinal === index + 1,
    );
  if (!executionBoundaryPassed && executionIssues.length === 0) {
    executionIssues.push({
      code: "execution.exact_matrix_boundary_failed",
      path: "executionAudit",
      message:
        "The experiment did not complete exactly eight sequential invocations with eight fresh TeamBuilds, eight trusted runtime validations, and eight structural observations.",
    });
  }
  const prevalidation = {
    status: "passed" as const,
    canonicalComposedTargetCount: executionSnapshot.composedTargets.length,
    candidateEnvelopeCount: noRunPrevalidation.candidateCount,
    validationTargetCountPerCandidate: 4,
    noRunRuntimeReadyCandidateCount:
      noRunPrevalidation.runtimeReadyCandidateCount,
    temporaryTeamBuildCount: noRunPrevalidation.temporaryTeamBuildCount,
    generatorInvoked: false as const,
  };
  const executionAudit = buildExecutionAudit(audit);
  if (!executionBoundaryPassed) {
    return buildNotComparableReport({
      generatedFrom: executionSnapshot.generatedFrom,
      inputBoundary: executionSnapshot.inputBoundary,
      prevalidation,
      executionAudit,
      issues: executionIssues,
      thisCanonicalInputAuthorizedAfterPrevalidation: true,
    });
  }

  return {
    ...buildCommonReport({
      generatedFrom: executionSnapshot.generatedFrom,
      inputBoundary: executionSnapshot.inputBoundary,
      prevalidation,
      executionAudit,
      thisCanonicalInputAuthorizedAfterPrevalidation: true,
    }),
    matrixStatus: "comparable",
    matrix: {
      status: "complete-structurally",
      nodeCount: 8,
      carryCharacterIds: [...CARRY_CHARACTER_IDS],
      compositionIds: [...EXPECTED_COMPOSITION_IDS],
      nodes: completedNodes,
    },
    originLedger,
    issues: [],
  };
}

function validateInputHashBindings(
  input: KeqingLunarCrossRecordTechnicalMatrixInput,
): KeqingLunarCrossRecordTechnicalMatrixIssue[] {
  const issues: KeqingLunarCrossRecordTechnicalMatrixIssue[] = [];
  validateGeneratedFromInventory(
    input.formulaDraftGeneratedFrom,
    KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
    "inputBoundary.formulaDraftGeneratedFrom",
    issues,
  );
  validateGeneratedFromInventory(
    input.contractGeneratedFrom,
    KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
    "inputBoundary.contractGeneratedFrom",
    issues,
  );
  validateGeneratedFromInventory(
    input.generatedFrom,
    KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS,
    "generatedFrom",
    issues,
  );

  const bindings: Array<{
    entries: readonly { path: string; sha256: string }[];
    path: string;
    value: unknown;
    issuePath: string;
  }> = [
    {
      entries: input.contractGeneratedFrom,
      path: "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json",
      value: input.formulaDraft,
      issuePath: "inputBoundary.formulaDraft",
    },
    {
      entries: input.contractGeneratedFrom,
      path: "scripts/guide-factory/reports/keqing-lunar-source-conditioned-candidate-lattice.json",
      value: input.candidateLattice,
      issuePath: "inputBoundary.candidateLattice",
    },
    {
      entries: input.generatedFrom,
      path: "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json",
      value: input.formulaDraft,
      issuePath: "generatedFrom.formulaDraft",
    },
    {
      entries: input.generatedFrom,
      path: "scripts/guide-factory/reports/keqing-lunar-source-conditioned-candidate-lattice.json",
      value: input.candidateLattice,
      issuePath: "generatedFrom.candidateLattice",
    },
    {
      entries: input.generatedFrom,
      path: "scripts/guide-factory/reports/keqing-lunar-cross-record-composition-contract.json",
      value: input.serializedContract,
      issuePath: "generatedFrom.serializedContract",
    },
  ];
  for (const binding of bindings) {
    const matches = binding.entries.filter(({ path }) => path === binding.path);
    const snapshotSha256 = sha256Text(stableJson(binding.value));
    if (matches.length !== 1 || matches[0].sha256 !== snapshotSha256) {
      issues.push({
        code: "input.snapshot_hash_binding_failed",
        path: binding.issuePath,
        message: `Caller-supplied typed snapshot ${binding.path} does not exactly match its supplied wrapper byte hash.`,
      });
    }
  }
  const latticeCurrentInputs = input.generatedFrom.filter(({ path }) =>
    KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS.includes(
      path as (typeof KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS)[number],
    ),
  );
  if (
    stableJson(normalizeGeneratedFrom(input.candidateLattice.generatedFrom)) !==
    stableJson(normalizeGeneratedFrom(latticeCurrentInputs))
  ) {
    issues.push({
      code: "input.candidate_lattice_generated_from_stale",
      path: "inputBoundary.candidateLattice.generatedFrom",
      message:
        "The candidate lattice generatedFrom hashes do not match the supplied wrapper's current direct lattice inputs.",
    });
  }
  return issues;
}

function validateGeneratedFromInventory(
  entries: readonly { path: string; sha256: string }[],
  expectedPaths: readonly string[],
  issuePath: string,
  issues: KeqingLunarCrossRecordTechnicalMatrixIssue[],
): void {
  const paths = entries.map(({ path }) => path);
  const validHashes = entries.every(({ sha256 }) =>
    /^[0-9a-f]{64}$/.test(sha256),
  );
  if (
    new Set(paths).size !== paths.length ||
    !validHashes ||
    stableJson([...paths].sort(compareText)) !==
      stableJson([...expectedPaths].sort(compareText))
  ) {
    issues.push({
      code: "input.generated_from_inventory_changed",
      path: issuePath,
      message:
        "The supplied wrapper hash inventory must contain every declared direct authority/runtime path once with a lowercase SHA-256.",
    });
  }
}

function buildInputBoundary(
  input: KeqingLunarCrossRecordTechnicalMatrixInput,
  canonicalContract: KeqingLunarCrossRecordCompositionContractReport,
  formulaDraftGeneratedFromMatchesSuppliedCurrentBytes: boolean,
  serializedContractAuthenticatedAgainstRebuild: boolean,
  repositorySemanticScopeProjectionSha256: string | null,
  repositorySemanticScopeAuthenticatedAgainstFormulaDraft: boolean,
  teammateRepositorySemanticScopeProjectionSha256: string | null,
  teammateRepositorySemanticScopeAuthenticated: boolean,
): KeqingLunarCrossRecordTechnicalMatrixReport["inputBoundary"] {
  return {
    candidateLatticeSha256: sha256Text(stableJson(input.candidateLattice)),
    formulaDraftSha256: sha256Text(stableJson(input.formulaDraft)),
    repositorySemanticScopes: {
      formulaFixture: {
        expectedScopeId:
          KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.scopeId,
        expectedManifestSha256:
          KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.manifestSha256,
        authenticatedScopeProjectionSha256:
          repositorySemanticScopeProjectionSha256,
        authenticatedAgainstFormulaDraft:
          repositorySemanticScopeAuthenticatedAgainstFormulaDraft,
      },
      teammateValidationTargets: {
        expectedScopeId:
          KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.scopeId,
        expectedManifestSha256:
          KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.manifestSha256,
        authenticatedScopeProjectionSha256:
          teammateRepositorySemanticScopeProjectionSha256,
        authenticated: teammateRepositorySemanticScopeAuthenticated,
      },
    },
    canonicalContractSha256: sha256Text(stableJson(canonicalContract)),
    serializedContractSha256: sha256Text(stableJson(input.serializedContract)),
    canonicalContractStatus: canonicalContract.contractStatus,
    canonicalContractRebuiltFromTypedInputs: true,
    serializedContractAuthenticatedAgainstRebuild,
    serializedContractUsedAsAuthority: false,
    formulaDraftGeneratedFromMatchesSuppliedCurrentBytes,
    contractGeneratedFromPolicy:
      "supplied-wrapper-current-canonical-input-bytes",
    matrixGeneratedFromPolicy:
      "supplied-wrapper-declared-direct-authority-and-runtime-bytes",
  };
}

function buildCommonReport(input: {
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: KeqingLunarCrossRecordTechnicalMatrixReport["inputBoundary"];
  prevalidation?: KeqingLunarCrossRecordTechnicalMatrixReport["prevalidation"];
  executionAudit?: KeqingLunarCrossRecordTechnicalMatrixReport["executionAudit"];
  thisCanonicalInputAuthorizedAfterPrevalidation?: boolean;
}): Omit<
  KeqingLunarCrossRecordTechnicalMatrixReport,
  "matrixStatus" | "matrix" | "originLedger" | "issues"
> {
  return {
    schemaVersion: 1,
    classification: "keqing-lunar-cross-record-technical-matrix",
    supportsGuideClaims: false,
    supportsSourceAuthoredBuildClaims: false,
    supportsArtifactRecommendations: false,
    supportsStatRecommendations: false,
    supportsArtifactSetComparison: false,
    supportsRankClaims: false,
    supportsWinnerClaims: false,
    supportsEnergyRecoveryClaims: false,
    crossRecordOrdering: "none",
    crossNodeObjectiveComparisonExecuted: false,
    artifactSetComparisonExecuted: false,
    evaluatedObjectiveValueRetained: false,
    numericalDamageRetained: false,
    scoreRetained: false,
    winnerSelected: false,
    energyRecoveryThresholdsUsed: false,
    energyRecoverySequenceUsed: false,
    generatedFrom: normalizeGeneratedFrom(input.generatedFrom),
    inputBoundary: { ...input.inputBoundary },
    executionAuthorization: {
      authorizedOnlyBy:
        "bounded-guide-factory-structural-experiment-policy",
      guideFactoryExperimentPolicyDeclared: true,
      thisCanonicalInputAuthorizedAfterPrevalidation:
        input.thisCanonicalInputAuthorizedAfterPrevalidation ?? false,
      executionStarted:
        (input.executionAudit?.observedGeneratorInvocationCount ?? 0) > 0,
      sourceAuthorized: false,
      compositionContractAuthorized: false,
      formulaFixtureAuthorized: false,
      scope: "eight-fresh-sequential-structural-generator-invocations",
    },
    prevalidation: input.prevalidation ?? {
      status: "not-run",
      canonicalComposedTargetCount: 0,
      candidateEnvelopeCount: 0,
      validationTargetCountPerCandidate: 0,
      noRunRuntimeReadyCandidateCount: 0,
      temporaryTeamBuildCount: 0,
      generatorInvoked: false,
    },
    executionAudit: input.executionAudit ?? {
      scheduling: "sequential",
      plannedGeneratorInvocationCount: 8,
      observedGeneratorInvocationCount: 0,
      uniqueTeamBuildInstanceCount: 0,
      maximumConcurrentGeneratorInvocationCount: 0,
      trustedValidatorRuntimeCallCount: 0,
      structurallyCompletedNodeCount: 0,
      partialStructuralOutputsDiscardedOnFailure: true,
    },
    cautions: [
      "This matrix is a bounded Guide Factory structural experiment; neither source evidence nor the checkpoint-18 composition contract authorizes execution.",
      "The generator uses the serialized numerical objective specification internally, but no evaluated objective value or damage value is retained and no cross-node objective or artifact-set comparison is performed.",
      "The default and alternative labels remain local to separate source records; node or array order establishes no relation between Marechaussee Hunter and Night of the Sky's Unveiling.",
      "The formula translation remains unreviewed and source-unbound; structural completion does not establish gameplay correctness or rotation quality.",
      "Repository validation targets can contain source-recorded Energy Recharge keys, but this matrix uses no Energy Recharge threshold or sequence and establishes no floor or adequacy claim.",
      "Source and repository stat arrays are provenance-validated post-generation observations only; they are not generator constraints, scoring weights, stat priorities, or ideal-roll targets.",
      "Formula fixture selected-artifact fields are retained as seed provenance only; every runtime artifact assignment is replaced by the matrix node payload before generation.",
      "Artifact hashes and validation-target observation hashes are reproducibility evidence, not build quality, score, rank, recommendation, or winner claims.",
      "The pure matrix core checks consistency among caller-supplied typed snapshots and hash arrays, while the source CLI binds the declared direct paths to current bytes. That list is not a transitive module graph; the durable full validator re-executes the current runtime and compares the complete report to catch effective drift.",
    ],
    prohibitedInterpretations: [
      "source-authored-build",
      "artifact-set-comparison",
      "damage-comparison",
      "cross-node-objective-comparison",
      "candidate-ranking",
      "winner",
      "artifact-recommendation",
      "stat-recommendation",
      "energy-requirement",
      "ideal-stat-rolls",
    ],
  };
}

function buildNotComparableReport(input: {
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: KeqingLunarCrossRecordTechnicalMatrixReport["inputBoundary"];
  issues: KeqingLunarCrossRecordTechnicalMatrixIssue[];
  prevalidation?: KeqingLunarCrossRecordTechnicalMatrixReport["prevalidation"];
  executionAudit?: KeqingLunarCrossRecordTechnicalMatrixReport["executionAudit"];
  thisCanonicalInputAuthorizedAfterPrevalidation?: boolean;
}): KeqingLunarCrossRecordTechnicalMatrixReport {
  return {
    ...buildCommonReport(input),
    matrixStatus: "not-comparable",
    matrix: null,
    originLedger: null,
    issues: sortIssues(input.issues),
  };
}

function buildOriginLedger(
  prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared,
): NonNullable<KeqingLunarCrossRecordTechnicalMatrixReport["originLedger"]> {
  const contractLedger = prepared.canonicalContract.originLedger;
  if (contractLedger == null) {
    throw new Error("The authenticated canonical contract has no origin ledger.");
  }
  const assumptions = prepared.formulaDraft.assumptions.characters;
  if (
    stableJson(assumptions.map(({ characterId }) => characterId)) !==
      stableJson(CARRY_CHARACTER_IDS) ||
    assumptions.some(({ refinement }) => refinement !== 1) ||
    stableJson(contractLedger.fixtureAssumptions.assumptions) !==
      stableJson(assumptions) ||
    contractLedger.fixtureAssumptions.sourceAuthored ||
    contractLedger.fixtureAssumptions.appliedByThisContract ||
    contractLedger.r1ExperimentPolicy.sourceAuthored ||
    contractLedger.r1ExperimentPolicy.experimentRefinementIsSourceFact ||
    contractLedger.r1ExperimentPolicy.appliedByThisContract ||
    contractLedger.teammateEquipment.appliedByThisContract ||
    contractLedger.unreviewedFormulaLines.appliedByThisContract ||
    contractLedger.calcContext.appliedByThisContract
  ) {
    throw new Error(
      "Fixture, R1, teammate, formula-line, or calculation-context provenance changed from the non-source experiment boundary.",
    );
  }

  const targets = EXPECTED_COMPOSITION_IDS.map((compositionId) => {
    const compositions = prepared.canonicalContract.compositions.filter(
      (composition) => composition.compositionId === compositionId,
    );
    const composedTargets = prepared.composedTargets.filter(
      (target) => target.compositionId === compositionId,
    );
    const targetSha256 = trustedCapabilityTargetHash(
      prepared.trustedCapability,
      compositionId,
    );
    if (
      compositions.length !== 1 ||
      composedTargets.length !== 1 ||
      targetSha256 == null ||
      targetSha256 !== sha256Text(stableJson(composedTargets[0]))
    ) {
      throw new Error(
        `Composition ${compositionId} no longer has one authenticated target payload.`,
      );
    }
    const composition = compositions[0];
    return {
      compositionId,
      artifactSetId: requireCompositionArtifactSetId(composition),
      recordLocalSourceClassification:
        composition.artifact.sourceClassification,
      targetSha256,
    };
  });

  return {
    canonicalCompositionContract: {
      origin: "rebuilt-checkpoint-18-contract",
      sha256: prepared.inputBoundary.canonicalContractSha256,
      sourceAuthoredCompositionCount: 0,
      guideFactoryAuthoredCompositionCount: 2,
      contractTechnicalExecutionAuthorized: false,
      crossRecordOrdering: "none",
    },
    sourceClaimTargets: {
      origin: "authenticated-canonical-composition-claims",
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
      sourceAuthored: false,
      targets,
      keqingStatTarget: {
        sands: ["atk%"],
        goblet: ["electro%", "atk%"],
        circlet: ["cd"],
        substats: ["cr", "cd", "atk%", "em"],
        sourcePriorityGroups: [["cr", "cd"], ["atk%"], ["em"]],
        withheldClaimIds: [CR_CIRCLET_CLAIM_ID],
        energyRecoveryFree: true,
        usedAsGeneratorConstraint: false,
        usedAsScoringWeight: false,
        usedOnlyForPostGenerationObservation: true,
      },
      excludedClaimIds: [TWO_NOD_NOTSU_CLAIM_ID],
    },
    fixtureAssumptions: {
      origin: "guide-factory-formula-fixture-assumptions",
      sourceAuthored: false,
      fixtureId: contractLedger.fixtureAssumptions.fixtureId,
      assumptions: structuredClone(contractLedger.fixtureAssumptions.assumptions),
      nonArtifactFieldsAppliedForInternalGeneratorExecution: true,
      selectedArtifactFieldsApplied: false,
      selectedArtifactFieldsRetainedAsSeedProvenanceOnly: true,
      artifactAssignmentsOverriddenByMatrixNodes: true,
    },
    r1ExperimentPolicy: {
      origin: "guide-factory-experiment-policy",
      sourceAuthored: false,
      characterRefinements: assumptions.map(({ characterId }) => ({
        characterId,
        experimentRefinement: 1,
      })),
      appliedForInternalGeneratorExecution: true,
    },
    teammateEquipment: {
      origin: "guide-factory-experiment-policy-from-validated-fixture",
      sourceAuthoredForExactTeam: false,
      members: structuredClone(contractLedger.teammateEquipment.members),
      weaponAndArtifactAssignmentsAppliedForInternalGeneratorExecution: true,
      repositoryStatTargetsUsedAsGeneratorConstraint: false,
      repositoryStatTargetsUsedAsScoringWeight: false,
      repositoryStatTargetsUsedOnlyForPostGenerationObservation: true,
    },
    unreviewedFormulaLines: {
      origin: "guide-factory-authored-source-translation",
      reviewStatus: "unreviewed",
      sourceBindingEstablished: false,
      lines: structuredClone(contractLedger.unreviewedFormulaLines.lines),
      appliedForInternalGeneratorObjective: true,
      evaluatedObjectiveValueRetained: false,
    },
    calcContext: {
      origin: "guide-factory-experiment-policy",
      value: structuredClone(contractLedger.calcContext.value),
      appliedForInternalGeneratorExecution: true,
    },
    carryRoster: {
      origin: "guide-factory-experiment-policy",
      characterIds: [...CARRY_CHARACTER_IDS],
      impliesCharacterOrdering: false,
    },
    energyRecovery: {
      computationExecuted: false,
      thresholdsUsed: false,
      sequenceUsed: false,
      floorOrAdequacyClaim: false,
      repositoryTargetsMayContainSourceRecordedKeys: true,
    },
  };
}

function deriveComposedTarget(
  composition: KeqingLunarCrossRecordComposition,
  contract: KeqingLunarCrossRecordCompositionContractReport,
  candidateLattice: KeqingLunarSourceConditionedCandidateLatticeReport,
): ArtifactGenerationComposedSourceClaimsValidationTarget {
  if (
    composition.teamRecordId !== TARGET_TEAM_ID ||
    composition.sourceAuthored ||
    composition.crossRecordOrdering !== "none" ||
    composition.formulaFixtureReference.technicalExecutionAuthorized
  ) {
    throw new Error(
      `Composition ${composition.compositionId} changed its non-authorizing canonical boundary.`,
    );
  }
  const contractLedger = contract.originLedger;
  if (contractLedger == null) {
    throw new Error("Canonical composition contract has no origin ledger.");
  }
  const targetTeam = requiredExactTargetTeam(candidateLattice);
  const weaponGroup = resolveEquipmentClaim(
    candidateLattice,
    targetTeam,
    composition.weapon.groupId,
    composition.weapon.claimId,
    "matched-by-exact-team-facts",
  );
  const artifactGroup = resolveEquipmentClaim(
    candidateLattice,
    targetTeam,
    composition.artifact.groupId,
    composition.artifact.claimId,
    "matched-by-exact-team-facts",
  );
  const matchedDefinitions = composition.statProfile.matchedClaims.map(
    (claim) =>
      resolveStatClaim(
        candidateLattice,
        targetTeam,
        claim,
        "matched-by-exact-team-facts",
      ),
  );
  if (composition.statProfile.withheldClaims.length !== 1) {
    throw new Error(
      `Composition ${composition.compositionId} must retain exactly one withheld stat claim.`,
    );
  }
  const withheldEvidence = composition.statProfile.withheldClaims[0];
  const withheldDefinition = resolveStatClaim(
    candidateLattice,
    targetTeam,
    withheldEvidence,
    "withheld-unresolved-source-condition",
  );
  if (
    withheldDefinition.claimId !== CR_CIRCLET_CLAIM_ID ||
    withheldDefinition.sourceClaim.kind !== "main-stat" ||
    withheldDefinition.sourceClaim.slot !== "circlet" ||
    stableJson(withheldDefinition.sourceClaim.statIds) !== stableJson(["cr"])
  ) {
    throw new Error(
      `Composition ${composition.compositionId} changed its withheld CRIT Rate Circlet claim.`,
    );
  }

  const mainStatDefinitions = matchedDefinitions.filter(
    (
      definition,
    ): definition is KeqingLunarCandidateStatClaim & {
      sourceClaim: Extract<
        KeqingLunarCandidateStatClaim["sourceClaim"],
        { kind: "main-stat" }
      >;
    } => definition.sourceClaim.kind === "main-stat",
  );
  const substatDefinitions = matchedDefinitions.filter(
    (
      definition,
    ): definition is KeqingLunarCandidateStatClaim & {
      sourceClaim: Extract<
        KeqingLunarCandidateStatClaim["sourceClaim"],
        { kind: "substat" }
      >;
    } => definition.sourceClaim.kind === "substat",
  );
  const sortedMainStats = [...mainStatDefinitions].sort((left, right) => {
    const slotOrder = { sands: 0, goblet: 1, circlet: 2 } as const;
    return (
      slotOrder[left.sourceClaim.slot] - slotOrder[right.sourceClaim.slot] ||
      (left.sourceClaim.priority ?? Number.MAX_SAFE_INTEGER) -
        (right.sourceClaim.priority ?? Number.MAX_SAFE_INTEGER) ||
      left.sourceClaim.entryIndex - right.sourceClaim.entryIndex
    );
  });
  const sortedSubstats = [...substatDefinitions].sort(
    (left, right) =>
      (left.sourceClaim.priority ?? Number.MAX_SAFE_INTEGER) -
        (right.sourceClaim.priority ?? Number.MAX_SAFE_INTEGER) ||
      left.sourceClaim.entryIndex - right.sourceClaim.entryIndex,
  );
  const sourcePriorityGroups = sortedSubstats.map(({ sourceClaim }) => [
    ...sourceClaim.statIds,
  ]) as SubStat[][];
  const statTarget = {
    sands: sortedMainStats
      .filter(({ sourceClaim }) => sourceClaim.slot === "sands")
      .flatMap(({ sourceClaim }) => sourceClaim.statIds) as MainStat[],
    goblet: sortedMainStats
      .filter(({ sourceClaim }) => sourceClaim.slot === "goblet")
      .flatMap(({ sourceClaim }) => sourceClaim.statIds) as MainStat[],
    circlet: sortedMainStats
      .filter(({ sourceClaim }) => sourceClaim.slot === "circlet")
      .flatMap(({ sourceClaim }) => sourceClaim.statIds) as MainStat[],
    substats: sourcePriorityGroups.flat() as SubStat[],
    sourcePriorityGroups,
  };
  if (stableJson(statTarget) !== stableJson(EXPECTED_KEQING_STAT_TARGET)) {
    throw new Error(
      `Composition ${composition.compositionId} no longer derives the exact Keqing stat target.`,
    );
  }
  const matchedStatClaimIds = {
    sands: sortedMainStats
      .filter(({ sourceClaim }) => sourceClaim.slot === "sands")
      .map(({ claimId }) => claimId),
    goblet: sortedMainStats
      .filter(({ sourceClaim }) => sourceClaim.slot === "goblet")
      .map(({ claimId }) => claimId),
    circlet: sortedMainStats
      .filter(({ sourceClaim }) => sourceClaim.slot === "circlet")
      .map(({ claimId }) => claimId),
    substats: sortedSubstats.map(({ claimId }) => claimId),
  };
  const statRepositoryRecordIds = [
    ...new Set(matchedDefinitions.map(({ repositoryRecordId }) => repositoryRecordId)),
  ];
  if (
    statRepositoryRecordIds.length !== 1 ||
    withheldDefinition.repositoryRecordId !== statRepositoryRecordIds[0]
  ) {
    throw new Error(
      `Composition ${composition.compositionId} stat claims do not resolve to one canonical repository record.`,
    );
  }
  if (
    contract.excludedSourceBranches.length !== 1 ||
    contract.excludedSourceBranches[0].claimId !== TWO_NOD_NOTSU_CLAIM_ID ||
    [composition.weapon.claimId, composition.artifact.claimId].includes(
      TWO_NOD_NOTSU_CLAIM_ID,
    )
  ) {
    throw new Error("The excluded two-Nod-Krai branch entered a composition.");
  }

  return {
    kind: "composed-source-claims",
    characterId: "keqing",
    artifactSetId: requireCompositionArtifactSetId(composition),
    sands: [...statTarget.sands],
    goblet: [...statTarget.goblet],
    circlet: [...statTarget.circlet],
    substats: [...statTarget.substats],
    compositionId: composition.compositionId,
    repositoryRecordIds: [
      targetTeam.teamRecordId,
      weaponGroup.repositoryRecordId,
      artifactGroup.repositoryRecordId,
      statRepositoryRecordIds[0],
    ].sort(),
    equipmentClaimIds: [
      composition.weapon.claimId,
      composition.artifact.claimId,
    ],
    matchedStatClaimIds,
    withheldStatClaimIds: [CR_CIRCLET_CLAIM_ID],
    sourcePriorityGroups: statTarget.sourcePriorityGroups.map((group) => [
      ...group,
    ]),
    sourceAuthored: false,
  };
}

function requiredExactTargetTeam(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
): NonNullable<
  KeqingLunarSourceConditionedCandidateLatticeReport["lattice"]
>["teams"][number] {
  const teams =
    lattice.lattice?.teams.filter(
      ({ teamRecordId }) => teamRecordId === TARGET_TEAM_ID,
    ) ?? [];
  if (teams.length !== 1) {
    throw new Error("Expected exactly one canonical target team lattice row.");
  }
  return teams[0];
}

function resolveEquipmentClaim(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  targetTeam: ReturnType<typeof requiredExactTargetTeam>,
  groupId: string,
  claimId: string,
  resolution: "matched-by-exact-team-facts",
): KeqingLunarCandidateEquipmentGroup {
  const matches = lattice.equipmentGroups.flatMap((group) =>
    group.members
      .filter((member) => member.claimId === claimId)
      .map((member) => ({ group, member })),
  );
  const cells = targetTeam.equipmentGroupCells.filter(
    (cell) => cell.groupId === groupId,
  );
  if (
    matches.length !== 1 ||
    matches[0].group.groupId !== groupId ||
    cells.length !== 1 ||
    cells[0].conditionResolution !== resolution ||
    cells[0].members.length !== 1 ||
    cells[0].members[0].claimId !== claimId ||
    cells[0].members[0].conditionResolution !== resolution
  ) {
    throw new Error(
      `Equipment claim ${claimId} did not resolve uniquely to canonical group ${groupId}.`,
    );
  }
  return matches[0].group;
}

function resolveStatClaim(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  targetTeam: ReturnType<typeof requiredExactTargetTeam>,
  evidence: KeqingLunarCrossRecordComposition["statProfile"][
    | "matchedClaims"
    | "withheldClaims"][number],
  resolution:
    | "matched-by-exact-team-facts"
    | "withheld-unresolved-source-condition",
): KeqingLunarCandidateStatClaim {
  const definitions = lattice.statClaims.filter(
    ({ claimId }) => claimId === evidence.claimId,
  );
  const cells = targetTeam.statClaimCells.filter(
    ({ claimId }) => claimId === evidence.claimId,
  );
  if (
    definitions.length !== 1 ||
    cells.length !== 1 ||
    cells[0].conditionResolution !== resolution ||
    evidence.conditionResolution !== resolution ||
    evidence.conditionResolutionOrigin !==
      "guide-factory-exact-team-facts-wrapper" ||
    definitions[0].sourceRecordId !== evidence.sourceRecordId ||
    stableJson(definitions[0].sourceClaim) !== stableJson(evidence.sourceClaim) ||
    stableJson(definitions[0].sourceConditions) !==
      stableJson(evidence.sourceConditions)
  ) {
    throw new Error(
      `Stat claim ${evidence.claimId} did not resolve uniquely to the canonical source and target cell.`,
    );
  }
  return definitions[0];
}

function buildTeammateRepositoryTargets(
  repositoryTargets: readonly KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection[],
  contract: KeqingLunarCrossRecordCompositionContractReport,
): ArtifactGenerationRepositoryBuildValidationTarget[] {
  const ledger = contract.originLedger;
  if (ledger == null) {
    throw new Error("Canonical contract has no teammate-equipment ledger.");
  }
  const observedBoundary = ledger.teammateEquipment.members.map(
    ({ characterId, characterGuideId, buildSourceRecordId, artifact }) => ({
      characterId,
      characterGuideId,
      buildSourceRecordId,
      artifactSetId: artifact.type === "4pc" ? artifact.setId : null,
    }),
  );
  if (
    stableJson(observedBoundary) !==
    stableJson(KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS)
  ) {
    throw new Error(
      "Canonical teammate equipment changed from the three exact repository-build targets.",
    );
  }
  if (
    stableJson(
      repositoryTargets.map(
        ({
          characterId,
          characterGuideId,
          buildSourceRecordId,
          artifact,
        }) => ({
          characterId,
          characterGuideId,
          buildSourceRecordId,
          artifactSetId: artifact.setId,
        }),
      ),
    ) !==
    stableJson(KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS)
  ) {
    throw new Error(
      "Authenticated teammate repository targets changed from the exact matrix boundary.",
    );
  }
  return repositoryTargets.map(buildRepositoryTarget);
}

function buildRepositoryTarget(
  projection: KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection,
): ArtifactGenerationRepositoryBuildValidationTarget {
  const target: ArtifactGenerationRepositoryBuildValidationTarget = {
    kind: "repository-build",
    characterId: projection.characterId,
    characterGuideId: projection.characterGuideId,
    buildSourceRecordId: projection.buildSourceRecordId,
    artifactSetId: projection.artifact.setId,
    sands: [...projection.sands] as MainStat[],
    goblet: [...projection.goblet] as MainStat[],
    circlet: [...projection.circlet] as MainStat[],
    substats: [...projection.substats] as SubStat[],
  };
  if (
    target.sands.length === 0 ||
    target.goblet.length === 0 ||
    target.circlet.length === 0 ||
    target.substats.length === 0
  ) {
    throw new Error(
      `Repository target ${projection.characterId}/${projection.buildSourceRecordId} has incomplete stat observations.`,
    );
  }
  return target;
}

function buildCandidate(
  composedTarget: ArtifactGenerationComposedSourceClaimsValidationTarget,
  teammateTargets: ArtifactGenerationRepositoryBuildValidationTarget[],
  candidateId: string,
): ArtifactGenerationTechnicalCandidate {
  const validationTargets: ArtifactGenerationValidationTarget[] = [
    cloneComposedTarget(composedTarget),
    ...teammateTargets.map(cloneRepositoryTarget),
  ];
  return {
    candidateId,
    classification: "composed-source-claims",
    artifactSetIdsByCharacter: Object.fromEntries(
      validationTargets.map(({ characterId, artifactSetId }) => [
        characterId,
        artifactSetId,
      ]),
    ),
    validationTargets,
  };
}

function requireCompositionArtifactSetId(
  composition: KeqingLunarCrossRecordComposition,
): "marechaussee_hunter" | "night_of_the_skys_unveiling" {
  if (
    composition.artifact.artifact.type !== "4pc" ||
    ![
      "marechaussee_hunter",
      "night_of_the_skys_unveiling",
    ].includes(composition.artifact.artifact.setId)
  ) {
    throw new Error(
      `Composition ${composition.compositionId} has an unexpected artifact target.`,
    );
  }
  return composition.artifact.artifact.setId;
}

function cloneComposedTarget(
  target: ArtifactGenerationComposedSourceClaimsValidationTarget,
): ArtifactGenerationComposedSourceClaimsValidationTarget {
  return {
    ...target,
    sands: [...target.sands],
    goblet: [...target.goblet],
    circlet: [...target.circlet],
    substats: [...target.substats],
    repositoryRecordIds: [...target.repositoryRecordIds],
    equipmentClaimIds: [...target.equipmentClaimIds],
    matchedStatClaimIds: {
      sands: [...target.matchedStatClaimIds.sands],
      goblet: [...target.matchedStatClaimIds.goblet],
      circlet: [...target.matchedStatClaimIds.circlet],
      substats: [...target.matchedStatClaimIds.substats],
    },
    withheldStatClaimIds: [...target.withheldStatClaimIds],
    sourcePriorityGroups: target.sourcePriorityGroups.map((group) => [
      ...group,
    ]),
  };
}

function cloneRepositoryTarget(
  target: ArtifactGenerationRepositoryBuildValidationTarget,
): ArtifactGenerationRepositoryBuildValidationTarget {
  return {
    ...target,
    sands: [...target.sands],
    goblet: [...target.goblet],
    circlet: [...target.circlet],
    substats: [...target.substats],
  };
}

function cloneCandidate(
  candidate: ArtifactGenerationTechnicalCandidate,
): ArtifactGenerationTechnicalCandidate {
  return {
    candidateId: candidate.candidateId,
    classification: candidate.classification,
    artifactSetIdsByCharacter: { ...candidate.artifactSetIdsByCharacter },
    validationTargets: candidate.validationTargets.map((target) =>
      target.kind === "composed-source-claims"
        ? cloneComposedTarget(target)
        : cloneRepositoryTarget(target),
    ),
  };
}

function cloneNodePlan(node: MatrixNodePlan): MatrixNodePlan {
  return {
    sequence: node.sequence,
    nodeId: node.nodeId,
    carryCharacterId: node.carryCharacterId,
    compositionId: node.compositionId,
    artifactSetId: node.artifactSetId,
    recordLocalSourceClassification: node.recordLocalSourceClassification,
    candidate: cloneCandidate(node.candidate),
  };
}

function clonePreparedExecutionSnapshot(
  prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared,
): KeqingLunarCrossRecordTechnicalMatrixPrepared {
  return {
    repository: structuredClone(prepared.repository),
    formulaDraft: structuredClone(prepared.formulaDraft),
    preflight: structuredClone(prepared.preflight),
    canonicalContract: structuredClone(prepared.canonicalContract),
    composedTargets: prepared.composedTargets.map(cloneComposedTarget),
    candidates: prepared.candidates.map(cloneCandidate),
    nodes: prepared.nodes.map(cloneNodePlan),
    generatedFrom: prepared.generatedFrom.map((entry) => ({ ...entry })),
    inputBoundary: { ...prepared.inputBoundary },
    trustedCapability: prepared.trustedCapability,
  };
}

function preparedAuthorityPayload(
  prepared: Omit<
    KeqingLunarCrossRecordTechnicalMatrixPrepared,
    "trustedCapability"
  >,
): unknown {
  return {
    repository: prepared.repository,
    formulaDraft: prepared.formulaDraft,
    preflight: prepared.preflight,
    canonicalContract: prepared.canonicalContract,
    composedTargets: prepared.composedTargets,
    candidates: prepared.candidates,
    nodes: prepared.nodes,
    generatedFrom: prepared.generatedFrom,
    inputBoundary: prepared.inputBoundary,
  };
}

function validatePreparedEnvelope(
  prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared,
): KeqingLunarCrossRecordTechnicalMatrixIssue | null {
  const preparedState = TRUSTED_PREPARED_STATES.get(prepared);
  const capabilityState = TRUSTED_CAPABILITY_STATES.get(
    prepared.trustedCapability,
  );
  if (
    preparedState == null ||
    capabilityState == null ||
    preparedState.capability !== prepared.trustedCapability ||
    preparedState.authorityPayloadSha256 !==
      capabilityState.authorityPayloadSha256 ||
    Object.isFrozen(prepared.trustedCapability) === false
  ) {
    return {
      code: "prevalidation.trusted_capability_invalid",
      path: "prepared.trustedCapability",
      message:
        "The prepared matrix does not carry its original frozen non-serializable trusted capability.",
    };
  }
  const observedAuthorityHash = sha256Text(
    stableJson(preparedAuthorityPayload(prepared)),
  );
  if (
    observedAuthorityHash !== preparedState.authorityPayloadSha256 ||
    observedAuthorityHash !== prepared.trustedCapability.authorityPayloadSha256
  ) {
    return {
      code: "prevalidation.prepared_authority_payload_changed",
      path: "prepared",
      message:
        "Repository, formula, preflight, canonical contract, targets, candidates, node/carry plan, or generatedFrom changed after trusted preparation.",
    };
  }
  if (
    prepared.canonicalContract.contractStatus !== "comparable" ||
    prepared.canonicalContract.compositions.length !== 2 ||
    prepared.nodes.length !== 8 ||
    prepared.candidates.length !== 2 ||
    prepared.composedTargets.length !== 2 ||
    !prepared.preflight.equipmentReadyForTechnicalProbe
  ) {
    return {
      code: "prevalidation.exact_envelope_changed",
      path: "prepared.nodes",
      message:
        "Prepared matrix must retain two canonical candidates, eight node/carry cells, and a passing technical equipment preflight.",
    };
  }
  const expectedAxes = CARRY_CHARACTER_IDS.flatMap((carryCharacterId) =>
    EXPECTED_COMPOSITION_IDS.map((compositionId) => ({
      carryCharacterId,
      compositionId,
    })),
  );
  if (
    prepared.nodes.some(
      (node, index) =>
        node.sequence !== index ||
        node.carryCharacterId !== expectedAxes[index].carryCharacterId ||
        node.compositionId !== expectedAxes[index].compositionId,
    )
  ) {
    return {
      code: "prevalidation.node_axis_changed",
      path: "prepared.nodes",
      message:
        "The exact carry-by-composition node axis or deterministic sequence changed.",
    };
  }
  const expectedRepositoryTargets = buildTeammateRepositoryTargets(
    requireKeqingLunarCrossRecordTechnicalMatrixScope(prepared.repository)
      .repositoryTargets,
    prepared.canonicalContract,
  );
  for (const candidate of prepared.candidates) {
    const composedTargets = candidate.validationTargets.filter(
      (
        target,
      ): target is ArtifactGenerationComposedSourceClaimsValidationTarget =>
        target.kind === "composed-source-claims",
    );
    const repositoryTargets = candidate.validationTargets.filter(
      (
        target,
      ): target is ArtifactGenerationRepositoryBuildValidationTarget =>
        target.kind === "repository-build",
    );
    if (
      candidate.classification !== "composed-source-claims" ||
      candidate.validationTargets.length !== 4 ||
      composedTargets.length !== 1 ||
      repositoryTargets.length !== 3 ||
      stableJson(repositoryTargets) !== stableJson(expectedRepositoryTargets) ||
      !validateWithTrustedCapability(
        prepared.trustedCapability,
        composedTargets[0],
      ).valid
    ) {
      return {
        code: "prevalidation.canonical_candidate_changed",
        path: `prepared.candidates.${candidate.candidateId}`,
        message:
          "Both composed nodes and all three teammate repository targets must match the prepared canonical payloads before execution.",
      };
    }
  }
  for (const node of prepared.nodes) {
    const expectedCandidate = prepared.candidates.find(
      ({ validationTargets }) =>
        validationTargets.some(
          (target) =>
            target.kind === "composed-source-claims" &&
            target.compositionId === node.compositionId,
        ),
    );
    if (
      expectedCandidate == null ||
      stableJson({ ...node.candidate, candidateId: expectedCandidate.candidateId }) !==
        stableJson(expectedCandidate)
    ) {
      return {
        code: "prevalidation.node_candidate_changed",
        path: `prepared.nodes.${node.nodeId}`,
        message:
          "A node candidate differs from its exact prevalidated canonical composition payload.",
      };
    }
  }
  return null;
}

function validateWithTrustedCapability(
  capability: KeqingLunarCrossRecordTechnicalMatrixTrustedCapability,
  target: ArtifactGenerationComposedSourceClaimsValidationTarget,
): { valid: true } | { valid: false; message: string } {
  const state = TRUSTED_CAPABILITY_STATES.get(capability);
  const expectedHash = state?.targetHashes.get(target.compositionId);
  const observedHash = sha256Text(stableJson(target));
  return expectedHash != null && observedHash === expectedHash
    ? { valid: true }
    : {
        valid: false,
        message:
          "Target does not exactly match either authenticated checkpoint-18-derived full payload.",
      };
}

function trustedCapabilityTargetHash(
  capability: KeqingLunarCrossRecordTechnicalMatrixTrustedCapability,
  compositionId: string,
): string | null {
  return (
    TRUSTED_CAPABILITY_STATES.get(capability)?.targetHashes.get(compositionId) ??
    null
  );
}

function buildProbeInput(
  prepared: KeqingLunarCrossRecordTechnicalMatrixPrepared,
  carryCharacterId: CarryCharacterId,
  candidates: ArtifactGenerationTechnicalCandidate[],
): ArtifactGenerationTechnicalProbeInput {
  return {
    preflight: structuredClone(prepared.preflight),
    formulaDraft: structuredClone(prepared.formulaDraft),
    validationProvenance: {
      repository: structuredClone(prepared.repository),
    },
    carryCharacterId,
    candidates: candidates.map(cloneCandidate),
    generatedFrom: prepared.generatedFrom.map((entry) => ({ ...entry })),
  };
}

function completedObservation(
  report: ArtifactGenerationTechnicalProbeReport,
  node: MatrixNodePlan,
): CompletedCandidateObservation | null {
  if (
    report.supportsGuideClaims ||
    report.supportsArtifactRecommendations ||
    report.supportsComparativeClaims ||
    report.sourceTeamRecordId !== TARGET_TEAM_ID ||
    report.execution.carryCharacterId !== node.carryCharacterId ||
    report.execution.comparisonWrapperUsed ||
    report.execution.scheduling !== "sequential" ||
    report.execution.energyRecoveryThresholdsUsed ||
    report.execution.numericalDamageRetained ||
    !report.execution.trustedComposedSourceClaimsValidatorAvailable ||
    stableJson(report.execution.candidateOrder) !== stableJson([node.nodeId]) ||
    report.candidates.length !== 1
  ) {
    return null;
  }
  const observation = report.candidates[0];
  return observation.outcome === "completed-structurally" &&
    observation.generatorInvoked &&
    observation.requestedAssignmentsSatisfied &&
    observation.classification === "composed-source-claims" &&
    observation.independentValidation
      .validationTargetsMatchAssignmentAndProvenance &&
    observation.independentValidation.allSetsAreFiveStar &&
    observation.independentValidation.runtimeRegistration === "passed"
    ? observation
    : null;
}

function summarizeValidationTargetObservation(
  observation: ValidationTargetComparison,
): KeqingLunarCrossRecordTechnicalMatrixNode["validationTargetObservations"][number] {
  return {
    characterId: observation.characterId,
    artifactSetId: observation.artifactSetId,
    validationTargetProvenance: structuredClone(
      observation.validationTargetProvenance,
    ),
    observationSha256: sha256Text(stableJson(observation)),
  };
}

function buildExecutionAudit(audit: {
  observedGeneratorInvocationCount: number;
  uniqueTeamBuilds: Set<object>;
  maximumConcurrentGeneratorInvocationCount: number;
  trustedValidatorRuntimeCallCount: number;
  structurallyCompletedNodeCount: number;
}): KeqingLunarCrossRecordTechnicalMatrixReport["executionAudit"] {
  return {
    scheduling: "sequential",
    plannedGeneratorInvocationCount: 8,
    observedGeneratorInvocationCount:
      audit.observedGeneratorInvocationCount,
    uniqueTeamBuildInstanceCount: audit.uniqueTeamBuilds.size,
    maximumConcurrentGeneratorInvocationCount:
      audit.maximumConcurrentGeneratorInvocationCount,
    trustedValidatorRuntimeCallCount:
      audit.trustedValidatorRuntimeCallCount,
    structurallyCompletedNodeCount: audit.structurallyCompletedNodeCount,
    partialStructuralOutputsDiscardedOnFailure: true,
  };
}

function normalizeGeneratedFrom(
  generatedFrom: readonly { path: string; sha256: string }[],
): Array<{ path: string; sha256: string }> {
  return generatedFrom
    .map(({ path, sha256 }) => ({ path, sha256 }))
    .sort((left, right) =>
      compareText(
        `${left.path}\u0000${left.sha256}`,
        `${right.path}\u0000${right.sha256}`,
      ),
    );
}

function sortIssues(
  issues: readonly KeqingLunarCrossRecordTechnicalMatrixIssue[],
): KeqingLunarCrossRecordTechnicalMatrixIssue[] {
  return [...issues].sort((left, right) =>
    compareText(
      `${left.path}\u0000${left.code}\u0000${left.message}`,
      `${right.path}\u0000${right.code}\u0000${right.message}`,
    ),
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function serializeError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : `NonErrorThrow: ${String(error)}`;
}
