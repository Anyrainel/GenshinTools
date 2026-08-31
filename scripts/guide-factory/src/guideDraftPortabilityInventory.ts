import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  hashGuideDraftValue,
  resolveGuideDraftJsonPointer,
} from "./guideDraftPacket";
import { stableJson } from "./io";

export const GUIDE_DRAFT_PORTABILITY_INVENTORY_SCHEMA_VERSION = 1 as const;

export const GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/guideDraftPacket.ts";
export const GUIDE_DRAFT_PORTABILITY_INVENTORY_CORE_RELATIVE_PATH =
  "scripts/guide-factory/src/guideDraftPortabilityInventory.ts";
export const GUIDE_DRAFT_PORTABILITY_INVENTORY_CLI_RELATIVE_PATH =
  "scripts/guide-factory/src/assemble-guide-draft-portability-inventory.ts";

export const GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS = {
  itto: "scripts/guide-factory/reports/itto-request-context-applicability.json",
  klee: "scripts/guide-factory/reports/klee-team-scoped-claim-join-witness.json",
  kokomi:
    "scripts/guide-factory/reports/kokomi-source-local-artifact-slice.json",
  diona:
    "scripts/guide-factory/reports/diona-source-local-support-slice.json",
  xiao:
    "scripts/guide-factory/reports/xiao-ffxx-non-er-condition-free-branch-candidate-contract.json",
  keqing:
    "scripts/guide-factory/reports/keqing-lunar-cross-record-composition-contract.json",
} as const;

export const GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS = [
  ...Object.values(GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS),
  GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
  GUIDE_DRAFT_PORTABILITY_INVENTORY_CORE_RELATIVE_PATH,
  GUIDE_DRAFT_PORTABILITY_INVENTORY_CLI_RELATIVE_PATH,
].sort(compareText);

export const GUIDE_DRAFT_PORTABILITY_INVENTORY_REPORT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "reports",
  "guide-draft-portability-inventory.json",
);

const PINNED_CP58_GUIDE_DRAFT_PACKET_CORE_SHA256 =
  "defde895365ae4b4b402f66483a04e3e5536d933abc516492e74acf188ed6ef5";

export const GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES = [
  "request.entered",
  "request.runtime-effective-talents",
  "team.exact-context",
  "team.subject-investment",
  "authority.source-review",
  "authority.source-authored-request-coverage",
  "authority.composition-authorship",
  "authority.complete-artifact-assignment",
  "authority.complete-build",
  "weapon.observed-options",
  "weapon.selected",
  "weapon.refinement",
  "weapon.quantitative-performance",
  "artifacts.set-options",
  "artifacts.selected-set",
  "artifacts.main-stats.sands.observed-options",
  "artifacts.main-stats.sands.guarded-alternatives",
  "artifacts.main-stats.sands.selected",
  "artifacts.main-stats.goblet.observed-options",
  "artifacts.main-stats.goblet.guarded-alternatives",
  "artifacts.main-stats.goblet.selected",
  "artifacts.main-stats.circlet.observed-options",
  "artifacts.main-stats.circlet.guarded-alternatives",
  "artifacts.main-stats.circlet.selected",
  "substats.source-groups",
  "substats.local-relation-overlays",
  "substats.selected-allocation",
  "substats.scalar-weights",
  "computation.enemy-scenario",
  "computation.formula-counts",
  "computation.rotation-and-buff-coverage",
  "computation.team-total-damage",
  "computation.energy-recharge",
] as const;

export type GuideDraftPortabilityFieldFamily =
  (typeof GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES)[number];

export type GuideDraftPortabilityGapClass =
  | "source-data"
  | "format"
  | "computation"
  | "review-authority";

export type GuideDraftPortabilitySurfaceKind =
  | "direct-source-observation"
  | "guarded-source-observation"
  | "identifier-reference-only"
  | "holdout-locator-only"
  | "guide-factory-composition"
  | "experimental-fixture"
  | "unreviewed-factory-translation"
  | "explicit-negative-boundary"
  | "scope-deferred"
  | "not-serialized";

export type GuideDraftPortabilityGapCode =
  | "request-facts-absent"
  | "effective-talent-facts-absent"
  | "exact-team-roster-absent"
  | "subject-investment-facts-absent"
  | "source-request-coverage-absent"
  | "option-payloads-absent"
  | "selection-evidence-absent"
  | "refinement-evidence-absent"
  | "quantitative-performance-evidence-absent"
  | "complete-artifact-assignment-absent"
  | "complete-build-evidence-absent"
  | "substat-allocation-evidence-absent"
  | "enemy-scenario-evidence-absent"
  | "formula-count-evidence-absent"
  | "rotation-coverage-evidence-absent"
  | "team-total-evidence-absent"
  | "multiple-independent-contexts-not-one-request"
  | "identifier-without-payload"
  | "holdout-locator-without-payload"
  | "guarded-choice-unresolved"
  | "group-order-is-not-selection"
  | "cross-record-composition-not-a-source-build"
  | "experimental-fixture-not-a-guide-field"
  | "unreviewed-factory-translation-not-a-guide-field"
  | "complete-guide-field-shape-not-serialized"
  | "effective-talents-not-computed"
  | "build-composition-not-executed"
  | "artifact-assignment-not-executed"
  | "selection-not-executed"
  | "refinement-comparison-not-executed"
  | "quantitative-performance-not-computed"
  | "joint-compatibility-not-evaluated"
  | "local-relation-overlay-not-computed"
  | "ideal-substat-allocation-not-computed"
  | "scalar-weights-not-computed"
  | "formula-counts-not-computed"
  | "rotation-coverage-not-computed"
  | "team-total-not-computed"
  | "energy-recharge-deferred-by-scope";

const GUIDE_DRAFT_PORTABILITY_GAP_CODE_CLASS = {
  "request-facts-absent": "source-data",
  "effective-talent-facts-absent": "source-data",
  "exact-team-roster-absent": "source-data",
  "subject-investment-facts-absent": "source-data",
  "source-request-coverage-absent": "source-data",
  "option-payloads-absent": "source-data",
  "selection-evidence-absent": "source-data",
  "refinement-evidence-absent": "source-data",
  "quantitative-performance-evidence-absent": "source-data",
  "complete-artifact-assignment-absent": "source-data",
  "complete-build-evidence-absent": "source-data",
  "substat-allocation-evidence-absent": "source-data",
  "enemy-scenario-evidence-absent": "source-data",
  "formula-count-evidence-absent": "source-data",
  "rotation-coverage-evidence-absent": "source-data",
  "team-total-evidence-absent": "source-data",
  "multiple-independent-contexts-not-one-request": "format",
  "identifier-without-payload": "format",
  "holdout-locator-without-payload": "format",
  "guarded-choice-unresolved": "format",
  "group-order-is-not-selection": "format",
  "cross-record-composition-not-a-source-build": "format",
  "experimental-fixture-not-a-guide-field": "format",
  "unreviewed-factory-translation-not-a-guide-field": "format",
  "complete-guide-field-shape-not-serialized": "format",
  "effective-talents-not-computed": "computation",
  "build-composition-not-executed": "computation",
  "artifact-assignment-not-executed": "computation",
  "selection-not-executed": "computation",
  "refinement-comparison-not-executed": "computation",
  "quantitative-performance-not-computed": "computation",
  "joint-compatibility-not-evaluated": "computation",
  "local-relation-overlay-not-computed": "computation",
  "ideal-substat-allocation-not-computed": "computation",
  "scalar-weights-not-computed": "computation",
  "formula-counts-not-computed": "computation",
  "rotation-coverage-not-computed": "computation",
  "team-total-not-computed": "computation",
  "energy-recharge-deferred-by-scope": "computation",
} as const satisfies Record<
  GuideDraftPortabilityGapCode,
  Exclude<GuideDraftPortabilityGapClass, "review-authority">
>;

export type GuideDraftPortabilityCharacterId =
  | "arataki_itto"
  | "klee"
  | "sangonomiya_kokomi"
  | "diona"
  | "xiao"
  | "keqing";

export interface GuideDraftPortabilitySourceFile {
  path: string;
  bytesBase64: string;
}

export interface GuideDraftPortabilityInventoryInput {
  sourceFiles: readonly GuideDraftPortabilitySourceFile[];
  generatedFrom: readonly { path: string; sha256: string }[];
}

export interface GuideDraftPortabilityEvidenceReference {
  evidenceId: string;
  family: GuideDraftPortabilityFieldFamily;
  observationKind:
    | "request-context"
    | "team-surface"
    | "investment-surface"
    | "equipment-surface"
    | "stat-surface"
    | "computation-surface"
    | "blocking-boundary"
    | "upstream-fragment-boundary";
  jsonPointer: string;
  canonicalValueSha256: string;
  valueShape: "array" | "object" | "scalar" | "null";
  itemCount: number | null;
}

export interface GuideDraftPortabilityFieldState {
  family: GuideDraftPortabilityFieldFamily;
  surfaceKinds: GuideDraftPortabilitySurfaceKind[];
  gapClasses: Array<Exclude<GuideDraftPortabilityGapClass, "review-authority">>;
  gapCodes: GuideDraftPortabilityGapCode[];
  evidenceReferenceIds: string[];
}

export interface GuideDraftPortabilityTrialGate {
  exactTeamRosterSurface: boolean;
  subjectScopedRequestSurface: boolean;
  artifactSetOptionSurface: boolean;
  allThreeMainStatSlotsSurface: boolean;
  independentApplicabilityWithoutWholeBuildComposition: boolean;
  zeroAssembledBuildsAndCandidates: boolean;
  singleRequestTeamInterpretation: boolean;
  evidenceGatePassed: boolean;
  currentGenericPacketFormatAccepted: false;
}

export interface GuideDraftPortabilitySubjectInventory {
  characterId: GuideDraftPortabilityCharacterId;
  sourceSurface: {
    reportPath: string;
    reportType: string | null;
    classification: string;
    byteLength: number;
    fileSha256: string;
    canonicalObjectSha256: string;
    embeddedGeneratedFromCanonicalSha256: string;
    durableBytesAuthenticated: true;
    upstreamFreshAuthenticationPerformedByThisInventory: false;
    embeddedGeneratedFromWorkspaceRecheckPerformedByThisInventory: false;
    upstreamRecomputationPerformedByThisInventory: false;
    publicationStatus: string | null;
  };
  evidenceReferences: GuideDraftPortabilityEvidenceReference[];
  fieldStates: GuideDraftPortabilityFieldState[];
  reviewAuthorityGap: {
    gapClass: "review-authority";
    sourceReviewStatus: "unreviewed";
    sourcePermissionStatus: "unknown";
    factoryAuthoredJoinsAreSourceAuthorization: false;
    publicationAuthorized: false;
  };
  trialGate: GuideDraftPortabilityTrialGate;
  trialDisposition:
    | "selected-for-next-format-portability-trial"
    | "withheld-additional-gaps";
}

