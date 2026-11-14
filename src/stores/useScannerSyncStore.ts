import { create } from "zustand";
import { persist } from "zustand/middleware";
import { migrateScannerSyncPreferences } from "./migration/scannerSync";
import { PersistedScannerSyncSchema } from "./schemas";

interface ScannerSyncPreferences {
  enabled: boolean;
  port: number;
  setEnabled: (enabled: boolean) => void;
  setPort: (port: number) => void;
}

const defaults = { enabled: false, port: 8765 };

/** Device-local opt-in. It is deliberately excluded from account/cloud backups. */
export const useScannerSyncStore = create<ScannerSyncPreferences>()(
  persist(
    (set) => ({
      ...defaults,
      setEnabled: (enabled) => set({ enabled }),
      setPort: (port) => set({ port }),
    }),
    {
      name: "genshin-scanner-sync-storage",
      version: 1,
      partialize: (state) => ({
        enabled: state.enabled,
        port: state.port,
      }),
      migrate: migrateScannerSyncPreferences,
      merge: (persisted, current) => {
        // The earlier unpublished v1 stored a selected fallback profile.
        const parsed = PersistedScannerSyncSchema.safeParse(
          migrateScannerSyncPreferences(persisted)
        );
        return { ...current, ...(parsed.success ? parsed.data : defaults) };
      },
    }
  )
);
