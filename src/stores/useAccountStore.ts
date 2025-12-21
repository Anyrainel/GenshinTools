import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AccountData } from "@/data/types";

interface AccountStore {
  accountData: AccountData | null;
  setAccountData: (data: AccountData) => void;
  clearAccountData: () => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accountData: null,
      setAccountData: (data) => set({ accountData: data }),
      clearAccountData: () => set({ accountData: null }),
    }),
    {
      name: "genshin-account-storage",
    },
  ),
);
