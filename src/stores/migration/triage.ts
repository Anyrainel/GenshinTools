import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import { DEFAULT_TRIAGE_SETTINGS } from "@/lib/account-data/triage/constants";
import { inferTriageBackupAmountMode } from "@/lib/account-data/triage/settings";
import type { TriageSettings } from "@/lib/account-data/triage/types";

interface LegacyTriageState {
  settings?: Partial<TriageSettings> & {
    strategicHighLevelEvaluation?: unknown;
  };
  settingsByProfileId?: Record<string, Partial<TriageSettings>>;
}

export function migrateTriageStore(
  persisted: unknown,
  version: number
): Record<string, unknown> {
  const state = (persisted ?? {}) as LegacyTriageState &
    Record<string, unknown>;
  const settings = (state.settings ?? {}) as Record<string, unknown>;
  // v3 -> v4: rename strategicHighLevelEvaluation -> highLevelProtection
  // and flip its meaning (protection = !evaluation).
  if (version < 4) {
    const prev = settings.strategicHighLevelEvaluation;
    settings.highLevelProtection = prev == null ? true : !prev;
    settings.strategicHighLevelEvaluation = undefined;
  }
  if (version < 5 || !state.settingsByProfileId) {
    state.settingsByProfileId = {
      [DEFAULT_ACCOUNT_PROFILE_ID]: settings,
    };
  }
  // v6 -> v7: add the backup amount preset mode while preserving existing
  // numeric keep-rule values. Values outside the presets become custom.
  if (version < 7 && state.settingsByProfileId) {
    for (const profileSettings of Object.values(state.settingsByProfileId)) {
      if (profileSettings.backupAmountMode) continue;
      profileSettings.backupAmountMode = inferTriageBackupAmountMode({
        qualityMargin:
          profileSettings.qualityMargin ??
          DEFAULT_TRIAGE_SETTINGS.qualityMargin,
        fillerKeep:
          profileSettings.fillerKeep ?? DEFAULT_TRIAGE_SETTINGS.fillerKeep,
        setSlotKeep:
          profileSettings.setSlotKeep ?? DEFAULT_TRIAGE_SETTINGS.setSlotKeep,
      });
    }
  }
  delete state.settings;
  return state;
}
