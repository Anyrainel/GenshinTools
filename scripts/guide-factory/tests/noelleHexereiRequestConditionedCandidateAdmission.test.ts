import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

import {
  formatNoelleHexereiRequestConditionedCandidateAdmissionSummary,
  loadNoelleHexereiRequestConditionedCandidateAdmissionInputFromWorkspace,
} from "../src/assemble-noelle-hexerei-request-conditioned-candidate-admission";
import { stableJson } from "../src/io";
import {
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS,
  NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
  type NoelleHexereiContextRobustnessRow,
  type NoelleHexereiLocalStatPriorityDiagnosticReport,
  type NoelleHexereiSourceOrderDiagnostic,
} from "../src/noelleHexereiLocalStatPriorityDiagnostic";
import {
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
  type NoelleHexereiPartialEquipmentValidationCandidate,
} from "../src/noelleHexereiPartialEquipmentComposition";
import {
  authenticateNoelleHexereiRequestConditionedCandidateAdmissionReport,
  buildNoelleHexereiRequestConditionedCandidateAdmissionReport,
  NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CLI_RELATIVE_PATH,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CORE_RELATIVE_PATH,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_SOURCE_FILE_PATHS,
  resolveNoelleHexereiCandidateForEnteredRequest,
  type NoelleHexereiEnteredRequest,
  type NoelleHexereiLocalRelationAdmission,
  type NoelleHexereiRelationDiagnosticReference,
  type NoelleHexereiRelationRobustnessReference,
  type NoelleHexereiRequestConditionedCandidateAdmissionInput,
  type NoelleHexereiRequestConditionedCandidateAdmissionReport,
} from "../src/noelleHexereiRequestConditionedCandidateAdmission";
import { REPOSITORY_ROOT } from "../src/paths";

const LONG_TIMEOUT = 180_000;

const EXPECTED_REQUESTS = [
  {
    sequence: 0,
    requestId: "c0-q9",
    witnessId: "c0-q9",
    characterId: "noelle",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 1, burst: 9 },
    profileId: "noelle-lower-investment-artifact-profile-v1",
  },
  {
    sequence: 1,
    requestId: "c5-q9",
    witnessId: "c5-q9",
    characterId: "noelle",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 12 },
    profileId: "noelle-lower-investment-artifact-profile-v1",
  },
  {
    sequence: 2,
    requestId: "c0-q10",
    witnessId: "c0-q10",
    characterId: "noelle",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 1, burst: 10 },
    profileId: "noelle-high-investment-artifact-profile-v1",
  },
  {
    sequence: 3,
    requestId: "c5-q10",
    witnessId: "c5-q10",
    characterId: "noelle",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 13 },
    profileId: "noelle-high-investment-artifact-profile-v1",
  },
  {
    sequence: 4,
    requestId: "c6-q9",
    witnessId: "c6-q9",
    characterId: "noelle",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 12 },
    profileId: "noelle-high-investment-artifact-profile-v1",
  },
  {
    sequence: 5,
    requestId: "c6-q10",
    witnessId: "c6-q10",
    characterId: "noelle",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 13 },
    profileId: "noelle-high-investment-artifact-profile-v1",
  },
] as const;

type ExpectedRelationResult = {
  relationId: string;
  higherStat: "cr" | "cd" | "atk%" | "def%";
  lowerStat: "cr" | "cd" | "atk%" | "def%";
  aligned: number;
  counterexample: number;
  inconclusive: number;
  status:
    | "admitted-unanimous-across-all-16-tested-contexts"
    | "withheld-counterexample";
};

const EXPECTED_RELATION_RESULTS: Record<string, readonly ExpectedRelationResult[]> = {
  "c0-q9": [
    relationResult("p1-cr-over-p2-atk", "cr", "atk%", 16, 0),
    relationResult("p1-cd-over-p2-atk", "cd", "atk%", 16, 0),
    relationResult("p2-atk-over-p3-def", "atk%", "def%", 16, 0),
  ],
  "c5-q9": [
    relationResult("p1-cr-over-p2-atk", "cr", "atk%", 16, 0),
    relationResult("p1-cd-over-p2-atk", "cd", "atk%", 16, 0),
    relationResult("p2-atk-over-p3-def", "atk%", "def%", 0, 16),
  ],
  "c0-q10": [
    relationResult("p1-cr-over-p2-def", "cr", "def%", 16, 0),
    relationResult("p1-cd-over-p2-def", "cd", "def%", 16, 0),
    relationResult("p2-def-over-p3-atk", "def%", "atk%", 0, 16),
  ],
  "c5-q10": [
    relationResult("p1-cr-over-p2-def", "cr", "def%", 16, 0),
    relationResult("p1-cd-over-p2-def", "cd", "def%", 16, 0),
    relationResult("p2-def-over-p3-atk", "def%", "atk%", 16, 0),
  ],
  "c6-q9": [
    relationResult("p1-cr-over-p2-def", "cr", "def%", 15, 1),
    relationResult("p1-cd-over-p2-def", "cd", "def%", 11, 5),
    relationResult("p2-def-over-p3-atk", "def%", "atk%", 16, 0),
  ],
  "c6-q10": [
    relationResult("p1-cr-over-p2-def", "cr", "def%", 15, 1),
    relationResult("p1-cd-over-p2-def", "cd", "def%", 9, 7),
    relationResult("p2-def-over-p3-atk", "def%", "atk%", 16, 0),
  ],
};

let baseInput: NoelleHexereiRequestConditionedCandidateAdmissionInput;
let durableReport: NoelleHexereiRequestConditionedCandidateAdmissionReport;
let report: NoelleHexereiRequestConditionedCandidateAdmissionReport;
let cp56Report: NoelleHexereiLocalStatPriorityDiagnosticReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadNoelleHexereiRequestConditionedCandidateAdmissionInputFromWorkspace(),
    readJsonReport<NoelleHexereiRequestConditionedCandidateAdmissionReport>(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH,
    ),
  ]);
  const authentication =
    await authenticateNoelleHexereiRequestConditionedCandidateAdmissionReport(
      durableReport,
      baseInput,
    );
  if (!authentication.authenticated) {
    throw new Error(
      "Expected the durable CP57 report to authenticate: " +
        authentication.message,
    );
  }
  report = authentication.canonicalReport;
  cp56Report = baseInput.cp56ReportInput;
}, LONG_TIMEOUT);

