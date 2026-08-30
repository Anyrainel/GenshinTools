import { existsSync, statSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildNoelleHexereiWeaponTeamSourceBindingFromWorkspace,
  loadNoelleHexereiWeaponTeamSourceBindingInputFromWorkspace,
} from "../src/assemble-noelle-hexerei-weapon-team-source-binding";
import { sha256Text, stableJson } from "../src/io";
import {
  buildNoelleSourceLocalHighInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalHighInvestmentSliceInput,
} from "../src/noelleSourceLocalHighInvestmentSlice";
import {
  authenticateNoelleHexereiWeaponTeamSourceBindingReport,
  buildNoelleHexereiWeaponTeamSourceBindingReport,
  NOELLE_HEXEREI_EXACT_SOURCE_CONDITION,
  NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING,
  NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
  NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
  NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
  NOELLE_HEXEREI_MANUAL_INDEX_RELATIVE_PATH,
  NOELLE_HEXEREI_MANUAL_SNAPSHOT_RELATIVE_PATH,
  NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
  NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CLI_RELATIVE_PATH,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CORE_RELATIVE_PATH,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS,
  requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport,
  type NoelleHexereiWeaponTeamSourceBindingInput,
  type NoelleHexereiWeaponTeamSourceBindingReport,
} from "../src/noelleHexereiWeaponTeamSourceBinding";
import { REPOSITORY_ROOT } from "../src/paths";

const GEST_OCCURRENCE_ID =
  "kqm:character_guide:noelle-hexerei-gest-luna-viii:recommendation.weaponRecommendations[0].conditions";
const GEST_CONDITIONS_SHA256 =
  "f27375a8ce8833cc0326a17c94f52c71ed4f44a72868e15d087390b864e490cf";
const GEST_MANUAL_RECORD_SHA256 =
  "cc303b82e147a8220675f5e9865868273251e5c68cdad3f88b20a9cbddb73ff8";
const GEST_REPOSITORY_RECORD_SHA256 =
  "bd2d5011230d9348402402ea5b7bee8ec75d4ecd91f7895f6899ef8ffb20f2fe";
const TEAM_MANUAL_RECORD_SHA256 =
  "35c67b57276cafba29250e7416e8ab7efb3b49540b0609621e5a056e146ce9c7";
const TEAM_REPOSITORY_RECORD_SHA256 =
  "f797ff46aff29917c60d50e7e7ebc1abb2fc0dbdd1983752a90df20eb8c7aa79";

let baseInput: NoelleHexereiWeaponTeamSourceBindingInput;
let report: NoelleHexereiWeaponTeamSourceBindingReport;

beforeAll(async () => {
  [baseInput, report] = await Promise.all([
    loadNoelleHexereiWeaponTeamSourceBindingInputFromWorkspace(),
    buildNoelleHexereiWeaponTeamSourceBindingFromWorkspace(),
  ]);
}, 120_000);

