import { create } from "zustand";
import { persist } from "zustand/middleware";
import { maybeHandleBetaMagic } from "@/data/betaState";

/**
 * Session-scoped state for the Archive pages. Survives in-session navigation
 * between tabs (characters / weapons / artifacts / bosses) so the user's last
 * search and selection aren't lost when clicking around, but resets when the
 * tab is closed.
 */
interface ArchiveSessionState {
  characterSearch: string;
  weaponSearch: string;
  artifactSearch: string;
  bossSearch: string;
  selectedCharacterId: string | null;
  selectedBossId: number | null;
  setCharacterSearch: (v: string) => void;
  setWeaponSearch: (v: string) => void;
  setArtifactSearch: (v: string) => void;
  setBossSearch: (v: string) => void;
  setSelectedCharacterId: (v: string | null) => void;
  setSelectedBossId: (v: number | null) => void;
}

export const useArchiveSessionStore = create<ArchiveSessionState>()(
  persist(
    (set) => ({
      characterSearch: "",
      weaponSearch: "",
      artifactSearch: "",
      bossSearch: "",
      selectedCharacterId: null,
      selectedBossId: null,
      setCharacterSearch: (v) => {
        const consumed = maybeHandleBetaMagic(v);
        set({ characterSearch: consumed ? "" : v });
      },
      setWeaponSearch: (v) => {
        const consumed = maybeHandleBetaMagic(v);
        set({ weaponSearch: consumed ? "" : v });
      },
      setArtifactSearch: (v) => {
        const consumed = maybeHandleBetaMagic(v);
        set({ artifactSearch: consumed ? "" : v });
      },
      setBossSearch: (v) => {
        const consumed = maybeHandleBetaMagic(v);
        set({ bossSearch: consumed ? "" : v });
      },
      setSelectedCharacterId: (v) => set({ selectedCharacterId: v }),
      setSelectedBossId: (v) => set({ selectedBossId: v }),
    }),
    {
      name: "archive-session-storage",
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
