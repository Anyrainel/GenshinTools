/**
 * Earlier preferences used { enabled, port } (v0), then the unpublished v1 used
 * { enabledProfileId: number | null, port }. Sync is now global: keep the opt-in
 * and port, but never restore a selected UID as the destination of anonymous data.
 */
export function migrateScannerSyncPreferences(state: unknown) {
  const saved = state && typeof state === "object" ? state : {};
  const port = "port" in saved ? saved.port : 8765;
  return {
    enabled:
      "enabled" in saved && typeof saved.enabled === "boolean"
        ? saved.enabled
        : "enabledProfileId" in saved &&
          typeof saved.enabledProfileId === "number" &&
          Number.isSafeInteger(saved.enabledProfileId) &&
          saved.enabledProfileId >= 0,
    port:
      typeof port === "number" &&
      Number.isInteger(port) &&
      port > 0 &&
      port <= 65535
        ? port
        : 8765,
  };
}
