import { render, renderHook, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useResource } from "@/hooks/useResource";
import { makeLangResource, makeResource } from "@/lib/resources/cache";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? "Load failed" : this.props.children;
  }
}

describe("reference resource lifecycle", () => {
  it("observes on-demand language text without starting a request itself", async () => {
    const load = vi.fn(async (language: string) => language);
    const resource = makeLangResource(load);
    const view = renderHook(() => useResource(resource, "zh", false));
    expect(load).not.toHaveBeenCalled();
    expect(view.result.current).toBeNull();
    await resource.preload("zh");
    await waitFor(() => expect(view.result.current).toBe("zh"));
    expect(load).toHaveBeenCalledExactlyOnceWith("zh");
  });
  it("delivers load failures to the React boundary without an unhandled rejection", async () => {
    const error = new Error("Broken bundled reference");
    const resource = makeResource(async () => {
      throw error;
    });
    function Consumer() {
      useResource(resource);
      return "Loading";
    }
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const view = render(
        <Boundary>
          <Consumer />
        </Boundary>
      );
      await waitFor(() =>
        expect(view.getByText("Load failed")).toBeInTheDocument()
      );
    } finally {
      log.mockRestore();
    }
  });

  it("cancels a pending subscriber when it unmounts", async () => {
    let complete!: (value: string) => void;
    const resource = makeResource(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        })
    );
    const view = renderHook(() => useResource(resource));
    await waitFor(() => expect(complete).toBeDefined());
    view.unmount();
    complete("ready");
    await expect(resource.preload()).resolves.toBe("ready");
    expect(resource.peek()).toBe("ready");
  });

  it("deduplicates concurrent loads and allows retry after rejection", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("ready");
    const resource = makeResource<string>(loader);
    const first = resource.preload();
    expect(resource.preload()).toBe(first);
    await expect(first).rejects.toThrow("temporary");
    await expect(resource.preload()).resolves.toBe("ready");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("keeps localized caches separate when one language needs a retry", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockImplementation(async (language) => language);
    const resource = makeLangResource<string>(loader);
    await expect(resource.preload("en")).rejects.toThrow("temporary");
    await expect(resource.preload("zh")).resolves.toBe("zh");
    await expect(resource.preload("en")).resolves.toBe("en");
    expect(resource.peek("en")).toBe("en");
    expect(resource.peek("zh")).toBe("zh");
  });
});
