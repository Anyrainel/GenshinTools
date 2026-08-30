import { createHash } from "node:crypto";

import { stableJson } from "./io";

export const GUIDE_DRAFT_PACKET_SCHEMA_VERSION = 1 as const;

export interface GuideDraftUpstreamProvenance {
  sourceObjectId: string;
  sourceObjectJsonPointer: string;
  sourceObjectCanonicalSha256: string;
  sourceValueJsonPointer: string;
  sourceValueCanonicalSha256: string;
}

interface GuideDraftFieldBase {
  fieldId: string;
  fieldPath: string;
  provenance: GuideDraftUpstreamProvenance[];
  blockerIds: string[];
  fieldSha256: string;
}

export interface GuideDraftPreservedEvidenceField
  extends GuideDraftFieldBase {
  state: "preserved-evidence";
  value: unknown;
}

export interface GuideDraftPreservedBlockingEvidenceField
  extends GuideDraftFieldBase {
  state: "preserved-blocking-evidence";
  value: unknown;
}

export interface GuideDraftLocallyAdmittedRelationField
  extends GuideDraftFieldBase {
  state: "locally-admitted-relation";
  value: unknown;
}

export interface GuideDraftWithheldCounterexampleField
  extends GuideDraftFieldBase {
  state: "withheld-counterexample";
  value: null;
  preservedObservation: unknown;
}

export interface GuideDraftWithheldInconclusiveField
  extends GuideDraftFieldBase {
  state: "withheld-inconclusive";
  value: null;
  preservedObservation: unknown;
}

export interface GuideDraftGuardedUnresolvedAlternativeField
  extends GuideDraftFieldBase {
  state: "guarded-unresolved-alternative";
  value: null;
  preservedObservation: unknown;
}

export interface GuideDraftUnselectedField extends GuideDraftFieldBase {
  state: "unselected";
  value: null;
  optionFieldIds: string[];
}

export interface GuideDraftMissingNotZeroField extends GuideDraftFieldBase {
  state: "missing-not-zero";
  value: null;
  upstreamMarker: unknown;
}

export interface GuideDraftNotComputedField extends GuideDraftFieldBase {
  state: "not-computed";
  value: null;
  upstreamMarker: unknown;
}

export interface GuideDraftDeferredMissingNotZeroField
  extends GuideDraftFieldBase {
  state: "deferred-missing-not-zero";
  value: null;
  upstreamMarker: unknown;
}

export type GuideDraftField =
  | GuideDraftPreservedEvidenceField
  | GuideDraftPreservedBlockingEvidenceField
  | GuideDraftLocallyAdmittedRelationField
  | GuideDraftWithheldCounterexampleField
  | GuideDraftWithheldInconclusiveField
  | GuideDraftGuardedUnresolvedAlternativeField
  | GuideDraftUnselectedField
  | GuideDraftMissingNotZeroField
  | GuideDraftNotComputedField
  | GuideDraftDeferredMissingNotZeroField;

type GuideDraftFieldInput =
  | Omit<GuideDraftPreservedEvidenceField, "fieldSha256">
  | Omit<GuideDraftPreservedBlockingEvidenceField, "fieldSha256">
  | Omit<GuideDraftLocallyAdmittedRelationField, "fieldSha256">
  | Omit<GuideDraftWithheldCounterexampleField, "fieldSha256">
  | Omit<GuideDraftWithheldInconclusiveField, "fieldSha256">
  | Omit<GuideDraftGuardedUnresolvedAlternativeField, "fieldSha256">
  | Omit<GuideDraftUnselectedField, "fieldSha256">
  | Omit<GuideDraftMissingNotZeroField, "fieldSha256">
  | Omit<GuideDraftNotComputedField, "fieldSha256">
  | Omit<GuideDraftDeferredMissingNotZeroField, "fieldSha256">;

export interface GuideDraftBlocker {
  blockerId: string;
  fieldId: string;
  fieldPath: string;
  code: GuideDraftBlockerCode;
  blocksPublication: true;
  sourceFieldSha256: string;
  blockerSha256: string;
}

