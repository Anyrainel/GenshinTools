export function migrateAccountScoreCacheStore(
  persistedState: unknown,
  version: number
): unknown {
  if (version < 4) {
    // v1 cached scores were computed before the complete CR-budget model.
    // They are derived data, so discard them and let the public scoring path
    // rebuild every character after the lazy game-stat resources are ready.
    // v2 scores can still carry weapons under retired 7.1 beta IDs.
    // v3 cached ArtifactScoreResult objects credited main stats at max level
    // and deducted all excess CR at the substat weight. The shape is unchanged,
    // but those derived scores must be rebuilt under the unified scoring rules.
    return {
      scoresByProfileId: {},
      staleScoreCharIdsByProfileId: {},
    };
  }

  return persistedState;
}
