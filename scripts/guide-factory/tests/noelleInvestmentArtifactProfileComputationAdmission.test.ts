import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { buildNoelleInvestmentArtifactProfileComputationAdmissionFromWorkspace } from "../src/assemble-noelle-investment-artifact-profile-computation-admission";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalHighInvestmentSliceInput,
  type NoelleSourceLocalHighInvestmentSliceReport,
} from "../src/noelleSourceLocalHighInvestmentSlice";
import {
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalLowerInvestmentSliceInput,
  type NoelleSourceLocalLowerInvestmentSliceReport,
} from "../src/noelleSourceLocalLowerInvestmentSlice";
import {
  authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport,
  buildNoelleInvestmentArtifactProfileComputationAdmissionReport,
  NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
  NOELLE_DIRECT_DAMAGE_RELATIVE_PATH,
  NOELLE_IMPLEMENTATION_RELATIVE_PATH,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CLI_RELATIVE_PATH,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CORE_RELATIVE_PATH,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
  NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH,
  NOELLE_REPLAY_ADAPTER_RELATIVE_PATH,
  type NoelleInvestmentArtifactProfileComputationAdmissionInput,
  type NoelleInvestmentArtifactProfileComputationAdmissionReport,
  type NoelleSourceBackedArtifactProfile,
} from "../src/noelleInvestmentArtifactProfileComputationAdmission";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";

const NOELLE_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-noelle-manual.json",
);
const LOWER_PROFILE_ID = "noelle-lower-investment-artifact-profile-v1";
const HIGH_PROFILE_ID = "noelle-high-investment-artifact-profile-v1";
const LOWER_SOURCE_RECORD_ID =
  "noelle-c0-c5-talent-9-artifact-stats-luna-viii";
const HIGH_SOURCE_RECORD_ID =
  "noelle-c6-or-talent-10-artifact-stats-luna-viii";
const HUSK_SOURCE_RECORD_ID = "noelle-general-husk-luna-viii";
const TEAM_SOURCE_RECORD_ID =
  "noelle-durin-nicole-xilonen-hexerei-example-luna-viii";
const TEAM_REPOSITORY_RECORD_ID =
  "kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii";
const ROTATION_NOTATION =
  "Nicole (Q)¹E > Durin EEQ > Xilonen EN2 > Noelle EQ 2[N3D] N2 > Xilonen EN2 > Noelle N3D N2";
const HUSK_OCCURRENCE_ID =
  "kqm:character_guide:noelle-general-husk-luna-viii:recommendation.artifactRecommendations[0].conditions";
const HUSK_CONDITIONS_SHA256 =
  "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570";
const LOWER_SUBSTAT_CONDITION =
  "Noelle is C0–C5 and her Burst Talent is Level 9; this priority covers offensive stats only.";
const HIGH_SUBSTAT_CONDITION =
  "Noelle is C6 or her Burst Talent is Level 10 or higher; this priority covers offensive stats only.";
const LOWER_SUBSTAT_CONDITIONS_SHA256 =
  "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675";
const HIGH_SUBSTAT_CONDITIONS_SHA256 =
  "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d";

let baseInput: NoelleInvestmentArtifactProfileComputationAdmissionInput;
let report: NoelleInvestmentArtifactProfileComputationAdmissionReport;

beforeAll(async () => {
  [baseInput, report] = await Promise.all([
    loadInput(),
    buildNoelleInvestmentArtifactProfileComputationAdmissionFromWorkspace(),
  ]);
}, 120_000);

