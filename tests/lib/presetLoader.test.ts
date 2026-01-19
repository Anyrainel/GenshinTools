import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { describe, expect, it, vi } from "vitest";

// Type for mock preset data - matches the generic constraint in presetLoader
type MockPreset = { author?: string; description?: string; data?: unknown[] };
type MockModules = Record<
  string,
  () => Promise<{ default: MockPreset } | MockPreset>
>;

describe("loadPresetMetadata", () => {
  it("extracts author and description when present", async () => {
    const mockModules: MockModules = {
      "/presets/test.json": () =>
        Promise.resolve({
          default: {
            author: "Test Author",
            description: "Test Description",
            data: [],
          },
        }),
    };

    const result = await loadPresetMetadata(mockModules);

    expect(result).toHaveLength(1);
    expect(result[0].author).toBe("Test Author");
    expect(result[0].description).toBe("Test Description");
    expect(result[0].label).toBe("[Test Author] Test Description");
    expect(result[0].path).toBe("/presets/test.json");
  });

  it("falls back to filename when metadata missing", async () => {
    const mockModules: MockModules = {
      "/presets/my-preset-file.json": () =>
        Promise.resolve({
          default: {}, // No author/description
        }),
    };

    const result = await loadPresetMetadata(mockModules);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("my preset file");
    expect(result[0].author).toBeUndefined();
    expect(result[0].description).toBeUndefined();
  });

  it("handles modules without default export", async () => {
    const mockModules: MockModules = {
      "/presets/direct.json": () =>
        Promise.resolve({
          author: "Direct Author",
          description: "Direct Desc",
        }),
    };

    const result = await loadPresetMetadata(mockModules);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("[Direct Author] Direct Desc");
  });

  it("sorts options alphabetically by label", async () => {
    const mockModules: MockModules = {
      "/presets/zeta.json": () =>
        Promise.resolve({ default: { author: "Z", description: "Zeta" } }),
      "/presets/alpha.json": () =>
        Promise.resolve({ default: { author: "A", description: "Alpha" } }),
      "/presets/beta.json": () =>
        Promise.resolve({ default: { author: "B", description: "Beta" } }),
    };

    const result = await loadPresetMetadata(mockModules);

    expect(result[0].label).toBe("[A] Alpha");
    expect(result[1].label).toBe("[B] Beta");
    expect(result[2].label).toBe("[Z] Zeta");
  });

  it("handles loader errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockModules: MockModules = {
      "/presets/broken.json": () => Promise.reject(new Error("Load failed")),
    };

    const result = await loadPresetMetadata(mockModules);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("broken");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("replaces underscores and hyphens with spaces in filename fallback", async () => {
    const mockModules: MockModules = {
      "/presets/my_preset-name.json": () => Promise.resolve({ default: {} }),
    };

    const result = await loadPresetMetadata(mockModules);

    expect(result[0].label).toBe("my preset name");
  });

  it("returns empty array for empty modules", async () => {
    const result = await loadPresetMetadata({});

    expect(result).toEqual([]);
  });
});

describe("loadPresetPayload", () => {
  it("loads payload from default export", async () => {
    const mockPayload = { builds: [], author: "Test" };
    const mockModules: MockModules = {
      "/presets/test.json": () => Promise.resolve({ default: mockPayload }),
    };

    const result = await loadPresetPayload(mockModules, "/presets/test.json");

    expect(result).toEqual(mockPayload);
  });

  it("loads payload from direct export (no default)", async () => {
    const mockPayload: MockPreset = { author: "Direct" };
    const mockModules: MockModules = {
      "/presets/direct.json": () => Promise.resolve(mockPayload),
    };

    const result = await loadPresetPayload(mockModules, "/presets/direct.json");

    expect(result).toEqual(mockPayload);
  });

  it("throws Error with descriptive message on missing path", async () => {
    const mockModules: MockModules = {
      "/presets/exists.json": () => Promise.resolve({ default: {} }),
    };

    await expect(
      loadPresetPayload(mockModules, "/presets/missing.json")
    ).rejects.toThrow("Preset not found for path: /presets/missing.json");
  });

  it("propagates loader errors", async () => {
    const mockModules: MockModules = {
      "/presets/broken.json": () => Promise.reject(new Error("Network error")),
    };

    await expect(
      loadPresetPayload(mockModules, "/presets/broken.json")
    ).rejects.toThrow("Network error");
  });
});
