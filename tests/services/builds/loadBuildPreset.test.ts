import { expect, it, vi } from "vitest";
import preset from "@/config/presets/builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
import { BUILTIN_BUILD_PRESET_ID } from "@/config/presets/ids";
import { loadBuildPreset } from "@/services/builds/loadBuildPreset";

vi.mock("@/domain/build/buildPresetRegistry", async () => {
  const { default: payload } = await import(
    "@/config/presets/builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json"
  );
  for (const build of Object.values(payload.builds)) Object.freeze(build);
  Object.freeze(payload);
  return {
    buildPresetModules: {
      "builtin:builds:all-characters": async () => ({ default: payload }),
    },
    getCachedBuildPreset: () => null,
    cacheBuildPreset: vi.fn(),
  };
});

it("loads concurrent presets from frozen JSON without mutating bundled inputs", async () => {
  const before = JSON.stringify(preset);
  const [first, second] = await Promise.all([
    loadBuildPreset(BUILTIN_BUILD_PRESET_ID),
    loadBuildPreset(BUILTIN_BUILD_PRESET_ID),
  ]);
  expect(first.version).toBe(5);
  expect(first.builds.FeFiQU8).toBeDefined();
  expect(first).not.toBe(preset);
  expect(second).not.toBe(first);
  expect(second).toEqual(first);
  expect(JSON.stringify(preset)).toBe(before);
});