export type GuideDraftBlockerCode =
  | "source-team-investment-unspecified"
  | "source-review-unreviewed"
  | "source-request-coverage-absent"
  | "artifact-assignment-incomplete"
  | "build-incomplete"
  | "weapon-selection-missing"
  | "weapon-refinement-missing"
  | "weapon-performance-missing"
  | "artifact-set-selection-missing"
  | "selected-sands-missing"
  | "selected-goblet-missing"
  | "selected-circlet-missing"
  | "guarded-alternative-unresolved"
  | "local-relation-counterexample"
  | "local-relation-inconclusive"
  | "substat-allocation-missing"
  | "scalar-weights-missing"
  | "enemy-scenario-missing"
  | "formula-counts-missing"
  | "rotation-and-buff-coverage-missing"
  | "team-total-not-computed"
  | "energy-recharge-deferred";

const GUIDE_DRAFT_BLOCKER_CODES = new Set<GuideDraftBlockerCode>([
  "source-team-investment-unspecified",
  "source-review-unreviewed",
  "source-request-coverage-absent",
  "artifact-assignment-incomplete",
  "build-incomplete",
  "weapon-selection-missing",
  "weapon-refinement-missing",
  "weapon-performance-missing",
  "artifact-set-selection-missing",
  "selected-sands-missing",
  "selected-goblet-missing",
  "selected-circlet-missing",
  "guarded-alternative-unresolved",
  "local-relation-counterexample",
  "local-relation-inconclusive",
  "substat-allocation-missing",
  "scalar-weights-missing",
  "enemy-scenario-missing",
  "formula-counts-missing",
  "rotation-and-buff-coverage-missing",
  "team-total-not-computed",
  "energy-recharge-deferred",
]);

export interface GuideDraftPacket<TFields extends Record<string, unknown>> {
  schemaVersion: typeof GUIDE_DRAFT_PACKET_SCHEMA_VERSION;
  packetType: "character-guide-draft-packet";
  packetId: string;
  subject: {
    characterId: string;
    requestId: string;
  };
  upstream: {
    reportPath: string;
    reportCanonicalSha256: string;
    envelopeId: string;
    envelopeJsonPointer: string;
    envelopeCanonicalObjectSha256: string;
    envelopeSha256: string;
    candidateId: string;
    candidateJsonPointer: string;
    candidateCanonicalObjectSha256: string;
    candidateSha256: string;
    profileId: string;
  };
  fields: TFields;
  blockers: GuideDraftBlocker[];
  readiness: {
    observationProjection: "complete";
    localRelationProjection:
      | "all-locally-admitted"
      | "partial-counterexamples-preserved"
      | "partial-inconclusive-preserved";
    guideReadiness: "incomplete";
    publicationStatus: "withheld";
    blockerCount: number;
  };
  capabilityBoundary: {
    supportsDraftSerialization: true;
    supportsPreservedObservationProjection: true;
    supportsRequestLocalRelationStateProjection: true;
    supportsGuideClaims: false;
    supportsPublication: false;
    supportsTeamRecommendationClaims: false;
    supportsEquipmentRecommendationClaims: false;
    supportsStatRecommendationClaims: false;
    supportsRankClaims: false;
    supportsWinnerClaims: false;
    supportsScalarWeights: false;
    supportsTotalStatOrder: false;
    supportsIdealStatAllocation: false;
    supportsOptimizerClaims: false;
    supportsAutoTuneClaims: false;
    supportsDamageClaims: false;
    supportsRotationClaims: false;
    supportsEnergyRechargeClaims: false;
  };
  packetSha256: string;
}

export interface GuideDraftFieldPolicyEntry {
  fieldId: string;
  fieldPath: string;
  fieldSha256: string;
  state: GuideDraftField["state"];
  blockerCodes: GuideDraftBlockerCode[];
  optionFieldIds: string[];
}

