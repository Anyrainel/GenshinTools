import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface OwnershipState {
  /** IDs of characters NOT owned (negative-set: everything is owned by default) */
  unownedCharacters: Record<string, true>;
  /** IDs of weapons NOT owned */
  unownedWeapons: Record<string, true>;

  isOwned: (type: "character" | "weapon", id: string) => boolean;
  setOwned: (type: "character" | "weapon", id: string, owned: boolean) => void;
  toggleOwned: (type: "character" | "weapon", id: string) => void;
  bulkSetOwned: (
    type: "character" | "weapon",
    ids: string[],
    owned: boolean
  ) => void;
  clearAll: () => void;
}

const getField = (type: "character" | "weapon") =>
  type === "character"
    ? ("unownedCharacters" as const)
    : ("unownedWeapons" as const);

export const useOwnershipStore = create<OwnershipState>()(
  persist(
    immer((set, get) => ({
      unownedCharacters: {},
      unownedWeapons: {},

      isOwned(type, id) {
        return !get()[getField(type)][id];
      },

      setOwned(type, id, owned) {
        set((state) => {
          const field = getField(type);
          if (owned) {
            delete state[field][id];
          } else {
            state[field][id] = true;
          }
        });
      },

      toggleOwned(type, id) {
        set((state) => {
          const field = getField(type);
          if (state[field][id]) {
            delete state[field][id];
          } else {
            state[field][id] = true;
          }
        });
      },

      bulkSetOwned(type, ids, owned) {
        set((state) => {
          const field = getField(type);
          for (const id of ids) {
            if (owned) {
              delete state[field][id];
            } else {
              state[field][id] = true;
            }
          }
        });
      },

      clearAll() {
        set((state) => {
          state.unownedCharacters = {};
          state.unownedWeapons = {};
        });
      },
    })),
    { name: "genshin-ownership" }
  )
);
