import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GameCatalogs } from "./catalogs";
import {
  buildGuideRequestContextApplicabilityReport,
  type GuideRequestClaimRule,
  type GuideRequestContextApplicabilityReport,
  type GuideRequestContextClaimProjection,
} from "./guideRequestContext";
import {
  GuideRequestContextFixtureSchema,
  type GuideRequestContextFixture,
} from "./guideRequestContextSchema";
import {
  authenticateIttoSourceConditionedGuidePacketReport,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
} from "./ittoSourceConditionedGuidePacket";
import { sha256Text, stableJson } from "./io";
import type {
  GeneratedFromEntry,
  SourceConditionedGuidePacketIssue,
  SourceConditionedGuidePacketReport,
} from "./sourceConditionedGuidePacket";

export type HashedJsonSnapshot = {
  path: string;
  fileSha256: string;
  canonicalObjectSha256: string;
  rawText: string;
  input: unknown;
};

export interface BuildIttoRequestContextApplicabilityInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  catalogs: GameCatalogs;
  sourceReportSnapshot: HashedJsonSnapshot;
  contextFixtureSnapshot: HashedJsonSnapshot;
  generatedFrom: readonly GeneratedFromEntry[];
}

export type IttoRequestContextApplicabilityReport = {
  schemaVersion: 1;
  reportType: "itto-request-context-applicability-report";
  experimentId: "itto-request-context-applicability-v1";
  classification: "descriptive-request-account-applicability-projection";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-experimental-context";
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsAccountAdvice: false;
  playerFacingRecommendations: false;
  ranking: false;
  buildComposition: false;
  damage: false;
  optimality: false;
  formulas: false;
  rotations: false;
  ER: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  energyRecoveryInputsUsed: false;
  baselineEquipmentUsed: false;
  axesMultipliedIntoBuilds: false;
  contextProjectionExecuted: boolean;
  sourceCellsMutated: false;
  generatedFrom: GeneratedFromEntry[];
  sourceControlBoundary: {
    status: "authenticated-canonical-control" | "unauthenticated";
    serializedReportPath: string;
    serializedReportFileSha256: string;
    serializedReportCanonicalObjectSha256: string;
    canonicalReportSha256: string | null;
    conditionMapSha256: string | null;
    claimCatalogSha256: string | null;
    teamPacketsSha256: string | null;
    upstreamGeneratedFromSha256: string | null;
    snapshotClosure: "accepted" | "rejected";
    semanticContract: "accepted" | "rejected";
    sourceCellsUsedAsImmutableControl: true;
  };
  contextFixtureBoundary: {
    status: "validated" | "invalid";
    path: string;
    fileSha256: string;
    canonicalObjectSha256: string;
    snapshotClosure: "accepted" | "rejected";
    fixtureId: string | null;
    contextIds: string[];
    containsClaimBindings: false;
    containsRequestedResolutions: false;
    strictSchema: true;
  };
  claimBindingPolicy: {
    owner: "guide-factory-wrapper";
    sourceTextParserUsed: false;
    sourceConditionHashPinned: true;
    sourcePredicateHashPinned: true;
    sourcePredicateLeafHashPinned: true;
    sourceOwnedFactsReplaceable: false;
    deferredEnergyReplaceable: false;
    claimRules: GuideRequestClaimRule[];
    claimRulesSha256: string;
  };
  projections: GuideRequestContextApplicabilityReport[];
  summary: {
    contextCount: number;
    projectedTeamPacketCount: number;
    sourceClaimCount: number;
    claimCellCount: number;
    matchedCellCount: number;
    inapplicableCellCount: number;
    withheldCellCount: number;
    unresolvedCellCount: number;
    deferredEnergyCellCount: number;
    sourceAlreadyMatchedCellCount: number;
    sourceDefinitelyInapplicableCellCount: number;
    applicableUnderSuppliedContextCellCount: number;
    notApplicableUnderSuppliedContextCellCount: number;
    stillUnresolvedCellCount: number;
    deferredEnergyUnchangedCellCount: number;
    uniqueSourceUnresolvedCellCount: number;
    contextAddressableSourceUnresolvedCellCount: number;
    unaddressedSourceUnresolvedCellCount: number;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
};

export type IttoRequestContextApplicabilityAuthentication =
  | {
      authenticated: true;
      canonicalReport: IttoRequestContextApplicabilityReport;
    }
  | {
      authenticated: false;
      reason:
        | "upstream-control-authentication-failed"
        | "context-input-invalid"
        | "canonical-projection-not-comparable"
        | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

const EXPERIMENT_ID = "itto-request-context-applicability-v1" as const;
const CONTEXT_FIXTURE_ID = "itto-diagnostic-request-contexts-v1";
const PINNED_CONTEXT_FIXTURE_REVISION = {
  fileSha256:
    "da3f73a23eea9cfd39a6c2f5233f4d2de625e9bcdf39d54dc287cdb23299b6c0",
  canonicalObjectSha256:
    "88cdd9e3d38384494b17031802badb6b544574a33c8ab10593ebc0ccfb2d6283",
} as const;
const EXPECTED_CONTEXT_IDS = [
  "free-craftable-preferred",
  "on-field-personal-damage",
  "owned-serpent-passive-supported",
] as const;
export const ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/itto-source-conditioned-guide-packets.json";
export const ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH =
  "scripts/guide-factory/data/request-contexts/itto-diagnostic-contexts-v1.json";

export const ITTO_REQUEST_CONTEXT_APPLICABILITY_REPORT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "reports",
  "itto-request-context-applicability.json",
);

export const ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS = [
  "scripts/guide-factory/src/guideRequestContext.ts",
  "scripts/guide-factory/src/guideRequestContextSchema.ts",
  "scripts/guide-factory/src/ittoRequestContextApplicability.ts",
  "scripts/guide-factory/src/assemble-itto-request-context-applicability.ts",
  "scripts/guide-factory/src/paths.ts",
  "src/data/game/weapon_stats.json",
  ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
  ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
  ...ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
] as const;

const CLAIM_RULES: readonly GuideRequestClaimRule[] = [
  roleRule(
    "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:main-stat:sands:0",
    "423c45da9436f71273f4502eae3481c3e7cc4909c500d00a3728f0ac4a99eab7",
    "9e2a3041c566bd0f2a2ae33f0ceed379957c7b9b6a7303a9db248947a72c2fd1",
    "predicate",
    "9e2a3041c566bd0f2a2ae33f0ceed379957c7b9b6a7303a9db248947a72c2fd1",
  ),
  roleRule(
    "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:main-stat:goblet:0",
    "423c45da9436f71273f4502eae3481c3e7cc4909c500d00a3728f0ac4a99eab7",
    "9e2a3041c566bd0f2a2ae33f0ceed379957c7b9b6a7303a9db248947a72c2fd1",
    "predicate",
    "9e2a3041c566bd0f2a2ae33f0ceed379957c7b9b6a7303a9db248947a72c2fd1",
  ),
  roleRule(
    "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:main-stat:goblet:1",
    "c848c4d9bc66bc610ff6ed605674ad7300d55a9e16d14ad0a23067b20723baf9",
    "8499a9078cc1a705532967c9c2f6acf4c4611ea2ef91997a97e87d6e193e6cf1",
    "predicate.predicates[0]",
    "9e2a3041c566bd0f2a2ae33f0ceed379957c7b9b6a7303a9db248947a72c2fd1",
  ),
  roleRule(
    "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:main-stat:circlet:0",
    "423c45da9436f71273f4502eae3481c3e7cc4909c500d00a3728f0ac4a99eab7",
    "9e2a3041c566bd0f2a2ae33f0ceed379957c7b9b6a7303a9db248947a72c2fd1",
    "predicate",
    "9e2a3041c566bd0f2a2ae33f0ceed379957c7b9b6a7303a9db248947a72c2fd1",
  ),
  roleRule(
    "kqm:character-guide:itto-contextual-artifact-sets-version-5-6:artifact-group:0",
    "e2c9dccf7a94008d3855b20423cdae5d6134d3c13dd61ff74261712c73740d50",
    "bf6daf3ff968041787b4124b16d3235565a006e1051f8ed70dfda22f917f349d",
    "predicate",
    "bf6daf3ff968041787b4124b16d3235565a006e1051f8ed70dfda22f917f349d",
  ),
  {
    claimId:
      "kqm:character-guide:itto-contextual-weapons-version-5-6:weapon-group:0",
    sourceConditionsSha256:
      "34da8bb536186e86abba8a61e58d05ce6ee8fbdab16083f818b9a33abed51eb3",
    sourcePredicateSha256:
      "4bb14290446d4112ecc75307bec76f7dbb4214dcaaf57af78a72ca22782bb652",
    bindings: [
      {
        sourcePredicatePath: "predicate",
        sourcePredicateLeafSha256:
          "4bb14290446d4112ecc75307bec76f7dbb4214dcaaf57af78a72ca22782bb652",
        requestPredicate: {
          type: "optimization-goal-is",
          characterId: "arataki_itto",
          goalId: "personal-damage",
        },
      },
    ],
  },
  {
    claimId:
      "kqm:character-guide:itto-contextual-weapons-version-5-6:weapon-group:1",
    sourceConditionsSha256:
      "7e97d371748aaa08ed777785b2bc57c691c6a4ac59deb118b29d5b8600ceffa3",
    sourcePredicateSha256:
      "2f0e8e6a5442c5fce1f809d1b40348d1bc6659c5e19e8a88f478e6b8fd43a20a",
    bindings: [
      {
        sourcePredicatePath: "predicate.predicates[0]",
        sourcePredicateLeafSha256:
          "147d3fe5f3ededbbfe7812284f04d29a95236b3b5346b7749678531888b47c97",
        requestPredicate: {
          type: "weapon-inventory-includes",
          weaponId: "serpent_spine",
        },
      },
      {
        sourcePredicatePath: "predicate.predicates[1]",
        sourcePredicateLeafSha256:
          "e00f20a7cc0893c705aec16aa90b605077c5d2716edfffe4e118f9034401f99b",
        requestPredicate: {
          type: "passive-execution-is",
          assumptionId: "serpent-spine-passive-stacks-accommodated",
          expected: true,
        },
      },
    ],
  },
  {
    claimId:
      "kqm:character-guide:itto-contextual-weapons-version-5-6:weapon-group:2",
    sourceConditionsSha256:
      "55b2e598ff17458d3336ab5dea4ab4beea1da33a2d7a00079517267eed9258a0",
    sourcePredicateSha256:
      "7d315746e1afa0af2f5240c7be728f9a8556b04a4fb1c7bf69127988d1c8b3ed",
    bindings: [
      {
        sourcePredicatePath: "predicate",
        sourcePredicateLeafSha256:
          "7d315746e1afa0af2f5240c7be728f9a8556b04a4fb1c7bf69127988d1c8b3ed",
        requestPredicate: {
          type: "acquisition-preference-is",
          preferenceId: "free-craftable",
        },
      },
    ],
  },
];

const EXPECTED_PROJECTION_SUMMARIES: Readonly<
  Record<
    string,
    Pick<
      GuideRequestContextApplicabilityReport["summary"],
      | "matchedCellCount"
      | "inapplicableCellCount"
      | "unresolvedCellCount"
      | "deferredEnergyCellCount"
      | "withheldCellCount"
    >
  >
> = {
  "free-craftable-preferred": {
    matchedCellCount: 6,
    inapplicableCellCount: 6,
    unresolvedCellCount: 24,
    deferredEnergyCellCount: 9,
    withheldCellCount: 33,
  },
  "on-field-personal-damage": {
    matchedCellCount: 18,
    inapplicableCellCount: 6,
    unresolvedCellCount: 12,
    deferredEnergyCellCount: 9,
    withheldCellCount: 21,
  },
  "owned-serpent-passive-supported": {
    matchedCellCount: 6,
    inapplicableCellCount: 6,
    unresolvedCellCount: 24,
    deferredEnergyCellCount: 9,
    withheldCellCount: 33,
  },
};

const CAPABILITY_BOUNDARY = {
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsAccountAdvice: false,
  playerFacingRecommendations: false,
  ranking: false,
  buildComposition: false,
  damage: false,
  optimality: false,
  formulas: false,
  rotations: false,
  ER: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  damageComputationExecuted: false,
  energyRecoveryInputsUsed: false,
  baselineEquipmentUsed: false,
  axesMultipliedIntoBuilds: false,
  sourceCellsMutated: false,
} as const;

const CAUTIONS = [
  "Applicable under supplied request/account context is not a recommendation, rank, winner, or proof of comparative performance.",
  "User-declared on-field intent and passive accommodation are assumptions, not rotation or gameplay proof.",
  "The DEF% Goblet branch still lacks buff-coverage, investment-threshold, and comparative-performance evidence; Retracing Bolide still lacks an artifact-quality contract.",
  "The three contexts are independent diagnostics. Their cells must not be multiplied into one build or treated as one combined user profile.",
  "All offensive substat-tail claims remain deferred behind the deliberately omitted rotation-specific ER prerequisite.",
];

const PROHIBITED_INTERPRETATIONS = [
  "Do not use this report as source authorization or as a player-facing guide.",
  "Do not infer a best weapon, artifact set, main stat, team, or account action from contextual applicability.",
  "Do not combine the three diagnostic contexts into a build, score, rank, or search candidate.",
  "Do not treat inventory ownership as suitability or a passive assumption as measured uptime.",
  "Do not use this report for damage, formula, rotation, optimizer, generator, or ER conclusions.",
];

export async function readHashedJsonSnapshot(
  repositoryRoot: string,
  relativePath: string,
): Promise<HashedJsonSnapshot> {
  const bytes = await readFile(path.join(repositoryRoot, relativePath));
  const rawText = bytes.toString("utf8");
  const input: unknown = JSON.parse(rawText);
  return {
    path: relativePath,
    fileSha256: createHash("sha256").update(bytes).digest("hex"),
    canonicalObjectSha256: hashValue(input),
    rawText,
    input,
  };
}

export async function buildIttoRequestContextApplicabilityReport(
  input: BuildIttoRequestContextApplicabilityInput,
): Promise<IttoRequestContextApplicabilityReport> {
  const generatedFrom = canonicalGeneratedFrom(input.generatedFrom);
  const inputBoundary = validateGeneratedFromAndSnapshots(input, generatedFrom);
  const issues = inputBoundary.issues;
  const fixtureIssueCountBefore = issues.length;
  const fixtureResult = GuideRequestContextFixtureSchema.safeParse(
    input.contextFixtureSnapshot.input,
  );
  if (!fixtureResult.success) {
    fixtureResult.error.issues.forEach((schemaIssue) =>
      issues.push({
        code: "request-context.invalid-context-fixture",
        path: `contextFixture${schemaIssue.path.length > 0 ? `.${schemaIssue.path.join(".")}` : ""}`,
        message: schemaIssue.message,
      }),
    );
  }
  const fixture = fixtureResult.success ? fixtureResult.data : null;
  if (fixture) {
    validateFixtureContract(fixture, issues);
    validateFixtureCatalog(fixture, input.catalogs, issues);
  }
  const fixtureValid =
    fixture !== null && issues.length === fixtureIssueCountBefore;

  const upstreamGeneratedFrom = generatedFrom.filter((entry) =>
    (ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS as readonly string[]).includes(
      entry.path,
    ),
  );
  const upstreamAuthentication =
    await authenticateIttoSourceConditionedGuidePacketReport(
      input.sourceReportSnapshot.input as SourceConditionedGuidePacketReport,
      {
        repositoryInput: input.repositoryInput,
        manualSnapshotInput: input.manualSnapshotInput,
        manualIndexInput: input.manualIndexInput,
        sourceRegistryInput: input.sourceRegistryInput,
        catalogs: input.catalogs,
        generatedFrom: upstreamGeneratedFrom,
      },
    );
  if (!upstreamAuthentication.authenticated) {
    issues.push({
      code: "request-context.upstream-control-authentication-failed",
      path: "sourceControlBoundary",
      message: `Checkpoint 23 source control did not authenticate: ${upstreamAuthentication.reason}.`,
    });
  }
  const canonicalSourceReport = upstreamAuthentication.authenticated
    ? upstreamAuthentication.canonicalReport
    : null;
  if (canonicalSourceReport) validateSourceSemanticContract(canonicalSourceReport, issues);

  const projections =
    issues.length === 0 && fixture && canonicalSourceReport
      ? fixture.contexts.map(({ contextId, context }) =>
          buildGuideRequestContextApplicabilityReport({
            projectionId: contextId,
            sourceReport: canonicalSourceReport,
            context,
            claimRules: CLAIM_RULES,
          }),
        )
      : [];
  projections.forEach((projection, index) => {
    if (projection.comparisonStatus !== "comparable") {
      issues.push({
        code: "request-context.context-projection-not-comparable",
        path: `projections[${index}]`,
        message: `Context ${projection.projectionId} did not produce a comparable projection.`,
      });
      issues.push(...projection.issues);
    }
    validateProjectionSummary(projection, issues);
  });

  const summary = summarize(projections, canonicalSourceReport);
  if (projections.length > 0) validateAggregateSummary(summary, issues);
  const comparable = issues.length === 0;
  return {
    schemaVersion: 1,
    reportType: "itto-request-context-applicability-report",
    experimentId: EXPERIMENT_ID,
    classification: "descriptive-request-account-applicability-projection",
    comparisonStatus: comparable ? "comparable" : "not-comparable",
    publicationStatus: "withheld-experimental-context",
    ...CAPABILITY_BOUNDARY,
    contextProjectionExecuted: projections.length > 0,
    generatedFrom,
    sourceControlBoundary: {
      status: canonicalSourceReport
        && inputBoundary.sourceReportSnapshotClosed
        ? "authenticated-canonical-control"
        : "unauthenticated",
      serializedReportPath: input.sourceReportSnapshot.path,
      serializedReportFileSha256: input.sourceReportSnapshot.fileSha256,
      serializedReportCanonicalObjectSha256:
        input.sourceReportSnapshot.canonicalObjectSha256,
      canonicalReportSha256: canonicalSourceReport
        ? hashValue(canonicalSourceReport)
        : null,
      conditionMapSha256:
        canonicalSourceReport?.policyBoundary.conditionMapSha256 ?? null,
      claimCatalogSha256: canonicalSourceReport
        ? hashValue(canonicalSourceReport.sourceClaimCatalog)
        : null,
      teamPacketsSha256: canonicalSourceReport
        ? hashValue(canonicalSourceReport.teamPackets)
        : null,
      upstreamGeneratedFromSha256: canonicalSourceReport
        ? hashValue(canonicalSourceReport.generatedFrom)
        : null,
      snapshotClosure: inputBoundary.sourceReportSnapshotClosed
        ? "accepted"
        : "rejected",
      semanticContract:
        canonicalSourceReport &&
        inputBoundary.sourceReportSnapshotClosed &&
        !issues.some(({ code }) => code === "request-context.source-contract-drift")
          ? "accepted"
          : "rejected",
      sourceCellsUsedAsImmutableControl: true,
    },
    contextFixtureBoundary: {
      status:
        fixtureValid && inputBoundary.contextFixtureSnapshotClosed
          ? "validated"
          : "invalid",
      path: input.contextFixtureSnapshot.path,
      fileSha256: input.contextFixtureSnapshot.fileSha256,
      canonicalObjectSha256:
        input.contextFixtureSnapshot.canonicalObjectSha256,
      snapshotClosure: inputBoundary.contextFixtureSnapshotClosed
        ? "accepted"
        : "rejected",
      fixtureId: fixture?.fixtureId ?? null,
      contextIds: fixture
        ? fixture.contexts.map(({ contextId }) => contextId).sort()
        : [],
      containsClaimBindings: false,
      containsRequestedResolutions: false,
      strictSchema: true,
    },
    claimBindingPolicy: {
      owner: "guide-factory-wrapper",
      sourceTextParserUsed: false,
      sourceConditionHashPinned: true,
      sourcePredicateHashPinned: true,
      sourcePredicateLeafHashPinned: true,
      sourceOwnedFactsReplaceable: false,
      deferredEnergyReplaceable: false,
      claimRules: canonicalClaimRules(),
      claimRulesSha256: hashValue(canonicalClaimRules()),
    },
    projections,
    summary,
    issues: issues.sort((left, right) =>
      `${left.path}\0${left.code}`.localeCompare(`${right.path}\0${right.code}`),
    ),
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

export async function authenticateIttoRequestContextApplicabilityReport(
  serializedReport: IttoRequestContextApplicabilityReport,
  input: BuildIttoRequestContextApplicabilityInput,
): Promise<IttoRequestContextApplicabilityAuthentication> {
  const canonicalReport = await buildIttoRequestContextApplicabilityReport(input);
  if (canonicalReport.comparisonStatus !== "comparable") {
    const upstreamFailure = canonicalReport.issues.some(({ code }) =>
      code.startsWith("request-context.upstream-control"),
    );
    const contextFailure = canonicalReport.issues.some(
      ({ code }) =>
        code.includes("context-fixture") ||
        code.includes("snapshot") ||
        code.includes("generated-from"),
    );
    return {
      authenticated: false,
      reason: upstreamFailure
        ? "upstream-control-authentication-failed"
        : contextFailure
          ? "context-input-invalid"
          : "canonical-projection-not-comparable",
      issues: canonicalReport.issues,
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      issues: [
        {
          code: "request-context.serialized-report-mismatch",
          path: "report",
          message:
            "Serialized request-context report does not match the canonical authenticated projection.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

function roleRule(
  claimId: string,
  sourceConditionsSha256: string,
  sourcePredicateSha256: string,
  sourcePredicatePath: string,
  sourcePredicateLeafSha256: string,
): GuideRequestClaimRule {
  return {
    claimId,
    sourceConditionsSha256,
    sourcePredicateSha256,
    bindings: [
      {
        sourcePredicatePath,
        sourcePredicateLeafSha256,
        requestPredicate: {
          type: "intended-role-is",
          characterId: "arataki_itto",
          roleId: "on-field-dps",
        },
      },
    ],
  };
}

function canonicalClaimRules(): GuideRequestClaimRule[] {
  return [...structuredClone(CLAIM_RULES)].sort((left, right) =>
    left.claimId.localeCompare(right.claimId),
  );
}

function validateGeneratedFromAndSnapshots(
  input: BuildIttoRequestContextApplicabilityInput,
  generatedFrom: readonly GeneratedFromEntry[],
): {
  issues: SourceConditionedGuidePacketIssue[];
  sourceReportSnapshotClosed: boolean;
  contextFixtureSnapshotClosed: boolean;
} {
  const issues: SourceConditionedGuidePacketIssue[] = [];
  const expected = new Set<string>(ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS);
  const counts = new Map<string, number>();
  input.generatedFrom.forEach(({ path: entryPath, sha256 }, index) => {
    counts.set(entryPath, (counts.get(entryPath) ?? 0) + 1);
    if (!expected.has(entryPath)) {
      issues.push({
        code: "request-context.unexpected-generated-from-path",
        path: `generatedFrom[${index}].path`,
        message: `Unexpected generatedFrom path ${entryPath}.`,
      });
    }
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      issues.push({
        code: "request-context.invalid-generated-from-hash",
        path: `generatedFrom[${index}].sha256`,
        message: "generatedFrom hashes must be lowercase SHA-256 values.",
      });
    }
  });
  for (const expectedPath of expected) {
    const count = counts.get(expectedPath) ?? 0;
    if (count !== 1) {
      issues.push({
        code: "request-context.missing-or-duplicate-generated-from-path",
        path: "generatedFrom",
        message: `Expected exactly one generatedFrom entry for ${expectedPath}; found ${count}.`,
      });
    }
  }
  const sourceReportSnapshotValid = validateSnapshot(
    input.sourceReportSnapshot,
    ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
    generatedFrom,
    issues,
  );
  const contextFixtureSnapshotValid = validateSnapshot(
    input.contextFixtureSnapshot,
    ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
    generatedFrom,
    issues,
    PINNED_CONTEXT_FIXTURE_REVISION,
  );
  return {
    issues,
    sourceReportSnapshotClosed:
      counts.get(ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH) === 1 &&
      sourceReportSnapshotValid,
    contextFixtureSnapshotClosed:
      counts.get(ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH) === 1 &&
      contextFixtureSnapshotValid,
  };
}

function validateSnapshot(
  snapshot: HashedJsonSnapshot,
  expectedPath: string,
  generatedFrom: readonly GeneratedFromEntry[],
  issues: SourceConditionedGuidePacketIssue[],
  pinnedRevision?: {
    fileSha256: string;
    canonicalObjectSha256: string;
  },
): boolean {
  const issueCountBefore = issues.length;
  if (snapshot.path !== expectedPath) {
    issues.push({
      code: "request-context.snapshot-path-mismatch",
      path: expectedPath,
      message: `Expected snapshot path ${expectedPath}; received ${snapshot.path}.`,
    });
  }
  const generatedHash = generatedFrom.find(({ path: entryPath }) =>
    entryPath === expectedPath,
  )?.sha256;
  if (generatedHash !== snapshot.fileSha256) {
    issues.push({
      code: "request-context.snapshot-file-hash-mismatch",
      path: expectedPath,
      message: "Snapshot byte hash does not match generatedFrom.",
    });
  }

  const rawTextSha256 = createHash("sha256")
    .update(snapshot.rawText, "utf8")
    .digest("hex");
  if (rawTextSha256 !== snapshot.fileSha256) {
    issues.push({
      code: "request-context.snapshot-raw-byte-hash-mismatch",
      path: expectedPath,
      message: "Snapshot raw JSON byte hash does not match its declared file hash.",
    });
  }

  let parsedRawInput: unknown;
  try {
    parsedRawInput = JSON.parse(snapshot.rawText);
  } catch (error) {
    issues.push({
      code: "request-context.snapshot-raw-json-invalid",
      path: expectedPath,
      message: `Snapshot raw JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}.`,
    });
  }
  if (
    parsedRawInput !== undefined &&
    stableJson(parsedRawInput) !== stableJson(snapshot.input)
  ) {
    issues.push({
      code: "request-context.snapshot-parsed-input-mismatch",
      path: expectedPath,
      message: "Snapshot parsed input does not match the supplied raw JSON bytes.",
    });
  }
  if (
    parsedRawInput !== undefined &&
    snapshot.canonicalObjectSha256 !== hashValue(parsedRawInput)
  ) {
    issues.push({
      code: "request-context.snapshot-object-hash-mismatch",
      path: expectedPath,
      message: "Snapshot canonical object hash does not match its raw JSON value.",
    });
  }
  if (
    pinnedRevision &&
    (snapshot.fileSha256 !== pinnedRevision.fileSha256 ||
      snapshot.canonicalObjectSha256 !==
        pinnedRevision.canonicalObjectSha256)
  ) {
    issues.push({
      code: "request-context.fixture-revision-mismatch",
      path: expectedPath,
      message: "Context fixture does not match the pinned experiment revision.",
    });
  }
  return issues.length === issueCountBefore;
}

function validateFixtureContract(
  fixture: GuideRequestContextFixture,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  if (fixture.fixtureId !== CONTEXT_FIXTURE_ID) {
    issues.push({
      code: "request-context.fixture-id-mismatch",
      path: "contextFixture.fixtureId",
      message: `Expected fixture ID ${CONTEXT_FIXTURE_ID}.`,
    });
  }
  const contextIds = fixture.contexts.map(({ contextId }) => contextId).sort();
  if (
    contextIds.length !== EXPECTED_CONTEXT_IDS.length ||
    contextIds.some((contextId, index) => contextId !== EXPECTED_CONTEXT_IDS[index])
  ) {
    issues.push({
      code: "request-context.context-id-set-mismatch",
      path: "contextFixture.contexts",
      message: "Diagnostic context IDs do not match the pinned experiment.",
    });
  }
  if (new Set(contextIds).size !== contextIds.length) {
    issues.push({
      code: "request-context.duplicate-context-id",
      path: "contextFixture.contexts",
      message: "Diagnostic context IDs must be unique.",
    });
  }
}

function validateFixtureCatalog(
  fixture: GuideRequestContextFixture,
  catalogs: GameCatalogs,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  fixture.contexts.forEach(({ context }, contextIndex) => {
    context.accountFacts?.weaponInventory?.weaponIds.forEach(
      (weaponId, weaponIndex) => {
        if (
          catalogs.weaponIds.has(weaponId) &&
          !catalogs.betaWeaponIds.has(weaponId)
        ) {
          return;
        }
        issues.push({
          code: "request-context.unknown-fixture-weapon",
          path: `contextFixture.contexts[${contextIndex}].context.accountFacts.weaponInventory.weaponIds[${weaponIndex}]`,
          message: `Context fixture weapon ${weaponId} is not in the released catalog.`,
        });
      },
    );
  });
}

function validateSourceSemanticContract(
  report: SourceConditionedGuidePacketReport,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const exact =
    report.reportType === "source-conditioned-guide-packet-report" &&
    report.classification === "descriptive-cross-record-source-claim-projection" &&
    report.comparisonStatus === "comparable" &&
    report.publicationStatus === "withheld-unreviewed-source" &&
    report.sourceBoundary.sourceId === "kqm" &&
    report.summary.packetCount === 3 &&
    report.summary.sourceClaimCount === 15 &&
    report.summary.claimCellCount === 45 &&
    report.summary.assembledBuildCount === 0 &&
    report.issues.length === 0 &&
    !report.supportsGuideClaims &&
    !report.playerFacingRecommendations &&
    !report.ranking &&
    !report.damage &&
    !report.optimality &&
    !report.formulas &&
    !report.rotations &&
    !report.ER &&
    !report.generatorExecuted &&
    !report.optimizerExecuted &&
    !report.damageComputationExecuted &&
    !report.energyRecoveryInputsUsed &&
    !report.baselineEquipmentUsed &&
    !report.axesMultipliedIntoBuilds;
  if (!exact) {
    issues.push({
      code: "request-context.source-contract-drift",
      path: "sourceControlBoundary.semanticContract",
      message:
        "Authenticated checkpoint 23 no longer matches the exact source-only semantic contract required by this experiment.",
    });
  }
}

function validateProjectionSummary(
  projection: GuideRequestContextApplicabilityReport,
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const expected = EXPECTED_PROJECTION_SUMMARIES[projection.projectionId];
  if (!expected) return;
  const summary = projection.summary;
  if (
    summary.packetCount !== 3 ||
    summary.sourceClaimCount !== 15 ||
    summary.claimCellCount !== 45 ||
    summary.assembledBuildCount !== 0 ||
    Object.entries(expected).some(
      ([key, value]) => summary[key as keyof typeof expected] !== value,
    )
  ) {
    issues.push({
      code: "request-context.projection-summary-mismatch",
      path: `projections.${projection.projectionId}.summary`,
      message: "Context projection counts do not match the reviewed diagnostic target.",
    });
  }
}

function summarize(
  projections: readonly GuideRequestContextApplicabilityReport[],
  sourceReport: SourceConditionedGuidePacketReport | null,
): IttoRequestContextApplicabilityReport["summary"] {
  const cells = projections.flatMap((projection) =>
    projection.teamProjections.flatMap(({ claimProjections }) => claimProjections),
  );
  const sourceUnresolvedKeys = new Set(
    (sourceReport?.teamPackets ?? []).flatMap((packet) =>
      packet.claimCells
        .filter(({ resolution }) => resolution === "unresolved-context")
        .map(({ claimId }) => `${packet.teamRecordId}\0${claimId}`),
    ),
  );
  const addressableKeys = new Set<string>();
  projections.forEach((projection) =>
    projection.teamProjections.forEach(({ teamRecordId, claimProjections }) =>
      claimProjections.forEach((cell) => {
        if (
          cell.contextApplicability === "applicable-under-supplied-context" ||
          cell.contextApplicability === "not-applicable-under-supplied-context"
        ) {
          addressableKeys.add(`${teamRecordId}\0${cell.claimId}`);
        }
      }),
    ),
  );
  const unresolvedCellCount = countResolution(cells, "unresolved-context");
  const deferredEnergyCellCount = countResolution(
    cells,
    "deferred-omitted-energy-prerequisite",
  );
  return {
    contextCount: projections.length,
    projectedTeamPacketCount: projections.reduce(
      (sum, projection) => sum + projection.teamProjections.length,
      0,
    ),
    sourceClaimCount: sourceReport?.summary.sourceClaimCount ?? 0,
    claimCellCount: cells.length,
    matchedCellCount: countResolution(cells, "matched"),
    inapplicableCellCount: countResolution(cells, "inapplicable"),
    withheldCellCount: unresolvedCellCount + deferredEnergyCellCount,
    unresolvedCellCount,
    deferredEnergyCellCount,
    sourceAlreadyMatchedCellCount: countApplicability(
      cells,
      "source-already-matched",
    ),
    sourceDefinitelyInapplicableCellCount: countApplicability(
      cells,
      "source-definitely-inapplicable",
    ),
    applicableUnderSuppliedContextCellCount: countApplicability(
      cells,
      "applicable-under-supplied-context",
    ),
    notApplicableUnderSuppliedContextCellCount: countApplicability(
      cells,
      "not-applicable-under-supplied-context",
    ),
    stillUnresolvedCellCount: countApplicability(cells, "still-unresolved"),
    deferredEnergyUnchangedCellCount: countApplicability(
      cells,
      "deferred-energy-unchanged",
    ),
    uniqueSourceUnresolvedCellCount: sourceUnresolvedKeys.size,
    contextAddressableSourceUnresolvedCellCount: addressableKeys.size,
    unaddressedSourceUnresolvedCellCount:
      sourceUnresolvedKeys.size - addressableKeys.size,
    assembledBuildCount: 0,
  };
}

function validateAggregateSummary(
  summary: IttoRequestContextApplicabilityReport["summary"],
  issues: SourceConditionedGuidePacketIssue[],
): void {
  const expected: IttoRequestContextApplicabilityReport["summary"] = {
    contextCount: 3,
    projectedTeamPacketCount: 9,
    sourceClaimCount: 15,
    claimCellCount: 135,
    matchedCellCount: 30,
    inapplicableCellCount: 18,
    withheldCellCount: 87,
    unresolvedCellCount: 60,
    deferredEnergyCellCount: 27,
    sourceAlreadyMatchedCellCount: 9,
    sourceDefinitelyInapplicableCellCount: 18,
    applicableUnderSuppliedContextCellCount: 21,
    notApplicableUnderSuppliedContextCellCount: 0,
    stillUnresolvedCellCount: 60,
    deferredEnergyUnchangedCellCount: 27,
    uniqueSourceUnresolvedCellCount: 27,
    contextAddressableSourceUnresolvedCellCount: 21,
    unaddressedSourceUnresolvedCellCount: 6,
    assembledBuildCount: 0,
  };
  if (stableJson(summary) !== stableJson(expected)) {
    issues.push({
      code: "request-context.aggregate-summary-mismatch",
      path: "summary",
      message: "Aggregate request-context counts do not match the reviewed target.",
    });
  }
}

function countResolution(
  cells: readonly GuideRequestContextClaimProjection[],
  resolution: GuideRequestContextClaimProjection["resolution"],
): number {
  return cells.filter((cell) => cell.resolution === resolution).length;
}

function countApplicability(
  cells: readonly GuideRequestContextClaimProjection[],
  applicability: GuideRequestContextClaimProjection["contextApplicability"],
): number {
  return cells.filter((cell) => cell.contextApplicability === applicability).length;
}

function canonicalGeneratedFrom(
  generatedFrom: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  return generatedFrom
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}