export interface GuideDraftFieldPolicy {
  fieldTreeShapeSha256: string;
  entries: GuideDraftFieldPolicyEntry[];
}

export type GuideDraftPacketInput<
  TFields extends Record<string, unknown>,
> = Omit<GuideDraftPacket<TFields>, "packetSha256">;

export function finalizeGuideDraftField(
  field: GuideDraftFieldInput,
): GuideDraftField {
  return {
    ...structuredClone(field),
    fieldSha256: hashGuideDraftValue(field),
  } as GuideDraftField;
}

export function finalizeGuideDraftBlocker(
  blocker: Omit<GuideDraftBlocker, "blockerSha256">,
): GuideDraftBlocker {
  return {
    ...structuredClone(blocker),
    blockerSha256: hashGuideDraftValue(blocker),
  };
}

export function finalizeGuideDraftPacket<
  TFields extends Record<string, unknown>,
>(packet: GuideDraftPacketInput<TFields>): GuideDraftPacket<TFields> {
  return {
    ...structuredClone(packet),
    packetSha256: hashGuideDraftValue(packet),
  };
}

export function buildGuideDraftFieldPolicy<
  TFields extends Record<string, unknown>,
>(
  fields: TFields,
  blockers: readonly GuideDraftBlocker[],
): GuideDraftFieldPolicy {
  const blockerById = new Map(
    blockers.map((blocker) => [blocker.blockerId, blocker] as const),
  );
  return {
    fieldTreeShapeSha256: hashGuideDraftValue(buildFieldTreeShape(fields)),
    entries: collectGuideDraftFields(fields, "/fields")
      .map(({ field }) => ({
        fieldId: field.fieldId,
        fieldPath: field.fieldPath,
        fieldSha256: field.fieldSha256,
        state: field.state,
        blockerCodes: field.blockerIds
          .map((blockerId) => {
            const blocker = blockerById.get(blockerId);
            if (!blocker) {
              throw new Error(
                `Cannot construct Guide draft policy with unknown blocker ${blockerId}.`,
              );
            }
            return blocker.code;
          })
          .sort(compareText),
        optionFieldIds:
          field.state === "unselected"
            ? [...field.optionFieldIds].sort(compareText)
            : [],
      }))
      .sort((left, right) => compareText(left.fieldPath, right.fieldPath)),
  };
}

export function validateGuideDraftPacket<
  TFields extends Record<string, unknown>,