describe("Noelle Hexerei request-conditioned candidate admission", () => {
  it("fresh-authenticates one deterministic durable report", async () => {
    expect(stableJson(report)).toBe(stableJson(durableReport));
    await expect(
      readFile(
        NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH,
        "utf8",
      ),
    ).resolves.toBe(stableJson(report));
    expect(report).toMatchObject({
      schemaVersion: 1,
      reportType: "noelle-hexerei-request-conditioned-candidate-admission",
      classification:
        "authenticated-request-conditioned-partial-candidate-admission",
      validationStatus:
        "completed-six-request-fail-closed-relation-admission",
      publicationStatus: "withheld-unreviewed-partial-candidates",
    });
    expect(
      formatNoelleHexereiRequestConditionedCandidateAdmissionSummary(report),
    ).toBe(
      "Conditioned 6 Noelle partial candidates across 18 local relation gates; admitted/withheld/evidence: 12/6/288; selections/ER: 0/0.",
    );
  });

  it("authenticates the exact 119-path, 80-runtime, 15-JSON, two-binary closure", async () => {
    const expectedPaths = [
      ...new Set([
        ...NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
        NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
        NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CORE_RELATIVE_PATH,
        NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CLI_RELATIVE_PATH,
      ]),
    ].sort(compareText);
    expect(expectedPaths).toHaveLength(119);
    expect(NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS)
      .toEqual(expectedPaths);
    expect(NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_SOURCE_FILE_PATHS)
      .toEqual(expectedPaths);
    expect(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
    ).toHaveLength(80);
    expect(expectedPaths.filter((sourcePath) => sourcePath.endsWith(".json")))
      .toHaveLength(15);
    expect(expectedPaths.filter((sourcePath) => sourcePath.endsWith(".json.gz")))
      .toHaveLength(2);
    expect(baseInput.sourceFiles.map(({ path: sourcePath }) => sourcePath))
      .toEqual(expectedPaths);
    expect(baseInput.generatedFrom.map(({ path: sourcePath }) => sourcePath))
      .toEqual(expectedPaths);
    expect(report.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      allSourceBytesMatchWorkspaceFiles: true,
      cp53ReportByteAndParsedObjectParity: true,
      cp56ReportByteAndParsedObjectParity: true,
      exactCp53InputProjection: true,
      exactCp56InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: 119,
      generatedFromCount: 119,
      runtimeInputPathCount: 80,
      jsonInputCount: 15,
      binaryRuntimeInputCount: 2,
    });
    expect(baseInput.technicalRequest).toEqual(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
    );
    expect(baseInput.cp53Input.sourceFiles.map(({ path: sourcePath }) => sourcePath))
      .toEqual(NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS);
    expect(baseInput.cp56Input.sourceFiles.map(({ path: sourcePath }) => sourcePath))
      .toEqual(NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS);

    await Promise.all(
      baseInput.sourceFiles.map(async (source) => {
        const bytes = Buffer.from(source.bytesBase64, "base64");
        const generated = baseInput.generatedFrom.find(
          ({ path: sourcePath }) => sourcePath === source.path,
        );
        expect(bytes.toString("base64"), source.path).toBe(source.bytesBase64);
        expect(generated?.sha256, source.path).toBe(sha256(bytes));
        await expect(
          readFile(path.join(REPOSITORY_ROOT, source.path)),
        ).resolves.toEqual(bytes);
      }),
    );
    expect(report.generatedFrom).toEqual(baseInput.generatedFrom);

    const cp53Bytes = requiredSourceBytes(
      baseInput,
      NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH,
    );
    const cp56Bytes = requiredSourceBytes(
      baseInput,
      NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
    );
    expect(stableJson(JSON.parse(cp53Bytes.toString("utf8")))).toBe(
      stableJson(baseInput.cp53ReportInput),
    );
    expect(stableJson(JSON.parse(cp56Bytes.toString("utf8")))).toBe(
      stableJson(baseInput.cp56ReportInput),
    );
    expect(report.upstreamBoundary).toEqual({
      cp53: {
        reportPath: NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256(cp53Bytes),
        canonicalObjectSha256: hashValue(baseInput.cp53ReportInput),
        freshlyAuthenticated: true,
        partialCandidateCount: 2,
        selectionCount: 0,
        energyRecoveryComputationCount: 0,
      },
      cp56: {
        reportPath: NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
        reportFileSha256: sha256(cp56Bytes),
        canonicalObjectSha256: hashValue(baseInput.cp56ReportInput),
        freshlyAuthenticated: true,
        sourceOrderDiagnosticCount: 288,
        contextRobustnessRowCount: 72,
        sourcePriorityValidated: false,
        selectedStatCount: 0,
        energyRecoveryComputationCount: 0,
      },
    });
  }, LONG_TIMEOUT);

  it("independently closes every runtime and implementation import", async () => {
    expect(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
    ).toEqual(NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS);
    expect(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS
        .some((sourcePath) => sourcePath.includes("/ercalc/")),
    ).toBe(false);

    const declaredPaths = new Set<string>(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
    );
    const runtimePaths = new Set<string>(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
    );
    const importCache = new Map<string, string[]>();
    const importsFor = async (sourcePath: string): Promise<string[]> => {
      const cached = importCache.get(sourcePath);
      if (cached) return cached;
      if (!/\.tsx?$/.test(sourcePath)) return [];
      const sourceText = await readFile(
        path.join(REPOSITORY_ROOT, sourcePath),
        "utf8",
      );
      const sourceFile = ts.createSourceFile(
        sourcePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
      );
      const imports = runtimeStaticModuleSpecifiers(sourceFile).flatMap(
        (moduleSpecifier) => {
          const resolved = resolveFirstPartyModulePath(
            sourcePath,
            moduleSpecifier,
          );
          return resolved ? [resolved] : [];
        },
      );
      importCache.set(sourcePath, imports);
      return imports;
    };

    const missingRuntimeImports: string[] = [];
    for (const sourcePath of runtimePaths) {
      for (const importedPath of await importsFor(sourcePath)) {
        if (!runtimePaths.has(importedPath)) {
          missingRuntimeImports.push(sourcePath + " -> " + importedPath);
        }
      }
    }
    expect(missingRuntimeImports).toEqual([]);

    const implementationRoots = [
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CORE_RELATIVE_PATH,
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_CLI_RELATIVE_PATH,
    ];
    const missingImplementationImports: string[] = [];
    const visited = new Set<string>();
    const queue = [...implementationRoots];
    while (queue.length > 0) {
      const sourcePath = queue.shift();
      if (!sourcePath || visited.has(sourcePath)) continue;
      visited.add(sourcePath);
      for (const importedPath of await importsFor(sourcePath)) {
        if (!declaredPaths.has(importedPath)) {
          missingImplementationImports.push(sourcePath + " -> " + importedPath);
          continue;
        }
        if (/\.tsx?$/.test(importedPath) && !visited.has(importedPath)) {
          queue.push(importedPath);
        }
      }
    }
    expect(missingImplementationImports).toEqual([]);

    const reachableRuntime = new Set<string>();
    const runtimeQueue = (await importsFor(
      NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
    )).filter((sourcePath) => runtimePaths.has(sourcePath));
    while (runtimeQueue.length > 0) {
      const sourcePath = runtimeQueue.shift();
      if (!sourcePath || reachableRuntime.has(sourcePath)) continue;
      reachableRuntime.add(sourcePath);
      for (const importedPath of await importsFor(sourcePath)) {
        if (
          runtimePaths.has(importedPath) &&
          !reachableRuntime.has(importedPath)
        ) {
          runtimeQueue.push(importedPath);
        }
      }
    }
    expect([...reachableRuntime].sort(compareText)).toEqual(
      [...runtimePaths].sort(compareText),
    );
  });

  it("pins the exact six entered requests and technical-only request boundary", () => {
    const expectedEnteredRequests = EXPECTED_REQUESTS.map(
      ({
        sequence,
        requestId,
        witnessId,
        characterId,
        constellation,
        enteredTalentLevels,
      }) => ({
        sequence,
        requestId,
        witnessId,
        characterId,
        constellation,
        enteredTalentLevels,
      }),
    );
    expect(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST
        .enteredRequests,
    ).toEqual(expectedEnteredRequests);
    expect(report.requestBoundary).toEqual({
      request:
        NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
      requestCanonicalObjectSha256: hashValue(
        NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
      ),
      enteredRequestCount: 6,
      exactTeamContext: ["noelle", "durin", "nicole", "xilonen"],
      sourceAuthoredRequestCoverage: false,
      enteredFactsOnlyCandidateMatching: true,
      runtimeEffectiveTalentsUsedForMatching: false,
      energyRecoveryDeferred: true,
    });
    expect(report.requestBoundary.request.authorship).toBe(
      "guide-factory-technical-request",
    );
    expect(report.requestBoundary.request.sourceAuthoredRequestCoverage).toBe(
      false,
    );
    expect(report.requestBoundary.request.selectionOutputs).toEqual({
      weapon: null,
      artifactSet: null,
      sands: null,
      goblet: null,
      circlet: null,
      substatAllocation: null,
      statWeights: null,
    });
    expect(
      new Set(
        report.requestBoundary.request.enteredRequests.map(
          ({ requestId }) => requestId,
        ),
      ).size,
    ).toBe(6);
    expect(report.identityBoundary.enteredRequestsSha256).toBe(
      hashValue(report.requestBoundary.request.enteredRequests),
    );
  });

  it("matches CP53 predicates from entered facts while keeping runtime-effective talents separate", () => {
    expect(report.requestConditionedCandidateEnvelopes).toHaveLength(6);
    for (const expected of EXPECTED_REQUESTS) {
      const envelope = requiredEnvelope(expected.requestId);
      expect(envelope.request).toEqual({
        sequence: expected.sequence,
        requestId: expected.requestId,
        witnessId: expected.witnessId,
        characterId: expected.characterId,
        constellation: expected.constellation,
        enteredTalentLevels: expected.enteredTalentLevels,
      });
      expect(envelope.requestCanonicalObjectSha256).toBe(
        hashValue(envelope.request),
      );
      const independentlyMatched = report.candidateCatalog.filter((candidate) =>
        evaluateSourcePredicate(
          candidate.artifactProfile.branch.requestPredicate,
          envelope.request,
        ),
      );
      expect(independentlyMatched).toHaveLength(1);
      expect(independentlyMatched[0].artifactProfile.profileId).toBe(
        expected.profileId,
      );
      expect(
        resolveNoelleHexereiCandidateForEnteredRequest(
          envelope.request,
          report.candidateCatalog,
        ).candidateId,
      ).toBe(independentlyMatched[0].candidateId);
      expect(envelope.candidateMatch).toEqual({
        candidateId: independentlyMatched[0].candidateId,
        candidateSha256: independentlyMatched[0].candidateSha256,
        profileId: expected.profileId,
        sourcePredicate:
          independentlyMatched[0].artifactProfile.branch.requestPredicate,
        predicateEvaluatedAgainstEnteredFactsOnly: true,
        runtimeEffectiveTalentsUsedForMatching: false,
        exactMatchedCandidateCount: 1,
      });
      expect(envelope.enteredAndRuntimeTalentBoundary).toEqual({
        constellation: expected.constellation,
        enteredTalentLevels: expected.enteredTalentLevels,
        runtimeEffectiveTalentLevels: expected.runtimeEffectiveTalentLevels,
        runtimeEffectiveTalentEvidenceOrigin: "authenticated-cp56-cells",
        enteredFactsRemainDistinctFromRuntimeEffectiveTalents: true,
      });

      const witnessCells = cp56Report.cells.filter(
        ({ witnessId }) => witnessId === expected.witnessId,
      );
      expect(witnessCells).toHaveLength(80);
      expect(
        witnessCells.every(
          ({ evaluation }) =>
            stableJson(evaluation.witness.enteredTalentLevels) ===
              stableJson(expected.enteredTalentLevels) &&
            stableJson(evaluation.witness.runtimeEffectiveTalentLevels) ===
              stableJson(expected.runtimeEffectiveTalentLevels),
        ),
      ).toBe(true);
    }

    const c5q9 = requiredEnvelope("c5-q9");
    expect(c5q9.request.enteredTalentLevels.burst).toBe(9);
    expect(
      c5q9.enteredAndRuntimeTalentBoundary.runtimeEffectiveTalentLevels.burst,
    ).toBe(12);
    expect(c5q9.candidateMatch.profileId).toBe(
      "noelle-lower-investment-artifact-profile-v1",
    );
    const c6q9 = requiredEnvelope("c6-q9");
    expect(c6q9.request.enteredTalentLevels.burst).toBe(9);
    expect(c6q9.request.constellation).toBe(6);
    expect(c6q9.candidateMatch.profileId).toBe(
      "noelle-high-investment-artifact-profile-v1",
    );
  });

  it("preserves both CP53 partial candidates exactly without selecting or rewriting them", () => {
    expect(report.candidateCatalog).toEqual(
      baseInput.cp53ReportInput.candidates,
    );
    expect(report.candidateCatalog).toHaveLength(2);
    for (const candidate of report.candidateCatalog) {
      expect(candidate.candidateSha256).toBe(
        hashValue(omitKey(candidate, "candidateSha256")),
      );
      expect(candidate.status).toBe(
        "request-parameterized-partial-validation-candidate",
      );
      expect(candidate.completeness.completeBuild).toBe(false);
      expect(candidate.selections).toEqual({
        selectedWeapon: null,
        selectedArtifactSet: null,
        selectedMainStats: {
          sands: null,
          goblet: null,
          circlet: null,
        },
        selectedSubstatAllocation: null,
      });
      expect(candidate.weaponOption.refinementStatus).toBe("missing-not-zero");
      expect(candidate.weaponOption.quantitativePerformanceStatus).toBe(
        "missing-not-zero",
      );
    }

    const reuseCensus: Record<string, number> = {};
    for (const envelope of report.requestConditionedCandidateEnvelopes) {
      const cp53Candidate = baseInput.cp53ReportInput.candidates.find(
        ({ candidateId }) =>
          candidateId === envelope.candidateMatch.candidateId,
      );
      expect(cp53Candidate).toBeDefined();
      if (!cp53Candidate) continue;
      reuseCensus[cp53Candidate.artifactProfile.profileId] =
        (reuseCensus[cp53Candidate.artifactProfile.profileId] ?? 0) + 1;
      expect(envelope.partialCandidate).toEqual(cp53Candidate);
      expect(envelope.partialCandidate.candidateSha256).toBe(
        envelope.candidateMatch.candidateSha256,
      );
      expect(envelope.preservedSourceObservations.exactTeam).toEqual(
        cp53Candidate.team,
      );
      expect(envelope.preservedSourceObservations.artifactSet).toEqual(
        cp53Candidate.artifactProfile.artifactSet,
      );
      expect(envelope.preservedSourceObservations.mainStats.sands).toEqual(
        cp53Candidate.artifactProfile.mainStats.sands,
      );
      expect(envelope.preservedSourceObservations.mainStats.goblet).toEqual(
        cp53Candidate.artifactProfile.mainStats.goblet,
      );
      expect(envelope.preservedSourceObservations.mainStats.circlet).toEqual(
        cp53Candidate.artifactProfile.mainStats.circlet,
      );
      expect(envelope.preservedSourceObservations.weaponOption).toEqual(
        cp53Candidate.weaponOption,
      );
      expect(
        envelope.preservedSourceObservations.substatPriorityOriginal,
      ).toEqual(cp53Candidate.artifactProfile.substatPriority);
      expect(
        envelope.relationAdmissionSummary
          .originalSourcePriorityGroupsPreservedUnchanged,
      ).toBe(true);
      expect(envelope.relationAdmissionSummary.totalOrderSynthesized).toBe(
        false,
      );
      expect(envelope.relationAdmissionSummary.scalarWeightsSynthesized).toBe(
        false,
      );
      expect(envelope.envelopeSha256).toBe(
        hashValue(omitKey(envelope, "envelopeSha256")),
      );
    }
    expect(reuseCensus).toEqual({
      "noelle-lower-investment-artifact-profile-v1": 2,
      "noelle-high-investment-artifact-profile-v1": 4,
    });
    expect(report.identityBoundary).toMatchObject({
      candidateSha256ValuesPreservedExactly: true,
      cp53CandidateObjectsPreservedExactly: true,
      serializationOrderIsNotRank: true,
    });
  });

  it("pins all 18 request-local relation decisions and the exact 12/6 outcome", () => {
    const allRelations =
      report.requestConditionedCandidateEnvelopes.flatMap(
        ({ relationAdmissions }) => relationAdmissions,
      );
    expect(allRelations).toHaveLength(18);
    for (const envelope of report.requestConditionedCandidateEnvelopes) {
      const expectedRelations =
        EXPECTED_RELATION_RESULTS[envelope.request.requestId];
      expect(expectedRelations).toBeDefined();
      expect(
        envelope.relationAdmissions.map(
          ({
            sourceRelationId,
            higherPriorityStat,
            lowerPriorityStat,
            sourceOrderAlignedCount,
            sourceOrderCounterexampleCount,
            withinToleranceInconclusiveCount,
            admissionStatus,
          }) => ({
            relationId: sourceRelationId,
            higherStat: higherPriorityStat,
            lowerStat: lowerPriorityStat,
            aligned: sourceOrderAlignedCount,
            counterexample: sourceOrderCounterexampleCount,
            inconclusive: withinToleranceInconclusiveCount,
            status: admissionStatus,
          }),
        ),
      ).toEqual(expectedRelations);
      for (const relation of envelope.relationAdmissions) {
        expect(relation.admissionId).toBe(
          envelope.request.requestId +
            ":" +
            relation.sourceRelationId +
            ":local-relation-admission",
        );
        expect(relation.requestId).toBe(envelope.request.requestId);
        expect(relation.witnessId).toBe(envelope.request.witnessId);
        expect(relation.candidateId).toBe(envelope.partialCandidate.candidateId);
        expect(relation.candidateSha256).toBe(
          envelope.partialCandidate.candidateSha256,
        );
        expect(relation.profileId).toBe(envelope.candidateMatch.profileId);
        expect(relation.admissionSha256).toBe(
          hashValue(omitKey(relation, "admissionSha256")),
        );
      }
      const admitted = envelope.relationAdmissions.filter(
        ({ admissionStatus }) =>
          admissionStatus ===
          "admitted-unanimous-across-all-16-tested-contexts",
      ).length;
      const withheld = envelope.relationAdmissions.length - admitted;
      expect(envelope.relationAdmissionSummary).toMatchObject({
        sourceAdjacentRelationCount: 3,
        admittedRelationCount: admitted,
        withheldCounterexampleRelationCount: withheld,
        withheldInconclusiveRelationCount: 0,
        aggregateStatus:
          admitted === 3
            ? "all-three-local-relations-admitted"
            : "partial-local-relation-admission-counterexamples-preserved",
      });
    }
    expect(
      census(allRelations, ({ admissionStatus }) => admissionStatus),
    ).toEqual({
      "admitted-unanimous-across-all-16-tested-contexts": 12,
      "withheld-counterexample": 6,
    });
    expect(report.summary).toMatchObject({
      enteredRequestCount: 6,
      requestConditionedEnvelopeCount: 6,
      uniqueMatchedCandidateCount: 2,
      lowerProfileRequestCount: 2,
      highProfileRequestCount: 4,
      relationAdmissionCount: 18,
      admittedRelationCount: 12,
      withheldCounterexampleRelationCount: 6,
      withheldInconclusiveRelationCount: 0,
    });
  });

  it("requires all 16 Cartesian contexts and retains every withheld counterexample", () => {
    expect(report.admissionPolicy).toEqual({
      policy: "all-16-contexts-must-align-no-majority-vote",
      evidencePerRelationCount: 16,
      robustnessRowsPerRelationCount: 4,
      exactCartesianAxes: {
        circlets: ["cr", "cd"],
        refinements: [1, 5],
        nicoleModes: ["all-theosis", "hexerei-theosis"],
        huskStackStates: [4, 0],
      },
      anyCounterexampleWithholds: true,
      anyInconclusiveWithoutCounterexampleWithholds: true,
      fifteenOfSixteenIsInsufficient: true,
      averagingAllowed: false,
      majorityVoteAllowed: false,
      sourcePriorityValidatedByLocalAdmission: false,
    });
    const expectedContexts = expectedDiagnosticContextKeys();
    const upstreamById = new Map(
      cp56Report.sourceOrderDiagnostics.map(
        (diagnostic) => [diagnostic.diagnosticId, diagnostic] as const,
      ),
    );
    const relations =
      report.requestConditionedCandidateEnvelopes.flatMap(
        ({ relationAdmissions }) => relationAdmissions,
      );
    for (const relation of relations) {
      expect(relation.evidence).toHaveLength(16);
      expect(relation.evidenceCount).toBe(16);
      expect(
        relation.evidence.map(diagnosticContextKey).sort(compareText),
      ).toEqual(expectedContexts);
      expect(
        new Set(relation.evidence.map(({ diagnosticId }) => diagnosticId)).size,
      ).toBe(16);
      for (const reference of relation.evidence) {
        const upstream = upstreamById.get(reference.diagnosticId);
        expect(upstream).toBeDefined();
        if (!upstream) continue;
        expect(reference).toEqual(diagnosticReference(upstream));
        expect(reference.diagnosticSha256).toBe(
          hashValue(omitKey(upstream, "diagnosticSha256")),
        );
        expect(reference.evidenceReferenceSha256).toBe(
          hashValue(omitKey(reference, "evidenceReferenceSha256")),
        );
        expect(reference.witnessId).toBe(relation.witnessId);
        expect(reference.profileId).toBe(relation.profileId);
        expect(reference.sourceRelationId).toBe(relation.sourceRelationId);
        expect(reference.higherPriorityStat).toBe(
          relation.higherPriorityStat,
        );
        expect(reference.lowerPriorityStat).toBe(
          relation.lowerPriorityStat,
        );
      }
      const aligned = relation.evidence.filter(
        ({ outcome }) => outcome === "source-order-aligned",
      ).length;
      const counterexample = relation.evidence.filter(
        ({ outcome }) => outcome === "source-order-counterexample",
      ).length;
      const inconclusive = relation.evidence.length - aligned - counterexample;
      expect({
        aligned,
        counterexample,
        inconclusive,
      }).toEqual({
        aligned: relation.sourceOrderAlignedCount,
        counterexample: relation.sourceOrderCounterexampleCount,
        inconclusive: relation.withinToleranceInconclusiveCount,
      });
      expect(relation.admissionStatus).toBe(
        counterexample > 0
          ? "withheld-counterexample"
          : inconclusive > 0
            ? "withheld-inconclusive"
            : aligned === 16
              ? "admitted-unanimous-across-all-16-tested-contexts"
              : "invalid",
      );
      expect(relation).toMatchObject({
        unanimousAlignmentRequired: true,
        majorityVoteAllowed: false,
        adjacentSourceGroupsOnly: true,
        sourcePriorityValidated: false,
        supportsUniversalPriorityClaim: false,
        supportsTotalOrderClaim: false,
      });
    }

    const admittedEvidence = relations
      .filter(
        ({ admissionStatus }) =>
          admissionStatus ===
          "admitted-unanimous-across-all-16-tested-contexts",
      )
      .flatMap(({ evidence }) => evidence);
    const withheldEvidence = relations
      .filter(
        ({ admissionStatus }) => admissionStatus === "withheld-counterexample",
      )
      .flatMap(({ evidence }) => evidence);
    expect(admittedEvidence).toHaveLength(192);
    expect(census(admittedEvidence, ({ outcome }) => outcome)).toEqual({
      "source-order-aligned": 192,
    });
    expect(withheldEvidence).toHaveLength(96);
    expect(census(withheldEvidence, ({ outcome }) => outcome)).toEqual({
      "source-order-aligned": 50,
      "source-order-counterexample": 46,
    });
    expect(
      withheldEvidence
        .filter(({ outcome }) => outcome === "source-order-counterexample")
        .map(({ diagnosticId }) => diagnosticId)
        .sort(compareText),
    ).toEqual(
      cp56Report.sourceOrderDiagnostics
        .filter(({ outcome }) => outcome === "source-order-counterexample")
        .map(({ diagnosticId }) => diagnosticId)
        .sort(compareText),
    );
  });

  it("preserves all 72 CP56 robustness rows as exact four-way partitions", () => {
    const relations =
      report.requestConditionedCandidateEnvelopes.flatMap(
        ({ relationAdmissions }) => relationAdmissions,
      );
    const upstreamById = new Map(
      cp56Report.contextRobustnessRows.map(
        (row) => [row.robustnessId, row] as const,
      ),
    );
    for (const relation of relations) {
      expect(relation.robustnessEvidence).toHaveLength(4);
      expect(relation.robustnessEvidenceCount).toBe(4);
      expect(relation.robustnessRowsExactlyPartitionRawEvidence).toBe(true);
      expect(
        relation.robustnessEvidence
          .map(({ circlet, refinement }) => circlet + ":r" + refinement)
          .sort(compareText),
      ).toEqual(["cd:r1", "cd:r5", "cr:r1", "cr:r5"]);

      const evidenceById = new Map(
        relation.evidence.map(
          (reference) => [reference.diagnosticId, reference] as const,
        ),
      );
      const partitionIds = relation.robustnessEvidence
        .flatMap(({ diagnosticIds }) => diagnosticIds)
        .sort(compareText);
      expect(partitionIds).toEqual(
        relation.evidence
          .map(({ diagnosticId }) => diagnosticId)
          .sort(compareText),
      );
      expect(new Set(partitionIds).size).toBe(16);

      for (const reference of relation.robustnessEvidence) {
        const upstream = upstreamById.get(reference.robustnessId);
        expect(upstream).toBeDefined();
        if (!upstream) continue;
        expect(reference).toEqual(robustnessReference(upstream));
        expect(reference.robustnessSha256).toBe(
          hashValue(omitKey(upstream, "robustnessSha256")),
        );
        expect(reference.robustnessReferenceSha256).toBe(
          hashValue(omitKey(reference, "robustnessReferenceSha256")),
        );
        expect(reference.witnessId).toBe(relation.witnessId);
        expect(reference.profileId).toBe(relation.profileId);
        expect(reference.sourceRelationId).toBe(relation.sourceRelationId);
        expect(reference.diagnosticIds).toHaveLength(4);
        expect(new Set(reference.diagnosticIds).size).toBe(4);
        const members = reference.diagnosticIds.map((diagnosticId) =>
          evidenceById.get(diagnosticId),
        );
        expect(members.every(Boolean)).toBe(true);
        const concrete = members.filter(
          (
            member,
          ): member is NonNullable<typeof member> => member != null,
        );
        expect(
          new Set(
            concrete.map(
              ({ nicoleMode, huskStacks }) =>
                nicoleMode + ":husk-" + huskStacks,
            ),
          ).size,
        ).toBe(4);
        expect(
          concrete.every(
            ({ circlet, refinement }) =>
              circlet === reference.circlet &&
              refinement === reference.refinement,
          ),
        ).toBe(true);
        const aligned = concrete.filter(
          ({ outcome }) => outcome === "source-order-aligned",
        ).length;
        const counterexample = concrete.filter(
          ({ outcome }) => outcome === "source-order-counterexample",
        ).length;
        const inconclusive = concrete.length - aligned - counterexample;
        expect(reference).toMatchObject({
          sourceOrderAlignedCount: aligned,
          sourceOrderCounterexampleCount: counterexample,
          withinToleranceInconclusiveCount: inconclusive,
          classification:
            aligned === 4
              ? "aligned-across-tested-sensitivity-grid"
              : counterexample === 4
                ? "counterexample-across-tested-sensitivity-grid"
                : "context-dependent-or-inconclusive",
        });
      }
    }

    const robustness =
      relations.flatMap(({ robustnessEvidence }) => robustnessEvidence);
    expect(robustness).toHaveLength(72);
    expect(census(robustness, ({ classification }) => classification)).toEqual({
      "aligned-across-tested-sensitivity-grid": 58,
      "context-dependent-or-inconclusive": 4,
      "counterexample-across-tested-sensitivity-grid": 10,
    });
    const admittedRobustness = relations
      .filter(
        ({ admissionStatus }) =>
          admissionStatus ===
          "admitted-unanimous-across-all-16-tested-contexts",
      )
      .flatMap(({ robustnessEvidence }) => robustnessEvidence);
    expect(admittedRobustness).toHaveLength(48);
    expect(
      census(admittedRobustness, ({ classification }) => classification),
    ).toEqual({
      "aligned-across-tested-sensitivity-grid": 48,
    });
    const withheldRobustness = relations
      .filter(
        ({ admissionStatus }) => admissionStatus === "withheld-counterexample",
      )
      .flatMap(({ robustnessEvidence }) => robustnessEvidence);
    expect(withheldRobustness).toHaveLength(24);
    expect(
      census(withheldRobustness, ({ classification }) => classification),
    ).toEqual({
      "aligned-across-tested-sensitivity-grid": 10,
      "context-dependent-or-inconclusive": 4,
      "counterexample-across-tested-sensitivity-grid": 10,
    });
  });

  it("consumes every CP56 diagnostic and robustness row exactly once", () => {
    const relations =
      report.requestConditionedCandidateEnvelopes.flatMap(
        ({ relationAdmissions }) => relationAdmissions,
      );
    const diagnosticReferences =
      relations.flatMap(({ evidence }) => evidence);
    const robustnessReferences =
      relations.flatMap(({ robustnessEvidence }) => robustnessEvidence);
    const upstreamDiagnosticIds = cp56Report.sourceOrderDiagnostics
      .map(({ diagnosticId }) => diagnosticId)
      .sort(compareText);
    const consumedDiagnosticIds = diagnosticReferences
      .map(({ diagnosticId }) => diagnosticId)
      .sort(compareText);
    const upstreamRobustnessIds = cp56Report.contextRobustnessRows
      .map(({ robustnessId }) => robustnessId)
      .sort(compareText);
    const consumedRobustnessIds = robustnessReferences
      .map(({ robustnessId }) => robustnessId)
      .sort(compareText);
    expect(diagnosticReferences).toHaveLength(288);
    expect(new Set(consumedDiagnosticIds).size).toBe(288);
    expect(consumedDiagnosticIds).toEqual(upstreamDiagnosticIds);
    expect(
      [...countValues(diagnosticReferences, ({ diagnosticId }) => diagnosticId)
        .values()],
    ).toEqual(Array.from({ length: 288 }, () => 1));
    expect(robustnessReferences).toHaveLength(72);
    expect(new Set(consumedRobustnessIds).size).toBe(72);
    expect(consumedRobustnessIds).toEqual(upstreamRobustnessIds);
    expect(
      [...countValues(robustnessReferences, ({ robustnessId }) => robustnessId)
        .values()],
    ).toEqual(Array.from({ length: 72 }, () => 1));

    expect(report.evidenceConsumptionLedger).toEqual({
      upstreamDiagnosticCount: 288,
      consumedDiagnosticReferenceCount: 288,
      uniqueConsumedDiagnosticCount: 288,
      unconsumedDiagnosticCount: 0,
      multiplyConsumedDiagnosticCount: 0,
      everyUpstreamDiagnosticConsumedExactlyOnce: true,
      upstreamDiagnosticIdsSha256: hashValue(upstreamDiagnosticIds),
      consumedDiagnosticIdsSha256: hashValue(consumedDiagnosticIds),
      evidenceReferencesSha256: hashValue(
        diagnosticReferences.map(
          ({ evidenceReferenceSha256 }) => evidenceReferenceSha256,
        ),
      ),
      upstreamRobustnessRowCount: 72,
      consumedRobustnessReferenceCount: 72,
      uniqueConsumedRobustnessRowCount: 72,
      unconsumedRobustnessRowCount: 0,
      multiplyConsumedRobustnessRowCount: 0,
      everyUpstreamRobustnessRowConsumedExactlyOnce: true,
      upstreamRobustnessIdsSha256: hashValue(upstreamRobustnessIds),
      consumedRobustnessIdsSha256: hashValue(consumedRobustnessIds),
      robustnessReferencesSha256: hashValue(
        robustnessReferences.map(
          ({ robustnessReferenceSha256 }) => robustnessReferenceSha256,
        ),
      ),
    });
  });

  it("recomputes every CP57 identity without turning serialization into rank", () => {
    const relations =
      report.requestConditionedCandidateEnvelopes.flatMap(
        ({ relationAdmissions }) => relationAdmissions,
      );
    const diagnosticReferences =
      relations.flatMap(({ evidence }) => evidence);
    const robustnessReferences =
      relations.flatMap(({ robustnessEvidence }) => robustnessEvidence);
    const candidateCatalogSha256 = hashValue(report.candidateCatalog);
    const enteredRequestsSha256 = hashValue(
      report.requestBoundary.request.enteredRequests,
    );
    const relationAdmissionsSha256 = hashValue(
      relations.map(({ admissionSha256 }) => admissionSha256),
    );
    const requestConditionedCandidateEnvelopesSha256 = hashValue(
      report.requestConditionedCandidateEnvelopes.map(
        ({ envelopeSha256 }) => envelopeSha256,
      ),
    );
    const evidenceReferencesSha256 = hashValue(
      diagnosticReferences.map(
        ({ evidenceReferenceSha256 }) => evidenceReferenceSha256,
      ),
    );
    const robustnessReferencesSha256 = hashValue(
      robustnessReferences.map(
        ({ robustnessReferenceSha256 }) => robustnessReferenceSha256,
      ),
    );
    const cp53CanonicalObjectSha256 = hashValue(baseInput.cp53ReportInput);
    const cp56CanonicalObjectSha256 = hashValue(baseInput.cp56ReportInput);
    const technicalRequestSha256 = hashValue(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
    );
    expect(report.identityBoundary).toEqual({
      candidateCatalogSha256,
      enteredRequestsSha256,
      relationAdmissionsSha256,
      requestConditionedCandidateEnvelopesSha256,
      aggregateAdmissionSha256: hashValue({
        cp53CanonicalObjectSha256,
        cp56CanonicalObjectSha256,
        technicalRequestSha256,
        candidateCatalogSha256,
        enteredRequestsSha256,
        relationAdmissionsSha256,
        requestConditionedCandidateEnvelopesSha256,
        evidenceReferencesSha256,
        robustnessReferencesSha256,
      }),
      candidateSha256ValuesPreservedExactly: true,
      cp53CandidateObjectsPreservedExactly: true,
      cp56DiagnosticHashesPreservedExactly: true,
      serializationOrderIsNotRank: true,
    });
  });

  it("keeps optimizer, rank, damage, rotation, allocation, and ER outside the claim boundary", () => {
    expect(report.summary).toEqual({
      enteredRequestCount: 6,
      requestConditionedEnvelopeCount: 6,
      uniqueMatchedCandidateCount: 2,
      lowerProfileRequestCount: 2,
      highProfileRequestCount: 4,
      allRelationsAdmittedRequestCount: 2,
      oneOrMoreRelationsWithheldRequestCount: 4,
      relationAdmissionCount: 18,
      admittedRelationCount: 12,
      withheldCounterexampleRelationCount: 6,
      withheldInconclusiveRelationCount: 0,
      admittedRelationEvidenceCount: 192,
      withheldRelationEvidenceCount: 96,
      sourceOrderAlignedEvidenceCount: 242,
      sourceOrderCounterexampleEvidenceCount: 46,
      withinToleranceInconclusiveEvidenceCount: 0,
      sourceSelectionCount: 0,
      rankingCount: 0,
      scalarWeightCount: 0,
      idealStatAllocationCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      damageComputationCount: 0,
      rotationReplayCount: 0,
      teamTotalDamageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    });
    expect(report.operationSummary).toEqual({
      countingScope:
        "cp57-request-conditioning-only-excludes-upstream-authentication-work",
      upstreamAuthenticationOperationsExcluded: true,
      upstreamCp56TechnicalCellsFreshlyRecomputedDuringAuthentication: 480,
      upstreamCp56TeamBuildsFreshlyMaterializedDuringAuthentication: 960,
      upstreamCp56ObjectiveTeamBuildsFreshlyMaterializedDuringAuthentication: 480,
      upstreamCp56HuskControlTeamBuildsFreshlyMaterializedDuringAuthentication: 480,
      localDamageEvaluationCount: 0,
      enteredRequestResolutionCount: 6,
      sourcePredicateEvaluationCount: 12,
      exactCandidateMatchCount: 6,
      candidateCatalogCloneCount: 2,
      envelopeCandidateCopyCount: 6,
      relationAdmissionDecisionCount: 18,
      diagnosticReferenceConsumptionCount: 288,
      robustnessReferenceConsumptionCount: 72,
      selectionCount: 0,
      rankingCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      idealStatAllocationCount: 0,
      rotationReplayCount: 0,
      teamTotalDamageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    });
    expect(report).toMatchObject({
      supportsSourceAuthorization: false,
      supportsRequestConditionedPartialValidationAdmission: true,
      supportsLocalOrdinalRelationAdmission: true,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsWinnerClaims: false,
      supportsScalarWeights: false,
      supportsTotalStatOrder: false,
      supportsPlayerDamageClaims: false,
      supportsSourceRotationReplay: false,
      supportsTeamTotalDamageComputation: false,
      supportsDpsClaims: false,
      supportsBuffTimingClaims: false,
      supportsEnergyRecoveryClaims: false,
      supportsIdealStatAllocation: false,
      requestConditioningExecuted: true,
      candidateApplicabilityResolutionExecuted: true,
      competitiveCandidateSelectionExecuted: false,
      localRelationAdmissionExecuted: true,
      sourceCandidateSelectionExecuted: false,
      sourceStatSelectionExecuted: false,
      sourceSubstatPriorityValidated: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      damageComputationExecuted: false,
      rotationReplayExecuted: false,
      teamTotalDamageComputationExecuted: false,
      idealStatAllocationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    for (const envelope of report.requestConditionedCandidateEnvelopes) {
      expect(envelope.unresolvedBoundaries).toEqual({
        sourceReviewStatus: "unreviewed",
        weaponRefinement: "missing-not-zero",
        weaponQuantitativePerformance: "missing-not-zero",
        completeArtifactAssignment: false,
        completeBuild: false,
        rotationTimingAndBuffCoverage: "missing-not-zero",
        teamTotalDamage: "not-computed",
        energyRecharge: "deferred-missing-not-zero",
      });
      expect(envelope.promotionReady).toBe(false);
      expect(envelope.publicationStatus).toBe(
        "withheld-unreviewed-partial-candidate",
      );
    }
    expect(report.cautions).toHaveLength(5);
    expect(report.prohibitedInterpretations).toHaveLength(5);
  });

  it("fails closed on unsupported requests, zero/double matches, and authenticated-input tampering", async () => {
    const c0q9 = requiredEnvelope("c0-q9").request;
    const unsupported = structuredClone(c0q9) as unknown as {
      constellation: number;
    };
    unsupported.constellation = 1;
    expect(() =>
      resolveNoelleHexereiCandidateForEnteredRequest(
        unsupported as NoelleHexereiEnteredRequest,
        report.candidateCatalog,
      ),
    ).toThrow("outside the exact six-request domain");

    const lowerCandidate = requiredCandidate(
      "noelle-lower-investment-artifact-profile-v1",
    );
    expect(() =>
      resolveNoelleHexereiCandidateForEnteredRequest(c0q9, [
        ...report.candidateCatalog,
        structuredClone(lowerCandidate),
      ]),
    ).toThrow("observed 2");
    expect(() =>
      resolveNoelleHexereiCandidateForEnteredRequest(
        c0q9,
        report.candidateCatalog.filter(
          ({ artifactProfile }) =>
            artifactProfile.profileId !==
            "noelle-lower-investment-artifact-profile-v1",
        ),
      ),
    ).toThrow("observed 0");

    const predicateDrift = structuredClone(lowerCandidate);
    (
      predicateDrift.artifactProfile.branch.requestPredicate as unknown as {
        predicates: Array<{ threshold: number }>;
      }
    ).predicates[0].threshold = 4;
    expect(() =>
      resolveNoelleHexereiCandidateForEnteredRequest(c0q9, [
        predicateDrift,
        requiredCandidate("noelle-high-investment-artifact-profile-v1"),
      ]),
    ).toThrow("source request-predicate AST drifted");

    const requestDrift = fixture();
    const mutableRequests = requestDrift.technicalRequest
      .enteredRequests as unknown as Array<{
      enteredTalentLevels: { burst: number };
    }>;
    mutableRequests[0].enteredTalentLevels.burst = 10;
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(requestDrift),
    ).rejects.toThrow("technical request drifted");

    const missingPath = fixture();
    missingPath.sourceFiles = missingPath.sourceFiles.slice(1);
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(missingPath),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const byteDrift = fixture();
    byteDrift.sourceFiles = byteDrift.sourceFiles.map((source, index) =>
      index === 0
        ? {
            ...source,
            bytesBase64: Buffer.from("cp57-tamper").toString("base64"),
          }
        : source,
    );
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(byteDrift),
    ).rejects.toThrow("do not match the workspace file");

    const hashDrift = fixture();
    hashDrift.generatedFrom = hashDrift.generatedFrom.map((entry, index) =>
      index === 0 ? { ...entry, sha256: "0".repeat(64) } : entry,
    );
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(hashDrift),
    ).rejects.toThrow("source/hash authentication drifted");

    const cp53SplitBrain = fixture();
    (
      cp53SplitBrain.cp53ReportInput.summary as unknown as {
        candidateCount: number;
      }
    ).candidateCount = 3;
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(
        cp53SplitBrain,
      ),
    ).rejects.toThrow(
      "CP53 durable report bytes disagree with the supplied parsed object",
    );

    const cp56SplitBrain = fixture();
    (
      cp56SplitBrain.cp56ReportInput.operationSummary as unknown as {
        sourceOrderDiagnosticCount: number;
      }
    ).sourceOrderDiagnosticCount = 287;
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(
        cp56SplitBrain,
      ),
    ).rejects.toThrow(
      "CP56 durable report bytes disagree with the supplied parsed object",
    );

    const cp53ProjectionDrift = fixture();
    cp53ProjectionDrift.cp53Input.sourceFiles =
      cp53ProjectionDrift.cp53Input.sourceFiles.slice(1);
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(
        cp53ProjectionDrift,
      ),
    ).rejects.toThrow(
      "CP53 input is not the exact projection of the outer authenticated byte closure",
    );

    const cp56ProjectionDrift = fixture();
    cp56ProjectionDrift.cp56Input.sourceFiles =
      cp56ProjectionDrift.cp56Input.sourceFiles.slice(1);
    await expect(
      buildNoelleHexereiRequestConditionedCandidateAdmissionReport(
        cp56ProjectionDrift,
      ),
    ).rejects.toThrow(
      "CP56 input is not the exact projection of the outer authenticated byte closure",
    );
  }, LONG_TIMEOUT);

  it("rejects a resealed-looking serialized admission with missing evidence and a promoted counterexample", async () => {
    const tampered = structuredClone(durableReport);
    tampered.requestConditionedCandidateEnvelopes[0].relationAdmissions[0]
      .evidence.pop();
    const withheld = tampered.requestConditionedCandidateEnvelopes
      .flatMap(({ relationAdmissions }) => relationAdmissions)
      .find(
        ({ admissionStatus }) => admissionStatus === "withheld-counterexample",
      );
    if (!withheld) throw new Error("Expected a withheld CP57 relation.");
    (
      withheld as unknown as {
        admissionStatus: string;
      }
    ).admissionStatus =
      "admitted-unanimous-across-all-16-tested-contexts";
    withheld.admissionSha256 = hashValue(
      omitKey(withheld, "admissionSha256"),
    );

    const authentication =
      await authenticateNoelleHexereiRequestConditionedCandidateAdmissionReport(
        tampered,
        baseInput,
      );
    expect(authentication).toEqual({
      authenticated: false,
      reason: "serialized-report-mismatch",
      message:
        "The serialized CP57 report does not match a fresh reconstruction from authenticated CP53/CP56 evidence.",
    });
  }, LONG_TIMEOUT);
});