export interface GuideDraftPortabilityInventoryReport {
  schemaVersion: typeof GUIDE_DRAFT_PORTABILITY_INVENTORY_SCHEMA_VERSION;
  reportType: "guide-draft-portability-inventory";
  inventoryId: "six-character-guide-draft-portability-cp59";
  classification: "authenticated-durable-surface-portability-gap-inventory";
  validationStatus: "completed-six-character-closed-field-family-audit";
  publicationStatus: "withheld-offline-experimental-inventory";
  generatedFrom: Array<{ path: string; sha256: string }>;
  rawInputBoundary: {
    status: "accepted";
    exactPathSet: true;
    byteHashClosure: true;
    canonicalJsonByteObjectParity: true;
    sourceFileCount: number;
    jsonReportCount: 6;
  };
  authorityBoundary: {
    durableReportBytesAuthenticated: true;
    upstreamFreshAuthenticationPerformedByThisInventory: false;
    upstreamClaimsReauthorized: false;
    selectedSurfaceCompletenessClaimed: false;
    applicabilityIsRecommendation: false;
  };
  formatBoundary: {
    assessedCorePath: typeof GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH;
    assessedCoreSha256: typeof PINNED_CP58_GUIDE_DRAFT_PACKET_CORE_SHA256;
    assessmentMethod: "reviewed-exact-core-fingerprint";
    reusableClosedFieldTreePolicyPresent: true;
    reusableExactProvenanceHashPolicyPresent: true;
    upstreamAnchorModel: "cp57-envelope-candidate-artifact-profile";
    nonCp57UpstreamAnchorSupported: false;
    zeroLocalRelationPacketSupported: false;
    relationStateDiscriminatorsAreCp57Specific: true;
    portabilityStatus: "blocked-pending-generic-anchor-and-readiness-refactor";
  };
  scopeBoundary: {
    fieldFamilies: GuideDraftPortabilityFieldFamily[];
    fieldFamilyCount: number;
    energyRecovery: "inventory-boundary-only-deferred-by-user";
    coverageScoreComputed: false;
    subjectRankComputed: false;
    majorityVoteComputed: false;
  };
  subjects: GuideDraftPortabilitySubjectInventory[];
  selectedTrial: {
    characterId: "klee";
    selectionMethod: "exact-boolean-evidence-gate-not-score";
    evidenceGateEligibleCharacterIds: ["klee"];
    selectionIsGuideRecommendation: false;
    selectionIsCharacterRank: false;
    nextRequiredWork: "generalize-upstream-anchor-and-zero-relation-readiness";
  };
  summary: {
    subjectCount: 6;
    fieldFamilyCountPerSubject: number;
    fieldStateCount: number;
    directSourceObservationRowCount: number;
    guardedSourceObservationRowCount: number;
    identifierReferenceOnlyRowCount: number;
    holdoutLocatorOnlyRowCount: number;
    guideFactoryCompositionRowCount: number;
    experimentalFixtureRowCount: number;
    unreviewedFactoryTranslationRowCount: number;
    explicitNegativeBoundaryRowCount: number;
    scopeDeferredRowCount: number;
    notSerializedRowCount: number;
    sourceDataGapRowCount: number;
    formatGapRowCount: number;
    computationGapRowCount: number;
    reviewAuthorityGapCount: 6;
    evidenceGateEligibleSubjectCount: 1;
    currentFormatAcceptedSubjectCount: 0;
    selectedTrialSubjectCount: 1;
    guideCount: 0;
    assembledBuildCount: 0;
    recommendationCount: 0;
    rankCount: 0;
    optimizerRunCount: 0;
    damageComputationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  capabilityBoundary: {
    supportsPortabilityInventory: true;
    supportsGuideClaims: false;
    supportsPublication: false;
    supportsTeamRecommendationClaims: false;
    supportsEquipmentRecommendationClaims: false;
    supportsStatRecommendationClaims: false;
    supportsRankClaims: false;
    supportsOptimizerClaims: false;
    supportsDamageClaims: false;
    supportsRotationClaims: false;
    supportsEnergyRecoveryClaims: false;
  };
  reportSha256: string;
}

export type GuideDraftPortabilityInventoryAuthentication =
  | {
      authenticated: true;
      canonicalReport: GuideDraftPortabilityInventoryReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-rejected" | "serialized-report-mismatch";
      message: string;
    };

type ReportMap = Record<keyof typeof GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS, unknown>;

type FamilyPolicy = GuideDraftPortabilityFieldState;

type EvidencePolicy = Omit<
  GuideDraftPortabilityEvidenceReference,
  "canonicalValueSha256" | "valueShape" | "itemCount"
>;

type SubjectPolicy = {
  key: keyof typeof GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS;
  characterId: GuideDraftPortabilityCharacterId;
  expectedReportType: string | null;
  expectedClassification: string;
  expectedPublicationStatus: string | null;
  evidence: EvidencePolicy[];
  fields: FamilyPolicy[];
};

const SUBJECT_POLICIES: readonly SubjectPolicy[] = [
  {
    key: "itto",
    characterId: "arataki_itto",
    expectedReportType: "itto-request-context-applicability-report",
    expectedClassification: "descriptive-request-account-applicability-projection",
    expectedPublicationStatus: "withheld-experimental-context",
    evidence: [
      evidence("itto.request-contexts", "request.entered", "request-context", "/projections"),
      evidence("itto.team-pointers", "team.exact-context", "team-surface", "/projections/0/teamProjections"),
      evidence("itto.sands-claim", "artifacts.main-stats.sands.observed-options", "upstream-fragment-boundary", "/projections/0/teamProjections/0/claimProjections/0"),
      evidence("itto.goblet-claim", "artifacts.main-stats.goblet.observed-options", "upstream-fragment-boundary", "/projections/0/teamProjections/0/claimProjections/1"),
      evidence("itto.goblet-guard-claim", "artifacts.main-stats.goblet.guarded-alternatives", "upstream-fragment-boundary", "/projections/0/teamProjections/0/claimProjections/2"),
      evidence("itto.circlet-claim", "artifacts.main-stats.circlet.observed-options", "upstream-fragment-boundary", "/projections/0/teamProjections/0/claimProjections/3"),
      evidence("itto.substat-claims", "substats.source-groups", "upstream-fragment-boundary", "/projections/0/teamProjections/0/claimProjections/4"),
      evidence("itto.artifact-claims", "artifacts.set-options", "upstream-fragment-boundary", "/projections/0/teamProjections/0/claimProjections/7"),
      evidence("itto.weapon-claims", "weapon.observed-options", "upstream-fragment-boundary", "/projections/0/teamProjections/0/claimProjections/11"),
      evidence("itto.review", "authority.source-review", "blocking-boundary", "/publicationStatus"),
      evidence("itto.source-authorization", "authority.source-authored-request-coverage", "blocking-boundary", "/supportsSourceAuthorization"),
      evidence("itto.composition", "authority.composition-authorship", "blocking-boundary", "/buildComposition"),
      evidence("itto.build-count", "authority.complete-build", "blocking-boundary", "/summary/assembledBuildCount"),
    ],
    fields: fields({
      "request.entered": directWithGap("format", "multiple-independent-contexts-not-one-request", "itto.request-contexts"),
      "request.runtime-effective-talents": missingSourceAndComputation("effective-talent-facts-absent", "effective-talents-not-computed"),
      "team.exact-context": identifier("exact-team-roster-absent", "itto.team-pointers"),
      "team.subject-investment": missingSource("subject-investment-facts-absent"),
      "authority.source-review": negativeBoundary("itto.review"),
      "authority.source-authored-request-coverage": negative("source-data", "source-request-coverage-absent", "itto.source-authorization"),
      "authority.composition-authorship": negative("computation", "build-composition-not-executed", "itto.composition"),
      "authority.complete-artifact-assignment": missingSourceAndComputation("complete-artifact-assignment-absent", "artifact-assignment-not-executed"),
      "authority.complete-build": negativeWithGaps(["source-data", "computation"], ["complete-build-evidence-absent", "build-composition-not-executed"], "itto.build-count"),
      "weapon.observed-options": identifier("option-payloads-absent", "itto.weapon-claims"),
      "weapon.selected": notComputed("selection-not-executed"),
      "weapon.refinement": missingSource("refinement-evidence-absent"),
      "weapon.quantitative-performance": missingSourceAndComputation("quantitative-performance-evidence-absent", "quantitative-performance-not-computed"),
      "artifacts.set-options": identifier("option-payloads-absent", "itto.artifact-claims"),
      "artifacts.selected-set": notComputed("selection-not-executed"),
      "artifacts.main-stats.sands.observed-options": identifier("option-payloads-absent", "itto.sands-claim"),
      "artifacts.main-stats.sands.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.sands.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.goblet.observed-options": identifier("option-payloads-absent", "itto.goblet-claim"),
      "artifacts.main-stats.goblet.guarded-alternatives": guardedIdentifier("itto.goblet-guard-claim"),
      "artifacts.main-stats.goblet.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.circlet.observed-options": identifier("option-payloads-absent", "itto.circlet-claim"),
      "artifacts.main-stats.circlet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.circlet.selected": notComputed("selection-not-executed"),
      "substats.source-groups": identifier("option-payloads-absent", "itto.substat-claims"),
      "substats.local-relation-overlays": notComputed("local-relation-overlay-not-computed"),
      "substats.selected-allocation": missingSourceAndComputation("substat-allocation-evidence-absent", "ideal-substat-allocation-not-computed"),
      "substats.scalar-weights": notComputed("scalar-weights-not-computed"),
      "computation.enemy-scenario": missingSource("enemy-scenario-evidence-absent"),
      "computation.formula-counts": missingSourceAndComputation("formula-count-evidence-absent", "formula-counts-not-computed"),
      "computation.rotation-and-buff-coverage": missingSourceAndComputation("rotation-coverage-evidence-absent", "rotation-coverage-not-computed"),
      "computation.team-total-damage": missingSourceAndComputation("team-total-evidence-absent", "team-total-not-computed"),
      "computation.energy-recharge": deferredEnergy(),
    }),
  },
  {
    key: "klee",
    characterId: "klee",
    expectedReportType: "klee-team-scoped-condition-resolved-claim-join-witness",
    expectedClassification: "authenticated-descriptive-independent-applicability-witness",
    expectedPublicationStatus: "withheld-unreviewed-factory-evidence-join",
    evidence: [
      evidence("klee.request-context", "request.entered", "request-context", "/positiveWitness/claims/0/requestProjection/requestContextBindings/0/requestPredicate"),
      evidence("klee.exact-team", "team.exact-context", "team-surface", "/positiveWitness/team"),
      evidence("klee.main-stat.sands", "artifacts.main-stats.sands.observed-options", "stat-surface", "/positiveWitness/claims/2/sourceClaim/payload"),
      evidence("klee.main-stat.goblet", "artifacts.main-stats.goblet.observed-options", "stat-surface", "/positiveWitness/claims/1/sourceClaim/payload"),
      evidence("klee.main-stat.circlet", "artifacts.main-stats.circlet.observed-options", "stat-surface", "/positiveWitness/claims/0/sourceClaim/payload"),
      evidence("klee.artifact-set", "artifacts.set-options", "equipment-surface", "/positiveWitness/claims/3/sourceClaim/payload"),
      evidence("klee.compatibility-block", "weapon.selected", "blocking-boundary", "/positiveWitness/jointPayloadCompatibilityEstablished"),
      evidence("klee.negative-control", "team.exact-context", "blocking-boundary", "/negativeControl"),
      evidence("klee.review", "authority.source-review", "blocking-boundary", "/publicationStatus"),
      evidence("klee.source-authorization", "authority.source-authored-request-coverage", "blocking-boundary", "/supportsSourceAuthorization"),
      evidence("klee.authorship", "authority.composition-authorship", "blocking-boundary", "/authorshipBoundary"),
      evidence("klee.completeness", "authority.complete-build", "blocking-boundary", "/positiveWitness/completenessEstablished"),
      evidence("klee.build-count", "authority.complete-build", "blocking-boundary", "/assembledBuildCount"),
      evidence("klee.selection-boundary", "weapon.selected", "blocking-boundary", "/choiceSelectionExecuted"),
    ],
    fields: fields({
      "request.entered": direct("klee.request-context"),
      "request.runtime-effective-talents": missingSourceAndComputation("effective-talent-facts-absent", "effective-talents-not-computed"),
      "team.exact-context": directAndNegative("klee.exact-team", "klee.negative-control"),
      "team.subject-investment": missingSource("subject-investment-facts-absent"),
      "authority.source-review": negativeBoundary("klee.review"),
      "authority.source-authored-request-coverage": negative("source-data", "source-request-coverage-absent", "klee.source-authorization"),
      "authority.composition-authorship": negative("format", "cross-record-composition-not-a-source-build", "klee.authorship"),
      "authority.complete-artifact-assignment": negativeWithGaps(["source-data", "computation"], ["complete-artifact-assignment-absent", "joint-compatibility-not-evaluated"], "klee.compatibility-block"),
      "authority.complete-build": negativeWithGaps(["source-data", "computation"], ["complete-build-evidence-absent", "build-composition-not-executed"], "klee.completeness", "klee.build-count"),
      "weapon.observed-options": missingSource("option-payloads-absent"),
      "weapon.selected": negative("computation", "selection-not-executed", "klee.selection-boundary", "klee.compatibility-block"),
      "weapon.refinement": missingSource("refinement-evidence-absent"),
      "weapon.quantitative-performance": missingSourceAndComputation("quantitative-performance-evidence-absent", "quantitative-performance-not-computed"),
      "artifacts.set-options": direct("klee.artifact-set"),
      "artifacts.selected-set": negative("computation", "selection-not-executed", "klee.selection-boundary", "klee.compatibility-block"),
      "artifacts.main-stats.sands.observed-options": direct("klee.main-stat.sands"),
      "artifacts.main-stats.sands.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.sands.selected": negative("computation", "selection-not-executed", "klee.selection-boundary"),
      "artifacts.main-stats.goblet.observed-options": direct("klee.main-stat.goblet"),
      "artifacts.main-stats.goblet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.goblet.selected": negative("computation", "selection-not-executed", "klee.selection-boundary"),
      "artifacts.main-stats.circlet.observed-options": direct("klee.main-stat.circlet"),
      "artifacts.main-stats.circlet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.circlet.selected": negative("computation", "selection-not-executed", "klee.selection-boundary"),
      "substats.source-groups": missingSource("option-payloads-absent"),
      "substats.local-relation-overlays": notComputed("local-relation-overlay-not-computed"),
      "substats.selected-allocation": missingSourceAndComputation("substat-allocation-evidence-absent", "ideal-substat-allocation-not-computed"),
      "substats.scalar-weights": notComputed("scalar-weights-not-computed"),
      "computation.enemy-scenario": missingSource("enemy-scenario-evidence-absent"),
      "computation.formula-counts": missingSourceAndComputation("formula-count-evidence-absent", "formula-counts-not-computed"),
      "computation.rotation-and-buff-coverage": missingSourceAndComputation("rotation-coverage-evidence-absent", "rotation-coverage-not-computed"),
      "computation.team-total-damage": missingSourceAndComputation("team-total-evidence-absent", "team-total-not-computed"),
      "computation.energy-recharge": deferredEnergy(),
    }),
  },
  {
    key: "kokomi",
    characterId: "sangonomiya_kokomi",
    expectedReportType: "kokomi-source-local-artifact-slice",
    expectedClassification: "authenticated-source-local-condition-binding-slice",
    expectedPublicationStatus: "withheld-unreviewed-source-slice",
    evidence: [
      evidence("kokomi.exact-team", "team.exact-context", "team-surface", "/sourceLocalSlice/exactTeamControls/0"),
      evidence("kokomi.artifact-set", "artifacts.set-options", "equipment-surface", "/selectedOccurrences/0/payload"),
      evidence("kokomi.artifact-holdouts", "artifacts.set-options", "upstream-fragment-boundary", "/holdoutOccurrences"),
      evidence("kokomi.review", "authority.source-review", "blocking-boundary", "/publicationStatus"),
      evidence("kokomi.source-authorization", "authority.source-authored-request-coverage", "blocking-boundary", "/supportsSourceAuthorization"),
      evidence("kokomi.assignment", "authority.complete-artifact-assignment", "blocking-boundary", "/artifactAssignmentExecuted"),
      evidence("kokomi.composition", "authority.complete-build", "blocking-boundary", "/buildCompositionExecuted"),
    ],
    fields: fields({
      "request.entered": missingSource("request-facts-absent"),
      "request.runtime-effective-talents": missingSourceAndComputation("effective-talent-facts-absent", "effective-talents-not-computed"),
      "team.exact-context": direct("kokomi.exact-team"),
      "team.subject-investment": missingSource("subject-investment-facts-absent"),
      "authority.source-review": negativeBoundary("kokomi.review"),
      "authority.source-authored-request-coverage": negative("source-data", "source-request-coverage-absent", "kokomi.source-authorization"),
      "authority.composition-authorship": negative("computation", "build-composition-not-executed", "kokomi.composition"),
      "authority.complete-artifact-assignment": negativeWithGaps(["source-data", "computation"], ["complete-artifact-assignment-absent", "artifact-assignment-not-executed"], "kokomi.assignment"),
      "authority.complete-build": negativeWithGaps(["source-data", "computation"], ["complete-build-evidence-absent", "build-composition-not-executed"], "kokomi.composition"),
      "weapon.observed-options": missingSource("option-payloads-absent"),
      "weapon.selected": notComputed("selection-not-executed"),
      "weapon.refinement": missingSource("refinement-evidence-absent"),
      "weapon.quantitative-performance": missingSourceAndComputation("quantitative-performance-evidence-absent", "quantitative-performance-not-computed"),
      "artifacts.set-options": directAndHoldout("kokomi.artifact-set", "kokomi.artifact-holdouts"),
      "artifacts.selected-set": notComputed("selection-not-executed"),
      "artifacts.main-stats.sands.observed-options": missingSource("option-payloads-absent"),
      "artifacts.main-stats.sands.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.sands.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.goblet.observed-options": missingSource("option-payloads-absent"),
      "artifacts.main-stats.goblet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.goblet.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.circlet.observed-options": missingSource("option-payloads-absent"),
      "artifacts.main-stats.circlet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.circlet.selected": notComputed("selection-not-executed"),
      "substats.source-groups": missingSource("option-payloads-absent"),
      "substats.local-relation-overlays": notComputed("local-relation-overlay-not-computed"),
      "substats.selected-allocation": missingSourceAndComputation("substat-allocation-evidence-absent", "ideal-substat-allocation-not-computed"),
      "substats.scalar-weights": notComputed("scalar-weights-not-computed"),
      "computation.enemy-scenario": missingSource("enemy-scenario-evidence-absent"),
      "computation.formula-counts": missingSourceAndComputation("formula-count-evidence-absent", "formula-counts-not-computed"),
      "computation.rotation-and-buff-coverage": missingSourceAndComputation("rotation-coverage-evidence-absent", "rotation-coverage-not-computed"),
      "computation.team-total-damage": missingSourceAndComputation("team-total-evidence-absent", "team-total-not-computed"),
      "computation.energy-recharge": deferredEnergy(),
    }),
  },
  {
    key: "diona",
    characterId: "diona",
    expectedReportType: "diona-source-local-support-slice",
    expectedClassification: "authenticated-source-local-condition-binding-slice",
    expectedPublicationStatus: "withheld-unreviewed-source-slice",
    evidence: [
      evidence("diona.request-context", "request.entered", "request-context", "/sourceLocalSlice/requestContextReport/teamProjections/0/claimProjections/0/requestContextBindings/0/requestPredicate"),
      evidence("diona.exact-team", "team.exact-context", "team-surface", "/sourceLocalSlice/exactTeamControls/0"),
      evidence("diona.artifact-set", "artifacts.set-options", "equipment-surface", "/selectedOccurrences/0/payload"),
      evidence("diona.artifact-holdout", "artifacts.set-options", "upstream-fragment-boundary", "/holdoutOccurrences/0"),
      evidence("diona.circlet-holdout", "artifacts.main-stats.circlet.observed-options", "upstream-fragment-boundary", "/holdoutOccurrences/6"),
      evidence("diona.substat-holdout", "substats.source-groups", "upstream-fragment-boundary", "/holdoutOccurrences/7"),
      evidence("diona.weapon-holdout", "weapon.observed-options", "upstream-fragment-boundary", "/holdoutOccurrences/8"),
      evidence("diona.review", "authority.source-review", "blocking-boundary", "/publicationStatus"),
      evidence("diona.source-authorization", "authority.source-authored-request-coverage", "blocking-boundary", "/supportsSourceAuthorization"),
      evidence("diona.assignment", "authority.complete-artifact-assignment", "blocking-boundary", "/artifactAssignmentExecuted"),
      evidence("diona.composition", "authority.complete-build", "blocking-boundary", "/buildCompositionExecuted"),
    ],
    fields: fields({
      "request.entered": direct("diona.request-context"),
      "request.runtime-effective-talents": missingSourceAndComputation("effective-talent-facts-absent", "effective-talents-not-computed"),
      "team.exact-context": direct("diona.exact-team"),
      "team.subject-investment": missingSource("subject-investment-facts-absent"),
      "authority.source-review": negativeBoundary("diona.review"),
      "authority.source-authored-request-coverage": negative("source-data", "source-request-coverage-absent", "diona.source-authorization"),
      "authority.composition-authorship": negative("computation", "build-composition-not-executed", "diona.composition"),
      "authority.complete-artifact-assignment": negativeWithGaps(["source-data", "computation"], ["complete-artifact-assignment-absent", "artifact-assignment-not-executed"], "diona.assignment"),
      "authority.complete-build": negativeWithGaps(["source-data", "computation"], ["complete-build-evidence-absent", "build-composition-not-executed"], "diona.composition"),
      "weapon.observed-options": holdout("diona.weapon-holdout"),
      "weapon.selected": notComputed("selection-not-executed"),
      "weapon.refinement": missingSource("refinement-evidence-absent"),
      "weapon.quantitative-performance": missingSourceAndComputation("quantitative-performance-evidence-absent", "quantitative-performance-not-computed"),
      "artifacts.set-options": directAndHoldout("diona.artifact-set", "diona.artifact-holdout"),
      "artifacts.selected-set": notComputed("selection-not-executed"),
      "artifacts.main-stats.sands.observed-options": missingSource("option-payloads-absent"),
      "artifacts.main-stats.sands.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.sands.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.goblet.observed-options": missingSource("option-payloads-absent"),
      "artifacts.main-stats.goblet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.goblet.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.circlet.observed-options": holdout("diona.circlet-holdout"),
      "artifacts.main-stats.circlet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.circlet.selected": notComputed("selection-not-executed"),
      "substats.source-groups": holdout("diona.substat-holdout"),
      "substats.local-relation-overlays": notComputed("local-relation-overlay-not-computed"),
      "substats.selected-allocation": missingSourceAndComputation("substat-allocation-evidence-absent", "ideal-substat-allocation-not-computed"),
      "substats.scalar-weights": notComputed("scalar-weights-not-computed"),
      "computation.enemy-scenario": missingSource("enemy-scenario-evidence-absent"),
      "computation.formula-counts": missingSourceAndComputation("formula-count-evidence-absent", "formula-counts-not-computed"),
      "computation.rotation-and-buff-coverage": missingSourceAndComputation("rotation-coverage-evidence-absent", "rotation-coverage-not-computed"),
      "computation.team-total-damage": missingSourceAndComputation("team-total-evidence-absent", "team-total-not-computed"),
      "computation.energy-recharge": deferredEnergy(),
    }),
  },
  {
    key: "xiao",
    characterId: "xiao",
    expectedReportType: "xiao-ffxx-non-er-condition-free-branch-candidate-contract",
    expectedClassification: "authenticated-guide-factory-authored-partial-branch-candidate-domain",
    expectedPublicationStatus: "withheld-unreviewed-partial-candidate-domain",
    evidence: [
      evidence("xiao.team-id-only", "team.exact-context", "upstream-fragment-boundary", "/candidates/0/teamRecordId"),
      evidence("xiao.weapon-groups", "weapon.observed-options", "equipment-surface", "/rankedFiveStarBranchGroups"),
      evidence("xiao.four-star-group", "weapon.observed-options", "equipment-surface", "/unrankedFourStarBranchGroups"),
      evidence("xiao.artifact-set", "artifacts.set-options", "equipment-surface", "/singletonAxes/artifactSet"),
      evidence("xiao.sands", "artifacts.main-stats.sands.observed-options", "stat-surface", "/singletonAxes/sands"),
      evidence("xiao.goblet", "artifacts.main-stats.goblet.observed-options", "stat-surface", "/singletonAxes/goblet"),
      evidence("xiao.guarded-circlet", "artifacts.main-stats.circlet.guarded-alternatives", "blocking-boundary", "/missingAxes/circlet"),
      evidence("xiao.guarded-substats", "substats.source-groups", "blocking-boundary", "/missingAxes/substats"),
      evidence("xiao.request-views", "request.entered", "blocking-boundary", "/candidates/0/baseViewEvidence"),
      evidence("xiao.refinement", "weapon.refinement", "blocking-boundary", "/candidates/0/axes/0/refinement"),
      evidence("xiao.candidates", "authority.composition-authorship", "computation-surface", "/candidates"),
      evidence("xiao.formula-boundary", "computation.formula-counts", "blocking-boundary", "/formulaInputsUsed"),
      evidence("xiao.review", "authority.source-review", "blocking-boundary", "/publicationStatus"),
      evidence("xiao.source-authorization", "authority.source-authored-request-coverage", "blocking-boundary", "/supportsSourceAuthorization"),
      evidence("xiao.selection-boundary", "weapon.selected", "blocking-boundary", "/choiceSelectionExecuted"),
      evidence("xiao.build-count", "authority.complete-build", "blocking-boundary", "/summary/assembledBuildCount"),
    ],
    fields: fields({
      "request.entered": negativeWithGaps(["source-data", "format"], ["request-facts-absent", "complete-guide-field-shape-not-serialized"], "xiao.request-views"),
      "request.runtime-effective-talents": missingSourceAndComputation("effective-talent-facts-absent", "effective-talents-not-computed"),
      "team.exact-context": identifier("exact-team-roster-absent", "xiao.team-id-only"),
      "team.subject-investment": negative("source-data", "subject-investment-facts-absent", "xiao.request-views"),
      "authority.source-review": negativeBoundary("xiao.review"),
      "authority.source-authored-request-coverage": negative("source-data", "source-request-coverage-absent", "xiao.source-authorization"),
      "authority.composition-authorship": factoryComposition("xiao.candidates"),
      "authority.complete-artifact-assignment": negativeWithGaps(["source-data", "computation"], ["complete-artifact-assignment-absent", "artifact-assignment-not-executed"], "xiao.candidates"),
      "authority.complete-build": negativeWithGaps(["source-data", "computation"], ["complete-build-evidence-absent", "build-composition-not-executed"], "xiao.build-count"),
      "weapon.observed-options": directWithGap("format", "group-order-is-not-selection", "xiao.weapon-groups", "xiao.four-star-group"),
      "weapon.selected": negative("computation", "selection-not-executed", "xiao.selection-boundary"),
      "weapon.refinement": negative("source-data", "refinement-evidence-absent", "xiao.refinement"),
      "weapon.quantitative-performance": missingSourceAndComputation("quantitative-performance-evidence-absent", "quantitative-performance-not-computed"),
      "artifacts.set-options": direct("xiao.artifact-set"),
      "artifacts.selected-set": negative("computation", "selection-not-executed", "xiao.selection-boundary"),
      "artifacts.main-stats.sands.observed-options": direct("xiao.sands"),
      "artifacts.main-stats.sands.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.sands.selected": negative("computation", "selection-not-executed", "xiao.selection-boundary"),
      "artifacts.main-stats.goblet.observed-options": direct("xiao.goblet"),
      "artifacts.main-stats.goblet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.goblet.selected": negative("computation", "selection-not-executed", "xiao.selection-boundary"),
      "artifacts.main-stats.circlet.observed-options": missingSource("option-payloads-absent"),
      "artifacts.main-stats.circlet.guarded-alternatives": guarded("xiao.guarded-circlet"),
      "artifacts.main-stats.circlet.selected": negative("computation", "selection-not-executed", "xiao.selection-boundary"),
      "substats.source-groups": guarded("xiao.guarded-substats"),
      "substats.local-relation-overlays": notComputed("local-relation-overlay-not-computed"),
      "substats.selected-allocation": missingSourceAndComputation("substat-allocation-evidence-absent", "ideal-substat-allocation-not-computed"),
      "substats.scalar-weights": notComputed("scalar-weights-not-computed"),
      "computation.enemy-scenario": missingSource("enemy-scenario-evidence-absent"),
      "computation.formula-counts": negative("computation", "formula-counts-not-computed", "xiao.formula-boundary"),
      "computation.rotation-and-buff-coverage": missingSourceAndComputation("rotation-coverage-evidence-absent", "rotation-coverage-not-computed"),
      "computation.team-total-damage": missingSourceAndComputation("team-total-evidence-absent", "team-total-not-computed"),
      "computation.energy-recharge": deferredEnergy(),
    }),
  },
  {
    key: "keqing",
    characterId: "keqing",
    expectedReportType: null,
    expectedClassification: "keqing-lunar-cross-record-composition-contract",
    expectedPublicationStatus: null,
    evidence: [
      evidence("keqing.exact-team", "team.exact-context", "team-surface", "/targetBoundary"),
      evidence("keqing.compositions", "authority.composition-authorship", "computation-surface", "/compositions"),
      evidence("keqing.weapon-options", "weapon.observed-options", "equipment-surface", "/compositions/0/weapon"),
      evidence("keqing.refinement-policy", "weapon.refinement", "computation-surface", "/originLedger/r1ExperimentPolicy"),
      evidence("keqing.artifact-options", "artifacts.set-options", "equipment-surface", "/compositions"),
      evidence("keqing.stat-profile", "artifacts.main-stats.sands.observed-options", "stat-surface", "/compositions/0/statProfile"),
      evidence("keqing.guarded-circlet", "artifacts.main-stats.circlet.guarded-alternatives", "blocking-boundary", "/compositions/0/statProfile/withheldClaims"),
      evidence("keqing.formula-lines", "computation.formula-counts", "computation-surface", "/originLedger/unreviewedFormulaLines"),
      evidence("keqing.calc-context", "computation.enemy-scenario", "computation-surface", "/originLedger/calcContext"),
      evidence("keqing.review", "authority.source-review", "blocking-boundary", "/supportsGuideClaims"),
      evidence("keqing.source-authorization", "authority.source-authored-request-coverage", "blocking-boundary", "/supportsSourceAuthoredBuildClaims"),
      evidence("keqing.execution", "authority.complete-build", "blocking-boundary", "/generatorExecuted"),
    ],
    fields: fields({
      "request.entered": missingSource("request-facts-absent"),
      "request.runtime-effective-talents": missingSourceAndComputation("effective-talent-facts-absent", "effective-talents-not-computed"),
      "team.exact-context": direct("keqing.exact-team"),
      "team.subject-investment": missingSource("subject-investment-facts-absent"),
      "authority.source-review": negativeBoundary("keqing.review"),
      "authority.source-authored-request-coverage": negative("source-data", "source-request-coverage-absent", "keqing.source-authorization"),
      "authority.composition-authorship": factoryComposition("keqing.compositions"),
      "authority.complete-artifact-assignment": negativeWithGaps(["source-data", "computation"], ["complete-artifact-assignment-absent", "joint-compatibility-not-evaluated"], "keqing.compositions"),
      "authority.complete-build": negativeWithGaps(["source-data", "computation"], ["complete-build-evidence-absent", "build-composition-not-executed"], "keqing.execution"),
      "weapon.observed-options": directFactoryComposition("keqing.weapon-options", "keqing.compositions"),
      "weapon.selected": factoryComposition("keqing.compositions"),
      "weapon.refinement": experimentalFixture(
        "refinement-comparison-not-executed",
        "keqing.refinement-policy",
      ),
      "weapon.quantitative-performance": missingSourceAndComputation("quantitative-performance-evidence-absent", "quantitative-performance-not-computed"),
      "artifacts.set-options": directFactoryComposition("keqing.artifact-options", "keqing.compositions"),
      "artifacts.selected-set": factoryComposition("keqing.compositions"),
      "artifacts.main-stats.sands.observed-options": directFactoryComposition("keqing.stat-profile"),
      "artifacts.main-stats.sands.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.sands.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.goblet.observed-options": directFactoryComposition("keqing.stat-profile"),
      "artifacts.main-stats.goblet.guarded-alternatives": notSerialized(),
      "artifacts.main-stats.goblet.selected": notComputed("selection-not-executed"),
      "artifacts.main-stats.circlet.observed-options": directFactoryComposition("keqing.stat-profile"),
      "artifacts.main-stats.circlet.guarded-alternatives": guardedFactoryComposition("keqing.guarded-circlet", "keqing.compositions"),
      "artifacts.main-stats.circlet.selected": notComputed("selection-not-executed"),
      "substats.source-groups": directFactoryComposition("keqing.stat-profile"),
      "substats.local-relation-overlays": notComputed("local-relation-overlay-not-computed"),
      "substats.selected-allocation": missingSourceAndComputation("substat-allocation-evidence-absent", "ideal-substat-allocation-not-computed"),
      "substats.scalar-weights": notComputed("scalar-weights-not-computed"),
      "computation.enemy-scenario": experimentalFixture(
        null,
        "keqing.calc-context",
      ),
      "computation.formula-counts": unreviewedFactoryTranslation(
        "formula-counts-not-computed",
        "keqing.formula-lines",
      ),
      "computation.rotation-and-buff-coverage": missingSourceAndComputation(
        "rotation-coverage-evidence-absent",
        "rotation-coverage-not-computed",
      ),
      "computation.team-total-damage": missingSourceAndComputation("team-total-evidence-absent", "team-total-not-computed"),
      "computation.energy-recharge": deferredEnergy(),
    }),
  },
] as const;

export function buildGuideDraftPortabilityInventoryReport(
  input: GuideDraftPortabilityInventoryInput,
): GuideDraftPortabilityInventoryReport {
  const authenticated = authenticateRawInput(input);
  const reports = parseAndValidateReports(authenticated.textByPath);
  const subjects = SUBJECT_POLICIES.map((policy) =>
    buildSubjectInventory(
      policy,
      reports[policy.key],
      authenticated.shaByPath,
      authenticated.byteLengthByPath,
    ),
  );
  const evidenceGateEligibleCharacterIds = subjects
    .filter(({ trialGate }) => trialGate.evidenceGatePassed)
    .map(({ characterId }) => characterId);
  if (stableJson(evidenceGateEligibleCharacterIds) !== stableJson(["klee"])) {
    throw new Error("Guide-draft portability evidence gate no longer selects exactly Klee.");
  }
  for (const subject of subjects) {
    subject.trialDisposition =
      subject.characterId === "klee"
        ? "selected-for-next-format-portability-trial"
        : "withheld-additional-gaps";
  }

  const fieldStates = subjects.flatMap(({ fieldStates: states }) => states);
  const reportWithoutHash = {
    schemaVersion: GUIDE_DRAFT_PORTABILITY_INVENTORY_SCHEMA_VERSION,
    reportType: "guide-draft-portability-inventory",
    inventoryId: "six-character-guide-draft-portability-cp59",
    classification: "authenticated-durable-surface-portability-gap-inventory",
    validationStatus: "completed-six-character-closed-field-family-audit",
    publicationStatus: "withheld-offline-experimental-inventory",
    generatedFrom: authenticated.generatedFrom,
    rawInputBoundary: {
      status: "accepted",
      exactPathSet: true,
      byteHashClosure: true,
      canonicalJsonByteObjectParity: true,
      sourceFileCount: GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS.length,
      jsonReportCount: 6,
    },
    authorityBoundary: {
      durableReportBytesAuthenticated: true,
      upstreamFreshAuthenticationPerformedByThisInventory: false,
      upstreamClaimsReauthorized: false,
      selectedSurfaceCompletenessClaimed: false,
      applicabilityIsRecommendation: false,
    },
    formatBoundary: {
      assessedCorePath: GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
      assessedCoreSha256: PINNED_CP58_GUIDE_DRAFT_PACKET_CORE_SHA256,
      assessmentMethod: "reviewed-exact-core-fingerprint",
      reusableClosedFieldTreePolicyPresent: true,
      reusableExactProvenanceHashPolicyPresent: true,
      upstreamAnchorModel: "cp57-envelope-candidate-artifact-profile",
      nonCp57UpstreamAnchorSupported: false,
      zeroLocalRelationPacketSupported: false,
      relationStateDiscriminatorsAreCp57Specific: true,
      portabilityStatus: "blocked-pending-generic-anchor-and-readiness-refactor",
    },
    scopeBoundary: {
      fieldFamilies: [...GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES],
      fieldFamilyCount: GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES.length,
      energyRecovery: "inventory-boundary-only-deferred-by-user",
      coverageScoreComputed: false,
      subjectRankComputed: false,
      majorityVoteComputed: false,
    },
    subjects,
    selectedTrial: {
      characterId: "klee",
      selectionMethod: "exact-boolean-evidence-gate-not-score",
      evidenceGateEligibleCharacterIds: ["klee"],
      selectionIsGuideRecommendation: false,
      selectionIsCharacterRank: false,
      nextRequiredWork: "generalize-upstream-anchor-and-zero-relation-readiness",
    },
    summary: {
      subjectCount: 6,
      fieldFamilyCountPerSubject: GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES.length,
      fieldStateCount: fieldStates.length,
      directSourceObservationRowCount: countSurfaceKind(
        fieldStates,
        "direct-source-observation",
      ),
      guardedSourceObservationRowCount: countSurfaceKind(
        fieldStates,
        "guarded-source-observation",
      ),
      identifierReferenceOnlyRowCount: countSurfaceKind(
        fieldStates,
        "identifier-reference-only",
      ),
      holdoutLocatorOnlyRowCount: countSurfaceKind(
        fieldStates,
        "holdout-locator-only",
      ),
      guideFactoryCompositionRowCount: countSurfaceKind(
        fieldStates,
        "guide-factory-composition",
      ),
      experimentalFixtureRowCount: countSurfaceKind(
        fieldStates,
        "experimental-fixture",
      ),
      unreviewedFactoryTranslationRowCount: countSurfaceKind(
        fieldStates,
        "unreviewed-factory-translation",
      ),
      explicitNegativeBoundaryRowCount: countSurfaceKind(
        fieldStates,
        "explicit-negative-boundary",
      ),
      scopeDeferredRowCount: countSurfaceKind(fieldStates, "scope-deferred"),
      notSerializedRowCount: countSurfaceKind(fieldStates, "not-serialized"),
      sourceDataGapRowCount: countGapClass(fieldStates, "source-data"),
      formatGapRowCount: countGapClass(fieldStates, "format"),
      computationGapRowCount: countGapClass(fieldStates, "computation"),
      reviewAuthorityGapCount: 6,
      evidenceGateEligibleSubjectCount: 1,
      currentFormatAcceptedSubjectCount: 0,
      selectedTrialSubjectCount: 1,
      guideCount: 0,
      assembledBuildCount: 0,
      recommendationCount: 0,
      rankCount: 0,
      optimizerRunCount: 0,
      damageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    },
    capabilityBoundary: {
      supportsPortabilityInventory: true,
      supportsGuideClaims: false,
      supportsPublication: false,
      supportsTeamRecommendationClaims: false,
      supportsEquipmentRecommendationClaims: false,
      supportsStatRecommendationClaims: false,
      supportsRankClaims: false,
      supportsOptimizerClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
    },
  } satisfies Omit<GuideDraftPortabilityInventoryReport, "reportSha256">;

  return {
    ...reportWithoutHash,
    reportSha256: hashGuideDraftValue(reportWithoutHash),
  };
}

export function authenticateGuideDraftPortabilityInventoryReport(
  serializedReport: GuideDraftPortabilityInventoryReport,
  input: GuideDraftPortabilityInventoryInput,
): GuideDraftPortabilityInventoryAuthentication {
  let canonicalReport: GuideDraftPortabilityInventoryReport;
  try {
    canonicalReport = buildGuideDraftPortabilityInventoryReport(input);
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-rejected",
      message: error instanceof Error ? error.message : "Canonical input authentication failed.",
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      message: "The serialized portability inventory differs from the canonical reconstruction.",
    };
  }
  return { authenticated: true, canonicalReport };
}

