import { createTierStore } from "./createTierStore";

export const useArtifactTierStore = createTierStore({
  storageKey: "artifact-tierlist-storage",
});