function relationResult(
  relationId: string,
  higherStat: ExpectedRelationResult["higherStat"],
  lowerStat: ExpectedRelationResult["lowerStat"],
  aligned: number,
  counterexample: number,
): ExpectedRelationResult {
  return {
    relationId,
    higherStat,
    lowerStat,
    aligned,
    counterexample,
    inconclusive: 0,
    status:
      counterexample === 0
        ? "admitted-unanimous-across-all-16-tested-contexts"
        : "withheld-counterexample",
  };
}

function requiredEnvelope(requestId: string) {
  const envelope = report.requestConditionedCandidateEnvelopes.find(
    ({ request }) => request.requestId === requestId,
  );
  if (!envelope) throw new Error("Missing CP57 envelope " + requestId + ".");
  return envelope;
}

function requiredCandidate(
  profileId: string,
): NoelleHexereiPartialEquipmentValidationCandidate {
  const candidate = report.candidateCatalog.find(
    ({ artifactProfile }) => artifactProfile.profileId === profileId,
  );
  if (!candidate) throw new Error("Missing CP53 candidate " + profileId + ".");
  return candidate;
}

type SourcePredicate = {
  type: "all" | "any";
  predicates: Array<{
    type:
      | "constellation-at-most"
      | "constellation-at-least"
      | "talent-level-is"
      | "talent-level-at-least";
    threshold: number;
  }>;
};

