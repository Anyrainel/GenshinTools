import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface BetaState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const STORAGE_KEY = "enable-beta";
const isTestEnv = import.meta.env?.MODE === "test";
const devDefault = !!import.meta.env?.DEV;

/**
 * User-controlled beta (unreleased content) toggle.
 *
 * Resolution order:
 *   1. MODE=test → always false (jsdom fetch can't resolve gz asset URLs)
 *   2. Persisted localStorage value → honored
 *   3. Otherwise → default to DEV (true) vs prod (false)
 *
 * Callers are mostly non-React (module init in ``data/constants.ts``,
 * loaders in ``lib/``), so the store exposes ``betaEnabled()`` /
 * ``setBetaEnabled()`` function shims in addition to the hook itself.
 *
 * Most surfaces that read this flag do so once at module init — the
 * ``constants.ts`` merge of released+beta entities happens during import,
 * not in React render. Callers that change the flag at runtime (the beta
 * toggle in the archive page) must ``window.location.reload()`` to pick
 * up the new merged state.
 */
const useBetaStore = create<BetaState>()(
  persist(
    (set) => ({
      enabled: devDefault,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ enabled: state.enabled }),
      // Historically this flag was stored as a plain ``"true"`` / ``"false"``
      // string under the same key. Accept either format on read so users who
      // toggled the old flag don't silently revert to the env default after
      // this migration.
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            const raw = localStorage.getItem(key);
            if (raw === null) return null;
            if (raw === "true" || raw === "false") {
              return JSON.stringify({
                state: { enabled: raw === "true" },
                version: 0,
              });
            }
            return raw;
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            // no-op — no persistent storage available
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            // no-op
          }
        },
      })),
    }
  )
);

export function betaEnabled(): boolean {
  if (isTestEnv) return false;
  return useBetaStore.getState().enabled;
}

export function setBetaEnabled(enabled: boolean): void {
  useBetaStore.getState().setEnabled(enabled);
}

// ── Magic-string shortcut for toggling beta from any text-input field ──

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
