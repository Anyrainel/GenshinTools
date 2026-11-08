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
  account: AccountState | null;
  syncedAccount: AccountState | null;
  sync: ReturnType<typeof useContinuousInventorySync>;
}

const ScannerSyncContext = createContext<ScannerSyncContextValue | null>(null);

/** The selected fallback profile persists independently of the active page/profile. */
export function ScannerSyncProvider({ children }: { children: ReactNode }) {
  const profiles = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const profileId = useScannerSyncStore((s) => s.enabledProfileId);
  const setProfileId = useScannerSyncStore((s) => s.setEnabledProfileId);
  const port = useScannerSyncStore((s) => s.port);
  const setPort = useScannerSyncStore((s) => s.setPort);
  const [portInput, setPortInput] = useState(String(port));
  const enabled = profileId !== null;
  const account = profiles[profileId ?? activeAccountId ?? -1] ?? null;
  const sync = useContinuousInventorySync(profileId, port);
  const syncedAccount = profiles[sync.targetProfileId ?? -1] ?? null;
  useEffect(() => setPortInput(String(port)), [port]);
  const setEnabled = useCallback(
    (next: boolean) => {
      if (!next) {
        setProfileId(null);
        return;
      }
      const store = useAccountStore.getState();
      let selected = store.activeAccountId;
      if (selected === null || !store.accounts[selected]) {
        selected = store.accounts[0]
          ? 0
          : Number(Object.keys(store.accounts)[0] ?? 0);
        if (!store.accounts[selected])
          store.addOrUpdateAccount(selected, {
            name: "Default Account",
            data: { characters: [], extraWeapons: [], extraArtifacts: [] },
          });
        store.setActiveAccount(selected);
      }
      setProfileId(selected);
    },
    [setProfileId]
  );
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
        account,
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
