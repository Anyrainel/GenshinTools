import type { ScanRequest } from "./types";

export const RECENT_ARTIFACT_SCAN_DEFAULT_LIMIT = 60;
export const RECENT_ARTIFACT_SCAN_MIN_LIMIT = 1;
export const RECENT_ARTIFACT_SCAN_MAX_LIMIT = 1000;

export function parseRecentArtifactLimit(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const limit = Number.parseInt(trimmed, 10);
  if (
    !Number.isInteger(limit) ||
    limit < RECENT_ARTIFACT_SCAN_MIN_LIMIT ||
    limit > RECENT_ARTIFACT_SCAN_MAX_LIMIT
  ) {
    return null;
  }

  return limit;
}

export function createRecentArtifactScanRequest(
  artifactLimit: number
): ScanRequest {
  if (
    !Number.isInteger(artifactLimit) ||
    artifactLimit < RECENT_ARTIFACT_SCAN_MIN_LIMIT ||
    artifactLimit > RECENT_ARTIFACT_SCAN_MAX_LIMIT
  ) {
    throw new Error(
      "Recent artifact scan limit must be an integer from 1 to 1000"
    );
  }

  return {
    artifacts: true,
    artifactMode: "recent",
    artifactLimit,
  };
}