function evaluateSourcePredicate(
  rawPredicate: unknown,
  request: NoelleHexereiEnteredRequest,
): boolean {
  const predicate = rawPredicate as SourcePredicate;
  const results = predicate.predicates.map((clause) => {
    switch (clause.type) {
      case "constellation-at-most":
        return request.constellation <= clause.threshold;
      case "constellation-at-least":
        return request.constellation >= clause.threshold;
      case "talent-level-is":
        return request.enteredTalentLevels.burst === clause.threshold;
      case "talent-level-at-least":
        return request.enteredTalentLevels.burst >= clause.threshold;
    }
  });
  return predicate.type === "all"
    ? results.every(Boolean)
    : results.some(Boolean);
}

function expectedDiagnosticContextKeys(): string[] {
  const keys: string[] = [];
  for (const circlet of ["cr", "cd"]) {
    for (const refinement of [1, 5]) {
      for (const nicoleMode of ["all-theosis", "hexerei-theosis"]) {
        for (const huskStacks of [4, 0]) {
          keys.push(
            circlet +
              ":r" +
              refinement +
              ":" +
              nicoleMode +
              ":husk-" +
              huskStacks,
          );
        }
      }
    }
  }
  return keys.sort(compareText);
}

function diagnosticContextKey(
  reference: NoelleHexereiRelationDiagnosticReference,
): string {
  return (
    reference.circlet +
    ":r" +
    reference.refinement +
    ":" +
    reference.nicoleMode +
    ":husk-" +
    reference.huskStacks
  );
}

