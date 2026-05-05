import type { LuckExpectation } from "@/data/enums";
import type { TierAssignment, TierCustomization } from "@/data/types";
import { legacyAccountProfileIdToNumber } from "@/lib/account-data/accountProfile";
import type { AccountProfileId } from "@/lib/account-data/types";

interface TierListInstanceMigration {
  id: number;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
  linkedAccountId: string | AccountProfileId | null;
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
  updatedAt?: number;
  // compatibility for persisted TierCustomization shape
  luckExpectation?: LuckExpectation;
}

interface GenericTierListInstanceMigration {
  id: number;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
}

interface LegacyGenericTierState {
  // v0: weapon/artifact tier stores persisted one flat list.
  tierAssignments?: TierAssignment;
  tierCustomization?: TierCustomization;
  customTitle?: string;
  author?: string;
  description?: string;
  // v1: multi-list shape.
  tierLists?: Record<number, GenericTierListInstanceMigration>;
  activeTierListId?: number;
  nextId?: number;
  updatedAt?: number;
}

export function migrateTierStore(
  persistedState: unknown,
  version: number
): Record<string, unknown> {
  let migratedState = persistedState;
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
    migratedState = {
      tierLists: { 1: instance },
      activeTierListId: 1,
      nextId: 2,
      showWeapons: old.showWeapons ?? true,
      showTravelers: old.showTravelers ?? false,
      showManekin: old.showManekin ?? false,
    };
  } else if (version === 1) {
    // v1 -> v2: drop removed investment threshold preferences.
    const old = (persistedState ?? {}) as LegacyPersistedState;
    const { investmentThresholds, ...rest } = old;
    migratedState = rest;
  }

  if (version < 3) {
    // v2 -> v3: account profile ids moved from strings ("default" or UID text)
    // to numbers (0 or numeric UID).
    const state = (migratedState ?? {}) as LegacyPersistedState;
    const tierLists = state.tierLists ?? {};
    for (const list of Object.values(tierLists)) {
      list.linkedAccountId = legacyAccountProfileIdToNumber(
        list.linkedAccountId
      );
    }
    migratedState = { ...state, tierLists };
  }

  if (version < 4) {
    migratedState = { ...(migratedState ?? {}), updatedAt: Date.now() };
  }

  return migratedState as Record<string, unknown>;
}

export function migrateGenericTierStore(
  persistedState: unknown,
  version: number
): Record<string, unknown> {
  if (version >= 1) {
    const state = (persistedState ?? {}) as LegacyGenericTierState;
    return {
      ...state,
      ...(version < 2 || !Number.isFinite(state.updatedAt)
        ? { updatedAt: Date.now() }
        : {}),
    };
  }

  const old = (persistedState ?? {}) as LegacyGenericTierState;
  const instance: GenericTierListInstanceMigration = {
    id: 1,
    tierAssignments: old.tierAssignments ?? {},
    tierCustomization: old.tierCustomization ?? {},
    customTitle: old.customTitle ?? "",
    author: old.author ?? "",
    description: old.description ?? "",
  };

  return {
    tierLists: { 1: instance },
    activeTierListId: 1,
    nextId: 2,
    updatedAt: Date.now(),
  };
}
