import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import type {
  ResourceKind,
  TierCompletenessThresholds,
} from "@/lib/account-data/resourceTips";

type KindTierMinScore = Record<ResourceKind, TierCompletenessThresholds>;

interface LegacyResourceRecState {
  thresholds?: TierCompletenessThresholds;
  minScoreDiff?: TierCompletenessThresholds | KindTierMinScore;
  panelOpen?: boolean;
  showCraft?: boolean;
  showReroll?: boolean;
  showLevelup?: boolean;
  kindMinScore?: unknown;
  settingsByProfileId?: Record<string, unknown>;
}

export function migrateResourceRecStore(
  persisted: unknown,
  version: number
): Record<string, unknown> {
  const state = (persisted ?? {}) as LegacyResourceRecState &
    Record<string, unknown>;
  // v<6 -> v6: minScoreDiff changed from flat TierCompletenessThresholds
  // to Record<ResourceKind, TierCompletenessThresholds>.
  // Old shape: { S: 0, A: 5, ... }
  // New shape: { craft: { S: 0, ... }, reroll: { S: 5, ... }, ... }
  if (version < 6) {
    const old = state.minScoreDiff as TierCompletenessThresholds | undefined;
    if (old && typeof old === "object" && "S" in old) {
      // Migrate: use old values for craft/levelup, bump reroll higher.
      state.minScoreDiff = {
        craft: { ...old },
        reroll: {
          S: (old.S ?? 0) + 5,
          A: (old.A ?? 5) + 5,
          B: (old.B ?? 10) + 5,
          C: (old.C ?? 15) + 5,
          D: (old.D ?? 20) + 5,
          Pool: (old.Pool ?? 20) + 5,
        },
        levelup: { ...old },
      };
    }
    // Remove obsolete kindMinScore field from v5.
    state.kindMinScore = undefined;
  }
  if (version < 7) {
    state.settingsByProfileId = {
      [DEFAULT_ACCOUNT_PROFILE_ID]: {
        thresholds: state.thresholds,
        minScoreDiff: state.minScoreDiff,
        panelOpen: state.panelOpen,
        showCraft: state.showCraft,
        showReroll: state.showReroll,
        showLevelup: state.showLevelup,
      },
    };
  }
  return state;
}
