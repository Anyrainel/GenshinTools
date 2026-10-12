let override: boolean | undefined;
export function setBetaOverride(value: boolean): void {
  override = value;
}
export function betaEnabled(): boolean {
  if (
    typeof process !== "undefined" &&
    process.env?.__BETA_ENABLED_OVERRIDE__ === "true"
  )
    return true;
  if (import.meta.env?.MODE === "test") return false;
  if (override !== undefined) return override;
  try {
    const raw = localStorage.getItem("enable-beta");
    if (raw === "true" || raw === "false") return raw === "true";
    if (raw !== null) return JSON.parse(raw).state.enabled;
  } catch {
    /* Storage may be unavailable. */
  }
  return !!import.meta.env?.DEV;
}
