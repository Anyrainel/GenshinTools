import type { BuildPayload, BuildPayloadV5 } from "@/domain/models";

// Import all presets eagerly or lazily?
// Current implementation in Page was lazy ({ eager: false }).
// Let's keep it lazy but provide a specific interface.
export const buildPresetModules = import.meta.glob<{
  default: BuildPayload | BuildPayloadV5;
}>("@/presets/artifact-builds/*.json");

// Cache for loaded presets
const loadedPresets: Record<string, BuildPayloadV5> = {};

/**
 * Loads a preset by its file path (which acts as ID basically).
 * In the new system, the ID inside the payload should match the filename?
 * Or we map ID -> Path.
 *
 * For now, we assume the Store stores the "Preset ID" which might be the filename
 * or the "id" field in the JSON.
 *
 * To facilitate ID lookup, we might need to load metadata first.
 */

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
