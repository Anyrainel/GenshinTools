import type { GlobalStatWeights } from "@/data/types";
import {
  DEFAULT_GLOBAL_STAT_WEIGHTS,
  PersistedArtifactScoreStoreSchema,
} from "@/stores/schemas";

export type ArtifactScoreGlobalConfig = { global: GlobalStatWeights };

export function migrateArtifactScorePersisted(
  persisted: unknown
): ArtifactScoreGlobalConfig {
  const parsed = PersistedArtifactScoreStoreSchema.safeParse(persisted);
  return parsed.success
    ? parsed.data.config
    : { global: DEFAULT_GLOBAL_STAT_WEIGHTS };
}
