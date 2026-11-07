import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import type { AccountState } from "@/domain/game-account/types";
import { useContinuousInventorySync } from "@/hooks/useContinuousInventorySync";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";

interface ScannerSyncContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  port: number;
  portInput: string;
  setPortInput: (value: string) => void;
  commitPort: () => void;
  account: AccountState | null;
  sync: ReturnType<typeof useContinuousInventorySync>;
}

const ScannerSyncContext = createContext<ScannerSyncContextValue | null>(null);

/** The session belongs to the app, independently of import dialogs and routes. */
export function ScannerSyncProvider({ children }: { children: ReactNode }) {
  const account = useAccountStore(getActiveAccount) ?? null;
  const [enabled, setEnabled] = useState(false);
  const [port, setPort] = useState(8765);
  const [portInput, setPortInput] = useState("8765");
  const sync = useContinuousInventorySync(enabled && !!account, port);
  const commitPort = useCallback(() => {
    const value = Number(portInput);
    if (Number.isInteger(value) && value > 0 && value <= 65535) {
      setPort(value);
      setPortInput(String(value));
    } else setPortInput(String(port));
  }, [port, portInput]);

  return (
    <ScannerSyncContext.Provider
      value={{
        enabled,
        setEnabled,
        port,
        portInput,
        setPortInput,
        commitPort,
        account,
        sync,
      }}
    >
      {children}
    </ScannerSyncContext.Provider>
  );
}

/** Optional so import controls can also be embedded without a live-sync host. */
export function useScannerSync() {
  return useContext(ScannerSyncContext);
}