function authenticateRawInput(input: GuideDraftPortabilityInventoryInput): {
  generatedFrom: Array<{ path: string; sha256: string }>;
  textByPath: Map<string, string>;
  shaByPath: Map<string, string>;
  byteLengthByPath: Map<string, number>;
} {
  const expectedPaths = [...GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS];
  const sourceFiles = [...input.sourceFiles].sort((left, right) => compareText(left.path, right.path));
  const generatedFrom = [...input.generatedFrom].sort((left, right) => compareText(left.path, right.path));
  if (
    stableJson(sourceFiles.map(({ path: sourcePath }) => sourcePath)) !== stableJson(expectedPaths) ||
    stableJson(generatedFrom.map(({ path: generatedPath }) => generatedPath)) !== stableJson(expectedPaths)
  ) {
    throw new Error("Guide-draft portability input path closure drifted.");
  }
  const textByPath = new Map<string, string>();
  const shaByPath = new Map<string, string>();
  const byteLengthByPath = new Map<string, number>();
  for (const [index, sourceFile] of sourceFiles.entries()) {
    const bytes = Buffer.from(sourceFile.bytesBase64, "base64");
    if (bytes.toString("base64") !== sourceFile.bytesBase64) {
      throw new Error(`Guide-draft portability source bytes are not canonical base64: ${sourceFile.path}.`);
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (generatedFrom[index]?.path !== sourceFile.path || generatedFrom[index]?.sha256 !== sha256) {
      throw new Error(`Guide-draft portability source hash drifted: ${sourceFile.path}.`);
    }
    textByPath.set(sourceFile.path, bytes.toString("utf8"));
    shaByPath.set(sourceFile.path, sha256);
    byteLengthByPath.set(sourceFile.path, bytes.length);
  }
  if (shaByPath.get(GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH) !== PINNED_CP58_GUIDE_DRAFT_PACKET_CORE_SHA256) {
    throw new Error("The reviewed checkpoint-58 guide-draft packet core fingerprint drifted; reassess format portability before rebuilding this inventory.");
  }
  return { generatedFrom, textByPath, shaByPath, byteLengthByPath };
}

function parseAndValidateReports(textByPath: Map<string, string>): ReportMap {
  const reports = {} as ReportMap;
  for (const [key, reportPath] of Object.entries(GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS) as Array<
    [keyof ReportMap, string]
  >) {
    const text = requiredText(textByPath, reportPath);
    const parsed = JSON.parse(text) as unknown;
    if (stableJson(parsed) !== text) {
      throw new Error(`Guide-draft portability JSON is not in canonical checked-in form: ${reportPath}.`);
    }
    reports[key] = parsed;
  }
  assertIttoReport(reports.itto);
  assertKleeReport(reports.klee);
  assertKokomiReport(reports.kokomi);
  assertDionaReport(reports.diona);
  assertXiaoReport(reports.xiao);
  assertKeqingReport(reports.keqing);
  return reports;
}

function buildSubjectInventory(
  policy: SubjectPolicy,
  report: unknown,
  shaByPath: Map<string, string>,
  byteLengthByPath: Map<string, number>,
): GuideDraftPortabilitySubjectInventory {
  const reportRecord = requireRecord(report, `${policy.key} report`);
  const reportPath = GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS[policy.key];
  const evidenceReferences = policy.evidence.map((entry) => {
    const value = resolveGuideDraftJsonPointer(report, entry.jsonPointer);
    return {
      ...entry,
      canonicalValueSha256: hashGuideDraftValue(value),
      valueShape: valueShape(value),
      itemCount: Array.isArray(value)
        ? value.length
        : isRecord(value)
          ? Object.keys(value).length
          : null,
    } satisfies GuideDraftPortabilityEvidenceReference;
  });
  assertUnique(
    evidenceReferences.map(({ evidenceId }) => evidenceId),
    `${policy.characterId} evidence IDs`,
  );
  const knownEvidenceIds = new Set(evidenceReferences.map(({ evidenceId }) => evidenceId));
  requireEqual(
    policy.fields.map(({ family }) => family),
    GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES,
    `${policy.characterId} closed field-family order`,
  );
  const fieldStates = policy.fields.map((field) => {
    assertUnique(field.surfaceKinds, `${policy.characterId} ${field.family} surface kinds`);
    assertUnique(field.gapClasses, `${policy.characterId} ${field.family} gap classes`);
    assertUnique(field.gapCodes, `${policy.characterId} ${field.family} gap codes`);
    assertUnique(
      field.evidenceReferenceIds,
      `${policy.characterId} ${field.family} evidence references`,
    );
    for (const evidenceId of field.evidenceReferenceIds) {
      if (!knownEvidenceIds.has(evidenceId)) {
        throw new Error(`${policy.characterId} field ${field.family} references unknown evidence ${evidenceId}.`);
      }
    }
    for (const gapCode of field.gapCodes) {
      const expectedClass = GUIDE_DRAFT_PORTABILITY_GAP_CODE_CLASS[gapCode];
      if (!field.gapClasses.includes(expectedClass)) {
        throw new Error(
          `${policy.characterId} field ${field.family} places ${gapCode} outside ${expectedClass}.`,
        );
      }
    }
    for (const gapClass of field.gapClasses) {
      if (
        !field.gapCodes.some(
          (gapCode) => GUIDE_DRAFT_PORTABILITY_GAP_CODE_CLASS[gapCode] === gapClass,
        )
      ) {
        throw new Error(
          `${policy.characterId} field ${field.family} has gap class ${gapClass} without a matching code.`,
        );
      }
    }
    const evidenceFreeSurface = field.surfaceKinds.every(
      (surfaceKind) =>
        surfaceKind === "not-serialized" || surfaceKind === "scope-deferred",
    );
    if (evidenceFreeSurface !== (field.evidenceReferenceIds.length === 0)) {
      throw new Error(
        `${policy.characterId} field ${field.family} evidence/surface boundary drifted.`,
      );
    }
    if (field.surfaceKinds.includes("not-serialized") && field.surfaceKinds.length !== 1) {
      throw new Error(
        `${policy.characterId} field ${field.family} mixes not-serialized with an observed surface.`,
      );
    }
    if (field.family === "computation.energy-recharge") {
      requireEqual(
        field,
        {
          family: "computation.energy-recharge",
          surfaceKinds: ["scope-deferred"],
          gapClasses: ["computation"],
          gapCodes: ["energy-recharge-deferred-by-scope"],
          evidenceReferenceIds: [],
        },
        `${policy.characterId} ER deferral row`,
      );
    }
    return structuredClone(field);
  });
  const gate = deriveTrialGate(fieldStates);
  return {
    characterId: policy.characterId,
    sourceSurface: {
      reportPath,
      reportType: policy.expectedReportType,
      classification: policy.expectedClassification,
      byteLength: requiredNumber(byteLengthByPath, reportPath),
      fileSha256: requiredSha(shaByPath, reportPath),
      canonicalObjectSha256: hashGuideDraftValue(report),
      embeddedGeneratedFromCanonicalSha256: hashGuideDraftValue(
        reportRecord.generatedFrom,
      ),
      durableBytesAuthenticated: true,
      upstreamFreshAuthenticationPerformedByThisInventory: false,
      embeddedGeneratedFromWorkspaceRecheckPerformedByThisInventory: false,
      upstreamRecomputationPerformedByThisInventory: false,
      publicationStatus: policy.expectedPublicationStatus,
    },
    evidenceReferences,
    fieldStates,
    reviewAuthorityGap: {
      gapClass: "review-authority",
      sourceReviewStatus: "unreviewed",
      sourcePermissionStatus: "unknown",
      factoryAuthoredJoinsAreSourceAuthorization: false,
      publicationAuthorized: false,
    },
    trialGate: gate,
    trialDisposition: "withheld-additional-gaps",
  };
}

function assertIttoReport(value: unknown): void {
  const report = requireRecord(value, "Itto report");
  requireEqual(report.reportType, "itto-request-context-applicability-report", "Itto report type");
  requireEqual(report.classification, "descriptive-request-account-applicability-projection", "Itto classification");
  requireEqual(report.comparisonStatus, "comparable", "Itto comparability");
  requireEqual(report.publicationStatus, "withheld-experimental-context", "Itto publication status");
  requireEqual(report.supportsGuideClaims, false, "Itto guide capability");
  const projections = requireArray(report.projections, "Itto projections");
  requireEqual(projections.length, 3, "Itto projection count");
  requireEqual(requireRecord(report.summary, "Itto summary").assembledBuildCount, 0, "Itto build count");
}

function assertKleeReport(value: unknown): void {
  const report = requireRecord(value, "Klee report");
  requireEqual(report.reportType, "klee-team-scoped-condition-resolved-claim-join-witness", "Klee report type");
  requireEqual(report.classification, "authenticated-descriptive-independent-applicability-witness", "Klee classification");
  requireEqual(report.publicationStatus, "withheld-unreviewed-factory-evidence-join", "Klee publication status");
  requireEqual(report.assembledBuildCount, 0, "Klee build count");
  requireEqual(report.candidateCount, 0, "Klee candidate count");
  requireEqual(report.choiceSelectionExecuted, false, "Klee choice-selection boundary");
  requireEqual(report.crossProductExecuted, false, "Klee cross-product boundary");
  requireEqual(
    report.recommendationCompositionExecuted,
    false,
    "Klee recommendation-composition boundary",
  );
  requireEqual(
    report.payloadAxisExpansionExecuted,
    false,
    "Klee payload-axis-expansion boundary",
  );
  requireEqual(
    report.payloadCompatibilityEvaluated,
    false,
    "Klee payload-compatibility boundary",
  );
  requireEqual(report.generatorExecuted, false, "Klee generator boundary");
  requireEqual(report.optimizerExecuted, false, "Klee optimizer boundary");
  requireEqual(report.jointOptimalityEvaluated, false, "Klee optimality boundary");
  requireEqual(report.rankingExecuted, false, "Klee ranking boundary");
  const witness = requireRecord(report.positiveWitness, "Klee positive witness");
  const claims = requireArray(witness.claims, "Klee claims");
  requireEqual(claims.length, 4, "Klee claim count");
  requireEqual(
    witness.independentlyApplicableClaimCount,
    4,
    "Klee independently applicable claim count",
  );
  requireEqual(
    witness.requestContextResolvedClaimCount,
    3,
    "Klee request-resolved claim count",
  );
  requireEqual(
    witness.sourceAlreadyMatchedClaimCount,
    1,
    "Klee source-matched claim count",
  );
  requireEqual(witness.jointPayloadCompatibilityEstablished, false, "Klee compatibility boundary");
  requireEqual(witness.completenessEstablished, false, "Klee completeness boundary");
  const team = requireRecord(witness.team, "Klee exact team");
  requireStringArray(team.memberCharacterIds, ["klee", "furina", "albedo", "xilonen"], "Klee exact team roster");
  requireEqual(
    team.teamRecordId,
    "kqm:team:klee-furina-albedo-xilonen-example-luna-iv",
    "Klee positive team record",
  );

  const expectedRoleClaims = [
    { slot: "circlet", statIds: ["cr", "cd"] },
    { slot: "goblet", statIds: ["pyro%"] },
    { slot: "sands", statIds: ["atk%"] },
  ] as const;
  for (const [index, expected] of expectedRoleClaims.entries()) {
    assertKleeRoleBoundMainStatClaim(
      claims[index],
      expected.slot,
      [...expected.statIds],
      index,
    );
  }
  assertKleeFurinaArtifactClaim(claims[3]);

  const negative = requireRecord(report.negativeControl, "Klee negative control");
  requireEqual(
    negative.controlKind,
    "exact-overload-team-roster-separation-control",
    "Klee negative-control kind",
  );
  requireEqual(
    negative.positiveWitnessConstructed,
    false,
    "Klee negative-control witness boundary",
  );
  requireEqual(
    negative.rosterConditionedClaimExcludedFromWitness,
    true,
    "Klee negative-control exclusion",
  );
  const negativeTeam = requireRecord(negative.team, "Klee negative-control team");
  requireStringArray(
    negativeTeam.memberCharacterIds,
    ["klee", "chevreuse", "durin", "fischl"],
    "Klee negative-control roster",
  );
  requireEqual(
    negativeTeam.teamRecordId,
    "kqm:team:klee-chevreuse-durin-fischl-overload-example-luna-iv",
    "Klee negative-control team record",
  );
  const negativeClaims = requireArray(
    negative.claimControls,
    "Klee negative-control claims",
  );
  requireEqual(negativeClaims.length, 4, "Klee negative-control claim count");
  const excludedArtifactClaim = requireRecord(
    negativeClaims[3],
    "Klee excluded artifact claim",
  );
  const excludedProjection = requireRecord(
    excludedArtifactClaim.requestProjection,
    "Klee excluded artifact request projection",
  );
  requireEqual(
    excludedProjection.contextApplicability,
    "source-definitely-inapplicable",
    "Klee excluded artifact applicability",
  );
  requireEqual(
    excludedProjection.resolution,
    "inapplicable",
    "Klee excluded artifact resolution",
  );
}

function assertKleeRoleBoundMainStatClaim(
  value: unknown,
  slot: "sands" | "goblet" | "circlet",
  statIds: string[],
  index: number,
): void {
  const claim = requireRecord(value, `Klee role-bound claim ${index}`);
  const sourceClaim = requireRecord(
    claim.sourceClaim,
    `Klee role-bound source claim ${index}`,
  );
  requireEqual(sourceClaim.characterId, "klee", `Klee claim ${index} subject`);
  requireEqual(
    sourceClaim.payload,
    {
      priority: null,
      slot,
      statIds,
      target: null,
      type: "main-stat",
    },
    `Klee ${slot} payload`,
  );
  const projection = requireRecord(
    claim.requestProjection,
    `Klee ${slot} request projection`,
  );
  requireEqual(
    projection.contextApplicability,
    "applicable-under-supplied-context",
    `Klee ${slot} applicability`,
  );
  requireEqual(projection.resolution, "matched", `Klee ${slot} resolution`);
  const bindings = requireArray(
    projection.requestContextBindings,
    `Klee ${slot} request bindings`,
  );
  requireEqual(bindings.length, 1, `Klee ${slot} request-binding count`);
  const binding = requireRecord(bindings[0], `Klee ${slot} request binding`);
  requireEqual(
    binding.requestPredicate,
    { characterId: "klee", roleId: "on-field-dps", type: "intended-role-is" },
    `Klee ${slot} request predicate`,
  );
  requireEqual(binding.result, "true", `Klee ${slot} request-binding result`);
  const predicateRows = requireArray(
    binding.predicateRows,
    `Klee ${slot} request predicate rows`,
  );
  requireEqual(predicateRows.length, 1, `Klee ${slot} request predicate-row count`);
  const predicateRow = requireRecord(
    predicateRows[0],
    `Klee ${slot} request predicate row`,
  );
  requireEqual(
    predicateRow.factScope,
    {
      accountSnapshotId: null,
      characterId: "klee",
      teamRecordId: "kqm:team:klee-furina-albedo-xilonen-example-luna-iv",
    },
    `Klee ${slot} request fact scope`,
  );
}

function assertKleeFurinaArtifactClaim(value: unknown): void {
  const claim = requireRecord(value, "Klee Furina artifact claim");
  const sourceClaim = requireRecord(
    claim.sourceClaim,
    "Klee Furina artifact source claim",
  );
  requireEqual(sourceClaim.characterId, "klee", "Klee artifact claim subject");
  requireEqual(
    sourceClaim.predicate,
    { characterId: "furina", type: "exact-team-roster-includes" },
    "Klee artifact predicate",
  );
  requireEqual(
    sourceClaim.payload,
    {
      artifacts: [{ setId: "marechaussee_hunter", type: "4pc" }],
      type: "artifact-group",
    },
    "Klee artifact payload",
  );
  const projection = requireRecord(
    claim.requestProjection,
    "Klee Furina artifact request projection",
  );
  requireEqual(
    projection.contextApplicability,
    "source-already-matched",
    "Klee artifact applicability",
  );
  requireEqual(projection.resolution, "matched", "Klee artifact resolution");
  requireEqual(
    projection.requestContextBindings,
    [],
    "Klee artifact request bindings",
  );
}

function deriveTrialGate(
  fieldStates: GuideDraftPortabilityFieldState[],
): GuideDraftPortabilityTrialGate {
  const request = requiredFieldState(fieldStates, "request.entered");
  const team = requiredFieldState(fieldStates, "team.exact-context");
  const composition = requiredFieldState(
    fieldStates,
    "authority.composition-authorship",
  );
  const completeBuild = requiredFieldState(
    fieldStates,
    "authority.complete-build",
  );
  const artifactSets = requiredFieldState(
    fieldStates,
    "artifacts.set-options",
  );
  const sands = requiredFieldState(
    fieldStates,
    "artifacts.main-stats.sands.observed-options",
  );
  const goblet = requiredFieldState(
    fieldStates,
    "artifacts.main-stats.goblet.observed-options",
  );
  const circlet = requiredFieldState(
    fieldStates,
    "artifacts.main-stats.circlet.observed-options",
  );
  const hasFactoryComposition = fieldStates.some(({ surfaceKinds }) =>
    surfaceKinds.includes("guide-factory-composition"),
  );
  const portableObservationFamilies = new Set<GuideDraftPortabilityFieldFamily>([
    "weapon.observed-options",
    "artifacts.set-options",
    "artifacts.main-stats.sands.observed-options",
    "artifacts.main-stats.goblet.observed-options",
    "artifacts.main-stats.circlet.observed-options",
    "substats.source-groups",
  ]);
  const hasDirectPortableObservation = fieldStates.some(
    (state) =>
      portableObservationFamilies.has(state.family) &&
      hasSurface(state, "direct-source-observation"),
  );
  const evidencePredicates = {
    exactTeamRosterSurface: hasSurface(team, "direct-source-observation"),
    subjectScopedRequestSurface: hasSurface(
      request,
      "direct-source-observation",
    ),
    artifactSetOptionSurface: hasSurface(
      artifactSets,
      "direct-source-observation",
    ),
    allThreeMainStatSlotsSurface: [sands, goblet, circlet].every((state) =>
      hasSurface(state, "direct-source-observation"),
    ),
    independentApplicabilityWithoutWholeBuildComposition:
      hasDirectPortableObservation &&
      hasSurface(composition, "explicit-negative-boundary") &&
      hasSurface(completeBuild, "explicit-negative-boundary") &&
      !hasFactoryComposition,
    zeroAssembledBuildsAndCandidates:
      hasSurface(composition, "explicit-negative-boundary") &&
      hasSurface(completeBuild, "explicit-negative-boundary") &&
      !hasFactoryComposition,
    singleRequestTeamInterpretation:
      hasSurface(request, "direct-source-observation") &&
      !request.gapCodes.includes("multiple-independent-contexts-not-one-request") &&
      hasSurface(team, "direct-source-observation"),
  };
  return {
    ...evidencePredicates,
    evidenceGatePassed: Object.values(evidencePredicates).every(Boolean),
    currentGenericPacketFormatAccepted: false,
  };
}

function requiredFieldState(
  fieldStates: GuideDraftPortabilityFieldState[],
  family: GuideDraftPortabilityFieldFamily,
): GuideDraftPortabilityFieldState {
  const state = fieldStates.find((candidate) => candidate.family === family);
  if (!state) throw new Error(`Missing trial-gate field family: ${family}.`);
  return state;
}

function hasSurface(
  state: GuideDraftPortabilityFieldState,
  surfaceKind: GuideDraftPortabilitySurfaceKind,
): boolean {
  return state.surfaceKinds.includes(surfaceKind);
}

function assertKokomiReport(value: unknown): void {
  const report = requireRecord(value, "Kokomi report");
  requireEqual(report.reportType, "kokomi-source-local-artifact-slice", "Kokomi report type");
  requireEqual(report.classification, "authenticated-source-local-condition-binding-slice", "Kokomi classification");
  requireEqual(report.publicationStatus, "withheld-unreviewed-source-slice", "Kokomi publication status");
  const selected = requireArray(
    report.selectedOccurrences,
    "Kokomi selected occurrences",
  );
  requireEqual(selected.length, 1, "Kokomi selected occurrence count");
  const selectedArtifact = requireRecord(selected[0], "Kokomi selected artifact");
  requireEqual(
    selectedArtifact.characterId,
    "sangonomiya_kokomi",
    "Kokomi selected artifact subject",
  );
  requireEqual(
    selectedArtifact.claimAxis,
    "artifact-recommendation",
    "Kokomi selected artifact axis",
  );
  requireEqual(
    selectedArtifact.payload,
    {
      artifacts: [{ setId: "oceanhued_clam", type: "4pc" }],
      type: "artifact-group",
    },
    "Kokomi selected artifact payload",
  );
  const holdouts = requireArray(report.holdoutOccurrences, "Kokomi holdouts");
  requireEqual(holdouts.length, 4, "Kokomi holdout count");
  const expectedAxes = [
    "artifact-recommendation",
    "artifact-plan",
    "artifact-recommendation",
    "artifact-recommendation",
  ];
  for (const [index, holdout] of holdouts.entries()) {
    assertLocatorOnlyHoldout(
      holdout,
      expectedAxes[index] ?? "",
      `Kokomi holdout ${index}`,
    );
  }
  const team = firstExactTeam(report, "Kokomi");
  requireStringArray(team.memberCharacterIds, ["sangonomiya_kokomi", "ineffa", "columbina", "sucrose"], "Kokomi exact team roster");
}

function assertDionaReport(value: unknown): void {
  const report = requireRecord(value, "Diona report");
  requireEqual(report.reportType, "diona-source-local-support-slice", "Diona report type");
  requireEqual(report.classification, "authenticated-source-local-condition-binding-slice", "Diona classification");
  requireEqual(report.publicationStatus, "withheld-unreviewed-source-slice", "Diona publication status");
  const selected = requireArray(
    report.selectedOccurrences,
    "Diona selected occurrences",
  );
  requireEqual(selected.length, 3, "Diona selected occurrence count");
  const holdouts = requireArray(report.holdoutOccurrences, "Diona holdouts");
  requireEqual(holdouts.length, 15, "Diona holdout count");
  const firstSelected = requireRecord(selected[0], "Diona subject occurrence");
  requireEqual(firstSelected.characterId, "diona", "Diona subject attribution");
  requireEqual(
    firstSelected.claimAxis,
    "artifact-recommendation",
    "Diona selected artifact axis",
  );
  requireEqual(
    firstSelected.payload,
    {
      artifacts: [
        { setId: "song_of_days_past", type: "4pc" },
        { setId: "noblesse_oblige", type: "4pc" },
      ],
      type: "artifact-group",
    },
    "Diona selected artifact payload",
  );
  assertLocatorOnlyHoldout(
    holdouts[0],
    "artifact-recommendation",
    "Diona artifact holdout",
  );
  assertLocatorOnlyHoldout(
    holdouts[6],
    "main-stat",
    "Diona Circlet holdout",
    "circlet",
  );
  assertLocatorOnlyHoldout(
    holdouts[7],
    "substat",
    "Diona substat holdout",
  );
  assertLocatorOnlyHoldout(
    holdouts[8],
    "weapon-recommendation",
    "Diona weapon holdout",
  );
  const team = firstExactTeam(report, "Diona");
  requireStringArray(team.memberCharacterIds, ["diona", "mavuika", "citlali", "bennett"], "Diona exact team roster");
}

function assertLocatorOnlyHoldout(
  value: unknown,
  expectedClaimAxis: string,
  label: string,
  expectedMainStatSlot?: string,
): void {
  const holdout = requireRecord(value, label);
  requireEqual(holdout.sliceDisposition, "holdout", `${label} disposition`);
  requireEqual(holdout.claimAxis, expectedClaimAxis, `${label} claim axis`);
  if (expectedMainStatSlot !== undefined) {
    requireEqual(
      holdout.mainStatSlot,
      expectedMainStatSlot,
      `${label} main-stat slot`,
    );
  }
  if ("payload" in holdout) {
    throw new Error(`${label} unexpectedly serializes a payload.`);
  }
}

function assertXiaoReport(value: unknown): void {
  const report = requireRecord(value, "Xiao report");
  requireEqual(report.reportType, "xiao-ffxx-non-er-condition-free-branch-candidate-contract", "Xiao report type");
  requireEqual(report.classification, "authenticated-guide-factory-authored-partial-branch-candidate-domain", "Xiao classification");
  requireEqual(report.publicationStatus, "withheld-unreviewed-partial-candidate-domain", "Xiao publication status");
  requireEqual(requireArray(report.candidates, "Xiao candidates").length, 6, "Xiao candidate count");
  requireEqual(requireRecord(report.summary, "Xiao summary").completeCandidateCount, 0, "Xiao complete candidate count");
  requireEqual(report.formulaInputsUsed, false, "Xiao formula-input boundary");
  const candidate = requireRecord(requireArray(report.candidates, "Xiao candidates")[0], "Xiao first candidate");
  requireEqual(candidate.teamRecordId, "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5", "Xiao team pointer");
}

function assertKeqingReport(value: unknown): void {
  const report = requireRecord(value, "Keqing report");
  requireEqual(report.classification, "keqing-lunar-cross-record-composition-contract", "Keqing classification");
  requireEqual(report.contractStatus, "comparable", "Keqing comparability");
  requireEqual(report.sourceAuthoredCompositionCount, 0, "Keqing source-authored composition count");
  requireEqual(report.guideFactoryAuthoredCompositionCount, 2, "Keqing factory composition count");
  const compositions = requireArray(report.compositions, "Keqing compositions");
  requireEqual(compositions.length, 2, "Keqing composition count");
  for (const [index, composition] of compositions.entries()) {
    requireEqual(
      requireRecord(composition, `Keqing composition ${index}`).characterId,
      "keqing",
      `Keqing composition ${index} subject`,
    );
  }
  requireEqual(report.supportsGuideClaims, false, "Keqing guide capability");
  const target = requireRecord(report.targetBoundary, "Keqing target boundary");
  requireStringArray(target.characterIds, ["keqing", "ineffa", "furina", "xilonen"], "Keqing exact team roster");
  const originLedger = requireRecord(report.originLedger, "Keqing origin ledger");
  const formulaTranslation = requireRecord(
    originLedger.unreviewedFormulaLines,
    "Keqing formula translation",
  );
  requireEqual(
    formulaTranslation.origin,
    "guide-factory-authored-source-translation",
    "Keqing formula translation origin",
  );
  requireEqual(
    formulaTranslation.reviewStatus,
    "unreviewed",
    "Keqing formula translation review status",
  );
  requireEqual(
    formulaTranslation.sourceAuthored,
    false,
    "Keqing formula translation source authorship",
  );
  requireEqual(
    formulaTranslation.appliedByThisContract,
    false,
    "Keqing formula translation application boundary",
  );
}

function firstExactTeam(report: Record<string, unknown>, label: string): Record<string, unknown> {
  const localSlice = requireRecord(report.sourceLocalSlice, `${label} local slice`);
  return requireRecord(requireArray(localSlice.exactTeamControls, `${label} exact teams`)[0], `${label} first exact team`);
}

function evidence(
  evidenceId: string,
  family: GuideDraftPortabilityFieldFamily,
  observationKind: EvidencePolicy["observationKind"],
  jsonPointer: string,
): EvidencePolicy {
  return { evidenceId, family, observationKind, jsonPointer };
}

function fields(
  values: Record<GuideDraftPortabilityFieldFamily, Omit<FamilyPolicy, "family">>,
): FamilyPolicy[] {
  return GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES.map((family) => ({
    family,
    ...values[family],
  }));
}

function portabilityPolicy(
  surfaceKinds: GuideDraftPortabilitySurfaceKind[],
  gapClasses: Array<Exclude<GuideDraftPortabilityGapClass, "review-authority">>,
  gapCodes: GuideDraftPortabilityGapCode[],
  evidenceReferenceIds: string[],
): Omit<FamilyPolicy, "family"> {
  return { surfaceKinds, gapClasses, gapCodes, evidenceReferenceIds };
}

function direct(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["direct-source-observation"],
    [],
    [],
    evidenceReferenceIds,
  );
}