>(
  packet: GuideDraftPacket<TFields>,
  upstreamReport: unknown,
  expectedUpstreamReportPath: string,
  expectedFieldPolicy: GuideDraftFieldPolicy,
): GuideDraftPacket<TFields> {
  // The caller must obtain this policy from its trusted projector or a prior
  // canonical reconstruction, never from the untrusted packet being checked.
  validateExactObjectKeys(packet, [
    "blockers",
    "capabilityBoundary",
    "fields",
    "packetId",
    "packetSha256",
    "packetType",
    "readiness",
    "schemaVersion",
    "subject",
    "upstream",
  ], `packet ${packet.packetId}`);
  validateExactObjectKeys(packet.subject, [
    "characterId",
    "requestId",
  ], `packet ${packet.packetId} subject`);
  validateExactObjectKeys(packet.upstream, [
    "candidateCanonicalObjectSha256",
    "candidateId",
    "candidateJsonPointer",
    "candidateSha256",
    "envelopeCanonicalObjectSha256",
    "envelopeId",
    "envelopeJsonPointer",
    "envelopeSha256",
    "profileId",
    "reportCanonicalSha256",
    "reportPath",
  ], `packet ${packet.packetId} upstream`);
  validateExactObjectKeys(packet.readiness, [
    "blockerCount",
    "guideReadiness",
    "localRelationProjection",
    "observationProjection",
    "publicationStatus",
  ], `packet ${packet.packetId} readiness`);
  if (packet.schemaVersion !== GUIDE_DRAFT_PACKET_SCHEMA_VERSION) {
    throw new Error("Guide draft packet schema version is unsupported.");
  }
  if (packet.packetType !== "character-guide-draft-packet") {
    throw new Error("Guide draft packet type is unsupported.");
  }
  requireNonEmptyText(packet.packetId, "packetId");
  requireNonEmptyText(packet.subject.characterId, "subject.characterId");
  requireNonEmptyText(packet.subject.requestId, "subject.requestId");
  if (
    packet.packetId !==
    `${packet.subject.requestId}:${packet.subject.characterId}:guide-draft-v1`
  ) {
    throw new Error("Guide draft packet ID is not bound to its subject.");
  }
  requireNonEmptyText(packet.upstream.reportPath, "upstream.reportPath");
  if (packet.upstream.reportPath !== expectedUpstreamReportPath) {
    throw new Error("Guide draft packet upstream report path drifted.");
  }
  if (
    packet.upstream.reportCanonicalSha256 !==
    hashGuideDraftValue(upstreamReport)
  ) {
    throw new Error("Guide draft packet upstream report hash drifted.");
  }
  if (
    packet.packetSha256 !==
    hashGuideDraftValue(omitKey(packet, "packetSha256"))
  ) {
    throw new Error("Guide draft packet identity drifted.");
  }
  validatePacketUpstreamAnchors(packet, upstreamReport);

  const collectedFields = collectGuideDraftFields(packet.fields, "/fields");
  assertFieldTreeContainsOnlyFieldsAndContainers(packet.fields, "/fields");
  if (collectedFields.length === 0) {
    throw new Error("Guide draft packet contains no field states.");
  }
  const fieldById = new Map<string, GuideDraftField>();
  const fieldByPath = new Map<string, GuideDraftField>();
  for (const { field, actualPath } of collectedFields) {
    if (field.fieldPath !== actualPath) {
      throw new Error(
        `Guide draft field path drifted for ${field.fieldId}: ${field.fieldPath} != ${actualPath}.`,
      );
    }
    if (fieldById.has(field.fieldId) || fieldByPath.has(field.fieldPath)) {
      throw new Error(`Guide draft field identity is duplicated: ${field.fieldId}.`);
    }
    fieldById.set(field.fieldId, field);
    fieldByPath.set(field.fieldPath, field);
    validateGuideDraftField(field, upstreamReport);
  }

  const blockerById = new Map<string, GuideDraftBlocker>();
  for (const blocker of packet.blockers) {
    validateExactObjectKeys(blocker, [
      "blockerId",
      "blockerSha256",
      "blocksPublication",
      "code",
      "fieldId",
      "fieldPath",
      "sourceFieldSha256",
    ], `blocker ${blocker.blockerId}`);
    requireNonEmptyText(blocker.blockerId, "blocker.blockerId");
    requireNonEmptyText(blocker.code, "blocker.code");
    if (!GUIDE_DRAFT_BLOCKER_CODES.has(blocker.code)) {
      throw new Error(`Guide draft blocker ${blocker.blockerId} has an unknown code.`);
    }
    if (!blocker.blocksPublication) {
      throw new Error(`Guide draft blocker ${blocker.blockerId} does not block publication.`);
    }
    if (
      blocker.blockerId !==
      `${packet.packetId}:${blocker.fieldId}:${blocker.code}`
    ) {
      throw new Error(
        `Guide draft blocker ${blocker.blockerId} is not deterministically named.`,
      );
    }
    if (blockerById.has(blocker.blockerId)) {
      throw new Error(`Guide draft blocker identity is duplicated: ${blocker.blockerId}.`);
    }
    const field = fieldById.get(blocker.fieldId);
    if (!field || field.fieldPath !== blocker.fieldPath) {
      throw new Error(`Guide draft blocker ${blocker.blockerId} is orphaned.`);
    }
    if (field.fieldSha256 !== blocker.sourceFieldSha256) {
      throw new Error(`Guide draft blocker ${blocker.blockerId} field hash drifted.`);
    }
    if (!field.blockerIds.includes(blocker.blockerId)) {
      throw new Error(`Guide draft blocker ${blocker.blockerId} is not linked by its field.`);
    }
    if (
      blocker.blockerSha256 !==
      hashGuideDraftValue(omitKey(blocker, "blockerSha256"))
    ) {
      throw new Error(`Guide draft blocker ${blocker.blockerId} identity drifted.`);
    }
    blockerById.set(blocker.blockerId, blocker);
  }
  for (const field of fieldById.values()) {
    if (new Set(field.blockerIds).size !== field.blockerIds.length) {
      throw new Error(`Guide draft field ${field.fieldId} has duplicate blockers.`);
    }
    for (const blockerId of field.blockerIds) {
      if (!blockerById.has(blockerId)) {
        throw new Error(`Guide draft field ${field.fieldId} links an unknown blocker.`);
      }
    }
    if (field.state === "unselected") {
      for (const optionFieldId of field.optionFieldIds) {
        if (optionFieldId === field.fieldId || !fieldById.has(optionFieldId)) {
          throw new Error(
            `Guide draft field ${field.fieldId} has an unresolved option-field link.`,
          );
        }
      }
    }
  }
  const actualFieldPolicy = buildGuideDraftFieldPolicy(
    packet.fields,
    packet.blockers,
  );
  if (stableJson(actualFieldPolicy) !== stableJson(expectedFieldPolicy)) {
    throw new Error("Guide draft packet field-state policy drifted.");
  }
  if (
    packet.readiness.observationProjection !== "complete" ||
    packet.readiness.guideReadiness !== "incomplete" ||
    packet.readiness.publicationStatus !== "withheld" ||
    packet.readiness.blockerCount !== packet.blockers.length ||
    packet.blockers.length === 0
  ) {
    throw new Error("Guide draft packet readiness boundary drifted.");
  }
  const relationFields = [...fieldById.values()].filter(
    ({ state }) =>
      state === "locally-admitted-relation" ||
      state === "withheld-counterexample" ||
      state === "withheld-inconclusive",
  );
  const expectedRelationProjection = relationFields.some(
    ({ state }) => state === "withheld-counterexample",
  )
    ? "partial-counterexamples-preserved"
    : relationFields.some(({ state }) => state === "withheld-inconclusive")
      ? "partial-inconclusive-preserved"
      : "all-locally-admitted";
  if (
    relationFields.length === 0 ||
    packet.readiness.localRelationProjection !== expectedRelationProjection
  ) {
    throw new Error("Guide draft packet local-relation readiness drifted.");
  }
  validateCapabilityBoundary(packet.capabilityBoundary);
  return packet;
}

