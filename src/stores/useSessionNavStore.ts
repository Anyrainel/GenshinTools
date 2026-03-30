import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionNavState {
  activeTeamId: string | null;
  activeInvestmentTeamId: string | null;
  activeWeaponChoiceTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
  setActiveInvestmentTeamId: (id: string | null) => void;
  setActiveWeaponChoiceTeamId: (id: string | null) => void;
}

export const useSessionNavStore = create<SessionNavState>()(
  persist(
    (set) => ({
      activeTeamId: null,
      activeInvestmentTeamId: null,
      activeWeaponChoiceTeamId: null,
      setActiveTeamId: (id) => set({ activeTeamId: id }),
      setActiveInvestmentTeamId: (id) => set({ activeInvestmentTeamId: id }),
      setActiveWeaponChoiceTeamId: (id) =>
        set({ activeWeaponChoiceTeamId: id }),
    }),
    {
      name: "session-nav-storage",
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
    }
  )
);