function directWithGap(
  gapClass: Exclude<GuideDraftPortabilityGapClass, "review-authority">,
  gapCode: GuideDraftPortabilityGapCode,
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["direct-source-observation"],
    [gapClass],
    [gapCode],
    evidenceReferenceIds,
  );
}

function directAndNegative(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["direct-source-observation", "explicit-negative-boundary"],
    [],
    [],
    evidenceReferenceIds,
  );
}

function directAndHoldout(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["direct-source-observation", "holdout-locator-only"],
    ["format"],
    ["holdout-locator-without-payload"],
    evidenceReferenceIds,
  );
}

function identifier(
  sourceGapCode: GuideDraftPortabilityGapCode,
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["identifier-reference-only"],
    ["source-data", "format"],
    [sourceGapCode, "identifier-without-payload"],
    evidenceReferenceIds,
  );
}

function guardedIdentifier(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["guarded-source-observation", "identifier-reference-only"],
    ["format"],
    ["guarded-choice-unresolved", "identifier-without-payload"],
    evidenceReferenceIds,
  );
}

function guarded(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["guarded-source-observation"],
    ["format"],
    ["guarded-choice-unresolved"],
    evidenceReferenceIds,
  );
}

function holdout(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["holdout-locator-only"],
    ["format"],
    ["holdout-locator-without-payload"],
    evidenceReferenceIds,
  );
}