export function resolveGuideDraftJsonPointer(
  root: unknown,
  pointer: string,
): unknown {
  if (pointer === "") return root;
  if (!pointer.startsWith("/")) {
    throw new Error(`Guide draft provenance pointer is not absolute: ${pointer}.`);
  }
  let current = root;
  for (const rawSegment of pointer.slice(1).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(segment)) {
        throw new Error(`Guide draft array pointer segment is invalid: ${segment}.`);
      }
      const index = Number(segment);
      if (index >= current.length) {
        throw new Error(`Guide draft array pointer is out of bounds: ${pointer}.`);
      }
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.hasOwn(current, segment)) {
      throw new Error(`Guide draft provenance pointer is unresolved: ${pointer}.`);
    }
    current = current[segment];
  }
  return current;
}

export function hashGuideDraftValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function validateGuideDraftField(
  field: GuideDraftField,
  upstreamReport: unknown,
): void {
  requireNonEmptyText(field.fieldId, "field.fieldId");
  requireNonEmptyText(field.fieldPath, "field.fieldPath");
  if (field.provenance.length === 0) {
    throw new Error(`Guide draft field ${field.fieldId} has no provenance.`);
  }
  for (const provenance of field.provenance) {
    validateGuideDraftProvenance(provenance, upstreamReport);
  }
  if (
    field.fieldSha256 !== hashGuideDraftValue(omitKey(field, "fieldSha256"))
  ) {
    throw new Error(`Guide draft field ${field.fieldId} identity drifted.`);
  }

  const noBlockers =
    field.state === "preserved-evidence" ||
    field.state === "locally-admitted-relation";
  if (noBlockers ? field.blockerIds.length !== 0 : field.blockerIds.length === 0) {
    throw new Error(`Guide draft field ${field.fieldId} blocker shape is illegal.`);
  }

  const baseKeys = [
    "blockerIds",
    "fieldId",
    "fieldPath",
    "fieldSha256",
    "provenance",
    "state",
  ];
  const firstProvenance = field.provenance[0];
  switch (field.state) {
    case "preserved-evidence":
    case "preserved-blocking-evidence":
    case "locally-admitted-relation":
      validateExactObjectKeys(field, [...baseKeys, "value"], `field ${field.fieldId}`);
      if (
        hashGuideDraftValue(field.value) !==
        firstProvenance.sourceValueCanonicalSha256
      ) {
        throw new Error(`Guide draft field ${field.fieldId} does not preserve its source value.`);
      }
      validateValueBoundState(field);
      break;
    case "withheld-counterexample":
    case "withheld-inconclusive":
    case "guarded-unresolved-alternative":
      validateExactObjectKeys(
        field,
        [...baseKeys, "preservedObservation", "value"],
        `field ${field.fieldId}`,
      );
      if (
        field.value !== null ||
        hashGuideDraftValue(field.preservedObservation) !==
          firstProvenance.sourceValueCanonicalSha256
      ) {
        throw new Error(`Guide draft field ${field.fieldId} observation boundary drifted.`);
      }
      validateValueBoundState(field);
      break;
    case "unselected":
      validateExactObjectKeys(
        field,
        [...baseKeys, "optionFieldIds", "value"],
        `field ${field.fieldId}`,
      );
      if (
        field.value !== null ||
        hashGuideDraftValue(null) !== firstProvenance.sourceValueCanonicalSha256 ||
        new Set(field.optionFieldIds).size !== field.optionFieldIds.length
      ) {
        throw new Error(`Guide draft field ${field.fieldId} unselected boundary drifted.`);
      }
      validateValueBoundState(field);
      break;
    case "missing-not-zero":
    case "not-computed":
    case "deferred-missing-not-zero":
      validateExactObjectKeys(
        field,
        [...baseKeys, "upstreamMarker", "value"],
        `field ${field.fieldId}`,
      );
      if (
        field.value !== null ||
        hashGuideDraftValue(field.upstreamMarker) !==
          firstProvenance.sourceValueCanonicalSha256
      ) {
        throw new Error(`Guide draft field ${field.fieldId} missing/computation boundary drifted.`);
      }
      validateValueBoundState(field);
      break;
    default:
      assertNever(field);
  }
}

