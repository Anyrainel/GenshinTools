import type { BuildPayload, BuildPayloadV5 } from "@/data/types";
import { migrateBuild } from "./buildMigration";

// Import all presets eagerly or lazily?
// Current implementation in Page was lazy ({ eager: false }).
// Let's keep it lazy but provide a specific interface.
const presetModules = import.meta.glob<{
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

export async function loadPreset(path: string): Promise<BuildPayloadV5> {
  if (loadedPresets[path]) return loadedPresets[path];

  const loader = presetModules[path];
  if (!loader) throw new Error(`Preset not found: ${path}`);

  const mod = await loader();
  const payload = mod.default;

  // Normalize to V5
  const v5 = normalizeToV5(payload);

  // Run build-level migrations (e.g. legacy halfSet IDs)
  for (const build of Object.values(v5.builds)) {
    migrateBuild(build);
  }

  loadedPresets[path] = v5;

  // Also cache by internal ID if present
  if (v5.id) {
    loadedPresets[v5.id] = v5;
  }

  return v5;
}

export function getCachedPreset(
  idOrPath: string | null
): BuildPayloadV5 | null {
  if (!idOrPath) return null;
  return loadedPresets[idOrPath] || null;
}

function normalizeToV5(payload: BuildPayload | BuildPayloadV5): BuildPayloadV5 {
  if (payload.version === 5) {
    return payload as BuildPayloadV5;
  }

  // Convert V4 to V5
  const v4 = payload as BuildPayload;
  const v5: BuildPayloadV5 = {
    version: 5,
    id: `legacy-${Date.now()}`, // Or derive from filename if possible
    author: v4.author,
    description: v4.description,
    builds: {},
    characterBuilds: {},
    characterWeapons: {},
    computeOptions: v4.computeOptions,
  };

  for (const { characterId, builds, weapons } of v4.data) {
    const buildIds: string[] = [];
    for (const build of builds) {
      v5.builds[build.id] = { ...build, characterId };
      buildIds.push(build.id);
    }

    if (buildIds.length > 0) {
      v5.characterBuilds[characterId] = buildIds;
    }

    if (weapons?.length) {
      v5.characterWeapons[characterId] = weapons;
    }
  }

  return v5;
}

export function getAvailablePresets() {
  return Object.keys(presetModules);
}
