import { existsSync, statSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildNoelleHexereiPartialEquipmentCompositionFromWorkspace,
  loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace,
} from "../src/assemble-noelle-hexerei-partial-equipment-composition";
import { sha256Text, stableJson } from "../src/io";
import {
  authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
} from "../src/noelleInvestmentArtifactProfileComputationAdmission";
import {
  authenticateNoelleHexereiWeaponTeamSourceBindingReport,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS,
} from "../src/noelleHexereiWeaponTeamSourceBinding";
import {
  authenticateNoelleHexereiPartialEquipmentCompositionReport,
  assertNoelleHexereiPartialEquipmentUpstreamSemanticBoundaries,
  buildNoelleHexereiPartialEquipmentCompositionReport,
  NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CLI_RELATIVE_PATH,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CORE_RELATIVE_PATH,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_SOURCE_FILE_PATHS,
  requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentCompositionInput,
  type NoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentValidationCandidate,
} from "../src/noelleHexereiPartialEquipmentComposition";
import { REPOSITORY_ROOT } from "../src/paths";

const REPOSITORY_PATH = "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const HIGH_SLICE_REPORT_PATH =
  "scripts/guide-factory/reports/noelle-source-local-high-investment-slice.json";
const LOWER_SLICE_REPORT_PATH =
  "scripts/guide-factory/reports/noelle-source-local-lower-investment-slice.json";
const TEAM_SOURCE_RECORD_ID =
  "noelle-durin-nicole-xilonen-hexerei-example-luna-viii";
const TEAM_REPOSITORY_RECORD_ID =
  "kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii";

let baseInput: NoelleHexereiPartialEquipmentCompositionInput;
let report: NoelleHexereiPartialEquipmentCompositionReport;

beforeAll(async () => {
  [baseInput, report] = await Promise.all([
    loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace(),
    buildNoelleHexereiPartialEquipmentCompositionFromWorkspace(),
  ]);
}, 120_000);

