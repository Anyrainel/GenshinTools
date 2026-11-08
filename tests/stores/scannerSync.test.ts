import { beforeEach, describe, expect, it } from "vitest";
import { migrateScannerSyncPreferences } from "@/stores/migration/scannerSync";
import { useScannerSyncStore } from "@/stores/useScannerSyncStore";

beforeEach(() => {
  localStorage.clear();
  useScannerSyncStore.setState({ enabledProfileId: null, port: 8765 });
});
describe("scanner preference persistence", () => {
  it("never enables an old global preference without a selected profile", () => {
    expect(
      migrateScannerSyncPreferences({ enabled: true, port: 9123 })
    ).toEqual({ enabledProfileId: null, port: 9123 });
    expect(
      migrateScannerSyncPreferences({ enabledProfileId: 123456789 })
    ).toEqual({ enabledProfileId: null, port: 8765 });
  });
  it("persists one destination and port and follows profile promotion", () => {
    const store = useScannerSyncStore.getState();
    store.setEnabledProfileId(0);
    store.setPort(9123);
    store.moveProfile(0, 800000003);
    const persisted = JSON.parse(
      localStorage.getItem("genshin-scanner-sync-storage")!
    );
    expect(persisted).toMatchObject({
      version: 1,
      state: { enabledProfileId: 800000003, port: 9123 },
    });
  });
  it("rejects malformed saved scope rather than enabling capture", async () => {
    localStorage.setItem(
      "genshin-scanner-sync-storage",
      JSON.stringify({ version: 1, state: { enabled: true, port: 9123 } })
    );
    await useScannerSyncStore.persist.rehydrate();
    expect(useScannerSyncStore.getState().enabledProfileId).toBeNull();
  });
});
