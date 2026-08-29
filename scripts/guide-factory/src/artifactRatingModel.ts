import { z } from "zod";
import type { GameCatalogs } from "./catalogs";
import { sha256Text, stableJson } from "./io";
import type { ValidationDiagnostic } from "./validation";

export const ARTIFACT_RATING_DB_CAPTURED_ON = "2026-08-29";
export const ARTIFACT_RATING_DB_SOURCE_ID = "artifact-rating-db";
export const ARTIFACT_RATING_DB_COMMIT =
  "255c084b0c35c33519d554c2532054fec57119cf";
export const ARTIFACT_RATING_DB_FILE_SHA256 =
  "af2f8f0bd3a33b4dc633b521c81ab89fb2e48dd307be26480c1868213835dada";
export const ARTIFACT_RATING_DB_FILE_BYTE_LENGTH = 160_813;
export const ARTIFACT_RATING_DB_KEQING_MODEL_SHA256 =
  "0dc083b90bb4e2c11b747270da6b66d2b8ae81a9fe3d300d241846fd281f618c";
export const ARTIFACT_RATING_DB_KEQING_SOURCE_RECORD_ID = "avatar-10000042";
export const ARTIFACT_RATING_DB_REPOSITORY_URL =
  "https://github.com/pizza-studio/ArtifactRatingDB";
export const ARTIFACT_RATING_DB_FILE_PATH =
  "Sources/ArtifactRatingDB/Resources/ARDB4GI.json";
export const ARTIFACT_RATING_DB_RAW_URL = `${ARTIFACT_RATING_DB_REPOSITORY_URL.replace(
  "github.com",
  "raw.githubusercontent.com"
)}/${ARTIFACT_RATING_DB_COMMIT}/${ARTIFACT_RATING_DB_FILE_PATH}`;
export const ARTIFACT_RATING_DB_README_URL =
  `${ARTIFACT_RATING_DB_REPOSITORY_URL}/blob/${ARTIFACT_RATING_DB_COMMIT}/README.md`;
export const ARTIFACT_RATING_DB_LICENSE_URL =
  `${ARTIFACT_RATING_DB_REPOSITORY_URL}/blob/${ARTIFACT_RATING_DB_COMMIT}/LICENSE`;
export const MOBYW_METHOD_URL =
  "https://github.com/Mar-7th/StarRailScore/blob/fb8268bc6345c52501bd4ec23f8df89b26497e0a/README.md";

export const ARTIFACT_RATING_DB_UPSTREAM = {
  repositoryUrl: ARTIFACT_RATING_DB_REPOSITORY_URL,
  commit: ARTIFACT_RATING_DB_COMMIT,
  file: {
    path: ARTIFACT_RATING_DB_FILE_PATH,
    rawUrl: ARTIFACT_RATING_DB_RAW_URL,
    sha256: ARTIFACT_RATING_DB_FILE_SHA256,
    byteLength: ARTIFACT_RATING_DB_FILE_BYTE_LENGTH,
  },
} as const;

export const ARTIFACT_RATING_DB_LINEAGE = {
  method: {
    author: "Mobyw",
    relationship:
      "ArtifactRatingDB states that its Genshin model method is the same as Mobyw's method.",
    evidenceUrl: ARTIFACT_RATING_DB_README_URL,
    upstreamMethodUrl: MOBYW_METHOD_URL,
  },
  authorLicenses: [
    {
      contribution: "Keqing data model",
      author: "Wu Xiaoyun",
      copyrightNotice: "(c) 2023 and onwards Alice Workshop",
      statedLicense: "MIT",
      evidenceUrl: ARTIFACT_RATING_DB_README_URL,
      applicability: "Keqing model entry",
    },
    {
      contribution: "ArtifactRatingDB Swift program files",
      author: "ArtifactRatingDB contributors",
      statedLicense: "AGPL-3.0-or-later",
      evidenceUrl: ARTIFACT_RATING_DB_README_URL,
      licenseTextUrl: ARTIFACT_RATING_DB_LICENSE_URL,
      applicability:
        "Software lineage only; the upstream README separately credits the Keqing model entry under MIT.",
    },
  ],
} as const;

