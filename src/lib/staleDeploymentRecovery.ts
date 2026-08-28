const RECOVERY_ATTEMPTED_KEY = "stale-deployment-recovery-attempted";

let recoveryScheduled = false;

async function reloadFreshDocument(): Promise<void> {
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));

  try {
    if ("caches" in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }
  } catch (error) {
    console.warn("Failed to clear CacheStorage before reload:", error);
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister())
      );
    }
  } catch (error) {
    console.warn("Failed to unregister service workers before reload:", error);
  }

  try {
    await fetch(url.toString(), {
      cache: "reload",
      credentials: "same-origin",
    });
  } catch (error) {
    console.warn("Failed to prefetch fresh document before reload:", error);
  }

  window.location.replace(url.toString());
}

/**
 * Recover once when an old page tries to load chunks from a newer deployment.
 * The session marker prevents a genuine code error from causing a reload loop.
 * Persisted application data lives in localStorage and is intentionally untouched.
 */
export function scheduleStaleDeploymentRecovery(): boolean {
  if (recoveryScheduled || typeof window === "undefined") return false;

  try {
    if (window.sessionStorage.getItem(RECOVERY_ATTEMPTED_KEY) === "1") {
      return false;
    }
    window.sessionStorage.setItem(RECOVERY_ATTEMPTED_KEY, "1");
  } catch {
    // Without a durable per-session marker, an automatic reload could loop.
    return false;
  }

  recoveryScheduled = true;
  void reloadFreshDocument();
  return true;
}

/** Clear the loop guard after a module worker has loaded and answered. */
export function markDeploymentAssetsHealthy(): void {
  recoveryScheduled = false;
  try {
    window.sessionStorage.removeItem(RECOVERY_ATTEMPTED_KEY);
  } catch {
    // Storage can be disabled; successful worker startup still needs no recovery.
  }
}

export function handleVitePreloadError(event: Event): void {
  if (scheduleStaleDeploymentRecovery()) event.preventDefault();
}
