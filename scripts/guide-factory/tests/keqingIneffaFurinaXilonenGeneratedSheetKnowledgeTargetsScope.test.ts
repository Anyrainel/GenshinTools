import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import {
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SEMANTIC_INPUT_PATHS,
  type BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
} from "../src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets";
import {
  authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
  buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAuthenticationInput,
  deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION,
  requireKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope,
} from "../src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsScope";
import type { KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport } from "../src/keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "../src/paths";
import { authenticateScopedSemanticDependencies } from "../src/scopedSemanticDependency";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
} from "../src/schemas";

const DEFAULT_STAT_RECORD_ID =
  "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i";
const DEFAULT_SANDS_CLAIM_ID = `${DEFAULT_STAT_RECORD_ID}:main-stat:sands:0`;

describe("CP39 generated-sheet knowledge-target semantic scope", () => {
  it("authenticates the exact selected records and all 26 normalized parities", async () => {
    const input = await fixture();
    const result =
      authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        input,
      );
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") throw new Error("Expected accepted scope.");
    expect(result.audit).toMatchObject({
      scopeId:
        KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.scopeId,
      selector: {
        manifestSha256:
          KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.manifestSha256,
      },
      scopeProjectionSha256:
        KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.scopeProjectionSha256,
    });
    expect(result.audit.dependencies).toHaveLength(11);
    expect(
      result.audit.dependencies.map(
        ({ selectedEntries }) => selectedEntries.length,
      ),
    ).toEqual([7, 12, 4, 1, 5, 5, 4, 12, 2, 1, 5]);
    expect(result.audit.parities).toHaveLength(26);
    expect(
      result.audit.parities.every(
        ({ status, leftNormalizedSha256, rightNormalizedSha256 }) =>
          status === "exact" &&
          leftNormalizedSha256 === rightNormalizedSha256,
      ),
    ).toBe(true);

    const selected =
      requireKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        input,
      );
    expect(selected.repositoryRecords).toHaveLength(7);
    expect(selected.presetGuides).toHaveLength(4);
    expect(selected.presetSnapshotEnvelope).toEqual({
      key: "genshintools-preset-snapshot-envelope",
      schemaVersion: 1,
      sourceId: "genshintools-presets",
    });
    expect(selected.presetBuilds).toHaveLength(5);
    expect(selected.liveBuilds).toHaveLength(5);
    expect(selected.liveCharacterBuilds).toHaveLength(4);
    expect(selected.evidence.claims).toHaveLength(12);
    expect(selected.evidence.sourceBoundaries).toHaveLength(2);
    expect(selected.cp36ActiveArtifacts).toHaveLength(5);
    expect(
      selected.cp36ActiveArtifacts.map(({ occurrenceId }) => occurrenceId),
    ).toEqual(
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS.map(
        ({ occurrenceId }) => occurrenceId,
      ),
    );
  });

  it("has no live weapon dependency and accepts a carrier with weapon arrays removed", async () => {
    const input = await fixture();
    const live = input.liveBuildPreset as { characterWeapons?: unknown };
    delete live.characterWeapons;

    const authenticationInput =
      buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAuthenticationInput(
        input,
      );
    expect(
      authenticationInput.manifest.dependencies.some(
        ({ collectionPath }) => collectionPath.includes("characterWeapons"),
      ),
    ).toBe(false);
    expect(
      authenticationInput.dependencies.some(({ collectionPath }) =>
        collectionPath.includes("characterWeapons"),
      ),
    ).toBe(false);
    expect(
      authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        input,
      ).status,
    ).toBe("accepted");
  });

  it("keeps the accepted audit stable under unrelated carrier and record drift", async () => {
    const baseline = await fixture();
    const expected =
      authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        baseline,
      );
    expect(expected.status).toBe("accepted");
    const changed = structuredClone(baseline);

    changed.repository.schemaVersion = 2 as 1;
    changed.repository.generatedFrom.push({
      sourceId: "kqm",
      files: [{ path: "unrelated.json", sha256: "e".repeat(64) }],
    });
    (
      changed.genshinToolsSnapshot as unknown as Record<string, unknown>
    ).unrelatedEnvelope = "ignored";
    changed.genshinToolsSnapshot.capturedAt = "2099-01-01";
    changed.genshinToolsSnapshot.sourceRevision.files.push({
      path: "unrelated-live-source.json",
      sha256: "c".repeat(64),
    });
    changed.evidenceReport.generatedFrom.push({
      path: "unrelated-evidence-input.json",
      sha256: "d".repeat(64),
    });
    changed.equipmentLatticeReport.summary.candidateNodeCount = 1;

    const live = changed.liveBuildPreset as {
      builds: Record<string, unknown>;
      characterBuilds: Record<string, unknown>;
      characterWeapons?: Record<string, unknown>;
    };
    live.builds.UNRELATED = {
      id: "UNRELATED",
      composition: "not-projectable-and-not-selected",
    };
    live.characterBuilds.unrelated = ["UNRELATED"];
    live.characterWeapons = { unrelated: ["dull_blade"] };

    const unrelatedOccurrence =
      changed.equipmentLatticeReport.inventoryBoundary.occurrences.find(
        ({ occurrenceId }) => occurrenceId.endsWith(":artifact:0:1"),
      );
    if (unrelatedOccurrence) unrelatedOccurrence.equipmentId = "4pc:unselected";

    const observed =
      authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        changed,
      );
    expect(observed).toEqual(expected);
  });

  it("rejects preset snapshot sourceId and schemaVersion drift", async () => {
    const source = await fixture();
    source.genshinToolsSnapshot.sourceId = "legacy-team-research" as "genshintools-presets";
    expect(
      authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        source,
      ).status,
    ).toBe("rejected");

    const schema = await fixture();
    schema.genshinToolsSnapshot.schemaVersion = 2 as 1;
    expect(
      authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        schema,
      ).status,
    ).toBe("rejected");
  });

  it("rejects missing, duplicate, and selected payload drift", async () => {
    const missing = await fixture();
    const live = missing.liveBuildPreset as {
      characterBuilds: Record<string, unknown>;
    };
    delete live.characterBuilds.xilonen;
    expect(
      rejectionCodes(
        deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate(
          missing,
        ),
      ),
    ).toContain("selection.required_key_missing");

    const duplicate = await fixture();
    duplicate.repository.records.push(
      structuredClone(requiredRepositoryRecord(duplicate.repository, DEFAULT_STAT_RECORD_ID)),
    );
    expect(
      rejectionCodes(
        deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate(
          duplicate,
        ),
      ),
    ).toContain("selection.required_key_duplicated");

    const drifted = await fixture();
    requiredSourceBoundary(drifted.evidenceReport, DEFAULT_STAT_RECORD_ID).reviewStatus =
      "reviewed";
    expect(
      authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
        drifted,
      ).status,
    ).toBe("rejected");
  });

  it("rejects build, claim-entry, and active-artifact normalized parity drift", async () => {
    const build = await fixture();
    const live = build.liveBuildPreset as {
      builds: Record<string, { sandsWeights: Array<{ stat: string }> }>;
    };
    live.builds.FeFiQU8!.sandsWeights[0]!.stat = "hp%";
    expect(
      rejectionCodes(
        deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate(
          build,
        ),
      ),
    ).toContain("parity.normalized_payload_mismatch");

    const claim = await fixture();
    const selectedClaim = requiredEvidenceClaim(
      claim.evidenceReport,
      DEFAULT_SANDS_CLAIM_ID,
    );
    if (selectedClaim.sourceClaim.kind !== "main-stat") {
      throw new Error("Expected main-stat claim.");
    }
    selectedClaim.sourceClaim.statIds = ["hp%"];
    expect(
      rejectionCodes(
        deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate(
          claim,
        ),
      ),
    ).toContain("parity.normalized_payload_mismatch");

    const artifact = await fixture();
    const occurrenceId =
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS[0]
        .occurrenceId;
    requiredOccurrence(artifact.equipmentLatticeReport, occurrenceId).equipmentId =
      "4pc:gilded_dreams";
    expect(
      rejectionCodes(
        deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate(
          artifact,
        ),
      ),
    ).toContain("parity.normalized_payload_mismatch");
  });

  it("binds selector identity and projections to the pinned manifest", async () => {
    const authenticationInput =
      buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAuthenticationInput(
        await fixture(),
      );
    authenticationInput.manifest.dependencies[0].projectionAdapterId =
      "forged-projection-adapter";
    const forged = authenticateScopedSemanticDependencies(authenticationInput);
    expect(forged.status).toBe("rejected");
    if (forged.status !== "rejected") throw new Error("Expected rejection.");
    expect(forged.issues.map(({ code }) => code)).toContain(
      "authentication.manifest_mismatch",
    );
  });
});