function negative(
  gapClass: Exclude<GuideDraftPortabilityGapClass, "review-authority">,
  gapCode: GuideDraftPortabilityGapCode,
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["explicit-negative-boundary"],
    [gapClass],
    [gapCode],
    evidenceReferenceIds,
  );
}

function negativeBoundary(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["explicit-negative-boundary"],
    [],
    [],
    evidenceReferenceIds,
  );
}

function negativeWithGaps(
  gapClasses: Array<Exclude<GuideDraftPortabilityGapClass, "review-authority">>,
  gapCodes: GuideDraftPortabilityGapCode[],
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["explicit-negative-boundary"],
    gapClasses,
    gapCodes,
    evidenceReferenceIds,
  );
}

function notSerialized(): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(["not-serialized"], [], [], []);
}

function missingSource(
  gapCode: GuideDraftPortabilityGapCode,
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["not-serialized"],
    ["source-data"],
    [gapCode],
    [],
  );
}

function missingSourceAndComputation(
  sourceGapCode: GuideDraftPortabilityGapCode,
  computationGapCode: GuideDraftPortabilityGapCode,
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["not-serialized"],
    ["source-data", "computation"],
    [sourceGapCode, computationGapCode],
    [],
  );
}

function notComputed(
  gapCode: GuideDraftPortabilityGapCode,
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["not-serialized"],
    ["computation"],
    [gapCode],
    [],
  );
}

