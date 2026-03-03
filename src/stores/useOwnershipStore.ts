import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface ProfileOwnership {
  /** IDs of characters NOT owned (negative-set: everything is owned by default) */
  unownedCharacters: Record<string, true>;
  /** IDs of weapons NOT owned */
  unownedWeapons: Record<string, true>;
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
  /** Atomic replace of the unowned character set for a profile (for GOOD import exhaustive sync) */
  setProfileCharacterOwnership: (
    profileId: string,
    unownedCharacterIds: string[]
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

  // v0: flat { unownedCharacters, unownedWeapons } shape (no profiles)
  if (version === 0) {
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

    return {
      profiles: {
        [activeId]: { unownedCharacters, unownedWeapons },
      },
    };
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
      version: 1,
      migrate: migrateOwnershipStore,
    }
  )
);