function validateGuideDraftProvenance(
  provenance: GuideDraftUpstreamProvenance,
  upstreamReport: unknown,
): void {
  validateExactObjectKeys(provenance, [
    "sourceObjectCanonicalSha256",
    "sourceObjectId",
    "sourceObjectJsonPointer",
    "sourceValueCanonicalSha256",
    "sourceValueJsonPointer",
  ], `provenance ${provenance.sourceObjectId}`);
  requireNonEmptyText(provenance.sourceObjectId, "provenance.sourceObjectId");
  if (
    provenance.sourceObjectJsonPointer !== "" &&
    provenance.sourceValueJsonPointer !== provenance.sourceObjectJsonPointer &&
    !provenance.sourceValueJsonPointer.startsWith(
      `${provenance.sourceObjectJsonPointer}/`,
    )
  ) {
    throw new Error(
      `Guide draft provenance value escapes its source object for ${provenance.sourceObjectId}.`,
    );
  }
  const sourceObject = resolveGuideDraftJsonPointer(
    upstreamReport,
    provenance.sourceObjectJsonPointer,
  );
  const sourceValue = resolveGuideDraftJsonPointer(
    upstreamReport,
    provenance.sourceValueJsonPointer,
  );
  if (
    hashGuideDraftValue(sourceObject) !== provenance.sourceObjectCanonicalSha256 ||
    hashGuideDraftValue(sourceValue) !== provenance.sourceValueCanonicalSha256
  ) {
    throw new Error(`Guide draft provenance hash drifted for ${provenance.sourceObjectId}.`);
  }
}

