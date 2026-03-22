import { createTierStore } from "./createTierStore";

export const useWeaponTierStore = createTierStore({
  storageKey: "weapon-tierlist-storage",
});
