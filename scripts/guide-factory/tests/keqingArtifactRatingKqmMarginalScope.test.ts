import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { ArtifactRatingModelSnapshot } from "../src/artifactRatingModel";
import { readJson } from "../src/io";
import { buildKeqingArtifactRatingKqmMarginalValidationSliceReport } from "../src/keqingArtifactRatingKqmMarginalValidationSlice";
import {
  authenticateKeqingArtifactRatingKqmMarginalScope,
  buildKeqingArtifactRatingKqmMarginalScopeAuthenticationInput,
  deriveKeqingArtifactRatingKqmMarginalScopeCandidate,
  KEQING_ARTIFACT_RATING_KQM_SCOPE_CLAIM_IDS,
  KEQING_ARTIFACT_RATING_KQM_SCOPE_EXPECTATION,
  requireKeqingArtifactRatingKqmMarginalScope,
  type KeqingArtifactRatingKqmMarginalScopeInput,
} from "../src/keqingArtifactRatingKqmMarginalScope";
import type { KeqingIneffaTeamStatMarginalDiagnosticReport } from "../src/keqingIneffaTeamStatMarginalDiagnostic";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "../src/paths";
import type {
  KnowledgeRepository,
  ManualObservationSnapshot,
} from "../src/schemas";
import { authenticateScopedSemanticDependencies } from "../src/scopedSemanticDependency";

const PATHS = {
  artifact:
    "scripts/guide-factory/data/source-snapshots/artifact-rating-db-keqing.json",
  repository: "scripts/guide-factory/data/knowledge/repository.json",
  marginal:
    "scripts/guide-factory/reports/keqing-ineffa-team-stat-marginal-diagnostic.json",
  raw: "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  equipment:
    "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json",
} as const;

let fixture: KeqingArtifactRatingKqmMarginalScopeInput;

beforeAll(async () => {
  const [
    artifactRatingSnapshot,
    repository,
    marginalReport,
    kqmRawSnapshot,
    kqmEquipmentReport,
  ] = await Promise.all(
    Object.values(PATHS).map((relativePath) =>
      readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ),
  );
  fixture = {
    artifactRatingSnapshot:
      artifactRatingSnapshot as ArtifactRatingModelSnapshot,
    repository: repository as KnowledgeRepository,
    marginalReport:
      marginalReport as KeqingIneffaTeamStatMarginalDiagnosticReport,
    kqmRawSnapshot: kqmRawSnapshot as ManualObservationSnapshot,
    kqmEquipmentReport:
      kqmEquipmentReport as KeqingLunarEquipmentEvidenceValidationReport,
  };
});

