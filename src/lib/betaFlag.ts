const BETA_STORAGE_KEY = "enable-beta";

/** Whether beta (unreleased) content should be loaded. Auto-enabled in DEV. */
export function betaEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(BETA_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
