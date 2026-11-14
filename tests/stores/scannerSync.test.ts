import { beforeEach, describe, expect, it } from "vitest";
import { migrateScannerSyncPreferences } from "@/stores/migration/scannerSync";
import { useScannerSyncStore } from "@/stores/useScannerSyncStore";

beforeEach(() => {
  localStorage.clear();
  useScannerSyncStore.setState({ enabled: false, port: 8765 });
});
describe("scanner preference persistence", () => {
  it("persists global enablement and port without an account destination", () => {
    const store = useScannerSyncStore.getState();
    store.setEnabled(true);
    store.setPort(9123);
    expect(
      JSON.parse(localStorage.getItem("genshin-scanner-sync-storage")!)
    ).toEqual({ version: 1, state: { enabled: true, port: 9123 } });
  });

  it.each([
    {
      label: "original v0 global opt-in",
      version: 0,
      state: { enabled: true, port: 9123 },
      enabled: true,
    },
    {
      label: "earlier v1 UID-scoped opt-in",
      version: 1,
      state: { enabledProfileId: 800000003, port: 9123 },
      enabled: true,
    },
    {
      label: "earlier v1 Default-scoped opt-in",
      version: 1,
      state: { enabledProfileId: 0, port: 9123 },
      enabled: true,
    },
    {
      label: "earlier v1 disabled mode",
      version: 1,
      state: { enabledProfileId: null, port: 9123 },
      enabled: false,
    },
    {
      label: "current v1 global opt-in",
      version: 1,
      state: { enabled: true, port: 9123 },
      enabled: true,
    },
  ])(
    "hydrates $label without retaining a destination",
    async ({ version, state, enabled }) => {
      localStorage.setItem(
        "genshin-scanner-sync-storage",
        JSON.stringify({ version, state })
      );
      await useScannerSyncStore.persist.rehydrate();
      expect(useScannerSyncStore.getState()).toMatchObject({
        enabled,
        port: 9123,
      });
      expect(useScannerSyncStore.getState()).not.toHaveProperty(
        "enabledProfileId"
      );

      // A subsequent preference write also removes the old destination on disk.
      useScannerSyncStore.getState().setPort(9123);
      expect(
        JSON.parse(localStorage.getItem("genshin-scanner-sync-storage")!)
      ).toEqual({ version: 1, state: { enabled, port: 9123 } });
    }
  );

  it.each([
    undefined,
    { enabled: "true", port: -1 },
    { enabledProfileId: -1, port: 70000 },
    { enabledProfileId: 1.5, port: "9123" },
  ])("does not enable malformed saved preferences: %j", (state) => {
    expect(migrateScannerSyncPreferences(state)).toEqual({
      enabled: false,
      port: 8765,
    });
  });
});