describe("Noelle Hexerei partial equipment composition", () => {
  it("deterministically self-authenticates the exact 29-path, eight-JSON outer closure", async () => {
    const rebuilt = buildNoelleHexereiPartialEquipmentCompositionReport(
      fixture(),
    );
    const authentication =
      authenticateNoelleHexereiPartialEquipmentCompositionReport(
        report,
        fixture(),
      );
    expect(authentication.authenticated).toBe(true);
    if (!authentication.authenticated) return;

    expect(stableJson(rebuilt)).toBe(stableJson(report));
    expect(stableJson(authentication.canonicalReport)).toBe(stableJson(report));
    expect(
      stableJson(
        requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport(
          report,
          fixture(),
        ),
      ),
    ).toBe(stableJson(report));
    expect(
      stableJson(
        await buildNoelleHexereiPartialEquipmentCompositionFromWorkspace(),
      ),
    ).toBe(stableJson(report));
    expect(report.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromText: true,
      jsonByteAndParsedObjectParity: true,
      exactCp51InputProjection: true,
      exactCp52InputProjection: true,
      sourceFileCount: 29,
      generatedFromCount: 29,
      jsonInputCount: 8,
    });
    expect(baseInput.sourceFiles.map(({ path: sourcePath }) => sourcePath)).toEqual(
      [...NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_SOURCE_FILE_PATHS],
    );
    expect(baseInput.generatedFrom.map(({ path: sourcePath }) => sourcePath)).toEqual(
      [...NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS],
    );
    expect(report.generatedFrom).toEqual(baseInput.generatedFrom);
    expect(new Set(report.generatedFrom.map(({ path: sourcePath }) => sourcePath)).size).toBe(
      29,
    );
    for (const sourceFile of baseInput.sourceFiles) {
      const generated = baseInput.generatedFrom.find(
        ({ path: sourcePath }) => sourcePath === sourceFile.path,
      );
      expect(generated?.sha256).toBe(sha256Text(sourceFile.text));
    }
  }, 120_000);

  it("independently authenticates all eight durable JSON byte/object projections", () => {
    const cases: Array<[string, unknown[]]> = [
      [
        REPOSITORY_PATH,
        [
          baseInput.cp51Input.highSliceInput.repositoryInput,
          baseInput.cp51Input.lowerSliceInput.repositoryInput,
          baseInput.cp52Input.repositoryInput,
        ],
      ],
      [
        MANUAL_SNAPSHOT_PATH,
        [
          baseInput.cp51Input.highSliceInput.manualSnapshotInput,
          baseInput.cp51Input.lowerSliceInput.manualSnapshotInput,
          baseInput.cp52Input.manualSnapshotInput,
        ],
      ],
      [
        MANUAL_INDEX_PATH,
        [
          baseInput.cp51Input.highSliceInput.manualIndexInput,
          baseInput.cp51Input.lowerSliceInput.manualIndexInput,
          baseInput.cp52Input.manualIndexInput,
        ],
      ],
      [
        SOURCE_REGISTRY_PATH,
        [
          baseInput.cp51Input.highSliceInput.sourceRegistryInput,
          baseInput.cp51Input.lowerSliceInput.sourceRegistryInput,
          baseInput.cp52Input.sourceRegistryInput,
        ],
      ],
      [
        HIGH_SLICE_REPORT_PATH,
        [
          baseInput.cp51Input.highSliceReport,
          baseInput.cp52Input.highSliceReportInput,
        ],
      ],
      [LOWER_SLICE_REPORT_PATH, [baseInput.cp51Input.lowerSliceReport]],
      [NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH, [baseInput.cp51ReportInput]],
      [NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH, [baseInput.cp52ReportInput]],
    ];
    expect(cases).toHaveLength(8);
    for (const [sourcePath, suppliedObjects] of cases) {
      const parsed = JSON.parse(requiredSourceFile(baseInput, sourcePath).text);
      for (const supplied of suppliedObjects) {
        expect(stableJson(supplied), sourcePath).toBe(stableJson(parsed));
      }
    }
  });

  it("projects both upstream inputs exactly from the outer closure and freshly authenticates both reports", () => {
    assertProjectedClosure(
      baseInput.cp51Input.sourceFiles,
      baseInput.cp51Input.generatedFrom,
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
    );
    assertProjectedClosure(
      baseInput.cp52Input.sourceFiles,
      baseInput.cp52Input.generatedFrom,
      NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS,
      NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
    );

    const cp51 =
      authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
        baseInput.cp51ReportInput,
        baseInput.cp51Input,
      );
    const cp52 = authenticateNoelleHexereiWeaponTeamSourceBindingReport(
      baseInput.cp52ReportInput,
      baseInput.cp52Input,
    );
    expect(cp52.authenticated).toBe(true);
    expect(stableJson(cp51)).toBe(stableJson(baseInput.cp51ReportInput));
    if (!cp52.authenticated) return;
    expect(stableJson(cp52.canonicalReport)).toBe(
      stableJson(baseInput.cp52ReportInput),
    );
    expect(report.upstreamBoundary).toEqual({
      cp51: {
        reportPath: NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256Text(
          requiredSourceFile(
            baseInput,
            NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
          ).text,
        ),
        canonicalObjectSha256: sha256Text(stableJson(cp51)),
        freshlyAuthenticated: true,
        inputPathCount: 23,
        profileCount: 2,
      },
      cp52: {
        reportPath: NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256Text(
          requiredSourceFile(
            baseInput,
            NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
          ).text,
        ),
        canonicalObjectSha256: sha256Text(stableJson(cp52.canonicalReport)),
        freshlyAuthenticated: true,
        inputPathCount: 16,
        exactTeamCount: 1,
        localBindingCount: 1,
      },
    });
  });

  it("constructs exactly two request-parameterized candidates without choosing an investment branch", () => {
    expect(report.candidates).toHaveLength(2);
    expect(report.candidates.map(({ candidateId }) => candidateId)).toEqual([
      "noelle-lower-investment-artifact-profile-v1:gest-exact-hexerei-team",
      "noelle-high-investment-artifact-profile-v1:gest-exact-hexerei-team",
    ]);
    for (const [index, candidate] of report.candidates.entries()) {
      expect(candidate).toMatchObject({
        status: "request-parameterized-partial-validation-candidate",
        characterId: "noelle",
        team: {
          sourceRecordId: TEAM_SOURCE_RECORD_ID,
          repositoryRecordId: TEAM_REPOSITORY_RECORD_ID,
          orderedCharacterIds: ["noelle", "durin", "nicole", "xilonen"],
          noelleInvestment: { status: "unspecified" },
          investmentBranchEvaluation: "not-evaluated",
          investmentBranchSelected: false,
        },
        authorship: {
          sourceAuthoredCandidate: false,
          sourceAuthoredComposite: false,
          guideFactoryAuthoredPartialComposition: true,
          guideFactoryAuthoredProjection: true,
          existingRuntimeGeneratorProducedCandidate: false,
        },
      });
      expect(stableJson(candidate.artifactProfile)).toBe(
        stableJson(baseInput.cp51ReportInput.profiles[index]),
      );
      expect(candidate.artifactProfile.missingBoundaries.weapon).toBe(
        "missing-not-zero",
      );
      const { candidateSha256, ...candidateWithoutHash } = candidate;
      expect(candidateSha256).toBe(
        sha256Text(stableJson(candidateWithoutHash)),
      );
    }
  });

  it("pins both authenticated upstream reports to validation-only authority and zero execution counts", () => {
    expect(baseInput.cp51ReportInput).toMatchObject({
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
      recommendationCompositionExecuted: false,
      candidateGenerationExecuted: false,
      generatorExecuted: false,
      autoTuneExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      weaponAssignmentExecuted: false,
      artifactAssignmentExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      rotationReplayExecuted: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        candidateCount: 0,
        generatedTeamCount: 0,
        assembledBuildCount: 0,
        artifactAssignmentCount: 0,
        optimizerRunCount: 0,
        numericResultCount: 0,
      },
    });
    expect(baseInput.cp52ReportInput).toMatchObject({
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
      recommendationCompositionExecuted: false,
      candidateGenerationExecuted: false,
      generatorExecuted: false,
      autoTuneExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      weaponAssignmentExecuted: false,
      artifactAssignmentExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      rotationReplayExecuted: false,
      idealStatAllocationExecuted: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        candidateCount: 0,
        assembledBuildCount: 0,
        equipmentAssignmentCount: 0,
        selectionCount: 0,
        derivedRankCount: 0,
        generatorRunCount: 0,
        optimizerRunCount: 0,
        damageComputationCount: 0,
        rotationReplayCount: 0,
        energyRecoveryComputationCount: 0,
      },
    });
  });

  it("projects one applicable unranked Gest and one unselected Husk option into each candidate", () => {
    for (const candidate of report.candidates) {
      expect(stableJson(candidate.weaponOption.sourceObservation)).toBe(
        stableJson(baseInput.cp52ReportInput.weaponObservation),
      );
      expect(stableJson(candidate.weaponOption.applicabilityBinding)).toBe(
        stableJson(baseInput.cp52ReportInput.binding),
      );
      expect(candidate.weaponOption).toMatchObject({
        projectedForCandidate: true,
        applicableButUnranked: true,
        refinement: null,
        refinementStatus: "missing-not-zero",
        quantitativePerformanceStatus: "missing-not-zero",
      });
      expect(candidate.weaponOption.sourceObservation).toMatchObject({
        weaponId: "gest_of_the_mighty_wolf",
        weaponOrdering: "unranked",
        refinement: null,
        refinementStatus: "missing-not-zero",
        quantitativePerformanceStatus: "missing-not-zero",
      });
      expect(candidate.artifactProfile.artifactSet).toMatchObject({
        set: { type: "4pc", setId: "husk_of_opulent_dreams" },
        sourceConditions: [],
        assignedToRuntimeBuild: false,
      });
      expect(candidate.selections).toEqual({
        selectedWeapon: null,
        selectedArtifactSet: null,
        selectedMainStats: { sands: null, goblet: null, circlet: null },
        selectedSubstatAllocation: null,
      });
      expect(candidate.completeness).toEqual({
        guardedAlternativesPreservedUnchanged: true,
        embeddedArtifactProfileWeaponBoundaryPreserved: "missing-not-zero",
        applicableWeaponOptionProjectedSeparately: true,
        completeArtifactAssignment: false,
        completeBuild: false,
      });
    }
  });

  it("preserves the exact CP51 main-stat, substat, provenance, and guarded-alternative payloads", () => {
    const [lower, high] = report.candidates;
    expect(mainStatProjection(lower!)).toEqual({
      sands: [["atk%"]],
      goblet: [["geo%"]],
      circlet: [["cr", "cd"]],
    });
    expect(mainStatProjection(high!)).toEqual({
      sands: [["def%"]],
      goblet: [["geo%"], ["def%"]],
      circlet: [["cr", "cd"], ["def%"]],
    });
    expect(substatProjection(lower!)).toEqual([
      [1, ["cr", "cd"]],
      [2, ["atk%"]],
      [3, ["def%"]],
    ]);
    expect(substatProjection(high!)).toEqual([
      [1, ["cr", "cd"]],
      [2, ["def%"]],
      [3, ["atk%"]],
    ]);
    expect(
      high!.artifactProfile.mainStats.goblet.options.map(
        ({ conditionStatus }) => conditionStatus,
      ),
    ).toEqual([
      "branch-condition-authenticated",
      "additional-source-guard-unresolved",
    ]);
    expect(
      high!.artifactProfile.mainStats.circlet.options.map(
        ({ conditionStatus }) => conditionStatus,
      ),
    ).toEqual([
      "branch-condition-authenticated",
      "additional-source-guard-unresolved",
    ]);
    for (const candidate of report.candidates) {
      for (const slot of Object.values(candidate.artifactProfile.mainStats)) {
        expect(slot.selectedOptionIndex).toBeNull();
      }
      expect(candidate.artifactProfile.substatPriority.selectedAllocation).toBeNull();
      expect(candidate.artifactProfile.substatPriority.scalarWeights).toBeNull();
      expect(candidate.artifactProfile.sourceRecordSha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(candidate.artifactProfile.artifactSet.conditionsSha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
      for (const group of candidate.artifactProfile.substatPriority.groups) {
        expect(group.sourceOccurrence.conditionsSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(group.sourceOccurrence.bindingMethod).toBe(
          "cp51-exact-source-condition-allowlist",
        );
      }
    }
  });

  it("preserves CP51 representation rejection and CP52 missing refinement/quantitative boundaries", () => {
    expect(stableJson(report.preservedComputationRepresentationGate)).toBe(
      stableJson(
        baseInput.cp51ReportInput.computationRepresentationAdmission,
      ),
    );
    expect(report.preservedComputationRepresentationGate).toMatchObject({
      exactSegmentMapping: {
        n3d: "not-representable",
        n2: "not-representable",
        total: "not-representable",
        nonnegativeIntegerAggregateCountExists: false,
      },
      admissionStatus: "rejected-exact-formula-representation-missing",
      numericReplayAdmitted: false,
      numericResult: null,
    });
    for (const candidate of report.candidates) {
      expect(candidate.weaponOption.refinement).toBeNull();
      expect(candidate.weaponOption.refinementStatus).toBe("missing-not-zero");
      expect(candidate.weaponOption.quantitativePerformanceStatus).toBe(
        "missing-not-zero",
      );
      expect(candidate.artifactProfile.missingBoundaries).toMatchObject({
        weapon: "missing-not-zero",
        energyRecharge: "deferred-missing-not-zero",
        formulaCounts: "missing-not-zero",
        completeArtifactAssignment: false,
        completeBuild: false,
      });
    }
  });

  it("records one GF-authored deterministic projection while all recommendation authority and runtime operations remain false", () => {
    expect(report.summary).toEqual({
      candidateCount: 2,
      partialValidationCandidateCount: 2,
      uniqueWeaponCount: 1,
      projectedWeaponOccurrenceCount: 2,
      uniqueArtifactSetCount: 1,
      projectedArtifactSetOccurrenceCount: 2,
      mainStatSlotGroupCount: 6,
      mainStatOptionGroupCount: 8,
      sourceMainStatOptionCount: 8,
      substatPriorityGroupCount: 6,
      candidateProjectionRunCount: 1,
      selectionCount: 0,
      assignmentCount: 0,
      completeBuildCount: 0,
      generatorRunCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      damageComputationCount: 0,
      rotationReplayCount: 0,
      idealStatAllocationCount: 0,
      energyRecoveryComputationCount: 0,
    });
    expect(report).toMatchObject({
      supportsPartialValidationComposition: true,
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
      arbitraryEnglishParsingAllowed: false,
      partialValidationCompositionExecuted: true,
      partialValidationCandidateProjectionExecuted: true,
      partialCandidateConstructionExecuted: true,
      recommendationCompositionExecuted: false,
      candidateGenerationExecuted: true,
      candidateGenerationKind: "deterministic-authenticated-branch-projection",
      generatorExecuted: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      weaponAssignmentExecuted: false,
      artifactAssignmentExecuted: false,
      equipmentAssignmentExecuted: false,
      selectionExecuted: false,
      rankingExecuted: false,
      damageComputationExecuted: false,
      rotationReplayExecuted: false,
      idealStatAllocationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
  });

  it("rejects missing, duplicate, raw-hash-mismatched, malformed, and JSON split-brain outer inputs", () => {
    const missingSource = fixture();
    missingSource.sourceFiles = missingSource.sourceFiles.slice(1);
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(missingSource)).toThrow(
      /path closure drifted/,
    );

    const duplicateSource = fixture();
    duplicateSource.sourceFiles = [
      ...duplicateSource.sourceFiles,
      structuredClone(duplicateSource.sourceFiles[0]!),
    ];
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(duplicateSource)).toThrow(
      /path closure drifted/,
    );

    const missingGenerated = fixture();
    missingGenerated.generatedFrom = missingGenerated.generatedFrom.slice(1);
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(missingGenerated)).toThrow(
      /path closure drifted/,
    );

    const duplicateGenerated = fixture();
    duplicateGenerated.generatedFrom = [
      ...duplicateGenerated.generatedFrom,
      structuredClone(duplicateGenerated.generatedFrom[0]!),
    ];
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(duplicateGenerated)).toThrow(
      /path closure drifted/,
    );

    const hashMismatch = fixture();
    requiredSourceFile(hashMismatch, MANUAL_INDEX_PATH).text += "\n";
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(hashMismatch)).toThrow(
      /source\/hash authentication drifted/,
    );

    const malformed = fixture();
    replaceOuterSourceText(malformed, MANUAL_INDEX_PATH, "{");
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(malformed)).toThrow(
      /JSON input is invalid/,
    );

    const splitBrain = fixture();
    (splitBrain.cp51ReportInput.summary as { profileCount: number }).profileCount = 3;
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(splitBrain)).toThrow(
      /parsed JSON input disagrees/,
    );
  });

  it("rejects CP51 and CP52 supplied-input projections that diverge from the outer closure", () => {
    const cp51Split = fixture();
    cp51Split.cp51Input.implementationFile.text += "\n// cp53 split";
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(cp51Split)).toThrow(
      /supplied CP51 input is not the exact projection/,
    );

    const cp52Split = fixture();
    const cp52CorePath =
      "scripts/guide-factory/src/noelleHexereiWeaponTeamSourceBinding.ts";
    const cp52Core = cp52Split.cp52Input.sourceFiles.find(
      ({ path: sourcePath }) => sourcePath === cp52CorePath,
    );
    expect(cp52Core).toBeDefined();
    cp52Core!.text += "\n// cp53 split";
    expect(() => buildNoelleHexereiPartialEquipmentCompositionReport(cp52Split)).toThrow(
      /supplied CP52 input is not the exact projection/,
    );
  });

  it("rejects hash-resealed forged CP51/CP52 reports and upstream authority/count broadening", () => {
    const cases: Array<{
      label: string;
      reportPath: string;
      mutate: (input: NoelleHexereiPartialEquipmentCompositionInput) => unknown;
    }> = [
      {
        label: "CP51 report",
        reportPath: NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
        mutate: (input) => {
          const forged = structuredClone(input.cp51ReportInput);
          (forged.summary as { profileCount: number }).profileCount = 3;
          input.cp51ReportInput = forged;
          return forged;
        },
      },
      {
        label: "CP51 authority",
        reportPath: NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
        mutate: (input) => {
          const forged = structuredClone(input.cp51ReportInput);
          (forged as unknown as { supportsGuideClaims: boolean }).supportsGuideClaims =
            true;
          input.cp51ReportInput = forged;
          return forged;
        },
      },
      {
        label: "CP52 report",
        reportPath: NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
        mutate: (input) => {
          const forged = structuredClone(input.cp52ReportInput);
          (forged.summary as { exactTeamCount: number }).exactTeamCount = 2;
          input.cp52ReportInput = forged;
          return forged;
        },
      },
      {
        label: "CP52 authority",
        reportPath: NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
        mutate: (input) => {
          const forged = structuredClone(input.cp52ReportInput);
          (
            forged as unknown as { supportsEquipmentRecommendations: boolean }
          ).supportsEquipmentRecommendations = true;
          input.cp52ReportInput = forged;
          return forged;
        },
      },
    ];
    for (const { label, reportPath, mutate } of cases) {
      const tampered = fixture();
      const forged = mutate(tampered);
      replaceJsonSource(tampered, reportPath, forged);
      expect(
        () => buildNoelleHexereiPartialEquipmentCompositionReport(tampered),
        label,
      ).toThrow();
    }
  });

  it("rejects every resealed CP52 binding-authority ledger mutation at CP53's own semantic gate", () => {
    const canonicalCp51 =
      authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
        baseInput.cp51ReportInput,
        baseInput.cp51Input,
      );
    const cp52Authentication =
      authenticateNoelleHexereiWeaponTeamSourceBindingReport(
        baseInput.cp52ReportInput,
        baseInput.cp52Input,
      );
    expect(cp52Authentication.authenticated).toBe(true);
    if (!cp52Authentication.authenticated) return;
    const canonicalCp52 = cp52Authentication.canonicalReport;
    expect(() =>
      assertNoelleHexereiPartialEquipmentUpstreamSemanticBoundaries(
        canonicalCp51,
        canonicalCp52,
      ),
    ).not.toThrow();

    const mutations: Array<[string, unknown]> = [
      ["applicabilityClassification", "universal-applicability"],
      ["scope", "all-teams"],
      ["exactTeamRepositoryRecordId", "forged:team"],
      ["characterId", "xiao"],
      ["weaponId", "whiteblind"],
      ["sourceCondition", "Any Hexerei-like team."],
      ["sourceSectionHeading", "Teams > All Teams"],
      ["sourceAuthoredCondition", false],
      ["sourceAuthoredTeamSectionClassification", false],
      ["sourceAuthoredCrossRecordJoin", true],
      ["guideFactoryAuthoredCrossRecordJoin", false],
      ["bindingMethod", "free-form-English-inference"],
      ["arbitraryEnglishParsingAllowed", true],
      ["teamAssignmentAuthoredBySource", true],
      ["equipmentAssignmentCreated", true],
      ["selectionExecuted", true],
      ["rankDerived", true],
      ["derivedEquipmentRecommendationCreated", true],
      ["validationTargetCreated", false],
    ];
    expect(mutations).toHaveLength(19);
    for (const [field, forgedValue] of mutations) {
      const altered = structuredClone(canonicalCp52);
      const binding = altered.binding as unknown as Record<string, unknown>;
      expect(binding[field], field).not.toEqual(forgedValue);
      binding[field] = forgedValue;
      binding.bindingSha256 = bindingAuthorityHash(binding);
      expect(
        () =>
          assertNoelleHexereiPartialEquipmentUpstreamSemanticBoundaries(
            canonicalCp51,
            altered,
          ),
        field,
      ).toThrow(/CP52 binding authority ledger drifted/);
    }

    const alteredHashOnly = structuredClone(canonicalCp52);
    (
      alteredHashOnly.binding as unknown as Record<string, unknown>
    ).bindingSha256 = "0".repeat(64);
    expect(() =>
      assertNoelleHexereiPartialEquipmentUpstreamSemanticBoundaries(
        canonicalCp51,
        alteredHashOnly,
      ),
    ).toThrow(/CP52 binding authority ledger drifted/);
  });

  it("rejects resealed roster, profile, binding, weapon, artifact, stat, and provenance output drift", () => {
    const mutations: Array<{
      label: string;
      mutate: (candidate: MutableCandidate) => void;
    }> = [
      {
        label: "roster",
        mutate: (candidate) => {
          candidate.team.orderedCharacterIds[3] = "gorou";
        },
      },
      {
        label: "profile",
        mutate: (candidate) => {
          candidate.artifactProfile.profileId = "forged-profile";
        },
      },
      {
        label: "binding",
        mutate: (candidate) => {
          candidate.weaponOption.applicabilityBinding.bindingMethod =
            "forged-binding";
        },
      },
      {
        label: "weapon",
        mutate: (candidate) => {
          candidate.weaponOption.sourceObservation.weaponId = "whiteblind";
        },
      },
      {
        label: "artifact",
        mutate: (candidate) => {
          candidate.artifactProfile.artifactSet.set.setId = "maiden_beloved";
        },
      },
      {
        label: "stat",
        mutate: (candidate) => {
          candidate.artifactProfile.mainStats.sands.options[0]!.statIds = [
            "er",
          ];
        },
      },
      {
        label: "provenance",
        mutate: (candidate) => {
          candidate.artifactProfile.sourceRecordSha256 = "0".repeat(64);
        },
      },
    ];
    for (const { label, mutate } of mutations) {
      const tampered = structuredClone(report);
      const candidate = tampered.candidates[0] as unknown as MutableCandidate;
      mutate(candidate);
      candidate.candidateSha256 = candidateHash(candidate);
      expect(
        authenticateNoelleHexereiPartialEquipmentCompositionReport(
          tampered,
          fixture(),
        ),
        label,
      ).toMatchObject({
        authenticated: false,
        reason: "serialized-report-mismatch",
      });
    }
  });

  it("AST-authenticates the exact CP53 core/CLI local value-import closure", () => {
    const declared = new Set(NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS);
    const expected = new Map<string, string[]>([
      [
        NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CORE_RELATIVE_PATH,
        [
          "scripts/guide-factory/src/io.ts",
          "scripts/guide-factory/src/noelleHexereiWeaponTeamSourceBinding.ts",
          "scripts/guide-factory/src/noelleInvestmentArtifactProfileComputationAdmission.ts",
          "scripts/guide-factory/src/noelleSourceLocalHighInvestmentSlice.ts",
          "scripts/guide-factory/src/noelleSourceLocalLowerInvestmentSlice.ts",
          "scripts/guide-factory/src/paths.ts",
        ],
      ],
      [
        NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_CLI_RELATIVE_PATH,
        [
          "scripts/guide-factory/src/assemble-noelle-hexerei-weapon-team-source-binding.ts",
          "scripts/guide-factory/src/assemble-noelle-investment-artifact-profile-computation-admission.ts",
          "scripts/guide-factory/src/io.ts",
          "scripts/guide-factory/src/noelleHexereiPartialEquipmentComposition.ts",
          "scripts/guide-factory/src/paths.ts",
        ],
      ],
    ]);
    expect(declared.size).toBe(29);
    for (const [sourcePath, exactImports] of expected) {
      const sourceFile = ts.createSourceFile(
        sourcePath,
        requiredSourceFile(baseInput, sourcePath).text,
        ts.ScriptTarget.Latest,
        true,
      );
      const imports = runtimeStaticModuleSpecifiers(sourceFile)
        .flatMap((specifier) => {
          const resolved = resolveFirstPartyModulePath(sourcePath, specifier);
          return resolved ? [resolved] : [];
        })
        .sort(compareText);
      expect(imports).toEqual(exactImports);
      expect(imports.every((importedPath) => declared.has(importedPath))).toBe(true);
    }
  });

  it("rejects serialized output tampering after valid canonical inputs", () => {
    const tampered = structuredClone(report);
    (tampered.summary as { completeBuildCount: number }).completeBuildCount = 1;
    expect(
      authenticateNoelleHexereiPartialEquipmentCompositionReport(
        tampered,
        fixture(),
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport(
        tampered,
        fixture(),
      ),
    ).toThrow(/serialized-report-mismatch/);
  });
});