describe("Noelle investment artifact-profile computation admission", () => {
  it("builds from the workspace, self-authenticates, and remains byte-stable without a CP51 durable report", async () => {
    const rebuilt =
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(fixture());
    const authenticated =
      authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
        report,
        fixture(),
      );

    expect(stableJson(report)).toBe(stableJson(rebuilt));
    expect(stableJson(authenticated)).toBe(stableJson(rebuilt));
    expect(
      stableJson(
        await buildNoelleInvestmentArtifactProfileComputationAdmissionFromWorkspace(),
      ),
    ).toBe(stableJson(report));
    expect(report.validationStatus).toBe("authenticated-representation-blocked");
    expect(
      report.sourceProfilesComparedWithPinnedComputationRepresentation,
    ).toBe(true);
    expect(report.summary).toEqual({
      profileCount: 2,
      sourceArtifactSetCount: 1,
      sourceMainStatOptionCount: 8,
      sourceSubstatPriorityGroupCount: 6,
      admittedReplayCount: 0,
      rejectedReplayCount: 1,
      numericResultCount: 0,
      candidateCount: 0,
      generatedTeamCount: 0,
      assembledBuildCount: 0,
      artifactAssignmentCount: 0,
      optimizerRunCount: 0,
    });
    expect(report.profiles.map(({ profileId }) => profileId)).toEqual([
      LOWER_PROFILE_ID,
      HIGH_PROFILE_ID,
    ]);
    expect(report.rawInputBoundary).toMatchObject({
      sourceFileCount: 23,
      generatedFromCount: 23,
      authenticatedJsonInputParityCount: 6,
      exactPathClosureAuthenticated: true,
      everySourceFileHashBoundToGeneratedFrom: true,
      upstreamInputsBoundToOuterRawClosure: true,
      highSliceFreshAuthentication: "accepted",
      lowerSliceFreshAuthentication: "accepted",
      sliceAuthenticationRebuiltFromExactRawInputs: true,
      sharedManualSnapshotExact: true,
      implementation: {
        path: NOELLE_IMPLEMENTATION_RELATIVE_PATH,
        importedAtRuntime: false,
        inspectedAsPinnedTextOnly: true,
      },
      evaluationSemantics: {
        directDamagePath: NOELLE_DIRECT_DAMAGE_RELATIVE_PATH,
        compiledDamagePath: NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
        replayAdapterPath: NOELLE_REPLAY_ADAPTER_RELATIVE_PATH,
        importedAtRuntime: false,
        inspectedAsPinnedTextOnly: true,
      },
    });
    expect(
      baseInput.sourceFiles.map(({ path: sourcePath }) => sourcePath),
    ).toEqual([
      ...NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
    ]);
    expect(
      baseInput.generatedFrom.map(({ path: sourcePath }) => sourcePath),
    ).toEqual([
      ...NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
    ]);
    expect(
      baseInput.sourceFiles.map(({ path: sourcePath }) => sourcePath),
    ).toEqual(baseInput.generatedFrom.map(({ path: sourcePath }) => sourcePath));
    expect(report.generatedFrom).toEqual(baseInput.generatedFrom);
    expect(
      new Set(report.generatedFrom.map(({ path: sourcePath }) => sourcePath))
        .size,
    ).toBe(23);
    for (const sourceFile of baseInput.sourceFiles) {
      const generated = baseInput.generatedFrom.find(
        ({ path: sourcePath }) => sourcePath === sourceFile.path,
      );
      expect(generated?.sha256).toBe(sha256Text(sourceFile.text));
    }
    for (const digest of [
      ...Object.values(report.rawInputBoundary.canonicalReportObjectSha256),
      ...Object.values(report.rawInputBoundary.sourceRecordSha256),
      report.rawInputBoundary.implementation.sha256,
      report.rawInputBoundary.evaluationSemantics.directDamageSha256,
      report.rawInputBoundary.evaluationSemantics.compiledDamageSha256,
      report.rawInputBoundary.evaluationSemantics.replayAdapterSha256,
    ]) {
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
    }
  }, 120_000);

  it("keeps the lower and high investment profiles distinct while preserving all eight unselected main-stat options", () => {
    const lower = requiredProfile(LOWER_PROFILE_ID);
    const high = requiredProfile(HIGH_PROFILE_ID);

    expect(lower).toMatchObject({
      characterId: "noelle",
      status: "partial-source-backed-validation-target-not-build",
      sourceRecordId: LOWER_SOURCE_RECORD_ID,
      sourceReviewStatus: "unreviewed",
      branch: {
        sourceCondition: "Noelle is C0–C5 and her Burst Talent is Level 9.",
        applicability: "typed-request-context-branch-authenticated",
        exhaustiveAcrossAllInvestmentStates: false,
        requestPredicate: {
          type: "all",
          predicates: [
            {
              type: "constellation-at-most",
              characterId: "noelle",
              threshold: 5,
            },
            {
              type: "talent-level-is",
              characterId: "noelle",
              talent: "burst",
              threshold: 9,
            },
          ],
        },
      },
    });
    expect(high).toMatchObject({
      characterId: "noelle",
      status: "partial-source-backed-validation-target-not-build",
      sourceRecordId: HIGH_SOURCE_RECORD_ID,
      sourceReviewStatus: "unreviewed",
      branch: {
        sourceCondition:
          "Noelle is C6 or her Burst Talent is Level 10 or higher.",
        applicability: "typed-request-context-branch-authenticated",
        exhaustiveAcrossAllInvestmentStates: false,
        requestPredicate: {
          type: "any",
          predicates: [
            {
              type: "constellation-at-least",
              characterId: "noelle",
              threshold: 6,
            },
            {
              type: "talent-level-at-least",
              characterId: "noelle",
              talent: "burst",
              threshold: 10,
            },
          ],
        },
      },
    });

    expect(mainStatProjection(lower)).toEqual({
      sands: [["atk%"]],
      goblet: [["geo%"]],
      circlet: [["cr", "cd"]],
    });
    expect(mainStatProjection(high)).toEqual({
      sands: [["def%"]],
      goblet: [["geo%"], ["def%"]],
      circlet: [["cr", "cd"], ["def%"]],
    });
    expect(
      high.mainStats.goblet.options.map(({ conditionStatus }) => conditionStatus),
    ).toEqual([
      "branch-condition-authenticated",
      "additional-source-guard-unresolved",
    ]);
    expect(
      high.mainStats.circlet.options.map(
        ({ conditionStatus }) => conditionStatus,
      ),
    ).toEqual([
      "branch-condition-authenticated",
      "additional-source-guard-unresolved",
    ]);
    for (const profile of [lower, high]) {
      expect(profile.mainStats.sands.selectedOptionIndex).toBeNull();
      expect(profile.mainStats.goblet.selectedOptionIndex).toBeNull();
      expect(profile.mainStats.circlet.selectedOptionIndex).toBeNull();
    }

    expect(lower.sourceRecordSha256).not.toBe(high.sourceRecordSha256);
    expect(sha256Text(stableJson(lower))).not.toBe(
      sha256Text(stableJson(high)),
    );
    expect(stableJson(lower)).toBe(
      stableJson(requiredProfile(LOWER_PROFILE_ID)),
    );
    expect(stableJson(high)).toBe(stableJson(requiredProfile(HIGH_PROFILE_ID)));
  });

  it("binds one condition-free unranked/default Husk source row without claiming universal applicability or assigning it", () => {
    const [lower, high] = report.profiles;
    expect(lower?.artifactSet).toEqual(high?.artifactSet);
    expect(lower?.artifactSet).toEqual({
      sourceRecordId: HUSK_SOURCE_RECORD_ID,
      sourceRecordSha256: report.rawInputBoundary.sourceRecordSha256.husk,
      occurrenceId: HUSK_OCCURRENCE_ID,
      conditionsSha256: HUSK_CONDITIONS_SHA256,
      set: { type: "4pc", setId: "husk_of_opulent_dreams" },
      sourceConditions: [],
      sourceConditionSemantics:
        "source-condition-free-not-universal-applicability",
      sourceClassification: "default",
      upstreamSliceDisposition: "empty-unconditional",
      upstreamBindingAuthored: false,
      cp51CompositionStatus: "new-source-specific-profile-component",
      assignedToRuntimeBuild: false,
    });

    const snapshot = baseInput.highSliceInput.manualSnapshotInput as {
      records: Array<Record<string, unknown>>;
    };
    const huskRecord = snapshot.records.find(
      ({ sourceRecordId }) => sourceRecordId === HUSK_SOURCE_RECORD_ID,
    ) as {
      recommendation: {
        artifactOrdering: string;
        artifactRecommendations: unknown[];
      };
    };
    expect(huskRecord.recommendation).toEqual(
      expect.objectContaining({
        artifactOrdering: "unranked",
        artifactRecommendations: [
          {
            artifacts: [
              { type: "4pc", setId: "husk_of_opulent_dreams" },
            ],
            grouping: "single",
            classification: "default",
            conditions: [],
          },
        ],
      }),
    );
  });

  it("newly source-binds exactly six formerly held-out substat priority groups without turning ordinal groups into weights", () => {
    const lower = requiredProfile(LOWER_PROFILE_ID);
    const high = requiredProfile(HIGH_PROFILE_ID);
    expect(substatProjection(lower)).toEqual([
      [1, ["cr", "cd"]],
      [2, ["atk%"]],
      [3, ["def%"]],
    ]);
    expect(substatProjection(high)).toEqual([
      [1, ["cr", "cd"]],
      [2, ["def%"]],
      [3, ["atk%"]],
    ]);

    for (const [profile, sourceRecordId, condition, conditionsSha256] of [
      [
        lower,
        LOWER_SOURCE_RECORD_ID,
        LOWER_SUBSTAT_CONDITION,
        LOWER_SUBSTAT_CONDITIONS_SHA256,
      ],
      [
        high,
        HIGH_SOURCE_RECORD_ID,
        HIGH_SUBSTAT_CONDITION,
        HIGH_SUBSTAT_CONDITIONS_SHA256,
      ],
    ] as const) {
      expect(profile.substatPriority).toMatchObject({
        semantics: "source-partial-order-groups-not-scalar-weights",
        scope: "offensive-stats-only",
        selectedAllocation: null,
        scalarWeights: null,
      });
      expect(profile.substatPriority.groups).toHaveLength(3);
      for (const [index, group] of profile.substatPriority.groups.entries()) {
        expect(group.sourceConditions).toEqual([condition]);
        expect(group.sourceOccurrence).toEqual({
          occurrenceId:
            `kqm:character_guide:${sourceRecordId}:recommendation.substats[${index}].conditions`,
          conditionsSha256,
          upstreamSliceDisposition: "holdout",
          upstreamBindingAuthored: false,
          upstreamEnergyClassificationAuthored: false,
          cp51BindingStatus: "new-exact-source-specific-binding",
          bindingMethod: "cp51-exact-source-condition-allowlist",
        });
      }
    }
  });

  it("authenticates exact manual-to-consolidated parity for the four source records without promoting them", () => {
    const snapshot = baseInput.highSliceInput.manualSnapshotInput as {
      records: Array<Record<string, unknown>>;
    };
    const repository = baseInput.highSliceInput.repositoryInput as {
      records: Array<Record<string, unknown>>;
    };
    const expected = [
      [
        HUSK_SOURCE_RECORD_ID,
        `kqm:character-guide:${HUSK_SOURCE_RECORD_ID}`,
        "character_guide",
      ],
      [
        LOWER_SOURCE_RECORD_ID,
        `kqm:character-guide:${LOWER_SOURCE_RECORD_ID}`,
        "character_guide",
      ],
      [
        HIGH_SOURCE_RECORD_ID,
        `kqm:character-guide:${HIGH_SOURCE_RECORD_ID}`,
        "character_guide",
      ],
      [TEAM_SOURCE_RECORD_ID, TEAM_REPOSITORY_RECORD_ID, "team"],
    ] as const;
    const parity = report.rawInputBoundary.consolidatedRepositoryParity;
    expect(parity.status).toBe("exact");
    expect(parity.recordCount).toBe(4);
    expect(
      parity.records.map(({ sourceRecordId, repositoryRecordId, kind }) => [
        sourceRecordId,
        repositoryRecordId,
        kind,
      ]),
    ).toEqual(expected);

    for (const [sourceRecordId, repositoryRecordId, kind] of expected) {
      const manual = requiredRecord(snapshot.records, "sourceRecordId", sourceRecordId);
      const consolidated = requiredRecord(repository.records, "id", repositoryRecordId);
      const row = parity.records.find(
        (candidate) => candidate.sourceRecordId === sourceRecordId,
      );
      expect(row).toMatchObject({
        sourceRecordId,
        repositoryRecordId,
        kind,
        payloadParity: "exact",
        sourceRefParity: "exact",
        status: "candidate",
        promotionEligible: false,
      });

      const [manualPayload, repositoryPayload] =
        kind === "character_guide"
          ? [
              manual.recommendation,
              (consolidated.recommendations as unknown[])[0],
            ]
          : [manualTeamParityPayload(manual), repositoryTeamParityPayload(consolidated)];
      expect(stableJson(manualPayload)).toBe(stableJson(repositoryPayload));
      const payloadSha256 = sha256Text(stableJson(manualPayload));
      expect(row?.manualPayloadSha256).toBe(payloadSha256);
      expect(row?.repositoryPayloadSha256).toBe(payloadSha256);
      expect(consolidated.sourceRefs).toEqual([
        {
          sourceId: "kqm",
          sourceRecordId,
          locator: manual.locator,
        },
      ]);
    }
  });

  it("pins the exact source rotation tokens and independently reconstructs the required normal-hit vector", () => {
    const source = report.computationRepresentationAdmission.sourceRotation;
    expect(source).toEqual({
      sourceRecordId: TEAM_SOURCE_RECORD_ID,
      rotationId: "sample-rotation-xilonen",
      notation: ROTATION_NOTATION,
      unresolvedSegments: [],
      noelleSegments: [
        {
          notation: "N3D",
          sourceTokenOccurrenceCount: 3,
          cancelToken: "D",
          cancelTokenPreserved: true,
          requiredHitVectorPerOccurrence: { n1: 1, n2: 1, n3: 1, n4: 0 },
          formulaCountInferred: false,
        },
        {
          notation: "N2",
          sourceTokenOccurrenceCount: 2,
          cancelToken: null,
          cancelTokenPreserved: true,
          requiredHitVectorPerOccurrence: { n1: 1, n2: 1, n3: 0, n4: 0 },
          formulaCountInferred: false,
        },
      ],
      requiredTotalHitVector: { n1: 5, n2: 5, n3: 3, n4: 0 },
    });
    expect(
      sumHitVectors(
        source.noelleSegments.map((segment) => ({
          count: segment.sourceTokenOccurrenceCount,
          vector: segment.requiredHitVectorPerOccurrence,
        })),
      ),
    ).toEqual(source.requiredTotalHitVector);

    const repository = baseInput.highSliceInput.repositoryInput as {
      records: Array<{
        id: string;
        rotations?: Array<{ id: string; notation: string }>;
      }>;
    };
    const team = repository.records.find(
      ({ id }) => id === TEAM_REPOSITORY_RECORD_ID,
    );
    expect(team?.rotations).toContainEqual({
      id: "sample-rotation-xilonen",
      label: "KQM sample rotation (Xilonen)",
      notation: ROTATION_NOTATION,
      unresolvedSegments: [],
      assumptions: [
        "Use Nicole's parenthesized Burst only when it is available.",
      ],
    });
  });

  it("proves that the current whole four-part noelle-na unit cannot exactly represent either prefix or their total", () => {
    const admission = report.computationRepresentationAdmission;
    expect(admission.calculatorObservation).toEqual({
      characterRegistration: "noelle",
      formulaId: "noelle-na",
      label: "Q Normal (4-hit)",
      representation: "inseparable-four-hit-aggregate",
      aggregateHitVectorPerCount: { n1: 1, n2: 1, n3: 1, n4: 1 },
      normalFormulaPartCount: 4,
      normalFormulaTalentParamIndexes: [1, 2, 3, 4],
      defaultComboDescriptor: [{ formulaId: "noelle-charge", count: 3 }],
      replayLineSupportsPartSelection: false,
      directPathMultipliesWholeEntryByLineCount: true,
      compiledPathMultipliesWholeEntryByLineCount: true,
    });
    expect(admission.exactSegmentMapping).toMatchObject({
      n3d: "not-representable",
      n2: "not-representable",
      total: "not-representable",
      nonnegativeIntegerAggregateCountExists: false,
    });
    expect(admission.exactSegmentMapping.proof).toContain(
      "Each noelle-na count necessarily contributes one N4",
    );

    const aggregate = admission.calculatorObservation.aggregateHitVectorPerCount;
    for (const target of [
      { n1: 1, n2: 1, n3: 1, n4: 0 },
      { n1: 1, n2: 1, n3: 0, n4: 0 },
      admission.sourceRotation.requiredTotalHitVector,
    ]) {
      expect(
        [...Array(16).keys()].some((count) =>
          hitVectorsEqual(scaleHitVector(aggregate, count), target),
        ),
      ).toBe(false);
    }

    const implementationText = baseInput.implementationFile.text;
    const noelleNormalDefinition = implementationText.slice(
      implementationText.indexOf('"noelle-na": {'),
      implementationText.indexOf('"noelle-charge": {'),
    );
    expect(noelleNormalDefinition.match(/this\.param\("A", [1-4]\)/g)).toEqual([
      'this.param("A", 1)',
      'this.param("A", 2)',
      'this.param("A", 3)',
      'this.param("A", 4)',
    ]);
    expect(implementationText).toContain(
      'return [{ id: "noelle-charge", count: 3 }];',
    );
    expect(baseInput.directDamageFile.text).toContain(
      "let total = result.totalDamage * line.count;",
    );
    expect(baseInput.compiledDamageFile.text).toContain("entry.parts,");
    expect(baseInput.compiledDamageFile.text).toContain("line.count,");
    expect(baseInput.replayAdapterFile.text).not.toContain("partIndex:");
  });

  it("independently AST-authenticates the CP51 core and CLI local value-import closure", () => {
    const declared = new Set(
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
    );
    const expectedImports = new Map<string, string[]>([
      [
        NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CORE_RELATIVE_PATH,
        [
          "scripts/guide-factory/src/io.ts",
          "scripts/guide-factory/src/noelleSourceLocalHighInvestmentSlice.ts",
          "scripts/guide-factory/src/noelleSourceLocalLowerInvestmentSlice.ts",
          "scripts/guide-factory/src/paths.ts",
          "scripts/guide-factory/src/schemas.ts",
        ],
      ],
      [
        NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_CLI_RELATIVE_PATH,
        [
          "scripts/guide-factory/src/io.ts",
          "scripts/guide-factory/src/noelleInvestmentArtifactProfileComputationAdmission.ts",
          "scripts/guide-factory/src/noelleSourceLocalHighInvestmentSlice.ts",
          "scripts/guide-factory/src/noelleSourceLocalLowerInvestmentSlice.ts",
          "scripts/guide-factory/src/paths.ts",
        ],
      ],
    ]);

    expect(declared.size).toBe(23);
    for (const [implementationPath, expected] of expectedImports) {
      const source = requiredSourceFile(baseInput, implementationPath);
      const sourceFile = ts.createSourceFile(
        implementationPath,
        source.text,
        ts.ScriptTarget.Latest,
        true,
      );
      const resolved = runtimeStaticModuleSpecifiers(sourceFile)
        .flatMap((moduleSpecifier) => {
          const importedPath = resolveFirstPartyModulePath(
            implementationPath,
            moduleSpecifier,
          );
          return importedPath ? [importedPath] : [];
        })
        .sort(compareText);
      expect(resolved).toEqual(expected);
      expect(
        resolved.every((importedPath) => declared.has(importedPath)),
      ).toBe(true);
    }
  });

  it("independently AST-authenticates the exact four-part noelle-na entry and default combo", () => {
    const sourceFile = ts.createSourceFile(
      NOELLE_IMPLEMENTATION_RELATIVE_PATH,
      baseInput.implementationFile.text,
      ts.ScriptTarget.Latest,
      true,
    );
    const normalEntries = descendants(sourceFile).filter(
      (node): node is ts.PropertyAssignment =>
        ts.isPropertyAssignment(node) && propertyNameText(node.name) === "noelle-na",
    );
    expect(normalEntries).toHaveLength(1);
    const normalEntry = normalEntries[0]!;
    expect(ts.isObjectLiteralExpression(normalEntry.initializer)).toBe(true);
    const normalObject = normalEntry.initializer as ts.ObjectLiteralExpression;
    expect(normalObject.properties.map(({ name }) => propertyNameText(name!))).toEqual([
      "label",
      "parts",
    ]);

    const label = requiredObjectProperty(normalObject, "label");
    expect(ts.isObjectLiteralExpression(label.initializer)).toBe(true);
    const englishLabel = requiredObjectProperty(
      label.initializer as ts.ObjectLiteralExpression,
      "en",
    );
    expect(ts.isStringLiteral(englishLabel.initializer)).toBe(true);
    expect((englishLabel.initializer as ts.StringLiteral).text).toBe(
      "Q Normal (4-hit)",
    );

    const parts = requiredObjectProperty(normalObject, "parts");
    expect(ts.isArrayLiteralExpression(parts.initializer)).toBe(true);
    const partElements = (parts.initializer as ts.ArrayLiteralExpression).elements;
    expect(partElements).toHaveLength(4);
    const paramIndexes = partElements.map((element) => {
      expect(ts.isObjectLiteralExpression(element)).toBe(true);
      const part = element as ts.ObjectLiteralExpression;
      expect(part.properties.map(({ name }) => propertyNameText(name!))).toEqual([
        "formula",
      ]);
      const formula = requiredObjectProperty(part, "formula");
      expect(ts.isNewExpression(formula.initializer)).toBe(true);
      const constructor = formula.initializer as ts.NewExpression;
      expect(constructor.expression.getText(sourceFile)).toBe("DirectFormula");
      const param = constructor.arguments?.[0];
      expect(param && ts.isCallExpression(param)).toBe(true);
      const call = param as ts.CallExpression;
      expect(call.expression.getText(sourceFile)).toBe("this.param");
      expect(call.arguments).toHaveLength(2);
      expect(ts.isStringLiteral(call.arguments[0]!)).toBe(true);
      expect((call.arguments[0] as ts.StringLiteral).text).toBe("A");
      expect(ts.isNumericLiteral(call.arguments[1]!)).toBe(true);
      return Number((call.arguments[1] as ts.NumericLiteral).text);
    });
    expect(paramIndexes).toEqual([1, 2, 3, 4]);

    const noelleClass = nearestClass(normalEntry);
    const comboAccessors = descendants(noelleClass).filter(
      (node): node is ts.GetAccessorDeclaration =>
        ts.isGetAccessorDeclaration(node) &&
        propertyNameText(node.name) === "comboDescriptor",
    );
    expect(comboAccessors).toHaveLength(1);
    const returns = descendants(comboAccessors[0]!).filter(ts.isReturnStatement);
    expect(returns).toHaveLength(1);
    const combo = returns[0]!.expression;
    expect(combo && ts.isArrayLiteralExpression(combo)).toBe(true);
    const comboElements = (combo as ts.ArrayLiteralExpression).elements;
    expect(comboElements).toHaveLength(1);
    expect(ts.isObjectLiteralExpression(comboElements[0]!)).toBe(true);
    const comboObject = comboElements[0] as ts.ObjectLiteralExpression;
    expect(comboObject.properties.map(({ name }) => propertyNameText(name!))).toEqual([
      "id",
      "count",
    ]);
    const comboId = requiredObjectProperty(comboObject, "id").initializer;
    const comboCount = requiredObjectProperty(comboObject, "count").initializer;
    expect(ts.isStringLiteral(comboId) && comboId.text).toBe("noelle-charge");
    expect(ts.isNumericLiteral(comboCount) && Number(comboCount.text)).toBe(3);
  });

  it("rejects the representation gate with no replay, numeric result, selection, build, claim, rank, damage, or ER output", () => {
    expect(report.computationRepresentationAdmission).toMatchObject({
      admissionStatus: "rejected-exact-formula-representation-missing",
      numericReplayAdmitted: false,
      numericResult: null,
    });
    expect(report).toMatchObject({
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      supportsIdealStatAllocation: false,
      artifactProfileCompositionExecuted: true,
      recommendationCompositionExecuted: false,
      candidateGenerationExecuted: false,
      generatorExecuted: false,
      autoTuneExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      artifactAssignmentExecuted: false,
      weaponAssignmentExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      rotationReplayExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    for (const profile of report.profiles) {
      expect(profile.substatPriority.selectedAllocation).toBeNull();
      expect(profile.substatPriority.scalarWeights).toBeNull();
      expect(profile.missingBoundaries).toEqual({
        weapon: "missing-not-zero",
        exactTeamNoelleWeaponRecommendationCount: 0,
        energyRecharge: "deferred-missing-not-zero",
        exactTeamNoelleErTargetCount: 0,
        formulaCounts: "missing-not-zero",
        sourceRecordsExplicitlyListFormulaCountsAsUnknown: true,
        enemyScenario: "missing-not-zero",
        completeArtifactAssignment: false,
        completeBuild: false,
      });
      expect(profile.artifactSet.assignedToRuntimeBuild).toBe(false);
    }
    expect(stableJson(report)).not.toContain("totalDamage");
    expect(stableJson(report)).not.toContain("winner");
  });

  it("rejects swapped high/lower authenticated report boundaries", () => {
    const swapped = fixture();
    const highReport = swapped.highSliceReport;
    const highInput = swapped.highSliceInput;
    swapped.highSliceReport = swapped.lowerSliceReport as unknown as NoelleSourceLocalHighInvestmentSliceReport;
    swapped.highSliceInput = swapped.lowerSliceInput as unknown as BuildNoelleSourceLocalHighInvestmentSliceInput;
    swapped.lowerSliceReport = highReport as unknown as NoelleSourceLocalLowerInvestmentSliceReport;
    swapped.lowerSliceInput = highInput as unknown as BuildNoelleSourceLocalLowerInvestmentSliceInput;

    expect(() =>
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(swapped),
    ).toThrow(
      /supplied slice report disagrees|high-investment slice authentication failed|high slice report hash drifted/,
    );
  });

  it("rejects missing, duplicate, hash-mismatched, and malformed outer raw inputs", () => {
    const missingSource = fixture();
    missingSource.sourceFiles = missingSource.sourceFiles.slice(1);
    expect(() =>
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
        missingSource,
      ),
    ).toThrow(/source-file path closure drifted/);

    const duplicateSource = fixture();
    duplicateSource.sourceFiles = [
      ...duplicateSource.sourceFiles,
      structuredClone(duplicateSource.sourceFiles[0]!),
    ];
    expect(() =>
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
        duplicateSource,
      ),
    ).toThrow(/source-file path closure drifted/);

    const missingGenerated = fixture();
    missingGenerated.generatedFrom = missingGenerated.generatedFrom.slice(1);
    expect(() =>
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
        missingGenerated,
      ),
    ).toThrow(/generatedFrom path closure drifted/);

    const duplicateGenerated = fixture();
    duplicateGenerated.generatedFrom = [
      ...duplicateGenerated.generatedFrom,
      structuredClone(duplicateGenerated.generatedFrom[0]!),
    ];
    expect(() =>
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
        duplicateGenerated,
      ),
    ).toThrow(/generatedFrom path closure drifted/);

    const rawHashMismatch = fixture();
    const manualIndexFile = requiredSourceFile(
      rawHashMismatch,
      "scripts/guide-factory/data/source-snapshots/manual-index.json",
    );
    manualIndexFile.text = `${manualIndexFile.text}\n`;
    expect(() =>
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
        rawHashMismatch,
      ),
    ).toThrow(/raw byte hash mismatch/);

    const malformedJson = fixture();
    replaceOuterSourceText(
      malformedJson,
      "scripts/guide-factory/data/source-snapshots/manual-index.json",
      "{",
    );
    expect(() =>
      buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
        malformedJson,
      ),
    ).toThrow(/could not be parsed/);
  });

  it("rejects raw source profile, Husk, substat-priority, and source-rotation tampering", () => {
    const cases: Array<{
      label: string;
      mutate: (
        input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
      ) => void;
    }> = [
      {
        label: "Husk set",
        mutate: (input) => {
          const record = mutableManualRecord(input, HUSK_SOURCE_RECORD_ID);
          const recommendation = record.recommendation as {
            artifactRecommendations: Array<{
              artifacts: Array<{ setId: string }>;
            }>;
          };
          recommendation.artifactRecommendations[0]!.artifacts[0]!.setId =
            "maiden_beloved";
        },
      },
      {
        label: "lower substat priority",
        mutate: (input) => {
          const record = mutableManualRecord(input, LOWER_SOURCE_RECORD_ID);
          const recommendation = record.recommendation as {
            substats: Array<{ priority: number }>;
          };
          recommendation.substats[1]!.priority = 3;
        },
      },
      {
        label: "high substat condition",
        mutate: (input) => {
          const record = mutableManualRecord(input, HIGH_SOURCE_RECORD_ID);
          const recommendation = record.recommendation as {
            substats: Array<{ conditions: string[] }>;
          };
          recommendation.substats[0]!.conditions[0] =
            "Noelle is C6; offensive stats only.";
        },
      },
      {
        label: "source rotation",
        mutate: (input) => {
          const record = mutableManualRecord(input, TEAM_SOURCE_RECORD_ID);
          const rotations = record.rotations as Array<{ notation: string }>;
          rotations[0]!.notation = rotations[0]!.notation.replace(
            "2[N3D]",
            "2[N4D]",
          );
        },
      },
    ];

    for (const { label, mutate } of cases) {
      const tampered = fixture();
      mutate(tampered);
      synchronizeManualSnapshotRawClosure(tampered);
      expect(
        () =>
          buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
            tampered,
          ),
        label,
      ).toThrow();
    }
  });

  it("rejects resealed implementation, direct, compiled, and replay-adapter representation evidence", () => {
    for (const field of [
      "implementationFile",
      "directDamageFile",
      "compiledDamageFile",
      "replayAdapterFile",
    ] as const) {
      const tampered = fixture();
      const file = tampered[field];
      file.text = `${file.text}\n// cp51 tamper`;
      file.sha256 = sha256Text(file.text);
      replaceOuterSourceText(tampered, file.path, file.text);
      expect(
        () =>
          buildNoelleInvestmentArtifactProfileComputationAdmissionReport(
            tampered,
          ),
        field,
      ).toThrow(/hash drifted/);
    }
  });

  it("rejects serialized report mutation even when every canonical input remains valid", () => {
    const tampered = structuredClone(report) as NoelleInvestmentArtifactProfileComputationAdmissionReport & {
      summary: { sourceMainStatOptionCount: number };
    };
    tampered.summary.sourceMainStatOptionCount = 7;
    expect(() =>
      authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
        tampered,
        fixture(),
      ),
    ).toThrow(/serialized report does not match a fresh canonical rebuild/);
  });
});

