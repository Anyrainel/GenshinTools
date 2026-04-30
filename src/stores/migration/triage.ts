import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import type { TriageSettings } from "@/lib/account-data/triage/types";

interface LegacyTriageState {
  settings?: Partial<TriageSettings> & {
    strategicHighLevelEvaluation?: unknown;
  };
  settingsByProfileId?: Record<string, TriageSettings>;
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
  state.settings = settings as Partial<TriageSettings>;
  if (version < 5 || !state.settingsByProfileId) {
    state.settingsByProfileId = {
      [DEFAULT_ACCOUNT_PROFILE_ID]: settings as TriageSettings,
    };
  }
  if (version < 6) {
    delete state.settings;
  }
  return state;
}