function factoryComposition(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["guide-factory-composition"],
    ["format", "computation"],
    [
      "cross-record-composition-not-a-source-build",
      "joint-compatibility-not-evaluated",
    ],
    evidenceReferenceIds,
  );
}

function directFactoryComposition(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["direct-source-observation", "guide-factory-composition"],
    ["format", "computation"],
    [
      "cross-record-composition-not-a-source-build",
      "joint-compatibility-not-evaluated",
    ],
    evidenceReferenceIds,
  );
}

function guardedFactoryComposition(
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["guarded-source-observation", "guide-factory-composition"],
    ["format", "computation"],
    [
      "guarded-choice-unresolved",
      "cross-record-composition-not-a-source-build",
      "joint-compatibility-not-evaluated",
    ],
    evidenceReferenceIds,
  );
}

function experimentalFixture(
  computationGapCode: GuideDraftPortabilityGapCode | null,
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["experimental-fixture"],
    computationGapCode === null ? ["format"] : ["format", "computation"],
    computationGapCode === null
      ? ["experimental-fixture-not-a-guide-field"]
      : ["experimental-fixture-not-a-guide-field", computationGapCode],
    evidenceReferenceIds,
  );
}

function unreviewedFactoryTranslation(
  computationGapCode: GuideDraftPortabilityGapCode,
  ...evidenceReferenceIds: string[]
): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["unreviewed-factory-translation"],
    ["format", "computation"],
    [
      "unreviewed-factory-translation-not-a-guide-field",
      computationGapCode,
    ],
    evidenceReferenceIds,
  );
}

