import { beforeEach, describe, expect, it } from "vitest";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { useAccountStore } from "@/stores/useAccountStore";
import { useScannerSyncStore } from "@/stores/useScannerSyncStore";
import { useTriageStore } from "@/stores/useTriageStore";

const data = () => ({ characters: [], extraArtifacts: [], extraWeapons: [] });
beforeEach(() => {
  useAccountStore.getState().clearAccounts();
});

describe("account identity promotion", () => {
  it("preserves linked settings and selected scanner target when binding default", () => {
    useAccountStore
      .getState()
      .addOrUpdateAccount(0, { data: data(), name: "My account" });
    useTriageStore.getState().updateSettings({ mainStatThreshold: 73 });
    useScannerSyncStore.getState().setEnabledProfileId(0);
    applyAccountImport({ accountId: 0, data: data(), promoteToId: 800000001 });
    expect(useAccountStore.getState().accounts[0]).toBeUndefined();
    expect(useAccountStore.getState().accounts[800000001].name).toBe(
      "My account"
    );
    expect(useScannerSyncStore.getState().enabledProfileId).toBe(800000001);
    expect(
      useTriageStore.getState().settingsByProfileId[800000001].mainStatThreshold
    ).toBe(73);
  });
  it("rejects a destination collision before changing either account or settings", () => {
    const store = useAccountStore.getState();
    store.addOrUpdateAccount(0, { data: data(), name: "Default" });
    store.addOrUpdateAccount(800000001, { data: data(), name: "Existing" });
    useScannerSyncStore.getState().setEnabledProfileId(0);
    const before = useAccountStore.getState().accounts;
    expect(() =>
      applyAccountImport({ accountId: 0, data: data(), promoteToId: 800000001 })
    ).toThrow("destination UID profile already exists");
    expect(useAccountStore.getState().accounts).toBe(before);
    expect(useScannerSyncStore.getState().enabledProfileId).toBe(0);
    expect(() => store.promoteToUid(0, 800000001)).toThrow();
    expect(useAccountStore.getState().accounts).toBe(before);
  });
  it("never relabels an unrelated known UID and disables fallback when its target is deleted", () => {
    const store = useAccountStore.getState();
    store.addOrUpdateAccount(800000001, { data: data() });
    expect(() => store.promoteToUid(800000001, 800000002)).toThrow();
    useScannerSyncStore.getState().setEnabledProfileId(800000001);
    store.deleteAccount(800000001);
    expect(useScannerSyncStore.getState().enabledProfileId).toBeNull();
  });
});
