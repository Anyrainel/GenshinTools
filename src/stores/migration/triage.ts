import type { TriageSettings } from "@/lib/account-data/triage/types";

interface LegacyTriageState {
  settings?: Partial<TriageSettings> & {
    strategicHighLevelEvaluation?: unknown;
  };
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
  return state;
}