function collectGuideDraftFields(
  value: unknown,
  pointer: string,
): Array<{ field: GuideDraftField; actualPath: string }> {
  if (looksLikeGuideDraftField(value)) {
    return [{ field: value as GuideDraftField, actualPath: pointer }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectGuideDraftFields(entry, `${pointer}/${index}`),
    );
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    collectGuideDraftFields(entry, `${pointer}/${escapeJsonPointerSegment(key)}`),
  );
}

function assertFieldTreeContainsOnlyFieldsAndContainers(
  value: unknown,
  pointer: string,
): void {
  if (looksLikeGuideDraftField(value)) return;
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      assertFieldTreeContainsOnlyFieldsAndContainers(entry, `${pointer}/${index}`);
    }
    return;
  }
  if (!isRecord(value)) {
    throw new Error(`Guide draft field tree has a non-field leaf at ${pointer}.`);
  }
  for (const [key, entry] of Object.entries(value)) {
    assertFieldTreeContainsOnlyFieldsAndContainers(
      entry,
      `${pointer}/${escapeJsonPointerSegment(key)}`,
    );
  }
}

function buildFieldTreeShape(value: unknown): unknown {
  if (looksLikeGuideDraftField(value)) {
    const field = value as GuideDraftField;
    return { fieldId: field.fieldId, fieldPath: field.fieldPath };
  }
  if (Array.isArray(value)) return value.map(buildFieldTreeShape);
  if (!isRecord(value)) return { nonFieldLeafType: typeof value };
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      buildFieldTreeShape(entry),
    ]),
  );
}

function validateValueBoundState(field: GuideDraftField): void {
  switch (field.state) {
    case "preserved-evidence":
      if (
        isReservedMissingOrBlockingValue(field.value) ||
        hasRelationAdmissionStatus(field.value) ||
        hasUnresolvedGuardStatus(field.value)
      ) {
        throw new Error(
          `Guide draft field ${field.fieldId} cannot promote a blocked or discriminated source value to preserved evidence.`,
        );
      }
      return;
    case "preserved-blocking-evidence":
      if (!isIntrinsicBlockingEvidence(field.value)) {
        throw new Error(
          `Guide draft field ${field.fieldId} is not an intrinsic blocking observation.`,
        );
      }
      return;
    case "locally-admitted-relation":
      requireAdmissionStatus(
        field.value,
        "admitted-unanimous-across-all-16-tested-contexts",
        field.fieldId,
      );
      return;
    case "withheld-counterexample":
      requireAdmissionStatus(
        field.preservedObservation,
        "withheld-counterexample",
        field.fieldId,
      );
      return;
    case "withheld-inconclusive":
      requireAdmissionStatus(
        field.preservedObservation,
        "withheld-inconclusive",
        field.fieldId,
      );
      return;
    case "guarded-unresolved-alternative":
      if (!hasUnresolvedGuardStatus(field.preservedObservation)) {
        throw new Error(
          `Guide draft field ${field.fieldId} does not preserve an unresolved guard.`,
        );
      }
      return;
    case "unselected":
      return;
    case "missing-not-zero":
      if (
        field.upstreamMarker !== null &&
        field.upstreamMarker !== "missing-not-zero"
      ) {
        throw new Error(
          `Guide draft field ${field.fieldId} does not preserve a missing-not-zero marker.`,
        );
      }
      return;
    case "not-computed":
      if (field.upstreamMarker !== "not-computed") {
        throw new Error(
          `Guide draft field ${field.fieldId} does not preserve a not-computed marker.`,
        );
      }
      return;
    case "deferred-missing-not-zero":
      if (field.upstreamMarker !== "deferred-missing-not-zero") {
        throw new Error(
          `Guide draft field ${field.fieldId} does not preserve a deferred marker.`,
        );
      }
      return;
    default:
      assertNever(field);
  }
}

