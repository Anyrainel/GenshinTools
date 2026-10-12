import { BUILTIN_BUILD_PRESET_ID } from "@/config/presets/ids";
import type { BuildPayload, BuildPayloadV5 } from "@/domain/models";

const modules = import.meta.glob<{ default: BuildPayload | BuildPayloadV5 }>(
  "@/config/presets/builds/*.json"
);

// Persist stable catalog identities, independent of Vite's source paths.
export const buildPresetModules: Record<
  string,
  () => Promise<{ default: BuildPayload | BuildPayloadV5 }>
> = {
  [BUILTIN_BUILD_PRESET_ID]:
    modules[
      "/src/config/presets/builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json"
    ],
};

// Cache for loaded presets
const loadedPresets: Record<string, BuildPayloadV5> = {};

export function cacheBuildPreset(idOrPath: string, payload: BuildPayloadV5) {
  loadedPresets[idOrPath] = payload;
  if (payload.id) {
    loadedPresets[payload.id] = payload;
  }
}

export function getCachedBuildPreset(
  idOrPath: string | null
): BuildPayloadV5 | null {
  if (!idOrPath) return null;
  return loadedPresets[idOrPath] || null;
}

export function getAvailablePresets() {
  return Object.keys(buildPresetModules);
}

export function getDefaultBuildPresetId(): string | null {
  return getAvailablePresets()[0] ?? null;
}
