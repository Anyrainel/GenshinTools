import type { AccountData } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/artifactScore";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountStore {
  accountData: AccountData | null;
  scores: Record<string, ArtifactScoreResult>;
  isScoresStale: boolean;
  lastUid: string;
  setAccountData: (data: AccountData) => void;
  setScores: (scores: Record<string, ArtifactScoreResult>) => void;
  invalidateScores: () => void;
  setLastUid: (uid: string) => void;
  clearAccountData: () => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accountData: null,
      scores: {},
      isScoresStale: false,
      lastUid: "",
      setAccountData: (data) => set({ accountData: data }),
      setScores: (scores) => set({ scores, isScoresStale: false }),
      invalidateScores: () => set({ isScoresStale: true }),
      setLastUid: (uid) => set({ lastUid: uid }),
      clearAccountData: () => set({ accountData: null, scores: {} }),
    }),
    {
      name: "genshin-account-storage",
    }
  )
);
