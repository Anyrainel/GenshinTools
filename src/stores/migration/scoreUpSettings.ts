import {
  normalizeScoreUpSettings,
  type ScoreUpSettings,
} from "@/lib/account-data/scoreUpSettings";

type ScoreUpSettingsStoreMigration = {
  settingsByProfileId?: Record<string, Partial<ScoreUpSettings>>;
};

export function migrateScoreUpSettingsStore(
  persistedState: unknown,
  version: number
): unknown {
  const state = {
    ...((persistedState ?? {}) as ScoreUpSettingsStoreMigration),
  };

  if (version < 2 && state.settingsByProfileId) {
    // v1 profile settings stored allowPoolArtifactSteals and luckExpectationByTier.
    // v2 adds respectFrozenArtifacts, healed to the default enabled value.
    state.settingsByProfileId = Object.fromEntries(
      Object.entries(state.settingsByProfileId).map(([profileId, settings]) => [
        profileId,
        normalizeScoreUpSettings(settings ?? {}),
      ])
    );
  }

  return state;
}
