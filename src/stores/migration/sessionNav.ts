import { DEFAULT_VIEW_SETTINGS } from "@/stores/schemas";

type PersistedSessionEnvelope = {
  state?: Record<string, unknown>;
  version?: number;
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
      ? { ...envelope.state }
      : undefined;
  if (!state) return envelope;
  // Before v1, damage/investment/weaponChoice each owned grid settings.
  // Damage wins conflicting preferences; other views are fallback when absent.
  // Former selected-team modes survive as defaults, with the same precedence.
  const oldViews =
    state.viewSettings && typeof state.viewSettings === "object"
      ? (state.viewSettings as Record<string, unknown>)
      : {};
  const readView = (key: string): Record<string, unknown> | undefined => {
    const raw = oldViews[key];
    return raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : undefined;
  };
  const damage = readView("damage");
  const investment = readView("investment");
  const weapons = readView("weaponChoice");
  const analysis = readView("analysis") ??
    damage ??
    investment ??
    weapons ?? {
      activeTeamId:
        state.activeTeamId ??
        state.activeInvestmentTeamId ??
        state.activeWeaponChoiceTeamId ??
        null,
    };
  const modes =
    state.analysisModes && typeof state.analysisModes === "object"
      ? { ...(state.analysisModes as Record<string, unknown>) }
      : {};
  for (const [view, mode, oldId] of [
    [damage, "artifacts", state.activeTeamId],
    [investment, "investment", state.activeInvestmentTeamId],
    [weapons, "builds", state.activeWeaponChoiceTeamId],
  ] as const) {
    const id = view?.activeTeamId ?? oldId;
    if (typeof id === "string" && !(id in modes)) modes[id] = mode;
  }
  state.viewSettings = { analysis: { ...DEFAULT_VIEW_SETTINGS, ...analysis } };
  state.analysisModes = modes;
  delete state.activeTeamId;
  delete state.activeInvestmentTeamId;
  delete state.activeWeaponChoiceTeamId;
  return { ...envelope, state, version: 1 };
}
