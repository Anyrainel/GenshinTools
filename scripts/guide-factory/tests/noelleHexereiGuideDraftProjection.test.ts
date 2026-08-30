import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

import {
  formatNoelleHexereiGuideDraftProjectionSummary,
  loadNoelleHexereiGuideDraftProjectionInputFromWorkspace,
} from "../src/assemble-noelle-hexerei-guide-draft-projection";
import {
  buildGuideDraftFieldPolicy,
  finalizeGuideDraftBlocker,
  finalizeGuideDraftField,
  finalizeGuideDraftPacket,
  GUIDE_DRAFT_PACKET_SCHEMA_VERSION,
  hashGuideDraftValue,
  resolveGuideDraftJsonPointer,
  validateGuideDraftPacket,
  type GuideDraftBlocker,
  type GuideDraftField,
} from "../src/guideDraftPacket";
import { stableJson } from "../src/io";
import {
  NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
} from "../src/noelleHexereiLocalStatPriorityDiagnostic";
import {
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
  type NoelleHexereiRequestConditionedCandidateAdmissionReport,
} from "../src/noelleHexereiRequestConditionedCandidateAdmission";
import {
  authenticateNoelleHexereiGuideDraftProjectionReport,
  buildNoelleHexereiGuideDraftProjectionReport,
  GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
  NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CLI_RELATIVE_PATH,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CORE_RELATIVE_PATH,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REPORT_PATH,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS,
  type NoelleHexereiGuideDraftPacket,
  type NoelleHexereiGuideDraftProjectionInput,
  type NoelleHexereiGuideDraftProjectionReport,
} from "../src/noelleHexereiGuideDraftProjection";
import { REPOSITORY_ROOT } from "../src/paths";

const LONG_TIMEOUT = 180_000;

const BASE_BLOCKER_CODES = [
  "artifact-assignment-incomplete",
  "artifact-set-selection-missing",
  "build-incomplete",
  "enemy-scenario-missing",
  "energy-recharge-deferred",
  "formula-counts-missing",
  "rotation-and-buff-coverage-missing",
  "scalar-weights-missing",
  "selected-circlet-missing",
  "selected-goblet-missing",
  "selected-sands-missing",
  "source-request-coverage-absent",
  "source-review-unreviewed",
  "source-team-investment-unspecified",
  "substat-allocation-missing",
  "team-total-not-computed",
  "weapon-performance-missing",
  "weapon-refinement-missing",
  "weapon-selection-missing",
] as const;

const EXPECTED_PACKETS = [
  {
    requestId: "c0-q9",
    profileId: "noelle-lower-investment-artifact-profile-v1",
    entered: {
      sequence: 0,
      requestId: "c0-q9",
      witnessId: "c0-q9",
      characterId: "noelle",
      constellation: 0,
      enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    },
    effective: { auto: 10, skill: 1, burst: 9 },
    fieldCount: 32,
    blockerCount: 19,
    guardedCount: 0,
    admittedCount: 3,
    withheldCount: 0,
    relationProjection: "all-locally-admitted",
  },
  {
    requestId: "c5-q9",
    profileId: "noelle-lower-investment-artifact-profile-v1",
    entered: {
      sequence: 1,
      requestId: "c5-q9",
      witnessId: "c5-q9",
      characterId: "noelle",
      constellation: 5,
      enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    },
    effective: { auto: 10, skill: 4, burst: 12 },
    fieldCount: 32,
    blockerCount: 20,
    guardedCount: 0,
    admittedCount: 2,
    withheldCount: 1,
    relationProjection: "partial-counterexamples-preserved",
  },
  {
    requestId: "c0-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    entered: {
      sequence: 2,
      requestId: "c0-q10",
      witnessId: "c0-q10",
      characterId: "noelle",
      constellation: 0,
      enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    },
    effective: { auto: 10, skill: 1, burst: 10 },
    fieldCount: 34,
    blockerCount: 22,
    guardedCount: 2,
    admittedCount: 2,
    withheldCount: 1,
    relationProjection: "partial-counterexamples-preserved",
  },
  {
    requestId: "c5-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    entered: {
      sequence: 3,
      requestId: "c5-q10",
      witnessId: "c5-q10",
      characterId: "noelle",
      constellation: 5,
      enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    },
    effective: { auto: 10, skill: 4, burst: 13 },
    fieldCount: 34,
    blockerCount: 21,
    guardedCount: 2,
    admittedCount: 3,
    withheldCount: 0,
    relationProjection: "all-locally-admitted",
  },
  {
    requestId: "c6-q9",
    profileId: "noelle-high-investment-artifact-profile-v1",
    entered: {
      sequence: 4,
      requestId: "c6-q9",
      witnessId: "c6-q9",
      characterId: "noelle",
      constellation: 6,
      enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    },
    effective: { auto: 10, skill: 4, burst: 12 },
    fieldCount: 34,
    blockerCount: 23,
    guardedCount: 2,
    admittedCount: 1,
    withheldCount: 2,
    relationProjection: "partial-counterexamples-preserved",
  },
  {
    requestId: "c6-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    entered: {
      sequence: 5,
      requestId: "c6-q10",
      witnessId: "c6-q10",
      characterId: "noelle",
      constellation: 6,
      enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    },
    effective: { auto: 10, skill: 4, burst: 13 },
    fieldCount: 34,
    blockerCount: 23,
    guardedCount: 2,
    admittedCount: 1,
    withheldCount: 2,
    relationProjection: "partial-counterexamples-preserved",
  },
] as const;

let baseInput: NoelleHexereiGuideDraftProjectionInput;
let durableReport: NoelleHexereiGuideDraftProjectionReport;
let report: NoelleHexereiGuideDraftProjectionReport;
let cp57Report: NoelleHexereiRequestConditionedCandidateAdmissionReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadNoelleHexereiGuideDraftProjectionInputFromWorkspace(),
    readJsonReport<NoelleHexereiGuideDraftProjectionReport>(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REPORT_PATH,
    ),
  ]);
  const authentication =
    await authenticateNoelleHexereiGuideDraftProjectionReport(
      durableReport,
      baseInput,
    );
  if (!authentication.authenticated) {
    throw new Error(
      "Expected the durable CP58 report to authenticate: " +
        authentication.message,
    );
  }
  report = authentication.canonicalReport;
  cp57Report = baseInput.cp57ReportInput;
}, LONG_TIMEOUT);