type MutableCandidate = {
  candidateSha256: string;
  team: { orderedCharacterIds: string[] };
  artifactProfile: {
    profileId: string;
    sourceRecordSha256: string;
    artifactSet: { set: { setId: string } };
    mainStats: {
      sands: { options: Array<{ statIds: string[] }> };
    };
  };
  weaponOption: {
    applicabilityBinding: { bindingMethod: string };
    sourceObservation: { weaponId: string };
  };
};

function fixture(): NoelleHexereiPartialEquipmentCompositionInput {
  return structuredClone(baseInput);
}

function requiredSourceFile(
  input: NoelleHexereiPartialEquipmentCompositionInput,
  sourcePath: string,
) {
  const matches = input.sourceFiles.filter(
    ({ path: candidatePath }) => candidatePath === sourcePath,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function replaceOuterSourceText(
  input: NoelleHexereiPartialEquipmentCompositionInput,
  sourcePath: string,
  text: string,
): void {
  requiredSourceFile(input, sourcePath).text = text;
  const generated = input.generatedFrom.filter(
    ({ path: candidatePath }) => candidatePath === sourcePath,
  );
  expect(generated).toHaveLength(1);
  generated[0]!.sha256 = sha256Text(text);
}

function replaceJsonSource(
  input: NoelleHexereiPartialEquipmentCompositionInput,
  sourcePath: string,
  value: unknown,
): void {
  replaceOuterSourceText(input, sourcePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertProjectedClosure(
  projectedSources: readonly { path: string; text: string }[],
  projectedGeneratedFrom: readonly { path: string; sha256: string }[],
  expectedSourcePaths: readonly string[],
  expectedGeneratedPaths: readonly string[],
): void {
  expect(projectedSources.map(({ path: sourcePath }) => sourcePath)).toEqual([
    ...expectedSourcePaths,
  ]);
  expect(
    projectedGeneratedFrom.map(({ path: sourcePath }) => sourcePath),
  ).toEqual([...expectedGeneratedPaths]);
  for (const projected of projectedSources) {
    expect(projected.text).toBe(requiredSourceFile(baseInput, projected.path).text);
  }
  for (const projected of projectedGeneratedFrom) {
    const outer = baseInput.generatedFrom.find(
      ({ path: sourcePath }) => sourcePath === projected.path,
    );
    expect(projected.sha256).toBe(outer?.sha256);
  }
}

function mainStatProjection(
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
) {
  return {
    sands: candidate.artifactProfile.mainStats.sands.options.map(
      ({ statIds }) => statIds,
    ),
    goblet: candidate.artifactProfile.mainStats.goblet.options.map(
      ({ statIds }) => statIds,
    ),
    circlet: candidate.artifactProfile.mainStats.circlet.options.map(
      ({ statIds }) => statIds,
    ),
  };
}

function substatProjection(
  candidate: NoelleHexereiPartialEquipmentValidationCandidate,
): Array<[number, string[]]> {
  return candidate.artifactProfile.substatPriority.groups.map(
    ({ priority, statIds }) => [priority, statIds],
  );
}

function candidateHash(candidate: MutableCandidate): string {
  const { candidateSha256: _candidateSha256, ...withoutHash } = candidate;
  return sha256Text(stableJson(withoutHash));
}

function bindingAuthorityHash(binding: Record<string, unknown>): string {
  const { bindingSha256: _bindingSha256, ...authorityLedger } = binding;
  return sha256Text(stableJson(authorityLedger));
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
  const bareSpecifier = moduleSpecifier.split("?", 1)[0];
  let basePath: string;
  if (bareSpecifier.startsWith("@/")) {
    basePath = `src/${bareSpecifier.slice(2)}`;
  } else if (bareSpecifier.startsWith(".")) {
    basePath = path.posix.normalize(
      path.posix.join(path.posix.dirname(importerPath), bareSpecifier),
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
    const absolute = path.join(REPOSITORY_ROOT, candidate);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  if (!resolved) {
    throw new Error(
      `Could not resolve first-party import ${moduleSpecifier} from ${importerPath}.`,
    );
  }
  return resolved.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