function deferredEnergy(): Omit<FamilyPolicy, "family"> {
  return portabilityPolicy(
    ["scope-deferred"],
    ["computation"],
    ["energy-recharge-deferred-by-scope"],
    [],
  );
}

function countSurfaceKind(
  states: GuideDraftPortabilityFieldState[],
  kind: GuideDraftPortabilitySurfaceKind,
): number {
  return states.filter(({ surfaceKinds }) => surfaceKinds.includes(kind)).length;
}

function countGapClass(
  states: GuideDraftPortabilityFieldState[],
  gapClass: Exclude<GuideDraftPortabilityGapClass, "review-authority">,
): number {
  return states.filter(({ gapClasses }) => gapClasses.includes(gapClass)).length;
}

function valueShape(value: unknown): GuideDraftPortabilityEvidenceReference["valueShape"] {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (isRecord(value)) return "object";
  return "scalar";
}

function requiredText(values: Map<string, string>, sourcePath: string): string {
  const value = values.get(sourcePath);
  if (value === undefined) throw new Error(`Missing guide-draft portability input: ${sourcePath}.`);
  return value;
}

function requiredSha(values: Map<string, string>, sourcePath: string): string {
  const value = values.get(sourcePath);
  if (value === undefined) throw new Error(`Missing guide-draft portability hash: ${sourcePath}.`);
  return value;
}

function requiredNumber(values: Map<string, number>, sourcePath: string): number {
  const value = values.get(sourcePath);
  if (value === undefined) {
    throw new Error(`Missing guide-draft portability byte length: ${sourcePath}.`);
  }
  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} is not an object.`);
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array.`);
  return value;
}

function requireEqual(actual: unknown, expected: unknown, label: string): void {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} drifted.`);
  }
}

function requireStringArray(actual: unknown, expected: string[], label: string): void {
  requireEqual(actual, expected, label);
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contain duplicates.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
