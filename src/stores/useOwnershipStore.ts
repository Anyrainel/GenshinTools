import { ALWAYS_OWNED_CHARACTER_IDS } from "@/lib/account-data/alwaysOwned";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface ProfileOwnership {
  /** IDs of characters NOT owned (negative-set: everything is owned by default) */
  unownedCharacters: Record<string, true>;
  /** IDs of weapons NOT owned */
  unownedWeapons: Record<string, true>;
  /** Character constellation levels (0-6). Absent = default 0 for 5★, 6 for 4★) */
  characterConstellations: Record<string, number>;
  /** Weapon refinement levels (1-5). Absent = default 1) */
  weaponRefinements: Record<string, number>;
}

interface OwnershipState {
  profiles: Record<string, ProfileOwnership>;

  isOwned: (
    profileId: string,
    type: "character" | "weapon",
    id: string
  ) => boolean;
  setOwned: (
    profileId: string,
    type: "character" | "weapon",
    id: string,
    owned: boolean
  ) => void;
  toggleOwned: (
    profileId: string,
    type: "character" | "weapon",
    id: string
  ) => void;
  bulkSetOwned: (
    profileId: string,
    type: "character" | "weapon",
    ids: string[],
    owned: boolean
  ) => void;
  getConstellation: (profileId: string, characterId: string) => number;
  setConstellation: (
    profileId: string,
    characterId: string,
    level: number
  ) => void;
  getRefinement: (profileId: string, weaponId: string) => number;
  setRefinement: (profileId: string, weaponId: string, level: number) => void;
  /** Atomic replace of the unowned character set for a profile (for GOOD import exhaustive sync) */
  setProfileCharacterOwnership: (
    profileId: string,
    unownedCharacterIds: string[]
  ) => void;
  /** Atomic replace of the unowned weapon set for a profile (for GOOD import exhaustive sync) */
  setProfileWeaponOwnership: (
    profileId: string,
    unownedWeaponIds: string[]
  ) => void;
  /** Rename a profile key (mirrors promoteToUid) */
  promoteProfile: (oldId: string, newId: string) => void;
  /** Remove a profile's ownership data */
  deleteProfile: (id: string) => void;
  /** Wipe all profiles */
  clearAll: () => void;
}

const getField = (type: "character" | "weapon") =>
  type === "character"
    ? ("unownedCharacters" as const)
    : ("unownedWeapons" as const);

const emptyProfile = (): ProfileOwnership => ({
  unownedCharacters: {},
  unownedWeapons: {},
  characterConstellations: {},
  weaponRefinements: {},
});

type PersistedOwnershipState = Pick<OwnershipState, "profiles">;

/**
 * Zustand persist migration function.
 * Exported for unit testing — do not call directly in application code.
 */
export function migrateOwnershipStore(
  persistedState: unknown,
  version: number
): PersistedOwnershipState {
  // biome-ignore lint/suspicious/noExplicitAny: migration across legacy formats
  const state = persistedState as any;
  let v = version;

  // v0: flat { unownedCharacters, unownedWeapons } shape (no profiles)
  if (v === 0) {
    const unownedCharacters: Record<string, true> =
      state.unownedCharacters || {};
    const unownedWeapons: Record<string, true> = state.unownedWeapons || {};

    // Try to find the active account ID from the account store
    let activeId = "default";
    try {
      const raw = localStorage.getItem("genshin-account-storage");
      if (raw) {
        const parsed = JSON.parse(raw);
        const accountState = parsed?.state;
        if (accountState?.activeAccountId) {
          activeId = accountState.activeAccountId;
        }
      }
    } catch {
      // ignore parse errors
    }

    state.profiles = {
      [activeId]: {
        unownedCharacters,
        unownedWeapons,
        characterConstellations: {},
        weaponRefinements: {},
      },
    };
    v = 2; // fall through to v2 → v3 migration
  }

  // v1 → v2: add characterConstellations & weaponRefinements to existing profiles
  if (v === 1) {
    const profiles = state.profiles || {};
    for (const key of Object.keys(profiles)) {
      if (!profiles[key].characterConstellations)
        profiles[key].characterConstellations = {};
      if (!profiles[key].weaponRefinements)
        profiles[key].weaponRefinements = {};
    }
    state.profiles = profiles;
    v = 2; // fall through to v2 → v3 migration
  }

  // v2 → v3: remove always-owned characters (Traveler/Manekin/Manekina) from unowned sets
  if (v === 2) {
    const profiles = state.profiles || {};
    for (const key of Object.keys(profiles)) {
      const unowned = profiles[key].unownedCharacters;
      if (unowned) {
        for (const id of ALWAYS_OWNED_CHARACTER_IDS) {
          delete unowned[id];
        }
      }
    }
    return { profiles };
  }

  return persistedState as PersistedOwnershipState;
}

