/** Legacy global enablement did not identify a destination profile. Never restore it. */
export function migrateScannerSyncPreferences(state: unknown) {
  const port =
    state && typeof state === "object" && "port" in state ? state.port : 8765;
  return {
    enabledProfileId: null,
    port:
      typeof port === "number" &&
      Number.isInteger(port) &&
      port > 0 &&
      port <= 65535
        ? port
        : 8765,
  };
}