function requiredProfile(profileId: string): NoelleSourceBackedArtifactProfile {
  const matches = report.profiles.filter((profile) => profile.profileId === profileId);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function mainStatProjection(profile: NoelleSourceBackedArtifactProfile) {
  return {
    sands: profile.mainStats.sands.options.map(({ statIds }) => statIds),
    goblet: profile.mainStats.goblet.options.map(({ statIds }) => statIds),
    circlet: profile.mainStats.circlet.options.map(({ statIds }) => statIds),
  };
}

function substatProjection(
  profile: NoelleSourceBackedArtifactProfile,
): Array<[number, string[]]> {
  return profile.substatPriority.groups.map(({ priority, statIds }) => [
    priority,
    statIds,
  ]);
}

type HitVector = { n1: number; n2: number; n3: number; n4: number };

function scaleHitVector(vector: HitVector, count: number): HitVector {
  return {
    n1: vector.n1 * count,
    n2: vector.n2 * count,
    n3: vector.n3 * count,
    n4: vector.n4 * count,
  };
}

function hitVectorsEqual(left: HitVector, right: HitVector): boolean {
  return (
    left.n1 === right.n1 &&
    left.n2 === right.n2 &&
    left.n3 === right.n3 &&
    left.n4 === right.n4
  );
}

function sumHitVectors(
  rows: ReadonlyArray<{ count: number; vector: HitVector }>,
): HitVector {
  return rows.reduce<HitVector>(
    (sum, { count, vector }) => ({
      n1: sum.n1 + count * vector.n1,
      n2: sum.n2 + count * vector.n2,
      n3: sum.n3 + count * vector.n3,
      n4: sum.n4 + count * vector.n4,
    }),
    { n1: 0, n2: 0, n3: 0, n4: 0 },
  );
}

function requiredRecord(
  records: Array<Record<string, unknown>>,
  key: string,
  value: string,
): Record<string, unknown> {
  const matches = records.filter((record) => record[key] === value);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function manualTeamParityPayload(
  manual: Record<string, unknown>,
): Record<string, unknown> {
  const members = (manual.members as Array<Record<string, unknown>>).map(
    (member) => {
      expect(member.weaponRecommendations).toEqual([]);
      expect(member.artifactRecommendations).toEqual([]);
      expect(member.erTargets).toEqual([]);
      return {
        characterId: member.characterId,
        investment: { status: "unspecified" },
        selectedArtifact: null,
        selectedWeapon: null,
      };
    },
  );
  return {
    label: manual.label,
    intent: manual.intent,
    exhaustiveness: manual.exhaustiveness,
    rankingClaim: manual.rankingClaim,
    members,
    rotations: manual.rotations,
    damagePlans: [],
  };
}

function repositoryTeamParityPayload(
  repository: Record<string, unknown>,
): Record<string, unknown> {
  return {
    label: repository.label,
    intent: repository.intent,
    exhaustiveness: repository.exhaustiveness,
    rankingClaim: repository.rankingClaim,
    members: repository.members,
    rotations: repository.rotations,
    damagePlans: repository.damagePlans,
  };
}

function descendants(root: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [];
  function visit(node: ts.Node): void {
    nodes.push(node);
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(root, visit);
  return nodes;
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return null;
}

function requiredObjectProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.PropertyAssignment {
  const matches = object.properties.filter(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && propertyNameText(property.name) === name,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function nearestClass(node: ts.Node): ts.ClassDeclaration {
  let ancestor: ts.Node | undefined = node.parent;
  while (ancestor && !ts.isClassDeclaration(ancestor)) {
    ancestor = ancestor.parent;
  }
  expect(ancestor && ts.isClassDeclaration(ancestor)).toBe(true);
  return ancestor as ts.ClassDeclaration;
}

function runtimeStaticModuleSpecifiers(sourceFile: ts.SourceFile): string[] {
  const moduleSpecifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyImportDeclaration(node)
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      moduleSpecifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return moduleSpecifiers;
}

function isTypeOnlyImportDeclaration(
  declaration: ts.ImportDeclaration,
): boolean {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  if (!clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) {
    return false;
  }
  return clause.namedBindings.elements.every(({ isTypeOnly }) => isTypeOnly);
}

function resolveFirstPartyModulePath(
  importerPath: string,
  moduleSpecifier: string,
): string | null {
  const bareModuleSpecifier = moduleSpecifier.split("?", 1)[0];
  let basePath: string;
  if (bareModuleSpecifier.startsWith("@/")) {
    basePath = `src/${bareModuleSpecifier.slice(2)}`;
  } else if (bareModuleSpecifier.startsWith(".")) {
    basePath = path.posix.normalize(
      path.posix.join(path.posix.dirname(importerPath), bareModuleSpecifier),
    );
  } else {
    return null;
  }

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.json`,
    `${basePath}.json.gz`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ];
  const resolved = candidates.find((candidate) => {
    const absolutePath = path.join(REPOSITORY_ROOT, candidate);
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  });
  if (!resolved) {
    throw new Error(
      `Could not resolve first-party static import ${moduleSpecifier} from ${importerPath}.`,
    );
  }
  return resolved.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function mutableManualRecord(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
  sourceRecordId: string,
): Record<string, unknown> {
  const snapshot = input.highSliceInput.manualSnapshotInput as {
    records: Array<Record<string, unknown>>;
  };
  const record = snapshot.records.find(
    (candidate) => candidate.sourceRecordId === sourceRecordId,
  );
  if (!record) throw new Error(`Missing test source record ${sourceRecordId}.`);
  return record;
}

function synchronizeManualSnapshotRawClosure(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
): void {
  const snapshot = structuredClone(input.highSliceInput.manualSnapshotInput);
  input.highSliceInput.manualSnapshotInput = snapshot;
  input.lowerSliceInput.manualSnapshotInput = structuredClone(snapshot);
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  replaceOuterSourceText(input, NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH, text);
  const sha256 = sha256Text(text);
  for (const slice of [input.highSliceInput, input.lowerSliceInput]) {
    const source = slice.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH,
    );
    const generated = slice.generatedFrom.find(
      ({ path: sourcePath }) =>
        sourcePath === NOELLE_MANUAL_SNAPSHOT_RELATIVE_PATH,
    );
    if (!source || !generated) {
      throw new Error("Missing Noelle manual snapshot from test slice fixture.");
    }
    source.text = text;
    generated.sha256 = sha256;
  }
}

function requiredSourceFile(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
  sourcePath: string,
) {
  const matches = input.sourceFiles.filter(
    ({ path: candidatePath }) => candidatePath === sourcePath,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function replaceOuterSourceText(
  input: NoelleInvestmentArtifactProfileComputationAdmissionInput,
  sourcePath: string,
  text: string,
): void {
  requiredSourceFile(input, sourcePath).text = text;
  const matches = input.generatedFrom.filter(
    ({ path: candidatePath }) => candidatePath === sourcePath,
  );
  expect(matches).toHaveLength(1);
  matches[0]!.sha256 = sha256Text(text);
}

function fixture(): NoelleInvestmentArtifactProfileComputationAdmissionInput {
  return structuredClone(baseInput);
}

async function loadInput(): Promise<NoelleInvestmentArtifactProfileComputationAdmissionInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    highSliceReport,
    lowerSliceReport,
    sourceFiles,
    generatedFrom,
    implementationFile,
    directDamageFile,
    compiledDamageFile,
    replayAdapterFile,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(NOELLE_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH),
    readJson(NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH),
    readSourceFiles(
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
    ),
    readGeneratedFrom(
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
    ),
    readPinnedTextFile(NOELLE_IMPLEMENTATION_RELATIVE_PATH),
    readPinnedTextFile(NOELLE_DIRECT_DAMAGE_RELATIVE_PATH),
    readPinnedTextFile(NOELLE_COMPILED_DAMAGE_RELATIVE_PATH),
    readPinnedTextFile(NOELLE_REPLAY_ADAPTER_RELATIVE_PATH),
  ]);

  const sourceFileByPath = new Map(
    sourceFiles.map((entry) => [entry.path, entry] as const),
  );
  const generatedFromByPath = new Map(
    generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  const selectSourceFiles = (paths: readonly string[]) =>
    paths.map((sourcePath) => {
      const entry = sourceFileByPath.get(sourcePath);
      if (!entry) throw new Error(`Missing test source file ${sourcePath}.`);
      return entry;
    });
  const selectGeneratedFrom = (paths: readonly string[]) =>
    paths.map((sourcePath) => {
      const entry = generatedFromByPath.get(sourcePath);
      if (!entry) throw new Error(`Missing test generatedFrom ${sourcePath}.`);
      return entry;
    });

  return {
    highSliceReport:
      highSliceReport as NoelleSourceLocalHighInvestmentSliceReport,
    highSliceInput: {
      repositoryInput,
      manualSnapshotInput,
      manualIndexInput,
      sourceRegistryInput,
      sourceFiles: selectSourceFiles(
        NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
      ),
      generatedFrom: selectGeneratedFrom(
        NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
      ),
    },
    lowerSliceReport:
      lowerSliceReport as NoelleSourceLocalLowerInvestmentSliceReport,
    lowerSliceInput: {
      repositoryInput,
      manualSnapshotInput,
      manualIndexInput,
      sourceRegistryInput,
      sourceFiles: selectSourceFiles(
        NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
      ),
      generatedFrom: selectGeneratedFrom(
        NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
      ),
    },
    implementationFile,
    directDamageFile,
    compiledDamageFile,
    replayAdapterFile,
    sourceFiles,
    generatedFrom,
  };
}

async function readSourceFiles(paths: readonly string[]) {
  return Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
    })),
  );
}

async function readGeneratedFrom(paths: readonly string[]) {
  return Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  );
}

async function readPinnedTextFile<TPath extends string>(relativePath: TPath) {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  const [text, sha256] = await Promise.all([
    readFile(absolutePath, "utf8"),
    sha256File(absolutePath),
  ]);
  return { path: relativePath, text, sha256 };
}
