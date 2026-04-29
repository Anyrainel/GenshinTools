import type { LuckExpectation } from "@/data/enums";
import type { TierAssignment, TierCustomization } from "@/data/types";

interface TierListInstanceMigration {
  id: number;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
  linkedAccountId: string | null;
}

/** v0 (single instance) and v1 (multi-instance, with removed investment thresholds). */
interface LegacyPersistedState {
  // v0 fields
  tierAssignments?: TierAssignment;
  tierCustomization?: TierCustomization;
  customTitle?: string;
  author?: string;
  description?: string;
  // v0 + v1
  showWeapons?: boolean;
  showTravelers?: boolean;
  showManekin?: boolean;
  investmentThresholds?: unknown;
  // v1
  tierLists?: Record<number, TierListInstanceMigration>;
  activeTierListId?: number;
  nextId?: number;
  // compatibility for persisted TierCustomization shape
  luckExpectation?: LuckExpectation;
}

export function migrateTierStore(
  persistedState: unknown,
  version: number
): Record<string, unknown> {
  if (version <= 0) {
    const old = (persistedState ?? {}) as LegacyPersistedState;
    const instance: TierListInstanceMigration = {
      id: 1,
      tierAssignments: old.tierAssignments ?? {},
      tierCustomization: old.tierCustomization ?? {},
      customTitle: old.customTitle ?? "",
      author: old.author ?? "",
      description: old.description ?? "",
      linkedAccountId: null,
    };
    return {
      tierLists: { 1: instance },
      activeTierListId: 1,
      nextId: 2,
      showWeapons: old.showWeapons ?? true,
      showTravelers: old.showTravelers ?? false,
      showManekin: old.showManekin ?? false,
      tierAssignments: instance.tierAssignments,
      tierCustomization: instance.tierCustomization,
      customTitle: instance.customTitle,
      author: instance.author,
      description: instance.description,
    };
  }
  if (version === 1) {
    // v1 -> v2: drop removed investment threshold preferences.
    const old = (persistedState ?? {}) as LegacyPersistedState;
    const { investmentThresholds, ...rest } = old;
    return rest;
  }
  return persistedState as Record<string, unknown>;
}
