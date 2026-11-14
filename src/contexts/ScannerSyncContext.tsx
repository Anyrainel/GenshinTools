import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AccountState } from "@/domain/game-account/types";
import { useContinuousInventorySync } from "@/hooks/useContinuousInventorySync";
import { useAccountStore } from "@/stores/useAccountStore";
import { useScannerSyncStore } from "@/stores/useScannerSyncStore";

interface ScannerSyncContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  port: number;
  portInput: string;
  setPortInput: (value: string) => void;
  commitPort: () => void;
  syncedAccount: AccountState | null;
  sync: ReturnType<typeof useContinuousInventorySync>;
}

const ScannerSyncContext = createContext<ScannerSyncContextValue | null>(null);

/** Device-local sync mode runs independently of pages and the viewed profile. */
export function ScannerSyncProvider({ children }: { children: ReactNode }) {
  const profiles = useAccountStore((s) => s.accounts);
  const enabled = useScannerSyncStore((s) => s.enabled);
  const setEnabled = useScannerSyncStore((s) => s.setEnabled);
  const port = useScannerSyncStore((s) => s.port);
  const setPort = useScannerSyncStore((s) => s.setPort);
  const [portInput, setPortInput] = useState(String(port));
  const sync = useContinuousInventorySync(enabled, port);
  const syncedAccount = profiles[sync.targetProfileId ?? -1] ?? null;
  useEffect(() => setPortInput(String(port)), [port]);
  const commitPort = useCallback(() => {
    const value = Number(portInput);
    if (Number.isInteger(value) && value > 0 && value <= 65535) {
      setPort(value);
      setPortInput(String(value));
    } else setPortInput(String(port));
  }, [port, portInput, setPort]);

  return (
    <ScannerSyncContext.Provider
      value={{
        enabled,
        setEnabled,
        port,
        portInput,
        setPortInput,
        commitPort,
        syncedAccount,
        sync,
      }}
    >
      {children}
    </ScannerSyncContext.Provider>
  );
}

export function useScannerSync() {
  return useContext(ScannerSyncContext);
}