export const ARTIFACT_RATING_RAW_STAT_TO_LOCAL_STAT: Readonly<
  Record<string, string>
> = {
  AttackAddedRatio: "atk%",
  AttackDelta: "atk",
  CriticalChanceBase: "cr",
  CriticalDamageBase: "cd",
  DefenceAddedRatio: "def%",
  DefenceDelta: "def",
  ElementalMastery: "em",
  FireAddedRatio: "pyro%",
  GrassAddedRatio: "dendro%",
  HealRatioBase: "heal%",
  HPAddedRatio: "hp%",
  HPDelta: "hp",
  IceAddedRatio: "cryo%",
  PhysicalAddedRatio: "phys%",
  RockAddedRatio: "geo%",
  SPRatioBase: "er",
  ThunderAddedRatio: "electro%",
  WaterAddedRatio: "hydro%",
  WindAddedRatio: "anemo%",
};

const SourceCoefficientSchema = z.number().finite().nonnegative();
const SourceCoefficientMapSchema = z.record(
  z.string().min(1),
  SourceCoefficientSchema
);

export const ArtifactRatingRawModelSchema = z
  .object({
    main: z
      .object({
        "1": SourceCoefficientMapSchema,
        "2": SourceCoefficientMapSchema,
        "3": SourceCoefficientMapSchema,
        "4": SourceCoefficientMapSchema,
        "5": SourceCoefficientMapSchema,
      })
      .strict(),
    max: z.number().finite().positive(),
    weight: SourceCoefficientMapSchema,
  })
  .strict();

const NormalizedCoefficientSchema = z
  .object({
    statId: z.string().min(1),
    coefficient: SourceCoefficientSchema,
    handling: z.enum(["heuristic-evidence", "ignored-deferred-energy"]),
  })
  .strict();

const NormalizedCoefficientMapSchema = z.record(
  z.string().min(1),
  NormalizedCoefficientSchema
);

const ExplicitUnknownContextSchema = z
  .object({
    team: z.literal("unknown"),
    roleVariant: z.literal("unknown"),
    weapon: z.literal("unknown"),
    constellation: z.literal("unknown"),
    scenario: z.literal("unknown"),
  })
  .strict();

const ArtifactRatingModelRecordSchema = z
  .object({
    sourceRecordId: z.string().min(1),
    nativeAvatarId: z.string().regex(/^\d+$/),
    characterId: z.string().min(1),
    context: ExplicitUnknownContextSchema,
    rawModelSha256: z.string().regex(/^[a-f0-9]{64}$/),
    rawModel: ArtifactRatingRawModelSchema,
    normalizedModel: z
      .object({
        main: z
          .object({
            flower: NormalizedCoefficientMapSchema,
            plume: NormalizedCoefficientMapSchema,
            sands: NormalizedCoefficientMapSchema,
            goblet: NormalizedCoefficientMapSchema,
            circlet: NormalizedCoefficientMapSchema,
          })
          .strict(),
        coefficients: NormalizedCoefficientMapSchema,
      })
      .strict(),
  })
  .strict();

