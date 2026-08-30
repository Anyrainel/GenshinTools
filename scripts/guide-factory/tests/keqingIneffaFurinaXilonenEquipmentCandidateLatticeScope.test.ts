import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ArtifactChoiceSearchCoverageReport } from "../src/artifactChoiceSearchCoverage";
import { readJson } from "../src/io";
import {
  buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS,
  type BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput,
} from "../src/keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import {
  authenticateKeqingIneffaFurinaXilonenEquipmentScope,
  buildKeqingIneffaFurinaXilonenEquipmentScopeAuthenticationInput,
  deriveKeqingIneffaFurinaXilonenEquipmentScopeCandidate,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION,
} from "../src/keqingIneffaFurinaXilonenEquipmentCandidateLatticeScope";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "../src/paths";
import { authenticateScopedSemanticDependencies } from "../src/scopedSemanticDependency";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
  ManualObservationSnapshot,
  ManualSnapshotIndex,
  SourceRegistry,
} from "../src/schemas";
import type { WeaponChoiceSearchCoverageReport } from "../src/weaponChoiceSearchCoverage";

const TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const WEAPON_GUIDE_ID =
  "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i";
const RAW_WEAPON_GUIDE_ID =
  "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i";
const WEAPON_CLAIM_ID = `${WEAPON_GUIDE_ID}:weapon:0:0`;
const WEAPON_OBSERVATION_ID = `${WEAPON_GUIDE_ID}:recommendation:lunar-charged-equal-refinement-four-star-ranking:weapon-group:0:0`;
const ARTIFACT_OBSERVATION_ID =
  "genshintools-presets:character-guide:furina:build:BQAI0BO";

