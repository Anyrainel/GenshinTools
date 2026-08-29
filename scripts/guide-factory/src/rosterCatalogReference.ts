import { sha256Text, stableJson } from "./io";
import type { ReleasedCharacterCatalogEntry } from "./teamRosterCandidateDomain";

export interface CheckedInRosterCatalogReference {
  reportComparisonStatus: string;
  eligibleCharacterCount: number;
  eligibleCatalogSha256: string;
  eligibleCharacterIdsSha256: string;
  playableIdentityCount: number;
}

export interface CheckedInRosterCatalogComparison {
  referenceReportComparable: boolean;
  eligibleCharacterCountMatches: boolean;
  eligibleCatalogHashMatches: boolean;
  eligibleCharacterIdsHashMatches: boolean;
  playableIdentityCountMatches: boolean;
  allChecksMatch: boolean;
}

export function parseCheckedInRosterCatalogReference(
  input: unknown,
): CheckedInRosterCatalogReference {
  if (!isRecord(input)) {
    throw new Error("The checked-in roster-domain report is not an object.");
  }
  const released = input.releasedCatalogBoundary;
  const domain = input.domain;
  if (!isRecord(released) || !isRecord(domain)) {
    throw new Error(
      "The checked-in roster-domain report is missing its catalog boundaries.",
    );
  }
  const compact = domain.catalogBoundary;
  if (!isRecord(compact)) {
    throw new Error(
      "The checked-in roster-domain report is missing domain.catalogBoundary.",
    );
  }
  const reference: CheckedInRosterCatalogReference = {
    reportComparisonStatus: requiredString(
      input.comparisonStatus,
      "comparisonStatus",
    ),
    eligibleCharacterCount: requiredNonNegativeInteger(
      released.eligibleCharacterCount,
      "releasedCatalogBoundary.eligibleCharacterCount",
    ),
    eligibleCatalogSha256: requiredSha256(
      released.eligibleCatalogSha256,
      "releasedCatalogBoundary.eligibleCatalogSha256",
    ),
    eligibleCharacterIdsSha256: requiredSha256(
      compact.characterIdsSha256,
      "domain.catalogBoundary.characterIdsSha256",
    ),
    playableIdentityCount: requiredNonNegativeInteger(
      compact.playableIdentityCount,
      "domain.catalogBoundary.playableIdentityCount",
    ),
  };
  const compactCharacterCount = requiredNonNegativeInteger(
    compact.characterCount,
    "domain.catalogBoundary.characterCount",
  );
  if (compactCharacterCount !== reference.eligibleCharacterCount) {
    throw new Error(
      "The checked-in roster-domain report has inconsistent eligible character counts.",
    );
  }
  return reference;
}

export function compareEligibleCatalogWithCheckedInRosterReport(
  eligibleCharacters: readonly ReleasedCharacterCatalogEntry[],
  reference: CheckedInRosterCatalogReference,
): CheckedInRosterCatalogComparison {
  const eligibleCharacterCountMatches =
    eligibleCharacters.length === reference.eligibleCharacterCount;
  const eligibleCatalogHashMatches =
    sha256Text(stableJson(eligibleCharacters)) ===
    reference.eligibleCatalogSha256;
  const eligibleCharacterIdsHashMatches =
    sha256Text(
      stableJson(eligibleCharacters.map(({ characterId }) => characterId)),
    ) === reference.eligibleCharacterIdsSha256;
  const playableIdentityCountMatches =
    new Set(
      eligibleCharacters.map(
        ({ characterId, playableIdentityId }) =>
          playableIdentityId ??
          (characterId.startsWith("traveler_") ? "traveler" : characterId),
      ),
    ).size === reference.playableIdentityCount;
  const referenceReportComparable =
    reference.reportComparisonStatus === "comparable";
  return {
    referenceReportComparable,
    eligibleCharacterCountMatches,
    eligibleCatalogHashMatches,
    eligibleCharacterIdsHashMatches,
    playableIdentityCountMatches,
    allChecksMatch:
      referenceReportComparable &&
      eligibleCharacterCountMatches &&
      eligibleCatalogHashMatches &&
      eligibleCharacterIdsHashMatches &&
      playableIdentityCountMatches,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The checked-in roster-domain report has invalid ${path}.`);
  }
  return value;
}

function requiredSha256(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!/^[a-f0-9]{64}$/.test(parsed)) {
    throw new Error(`The checked-in roster-domain report has invalid ${path}.`);
  }
  return parsed;
}

function requiredNonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`The checked-in roster-domain report has invalid ${path}.`);
  }
  return value as number;
}