const UpstreamSchema = z
  .object({
    repositoryUrl: z.string().url(),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    file: z
      .object({
        path: z.string().min(1),
        rawUrl: z.string().url(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        byteLength: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const LineageSchema = z
  .object({
    method: z
      .object({
        author: z.string().min(1),
        relationship: z.string().min(1),
        evidenceUrl: z.string().url(),
        upstreamMethodUrl: z.string().url(),
      })
      .strict(),
    authorLicenses: z.array(
      z
        .object({
          contribution: z.string().min(1),
          author: z.string().min(1),
          copyrightNotice: z.string().min(1).optional(),
          statedLicense: z.string().min(1),
          evidenceUrl: z.string().url(),
          licenseTextUrl: z.string().url().optional(),
          applicability: z.string().min(1),
        })
        .strict()
    ),
  })
  .strict();

export const ArtifactRatingModelSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    format: z.literal("artifact-rating-model-v1"),
    sourceId: z.literal("artifact-rating-db"),
    capturedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourcePolicy: z
      .object({
        status: z.literal("planned"),
        permission: z.literal("mixed"),
        integration: z.literal("isolated-pilot-only"),
        consolidation: z.literal("blocked-pending-permission-review"),
      })
      .strict(),
    upstream: UpstreamSchema,
    lineage: LineageSchema,
    semantics: z
      .object({
        modelKind: z.literal("character-artifact-rating-heuristic"),
        coefficientMeaning: z.literal("source-native heuristic coefficient"),
        objectKeyOrder: z.literal("not evidence"),
        teamApplicability: z.literal("not established"),
        energyHandling: z.literal("ignored-deferred"),
      })
      .strict(),
    records: z.array(ArtifactRatingModelRecordSchema).min(1),
  })
  .strict();

export type ArtifactRatingRawModel = z.infer<
  typeof ArtifactRatingRawModelSchema
>;
export type ArtifactRatingModelSnapshot = z.infer<
  typeof ArtifactRatingModelSnapshotSchema
>;
type NormalizedCoefficient = z.infer<typeof NormalizedCoefficientSchema>;

const NATIVE_AVATAR_TO_CHARACTER_ID: Readonly<Record<string, string>> = {
  "10000042": "keqing",
};

export function buildArtifactRatingModelSnapshot(
  rawModelInput: unknown
): ArtifactRatingModelSnapshot {
  const rawModel = ArtifactRatingRawModelSchema.parse(rawModelInput);

  return ArtifactRatingModelSnapshotSchema.parse({
    schemaVersion: 1,
    format: "artifact-rating-model-v1",
    sourceId: ARTIFACT_RATING_DB_SOURCE_ID,
    capturedOn: ARTIFACT_RATING_DB_CAPTURED_ON,
    sourcePolicy: {
      status: "planned",
      permission: "mixed",
      integration: "isolated-pilot-only",
      consolidation: "blocked-pending-permission-review",
    },
    upstream: ARTIFACT_RATING_DB_UPSTREAM,
    lineage: ARTIFACT_RATING_DB_LINEAGE,
    semantics: {
      modelKind: "character-artifact-rating-heuristic",
      coefficientMeaning: "source-native heuristic coefficient",
      objectKeyOrder: "not evidence",
      teamApplicability: "not established",
      energyHandling: "ignored-deferred",
    },
    records: [
      {
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
        rawModelSha256: sha256Text(stableJson(rawModel)),
        rawModel,
        normalizedModel: {
          main: {
            flower: normalizeCoefficientMap(rawModel.main["1"]),
            plume: normalizeCoefficientMap(rawModel.main["2"]),
            sands: normalizeCoefficientMap(rawModel.main["3"]),
            goblet: normalizeCoefficientMap(rawModel.main["4"]),
            circlet: normalizeCoefficientMap(rawModel.main["5"]),
          },
          coefficients: normalizeCoefficientMap(rawModel.weight),
        },
      },
    ],
  });
}

export function validateArtifactRatingModelSnapshot(
  input: unknown,
  catalogs: GameCatalogs
): ValidationDiagnostic[] {
  const parsed = ArtifactRatingModelSnapshotSchema.safeParse(input);
  if (!parsed.success) return schemaDiagnostics(parsed.error);

  const snapshot = parsed.data;
  const diagnostics: ValidationDiagnostic[] = [];

  if (snapshot.capturedOn !== ARTIFACT_RATING_DB_CAPTURED_ON) {
    diagnostics.push({
      severity: "error",
      code: "artifact_rating_model.capture_date_mismatch",
      path: "artifact-rating-model.capturedOn",
      message: `The pinned pilot must retain capture date ${ARTIFACT_RATING_DB_CAPTURED_ON}.`,
    });
  }

  if (stableJson(snapshot.upstream) !== stableJson(ARTIFACT_RATING_DB_UPSTREAM)) {
    diagnostics.push({
      severity: "error",
      code: "artifact_rating_model.provenance_mismatch",
      path: "artifact-rating-model.upstream",
      message:
        "The pilot must retain the exact pinned repository revision and source-file digest.",
    });
  }

  if (stableJson(snapshot.lineage) !== stableJson(ARTIFACT_RATING_DB_LINEAGE)) {
    diagnostics.push({
      severity: "error",
      code: "artifact_rating_model.lineage_mismatch",
      path: "artifact-rating-model.lineage",
      message:
        "The pilot must retain the upstream method, author, and license lineage.",
    });
  }

  checkDuplicateField(
    snapshot.records.map(({ sourceRecordId }) => sourceRecordId),
    "sourceRecordId",
    diagnostics
  );
  checkDuplicateField(
    snapshot.records.map(({ nativeAvatarId }) => nativeAvatarId),
    "nativeAvatarId",
    diagnostics
  );
  checkDuplicateField(
    snapshot.records.map(({ characterId }) => characterId),
    "characterId",
    diagnostics
  );

  if (
    snapshot.records.length !== 1 ||
    snapshot.records[0]?.sourceRecordId !==
      ARTIFACT_RATING_DB_KEQING_SOURCE_RECORD_ID ||
    snapshot.records[0]?.nativeAvatarId !== "10000042" ||
    snapshot.records[0]?.characterId !== "keqing"
  ) {
    diagnostics.push({
      severity: "error",
      code: "artifact_rating_model.pilot_record_boundary_mismatch",
      path: "artifact-rating-model.records",
      message:
        "The isolated pilot must contain exactly the pinned Keqing avatar-10000042 record.",
    });
  }

  for (const [recordIndex, record] of snapshot.records.entries()) {
    const recordPath = `artifact-rating-model.records[${recordIndex}]`;
    if (
      !catalogs.characterIds.has(record.characterId) ||
      catalogs.betaCharacterIds.has(record.characterId)
    ) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.character_not_released",
        path: `${recordPath}.characterId`,
        message: `${record.characterId} is not in the released character catalog.`,
      });
    }

    const mappedCharacterId =
      NATIVE_AVATAR_TO_CHARACTER_ID[record.nativeAvatarId];
    if (mappedCharacterId !== record.characterId) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.avatar_mapping_mismatch",
        path: `${recordPath}.characterId`,
        message: `Native avatar ${record.nativeAvatarId} does not map to ${record.characterId}.`,
      });
    }

    const computedRawModelSha256 = sha256Text(stableJson(record.rawModel));
    if (
      record.rawModelSha256 !== ARTIFACT_RATING_DB_KEQING_MODEL_SHA256 ||
      computedRawModelSha256 !== ARTIFACT_RATING_DB_KEQING_MODEL_SHA256
    ) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.raw_model_digest_mismatch",
        path: `${recordPath}.rawModelSha256`,
        message:
          "The raw Keqing model does not match the entry extracted from the pinned source file.",
      });
    }

    const energyOccurrences = { raw: 0, normalized: 0 };
    validateCoefficientMap(
      record.rawModel.main["1"],
      record.normalizedModel.main.flower,
      `${recordPath}.main.flower`,
      diagnostics,
      energyOccurrences
    );
    validateCoefficientMap(
      record.rawModel.main["2"],
      record.normalizedModel.main.plume,
      `${recordPath}.main.plume`,
      diagnostics,
      energyOccurrences
    );
    validateCoefficientMap(
      record.rawModel.main["3"],
      record.normalizedModel.main.sands,
      `${recordPath}.main.sands`,
      diagnostics,
      energyOccurrences
    );
    validateCoefficientMap(
      record.rawModel.main["4"],
      record.normalizedModel.main.goblet,
      `${recordPath}.main.goblet`,
      diagnostics,
      energyOccurrences
    );
    validateCoefficientMap(
      record.rawModel.main["5"],
      record.normalizedModel.main.circlet,
      `${recordPath}.main.circlet`,
      diagnostics,
      energyOccurrences
    );
    validateCoefficientMap(
      record.rawModel.weight,
      record.normalizedModel.coefficients,
      `${recordPath}.coefficients`,
      diagnostics,
      energyOccurrences
    );

    if (
      energyOccurrences.raw === 0 ||
      energyOccurrences.raw !== energyOccurrences.normalized
    ) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.energy_evidence_not_preserved",
        path: `${recordPath}.normalizedModel`,
        message:
          "The pinned Keqing pilot must retain every SPRatioBase occurrence as ignored/deferred evidence.",
      });
    }
  }

  return diagnostics;
}