describe("CP36 equipment candidate-lattice semantic scope", () => {
  it("authenticates 16 exact dependencies and all 14 declared parities", async () => {
    const result = authenticateKeqingIneffaFurinaXilonenEquipmentScope(
      await fixture(),
    );
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") throw new Error("Expected accepted scope.");
    expect(result.audit).toMatchObject({
      scopeId: KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.scopeId,
      selector: {
        manifestSha256:
          KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.manifestSha256,
      },
      scopeProjectionSha256:
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.scopeProjectionSha256,
    });
    expect(result.audit.dependencies).toHaveLength(16);
    expect(result.audit.dependencies.map(({ selectedEntries }) => selectedEntries.length)).toEqual([
      6,
      1,
      3,
      1,
      3,
      3,
      10,
      3,
      3,
      1,
      2,
      1,
      1,
      5,
      8,
      12,
    ]);
    expect(result.audit.parities).toHaveLength(14);
    expect(result.audit.parities.every(({ status }) => status === "exact")).toBe(
      true,
    );
  });

  it("rejects selected snapshot source identity drift", async () => {
    const kqm = await fixture();
    kqm.kqmSnapshot.sourceId = "gcsim";
    expect(authenticateKeqingIneffaFurinaXilonenEquipmentScope(kqm).status).toBe(
      "rejected",
    );

    const preset = await fixture();
    (preset.genshinToolsSnapshot as { sourceId: string }).sourceId =
      "legacy-team-research";
    expect(
      authenticateKeqingIneffaFurinaXilonenEquipmentScope(preset).status,
    ).toBe("rejected");
  });

  it("keeps the complete lattice report stable under unrelated additions and envelope/hash drift", async () => {
    const baselineInput = await fixture();
    const baseline = buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
      baselineInput,
    );
    const changed = structuredClone(baselineInput);

    changed.repository.sourceRegistrySha256 = "f".repeat(64);
    changed.repository.generatedFrom.push({
      sourceId: "kqm",
      files: [{ path: "unrelated.json", sha256: "e".repeat(64) }],
    });
    const unrelatedRepository = structuredClone(
      requiredRepositoryRecord(changed.repository, WEAPON_GUIDE_ID),
    );
    unrelatedRepository.id = "kqm:character-guide:unrelated-cp36-scope-test";
    changed.repository.records.push(unrelatedRepository);

    changed.kqmSnapshot.capturedAt = "2099-01-01";
    const unrelatedRaw = structuredClone(
      requiredRawRecord(changed.kqmSnapshot, RAW_WEAPON_GUIDE_ID),
    );
    unrelatedRaw.sourceRecordId = "unrelated-cp36-scope-test";
    changed.kqmSnapshot.records.push(unrelatedRaw);

    changed.genshinToolsSnapshot.capturedAt = "2099-01-01";
    changed.genshinToolsSnapshot.sourceRevision.files.push({
      path: "unrelated-live-source.json",
      sha256: "d".repeat(64),
    });
    const unrelatedPreset = structuredClone(
      requiredPresetGuide(changed.genshinToolsSnapshot, "furina"),
    );
    unrelatedPreset.characterId = "unrelated-character";
    unrelatedPreset.sourceRecordId = "unrelated-character";
    changed.genshinToolsSnapshot.characterGuides.push(unrelatedPreset);

    changed.manualIndex.snapshots.push({
      sourceId: "kqm",
      path: "scripts/guide-factory/data/source-snapshots/unrelated.json",
    });
    const unrelatedSource = structuredClone(changed.sourceRegistry.sources[0]);
    unrelatedSource.id = "unrelated-source";
    changed.sourceRegistry.sources.push(unrelatedSource);

    const live = changed.liveBuildPreset as {
      builds: Record<string, unknown>;
      characterBuilds: Record<string, string[]>;
      characterWeapons: Record<string, string[]>;
    };
    live.builds.UNRELATED = { id: "UNRELATED" };
    live.characterBuilds.unrelated = ["UNRELATED"];
    live.characterWeapons.unrelated = ["dull_blade"];

    const unrelatedClaim = structuredClone(
      requiredEvidenceClaim(changed.evidenceReport, WEAPON_CLAIM_ID),
    );
    unrelatedClaim.claimId = `${WEAPON_GUIDE_ID}:weapon:99:99`;
    changed.evidenceReport.claims.push(unrelatedClaim);
    changed.evidenceReport.generatedFrom.push({
      path: "unrelated-evidence-input.json",
      sha256: "c".repeat(64),
    });

    const unrelatedWeapon = structuredClone(
      requiredWeaponObservation(changed.weaponCoverageReport, WEAPON_OBSERVATION_ID),
    );
    unrelatedWeapon.observationId = "unrelated-weapon-observation";
    changed.weaponCoverageReport.observations.push(unrelatedWeapon);
    changed.weaponCoverageReport.generatedFrom.push({
      path: "unrelated-weapon-input.json",
      sha256: "b".repeat(64),
    });

    const unrelatedArtifact = structuredClone(
      requiredArtifactObservation(
        changed.artifactCoverageReport,
        ARTIFACT_OBSERVATION_ID,
      ),
    );
    unrelatedArtifact.observationId = "unrelated-artifact-observation";
    changed.artifactCoverageReport.observations.push(unrelatedArtifact);
    changed.artifactCoverageReport.generatedFrom.push({
      path: "unrelated-artifact-input.json",
      sha256: "a".repeat(64),
    });

    expect(
      buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(changed),
    ).toEqual(baseline);
  });

  it("rejects missing, duplicate, selected-drift, and parity-mismatched records", async () => {
    const missing = await fixture();
    missing.repository.records = missing.repository.records.filter(
      ({ id }) => id !== TEAM_ID,
    );
    expect(rejectionCodes(deriveKeqingIneffaFurinaXilonenEquipmentScopeCandidate(missing))).toContain(
      "selection.required_key_missing",
    );

    const duplicate = await fixture();
    duplicate.repository.records.push(
      structuredClone(requiredRepositoryRecord(duplicate.repository, WEAPON_GUIDE_ID)),
    );
    expect(rejectionCodes(deriveKeqingIneffaFurinaXilonenEquipmentScopeCandidate(duplicate))).toContain(
      "selection.required_key_duplicated",
    );

    const drifted = await fixture();
    requiredPresetGuide(drifted.genshinToolsSnapshot, "furina").weaponOrder?.reverse();
    expect(
      authenticateKeqingIneffaFurinaXilonenEquipmentScope(drifted).status,
    ).toBe("rejected");

    const parity = await fixture();
    requiredRawRecord(parity.kqmSnapshot, RAW_WEAPON_GUIDE_ID).recommendation.label =
      "parity drift";
    expect(rejectionCodes(deriveKeqingIneffaFurinaXilonenEquipmentScopeCandidate(parity))).toContain(
      "parity.normalized_payload_mismatch",
    );
  });

  it("binds selector identity and projections to the pinned manifest", async () => {
    const input = await fixture();
    const authenticationInput =
      buildKeqingIneffaFurinaXilonenEquipmentScopeAuthenticationInput(input);
    authenticationInput.manifest.dependencies[0].projectionAdapterId =
      "forged-projection-adapter";
    const forged = authenticateScopedSemanticDependencies(authenticationInput);
    expect(forged.status).toBe("rejected");
    if (forged.status !== "rejected") throw new Error("Expected forged scope rejection.");
    expect(forged.issues.map(({ code }) => code)).toContain(
      "authentication.manifest_mismatch",
    );
  });
});

