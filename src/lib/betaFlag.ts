const BETA_STORAGE_KEY = "enable-beta";

/**
 * Whether beta (unreleased) content should be loaded.
 *
 * Resolution order:
 *   1. MODE=test → always false (jsdom fetch doesn't resolve gz URL assets).
 *   2. localStorage explicitly set ("true" / "false") → honor the stored choice
 *      so devs can toggle beta off in dev and QA can flip it on in prod.
 *   3. Otherwise → default to DEV (true) vs prod (false).
 */
export function betaEnabled(): boolean {
  if (import.meta.env?.MODE === "test") return false;
  try {
    const stored = localStorage.getItem(BETA_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage unavailable — fall through to env default.
  }
  return !!import.meta.env?.DEV;
}

/**
 * Persist a user-controlled beta-enabled choice. Most surfaces read
 * ``betaEnabled()`` at module init (e.g. constants.ts merges beta entities
 * into allCharacters/allWeapons/allArtifacts once), so callers should reload
 * the page after toggling to pick up the change.
 */
export function setBetaEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BETA_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // ignore — no persistent storage available
  }
}

const MAGIC_ON = "开启测试模式";
const MAGIC_OFF = "关闭测试模式";
const REVERT_MS = 10_000;

let pendingRevert: ReturnType<typeof setTimeout> | null = null;

export function maybeHandleBetaMagic(value: string): boolean {
  if (value === MAGIC_ON) {
    if (betaEnabled() && pendingRevert === null) return true;
    if (pendingRevert) clearTimeout(pendingRevert);
    setBetaEnabled(true);
    pendingRevert = setTimeout(() => {
      setBetaEnabled(false);
      pendingRevert = null;
    }, REVERT_MS);
    return true;
  }
  if (value === MAGIC_OFF) {
    const wasOn = betaEnabled();
    if (pendingRevert) {
      clearTimeout(pendingRevert);
      pendingRevert = null;
    }
    setBetaEnabled(false);
    if (wasOn) window.location.reload();
    return true;
  }
  return false;
}