function diagnosticReference(
  diagnostic: NoelleHexereiSourceOrderDiagnostic,
): NoelleHexereiRelationDiagnosticReference {
  const withoutHash = {
    diagnosticId: diagnostic.diagnosticId,
    diagnosticSha256: diagnostic.diagnosticSha256,
    witnessId: diagnostic.witnessId,
    profileId: diagnostic.profileId,
    sourceRelationId: diagnostic.sourceRelationId,
    circlet: diagnostic.circlet,
    refinement: diagnostic.refinement,
    nicoleMode: diagnostic.nicoleMode,
    huskStacks: diagnostic.huskStacks,
    higherPriorityStat: diagnostic.higherPriorityStat,
    lowerPriorityStat: diagnostic.lowerPriorityStat,
    higherPriorityMarginalId: diagnostic.higherPriorityMarginalId,
    lowerPriorityMarginalId: diagnostic.lowerPriorityMarginalId,
    signedHigherMinusLowerDelta: diagnostic.signedHigherMinusLowerDelta,
    allowedDifference: diagnostic.allowedDifference,
    outcome: diagnostic.outcome,
  };
  return {
    ...withoutHash,
    evidenceReferenceSha256: hashValue(withoutHash),
  };
}

function robustnessReference(
  row: NoelleHexereiContextRobustnessRow,
): NoelleHexereiRelationRobustnessReference {
  const withoutHash = {
    robustnessId: row.robustnessId,
    robustnessSha256: row.robustnessSha256,
    witnessId: row.witnessId,
    profileId: row.profileId,
    sourceRelationId: row.sourceRelationId,
    circlet: row.circlet,
    refinement: row.refinement,
    diagnosticIds: [...row.diagnosticIds].sort(compareText),
    sourceOrderAlignedCount: row.sourceOrderAlignedCount,
    sourceOrderCounterexampleCount: row.sourceOrderCounterexampleCount,
    withinToleranceInconclusiveCount: row.withinToleranceInconclusiveCount,
    classification: row.classification,
  };
  return {
    ...withoutHash,
    robustnessReferenceSha256: hashValue(withoutHash),
  };
}

