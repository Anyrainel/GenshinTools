import { DEFAULT_GLOBAL_STAT_WEIGHTS } from "@/domain/build/artifact/scoring/constants";
import type { GlobalStatWeights } from "@/domain/models";
import { PersistedArtifactScoreStoreSchema } from "@/stores/schemas";

export type ArtifactScoreGlobalConfig = { global: GlobalStatWeights };

export function migrateArtifactScorePersisted(
  persisted: unknown
): ArtifactScoreGlobalConfig {
  const parsed = PersistedArtifactScoreStoreSchema.safeParse(persisted);
  return parsed.success
    ? parsed.data.config
    : { global: DEFAULT_GLOBAL_STAT_WEIGHTS };
}