function normalizeCoefficientMap(
  raw: Record<string, number>
): Record<string, NormalizedCoefficient> {
  return Object.fromEntries(
    Object.entries(raw).map(([rawStatKey, coefficient]) => {
      const statId = ARTIFACT_RATING_RAW_STAT_TO_LOCAL_STAT[rawStatKey];
      if (!statId) {
        throw new Error(
          `ArtifactRatingDB stat key ${rawStatKey} has no local stat mapping.`
        );
      }

      return [
        rawStatKey,
        {
          statId,
          coefficient,
          handling:
            rawStatKey === "SPRatioBase"
              ? "ignored-deferred-energy"
              : "heuristic-evidence",
        },
      ];
    })
  );
}

function validateCoefficientMap(
  raw: Record<string, number>,
  normalized: Record<string, NormalizedCoefficient>,
  mapPath: string,
  diagnostics: ValidationDiagnostic[],
  energyOccurrences: { raw: number; normalized: number }
): void {
  const rawKeys = new Set(Object.keys(raw));
  const normalizedKeys = new Set(Object.keys(normalized));

  for (const [rawStatKey, coefficient] of Object.entries(raw)) {
    if (rawStatKey === "SPRatioBase") energyOccurrences.raw += 1;

    const entry = normalized[rawStatKey];
    if (!entry) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.normalized_stat_missing",
        path: `${mapPath}.${rawStatKey}`,
        message: `Raw stat key ${rawStatKey} is missing from the normalized model.`,
      });
      continue;
    }

    if (rawStatKey === "SPRatioBase") energyOccurrences.normalized += 1;
    const expectedStatId =
      ARTIFACT_RATING_RAW_STAT_TO_LOCAL_STAT[rawStatKey];
    if (!expectedStatId) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.raw_stat_unsupported",
        path: `${mapPath}.${rawStatKey}`,
        message: `Raw stat key ${rawStatKey} has no reviewed local mapping.`,
      });
    } else if (entry.statId !== expectedStatId) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.stat_mapping_mismatch",
        path: `${mapPath}.${rawStatKey}.statId`,
        message: `${rawStatKey} must map to ${expectedStatId}, not ${entry.statId}.`,
      });
    }

    if (entry.coefficient !== coefficient) {
      diagnostics.push({
        severity: "error",
        code: "artifact_rating_model.coefficient_mismatch",
        path: `${mapPath}.${rawStatKey}.coefficient`,
        message: `${rawStatKey} must retain its source coefficient exactly.`,
      });
    }

    const expectedHandling =
      rawStatKey === "SPRatioBase"
        ? "ignored-deferred-energy"
        : "heuristic-evidence";
    if (entry.handling !== expectedHandling) {
      diagnostics.push({
        severity: "error",
        code:
          rawStatKey === "SPRatioBase"
            ? "artifact_rating_model.energy_not_deferred"
            : "artifact_rating_model.handling_mismatch",
        path: `${mapPath}.${rawStatKey}.handling`,
        message: `${rawStatKey} must use ${expectedHandling} handling.`,
      });
    }
  }

  for (const normalizedKey of normalizedKeys) {
    if (rawKeys.has(normalizedKey)) continue;
    diagnostics.push({
      severity: "error",
      code: "artifact_rating_model.normalized_stat_without_source",
      path: `${mapPath}.${normalizedKey}`,
      message: `Normalized stat ${normalizedKey} has no matching raw source key.`,
    });
  }
}

function checkDuplicateField(
  values: string[],
  field: string,
  diagnostics: ValidationDiagnostic[]
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (!seen.has(value)) {
      seen.add(value);
      continue;
    }
    diagnostics.push({
      severity: "error",
      code: "artifact_rating_model.duplicate_record_identity",
      path: `artifact-rating-model.records[${index}].${field}`,
      message: `Duplicate ${field} value ${value}.`,
    });
  }
}

function schemaDiagnostics(error: z.ZodError): ValidationDiagnostic[] {
  return error.issues.map((issue) => ({
    severity: "error",
    code: "artifact_rating_model.schema",
    path: ["artifact-rating-model", ...issue.path].join("."),
    message: issue.message,
  }));
}
