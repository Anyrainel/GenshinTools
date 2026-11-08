import { create } from "zustand";
import { persist } from "zustand/middleware";
import { migrateScannerSyncPreferences } from "./migration/scannerSync";
import { PersistedScannerSyncSchema } from "./schemas";

interface ScannerSyncPreferences {
  enabledProfileId: number | null;
  port: number;
  setEnabledProfileId: (profileId: number | null) => void;
  setPort: (port: number) => void;
  moveProfile: (sourceId: number, targetId: number) => void;
}

const defaults = { enabledProfileId: null, port: 8765 };

/** Device-local opt-in. It is deliberately excluded from account/cloud backups. */
export const useScannerSyncStore = create<ScannerSyncPreferences>()(
  persist(
    (set) => ({
      ...defaults,
      setEnabledProfileId: (enabledProfileId) => set({ enabledProfileId }),
      setPort: (port) => set({ port }),
      moveProfile: (sourceId, targetId) =>
        set((state) =>
          state.enabledProfileId === sourceId
            ? { enabledProfileId: targetId }
            : state
        ),
    }),
    {
      name: "genshin-scanner-sync-storage",
      version: 1,
      partialize: (state) => ({
        enabledProfileId: state.enabledProfileId,
        port: state.port,
      }),
      migrate: migrateScannerSyncPreferences,
      merge: (persisted, current) => {
        const parsed = PersistedScannerSyncSchema.safeParse(persisted);
        return { ...current, ...(parsed.success ? parsed.data : defaults) };
      },
    }
  )
);
