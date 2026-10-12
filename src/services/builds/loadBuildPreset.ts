import {
  buildPresetModules,
  cacheBuildPreset,
  getCachedBuildPreset,
} from "@/domain/build/buildPresetRegistry";
import type { BuildPayload, BuildPayloadV5 } from "@/domain/models";
import { migrateBuild } from "@/stores/migration/buildLegacy";
export async function loadBuildPreset(path: string): Promise<BuildPayloadV5> {
  if (getCachedBuildPreset(path)) return getCachedBuildPreset(path)!;

  const loader = buildPresetModules[path];
  if (!loader) throw new Error(`Preset not found: ${path}`);

  const mod = await loader();
  const payload = mod.default;

  // Normalize to V5
  const v5 = normalizeToV5(payload);

  // Run build-level migrations (e.g. legacy halfSet IDs)
  for (const build of Object.values(v5.builds)) {
    migrateBuild(build);
  }

  cacheBuildPreset(path, v5);

  return v5;
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
