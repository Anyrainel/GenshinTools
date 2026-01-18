import type { AccountData } from "@/data/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountStore {
  accountData: AccountData | null;
  lastUid: string;
  setAccountData: (data: AccountData) => void;
  setLastUid: (uid: string) => void;
  clearAccountData: () => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accountData: null,
      lastUid: "",
      setAccountData: (data) => set({ accountData: data }),
      setLastUid: (uid) => set({ lastUid: uid }),
      clearAccountData: () => set({ accountData: null }),
    }),
    {
      name: "genshin-account-storage",
    }
  )
);