export const useOwnershipStore = create<OwnershipState>()(
  persist(
    immer((set, get) => ({
      profiles: {},

      isOwned(profileId, type, id) {
        const profile = get().profiles[profileId];
        if (!profile) return true; // no profile = all owned by default
        return !profile[getField(type)][id];
      },

      setOwned(profileId, type, id, owned) {
        set((state) => {
          if (!state.profiles[profileId]) {
            state.profiles[profileId] = emptyProfile();
          }
          const field = getField(type);
          if (owned) {
            delete state.profiles[profileId][field][id];
          } else {
            state.profiles[profileId][field][id] = true;
          }
        });
      },

      toggleOwned(profileId, type, id) {
        set((state) => {
          if (!state.profiles[profileId]) {
            state.profiles[profileId] = emptyProfile();
          }
          const field = getField(type);
          if (state.profiles[profileId][field][id]) {
            delete state.profiles[profileId][field][id];
          } else {
            state.profiles[profileId][field][id] = true;
          }
        });
      },

      getConstellation(profileId, characterId) {
        const profile = get().profiles[profileId];
        return profile?.characterConstellations[characterId] ?? 0;
      },

      setConstellation(profileId, characterId, level) {
        set((state) => {
          if (!state.profiles[profileId]) {
            state.profiles[profileId] = emptyProfile();
          }
          if (!state.profiles[profileId].characterConstellations) {
            state.profiles[profileId].characterConstellations = {};
          }
          if (level === 0) {
            delete state.profiles[profileId].characterConstellations[
              characterId
            ];
          } else {
            state.profiles[profileId].characterConstellations[characterId] =
              level;
          }
        });
      },

      getRefinement(profileId, weaponId) {
        const profile = get().profiles[profileId];
        return profile?.weaponRefinements[weaponId] ?? 1;
      },

      setRefinement(profileId, weaponId, level) {
        set((state) => {
          if (!state.profiles[profileId]) {
            state.profiles[profileId] = emptyProfile();
          }
          if (!state.profiles[profileId].weaponRefinements) {
            state.profiles[profileId].weaponRefinements = {};
          }
          if (level === 1) {
            delete state.profiles[profileId].weaponRefinements[weaponId];
          } else {
            state.profiles[profileId].weaponRefinements[weaponId] = level;
          }
        });
      },

      bulkSetOwned(profileId, type, ids, owned) {
        set((state) => {
          if (!state.profiles[profileId]) {
            state.profiles[profileId] = emptyProfile();
          }
          const field = getField(type);
          for (const id of ids) {
            if (owned) {
              delete state.profiles[profileId][field][id];
            } else {
              state.profiles[profileId][field][id] = true;
            }
          }
        });
      },

      setProfileCharacterOwnership(profileId, unownedCharacterIds) {
        set((state) => {
          if (!state.profiles[profileId]) {
            state.profiles[profileId] = emptyProfile();
          }
          const record: Record<string, true> = {};
          for (const id of unownedCharacterIds) {
            record[id] = true;
          }
          state.profiles[profileId].unownedCharacters = record;
        });
      },

      setProfileWeaponOwnership(profileId, unownedWeaponIds) {
        set((state) => {
          if (!state.profiles[profileId]) {
            state.profiles[profileId] = emptyProfile();
          }
          const record: Record<string, true> = {};
          for (const id of unownedWeaponIds) {
            record[id] = true;
          }
          state.profiles[profileId].unownedWeapons = record;
        });
      },

      promoteProfile(oldId, newId) {
        set((state) => {
          const profile = state.profiles[oldId];
          if (!profile || !newId || newId === oldId) return;
          state.profiles[newId] = profile;
          delete state.profiles[oldId];
        });
      },

      deleteProfile(id) {
        set((state) => {
          delete state.profiles[id];
        });
      },

      clearAll() {
        set((state) => {
          state.profiles = {};
        });
      },
    })),
    {
      name: "genshin-ownership",
      version: 3,
      migrate: migrateOwnershipStore,
    }
  )
);
