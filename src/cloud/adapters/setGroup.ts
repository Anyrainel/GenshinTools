import { encodePathSegment } from "@/cloud/payload";

/**
 * Editable artifact-set grouping for cloud artifact shards.
 *
 * Leave a set absent to use its own set key as the group. Before launch, edit
 * this map to coarsen groups if per-set shards are too granular.
 */
export const ARTIFACT_SET_GROUP_OVERRIDES: Record<string, string> = {};

export function getArtifactSetGroup(setKey: string): string {
  return encodePathSegment(ARTIFACT_SET_GROUP_OVERRIDES[setKey] ?? setKey);
}
