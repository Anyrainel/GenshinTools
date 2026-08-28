import { beforeEach, describe, expect, it, vi } from "vitest";

describe("stale deployment recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("performs one fresh reload without clearing persisted app data", async () => {
    const replace = vi.fn();
    const removeCache = vi.fn().mockResolvedValue(true);
    const unregister = vi.fn().mockResolvedValue(true);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));

    window.localStorage.setItem("team-builder-storage", "saved-team-data");
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "caches", {
      value: {
        keys: vi.fn().mockResolvedValue(["old-assets"]),
        delete: removeCache,
      },
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
      },
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        href: "https://ggartifact.com/team-comp/damage",
        replace,
      },
      configurable: true,
    });

    const { scheduleStaleDeploymentRecovery } = await import(
      "@/lib/staleDeploymentRecovery"
    );

    expect(scheduleStaleDeploymentRecovery()).toBe(true);
    expect(scheduleStaleDeploymentRecovery()).toBe(false);

    await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
    expect(removeCache).toHaveBeenCalledWith("old-assets");
    expect(unregister).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(replace.mock.calls[0][0])).toContain("_r=");
    expect(window.localStorage.getItem("team-builder-storage")).toBe(
      "saved-team-data"
    );
  });

  it("keeps the loop guard until a worker proves the deployment is healthy", async () => {
    const replace = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)));
    Object.defineProperty(window, "location", {
      value: { ...window.location, replace },
      configurable: true,
    });

    const { markDeploymentAssetsHealthy, scheduleStaleDeploymentRecovery } =
      await import("@/lib/staleDeploymentRecovery");

    expect(scheduleStaleDeploymentRecovery()).toBe(true);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());

    vi.resetModules();
    const afterReload = await import("@/lib/staleDeploymentRecovery");
    expect(afterReload.scheduleStaleDeploymentRecovery()).toBe(false);

    markDeploymentAssetsHealthy();
    expect(afterReload.scheduleStaleDeploymentRecovery()).toBe(true);
  });

  it("suppresses a Vite preload error only when recovery can start", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)));
    Object.defineProperty(window, "location", {
      value: { ...window.location, replace: vi.fn() },
      configurable: true,
    });
    const { handleVitePreloadError } = await import(
      "@/lib/staleDeploymentRecovery"
    );
    const first = new Event("vite:preloadError", { cancelable: true });
    const second = new Event("vite:preloadError", { cancelable: true });

    handleVitePreloadError(first);
    handleVitePreloadError(second);

    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(false);
  });
});
