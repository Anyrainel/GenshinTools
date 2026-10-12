import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLabPreview } from "@/providers/preview/labPreview";
import { loadLabPreview } from "../../../scripts/dev/vite-plugin-lab-preview";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("development experiment preview", () => {
  it("keeps saved selections and missing values unchanged", async () => {
    const data = await loadLabPreview(process.cwd());
    expect(data.drafts).toHaveLength(6);
    expect(data.drafts.every((draft) => draft.publication === "withheld")).toBe(
      true
    );
    expect(
      data.drafts[0].fields.find((field) => field.id === "weapon.selected")
    ).toMatchObject({ state: "unselected", value: null });
    expect(
      data.drafts[0].fields.find(
        (field) => field.id === "computation.energy-recharge"
      )
    ).toMatchObject({ state: "deferred-missing-not-zero", value: null });
    expect(
      data.sources.some(
        (source) =>
          source.characterId === "noelle" && source.status === "candidate"
      )
    ).toBe(true);
    expect(data.optimizer.length).toBeGreaterThan(0);
  });

  it("does not request experiment data in a production environment", async () => {
    vi.stubEnv("DEV", false);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(fetchLabPreview(new AbortController().signal)).rejects.toThrow(
      "development only"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces missing reports and rejects malformed previews", async () => {
    vi.stubEnv("DEV", true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    await expect(fetchLabPreview(new AbortController().signal)).rejects.toThrow(
      "500"
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ drafts: [] }) })
    );
    await expect(
      fetchLabPreview(new AbortController().signal)
    ).rejects.toThrow();
  });
});