describe("Noelle Hexerei weapon/team source binding", () => {
  it("builds deterministically from the exact 16-file and five-JSON boundary and self-authenticates", async () => {
    const rebuilt = buildNoelleHexereiWeaponTeamSourceBindingReport(fixture());
    const authentication =
      authenticateNoelleHexereiWeaponTeamSourceBindingReport(
        report,
        fixture(),
      );
    expect(authentication.authenticated).toBe(true);
    if (!authentication.authenticated) return;

    expect(stableJson(report)).toBe(stableJson(rebuilt));
    expect(stableJson(authentication.canonicalReport)).toBe(stableJson(report));
    expect(
      stableJson(
        requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport(
          report,
          fixture(),
        ),
      ),
    ).toBe(stableJson(report));
    expect(
      stableJson(await buildNoelleHexereiWeaponTeamSourceBindingFromWorkspace()),
    ).toBe(stableJson(report));
    expect(report.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromText: true,
      jsonByteAndParsedObjectParity: true,
      sourceFileCount: 16,
      generatedFromCount: 16,
      jsonInputCount: 5,
    });
    expect(baseInput.sourceFiles.map(({ path: sourcePath }) => sourcePath)).toEqual(
      [...NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS],
    );
    expect(baseInput.generatedFrom.map(({ path: sourcePath }) => sourcePath)).toEqual(
      [...NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS],
    );
    expect(report.generatedFrom).toEqual(baseInput.generatedFrom);
    expect(new Set(report.generatedFrom.map(({ path: sourcePath }) => sourcePath)).size).toBe(
      16,
    );
    for (const sourceFile of baseInput.sourceFiles) {
      const generated = baseInput.generatedFrom.find(
        ({ path: sourcePath }) => sourcePath === sourceFile.path,
      );
      expect(generated?.sha256).toBe(sha256Text(sourceFile.text));
    }
  }, 120_000);

  it("independently proves exact Gest item parity and exact normalized team/sourceRef parity", () => {
    const manualRecords = recordsOf(baseInput.manualSnapshotInput);
    const repositoryRecords = recordsOf(baseInput.repositoryInput);
    const gestManual = requiredRecord(
      manualRecords,
      "sourceRecordId",
      NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
    );
    const gestRepository = requiredRecord(
      repositoryRecords,
      "id",
      NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
    );
    const teamManual = requiredRecord(
      manualRecords,
      "sourceRecordId",
      NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
    );
    const teamRepository = requiredRecord(
      repositoryRecords,
      "id",
      NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
    );

    expect(stableJson(gestManual.recommendation)).toBe(
      stableJson((gestRepository.recommendations as unknown[])[0]),
    );
    expect(stableJson(manualTeamPayload(teamManual))).toBe(
      stableJson(repositoryTeamPayload(teamRepository)),
    );
    for (const [manual, repository] of [
      [gestManual, gestRepository],
      [teamManual, teamRepository],
    ] as const) {
      expect(repository.sourceRefs).toEqual([
        {
          sourceId: "kqm",
          sourceRecordId: manual.sourceRecordId,
          locator: manual.locator,
        },
      ]);
    }

    expect(report.sourceParityBoundary).toEqual({
      status: "exact",
      sourceId: "kqm",
      sourceUrl: "https://keqingmains.com/q/noelle-quickguide/",
      sourceVersion: "Luna VIII",
      sameSourceDocument: true,
      manualRecordCount: 2,
      consolidatedRecordCount: 2,
      records: [
        {
          sourceRecordId: NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
          repositoryRecordId: NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
          kind: "character_guide",
          manualRecordSha256: GEST_MANUAL_RECORD_SHA256,
          repositoryRecordSha256: GEST_REPOSITORY_RECORD_SHA256,
          payloadParity: "exact-normalized-consolidation",
          sourceRefParity: "exact",
          repositoryStatus: "candidate",
          promotionEligible: false,
        },
        {
          sourceRecordId: NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
          repositoryRecordId: NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
          kind: "team",
          manualRecordSha256: TEAM_MANUAL_RECORD_SHA256,
          repositoryRecordSha256: TEAM_REPOSITORY_RECORD_SHA256,
          payloadParity: "exact-normalized-consolidation",
          sourceRefParity: "exact",
          repositoryStatus: "candidate",
          promotionEligible: false,
        },
      ],
    });
    expect(sha256Text(stableJson(gestManual))).toBe(GEST_MANUAL_RECORD_SHA256);
    expect(sha256Text(stableJson(gestRepository))).toBe(
      GEST_REPOSITORY_RECORD_SHA256,
    );
    expect(sha256Text(stableJson(teamManual))).toBe(TEAM_MANUAL_RECORD_SHA256);
    expect(sha256Text(stableJson(teamRepository))).toBe(
      TEAM_REPOSITORY_RECORD_SHA256,
    );
  });

  it("keeps the upstream Gest occurrence held out and authors exactly one local allowlist binding", () => {
    const occurrences = baseInput.highSliceReportInput.holdoutOccurrences.filter(
      ({ occurrenceId }) => occurrenceId === GEST_OCCURRENCE_ID,
    );
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      occurrenceId: GEST_OCCURRENCE_ID,
      sourceRecordId: NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
      repositoryRecordId: NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
      manualClaimPath: "recommendation.weaponRecommendations[0].conditions",
      repositoryPath:
        "recommendations[0].weaponRecommendations[0].conditions",
      claimAxis: "weapon-recommendation",
      conditions: [NOELLE_HEXEREI_EXACT_SOURCE_CONDITION],
      conditionsSha256: GEST_CONDITIONS_SHA256,
      structuralEnergyDimension: "not-structural-er",
      repositoryParity: "exact",
      sliceDisposition: "holdout",
      consumedBySlice: false,
      bindingAuthoredBySlice: false,
      energyClassificationAuthoredBySlice: false,
    });
    expect(report.upstreamBoundary).toMatchObject({
      status: "accepted",
      durableReportPath: NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
      freshlyAuthenticated: true,
      upstreamInputCount: 13,
      occurrenceId: GEST_OCCURRENCE_ID,
      conditionsSha256: GEST_CONDITIONS_SHA256,
      occurrenceDisposition: "holdout",
      consumedByUpstreamSlice: false,
      bindingAuthoredByUpstreamSlice: false,
      energyClassificationAuthoredByUpstreamSlice: false,
      structuralEnergyDimension: "not-structural-er",
    });
    expect(report.upstreamBoundary.durableReportFileSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(report.upstreamBoundary.durableReportCanonicalObjectSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );

    const { bindingSha256, ...bindingWithoutHash } = report.binding;
    expect(bindingWithoutHash).toEqual({
      applicabilityClassification:
        "applicable-under-source-section-classification",
      scope: "exact-team-only",
      exactTeamRepositoryRecordId: NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
      characterId: "noelle",
      weaponId: "gest_of_the_mighty_wolf",
      sourceCondition: NOELLE_HEXEREI_EXACT_SOURCE_CONDITION,
      sourceSectionHeading: NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING,
      sourceAuthoredCondition: true,
      sourceAuthoredTeamSectionClassification: true,
      sourceAuthoredCrossRecordJoin: false,
      guideFactoryAuthoredCrossRecordJoin: true,
      bindingMethod: "cp52-exact-condition-and-heading-allowlist",
      arbitraryEnglishParsingAllowed: false,
      teamAssignmentAuthoredBySource: false,
      equipmentAssignmentCreated: false,
      selectionExecuted: false,
      rankDerived: false,
      derivedEquipmentRecommendationCreated: false,
      validationTargetCreated: true,
    });
    expect(bindingSha256).toBe(sha256Text(stableJson(bindingWithoutHash)));
    expect(report.summary.localBindingCount).toBe(1);
  });

  it("preserves Gest and the exact team as an unassigned validation target with no refinement", () => {
    expect(report.weaponObservation).toEqual({
      sourceRecordId: NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID,
      repositoryRecordId: NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
      recommendationId: "hexerei-gest",
      weaponId: "gest_of_the_mighty_wolf",
      weaponOrdering: "unranked",
      grouping: "single",
      sourceClassification: "conditional",
      sourceConditions: [NOELLE_HEXEREI_EXACT_SOURCE_CONDITION],
      sourceConditionStatus: "guarded-source-observation",
      refinement: null,
      refinementStatus: "missing-not-zero",
      quantitativePerformanceStatus: "missing-not-zero",
    });
    expect(report.exactTeam).toEqual({
      sourceRecordId: NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
      repositoryRecordId: NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
      locatorHeading: NOELLE_HEXEREI_EXACT_TEAM_LOCATOR_HEADING,
      label: "Noelle — Durin — Nicole — Xilonen",
      intent: "example",
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      orderedCharacterIds: ["noelle", "durin", "nicole", "xilonen"],
      noelleSourceMemberWeaponRecommendations: [],
      noelleSourceMemberWeaponRecommendationCount: 0,
      noelleConsolidatedSelectedWeapon: null,
      teamMemberWeaponAndRefinementStatus: "missing-not-zero",
    });
    const sourceTeam = requiredRecord(
      recordsOf(baseInput.manualSnapshotInput),
      "sourceRecordId",
      NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
    );
    const noelleMembers = (sourceTeam.members as Array<Record<string, unknown>>).filter(
      ({ characterId }) => characterId === "noelle",
    );
    expect(noelleMembers).toHaveLength(1);
    expect(noelleMembers[0]?.weaponRecommendations).toEqual([]);
    expect(report.binding).toMatchObject({
      teamAssignmentAuthoredBySource: false,
      equipmentAssignmentCreated: false,
      selectionExecuted: false,
      rankDerived: false,
      derivedEquipmentRecommendationCreated: false,
      validationTargetCreated: true,
    });
  });

  it("emits zero candidate, build, recommendation, rank, generator, optimizer, damage, replay, and ER operations", () => {
    expect(report.summary).toEqual({
      sourceRecordCount: 2,
      upstreamHoldoutOccurrenceCount: 1,
      exactTeamCount: 1,
      localBindingCount: 1,
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
    });
    expect(report).toMatchObject({
      validationStatus: "authenticated-validation-target",
      publicationStatus: "withheld-unreviewed-source-binding",
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsIdealStatAllocation: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      candidateGenerationExecuted: false,
      recommendationCompositionExecuted: false,
      generatorExecuted: false,
      autoTuneExecuted: false,
      optimizerExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      weaponAssignmentExecuted: false,
      artifactAssignmentExecuted: false,
      equipmentAssignmentExecuted: false,
      selectionExecuted: false,
      rankingExecuted: false,
      damageComputationExecuted: false,
      rotationReplayExecuted: false,
      energyRecoveryComputationExecuted: false,
      idealStatAllocationExecuted: false,
    });
  });

  it("rejects missing, duplicate, raw-hash-mismatched, and malformed outer inputs", () => {
    const missingSource = fixture();
    missingSource.sourceFiles = missingSource.sourceFiles.slice(1);
    expect(() => buildNoelleHexereiWeaponTeamSourceBindingReport(missingSource)).toThrow(
      /path closure drifted/,
    );

    const duplicateSource = fixture();
    duplicateSource.sourceFiles = [
      ...duplicateSource.sourceFiles,
      structuredClone(duplicateSource.sourceFiles[0]!),
    ];
    expect(() =>
      buildNoelleHexereiWeaponTeamSourceBindingReport(duplicateSource),
    ).toThrow(/path closure drifted/);

    const missingGenerated = fixture();
    missingGenerated.generatedFrom = missingGenerated.generatedFrom.slice(1);
    expect(() =>
      buildNoelleHexereiWeaponTeamSourceBindingReport(missingGenerated),
    ).toThrow(/path closure drifted/);

    const duplicateGenerated = fixture();
    duplicateGenerated.generatedFrom = [
      ...duplicateGenerated.generatedFrom,
      structuredClone(duplicateGenerated.generatedFrom[0]!),
    ];
    expect(() =>
      buildNoelleHexereiWeaponTeamSourceBindingReport(duplicateGenerated),
    ).toThrow(/path closure drifted/);

    const hashMismatch = fixture();
    requiredSourceFile(
      hashMismatch,
      NOELLE_HEXEREI_MANUAL_INDEX_RELATIVE_PATH,
    ).text += "\n";
    expect(() => buildNoelleHexereiWeaponTeamSourceBindingReport(hashMismatch)).toThrow(
      /source\/hash authentication drifted/,
    );

    const malformed = fixture();
    replaceOuterSourceText(
      malformed,
      NOELLE_HEXEREI_MANUAL_INDEX_RELATIVE_PATH,
      "{",
    );
    expect(() => buildNoelleHexereiWeaponTeamSourceBindingReport(malformed)).toThrow(
      /JSON input is invalid/,
    );
  });

  it("rejects report and parsed-input split-brain fixtures", () => {
    const parsedSplit = fixture();
    const repository = parsedSplit.repositoryInput as { schemaVersion: number };
    repository.schemaVersion = 999;
    expect(() => buildNoelleHexereiWeaponTeamSourceBindingReport(parsedSplit)).toThrow(
      /parsed JSON input disagrees/,
    );

    const reportSplit = fixture();
    reportSplit.highSliceReportInput = {
      ...reportSplit.highSliceReportInput,
      issues: [
        ...reportSplit.highSliceReportInput.issues,
        {
          code: "test-split-brain",
          path: "test",
          message: "test",
        },
      ],
    };
    expect(() => buildNoelleHexereiWeaponTeamSourceBindingReport(reportSplit)).toThrow(
      /parsed JSON input disagrees/,
    );
  });

  it("rejects independently rebuilt source condition, team heading, roster, and Gest item drift", () => {
    const cases: Array<{
      label: string;
      mutate: (
        manual: Array<Record<string, unknown>>,
        repository: Array<Record<string, unknown>>,
      ) => void;
    }> = [
      {
        label: "condition",
        mutate: (manual, repository) => {
          gestItem(manual, "sourceRecordId", NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID)
            .conditions = ["Noelle is played in any two-Hexerei-character team."];
          gestItem(repository, "id", NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID)
            .conditions = ["Noelle is played in any two-Hexerei-character team."];
        },
      },
      {
        label: "team heading",
        mutate: (manual, repository) => {
          const source = requiredRecord(
            manual,
            "sourceRecordId",
            NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
          );
          (source.locator as Record<string, unknown>).heading =
            "Teams > Hexerei Teams > Other Example";
          const consolidated = requiredRecord(
            repository,
            "id",
            NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
          );
          const sourceRef = (consolidated.sourceRefs as Array<Record<string, unknown>>)[0]!;
          (sourceRef.locator as Record<string, unknown>).heading =
            "Teams > Hexerei Teams > Other Example";
        },
      },
      {
        label: "roster",
        mutate: (manual, repository) => {
          const source = requiredRecord(
            manual,
            "sourceRecordId",
            NOELLE_HEXEREI_TEAM_SOURCE_RECORD_ID,
          );
          (source.members as Array<Record<string, unknown>>)[3]!.characterId =
            "gorou";
          const consolidated = requiredRecord(
            repository,
            "id",
            NOELLE_HEXEREI_TEAM_REPOSITORY_RECORD_ID,
          );
          (consolidated.members as Array<Record<string, unknown>>)[3]!.characterId =
            "gorou";
        },
      },
      {
        label: "Gest item",
        mutate: (manual, repository) => {
          gestItem(manual, "sourceRecordId", NOELLE_HEXEREI_GEST_SOURCE_RECORD_ID)
            .weaponIds = ["whiteblind"];
          gestItem(repository, "id", NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID)
            .weaponIds = ["whiteblind"];
        },
      },
    ];

    for (const { label, mutate } of cases) {
      const tampered = fixture();
      mutateAndResealSourcePair(tampered, mutate);
      expect(
        () => buildNoelleHexereiWeaponTeamSourceBindingReport(tampered),
        label,
      ).toThrow();
    }
  });

  it("rejects repository-only consolidation parity drift", () => {
    const tampered = fixture();
    mutateAndResealSourcePair(
      tampered,
      (_manual, repository) => {
        const gest = requiredRecord(
          repository,
          "id",
          NOELLE_HEXEREI_GEST_REPOSITORY_RECORD_ID,
        );
        (gest.sourceRefs as Array<Record<string, unknown>>)[0]!.sourceId =
          "other-source";
      },
    );
    expect(() => buildNoelleHexereiWeaponTeamSourceBindingReport(tampered)).toThrow();
  });

  it("rejects a hash-resealed forged upstream report", () => {
    const tampered = fixture();
    const upstream = structuredClone(tampered.highSliceReportInput);
    (upstream as unknown as { optimizerExecuted: boolean }).optimizerExecuted =
      true;
    tampered.highSliceReportInput = upstream;
    replaceJsonSource(
      tampered,
      NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
      upstream,
    );
    expect(() => buildNoelleHexereiWeaponTeamSourceBindingReport(tampered)).toThrow(
      /failed fresh authentication/,
    );
  });

  it("AST-authenticates the exact CP52 core and CLI local value-import closure", () => {
    const declared = new Set(NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS);
    const expected = new Map<string, string[]>([
      [
        NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CORE_RELATIVE_PATH,
        [
          "scripts/guide-factory/src/io.ts",
          "scripts/guide-factory/src/noelleSourceLocalHighInvestmentSlice.ts",
          "scripts/guide-factory/src/paths.ts",
          "scripts/guide-factory/src/schemas.ts",
        ],
      ],
      [
        NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_CLI_RELATIVE_PATH,
        [
          "scripts/guide-factory/src/io.ts",
          "scripts/guide-factory/src/noelleHexereiWeaponTeamSourceBinding.ts",
          "scripts/guide-factory/src/paths.ts",
        ],
      ],
    ]);
    expect(declared.size).toBe(16);
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

  it("rejects serialized report tampering after a valid canonical rebuild", () => {
    const tampered = structuredClone(report) as NoelleHexereiWeaponTeamSourceBindingReport & {
      binding: { equipmentAssignmentCreated: boolean };
    };
    (
      tampered.binding as unknown as { equipmentAssignmentCreated: boolean }
    ).equipmentAssignmentCreated = true;
    expect(
      authenticateNoelleHexereiWeaponTeamSourceBindingReport(
        tampered,
        fixture(),
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport(
        tampered,
        fixture(),
      ),
    ).toThrow(/serialized-report-mismatch/);
  });
});

function fixture(): NoelleHexereiWeaponTeamSourceBindingInput {
  return structuredClone(baseInput);
}

function recordsOf(value: unknown): Array<Record<string, unknown>> {
  return (value as { records: Array<Record<string, unknown>> }).records;
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

function gestItem(
  records: Array<Record<string, unknown>>,
  key: string,
  value: string,
): Record<string, unknown> {
  const record = requiredRecord(records, key, value);
  const recommendation =
    key === "sourceRecordId"
      ? (record.recommendation as Record<string, unknown>)
      : ((record.recommendations as Array<Record<string, unknown>>)[0] as Record<
          string,
          unknown
        >);
  return (recommendation.weaponRecommendations as Array<Record<string, unknown>>)[0]!;
}

function manualTeamPayload(manual: Record<string, unknown>) {
  return {
    label: manual.label,
    intent: manual.intent,
    exhaustiveness: manual.exhaustiveness,
    rankingClaim: manual.rankingClaim,
    members: (manual.members as Array<Record<string, unknown>>).map((member) => {
      expect(member.weaponRecommendations).toEqual([]);
      expect(member.artifactRecommendations).toEqual([]);
      expect(member.erTargets).toEqual([]);
      return {
        characterId: member.characterId,
        investment: { status: "unspecified" },
        selectedArtifact: null,
        selectedWeapon: null,
      };
    }),
    rotations: manual.rotations,
    damagePlans: [],
  };
}

function repositoryTeamPayload(repository: Record<string, unknown>) {
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

function requiredSourceFile(
  input: NoelleHexereiWeaponTeamSourceBindingInput,
  sourcePath: string,
) {
  const matches = input.sourceFiles.filter(
    ({ path: candidatePath }) => candidatePath === sourcePath,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function replaceOuterSourceText(
  input: NoelleHexereiWeaponTeamSourceBindingInput,
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
  input: NoelleHexereiWeaponTeamSourceBindingInput,
  sourcePath: string,
  value: unknown,
): void {
  replaceOuterSourceText(input, sourcePath, `${JSON.stringify(value, null, 2)}\n`);
}

function mutateAndResealSourcePair(
  input: NoelleHexereiWeaponTeamSourceBindingInput,
  mutate: (
    manual: Array<Record<string, unknown>>,
    repository: Array<Record<string, unknown>>,
  ) => void,
): void {
  const manual = recordsOf(input.manualSnapshotInput);
  const repository = recordsOf(input.repositoryInput);
  mutate(manual, repository);
  replaceJsonSource(
    input,
    NOELLE_HEXEREI_MANUAL_SNAPSHOT_RELATIVE_PATH,
    input.manualSnapshotInput,
  );
  replaceJsonSource(
    input,
    NOELLE_HEXEREI_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
    input.repositoryInput,
  );
  const highSlice = buildNoelleSourceLocalHighInvestmentSliceReport(
    buildHighSliceInput(input),
  );
  input.highSliceReportInput = highSlice;
  replaceJsonSource(
    input,
    NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
    highSlice,
  );
}

function buildHighSliceInput(
  input: NoelleHexereiWeaponTeamSourceBindingInput,
): BuildNoelleSourceLocalHighInvestmentSliceInput {
  const sourceByPath = new Map(
    input.sourceFiles.map((entry) => [entry.path, entry] as const),
  );
  const generatedByPath = new Map(
    input.generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  return {
    repositoryInput: input.repositoryInput,
    manualSnapshotInput: input.manualSnapshotInput,
    manualIndexInput: input.manualIndexInput,
    sourceRegistryInput: input.sourceRegistryInput,
    sourceFiles: NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
      (sourcePath) => {
        const entry = sourceByPath.get(sourcePath);
        if (!entry) throw new Error(`Missing test source ${sourcePath}.`);
        return entry;
      },
    ),
    generatedFrom: NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS.map(
      (sourcePath) => {
        const entry = generatedByPath.get(sourcePath);
        if (!entry) throw new Error(`Missing test generatedFrom ${sourcePath}.`);
        return entry;
      },
    ),
  };
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
