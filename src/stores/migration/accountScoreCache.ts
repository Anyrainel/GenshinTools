export function migrateAccountScoreCacheStore(
  persistedState: unknown,
  version: number
): unknown {
  if (version < 3) {
    // v1 cached scores were computed before the complete CR-budget model.
    // They are derived data, so discard them and let the public scoring path
    // rebuild every character after the lazy game-stat resources are ready.
    // v2 scores can still carry weapons under retired 7.1 beta IDs.
    return {
      scoresByProfileId: {},
      staleScoreCharIdsByProfileId: {},
    };
  }

  return persistedState;
}