async function fixture(): Promise<BuildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeInput> {
  const values = await Promise.all(
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS.map(
      (relativePath) => readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ),
  );
  return {
    repository: values[0] as KnowledgeRepository,
    kqmSnapshot: values[1] as ManualObservationSnapshot,
    genshinToolsSnapshot: values[2] as GenshinToolsPresetSnapshot,
    manualIndex: values[3] as ManualSnapshotIndex,
    sourceRegistry: values[4] as SourceRegistry,
    liveBuildPreset: values[5],
    evidenceReport: values[6] as KeqingLunarEquipmentEvidenceValidationReport,
    weaponCoverageReport: values[7] as WeaponChoiceSearchCoverageReport,
    artifactCoverageReport: values[8] as ArtifactChoiceSearchCoverageReport,
  };
}

function rejectionCodes(
  result: ReturnType<
    typeof deriveKeqingIneffaFurinaXilonenEquipmentScopeCandidate
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

function requiredRawRecord(
  snapshot: ManualObservationSnapshot,
  sourceRecordId: string,
) {
  const record = snapshot.records.find(
    (candidate) => candidate.sourceRecordId === sourceRecordId,
  );
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Missing raw guide ${sourceRecordId}.`);
  }
  return record;
}

function requiredPresetGuide(
  snapshot: GenshinToolsPresetSnapshot,
  characterId: string,
) {
  const guide = snapshot.characterGuides.find(
    (candidate) => candidate.characterId === characterId,
  );
  if (!guide) throw new Error(`Missing preset guide ${characterId}.`);
  return guide;
}

function requiredEvidenceClaim(
  report: KeqingLunarEquipmentEvidenceValidationReport,
  claimId: string,
) {
  const claim = report.claims.find((candidate) => candidate.claimId === claimId);
  if (!claim) throw new Error(`Missing evidence claim ${claimId}.`);
  return claim;
}

function requiredWeaponObservation(
  report: WeaponChoiceSearchCoverageReport,
  observationId: string,
) {
  const observation = report.observations.find(
    (candidate) => candidate.observationId === observationId,
  );
  if (!observation) throw new Error(`Missing weapon observation ${observationId}.`);
  return observation;
}

function requiredArtifactObservation(
  report: ArtifactChoiceSearchCoverageReport,
  observationId: string,
) {
  const observation = report.observations.find(
    (candidate) => candidate.observationId === observationId,
  );
  if (!observation) throw new Error(`Missing artifact observation ${observationId}.`);
  return observation;
}