function census<T>(
  rows: readonly T[],
  key: (row: T) => string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row);
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function countValues<T>(
  rows: readonly T[],
  key: (row: T) => string,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    const value = key(row);
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

function fixture(): NoelleHexereiRequestConditionedCandidateAdmissionInput {
  return structuredClone(baseInput);
}

function requiredSourceBytes(
  input: NoelleHexereiRequestConditionedCandidateAdmissionInput,
  sourcePath: string,
): Buffer {
  const source = input.sourceFiles.find(
    ({ path: candidatePath }) => candidatePath === sourcePath,
  );
  if (!source) throw new Error("Missing source bytes " + sourcePath + ".");
  return Buffer.from(source.bytesBase64, "base64");
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function omitKey<T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readJsonReport<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
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
    basePath = "src/" + bareModuleSpecifier.slice(2);
  } else if (bareModuleSpecifier.startsWith(".")) {
    basePath = path.posix.normalize(
      path.posix.join(path.posix.dirname(importerPath), bareModuleSpecifier),
    );
  } else {
    return null;
  }
  const candidates = [
    basePath,
    basePath + ".ts",
    basePath + ".tsx",
    basePath + ".json",
    basePath + ".json.gz",
    basePath + "/index.ts",
    basePath + "/index.tsx",
  ];
  const resolved = candidates.find((candidate) => {
    const absolutePath = path.join(REPOSITORY_ROOT, candidate);
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  });
  if (!resolved) {
    throw new Error(
      "Could not resolve first-party static import " +
        moduleSpecifier +
        " from " +
        importerPath +
        ".",
    );
  }
  return resolved.replaceAll("\\", "/");
}