describe("CP35 scoped semantic dependency", () => {
  it("derives the reviewable narrow scope candidate", () => {
    const candidate = deriveKeqingArtifactRatingKqmMarginalScopeCandidate(
      fixture,
    );
    expect(candidate.status).toBe("candidate");
    if (candidate.status !== "candidate") {
      throw new Error(JSON.stringify(candidate.issues));
    }
    expect(candidate.audit.selector.manifestSha256).toBe(
      KEQING_ARTIFACT_RATING_KQM_SCOPE_EXPECTATION.manifestSha256,
    );
    expect(candidate.audit.scopeProjectionSha256).toBe(
      KEQING_ARTIFACT_RATING_KQM_SCOPE_EXPECTATION.scopeProjectionSha256,
    );
    expect(candidate.audit.dependencies).toHaveLength(10);
    expect(candidate.audit.parities).toHaveLength(1);
    expect(candidate.audit.dependencies.at(-1)?.requiredKeys).toEqual(
      KEQING_ARTIFACT_RATING_KQM_SCOPE_CLAIM_IDS,
    );
  });

  it("authenticates and materializes only the selected validation facts", () => {
    const scope = requireKeqingArtifactRatingKqmMarginalScope(fixture);
    expect(scope.audit).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      scopeId: KEQING_ARTIFACT_RATING_KQM_SCOPE_EXPECTATION.scopeId,
    });
    expect(scope.artifactRating.record.nativeAvatarId).toBe("10000042");
    expect(scope.kqm.guide.id).toContain(
      "keqing-lunar-charged-default-artifact-stats-luna-i",
    );
    expect(scope.kqm.team.members.map(({ characterId }) => characterId)).toEqual(
      ["keqing", "ineffa", "furina", "xilonen"],
    );
    expect(scope.kqm.rawGuide.recommendation).toEqual(
      scope.kqm.guide.recommendations?.[0],
    );
    expect(scope.marginal.diagnostic.keqingStats).toHaveLength(9);
    expect(scope.equipment.claims).toHaveLength(8);
  });

  it("rejects selected drift, duplicate identity, and raw/repository parity drift", () => {
    const selectedDrift = structuredClone(fixture);
    selectedDrift.artifactRatingSnapshot.records[0].normalizedModel.coefficients.AttackAddedRatio.coefficient =
      0.66;
    expect(issueCodes(selectedDrift)).toContain(
      "authentication.scope_projection_mismatch",
    );

    const duplicate = structuredClone(fixture);
    duplicate.repository.records.push(
      structuredClone(
        requiredRepositoryRecord(
          duplicate.repository,
          "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
        ),
      ),
    );
    expect(issueCodes(duplicate)).toContain("selection.required_key_duplicated");

    const parityDrift = structuredClone(fixture);
    const raw = parityDrift.kqmRawSnapshot.records.find(
      (record) =>
        record.kind === "character_guide" &&
        record.sourceRecordId ===
          "keqing-lunar-charged-default-artifact-stats-luna-i",
    );
    if (!raw || raw.kind !== "character_guide") {
      throw new Error("Missing raw CP35 guide fixture.");
    }
    if (!raw.recommendation.mainStats) {
      throw new Error("Missing raw CP35 main-stat fixture.");
    }
    raw.recommendation.mainStats.sands[0].statIds = ["em"];
    expect(issueCodes(parityDrift)).toContain(
      "parity.normalized_payload_mismatch",
    );
  });

  it("binds selector path and adapter identity to the manifest pin", () => {
    const pathDrift =
      buildKeqingArtifactRatingKqmMarginalScopeAuthenticationInput(fixture);
    pathDrift.manifest.dependencies[0].collectionPath = "/records";
    expect(sharedIssueCodes(pathDrift)).toContain(
      "authentication.manifest_mismatch",
    );

    const adapterDrift =
      buildKeqingArtifactRatingKqmMarginalScopeAuthenticationInput(fixture);
    adapterDrift.manifest.dependencies[9].projectionAdapterId =
      "cp35-equipment-default-claim-v2";
    expect(sharedIssueCodes(adapterDrift)).toContain(
      "authentication.manifest_mismatch",
    );
  });

  it("is stable across unrelated records and unselected report evidence", () => {
    const baseline = requireKeqingArtifactRatingKqmMarginalScope(fixture).audit;
    const baselineReport =
      buildKeqingArtifactRatingKqmMarginalValidationSliceReport(fixture);
    const changed = structuredClone(fixture);

    const unrelatedArtifact = structuredClone(
      changed.artifactRatingSnapshot.records[0],
    );
    unrelatedArtifact.nativeAvatarId = "19999999";
    unrelatedArtifact.sourceRecordId = "avatar-19999999";
    unrelatedArtifact.characterId = "unrelated";
    changed.artifactRatingSnapshot.records.push(unrelatedArtifact);

    const unrelatedRepository = structuredClone(
      changed.repository.records.find(
        ({ id }) =>
          id !==
            "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i" &&
          id !==
            "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
      ) ?? changed.repository.records[0],
    );
    unrelatedRepository.id = "test:cp35-unrelated-repository-record";
    changed.repository.records.push(unrelatedRepository);

    const unrelatedRaw = structuredClone(changed.kqmRawSnapshot.records[0]);
    if (!("sourceRecordId" in unrelatedRaw)) {
      throw new Error("Missing sourceRecordId on unrelated raw fixture.");
    }
    unrelatedRaw.sourceRecordId = "cp35-unrelated-raw-record";
    changed.kqmRawSnapshot.records.push(unrelatedRaw);

    changed.marginalReport.cautions.push("unrelated CP35 test caution");
    const nonKeqing = changed.marginalReport.marginalDiagnostic
      ?.crossEndpointSummary?.characters.find(
        ({ characterId }) => characterId !== "keqing",
      );
    if (!nonKeqing) throw new Error("Missing non-Keqing marginal fixture.");
    nonKeqing.stats[0].positiveEndpointIds = [];

    changed.kqmEquipmentReport.cautions.push(
      "unrelated CP35 equipment caution",
    );
    const unrelatedClaim = changed.kqmEquipmentReport.claims.find(
      ({ claimId }) =>
        !KEQING_ARTIFACT_RATING_KQM_SCOPE_CLAIM_IDS.includes(
          claimId as (typeof KEQING_ARTIFACT_RATING_KQM_SCOPE_CLAIM_IDS)[number],
        ),
    );
    if (!unrelatedClaim) throw new Error("Missing unrelated equipment claim.");
    unrelatedClaim.allSourceConditionsMappedExactly =
      !unrelatedClaim.allSourceConditionsMappedExactly;

    expect(requireKeqingArtifactRatingKqmMarginalScope(changed).audit).toEqual(
      baseline,
    );
    expect(
      buildKeqingArtifactRatingKqmMarginalValidationSliceReport(changed),
    ).toEqual(baselineReport);
  });
});

function issueCodes(
  input: KeqingArtifactRatingKqmMarginalScopeInput,
): string[] {
  const result = authenticateKeqingArtifactRatingKqmMarginalScope(input);
  return result.status === "accepted"
    ? []
    : result.issues.map(({ code }) => code);
}

function sharedIssueCodes(
  input: ReturnType<
    typeof buildKeqingArtifactRatingKqmMarginalScopeAuthenticationInput
  >,
): string[] {
  const result = authenticateScopedSemanticDependencies(input);
  return result.status === "accepted"
    ? []
    : result.issues.map(({ code }) => code);
}

function requiredRepositoryRecord(
  repository: KnowledgeRepository,
  id: string,
) {
  const record = repository.records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing repository fixture ${id}.`);
  return record;
}
