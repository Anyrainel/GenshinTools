import { createTierStore } from "./createTierStore";
import {
  migrateReleasedWeaponRecord,
  migrateWeaponTierStore,
} from "./migration/releasedWeaponIds";

export const useWeaponTierStore = createTierStore({
  storageKey: "weapon-tierlist-storage",
  version: 3,
  migrate: migrateWeaponTierStore,
  normalizeAssignments: migrateReleasedWeaponRecord,
});