async function fixture(): Promise<BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput> {
  const values = await Promise.all(
    KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SEMANTIC_INPUT_PATHS.map(
      (relativePath) => readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ),
  );
  return {
    equipmentLatticeReport:
      values[0] as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
    repository: values[1] as KnowledgeRepository,
    genshinToolsSnapshot: values[2] as GenshinToolsPresetSnapshot,
    liveBuildPreset: values[3],
    evidenceReport:
      values[4] as KeqingLunarEquipmentEvidenceValidationReport,
  };
}

function rejectionCodes(
  result: ReturnType<
    typeof deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate
  >,
): string[] {
  if (result.status !== "rejected") throw new Error("Expected rejected scope.");
  return result.issues.map(({ code }) => code);
}

function requiredRepositoryRecord(repository: KnowledgeRepository, id: string) {
  const record = repository.records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing repository record ${id}.`);
  return record;
}

function requiredSourceBoundary(
  report: KeqingLunarEquipmentEvidenceValidationReport,
  repositoryRecordId: string,
) {
  const boundary = report.sourceBoundary.records.find(
    (candidate) => candidate.repositoryRecordId === repositoryRecordId,
  );
  if (!boundary) throw new Error(`Missing source boundary ${repositoryRecordId}.`);
  return boundary;
}

function requiredEvidenceClaim(
  report: KeqingLunarEquipmentEvidenceValidationReport,
  claimId: string,
) {
  const claim = report.claims.find((candidate) => candidate.claimId === claimId);
  if (!claim) throw new Error(`Missing evidence claim ${claimId}.`);
  return claim;
}

function requiredOccurrence(
  report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  occurrenceId: string,
) {
  const occurrence = report.inventoryBoundary.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (!occurrence) throw new Error(`Missing occurrence ${occurrenceId}.`);
  return occurrence;
}