describe("Noelle Hexerei guide-draft projection", () => {
  it("fresh-authenticates one deterministic durable offline projection", async () => {
    expect(stableJson(report)).toBe(stableJson(durableReport));
    await expect(
      readFile(NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REPORT_PATH, "utf8"),
    ).resolves.toBe(stableJson(report));
    expect(report).toMatchObject({
      schemaVersion: 1,
      reportType: "noelle-hexerei-guide-draft-projection",
      classification:
        "authenticated-offline-blocker-aware-guide-draft-projection",
      validationStatus: "completed-six-request-exact-field-state-projection",
      publicationStatus: "withheld-incomplete-evidence-drafts",
      promotionEligible: false,
    });
    expect(formatNoelleHexereiGuideDraftProjectionSummary(report)).toBe(
      "Projected 6 authenticated Noelle draft packets with 200 explicit fields and 128 blockers; all-local/partial/publishable/ER: 2/4/0/0.",
    );
  });

  it("authenticates the exact 123-path, 80-runtime, 16-JSON, two-binary closure", async () => {
    const expectedPaths = [
      ...new Set([
        ...NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
        NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
        GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
        NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CORE_RELATIVE_PATH,
        NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CLI_RELATIVE_PATH,
      ]),
    ].sort(compareText);
    expect(expectedPaths).toHaveLength(123);
    expect(NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS).toEqual(
      expectedPaths,
    );
    expect(NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS)
      .toHaveLength(80);
    expect(expectedPaths.filter((sourcePath) => sourcePath.endsWith(".json")))
      .toHaveLength(16);
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
      cp57ReportByteAndParsedObjectParity: true,
      exactCp57InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: 123,
      generatedFromCount: 123,
      runtimeInputPathCount: 80,
      jsonInputCount: 16,
      binaryRuntimeInputCount: 2,
    });
    expect(baseInput.technicalRequest).toEqual(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
    );
    expect(
      baseInput.cp57Input.sourceFiles.map(({ path: sourcePath }) => sourcePath),
    ).toEqual(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
    );
    expect(
      baseInput.cp57Input.generatedFrom.map(
        ({ path: sourcePath }) => sourcePath,
      ),
    ).toEqual(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
    );

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

    const cp57Bytes = requiredSourceBytes(
      baseInput,
      NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
    );
    expect(stableJson(JSON.parse(cp57Bytes.toString("utf8")))).toBe(
      stableJson(cp57Report),
    );
    expect(report.upstreamBoundary.cp57).toEqual({
      reportPath: NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
      reportFileSha256: sha256(cp57Bytes),
      canonicalObjectSha256: hashGuideDraftValue(cp57Report),
      aggregateAdmissionSha256:
        cp57Report.identityBoundary.aggregateAdmissionSha256,
      technicalRequestSha256:
        cp57Report.requestBoundary.requestCanonicalObjectSha256,
      freshlyAuthenticated: true,
      technicalCellRecomputationCountDuringAuthentication: 480,
      teamBuildMaterializationCountDuringAuthentication: 960,
    });
    expect(report.requestBoundary).toEqual({
      request: NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
      requestCanonicalObjectSha256: hashGuideDraftValue(
        NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
      ),
      projectionOnly: true,
      serializationOrderIsNotRank: true,
      energyRecoveryDeferred: true,
    });
    expect(report.packetFormatBoundary).toEqual({
      schemaVersion: GUIDE_DRAFT_PACKET_SCHEMA_VERSION,
      closedFieldStateMachine: true,
      exactFieldLevelUpstreamPointers: true,
      exactFieldAndBlockerHashes: true,
      projectorSuppliedExactFieldPolicy: true,
      unauthenticatedFieldProseSerialized: false,
      blockersReconstructableFromFieldStates: true,
      missingNeverSerializedAsZero: true,
      nullNeverSerializedAsDefaultSelection: true,
    });
  }, LONG_TIMEOUT);

  it("independently closes every runtime and implementation import", async () => {
    expect(NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS).toEqual(
      [
        ...NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_RUNTIME_INPUT_PATHS,
      ].sort(compareText),
    );
    expect(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS.some(
        (sourcePath) => sourcePath.includes("/ercalc/"),
      ),
    ).toBe(false);

    const declaredPaths = new Set<string>(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS,
    );
    const runtimePaths = new Set<string>(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_RUNTIME_INPUT_PATHS,
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

    const roots = [
      GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CORE_RELATIVE_PATH,
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_CLI_RELATIVE_PATH,
    ];
    const missingImplementationImports: string[] = [];
    const visited = new Set<string>();
    const queue = [...roots];
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

  it("projects all six requests in exact order without mixing entered and effective talents", () => {
    expect(
      report.packets.map(({ subject }) => subject.requestId),
    ).toEqual(
      EXPECTED_PACKETS.map(({ requestId }) => requestId),
    );
    expect(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST.exactPacketOrder,
    ).toEqual(EXPECTED_PACKETS.map(({ requestId }) => requestId));
    expect(new Set(report.packets.map(({ packetId }) => packetId)).size).toBe(
      6,
    );

    for (const [index, expected] of EXPECTED_PACKETS.entries()) {
      const packet = report.packets[index];
      const envelope =
        cp57Report.requestConditionedCandidateEnvelopes[index];
      expect(packet.packetId).toBe(
        expected.requestId + ":noelle:guide-draft-v1",
      );
      expect(packet.subject).toEqual({
        characterId: "noelle",
        requestId: expected.requestId,
      });
      expect(packet.upstream).toEqual({
        reportPath: NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
        reportCanonicalSha256: hashGuideDraftValue(cp57Report),
        envelopeId: envelope.envelopeId,
        envelopeJsonPointer:
          "/requestConditionedCandidateEnvelopes/" + index,
        envelopeCanonicalObjectSha256: hashGuideDraftValue(envelope),
        envelopeSha256: envelope.envelopeSha256,
        candidateId: envelope.candidateMatch.candidateId,
        candidateJsonPointer:
          "/requestConditionedCandidateEnvelopes/" +
          index +
          "/partialCandidate",
        candidateCanonicalObjectSha256: hashGuideDraftValue(
          envelope.partialCandidate,
        ),
        candidateSha256: envelope.candidateMatch.candidateSha256,
        profileId: expected.profileId,
      });
      expect(preservedValue(packet.fields.request.entered)).toEqual(
        expected.entered,
      );
      expect(
        preservedValue(packet.fields.request.runtimeEffectiveTalents),
      ).toEqual(expected.effective);
      expect(envelope.request).toEqual(expected.entered);
      expect(
        envelope.enteredAndRuntimeTalentBoundary.runtimeEffectiveTalentLevels,
      ).toEqual(expected.effective);
    }

    const c5q9 = requiredPacket("c5-q9");
    expect(
      (preservedValue(c5q9.fields.request.entered) as {
        enteredTalentLevels: { burst: number };
      }).enteredTalentLevels.burst,
    ).toBe(9);
    expect(
      (preservedValue(c5q9.fields.request.runtimeEffectiveTalents) as {
        burst: number;
      }).burst,
    ).toBe(12);
    expect(c5q9.upstream.profileId).toBe(
      "noelle-lower-investment-artifact-profile-v1",
    );
    const c6q9 = requiredPacket("c6-q9");
    expect(
      (preservedValue(c6q9.fields.request.entered) as {
        constellation: number;
        enteredTalentLevels: { burst: number };
      }),
    ).toMatchObject({
      constellation: 6,
      enteredTalentLevels: { burst: 9 },
    });
    expect(c6q9.upstream.profileId).toBe(
      "noelle-high-investment-artifact-profile-v1",
    );
  });

  it("validates all 200 closed field states and all 206 exact provenance references", () => {
    let provenanceCount = 0;
    for (const [index, packet] of report.packets.entries()) {
      expect(validatePacket(packet, packet)).toBe(packet);
      expect(packet.packetSha256).toBe(
        hashGuideDraftValue(omitKey(packet, "packetSha256")),
      );
      const entries = collectFieldEntries(packet.fields, "/fields");
      expect(entries).toHaveLength(EXPECTED_PACKETS[index].fieldCount);
      expect(new Set(entries.map(({ field }) => field.fieldId)).size).toBe(
        entries.length,
      );
      expect(new Set(entries.map(({ actualPath }) => actualPath)).size).toBe(
        entries.length,
      );
      const fieldsById = new Map(
        entries.map(({ field }) => [field.fieldId, field] as const),
      );
      for (const { field, actualPath } of entries) {
        expect(field.fieldPath).toBe(actualPath);
        expect(field.fieldSha256).toBe(
          hashGuideDraftValue(omitKey(field, "fieldSha256")),
        );
        expect(field.provenance.length).toBeGreaterThan(0);
        provenanceCount += field.provenance.length;
        for (const provenance of field.provenance) {
          const sourceObject = resolveGuideDraftJsonPointer(
            cp57Report,
            provenance.sourceObjectJsonPointer,
          );
          const sourceValue = resolveGuideDraftJsonPointer(
            cp57Report,
            provenance.sourceValueJsonPointer,
          );
          expect(provenance.sourceObjectCanonicalSha256).toBe(
            hashGuideDraftValue(sourceObject),
          );
          expect(provenance.sourceValueCanonicalSha256).toBe(
            hashGuideDraftValue(sourceValue),
          );
        }
        assertFieldPayloadMatchesFirstProvenance(field);
        if (field.state === "unselected") {
          expect(new Set(field.optionFieldIds).size).toBe(
            field.optionFieldIds.length,
          );
          for (const optionFieldId of field.optionFieldIds) {
            expect(fieldsById.has(optionFieldId)).toBe(true);
            expect(optionFieldId).not.toBe(field.fieldId);
          }
        }
      }
    }
    expect(
      report.packets.flatMap(({ fields }) =>
        collectFieldEntries(fields, "/fields"),
      ),
    ).toHaveLength(200);
    expect(provenanceCount).toBe(206);
    expect(report.summary.provenanceReferenceCount).toBe(206);
  });

  it("pins the exact 200-field state census and 19-base-plus-deltas blocker model", () => {
    const allFields = report.packets.flatMap(({ fields }) =>
      collectFieldEntries(fields, "/fields").map(({ field }) => field),
    );
    const allBlockers = report.packets.flatMap(({ blockers }) => blockers);
    expect(census(allFields, ({ state }) => state)).toEqual({
      "preserved-evidence": 60,
      "preserved-blocking-evidence": 30,
      "locally-admitted-relation": 12,
      "withheld-counterexample": 6,
      "guarded-unresolved-alternative": 8,
      unselected: 36,
      "missing-not-zero": 36,
      "not-computed": 6,
      "deferred-missing-not-zero": 6,
    });
    expect(allFields).toHaveLength(200);
    expect(allBlockers).toHaveLength(128);
    expect(new Set(allBlockers.map(({ blockerId }) => blockerId)).size).toBe(
      128,
    );

    const expectedGlobalCodes: Record<string, number> = {};
    for (const code of BASE_BLOCKER_CODES) expectedGlobalCodes[code] = 6;
    expectedGlobalCodes["guarded-alternative-unresolved"] = 8;
    expectedGlobalCodes["local-relation-counterexample"] = 6;
    expect(census(allBlockers, ({ code }) => code)).toEqual(
      expectedGlobalCodes,
    );

    for (const [index, packet] of report.packets.entries()) {
      const expected = EXPECTED_PACKETS[index];
      expect(packet.blockers).toHaveLength(expected.blockerCount);
      const expectedCodes: Record<string, number> = {};
      for (const code of BASE_BLOCKER_CODES) expectedCodes[code] = 1;
      if (expected.guardedCount > 0) {
        expectedCodes["guarded-alternative-unresolved"] =
          expected.guardedCount;
      }
      if (expected.withheldCount > 0) {
        expectedCodes["local-relation-counterexample"] =
          expected.withheldCount;
      }
      expect(census(packet.blockers, ({ code }) => code)).toEqual(
        expectedCodes,
      );

      const fieldById = new Map(
        collectFieldEntries(packet.fields, "/fields").map(
          ({ field }) => [field.fieldId, field] as const,
        ),
      );
      const linkedBlockerIds = [...fieldById.values()].flatMap(
        ({ blockerIds }) => blockerIds,
      );
      expect(linkedBlockerIds.sort(compareText)).toEqual(
        packet.blockers
          .map(({ blockerId }) => blockerId)
          .sort(compareText),
      );
      for (const field of fieldById.values()) {
        const shouldBeUnblocked =
          field.state === "preserved-evidence" ||
          field.state === "locally-admitted-relation";
        expect(field.blockerIds).toHaveLength(shouldBeUnblocked ? 0 : 1);
      }
      for (const blocker of packet.blockers) {
        const field = fieldById.get(blocker.fieldId);
        expect(field).toBeDefined();
        expect(blocker.blockerId).toBe(
          packet.packetId + ":" + blocker.fieldId + ":" + blocker.code,
        );
        expect(blocker.fieldPath).toBe(field?.fieldPath);
        expect(blocker.sourceFieldSha256).toBe(field?.fieldSha256);
        expect(blocker.blocksPublication).toBe(true);
        expect(field?.blockerIds).toContain(blocker.blockerId);
        expect(blocker.blockerSha256).toBe(
          hashGuideDraftValue(omitKey(blocker, "blockerSha256")),
        );
      }
      expect(packet.readiness.blockerCount).toBe(expected.blockerCount);
    }

    expect(report.summary).toMatchObject({
      fieldCount: 200,
      blockerCount: 128,
      baseBlockerCountPerPacket: 19,
      guardedAlternativeBlockerCount: 8,
      withheldRelationBlockerCount: 6,
      nullSelectionCount: 36,
    });
  });

  it("preserves exact weapon, artifact, and guarded main-stat options while selecting nothing", () => {
    const unselected: GuideDraftField[] = [];
    for (const [index, packet] of report.packets.entries()) {
      const expected = EXPECTED_PACKETS[index];
      const envelope =
        cp57Report.requestConditionedCandidateEnvelopes[index];
      expect(packet.fields.weapon.observedOptions).toHaveLength(1);
      expect(
        preservedValue(packet.fields.weapon.observedOptions[0]),
      ).toEqual(envelope.preservedSourceObservations.weaponOption);
      expect(
        preservedValue(packet.fields.artifacts.setOptions[0]),
      ).toEqual(envelope.preservedSourceObservations.artifactSet);
      expect(packet.fields.artifacts.setOptions).toHaveLength(1);

      unselected.push(
        packet.fields.weapon.selected,
        packet.fields.artifacts.selectedSet,
        packet.fields.artifacts.mainStats.sands.selected,
        packet.fields.artifacts.mainStats.goblet.selected,
        packet.fields.artifacts.mainStats.circlet.selected,
        packet.fields.substats.selectedAllocation,
      );
      expect(unselectedValue(packet.fields.weapon.selected)).toBeNull();
      expect(
        unselectedOptionFieldIds(packet.fields.weapon.selected),
      ).toEqual(["weapon.observed-option.gest"]);
      expect(unselectedValue(packet.fields.artifacts.selectedSet)).toBeNull();
      expect(
        unselectedOptionFieldIds(packet.fields.artifacts.selectedSet),
      ).toEqual(["artifacts.set-option.husk-4pc"]);

      let guardedCount = 0;
      for (const slot of ["sands", "goblet", "circlet"] as const) {
        const projected = packet.fields.artifacts.mainStats[slot];
        const sourceOptions =
          envelope.partialCandidate.artifactProfile.mainStats[slot].options;
        const observedSource = sourceOptions.filter(
          ({ conditionStatus }) =>
            conditionStatus !== "additional-source-guard-unresolved",
        );
        const guardedSource = sourceOptions.filter(
          ({ conditionStatus }) =>
            conditionStatus === "additional-source-guard-unresolved",
        );
        expect(
          projected.observedOptions.map(preservedValue),
        ).toEqual(observedSource);
        expect(
          projected.guardedAlternatives.map(guardedObservation),
        ).toEqual(guardedSource);
        expect(
          projected.guardedAlternatives.every(({ value }) => value === null),
        ).toBe(true);
        guardedCount += projected.guardedAlternatives.length;
        expect(unselectedValue(projected.selected)).toBeNull();
        expect(unselectedOptionFieldIds(projected.selected)).toEqual(
          [...projected.observedOptions, ...projected.guardedAlternatives].map(
            ({ fieldId }) => fieldId,
          ),
        );
      }
      expect(guardedCount).toBe(expected.guardedCount);
      if (expected.guardedCount === 2) {
        expect(
          packet.fields.artifacts.mainStats.sands.guardedAlternatives,
        ).toHaveLength(0);
        expect(
          guardedObservation(
            packet.fields.artifacts.mainStats.goblet.guardedAlternatives[0],
          ),
        ).toMatchObject({
          conditionStatus: "additional-source-guard-unresolved",
          statIds: ["def%"],
        });
        expect(
          guardedObservation(
            packet.fields.artifacts.mainStats.circlet.guardedAlternatives[0],
          ),
        ).toMatchObject({
          conditionStatus: "additional-source-guard-unresolved",
          statIds: ["def%"],
        });
      }
      expect(
        preservedValue(packet.fields.substats.sourceGroups),
      ).toEqual(
        envelope.preservedSourceObservations.substatPriorityOriginal.groups,
      );
    }
    expect(unselected).toHaveLength(36);
    expect(unselected.every(({ state, value }) =>
      state === "unselected" && value === null)).toBe(true);
  });

  it("projects exactly 12 admitted and six withheld request-local relations", () => {
    const allOverlays: GuideDraftField[] = [];
    for (const [index, packet] of report.packets.entries()) {
      const expected = EXPECTED_PACKETS[index];
      const envelope =
        cp57Report.requestConditionedCandidateEnvelopes[index];
      const overlays = packet.fields.substats.localRelationOverlays;
      allOverlays.push(...overlays);
      expect(overlays).toHaveLength(3);
      for (const [relationIndex, overlay] of overlays.entries()) {
        const relation = envelope.relationAdmissions[relationIndex];
        expect(overlay.fieldId).toBe(
          "substats.local-relation." + relation.sourceRelationId,
        );
        if (
          relation.admissionStatus ===
          "admitted-unanimous-across-all-16-tested-contexts"
        ) {
          expect(overlay.state).toBe("locally-admitted-relation");
          expect(preservedValue(overlay)).toEqual(relation);
          expect(overlay.blockerIds).toEqual([]);
        } else {
          expect(overlay.state).toBe("withheld-counterexample");
          expect(overlay.value).toBeNull();
          expect(withheldObservation(overlay)).toEqual(relation);
          expect(overlay.blockerIds).toHaveLength(1);
        }
      }
      expect(
        overlays.filter(
          ({ state }) => state === "locally-admitted-relation",
        ),
      ).toHaveLength(expected.admittedCount);
      expect(
        overlays.filter(({ state }) => state === "withheld-counterexample"),
      ).toHaveLength(expected.withheldCount);
      expect(packet.readiness).toEqual({
        observationProjection: "complete",
        localRelationProjection: expected.relationProjection,
        guideReadiness: "incomplete",
        publicationStatus: "withheld",
        blockerCount: expected.blockerCount,
      });
    }
    expect(census(allOverlays, ({ state }) => state)).toEqual({
      "locally-admitted-relation": 12,
      "withheld-counterexample": 6,
    });
    expect(
      report.packets.filter(
        ({ readiness }) =>
          readiness.localRelationProjection === "all-locally-admitted",
      ).map(({ subject }) => subject.requestId),
    ).toEqual(["c0-q9", "c5-q10"]);
    expect(
      report.packets.filter(
        ({ readiness }) =>
          readiness.localRelationProjection ===
          "partial-counterexamples-preserved",
      ).map(({ subject }) => subject.requestId),
    ).toEqual(["c5-q9", "c0-q10", "c6-q9", "c6-q10"]);
  });

  it("keeps every authority, selection, computation, and ER gap explicit rather than defaulting it", () => {
    for (const [index, packet] of report.packets.entries()) {
      const envelope =
        cp57Report.requestConditionedCandidateEnvelopes[index];
      const candidate = envelope.partialCandidate;
      expect(preservedValue(packet.fields.team.exactContext)).toEqual(
        envelope.preservedSourceObservations.exactTeam,
      );
      expect(preservedValue(packet.fields.team.noelleInvestment)).toEqual(
        envelope.preservedSourceObservations.exactTeam.noelleInvestment,
      );
      expect(preservedValue(packet.fields.authority.sourceReview)).toBe(
        "unreviewed",
      );
      expect(
        preservedValue(packet.fields.authority.sourceAuthoredRequestCoverage),
      ).toBe(false);
      expect(
        preservedValue(packet.fields.authority.compositionAuthorship),
      ).toEqual(candidate.authorship);
      expect(
        preservedValue(packet.fields.authority.completeArtifactAssignment),
      ).toBe(false);
      expect(preservedValue(packet.fields.authority.completeBuild)).toBe(false);

      expect(missingMarker(packet.fields.weapon.refinement)).toBeNull();
      expect(
        packet.fields.weapon.refinement.provenance.map(
          ({ sourceValueJsonPointer }) => sourceValueJsonPointer,
        ),
      ).toEqual([
        "/requestConditionedCandidateEnvelopes/" +
          index +
          "/partialCandidate/weaponOption/refinement",
        "/requestConditionedCandidateEnvelopes/" +
          index +
          "/partialCandidate/weaponOption/refinementStatus",
      ]);
      expect(
        missingMarker(packet.fields.weapon.quantitativePerformance),
      ).toBe("missing-not-zero");
      expect(missingMarker(packet.fields.substats.scalarWeights)).toBeNull();
      expect(missingMarker(packet.fields.computation.enemyScenario)).toBe(
        "missing-not-zero",
      );
      expect(missingMarker(packet.fields.computation.formulaCounts)).toBe(
        "missing-not-zero",
      );
      expect(
        missingMarker(
          packet.fields.computation.rotationTimingAndBuffCoverage,
        ),
      ).toBe("missing-not-zero");
      expect(missingMarker(packet.fields.computation.teamTotalDamage)).toBe(
        "not-computed",
      );
      expect(missingMarker(packet.fields.computation.energyRecharge)).toBe(
        "deferred-missing-not-zero",
      );
      expect(packet.fields.computation.teamTotalDamage.state).toBe(
        "not-computed",
      );
      expect(packet.fields.computation.energyRecharge.state).toBe(
        "deferred-missing-not-zero",
      );

      const missingFields = collectFieldEntries(packet.fields, "/fields")
        .map(({ field }) => field)
        .filter(({ state }) => state === "missing-not-zero");
      expect(missingFields).toHaveLength(6);
      expect(missingFields.every(({ value }) => value === null)).toBe(true);
      expect(
        collectFieldEntries(packet.fields, "/fields")
          .map(({ field }) => field)
          .filter(
            ({ state }) =>
              state === "not-computed" ||
              state === "deferred-missing-not-zero",
          ),
      ).toHaveLength(2);
    }
  });

  it("recomputes every field, blocker, packet, and aggregate identity", () => {
    const fieldIdentitySetSha256 = hashGuideDraftValue(
      report.packets.flatMap((packet) =>
        collectFieldEntries(packet.fields, "/fields").map(({ field }) => ({
          packetId: packet.packetId,
          fieldId: field.fieldId,
          fieldSha256: field.fieldSha256,
        })),
      ),
    );
    const blockers = report.packets.flatMap(({ blockers }) => blockers);
    const blockerIdentitySetSha256 = hashGuideDraftValue(
      blockers.map(({ blockerId, blockerSha256 }) => ({
        blockerId,
        blockerSha256,
      })),
    );
    const relationOverlayIdentitySetSha256 = hashGuideDraftValue(
      report.packets.flatMap((packet) =>
        packet.fields.substats.localRelationOverlays.map(
          ({ fieldId, fieldSha256 }) => ({
            packetId: packet.packetId,
            fieldId,
            fieldSha256,
          }),
        ),
      ),
    );
    const packetIdentitySetSha256 = hashGuideDraftValue(
      report.packets.map(({ packetId, packetSha256 }) => ({
        packetId,
        packetSha256,
      })),
    );
    const generatedFromSetSha256 = hashGuideDraftValue(report.generatedFrom);
    const cp57CanonicalObjectSha256 = hashGuideDraftValue(cp57Report);
    const technicalRequestSha256 = hashGuideDraftValue(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
    );
    expect(report.identityBoundary).toEqual({
      generatedFromSetSha256,
      fieldIdentitySetSha256,
      blockerIdentitySetSha256,
      relationOverlayIdentitySetSha256,
      packetIdentitySetSha256,
      aggregateProjectionSha256: hashGuideDraftValue({
        generatedFromSetSha256,
        cp57CanonicalObjectSha256,
        cp57AggregateAdmissionSha256:
          cp57Report.identityBoundary.aggregateAdmissionSha256,
        cp57TechnicalRequestSha256:
          cp57Report.requestBoundary.requestCanonicalObjectSha256,
        technicalRequestSha256,
        fieldIdentitySetSha256,
        blockerIdentitySetSha256,
        relationOverlayIdentitySetSha256,
        packetIdentitySetSha256,
      }),
      serializationOrderIsNotRank: true,
    });
  });

  it("keeps guide, rank, optimizer, damage, rotation, and ER claims closed", () => {
    expect(report.summary).toEqual({
      packetCount: 6,
      completeObservationProjectionCount: 6,
      allRelationsAdmittedPacketCount: 2,
      partialRelationPacketCount: 4,
      publicationReadyPacketCount: 0,
      fieldCount: 200,
      provenanceReferenceCount: 206,
      preservedEvidenceFieldCount: 60,
      preservedBlockingEvidenceFieldCount: 30,
      locallyAdmittedRelationFieldCount: 12,
      withheldCounterexampleFieldCount: 6,
      withheldInconclusiveFieldCount: 0,
      guardedUnresolvedAlternativeFieldCount: 8,
      unselectedFieldCount: 36,
      missingNotZeroFieldCount: 36,
      notComputedFieldCount: 6,
      deferredMissingNotZeroFieldCount: 6,
      blockerCount: 128,
      baseBlockerCountPerPacket: 19,
      guardedAlternativeBlockerCount: 8,
      withheldRelationBlockerCount: 6,
      nullSelectionCount: 36,
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
        "cp58-projection-only-excludes-upstream-authentication-work",
      upstreamAuthenticationOperationsExcluded: true,
      upstreamCp57TechnicalCellsFreshlyRecomputedDuringAuthentication: 480,
      upstreamCp57TeamBuildsFreshlyMaterializedDuringAuthentication: 960,
      packetProjectionCount: 6,
      fieldProjectionCount: 200,
      blockerConstructionCount: 128,
      relationOverlayProjectionCount: 18,
      guardedAlternativeProjectionCount: 8,
      nullSelectionProjectionCount: 36,
      selectionExecutionCount: 0,
      rankingCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      damageComputationCount: 0,
      rotationReplayCount: 0,
      teamTotalDamageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    });
    const packetCapability = {
      supportsDraftSerialization: true,
      supportsPreservedObservationProjection: true,
      supportsRequestLocalRelationStateProjection: true,
      supportsGuideClaims: false,
      supportsPublication: false,
      supportsTeamRecommendationClaims: false,
      supportsEquipmentRecommendationClaims: false,
      supportsStatRecommendationClaims: false,
      supportsRankClaims: false,
      supportsWinnerClaims: false,
      supportsScalarWeights: false,
      supportsTotalStatOrder: false,
      supportsIdealStatAllocation: false,
      supportsOptimizerClaims: false,
      supportsAutoTuneClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRechargeClaims: false,
    } as const;
    expect(report).toMatchObject({
      ...omitKey(packetCapability, "supportsDraftSerialization"),
      supportsDraftPacketSerialization: true,
    });
    for (const packet of report.packets) {
      expect(packet.capabilityBoundary).toEqual(packetCapability);
      expect(packet.readiness).toMatchObject({
        observationProjection: "complete",
        guideReadiness: "incomplete",
        publicationStatus: "withheld",
      });
      expect(packet.blockers.length).toBeGreaterThanOrEqual(19);
    }
    expect(report.cautions).toHaveLength(4);
    expect(report.prohibitedInterpretations).toHaveLength(4);
  });

  it("rejects provenance, field, blocker, packet-anchor, readiness, option-link, and extra-key tampering", () => {
    const canonicalPacket = report.packets[0];
    const c5CanonicalPacket = requiredPacket("c5-q9");
    const highCanonicalPacket = requiredPacket("c0-q10");
    const provenanceTamper = structuredClone(canonicalPacket);
    provenanceTamper.fields.request.entered.provenance[0]
      .sourceValueCanonicalSha256 = "0".repeat(64);
    provenanceTamper.fields.request.entered = resealField(
      provenanceTamper.fields.request.entered,
    );
    expect(() =>
      validatePacket(resealPacket(provenanceTamper), canonicalPacket),
    ).toThrow("provenance hash drifted");

    const fieldTamper = structuredClone(canonicalPacket);
    (
      fieldTamper.fields.weapon.selected as unknown as { value: unknown }
    ).value = "gest-of-the-mighty-wolf";
    fieldTamper.fields.weapon.selected = resealField(
      fieldTamper.fields.weapon.selected,
    );
    synchronizeFieldBlockers(
      fieldTamper,
      fieldTamper.fields.weapon.selected,
    );
    expect(() =>
      validatePacket(resealPacket(fieldTamper), canonicalPacket),
    ).toThrow("unselected boundary drifted");

    const blockerTamper = structuredClone(canonicalPacket);
    blockerTamper.blockers[0].fieldPath = "/fields/forged";
    blockerTamper.blockers[0] = resealBlocker(blockerTamper.blockers[0]);
    expect(() =>
      validatePacket(resealPacket(blockerTamper), canonicalPacket),
    ).toThrow("is orphaned");

    const anchorTamper = structuredClone(canonicalPacket);
    anchorTamper.upstream.envelopeJsonPointer =
      "/requestConditionedCandidateEnvelopes/1";
    expect(() =>
      validatePacket(resealPacket(anchorTamper), canonicalPacket),
    ).toThrow("upstream anchor hash drifted");

    const reportPathTamper = structuredClone(canonicalPacket);
    reportPathTamper.upstream.reportPath = "reports/forged.json";
    expect(() =>
      validatePacket(resealPacket(reportPathTamper), canonicalPacket),
    ).toThrow(
      "upstream report path drifted",
    );

    const subjectTamper = structuredClone(canonicalPacket);
    subjectTamper.subject.characterId = "itto";
    subjectTamper.packetId = "c0-q9:itto:guide-draft-v1";
    expect(() =>
      validatePacket(resealPacket(subjectTamper), canonicalPacket),
    ).toThrow(
      "subject is not bound to its upstream request",
    );

    const readinessTamper = structuredClone(c5CanonicalPacket);
    readinessTamper.readiness.localRelationProjection =
      "all-locally-admitted";
    expect(() =>
      validatePacket(resealPacket(readinessTamper), c5CanonicalPacket),
    ).toThrow("local-relation readiness drifted");

    const optionLinkTamper = structuredClone(canonicalPacket);
    (
      optionLinkTamper.fields.weapon.selected as Extract<
        GuideDraftField,
        { state: "unselected" }
      >
    ).optionFieldIds = ["forged-option"];
    optionLinkTamper.fields.weapon.selected = resealField(
      optionLinkTamper.fields.weapon.selected,
    );
    synchronizeFieldBlockers(
      optionLinkTamper,
      optionLinkTamper.fields.weapon.selected,
    );
    expect(() =>
      validatePacket(resealPacket(optionLinkTamper), canonicalPacket),
    ).toThrow("unresolved option-field link");

    const relationStateTamper = structuredClone(canonicalPacket);
    const relationField = relationStateTamper.fields.substats
      .localRelationOverlays[0];
    (relationField as unknown as { state: string }).state =
      "preserved-evidence";
    relationStateTamper.fields.substats.localRelationOverlays[0] =
      resealField(relationField);
    expect(() =>
      validatePacket(resealPacket(relationStateTamper), canonicalPacket),
    ).toThrow("cannot promote a blocked or discriminated source value");

    const guardStateTamper = structuredClone(highCanonicalPacket);
    const guardField = guardStateTamper.fields.artifacts.mainStats.goblet
      .guardedAlternatives[0];
    (guardField as unknown as { state: string }).state =
      "withheld-counterexample";
    guardStateTamper.fields.artifacts.mainStats.goblet.guardedAlternatives[0] =
      resealField(guardField);
    synchronizeFieldBlockers(
      guardStateTamper,
      guardStateTamper.fields.artifacts.mainStats.goblet
        .guardedAlternatives[0],
    );
    expect(() =>
      validatePacket(resealPacket(guardStateTamper), highCanonicalPacket),
    ).toThrow("disagrees with its upstream admission status");

    const missingStateTamper = structuredClone(canonicalPacket);
    (
      missingStateTamper.fields.computation.enemyScenario as unknown as {
        state: string;
      }
    ).state = "not-computed";
    missingStateTamper.fields.computation.enemyScenario = resealField(
      missingStateTamper.fields.computation.enemyScenario,
    );
    synchronizeFieldBlockers(
      missingStateTamper,
      missingStateTamper.fields.computation.enemyScenario,
    );
    expect(() =>
      validatePacket(resealPacket(missingStateTamper), canonicalPacket),
    ).toThrow("does not preserve a not-computed marker");

    const sameStateRelabelTamper = structuredClone(canonicalPacket);
    (
      sameStateRelabelTamper.fields.request.entered as unknown as {
        value: unknown;
        provenance: GuideDraftField["provenance"];
      }
    ).value = structuredClone(
      preservedValue(
        sameStateRelabelTamper.fields.request.runtimeEffectiveTalents,
      ),
    );
    sameStateRelabelTamper.fields.request.entered.provenance = structuredClone(
      sameStateRelabelTamper.fields.request.runtimeEffectiveTalents.provenance,
    );
    sameStateRelabelTamper.fields.request.entered = resealField(
      sameStateRelabelTamper.fields.request.entered,
    );
    expect(() =>
      validatePacket(resealPacket(sameStateRelabelTamper), canonicalPacket),
    ).toThrow("field-state policy drifted");

    const emptyContainerTamper = structuredClone(canonicalPacket);
    (
      emptyContainerTamper.fields as unknown as Record<string, unknown>
    ).forgedEmptyContainer = [];
    expect(() =>
      validatePacket(resealPacket(emptyContainerTamper), canonicalPacket),
    ).toThrow("field-state policy drifted");

    const rawWithRank = omitKey(
      structuredClone(report.packets[0]),
      "packetSha256",
    ) as unknown as Record<string, unknown>;
    rawWithRank.rank = 1;
    const extraKeyTamper = finalizeGuideDraftPacket(
      rawWithRank as Parameters<typeof finalizeGuideDraftPacket>[0],
    );
    expect(() =>
      validatePacket(
        extraKeyTamper as NoelleHexereiGuideDraftPacket,
        canonicalPacket,
      ),
    ).toThrow("has an illegal object shape");
  });

  it("rejects request, source, hash, CP57 split-brain, nested-input, and serialized-report tampering", async () => {
    const requestTamper = fixture();
    (
      requestTamper.technicalRequest as unknown as {
        rankingRequested: boolean;
      }
    ).rankingRequested = true;
    await expect(
      buildNoelleHexereiGuideDraftProjectionReport(requestTamper),
    ).rejects.toThrow("technical request drifted");

    const pathTamper = fixture();
    pathTamper.sourceFiles = pathTamper.sourceFiles.slice(1);
    await expect(
      buildNoelleHexereiGuideDraftProjectionReport(pathTamper),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const hashTamper = fixture();
    hashTamper.generatedFrom = hashTamper.generatedFrom.map((entry, index) =>
      index === 0 ? { ...entry, sha256: "0".repeat(64) } : entry,
    );
    await expect(
      buildNoelleHexereiGuideDraftProjectionReport(hashTamper),
    ).rejects.toThrow("source/hash authentication drifted");

    const splitBrain = fixture();
    (
      splitBrain.cp57ReportInput.summary as unknown as {
        relationAdmissionCount: number;
      }
    ).relationAdmissionCount = 17;
    await expect(
      buildNoelleHexereiGuideDraftProjectionReport(splitBrain),
    ).rejects.toThrow(
      "CP57 durable report bytes disagree with the supplied parsed object",
    );

    const nestedInputTamper = fixture();
    nestedInputTamper.cp57Input.sourceFiles =
      nestedInputTamper.cp57Input.sourceFiles.slice(1);
    await expect(
      buildNoelleHexereiGuideDraftProjectionReport(nestedInputTamper),
    ).rejects.toThrow(
      "CP57 input is not the exact projection of the outer authenticated byte closure",
    );

    const serializedTamper = structuredClone(durableReport);
    (
      serializedTamper as unknown as { supportsRankClaims: boolean }
    ).supportsRankClaims = true;
    serializedTamper.packets[0].readiness.guideReadiness =
      "incomplete";
    const authentication =
      await authenticateNoelleHexereiGuideDraftProjectionReport(
        serializedTamper,
        baseInput,
      );
    expect(authentication).toEqual({
      authenticated: false,
      reason: "serialized-report-mismatch",
      message:
        "The serialized CP58 report does not match a fresh reconstruction from authenticated CP57 evidence.",
    });
  }, LONG_TIMEOUT);
});

function requiredPacket(requestId: string): NoelleHexereiGuideDraftPacket {
  const packet = report.packets.find(
    ({ subject }) => subject.requestId === requestId,
  );
  if (!packet) throw new Error("Missing CP58 packet " + requestId + ".");
  return packet;
}

function preservedValue(field: GuideDraftField): unknown {
  if (
    field.state !== "preserved-evidence" &&
    field.state !== "preserved-blocking-evidence" &&
    field.state !== "locally-admitted-relation"
  ) {
    throw new Error("Expected a preserved-value field, got " + field.state + ".");
  }
  return field.value;
}

function guardedObservation(field: GuideDraftField): unknown {
  if (field.state !== "guarded-unresolved-alternative") {
    throw new Error("Expected a guarded field, got " + field.state + ".");
  }
  return field.preservedObservation;
}

function withheldObservation(field: GuideDraftField): unknown {
  if (
    field.state !== "withheld-counterexample" &&
    field.state !== "withheld-inconclusive"
  ) {
    throw new Error("Expected a withheld field, got " + field.state + ".");
  }
  return field.preservedObservation;
}

function unselectedValue(field: GuideDraftField): null {
  if (field.state !== "unselected") {
    throw new Error("Expected an unselected field, got " + field.state + ".");
  }
  return field.value;
}

function unselectedOptionFieldIds(field: GuideDraftField): string[] {
  if (field.state !== "unselected") {
    throw new Error("Expected an unselected field, got " + field.state + ".");
  }
  return field.optionFieldIds;
}

function missingMarker(field: GuideDraftField): unknown {
  if (
    field.state !== "missing-not-zero" &&
    field.state !== "not-computed" &&
    field.state !== "deferred-missing-not-zero"
  ) {
    throw new Error("Expected a missing/computation field, got " + field.state + ".");
  }
  expect(field.value).toBeNull();
  return field.upstreamMarker;
}

function assertFieldPayloadMatchesFirstProvenance(
  field: GuideDraftField,
): void {
  const expectedHash = field.provenance[0].sourceValueCanonicalSha256;
  switch (field.state) {
    case "preserved-evidence":
    case "preserved-blocking-evidence":
    case "locally-admitted-relation":
      expect(hashGuideDraftValue(field.value), field.fieldId).toBe(
        expectedHash,
      );
      break;
    case "withheld-counterexample":
    case "withheld-inconclusive":
    case "guarded-unresolved-alternative":
      expect(field.value, field.fieldId).toBeNull();
      expect(
        hashGuideDraftValue(field.preservedObservation),
        field.fieldId,
      ).toBe(expectedHash);
      break;
    case "unselected":
      expect(field.value, field.fieldId).toBeNull();
      expect(hashGuideDraftValue(null), field.fieldId).toBe(expectedHash);
      break;
    case "missing-not-zero":
    case "not-computed":
    case "deferred-missing-not-zero":
      expect(field.value, field.fieldId).toBeNull();
      expect(hashGuideDraftValue(field.upstreamMarker), field.fieldId).toBe(
        expectedHash,
      );
      break;
  }
}

function collectFieldEntries(
  value: unknown,
  pointer: string,
): Array<{ field: GuideDraftField; actualPath: string }> {
  if (looksLikeField(value)) {
    return [{ field: value as GuideDraftField, actualPath: pointer }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectFieldEntries(entry, pointer + "/" + index),
    );
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    collectFieldEntries(
      entry,
      pointer + "/" + escapeJsonPointerSegment(key),
    ),
  );
}

function looksLikeField(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.fieldId === "string" &&
    typeof value.fieldPath === "string" &&
    typeof value.state === "string" &&
    typeof value.fieldSha256 === "string"
  );
}

function resealField(field: GuideDraftField): GuideDraftField {
  return finalizeGuideDraftField(
    omitKey(field, "fieldSha256") as Parameters<
      typeof finalizeGuideDraftField
    >[0],
  );
}

function resealBlocker(blocker: GuideDraftBlocker): GuideDraftBlocker {
  return finalizeGuideDraftBlocker(
    omitKey(blocker, "blockerSha256"),
  );
}

function resealPacket(
  packet: NoelleHexereiGuideDraftPacket,
): NoelleHexereiGuideDraftPacket {
  return finalizeGuideDraftPacket(
    omitKey(packet, "packetSha256"),
  );
}

function validatePacket(
  packet: NoelleHexereiGuideDraftPacket,
  canonicalPacket: NoelleHexereiGuideDraftPacket,
): NoelleHexereiGuideDraftPacket {
  return validateGuideDraftPacket(
    packet,
    cp57Report,
    NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
    buildGuideDraftFieldPolicy(
      canonicalPacket.fields,
      canonicalPacket.blockers,
    ),
  );
}

function synchronizeFieldBlockers(
  packet: NoelleHexereiGuideDraftPacket,
  field: GuideDraftField,
): void {
  for (const blockerId of field.blockerIds) {
    const index = packet.blockers.findIndex(
      (blocker) => blocker.blockerId === blockerId,
    );
    if (index < 0) throw new Error("Missing blocker " + blockerId + ".");
    packet.blockers[index] = finalizeGuideDraftBlocker({
      ...omitKey(packet.blockers[index], "blockerSha256"),
      sourceFieldSha256: field.fieldSha256,
    });
  }
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

function fixture(): NoelleHexereiGuideDraftProjectionInput {
  return structuredClone(baseInput);
}

function requiredSourceBytes(
  input: NoelleHexereiGuideDraftProjectionInput,
  sourcePath: string,
): Buffer {
  const source = input.sourceFiles.find(
    ({ path: candidatePath }) => candidatePath === sourcePath,
  );
  if (!source) throw new Error("Missing source bytes " + sourcePath + ".");
  return Buffer.from(source.bytesBase64, "base64");
}

function omitKey<T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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
