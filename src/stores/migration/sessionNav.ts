import { DEFAULT_VIEW_SETTINGS } from "@/stores/schemas";

const VIEW_IDS = ["damage", "investment", "weaponChoice"] as const;

type PersistedSessionEnvelope = {
  state?: Record<string, unknown>;
};

export function migrateSessionNavStorageValue(
  value: unknown
): PersistedSessionEnvelope {
  const envelope =
    value && typeof value === "object"
      ? (value as PersistedSessionEnvelope)
      : {};
  const state =
    envelope.state && typeof envelope.state === "object"
      ? envelope.state
      : undefined;
  if (!state) return envelope;

  if (!state.viewSettings) {
    state.viewSettings = {
      damage: {
        ...DEFAULT_VIEW_SETTINGS,
        activeTeamId: state.activeTeamId ?? null,
      },
      investment: {
        ...DEFAULT_VIEW_SETTINGS,
        activeTeamId: state.activeInvestmentTeamId ?? null,
      },
      weaponChoice: {
        ...DEFAULT_VIEW_SETTINGS,
        activeTeamId: state.activeWeaponChoiceTeamId ?? null,
      },
    };
    delete state.activeTeamId;
    delete state.activeInvestmentTeamId;
    delete state.activeWeaponChoiceTeamId;
  }

  const viewSettings =
    state.viewSettings && typeof state.viewSettings === "object"
      ? (state.viewSettings as Record<string, unknown>)
      : {};
  for (const viewId of VIEW_IDS) {
    viewSettings[viewId] = {
      ...DEFAULT_VIEW_SETTINGS,
      ...(viewSettings[viewId] && typeof viewSettings[viewId] === "object"
        ? (viewSettings[viewId] as Record<string, unknown>)
        : {}),
    };
  }
  state.viewSettings = viewSettings;

  return envelope;
}
