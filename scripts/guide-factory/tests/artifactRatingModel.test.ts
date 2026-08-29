import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadGameCatalogs, type GameCatalogs } from "../src/catalogs";
import { readJson, stableJson } from "../src/io";
import {
  ARTIFACT_RATING_DB_COMMIT,
  ARTIFACT_RATING_DB_FILE_SHA256,
  ARTIFACT_RATING_DB_KEQING_MODEL_SHA256,
  ARTIFACT_RATING_DB_KEQING_SOURCE_RECORD_ID,
  ArtifactRatingModelSnapshotSchema,
  type ArtifactRatingModelSnapshot,
  buildArtifactRatingModelSnapshot,
  validateArtifactRatingModelSnapshot,
} from "../src/artifactRatingModel";

const SNAPSHOT_PATH = fileURLToPath(
  new URL(
    "../data/source-snapshots/artifact-rating-db-keqing.json",
    import.meta.url
  )
);

describe("ArtifactRatingDB Keqing heuristic-model pilot", () => {
  let catalogs: GameCatalogs;
  let snapshot: ArtifactRatingModelSnapshot;

  beforeAll(async () => {
    catalogs = await loadGameCatalogs();
    snapshot = ArtifactRatingModelSnapshotSchema.parse(
      await readJson(SNAPSHOT_PATH)
    );
  });

  it("pins the source, attribution, raw model, local IDs, and unknown context", () => {
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      format: "artifact-rating-model-v1",
      sourceId: "artifact-rating-db",
      sourcePolicy: {
        status: "planned",
        permission: "mixed",
        integration: "isolated-pilot-only",
        consolidation: "blocked-pending-permission-review",
      },
      upstream: {
        commit: ARTIFACT_RATING_DB_COMMIT,
        file: {
          sha256: ARTIFACT_RATING_DB_FILE_SHA256,
          byteLength: 160_813,
        },
      },
      lineage: {
        method: { author: "Mobyw" },
        authorLicenses: expect.arrayContaining([
          expect.objectContaining({
            contribution: "Keqing data model",
            author: "Wu Xiaoyun",
            statedLicense: "MIT",
          }),
        ]),
      },
      semantics: {
        modelKind: "character-artifact-rating-heuristic",
        coefficientMeaning: "source-native heuristic coefficient",
        objectKeyOrder: "not evidence",
        teamApplicability: "not established",
        energyHandling: "ignored-deferred",
      },
    });

    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0]).toMatchObject({
      sourceRecordId: "avatar-10000042",
      nativeAvatarId: "10000042",
      characterId: "keqing",
      context: {
        team: "unknown",
        roleVariant: "unknown",
        weapon: "unknown",
        constellation: "unknown",
        scenario: "unknown",
      },
      rawModelSha256: ARTIFACT_RATING_DB_KEQING_MODEL_SHA256,
      rawModel: {
        main: {
          "3": {
            AttackAddedRatio: 0.65,
            DefenceAddedRatio: 0,
            ElementalMastery: 0.85,
            HPAddedRatio: 0,
            SPRatioBase: 0,
          },
          "4": {
            AttackAddedRatio: 0.65,
            DefenceAddedRatio: 0,
            ElementalMastery: 0.85,
            HPAddedRatio: 0,
            ThunderAddedRatio: 1,
          },
        },
        max: 10,
        weight: {
          AttackAddedRatio: 0.65,
          AttackDelta: 0.45,
          CriticalChanceBase: 1,
          CriticalDamageBase: 1,
          DefenceAddedRatio: 0,
          DefenceDelta: 0,
          ElementalMastery: 0.85,
          HPAddedRatio: 0,
          HPDelta: 0,
          SPRatioBase: 0,
          ThunderAddedRatio: 1,
        },
      },
    });

    const record = snapshot.records[0]!;
    expect(record.normalizedModel.main.goblet.ThunderAddedRatio).toEqual({
      statId: "electro%",
      coefficient: 1,
      handling: "heuristic-evidence",
    });
    expect(record.normalizedModel.main.sands.SPRatioBase).toEqual({
      statId: "er",
      coefficient: 0,
      handling: "ignored-deferred-energy",
    });
    expect(record.normalizedModel.coefficients.SPRatioBase).toEqual({
      statId: "er",
      coefficient: 0,
      handling: "ignored-deferred-energy",
    });
    expect(validateArtifactRatingModelSnapshot(snapshot, catalogs)).toEqual([]);
  });

  it("replays the adapter byte-stably from the preserved source-native record", () => {
    const rebuilt = buildArtifactRatingModelSnapshot(
      snapshot.records[0]!.rawModel
    );
    expect(stableJson(rebuilt)).toBe(stableJson(snapshot));
  });

  it("rejects provenance or lineage drift", () => {
    const provenanceDrift = cloneSnapshot(snapshot);
    provenanceDrift.upstream.commit = "0".repeat(40);
    expect(validationCodes(provenanceDrift, catalogs)).toContain(
      "artifact_rating_model.provenance_mismatch"
    );

    const lineageDrift = cloneSnapshot(snapshot);
    lineageDrift.lineage.authorLicenses[0]!.author = "Unknown";
    expect(validationCodes(lineageDrift, catalogs)).toContain(
      "artifact_rating_model.lineage_mismatch"
    );
  });

  it("pins the capture date and exact isolated-pilot record identity", () => {
    const captureDateDrift = cloneSnapshot(snapshot);
    captureDateDrift.capturedOn = "2099-12-31";
    expect(validationCodes(captureDateDrift, catalogs)).toContain(
      "artifact_rating_model.capture_date_mismatch"
    );

    const recordIdentityDrift = cloneSnapshot(snapshot);
    recordIdentityDrift.records[0]!.sourceRecordId = "fabricated";
    expect(validationCodes(recordIdentityDrift, catalogs)).toContain(
      "artifact_rating_model.pilot_record_boundary_mismatch"
    );

    expect(snapshot.records[0]!.sourceRecordId).toBe(
      ARTIFACT_RATING_DB_KEQING_SOURCE_RECORD_ID
    );
  });

  it("rejects coordinated raw-model drift and normalized coefficient drift", () => {
    const rawDrift = cloneSnapshot(snapshot);
    rawDrift.records[0]!.rawModel.weight.AttackAddedRatio = 0.7;
    rawDrift.records[0]!.normalizedModel.coefficients.AttackAddedRatio = {
      statId: "atk%",
      coefficient: 0.7,
      handling: "heuristic-evidence",
    };
    expect(validationCodes(rawDrift, catalogs)).toContain(
      "artifact_rating_model.raw_model_digest_mismatch"
    );

    const normalizedDrift = cloneSnapshot(snapshot);
    normalizedDrift.records[0]!.normalizedModel.main.goblet.ThunderAddedRatio = {
      statId: "electro%",
      coefficient: 0.9,
      handling: "heuristic-evidence",
    };
    expect(validationCodes(normalizedDrift, catalogs)).toContain(
      "artifact_rating_model.coefficient_mismatch"
    );
  });

  it("rejects missing, invented, unsupported, or incorrectly mapped stats", () => {
    const missing = cloneSnapshot(snapshot);
    delete missing.records[0]!.normalizedModel.coefficients.AttackDelta;
    expect(validationCodes(missing, catalogs)).toContain(
      "artifact_rating_model.normalized_stat_missing"
    );

    const invented = cloneSnapshot(snapshot);
    invented.records[0]!.normalizedModel.coefficients.InventedStat = {
      statId: "atk",
      coefficient: 1,
      handling: "heuristic-evidence",
    };
    expect(validationCodes(invented, catalogs)).toContain(
      "artifact_rating_model.normalized_stat_without_source"
    );

    const unsupported = cloneSnapshot(snapshot);
    unsupported.records[0]!.rawModel.weight.FutureStat = 1;
    unsupported.records[0]!.normalizedModel.coefficients.FutureStat = {
      statId: "atk",
      coefficient: 1,
      handling: "heuristic-evidence",
    };
    expect(validationCodes(unsupported, catalogs)).toContain(
      "artifact_rating_model.raw_stat_unsupported"
    );

    const incorrectlyMapped = cloneSnapshot(snapshot);
    incorrectlyMapped.records[0]!.normalizedModel.main.goblet.ThunderAddedRatio =
      {
        statId: "atk%",
        coefficient: 1,
        handling: "heuristic-evidence",
      };
    expect(validationCodes(incorrectlyMapped, catalogs)).toContain(
      "artifact_rating_model.stat_mapping_mismatch"
    );
  });

  it("keeps energy evidence present but unusable by this pilot", () => {
    const activated = cloneSnapshot(snapshot);
    activated.records[0]!.normalizedModel.main.sands.SPRatioBase!.handling =
      "heuristic-evidence";
    expect(validationCodes(activated, catalogs)).toContain(
      "artifact_rating_model.energy_not_deferred"
    );

    const removed = cloneSnapshot(snapshot);
    delete removed.records[0]!.rawModel.main["3"].SPRatioBase;
    delete removed.records[0]!.normalizedModel.main.sands.SPRatioBase;
    delete removed.records[0]!.rawModel.weight.SPRatioBase;
    delete removed.records[0]!.normalizedModel.coefficients.SPRatioBase;
    expect(validationCodes(removed, catalogs)).toContain(
      "artifact_rating_model.energy_evidence_not_preserved"
    );
  });

  it("requires a released local character and every explicit unknown field", () => {
    const catalogsWithKeqingMarkedBeta: GameCatalogs = {
      ...catalogs,
      betaCharacterIds: new Set([...catalogs.betaCharacterIds, "keqing"]),
    };
    expect(
      validationCodes(snapshot, catalogsWithKeqingMarkedBeta)
    ).toContain("artifact_rating_model.character_not_released");

    const missingContext = cloneSnapshot(snapshot);
    const partialContext: Partial<
      (typeof missingContext.records)[number]["context"]
    > = missingContext.records[0]!.context;
    delete partialContext.weapon;
    expect(validationCodes(missingContext, catalogs)).toContain(
      "artifact_rating_model.schema"
    );
  });

  it("rejects duplicate source, native-avatar, and local-character identities", () => {
    const duplicate = cloneSnapshot(snapshot);
    duplicate.records.push(structuredClone(duplicate.records[0]!));
    expect(
      validationCodes(duplicate, catalogs).filter(
        (code) => code === "artifact_rating_model.duplicate_record_identity"
      )
    ).toHaveLength(3);
  });
});

function cloneSnapshot(
  snapshot: ArtifactRatingModelSnapshot
): ArtifactRatingModelSnapshot {
  return structuredClone(snapshot);
}

function validationCodes(
  input: unknown,
  catalogs: GameCatalogs
): string[] {
  return validateArtifactRatingModelSnapshot(input, catalogs).map(
    ({ code }) => code
  );
}