function isReservedMissingOrBlockingValue(value: unknown): boolean {
  return (
    value === null ||
    value === false ||
    value === "unreviewed" ||
    value === "missing-not-zero" ||
    value === "not-computed" ||
    value === "deferred-missing-not-zero" ||
    isUnspecifiedStatus(value)
  );
}

function isIntrinsicBlockingEvidence(value: unknown): boolean {
  return value === false || value === "unreviewed" || isUnspecifiedStatus(value);
}

function isUnspecifiedStatus(value: unknown): boolean {
  return (
    isRecord(value) &&
    stableJson(value) === stableJson({ status: "unspecified" })
  );
}

function hasRelationAdmissionStatus(value: unknown): boolean {
  return isRecord(value) && typeof value.admissionStatus === "string";
}

function hasUnresolvedGuardStatus(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.conditionStatus === "additional-source-guard-unresolved"
  );
}

function requireAdmissionStatus(
  value: unknown,
  expectedStatus: string,
  fieldId: string,
): void {
  if (!isRecord(value) || value.admissionStatus !== expectedStatus) {
    throw new Error(
      `Guide draft relation field ${fieldId} disagrees with its upstream admission status.`,
    );
  }
}

function looksLikeGuideDraftField(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.fieldId === "string" &&
    typeof value.fieldPath === "string" &&
    typeof value.state === "string" &&
    typeof value.fieldSha256 === "string"
  );
}

function validatePacketUpstreamAnchors<TFields extends Record<string, unknown>>(
  packet: GuideDraftPacket<TFields>,
  upstreamReport: unknown,
): void {
  const envelope = resolveGuideDraftJsonPointer(
    upstreamReport,
    packet.upstream.envelopeJsonPointer,
  );
  const candidate = resolveGuideDraftJsonPointer(
    upstreamReport,
    packet.upstream.candidateJsonPointer,
  );
  if (
    hashGuideDraftValue(envelope) !==
      packet.upstream.envelopeCanonicalObjectSha256 ||
    hashGuideDraftValue(candidate) !==
      packet.upstream.candidateCanonicalObjectSha256
  ) {
    throw new Error("Guide draft packet upstream anchor hash drifted.");
  }
  if (
    !isRecord(envelope) ||
    !isRecord(candidate) ||
    envelope.envelopeId !== packet.upstream.envelopeId ||
    envelope.envelopeSha256 !== packet.upstream.envelopeSha256 ||
    candidate.candidateId !== packet.upstream.candidateId ||
    candidate.candidateSha256 !== packet.upstream.candidateSha256
  ) {
    throw new Error("Guide draft packet upstream anchor identity drifted.");
  }
  const request = envelope.request;
  if (
    !isRecord(request) ||
    request.requestId !== packet.subject.requestId ||
    request.characterId !== packet.subject.characterId ||
    candidate.characterId !== packet.subject.characterId
  ) {
    throw new Error("Guide draft packet subject is not bound to its upstream request.");
  }
  const artifactProfile = candidate.artifactProfile;
  if (
    !isRecord(artifactProfile) ||
    artifactProfile.profileId !== packet.upstream.profileId
  ) {
    throw new Error("Guide draft packet upstream profile identity drifted.");
  }
}

function validateCapabilityBoundary(
  capability: GuideDraftPacket<Record<string, unknown>>["capabilityBoundary"],
): void {
  const expected = {
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
  if (stableJson(capability) !== stableJson(expected)) {
    throw new Error("Guide draft packet capability boundary drifted.");
  }
}

function validateExactObjectKeys(
  value: object,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} has an illegal object shape.`);
  }
}

function requireNonEmptyText(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must not be empty.`);
}

function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Guide draft field state: ${stableJson(value)}`);
}
